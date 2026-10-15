-- Reminders that follow the animal, and offline logs saved once.
-- Comprehensive review, Part E2, items 15 and 19 (October 2026 release).
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
--    A gecko added on or after the day the defaults start gets reminders
--    without the member opening Settings, whichever way it was added
--    (Quick Add, the full form, a spreadsheet import, a hatchling, Morph
--    ID). That day is stored once in app_settings
--    'care_reminder_defaults_from', which the app reads too: 16 Oct 2026
--    (the app's fallback, CARE_DEFAULTS_FROM), or the day this file runs
--    if that is later (the Helpers section below says why):
--      * weigh-ins: every 14 days while growing (under 15 g or under 12
--        months, the care guide's hatchling and juvenile stages), every 21
--        days as a sub-adult (under 35 g or under 18 months) and every 30
--        days as an adult. The first one is the day after it is added when
--        it has no weight yet. The cadence follows the animal: when a
--        juvenile crosses 15 g the next date moves out by itself.
--      * feeding: every 3 days from its last feeding, for a gecko that is
--        not in a feeding group (geckos in a group keep the group's
--        schedule, as before).
--      * eggs: one hatch alert a day per member while any egg is within 7
--        days before to 14 days after its expected hatch date, and one
--        every 6 days otherwise. The alert names the egg due soonest (an
--        egg in that daily window first) and counts the rest ("3 eggs in
--        your incubator ..."), so a full incubator sends one email, not
--        one per egg. Each egg still gets its own row at least every 6
--        days, so the app's hatch check (last 7 days) sees every egg as
--        alerted, in older open tabs too; the rows that are not the day's
--        alert are marked quiet, already read, are not sent
--        (notify_dispatch_on_insert below) and are not listed in the app.
--    The member can still change or switch off each one: per gecko on its
--    record (profiles.extra_data.care_reminders.weigh_in.geckos.<id> and
--    .feeding.geckos.<id>, with "on": false), or for the whole account in
--    Settings. Geckos added before that day keep what they had: the
--    per-gecko switch and the weekly "not weighed in 30 days" line.
--
-- 3. One-tap log links (item 15). Weigh-in and feeding reminders link to
--    /log?type=weight|feeding&gecko=<ids>&group=<ids>, which opens a short
--    form for exactly those geckos, from the day after the defaults
--    start. Until then they keep the old pages: a tab opened before the
--    release has no /log page and would show "Page not found".
--    Hatch reminders open the hatchery tab.
--
-- 4. No reminders or digests for addresses that cannot sign in (item 15).
--    About 83 of 147 profiles were imported from the old platform and have
--    no login. In the 30 days to 15 Oct, 76 of 135 weekly digests and 12
--    of 31 weigh-in reminders went to them. Every reminder and digest job
--    below (task and season planner reminders included) now leaves those
--    addresses out, so no row is created at all (public.email_has_login,
--    migration 20261015140100).
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

-- The fallback day: the same as CARE_DEFAULTS_FROM in
-- src/lib/careReminders.js, which the app uses when it cannot read the
-- setting row below. A test (src/lib/__tests__/careReminders.test.js)
-- checks the two match. Used here when the setting row is missing or not
-- a real day.
create or replace function public.care_reminder_defaults_fallback()
returns date
language sql
immutable
set search_path to ''
as $function$
  select date '2026-10-16';
$function$;

-- The day the life-stage defaults start: geckos created on or after it
-- get reminders without a stored setting. Written once, when this file
-- first runs in production ("on conflict do nothing" keeps the first
-- value when the file runs again), as the later of:
--   * the fallback day above, 16 Oct 2026. A release before then starts
--     the defaults on that day.
--   * the day this file runs (UTC). A release that slips past 16 Oct
--     then does not start reminding geckos added before it, in tabs that
--     had no switch to turn the reminder off.
-- The row is public (is_public), and the gecko record and the phone app
-- read it (loadCareDefaultsFrom in src/lib/careReminders.js), so their
-- Feeding and Weigh-in switches show the same geckos as on that the
-- reminder jobs remind about. Until this file has run the app uses the
-- fallback day, and it reads the row again on the next page load.
insert into public.app_settings (key, value, is_public, description)
values (
  'care_reminder_defaults_from',
  to_jsonb(greatest((now() at time zone 'utc')::date,
                    public.care_reminder_defaults_fallback())::text),
  true,
  'Geckos added on or after this day (UTC) get weigh-in and feeding reminders by life stage without a stored choice, and reminders link to the one-tap log page from the next day. Written once by migration 20261015151100: 16 Oct 2026 (the fallback day) or the day the migration ran, whichever is later. The app reads it too, so the gecko record shows the same reminders the server sends.'
)
on conflict (key) do nothing;

create or replace function public.care_reminder_defaults_from()
returns date
language plpgsql
stable
set search_path to ''
as $function$
declare
  v_raw text;
begin
  select s.value #>> '{}' into v_raw
    from public.app_settings s
   where s.key = 'care_reminder_defaults_from';
  -- Only a well-formed day is used, so a bad hand edit cannot stop the
  -- reminder jobs.
  if v_raw ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(v_raw, 'date') then
    return v_raw::date;
  end if;
  return public.care_reminder_defaults_fallback();
end;
$function$;

revoke all on function public.care_reminder_defaults_fallback() from public, anon, authenticated;
grant execute on function public.care_reminder_defaults_fallback() to service_role;
revoke all on function public.care_reminder_defaults_from() from public, anon, authenticated;
grant execute on function public.care_reminder_defaults_from() to service_role;

-- True from the day after the defaults start. The one-tap log page (/log)
-- ships in the same release as this file, and members keep tabs open for
-- hours: a tab opened before the release has no /log page and shows "Page
-- not found" when a reminder is opened in it. So on release day (and on
-- 16 Oct too, for a release before it) the reminders keep linking to the
-- pages every version has, and from the next day to /log.
create or replace function public.care_log_links_live()
returns boolean
language sql
stable
set search_path to ''
as $function$
  select current_date > public.care_reminder_defaults_from();
$function$;

revoke all on function public.care_log_links_live() from public, anon, authenticated;
grant execute on function public.care_log_links_live() to service_role;

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

-- The one-tap log link for a reminder:
-- /log?type=<type>&gecko=<ids>&group=<ids>&more=<n>.
-- Only ids made of letters, digits, "_" and "-" (up to 64) go in, at most
-- 10 of each, so the link always passes public.safe_internal_link. A
-- gecko named twice counts once. When more than 10 geckos are due,
-- "more" is how many did not fit (digits only), so the /log page says so
-- instead of looking finished after the first 10. With no usable id it
-- falls back to the page that lists them, and so it does until the day
-- after the defaults start (care_log_links_live above): feedings open
-- Batch Husbandry, and a weigh-in for one gecko opens it in My Geckos, as
-- the reminders did before.
create or replace function public.care_log_link(
  p_type text,
  p_gecko_ids text[],
  p_group_ids text[] default null
)
returns text
language sql
stable
set search_path to ''
as $function$
  with gv as (
    -- Each usable gecko id once, where it first appears.
    select x, min(o) as o
      from unnest(coalesce(p_gecko_ids, '{}'::text[])) with ordinality as t(x, o)
     where x ~ '^[A-Za-z0-9_-]{1,64}$'
     group by x
  ),
  g as (
    select array_to_string((array_agg(x order by o))[1:10], ',') as ids,
           count(*) as n,
           (array_agg(x order by o))[1] as first_id
      from gv
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
    when not public.care_log_links_live() then
      case when p_type = 'feeding' then '/BatchHusbandry'
           when g.n = 1 and coalesce(f.ids, '') = '' then '/MyGeckos?gecko=' || g.first_id
           else '/MyGeckos' end
    else '/log?type=' || p_type
         || case when coalesce(g.ids, '') <> '' then '&gecko=' || g.ids else '' end
         || case when coalesce(f.ids, '') <> '' then '&group=' || f.ids else '' end
         || case when g.n > 10 then '&more=' || (g.n - 10)::text else '' end
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
-- 5. Hatch alerts: one a day per member while an egg is due, every 6 days
--    otherwise, and only the alert itself is sent
-- ===========================================================================
-- A member with 22 eggs from one clutch used to get 22 emails and 22
-- pushes in one go. Now each run sends a member at most one hatch alert:
-- the row for the egg due soonest, whose words count the others ("3 eggs
-- in your incubator are close to hatching. The first is due in 2 days.")
-- and whose metadata.egg_ids lists them all.
--
-- The other eggs still need their own rows. The app's hatch check
-- (src/components/breeding/HatchAlertSystem.jsx) decides "already
-- alerted" from the hatch alerts of the last 7 days: from this release
-- it reads metadata.egg_id and metadata.egg_ids, but a tab opened before
-- it reads only metadata.egg_id, from the 50 newest rows. An egg with no
-- row in that time looks unalerted to that tab, and it then writes its
-- own alert, which is pushed and emailed. (The member insert guard,
-- guard_notification_insert, only drops a repeat for the same egg within
-- 20 hours, so it does not stop that.) So every egg in its window gets a
-- row at least every 6 days. Those rows carry metadata.quiet = true and
-- is_read = true: the dispatcher below does not send them, they do not
-- add to the unread count, and the app's notification lists leave them
-- out (src/lib/notificationsApi.js).
--
-- When it sends:
--   * any egg within 7 days before to 14 days after its expected hatch
--     date: once a day;
--   * otherwise: when an egg has gone 6 days without a row, and then every
--     egg is refreshed together, so a member with clutches laid on
--     different days still gets one email every 6 days, not one per clutch.
-- Never twice in one day for the same member (a second run adds nothing).

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
         and public.email_has_login(e.created_by)
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
       and public.email_has_login(e.created_by)
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

-- The push and email dispatcher. Same body as
-- 20261008081305_account_erasure.sql plus one early return: a hatch alert
-- row marked quiet (written above for an egg that is counted in the day's
-- alert) is kept but never sent. Safe in any deploy order: no earlier code
-- writes the flag, and a member can only write hatch alerts to themselves
-- (guard_notification_insert), so the flag can only quiet their own rows.
create or replace function public.notify_dispatch_on_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_push_url  constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-push';
  v_email_url constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-email';
  v_key       text;
  v_title     text;
  v_body      text;
  v_link      text;
  v_payload   jsonb;
  v_headers   jsonb;
begin
  -- A hatch alert for an egg already counted in the day's grouped alert.
  if NEW.type = 'hatch_alert' and NEW.metadata ->> 'quiet' = 'true' then
    return NEW;
  end if;

  -- Pull the service-role key from Vault. If it's not configured,
  -- skip both channels cleanly so the notifications INSERT itself
  -- still succeeds.
  select decrypted_secret
    into v_key
    from vault.decrypted_secrets
   where name = 'notification_service_role_key'
   limit 1;

  if v_key is null or v_key = '' then
    return NEW;
  end if;

  v_title := case NEW.type
    when 'new_message'            then 'New message'
    when 'marketplace_inquiry'    then 'Marketplace inquiry'
    when 'hatch_alert'            then 'Hatch alert'
    when 'feeding_due'            then 'Feeding due'
    when 'weighin_reminder'       then 'Weigh-in reminder'
    when 'new_comment'            then 'New comment'
    when 'new_reply'              then 'New reply'
    when 'new_follower'           then 'New follower'
    when 'new_gecko_listing'      then 'New gecko listed'
    when 'new_breeding_plan'      then 'New breeding plan'
    when 'future_breeding_ready'  then 'Breeding window ready'
    when 'gecko_of_the_day'       then 'Gecko of the Day'
    when 'level_up'               then 'Level up!'
    when 'expert_status'          then 'Expert status update'
    when 'submission_approved'    then 'Submission approved'
    when 'submission_rejected'    then 'Photo not added to the Morph Guide'
    when 'announcement'           then 'Geck Inspect announcement'
    when 'role_change'            then 'Role updated'
    when 'referral_reward'        then 'Your referral paid off'
    when 'referral_grant_ended'   then 'Your free month of Keeper has ended'
    when 'weekly_digest'          then 'Your week on Geck Inspect'
    when 'waitlist_signup'        then 'New waitlist signup'
    when 'market_alert'           then 'Watchlist match'
    when 'market_brief'           then 'Your crested gecko market today'
    when 'vet_followup'           then 'Vet follow-up'
    when 'account_deletion_request' then 'Account deletion request'
    when 'task_reminder'          then 'Task reminder'
    when 'support_reply'          then 'Reply from Geck Inspect support'
    else 'Geck Inspect'
  end;
  v_body := coalesce(NEW.content, '');
  v_link := coalesce(NEW.link, '/');

  v_headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || v_key
  );

  v_payload := jsonb_build_object(
    'user_email', NEW.user_email,
    'type',       NEW.type,
    'title',      v_title,
    'body',       v_body,
    'url',        v_link,
    'tag',        NEW.type
  );

  begin
    perform net.http_post(url := v_push_url, headers := v_headers, body := v_payload);
  exception when others then
    raise warning 'notify_dispatch_on_insert: send-push pg_net call failed: %', sqlerrm;
  end;

  begin
    perform net.http_post(url := v_email_url, headers := v_headers, body := v_payload);
  exception when others then
    raise warning 'notify_dispatch_on_insert: send-email pg_net call failed: %', sqlerrm;
  end;

  return NEW;
end;
$function$;

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

-- ===========================================================================
-- 8. Task, plan and season planner reminders: unchanged except for the
--    login check
-- ===========================================================================
-- Same body as 20261003031932_season_planner_server_reminders.sql (the
-- live version on 15 Oct 2026) with public.email_has_login added to each
-- of the three lists, like every other reminder job above. A future
-- breeding plan for an address with no login stays unnotified, so it is
-- still announced if that person later makes an account while the window
-- is open.

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
         and public.email_has_login(t.created_by)
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
       and public.email_has_login(p.created_by)
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
       and public.email_has_login(f.created_by)
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
