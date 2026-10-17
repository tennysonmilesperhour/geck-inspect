-- Objects production has outside the public/geck_data dump.
-- Trigger on auth.users (prod: CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user()).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Production drift alignment (read 2026-10-15). The repo chain leaves these
-- execute grants different from production; production wins here so tests see
-- what the live API roles see.
-- 1. The baseline dump carries no grants for the two vector-argument functions,
--    so a replay leaves them executable by PUBLIC (anon included).
revoke all on function public.nearest_training_samples(extensions.vector, integer, boolean) from public, anon;
grant execute on function public.nearest_training_samples(extensions.vector, integer, boolean) to postgres, authenticated, service_role;
revoke all on function public.morph_visual_neighbors(extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.morph_visual_neighbors(extensions.vector, integer) to postgres, service_role;
-- 2. Production grants these two helpers to anon and authenticated (granted outside the repo).
grant execute on function geck_data._looks_like_group_lot(text, boolean) to anon, authenticated;
grant execute on function geck_data.is_training_trait(text) to anon, authenticated;

-- Storage buckets and storage.objects policies as they are in production
-- (the schema dump covers public and geck_data only). Bucket rows hold no files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('archive-listing-images', 'archive-listing-images', false, null, null),
  ('geck-inspect-media', 'geck-inspect-media', true, 52428800, '{image/jpeg,image/png,image/webp,image/gif,image/avif}'),
  ('listing-images', 'listing-images', true, null, null),
  ('promote-images', 'promote-images', true, null, null),
  ('raw-uploads', 'raw-uploads', false, null, null)
on conflict (id) do nothing;

create policy "Sticker uploads readable by anyone" on storage.objects for select to public
  using ((bucket_id = 'geck-inspect-media'::text) AND ((storage.foldername(name))[1] = 'sticker-uploads'::text));
create policy "Users delete their own promote images" on storage.objects for delete to public
  using ((bucket_id = 'promote-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
create policy "Users read their own promote images" on storage.objects for select to public
  using ((bucket_id = 'promote-images'::text) AND (((auth.uid())::text = (storage.foldername(name))[1]) OR true));
create policy "Users update their own promote images" on storage.objects for update to public
  using ((bucket_id = 'promote-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
create policy "Users upload to their own promote folder" on storage.objects for insert to public
  with check ((bucket_id = 'promote-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1]));
create policy "geck-inspect-media admin delete" on storage.objects for delete to authenticated
  using ((bucket_id = 'geck-inspect-media'::text) AND (EXISTS (SELECT 1 FROM public.profiles WHERE ((profiles.email = (auth.jwt() ->> 'email'::text)) AND (profiles.role = 'admin'::text)))));
create policy "geck-inspect-media admin update" on storage.objects for update to authenticated
  using ((bucket_id = 'geck-inspect-media'::text) AND (EXISTS (SELECT 1 FROM public.profiles WHERE ((profiles.email = (auth.jwt() ->> 'email'::text)) AND (profiles.role = 'admin'::text)))));
create policy "geck-inspect-media authenticated insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'geck-inspect-media'::text);
create policy "geck-inspect-media owner delete" on storage.objects for delete to authenticated
  using ((bucket_id = 'geck-inspect-media'::text) AND (owner = auth.uid()));
create policy "geck-inspect-media owner update" on storage.objects for update to authenticated
  using ((bucket_id = 'geck-inspect-media'::text) AND (owner = auth.uid()))
  with check ((bucket_id = 'geck-inspect-media'::text) AND (owner = auth.uid()));
-- No public read policy on geck-inspect-media: migration
-- 20261016220000_media_listing_closed.sql replaced both with its owner or
-- admin read (files still load by URL; only listing is closed).
create policy "geck_inspect_media_authed_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'geck-inspect-media'::text);
create policy "geck_inspect_media_owner_delete" on storage.objects for delete to authenticated
  using ((bucket_id = 'geck-inspect-media'::text) AND (owner = auth.uid()));
create policy "geck_inspect_media_owner_update" on storage.objects for update to authenticated
  using ((bucket_id = 'geck-inspect-media'::text) AND (owner = auth.uid()))
  with check ((bucket_id = 'geck-inspect-media'::text) AND (owner = auth.uid()));
create policy "public read listing-images" on storage.objects for select to public
  using (bucket_id = 'listing-images'::text);
