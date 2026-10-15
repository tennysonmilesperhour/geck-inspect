-- Reminders that follow the animal, and offline logs saved once.
-- Comprehensive review, Part E2, items 15 and 19 (16 Oct 2026).
--
-- Additive and safe to run more than once: columns and indexes use
-- "if not exists", every function is "create or replace", and no cron
-- schedule changes (the existing daily and weekly jobs call the same
-- function names).
--
-- 1. Offline logs saved once (item 19).
--    A care log made on a weak signal can reach the database and commit,
--    while the phone gives up after 30 seconds and keeps the log to send
--    again. Sending it again used to make a second row. Each log now
--    carries a client_request_id made on the phone before the first try
--    and kept with the queued copy. The unique index refuses the second
--    copy, and the app treats that refusal as "already saved".
--
-- 2. Reminder defaults by life stage (item 15).
--    A gecko added from 16 Oct 2026 on gets reminders without the member
--    opening Settings, whichever way it was added (Quick Add, the full
--    form, a spreadsheet import, a hatchling, Morph ID):
--      * weigh-ins: every 14 days while growing (under 15 g or under 12
--        months, the care guide's hatchling and juvenile stages), every 21
--        days as a sub-adult (under 35 g or under 18 months) and every 30
--        days as an adult. The first one is the day after it is added when
--        it has no weight yet. The cadence follows the animal: when a
--        juvenile crosses 15 g the next date moves out by itself.
--      * feeding: every 3 days from its last feeding, for a gecko that is
--        not in a feeding group (geckos in a group keep the group's
--        schedule, as before).
--      * eggs: once a day from 7 days before the expected hatch date to 14
--        days after it, and weekly otherwise (as before).
--    The member can still change or switch off each one: per gecko on its
--    record (profiles.extra_data.care_reminders.weigh_in.geckos.<id> and
--    .feeding.geckos.<id>, with "on": false), or for the whole account in
--    Settings. Geckos added before 16 Oct keep what they had: the
--    per-gecko switch and the weekly "not weighed in 30 days" line.
--
-- 3. One-tap log links (item 15). Weigh-in and feeding reminders link to
--    /log?type=weight|feeding&gecko=<ids>&group=<ids>, which opens a short
--    form for exactly those geckos. Hatch reminders open the hatchery tab.
--
-- 4. No reminders or digests for addresses that cannot sign in (item 15).
--    About 83 of 147 profiles were imported from the old platform and have
--    no login. In the 30 days to 15 Oct, 76 of 135 weekly digests and 12
--    of 31 weigh-in reminders went to them. Every reminder and digest job
--    below now leaves those addresses out, so no row is created at all
--    (public.email_has_login, migration 20261015140100).
--
-- Needs 20261015140100_email_has_login.sql first (it is listed before
-- this file).

-- ===========================================================================
-- 1. client_request_id on the three care-log tables
-- ===========================================================================

alter table public.weight_records  add column if not exists client_request_id uuid;
alter table public.feeding_records add column if not exists client_request_id uuid;
alter table public.shed_records    add column if not exists client_request_id uuid;

comment on column public.weight_records.client_request_id is
  'Made on the phone before the first save attempt and kept when the log waits offline. Unique, so a retried log is never saved twice.';
comment on column public.feeding_records.client_request_id is
  'Made on the phone before the first save attempt and kept when the log waits offline. Unique, so a retried log is never saved twice.';
comment on column public.shed_records.client_request_id is
  'Made on the phone before the first save attempt and kept when the log waits offline. Unique, so a retried log is never saved twice.';

-- Not partial: empty values never clash (each NULL is distinct), and a
-- plain unique index also works for "on conflict (client_request_id)".
-- The tables hold a few hundred rows, so building these is instant.
create unique index if not exists weight_records_client_request_id_key
  on public.weight_records (client_request_id);
create unique index if not exists feeding_records_client_request_id_key
  on public.feeding_records (client_request_id);
create unique index if not exists shed_records_client_request_id_key
  on public.shed_records (client_request_id);

-- ===========================================================================
-- 2. Helpers
-- ===========================================================================

-- The day the life-stage defaults start: geckos created on or after it
-- get reminders without a stored setting. The app reads the same date
-- (CARE_DEFAULTS_FROM in src/lib/careReminders.js); a test checks both.
create or replace function public.care_reminder_defaults_from()
returns date
language sql
immutable
set search_path to ''
as $function$
  select date '2026-10-16';
$function$;

revoke all on function public.care_reminder_defaults_from() from public, anon, authenticated;
grant execute on function public.care_reminder_defaults_from() to service_role;

-- Days between weigh-ins for a crested gecko, from the care guide's life
-- stages (src/data/care-guide.js, "Life Stages"):
--   hatchling and juvenile, under 15 g or under 12 months: 14 days
--   sub-adult, under 35 g or under 18 months:            21 days
--   adult:                                               30 days
-- Nothing known (no weight, no hatch date) counts as growing, since most
-- first geckos are bought young. The app has the same rule
-- (weighInIntervalDays in src/lib/lifeStage.js) and the same test cases.
create or replace function public.weighin_interval_days(
  p_weight_grams numeric,
  p_hatch_date date,
  p_on date default current_date
)
returns integer
language sql
immutable
set search_path to ''
as $function$
  select case
    when p_weight_grams is null and p_hatch_date is null then 14
    when (p_weight_grams is not null and p_weight_grams < 15)
      or (p_hatch_date is not null and p_hatch_date > (p_on - interval '12 months')::date) then 14
    when (p_weight_grams is not null and p_weight_grams < 35)
      or (p_hatch_date is not null and p_hatch_date > (p_on - interval '18 months')::date) then 21
    else 30
  end;
$function$;

revoke all on function public.weighin_interval_days(numeric, date, date) from public, anon, authenticated;
grant execute on function public.weighin_interval_days(numeric, date, date) to service_role;

-- The one-tap log link for a reminder: /log?type=<type>&gecko=<ids>&group=<ids>.
-- Only ids made of letters, digits, "_" and "-" (up to 64) go in, at most
-- 10 of each, so the link always passes public.safe_internal_link. With
-- no usable id it falls back to the page that lists them.
create or replace function public.care_log_link(
  p_type text,
  p_gecko_ids text[],
  p_group_ids text[] default null
)
returns text
language sql
immutable
set search_path to ''
as $function$
  with g as (
    select array_to_string((array_agg(x order by o))[1:10], ',') as ids
      from unnest(coalesce(p_gecko_ids, '{}'::text[])) with ordinality as t(x, o)
     where x ~ '^[A-Za-z0-9_-]{1,64}$'
  ),
  f as (
    select array_to_string((array_agg(x order by o))[1:10], ',') as ids
      from unnest(coalesce(p_group_ids, '{}'::text[])) with ordinality as t(x, o)
     where x ~ '^[A-Za-z0-9_-]{1,64}$'
  )
  select case
    when p_type not in ('weight', 'feeding', 'shed') then '/MyGeckos'
    when coalesce(g.ids, '') = '' and coalesce(f.ids, '') = '' then
      case when p_type = 'feeding' then '/BatchHusbandry' else '/MyGeckos' end
    else '/log?type=' || p_type
         || case when coalesce(g.ids, '') <> '' then '&gecko=' || g.ids else '' end
         || case when coalesce(f.ids, '') <> '' then '&group=' || f.ids else '' end
  end
  from g, f;
$function$;

revoke all on function public.care_log_link(text, text[], text[]) from public, anon, authenticated;
grant execute on function public.care_log_link(text, text[], text[]) to service_role;

-- ===========================================================================
-- 3. Weigh-in reminders (daily), with life-stage defaults
-- ===========================================================================

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
         and public.email_has_login(p.email)
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

-- The weekly "not weighed in over 30 days" line. It now covers only geckos
-- the daily job does not: added before the defaults started and with no
-- choice made on the record (a gecko switched off stays quiet here too).
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
    select g.created_by,
           count(*) as stale,
           array_agg(g.id order by lw.last_weighed, g.name) as ids
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
       and jsonb_typeof(p.extra_data->'care_reminders'->'weigh_in'->'geckos'->g.id) is distinct from 'object'
       and g.created_date < public.care_reminder_defaults_from()
       and public.email_has_login(g.created_by)
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
      public.care_log_link('weight', r.ids),
      jsonb_build_object('stale_count', r.stale, 'gecko_ids', to_jsonb(r.ids), 'source', 'cron'),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_weighin_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_weighin_reminders() to service_role;

-- ===========================================================================
-- 4. Feeding reminders (daily): groups as before, plus geckos on their own
-- ===========================================================================

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
      select rp.created_by,
             coalesce(nullif(trim(rp.name), ''), 'A reptile'),
             'reptile',
             rp.id::text,
             current_date - (rp.last_fed_date + greatest(coalesce(rp.feeding_interval_days, 7), 1)::int)
        from public.other_reptiles rp
       where rp.created_by is not null
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

-- ===========================================================================
-- 5. Hatch alerts: daily while an egg is due, one message per member
-- ===========================================================================

create or replace function public.enqueue_hatch_alerts()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_days_incubating integer;
  v_days_to_expected integer;
  v_body text;
begin
  for r in
    with eggs_open as (
      select e.id, e.created_by, e.lay_date, e.hatch_date_expected,
             -- Due: from 7 days before the expected hatch date to 14 days
             -- after it. A reminder a day then; a week apart otherwise.
             (e.hatch_date_expected is not null
              and current_date between e.hatch_date_expected - 7 and e.hatch_date_expected + 14) as daily
        from public.eggs e
        left join public.profiles p on p.email = e.created_by
       where e.status = 'Incubating'
         and coalesce(e.archived, false) = false
         and e.lay_date is not null
         and e.created_by is not null
         and (current_date - e.lay_date) >= coalesce(p.hatch_alert_days, 60)
         and current_date <= coalesce(e.hatch_date_expected + 30, e.lay_date + 150)
         and public.email_has_login(e.created_by)
    ),
    ready as (
      select o.*
        from eggs_open o
       where not exists (
         select 1 from public.notifications n
          where n.user_email = o.created_by
            and n.type = 'hatch_alert'
            and (n.metadata ->> 'egg_id' = o.id or coalesce(n.metadata -> 'egg_ids', '[]'::jsonb) ? o.id)
            and n.created_date > case when o.daily then current_date::timestamptz
                                      else now() - interval '7 days' end
       )
    )
    select x.created_by,
           array_agg(x.id order by x.hatch_date_expected nulls last, x.lay_date) as ids,
           count(*) as n,
           count(*) filter (where x.hatch_date_expected >= current_date) as due_ahead,
           count(*) filter (where x.hatch_date_expected < current_date) as past_date,
           min(x.hatch_date_expected - current_date) filter (where x.hatch_date_expected >= current_date) as soonest,
           (array_agg(x.lay_date order by x.hatch_date_expected nulls last, x.lay_date))[1] as lay_date,
           (array_agg(x.hatch_date_expected order by x.hatch_date_expected nulls last, x.lay_date))[1] as hatch_date_expected
      from ready x
     where not exists (
       -- One hatch reminder a member a day from this job.
       select 1 from public.notifications n
        where n.user_email = x.created_by
          and n.type = 'hatch_alert'
          and n.metadata ->> 'source' = 'cron'
          and coalesce(n.metadata ->> 'kind', '') <> 'status_check'
          and n.created_date >= current_date
     )
     group by x.created_by
  loop
    if r.n = 1 then
      v_days_incubating := current_date - r.lay_date;
      v_days_to_expected := case when r.hatch_date_expected is null then null
                                 else r.hatch_date_expected - current_date end;
      v_body := case
        when v_days_to_expected is not null and v_days_to_expected >= 0 then
          format('An egg in your incubator is due to hatch in %s day%s (incubating for %s days). Time to check on it.',
                 v_days_to_expected, case when v_days_to_expected = 1 then '' else 's' end, v_days_incubating)
        when v_days_to_expected is not null then
          format('An egg in your incubator is %s day%s past its expected hatch date. Check on it as soon as you can.',
                 abs(v_days_to_expected), case when abs(v_days_to_expected) = 1 then '' else 's' end)
        else
          format('An egg has been incubating for %s days, within the hatch window.', v_days_incubating)
      end;
    else
      v_body := format('%s eggs in your incubator are in their hatch window%s. Time to check on them.',
        r.n,
        case
          when r.due_ahead > 0 and r.past_date > 0 then
            format(': %s not yet at the expected date and %s past it', r.due_ahead, r.past_date)
          when r.due_ahead > 0 then
            format(', the next one due in %s day%s', r.soonest, case when r.soonest = 1 then '' else 's' end)
          when r.past_date > 0 then
            format(', %s past the expected date', r.past_date)
          else ''
        end);
    end if;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'hatch_alert', v_body, '/Breeding?tab=hatchery',
      jsonb_build_object(
        -- egg_id stays for the app's own hatch check, which reads it.
        'egg_id', r.ids[1],
        'egg_ids', to_jsonb(r.ids),
        'count', r.n,
        'lay_date', r.lay_date,
        'hatch_date_expected', r.hatch_date_expected,
        'days_incubating', current_date - r.lay_date,
        'source', 'cron'
      ),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;

  -- Past the hatch window: one status check per egg, ever.
  for r in
    select e.id, e.created_by, e.lay_date
      from public.eggs e
     where e.status = 'Incubating'
       and coalesce(e.archived, false) = false
       and e.lay_date is not null
       and e.created_by is not null
       and current_date > coalesce(e.hatch_date_expected + 30, e.lay_date + 150)
       and public.email_has_login(e.created_by)
       and not exists (
         select 1 from public.notifications n
          where n.user_email = e.created_by
            and n.type = 'hatch_alert'
            and n.metadata ->> 'egg_id' = e.id
            and n.metadata ->> 'kind' = 'status_check'
       )
  loop
    v_days_incubating := current_date - r.lay_date;
    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.created_by, 'hatch_alert',
      format('An egg laid %s is still marked incubating after %s days, past its hatch window. If it hatched or did not make it, update it on the Breeding page so your records stay accurate. This is the last reminder for this egg.',
             to_char(r.lay_date, 'FMMonth FMDD, YYYY'), v_days_incubating),
      '/Breeding?tab=hatchery',
      jsonb_build_object(
        'egg_id', r.id,
        'lay_date', r.lay_date,
        'days_incubating', v_days_incubating,
        'kind', 'status_check',
        'source', 'cron'
      ),
      false, r.created_by
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.enqueue_hatch_alerts() from public, anon, authenticated;
grant execute on function public.enqueue_hatch_alerts() to service_role;

-- ===========================================================================
-- 6. Vet follow-ups: unchanged except for the login check
-- ===========================================================================

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
       and public.email_has_login(v.created_by)
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

-- ===========================================================================
-- 7. Weekly digest: unchanged except for the login check
-- ===========================================================================

create or replace function public.enqueue_weekly_digest()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count integer := 0;
  v_uploads integer;
  v_posts integer;
  v_parts text[];
  v_content text;
  v_value record;
  v_week_ago numeric;
  v_matches integer;
  v_market text;
begin
  select count(*) into v_uploads
    from public.gecko_images
   where created_by is not null
     and created_date > now() - interval '7 days';
  select count(*) into v_posts
    from public.forum_posts
   where created_date > now() - interval '7 days';

  for r in
    select g.created_by as email,
           count(*) as geckos,
           coalesce(e.incubating, 0) as incubating,
           coalesce(e.due_soon, 0) as due_soon,
           coalesce(w.stale, 0) as stale
      from public.geckos g
      left join lateral (
        select count(*) filter (where eg.status = 'Incubating' and coalesce(eg.archived, false) = false) as incubating,
               count(*) filter (where eg.status = 'Incubating' and coalesce(eg.archived, false) = false
                                  and eg.hatch_date_expected between current_date and current_date + 7) as due_soon
          from public.eggs eg
         where eg.created_by = g.created_by
      ) e on true
      left join lateral (
        select count(*) as stale
          from public.geckos g2
          join lateral (
            select max(wr.record_date) as last_weighed
              from public.weight_records wr
             where wr.gecko_id = g2.id
          ) lw on true
         where g2.created_by = g.created_by
           and coalesce(g2.archived, false) = false
           and coalesce(g2.status, '') not in ('Sold')
           and lw.last_weighed is not null
           and lw.last_weighed < current_date - 30
      ) w on true
     where coalesce(g.archived, false) = false
       and g.created_by is not null
       and coalesce(g.status, '') not in ('Sold')
       and public.email_has_login(g.created_by)
       and not exists (
         select 1 from public.notifications n
          where n.user_email = g.created_by
            and n.type = 'weekly_digest'
            and n.created_date > now() - interval '6 days'
       )
     group by g.created_by, e.incubating, e.due_soon, w.stale
  loop
    v_parts := array[
      format('%s %s in your collection', r.geckos, case when r.geckos = 1 then 'crested gecko' else 'crested geckos' end)
    ];
    if r.incubating > 0 then
      v_parts := v_parts || format('%s %s incubating%s',
        r.incubating,
        case when r.incubating = 1 then 'egg' else 'eggs' end,
        case when r.due_soon > 0
             then format(' (%s due to hatch this week)', r.due_soon)
             else '' end);
    end if;
    if r.stale > 0 then
      v_parts := v_parts || format('%s not weighed in over 30 days', r.stale);
    end if;

    v_content := 'Your week on Geck Inspect: ' || array_to_string(v_parts, ', ') || '.';

    -- Market value of the member's crested geckos, and the change since a
    -- week ago when both days were valued.
    v_market := null;
    v_week_ago := null;
    select d.value, d.value_low, d.value_high, d.priced, d.day
      into v_value
      from public.market_value_daily d
     where d.user_email = lower(r.email)
     order by d.day desc
     limit 1;
    if v_value.priced is not null and v_value.priced > 0
       and v_value.day >= current_date - 2 then
      select p.value into v_week_ago
        from public.market_value_daily p
       where p.user_email = lower(r.email)
         and p.day <= v_value.day - 7
       order by p.day desc
       limit 1;
      v_market := format('Your crested geckos are worth about $%s to $%s at current asking prices',
        to_char(v_value.value_low, 'FM999,999'), to_char(v_value.value_high, 'FM999,999'));
      if v_week_ago is not null and v_week_ago > 0 and v_value.value <> v_week_ago then
        v_market := v_market || format(', %s %s%% from last week',
          case when v_value.value > v_week_ago then 'up' else 'down' end,
          round(abs(v_value.value - v_week_ago) / v_week_ago * 100, 1));
      end if;
      v_market := v_market || '.';
    end if;

    select count(*) into v_matches
      from geck_data.alert_matches m
      join geck_data.alerts a on a.id = m.alert_id
      join auth.users u on u.id = a.owner_id
     where lower(u.email) = lower(r.email)
       and m.matched_at > now() - interval '7 days';
    if v_matches > 0 then
      v_market := concat_ws(' ', v_market, format('%s %s matched your watchlist this week.',
        v_matches, case when v_matches = 1 then 'listing' else 'listings' end));
    end if;

    if v_market is not null then
      v_content := v_content || ' ' || v_market;
    end if;

    if v_uploads > 0 or v_posts > 0 then
      v_content := v_content || format(' The community added %s %s and %s %s this week.',
        v_uploads, case when v_uploads = 1 then 'photo' else 'photos' end,
        v_posts, case when v_posts = 1 then 'forum post' else 'forum posts' end);
    end if;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.email, 'weekly_digest', v_content, '/Dashboard',
      jsonb_build_object(
        'geckos', r.geckos, 'incubating', r.incubating, 'due_soon', r.due_soon,
        'stale_weighins', r.stale, 'community_uploads', v_uploads, 'community_posts', v_posts,
        'market_value', v_value.value, 'market_value_week_ago', v_week_ago,
        'watchlist_matches', v_matches,
        'source', 'cron'
      ),
      false, r.email
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

revoke all on function public.enqueue_weekly_digest() from public, anon, authenticated;
grant execute on function public.enqueue_weekly_digest() to service_role;
