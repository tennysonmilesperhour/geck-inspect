-- This shared Geck Intellect query previously deduplicated the entire price
-- history before selecting a trait combination. Restrict observations first,
-- preserving the weekly latest-price definition and the existing public RLS.
create or replace function geck_data.combo_weekly_prices(p_trait_a text, p_trait_b text, window_days integer default 180)
returns table(week_start date, median_price numeric, n_listings bigint, observed_days bigint)
language sql stable set search_path = '' as $$
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
$$;
