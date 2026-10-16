-- Only a photo's owner, an admin or the server may add its thumbnail.
--
-- Since 16 Oct 2026 every member photo in geck-inspect-media has a small
-- copy at thumbs/<the photo's path> (src/lib/photoThumbnails.js), and
-- gecko cards load that copy first. The bucket's insert rules let any
-- signed-in member add a file at any name, and a thumbnail's name is
-- predictable, so without this rule one member could add a thumbnail for
-- another member's photo that has none yet, and that picture would show
-- on the other member's cards.
--
-- This adds one RESTRICTIVE insert policy, which applies on top of the
-- existing permissive ones (a file must pass both). It applies to signed-in
-- members, the only role the bucket lets add files. Names outside
-- thumbs/ and other buckets are unaffected. The server (service_role)
-- bypasses row security as before, so the admin-delete and erasure
-- functions are unchanged. The admin backfill (Admin panel, System,
-- Photo thumbnails) passes through public.is_admin().
--
-- Safe in either order with the site: the app already uploads only the
-- thumbnail of a photo it has just uploaded as that member. Safe to run
-- twice.

drop policy if exists "geck-inspect-media thumbnails by photo owner or admin" on storage.objects;

create policy "geck-inspect-media thumbnails by photo owner or admin"
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
