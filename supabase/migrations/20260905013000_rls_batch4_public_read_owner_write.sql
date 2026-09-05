-- RLS consolidation, batch 4: public-read tables with an owner FOR ALL (5 Sep 2026).
-- Plan: docs/planning/rls-policy-consolidation.md
-- Twelve tables had SELECT true plus a "Users manage own ..." FOR ALL rule
-- (created_by = jwt email) that duplicated the SELECT. The FOR ALL splits
-- into INSERT, UPDATE and DELETE on the same owner rule. Reads are
-- unchanged: still public. Idempotent.

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('answers', 'Users manage own answers'),
      ('breeder_profiles', 'Users manage own breeder profile'),
      ('breeder_reviews', 'Users manage own reviews'),
      ('breeding_loans', 'Users manage own loans'),
      ('breeding_projects', 'Users manage own breeding projects'),
      ('clutches', 'Users manage own clutches'),
      ('collection_valuations', 'Users manage own valuations'),
      ('genetic_outcome_predictions', 'Users manage own outcomes'),
      ('morph_price_entries', 'Users manage own price entries'),
      ('price_alerts', 'Users manage own alerts'),
      ('question_votes', 'Users manage own votes'),
      ('questions', 'Users manage own questions')
    ) as v(tbl, old_name)
  loop
    execute format('drop policy if exists %I on public.%I', rec.old_name, rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_insert_own', rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_update_own', rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_delete_own', rec.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (created_by = (select auth.email()))', rec.tbl || '_insert_own', rec.tbl);
    execute format('create policy %I on public.%I for update to authenticated using (created_by = (select auth.email())) with check (created_by = (select auth.email()))', rec.tbl || '_update_own', rec.tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (created_by = (select auth.email()))', rec.tbl || '_delete_own', rec.tbl);
  end loop;
end $$;
