-- The member photo bucket cannot be listed by visitors or other members.
-- Regression checks for supabase/migrations/20261016220000_media_listing_closed.sql.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/media_listing_regressions.sql
--
-- A visitor sees no file names; a member sees only their own; an admin sees
-- every file; and a member can still add the thumbnail of their own photo
-- (the thumbnail rule looks the photo up under the member's own view).
begin;

create temp table _who (tag text primary key, uid uuid not null, email text not null) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text) returns void language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'medialist-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  insert into _who values (p_tag, v_id, v_email);
end $$;
create function pg_temp.uid(p_tag text) returns uuid language sql stable as $$
  select uid from _who where tag = p_tag
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
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.put(p_name text, p_owner uuid) returns void language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('geck-inspect-media', p_name, p_owner, p_owner::text, '{"size": 1000, "mimetype": "image/webp"}'::jsonb);
end $$;
-- How many of this test's files the current role can see.
create function pg_temp.seen() returns int language sql as $$
  select count(*)::int from storage.objects
   where bucket_id = 'geck-inspect-media' and name like 'medialist-test/%'
$$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('admin');
select pg_temp.mk('member');
select pg_temp.mk('other');
update public.profiles set role = 'admin' where email = (select email from _who where tag = 'admin');

select pg_temp.put('medialist-test/' || pg_temp.uid('member') || '/a.webp', pg_temp.uid('member'));
select pg_temp.put('medialist-test/' || pg_temp.uid('other') || '/b.webp', pg_temp.uid('other'));
select pg_temp.put('medialist-test/legacy/c.jpg', null);

do $$
declare n int;
begin
  perform pg_temp.as_anon();
  n := pg_temp.seen();
  if n <> 0 then raise exception 'FAIL: a visitor can list % member photo file names', n; end if;

  perform pg_temp.as_member('member');
  n := pg_temp.seen();
  if n <> 1 then raise exception 'FAIL: a member sees % files, expected only their own 1', n; end if;

  perform pg_temp.as_member('admin');
  n := pg_temp.seen();
  if n <> 3 then raise exception 'FAIL: the admin sees % files, expected all 3', n; end if;

  perform pg_temp.as_member('member');
  begin
    insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
    values ('geck-inspect-media', 'thumbs/medialist-test/' || pg_temp.uid('member') || '/a.webp',
            auth.uid(), auth.uid()::text, '{"size": 10, "mimetype": "image/webp"}'::jsonb);
  exception when insufficient_privilege then
    raise exception 'FAIL: a member could no longer add the thumbnail of their own photo';
  end;
  perform pg_temp.as_postgres();
  raise notice 'media listing: all checks passed';
end $$;

rollback;
