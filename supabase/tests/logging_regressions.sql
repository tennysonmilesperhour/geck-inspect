-- Reminders that follow the animal, and offline logs saved once.
-- Regression checks for
-- supabase/migrations/20261015151100_reminders_and_offline_logging.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members, switches roles the way the API does
-- (request.jwt.claims plus SET ROLE) and rolls everything back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/logging_regressions.sql
--
-- Each block raises "FAIL: ..." when a rule is broken again. "PASS" lines
-- are printed as notices.
begin;

-- ---------------------------------------------------------------------------
-- 0. The day the defaults start is stored once in app_settings (public),
--    as the app's own day (CARE_DEFAULTS_FROM, 16 Oct 2026) or the day the
--    migration ran if that is later, so a release on or before 16 Oct
--    agrees with the gecko record's switches. A bad value falls back to
--    the app's day instead of stopping the reminder jobs.
-- ---------------------------------------------------------------------------
do $start$
declare
  v_raw text;
begin
  select value #>> '{}' into v_raw
    from public.app_settings
   where key = 'care_reminder_defaults_from' and is_public;
  if v_raw is null or v_raw !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'FAIL: the defaults day is not stored as a public setting: %', v_raw;
  end if;
  if public.care_reminder_defaults_from() <> v_raw::date then
    raise exception 'FAIL: care_reminder_defaults_from() = %, setting says %', public.care_reminder_defaults_from(), v_raw;
  end if;
  -- Never before the app's day: a gecko the app shows with its switches
  -- off must not be reminded. (A copy built today stores the later of
  -- today and 16 Oct.)
  if v_raw::date < public.care_reminder_defaults_fallback() then
    raise exception 'FAIL: the defaults start % before the app''s day %', v_raw, public.care_reminder_defaults_fallback();
  end if;
  if v_raw::date > greatest(current_date, public.care_reminder_defaults_fallback()) then
    raise exception 'FAIL: the defaults start % after the day the migration ran', v_raw;
  end if;

  -- The release day itself: the links keep the old pages.
  update public.app_settings set value = to_jsonb(current_date::text) where key = 'care_reminder_defaults_from';
  if public.care_log_links_live() then raise exception 'FAIL: /log links live on release day'; end if;
  if public.care_log_link('weight', array['g1']) <> '/MyGeckos?gecko=g1' then
    raise exception 'FAIL: release-day weigh-in link %', public.care_log_link('weight', array['g1']);
  end if;
  if public.care_log_link('weight', array['g1', 'g2']) <> '/MyGeckos' then
    raise exception 'FAIL: release-day link for two geckos %', public.care_log_link('weight', array['g1', 'g2']);
  end if;
  if public.care_log_link('feeding', array['g1'], array['grp-1']) <> '/BatchHusbandry' then
    raise exception 'FAIL: release-day feeding link %', public.care_log_link('feeding', array['g1'], array['grp-1']);
  end if;

  -- The next day: /log.
  update public.app_settings set value = to_jsonb((current_date - 1)::text) where key = 'care_reminder_defaults_from';
  if public.care_log_link('weight', array['g1']) <> '/log?type=weight&gecko=g1' then
    raise exception 'FAIL: next-day weigh-in link %', public.care_log_link('weight', array['g1']);
  end if;

  -- A hand edit that is not a real day does not break the jobs.
  update public.app_settings set value = '"2026-02-30"'::jsonb where key = 'care_reminder_defaults_from';
  if public.care_reminder_defaults_from() <> public.care_reminder_defaults_fallback() then
    raise exception 'FAIL: a bad setting was used: %', public.care_reminder_defaults_from();
  end if;
  update public.app_settings set value = to_jsonb(v_raw) where key = 'care_reminder_defaults_from';
  raise notice 'PASS defaults day and release-day links';
end
$start$;

-- In production the defaults start on the stored day. Here they start 60
-- days ago, so geckos "added" a few days back count as new without
-- waiting for the calendar. Rolled back with everything else.
create or replace function public.care_reminder_defaults_from()
returns date language sql immutable set search_path to '' as $$ select current_date - 60 $$;

create temp table _t (k text primary key, v text not null) on commit drop;
grant all on _t to public;

-- A member who can sign in (auth.users row) and a profile imported from
-- the old platform with no login.
do $setup$
declare
  v_id uuid := gen_random_uuid();
  v_a text := 'logging-a-' || left(v_id::text, 8) || '@example.com';
  v_l text := 'logging-legacy-' || left(v_id::text, 8) || '@example.com';
  s text := left(v_id::text, 8);
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_a,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_a) then
    insert into public.profiles (email) values (v_a);
  end if;
  insert into public.profiles (email) values (v_l);
  -- A breeder-sized collection: the test adds more than the Free plan's 10.
  update public.profiles set membership_tier = 'breeder' where email in (v_a, v_l);
  insert into _t values ('a', v_a), ('l', v_l), ('a_uid', v_id::text), ('s', s);
end
$setup$;

-- ---------------------------------------------------------------------------
-- 1. Life-stage cadence. The same cases are in
--    src/lib/__tests__/lifeStage.test.js, so the app and the job agree.
-- ---------------------------------------------------------------------------
do $cadence$
declare
  c record;
  v_got integer;
begin
  for c in
    select * from (values
      (null::numeric, null::date, 14),
      (2.5,  null, 14),
      (14.9, null, 14),
      (15,   null, 21),
      (34.9, null, 21),
      (35,   null, 30),
      (null, date '2026-01-01', 14),
      (null, date '2025-10-17', 14),
      (null, date '2025-10-16', 21),
      (null, date '2025-04-17', 21),
      (null, date '2025-04-16', 30),
      (40,   date '2026-03-01', 14),
      (10,   date '2020-01-01', 14),
      (25,   date '2020-01-01', 21),
      (50,   date '2024-01-01', 30)
    ) as t(weight, hatch, expected)
  loop
    v_got := public.weighin_interval_days(c.weight, c.hatch, date '2026-10-16');
    if v_got <> c.expected then
      raise exception 'FAIL: weighin_interval_days(%, %) = %, expected %', c.weight, c.hatch, v_got, c.expected;
    end if;
  end loop;
  raise notice 'PASS life-stage cadence';
end
$cadence$;

-- ---------------------------------------------------------------------------
-- 2. One-tap log links pass the notification link rule unchanged.
-- ---------------------------------------------------------------------------
do $links$
declare
  v text;
begin
  v := public.care_log_link('weight', array['abc', 'x y', 'g-1', '../evil', 'q"x']);
  if v <> '/log?type=weight&gecko=abc,g-1' then raise exception 'FAIL: unsafe ids kept: %', v; end if;
  if public.safe_internal_link(v) <> v then raise exception 'FAIL: link changed by safe_internal_link: %', v; end if;

  v := public.care_log_link('feeding', array['g1'], array['grp-1']);
  if v <> '/log?type=feeding&gecko=g1&group=grp-1' then raise exception 'FAIL: feeding link %', v; end if;
  if public.safe_internal_link(v) <> v then raise exception 'FAIL: feeding link changed by safe_internal_link'; end if;

  if public.care_log_link('feeding', null, null) <> '/BatchHusbandry' then raise exception 'FAIL: feeding fallback'; end if;
  if public.care_log_link('weight', array['bad id'], null) <> '/MyGeckos' then raise exception 'FAIL: weight fallback'; end if;
  if public.care_log_link('surprise', array['g1'], null) <> '/MyGeckos' then raise exception 'FAIL: unknown type'; end if;

  v := public.care_log_link('shed', array['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11','a12']);
  if v <> '/log?type=shed&gecko=a1,a2,a3,a4,a5,a6,a7,a8,a9,a10' then raise exception 'FAIL: more than 10 ids: %', v; end if;
  raise notice 'PASS log links';
end
$links$;

-- ---------------------------------------------------------------------------
-- 3. A retried care log is refused, not saved twice (as the member, under
--    row-level security, the way the app sends it).
-- ---------------------------------------------------------------------------
insert into public.geckos (id, name, created_by, created_date)
select 'lg-idem-' || (select v from _t where k = 's'), 'Mango', (select v from _t where k = 'a'), now() - interval '100 days';

select set_config('request.jwt.claims',
  json_build_object('sub', (select v from _t where k = 'a_uid'), 'email', (select v from _t where k = 'a'), 'role', 'authenticated')::text, true);
set local role authenticated;

do $idem$
declare
  v_g text := 'lg-idem-' || (select v from _t where k = 's');
  v_req uuid := gen_random_uuid();
  v_email text := auth.email();
  v_n integer;
begin
  -- weight_records
  insert into public.weight_records (gecko_id, weight_grams, record_date, created_by, client_request_id)
  values (v_g, 18.5, current_date, v_email, v_req);
  begin
    insert into public.weight_records (gecko_id, weight_grams, record_date, created_by, client_request_id)
    values (v_g, 18.5, current_date, v_email, v_req);
    raise exception 'FAIL: second weight with the same request id was saved';
  exception when unique_violation then
    null;
  end;
  select count(*) into v_n from public.weight_records where gecko_id = v_g;
  if v_n <> 1 then raise exception 'FAIL: % weight rows after a retry', v_n; end if;

  -- feeding_records
  v_req := gen_random_uuid();
  insert into public.feeding_records (animal_id, date, food_type, accepted, created_by, client_request_id)
  values (v_g, current_date, 'CGD', true, v_email, v_req);
  begin
    insert into public.feeding_records (animal_id, date, food_type, accepted, created_by, client_request_id)
    values (v_g, current_date, 'CGD', true, v_email, v_req);
    raise exception 'FAIL: second feeding with the same request id was saved';
  exception when unique_violation then
    null;
  end;

  -- shed_records
  v_req := gen_random_uuid();
  insert into public.shed_records (animal_id, date, quality, created_by, client_request_id)
  values (v_g, current_date, 'unknown', v_email, v_req);
  begin
    insert into public.shed_records (animal_id, date, quality, created_by, client_request_id)
    values (v_g, current_date, 'unknown', v_email, v_req);
    raise exception 'FAIL: second shed with the same request id was saved';
  exception when unique_violation then
    null;
  end;

  -- Logs without a request id (older app versions) still save as before.
  insert into public.feeding_records (animal_id, date, food_type, accepted, created_by)
  values (v_g, current_date - 1, 'CGD', true, v_email), (v_g, current_date - 2, 'CGD', true, v_email);
  select count(*) into v_n from public.feeding_records where animal_id = v_g;
  if v_n <> 3 then raise exception 'FAIL: expected 3 feeding rows, got %', v_n; end if;

  -- The member can read the saved row back by its request id, which is how
  -- the app recovers the record after a refused retry.
  select count(*) into v_n from public.shed_records where client_request_id = v_req;
  if v_n <> 1 then raise exception 'FAIL: saved shed not found by request id'; end if;
  raise notice 'PASS retried logs saved once';
end
$idem$;

reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 4. Who may run the new helpers and jobs: the server only.
-- ---------------------------------------------------------------------------
do $grants$
declare
  f text;
begin
  foreach f in array array[
    'public.care_reminder_defaults_from()',
    'public.care_reminder_defaults_fallback()',
    'public.care_log_links_live()',
    'public.weighin_interval_days(numeric, date, date)',
    'public.care_log_link(text, text[], text[])',
    'public.enqueue_personal_weighin_reminders()',
    'public.enqueue_weighin_reminders()',
    'public.enqueue_feeding_reminders()',
    'public.enqueue_hatch_alerts()',
    'public.enqueue_vet_followups()',
    'public.enqueue_weekly_digest()',
    'public.enqueue_season_planner_reminders()'
  ] loop
    if has_function_privilege('anon', f, 'execute') then raise exception 'FAIL: anon can run %', f; end if;
    if has_function_privilege('authenticated', f, 'execute') then raise exception 'FAIL: members can run %', f; end if;
    if not has_function_privilege('service_role', f, 'execute') then raise exception 'FAIL: service role cannot run %', f; end if;
  end loop;
  raise notice 'PASS grants';
end
$grants$;

-- ---------------------------------------------------------------------------
-- 5. The data the jobs read. CD = today.
-- ---------------------------------------------------------------------------
do $data$
declare
  a text := (select v from _t where k = 'a');
  l text := (select v from _t where k = 'l');
  s text := (select v from _t where k = 's');
begin
  -- Only these test rows are in play: older rows in the scratch copy
  -- would otherwise join the jobs.
  delete from public.notifications;

  insert into public.geckos (id, name, created_by, created_date, hatch_date, weight_grams, feeding_group_id, status) values
    -- weigh-ins (daily job)
    ('lg-w1-' || s, 'Alder',  a, now() - interval '2 days',   null, null, null, 'Pet'),   -- new, no weight: due CD-1
    ('lg-w2-' || s, 'Birch',  a, now() - interval '40 days',  null, null, null, 'Pet'),   -- 10 g at CD-15: 14 days, due CD-1
    ('lg-w3-' || s, 'Cedar',  a, now() - interval '40 days',  current_date - 1100, null, null, 'Pet'), -- 40 g adult: due CD+15
    ('lg-w4-' || s, 'Dogwood',a, now() - interval '2 days',   null, null, null, 'Pet'),   -- switched off
    ('lg-w5-' || s, 'Elm',    a, now() - interval '100 days', null, null, null, 'Pet'),   -- before the defaults, stale
    ('lg-w6-' || s, 'Fir',    a, now() - interval '100 days', null, null, null, 'Pet'),   -- before the defaults, stale, switched off
    ('lg-w7-' || s, 'Gum',    a, now() - interval '2 days',   null, null, null, 'Sold'),  -- sold
    ('lg-l1-' || s, 'Legacy', l, now() - interval '2 days',   null, null, null, 'Pet'),   -- no login
    ('lg-l2-' || s, 'Legacy old', l, now() - interval '100 days', null, null, null, 'Pet');

  insert into public.weight_records (gecko_id, weight_grams, record_date, created_by) values
    ('lg-w2-' || s, 10, current_date - 15, a),
    ('lg-w3-' || s, 40, current_date - 15, a),
    ('lg-w5-' || s, 30, current_date - 40, a),
    ('lg-w6-' || s, 30, current_date - 40, a),
    ('lg-l2-' || s, 30, current_date - 40, l);

  update public.profiles
     set extra_data = coalesce(extra_data, '{}'::jsonb) || jsonb_build_object('care_reminders', jsonb_build_object(
       'weigh_in', jsonb_build_object('geckos', jsonb_build_object(
         'lg-w4-' || s, jsonb_build_object('on', false),
         'lg-w6-' || s, jsonb_build_object('on', false))),
       'feeding', jsonb_build_object('geckos', jsonb_build_object(
         'lg-f2-' || s, jsonb_build_object('on', false)))))
   where email = a;

  -- feeding: a group due today, geckos on their own
  insert into public.feeding_groups (id, created_by, name, label, diet_type, interval_days, last_fed_date, feeding_reminder_enabled)
  values ('lg-fg1-' || s, a, 'Rack A', 'A', 'CGD', 3, current_date - 3, true);
  insert into public.geckos (id, name, created_by, created_date, feeding_group_id, status) values
    ('lg-f1-' || s, 'Hazel', a, now() - interval '3 days',  null, 'Pet'),               -- new, never fed: due CD
    ('lg-f2-' || s, 'Ivy',   a, now() - interval '3 days',  null, 'Pet'),               -- switched off
    ('lg-f3-' || s, 'Juniper', a, now() - interval '3 days', 'lg-fg1-' || s, 'Pet'),    -- in the group
    ('lg-f4-' || s, 'Kale',  a, now() - interval '10 days', null, 'Pet'),               -- ate CD-3: due CD
    ('lg-f5-' || s, 'Larch', a, now() - interval '10 days', null, 'Pet'),               -- ate CD-1: not due
    ('lg-f6-' || s, 'Maple', a, now() - interval '10 days', null, 'Pet'),               -- refused CD-1, ate CD-3: due CD
    ('lg-lf-' || s, 'Legacy fed', l, now() - interval '3 days', null, 'Pet');
  insert into public.feeding_records (animal_id, date, food_type, accepted, created_by) values
    ('lg-f4-' || s, current_date - 3, 'CGD', true, a),
    ('lg-f5-' || s, current_date - 1, 'CGD', true, a),
    ('lg-f6-' || s, current_date - 3, 'CGD', true, a),
    ('lg-f6-' || s, current_date - 1, 'CGD', false, a);

  -- eggs
  insert into public.eggs (id, breeding_plan_id, created_by, status, lay_date, hatch_date_expected) values
    ('lg-e1-' || s, 'plan', a, 'Incubating', current_date - 70, current_date + 3),   -- due: daily
    ('lg-e2-' || s, 'plan', a, 'Incubating', current_date - 61, current_date + 40),  -- in window: weekly
    ('lg-e3-' || s, 'plan', l, 'Incubating', current_date - 70, current_date + 3);   -- no login
end
$data$;

-- Only this test's members get anything from the jobs below.
create temp table _mine as select v as email from _t where k in ('a', 'l');

-- ---------------------------------------------------------------------------
-- 6. Weigh-ins: defaults, life stage, the switch, no login, once a day.
-- ---------------------------------------------------------------------------
do $weigh$
declare
  a text := (select v from _t where k = 'a');
  l text := (select v from _t where k = 'l');
  s text := (select v from _t where k = 's');
  n record;
  v_rows integer;
begin
  -- The feeding test geckos are new too, so they would be due for a first
  -- weigh-in; they are left out of this check.
  update public.geckos set archived = true where id like 'lg-f%' || s or id = 'lg-lf-' || s;
  perform public.enqueue_personal_weighin_reminders();
  select count(*) into v_rows from public.notifications where user_email = l;
  if v_rows <> 0 then raise exception 'FAIL: a weigh-in reminder was made for an address with no login'; end if;

  select * into n from public.notifications where user_email = a and type = 'weighin_reminder';
  if n is null then raise exception 'FAIL: no weigh-in reminder for a new gecko with no settings'; end if;
  if n.metadata->'gecko_ids' <> jsonb_build_array('lg-w1-' || s, 'lg-w2-' || s) then
    raise exception 'FAIL: wrong geckos due: %', n.metadata->'gecko_ids';
  end if;
  if n.link <> '/log?type=weight&gecko=lg-w1-' || s || ',lg-w2-' || s then
    raise exception 'FAIL: weigh-in link %', n.link;
  end if;

  -- Run again the same day: nothing new.
  perform public.enqueue_personal_weighin_reminders();
  select count(*) into v_rows from public.notifications where user_email = a and type = 'weighin_reminder';
  if v_rows <> 1 then raise exception 'FAIL: % weigh-in reminders after a second run', v_rows; end if;

  -- The member turns weigh-in reminders off for the account: nothing more.
  delete from public.notifications where user_email = a;
  update public.profiles
     set extra_data = jsonb_set(extra_data, '{care_reminders,weigh_in,enabled}', 'false'::jsonb)
   where email = a;
  perform public.enqueue_personal_weighin_reminders();
  select count(*) into v_rows from public.notifications where user_email = a;
  if v_rows <> 0 then raise exception 'FAIL: reminders sent after the account switch was turned off'; end if;
  update public.profiles
     set extra_data = jsonb_set(extra_data, '{care_reminders,weigh_in,enabled}', 'true'::jsonb)
   where email = a;

  -- A cadence the member picked overrides the life stage: Birch (10 g,
  -- weighed CD-15) on a fixed 21 days is not due yet.
  update public.profiles
     set extra_data = jsonb_set(extra_data, array['care_reminders','weigh_in','geckos','lg-w2-' || s],
                                jsonb_build_object('on', true, 'fixed', true, 'every_days', 21))
   where email = a;
  perform public.enqueue_personal_weighin_reminders();
  select * into n from public.notifications where user_email = a and type = 'weighin_reminder';
  if n.metadata->'gecko_ids' <> jsonb_build_array('lg-w1-' || s) then
    raise exception 'FAIL: fixed cadence ignored: %', n.metadata->'gecko_ids';
  end if;
  delete from public.notifications where user_email = a;

  -- Weekly 30-day line: only the gecko from before the defaults that the
  -- member did not switch off; nothing for the address with no login.
  perform public.enqueue_weighin_reminders();
  select count(*) into v_rows from public.notifications where user_email = l;
  if v_rows <> 0 then raise exception 'FAIL: weekly weigh-in line for an address with no login'; end if;
  select * into n from public.notifications where user_email = a and type = 'weighin_reminder';
  if n is null or n.metadata->'gecko_ids' <> jsonb_build_array('lg-w5-' || s) then
    raise exception 'FAIL: weekly line geckos %', n.metadata->'gecko_ids';
  end if;
  if n.link <> '/log?type=weight&gecko=lg-w5-' || s then raise exception 'FAIL: weekly link %', n.link; end if;
  delete from public.notifications where user_email in (a, l);
  raise notice 'PASS weigh-in reminders';
end
$weigh$;

-- ---------------------------------------------------------------------------
-- 7. Feeding: geckos on their own every 3 days, groups as before.
-- ---------------------------------------------------------------------------
do $feed$
declare
  a text := (select v from _t where k = 'a');
  l text := (select v from _t where k = 'l');
  s text := (select v from _t where k = 's');
  n record;
  v_rows integer;
  v_ids jsonb;
begin
  -- The weigh-in test geckos are not part of this check.
  update public.geckos set archived = true where id like 'lg-w%' || s or id like 'lg-l%' || s or id = 'lg-idem-' || s;
  update public.geckos set archived = false where id like 'lg-f%' || s or id = 'lg-lf-' || s;

  perform public.enqueue_feeding_reminders();
  select count(*) into v_rows from public.notifications where user_email = l;
  if v_rows <> 0 then raise exception 'FAIL: a feeding reminder was made for an address with no login'; end if;

  select * into n from public.notifications where user_email = a and type = 'feeding_due';
  if n is null then raise exception 'FAIL: no feeding reminder'; end if;
  select jsonb_agg(x order by x) into v_ids from jsonb_array_elements_text(n.metadata->'gecko_ids') x;
  if v_ids <> jsonb_build_array('lg-f1-' || s, 'lg-f4-' || s, 'lg-f6-' || s) then
    raise exception 'FAIL: wrong geckos due for feeding: %', n.metadata->'gecko_ids';
  end if;
  if n.metadata->'group_ids' <> jsonb_build_array('lg-fg1-' || s) then
    raise exception 'FAIL: group missing: %', n.metadata->'group_ids';
  end if;
  if n.link not like '/log?type=feeding&gecko=%&group=lg-fg1-' || s then raise exception 'FAIL: feeding link %', n.link; end if;
  if public.safe_internal_link(n.link) <> n.link then raise exception 'FAIL: feeding link not safe'; end if;

  -- Once a day.
  perform public.enqueue_feeding_reminders();
  select count(*) into v_rows from public.notifications where user_email = a and type = 'feeding_due';
  if v_rows <> 1 then raise exception 'FAIL: % feeding reminders after a second run', v_rows; end if;

  -- Feeding alerts off in Settings: nothing.
  delete from public.notifications where user_email = a;
  update public.profiles set feeding_alerts_enabled = false where email = a;
  perform public.enqueue_feeding_reminders();
  select count(*) into v_rows from public.notifications where user_email = a;
  if v_rows <> 0 then raise exception 'FAIL: feeding reminder with alerts off'; end if;
  update public.profiles set feeding_alerts_enabled = true where email = a;
  raise notice 'PASS feeding reminders';
end
$feed$;

-- ---------------------------------------------------------------------------
-- 8. Hatch alerts: at most one sent alert per member per run, naming the
--    egg due soonest and counting the rest. Every egg in its window still
--    has its own row (quiet, already read, not sent) within the last 7
--    days, so the app's hatch check (which reads metadata.egg_id only)
--    never adds an alert of its own for an egg the server covered.
-- ---------------------------------------------------------------------------

-- The dispatcher needs its Vault key to queue the push and email calls,
-- which is how "sent" is counted below.
do $vault$
begin
  if not exists (select 1 from vault.secrets where name = 'notification_service_role_key') then
    perform vault.create_secret('local-test-key', 'notification_service_role_key', 'test');
  end if;
end
$vault$;

-- Emails handed to send-email for one address since a queue position.
create function pg_temp.emails_sent(p_email text, p_after bigint) returns integer language sql as $$
  select count(*)::int from net.http_request_queue q
   where q.id > p_after
     and q.url like '%/functions/v1/send-email'
     and convert_from(q.body, 'UTF8')::jsonb ->> 'user_email' = p_email
$$;
create function pg_temp.queue_pos() returns bigint language sql as $$
  select coalesce(max(id), 0) from net.http_request_queue
$$;
-- Eggs of one member in their window with no hatch_alert row naming them
-- in the last 7 days: what the app would alert on its own.
create function pg_temp.uncovered(p_email text) returns integer language sql as $$
  select count(*)::int from public.eggs e
   where e.created_by = p_email and e.status = 'Incubating'
     and not exists (select 1 from public.notifications x
                      where x.user_email = p_email and x.type = 'hatch_alert'
                        and x.metadata->>'egg_id' = e.id
                        and x.created_date > now() - interval '7 days')
$$;
-- "One day later": every row moves a day into the past.
create function pg_temp.next_day(p_email text) returns void language sql as $$
  update public.notifications set created_date = created_date - interval '1 day' where user_email = p_email
$$;

do $hatch$
declare
  a text := (select v from _t where k = 'a');
  l text := (select v from _t where k = 'l');
  s text := (select v from _t where k = 's');
  n record;
  v_rows integer;
  v_ids jsonb;
  v_q bigint;
begin
  delete from public.notifications where user_email in (a, l);
  v_q := pg_temp.queue_pos();
  perform public.enqueue_hatch_alerts();
  select count(*) into v_rows from public.notifications where user_email = l;
  if v_rows <> 0 then raise exception 'FAIL: a hatch alert was made for an address with no login'; end if;

  -- One sent alert for the egg due soonest (e1, due in 3 days), naming
  -- both eggs, and a quiet row for e2.
  select * into n from public.notifications
   where user_email = a and type = 'hatch_alert' and coalesce(metadata->>'quiet', '') <> 'true';
  if n is null or n.metadata->>'egg_id' <> 'lg-e1-' || s
     or n.metadata->'egg_ids' <> jsonb_build_array('lg-e1-' || s, 'lg-e2-' || s)
     or n.is_read or n.metadata->>'cadence' <> 'daily' then
    raise exception 'FAIL: the day''s hatch alert %', to_jsonb(n);
  end if;
  if n.content not like '2 eggs in your incubator are close to hatching. The first is due in 3 days%' then
    raise exception 'FAIL: grouped hatch text %', n.content;
  end if;
  select * into n from public.notifications
   where user_email = a and type = 'hatch_alert' and metadata->>'quiet' = 'true';
  if n is null or n.metadata->>'egg_id' <> 'lg-e2-' || s or not n.is_read then
    raise exception 'FAIL: quiet row for the second egg %', to_jsonb(n);
  end if;
  for n in select * from public.notifications where user_email = a and type = 'hatch_alert' loop
    if n.link <> '/Breeding?tab=hatchery' then raise exception 'FAIL: hatch link %', n.link; end if;
    -- House style: no em dash (U+2014) or en dash (U+2013) in member copy.
    if strpos(n.content, chr(8212)) > 0 or strpos(n.content, chr(8211)) > 0 then
      raise exception 'FAIL: dash in hatch text';
    end if;
  end loop;
  -- Only the alert went out: one email (and one push), none for the quiet row.
  if pg_temp.emails_sent(a, v_q) <> 1 then
    raise exception 'FAIL: % hatch emails for one run', pg_temp.emails_sent(a, v_q);
  end if;
  if (select count(*) from net.http_request_queue q where q.id > v_q and q.url like '%/send-push') <> 1 then
    raise exception 'FAIL: quiet hatch row was pushed';
  end if;
  -- The app's check sees both eggs as alerted.
  if pg_temp.uncovered(a) <> 0 then raise exception 'FAIL: % eggs look unalerted to the app', pg_temp.uncovered(a); end if;

  -- A second run the same day adds nothing.
  perform public.enqueue_hatch_alerts();
  select count(*) into v_rows from public.notifications where user_email = a and type = 'hatch_alert';
  if v_rows <> 2 then raise exception 'FAIL: % hatch rows after a second run the same day', v_rows; end if;

  -- The next day: the alert again (e1 is due), and no new row for e2,
  -- whose row from yesterday still covers it.
  perform pg_temp.next_day(a);
  perform public.enqueue_hatch_alerts();
  select jsonb_agg(metadata->>'egg_id') into v_ids from public.notifications
   where user_email = a and type = 'hatch_alert' and created_date >= current_date;
  if v_ids is distinct from jsonb_build_array('lg-e1-' || s) then
    raise exception 'FAIL: next-day hatch rows %', v_ids;
  end if;

  -- Six days after e2's last row it gets a new quiet one, so the app never
  -- goes 7 days without seeing it.
  update public.notifications set created_date = created_date - interval '5 days' where user_email = a;
  perform public.enqueue_hatch_alerts();
  select jsonb_agg(metadata->>'egg_id' order by metadata->>'egg_id') into v_ids from public.notifications
   where user_email = a and type = 'hatch_alert' and created_date >= current_date;
  if v_ids is distinct from jsonb_build_array('lg-e1-' || s, 'lg-e2-' || s) then
    raise exception 'FAIL: six days on the job named %', v_ids;
  end if;
  if pg_temp.uncovered(a) <> 0 then raise exception 'FAIL: an egg went uncovered'; end if;
  raise notice 'PASS hatch alerts';
end
$hatch$;

-- A full incubator: 12 eggs due in 2 days, three runs a day apart. Three
-- emails, not 36, and every egg covered for the app each day.
do $flood$
declare
  a text := (select v from _t where k = 'a');
  s text := (select v from _t where k = 's');
  v_q bigint;
  v_day integer;
  v_sent integer;
begin
  delete from public.notifications where user_email = a;
  update public.eggs set status = 'Hatched' where created_by = a;
  insert into public.eggs (id, breeding_plan_id, created_by, status, lay_date, hatch_date_expected)
  select 'lg-f12-' || i || '-' || s, 'plan', a, 'Incubating', current_date - 68, current_date + 2
    from generate_series(1, 12) i;
  v_q := pg_temp.queue_pos();
  for v_day in 1 .. 3 loop
    perform public.enqueue_hatch_alerts();
    if pg_temp.uncovered(a) <> 0 then
      raise exception 'FAIL: day %: % eggs look unalerted to the app', v_day, pg_temp.uncovered(a);
    end if;
    perform pg_temp.next_day(a);
  end loop;
  v_sent := pg_temp.emails_sent(a, v_q);
  if v_sent <> 3 then raise exception 'FAIL: 12 eggs over 3 days sent % hatch emails, expected 3', v_sent; end if;
  if (select count(*) from public.notifications where user_email = a and type = 'hatch_alert'
        and coalesce(metadata->>'quiet', '') <> 'true') <> 3 then
    raise exception 'FAIL: expected 3 unread hatch alerts';
  end if;
  raise notice 'PASS a full incubator sends one hatch email a day';
end
$flood$;

-- The day's alert names an egg that is due, not one long overdue whose
-- expected date happens to be earliest, and its words fit that egg.
do $naming$
declare
  a text := (select v from _t where k = 'a');
  s text := (select v from _t where k = 's');
  n record;
begin
  delete from public.notifications where user_email = a;
  update public.eggs set status = 'Hatched' where created_by = a;
  insert into public.eggs (id, breeding_plan_id, created_by, status, lay_date, hatch_date_expected) values
    ('lg-nm-old-' || s, 'plan', a, 'Incubating', current_date - 80, current_date - 20),  -- 20 days overdue, not daily
    ('lg-nm-due-' || s, 'plan', a, 'Incubating', current_date - 62, current_date + 2);   -- due in 2 days: daily
  perform public.enqueue_hatch_alerts();
  select * into n from public.notifications
   where user_email = a and type = 'hatch_alert' and coalesce(metadata->>'quiet', '') <> 'true';
  if n is null or n.metadata->>'egg_id' <> 'lg-nm-due-' || s or n.metadata->>'cadence' <> 'daily' then
    raise exception 'FAIL: the daily alert named %', to_jsonb(n);
  end if;
  if n.content not like '2 eggs in your incubator are close to hatching. The first is due in 2 days%' then
    raise exception 'FAIL: daily alert text %', n.content;
  end if;
  if pg_temp.uncovered(a) <> 0 then raise exception 'FAIL: the overdue egg looks unalerted to the app'; end if;

  -- When the first egg is past its date, the words do not call it close.
  delete from public.notifications where user_email = a;
  update public.eggs set hatch_date_expected = current_date - 10 where id = 'lg-nm-old-' || s;
  perform public.enqueue_hatch_alerts();
  select * into n from public.notifications
   where user_email = a and type = 'hatch_alert' and coalesce(metadata->>'quiet', '') <> 'true';
  if n is null or n.metadata->>'egg_id' <> 'lg-nm-old-' || s
     or n.content not like '2 eggs in your incubator need a look. The first is 10 days past its expected hatch date.%' then
    raise exception 'FAIL: overdue alert %', to_jsonb(n);
  end if;
  update public.eggs set status = 'Hatched' where id in ('lg-nm-old-' || s, 'lg-nm-due-' || s);
  raise notice 'PASS the daily hatch alert names an egg that is due';
end
$naming$;

-- Eggs not yet due, from two clutches laid on different days: one email
-- every 6 days for both, not one per clutch.
do $weekly$
declare
  a text := (select v from _t where k = 'a');
  s text := (select v from _t where k = 's');
  v_q bigint;
  v_day integer;
  v_sent integer;
begin
  delete from public.notifications where user_email = a;
  update public.eggs set status = 'Hatched' where created_by = a;
  insert into public.eggs (id, breeding_plan_id, created_by, status, lay_date, hatch_date_expected) values
    ('lg-wk1-' || s, 'plan', a, 'Incubating', current_date - 64, current_date + 30),
    ('lg-wk2-' || s, 'plan', a, 'Incubating', current_date - 64, current_date + 30),
    ('lg-wk3-' || s, 'plan', a, 'Incubating', current_date - 61, current_date + 33);
  v_q := pg_temp.queue_pos();
  for v_day in 1 .. 12 loop
    perform public.enqueue_hatch_alerts();
    if pg_temp.uncovered(a) <> 0 then
      raise exception 'FAIL: weekly day %: an egg looks unalerted to the app', v_day;
    end if;
    perform pg_temp.next_day(a);
  end loop;
  v_sent := pg_temp.emails_sent(a, v_q);
  if v_sent <> 2 then raise exception 'FAIL: 12 days of eggs not yet due sent % emails, expected 2', v_sent; end if;
  raise notice 'PASS eggs not yet due share one email every 6 days';
end
$weekly$;

-- Past the window: one status check per egg, ever, and one email for all.
do $status$
declare
  a text := (select v from _t where k = 'a');
  s text := (select v from _t where k = 's');
  v_q bigint;
  n record;
begin
  delete from public.notifications where user_email = a;
  update public.eggs set status = 'Hatched' where created_by = a;
  insert into public.eggs (id, breeding_plan_id, created_by, status, lay_date, hatch_date_expected) values
    ('lg-old1-' || s, 'plan', a, 'Incubating', current_date - 140, current_date - 40),
    ('lg-old2-' || s, 'plan', a, 'Incubating', current_date - 139, current_date - 39),
    ('lg-old3-' || s, 'plan', a, 'Incubating', current_date - 170, null);
  v_q := pg_temp.queue_pos();
  perform public.enqueue_hatch_alerts();
  perform public.enqueue_hatch_alerts();
  if (select count(*) from public.notifications where user_email = a and metadata->>'kind' = 'status_check') <> 3 then
    raise exception 'FAIL: expected one status check per egg';
  end if;
  if pg_temp.emails_sent(a, v_q) <> 1 then
    raise exception 'FAIL: % status check emails, expected 1', pg_temp.emails_sent(a, v_q);
  end if;
  select * into n from public.notifications
   where user_email = a and metadata->>'kind' = 'status_check' and coalesce(metadata->>'quiet', '') <> 'true';
  if n.content not like '3 eggs are still marked incubating past their hatch window%' then
    raise exception 'FAIL: status check text %', n.content;
  end if;
  update public.eggs set status = 'Hatched' where created_by = a;
  raise notice 'PASS status checks';
end
$status$;

-- The member's own copy (what HatchAlertSystem.jsx would insert) for an
-- egg the server alerted today is dropped by the insert guard, so even a
-- stale tab cannot double a server alert. A quiet row counts too.
do $hatch_setup$
declare
  a text := (select v from _t where k = 'a');
begin
  delete from public.notifications where user_email = a;
  update public.eggs set status = 'Incubating' where id like 'lg-e%' and created_by = a;
  perform public.enqueue_hatch_alerts();
end
$hatch_setup$;
select set_config('request.jwt.claims',
  json_build_object('sub', (select v from _t where k = 'a_uid'), 'email', (select v from _t where k = 'a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $hatch_app$
declare
  a text := auth.email();
  s text := (select v from _t where k = 's');
  v_before integer;
  v_after integer;
begin
  select count(*) into v_before from public.notifications where user_email = a and type = 'hatch_alert';
  insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
  values (a, 'hatch_alert', 'An egg has been incubating for 61 days, within the hatch window.', '/Breeding',
          jsonb_build_object('egg_id', 'lg-e2-' || s), false, a);
  select count(*) into v_after from public.notifications where user_email = a and type = 'hatch_alert';
  if v_after <> v_before then raise exception 'FAIL: app hatch alert doubled a server alert'; end if;
  raise notice 'PASS app hatch alert does not double the server one';
end
$hatch_app$;
reset role;
select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- 9. Weekly digest: nothing for an address with no login.
-- ---------------------------------------------------------------------------
do $digest$
declare
  a text := (select v from _t where k = 'a');
  l text := (select v from _t where k = 'l');
  v_rows integer;
begin
  update public.geckos set archived = false where created_by in (a, l);
  perform public.enqueue_weekly_digest();
  select count(*) into v_rows from public.notifications where user_email = l and type = 'weekly_digest';
  if v_rows <> 0 then raise exception 'FAIL: weekly digest for an address with no login'; end if;
  select count(*) into v_rows from public.notifications where user_email = a and type = 'weekly_digest';
  if v_rows <> 1 then raise exception 'FAIL: member with a login got % digests', v_rows; end if;
  raise notice 'PASS weekly digest';
end
$digest$;

rollback;
