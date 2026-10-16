-- What the admin analytics screens and the offline-log changes of
-- 16 October 2026 rely on in the database (engineering cleanup).
--
-- No migration came with those changes; the app now reads the database
-- differently, and this file pins the rules it reads through, so a later
-- migration that breaks them fails here first:
--
--   1. An admin reads every user_events row, in the columns the analytics
--      screens select (src/lib/adminData.js, USER_EVENT_COLUMNS); a member
--      reads none.
--   2. read_profiles(null) gives an admin every member's row, with the
--      email, role and created_date the screens use.
--   3. A signed-in admin may select the id, owner and date columns the
--      screens read from geckos, gecko_images, forum_posts, forum_comments,
--      breeding_plans and direct_messages. If one of those column grants is
--      ever revoked from `authenticated` (review item E1 4 proposes it for
--      email columns), give the screens an admin-only function first.
--   4. A member can still write user_activity: app copies opened before
--      16 October still do, for hours, and must not fail.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it makes its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Everything rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/eng_regressions.sql
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text, p_role text default 'user')
returns void
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'eng-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  update public.profiles set role = p_role where email = v_email;
  insert into _who values (p_tag, v_id, v_email);
end
$$;

create function pg_temp.as_member(p_tag text) returns void language plpgsql as $$
declare w record;
begin
  perform set_config('role', 'postgres', true);
  select * into w from _who where tag = p_tag;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', w.uid, 'email', w.email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.who(p_tag text) returns text language sql stable as $$
  select email from _who where tag = p_tag
$$;
-- New functions are not executable by everyone in this schema (see
-- SCHEMA_CONVENTIONS.md 4a), so the test helper is granted explicitly.
grant execute on function pg_temp.who(text) to public;
grant execute on function pg_temp.as_member(text) to public;
grant execute on function pg_temp.as_postgres() to public;

select pg_temp.mk('admin', 'admin');
select pg_temp.mk('member');
select pg_temp.mk('other');

-- Events from both members and the admin, written as the server would.
insert into public.user_events (event_name, user_email, page, session_id, properties, created_by)
values
  ('page_view',      pg_temp.who('member'), 'Dashboard', 's-member', '{}'::jsonb, pg_temp.who('member')),
  ('weight_logged',  pg_temp.who('member'), 'log',       's-member', '{}'::jsonb, pg_temp.who('member')),
  ('animal_created', pg_temp.who('other'),  'MyGeckos',  's-other',  '{}'::jsonb, pg_temp.who('other')),
  ('login_completed', pg_temp.who('admin'), 'Dashboard', 's-admin',  '{"is_admin": true}'::jsonb, pg_temp.who('admin'));

-- 1. The admin reads every event, in the columns the screens select.
select pg_temp.as_member('admin');
do $$
declare n integer;
begin
  select count(*) into n
  from (
    select id, event_name, user_email, session_id, page, properties, created_date
    from public.user_events
    where user_email in (pg_temp.who('admin'), pg_temp.who('member'), pg_temp.who('other'))
  ) e;
  if n <> 4 then
    raise exception 'FAIL: an admin should read all 4 fixture events, read %', n;
  end if;
  -- The member card lists a member's latest events without page views.
  select count(*) into n from public.user_events
  where user_email = pg_temp.who('member') and event_name <> 'page_view';
  if n <> 1 then
    raise exception 'FAIL: the member card query should find 1 non-page-view event, found %', n;
  end if;
end $$;

-- ... and a member reads none, not even their own.
select pg_temp.as_member('member');
do $$
declare n integer;
begin
  select count(*) into n from public.user_events;
  if n <> 0 then
    raise exception 'FAIL: a member read % user_events rows', n;
  end if;
end $$;

-- 2. read_profiles(null) gives the admin every member, with what the
-- screens use.
select pg_temp.as_member('admin');
do $$
declare r record;
begin
  select id, email, role, created_date into r
  from public.read_profiles(null) where email = pg_temp.who('member');
  if r.email is null then
    raise exception 'FAIL: read_profiles(null) did not give the admin the member row';
  end if;
  if r.role is distinct from 'user' or r.created_date is null then
    raise exception 'FAIL: read_profiles(null) hid role or created_date from the admin';
  end if;
  if not exists (select 1 from public.read_profiles(null) where email = pg_temp.who('other')) then
    raise exception 'FAIL: read_profiles(null) missed a member';
  end if;
end $$;

-- 3. The columns the screens select are readable by a signed-in admin.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('geckos', 'id, created_by, created_date'),
      ('gecko_images', 'id, created_by, created_date'),
      ('forum_posts', 'id, created_by, created_date'),
      ('forum_comments', 'id, created_by, created_date'),
      ('breeding_plans', 'id, created_by, created_date'),
      ('direct_messages', 'id, sender_email, created_date')
    ) as v(tbl, cols)
  loop
    begin
      execute format('select %s from public.%I limit 0', t.cols, t.tbl);
    exception when insufficient_privilege then
      raise exception 'FAIL: the admin analytics screens read (%) from %, and that is no longer allowed', t.cols, t.tbl;
    end;
  end loop;
end $$;

-- 4. Old app copies still write user_activity for a new gecko.
select pg_temp.as_member('member');
do $$
begin
  insert into public.user_activity (user_email, activity_type, points, created_by)
  values (pg_temp.who('member'), 'new_gecko', 5, pg_temp.who('member'));
exception when others then
  raise exception 'FAIL: a member can no longer write user_activity (old app copies still do): %', sqlerrm;
end $$;

select pg_temp.as_postgres();
rollback;
