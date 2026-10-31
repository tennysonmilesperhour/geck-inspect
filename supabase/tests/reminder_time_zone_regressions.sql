-- Reminders at about 7 am in each member's own time zone.
-- Regression checks for
-- supabase/migrations/20261031010000_reminder_time_zones.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and animals and rolls everything back. It is
-- not meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/reminder_time_zone_regressions.sql
--
-- Each block raises "FAIL: ..." when a rule is broken. "PASS" lines are
-- printed as notices.
--
-- Covered:
--   0. The schedules call run_reminders_local, and only the service role
--      may run the new functions.
--   1. profiles.time_zone takes a real IANA name, stores a blank one as
--      empty, and refuses a name Postgres does not know.
--   2. Called by hand (no run in progress) a reminder function reminds
--      everyone, as before.
--   3. At 7 am in Seoul only the Seoul member is reminded, and "today" is
--      the Seoul day.
--   4. At 7 am in Los Angeles the member with no time zone saved (the
--      default) is reminded, and the Seoul and Chicago members are not.
--   5. An hour that is 7 am nowhere reminds nobody; the same hour twice
--      reminds once; the session time zone is unchanged afterwards; an
--      unknown job name is refused.
begin;

create temp table _t (k text primary key, v text not null) on commit drop;

-- ---------------------------------------------------------------------------
-- 0. Schedules and grants
-- ---------------------------------------------------------------------------
do $schedules$
declare
  v_job text;
  v_cmd text;
  v_fn text;
begin
  foreach v_job in array array['feeding-reminders-daily', 'personal-weighin-reminders-daily',
                               'season-planner-reminders-daily', 'vet-followups-daily', 'hatch-alerts-daily'] loop
    select j.command into v_cmd from cron.job j where j.jobname = v_job;
    if v_cmd is null then raise exception 'FAIL: no cron job %', v_job; end if;
    if v_cmd not like '%public.run_reminders_local(%' then
      raise exception 'FAIL: % runs %, expected run_reminders_local', v_job, v_cmd;
    end if;
    if (select j.schedule from cron.job j where j.jobname = v_job) not like '% * * * *' then
      raise exception 'FAIL: % is not hourly', v_job;
    end if;
  end loop;

  foreach v_fn in array array['public.run_reminders_local(text, timestamptz)', 'public.reminder_recipient_due(text)'] loop
    if has_function_privilege('anon', v_fn, 'execute') or has_function_privilege('authenticated', v_fn, 'execute') then
      raise exception 'FAIL: % is open to anon or authenticated', v_fn;
    end if;
    if not has_function_privilege('service_role', v_fn, 'execute') then
      raise exception 'FAIL: the service role cannot run %', v_fn;
    end if;
  end loop;
  raise notice 'PASS the five jobs run hourly through run_reminders_local, service role only';
end
$schedules$;

-- Three members who can sign in, each with a gecko whose vet follow-up is
-- today in their own time zone:
--   la   no time zone saved (the default, America/Los_Angeles)
--   seo  Asia/Seoul
--   chi  America/Chicago
do $setup$
declare
  s text := left(gen_random_uuid()::text, 8);
  who text;
  v_email text;
  v_zone text;
begin
  foreach who in array array['la', 'seo', 'chi'] loop
    v_email := 'tz-' || who || '-' || s || '@example.com';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email,
            'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
            '{}'::jsonb, now(), now());
    if not exists (select 1 from public.profiles where email = v_email) then
      insert into public.profiles (email) values (v_email);
    end if;
    v_zone := case who when 'seo' then 'Asia/Seoul' when 'chi' then 'America/Chicago' end;
    update public.profiles set time_zone = v_zone where email = v_email;
    insert into _t values (who, v_email);

    insert into public.geckos (id, name, created_by, status)
    values ('tz-g-' || who || '-' || s, 'Nimbus ' || who, v_email, 'Pet');
    insert into public.vet_records (animal_id, date, follow_up, reason, created_by)
    values ('tz-g-' || who || '-' || s,
            (now() at time zone coalesce(v_zone, 'America/Los_Angeles'))::date - 10,
            (now() at time zone coalesce(v_zone, 'America/Los_Angeles'))::date,
            'a check-up', v_email);
  end loop;
  insert into _t values ('s', s);
end
$setup$;

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
do $column$
declare
  v_email text := (select v from _t where k = 'chi');
  v_failed boolean := false;
begin
  if (select time_zone from public.profiles where email = (select v from _t where k = 'seo')) <> 'Asia/Seoul' then
    raise exception 'FAIL: Asia/Seoul was not stored';
  end if;

  update public.profiles set time_zone = '   ' where email = v_email;
  if (select time_zone from public.profiles where email = v_email) is not null then
    raise exception 'FAIL: a blank time zone was stored as text';
  end if;

  begin
    update public.profiles set time_zone = 'Mars/Olympus_Mons' where email = v_email;
  exception when sqlstate '22023' then
    v_failed := true;
  end;
  if not v_failed then raise exception 'FAIL: an unknown time zone was accepted'; end if;

  update public.profiles set time_zone = 'America/Chicago' where email = v_email;
  -- Saving the row again without changing the zone is fine.
  update public.profiles set full_name = 'Chicago keeper' where email = v_email;
  raise notice 'PASS time_zone takes IANA names, empties blanks and refuses unknown names';
end
$column$;

-- ---------------------------------------------------------------------------
-- 2. By hand: everyone, as before
-- ---------------------------------------------------------------------------
savepoint by_hand;
do $by_hand$
declare
  v_n integer;
begin
  perform public.enqueue_vet_followups();
  -- On the UTC day some members' "today" may be tomorrow or yesterday, so
  -- only check that the job still reaches past one zone with no run set.
  select count(*) into v_n
    from public.notifications n
   where n.type = 'vet_followup'
     and n.user_email in (select v from _t where k in ('la', 'seo', 'chi'));
  if v_n < 2 then
    raise exception 'FAIL: called by hand the vet job reminded % of 3 members, expected everyone due on the UTC day', v_n;
  end if;
  raise notice 'PASS called by hand, the reminder jobs still cover every member';
end
$by_hand$;
rollback to savepoint by_hand;

-- ---------------------------------------------------------------------------
-- 3. 7 am in Seoul
-- ---------------------------------------------------------------------------
do $seoul$
declare
  v_at timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul') + interval '7 hours 10 minutes') at time zone 'Asia/Seoul';
  v_tz_before text := current_setting('timezone');
  v_made integer;
  v_content text;
begin
  v_made := public.run_reminders_local('vet', v_at);

  if exists (select 1 from public.notifications n where n.type = 'vet_followup'
              and n.user_email in (select v from _t where k in ('la', 'chi'))) then
    raise exception 'FAIL: the Seoul run reminded a member in another time zone';
  end if;
  select n.content into v_content from public.notifications n
   where n.type = 'vet_followup' and n.user_email = (select v from _t where k = 'seo');
  if v_content is null then
    raise exception 'FAIL: the Seoul member was not reminded at 7 am Seoul time';
  end if;
  -- The follow-up is the Seoul day, so "is due today" shows the run used it.
  if v_content not like '%is due today%' then
    raise exception 'FAIL: the Seoul run did not use the Seoul day: %', v_content;
  end if;
  if current_setting('timezone') <> v_tz_before then
    raise exception 'FAIL: the session time zone is % after the run, was %', current_setting('timezone'), v_tz_before;
  end if;
  if coalesce(current_setting('geck.reminder_zone', true), '') <> '' then
    raise exception 'FAIL: geck.reminder_zone is still set after the run';
  end if;

  -- The same hour again adds nothing.
  perform public.run_reminders_local('vet', v_at);
  if (select count(*) from public.notifications n where n.type = 'vet_followup'
       and n.user_email = (select v from _t where k = 'seo')) <> 1 then
    raise exception 'FAIL: a second run in the same hour reminded the Seoul member again';
  end if;
  raise notice 'PASS at 7 am in Seoul only the Seoul member is reminded, on the Seoul day (% made)', v_made;
end
$seoul$;

-- ---------------------------------------------------------------------------
-- 4. 7 am in Los Angeles: the default zone
-- ---------------------------------------------------------------------------
do $los_angeles$
declare
  v_at timestamptz := (date_trunc('day', now() at time zone 'America/Los_Angeles') + interval '7 hours 10 minutes') at time zone 'America/Los_Angeles';
begin
  perform public.run_reminders_local('vet', v_at);
  if not exists (select 1 from public.notifications n where n.type = 'vet_followup'
                  and n.user_email = (select v from _t where k = 'la')
                  and n.content like '%is due today%') then
    raise exception 'FAIL: the member with no time zone was not reminded at 7 am Pacific';
  end if;
  if exists (select 1 from public.notifications n where n.type = 'vet_followup'
              and n.user_email = (select v from _t where k = 'chi')) then
    raise exception 'FAIL: the Los Angeles run reminded the Chicago member';
  end if;
  raise notice 'PASS a member with no time zone keeps 7 am Pacific';
end
$los_angeles$;

-- ---------------------------------------------------------------------------
-- 5. Nobody at the wrong hour; an unknown job is refused
-- ---------------------------------------------------------------------------
do $edges$
declare
  -- 3 am in Chicago is not 7 am in Chicago, Seoul or Los Angeles.
  v_at timestamptz := (date_trunc('day', now() at time zone 'America/Chicago') + interval '3 hours') at time zone 'America/Chicago';
  v_refused boolean := false;
begin
  -- Other members in this copy may use other zones; only ours matter.
  perform public.run_reminders_local('vet', v_at);
  if exists (select 1 from public.notifications n where n.type = 'vet_followup'
              and n.user_email = (select v from _t where k = 'chi')) then
    raise exception 'FAIL: the Chicago member was reminded at 3 am Chicago time';
  end if;

  v_at := (date_trunc('day', now() at time zone 'America/Chicago') + interval '7 hours 25 minutes') at time zone 'America/Chicago';
  perform public.run_reminders_local('vet', v_at);
  if not exists (select 1 from public.notifications n where n.type = 'vet_followup'
                  and n.user_email = (select v from _t where k = 'chi')) then
    raise exception 'FAIL: the Chicago member was not reminded at 7 am Chicago time';
  end if;

  begin
    perform public.run_reminders_local('nonsense', now());
  exception when sqlstate '22023' then
    v_refused := true;
  end;
  if not v_refused then raise exception 'FAIL: an unknown job name was accepted'; end if;
  raise notice 'PASS the wrong hour reminds nobody, 7 am Chicago reminds Chicago, unknown jobs are refused';
end
$edges$;

-- Every job runs end to end in a zone's hour (no error from any of the five).
do $all_jobs$
declare
  v_at timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul') + interval '7 hours') at time zone 'Asia/Seoul';
  v_job text;
begin
  foreach v_job in array array['feeding', 'weigh_in', 'hatch', 'vet', 'planner'] loop
    perform public.run_reminders_local(v_job, v_at);
  end loop;
  raise notice 'PASS all five reminder jobs run through run_reminders_local';
end
$all_jobs$;

rollback;
