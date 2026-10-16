-- Test helpers for acting as Supabase API callers inside a scratch copy of
-- the template that scripts/sql-harness/build.sh makes.
-- Install into a scratch copy (never into the template, never into production):
--   psql -X -d <scratch copy> -f scripts/sql-harness/impersonate.sql
-- Everything lives in schema test_helpers so it cannot be confused with app objects.
--
-- How Supabase does it: PostgREST connects as "authenticator", copies the JWT
-- payload into the setting request.jwt.claims, and runs SET LOCAL ROLE to the
-- JWT's role (anon, authenticated or service_role). auth.uid(), auth.email(),
-- auth.role() and auth.jwt() read that setting. These helpers do the same,
-- transaction-locally, so ROLLBACK undoes the impersonation and the data.
--
-- Usage:
--   begin;
--   select test_helpers.create_user('a@example.com');            -- auth.users row + profile (trigger)
--   select test_helpers.act_as('a@example.com');                 -- authenticated member A
--   ... queries run under RLS as A ...
--   select test_helpers.act_as_anon();                           -- signed-out visitor
--   select test_helpers.act_as_service();                        -- service_role (bypasses RLS)
--   select test_helpers.act_as_postgres();                       -- back to the superuser, claims cleared
--   rollback;

create schema if not exists test_helpers;
grant usage on schema test_helpers to anon, authenticated, service_role;

-- Creates an auth.users row the way GoTrue does for a confirmed email signup.
-- The production trigger on_auth_user_created then inserts the public.profiles row.
create or replace function test_helpers.create_user(p_email text, p_full_name text default null, p_id uuid default gen_random_uuid())
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', lower(p_email),
          extensions.crypt('password', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          case when p_full_name is null then '{}'::jsonb else jsonb_build_object('full_name', p_full_name) end,
          now(), now());
  return p_id;
end $$;
revoke all on function test_helpers.create_user(text, text, uuid) from public, anon, authenticated;

create or replace function test_helpers.user_id(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from auth.users where email = lower(p_email)
$$;

-- Act as a signed-in member. Claims mirror a Supabase access token.
-- The act_as functions carry no SET clause on purpose: a function with a SET clause
-- would roll back the role and claims changes when it returns. All names are
-- schema-qualified instead.
create or replace function test_helpers.act_as(p_email text)
returns jsonb language plpgsql as $$
declare
  v_id uuid;
  v_claims jsonb;
begin
  perform set_config('role', 'postgres', true);
  select id into v_id from auth.users where email = lower(p_email);
  if v_id is null then
    raise exception 'no auth.users row for %', p_email;
  end if;
  v_claims := jsonb_build_object(
    'sub', v_id::text, 'email', lower(p_email), 'role', 'authenticated', 'aud', 'authenticated',
    'aal', 'aal1', 'is_anonymous', false,
    'app_metadata', jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    'exp', extract(epoch from now() + interval '1 hour')::bigint);
  perform set_config('request.jwt.claims', v_claims::text, true);
  perform set_config('role', 'authenticated', true);
  return v_claims;
end $$;

create or replace function test_helpers.act_as_anon()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function test_helpers.act_as_service()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

-- Back to the superuser with no JWT, like a migration or the SQL editor.
create or replace function test_helpers.act_as_postgres()
returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema test_helpers to anon, authenticated, service_role;
revoke all on function test_helpers.create_user(text, text, uuid) from public, anon, authenticated;
