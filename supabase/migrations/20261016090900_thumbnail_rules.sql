-- Thumbnails follow their photo.
--
-- Since 16 Oct 2026 every member photo in geck-inspect-media has a small
-- copy at thumbs/<the photo's path> (src/lib/photoThumbnails.js), and gecko
-- cards load that copy first. These two rules make sure that copy can only
-- come from the photo's owner or an admin: a file may be created at, or
-- renamed to, a name under thumbs/ only when the signed-in member owns the
-- photo at the same name without thumbs/, or is an admin.
--
-- Both are RESTRICTIVE policies: they apply on top of the bucket's
-- existing permissive rules (a write must pass both), and only to signed-in
-- members. Names outside thumbs/ and other buckets are unaffected. The
-- server (service_role) bypasses row security as before, so the erasure
-- functions are unchanged. The admin backfill (Admin panel, System, Photo
-- thumbnails) passes through public.is_admin().
--
-- Safe in either order with the site: copies of the app from before this
-- release never write under thumbs/, and the new app only writes the
-- thumbnail of a photo it has just uploaded as that member. Safe to run
-- twice.

drop policy if exists "geck-inspect-media thumbnails by photo owner or admin" on storage.objects;
drop policy if exists "geck-inspect-media thumbnails follow their photo (insert)" on storage.objects;
drop policy if exists "geck-inspect-media thumbnails follow their photo (update)" on storage.objects;

create policy "geck-inspect-media thumbnails follow their photo (insert)"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (
    bucket_id <> 'geck-inspect-media'
    or name not like 'thumbs/%'
    or public.is_admin()
    or exists (
      select 1
        from storage.objects photo
       where photo.bucket_id = 'geck-inspect-media'
         and photo.name = substr(objects.name, length('thumbs/') + 1)
         and photo.owner = auth.uid()
    )
  );

create policy "geck-inspect-media thumbnails follow their photo (update)"
  on storage.objects
  as restrictive
  for update
  to authenticated
  using (true)
  with check (
    bucket_id <> 'geck-inspect-media'
    or name not like 'thumbs/%'
    or public.is_admin()
    or exists (
      select 1
        from storage.objects photo
       where photo.bucket_id = 'geck-inspect-media'
         and photo.name = substr(objects.name, length('thumbs/') + 1)
         and photo.owner = auth.uid()
    )
  );
