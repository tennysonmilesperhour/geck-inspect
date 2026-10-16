-- Nobody can list the member photo bucket any more (Tennyson, 16 Oct 2026).
--
-- geck-inspect-media is a public bucket: every photo is served to anyone
-- who has its address, and that does not change here. What changes is the
-- file list. Two read rules let anyone (signed in or not) list every file
-- name in the bucket, which named the photos of private geckos too. Reading
-- the list now needs a signed-in member and shows only that member's own
-- files; an admin sees all of them (the thumbnail backfill replaces files,
-- which needs to see them).
--
-- Safe for open copies of the app: the app never lists this bucket. It
-- shows photos by their public address and uploads without replacing, and
-- the thumbnail rules (20261016090900) only look up the member's own photo.
drop policy if exists "geck-inspect-media public read" on storage.objects;
drop policy if exists "geck_inspect_media_public_read" on storage.objects;
drop policy if exists "geck-inspect-media owner or admin read" on storage.objects;

create policy "geck-inspect-media owner or admin read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'geck-inspect-media'
    and (owner = auth.uid() or public.is_admin())
  );
