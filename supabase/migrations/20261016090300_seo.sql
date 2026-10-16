-- Price Index minimum sample (comprehensive review item 27, adversarial
-- review section 11).
--
-- open_price_index() fed the public Geck Inspect Price Index
-- (/data/price-index.json) any trait with at least 5 listings. A median of
-- 5 asking prices moves by hundreds of dollars when one seller relists, and
-- small rows exposed label mix-ups (South Korea showed Harlequin at 6
-- listings next to Extreme Harlequin at 395). From this migration:
--
--   * a latest row needs at least 30 listings (was 5);
--   * a day counts toward a monthly median only with at least 30 listings;
--   * each latest row carries "thin": true when it has under 100 listings,
--     so pages can mark it.
--
-- The same numbers live in src/lib/priceIndexPolicy.js, which every page
-- and file built from the index applies again (a test checks the two
-- agree). The build applies the rule itself, so the order this migration
-- and the new site go live in does not matter: an old site build reading
-- the new function only sees fewer rows plus an extra field it ignores.
--
-- Same signature, same security definer and search_path, same callers
-- (the build script, with the anon key). Execute is granted by name to
-- anon, authenticated and service_role and no longer to PUBLIC
-- (supabase/SCHEMA_CONVENTIONS.md). Safe to run twice.

create or replace function public.open_price_index()
returns jsonb
language sql
stable
security definer
set search_path = public, geck_data
as $$
  with full_days as (
    select market, max(day) as last_day
    from geck_data.market_daily
    where full_check
    group by market
  ),
  latest as (
    select d.market, d.day, nullif(d.trait, '') as trait, d.for_sale, d.p25, d.p50, d.p75,
           d.new_listings, d.cuts
    from geck_data.market_daily d
    join full_days f on f.market = d.market and f.last_day = d.day
    where d.full_check and d.for_sale >= 30
  ),
  monthly as (
    select market,
           to_char(date_trunc('month', day), 'YYYY-MM') as month,
           nullif(trait, '') as trait,
           count(*) as full_checks,
           round(percentile_cont(0.5) within group (order by p50)::numeric) as median_p50,
           round(avg(for_sale)) as avg_for_sale
    from geck_data.market_daily
    where full_check and for_sale >= 30 and p50 is not null
    group by 1, 2, 3
  )
  select jsonb_build_object(
    'generated_at', now(),
    'min_listings', 30,
    'thin_below', 100,
    'latest', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market', market, 'checked_on', day, 'trait', trait, 'listings', for_sale,
        'p25', p25, 'median', p50, 'p75', p75, 'new_listings', new_listings, 'price_cuts', cuts,
        'thin', for_sale < 100
      ) order by market, trait nulls first)
      from latest
    ), '[]'::jsonb),
    'monthly', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market', market, 'month', month, 'trait', trait, 'full_checks', full_checks,
        'median', median_p50, 'avg_listings', avg_for_sale
      ) order by market, month, trait nulls first)
      from monthly
    ), '[]'::jsonb)
  );
$$;

comment on function public.open_price_index() is
  'Public Geck Inspect Price Index: aggregate asking prices (counts and quartiles, never single listings) from full catalog checks. A row needs at least 30 listings; rows under 100 carry thin = true. Mirrors src/lib/priceIndexPolicy.js.';

-- Open data, so signed-out visitors may call it, but through named grants
-- instead of the PUBLIC execute it was first created with: any role added
-- later gets nothing by accident (supabase/SCHEMA_CONVENTIONS.md, 4a).
revoke all on function public.open_price_index() from public;
grant execute on function public.open_price_index() to anon, authenticated, service_role;
