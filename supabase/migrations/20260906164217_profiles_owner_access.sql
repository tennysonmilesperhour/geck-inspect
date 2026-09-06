-- Private account data is available only to its owner and administrators.
drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_owner_admin on public.profiles for select using (
  email = (select auth.email()) or (select public.is_admin())
);
-- Avoid a recursive profiles lookup in the legacy deletion policy.
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles for delete using ((select public.is_admin()));

