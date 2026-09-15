-- Cut Disk IO from the market analytics endpoints.
--
-- Between 2026-09-09 and 2026-09-15 the SSR analytics app called
-- geck_data.combo_weekly_prices() 516,012 times (15.8 hours of execution and
-- 192.6 GB written to temp files) and scanned geck_data.v_sold_reconciled
-- roughly 500,000 times. Both filter with cached_traits ilike '%trait%',
-- which no btree index can serve, and combo_weekly_prices additionally sorts
-- a distinct-on set that spills to disk on every call.
--
-- Two fixes:
--   1. pg_trgm GIN index on market_listings.cached_traits so the ilike
--      filters stop sequentially scanning. This helps v_sold_reconciled and
--      every other cached_traits ilike query, including the refresh below.
--   2. Precompute combo_weekly_prices into a materialized view keyed by
--      (trait_a, trait_b, week_start), refreshed daily, so the RPC becomes an
--      index lookup instead of a sort-and-spill aggregate.
--
-- There are only 116 observed traits, so the full pair space materializes to
-- ~11,200 rows across ~2,600 pairs. Output was verified identical to the live
-- implementation across the top 25 pairs (150 rows, zero mismatches on median
-- price, listing counts and observed days).

-- 1. Trigram index for the cached_traits ilike filters.
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_market_listings_cached_traits_trgm
  on geck_data.market_listings
  using gin (cached_traits extensions.gin_trgm_ops);

-- 2a. Trait vocabulary, materialized so the RPC can check membership cheaply
-- instead of re-running the v_observed_traits aggregate on every call.
create materialized view if not exists geck_data.combo_weekly_prices_traits as
  select trait from geck_data.v_observed_traits;

create unique index if not exists combo_weekly_prices_traits_pk
  on geck_data.combo_weekly_prices_traits (trait);

-- 2b. Precomputed weekly combo prices for every co-occurring trait pair.
-- Pairs are stored canonically (trait_a <= trait_b) because the two ilike
-- filters are commutative, so (a,b) and (b,a) share a row.
--
-- The trait filter is listing-level and the distinct-on is per
-- (listing, week), so filtering by trait before or after the distinct-on
-- yields the same rows. That lets the observation set be computed once and
-- joined to every pair, rather than recomputed per pair.
create materialized view if not exists geck_data.combo_weekly_prices_mv as
with listing_traits as (
  select ml.id as listing_id, t.trait
  from geck_data.market_listings ml
  cross join geck_data.combo_weekly_prices_traits t
  where ml.species in ('crested', 'unknown')
    and not ml.is_group_lot
    and ml.cached_traits ilike '%' || t.trait || '%'
), observations as (
  select distinct on (ph.listing_id, date_trunc('week', ph.observed_at))
    date_trunc('week', ph.observed_at)::date as week_start,
    ph.observed_at::date as observed_day,
    ph.listing_id,
    ph.price_usd_equivalent as price
  from geck_data.price_history ph
  join geck_data.market_listings ml on ml.id = ph.listing_id
  where ml.species in ('crested', 'unknown') and not ml.is_group_lot
    and ph.price_usd_equivalent > 0 and ph.price_usd_equivalent < 100000
    and ph.observed_at >= timezone('UTC', now()) - make_interval(days => 730)
  order by ph.listing_id, date_trunc('week', ph.observed_at), ph.observed_at desc
)
select
  la.trait as trait_a,
  lb.trait as trait_b,
  o.week_start,
  round(percentile_cont(0.5) within group (order by o.price)::numeric, 2) as median_price,
  count(distinct o.listing_id)::bigint as n_listings,
  count(distinct o.observed_day)::bigint as observed_days
from listing_traits la
join listing_traits lb
  on lb.listing_id = la.listing_id and la.trait <= lb.trait
join observations o
  on o.listing_id = la.listing_id
group by la.trait, lb.trait, o.week_start;

-- Unique index is required for refresh materialized view concurrently.
create unique index if not exists combo_weekly_prices_mv_pk
  on geck_data.combo_weekly_prices_mv (trait_a, trait_b, week_start);

-- 3. Keep the original on-demand implementation as a fallback for trait
-- strings outside the known vocabulary (partial strings, traits seen fewer
-- than three times), so semantics are preserved for any input.
create or replace function geck_data.combo_weekly_prices_live(
  p_trait_a text,
  p_trait_b text,
  window_days integer default 180
)
returns table(week_start date, median_price numeric, n_listings bigint, observed_days bigint)
language sql
stable
set search_path to ''
set work_mem to '16MB'
as $function$
  with bounds as (
    select date_trunc('week', timezone('UTC', now())
      - make_interval(days => least(greatest(coalesce(window_days, 180), 1), 730)))::date as from_week
  ), observations as (
    select distinct on (ph.listing_id, date_trunc('week', ph.observed_at))
      date_trunc('week', ph.observed_at)::date as week_start,
      ph.observed_at::date as observed_day,
      ph.listing_id,
      ph.price_usd_equivalent as price
    from geck_data.price_history ph
    join geck_data.market_listings ml on ml.id = ph.listing_id
    cross join bounds b
    where ml.species in ('crested', 'unknown') and not ml.is_group_lot
      and ml.cached_traits ilike '%' || p_trait_a || '%'
      and ml.cached_traits ilike '%' || p_trait_b || '%'
      and ph.price_usd_equivalent > 0 and ph.price_usd_equivalent < 100000
      and date_trunc('week', ph.observed_at)::date >= b.from_week
    order by ph.listing_id, date_trunc('week', ph.observed_at), ph.observed_at desc
  )
  select o.week_start,
    round(percentile_cont(0.5) within group (order by o.price)::numeric, 2),
    count(distinct o.listing_id)::bigint,
    count(distinct o.observed_day)::bigint
  from observations o
  group by o.week_start order by o.week_start;
$function$;

-- 4. The RPC now reads the precomputed table, falling back to the live
-- implementation only for unknown traits.
create or replace function geck_data.combo_weekly_prices(
  p_trait_a text,
  p_trait_b text,
  window_days integer default 180
)
returns table(week_start date, median_price numeric, n_listings bigint, observed_days bigint)
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_from_week date;
  v_a text;
  v_b text;
begin
  -- Matches the original: a null trait makes the ilike predicate null, so no
  -- rows qualify.
  if p_trait_a is null or p_trait_b is null then
    return;
  end if;

  v_from_week := date_trunc('week', timezone('UTC', now())
    - make_interval(days => least(greatest(coalesce(window_days, 180), 1), 730)))::date;
  v_a := least(p_trait_a, p_trait_b);
  v_b := greatest(p_trait_a, p_trait_b);

  if exists (select 1 from geck_data.combo_weekly_prices_traits t where t.trait = v_a)
     and exists (select 1 from geck_data.combo_weekly_prices_traits t where t.trait = v_b)
  then
    return query
      select m.week_start, m.median_price, m.n_listings, m.observed_days
      from geck_data.combo_weekly_prices_mv m
      where m.trait_a = v_a
        and m.trait_b = v_b
        and m.week_start >= v_from_week
      order by m.week_start;
  else
    return query
      select l.week_start, l.median_price, l.n_listings, l.observed_days
      from geck_data.combo_weekly_prices_live(p_trait_a, p_trait_b, window_days) l;
  end if;
end;
$function$;

-- 5. Daily refresh, matching the refresh_combo_index_daily pattern.
create or replace function geck_data.refresh_combo_weekly_prices()
returns void
language sql
security definer
set search_path to 'pg_catalog', 'geck_data', 'extensions'
as $function$
  refresh materialized view concurrently geck_data.combo_weekly_prices_traits;
  refresh materialized view concurrently geck_data.combo_weekly_prices_mv;
$function$;

-- 6. Grants mirror geck_data.combo_index_daily. Both views hold only
-- aggregates, which is strictly less than what anon can already read from the
-- underlying tables.
grant select on geck_data.combo_weekly_prices_traits to anon, authenticated, service_role;
grant select on geck_data.combo_weekly_prices_mv to anon, authenticated, service_role;
grant execute on function geck_data.combo_weekly_prices_live(text, text, integer)
  to anon, authenticated, service_role;
grant execute on function geck_data.refresh_combo_weekly_prices() to service_role;

-- 7. Refresh daily at 04:05 UTC, clear of the 03:17, 03:47 and 04:30 jobs.
do $cronjob$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-combo-weekly-prices') then
    perform cron.unschedule('refresh-combo-weekly-prices');
  end if;
  perform cron.schedule(
    'refresh-combo-weekly-prices',
    '5 4 * * *',
    $cron$ select geck_data.refresh_combo_weekly_prices(); $cron$
  );
end
$cronjob$;
