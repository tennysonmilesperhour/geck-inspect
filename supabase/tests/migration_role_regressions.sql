-- Migrations must apply as a role that is not a superuser.
--
-- On Supabase the migration role (postgres) is not a superuser, while the
-- local harness builds the schema as one. Some statements only a superuser
-- may run therefore pass here and fail in production. On 31 Oct 2026
-- 20261031010000_reminder_time_zones.sql failed on Supabase with
-- "permission denied to set parameter "geck.reminder_zone"": a function's
-- SET clause named a custom setting Postgres had not registered, which
-- Postgres 15 and later allow only for a superuser.
--
-- This file:
--   1. fails when any function in the app's schemas has a custom (dotted)
--      setting in its SET clause, the pattern that broke;
--   2. runs the October 31 migrations again as a role that owns what
--      postgres owns but is not a superuser, the way Supabase runs them.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser.
-- Everything (the role included) is rolled back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/migration_role_regressions.sql
begin;

do $custom_settings$
declare
  v_bad text;
begin
  select string_agg(n.nspname || '.' || p.proname || ' (' || c || ')', ', ')
    into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proconfig) c
   where n.nspname in ('public', 'geck_data')
     and split_part(c, '=', 1) like '%.%';
  if v_bad is not null then
    raise exception 'FAIL: SET clauses with a custom setting need a superuser on Supabase: %', v_bad;
  end if;
  raise notice 'PASS no function sets a custom setting in its SET clause';
end
$custom_settings$;

create role gi_migrator_check nosuperuser inherit;
grant postgres to gi_migrator_check;
set role gi_migrator_check;

do $not_super$
begin
  if (select rolsuper from pg_roles where rolname = current_user) then
    raise exception 'FAIL: the check role is a superuser';
  end if;
end
$not_super$;

\ir ../migrations/20261031010000_reminder_time_zones.sql
\ir ../migrations/20261031010100_egg_sire.sql

-- The runner works for this role too, and leaves no zone set afterwards.
do $runs$
begin
  perform public.run_reminders_local('vet', now());
  if coalesce(current_setting('geck.reminder_zone', true), '') <> '' then
    raise exception 'FAIL: geck.reminder_zone is still set after a run';
  end if;
  raise notice 'PASS the 31 October migrations apply and run as a role that is not a superuser';
end
$runs$;

reset role;
rollback;
