-- RLS consolidation, batch 2: profiles UPDATE (5 Sep 2026).
-- Plan: docs/planning/rls-policy-consolidation.md
-- profiles_update_own and profiles_update_admin both allowed UPDATE, so
-- Postgres evaluated both on every row. One policy carries both rules.
-- The privileged-column and referral-column triggers keep doing the real
-- protection. Restricting to authenticated changes nothing: anon has no
-- email and never matched. Idempotent.

drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_update
  on public.profiles for update
  to authenticated
  using (
    email = (select auth.email())
    or created_by = (select auth.email())
    or public.is_admin()
  )
  with check (
    email = (select auth.email())
    or created_by = (select auth.email())
    or public.is_admin()
  );
