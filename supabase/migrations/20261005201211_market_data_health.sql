-- One read-only health number set for the daily canary
-- (scripts/canary/run-canary.mjs). It answers "are value estimates being fed
-- fresh listings?" using the same species filter as trait_value_table(), so
-- a filter mismatch like the 'crested-gecko' one (1 to 5 Oct 2026) shows up
-- as zero new listings within a day instead of going unnoticed.
--
-- Service role only: it is for the canary, not the app.

create or replace function public.market_data_health()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
    )
  )
  from geck_data.listings l
  where coalesce(l.species, 'unknown') = any (array['crested', 'unknown'])
    and l.currency = 'USD'
    and l.price > 0
    and l.price < 100000;
$$;

revoke all on function public.market_data_health() from public, anon, authenticated;
grant execute on function public.market_data_health() to service_role;
