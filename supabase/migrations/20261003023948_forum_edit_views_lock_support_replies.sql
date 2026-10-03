-- Plan steps 20 (Forum), 21 (notifications) and 16 (Support), 3 Oct 2026.
-- Applied to production in six parts because the migration tool stalls on
-- long scripts; read them in version order.
--
-- Part 1 of 6: forum_is_admin(), the admin check the forum guards and the
-- support reply rules use. (The name covers the whole set; only this
-- function went in under it.)

create or replace function public.forum_is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.profiles p
    where p.email = auth.email() and p.role = 'admin'
  );
$$;

revoke all on function public.forum_is_admin() from public, anon;
grant execute on function public.forum_is_admin() to authenticated, service_role;
