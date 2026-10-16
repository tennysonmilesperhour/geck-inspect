-- Other Reptiles feeding reminders follow one switch.
-- Regression checks for
-- supabase/migrations/20261016090700_reptile_reminders_switch.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and animals and rolls everything back. It is
-- not meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/reptile_reminders_regressions.sql
--
-- It reads the migration a second time with \ir (path relative to this
-- file), to show running it again is harmless and keeps a value already
-- set. Each block raises "FAIL: ..." when a rule is broken. "PASS" lines
-- are printed as notices.
--
-- Covered:
--   0. The switch is stored, off and public.
--   1. Off: a member whose only due animal is a reptile gets nothing; a
--      member with geckos gets exactly the gecko reminder they got before;
--      a member with both gets the geckos only.
--   2. A missing row counts as off.
--   3. On: the reptile is reminded again (once a day), with the link and
--      words it had before.
--   4. The migration run again keeps a value already set to true, and the
--      job keeps its owner, security definer, search_path and grants.
begin;

-- ---------------------------------------------------------------------------
-- 0. The switch: off, public, one row.
-- ---------------------------------------------------------------------------
do $switch$
declare
  s record;
begin
  select * into s from public.app_settings where key = 'other_reptile_reminders_enabled';
  if s is null then raise exception 'FAIL: no other_reptile_reminders_enabled setting'; end if;
  if s.value <> 'false'::jsonb then raise exception 'FAIL: the switch is %, expected false', s.value; end if;
  if not s.is_public then raise exception 'FAIL: the switch is not public, so the app cannot read it'; end if;
  raise notice 'PASS the switch is stored, off and public';
end
$switch$;

create temp table _t (k text primary key, v text not null) on commit drop;

-- Three members who can sign in (auth.users rows):
--   g  geckos only: a feeding group due today and a gecko on its own
--   m  the same geckos plus a reptile due today
--   r  a reptile due today and nothing else
do $setup$
declare
  s text := left(gen_random_uuid()::text, 8);
  who text;
  v_email text;
begin
  foreach who in array array['g', 'm', 'r'] loop
    v_email := 'reptile-' || who || '-' || s || '@example.com';
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', v_email,
            'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
            '{}'::jsonb, now(), now());
    if not exists (select 1 from public.profiles where email = v_email) then
      insert into public.profiles (email) values (v_email);
    end if;
    insert into _t values (who, v_email);
  end loop;
  insert into _t values ('s', s);

  foreach who in array array['g', 'm'] loop
    v_email := (select v from _t where k = who);
    -- A group fed 3 days ago on a 3 day interval: due today.
    insert into public.feeding_groups (id, created_by, name, label, diet_type, interval_days, last_fed_date, feeding_reminder_enabled)
    values ('rr-fg-' || who || '-' || s, v_email, 'Rack A', 'A', 'CGD', 3, current_date - 3, true);
    -- A crested gecko in no group, switched on by the member, that last
    -- ate 3 days ago: due today on the default 3 days.
    insert into public.geckos (id, name, created_by, created_date, feeding_group_id, status)
    values ('rr-g-' || who || '-' || s, 'Nimbus', v_email, now() - interval '10 days', null, 'Pet');
    insert into public.feeding_records (animal_id, date, food_type, accepted, created_by)
    values ('rr-g-' || who || '-' || s, current_date - 3, 'CGD', true, v_email);
    update public.profiles
       set extra_data = coalesce(extra_data, '{}'::jsonb) || jsonb_build_object('care_reminders', jsonb_build_object(
         'feeding', jsonb_build_object('geckos', jsonb_build_object(
           'rr-g-' || who || '-' || s, jsonb_build_object('on', true)))))
     where email = v_email;
  end loop;

  -- A reptile fed 7 days ago on a 7 day interval, reminders on: due today.
  foreach who in array array['m', 'r'] loop
    insert into public.other_reptiles (id, name, species, created_by, feeding_reminder_enabled, feeding_interval_days, last_fed_date)
    values ('rr-rp-' || who || '-' || s, 'Basil', 'Gargoyle gecko', (select v from _t where k = who), true, 7, current_date - 7);
  end loop;
end
$setup$;

-- The reminders this test's members have, as one row each.
create temp view _mine as
select t.k, n.content, n.link, n.metadata
  from _t t
  join public.notifications n on n.user_email = t.v and n.type = 'feeding_due'
 where t.k in ('g', 'm', 'r');

-- ---------------------------------------------------------------------------
-- 1. Off: no reptile reminders, gecko reminders as before.
-- ---------------------------------------------------------------------------
do $off$
declare
  s text := (select v from _t where k = 's');
  n record;
  v_rows integer;
  v_link_g text;
  v_link_m text;
begin
  perform public.enqueue_feeding_reminders();

  select count(*) into v_rows from _mine where k = 'r';
  if v_rows <> 0 then raise exception 'FAIL: a reptile was reminded with the switch off'; end if;

  v_link_g := public.care_log_link('feeding', array['rr-g-g-' || s], array['rr-fg-g-' || s]);
  select * into n from _mine where k = 'g';
  if n is null then raise exception 'FAIL: no gecko reminder with the switch off'; end if;
  if n.content <> 'Nimbus and Rack A are due for feeding today.' then raise exception 'FAIL: gecko reminder words %', n.content; end if;
  if n.link <> v_link_g then raise exception 'FAIL: gecko reminder link %, expected %', n.link, v_link_g; end if;
  if n.metadata->'gecko_ids' <> jsonb_build_array('rr-g-g-' || s)
     or n.metadata->'group_ids' <> jsonb_build_array('rr-fg-g-' || s)
     or (n.metadata->>'count')::int <> 2 then
    raise exception 'FAIL: gecko reminder details %', n.metadata;
  end if;

  -- The member with a reptile too gets the same gecko reminder, and the
  -- reptile is not named or counted.
  v_link_m := public.care_log_link('feeding', array['rr-g-m-' || s], array['rr-fg-m-' || s]);
  select * into n from _mine where k = 'm';
  if n is null then raise exception 'FAIL: no gecko reminder for the member with a reptile'; end if;
  if n.content <> 'Nimbus and Rack A are due for feeding today.' then raise exception 'FAIL: mixed reminder words %', n.content; end if;
  if n.link <> v_link_m then raise exception 'FAIL: mixed reminder link %', n.link; end if;
  if (n.metadata->>'count')::int <> 2 or n.metadata->'names' ? 'Basil' then
    raise exception 'FAIL: the reptile is in the reminder with the switch off: %', n.metadata;
  end if;

  delete from public.notifications where user_email in (select v from _t where k in ('g', 'm', 'r'));
  raise notice 'PASS off: no reptile reminders, gecko reminders unchanged';
end
$off$;

-- ---------------------------------------------------------------------------
-- 2. A missing row counts as off.
-- ---------------------------------------------------------------------------
do $missing$
declare
  v_rows integer;
begin
  delete from public.app_settings where key = 'other_reptile_reminders_enabled';
  perform public.enqueue_feeding_reminders();
  select count(*) into v_rows from _mine where k = 'r';
  if v_rows <> 0 then raise exception 'FAIL: a reptile was reminded with no switch row'; end if;
  select count(*) into v_rows from _mine where k in ('g', 'm');
  if v_rows <> 2 then raise exception 'FAIL: % gecko reminders with no switch row, expected 2', v_rows; end if;
  delete from public.notifications where user_email in (select v from _t where k in ('g', 'm', 'r'));
  raise notice 'PASS a missing switch row counts as off';
end
$missing$;

-- Put the row back the way the migration writes it (read again from the
-- file), then turn it on.
\ir ../migrations/20261016090700_reptile_reminders_switch.sql

do $restored$
begin
  if (select value from public.app_settings where key = 'other_reptile_reminders_enabled') <> 'false'::jsonb then
    raise exception 'FAIL: the migration did not add the switch back as false';
  end if;
  raise notice 'PASS the migration adds a missing switch as false';
end
$restored$;

-- ---------------------------------------------------------------------------
-- 3. On: the reptile gets its reminder again, once a day.
-- ---------------------------------------------------------------------------
do $on$
declare
  s text := (select v from _t where k = 's');
  n record;
  v_rows integer;
begin
  update public.app_settings set value = 'true'::jsonb where key = 'other_reptile_reminders_enabled';
  perform public.enqueue_feeding_reminders();

  select count(*) into v_rows from _mine where k = 'r';
  if v_rows <> 1 then raise exception 'FAIL: % reptile reminders with the switch on, expected 1', v_rows; end if;
  select * into n from _mine where k = 'r';
  if n.content <> 'Basil is due for feeding today.' then raise exception 'FAIL: reptile reminder words %', n.content; end if;
  if n.link <> '/OtherReptiles' then raise exception 'FAIL: reptile reminder link %', n.link; end if;

  select * into n from _mine where k = 'm';
  if (n.metadata->>'count')::int <> 3 or not (n.metadata->'names' ? 'Basil') then
    raise exception 'FAIL: the reptile is missing from the mixed reminder with the switch on: %', n.metadata;
  end if;
  if n.metadata->'gecko_ids' <> jsonb_build_array('rr-g-m-' || s) then
    raise exception 'FAIL: mixed reminder geckos %', n.metadata->'gecko_ids';
  end if;

  select * into n from _mine where k = 'g';
  if n.content <> 'Nimbus and Rack A are due for feeding today.' then raise exception 'FAIL: gecko reminder changed with the switch on: %', n.content; end if;

  -- Once a day, as before.
  perform public.enqueue_feeding_reminders();
  select count(*) into v_rows from _mine;
  if v_rows <> 3 then raise exception 'FAIL: % reminders after a second run, expected 3', v_rows; end if;
  delete from public.notifications where user_email in (select v from _t where k in ('g', 'm', 'r'));
  raise notice 'PASS on: the reptile is reminded once a day';
end
$on$;

-- ---------------------------------------------------------------------------
-- 4. The migration again: a true already set is kept, and the job keeps
--    its owner, security definer, search_path and grants.
-- ---------------------------------------------------------------------------
create temp table _fn_before as
select p.proowner, p.prosecdef, p.proconfig, p.proacl
  from pg_proc p
 where p.oid = 'public.enqueue_feeding_reminders()'::regprocedure;

\ir ../migrations/20261016090700_reptile_reminders_switch.sql

do $again$
declare
  b record;
  a record;
  v_rows integer;
begin
  if (select value from public.app_settings where key = 'other_reptile_reminders_enabled') <> 'true'::jsonb then
    raise exception 'FAIL: running the migration again overwrote a switch set to true';
  end if;
  select count(*) into v_rows from public.app_settings where key = 'other_reptile_reminders_enabled';
  if v_rows <> 1 then raise exception 'FAIL: % switch rows', v_rows; end if;

  select * into b from _fn_before;
  select p.proowner, p.prosecdef, p.proconfig, p.proacl into a
    from pg_proc p
   where p.oid = 'public.enqueue_feeding_reminders()'::regprocedure;
  if a.proowner <> b.proowner then raise exception 'FAIL: the job changed owner'; end if;
  if not a.prosecdef then raise exception 'FAIL: the job is no longer security definer'; end if;
  if a.proconfig is distinct from array['search_path=public'] then raise exception 'FAIL: search_path %', a.proconfig; end if;
  if a.proacl::text[] is distinct from b.proacl::text[] then raise exception 'FAIL: grants changed: % to %', b.proacl, a.proacl; end if;
  if has_function_privilege('anon', 'public.enqueue_feeding_reminders()', 'execute')
     or has_function_privilege('authenticated', 'public.enqueue_feeding_reminders()', 'execute') then
    raise exception 'FAIL: a member or visitor can run the feeding job';
  end if;
  if not has_function_privilege('service_role', 'public.enqueue_feeding_reminders()', 'execute') then
    raise exception 'FAIL: the service role cannot run the feeding job';
  end if;

  -- And it still follows the switch it kept.
  perform public.enqueue_feeding_reminders();
  select count(*) into v_rows from _mine where k = 'r';
  if v_rows <> 1 then raise exception 'FAIL: % reptile reminders after the migration ran again with the switch on', v_rows; end if;
  raise notice 'PASS the migration runs again, keeps true, and keeps the job''s owner and grants';
end
$again$;

rollback;
