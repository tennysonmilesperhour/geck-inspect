-- The daily canary (scripts/canary/run-canary.mjs) passed every day while the
-- US market feed had stalled: its only freshness check was "some new listings
-- in 3 days", which the 30-minute newest-listings route kept true. On 28 Oct
-- 2026 the last complete pass of the catalog was 19 Oct (0.4% of live
-- listings re-observed in 48 hours) and the US Price Index's last full day was
-- 6 Oct.
--
-- public.market_data_health() gains three keys the canary now checks:
--   last_complete_pass_at  geck_data.market_coverage(48).last_complete_pass_at
--   coverage_pct           the share of live listings re-observed in 48 hours
--   us_last_full_day       the newest geck_data.market_daily day with a full
--                          US check (what the Price Index shows)
-- The full body of 20261005201211 with those keys added; the existing keys
-- are unchanged, so an older canary keeps working. Service role only, as
-- before (create or replace keeps the grants; they are restated anyway).

create or replace function public.market_data_health()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'listings_counted', count(*),
    'new_last_3_days', count(*) filter (where l.first_seen_at > now() - interval '3 days'),
    'seen_last_3_days', count(*) filter (where l.last_seen_at > now() - interval '3 days'),
    'newest_first_seen', max(l.first_seen_at),
    'newest_last_seen', max(l.last_seen_at),
    'uncounted_species', (
      select coalesce(jsonb_object_agg(x.species, x.n), '{}'::jsonb)
        from (
          select l2.species, count(*) as n
            from geck_data.listings l2
           where coalesce(l2.species, 'unknown') <> all (array['crested', 'unknown'])
           group by l2.species
        ) x
    ),
    -- New in 20261028015600.
    'last_complete_pass_at', (select c.last_complete_pass_at from geck_data.market_coverage(48) c),
    'coverage_pct', (select c.coverage_pct from geck_data.market_coverage(48) c),
    'us_last_full_day', (select max(d.day) from geck_data.market_daily d where d.market = 'US' and d.full_check)
  )
  from geck_data.listings l
  where coalesce(l.species, 'unknown') = any (array['crested', 'unknown'])
    and l.currency = 'USD'
    and l.price > 0
    and l.price < 100000;
$function$;

revoke all on function public.market_data_health() from public, anon, authenticated;
grant execute on function public.market_data_health() to service_role;
