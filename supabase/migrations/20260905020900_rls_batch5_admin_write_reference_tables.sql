-- RLS consolidation, batch 5: reference tables with an admin FOR ALL (5 Sep 2026).
-- Plan: docs/planning/rls-policy-consolidation.md
-- Eleven tables had a public (or scoped) SELECT plus "*_write_admin" FOR
-- ALL, which duplicated the SELECT for everyone. The admin rule becomes
-- INSERT, UPDATE and DELETE on is_admin(). admin_tasks keeps only its FOR
-- ALL rule (both rules were admin-only). app_settings gets one SELECT:
-- public rows for everyone, every row for admins. Idempotent.

do $$
declare
  rec record;
begin
  for rec in
    select * from (values
      ('care_guide_sections', 'care_guide_write_admin'),
      ('change_logs', 'change_logs_write_admin'),
      ('expert_actions', 'expert_actions_write_admin'),
      ('forum_categories', 'forum_categories_write_admin'),
      ('gecko_of_the_day', 'gecko_of_day_write_admin'),
      ('morph_guides', 'morph_guides_write_admin'),
      ('morph_price_cache', 'morph_price_cache_write_admin'),
      ('morph_traits', 'morph_traits_write_admin'),
      ('page_config', 'page_config_write_admin'),
      ('payment_events', 'payment_events_write_admin'),
      ('user_badges', 'user_badges_write_admin')
    ) as v(tbl, old_name)
  loop
    execute format('drop policy if exists %I on public.%I', rec.old_name, rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_insert_admin', rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_update_admin', rec.tbl);
    execute format('drop policy if exists %I on public.%I', rec.tbl || '_delete_admin', rec.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_admin())', rec.tbl || '_insert_admin', rec.tbl);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', rec.tbl || '_update_admin', rec.tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_admin())', rec.tbl || '_delete_admin', rec.tbl);
  end loop;
end $$;

drop policy if exists "Admins read tasks" on public.admin_tasks;

drop policy if exists "Admins read all settings" on public.app_settings;
drop policy if exists "Public settings readable by anyone" on public.app_settings;
drop policy if exists "Admins write settings" on public.app_settings;
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select
  on public.app_settings for select
  to anon, authenticated
  using (is_public = true or public.is_admin());
drop policy if exists app_settings_insert_admin on public.app_settings;
create policy app_settings_insert_admin on public.app_settings for insert to authenticated with check (public.is_admin());
drop policy if exists app_settings_update_admin on public.app_settings;
create policy app_settings_update_admin on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists app_settings_delete_admin on public.app_settings;
create policy app_settings_delete_admin on public.app_settings for delete to authenticated using (public.is_admin());
