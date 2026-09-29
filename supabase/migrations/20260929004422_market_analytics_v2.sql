-- Market Analytics v2 aggregates for Business Tools.
--
-- The Market Analytics tab read a JSON snapshot from the Geck Data site
-- and computed everything in the browser. That snapshot is not shaped for
-- the questions the tab now asks (trait by age, weekly asks, spring vs
-- recent, seller concentration), and the old views came up empty on real
-- data. This function returns the whole dashboard as one jsonb object in
-- the shape documented in src/lib/marketAnalytics/v2/demoAggregates.js.
-- The design demo is built from a saved copy of this function's output,
-- so the demo and the live tab show the same numbers.
--
-- Scope mirrors public.trait_value_table: geck_data.listings, crested or
-- unknown species, USD, no group lots, traits limited to the
-- crested_morph_taxonomy vocabulary. Prices outside $20 to $20,000 are
-- placeholder asks (one is $1,000,000) and are counted, then left out.
--
-- Periods adapt to the data: "recent" is the last 28 days before the
-- newest listing, "earlier" is everything before that. Sales are inferred
-- when a listing flips to sold between scrapes, so sell-through and days
-- to sell only describe the weeks the collector was running.
--
-- Seller names are not returned. The tab shows sellers by rank only.
--
-- Cost: a few scans of ~10k listings, well under a second. The client
-- caches the result for 30 minutes.
--
-- security definer because authenticated users have no direct grant on
-- the geck_data tables it reads; it only returns aggregates.

create or replace function public.market_analytics_v2()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
with taxo as (
  select m.norm_name,
         array(select lower(s.s) from unnest(m.synonyms) s(s)) as syns
  from geck_data.crested_morph_taxonomy m
),
names as (
  select tx.norm_name as norm from taxo tx
  union
  select unnest(tx.syns) from taxo tx
),
scope as (
  select l.listing_id,
         l.price::float8 as price,
         l.trait_array,
         l.first_seen_at,
         l.last_seen_at,
         l.sold_at,
         nullif(trim(coalesce(l.seller_slug, l.seller_name)), '') as seller,
         geck_data._age_class(l.maturity) as age_raw
  from geck_data.listings l
  where coalesce(l.species, 'unknown') = any (array['crested', 'unknown'])
    and l.currency = 'USD'
    and l.price > 0
    and l.first_seen_at is not null
    and not geck_data._looks_like_group_lot(l.name, false)
),
base as (
  select s.*,
         case s.age_raw when 'hatchling' then 'baby' else coalesce(s.age_raw, 'unknown') end as age,
         case when s.sold_at is not null and s.sold_at - s.first_seen_at > interval '1 hour'
              then extract(epoch from (s.sold_at - s.first_seen_at)) / 86400.0 end as days_to_sell
  from scope s
  where s.price between 20 and 20000
),
bounds as (
  select min(b.first_seen_at) as first_seen,
         greatest(max(b.first_seen_at), max(b.last_seen_at)) as last_seen,
         min(b.sold_at) as sold_from,
         max(b.sold_at) as sold_to,
         date_trunc('day', greatest(max(b.first_seen_at), max(b.last_seen_at))) - interval '28 days' as recent_from,
         (select count(*) from scope s where s.price < 20 or s.price > 20000) as outliers
  from base b
),
weeks as (
  select w.wk,
         coalesce(f.n, 0) as listings,
         f.med,
         coalesce(so.sold, 0) as sold
  from (
    select date_trunc('week', b.first_seen_at)::date as wk from base b
    union
    select date_trunc('week', b.sold_at)::date from base b where b.sold_at is not null
  ) w
  left join (
    select date_trunc('week', b.first_seen_at)::date as wk, count(*) as n,
           percentile_cont(0.5) within group (order by b.price) as med
    from base b group by 1
  ) f on f.wk = w.wk
  left join (
    select date_trunc('week', b.sold_at)::date as wk, count(*) as sold
    from base b where b.sold_at is not null group by 1
  ) so on so.wk = w.wk
),
lt as (
  select distinct on (b.listing_id, lower(trim(t.trait)))
         b.*,
         lower(trim(t.trait)) as trait_key,
         trim(t.trait) as trait_label
  from base b,
       lateral unnest(b.trait_array) t(trait)
  where lower(trim(t.trait)) in (select names.norm from names)
    and t.trait not ilike 'Diet:%'
    and t.trait not ilike 'Proven breeder%'
),
ts as (
  select lt.trait_key,
         mode() within group (order by lt.trait_label) as name,
         count(*) as n,
         count(*) filter (where lt.sold_at is not null) as sold,
         percentile_cont(0.5) within group (order by lt.price) as med,
         percentile_cont(0.25) within group (order by lt.price) as p25,
         percentile_cont(0.75) within group (order by lt.price) as p75,
         avg(lt.days_to_sell) as days,
         count(*) filter (where lt.sold_at is not null and lt.first_seen_at <= bd.sold_to)::float8
           / nullif(count(*) filter (where lt.first_seen_at <= bd.sold_to), 0) as sell_through,
         count(*) filter (where lt.first_seen_at < bd.recent_from) as earlier_n,
         percentile_cont(0.5) within group (order by lt.price) filter (where lt.first_seen_at < bd.recent_from) as earlier_med,
         count(*) filter (where lt.first_seen_at >= bd.recent_from) as recent_n,
         percentile_cont(0.5) within group (order by lt.price) filter (where lt.first_seen_at >= bd.recent_from) as recent_med
  from lt cross join bounds bd
  group by lt.trait_key
  having count(*) >= 60
  order by count(*) desc
  limit 32
),
tw as (
  select lt.trait_key, date_trunc('week', lt.first_seen_at)::date as wk, count(*) as n,
         percentile_cont(0.5) within group (order by lt.price) as med
  from lt where lt.trait_key in (select ts.trait_key from ts)
  group by 1, 2
),
ta as (
  select lt.trait_key, lt.age, count(*) as n,
         percentile_cont(0.5) within group (order by lt.price) as med
  from lt where lt.age <> 'unknown' and lt.trait_key in (select ts.trait_key from ts)
  group by 1, 2
),
ta_ok as (
  select ta.trait_key from ta where ta.n >= 5 group by ta.trait_key having count(*) = 4
),
ages as (
  select b.age, count(*) as n,
         percentile_cont(0.5) within group (order by b.price) as med,
         count(*) filter (where b.sold_at is not null) as sold,
         avg(b.days_to_sell) as days
  from base b group by b.age
),
sel as (
  select b.seller, count(*) as n,
         count(*) filter (where b.sold_at is not null) as sold,
         coalesce(sum(b.price) filter (where b.sold_at is not null), 0) as rev,
         percentile_cont(0.5) within group (order by b.price) as med
  from base b where b.seller is not null group by b.seller
),
selrank as (
  select sel.*,
         row_number() over (order by sel.rev desc, sel.n desc) as rk,
         sel.rev / nullif(sum(sel.rev) over (), 0) as sh
  from sel
)
select jsonb_build_object(
  'generated_at', now(),
  'source', jsonb_build_object('id', 'external.morphmarket', 'label', 'MorphMarket listings, United States', 'collector', 'Geck Data'),
  'coverage', (
    select jsonb_build_object(
      'first_seen', bd.first_seen::date,
      'last_seen', bd.last_seen::date,
      'sold_window', case when bd.sold_from is null then null
                          else jsonb_build_object('from', bd.sold_from::date, 'to', bd.sold_to::date) end,
      'excluded_outliers', bd.outliers,
      'weeks', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'week', w.wk, 'listings', w.listings,
                 'median_ask', round(w.med::numeric), 'sold', w.sold) order by w.wk)
        from weeks w), '[]'::jsonb)
    ) from bounds bd
  ),
  'periods', (
    select jsonb_build_object(
      'earlier', jsonb_build_object('from', bd.first_seen::date, 'to', (bd.recent_from - interval '1 day')::date),
      'recent', jsonb_build_object('from', bd.recent_from::date, 'to', bd.last_seen::date)
    ) from bounds bd
  ),
  'kpis', (
    select jsonb_build_object(
      'listings', count(*),
      'sold', count(*) filter (where b.sold_at is not null),
      'median_ask', round((percentile_cont(0.5) within group (order by b.price))::numeric),
      'sold_value', round(coalesce(sum(b.price) filter (where b.sold_at is not null), 0)::numeric),
      'sell_through', round((count(*) filter (where b.sold_at is not null and b.first_seen_at <= bd.sold_to)::numeric
                        / nullif(count(*) filter (where b.first_seen_at <= bd.sold_to), 0)), 3),
      'avg_days_to_sell', round(avg(b.days_to_sell)::numeric),
      'sellers', (select count(*) from sel)
    ) from base b cross join bounds bd group by bd.sold_to
  ),
  'ages', coalesce((
    select jsonb_agg(jsonb_build_object(
             'code', a.age,
             'n', a.n, 'median', round(a.med::numeric), 'sold', a.sold, 'days', round(a.days::numeric))
           order by array_position(array['baby', 'juvenile', 'subadult', 'adult', 'unknown'], a.age))
    from ages a), '[]'::jsonb),
  'traits', coalesce((
    select jsonb_agg(jsonb_build_object(
             'name', ts.name,
             'n', ts.n, 'sold', ts.sold,
             'median', round(ts.med::numeric), 'p25', round(ts.p25::numeric), 'p75', round(ts.p75::numeric),
             'days', round(ts.days::numeric),
             'sell_through', round(ts.sell_through::numeric, 3),
             'earlier', jsonb_build_array(ts.earlier_n, round(ts.earlier_med::numeric)),
             'recent', jsonb_build_array(ts.recent_n, round(ts.recent_med::numeric)),
             'weekly', (select jsonb_object_agg(tw.wk, jsonb_build_array(tw.n, round(tw.med::numeric)))
                        from tw where tw.trait_key = ts.trait_key),
             'by_age', case when ts.trait_key in (select ta_ok.trait_key from ta_ok) then
                         (select jsonb_object_agg(ta.age, jsonb_build_array(ta.n, round(ta.med::numeric)))
                          from ta where ta.trait_key = ts.trait_key)
                       end
           ) order by ts.n desc)
    from ts), '[]'::jsonb),
  'sellers', (
    select jsonb_build_object(
      'total', count(*),
      'with_a_sale', count(*) filter (where sr.sold > 0),
      'unattributed_listings', (select count(*) from base b where b.seller is null),
      'attributed_sold_value', round(sum(sr.rev)::numeric),
      'top10_share', round(coalesce(sum(sr.sh) filter (where sr.rk <= 10), 0)::numeric, 3),
      'top50_share', round(coalesce(sum(sr.sh) filter (where sr.rk <= 50), 0)::numeric, 3),
      'hhi', round(coalesce(sum(power(sr.sh * 100, 2)), 0)::numeric),
      'size_buckets', jsonb_build_array(
        jsonb_build_object('label', '1 listing', 'sellers', count(*) filter (where sr.n = 1)),
        jsonb_build_object('label', '2 to 5', 'sellers', count(*) filter (where sr.n between 2 and 5)),
        jsonb_build_object('label', '6 to 20', 'sellers', count(*) filter (where sr.n between 6 and 20)),
        jsonb_build_object('label', '21 or more', 'sellers', count(*) filter (where sr.n > 20))
      ),
      'top', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'rank', t.rk, 'listings', t.n, 'sold', t.sold,
                 'sold_value', round(t.rev::numeric), 'median', round(t.med::numeric)) order by t.rk)
        from selrank t where t.rk <= 10 and t.rev > 0), '[]'::jsonb)
    ) from selrank sr
  )
)
;
$function$;

comment on function public.market_analytics_v2() is
  'Business Tools Market Analytics dashboard as one jsonb object: coverage, periods, KPIs, per-trait prices by age and week, seller concentration. Asking prices from geck_data.listings.';

revoke all on function public.market_analytics_v2() from public, anon;
grant execute on function public.market_analytics_v2() to authenticated, service_role;
