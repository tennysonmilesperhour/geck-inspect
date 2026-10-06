-- Time to sell model (Enterprise, Market Intelligence).
--
-- MorphMarket listings were checked for "sold" between 17 May and 7 Jun
-- 2026, so for that window we know, per listing, how long it was up
-- before it sold or the window closed. This returns a sales rate (sales
-- per listing-day) for the whole market and a multiplier for each age
-- class, sex, price position and trait. The app multiplies them for one
-- gecko and turns the rate into "half sell within N days" assuming a
-- steady rate (src/lib/sellTime.js). Small groups are pulled toward the
-- market rate (a prior worth K listing-days) so ten listings cannot
-- claim a trait sells three times faster.
--
-- Enterprise and admins only, like the rest of Market Intelligence.
create or replace function public.sell_time_model()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_tier text;
  v_out jsonb;
  k constant float8 := 500;
begin
  if auth.uid() is null then
    raise exception 'Sign in to see time to sell' using errcode = '42501';
  end if;
  v_tier := public.effective_tier_for_current_user();
  if coalesce(v_tier, 'free') <> 'enterprise' then
    return jsonb_build_object('allowed', false, 'tier', v_tier);
  end if;

  with bounds as (
    select min(sold_at) as w_start, max(sold_at) as w_end
    from geck_data.listings where sold_at is not null
  ),
  taxo as (
    select m.norm_name as norm from geck_data.crested_morph_taxonomy m
    union
    select lower(s.s) from geck_data.crested_morph_taxonomy m, unnest(m.synonyms) s(s)
  ),
  base as (
    select l.listing_id,
           l.price::float8 as price,
           geck_data._age_class(l.maturity) as age_class,
           coalesce(geck_data._sex_class(l.sex), 'unsexed') as sex_class,
           l.trait_array,
           greatest(extract(epoch from least(coalesce(l.sold_at, bd.w_end), bd.w_end) - l.first_seen_at) / 86400.0, 0.25) as t,
           (l.sold_at is not null)::int as ev
    from geck_data.listings l cross join bounds bd
    where coalesce(l.species, 'unknown') in ('crested', 'unknown')
      and l.currency = 'USD' and l.price > 0 and l.price < 100000
      and geck_data._age_class(l.maturity) is not null
      and l.first_seen_at < bd.w_end - interval '1 day'
      and not geck_data._looks_like_group_lot(l.name, false)
  ),
  medians as (
    select age_class, percentile_cont(0.5) within group (order by price) as med
    from base group by age_class
  ),
  -- Price position is measured against geckos of the same age with the
  -- same leading trait (the trait with the highest median ask), as the
  -- Sell page and the value estimate do, so a typical Lilly White price
  -- does not read as overpriced. Listings with no known trait fall back
  -- to the age median.
  trait_med as (
    select b.age_class, lower(trim(tr)) as tk,
           percentile_cont(0.5) within group (order by b.price) as med
    from base b, unnest(b.trait_array) tr
    where lower(trim(tr)) in (select norm from taxo)
      and tr not ilike 'Diet:%' and tr not ilike 'Proven breeder%'
    group by 1, 2
    having count(*) >= 8
  ),
  lead as (
    select b.listing_id, max(tm.med) as med
    from base b, unnest(b.trait_array) tr
    join trait_med tm on tm.tk = lower(trim(tr))
    where tm.age_class = b.age_class
    group by b.listing_id
  ),
  rated as (
    select b.*, b.price / coalesce(ld.med, m.med) as ratio
    from base b
    join medians m using (age_class)
    left join lead ld using (listing_id)
  ),
  priced as (
    select r.*,
           case when r.ratio < 0.7 then 'well_below'
                when r.ratio < 0.9 then 'below'
                when r.ratio <= 1.15 then 'typical'
                when r.ratio <= 1.5 then 'above'
                else 'well_above' end as price_band
    from rated r
  ),
  overall as (
    select count(*) as n, sum(ev) as sold, sum(t) as exposure, sum(ev) / sum(t) as rate from priced
  ),
  grp as (
    select 'age' as dim, age_class as key, count(*) as n, sum(ev) as sold, sum(t) as exposure from priced group by age_class
    union all
    select 'sex', sex_class, count(*), sum(ev), sum(t) from priced group by sex_class
    union all
    select 'price', price_band, count(*), sum(ev), sum(t) from priced group by price_band
    union all
    select 'trait', lower(trim(tr)), count(*), sum(p.ev), sum(p.t)
    from priced p, unnest(p.trait_array) tr
    where lower(trim(tr)) in (select norm from taxo)
      and tr not ilike 'Diet:%' and tr not ilike 'Proven breeder%'
    group by lower(trim(tr))
    having count(*) >= 20
  ),
  factors as (
    select g.dim, g.key, g.n, g.sold,
           round((((g.sold + k * o.rate) / (g.exposure + k)) / o.rate)::numeric, 3) as factor
    from grp g cross join overall o
  )
  select jsonb_build_object(
    'allowed', true,
    'window', jsonb_build_object('from', (select w_start::date from bounds), 'to', (select w_end::date from bounds)),
    'listings', o.n,
    'sold', o.sold,
    'rate', round(o.rate::numeric, 6),
    'age_medians', (select jsonb_object_agg(age_class, round(med::numeric)) from medians),
    'factors', (
      select jsonb_object_agg(dim, d) from (
        select f.dim, jsonb_object_agg(f.key, jsonb_build_object('n', f.n, 'sold', f.sold, 'factor', f.factor)) as d
        from factors f group by f.dim
      ) x
    )
  ) into v_out
  from overall o;

  return v_out;
end;
$$;

grant execute on function public.sell_time_model() to authenticated;
