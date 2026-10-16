-- The Today screen's list, public.my_care_today.
-- Regression checks for supabase/migrations/20261015232000_nav.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members, switches roles the way the API does
-- (request.jwt.claims plus SET ROLE) and rolls everything back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/nav_regressions.sql
--
-- Each block raises "FAIL: ..." when a rule is broken again. "PASS" lines
-- are printed as notices.
begin;

-- ---------------------------------------------------------------------------
-- 0. Who may call it: signed-in members, not signed-out visitors.
-- ---------------------------------------------------------------------------
do $grants$
begin
  if has_function_privilege('anon', 'public.my_care_today(date)', 'execute') then
    raise exception 'FAIL: signed-out visitors can call my_care_today';
  end if;
  if has_function_privilege('public', 'public.my_care_today(date)', 'execute') then
    raise exception 'FAIL: PUBLIC can call my_care_today';
  end if;
  if not has_function_privilege('authenticated', 'public.my_care_today(date)', 'execute') then
    raise exception 'FAIL: members cannot call my_care_today';
  end if;
  if (select provolatile from pg_proc where oid = 'public.my_care_today(date)'::regprocedure) <> 's' then
    raise exception 'FAIL: my_care_today is not marked stable (it must only read)';
  end if;
  raise notice 'PASS grants';
end
$grants$;

-- In production the defaults start on the stored day. Here they start 60
-- days ago, so geckos "added" a few days back count as new, the same way
-- supabase/tests/logging_regressions.sql does it. Rolled back with
-- everything else.
create or replace function public.care_reminder_defaults_from()
returns date language sql immutable set search_path to '' as $$ select current_date - 60 $$;

create temp table _t (k text primary key, v text not null) on commit drop;
grant all on _t to public;

-- Two members who can sign in, A and B.
do $setup$
declare
  v_a_id uuid := gen_random_uuid();
  v_b_id uuid := gen_random_uuid();
  s text := left(v_a_id::text, 8);
  v_a text := 'nav-a-' || s || '@example.com';
  v_b text := 'nav-b-' || s || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_a_id, 'authenticated', 'authenticated', v_a,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
         ('00000000-0000-0000-0000-000000000000', v_b_id, 'authenticated', 'authenticated', v_b,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_a) then
    insert into public.profiles (email) values (v_a);
  end if;
  if not exists (select 1 from public.profiles where email = v_b) then
    insert into public.profiles (email) values (v_b);
  end if;
  -- Late feeding reminders on, so the feeding job names overdue geckos
  -- too and its list can be compared with the Today list below.
  update public.profiles set membership_tier = 'breeder', feeding_late_reminders_enabled = true
   where email in (v_a, v_b);
  insert into _t values ('a', v_a), ('b', v_b), ('a_uid', v_a_id::text), ('b_uid', v_b_id::text), ('s', s);
end
$setup$;

-- A's collection, written as the superuser (row security does not apply).
do $data$
declare
  s text := (select v from _t where k = 's');
  v_a text := (select v from _t where k = 'a');
  v_b text := (select v from _t where k = 'b');
begin
  -- A feeding group fed 3 days ago, every 3 days: due today. One gecko in it.
  insert into public.feeding_groups (id, label, name, diet_type, interval_days, last_fed_date, created_by)
  values ('nav-grp-' || s, 'A', 'Rack A', 'CGD', 3, current_date - 3, v_a);
  insert into public.geckos (id, name, created_by, created_date, feeding_group_id, weight_grams)
  values ('nav-ingroup-' || s, 'Pebble', v_a, now() - interval '200 days', 'nav-grp-' || s, 40);

  -- Mango: added 10 days ago (after the defaults started), in no group.
  -- Last ate 4 days ago; refused yesterday, which does not count as fed.
  -- Due every 3 days, so a day overdue. Never weighed: weigh-in due the
  -- day after it was added.
  insert into public.geckos (id, name, created_by, created_date)
  values ('nav-mango-' || s, 'Mango', v_a, now() - interval '10 days');
  insert into public.feeding_records (animal_id, date, food_type, accepted, created_by)
  values ('nav-mango-' || s, current_date - 4, 'CGD', true, v_a),
         ('nav-mango-' || s, current_date - 1, 'CGD', false, v_a);

  -- Nimbus: added 10 days ago, weighed 5 days ago at 8 g (growing, every
  -- 14 days): weigh-in due in 9 days, past the 7-day horizon, so not
  -- listed. Fed today: next feeding in 3 days.
  insert into public.geckos (id, name, created_by, created_date, weight_grams)
  values ('nav-nimbus-' || s, 'Nimbus', v_a, now() - interval '10 days', 8);
  insert into public.weight_records (gecko_id, weight_grams, record_date, created_by)
  values ('nav-nimbus-' || s, 8, current_date - 5, v_a);
  insert into public.feeding_records (animal_id, date, food_type, accepted, created_by)
  values ('nav-nimbus-' || s, current_date, 'CGD', true, v_a);

  -- Old Harley: added before the defaults started, no choice made, last
  -- weighed 40 days ago: the weekly "not weighed in 30 days" line, so
  -- due 10 days ago. No feeding reminder of her own (added before).
  insert into public.geckos (id, name, created_by, created_date, weight_grams)
  values ('nav-harley-' || s, 'Harley', v_a, now() - interval '400 days', 45);
  insert into public.weight_records (gecko_id, weight_grams, record_date, created_by)
  values ('nav-harley-' || s, 45, current_date - 40, v_a);

  -- Switched off on its record: no feeding and no weigh-in.
  insert into public.geckos (id, name, created_by, created_date)
  values ('nav-off-' || s, 'Quiet', v_a, now() - interval '10 days');

  -- Sold and archived geckos never show.
  insert into public.geckos (id, name, created_by, created_date, status)
  values ('nav-sold-' || s, 'Gone', v_a, now() - interval '10 days', 'Sold');
  insert into public.geckos (id, name, created_by, created_date, archived)
  values ('nav-arch-' || s, 'Archived', v_a, now() - interval '10 days', true);

  update public.profiles
     set extra_data = jsonb_build_object('care_reminders', jsonb_build_object(
           'weigh_in', jsonb_build_object('geckos', jsonb_build_object('nav-off-' || s, jsonb_build_object('on', false))),
           'feeding', jsonb_build_object('geckos', jsonb_build_object('nav-off-' || s, jsonb_build_object('on', false)))))
   where email = v_a;

  -- A pairing with B's private gecko as the sire, and A's own dam. The
  -- clutch is due to hatch in 5 days, so its window opened 2 days ago.
  insert into public.geckos (id, name, created_by, created_date, is_public)
  values ('nav-bsire-' || s, 'SecretSire', v_b, now() - interval '400 days', false);
  insert into public.breeding_plans (id, sire_id, dam_id, breeding_id, created_by)
  values ('nav-plan-' || s, 'nav-bsire-' || s, 'nav-harley-' || s, 'Harley 2026', v_a);
  insert into public.eggs (breeding_plan_id, lay_date, hatch_date_expected, status, created_by)
  values ('nav-plan-' || s, current_date - 60, current_date + 5, 'Incubating', v_a),
         ('nav-plan-' || s, current_date - 60, current_date + 6, 'Incubating', v_a),
         ('nav-plan-' || s, current_date - 60, current_date - 1, 'Hatched', v_a);

  -- Vet follow-ups: one today, one ten days ago (too old).
  insert into public.vet_records (animal_id, date, reason, follow_up, created_by)
  values ('nav-mango-' || s, current_date - 14, 'Tail check', current_date, v_a),
         ('nav-mango-' || s, current_date - 30, 'Old visit', current_date - 10, v_a);

  -- Season Planner: a task due tomorrow, a finished one, and a plan due today.
  insert into public.projects (id, name, status, due_date, created_by)
  values ('nav-proj-' || s, 'Spring prep', 'active', current_date, v_a);
  insert into public.tasks (id, project_id, title, due_date, is_completed, created_by)
  values ('nav-task-' || s, 'nav-proj-' || s, 'Clean the tubs', (current_date + 1)::timestamptz, false, v_a),
         ('nav-done-' || s, 'nav-proj-' || s, 'Done already', current_date::timestamptz, true, v_a);

  -- B: a group due today and a gecko, which A must never see.
  insert into public.feeding_groups (id, label, name, diet_type, interval_days, last_fed_date, created_by)
  values ('nav-bgrp-' || s, 'B', 'B rack', 'CGD', 3, current_date - 3, v_b);
  insert into public.geckos (id, name, created_by, created_date)
  values ('nav-bgecko-' || s, 'BeesGecko', v_b, now() - interval '10 days');
end
$data$;

-- ---------------------------------------------------------------------------
-- 1. A's list, as A.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from _t where k = 'a_uid'), 'email', (select v from _t where k = 'a'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $list$
declare
  s text := (select v from _t where k = 's');
  v jsonb := public.my_care_today(current_date);
  v_items jsonb := v->'items';
  v_text text := v::text;
  v_has boolean;
  v_due date;
begin
  if (v->>'today')::date <> current_date then
    raise exception 'FAIL: today is %', v->>'today';
  end if;

  -- The group, due today, with its one gecko counted.
  select (i->>'due')::date into v_due from jsonb_array_elements(v_items) i
   where i->>'kind' = 'feeding' and i->>'group_id' = 'nav-grp-' || s;
  if v_due is distinct from current_date then raise exception 'FAIL: group due %', v_due; end if;
  if (select (i->'extra'->>'geckos')::int from jsonb_array_elements(v_items) i
       where i->>'group_id' = 'nav-grp-' || s) <> 1 then
    raise exception 'FAIL: the group does not count its gecko';
  end if;

  -- Mango: feeding due yesterday (a refusal is not a feeding).
  select (i->>'due')::date into v_due from jsonb_array_elements(v_items) i
   where i->>'kind' = 'feeding' and i->>'gecko_id' = 'nav-mango-' || s;
  if v_due is distinct from current_date - 1 then raise exception 'FAIL: Mango feeding due %', v_due; end if;
  -- ...and a weigh-in due the day after it was added.
  select (i->>'due')::date into v_due from jsonb_array_elements(v_items) i
   where i->>'kind' = 'weigh_in' and i->>'gecko_id' = 'nav-mango-' || s;
  if v_due is distinct from (now() - interval '10 days')::date + 1 then raise exception 'FAIL: Mango weigh-in due %', v_due; end if;

  -- Nimbus: fed today, so feeding in 3 days ("coming up"); weigh-in in 9
  -- days, past the horizon, so absent.
  select (i->>'due')::date into v_due from jsonb_array_elements(v_items) i
   where i->>'kind' = 'feeding' and i->>'gecko_id' = 'nav-nimbus-' || s;
  if v_due is distinct from current_date + 3 then raise exception 'FAIL: Nimbus feeding due %', v_due; end if;
  select exists (select 1 from jsonb_array_elements(v_items) i
                  where i->>'kind' = 'weigh_in' and i->>'gecko_id' = 'nav-nimbus-' || s) into v_has;
  if v_has then raise exception 'FAIL: Nimbus weigh-in listed 9 days early'; end if;

  -- Harley: the weekly 30-day line, 10 days overdue; no feeding of her own.
  select (i->>'due')::date into v_due from jsonb_array_elements(v_items) i
   where i->>'kind' = 'weigh_in' and i->>'gecko_id' = 'nav-harley-' || s;
  if v_due is distinct from current_date - 10 then raise exception 'FAIL: Harley weigh-in due %', v_due; end if;
  select exists (select 1 from jsonb_array_elements(v_items) i
                  where i->>'kind' = 'feeding' and i->>'gecko_id' = 'nav-harley-' || s) into v_has;
  if v_has then raise exception 'FAIL: a gecko added before the defaults got a feeding reminder'; end if;

  -- Switched off, sold and archived: absent.
  if v_text like '%nav-off-%' or v_text like '%nav-sold-%' or v_text like '%nav-arch-%' then
    raise exception 'FAIL: a switched-off, sold or archived gecko is listed: %', v_text;
  end if;
  -- The gecko in a group gets no feeding item of its own.
  select exists (select 1 from jsonb_array_elements(v_items) i
                  where i->>'kind' = 'feeding' and i->>'gecko_id' = 'nav-ingroup-' || s) into v_has;
  if v_has then raise exception 'FAIL: a gecko in a feeding group is listed on its own'; end if;

  -- The clutch: one item for two incubating eggs, window from 2 days ago.
  select (i->>'due')::date into v_due from jsonb_array_elements(v_items) i where i->>'kind' = 'hatch';
  if v_due is distinct from current_date - 2 then raise exception 'FAIL: clutch due %', v_due; end if;
  if (select (i->'extra'->>'eggs')::int from jsonb_array_elements(v_items) i where i->>'kind' = 'hatch') <> 2 then
    raise exception 'FAIL: the clutch should count 2 incubating eggs';
  end if;
  -- B's private sire is not named.
  if v_text like '%SecretSire%' then raise exception 'FAIL: another member''s private gecko is named'; end if;
  if (select i->'extra'->>'dam' from jsonb_array_elements(v_items) i where i->>'kind' = 'hatch') <> 'Harley' then
    raise exception 'FAIL: the member''s own dam is not named';
  end if;

  -- Vet: today's follow-up only.
  if (select count(*) from jsonb_array_elements(v_items) i where i->>'kind' = 'vet') <> 1 then
    raise exception 'FAIL: expected one vet follow-up: %', v_items;
  end if;

  -- Season Planner: the open task and the plan, not the finished task.
  if (select count(*) from jsonb_array_elements(v_items) i where i->>'kind' = 'task') <> 2 then
    raise exception 'FAIL: expected the task and the plan: %', v_items;
  end if;
  if v_text like '%Done already%' then raise exception 'FAIL: a finished task is listed'; end if;

  -- Nothing of B's.
  if v_text like '%nav-bgrp-%' or v_text like '%BeesGecko%' or v_text like '%B rack%' then
    raise exception 'FAIL: another member''s animals are listed';
  end if;

  -- Oldest first.
  if exists (
    select 1 from (
      select (i->>'due')::date as due, lag((i->>'due')::date) over (order by o) as prev
        from jsonb_array_elements(v_items) with ordinality as t(i, o)
    ) x where x.due < x.prev
  ) then
    raise exception 'FAIL: items are not oldest first';
  end if;

  -- A date from the phone more than a day away from the server's is not used.
  if (public.my_care_today(current_date + 5)->>'today')::date <> current_date then
    raise exception 'FAIL: a far-off phone date was used';
  end if;
  if (public.my_care_today(current_date + 1)->>'today')::date <> current_date + 1 then
    raise exception 'FAIL: a phone a day ahead (east of UTC) was not followed';
  end if;
  if (public.my_care_today(null)->>'today')::date <> current_date then
    raise exception 'FAIL: no phone date should mean the server''s date';
  end if;
  raise notice 'PASS member A list';
end
$list$;

-- Weigh-in reminders off for the whole account: no weigh-in items.
-- Feeding alerts off: no feeding items. (Written as A, through the
-- member's own profile, the way Settings saves them.)
do $switches$
declare
  v jsonb;
begin
  update public.profiles
     set extra_data = jsonb_set(coalesce(extra_data, '{}'::jsonb), '{care_reminders,weigh_in,enabled}', 'false'::jsonb, true),
         feeding_alerts_enabled = false
   where email = auth.email();
  v := public.my_care_today(current_date);
  if exists (select 1 from jsonb_array_elements(v->'items') i where i->>'kind' in ('weigh_in', 'feeding')) then
    raise exception 'FAIL: switched-off reminders still listed: %', v->'items';
  end if;
  if (v->>'weigh_in_reminders')::boolean or (v->>'feeding_reminders')::boolean then
    raise exception 'FAIL: the switches are not reported: %', v;
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'items') i where i->>'kind' = 'hatch') then
    raise exception 'FAIL: the switches hid the clutch too';
  end if;
  raise notice 'PASS account switches';
end
$switches$;

reset role;
select set_config('request.jwt.claims', '', true);

-- Put A's switches back for the comparison with the jobs.
update public.profiles
   set extra_data = extra_data #- '{care_reminders,weigh_in,enabled}', feeding_alerts_enabled = true
 where email = (select v from _t where k = 'a');

-- ---------------------------------------------------------------------------
-- 2. Same rules as the reminder jobs: what the jobs remind A about today
--    is exactly what Today lists as due (on or before today).
-- ---------------------------------------------------------------------------
do $parity$
declare
  v_a text := (select v from _t where k = 'a');
  v_today jsonb;
  v_job_feed text[];
  v_job_weigh text[];
  v_list_feed text[];
  v_list_weigh text[];
begin
  delete from public.notifications where user_email = v_a and type in ('feeding_due', 'weighin_reminder');
  perform public.enqueue_feeding_reminders();
  select array_agg(x order by x) into v_job_feed from (
    select jsonb_array_elements_text(n.metadata->'gecko_ids') as x from public.notifications n
     where n.user_email = v_a and n.type = 'feeding_due'
    union
    select jsonb_array_elements_text(n.metadata->'group_ids') from public.notifications n
     where n.user_email = v_a and n.type = 'feeding_due'
  ) j;

  -- The two weigh-in jobs hold each other back (one weigh-in message a
  -- day, one weekly line a week), so each runs on its own here and the
  -- geckos they name are put together.
  perform public.enqueue_personal_weighin_reminders();
  create temp table _job_weigh on commit drop as
    select jsonb_array_elements_text(n.metadata->'gecko_ids') as x from public.notifications n
     where n.user_email = v_a and n.type = 'weighin_reminder';
  delete from public.notifications where user_email = v_a and type = 'weighin_reminder';
  perform public.enqueue_weighin_reminders();
  insert into _job_weigh
    select jsonb_array_elements_text(n.metadata->'gecko_ids') from public.notifications n
     where n.user_email = v_a and n.type = 'weighin_reminder';
  select array_agg(distinct x order by x) into v_job_weigh from _job_weigh;

  perform set_config('request.jwt.claims',
    json_build_object('sub', (select v from _t where k = 'a_uid'), 'email', v_a, 'role', 'authenticated')::text, true);
  v_today := public.my_care_today(current_date);
  perform set_config('request.jwt.claims', '', true);

  select array_agg(coalesce(i->>'gecko_id', i->>'group_id') order by coalesce(i->>'gecko_id', i->>'group_id'))
    into v_list_feed
    from jsonb_array_elements(v_today->'items') i
   where i->>'kind' = 'feeding' and (i->>'due')::date <= current_date;
  select array_agg(i->>'gecko_id' order by i->>'gecko_id')
    into v_list_weigh
    from jsonb_array_elements(v_today->'items') i
   where i->>'kind' = 'weigh_in' and (i->>'due')::date <= current_date;

  if v_job_feed is distinct from v_list_feed then
    raise exception 'FAIL: feeding job named % but Today lists %', v_job_feed, v_list_feed;
  end if;
  if v_job_weigh is distinct from v_list_weigh then
    raise exception 'FAIL: weigh-in jobs named % but Today lists %', v_job_weigh, v_list_weigh;
  end if;
  if coalesce(array_length(v_list_feed, 1), 0) <> 2 or coalesce(array_length(v_list_weigh, 1), 0) <> 2 then
    raise exception 'FAIL: expected 2 feedings and 2 weigh-ins due, got % and %', v_list_feed, v_list_weigh;
  end if;
  raise notice 'PASS same list as the reminder jobs';
end
$parity$;

-- ---------------------------------------------------------------------------
-- 2b. An odd hatch window setting does not empty the list.
--     profiles.hatch_alert_days is a numeric the member can write, so it
--     can hold NaN, a negative number or one too big for an integer. The
--     function clamps it to 1..365 days instead of failing (a failure
--     would leave the member's whole Today screen empty).
-- ---------------------------------------------------------------------------
do $hatchdays$
declare
  s text := (select v from _t where k = 's');
  v_a text := (select v from _t where k = 'a');
  v_list jsonb;
  v_due date;
  v_case record;
begin
  -- A second clutch with no expected date, laid 70 days ago: its window
  -- opens hatch_alert_days after the lay day.
  insert into public.breeding_plans (id, sire_id, dam_id, breeding_id, created_by)
  values ('nav-plan2-' || s, 'nav-ingroup-' || s, 'nav-harley-' || s, 'Pebble x Harley', v_a);
  insert into public.eggs (breeding_plan_id, lay_date, hatch_date_expected, status, created_by)
  values ('nav-plan2-' || s, current_date - 70, null, 'Incubating', v_a);

  for v_case in
    select * from (values
      ('NaN'::numeric, current_date - 10),          -- unreadable: the 60-day default
      (5e9::numeric, null::date),                   -- huge: 365 days, past this week
      (-3::numeric, current_date - 69),             -- below 1: 1 day
      (61.6::numeric, current_date - 8)             -- a fraction: rounded to 62
    ) t(setting, due)
  loop
    update public.profiles set hatch_alert_days = v_case.setting where email = v_a;
    perform set_config('request.jwt.claims',
      json_build_object('sub', (select v from _t where k = 'a_uid'), 'email', v_a, 'role', 'authenticated')::text, true);
    v_list := public.my_care_today(current_date);
    perform set_config('request.jwt.claims', '', true);

    -- The rest of the list is still there.
    if not exists (select 1 from jsonb_array_elements(v_list->'items') i where i->>'kind' = 'feeding') then
      raise exception 'FAIL: hatch_alert_days % emptied the list: %', v_case.setting, v_list;
    end if;
    select (i->>'due')::date into v_due from jsonb_array_elements(v_list->'items') i
     where i->>'kind' = 'hatch' and i->>'key' like 'clutch:nav-plan2-%';
    if v_due is distinct from v_case.due then
      raise exception 'FAIL: hatch_alert_days % gave the undated clutch due %, expected %', v_case.setting, v_due, v_case.due;
    end if;
  end loop;
  update public.profiles set hatch_alert_days = null where email = v_a;
  raise notice 'PASS odd hatch window settings';
end
$hatchdays$;

-- ---------------------------------------------------------------------------
-- 3. Signed-out callers and calls with no email are refused.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $anon$
begin
  begin
    perform public.my_care_today(current_date);
    raise exception 'FAIL: a signed-out visitor got a list';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS signed-out visitors refused';
end
$anon$;
reset role;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
do $noemail$
begin
  begin
    perform public.my_care_today(current_date);
    raise exception 'FAIL: a token with no email got a list';
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS no email refused';
end
$noemail$;
reset role;
select set_config('request.jwt.claims', '', true);

rollback;
