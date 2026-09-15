-- Second round of Disk IO reduction for the market analytics endpoints.
--
-- After precomputing combo_weekly_prices (which was 79.3% of all buffer work),
-- the remaining hot spots are:
--   * v_sold_reconciled, ~1.5M calls across three query shapes, 12.8% of total
--   * v_observed_traits, 574,470 calls at ~613 ms each, rebuilding a scan plus
--     unnest plus aggregate every time to return 116 rows
-- Both only change when a scrape lands, so both become materialized views.
--
-- Each keeps its existing name and column list, so PostgREST keeps serving
-- /rest/v1/v_observed_traits and /rest/v1/v_sold_reconciled unchanged and the
-- geck-data app needs no edit. Both callers of v_observed_traits already pass
-- an explicit .order("n"), so dropping the view's ORDER BY changes nothing.
--
-- Materialized views do not enforce RLS. That is not a change in exposure
-- here: market_listings, listings, listing_status_events and price_history
-- each have a single permissive "public read" policy with qual = true, and
-- anon already holds SELECT on all of them.

-- 1. Rebuild the dependency chain on top of a materialized v_observed_traits.
--    combo_weekly_prices_traits existed only because v_observed_traits was an
--    expensive view; it is redundant once the view itself is materialized.
drop materialized view if exists geck_data.combo_weekly_prices_mv;
drop materialized view if exists geck_data.combo_weekly_prices_traits;
drop view if exists geck_data.v_observed_traits;

create materialized view geck_data.v_observed_traits as
with split as (
  select trim(both from t.t) as trait,
         coalesce(ml.price_usd_equivalent, ml.price) as price
  from geck_data.market_listings ml,
       lateral unnest(string_to_array(ml.cached_traits, ',')) t(t)
  where ml.cached_traits is not null
    and ml.species = any (array['crested', 'unknown'])
    and coalesce(ml.price_usd_equivalent, ml.price) is not null
    and coalesce(ml.price_usd_equivalent, ml.price) > 0::double precision
    and coalesce(ml.price_usd_equivalent, ml.price) < 100000::double precision
)
select trait,
       count(*) as n,
       percentile_cont(0.5::double precision)
         within group (order by (price::double precision))::numeric as median_price
from split
where length(trait) >= 2 and length(trait) <= 60
group by trait
having count(*) >= 3;

create unique index v_observed_traits_pk on geck_data.v_observed_traits (trait);
create index v_observed_traits_n_idx on geck_data.v_observed_traits (n desc);

-- 2. Recreate the combo price precompute against the materialized trait list.
create materialized view geck_data.combo_weekly_prices_mv as
with listing_traits as (
  select ml.id as listing_id, t.trait
  from geck_data.market_listings ml
  cross join geck_data.v_observed_traits t
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

create unique index combo_weekly_prices_mv_pk
  on geck_data.combo_weekly_prices_mv (trait_a, trait_b, week_start);

-- 3. Point the RPC's vocabulary check at v_observed_traits.
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
  if p_trait_a is null or p_trait_b is null then
    return;
  end if;

  v_from_week := date_trunc('week', timezone('UTC', now())
    - make_interval(days => least(greatest(coalesce(window_days, 180), 1), 730)))::date;
  v_a := least(p_trait_a, p_trait_b);
  v_b := greatest(p_trait_a, p_trait_b);

  if exists (select 1 from geck_data.v_observed_traits t where t.trait = v_a)
     and exists (select 1 from geck_data.v_observed_traits t where t.trait = v_b)
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

-- 4. v_sold_reconciled: view -> materialized view. Only 2,932 rows, and the
--    three hot query shapes (sold_at ordering, days_to_sell threshold, and
--    cached_traits substring match) each rebuilt the whole union per call.
drop view if exists geck_data.v_sold_reconciled;

create materialized view geck_data.v_sold_reconciled as
select ml.id,
  ml.seller_id,
  ml.title,
  ml.price,
  ml.price_usd_equivalent,
  ml.maturity,
  ml.sex,
  ml.cached_traits,
  ml.first_seen_at,
  lse.observed_at as sold_at,
  'captured_event'::text as sold_basis,
  lse.source as sold_source,
  ml.is_group_lot,
  case
    when ml.first_seen_at is null then null::integer
    when (lse.observed_at - ml.first_seen_at) < '01:00:00'::interval then null::integer
    else round(extract(epoch from lse.observed_at - ml.first_seen_at) / 86400.0)::integer
  end as days_to_sell
from geck_data.market_listings ml
join geck_data.listing_status_events lse
  on lse.listing_id = ml.id and lse.status = 'sold'::text
union all
select ml.id,
  ml.seller_id,
  ml.title,
  ml.price,
  ml.price_usd_equivalent,
  ml.maturity,
  ml.sex,
  ml.cached_traits,
  ml.first_seen_at,
  l.sold_at,
  'inferred_unseen'::text as sold_basis,
  'scraper'::text as sold_source,
  ml.is_group_lot,
  case
    when ml.first_seen_at is null then null::integer
    when (l.sold_at - ml.first_seen_at) < '01:00:00'::interval then null::integer
    else round(extract(epoch from l.sold_at - ml.first_seen_at) / 86400.0)::integer
  end as days_to_sell
from geck_data.listings l
join geck_data.market_listings ml on ml.id = ('mm_'::text || l.listing_id)
where l.sold_at is not null
  and not exists (
    select 1 from geck_data.listing_status_events e
    where e.listing_id = ml.id and e.status = 'sold'::text
  );

create unique index v_sold_reconciled_pk
  on geck_data.v_sold_reconciled (id, sold_basis, sold_at);
create index v_sold_reconciled_sold_at_idx
  on geck_data.v_sold_reconciled (is_group_lot, sold_at desc);
create index v_sold_reconciled_days_idx
  on geck_data.v_sold_reconciled (is_group_lot, days_to_sell);
create index v_sold_reconciled_seller_idx
  on geck_data.v_sold_reconciled (seller_id);
create index v_sold_reconciled_traits_trgm
  on geck_data.v_sold_reconciled using gin (cached_traits extensions.gin_trgm_ops);

-- 5. One refresh entry point for the market matviews. v_observed_traits must
--    refresh before combo_weekly_prices_mv, which reads it.
drop function if exists geck_data.refresh_combo_weekly_prices();

create or replace function geck_data.refresh_market_matviews()
returns void
language sql
security definer
set search_path to 'pg_catalog', 'geck_data', 'extensions'
as $function$
  refresh materialized view concurrently geck_data.v_observed_traits;
  refresh materialized view concurrently geck_data.combo_weekly_prices_mv;
  refresh materialized view concurrently geck_data.v_sold_reconciled;
$function$;

-- 6. Grants. Matviews are read-only, so SELECT is the equivalent of the arwd
--    the views nominally carried.
grant select on geck_data.v_observed_traits to anon, authenticated, service_role;
grant select on geck_data.v_sold_reconciled to anon, authenticated, service_role;
grant select on geck_data.combo_weekly_prices_mv to anon, authenticated, service_role;
grant execute on function geck_data.refresh_market_matviews() to service_role;

-- 7. Refresh hourly rather than daily. These feed a market intelligence UI, so
--    capping staleness at an hour matters more than the few seconds of work,
--    and it is still ~1/60th of the per-minute cron load removed earlier.
do $cronjob$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-combo-weekly-prices') then
    perform cron.unschedule('refresh-combo-weekly-prices');
  end if;
  if exists (select 1 from cron.job where jobname = 'refresh-market-matviews') then
    perform cron.unschedule('refresh-market-matviews');
  end if;
  perform cron.schedule(
    'refresh-market-matviews',
    '20 * * * *',
    $cron$ select geck_data.refresh_market_matviews(); $cron$
  );
end
$cronjob$;

-- 8. service_role had no statement_timeout, so a pathological query from the
--    admin client could run unbounded. anon (3s) and authenticated (8s) are
--    already capped by Supabase defaults. 60s stays clear of legitimate batch
--    ingest and matview refreshes. Revert with:
--   alter role service_role reset statement_timeout;
alter role service_role set statement_timeout = '60s';
