-- Members could not delete their own notifications: the only delete rule
-- was admin-only, so the Notifications page always said "Could not delete".
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using ((select auth.email()) = user_email);

-- Content Moderation's "Unpublish" updates another member's gecko, but the
-- only update rule was owner or collection editor, so the listing stayed
-- public. Admins can already read every gecko (geckos_read_visible).
drop policy if exists geckos_update_admin on public.geckos;
create policy geckos_update_admin on public.geckos
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
