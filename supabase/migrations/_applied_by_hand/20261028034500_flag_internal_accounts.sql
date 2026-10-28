-- Run by hand in production on 28 Oct 2026 (about 03:45 UTC), through the
-- Supabase MCP as the session's one-off step for the honest scoreboard
-- (20261028040100_scoreboard_honest_counts.sql). It marks the internal
-- accounts so the Weekly scoreboard leaves them out of paying breeders,
-- weekly active breeders, passports and the member counts: the TestFlight
-- QA account and the three App Review accounts. Selected by their display
-- names, which only these internal accounts use; no address is in this
-- file. Preview and check both returned 4; the update changed 4 rows.
-- Safe to run again (it skips accounts already flagged).

update auth.users au
   set raw_app_meta_data = coalesce(au.raw_app_meta_data, '{}'::jsonb) || '{"internal": true}'::jsonb
  from public.profiles p
 where lower(p.email) = lower(au.email)
   and (p.full_name = 'Geck Simulator QA' or p.full_name like 'Apple Review %')
   and coalesce(p.role, 'user') <> 'admin'
   and coalesce(au.raw_app_meta_data ->> 'internal', 'false') <> 'true';

-- Check, expect 4:
-- select count(*) from auth.users where raw_app_meta_data ->> 'internal' = 'true';
