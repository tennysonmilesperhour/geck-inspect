-- Add an admin UPDATE policy to public.profiles.
--
-- NOT YET APPLIED TO PRODUCTION. Committed for review as part of the
-- 2026-07 RLS admin audit (see docs/security/rls-admin-audit-2026-07.md).
-- Apply with `supabase db push` or the dashboard after review.
--
-- Gap found: the admin User Management screen
-- (src/components/admin/UserManagement.jsx) grants/revokes the `admin`
-- role and `is_expert` flag on OTHER users via a client-side
-- `profiles` UPDATE (User.update(otherUserId, { role, is_expert })).
-- But the only UPDATE policy on profiles is `profiles_update_own`:
--
--   using (auth.email() = email OR auth.email() = created_by)
--
-- An admin editing a different user's row matches neither clause
-- (created_by is the target user's own email, not the admin's), so RLS
-- silently filters the UPDATE to zero rows. The "Make Admin", "Make
-- Expert", and "Remove Expert" buttons therefore do nothing in
-- production.
--
-- Fix: add a permissive admin UPDATE policy using the same email-based
-- admin check used everywhere else in this schema (and already present
-- as profiles_delete_admin, which proves the self-referential EXISTS on
-- profiles resolves without recursion because profiles_read_all makes
-- the subquery permissive).

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.email = auth.email() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.email = auth.email() and p.role = 'admin'
    )
  );
