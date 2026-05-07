-- =============================================================================
-- Phase B: widen geckos UPDATE/DELETE to honor accepted collaborators
-- =============================================================================
-- The 20260507_collections.sql migration set up collection ownership +
-- membership but left the geckos write policies unchanged. As a result,
-- a Keeper-tier user could invite a collaborator to a collection but
-- the collaborator still couldn't edit any of the shared geckos.
--
-- This migration widens UPDATE and DELETE so accepted members of a
-- collection (role = owner or editor) can mutate rows whose
-- collection_id points at that collection. Viewers and pending invites
-- get no write access — they can only SELECT (which is already
-- everything-readable per the geckos_read_all policy).
--
-- INSERT is left at the original `auth.email() = created_by` check.
-- Letting collaborators add geckos to someone else's collection is a
-- separate feature that deserves its own UX (whose collection are you
-- adding to? does the owner approve?). Out of scope here.
--
-- The original UPDATE policy didn't have a WITH CHECK clause, which
-- meant an owner could rewrite created_by to any value. Adding the
-- same expression as WITH CHECK closes that loophole on the way past.
-- =============================================================================

drop policy if exists geckos_update_own on public.geckos;
create policy geckos_update_own
  on public.geckos
  for update
  using (
    auth.email() = created_by
    or exists (
      select 1 from public.collection_members cm
       where cm.collection_id = geckos.collection_id
         and lower(cm.member_email) = lower(coalesce(auth.email(), ''))
         and cm.status = 'accepted'
         and cm.role in ('owner', 'editor')
    )
  )
  with check (
    auth.email() = created_by
    or exists (
      select 1 from public.collection_members cm
       where cm.collection_id = geckos.collection_id
         and lower(cm.member_email) = lower(coalesce(auth.email(), ''))
         and cm.status = 'accepted'
         and cm.role in ('owner', 'editor')
    )
  );

drop policy if exists geckos_delete_own on public.geckos;
create policy geckos_delete_own
  on public.geckos
  for delete
  using (
    auth.email() = created_by
    or exists (
      select 1 from public.collection_members cm
       where cm.collection_id = geckos.collection_id
         and lower(cm.member_email) = lower(coalesce(auth.email(), ''))
         and cm.status = 'accepted'
         and cm.role in ('owner', 'editor')
    )
  );
