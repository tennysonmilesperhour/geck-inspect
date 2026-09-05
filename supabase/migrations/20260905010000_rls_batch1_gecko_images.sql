-- RLS consolidation, batch 1: gecko_images (5 Sep 2026).
-- Plan: docs/planning/rls-policy-consolidation.md
--
-- The table carried two generations of policies at once: a legacy set on
-- the public role (read_all, insert_own, update_own, delete_own) and a
-- newer authenticated set written to be stricter (insert only while
-- unverified, owner may update only while unverified, admins and expert
-- reviewers may update anything). Permissive policies are ORed, so the
-- looser legacy rule always won: a member could insert a row with
-- verified = true, and could edit their photo after an expert verified it.
-- Nine policies collapse to four and the stricter intent finally holds.
--
-- is_admin() and is_expert_reviewer() are also marked STABLE. They only
-- read profiles, and without the marker Postgres had to call them once per
-- row inside every policy that uses them.
--
-- Idempotent; safe to re-apply.

alter function public.is_admin() stable;
alter function public.is_expert_reviewer() stable;

drop policy if exists "gecko_images public read" on public.gecko_images;
drop policy if exists "gecko_images_read_all" on public.gecko_images;
drop policy if exists "gecko_images authenticated insert" on public.gecko_images;
drop policy if exists "gecko_images_insert_own" on public.gecko_images;
drop policy if exists "gecko_images owner update" on public.gecko_images;
drop policy if exists "gecko_images reviewer update" on public.gecko_images;
drop policy if exists "gecko_images_update_own" on public.gecko_images;
drop policy if exists "gecko_images admin delete" on public.gecko_images;
drop policy if exists "gecko_images_delete_own" on public.gecko_images;

drop policy if exists gecko_images_select on public.gecko_images;
create policy gecko_images_select
  on public.gecko_images for select
  to anon, authenticated
  using (true);

drop policy if exists gecko_images_insert on public.gecko_images;
create policy gecko_images_insert
  on public.gecko_images for insert
  to authenticated
  with check (
    created_by = (select auth.email())
    and verified is not true
  );

drop policy if exists gecko_images_update on public.gecko_images;
create policy gecko_images_update
  on public.gecko_images for update
  to authenticated
  using (
    (created_by = (select auth.email()) and verified is not true)
    or public.is_expert_reviewer()
  )
  with check (
    (created_by = (select auth.email()) and verified is not true)
    or public.is_expert_reviewer()
  );

drop policy if exists gecko_images_delete on public.gecko_images;
create policy gecko_images_delete
  on public.gecko_images for delete
  to authenticated
  using (
    created_by = (select auth.email())
    or public.is_admin()
  );
