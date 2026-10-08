-- Market tape: page by time and event id (30 Sep 2026).
--
-- Korean and Japanese runs stamp many listings with the same time, so
-- "Load older" with a time cursor alone skipped some of them. The tape now
-- takes the last event's id as well and pages by (time, id).

-- A fresh replay does not have every geck_data object this statement
-- uses, because the archived placeholders create nothing. Run the
-- original statement only when those objects exist. Production already
-- applied this version and will not run the file again.
do $do$
begin
  if to_regclass('geck_data.listing_market_mv') is not null
     and to_regclass('geck_data.listing_facts_mv') is not null
     and to_regclass('geck_data.market_daily') is not null
     and to_regclass('geck_data.price_history') is not null
     and to_regclass('geck_data.cross_platform_observations') is not null
     and to_regclass('geck_data.cross_platform_listings') is not null
     and to_regclass('geck_data.cross_platform_traits_mv') is not null
     and to_regclass('geck_data.cross_platform_listing_images') is not null
     and to_regclass('geck_data.fx_rates') is not null then
    execute $stmt$
drop function if exists public.market_tape(timestamptz, integer, text);
$stmt$;
    execute $stmt$
create or replace function public.market_tape(
  p_before timestamptz default null,
  p_limit integer default 40,
  p_scope text default 'all',
  p_before_id text default null
)
returns table (
  event_id text, at timestamptz, kind text, market text, listing_id text,
  title text, morphs text[], sex_class text, age_class text, weight_grams numeric,
  price numeric, was_price numeric, currency text, price_local numeric,
  price_position text, similar_p25 numeric, similar_p50 numeric, similar_p75 numeric,
  image_url text, listing_url text
)
language sql
stable
security definer
set search_path to ''
as $$
  with bounds as (
    select coalesce(p_before, now() + interval '1 minute') as before_at
  ),
  us_new as (
    select 'us-new-' || l.listing_id as event_id, l.first_seen_at as at, 'new'::text as kind,
           'US'::text as market, l.listing_id, l.name as title, f.morphs,
           l.sex_class, l.age_class, l.weight_grams,
           l.price, null::numeric as was_price, 'USD'::text as currency, l.price as price_local,
           l.position as price_position, l.similar_p25, l.similar_p50, l.similar_p75,
           l.primary_image_url as image_url, l.listing_url
    from geck_data.listing_market_mv l
    join geck_data.listing_facts_mv f using (listing_id)
    cross join bounds b
    where p_scope in ('all', 'US')
      and l.currency = 'USD' and not l.is_lot
      and l.first_seen_at <= b.before_at
      and l.first_seen_at > b.before_at - interval '120 days'
      and (f.first_listed_at is null or f.first_listed_at >= l.first_seen_at - interval '3 days')
      -- Leave out a day that was a catch-up after an outage.
      and not exists (
        select 1 from geck_data.market_daily d
         where d.market = 'US' and d.trait = '' and d.after_gap
           and d.day = (l.first_seen_at at time zone 'UTC')::date
      )
      -- And MorphMarket's first import.
      and l.first_seen_at >= (
        select min(d.day)::timestamp at time zone 'UTC' + interval '3 days'
          from geck_data.market_daily d where d.market = 'US' and d.trait = '' and d.full_check
      )
  ),
  us_ph as (
    select regexp_replace(h.listing_id, '^mm_', '') as listing_id, h.observed_at, h.price,
           lag(h.price) over (partition by h.listing_id order by h.observed_at) as prev
    from geck_data.price_history h
    cross join bounds b
    where p_scope in ('all', 'US')
      and h.currency = 'USD'
      and h.observed_at <= b.before_at
      and h.observed_at > b.before_at - interval '150 days'
  ),
  us_cuts as (
    select 'us-cut-' || c.listing_id || '-' || extract(epoch from c.observed_at)::bigint,
           c.observed_at, 'cut'::text, 'US'::text, l.listing_id, l.name, f.morphs,
           l.sex_class, l.age_class, l.weight_grams,
           c.price, c.prev, 'USD'::text, c.price,
           l.position, l.similar_p25, l.similar_p50, l.similar_p75,
           l.primary_image_url, l.listing_url
    from us_ph c
    cross join bounds b
    join geck_data.listing_market_mv l on l.listing_id = c.listing_id
    join geck_data.listing_facts_mv f on f.listing_id = c.listing_id
    where c.prev is not null and c.price < c.prev
      and c.observed_at > b.before_at - interval '120 days'
      and not l.is_lot
      and not exists (
        select 1 from geck_data.market_daily d
         where d.market = 'US' and d.trait = '' and d.after_gap
           and d.day = (c.observed_at at time zone 'UTC')::date
      )
  ),
  obs as (
    select o.platform, o.external_id, o.observed_on
    from geck_data.cross_platform_observations o
    where o.platform in ('feedle_kr', 'kr_shops', 'repsuki', 'terraristik')
      and o.observed_on > current_date - 120
  ),
  plat_days as (
    select platform, observed_on, count(*) as n from obs group by platform, observed_on
  ),
  plat_full as (
    select pd.platform, pd.observed_on,
           pd.n >= 0.5 * coalesce((
             select max(p2.n) from plat_days p2
              where p2.platform = pd.platform and p2.observed_on < pd.observed_on
                and p2.observed_on >= pd.observed_on - 45), 0) as full_check,
           lag(pd.observed_on) over (partition by pd.platform order by pd.observed_on) as prev_on,
           min(pd.observed_on) over (partition by pd.platform) as first_on
    from plat_days pd
  ),
  good_days as (
    -- A day counts when the source had a full check that day and on its
    -- previous check day, and it was not the source's first day.
    select pf.platform, pf.observed_on
    from plat_full pf
    join plat_full pp on pp.platform = pf.platform and pp.observed_on = pf.prev_on
    where pf.full_check and pp.full_check and pf.observed_on > pf.first_on
  ),
  first_obs as (
    select platform, external_id, min(observed_on) as first_on
    from obs group by platform, external_id
  ),
  intl_new as (
    select 'cp-new-' || c.id::text, c.first_seen_at, 'new'::text,
           case when c.platform in ('feedle_kr', 'kr_shops') then 'KR'
                when c.platform = 'repsuki' then 'JP' else 'EU' end,
           c.platform || ':' || c.external_id, c.title,
           coalesce(tr.traits, '{}'::text[]),
           case lower(coalesce(c.payload ->> 'sex', ''))
             when 'male' then 'male' when 'female' then 'female' else 'unsexed' end,
           null::text, null::numeric,
           round(c.price / nullif(fx.per_usd, 0)), null::numeric, c.currency, c.price,
           null::text, null::numeric, null::numeric, null::numeric,
           (select i.image_url from geck_data.cross_platform_listing_images i
             where i.cross_platform_listing_id = c.id limit 1),
           c.url
    from geck_data.cross_platform_listings c
    join first_obs fo on fo.platform = c.platform and fo.external_id = c.external_id
    join good_days gd on gd.platform = c.platform and gd.observed_on = fo.first_on
    left join geck_data.cross_platform_traits_mv tr on tr.platform = c.platform and tr.external_id = c.external_id
    left join geck_data.fx_rates fx on fx.currency = c.currency
    cross join bounds b
    where p_scope in ('all', 'KR', 'JP', 'EU')
      and (p_scope = 'all' or p_scope = case when c.platform in ('feedle_kr', 'kr_shops') then 'KR'
                                             when c.platform = 'repsuki' then 'JP' else 'EU' end)
      and coalesce(c.species, 'crested') = 'crested'
      and not coalesce((c.payload ->> 'is_group_lot')::boolean, false)
      and c.price > 0
      and c.first_seen_at <= b.before_at
  )
  select * from (
    select * from us_new
    union all
    select * from us_cuts
    union all
    select * from intl_new
  ) e
  -- Page by time, then by event id: a source can stamp many listings
  -- with the same time, and a plain time cursor would skip some of them.
  where p_before is null
     or e.at < p_before
     or (e.at = p_before and p_before_id is not null and e.event_id < p_before_id)
  order by e.at desc, e.event_id desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;
$stmt$;
    execute $stmt$
revoke all on function public.market_tape(timestamptz, integer, text, text) from public, anon;
$stmt$;
    execute $stmt$
grant execute on function public.market_tape(timestamptz, integer, text, text) to authenticated;
$stmt$;
  end if;
end
$do$;
