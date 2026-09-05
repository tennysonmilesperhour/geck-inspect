-- Audit F46 (part 1): stop re-evaluating auth functions per row.
--
-- Postgres evaluates auth.uid() / auth.email() / auth.jwt() / auth.role()
-- once per row when they appear bare in a policy, and once per query
-- when they are wrapped in a scalar subquery ((select auth.uid())), which
-- the planner turns into an InitPlan. Supabase's performance advisor
-- flagged 213 policies here. This rewrites every one of them in place
-- with the same expression, only wrapped, so behaviour is identical.
--
-- The rewrite is generated from pg_policies at apply time and is
-- idempotent: a policy that already reads "( SELECT auth.uid() ...)" is
-- skipped by the negative lookbehind.
do $$
declare
  r record;
  v_using text;
  v_check text;
  v_sql text;
  v_count integer := 0;
begin
  for r in
    select schemaname, tablename, policyname, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '')       ~ '(?<!SELECT )auth\.(uid|email|jwt|role)\(\)'
         or coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|email|jwt|role)\(\)')
  loop
    v_using := regexp_replace(r.qual,       '(?<!SELECT )auth\.(uid|email|jwt|role)\(\)', '(select auth.\1())', 'g');
    v_check := regexp_replace(r.with_check, '(?<!SELECT )auth\.(uid|email|jwt|role)\(\)', '(select auth.\1())', 'g');
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.cmd in ('SELECT', 'DELETE', 'UPDATE', 'ALL') and v_using is not null then
      v_sql := v_sql || format(' using (%s)', v_using);
    end if;
    if r.cmd in ('INSERT', 'UPDATE', 'ALL') and v_check is not null then
      v_sql := v_sql || format(' with check (%s)', v_check);
    end if;
    execute v_sql;
    v_count := v_count + 1;
  end loop;
  raise notice 'rls_initplan_rewrite: rewrote % policies', v_count;
end $$;
