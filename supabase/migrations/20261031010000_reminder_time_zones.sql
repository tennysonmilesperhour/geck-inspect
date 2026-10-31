-- Reminders at about 7 am in each member's own time zone.
-- Comprehensive review, Part C15 item 3 and Part E (time zones before any
-- non-US member is asked to rely on reminders).
--
-- Before: every reminder job ran once a day at a fixed UTC hour (14:10 to
-- 14:25, and the hatch alerts at 13:00). That is about 7 am Pacific in
-- summer, 6 am Pacific in winter, and 11 pm in Seoul. "Today" in the
-- reminder queries was the UTC day.
--
-- After:
--
-- 1. profiles.time_zone (text, may be empty): an IANA time zone name such
--    as 'America/Chicago' or 'Asia/Seoul'. The app saves the browser's
--    time zone on the member's next visit when the column is empty
--    (src/lib/memberTimeZone.js), and Settings, Feeding Alerts lets the
--    member change it. A trigger refuses a name Postgres does not know,
--    so a stored value is always usable.
--
-- 2. reminder_default_time_zone() = 'America/Los_Angeles'. A member with
--    no time zone saved keeps today's behaviour: reminders at about 7 am
--    Pacific.
--
-- 3. run_reminders_local(p_job): the five daily reminder jobs now run
--    every hour at their old minute and call this. Each hour it finds the
--    time zones (the members' saved ones plus the default) where it is
--    now 7 am, and for each one it sets the session time zone to it (so
--    current_date and every "today" in the queries is the member's local
--    day) and the setting geck.reminder_zone, then calls the unchanged
--    reminder function. A member is reminded in the run for their own
--    zone only. Both settings are undone when run_reminders_local returns.
--
-- 4. reminder_recipient_due(email): email_has_login(email), and, while
--    geck.reminder_zone is set, "this member's zone is the one being run".
--    The five reminder functions call it where they called
--    email_has_login. Called with no geck.reminder_zone (by hand, or by an
--    old schedule) they behave exactly as before: everyone, UTC day.
--
-- The five functions below are their newest bodies with only that one
-- call changed (public.email_has_login( became
-- public.reminder_recipient_due( on the lines that filter recipients):
--   enqueue_personal_weighin_reminders  from 20261015151100
--   enqueue_feeding_reminders           from 20261016090700
--   enqueue_hatch_alerts                from 20261015151100
--   enqueue_vet_followups               from 20261015151100
--   enqueue_season_planner_reminders    from 20261015151100
-- Owner, security definer, search_path and grants are as they were.
--
-- Not changed: the weekly weigh-in line (Sunday 15:00 UTC), the weekly
-- digest (Sunday 16:00 UTC), the market brief and the email programmes.
--
-- Safe for the app that is already open: a new nullable column, new
-- functions, and the same function names and return types. Safe to run
-- more than once: add column if not exists, create or replace, drop
-- trigger if exists, and cron.schedule with the existing job names (which
-- replaces each schedule).

-- ===========================================================================
-- 1. The column, and a check on the name
-- ===========================================================================

alter table public.profiles add column if not exists time_zone text;

comment on column public.profiles.time_zone is
  'IANA time zone name (for example America/Chicago). Reminders arrive at about 7 am in this zone. Empty: reminder_default_time_zone() (America/Los_Angeles). Saved from the browser on the next visit when empty; the member can change it in Settings.';

create or replace function public.reminder_default_time_zone()
returns text
language sql
immutable
set search_path to ''
as $function$
  select 'America/Los_Angeles'::text;
$function$;

-- The local hour reminders go out at.
create or replace function public.reminder_local_hour()
returns integer
language sql
immutable
set search_path to ''
as $function$
  select 7;
$function$;

-- Before insert or update: a blank name is stored as empty (null), and a
-- name Postgres does not know is refused, so run_reminders_local can
-- always use a stored value.
create or replace function public.profiles_check_time_zone()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if tg_op = 'UPDATE' and new.time_zone is not distinct from old.time_zone then
    return new;
  end if;
  new.time_zone := nullif(btrim(new.time_zone), '');
  if new.time_zone is not null
     and (length(new.time_zone) > 64
          or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = new.time_zone)) then
    raise exception 'Unknown time zone: %', left(new.time_zone, 64)
      using errcode = '22023',
            hint = 'Use an IANA time zone name such as America/Chicago.';
  end if;
  return new;
end;
$function$;

revoke all on function public.profiles_check_time_zone() from public, anon, authenticated;

drop trigger if exists profiles_check_time_zone on public.profiles;
create trigger profiles_check_time_zone
  before insert or update of time_zone on public.profiles
  for each row execute function public.profiles_check_time_zone();

-- ===========================================================================
-- 2. Who is due in this run
-- ===========================================================================

create or replace function public.reminder_recipient_due(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_scope text := nullif(current_setting('geck.reminder_zone', true), '');
  v_zone text;
begin
  if not public.email_has_login(p_email) then
    return false;
  end if;
  -- No run in progress (a call by hand, or an old schedule): everyone, as
  -- before this file.
  if v_scope is null then
    return true;
  end if;
  select p.time_zone into v_zone
    from public.profiles p
   where lower(p.email) = lower(btrim(p_email))
     and p.time_zone is not null
   order by p.updated_date desc nulls last
   limit 1;
  return coalesce(v_zone, public.reminder_default_time_zone()) = v_scope;
end;
$function$;

revoke all on function public.reminder_default_time_zone() from public, anon, authenticated;
grant execute on function public.reminder_default_time_zone() to service_role;
revoke all on function public.reminder_local_hour() from public, anon, authenticated;
grant execute on function public.reminder_local_hour() to service_role;
revoke all on function public.reminder_recipient_due(text) from public, anon, authenticated;
grant execute on function public.reminder_recipient_due(text) to service_role;

-- ===========================================================================
-- 3. The hourly runner
-- ===========================================================================
-- p_job: 'feeding', 'weigh_in', 'hatch', 'vet' or 'planner'. p_at is the
-- moment to run for (the tests pass one; the schedule uses now()).
-- Returns how many notifications the reminder functions made.

create or replace function public.run_reminders_local(p_job text, p_at timestamptz default null)
returns integer
language plpgsql
security definer
set search_path to ''
-- Both settings are listed here so that what the loop sets is undone when
-- the function returns (Postgres restores a variable named in a SET
-- clause, and only those).
set timezone to 'UTC'
set geck.reminder_zone to ''
as $function$
declare
  v_at timestamptz := coalesce(p_at, now());
  v_zone text;
  v_clock text;
  v_hour integer;
  v_total integer := 0;
begin
  if p_job not in ('feeding', 'weigh_in', 'hatch', 'vet', 'planner') then
    raise exception 'Unknown reminder job: %', p_job using errcode = '22023';
  end if;

  for v_zone in
    select z
      from (select distinct p.time_zone as z
              from public.profiles p
             where p.time_zone is not null
            union
            select public.reminder_default_time_zone()) zones
     order by z
  loop
    -- A stored name that Postgres stopped knowing (a tzdata change) runs
    -- on the default zone's clock, so those members are never skipped.
    v_clock := v_zone;
    begin
      v_hour := extract(hour from (v_at at time zone v_clock))::int;
    exception when others then
      v_clock := public.reminder_default_time_zone();
      v_hour := extract(hour from (v_at at time zone v_clock))::int;
    end;
    continue when v_hour <> public.reminder_local_hour();

    -- Undone when the function returns (its SET clause above).
    perform pg_catalog.set_config('timezone', v_clock, true);
    perform pg_catalog.set_config('geck.reminder_zone', v_zone, true);

    v_total := v_total + case p_job
      when 'feeding'  then public.enqueue_feeding_reminders()
      when 'weigh_in' then public.enqueue_personal_weighin_reminders()
      when 'hatch'    then public.enqueue_hatch_alerts()
      when 'vet'      then public.enqueue_vet_followups()
      when 'planner'  then public.enqueue_season_planner_reminders()
    end;
  end loop;

  return v_total;
end;
$function$;

revoke all on function public.run_reminders_local(text, timestamptz) from public, anon, authenticated;
grant execute on function public.run_reminders_local(text, timestamptz) to service_role;

-- ===========================================================================
-- 4. The five reminder functions (one call changed in each, see the header)
-- ===========================================================================

-- enqueue_personal_weighin_reminders
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
    with members as (
      select p.email,
             case when jsonb_typeof(p.extra_data->'care_reminders'->'weigh_in'->'geckos') = 'object'
                  then p.extra_data->'care_reminders'->'weigh_in'->'geckos'
                  else '{}'::jsonb end as settings
        from public.profiles p
       where p.email is not null
         and coalesce(p.extra_data->'care_reminders'->'weigh_in'->>'enabled', 'true') <> 'false'
         and public.reminder_recipient_due(p.email)
    ),
    chosen as (
      select m.email, g.id, g.name, g.created_date, g.hatch_date, g.weight_grams,
             case when jsonb_typeof(m.settings->g.id) = 'object' then m.settings->g.id end as entry
        from members m
        join public.geckos g on g.created_by = m.email
       where coalesce(g.archived, false) = false
         and coalesce(g.status, '') not in ('Sold')
    ),
    due as (
      select c.email,
             c.id,
             coalesce(nullif(trim(c.name), ''), 'A gecko') as name,
             case
               when lw.last_weighed is not null then lw.last_weighed + iv.every_days
               -- Weighed when it was added but no dated weigh-in: count the
               -- day it was added as the last weigh-in.
               when c.weight_grams is not null then coalesce(sv.since, c.created_date::date) + iv.every_days
               -- No weight at all: a nudge the day after it was added.
               else coalesce(sv.since, c.created_date::date) + 1
             end as due_date
        from chosen c
        left join lateral (
          select w.record_date as last_weighed, w.weight_grams as last_weight
            from public.weight_records w
           where w.gecko_id = c.id
           order by w.record_date desc nulls last, w.created_date desc nulls last
           limit 1
        ) lw on true
        cross join lateral (
          select case when c.entry->>'since' ~ '^\d{4}-\d{2}-\d{2}$'
                      then (c.entry->>'since')::date end as since
        ) sv
        cross join lateral (
          select case
                   -- A cadence the member picked on the gecko's record.
                   when c.entry->>'fixed' = 'true' and c.entry->>'every_days' ~ '^\d{1,3}$'
                     then greatest(7, least(90, (c.entry->>'every_days')::int))
                   else public.weighin_interval_days(coalesce(lw.last_weight, c.weight_grams), c.hatch_date)
                 end as every_days
        ) iv
       where (c.entry is null and c.created_date >= public.care_reminder_defaults_from())
          or c.entry->>'on' = 'true'
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
      public.care_log_link('weight', r.ids),
      jsonb_build_object('gecko_ids', to_jsonb(r.ids), 'names', to_jsonb(r.names), 'count', r.n, 'source', 'personal'),
      false, r.email
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_personal_weighin_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_personal_weighin_reminders() to service_role;

-- enqueue_feeding_reminders
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
       and public.reminder_recipient_due(d.user_email)
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

-- enqueue_hatch_alerts
create or replace function public.enqueue_hatch_alerts()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  m record;
  r record;
  v_count integer := 0;
  v_i integer;
  v_days_incubating integer;
  v_days_to_expected integer;
  v_body text;
  v_more integer;
begin
  for m in
    with eggs_open as (
      select e.id, e.created_by, e.lay_date, e.hatch_date_expected,
             -- Due: from 7 days before the expected hatch date to 14 days
             -- after it.
             (e.hatch_date_expected is not null
              and current_date between e.hatch_date_expected - 7 and e.hatch_date_expected + 14) as daily,
             -- No row for this egg (from this job or the app) for 6 days,
             -- less an hour so a run a few seconds early still counts it.
             -- The app looks back 7 days, so a row every 6 keeps the egg
             -- covered without a gap.
             not exists (
               select 1 from public.notifications n
                where n.user_email = e.created_by
                  and n.type = 'hatch_alert'
                  and n.metadata ->> 'egg_id' = e.id
                  and coalesce(n.metadata ->> 'kind', '') <> 'status_check'
                  and n.created_date > now() - interval '6 days' + interval '1 hour'
             ) as stale,
             not exists (
               select 1 from public.notifications n
                where n.user_email = e.created_by
                  and n.type = 'hatch_alert'
                  and n.metadata ->> 'egg_id' = e.id
                  and coalesce(n.metadata ->> 'kind', '') <> 'status_check'
                  and n.created_date >= current_date
             ) as none_today
        from public.eggs e
        left join public.profiles p on p.email = e.created_by
       where e.status = 'Incubating'
         and coalesce(e.archived, false) = false
         and e.lay_date is not null
         and e.created_by is not null
         and (current_date - e.lay_date) >= coalesce(p.hatch_alert_days, 60)
         and current_date <= coalesce(e.hatch_date_expected + 30, e.lay_date + 150)
         and public.reminder_recipient_due(e.created_by)
    )
    select o.created_by as email,
           count(*)::int as n,
           bool_or(o.daily) as has_daily,
           bool_or(o.stale) as any_stale,
           -- On a daily run an egg in the daily window comes first, so
           -- the alert names an egg that is due, not one long overdue.
           -- Then soonest expected hatch first; eggs with no expected
           -- date last, oldest first.
           array_agg(o.id order by o.daily desc, o.hatch_date_expected nulls last, o.lay_date, o.id) as ids,
           array_agg(o.lay_date order by o.daily desc, o.hatch_date_expected nulls last, o.lay_date, o.id) as lay_dates,
           array_agg(o.hatch_date_expected order by o.daily desc, o.hatch_date_expected nulls last, o.lay_date, o.id) as expected,
           array_agg(o.daily order by o.daily desc, o.hatch_date_expected nulls last, o.lay_date, o.id) as daily,
           array_agg(o.stale order by o.daily desc, o.hatch_date_expected nulls last, o.lay_date, o.id) as stale,
           array_agg(o.none_today order by o.daily desc, o.hatch_date_expected nulls last, o.lay_date, o.id) as none_today
      from eggs_open o
     group by o.created_by
     order by o.created_by
  loop
    -- At most one sent alert a day: a second run the same day, or a run
    -- after this job already wrote today's alert, adds nothing.
    if exists (
      select 1 from public.notifications n
       where n.user_email = m.email
         and n.type = 'hatch_alert'
         and n.metadata ->> 'source' = 'cron'
         and coalesce(n.metadata ->> 'kind', '') <> 'status_check'
         and coalesce(n.metadata ->> 'quiet', '') <> 'true'
         and n.created_date >= current_date
    ) then
      continue;
    end if;
    if not (m.has_daily or m.any_stale) then
      continue;
    end if;

    -- The alert: the egg due soonest, with the count of the others.
    v_days_incubating := current_date - m.lay_dates[1];
    v_days_to_expected := case when m.expected[1] is null then null
                               else m.expected[1] - current_date end;
    v_more := m.n - 1;
    v_body := case
      when m.n = 1 and v_days_to_expected is not null and v_days_to_expected >= 0 then
        format('An egg in your incubator is due to hatch in %s day%s (incubating for %s days). Time to check on it.',
               v_days_to_expected, case when v_days_to_expected = 1 then '' else 's' end, v_days_incubating)
      when m.n = 1 and v_days_to_expected is not null then
        format('An egg in your incubator is %s day%s past its expected hatch date. Check on it as soon as you can.',
               abs(v_days_to_expected), case when abs(v_days_to_expected) = 1 then '' else 's' end)
      when m.n = 1 then
        format('An egg has been incubating for %s days, within the hatch window.', v_days_incubating)
      when v_days_to_expected is not null and v_days_to_expected >= 0 then
        format('%s eggs in your incubator are close to hatching. The first is due in %s day%s (incubating for %s days). Time to check on them.',
               m.n, v_days_to_expected, case when v_days_to_expected = 1 then '' else 's' end, v_days_incubating)
      when v_days_to_expected is not null then
        format('%s eggs in your incubator need a look. The first is %s day%s past its expected hatch date. Check on them as soon as you can.',
               m.n, abs(v_days_to_expected), case when abs(v_days_to_expected) = 1 then '' else 's' end)
      else
        format('%s eggs in your incubator are within the hatch window. The oldest has been incubating for %s days.',
               m.n, v_days_incubating)
    end;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      m.email, 'hatch_alert', v_body, '/Breeding?tab=hatchery',
      jsonb_build_object(
        'egg_id', m.ids[1],
        'egg_ids', to_jsonb(m.ids),
        'count', m.n,
        'lay_date', m.lay_dates[1],
        'hatch_date_expected', m.expected[1],
        'days_incubating', v_days_incubating,
        'cadence', case when m.has_daily then 'daily' else 'weekly' end,
        'source', 'cron'
      ),
      false, m.email
    );
    v_count := v_count + 1;

    -- The other eggs: a quiet row where one is needed to keep the egg
    -- covered for 7 days, and, on a 6-day send, for every egg not yet
    -- covered today, so the member's eggs stay on one schedule.
    for v_i in 2 .. m.n loop
      if m.stale[v_i] or (not m.has_daily and m.none_today[v_i]) then
        v_days_incubating := current_date - m.lay_dates[v_i];
        insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
        values (
          m.email, 'hatch_alert',
          format('An egg in your incubator is in its hatch window (incubating for %s days). It is counted in today''s hatch alert.',
                 v_days_incubating),
          '/Breeding?tab=hatchery',
          jsonb_build_object(
            'egg_id', m.ids[v_i],
            'lay_date', m.lay_dates[v_i],
            'hatch_date_expected', m.expected[v_i],
            'days_incubating', v_days_incubating,
            'cadence', case when m.daily[v_i] then 'daily' else 'weekly' end,
            'quiet', true,
            'grouped_in', m.ids[1],
            'source', 'cron'
          ),
          true, m.email
        );
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;

  -- Past the hatch window: one status check per egg, ever. Each member gets
  -- one sent message per run, naming how many eggs it covers; the other
  -- eggs' checks are quiet rows.
  for m in
    select e.created_by as email,
           count(*)::int as n,
           array_agg(e.id order by e.lay_date, e.id) as ids,
           array_agg(e.lay_date order by e.lay_date, e.id) as lay_dates
      from public.eggs e
     where e.status = 'Incubating'
       and coalesce(e.archived, false) = false
       and e.lay_date is not null
       and e.created_by is not null
       and current_date > coalesce(e.hatch_date_expected + 30, e.lay_date + 150)
       and public.reminder_recipient_due(e.created_by)
       and not exists (
         select 1 from public.notifications n
          where n.user_email = e.created_by
            and n.type = 'hatch_alert'
            and n.metadata ->> 'egg_id' = e.id
            and n.metadata ->> 'kind' = 'status_check'
       )
     group by e.created_by
     order by e.created_by
  loop
    for v_i in 1 .. m.n loop
      v_days_incubating := current_date - m.lay_dates[v_i];
      v_body := case
        when v_i > 1 then
          format('An egg laid %s is still marked incubating after %s days, past its hatch window. It is counted in today''s reminder.',
                 to_char(m.lay_dates[v_i], 'FMMonth FMDD, YYYY'), v_days_incubating)
        when m.n = 1 then
          format('An egg laid %s is still marked incubating after %s days, past its hatch window. If it hatched or did not make it, update it on the Breeding page so your records stay accurate. This is the last reminder for this egg.',
                 to_char(m.lay_dates[1], 'FMMonth FMDD, YYYY'), v_days_incubating)
        else
          format('%s eggs are still marked incubating past their hatch window, the oldest laid %s. If they hatched or did not make it, update them on the Breeding page so your records stay accurate. This is the last reminder for these eggs.',
                 m.n, to_char(m.lay_dates[1], 'FMMonth FMDD, YYYY'))
      end;
      insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
      values (
        m.email, 'hatch_alert', v_body, '/Breeding?tab=hatchery',
        jsonb_build_object(
          'egg_id', m.ids[v_i],
          'lay_date', m.lay_dates[v_i],
          'days_incubating', v_days_incubating,
          'kind', 'status_check',
          'source', 'cron'
        )
        || case when v_i = 1 and m.n > 1 then jsonb_build_object('egg_ids', to_jsonb(m.ids), 'count', m.n)
                when v_i > 1 then jsonb_build_object('quiet', true, 'grouped_in', m.ids[1])
                else '{}'::jsonb end,
        v_i > 1, m.email
      );
      v_count := v_count + 1;
    end loop;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.enqueue_hatch_alerts() from public, anon, authenticated;
grant execute on function public.enqueue_hatch_alerts() to service_role;

-- enqueue_vet_followups
create or replace function public.enqueue_vet_followups()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_body text;
  v_when text;
begin
  for r in
    select v.id, v.created_by, v.animal_id, v.follow_up, v.date as visit_date,
           nullif(trim(v.reason), '') as reason,
           nullif(trim(v.vet_name), '') as vet_name,
           coalesce(nullif(trim(g.name), ''), 'Your gecko') as gecko_name
      from public.vet_records v
      join public.geckos g on g.id = v.animal_id
     where v.follow_up is not null
       and v.created_by is not null
       and v.follow_up between current_date - 3 and current_date
       and coalesce(g.archived, false) = false
       and public.reminder_recipient_due(v.created_by)
       and not exists (
         select 1 from public.notifications n
          where n.user_email = v.created_by
            and n.type = 'vet_followup'
            and n.metadata ->> 'vet_record_id' = v.id::text
            and n.metadata ->> 'follow_up' = v.follow_up::text
       )
  loop
    v_when := case when r.follow_up = current_date then 'is due today'
                   else format('was due %s', to_char(r.follow_up, 'FMMonth FMDD')) end;
    v_body := format('%s''s vet follow-up %s%s%s.',
      r.gecko_name, v_when,
      case when r.reason is not null then format(' (visit for %s on %s)', r.reason, to_char(r.visit_date, 'FMMonth FMDD'))
           else format(' (visit on %s)', to_char(r.visit_date, 'FMMonth FMDD')) end,
      case when r.vet_name is not null then format(' with %s', r.vet_name) else '' end);

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'vet_followup', left(v_body, 500),
      '/GeckoDetail?id=' || r.animal_id,
      jsonb_build_object(
        'vet_record_id', r.id,
        'gecko_id', r.animal_id,
        'follow_up', r.follow_up,
        'source', 'cron'
      ),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_vet_followups() from public, anon, authenticated;
grant execute on function public.enqueue_vet_followups() to service_role;

-- enqueue_season_planner_reminders
create or replace function public.enqueue_season_planner_reminders()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_body text;
  v_when text;
  v_label text;
begin
  -- Only the scheduled job (no signed-in caller), the service role or an
  -- admin may run this.
  if coalesce(auth.role(), '') not in ('', 'service_role') and not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- 3a. Tasks: due-day reminders and "N days before" reminders.
  for r in
    with due_tasks as (
      select t.id, t.title, t.created_by, t.is_recurring,
             (coalesce(case when t.is_recurring then t.next_due_date end, t.due_date) at time zone 'UTC')::date as due,
             case when coalesce(t.reminder_enabled, false) then greatest(coalesce(t.reminder_days_before, 0), 0)::int else 0 end as days_before
        from public.tasks t
        left join public.projects p on p.id = t.project_id
       where coalesce(t.is_completed, false) = false
         and t.created_by is not null
         and public.reminder_recipient_due(t.created_by)
         and coalesce(case when t.is_recurring then t.next_due_date end, t.due_date) is not null
         and (p.id is null or coalesce(p.status, 'active') = 'active')
    ),
    candidates as (
      select d.*, 'due'::text as kind from due_tasks d
       where d.due between current_date - 3 and current_date
      union all
      select d.*, 'early'::text as kind from due_tasks d
       where d.days_before > 0
         and d.due > current_date
         and (d.due - d.days_before) between current_date - 3 and current_date
    )
    select c.* from candidates c
     where not exists (
       select 1 from public.notifications n
        where n.user_email = c.created_by
          and n.type = 'task_reminder'
          and n.metadata ->> 'task_id' = c.id
          and n.metadata ->> 'due' = c.due::text
          and n.metadata ->> 'kind' = c.kind
     )
  loop
    v_label := coalesce(nullif(trim(r.title), ''), 'A task');
    if r.kind = 'early' then
      v_when := case when r.due - current_date = 1 then 'is due tomorrow'
                     else format('is due in %s days (%s)', r.due - current_date, to_char(r.due, 'FMMonth FMDD')) end;
    else
      v_when := case when r.due = current_date then 'is due today'
                     else format('was due %s', to_char(r.due, 'FMMonth FMDD')) end;
    end if;
    v_body := format('Task "%s" %s%s.', v_label, v_when, case when r.is_recurring then ' (repeats)' else '' end);

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'task_reminder', left(v_body, 500), '/ProjectManager?tab=projects',
      jsonb_build_object('task_id', r.id, 'due', r.due, 'kind', r.kind, 'source', 'cron'),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;

  -- 3b. Plans (projects) on their due date.
  for r in
    select p.id, p.name, p.created_by, p.due_date as due
      from public.projects p
     where coalesce(p.status, 'active') = 'active'
       and p.created_by is not null
       and public.reminder_recipient_due(p.created_by)
       and p.due_date between current_date - 3 and current_date
       and not exists (
         select 1 from public.notifications n
          where n.user_email = p.created_by
            and n.type = 'task_reminder'
            and n.metadata ->> 'project_id' = p.id
            and n.metadata ->> 'due' = p.due_date::text
       )
  loop
    v_label := coalesce(nullif(trim(r.name), ''), 'A plan');
    v_when := case when r.due = current_date then 'is due today'
                   else format('was due %s', to_char(r.due, 'FMMonth FMDD')) end;
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'task_reminder', left(format('Plan "%s" %s.', v_label, v_when), 500), '/ProjectManager?tab=projects',
      jsonb_build_object('project_id', r.id, 'due', r.due, 'kind', 'due', 'source', 'cron'),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;

  -- 3c. Future breeding plans whose season window is open.
  for r in
    select f.id, f.created_by, f.target_season, f.target_year,
           coalesce(nullif(trim(s.name), ''), 'your sire') as sire_name,
           coalesce(nullif(trim(d.name), ''), 'your dam') as dam_name
      from public.future_breeding_plans f
      left join public.geckos s on s.id = f.sire_id
      left join public.geckos d on d.id = f.dam_id
     where coalesce(f.notified, false) = false
       and f.started_breeding_plan_id is null
       and f.created_by is not null
       and public.reminder_recipient_due(f.created_by)
       and public.season_window_start(f.target_season, f.target_year) is not null
       and current_date between public.season_window_start(f.target_season, f.target_year)
                            and public.season_window_end(f.target_season, f.target_year)
  loop
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'future_breeding_ready',
      left(format('Your %s %s pairing window is open: %s x %s. Open the Season Planner and tap Start this pairing.',
        initcap(r.target_season), r.target_year, r.sire_name, r.dam_name), 500),
      '/ProjectManager?tab=future',
      jsonb_build_object('future_breeding_plan_id', r.id, 'source', 'cron'),
      false, r.created_by
    );
    update public.future_breeding_plans
       set notified = true, notified_date = now()
     where id = r.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.enqueue_season_planner_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_season_planner_reminders() to service_role;

-- ===========================================================================
-- 5. The schedules: hourly at the old minute, each member at 7 am local
-- ===========================================================================
-- The job names stay, so the operations docs and the job history keep
-- one name per reminder. hatch-alerts-daily was created before the
-- September baseline and exists only in production; cron.schedule with
-- its name replaces it there and creates it in a fresh copy.

select cron.schedule('feeding-reminders-daily',          '10 * * * *', $$ select public.run_reminders_local('feeding'); $$);
select cron.schedule('personal-weighin-reminders-daily', '20 * * * *', $$ select public.run_reminders_local('weigh_in'); $$);
select cron.schedule('season-planner-reminders-daily',   '20 * * * *', $$ select public.run_reminders_local('planner'); $$);
select cron.schedule('vet-followups-daily',              '25 * * * *', $$ select public.run_reminders_local('vet'); $$);
select cron.schedule('hatch-alerts-daily',               '0 * * * *',  $$ select public.run_reminders_local('hatch'); $$);
