-- Daily market snapshot (29 Sep 2026).
--
-- The market brief, the Dashboard's Today card, the Sunday digest and
-- watchlist alerts all need to say what changed since the last check
-- ("94 new, 61 cuts, 108 came down") and whether that is a busy or a slow
-- day. The existing trend data is weekly (listing_week_mv), so this adds
-- one row per day, per market, per morph.
--
-- Markets: US is MorphMarket listings priced in USD. KR (Feedle and the
-- Korean shops), JP (Repsuki) and EU (terraristik) come from the
-- cross-platform scrapers' daily observations. trait '' is every crested
-- listing; every other row is one canonical morph (Lilly White, Axanthic,
-- Sable ...), spelled the way the taxonomy spells it.
--
-- How to read a row:
--   checked         listings the scrapers looked at that day.
--   full_check      the day's check covered most of the market. MorphMarket
--                   only gets a full check when the catalog walk completes
--                   (weekly in May and June, daily once the Mac or the proxy
--                   job runs); smaller runs only find new listings.
--   for_sale, p25/p50/p75
--                   the market at the end of a full-check day, asking
--                   prices in USD. Null on other days, because a partial
--                   check only sees the listings it happened to read.
--   new_listings    first seen that day and, when MorphMarket gives a
--                   posting date, posted within 3 days of it. new_low is
--                   the part priced low for its kind (lowest quarter).
--   came_down, cuts, raises
--                   seen on a full-check day, covering the time since the
--                   previous full check (prev_full_day). Null on other days.
--   after_gap       the previous check was more than 3 days earlier, so the
--                   day's flows are a catch-up after an outage, not one
--                   day's change. Every flow is null on those days.
--
-- geck_data.after_scrape() refreshes the market views and rewrites today's
-- rows. It runs every hour from pg_cron, and within 5 minutes of a scraper
-- calling geck_data.request_after_scrape(): the refresh alone takes about
-- 50 seconds, close to the 60 second limit on API calls, so scrapers queue
-- a request instead of running it themselves.

-- 1. One spelling per morph. A synonym wins over another row's own name,
--    so 'lily white' maps to Lilly White and 'whitewall' to White Wall
--    (the taxonomy has a row for each spelling as well).
create or replace view geck_data.morph_term_map
with (security_invoker = true) as
select distinct on (t.term) t.term, t.canon
from (
  select m.norm_name as term, m.canonical_name as canon, 0 as pref
  from geck_data.crested_morph_taxonomy m
  union all
  select lower(s.s), m.canonical_name, 1
  from geck_data.crested_morph_taxonomy m,
       lateral unnest(m.synonyms) s(s)
) t
where coalesce(t.term, '') <> ''
order by t.term, t.pref desc, t.canon;

revoke all on geck_data.morph_term_map from anon, authenticated;
grant select on geck_data.morph_term_map to service_role;

-- 2. Canonical morphs and MorphMarket's own posting date per listing.
create materialized view if not exists geck_data.listing_facts_mv as
with lt as (
  select l.listing_id, mp.canon
  from geck_data.listings l
  cross join lateral unnest(coalesce(l.trait_array, '{}'::text[])) t(trait)
  join geck_data.morph_term_map mp on mp.term = lower(trim(t.trait))
),
morphs as (
  select lt.listing_id, geck_data._drop_contained(array_agg(distinct lt.canon)) as morphs
  from lt
  group by lt.listing_id
)
select l.listing_id,
       coalesce(m.morphs, '{}'::text[]) as morphs,
       ml.first_listed_at
from geck_data.listings l
left join morphs m using (listing_id)
left join geck_data.market_listings ml on ml.id = 'mm_' || l.listing_id;

create unique index if not exists listing_facts_mv_pk on geck_data.listing_facts_mv (listing_id);
create index if not exists listing_facts_mv_morphs on geck_data.listing_facts_mv using gin (morphs);

revoke all on geck_data.listing_facts_mv from anon, authenticated;
grant select on geck_data.listing_facts_mv to service_role;

-- 3. The daily table.
create table if not exists geck_data.market_daily (
  day date not null,
  market text not null,
  trait text not null default '',
  checked integer not null default 0,
  full_check boolean not null default false,
  for_sale integer,
  p25 numeric,
  p50 numeric,
  p75 numeric,
  new_listings integer,
  new_low integer,
  came_down integer,
  cuts integer,
  raises integer,
  median_cut_pct numeric,
  prev_check_day date,
  prev_full_day date,
  after_gap boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (day, market, trait)
);

alter table geck_data.market_daily enable row level security;
revoke all on geck_data.market_daily from anon, authenticated;
grant select, insert, update, delete on geck_data.market_daily to service_role;

create index if not exists market_daily_market_trait_day
  on geck_data.market_daily (market, trait, day desc);

-- 4. Rebuild one day's rows. Safe to rerun; run days in order when
--    backfilling, because freshness flags read the days before.
create or replace function geck_data.snapshot_market_day(p_day date)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_d0 timestamptz := p_day::timestamp at time zone 'UTC';
  v_d1 timestamptz := (p_day + 1)::timestamp at time zone 'UTC';
  v_rows integer;
begin
  delete from geck_data.market_daily where day = p_day;

  -- MorphMarket, USD listings, group lots left out.
  insert into geck_data.market_daily
    (day, market, trait, checked, for_sale, p25, p50, p75,
     new_listings, new_low, came_down, cuts, raises, median_cut_pct)
  with us as (
    select l.listing_id, l.first_seen_at, l.last_seen_at, l.sold_at, l.price, l.position,
           f.morphs, f.first_listed_at
    from geck_data.listing_market_mv l
    join geck_data.listing_facts_mv f using (listing_id)
    where l.currency = 'USD' and not l.is_lot
  ),
  ph as (
    select regexp_replace(h.listing_id, '^mm_', '') as listing_id,
           h.observed_at,
           h.price,
           lag(h.price) over (partition by h.listing_id order by h.observed_at) as prev
    from geck_data.price_history h
    where h.currency = 'USD'
      and h.price > 0 and h.price < 100000
      and h.observed_at < v_d1
  ),
  day_obs as (
    select ph.listing_id,
           bool_or(ph.prev is not null and ph.price < ph.prev) as cut,
           bool_or(ph.prev is not null and ph.price > ph.prev) as raised,
           max(case when ph.prev is not null and ph.price < ph.prev
                    then (ph.prev - ph.price) / ph.prev end) as cut_pct
    from ph
    where ph.observed_at >= v_d0
    group by ph.listing_id
  ),
  last_price as (
    select distinct on (ph.listing_id) ph.listing_id, ph.price
    from ph
    order by ph.listing_id, ph.observed_at desc
  ),
  flags as (
    select u.morphs,
           (u.first_seen_at >= v_d0 and u.first_seen_at < v_d1
             and (u.first_listed_at is null or u.first_listed_at >= v_d0 - interval '3 days')) as is_new,
           (u.sold_at >= v_d0 and u.sold_at < v_d1) as is_down,
           coalesce(o.cut, false) as cut,
           coalesce(o.raised, false) as raised,
           o.cut_pct,
           (o.listing_id is not null
             or (u.last_seen_at >= v_d0 and u.last_seen_at < v_d1)
             or (u.first_seen_at >= v_d0 and u.first_seen_at < v_d1)) as checked,
           (u.first_seen_at < v_d1 and u.last_seen_at >= v_d0
             and (u.sold_at is null or u.sold_at >= v_d1)) as for_sale,
           coalesce(lp.price, u.price) as price_at,
           u.position
    from us u
    left join day_obs o using (listing_id)
    left join last_price lp using (listing_id)
  )
  select p_day, 'US', t.trait,
         count(*) filter (where f.checked),
         count(*) filter (where f.for_sale),
         round((percentile_cont(0.25) within group (order by f.price_at) filter (where f.for_sale))::numeric, 0),
         round((percentile_cont(0.50) within group (order by f.price_at) filter (where f.for_sale))::numeric, 0),
         round((percentile_cont(0.75) within group (order by f.price_at) filter (where f.for_sale))::numeric, 0),
         count(*) filter (where f.is_new),
         count(*) filter (where f.is_new and f.position = 'low'),
         count(*) filter (where f.is_down),
         count(*) filter (where f.cut),
         count(*) filter (where f.raised),
         round((percentile_cont(0.5) within group (order by f.cut_pct) filter (where f.cut))::numeric, 3)
  from flags f
  cross join lateral unnest(array[''] || f.morphs) t(trait)
  group by t.trait
  having t.trait = ''
      or count(*) filter (where f.checked or f.for_sale or f.is_new or f.is_down) > 0;

  -- Korea, Japan and Europe from the cross-platform daily observations.
  insert into geck_data.market_daily
    (day, market, trait, checked, for_sale, p25, p50, p75,
     new_listings, new_low, came_down, cuts, raises, median_cut_pct)
  with obs as (
    select o.platform, o.external_id, o.observed_on, o.price, o.currency, o.sold,
           case when o.platform in ('feedle_kr', 'kr_shops') then 'KR'
                when o.platform = 'repsuki' then 'JP'
                else 'EU' end as market,
           lag(o.price) over w as prev_price,
           lag(o.sold) over w as prev_sold,
           min(o.observed_on) over (partition by o.platform, o.external_id) as first_on
    from geck_data.cross_platform_observations o
    where o.platform in ('feedle_kr', 'kr_shops', 'repsuki', 'terraristik')
      and o.observed_on <= p_day
    window w as (partition by o.platform, o.external_id order by o.observed_on)
  ),
  plat as (
    select ob.platform,
           min(ob.observed_on) as first_day,
           max(ob.observed_on) filter (where ob.observed_on < p_day) as prev_day,
           bool_or(ob.observed_on = p_day) as seen_today
    from obs ob
    group by ob.platform
  ),
  cp_morphs as (
    select tr.platform, tr.external_id,
           geck_data._drop_contained(array_agg(distinct mp.canon)) as morphs
    from geck_data.cross_platform_traits_mv tr
    cross join lateral unnest(tr.traits) x(t)
    join geck_data.morph_term_map mp on mp.term = lower(x.t)
    group by tr.platform, tr.external_id
  ),
  excluded as (
    select c.platform, c.external_id
    from geck_data.cross_platform_listings c
    where c.platform in ('feedle_kr', 'kr_shops', 'repsuki', 'terraristik')
      and (coalesce(c.species, 'crested') <> 'crested'
           or coalesce((c.payload ->> 'is_group_lot')::boolean, false))
  ),
  today as (
    select ob.* from obs ob where ob.observed_on = p_day
  ),
  vanished as (
    select ob.market, ob.platform, ob.external_id
    from obs ob
    join plat p on p.platform = ob.platform
    where p.seen_today
      and ob.observed_on = p.prev_day
      and not ob.sold
      and not exists (
        select 1 from today t2
        where t2.platform = ob.platform and t2.external_id = ob.external_id
      )
  ),
  flags as (
    select t.market, t.platform, t.external_id,
           true as checked,
           not t.sold as for_sale,
           (t.first_on = p_day and p_day > p.first_day) as is_new,
           (t.sold and t.prev_sold is false) as is_down,
           (t.prev_price is not null and t.price < t.prev_price) as cut,
           (t.prev_price is not null and t.price > t.prev_price) as raised,
           case when t.prev_price is not null and t.price < t.prev_price
                then (t.prev_price - t.price) / t.prev_price end as cut_pct,
           t.price / nullif(fx.per_usd, 0) as price_usd
    from today t
    join plat p on p.platform = t.platform
    left join geck_data.fx_rates fx on fx.currency = t.currency
    union all
    select v.market, v.platform, v.external_id,
           false, false, false, true, false, false, null::numeric, null::numeric
    from vanished v
  ),
  scoped as (
    select f.*, coalesce(m.morphs, '{}'::text[]) as morphs
    from flags f
    left join cp_morphs m on m.platform = f.platform and m.external_id = f.external_id
    where not exists (
      select 1 from excluded e
      where e.platform = f.platform and e.external_id = f.external_id
    )
  )
  select p_day, s.market, t.trait,
         count(*) filter (where s.checked),
         count(*) filter (where s.for_sale),
         round((percentile_cont(0.25) within group (order by s.price_usd) filter (where s.for_sale))::numeric, 0),
         round((percentile_cont(0.50) within group (order by s.price_usd) filter (where s.for_sale))::numeric, 0),
         round((percentile_cont(0.75) within group (order by s.price_usd) filter (where s.for_sale))::numeric, 0),
         count(*) filter (where s.is_new),
         null::integer,
         count(*) filter (where s.is_down),
         count(*) filter (where s.cut),
         count(*) filter (where s.raised),
         round((percentile_cont(0.5) within group (order by s.cut_pct) filter (where s.cut))::numeric, 3)
  from scoped s
  cross join lateral unnest(array[''] || s.morphs) t(trait)
  group by s.market, t.trait;

  -- Freshness flags per market, read from each market's all-morph row and
  -- the days before it, then applied to every morph row of that market.
  with m as (
    select md.market, md.checked, md.for_sale,
           (select max(p.day) from geck_data.market_daily p
             where p.market = md.market and p.trait = '' and p.day < p_day and p.checked > 0) as prev_check_day,
           (select max(p.day) from geck_data.market_daily p
             where p.market = md.market and p.trait = '' and p.day < p_day and p.full_check) as prev_full_day,
           (select max(p.for_sale) from geck_data.market_daily p
             where p.market = md.market and p.trait = '' and p.full_check
               and p.day < p_day and p.day >= p_day - 14) as recent_for_sale,
           (select max(p.checked) from geck_data.market_daily p
             where p.market = md.market and p.trait = ''
               and p.day < p_day and p.day >= p_day - 14) as recent_checked
    from geck_data.market_daily md
    where md.day = p_day and md.trait = ''
  ),
  f as (
    select m.market, m.checked as market_checked, m.prev_check_day, m.prev_full_day,
           case
             when m.checked = 0 then false
             when m.market = 'US'
               then m.checked >= greatest(1000, 0.5 * coalesce(m.recent_for_sale, 0))
             else m.checked >= 0.5 * coalesce(m.recent_checked, m.checked)
           end as full_check,
           (m.prev_check_day is null or p_day - m.prev_check_day > 3) as after_gap
    from m
  )
  update geck_data.market_daily md
     set full_check = f.full_check,
         prev_check_day = f.prev_check_day,
         prev_full_day = f.prev_full_day,
         after_gap = f.after_gap,
         for_sale = case when f.full_check then md.for_sale end,
         p25 = case when f.full_check then md.p25 end,
         p50 = case when f.full_check then md.p50 end,
         p75 = case when f.full_check then md.p75 end,
         new_listings = case when f.market_checked > 0 and not f.after_gap then md.new_listings end,
         new_low = case when f.market_checked > 0 and not f.after_gap then md.new_low end,
         came_down = case when f.full_check and not f.after_gap then md.came_down end,
         cuts = case when f.full_check and not f.after_gap then md.cuts end,
         raises = case when f.full_check and not f.after_gap then md.raises end,
         median_cut_pct = case when f.full_check and not f.after_gap then md.median_cut_pct end,
         computed_at = now()
    from f
   where md.day = p_day and md.market = f.market;

  select count(*) into v_rows from geck_data.market_daily where day = p_day;
  return v_rows;
end;
$$;

revoke all on function geck_data.snapshot_market_day(date) from public, anon, authenticated;
grant execute on function geck_data.snapshot_market_day(date) to service_role;

-- 5. The views the snapshot reads include listing_facts_mv now.
create or replace function geck_data.refresh_market_matviews()
returns void
language sql
security definer
set search_path to 'pg_catalog', 'geck_data', 'extensions'
as $$
  refresh materialized view concurrently geck_data.v_observed_traits;
  refresh materialized view concurrently geck_data.combo_weekly_prices_mv;
  refresh materialized view concurrently geck_data.v_sold_reconciled;
  refresh materialized view concurrently geck_data.listing_market_mv;
  refresh materialized view concurrently geck_data.listing_week_mv;
  refresh materialized view concurrently geck_data.cross_platform_traits_mv;
  refresh materialized view concurrently geck_data.market_asks_mv;
  refresh materialized view concurrently geck_data.listing_facts_mv;
$$;

-- 6. What runs after a scrape, and the queue scrapers use to ask for it.
create table if not exists geck_data.after_scrape_requests (
  id bigint generated always as identity primary key,
  source text not null default 'unknown',
  requested_at timestamptz not null default now(),
  handled_at timestamptz
);

alter table geck_data.after_scrape_requests enable row level security;
revoke all on geck_data.after_scrape_requests from anon, authenticated;
grant select, insert, update on geck_data.after_scrape_requests to service_role;

create table if not exists geck_data.after_scrape_runs (
  id bigint generated always as identity primary key,
  trigger text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb
);

alter table geck_data.after_scrape_runs enable row level security;
revoke all on geck_data.after_scrape_runs from anon, authenticated;
grant select on geck_data.after_scrape_runs to service_role;

create or replace function geck_data.after_scrape(p_trigger text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_run bigint;
  v_today date := (now() at time zone 'UTC')::date;
  v_rows integer;
  v_result jsonb;
begin
  -- One run at a time; a second caller waits for the first to finish.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('geck_data.after_scrape'));

  insert into geck_data.after_scrape_runs (trigger) values (left(coalesce(p_trigger, 'manual'), 40))
  returning id into v_run;

  perform geck_data.refresh_market_matviews();

  -- A failed snapshot must not undo the refresh the site depends on, so
  -- it runs in its own block and reports the error instead.
  begin
    -- A scrape that runs past midnight UTC still belongs to the day it
    -- started, so yesterday is rebuilt during the first hours of a day.
    if extract(hour from now() at time zone 'UTC') < 6 then
      perform geck_data.snapshot_market_day(v_today - 1);
    end if;
    v_rows := geck_data.snapshot_market_day(v_today);
    v_result := jsonb_build_object('snapshot_rows', v_rows);
  exception when others then
    v_result := jsonb_build_object('snapshot_error', sqlerrm);
  end;

  update geck_data.after_scrape_runs
     set finished_at = now(), result = v_result
   where id = v_run;
  return v_result;
end;
$$;

revoke all on function geck_data.after_scrape(text) from public, anon, authenticated;
grant execute on function geck_data.after_scrape(text) to service_role;

create or replace function geck_data.request_after_scrape(p_source text default 'unknown')
returns void
language sql
security definer
set search_path to ''
as $$
  insert into geck_data.after_scrape_requests (source)
  values (left(coalesce(nullif(trim(p_source), ''), 'unknown'), 80));
$$;

revoke all on function geck_data.request_after_scrape(text) from public, anon, authenticated;
grant execute on function geck_data.request_after_scrape(text) to service_role;

create or replace function geck_data.run_requested_after_scrape()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_taken integer;
begin
  with taken as (
    update geck_data.after_scrape_requests r
       set handled_at = now()
     where r.id in (
       select q.id from geck_data.after_scrape_requests q
        where q.handled_at is null
        for update skip locked
     )
    returning 1
  )
  select count(*) into v_taken from taken;

  if v_taken = 0 then
    return jsonb_build_object('requests', 0);
  end if;
  return geck_data.after_scrape('requested') || jsonb_build_object('requests', v_taken);
end;
$$;

revoke all on function geck_data.run_requested_after_scrape() from public, anon, authenticated;
grant execute on function geck_data.run_requested_after_scrape() to service_role;
