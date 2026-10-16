-- Guard switch regressions (migration 20261015233100_guard_switches.sql).
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it writes auth.users, switches roles the way the API does
-- (request.jwt.claims plus SET ROLE) and switches the database login the
-- way the sign-in service and the API gateway connect (SET SESSION
-- AUTHORIZATION). It is not pgTAP, and it is not meant for the Supabase
-- SQL editor or for production. Everything runs in one transaction and
-- rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/guard_switch_regressions.sql
--
-- Every check prints PASS or FAIL and the script ends with an error when
-- any check fails. Checks marked [fix] fail on a copy without the
-- migration (that is the proof the problem was real); checks marked
-- [holds] pass on both and prove the guard next to the fix still refuses
-- a member.
--
-- Covered:
--   1. Signup. The sign-in service logs in as supabase_auth_admin with no
--      member token. Its insert into auth.users creates the profile, and
--      the artwork trigger on profiles used to refuse that, so every new
--      signup failed. Both artwork triggers are also checked on their own
--      for each kind of caller.
--   2. Switches. apply_referral_code used to leave the referral switch on
--      after its own write, so a later write by the member in the same
--      transaction skipped the referral guard. Also: every switch a
--      member's call can turn on is off again when the call returns, a
--      request header named like a switch sets nothing, and no
--      member-callable function sets a setting whose name the caller picks.
begin;

create schema guard_switch_test;
grant usage on schema guard_switch_test to public;

create table guard_switch_test.results (
  seq serial primary key,
  check_name text not null,
  ok boolean not null,
  detail text
);

create function guard_switch_test.expect(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into guard_switch_test.results (check_name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail) $$;

-- Become a caller:
--   null            the database owner with no token (scheduled jobs, SQL editor)
--   'service'       the server key through the API
--   'api-anon'      a signed-out visitor through the API (authenticator login)
--   'api-no-token'  the API login with no token at all
--   'auth-service'  the sign-in service (supabase_auth_admin login, no token)
--   an email        that signed-in member through the API
-- Each call starts like a new request: no switch is on.
create function guard_switch_test.become(p_who text) returns void
language plpgsql as $$
declare
  v_id uuid;
begin
  execute 'reset session authorization';
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
  perform set_config('geck.referral_bypass', '', true);
  perform set_config('geck.ownership_transfer', '', true);
  perform set_config('geck.profile_privileged_write', '', true);
  if p_who is null then
    return;
  elsif p_who = 'service' then
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    perform set_config('role', 'service_role', true);
  elsif p_who = 'auth-service' then
    perform set_config('role', 'none', true);
    execute 'set local session authorization supabase_auth_admin';
  elsif p_who = 'api-no-token' then
    perform set_config('role', 'none', true);
    execute 'set local session authorization authenticator';
  elsif p_who = 'api-anon' then
    perform set_config('role', 'none', true);
    execute 'set local session authorization authenticator';
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
  else
    select id into v_id from auth.users where email = lower(p_who);
    if v_id is null then
      raise exception 'no auth.users row for %', p_who;
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_id, 'email', lower(p_who), 'role', 'authenticated',
                        'aud', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;

-- Run one statement as a caller. Returns 'ok' or 'error:<message>'. A
-- failed statement rolls back to before it.
create function guard_switch_test.try_as(p_who text, p_sql text) returns text
language plpgsql as $$
declare
  v_r text;
begin
  begin
    perform guard_switch_test.become(p_who);
    execute p_sql;
    v_r := 'ok';
  exception when others then
    v_r := 'error:' || sqlerrm;
  end;
  perform guard_switch_test.become(null);
  return v_r;
end $$;

grant execute on all functions in schema guard_switch_test to public;

-- A member created as the database owner (the existing fixture route).
create function guard_switch_test.mk_user(p_email text) returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    lower(p_email), 'not-a-real-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  );
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Signup and the artwork triggers
-- ---------------------------------------------------------------------------
do $s$
declare
  r text;
begin
  -- [fix] A new member signs up: the sign-in service inserts auth.users
  -- and the profile row follows, with no plan or role carried in.
  r := guard_switch_test.try_as('auth-service', $q$
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
            'gs-signup@example.com', 'not-a-real-password', now(),
            '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Crested Keeper"}'::jsonb,
            now(), now())$q$);
  perform guard_switch_test.expect('[fix] signup: the sign-in service creates the account and its profile',
    r = 'ok'
    and exists (select 1 from auth.users where email = 'gs-signup@example.com')
    and exists (select 1 from public.profiles
                 where email = 'gs-signup@example.com'
                   and full_name = 'Crested Keeper'
                   and created_by = 'gs-signup@example.com'
                   and coalesce(membership_tier, 'free') = 'free'
                   and coalesce(role, 'user') = 'user'
                   and referral_code is not null),
    r);
end
$s$;

-- The artwork trigger functions on their own, attached to probe tables, so
-- each caller's result comes from the trigger and not from a row policy.
create table guard_switch_test.sync_probe (email text, gecko_artwork_style text);
create table guard_switch_test.inherit_probe (created_by text, inherited_placeholder_style text);
grant insert, select on guard_switch_test.sync_probe, guard_switch_test.inherit_probe to public;
create trigger sync_probe_artwork after insert on guard_switch_test.sync_probe
  for each row execute function geck_private.sync_owner_artwork();
create trigger inherit_probe_artwork before insert on guard_switch_test.inherit_probe
  for each row execute function geck_private.inherit_gecko_artwork();

do $a$
declare
  r text;
  v_who text;
  v_member uuid := guard_switch_test.mk_user('gs-art@example.com');
begin
  -- [fix] The sign-in service passes both triggers.
  r := guard_switch_test.try_as('auth-service', $q$insert into guard_switch_test.sync_probe values ('gs-probe@example.com', null)$q$);
  perform guard_switch_test.expect('[fix] artwork sync: the sign-in service login is trusted', r = 'ok', r);
  r := guard_switch_test.try_as('auth-service', $q$insert into guard_switch_test.inherit_probe values ('gs-probe@example.com', null)$q$);
  perform guard_switch_test.expect('[fix] artwork inherit: the sign-in service login is trusted', r = 'ok', r);

  -- [holds] An API request with no signed-in member is still refused,
  -- with or without a token.
  foreach v_who in array array['api-anon', 'api-no-token'] loop
    r := guard_switch_test.try_as(v_who, $q$insert into guard_switch_test.sync_probe values ('gs-probe@example.com', null)$q$);
    perform guard_switch_test.expect('[holds] artwork sync: refused for ' || v_who, r like 'error:Authentication required%', r);
    r := guard_switch_test.try_as(v_who, $q$insert into guard_switch_test.inherit_probe values ('gs-probe@example.com', null)$q$);
    perform guard_switch_test.expect('[holds] artwork inherit: refused for ' || v_who, r like 'error:Authentication required%', r);
  end loop;

  -- [holds] Members, the server key and the database owner pass, as before.
  foreach v_who in array array['gs-art@example.com', 'service'] loop
    r := guard_switch_test.try_as(v_who, $q$insert into guard_switch_test.sync_probe values ('gs-probe@example.com', null)$q$);
    perform guard_switch_test.expect('[holds] artwork sync: allowed for ' || v_who, r = 'ok', r);
  end loop;
  r := guard_switch_test.try_as(null, $q$insert into guard_switch_test.sync_probe values ('gs-probe@example.com', null)$q$);
  perform guard_switch_test.expect('[holds] artwork sync: allowed for the database owner', r = 'ok', r);

  -- [holds] A member's own artwork default still reaches their geckos.
  insert into public.geckos (id, name, created_by, status) values ('gs-gecko-art', 'Lilly White', 'gs-art@example.com', 'Pet');
  r := guard_switch_test.try_as('gs-art@example.com',
    $q$update public.profiles set gecko_artwork_style = 'woodcut' where email = 'gs-art@example.com'$q$);
  perform guard_switch_test.expect('[holds] artwork: a member''s default reaches their geckos',
    r = 'ok' and (select inherited_placeholder_style from public.geckos where id = 'gs-gecko-art') = 'woodcut', r);

  -- [holds] A signed-out visitor still cannot plant a profile.
  r := guard_switch_test.try_as('api-anon',
    $q$insert into public.profiles (email, created_by) values ('gs-planted@example.com', 'gs-planted@example.com')$q$);
  perform guard_switch_test.expect('[holds] signup: a signed-out visitor cannot create a profile',
    r like 'error:%' and not exists (select 1 from public.profiles where email = 'gs-planted@example.com'), r);
end
$a$;

-- ---------------------------------------------------------------------------
-- 2. Switches
-- ---------------------------------------------------------------------------
create temp table _gs (k text primary key, v text) on commit drop;

do $fx$
declare
  v_seller uuid;
begin
  perform guard_switch_test.mk_user('gs-ref@example.com');
  perform guard_switch_test.mk_user('gs-new@example.com');
  perform guard_switch_test.mk_user('gs-new2@example.com');
  perform guard_switch_test.mk_user('gs-old@example.com');
  perform guard_switch_test.mk_user('gs-grant@example.com');
  v_seller := guard_switch_test.mk_user('gs-seller@example.com');
  perform guard_switch_test.mk_user('gs-buyer@example.com');
  -- The referrer and the long-standing member are not new accounts.
  update public.profiles set created_date = now() - interval '60 days'
   where email in ('gs-ref@example.com', 'gs-old@example.com');
  update auth.users set created_at = now() - interval '60 days'
   where email in ('gs-ref@example.com', 'gs-old@example.com');
  insert into _gs values ('code', (select referral_code from public.profiles where email = 'gs-ref@example.com'));

  insert into public.store_signup_grants (token, granted_email, granted_tier, granted_duration_days, expires_at)
  values ('gs-grant-token-0001', 'gs-grant@example.com', 'keeper', 30, now() + interval '7 days');

  insert into public.geckos (id, name, created_by, status) values ('gs-gecko-sale', 'Harlequin for sale', 'gs-seller@example.com', 'Pet');
  insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, created_by, expires_at)
  values ('gs-gecko-sale', 'gecko', v_seller, 'gs-buyer@example.com', 'gs-transfer-tok-01', 'gs-seller@example.com', now() + interval '3 days');
end
$fx$;

do $r$
declare
  r text;
  v_code text := (select v from _gs where k = 'code');
  v_applied boolean;
  v_switch text;
begin
  -- [holds] The legitimate call still records who referred the member.
  r := guard_switch_test.try_as('gs-new@example.com', format($q$select public.apply_referral_code(%L)$q$, v_code));
  perform guard_switch_test.expect('[holds] referral: a new member''s code is recorded',
    r = 'ok' and (select referred_by from public.profiles where email = 'gs-new@example.com') = v_code, r);

  -- [fix] The call, then the member's own write, in one transaction.
  perform guard_switch_test.become('gs-new2@example.com');
  v_applied := public.apply_referral_code(v_code);
  v_switch := coalesce(current_setting('geck.referral_bypass', true), '');
  update public.profiles
     set referral_grant_until = now() + interval '1 year',
         referral_signup_count = 50,
         referral_code = 'gsvanity'
   where email = 'gs-new2@example.com';
  perform guard_switch_test.become(null);
  perform guard_switch_test.expect('[fix] referral: the switch is off when apply_referral_code returns',
    v_applied and v_switch is distinct from 'on', 'switch=' || v_switch);
  perform guard_switch_test.expect('[fix] referral: a write after apply_referral_code in the same transaction is still guarded',
    (select referral_grant_until is null and coalesce(referral_signup_count, 0) = 0
            and referral_code is distinct from 'gsvanity'
            and referred_by = v_code
       from public.profiles where email = 'gs-new2@example.com'));

  -- [holds] Without the call, the referral columns are the server's.
  r := guard_switch_test.try_as('gs-old@example.com', $q$update public.profiles
        set referral_grant_until = now() + interval '1 year', referral_signup_count = 50, referred_by = 'gsvanity'
      where email = 'gs-old@example.com'$q$);
  perform guard_switch_test.expect('[holds] referral: a member''s direct write is reverted',
    (select referral_grant_until is null and coalesce(referral_signup_count, 0) = 0 and referred_by is null
       from public.profiles where email = 'gs-old@example.com'), r);

  -- [holds] A request header named like the switch sets nothing. The API
  -- puts every header into the one JSON setting request.headers.
  perform guard_switch_test.become('gs-old@example.com');
  perform set_config('request.headers', '{"geck.referral_bypass":"on","geck.profile_privileged_write":"on"}', true);
  update public.profiles
     set referral_grant_until = now() + interval '1 year', membership_tier = 'breeder'
   where email = 'gs-old@example.com';
  perform guard_switch_test.become(null);
  perform guard_switch_test.expect('[holds] switches: a request header named like a switch sets nothing',
    (select referral_grant_until is null and coalesce(membership_tier, 'free') = 'free'
       from public.profiles where email = 'gs-old@example.com'));
end
$r$;

-- The round 1 switches, the same way: off when the call returns, so the
-- member's next write in the transaction meets the guard.
do $r1$
declare
  v_switch text;
begin
  perform guard_switch_test.become('gs-grant@example.com');
  perform public.redeem_signup_grant('gs-grant-token-0001');
  v_switch := coalesce(current_setting('geck.profile_privileged_write', true), '');
  update public.profiles set membership_tier = 'enterprise', social_post_credits = 99 where email = 'gs-grant@example.com';
  perform guard_switch_test.become(null);
  perform guard_switch_test.expect('[holds] signup grant: plan applied, switch off, the member''s next write is guarded',
    v_switch is distinct from 'on'
    and (select membership_tier = 'keeper' and coalesce(social_post_credits, 0) = 0
           from public.profiles where email = 'gs-grant@example.com'),
    'switch=' || v_switch);

  perform guard_switch_test.become('gs-buyer@example.com');
  perform public.claim_transfer('gs-transfer-tok-01', false);
  v_switch := coalesce(current_setting('geck.ownership_transfer', true), '');
  perform guard_switch_test.become(null);
  perform guard_switch_test.expect('[holds] transfer: claimed, switch off when claim_transfer returns',
    v_switch is distinct from 'on'
    and (select created_by from public.geckos where id = 'gs-gecko-sale') = 'gs-buyer@example.com',
    'switch=' || v_switch);
end
$r1$;

-- Static checks over every function a signed-out visitor or a member can
-- call through the API.
do $st$
declare
  v_bad text;
begin
  -- [fix] Every geck switch such a function turns on, it also turns off.
  select string_agg(distinct p.oid::regprocedure::text || ' leaves ' || m[1] || ' on', ', ')
    into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral regexp_matches(p.prosrc, 'set_config\(\s*''(geck\.[a-z_]+)''\s*,\s*''on''', 'g') m
   where n.nspname not in ('pg_catalog', 'information_schema', 'guard_switch_test')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
     and position(format('set_config(''%s'', ''off''', m[1]) in p.prosrc) = 0;
  perform guard_switch_test.expect('[fix] switches: every switch a member''s call turns on is turned off in the same function',
    v_bad is null, v_bad);

  -- [holds] Every set_config in such a function names a fixed setting, so
  -- no caller can pick the setting a call turns on.
  select string_agg(distinct p.oid::regprocedure::text, ', ')
    into v_bad
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname not in ('pg_catalog', 'information_schema', 'guard_switch_test')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
     and p.prosrc ~* 'set_config\s*\(\s*[^''\s]';
  perform guard_switch_test.expect('[holds] switches: no member-callable function sets a setting the caller names',
    v_bad is null, v_bad);

  -- [holds] The functions this migration restates keep their grants.
  perform guard_switch_test.expect('[holds] grants: artwork triggers are not callable from the API',
    not has_function_privilege('anon', 'geck_private.sync_owner_artwork()', 'execute')
    and not has_function_privilege('authenticated', 'geck_private.sync_owner_artwork()', 'execute')
    and not has_function_privilege('anon', 'geck_private.inherit_gecko_artwork()', 'execute')
    and not has_function_privilege('authenticated', 'geck_private.inherit_gecko_artwork()', 'execute'));
  perform guard_switch_test.expect('[holds] grants: apply_referral_code is for signed-in members and the server',
    has_function_privilege('authenticated', 'public.apply_referral_code(text)', 'execute')
    and has_function_privilege('service_role', 'public.apply_referral_code(text)', 'execute')
    and not has_function_privilege('anon', 'public.apply_referral_code(text)', 'execute')
    and (select prosecdef from pg_proc where oid = 'public.apply_referral_code(text)'::regprocedure));
end
$st$;

select case when ok then 'PASS' else 'FAIL' end as result, check_name, detail
  from guard_switch_test.results
 order by seq;

do $final$
declare
  v_failed integer;
  v_total integer;
begin
  select count(*) filter (where not ok), count(*) into v_failed, v_total from guard_switch_test.results;
  if v_failed > 0 then
    raise exception '% of % guard switch checks failed', v_failed, v_total;
  end if;
  raise notice 'All % guard switch checks passed', v_total;
end
$final$;

rollback;
