-- Feeding reminders used to be created by FeedingAlertSystem, a loop inside
-- an open browser tab, so they only fired while the app was open. This runs
-- them on the server once a day, like hatch alerts and weigh-in reminders.
--
-- Rules (decision 27 Sep 2026):
--   * Only feeding groups with reminders on, and other reptiles with
--     feeding_reminder_enabled, count. Nobody gets reminders they did not set up.
--   * profiles.feeding_alerts_enabled = false turns them off entirely.
--   * One combined message per keeper per day, never one per group.
--   * Due today only, unless the keeper turned on late reminders, which
--     repeat daily while a feeding stays overdue.
-- Delivery (push and email) goes through notify_dispatch_on_insert, which
-- applies the keeper's per-type preferences; emails carry a preferences link.

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
             true as is_group,
             current_date - (fg.last_fed_date + greatest(coalesce(fg.interval_days, 3), 1)::int) as days_overdue
        from public.feeding_groups fg
       where fg.created_by is not null
         and coalesce(fg.feeding_reminder_enabled, true)
         and fg.last_fed_date is not null
      union all
      select rp.created_by,
             coalesce(nullif(trim(rp.name), ''), 'A reptile'),
             false,
             current_date - (rp.last_fed_date + greatest(coalesce(rp.feeding_interval_days, 7), 1)::int)
        from public.other_reptiles rp
       where rp.created_by is not null
         and rp.feeding_reminder_enabled is true
         and coalesce(rp.archived, false) = false
         and rp.last_fed_date is not null
    )
    select d.user_email,
           array_agg(d.name order by d.days_overdue desc, d.name) as names,
           bool_or(d.is_group) as has_group,
           count(*) as n,
           max(d.days_overdue) as max_overdue
      from due d
      left join public.profiles p on p.email = d.user_email
     where coalesce(p.feeding_alerts_enabled, true)
       and (d.days_overdue = 0
            or (d.days_overdue > 0 and coalesce(p.feeding_late_reminders_enabled, false)))
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
      case when r.has_group then '/BatchHusbandry' else '/OtherReptiles' end,
      jsonb_build_object('count', r.n, 'names', to_jsonb(r.names), 'source', 'cron'),
      false, r.user_email
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_feeding_reminders() from public;
revoke all on function public.enqueue_feeding_reminders() from anon;
revoke all on function public.enqueue_feeding_reminders() from authenticated;
grant execute on function public.enqueue_feeding_reminders() to service_role;

-- 14:10 UTC is morning across the US (7:10 PT, 10:10 ET), an hour after
-- hatch alerts so the two do not land together.
select cron.schedule('feeding-reminders-daily', '10 14 * * *', $$ select public.enqueue_feeding_reminders(); $$);
