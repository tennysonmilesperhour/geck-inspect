-- Trait value table for the Collection Portfolio.
--
-- The Portfolio priced animals off public.morph_price_cache, which holds one
-- row, so nearly every gecko landed on "No data". Geck Data already has the
-- evidence: geck_data.listings carries ~9,900 crested listings with a
-- trait_array, maturity and sex. geck_data.v_listing_value computes per-trait
-- price bands from it, but only per listing. This function returns the same
-- bands keyed by trait so a client can price an animal it owns.
--
-- Filters and grouping mirror v_listing_value exactly (USD, crested or
-- unknown species, price 0 to 100k, no group lots, traits limited to the
-- crested_morph_taxonomy vocabulary) so the Portfolio and Geck Data agree on
-- what a Lilly White is worth. A band is only returned with 8 or more
-- listings behind it, the same floor v_listing_value uses.
--
-- Rows come at four levels: trait + age + sex, trait + age, trait + sex, and
-- trait alone ('any' marks a rolled-up dimension). The client uses the most
-- specific level that exists for the animal.
--
-- aliases carries the taxonomy name and synonyms for the trait (lowercase),
-- so the client can match 'Tricolor' to 'Tri-color' or 'Harley' to
-- 'Harlequin' without a second request.
--
-- Prices are asking prices on listings, not negotiated sale prices.
--
-- Cost: one scan of geck_data.listings, about 1s. Called once per Portfolio
-- visit and cached client-side. If it ever gets hot, move the body into a
-- materialized view with its own refresh job (do not add it to
-- geck_data.refresh_market_matviews, which the geck-data repo also edits).
--
-- security definer because authenticated users have no direct grant on the
-- geck_data tables it reads; it only returns aggregates.

create or replace function public.trait_value_table()
returns table (
  trait text,
  aliases text[],
  age_class text,
  sex_class text,
  n bigint,
  p25 numeric,
  p50 numeric,
  p75 numeric
)
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
  base as (
    select l.price,
           geck_data._age_class(l.maturity) as age_class,
           geck_data._sex_class(l.sex) as sex_class,
           l.trait_array
    from geck_data.listings l
    where coalesce(l.species, 'unknown') = any (array['crested', 'unknown'])
      and l.currency = 'USD'
      and l.price > 0
      and l.price < 100000
      and not geck_data._looks_like_group_lot(l.name, false)
  ),
  lt as (
    select b.price,
           b.age_class,
           b.sex_class,
           lower(trim(t.trait)) as trait_key,
           trim(t.trait) as trait_label
    from base b,
         lateral unnest(b.trait_array) t(trait)
    where lower(trim(t.trait)) in (select names.norm from names)
      and t.trait not ilike 'Diet:%'
      and t.trait not ilike 'Proven breeder%'
  ),
  stats as (
    select lt.trait_key,
           case when grouping(lt.age_class) = 1 then 'any' else lt.age_class end as age_class,
           case when grouping(lt.sex_class) = 1 then 'any' else lt.sex_class end as sex_class,
           count(*) as n,
           percentile_cont(0.25) within group (order by lt.price::float8) as p25,
           percentile_cont(0.50) within group (order by lt.price::float8) as p50,
           percentile_cont(0.75) within group (order by lt.price::float8) as p75
    from lt
    group by grouping sets (
      (lt.trait_key, lt.age_class, lt.sex_class),
      (lt.trait_key, lt.age_class),
      (lt.trait_key, lt.sex_class),
      (lt.trait_key)
    )
  ),
  labels as (
    select lt.trait_key,
           mode() within group (order by lt.trait_label) as trait
    from lt
    group by lt.trait_key
  ),
  alias_sets as (
    select lb.trait_key,
           array(
             select distinct a.alias
             from (
               select lb.trait_key as alias
               union all
               select tx.norm_name
               from taxo tx
               where tx.norm_name = lb.trait_key or lb.trait_key = any (tx.syns)
               union all
               select unnest(tx.syns)
               from taxo tx
               where tx.norm_name = lb.trait_key or lb.trait_key = any (tx.syns)
             ) a
             where a.alias is not null and a.alias <> ''
             order by a.alias
           ) as aliases
    from labels lb
  )
  select lb.trait,
         al.aliases,
         s.age_class,
         s.sex_class,
         s.n,
         round(s.p25::numeric, 0),
         round(s.p50::numeric, 0),
         round(s.p75::numeric, 0)
  from stats s
  join labels lb on lb.trait_key = s.trait_key
  join alias_sets al on al.trait_key = s.trait_key
  where s.n >= 8
    and s.age_class is not null
    and s.sex_class is not null
  order by lb.trait, s.age_class, s.sex_class;
$function$;

comment on function public.trait_value_table() is
  'Per-trait asking-price bands (p25/p50/p75) from geck_data.listings, by age and sex with rolled-up ''any'' levels. Same filters as geck_data.v_listing_value. Feeds the Collection Portfolio valuation.';

revoke all on function public.trait_value_table() from public, anon;
grant execute on function public.trait_value_table() to authenticated, service_role;
