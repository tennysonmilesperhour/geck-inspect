-- Thumbnails follow their photo (thumbs/<path> in geck-inspect-media).
-- Regression checks for supabase/migrations/20261016090900_thumbnail_rules.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/thumbnail_rules_regressions.sql
--
-- It checks that a member may create or rename a file into the thumbnail
-- name of their own photo, but not of another member's photo or of a photo
-- with no owner; that an admin may do both for any photo; and that ordinary
-- uploads and renames outside thumbs/ are unaffected.
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
  v_email text := 'thumbrule-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
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
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Records a photo as the server would after an upload.
create function pg_temp.put(p_name text, p_owner uuid) returns void language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values ('geck-inspect-media', p_name, p_owner, p_owner::text, '{"size": 1000, "mimetype": "image/webp"}'::jsonb);
end $$;
-- Tries an insert as the current role; true when row security let it in.
create function pg_temp.try_insert(p_bucket text, p_name text) returns boolean language plpgsql as $$
begin
  insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
  values (p_bucket, p_name, auth.uid(), auth.uid()::text, '{"size": 10, "mimetype": "image/webp"}'::jsonb);
  return true;
exception when insufficient_privilege then
  return false;
end $$;
-- Tries a rename as the current role: 'ok', 'refused' (row security
-- refused the new name) or 'none' (the row is not the caller's to change).
create function pg_temp.try_rename(p_from text, p_to text) returns text language plpgsql as $$
declare n int;
begin
  update storage.objects set name = p_to
   where bucket_id = 'geck-inspect-media' and name = p_from;
  get diagnostics n = row_count;
  return case when n = 1 then 'ok' else 'none' end;
exception when insufficient_privilege then
  return 'refused';
end $$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('admin');
select pg_temp.mk('member');
select pg_temp.mk('other');
update public.profiles set role = 'admin'
 where email = (select email from _who where tag = 'admin');

select pg_temp.put('uploads/' || pg_temp.uid('member') || '/a.webp', pg_temp.uid('member'));
select pg_temp.put('uploads/' || pg_temp.uid('other') || '/b.webp', pg_temp.uid('other'));
select pg_temp.put('base44.app/legacy/c.jpg', null);

do $$
declare
  m text := pg_temp.uid('member')::text;
  o text := pg_temp.uid('other')::text;
begin
  -- 1. A member adds the thumbnail of their own photo.
  perform pg_temp.as_member('member');
  if not pg_temp.try_insert('geck-inspect-media', 'thumbs/uploads/' || m || '/a.webp') then
    raise exception 'FAIL: a member could not add the thumbnail of their own photo';
  end if;

  -- 2. Not for another member's photo, a photo with no owner, or a photo that does not exist.
  if pg_temp.try_insert('geck-inspect-media', 'thumbs/uploads/' || o || '/b.webp') then
    raise exception 'FAIL: a member planted a thumbnail for another member''s photo';
  end if;
  if pg_temp.try_insert('geck-inspect-media', 'thumbs/base44.app/legacy/c.jpg') then
    raise exception 'FAIL: a member added a thumbnail for a photo with no owner';
  end if;
  if pg_temp.try_insert('geck-inspect-media', 'thumbs/uploads/' || o || '/not-there.webp') then
    raise exception 'FAIL: a member added a thumbnail for a photo that does not exist';
  end if;

  -- 3. Ordinary uploads are unaffected.
  if not pg_temp.try_insert('geck-inspect-media', 'uploads/' || m || '/new.webp') then
    raise exception 'FAIL: an ordinary upload outside thumbs/ was refused';
  end if;

  -- 4. Renames follow the same rule.
  perform pg_temp.as_postgres();
  perform pg_temp.put('uploads/' || m || '/spare.webp', pg_temp.uid('member'));
  perform pg_temp.put('uploads/' || m || '/spare2.webp', pg_temp.uid('member'));
  perform pg_temp.put('uploads/' || m || '/c.webp', pg_temp.uid('member'));
  perform pg_temp.as_member('member');
  if pg_temp.try_rename('uploads/' || m || '/spare.webp', 'thumbs/uploads/' || o || '/b2.webp') <> 'refused' then
    raise exception 'FAIL: a member renamed a file onto another member''s thumbnail name';
  end if;
  if pg_temp.try_rename('uploads/' || m || '/spare.webp', 'thumbs/uploads/' || m || '/c.webp') <> 'ok' then
    raise exception 'FAIL: a member could not rename a file onto their own photo''s thumbnail name';
  end if;
  if pg_temp.try_rename('uploads/' || m || '/spare2.webp', 'uploads/' || m || '/renamed.webp') <> 'ok' then
    raise exception 'FAIL: an ordinary rename outside thumbs/ was refused';
  end if;

  -- 5. The admin may add any thumbnail (the backfill).
  perform pg_temp.as_member('admin');
  if not pg_temp.try_insert('geck-inspect-media', 'thumbs/uploads/' || o || '/b.webp') then
    raise exception 'FAIL: the admin could not add another member''s thumbnail';
  end if;
  if not pg_temp.try_insert('geck-inspect-media', 'thumbs/base44.app/legacy/c.jpg') then
    raise exception 'FAIL: the admin could not add a thumbnail for a photo with no owner';
  end if;

  perform pg_temp.as_postgres();
end $$;

-- 6. Both rules are restrictive and for signed-in members.
do $$
begin
  if (select count(*) from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname like 'geck-inspect-media thumbnails follow their photo (%)'
         and permissive = 'RESTRICTIVE' and roles = '{authenticated}'
         and cmd in ('INSERT', 'UPDATE')) <> 2 then
    raise exception 'FAIL: the two restrictive thumbnail rules (insert and update) are not both in place';
  end if;
end $$;

rollback;
