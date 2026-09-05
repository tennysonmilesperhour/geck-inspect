-- RLS consolidation, batch 8: collections, members, messages, votes, offers, waitlists (5 Sep 2026).
-- Plan: docs/planning/rls-policy-consolidation.md
--
-- collections: owner FOR ALL plus two reader rules become one SELECT
--   (owner or member) and owner INSERT, UPDATE, DELETE.
-- collection_members: same shape, plus the two UPDATE rules (member edits
--   own row, owner edits any) merge into one.
-- direct_messages: "users can unsend own recent messages" is dropped. The
--   authenticated delete rule already lets a sender delete at any time,
--   so the five-minute window has been dead since it was added.
-- classification_votes: the two SELECT rules (reviewer or expert; author
--   or admin) and the two INSERT rules (reviewer_email; created_by) merge.
-- mentor_offers, gecko_waitlists: owner FOR ALL splits into I/U/D.
-- Idempotent.

-- collections
drop policy if exists "Owners write their collections" on public.collections;
drop policy if exists "Members read collections they belong to" on public.collections;
drop policy if exists "Owners read their collections" on public.collections;
drop policy if exists collections_select on public.collections;
create policy collections_select on public.collections for select to authenticated
  using (
    lower(owner_email) = lower(coalesce((select auth.email()), ''))
    or public.is_collection_member(id, (select auth.email()))
  );
drop policy if exists collections_insert_owner on public.collections;
create policy collections_insert_owner on public.collections for insert to authenticated
  with check (lower(owner_email) = lower(coalesce((select auth.email()), '')));
drop policy if exists collections_update_owner on public.collections;
create policy collections_update_owner on public.collections for update to authenticated
  using (lower(owner_email) = lower(coalesce((select auth.email()), '')))
  with check (lower(owner_email) = lower(coalesce((select auth.email()), '')));
drop policy if exists collections_delete_owner on public.collections;
create policy collections_delete_owner on public.collections for delete to authenticated
  using (lower(owner_email) = lower(coalesce((select auth.email()), '')));

-- collection_members
drop policy if exists "Owners write members of their collections" on public.collection_members;
drop policy if exists "Members read their own membership" on public.collection_members;
drop policy if exists "Owners read members of their collections" on public.collection_members;
drop policy if exists "Members update their own membership" on public.collection_members;
drop policy if exists collection_members_select on public.collection_members;
create policy collection_members_select on public.collection_members for select to authenticated
  using (
    lower(member_email) = lower(coalesce((select auth.email()), ''))
    or public.is_collection_owner(collection_id, (select auth.email()))
  );
drop policy if exists collection_members_update on public.collection_members;
create policy collection_members_update on public.collection_members for update to authenticated
  using (
    lower(member_email) = lower(coalesce((select auth.email()), ''))
    or public.is_collection_owner(collection_id, (select auth.email()))
  )
  with check (
    lower(member_email) = lower(coalesce((select auth.email()), ''))
    or public.is_collection_owner(collection_id, (select auth.email()))
  );
drop policy if exists collection_members_insert_owner on public.collection_members;
create policy collection_members_insert_owner on public.collection_members for insert to authenticated
  with check (public.is_collection_owner(collection_id, (select auth.email())));
drop policy if exists collection_members_delete_owner on public.collection_members;
create policy collection_members_delete_owner on public.collection_members for delete to authenticated
  using (public.is_collection_owner(collection_id, (select auth.email())));

-- direct_messages
drop policy if exists "users can unsend own recent messages" on public.direct_messages;

-- classification_votes
drop policy if exists "classification_votes reviewer read" on public.classification_votes;
drop policy if exists classification_votes_read_own on public.classification_votes;
drop policy if exists classification_votes_select on public.classification_votes;
create policy classification_votes_select on public.classification_votes for select to authenticated
  using (
    reviewer_email = (select auth.email())
    or created_by = (select auth.email())
    or public.is_expert_reviewer()
  );
drop policy if exists "classification_votes insert self" on public.classification_votes;
drop policy if exists classification_votes_write_own on public.classification_votes;
drop policy if exists classification_votes_insert on public.classification_votes;
create policy classification_votes_insert on public.classification_votes for insert to authenticated
  with check (
    reviewer_email = (select auth.email())
    or created_by = (select auth.email())
  );

-- mentor_offers (user_id) and gecko_waitlists (breeder_user_id)
drop policy if exists "Owners manage their mentor offers" on public.mentor_offers;
drop policy if exists mentor_offers_insert_owner on public.mentor_offers;
create policy mentor_offers_insert_owner on public.mentor_offers for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists mentor_offers_update_owner on public.mentor_offers;
create policy mentor_offers_update_owner on public.mentor_offers for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists mentor_offers_delete_owner on public.mentor_offers;
create policy mentor_offers_delete_owner on public.mentor_offers for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Owners manage their waitlists" on public.gecko_waitlists;
drop policy if exists gecko_waitlists_insert_owner on public.gecko_waitlists;
create policy gecko_waitlists_insert_owner on public.gecko_waitlists for insert to authenticated with check (breeder_user_id = (select auth.uid()));
drop policy if exists gecko_waitlists_update_owner on public.gecko_waitlists;
create policy gecko_waitlists_update_owner on public.gecko_waitlists for update to authenticated using (breeder_user_id = (select auth.uid())) with check (breeder_user_id = (select auth.uid()));
drop policy if exists gecko_waitlists_delete_owner on public.gecko_waitlists;
create policy gecko_waitlists_delete_owner on public.gecko_waitlists for delete to authenticated using (breeder_user_id = (select auth.uid()));
