-- Photos that still need a thumbnail (admin backfill).
-- Regression checks for supabase/migrations/20261016090800_photo_thumbnails.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/photo_thumbnails_regressions.sql
--
-- It checks that admin_photos_without_thumbnail() refuses members and
-- signed-out visitors, and that for an admin it returns exactly the
-- photos with no thumbnail or with one somebody else made, in name
-- order, a page at a time, with the right total; and that a member may
-- add the thumbnail for their own photo under the bucket's storage rules
-- and an admin may replace someone else's.
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text) returns void language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'thumbs-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
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
-- Adds a file to the bucket as the server would record an upload.
create function pg_temp.put(p_name text, p_owner uuid, p_size bigint default 1000) returns void language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('geck-inspect-media', p_name, p_owner, p_owner::text,
          jsonb_build_object('size', p_size, 'mimetype', 'image/webp'));
end $$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('admin');
select pg_temp.mk('member');
select pg_temp.mk('other');
update public.profiles set role = 'admin'
 where email = (select email from _who where tag = 'admin');

do $$
begin
  if not exists (select 1 from public.profiles p join _who w on w.email = p.email
                  where w.tag = 'admin' and p.role = 'admin') then
    raise exception 'FAIL: setup could not make the admin';
  end if;
end $$;

-- The bucket. m = member, o = other member, legacy files have no owner.
select pg_temp.put('uploads/' || pg_temp.uid('member') || '/a-done.webp', pg_temp.uid('member'), 300000);
select pg_temp.put('thumbs/uploads/' || pg_temp.uid('member') || '/a-done.webp', pg_temp.uid('member'), 30000);
select pg_temp.put('uploads/' || pg_temp.uid('member') || '/b-missing.jpg', pg_temp.uid('member'), 2000000);
select pg_temp.put('uploads/' || pg_temp.uid('member') || '/c-planted.png', pg_temp.uid('member'));
select pg_temp.put('thumbs/uploads/' || pg_temp.uid('member') || '/c-planted.png', pg_temp.uid('other'));
select pg_temp.put('uploads/' || pg_temp.uid('member') || '/d-dance.gif', pg_temp.uid('member'));
select pg_temp.put('uploads/' || pg_temp.uid('member') || '/e-notes.pdf', pg_temp.uid('member'));
select pg_temp.put('base44.app/api/apps/x/files/public/x/f-legacy.JPEG', null, 5000000);
select pg_temp.put('base44.app/api/apps/x/files/public/x/g-legacy-done.jpeg', null);
select pg_temp.put('thumbs/base44.app/api/apps/x/files/public/x/g-legacy-done.jpeg', pg_temp.uid('admin'));
select pg_temp.put('base44.app/api/apps/x/files/public/x/h-legacy-planted.jpg', null);
select pg_temp.put('thumbs/base44.app/api/apps/x/files/public/x/h-legacy-planted.jpg', pg_temp.uid('other'));
select pg_temp.put('hero-anchors/i-server.jpg', null);
select pg_temp.put('thumbs/hero-anchors/i-server.jpg', null);
-- A deleted photo (an older version kept by versioning) needs nothing.
insert into storage.objects (bucket_id, name, owner, owner_id, metadata, archived_at, version)
values ('geck-inspect-media', 'uploads/' || pg_temp.uid('member') || '/j-archived.webp', pg_temp.uid('member'),
        pg_temp.uid('member')::text, '{"size": 1}'::jsonb, now(), 'v1');
-- Another bucket is not looked at.
insert into storage.objects (bucket_id, name, owner, metadata)
values ('promote-images', pg_temp.uid('member') || '/k-promo.webp', pg_temp.uid('member'), '{"size": 1}'::jsonb);

-- 1. Members and signed-out visitors are refused.
do $$
declare v_ok boolean;
begin
  perform pg_temp.as_member('member');
  begin
    perform * from public.admin_photos_without_thumbnail(null, 50);
    v_ok := false;
  exception when insufficient_privilege then
    v_ok := true;
  end;
  perform pg_temp.as_postgres();
  if not v_ok then
    raise exception 'FAIL: a member could list the photos that need thumbnails';
  end if;

  perform pg_temp.as_anon();
  begin
    perform * from public.admin_photos_without_thumbnail(null, 50);
    v_ok := false;
  exception when insufficient_privilege then
    v_ok := true;  -- no EXECUTE grant for anon
  end;
  perform pg_temp.as_postgres();
  if not v_ok then
    raise exception 'FAIL: a signed-out visitor could call admin_photos_without_thumbnail';
  end if;
end $$;

-- 2. The admin gets exactly the photos that need one, in name order.
do $$
declare
  v_member text := (select uid::text from _who where tag = 'member');
  v_got text;
  v_want text;
  v_total bigint;
  v_sizes text;
begin
  perform pg_temp.as_member('admin');
  select string_agg(name || ':' || reason, ' | ' order by name collate "C"), max(total_needing)
    into v_got, v_total
    from public.admin_photos_without_thumbnail(null, 50);
  select string_agg(name || '=' || size_bytes, ' | ' order by name collate "C")
    into v_sizes
    from public.admin_photos_without_thumbnail(null, 50)
   where name like '%missing%' or name like '%f-legacy%';
  perform pg_temp.as_postgres();

  v_want := 'base44.app/api/apps/x/files/public/x/f-legacy.JPEG:missing'
    || ' | base44.app/api/apps/x/files/public/x/h-legacy-planted.jpg:untrusted'
    || ' | uploads/' || v_member || '/b-missing.jpg:missing'
    || ' | uploads/' || v_member || '/c-planted.png:untrusted';
  if v_got is distinct from v_want then
    raise exception 'FAIL: wrong photos for the admin. Got [%], want [%]', v_got, v_want;
  end if;
  if v_total <> 4 then
    raise exception 'FAIL: total_needing should be 4, got %', v_total;
  end if;
  if v_sizes is distinct from
     'base44.app/api/apps/x/files/public/x/f-legacy.JPEG=5000000 | uploads/' || v_member || '/b-missing.jpg=2000000' then
    raise exception 'FAIL: wrong sizes: %', v_sizes;
  end if;
end $$;

-- 3. Paging: two at a time after a cursor, with the full total on every page.
do $$
declare
  v_first text;
  v_last text;
  v_second text;
  v_n int;
  v_total bigint;
begin
  perform pg_temp.as_member('admin');
  select string_agg(name, ',' order by name collate "C"), max(name collate "C"), count(*), max(total_needing)
    into v_first, v_last, v_n, v_total
    from public.admin_photos_without_thumbnail(null, 2);
  if v_n <> 2 or v_total <> 4 then
    raise exception 'FAIL: first page should have 2 of 4, got % of %', v_n, v_total;
  end if;
  select string_agg(name, ',' order by name collate "C"), count(*)
    into v_second, v_n
    from public.admin_photos_without_thumbnail(v_last, 2);
  if v_n <> 2 or v_second like '%' || v_last || '%' then
    raise exception 'FAIL: second page should be the next 2, got % (%)', v_n, v_second;
  end if;
  select count(*) into v_n
    from public.admin_photos_without_thumbnail((select max(name collate "C") from public.admin_photos_without_thumbnail(v_last, 2)), 2);
  if v_n <> 0 then
    raise exception 'FAIL: nothing should follow the last page, got %', v_n;
  end if;
  -- The page size is kept between 1 and 200.
  select count(*) into v_n from public.admin_photos_without_thumbnail(null, 0);
  if v_n <> 1 then
    raise exception 'FAIL: a page size of 0 should mean 1, got %', v_n;
  end if;
  perform pg_temp.as_postgres();
end $$;

-- 4. Storage rules: a member may add the thumbnail of their own photo; an
--    admin may replace a thumbnail someone else made; a member may not
--    replace another member's thumbnail.
do $$
declare
  v_member text := (select uid::text from _who where tag = 'member');
  v_n int;
  v_ok boolean;
begin
  perform pg_temp.as_member('member');
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('geck-inspect-media', 'thumbs/uploads/' || v_member || '/b-missing.jpg',
          auth.uid(), auth.uid()::text, '{"size": 25000, "mimetype": "image/webp"}'::jsonb);
  perform pg_temp.as_postgres();

  perform pg_temp.as_member('admin');
  update storage.objects
     set owner = auth.uid(), owner_id = auth.uid()::text, metadata = '{"size": 24000, "mimetype": "image/webp"}'::jsonb
   where bucket_id = 'geck-inspect-media' and name = 'thumbs/uploads/' || v_member || '/c-planted.png';
  get diagnostics v_n = row_count;
  perform pg_temp.as_postgres();
  if v_n <> 1 then
    raise exception 'FAIL: the admin could not replace a planted thumbnail (% rows)', v_n;
  end if;

  perform pg_temp.as_member('other');
  update storage.objects set metadata = '{"size": 1}'::jsonb
   where bucket_id = 'geck-inspect-media' and name = 'thumbs/uploads/' || v_member || '/a-done.webp';
  get diagnostics v_n = row_count;
  perform pg_temp.as_postgres();
  if v_n <> 0 then
    raise exception 'FAIL: a member changed another member''s thumbnail';
  end if;

  -- With those two done, two legacy photos are left.
  perform pg_temp.as_member('admin');
  select count(*) = 2 and bool_and(name like 'base44.app/%') into v_ok
    from public.admin_photos_without_thumbnail(null, 50);
  perform pg_temp.as_postgres();
  if not v_ok then
    raise exception 'FAIL: after the member''s upload and the admin''s replacement, only the two legacy photos should remain';
  end if;
end $$;

-- 5. Grants: authenticated and service_role may execute, anon and public may not.
do $$
begin
  if has_function_privilege('anon', 'public.admin_photos_without_thumbnail(text, integer)', 'execute') then
    raise exception 'FAIL: anon can execute admin_photos_without_thumbnail';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_photos_without_thumbnail(text, integer)', 'execute') then
    raise exception 'FAIL: authenticated cannot execute admin_photos_without_thumbnail';
  end if;
  if not (select prosecdef from pg_proc where oid = 'public.admin_photos_without_thumbnail(text, integer)'::regprocedure) then
    raise exception 'FAIL: admin_photos_without_thumbnail should be SECURITY DEFINER';
  end if;
end $$;

rollback;
