-- Other Reptiles feeding reminders: one switch, off (Tennyson's decision 1
-- of 16 Oct 2026). NOT APPLIED YET.
--
-- Other Reptiles was retired on 16 Oct 2026 (src/lib/retiredPages.js,
-- docs/planning/retired-features-2026-10.md): its page redirects, but its
-- code and its table stay for a later release. The daily feeding job
-- (enqueue_feeding_reminders, cron job feeding-reminders-daily) still
-- reminded members about animals in that table, linking to a page that no
-- longer opens. This file stops those reminders in a way that is one
-- switch to undo.
--
-- What it does, in plain words:
--
-- 1. Adds the app_settings row 'other_reptile_reminders_enabled', set to
--    false. It is only added when missing, so a value someone has already
--    set is never overwritten. It is public (is_public), like
--    care_reminder_defaults_from, so the app can read the same switch for
--    the in-app reminders it shows.
--
-- 2. enqueue_feeding_reminders leaves other_reptiles out unless that row
--    is true. Everything about crested gecko and feeding group reminders is
--    unchanged: this is the definition from
--    20261015151100_reminders_and_offline_logging.sql with one added
--    condition on the reptile branch. Owner, security definer, search_path
--    and grants are kept as they were.
--
-- To send reptile reminders again:
--   update public.app_settings set value = 'true'::jsonb
--    where key = 'other_reptile_reminders_enabled';
--
-- No other job or function sends reminders for other_reptiles (checked on
-- 16 Oct 2026: of the database functions that read the table, only this
-- one makes notifications; the others check ownership, transfers and
-- account erasure).
--
-- Safe to run more than once: on conflict do nothing, create or replace.
-- Safe in either order with the app release: nothing in the app reads the
-- row yet, and a missing row means off.

-- 1. The switch ----------------------------------------------------------

insert into public.app_settings (key, value, is_public, description)
values (
  'other_reptile_reminders_enabled',
  'false'::jsonb,
  true,
  'Sends daily feeding reminders for animals in Other Reptiles (retired 16 Oct 2026, its code and table kept). Off: enqueue_feeding_reminders leaves them out. Set to true to send them again. Crested gecko and feeding group reminders do not depend on it.'
)
on conflict (key) do nothing;

-- 2. The daily feeding job, reptiles only when the switch is on -------------

create or replace function public.enqueue_feeding_reminders()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_body text;
  v_verb text;
begin
  for r in
    with due as (
      select fg.created_by as user_email,
             coalesce(nullif(trim(fg.name), ''), nullif(trim(fg.label), ''), 'A feeding group') as name,
             'group'::text as kind,
             fg.id::text as ref_id,
             current_date - (fg.last_fed_date + greatest(coalesce(fg.interval_days, 3), 1)::int) as days_overdue
        from public.feeding_groups fg
       where fg.created_by is not null
         and coalesce(fg.feeding_reminder_enabled, true)
         and fg.last_fed_date is not null
      union all
      -- A crested gecko in no feeding group, added since the defaults
      -- started (or switched on by the member): every 3 days from its
      -- last feeding it ate, or from the day it was added.
      select g.created_by,
             coalesce(nullif(trim(g.name), ''), 'A gecko'),
             'gecko',
             g.id,
             current_date - (coalesce(lf.last_fed, g.created_date::date) + st.every_days)
        from public.geckos g
        left join public.profiles gp on gp.email = g.created_by
        cross join lateral (
          select case when jsonb_typeof(gp.extra_data->'care_reminders'->'feeding'->'geckos'->g.id) = 'object'
                      then gp.extra_data->'care_reminders'->'feeding'->'geckos'->g.id end as entry
        ) e
        cross join lateral (
          select case when e.entry->>'every_days' ~ '^\d{1,2}$'
                      then greatest(1, least(30, (e.entry->>'every_days')::int))
                      else 3 end as every_days
        ) st
        left join lateral (
          select max(f.date) as last_fed
            from public.feeding_records f
           where f.animal_id = g.id
             and coalesce(f.accepted, true)
        ) lf on true
       where g.created_by is not null
         and coalesce(g.archived, false) = false
         and coalesce(g.status, '') not in ('Sold')
         and not exists (select 1 from public.feeding_groups fg2 where fg2.id::text = g.feeding_group_id)
         and coalesce(e.entry->>'on', '') <> 'false'
         and (e.entry->>'on' = 'true' or g.created_date >= public.care_reminder_defaults_from())
      union all
      -- Other Reptiles (retired 16 Oct 2026): only while the switch
      -- app_settings 'other_reptile_reminders_enabled' is true. A missing
      -- row counts as off.
      select rp.created_by,
             coalesce(nullif(trim(rp.name), ''), 'A reptile'),
             'reptile',
             rp.id::text,
             current_date - (rp.last_fed_date + greatest(coalesce(rp.feeding_interval_days, 7), 1)::int)
        from public.other_reptiles rp
       where exists (
               select 1 from public.app_settings s
                where s.key = 'other_reptile_reminders_enabled'
                  and s.value #>> '{}' = 'true'
             )
         and rp.created_by is not null
         and rp.feeding_reminder_enabled is true
         and coalesce(rp.archived, false) = false
         and rp.last_fed_date is not null
    )
    select d.user_email,
           array_agg(d.name order by d.days_overdue desc, d.name) as names,
           array_agg(d.ref_id order by d.days_overdue desc, d.name) filter (where d.kind = 'gecko') as gecko_ids,
           array_agg(d.ref_id order by d.days_overdue desc, d.name) filter (where d.kind = 'group') as group_ids,
           bool_or(d.kind <> 'reptile') as has_gecko,
           count(*) as n,
           max(d.days_overdue) as max_overdue
      from due d
      left join public.profiles p on p.email = d.user_email
     where coalesce(p.feeding_alerts_enabled, true)
       and (d.days_overdue = 0
            or (d.days_overdue > 0 and coalesce(p.feeding_late_reminders_enabled, false)))
       and public.email_has_login(d.user_email)
       and not exists (
         select 1 from public.notifications n
          where n.user_email = d.user_email
            and n.type = 'feeding_due'
            and n.created_date >= current_date
       )
     group by d.user_email
  loop
    v_verb := case when r.max_overdue > 0 then 'due or overdue for feeding' else 'due for feeding today' end;
    v_body := case
      when r.n = 1 then format('%s is %s.', r.names[1], v_verb)
      when r.n = 2 then format('%s and %s are %s.', r.names[1], r.names[2], v_verb)
      else format('%s, %s and %s more are %s.', r.names[1], r.names[2], r.n - 2, v_verb)
    end;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.user_email, 'feeding_due', v_body,
      case when r.has_gecko then public.care_log_link('feeding', r.gecko_ids, r.group_ids) else '/OtherReptiles' end,
      jsonb_build_object(
        'count', r.n, 'names', to_jsonb(r.names),
        'gecko_ids', to_jsonb(coalesce(r.gecko_ids, '{}'::text[])),
        'group_ids', to_jsonb(coalesce(r.group_ids, '{}'::text[])),
        'source', 'cron'
      ),
      false, r.user_email
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_feeding_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_feeding_reminders() to service_role;
