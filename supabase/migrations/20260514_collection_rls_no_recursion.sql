-- =============================================================================
-- Break the collection-membership RLS recursion
-- =============================================================================
-- The policies introduced by 20260507_collections.sql +
-- 20260507_geckos_collaborator_writes.sql close a three-table cycle:
--
--   geckos.geckos_update_own  USING (... OR EXISTS … collection_members …)
--     →  collection_members."Owners read members of their collections"
--           USING (EXISTS … collections …)
--        →  collections."Members read collections they belong to"
--              USING (EXISTS … collection_members …)
--           →  back to collection_members SELECT policies … (loop)
--
-- Postgres aborts with `infinite recursion detected in policy for relation
-- "collection_members"`, which kills every UPDATE/DELETE on geckos — even
-- for the plain owner path (`auth.email() = created_by`), because Postgres
-- still evaluates the OR branch.
--
-- Fix: route every recursive membership check through a SECURITY DEFINER
-- helper. The function runs with the migration owner's role, so RLS does
-- not re-enter when it scans collections / collection_members. The
-- policies that used to inline an EXISTS subquery now just call the
-- helper.
--
-- Helpers are STABLE (Postgres can cache per-row), SECURITY DEFINER (RLS
-- bypass for the internal lookup), and `set search_path = public` (so the
-- definer-owned function can't be hijacked by a session-local search_path
-- override — standard hardening for SECURITY DEFINER functions).
-- =============================================================================

create or replace function public.is_collection_owner(
  p_collection_id uuid,
  p_email text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.collections
     where id = p_collection_id
       and lower(owner_email) = lower(coalesce(p_email, ''))
  );
$$;

create or replace function public.is_collection_member(
  p_collection_id uuid,
  p_email text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.collection_members
     where collection_id = p_collection_id
       and lower(member_email) = lower(coalesce(p_email, ''))
       and status in ('pending', 'accepted')
  );
$$;

create or replace function public.is_collection_editor(
  p_collection_id uuid,
  p_email text
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.collection_members
     where collection_id = p_collection_id
       and lower(member_email) = lower(coalesce(p_email, ''))
       and status = 'accepted'
       and role in ('owner', 'editor')
  );
$$;

grant execute on function public.is_collection_owner(uuid, text)  to authenticated, anon;
grant execute on function public.is_collection_member(uuid, text) to authenticated, anon;
grant execute on function public.is_collection_editor(uuid, text) to authenticated, anon;

-- Rewrite the three policies that close the cycle. Same semantics as
-- before, just sourced through the helper functions.

drop policy if exists "Members read collections they belong to" on public.collections;
create policy "Members read collections they belong to"
  on public.collections
  for select
  using (public.is_collection_member(id, auth.email()));

drop policy if exists "Owners read members of their collections" on public.collection_members;
create policy "Owners read members of their collections"
  on public.collection_members
  for select
  using (public.is_collection_owner(collection_id, auth.email()));

drop policy if exists "Owners write members of their collections" on public.collection_members;
create policy "Owners write members of their collections"
  on public.collection_members
  for all
  using (public.is_collection_owner(collection_id, auth.email()))
  with check (public.is_collection_owner(collection_id, auth.email()));

drop policy if exists geckos_update_own on public.geckos;
create policy geckos_update_own
  on public.geckos
  for update
  using (
    auth.email() = created_by
    or public.is_collection_editor(collection_id, auth.email())
  )
  with check (
    auth.email() = created_by
    or public.is_collection_editor(collection_id, auth.email())
  );

drop policy if exists geckos_delete_own on public.geckos;
create policy geckos_delete_own
  on public.geckos
  for delete
  using (
    auth.email() = created_by
    or public.is_collection_editor(collection_id, auth.email())
  );
