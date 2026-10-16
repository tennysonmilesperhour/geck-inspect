-- Photos that still need a thumbnail, for the admin backfill button.
--
-- Why: from 16 October 2026 every member photo gets a small thumbnail at
-- thumbs/<the photo's own path> in the geck-inspect-media bucket, made in
-- the member's browser when the photo uploads (src/lib/uploadFile.js,
-- src/lib/photoThumbnails.js). The roughly 800 photos uploaded before that
-- get theirs from the admin panel (Photo thumbnails), which resizes each
-- one in the admin's own browser and uploads the result with the admin's
-- own session. Nothing here, and nothing in that tool, holds the service
-- role key.
--
-- This function tells the tool which photos to do. It returns a page of
-- photo names, in name order after p_after, that either have no thumbnail
-- or have one that someone other than the photo's owner (or an admin)
-- uploaded. The storage rules let any signed-in member add files anywhere
-- in the bucket, and a thumbnail's address can be worked out from the
-- photo's, so only a thumbnail made by the photo's owner, an admin, or
-- the server is trusted; the tool replaces the others. (Storage's own
-- file listing cannot tell these apart: it does not return who uploaded
-- a file.)
--
-- Photos: image files (jpg, jpeg, png, webp, avif) in the bucket, outside
-- thumbs/. GIFs never get a thumbnail (the app shows the GIF itself).
-- total_needing is the count over the whole bucket, not just this page,
-- so the tool can show progress.
--
-- Safe in either deploy order: it only adds a function. An admin panel
-- that loads before the function exists says it is not installed yet.
--
-- SECURITY DEFINER because it reads storage.objects and auth.users, which
-- members cannot query directly; it refuses anyone who is not an admin
-- (public.is_admin()), and EXECUTE is revoked from public and anon.

create or replace function public.admin_photos_without_thumbnail(
  p_after text default null,
  p_limit integer default 50
)
returns table (
  name text,
  size_bytes bigint,
  reason text,
  total_needing bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'admin_photos_without_thumbnail: admins only'
      using errcode = '42501';
  end if;

  return query
  with admins as (
    select u.id::text as uid
      from auth.users u
      join public.profiles p on lower(p.email) = lower(u.email)
     where p.role = 'admin'
  ),
  live as (
    select o.name, o.metadata, coalesce(o.owner_id, o.owner::text) as uploader
      from storage.objects o
     where o.bucket_id = 'geck-inspect-media'
       and o.archived_at is null
       and not coalesce(o.is_delete_marker, false)
  ),
  photos as (
    select l.name, l.uploader, nullif(l.metadata ->> 'size', '')::bigint as size_bytes
      from live l
     where l.name not like 'thumbs/%'
       and l.name ~* '\.(jpe?g|png|webp|avif)$'
  ),
  needing as (
    select ph.name,
           ph.size_bytes,
           case when t.name is null then 'missing' else 'untrusted' end as reason
      from photos ph
      left join live t on t.name = 'thumbs/' || ph.name
     where t.name is null
        -- coalesce: a photo with no recorded owner (the files carried
        -- over from the old platform) makes "same uploader" unknown,
        -- which must count as not trusted.
        or not coalesce(
             t.uploader is null
          or t.uploader = ph.uploader
          or exists (select 1 from admins a where a.uid = t.uploader),
           false)
  ),
  counted as (
    select n.name, n.size_bytes, n.reason, count(*) over () as total_needing
      from needing n
  )
  select c.name, c.size_bytes, c.reason, c.total_needing
    from counted c
   where p_after is null or c.name collate "C" > p_after collate "C"
   order by c.name collate "C"
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$function$;

comment on function public.admin_photos_without_thumbnail(text, integer) is
  'Admin only. A page (name order, after p_after, at most 200) of geck-inspect-media photos with no thumbnail at thumbs/<name>, or one uploaded by someone other than the photo''s owner or an admin. Used by the admin panel''s Photo thumbnails tool (20261016090800_photo_thumbnails.sql).';

revoke all on function public.admin_photos_without_thumbnail(text, integer) from public, anon;
grant execute on function public.admin_photos_without_thumbnail(text, integer) to authenticated, service_role;
