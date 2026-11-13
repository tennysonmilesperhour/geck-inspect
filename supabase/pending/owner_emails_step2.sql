-- Owner email addresses off rows other members can read, step 2 of 2.
-- Owner decision E16; plan and status in docs/planning/owner-emails-2026-11.md.
--
-- WAITING in supabase/pending: move it to supabase/migrations (with a
-- timestamp later than every migration there) no sooner than 3 days after
-- step 1's app change is live, and only after the API logs show no request
-- that still names created_by on these tables or reads them with select *
-- (a tab opened before step 1 does, and this file makes that request
-- fail). The doc above says how to check. Its test is
-- supabase/tests/owner_emails_step2_regressions.sql; when the file moves,
-- change the \ir path there.
--
-- What it does: signed-in members lose SELECT on created_by, the owner's
-- email, on the seven tables whose owner is an email:
--   geckos, breeding_plans, weight_records, feeding_records,
--   shed_records, vet_records, ownership_records.
-- The table grant becomes a column grant of every other column, the way
-- 20261031061000_member_email_columns_revoke.sql did for photos and forum
-- posts. Signed-out visitors lost the column in October already.
--
-- What still works: members insert their own rows with created_by set (an
-- insert needs no read right), and the tables' own row rules, which compare
-- created_by with auth.email(), still apply, because a rule on a table's own
-- columns is not checked against the member's column rights. Step 1
-- (20261113215000_owner_emails_step1.sql and
-- 20261113225505_owner_emails_functions.sql) moved every function and row
-- rule that read the column some other way. Admins are signed-in members
-- too and lose the column as well; the admin screens find owners by
-- owner_profile_id. The server (service_role) and functions that run as
-- their owner are unaffected.
--
-- After this, the app reads these tables with the lists in
-- src/lib/memberColumns.js (OWNED_COLUMNS_BY_TABLE). A column added to one
-- of these tables later is not readable by members until it is granted in a
-- later migration and added to that list (docs/RULES.md).
--
-- Safe to run more than once: the table grant is swapped only the first
-- time, and the column revoke is a no-op the second time.

do $$
declare
  r record;
  v_cols text;
begin
  for r in
    select * from (values
      ('geckos',            array['created_by']),
      ('breeding_plans',    array['created_by']),
      ('weight_records',    array['created_by']),
      ('feeding_records',   array['created_by']),
      ('shed_records',      array['created_by']),
      ('vet_records',       array['created_by']),
      ('ownership_records', array['created_by'])
    ) t(tbl, hidden)
  loop
    if to_regclass('public.' || r.tbl) is null then
      continue;
    end if;
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum) into v_cols
      from pg_attribute a
     where a.attrelid = ('public.' || r.tbl)::regclass
       and a.attnum > 0 and not a.attisdropped
       and a.attname <> all (r.hidden);
    -- Only the first time: once the table grant is gone, a second run
    -- must not hand back a column added and deliberately left out since.
    if has_table_privilege('authenticated', 'public.' || r.tbl, 'select') then
      execute format('revoke select on public.%I from authenticated', r.tbl);
      execute format('grant select (%s) on public.%I to authenticated', v_cols, r.tbl);
    end if;
    execute format('revoke select (%s) on public.%I from authenticated',
                   (select string_agg(quote_ident(h), ', ') from unnest(r.hidden) h), r.tbl);
  end loop;
end
$$;
