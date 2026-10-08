-- Personal weigh-in reminders (activation pass, 5 Oct 2026). NOT APPLIED YET.
--
-- Why: new members add a gecko and never come back. The only weigh-in
-- reminder today is a weekly line about geckos that were weighed once and
-- then not for 30 days, so a new gecko (no weight yet, or weighed today)
-- produces nothing for a month. The app now sets a reminder per gecko when
-- it is added through the guided first gecko, stored in
--   profiles.extra_data.care_reminders.weigh_in
--     { enabled: bool (member switch, default on),
--       geckos: { "<gecko id>": { on: bool, every_days: int, since: "YYYY-MM-DD" } } }
-- (see src/lib/careReminders.js). This job reads it once a day.
--
-- Rules:
--   * Only geckos with on = true, owned by that member, not archived, not sold.
--   * Due the day after it was added when it has no weight yet (a nudge to
--     log the first one), otherwise every_days after the last weigh-in.
--   * One message per member per day, naming the geckos that are due.
--   * Each gecko is reminded once per due date; weighing it moves the date.
--   * The member switch (enabled = false) stops it, and the usual per-type
--     push and email preferences apply through notify_dispatch_on_insert
--     (weighin_reminder is already a known type with a title).
--
-- The weekly stale-weigh-in job now skips geckos covered here and members
-- who turned weigh-in reminders off, so nobody gets both.
--
-- Safe to run more than once: create or replace, and cron.schedule with a
-- fixed job name replaces the schedule.

create or replace function public.enqueue_personal_weighin_reminders()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_body text;
begin
  for r in
    with prefs as (
      select p.email,
             e.key as gecko_id,
             case when e.value->>'every_days' ~ '^\d{1,3}$'
                  then greatest(7, least(90, (e.value->>'every_days')::int))
                  else 14 end as every_days,
             case when e.value->>'since' ~ '^\d{4}-\d{2}-\d{2}$'
                  then (e.value->>'since')::date end as since
        from public.profiles p
        cross join lateral jsonb_each(
          case when jsonb_typeof(p.extra_data->'care_reminders'->'weigh_in'->'geckos') = 'object'
               then p.extra_data->'care_reminders'->'weigh_in'->'geckos'
               else '{}'::jsonb end
        ) e
       where p.email is not null
         and coalesce(p.extra_data->'care_reminders'->'weigh_in'->>'enabled', 'true') <> 'false'
         and jsonb_typeof(e.value) = 'object'
         and e.value->>'on' = 'true'
    ),
    due as (
      select pr.email,
             g.id,
             coalesce(nullif(trim(g.name), ''), 'A gecko') as name,
             case when lw.last_weighed is null
                  then coalesce(pr.since, g.created_date::date) + 1
                  else lw.last_weighed + pr.every_days end as due_date
        from prefs pr
        join public.geckos g on g.id = pr.gecko_id and g.created_by = pr.email
        left join lateral (
          select max(w.record_date) as last_weighed
            from public.weight_records w
           where w.gecko_id = g.id
        ) lw on true
       where coalesce(g.archived, false) = false
         and coalesce(g.status, '') not in ('Sold')
    )
    select d.email,
           array_agg(d.id order by d.due_date, d.name) as ids,
           array_agg(d.name order by d.due_date, d.name) as names,
           count(*) as n
      from due d
     where d.due_date <= current_date
       and not exists (
         select 1 from public.notifications n
          where n.user_email = d.email
            and n.type = 'weighin_reminder'
            and n.metadata->'gecko_ids' ? d.id
            and n.created_date::date >= d.due_date
       )
       and not exists (
         select 1 from public.notifications n
          where n.user_email = d.email
            and n.type = 'weighin_reminder'
            and n.created_date >= current_date
       )
     group by d.email
  loop
    v_body := case
      when r.n = 1 then format('Time to weigh %s. Weights build the growth chart and show when a female is big enough to breed.', r.names[1])
      when r.n = 2 then format('Time to weigh %s and %s. Weights build the growth chart and show when a female is big enough to breed.', r.names[1], r.names[2])
      else format('Time to weigh %s, %s and %s more. Weights build the growth chart and show when a female is big enough to breed.', r.names[1], r.names[2], r.n - 2)
    end;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.email, 'weighin_reminder', v_body,
      case when r.n = 1 then '/MyGeckos?gecko=' || r.ids[1] else '/MyGeckos' end,
      jsonb_build_object('gecko_ids', to_jsonb(r.ids), 'names', to_jsonb(r.names), 'count', r.n, 'source', 'personal'),
      false, r.email
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_personal_weighin_reminders() from public;
revoke all on function public.enqueue_personal_weighin_reminders() from anon;
revoke all on function public.enqueue_personal_weighin_reminders() from authenticated;
grant execute on function public.enqueue_personal_weighin_reminders() to service_role;

-- The weekly 30-day nudge, unchanged except that it leaves out members who
-- turned weigh-in reminders off and geckos the daily job above covers.
create or replace function public.enqueue_weighin_reminders()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select g.created_by, count(*) as stale
      from public.geckos g
      join lateral (
        select max(w.record_date) as last_weighed
          from public.weight_records w
         where w.gecko_id = g.id
      ) lw on true
      left join public.profiles p on p.email = g.created_by
     where coalesce(g.archived, false) = false
       and g.created_by is not null
       and coalesce(g.status, '') not in ('Sold')
       and lw.last_weighed is not null
       and lw.last_weighed < current_date - 30
       and coalesce(p.extra_data->'care_reminders'->'weigh_in'->>'enabled', 'true') <> 'false'
       and coalesce(p.extra_data->'care_reminders'->'weigh_in'->'geckos'->g.id->>'on', 'false') <> 'true'
       and not exists (
         select 1 from public.notifications n
          where n.user_email = g.created_by
            and n.type = 'weighin_reminder'
            and n.created_date > now() - interval '6 days'
       )
     group by g.created_by
  loop
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'weighin_reminder',
      format('%s of your geckos %s not been weighed in over 30 days. A quick weigh-in keeps growth charts and breeding readiness accurate.',
             r.stale, case when r.stale = 1 then 'has' else 'have' end),
      '/MyGeckos',
      jsonb_build_object('stale_count', r.stale, 'source', 'cron'),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

-- 14:20 UTC: morning across the US, ten minutes after feeding reminders.
select cron.schedule('personal-weighin-reminders-daily', '20 14 * * *', $$ select public.enqueue_personal_weighin_reminders(); $$);
