-- Admin two-factor regressions (migration 20261028040200_admin_mfa.sql).
--
-- Plain SQL for a scratch copy of the harness template (never production).
-- Runs in one transaction and rolls back. Each failed check raises
-- "FAIL: ...". Covered:
--   1. The switch row exists, is off and is not public.
--   2. Switch off: is_admin() answers as before, whatever the token's aal.
--   3. Switch on: an admin token at aal1 is refused, aal2 is allowed, a
--      member is refused either way, and a missing row means off.
--   4. The agent_hits_admin_read policy calls is_admin() and follows the
--      switch.
--   5. With the switch on, an admin at aal1 cannot turn it off through
--      the API (app_settings writes go through is_admin()).
--   6. is_admin() keeps its shape: STABLE, SECURITY DEFINER, search_path
--      public, owned by postgres, callable by anon and authenticated.
--   7. Running the migration again keeps a switch someone turned on.
begin;
\ir ../../scripts/sql-harness/impersonate.sql

select test_helpers.create_user('mfa-admin@example.com');
select test_helpers.create_user('mfa-member@example.com');
update public.profiles set role = 'admin' where email = 'mfa-admin@example.com';
insert into public.agent_hits (agent, kind, path, ua) values ('GPTBot', 'ai', '/MorphGuide', 'test');

-- Act as a member with the given assurance level, the way PostgREST does
-- (the token's claims plus the authenticated role).
create function test_helpers.act_as_aal(p_email text, p_aal text) returns void
language plpgsql as $$
begin
  perform test_helpers.act_as(p_email);
  perform set_config('request.jwt.claims',
    jsonb_set(current_setting('request.jwt.claims')::jsonb, '{aal}', to_jsonb(p_aal))::text, true);
end $$;
grant execute on function test_helpers.act_as_aal(text, text) to authenticated;

-- 1. The switch row --------------------------------------------------------
do $$ begin
  if not exists (select 1 from public.app_settings where key = 'admin_requires_mfa') then
    raise exception 'FAIL: switch row admin_requires_mfa is missing';
  end if;
  if (select value from public.app_settings where key = 'admin_requires_mfa') <> 'false'::jsonb then
    raise exception 'FAIL: switch does not start off';
  end if;
  if (select is_public from public.app_settings where key = 'admin_requires_mfa') then
    raise exception 'FAIL: switch is readable by everyone';
  end if;
end $$;

-- 2. Switch off: no change -------------------------------------------------
select test_helpers.act_as_aal('mfa-admin@example.com', 'aal1');
do $$ begin
  if not public.is_admin() then raise exception 'FAIL: switch off, admin at aal1 lost admin'; end if;
  if (select count(*) from public.agent_hits) <> 1 then raise exception 'FAIL: switch off, admin at aal1 cannot read agent_hits'; end if;
end $$;
select test_helpers.act_as_aal('mfa-admin@example.com', 'aal2');
do $$ begin
  if not public.is_admin() then raise exception 'FAIL: switch off, admin at aal2 lost admin'; end if;
end $$;
select test_helpers.act_as_aal('mfa-member@example.com', 'aal2');
do $$ begin
  if public.is_admin() then raise exception 'FAIL: member is admin'; end if;
  if (select count(*) from public.agent_hits) <> 0 then raise exception 'FAIL: member reads agent_hits'; end if;
end $$;
select test_helpers.act_as_anon();
do $$ begin
  if public.is_admin() then raise exception 'FAIL: signed-out visitor is admin'; end if;
end $$;

-- 4 (shape). The policy calls is_admin() ------------------------------------
select test_helpers.act_as_postgres();
do $$
declare v_qual text;
begin
  select qual into v_qual from pg_policies
   where schemaname = 'public' and tablename = 'agent_hits' and policyname = 'agent_hits_admin_read';
  if v_qual is distinct from '( SELECT is_admin() AS is_admin)' then
    raise exception 'FAIL: agent_hits_admin_read does not use is_admin(): %', v_qual;
  end if;
end $$;

-- 3. Switch on ---------------------------------------------------------------
update public.app_settings set value = 'true'::jsonb where key = 'admin_requires_mfa';

select test_helpers.act_as_aal('mfa-admin@example.com', 'aal1');
do $$ begin
  if public.is_admin() then raise exception 'FAIL: switch on, admin at aal1 is still admin'; end if;
  if (select count(*) from public.agent_hits) <> 0 then raise exception 'FAIL: switch on, admin at aal1 reads agent_hits'; end if;
end $$;
-- 5. ...and cannot turn the switch off through the API.
update public.app_settings set value = 'false'::jsonb where key = 'admin_requires_mfa';
select test_helpers.act_as_postgres();
do $$ begin
  if (select value from public.app_settings where key = 'admin_requires_mfa') <> 'true'::jsonb then
    raise exception 'FAIL: admin at aal1 turned the switch off';
  end if;
end $$;

-- A token with no aal claim at all counts as aal1.
select test_helpers.act_as('mfa-admin@example.com');
select set_config('request.jwt.claims', (current_setting('request.jwt.claims')::jsonb - 'aal')::text, true);
do $$ begin
  if public.is_admin() then raise exception 'FAIL: switch on, admin token without aal is admin'; end if;
end $$;

select test_helpers.act_as_aal('mfa-admin@example.com', 'aal2');
do $$ begin
  if not public.is_admin() then raise exception 'FAIL: switch on, admin at aal2 refused'; end if;
  if (select count(*) from public.agent_hits) <> 1 then raise exception 'FAIL: switch on, admin at aal2 cannot read agent_hits'; end if;
end $$;
select test_helpers.act_as_aal('mfa-member@example.com', 'aal2');
do $$ begin
  if public.is_admin() then raise exception 'FAIL: switch on, member at aal2 is admin'; end if;
end $$;

-- A missing row means off.
select test_helpers.act_as_postgres();
delete from public.app_settings where key = 'admin_requires_mfa';
select test_helpers.act_as_aal('mfa-admin@example.com', 'aal1');
do $$ begin
  if not public.is_admin() then raise exception 'FAIL: missing switch row refused admin at aal1'; end if;
end $$;

-- 6. Shape of is_admin() ------------------------------------------------------
select test_helpers.act_as_postgres();
do $$
declare p record;
begin
  select provolatile, prosecdef, proconfig, pg_get_userbyid(proowner) as owner into p
    from pg_proc where oid = 'public.is_admin()'::regprocedure;
  if p.provolatile <> 's' then raise exception 'FAIL: is_admin is not STABLE'; end if;
  if not p.prosecdef then raise exception 'FAIL: is_admin is not SECURITY DEFINER'; end if;
  if p.proconfig is distinct from array['search_path=public'] then raise exception 'FAIL: is_admin search_path is %', p.proconfig; end if;
  if p.owner <> 'postgres' then raise exception 'FAIL: is_admin owner is %', p.owner; end if;
  if not has_function_privilege('anon', 'public.is_admin()', 'execute')
     or not has_function_privilege('authenticated', 'public.is_admin()', 'execute') then
    raise exception 'FAIL: is_admin lost EXECUTE for anon or authenticated (policies call it)';
  end if;
end $$;

-- 7. Running the migration again keeps a switch someone turned on ------------
insert into public.app_settings (key, value, is_public) values ('admin_requires_mfa', 'true'::jsonb, false);
\ir ../migrations/20261028040200_admin_mfa.sql
do $$ begin
  if (select value from public.app_settings where key = 'admin_requires_mfa') <> 'true'::jsonb then
    raise exception 'FAIL: running the migration again reset the switch';
  end if;
  if (select count(*) from pg_policies where tablename = 'agent_hits' and policyname = 'agent_hits_admin_read') <> 1 then
    raise exception 'FAIL: running the migration again duplicated or lost the policy';
  end if;
end $$;

select 'admin_mfa_regressions: all checks passed' as result;
rollback;
