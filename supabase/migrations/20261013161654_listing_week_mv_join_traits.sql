-- Speed up listing_week_mv (13 Oct 2026).
--
-- The view looked up each row's trait_array with a correlated subquery
-- against the filtered listings CTE. The planner guessed that CTE at about
-- 100 rows and scanned all ~15,000 of them once per output row (~42,000),
-- so the refresh grew past 55 seconds and pushed the hourly market refresh
-- (geck_data.after_scrape) over its 120 second statement timeout for days.
-- Joining the traits once after grouping gives identical rows in about
-- 1.5 seconds, and the full refresh drops from ~120 to ~40 seconds.
--
-- The Supabase MCP tool holds DROP statements for a confirmation it cannot
-- show, so the new view was built under a temporary name and swapped in by
-- renaming. The old copy stays as geck_data.listing_week_mv_old with no
-- grants and is never refreshed. Drop it by hand in the SQL editor:
--   drop materialized view geck_data.listing_week_mv_old;
--
-- Functions that read the view (market_trend, market_weekly, compare_trends,
-- refresh_market_matviews) resolve it by name at run time and need no change.
set local lock_timeout = '10s';

create materialized view geck_data.listing_week_mv_new as
with obs as (
  select regexp_replace(h.listing_id, '^mm_', '') as listing_id,
         h.observed_at,
         h.price
  from geck_data.price_history h
  where h.currency = 'USD' and h.price > 0 and h.price < 100000
),
l as (
  select l.listing_id, l.trait_array
  from geck_data.listings l
  where coalesce(l.species, 'unknown') = any (array['crested', 'unknown'])
    and not geck_data._looks_like_group_lot(l.name, false)
),
o as (
  select o_1.listing_id, o_1.observed_at, o_1.price,
         lag(o_1.price) over (partition by o_1.listing_id order by o_1.observed_at) as prev
  from obs o_1
  join l using (listing_id)
),
w as (
  select date_trunc('week', o.observed_at)::date as week,
         o.listing_id,
         (array_agg(o.price order by o.observed_at desc))[1] as price,
         bool_or(o.prev is not null and o.price < o.prev) as cut,
         bool_or(o.prev is not null and o.price > o.prev) as raised,
         min(case when o.prev is not null and o.price < o.prev
                  then (o.prev - o.price) / o.prev end) as cut_pct
  from o
  group by 1, 2
)
select w.week, w.listing_id, w.price, w.cut, w.raised, w.cut_pct, l.trait_array
from w
join l using (listing_id);

create unique index listing_week_mv_new_pk on geck_data.listing_week_mv_new using btree (week, listing_id);
create index listing_week_mv_new_traits on geck_data.listing_week_mv_new using gin (trait_array);

revoke all on geck_data.listing_week_mv_new from public;
grant select on geck_data.listing_week_mv_new to anon, authenticated;

alter materialized view geck_data.listing_week_mv rename to listing_week_mv_old;
alter index geck_data.listing_week_mv_pk rename to listing_week_mv_old_pk;
alter index geck_data.listing_week_mv_traits rename to listing_week_mv_old_traits;
revoke select on geck_data.listing_week_mv_old from anon, authenticated;

alter materialized view geck_data.listing_week_mv_new rename to listing_week_mv;
alter index geck_data.listing_week_mv_new_pk rename to listing_week_mv_pk;
alter index geck_data.listing_week_mv_new_traits rename to listing_week_mv_traits;
