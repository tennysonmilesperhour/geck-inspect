-- Two-factor sign-in for admin powers, behind a switch that starts off
-- (comprehensive review, Part E item E1 10).
--
-- The app now lets the admin account add an authenticator app (Settings,
-- Security) and asks for its 6-digit code at sign-in, which raises the
-- session's assurance level from aal1 (password or link only) to aal2
-- (password plus code). This file is the database half: it lets admin
-- powers require that second step, once Tennyson has an authenticator.
--
-- What it does, in plain words:
--
-- 1. Adds the app_settings row 'admin_requires_mfa', set to false. It is
--    only added when missing, so a value set later is never overwritten.
--    It is not public: signed-out visitors and members cannot read it.
--
-- 2. Restates public.is_admin(). It starts from the production body
--    (pg_get_functiondef md5 6f80a951a16998dd22caf3fb982f7288, read on
--    28 Oct 2026, the same text as 20260410025954_remote_schema.sql) and
--    adds one condition: when the switch is true, an admin's request only
--    counts as admin when its token says aal2. With the switch false, or
--    the row missing, it answers exactly as before. Owner, STABLE,
--    SECURITY DEFINER, search_path and grants are kept (create or
--    replace keeps them; anon and authenticated must keep EXECUTE
--    because 131 policies call it, some for signed-out visitors).
--    It stays fast: a member's request stops after the one indexed
--    profile lookup (profiles_email_key), as before. Only an admin's
--    request at aal1 reads the switch, by its primary key.
--
-- 3. Points the agent_hits_admin_read policy at is_admin() instead of its
--    own copy of the email check (read in production on 28 Oct 2026:
--    exists (select 1 from profiles p where p.email = auth.jwt() ->>
--    'email' and p.role = 'admin')). Same answer while the switch is off.
--
-- Turning it on (only after a read-only check shows a verified factor
-- on the admin account, see docs/planning/admin-mfa-2026-10.md):
--   update public.app_settings set value = 'true'::jsonb,
--          updated_at = now()
--    where key = 'admin_requires_mfa';
-- Turning it off again (works from any database session; an admin who
-- has not entered a code cannot change app_settings once it is on):
--   update public.app_settings set value = 'false'::jsonb,
--          updated_at = now()
--    where key = 'admin_requires_mfa';
--
-- Safe to run more than once: on conflict do nothing, create or replace,
-- drop policy if exists before create policy. Safe in either order with
-- the app release: with the switch off nothing changes for anyone.

-- 1. The switch ----------------------------------------------------------

insert into public.app_settings (key, value, is_public, description)
values (
  'admin_requires_mfa',
  'false'::jsonb,
  false,
  'Admin powers need two-factor sign-in. On (true): public.is_admin() is only true for a session that entered an authenticator code (token aal2). Off (false) or missing: is_admin() checks the profile role only, as before. Turn on only after the admin account has a verified authenticator (Settings, Security). An admin without a code cannot change this row while it is on; turn it off from a database session.'
)
on conflict (key) do nothing;

-- 2. is_admin(), with the switch ----------------------------------------

create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email' AND profiles.role = 'admin'
  )
  -- Two-factor rule (app_settings 'admin_requires_mfa'). Evaluated only
  -- when the profile check above is true, so a member's request still
  -- costs one lookup.
  AND (
    coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    OR NOT coalesce(
      (SELECT value = 'true'::jsonb FROM app_settings WHERE key = 'admin_requires_mfa'),
      false
    )
  );
$function$;

-- 3. The AI traffic log policy uses is_admin() ----------------------------

drop policy if exists agent_hits_admin_read on public.agent_hits;
create policy agent_hits_admin_read on public.agent_hits
  for select to authenticated
  -- In a select so Postgres works it out once per query, not once per row.
  using ((select public.is_admin()));
