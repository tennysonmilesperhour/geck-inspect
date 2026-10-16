-- The Today screen: what is due for the signed-in member.
-- Comprehensive review, Part E3, item 25 (October 2026 release).
--
-- Adds one read-only function, public.my_care_today(p_today date). It
-- changes no table, policy, cron job or existing function, so it is safe
-- to run more than once ("create or replace") and safe for the app that
-- is already open in members' browsers (that app never calls it). The new
-- app copes with the minutes before this file has run: the Today screen
-- says its list could not load and still shows the collection and the
-- Log button (src/lib/today.js, isTodayUnavailable).
--
-- What it returns, for the caller's own animals only (auth.email()):
--   {
--     "today": "2026-10-16",              the day used (see p_today below)
--     "feeding_reminders": true,          the member's Feeding Alerts switch
--     "weigh_in_reminders": true,         the member's weigh-in switch
--     "items": [ { kind, key, gecko_id, group_id, name, due, extra }, ... ]
--   }
-- with one item per thing that is due on or before seven days from
-- today, oldest first:
--   * feeding    a feeding group, or a gecko in no feeding group
--   * weigh_in   a gecko's weigh-in
--   * hatch      a clutch (eggs from one pairing laid on one day) whose
--                hatch window starts by then
--   * vet        a vet follow-up date
--   * task       a Season Planner task or plan due date
--   * pairing_window  a planned pairing whose season window is open
--
-- The rules are the reminder jobs' own (hatch differs slightly, see
-- below), so the screen and the reminders agree. Each part below names the job it copies, from the newest
-- definitions in 20261015151100_reminders_and_offline_logging.sql:
--   feeding   enqueue_feeding_reminders (groups and geckos on their own;
--             other reptiles are left out, that page is retired)
--   weigh_in  enqueue_personal_weighin_reminders and, for geckos added
--             before the defaults started, enqueue_weighin_reminders
--             (the weekly "not weighed in 30 days" line)
--   hatch     built on enqueue_hatch_alerts (eggs still incubating, up
--             to 30 days past the expected date or 150 days after laying),
--             but not identical: the job waits for the member's hatch
--             alert days since laying, while here a clutch with an
--             expected date shows from 7 days before that date, and one
--             without shows after the hatch alert days (clamped to 1 to
--             365). So a clutch can appear here a little before its alert.
--   vet       enqueue_vet_followups (from 3 days before today)
--   task      enqueue_season_planner_reminders, parts 3a, 3b and 3c
-- Three differences on purpose, because this is a list to work through
-- and not a message: overdue items stay on it (the jobs send late
-- feeding reminders only to members who asked for them), the next seven
-- days are included as "coming up", and the once-a-day limits and the
-- "can this address sign in" check do not apply (the caller is signed
-- in).
--
-- Why SECURITY DEFINER: the helpers it shares with the jobs
-- (care_reminder_defaults_from, weighin_interval_days) are granted to the
-- service role only. Every read below is limited to rows the caller
-- created (created_by = the caller's email, the app-wide ownership
-- rule), and another member's gecko is named only when it is public.
--
-- p_today is the member's own date from the phone, so "today" follows
-- their time zone. It is used only when it is within one day of the
-- server's date (time zones run from UTC-12 to UTC+14); anything else
-- falls back to the server's date.

create or replace function public.my_care_today(p_today date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_email text := nullif(auth.email(), '');
  v_today date;
  v_horizon date;
  v_defaults date;
  v_extra jsonb;
  v_feeding_on boolean;
  v_hatch_raw numeric;
  v_hatch_days integer;
  v_weigh_on boolean;
  v_items jsonb;
begin
  if v_email is null then
    raise exception 'Sign in to see what is due today' using errcode = '42501';
  end if;

  v_today := case when p_today between current_date - 1 and current_date + 1
                  then p_today else current_date end;
  v_horizon := v_today + 7;
  v_defaults := public.care_reminder_defaults_from();

  select p.extra_data, p.feeding_alerts_enabled, p.hatch_alert_days
    into v_extra, v_feeding_on, v_hatch_raw
    from public.profiles p
   where p.email = v_email
   order by p.created_date nulls last
   limit 1;
  v_extra := case when jsonb_typeof(v_extra) = 'object' then v_extra else '{}'::jsonb end;
  v_feeding_on := coalesce(v_feeding_on, true);
  -- hatch_alert_days is a numeric the member can set to anything (NaN, or
  -- a number too big for an integer). Clamp it before the cast, so an odd
  -- value gives a sensible window instead of an error that would empty
  -- the member's whole Today list. 365 days is past any clutch's hatch
  -- window, which is what the hatch job does with a huge value (it never
  -- alerts).
  v_hatch_days := case
    when v_hatch_raw is null or v_hatch_raw = 'NaN'::numeric then 60
    else greatest(1, least(365, round(v_hatch_raw)))::int
  end;
  v_weigh_on := coalesce(v_extra->'care_reminders'->'weigh_in'->>'enabled', 'true') <> 'false';

  with
  -- Feeding groups (enqueue_feeding_reminders, first branch).
  feed_groups as (
    select 'feeding'::text as kind,
           'group:' || fg.id::text as key,
           null::text as gecko_id,
           fg.id::text as group_id,
           coalesce(nullif(trim(fg.name), ''), nullif(trim(fg.label), ''), 'A feeding group') as name,
           fg.last_fed_date + greatest(coalesce(fg.interval_days, 3), 1)::int as due,
           jsonb_build_object(
             'last', fg.last_fed_date,
             'every_days', greatest(coalesce(fg.interval_days, 3), 1)::int,
             'geckos', (select count(*) from public.geckos g
                         where g.feeding_group_id = fg.id::text
                           and g.created_by = v_email
                           and coalesce(g.archived, false) = false
                           and coalesce(g.status, '') not in ('Sold'))
           ) as extra
      from public.feeding_groups fg
     where v_feeding_on
       and fg.created_by = v_email
       and coalesce(fg.feeding_reminder_enabled, true)
       and fg.last_fed_date is not null
  ),
  -- A gecko in no feeding group (enqueue_feeding_reminders, second
  -- branch): every 3 days (or the member's choice) from the last feeding
  -- it ate, or from the day it was added.
  feed_geckos as (
    select 'feeding'::text,
           'gecko:' || g.id,
           g.id,
           null::text,
           coalesce(nullif(trim(g.name), ''), 'A gecko'),
           coalesce(lf.last_fed, g.created_date::date) + st.every_days,
           jsonb_build_object('last', lf.last_fed, 'every_days', st.every_days)
      from public.geckos g
      cross join lateral (
        select case when jsonb_typeof(v_extra->'care_reminders'->'feeding'->'geckos'->g.id) = 'object'
                    then v_extra->'care_reminders'->'feeding'->'geckos'->g.id end as entry
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
     where v_feeding_on
       and g.created_by = v_email
       and coalesce(g.archived, false) = false
       and coalesce(g.status, '') not in ('Sold')
       and not exists (select 1 from public.feeding_groups fg2 where fg2.id::text = g.feeding_group_id)
       and coalesce(e.entry->>'on', '') <> 'false'
       and (e.entry->>'on' = 'true' or g.created_date >= v_defaults)
  ),
  -- Weigh-ins (enqueue_personal_weighin_reminders): a gecko added since
  -- the defaults started with no choice made, or one switched on. The
  -- cadence follows its life stage unless the member fixed one.
  weigh_chosen as (
    select g.id, g.name, g.created_date, g.hatch_date, g.weight_grams,
           case when jsonb_typeof(v_extra->'care_reminders'->'weigh_in'->'geckos'->g.id) = 'object'
                then v_extra->'care_reminders'->'weigh_in'->'geckos'->g.id end as entry
      from public.geckos g
     where v_weigh_on
       and g.created_by = v_email
       and coalesce(g.archived, false) = false
       and coalesce(g.status, '') not in ('Sold')
  ),
  weigh_due as (
    select 'weigh_in'::text,
           'gecko:' || c.id,
           c.id,
           null::text,
           coalesce(nullif(trim(c.name), ''), 'A gecko'),
           case
             when lw.last_weighed is not null then lw.last_weighed + iv.every_days
             when c.weight_grams is not null then coalesce(sv.since, c.created_date::date) + iv.every_days
             else coalesce(sv.since, c.created_date::date) + 1
           end,
           jsonb_build_object('last', lw.last_weighed, 'every_days', iv.every_days,
                              'grams', coalesce(lw.last_weight, c.weight_grams))
      from weigh_chosen c
      left join lateral (
        select w.record_date as last_weighed, w.weight_grams as last_weight
          from public.weight_records w
         where w.gecko_id = c.id
         order by w.record_date desc nulls last, w.created_date desc nulls last
         limit 1
      ) lw on true
      cross join lateral (
        select case when c.entry->>'since' ~ '^\d{4}-\d{2}-\d{2}$'
                     and pg_input_is_valid(c.entry->>'since', 'date')
                    then (c.entry->>'since')::date end as since
      ) sv
      cross join lateral (
        select case
                 when c.entry->>'fixed' = 'true' and c.entry->>'every_days' ~ '^\d{1,3}$'
                   then greatest(7, least(90, (c.entry->>'every_days')::int))
                 else public.weighin_interval_days(coalesce(lw.last_weight, c.weight_grams), c.hatch_date, v_today)
               end as every_days
      ) iv
     where (c.entry is null and c.created_date >= v_defaults)
        or c.entry->>'on' = 'true'
  ),
  -- Geckos added before the defaults started, with no choice made and a
  -- weigh-in on record (enqueue_weighin_reminders, the weekly line):
  -- due 30 days after the last weigh-in.
  weigh_stale as (
    select 'weigh_in'::text,
           'gecko:' || c.id,
           c.id,
           null::text,
           coalesce(nullif(trim(c.name), ''), 'A gecko'),
           lw.last_weighed + 30,
           jsonb_build_object('last', lw.last_weighed, 'every_days', 30, 'grams', c.weight_grams)
      from weigh_chosen c
      join lateral (
        select max(w.record_date) as last_weighed
          from public.weight_records w
         where w.gecko_id = c.id
      ) lw on true
     where c.entry is null
       and c.created_date < v_defaults
       and lw.last_weighed is not null
  ),
  -- Clutches in the incubator (enqueue_hatch_alerts): eggs still
  -- incubating, one item per pairing and lay day.
  clutches as (
    select e.breeding_plan_id,
           e.lay_date,
           count(*)::int as eggs,
           min(e.hatch_date_expected) as expected
      from public.eggs e
     where e.created_by = v_email
       and e.status = 'Incubating'
       and coalesce(e.archived, false) = false
       and e.lay_date is not null
     group by e.breeding_plan_id, e.lay_date
  ),
  hatch as (
    select 'hatch'::text,
           'clutch:' || coalesce(c.breeding_plan_id, 'none') || ':' || c.lay_date::text,
           null::text,
           null::text,
           coalesce(nullif(trim(bp.breeding_id), ''), ''),
           coalesce(c.expected - 7, c.lay_date + v_hatch_days),
           jsonb_build_object(
             'eggs', c.eggs,
             'lay_date', c.lay_date,
             'expected', c.expected,
             'plan_id', bp.id,
             'sire', case when s.created_by = v_email or coalesce(s.is_public, false) then nullif(trim(s.name), '') end,
             'dam', case when d.created_by = v_email or coalesce(d.is_public, false) then nullif(trim(d.name), '') end
           )
      from clutches c
      left join public.breeding_plans bp on bp.id = c.breeding_plan_id and bp.created_by = v_email
      left join public.geckos s on s.id = bp.sire_id
      left join public.geckos d on d.id = bp.dam_id
     where v_today <= coalesce(c.expected + 30, c.lay_date + 150)
  ),
  -- Vet follow-ups (enqueue_vet_followups).
  vet as (
    select 'vet'::text,
           'vet:' || v.id::text,
           v.animal_id,
           null::text,
           case when g.created_by = v_email or coalesce(g.is_public, false)
                then coalesce(nullif(trim(g.name), ''), 'Your gecko') else 'Your gecko' end,
           v.follow_up,
           jsonb_build_object('reason', nullif(trim(v.reason), ''), 'vet', nullif(trim(v.vet_name), ''), 'visit', v.date)
      from public.vet_records v
      join public.geckos g on g.id = v.animal_id
     where v.created_by = v_email
       and v.follow_up is not null
       and v.follow_up between v_today - 3 and v_horizon
       and coalesce(g.archived, false) = false
  ),
  -- Season Planner tasks (enqueue_season_planner_reminders, 3a).
  task as (
    select 'task'::text,
           'task:' || t.id,
           null::text,
           null::text,
           coalesce(nullif(trim(t.title), ''), 'A task'),
           d.due,
           jsonb_build_object('recurring', coalesce(t.is_recurring, false))
      from public.tasks t
      left join public.projects p on p.id = t.project_id
      cross join lateral (
        select (coalesce(case when t.is_recurring then t.next_due_date end, t.due_date) at time zone 'UTC')::date as due
      ) d
     where t.created_by = v_email
       and coalesce(t.is_completed, false) = false
       and d.due is not null
       and d.due between v_today - 3 and v_horizon
       and (p.id is null or coalesce(p.status, 'active') = 'active')
  ),
  -- Season Planner plans on their due date (3b).
  plan as (
    select 'task'::text,
           'project:' || p.id,
           null::text,
           null::text,
           coalesce(nullif(trim(p.name), ''), 'A plan'),
           p.due_date,
           jsonb_build_object('plan', true)
      from public.projects p
     where p.created_by = v_email
       and coalesce(p.status, 'active') = 'active'
       and p.due_date between v_today - 3 and v_horizon
  ),
  -- Planned pairings whose season window is open or opens this week (3c).
  pairing as (
    select 'pairing_window'::text,
           'future:' || f.id,
           null::text,
           null::text,
           initcap(coalesce(f.target_season, '')) || ' ' || coalesce(f.target_year::text, ''),
           w.starts,
           jsonb_build_object(
             'ends', w.ends,
             'sire', case when s.created_by = v_email or coalesce(s.is_public, false) then nullif(trim(s.name), '') end,
             'dam', case when d.created_by = v_email or coalesce(d.is_public, false) then nullif(trim(d.name), '') end
           )
      from public.future_breeding_plans f
      cross join lateral (
        select public.season_window_start(f.target_season, f.target_year) as starts,
               public.season_window_end(f.target_season, f.target_year) as ends
      ) w
      left join public.geckos s on s.id = f.sire_id
      left join public.geckos d on d.id = f.dam_id
     where f.created_by = v_email
       and f.started_breeding_plan_id is null
       and w.starts is not null
       and w.starts <= v_horizon
       and v_today <= coalesce(w.ends, w.starts)
  ),
  everything as (
    select * from feed_groups
    union all select * from feed_geckos
    union all select * from weigh_due
    union all select * from weigh_stale
    union all select * from hatch
    union all select * from vet
    union all select * from task
    union all select * from plan
    union all select * from pairing
  ),
  listed as (
    select x.*
      from everything x
     where x.due is not null
       and x.due <= v_horizon
     order by x.due, x.kind, x.name, x.key
     limit 500
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', l.kind,
           'key', l.key,
           'gecko_id', l.gecko_id,
           'group_id', l.group_id,
           'name', l.name,
           'due', l.due,
           'extra', l.extra
         ) order by l.due, l.kind, l.name, l.key), '[]'::jsonb)
    into v_items
    from listed l;

  return jsonb_build_object(
    'today', v_today,
    'feeding_reminders', v_feeding_on,
    'weigh_in_reminders', v_weigh_on,
    'items', v_items
  );
end;
$function$;

-- Signed-in members only. New functions get no API grants by default
-- (supabase/SCHEMA_CONVENTIONS.md, 4a), so say who may run it.
revoke all on function public.my_care_today(date) from public, anon, authenticated;
grant execute on function public.my_care_today(date) to authenticated, service_role;

comment on function public.my_care_today(date) is
  'The Today screen: what is due for the caller''s own animals (feedings, weigh-ins, hatch windows, vet follow-ups, Season Planner tasks and pairing windows), overdue and the next 7 days, by the reminder jobs'' rules. Read only. Migration 20261016090100_nav.sql.';
