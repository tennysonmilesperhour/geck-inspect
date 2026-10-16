-- geck_data objects that production has but no runnable migration creates
-- (built by the geck-data scraper repo or by hand). Copied from production
-- catalog reads on 2026-10-15 and applied right after the baseline dump, so
-- the guarded market migrations (which skip when these are missing) replay
-- the same way they ran in production.
-- None of this touches member data or row-level security on public tables.

set check_function_bodies = off;

-- ---------------------------------------------------------------- functions
CREATE OR REPLACE FUNCTION geck_data._age_class(p_maturity text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case lower(coalesce(p_maturity, ''))
    when 'baby' then 'hatchling' when 'hatchling' then 'hatchling'
    when 'juvenile' then 'juvenile' when 'subadult' then 'subadult'
    when 'adult' then 'adult' else null end;
$function$
;
CREATE OR REPLACE FUNCTION geck_data._drop_contained(p_traits text[])
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(distinct a order by a), '{}')
  from unnest(p_traits) a
  where not exists (
    select 1 from unnest(p_traits) b
    where b <> a and position(lower(a) in lower(b)) > 0
  );
$function$
;
CREATE OR REPLACE FUNCTION geck_data._sex_class(p_sex text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case lower(coalesce(p_sex, ''))
    when 'male' then 'male' when 'female' then 'female'
    when 'mixed' then null else 'unsexed' end;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.asking_price_band(p_traits text[])
 RETURNS TABLE(n bigint, p10 numeric, p25 numeric, p50 numeric, p75 numeric, p90 numeric, n_sellers bigint, newest_seen_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select count(*),
    round(percentile_cont(0.10) within group (order by l.price)::numeric, 0),
    round(percentile_cont(0.25) within group (order by l.price)::numeric, 0),
    round(percentile_cont(0.50) within group (order by l.price)::numeric, 0),
    round(percentile_cont(0.75) within group (order by l.price)::numeric, 0),
    round(percentile_cont(0.90) within group (order by l.price)::numeric, 0),
    count(distinct l.seller_slug), max(l.last_seen_at)
  from geck_data.listings l
  where l.is_active and l.sold_at is null
    and coalesce(l.species, 'unknown') in ('crested', 'unknown')
    and l.currency = 'USD' and l.price > 0 and l.price < 100000
    and l.trait_array @> coalesce(p_traits, '{}'::text[]);
$function$
;
CREATE OR REPLACE FUNCTION geck_data.breeder_summary()
 RETURNS TABLE(seller_slug text, name text, location text, avatar_url text, for_sale bigint, ask_p50 numeric, sold bigint, top_traits text[], last_seen_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with base as (
    select l.*, (l.is_active and l.sold_at is null) as for_sale_now
    from geck_data.listings l
    where l.seller_slug is not null and l.seller_slug <> ''
      and coalesce(l.species, 'unknown') in ('crested', 'unknown')
      and l.price > 0 and l.price < 100000
  ),
  agg as (
    select b.seller_slug, max(b.seller_name) as seller_name,
      count(*) filter (where b.for_sale_now) as for_sale,
      round(percentile_cont(0.5) within group (order by b.price) filter (where b.for_sale_now and b.currency = 'USD')::numeric, 0) as ask_p50,
      count(*) filter (where b.sold_at is not null) as sold,
      max(b.last_seen_at) as last_seen_at
    from base b group by b.seller_slug
  ),
  traits as (
    select b.seller_slug, t.trait, count(*) as n
    from base b, unnest(b.trait_array) t(trait) where b.for_sale_now group by 1, 2
  ),
  names as (
    select m.norm_name as norm from geck_data.crested_morph_taxonomy m
    union
    select lower(s) from geck_data.crested_morph_taxonomy m, unnest(m.synonyms) s
  ),
  real_traits as (
    select d.trait from (select distinct trait from traits) d
    where lower(trim(d.trait)) in (select norm from names)
      and d.trait not ilike 'Diet:%' and d.trait not ilike 'Proven breeder%'
  ),
  ranked as (
    select tr.seller_slug, tr.trait, row_number() over (partition by tr.seller_slug order by tr.n desc, tr.trait) as rk
    from traits tr join real_traits rt on rt.trait = tr.trait
  )
  select a.seller_slug, coalesce(nullif(s.store_name, ''), a.seller_name, a.seller_slug), s.location_raw, s.avatar_url,
    a.for_sale, a.ask_p50, a.sold,
    coalesce((select array_agg(r.trait order by r.rk) from ranked r where r.seller_slug = a.seller_slug and r.rk <= 3), '{}'),
    a.last_seen_at
  from agg a left join geck_data.sellers s on s.seller_slug = a.seller_slug
  order by a.for_sale desc, a.sold desc;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.compare_trends(p_traits text[])
 RETURNS TABLE(trait text, week date, n integer, p50 numeric, partial boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with market_weeks as (
    select m.week, count(*) as checked from geck_data.listing_week_mv m group by m.week
  ),
  per as (
    select t.trait, w.week, w.price
    from unnest(p_traits[1:6]) t(trait)
    join geck_data.listing_week_mv w on w.trait_array @> array[t.trait]
  )
  select p.trait, p.week, count(*)::int,
    round(percentile_cont(0.5) within group (order by p.price)::numeric, 0),
    bool_or(mw.checked < 0.5 * (select max(checked) from market_weeks))
  from per p
  join market_weeks mw using (week)
  group by p.trait, p.week
  order by p.trait, p.week;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.data_health()
 RETURNS TABLE(for_sale bigint, rechecked_14d bigint, tagged bigint, with_store bigint, first_seen date, last_checked timestamp with time zone, sold bigint, sold_from date, sold_to date, last_seen_by_week jsonb)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with m as (select * from geck_data.listing_market_mv),
  latest as (select max(last_seen_at) as t from m)
  select
    count(*) filter (where m.for_sale),
    count(*) filter (where m.for_sale and m.last_seen_at > (select t from latest) - interval '14 days'),
    count(*) filter (where m.for_sale and cardinality(m.trait_array) > 0),
    count(*) filter (where m.for_sale and m.seller_slug is not null),
    min(m.first_seen_at)::date,
    (select t from latest),
    count(*) filter (where m.sold_at is not null),
    min(m.sold_at)::date,
    max(m.sold_at)::date,
    (select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'n', w.n) order by w.week), '[]'::jsonb)
       from (select date_trunc('week', x.last_seen_at)::date as week, count(*) as n
             from m x where x.for_sale group by 1) w)
  from m;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.feedle_import_markup()
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select round(percentile_cont(0.5) within group (
    order by a.price_usd_equivalent / k.price_usd_equivalent)::numeric, 3)
  from geck_data.cross_platform_listings a
  join geck_data.cross_platform_listings k
    on k.external_id = a.external_id and k.platform = 'feedle_kr'
  where a.platform = 'feedle_air'
    and a.price_usd_equivalent > 0 and k.price_usd_equivalent > 0;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.growth_curve(p_traits text[])
 RETURNS TABLE(bucket integer, label text, sex_class text, n bigint, p50 numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with rows as (
    select l.weight_grams w, geck_data._sex_class(l.sex) as sex_class, l.price
    from geck_data.listings l
    where coalesce(l.species, 'unknown') in ('crested', 'unknown')
      and l.currency = 'USD' and l.price > 0 and l.price < 100000
      and l.weight_grams > 0 and l.weight_grams < 150
      and l.trait_array @> coalesce(p_traits, '{}'::text[])
  ),
  b as (
    select case when w < 5 then 0 when w < 10 then 1 when w < 15 then 2 when w < 20 then 3
        when w < 30 then 4 when w < 40 then 5 when w < 50 then 6 else 7 end as bucket,
      sex_class, price
    from rows where sex_class is not null
  )
  select b.bucket,
    (array['under 5g','5 to 10g','10 to 15g','15 to 20g','20 to 30g','30 to 40g','40 to 50g','50g and up'])[b.bucket + 1],
    s.sex_class, count(*),
    round(percentile_cont(0.5) within group (order by b.price)::numeric, 0)
  from b cross join lateral (values (b.sex_class), ('all')) s(sex_class)
  group by 1, 2, 3 order by 1, 3;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.listing_price_history(p_listing_id text)
 RETURNS TABLE(observed_at timestamp with time zone, price numeric, currency text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select h.observed_at, h.price, h.currency
  from geck_data.price_history h
  where h.listing_id in (p_listing_id, 'mm_' || p_listing_id)
    and h.price > 0
  order by h.observed_at;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.market_baseline()
 RETURNS TABLE(n bigint, p50 numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select count(*), round(percentile_cont(0.5) within group (order by l.price)::numeric, 0)
  from geck_data.listings l
  where coalesce(l.species, 'unknown') in ('crested', 'unknown')
    and l.currency = 'USD' and l.price > 0 and l.price < 100000;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.market_compare(p_min integer DEFAULT 5)
 RETURNS TABLE(market text, trait text, n integer, p25 numeric, p50 numeric, p75 numeric, as_of timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with a as (
    select case when source = 'us_shops' then 'US_SHOPS' else market end as market,
      traits, price_usd, last_seen_at
    from geck_data.market_asks_mv
  ),
  per as (
    select a.market, t.trait, a.price_usd, a.last_seen_at
    from a, unnest(a.traits) t(trait)
    union all
    select a.market, null, a.price_usd, a.last_seen_at from a
  )
  select p.market, p.trait, count(*)::int,
    round(percentile_cont(0.25) within group (order by p.price_usd)::numeric, 0),
    round(percentile_cont(0.50) within group (order by p.price_usd)::numeric, 0),
    round(percentile_cont(0.75) within group (order by p.price_usd)::numeric, 0),
    max(p.last_seen_at)
  from per p
  group by p.market, p.trait
  having count(*) >= p_min;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.market_trend(p_trait text DEFAULT NULL::text)
 RETURNS TABLE(week date, seen integer, p25 numeric, p50 numeric, p75 numeric, cuts integer, raises integer, median_cut numeric, new_listings integer, came_down integer, after_gap boolean, partial boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with p as (
    select * from geck_data.listing_week_mv
    where p_trait is null or trait_array @> array[p_trait]
  ),
  weeks as (
    select p.week,
      count(*)::int as seen,
      round(percentile_cont(0.25) within group (order by p.price)::numeric, 0) as p25,
      round(percentile_cont(0.50) within group (order by p.price)::numeric, 0) as p50,
      round(percentile_cont(0.75) within group (order by p.price)::numeric, 0) as p75,
      count(*) filter (where p.cut)::int as cuts,
      count(*) filter (where p.raised)::int as raises,
      round((percentile_cont(0.5) within group (order by p.cut_pct) filter (where p.cut))::numeric, 2) as median_cut
    from p
    group by p.week
  ),
  market_weeks as (
    select m.week, count(*) as checked from geck_data.listing_week_mv m group by m.week
  ),
  sized as (
    select w.*, mw.checked < 0.5 * (select max(checked) from market_weeks) as partial
    from weeks w
    join market_weeks mw using (week)
  ),
  flagged as (
    select s.*,
      coalesce(lag(s.week) over (order by s.week) <> s.week - 7, true) as after_gap,
      coalesce(lag(s.partial) over (order by s.week), true) as prev_partial
    from sized s
  ),
  flow as (
    select date_trunc('week', v.first_seen_at)::date as seen_week,
      date_trunc('week', v.sold_at)::date as down_week
    from geck_data.listing_market_mv v
    where not v.is_lot
      and (p_trait is null or v.trait_array @> array[p_trait])
  )
  select f.week, f.seen, f.p25, f.p50, f.p75, f.cuts, f.raises, f.median_cut,
    case when f.after_gap or f.partial or f.prev_partial then null else
      (select count(*)::int from flow where flow.seen_week = f.week) end,
    case when f.after_gap or f.partial or f.prev_partial then null else
      (select count(*)::int from flow where flow.down_week = f.week) end,
    f.after_gap,
    f.partial
  from flagged f
  order by f.week;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.market_weekly(p_trait text DEFAULT NULL::text)
 RETURNS TABLE(market text, week date, n integer, p50 numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with us as (
    select 'US'::text as market, w.week, count(*)::int as n,
      round(percentile_cont(0.5) within group (order by w.price)::numeric, 0) as p50
    from geck_data.listing_week_mv w
    where p_trait is null or w.trait_array @> array[p_trait]
    group by w.week
  ),
  obs as (
    select
      case when o.platform in ('feedle_kr', 'kr_shops') then 'KR' when o.platform = 'terraristik' then 'EU' when o.platform = 'repsuki' then 'JP' end as market,
      date_trunc('week', o.observed_on)::date as week,
      o.platform, o.external_id,
      (array_agg(o.price / fx.per_usd order by o.observed_on desc))[1] as price_usd
    from geck_data.cross_platform_observations o
    join geck_data.fx_rates fx on fx.currency = o.currency
    join geck_data.cross_platform_listings c
      on c.platform = o.platform and c.external_id = o.external_id
    left join geck_data.cross_platform_traits_mv tr
      on tr.platform = o.platform and tr.external_id = o.external_id
    where o.platform in ('feedle_kr', 'kr_shops', 'terraristik', 'repsuki')
      and not o.sold and o.price > 0
      and not coalesce((c.payload->>'is_group_lot')::boolean, false)
      and not coalesce((c.payload->>'exclude_from_combo_arb')::boolean, false)
      and (p_trait is null or tr.traits @> array[p_trait])
    group by 1, 2, 3, 4
  )
  select * from us
  union all
  select o.market, o.week, count(*)::int,
    round(percentile_cont(0.5) within group (order by o.price_usd)::numeric, 0)
  from obs o
  where o.market is not null
  group by o.market, o.week
  order by 1, 2;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.match_traits(p_text text)
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with t as (select lower(coalesce(p_text, '')) as s),
  names as (
    select m.norm_name as term, array[m.canonical_name] as traits
    from geck_data.crested_morph_taxonomy m
    union all
    select lower(syn), array[m.canonical_name]
    from geck_data.crested_morph_taxonomy m, unnest(m.synonyms) syn
    where length(syn) >= 3
    union all
    select a.alias, a.traits from geck_data.market_trait_alias a
  ),
  hits as (
    select distinct unnest(n.traits) as trait, n.term
    from names n, t
    where case
      when n.term ~ '[가-힣ぁ-んァ-ヶ]' then position(n.term in t.s) > 0
      else t.s ~ ('(^|[^a-z0-9])'
        || regexp_replace(n.term, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g')
        || '($|[^a-z0-9])')
    end
  ),
  blocked as (
    select n.term from names n, t
    where n.traits = '{}' and n.term ~ '[가-힣ぁ-んァ-ヶ]' and position(n.term in t.s) > 0
  ),
  kept as (
    select h.trait, h.term from hits h
    where not exists (select 1 from blocked b where position(h.term in b.term) > 0 and b.term <> h.term)
  )
  select geck_data._drop_contained(coalesce(array_agg(distinct k.trait), '{}'))
  from kept k;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.monthly_history(p_trait text DEFAULT NULL::text)
 RETURNS TABLE(month date, sampled integer, est_posted integer, priced integer, p25 numeric, p50 numeric, p75 numeric, sold_share numeric, gone_share numeric, covered boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with span as (
    select generate_series(
      date_trunc('month', now()) - interval '12 months',
      date_trunc('month', now()),
      interval '1 month'
    )::date as month
  ),
  dated as (
    select b.*, date_trunc('month', b.first_listed_at)::date as month
    from geck_data.listing_backfill b
    where b.first_listed_at is not null
  ),
  grouped as (
    select b.nid, b.http_status, b.first_listed_at,
      count(b.first_listed_at) over (order by b.nid) as grp
    from geck_data.listing_backfill b
    where b.nid is not null
  ),
  gone as (
    select x.month
    from (
      select g.http_status,
        first_value(date_trunc('month', g.first_listed_at)::date)
          over (partition by g.grp order by g.nid) as month
      from grouped g
    ) x
    where x.http_status = 404
  ),
  reach as (
    select min(first_listed_at) as lo from dated
  ),
  crested as (
    select d.*
    from dated d
    where d.is_crested
      and (p_trait is null or d.trait_array @> array[p_trait])
  )
  select s.month,
    count(c.listing_id)::int as sampled,
    coalesce(sum(c.sample_every), 0)::int as est_posted,
    count(c.listing_id) filter (where c.currency = 'USD' and c.price > 0 and c.price < 100000
      and not geck_data._looks_like_group_lot(c.name, false))::int as priced,
    round((percentile_cont(0.25) within group (order by c.price) filter (
      where c.currency = 'USD' and c.price > 0 and c.price < 100000
        and not geck_data._looks_like_group_lot(c.name, false)))::numeric, 0),
    round((percentile_cont(0.50) within group (order by c.price) filter (
      where c.currency = 'USD' and c.price > 0 and c.price < 100000
        and not geck_data._looks_like_group_lot(c.name, false)))::numeric, 0),
    round((percentile_cont(0.75) within group (order by c.price) filter (
      where c.currency = 'USD' and c.price > 0 and c.price < 100000
        and not geck_data._looks_like_group_lot(c.name, false)))::numeric, 0),
    round(avg(c.is_sold::int)::numeric, 2),
    (
      select round(g.n::numeric / nullif(g.n + d.n, 0), 2)
      from (select count(*) as n from gone gg where gg.month = s.month) g,
           (select count(*) as n from dated d2 where d2.month = s.month) d
    ),
    coalesce((select r.lo from reach r) <= s.month + interval '3 days', false)
  from span s
  left join crested c on c.month = s.month
  group by s.month
  order by s.month;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.morph_summary()
 RETURNS TABLE(trait text, for_sale bigint, ask_p25 numeric, ask_p50 numeric, ask_p75 numeric, sold bigint, sold_p50 numeric, last_seen_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with rows as (
    select unnest(l.trait_array) as trait, l.price, l.currency,
      (l.is_active and l.sold_at is null) as is_active, l.sold_at, l.last_seen_at
    from geck_data.listings l
    where coalesce(l.species, 'unknown') in ('crested', 'unknown') and l.price > 0 and l.price < 100000
  ),
  names as (
    select m.norm_name as norm from geck_data.crested_morph_taxonomy m
    union
    select lower(s) from geck_data.crested_morph_taxonomy m, unnest(m.synonyms) s
  ),
  real_traits as (
    select d.trait from (select distinct r.trait from rows r) d
    where lower(trim(d.trait)) in (select norm from names)
      and d.trait not ilike 'Diet:%' and d.trait not ilike 'Proven breeder%'
  )
  select r.trait,
    count(*) filter (where r.is_active),
    round(percentile_cont(0.25) within group (order by r.price) filter (where r.is_active and r.currency = 'USD')::numeric, 0),
    round(percentile_cont(0.50) within group (order by r.price) filter (where r.is_active and r.currency = 'USD')::numeric, 0),
    round(percentile_cont(0.75) within group (order by r.price) filter (where r.is_active and r.currency = 'USD')::numeric, 0),
    count(*) filter (where r.sold_at is not null),
    round(percentile_cont(0.50) within group (order by r.price) filter (where r.sold_at is not null and r.currency = 'USD')::numeric, 0),
    max(r.last_seen_at)
  from rows r join real_traits t on t.trait = r.trait
  group by r.trait order by 2 desc, 1;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.trait_upgrades(p_traits text[])
 RETURNS TABLE(trait text, n bigint, p50 numeric, base_n bigint, base_p50 numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with base as (
    select l.price, l.trait_array from geck_data.listings l
    where coalesce(l.species, 'unknown') in ('crested', 'unknown')
      and l.currency = 'USD' and l.price > 0 and l.price < 100000
      and l.trait_array @> coalesce(p_traits, '{}'::text[])
  ),
  bm as (select count(*) as n, round(percentile_cont(0.5) within group (order by price)::numeric, 0) as p50 from base),
  extra as (
    select t.trait, b.price from base b, unnest(b.trait_array) t(trait)
    where not (t.trait = any(coalesce(p_traits, '{}'::text[])))
  ),
  names as (
    select m.norm_name as norm from geck_data.crested_morph_taxonomy m
    union
    select lower(s) from geck_data.crested_morph_taxonomy m, unnest(m.synonyms) s
  ),
  real_traits as (
    select d.trait from (select distinct e.trait from extra e) d
    where lower(trim(d.trait)) in (select norm from names)
      and d.trait not ilike 'Diet:%' and d.trait not ilike 'Proven breeder%'
  )
  select e.trait, count(*), round(percentile_cont(0.5) within group (order by e.price)::numeric, 0),
    (select n from bm), (select p50 from bm)
  from extra e join real_traits r on r.trait = e.trait
  group by e.trait having count(*) >= 5 order by 3 desc;
$function$
;
CREATE OR REPLACE FUNCTION geck_data.value_grid(p_traits text[])
 RETURNS TABLE(age_class text, sex_class text, n bigint, p25 numeric, p50 numeric, p75 numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with rows as (
    select geck_data._age_class(l.maturity) as age_class, geck_data._sex_class(l.sex) as sex_class, l.price
    from geck_data.listings l
    where coalesce(l.species, 'unknown') in ('crested', 'unknown')
      and l.currency = 'USD' and l.price > 0 and l.price < 100000
      and l.trait_array @> coalesce(p_traits, '{}'::text[])
  ),
  g as (
    select
      case when grouping(r.age_class) = 1 then 'any' else r.age_class end as age_class,
      case when grouping(r.sex_class) = 1 then 'any' else r.sex_class end as sex_class,
      count(*) as n,
      round(percentile_cont(0.25) within group (order by r.price)::numeric, 0) as p25,
      round(percentile_cont(0.50) within group (order by r.price)::numeric, 0) as p50,
      round(percentile_cont(0.75) within group (order by r.price)::numeric, 0) as p75
    from rows r
    group by grouping sets ((r.age_class, r.sex_class), (r.age_class), (r.sex_class), ())
  )
  select * from g where g.age_class is not null and g.sex_class is not null;
$function$
;

-- Production ACL on all of the above except _drop_contained (default, PUBLIC):
-- PUBLIC, postgres, anon, authenticated. New functions already get PUBLIC.
do $$
declare f text;
begin
  foreach f in array array[
    'geck_data._age_class(text)', 'geck_data._sex_class(text)', 'geck_data.asking_price_band(text[])',
    'geck_data.breeder_summary()', 'geck_data.compare_trends(text[])', 'geck_data.data_health()',
    'geck_data.feedle_import_markup()', 'geck_data.growth_curve(text[])', 'geck_data.listing_price_history(text)',
    'geck_data.market_baseline()', 'geck_data.market_compare(integer)', 'geck_data.market_trend(text)',
    'geck_data.market_weekly(text)', 'geck_data.match_traits(text)', 'geck_data.monthly_history(text)',
    'geck_data.morph_summary()', 'geck_data.trait_upgrades(text[])', 'geck_data.value_grid(text[])'] loop
    execute format('grant execute on function %s to public, postgres, anon, authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------- tables
create table if not exists geck_data.fx_rates (
  currency text not null primary key,
  per_usd numeric not null check (per_usd > (0)::numeric),
  as_of timestamptz not null default now(),
  source text
);
create table if not exists geck_data.market_trait_alias (
  alias text not null primary key,
  traits text[] not null
);
create table if not exists geck_data.cross_platform_observations (
  platform text not null,
  external_id text not null,
  observed_on date not null,
  price numeric,
  currency text,
  sold boolean not null default false,
  primary key (platform, external_id, observed_on)
);
create table if not exists geck_data.listing_backfill (
  listing_id text not null primary key,
  nid bigint generated always as (case when (listing_id ~ '^[0-9]+$'::text) then (listing_id)::bigint else null::bigint end) stored,
  http_status integer,
  is_crested boolean,
  first_listed_at timestamptz,
  state text,
  is_sold boolean,
  name text,
  price numeric,
  currency text,
  trait_array text[],
  sex text,
  maturity text,
  sample_every integer not null,
  fetched_at timestamptz not null default now()
);
create index if not exists listing_backfill_nid on geck_data.listing_backfill using btree (nid);
create index if not exists listing_backfill_listed on geck_data.listing_backfill using btree (first_listed_at);
create index if not exists listing_backfill_traits on geck_data.listing_backfill using gin (trait_array);

alter table geck_data.fx_rates enable row level security;
alter table geck_data.market_trait_alias enable row level security;
alter table geck_data.cross_platform_observations enable row level security;
alter table geck_data.listing_backfill enable row level security;
drop policy if exists "public read fx_rates" on geck_data.fx_rates;
create policy "public read fx_rates" on geck_data.fx_rates for select to anon, authenticated using (true);
drop policy if exists "public read market_trait_alias" on geck_data.market_trait_alias;
create policy "public read market_trait_alias" on geck_data.market_trait_alias for select to anon, authenticated using (true);
drop policy if exists "public read cross_platform_observations" on geck_data.cross_platform_observations;
create policy "public read cross_platform_observations" on geck_data.cross_platform_observations for select to anon, authenticated using (true);
drop policy if exists "public read listing_backfill" on geck_data.listing_backfill;
create policy "public read listing_backfill" on geck_data.listing_backfill for select to anon, authenticated using (true);

revoke all on geck_data.fx_rates, geck_data.market_trait_alias, geck_data.cross_platform_observations, geck_data.listing_backfill from public, anon, authenticated, service_role;
grant select on geck_data.fx_rates, geck_data.market_trait_alias to anon, authenticated;
grant select on geck_data.cross_platform_observations, geck_data.listing_backfill to authenticated;
grant select, insert, update, delete on geck_data.fx_rates, geck_data.market_trait_alias,
  geck_data.cross_platform_observations, geck_data.listing_backfill to service_role;

-- ---------------------------------------------------------------- views and materialized views
create materialized view if not exists geck_data.cross_platform_traits_mv as
 SELECT platform,
    external_id,
    geck_data.match_traits(((COALESCE(traits_raw, ''::text) || ' , '::text) || COALESCE(title, ''::text))) AS traits
   FROM geck_data.cross_platform_listings c
  WHERE (platform = ANY (ARRAY['feedle_kr'::text, 'kr_shops'::text, 'terraristik'::text, 'tikis_geckos'::text, 'altitude_exotics'::text, 'repsuki'::text]));
create unique index if not exists cross_platform_traits_mv_pk on geck_data.cross_platform_traits_mv using btree (platform, external_id);

create or replace view geck_data.v_listing_value as
 WITH names AS (
         SELECT m.norm_name AS norm
           FROM geck_data.crested_morph_taxonomy m
        UNION
         SELECT lower(s.s) AS lower
           FROM geck_data.crested_morph_taxonomy m,
            LATERAL unnest(m.synonyms) s(s)
        ), base AS (
         SELECT l.listing_id,
            l.price,
            l.trait_array,
            geck_data._age_class(l.maturity) AS age_class,
            geck_data._sex_class(l.sex) AS sex_class
           FROM geck_data.listings l
          WHERE ((COALESCE(l.species, 'unknown'::text) = ANY (ARRAY['crested'::text, 'unknown'::text])) AND (l.currency = 'USD'::text) AND (l.price > (0)::numeric) AND (l.price < (100000)::numeric) AND (NOT geck_data._looks_like_group_lot(l.name, false)))
        ), lt AS (
         SELECT b.listing_id,
            b.price,
            b.age_class,
            b.sex_class,
            t.trait
           FROM base b,
            LATERAL unnest(b.trait_array) t(trait)
          WHERE ((lower(TRIM(BOTH FROM t.trait)) IN ( SELECT names.norm
                   FROM names)) AND (t.trait !~~* 'Diet:%'::text) AND (t.trait !~~* 'Proven breeder%'::text))
        ), trait_stats AS (
         SELECT lt.trait,
                CASE
                    WHEN (GROUPING(lt.age_class) = 1) THEN 'any'::text
                    ELSE lt.age_class
                END AS age_class,
                CASE
                    WHEN (GROUPING(lt.sex_class) = 1) THEN 'any'::text
                    ELSE lt.sex_class
                END AS sex_class,
            count(*) AS n,
            percentile_cont((0.25)::double precision) WITHIN GROUP (ORDER BY ((lt.price)::double precision)) AS p25,
            percentile_cont((0.50)::double precision) WITHIN GROUP (ORDER BY ((lt.price)::double precision)) AS p50,
            percentile_cont((0.75)::double precision) WITHIN GROUP (ORDER BY ((lt.price)::double precision)) AS p75
           FROM lt
          GROUP BY GROUPING SETS ((lt.trait, lt.age_class, lt.sex_class), (lt.trait, lt.age_class), (lt.trait))
        ), market_stats AS (
         SELECT
                CASE
                    WHEN (GROUPING(b.age_class) = 1) THEN 'any'::text
                    ELSE b.age_class
                END AS age_class,
                CASE
                    WHEN (GROUPING(b.sex_class) = 1) THEN 'any'::text
                    ELSE b.sex_class
                END AS sex_class,
            count(*) AS n,
            percentile_cont((0.25)::double precision) WITHIN GROUP (ORDER BY ((b.price)::double precision)) AS p25,
            percentile_cont((0.50)::double precision) WITHIN GROUP (ORDER BY ((b.price)::double precision)) AS p50,
            percentile_cont((0.75)::double precision) WITHIN GROUP (ORDER BY ((b.price)::double precision)) AS p75
           FROM base b
          GROUP BY GROUPING SETS ((b.age_class, b.sex_class), ())
        ), per_trait AS (
         SELECT lt.listing_id,
            lt.trait,
                CASE
                    WHEN (s1.trait IS NOT NULL) THEN 'trait_age_sex'::text
                    WHEN (s2.trait IS NOT NULL) THEN 'trait_age'::text
                    WHEN (s3.trait IS NOT NULL) THEN 'trait'::text
                    ELSE NULL::text
                END AS basis,
            COALESCE(s1.n, s2.n, s3.n) AS n,
            COALESCE(s1.p25, s2.p25, s3.p25) AS p25,
            COALESCE(s1.p50, s2.p50, s3.p50) AS p50,
            COALESCE(s1.p75, s2.p75, s3.p75) AS p75
           FROM (((lt
             LEFT JOIN trait_stats s1 ON (((s1.trait = lt.trait) AND (s1.age_class = lt.age_class) AND (s1.sex_class = lt.sex_class) AND (s1.n >= 8))))
             LEFT JOIN trait_stats s2 ON (((s2.trait = lt.trait) AND (s2.age_class = lt.age_class) AND (s2.sex_class = 'any'::text) AND (s2.n >= 8))))
             LEFT JOIN trait_stats s3 ON (((s3.trait = lt.trait) AND (s3.age_class = 'any'::text) AND (s3.sex_class = 'any'::text) AND (s3.n >= 8))))
        ), best AS (
         SELECT DISTINCT ON (p.listing_id) p.listing_id,
            p.trait,
            p.basis,
            p.n,
            p.p25,
            p.p50,
            p.p75
           FROM per_trait p
          WHERE (p.p50 IS NOT NULL)
          ORDER BY p.listing_id, p.p50 DESC
        ), ref AS (
         SELECT b.listing_id,
            b.price,
            b.age_class,
            b.sex_class,
            best.trait,
                CASE
                    WHEN (best.p50 IS NOT NULL) THEN best.basis
                    WHEN (m1.p50 IS NOT NULL) THEN 'market_age_sex'::text
                    ELSE 'market'::text
                END AS basis,
            COALESCE(best.n, m1.n, m2.n) AS n,
            COALESCE(best.p25, m1.p25, m2.p25) AS p25,
            COALESCE(best.p50, m1.p50, m2.p50) AS p50,
            COALESCE(best.p75, m1.p75, m2.p75) AS p75
           FROM (((base b
             LEFT JOIN best ON ((best.listing_id = b.listing_id)))
             LEFT JOIN market_stats m1 ON (((m1.age_class = b.age_class) AND (m1.sex_class = b.sex_class) AND (m1.n >= 8))))
             CROSS JOIN ( SELECT market_stats.n,
                    market_stats.p25,
                    market_stats.p50,
                    market_stats.p75
                   FROM market_stats
                  WHERE ((market_stats.age_class = 'any'::text) AND (market_stats.sex_class = 'any'::text))) m2)
        )
 SELECT listing_id,
    age_class,
    sex_class,
    trait AS compared_trait,
    basis,
    n AS compared_n,
    round((p25)::numeric, 0) AS similar_p25,
    round((p50)::numeric, 0) AS similar_p50,
    round((p75)::numeric, 0) AS similar_p75,
    round((((price)::double precision / NULLIF(p50, (0)::double precision)))::numeric, 2) AS ratio,
        CASE
            WHEN ((price)::double precision < p25) THEN 'low'::text
            WHEN ((price)::double precision > p75) THEN 'high'::text
            ELSE 'typical'::text
        END AS "position"
   FROM ref r;

create materialized view if not exists geck_data.listing_market_mv as
 WITH first_price AS (
         SELECT DISTINCT ON ((regexp_replace(h.listing_id, '^mm_'::text, ''::text))) regexp_replace(h.listing_id, '^mm_'::text, ''::text) AS listing_id,
            h.price AS first_price,
            h.currency AS first_currency,
            h.observed_at AS first_observed_at
           FROM geck_data.price_history h
          WHERE ((h.price IS NOT NULL) AND (h.price > (0)::numeric))
          ORDER BY (regexp_replace(h.listing_id, '^mm_'::text, ''::text)), h.observed_at
        )
 SELECT l.listing_id,
    l.name,
    l.price,
    l.currency,
    l.sex,
    l.maturity,
    l.trait_array,
    l.primary_image_url,
    l.listing_url,
    l.seller_slug,
    l.seller_name,
    l.weight_grams,
    l.first_seen_at,
    l.last_seen_at,
    l.sold_at,
    l.is_active,
    l.species,
    (l.is_active AND (l.sold_at IS NULL)) AS for_sale,
    geck_data._looks_like_group_lot(l.name, false) AS is_lot,
    v.age_class,
    v.sex_class,
    v.compared_trait,
    v.basis,
    v.compared_n,
    v.similar_p25,
    v.similar_p50,
    v.similar_p75,
    v.ratio,
    v."position",
        CASE
            WHEN (fp.first_price > l.price) THEN round((fp.first_price - l.price), 0)
            ELSE NULL::numeric
        END AS price_cut,
    fp.first_price
   FROM ((geck_data.listings l
     LEFT JOIN geck_data.v_listing_value v ON ((v.listing_id = l.listing_id)))
     LEFT JOIN first_price fp ON (((fp.listing_id = l.listing_id) AND (NOT (fp.first_currency IS DISTINCT FROM l.currency)))))
  WHERE ((COALESCE(l.species, 'unknown'::text) = ANY (ARRAY['crested'::text, 'unknown'::text])) AND (l.price > (0)::numeric) AND (l.price < (100000)::numeric));
create unique index if not exists listing_market_mv_pk on geck_data.listing_market_mv using btree (listing_id);
create index if not exists listing_market_mv_traits on geck_data.listing_market_mv using gin (trait_array);
create index if not exists listing_market_mv_seller on geck_data.listing_market_mv using btree (seller_slug);

-- listing_facts_mv is left to 20260929231624_market_daily_snapshots.sql (it needs
-- geck_data.morph_term_map, which that migration creates).

create materialized view if not exists geck_data.market_asks_mv as
 WITH names AS (
         SELECT m.norm_name AS term,
            m.canonical_name AS canon
           FROM geck_data.crested_morph_taxonomy m
        UNION
         SELECT lower(syn.syn) AS lower,
            m.canonical_name
           FROM geck_data.crested_morph_taxonomy m,
            LATERAL unnest(m.synonyms) syn(syn)
        ), mm AS (
         SELECT
                CASE l.currency
                    WHEN 'USD'::text THEN 'US'::text
                    WHEN 'CAD'::text THEN 'CA'::text
                    WHEN 'EUR'::text THEN 'EU'::text
                    WHEN 'GBP'::text THEN 'UK'::text
                    ELSE NULL::text
                END AS market,
            'morphmarket'::text AS source,
            l.listing_id AS listing_key,
            l.name AS title,
            l.listing_url AS url,
            geck_data._drop_contained(COALESCE(( SELECT array_agg(DISTINCT n.canon) AS array_agg
                   FROM (unnest(l.trait_array) t(trait)
                     JOIN names n ON ((n.term = lower(TRIM(BOTH FROM t.trait)))))), '{}'::text[])) AS traits,
            l.sex_class AS sex,
            l.price AS price_local,
            l.currency,
            l.first_seen_at,
            l.last_seen_at
           FROM geck_data.listing_market_mv l
          WHERE (l.for_sale AND (NOT l.is_lot) AND (l.currency = ANY (ARRAY['USD'::text, 'CAD'::text, 'EUR'::text, 'GBP'::text])))
        ), cp AS (
         SELECT
                CASE
                    WHEN (c.platform = ANY (ARRAY['feedle_kr'::text, 'kr_shops'::text])) THEN 'KR'::text
                    WHEN (c.platform = 'terraristik'::text) THEN 'EU'::text
                    WHEN (c.platform = 'repsuki'::text) THEN 'JP'::text
                    WHEN (c.platform = ANY (ARRAY['tikis_geckos'::text, 'altitude_exotics'::text])) THEN 'US'::text
                    ELSE NULL::text
                END AS market,
                CASE
                    WHEN (c.platform = 'feedle_kr'::text) THEN 'feedle'::text
                    WHEN (c.platform = ANY (ARRAY['tikis_geckos'::text, 'altitude_exotics'::text])) THEN 'us_shops'::text
                    ELSE c.platform
                END AS source,
            ((c.platform || ':'::text) || c.external_id) AS listing_key,
            c.title,
            c.url,
            COALESCE(tr.traits, '{}'::text[]) AS traits,
                CASE lower(COALESCE((c.payload ->> 'sex'::text), ''::text))
                    WHEN 'male'::text THEN 'male'::text
                    WHEN 'female'::text THEN 'female'::text
                    ELSE 'unsexed'::text
                END AS sex,
            c.price AS price_local,
            c.currency,
            c.first_seen_at,
            c.last_seen_at
           FROM (geck_data.cross_platform_listings c
             LEFT JOIN geck_data.cross_platform_traits_mv tr ON (((tr.platform = c.platform) AND (tr.external_id = c.external_id))))
          WHERE ((c.platform = ANY (ARRAY['feedle_kr'::text, 'kr_shops'::text, 'terraristik'::text, 'tikis_geckos'::text, 'altitude_exotics'::text, 'repsuki'::text])) AND (COALESCE(c.species, 'crested'::text) = 'crested'::text) AND (NOT COALESCE(((c.payload ->> 'sold'::text))::boolean, false)) AND (NOT COALESCE(((c.payload ->> 'is_group_lot'::text))::boolean, false)) AND (NOT COALESCE(((c.payload ->> 'exclude_from_combo_arb'::text))::boolean, false)) AND (c.price > (0)::numeric) AND (c.last_seen_at >= ( SELECT (max(c2.last_seen_at) - '21 days'::interval)
                   FROM geck_data.cross_platform_listings c2
                  WHERE (c2.platform = c.platform))))
        ), u AS (
         SELECT mm.market, mm.source, mm.listing_key, mm.title, mm.url, mm.traits, mm.sex,
            mm.price_local, mm.currency, mm.first_seen_at, mm.last_seen_at
           FROM mm
        UNION ALL
         SELECT cp.market, cp.source, cp.listing_key, cp.title, cp.url, cp.traits, cp.sex,
            cp.price_local, cp.currency, cp.first_seen_at, cp.last_seen_at
           FROM cp
        )
 SELECT u.market,
    u.source,
    u.listing_key,
    u.title,
    u.url,
    u.traits,
    u.sex,
    u.price_local,
    u.currency,
    u.first_seen_at,
    u.last_seen_at,
    round((u.price_local / fx.per_usd), 2) AS price_usd
   FROM (u
     JOIN geck_data.fx_rates fx ON ((fx.currency = u.currency)))
  WHERE ((u.market IS NOT NULL) AND (((u.price_local / fx.per_usd) >= (5)::numeric) AND ((u.price_local / fx.per_usd) <= (100000)::numeric)));
create unique index if not exists market_asks_mv_pk on geck_data.market_asks_mv using btree (source, listing_key);
create index if not exists market_asks_mv_traits on geck_data.market_asks_mv using gin (traits);

create or replace view geck_data.breeder_market_v as
 WITH l AS (
         SELECT listing_market_mv.listing_id, listing_market_mv.name, listing_market_mv.price,
            listing_market_mv.currency, listing_market_mv.sex, listing_market_mv.maturity,
            listing_market_mv.trait_array, listing_market_mv.primary_image_url, listing_market_mv.listing_url,
            listing_market_mv.seller_slug, listing_market_mv.seller_name, listing_market_mv.weight_grams,
            listing_market_mv.first_seen_at, listing_market_mv.last_seen_at, listing_market_mv.sold_at,
            listing_market_mv.is_active, listing_market_mv.species, listing_market_mv.for_sale,
            listing_market_mv.is_lot, listing_market_mv.age_class, listing_market_mv.sex_class,
            listing_market_mv.compared_trait, listing_market_mv.basis, listing_market_mv.compared_n,
            listing_market_mv.similar_p25, listing_market_mv.similar_p50, listing_market_mv.similar_p75,
            listing_market_mv.ratio, listing_market_mv."position", listing_market_mv.price_cut,
            listing_market_mv.first_price
           FROM geck_data.listing_market_mv
          WHERE ((listing_market_mv.seller_slug IS NOT NULL) AND (listing_market_mv.seller_slug <> ''::text))
        ), agg AS (
         SELECT l.seller_slug,
            max(l.seller_name) AS seller_name,
            count(*) FILTER (WHERE l.for_sale) AS for_sale,
            count(*) FILTER (WHERE (l.sold_at IS NOT NULL)) AS sold,
            min(l.first_seen_at) AS first_seen_at,
            max(l.last_seen_at) AS last_seen_at,
            round((percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((l.price)::double precision)) FILTER (WHERE (l.for_sale AND (l.currency = 'USD'::text))))::numeric, 0) AS ask_p50,
            round((percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((l.ratio)::double precision)) FILTER (WHERE (l.ratio IS NOT NULL)))::numeric, 2) AS price_ratio,
            count(*) FILTER (WHERE (l.ratio IS NOT NULL)) AS priced_n,
            count(*) FILTER (WHERE (l."position" = 'low'::text)) AS n_low,
            count(*) FILTER (WHERE (l."position" = 'typical'::text)) AS n_typical,
            count(*) FILTER (WHERE (l."position" = 'high'::text)) AS n_high,
            round(avg(((l.age_class = 'hatchling'::text))::integer) FILTER (WHERE (l.age_class IS NOT NULL)), 2) AS share_hatchling,
            round(avg(((l.sex_class = 'female'::text))::integer) FILTER (WHERE (l.sex_class IS NOT NULL)), 2) AS share_female
           FROM l
          GROUP BY l.seller_slug
        ), names AS (
         SELECT m.norm_name AS norm
           FROM geck_data.crested_morph_taxonomy m
        UNION
         SELECT lower(s_1.s) AS lower
           FROM geck_data.crested_morph_taxonomy m,
            LATERAL unnest(m.synonyms) s_1(s)
        ), traits AS (
         SELECT l.seller_slug,
            t.trait,
            count(*) AS n
           FROM l,
            LATERAL unnest(l.trait_array) t(trait)
          WHERE ((lower(TRIM(BOTH FROM t.trait)) IN ( SELECT names.norm
                   FROM names)) AND (t.trait !~~* 'Diet:%'::text) AND (t.trait !~~* 'Proven breeder%'::text))
          GROUP BY l.seller_slug, t.trait
        ), ranked AS (
         SELECT tr.seller_slug,
            tr.trait,
            tr.n,
            row_number() OVER (PARTITION BY tr.seller_slug ORDER BY tr.n DESC, tr.trait) AS rk
           FROM traits tr
        )
 SELECT a.seller_slug,
    COALESCE(NULLIF(s.store_name, ''::text), a.seller_name, a.seller_slug) AS name,
    s.location_raw AS location,
    s.avatar_url,
    a.for_sale,
    a.sold,
    a.first_seen_at,
    a.last_seen_at,
    a.ask_p50,
    a.price_ratio,
    a.priced_n,
    a.n_low,
    a.n_typical,
    a.n_high,
    a.share_hatchling,
    a.share_female,
    COALESCE(( SELECT array_agg(r.trait ORDER BY r.rk) AS array_agg
           FROM ranked r
          WHERE ((r.seller_slug = a.seller_slug) AND (r.rk <= 5))), '{}'::text[]) AS top_traits,
    COALESCE(( SELECT array_agg(r.n ORDER BY r.rk) AS array_agg
           FROM ranked r
          WHERE ((r.seller_slug = a.seller_slug) AND (r.rk <= 5))), '{}'::bigint[]) AS top_trait_counts
   FROM (agg a
     LEFT JOIN geck_data.sellers s ON ((s.seller_slug = a.seller_slug)));

-- listing_week_mv as it stood before 20261013161654 (production keeps that copy
-- as listing_week_mv_old). The migration renames it and builds the new one.
create materialized view if not exists geck_data.listing_week_mv as
 WITH obs AS (
         SELECT regexp_replace(h.listing_id, '^mm_'::text, ''::text) AS listing_id,
            h.observed_at,
            h.price
           FROM geck_data.price_history h
          WHERE ((h.currency = 'USD'::text) AND (h.price > (0)::numeric) AND (h.price < (100000)::numeric))
        ), l AS (
         SELECT l.listing_id,
            l.trait_array
           FROM geck_data.listings l
          WHERE ((COALESCE(l.species, 'unknown'::text) = ANY (ARRAY['crested'::text, 'unknown'::text])) AND (NOT geck_data._looks_like_group_lot(l.name, false)))
        ), o AS (
         SELECT o_1.listing_id,
            o_1.observed_at,
            o_1.price,
            lag(o_1.price) OVER (PARTITION BY o_1.listing_id ORDER BY o_1.observed_at) AS prev
           FROM (obs o_1
             JOIN l USING (listing_id))
        )
 SELECT (date_trunc('week'::text, observed_at))::date AS week,
    listing_id,
    (array_agg(price ORDER BY observed_at DESC))[1] AS price,
    bool_or(((prev IS NOT NULL) AND (price < prev))) AS cut,
    bool_or(((prev IS NOT NULL) AND (price > prev))) AS raised,
    min(
        CASE
            WHEN ((prev IS NOT NULL) AND (price < prev)) THEN ((prev - price) / prev)
            ELSE NULL::numeric
        END) AS cut_pct,
    ( SELECT l.trait_array
           FROM l
          WHERE (l.listing_id = o.listing_id)) AS trait_array
   FROM o
  GROUP BY ((date_trunc('week'::text, observed_at))::date), listing_id;
create unique index if not exists listing_week_mv_pk on geck_data.listing_week_mv using btree (week, listing_id);
create index if not exists listing_week_mv_traits on geck_data.listing_week_mv using gin (trait_array);

-- Final production ACLs (the 13 Oct migrations re-grant service_role idempotently).
revoke all on geck_data.cross_platform_traits_mv, geck_data.v_listing_value, geck_data.listing_market_mv,
  geck_data.market_asks_mv, geck_data.breeder_market_v, geck_data.listing_week_mv
  from public, anon, authenticated, service_role;
grant select on geck_data.cross_platform_traits_mv to anon, authenticated, service_role;
grant select on geck_data.v_listing_value, geck_data.listing_market_mv, geck_data.market_asks_mv,
  geck_data.breeder_market_v to authenticated, service_role;
grant select on geck_data.listing_week_mv to anon, authenticated;
