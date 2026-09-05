-- RLS consolidation, batch 3: health, ownership and transfer records (5 Sep 2026).
-- Plan: docs/planning/rls-policy-consolidation.md
-- Each table had a scoped *_read SELECT plus "Users manage own ..." FOR
-- ALL, which duplicated the SELECT. The FOR ALL becomes INSERT, UPDATE and
-- DELETE on the same owner rule; the read policy already covers the
-- author, so nobody gains or loses access. Also drops the four duplicate
-- animal_id indexes the advisor flagged. Idempotent.

do $$
declare
  t text;
  old_name text;
begin
  foreach t in array array['feeding_records', 'shed_records', 'vet_records', 'ownership_records', 'transfer_requests'] loop
    old_name := 'Users manage own ' || replace(t, '_', ' ');
    execute format('drop policy if exists %I on public.%I', old_name, t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (created_by = (select auth.email()))', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using (created_by = (select auth.email())) with check (created_by = (select auth.email()))', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using (created_by = (select auth.email()))', t || '_delete_own', t);
  end loop;
end $$;

drop index if exists public.idx_feeding_records_animal;
drop index if exists public.idx_ownership_records_animal;
drop index if exists public.idx_shed_records_animal;
drop index if exists public.idx_vet_records_animal;
