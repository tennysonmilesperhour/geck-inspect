-- Lifecycle emails, the email delivery log and suppressions.
-- Regression checks for supabase/migrations/20261016110000_lifecycle_emails.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members, moves the clock with the p_now argument the
-- functions take, and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/lifecycle_regressions.sql
--
-- Each block raises "FAIL: ..." when a rule is broken. The last line
-- prints "lifecycle regressions: all passed".
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
) on commit drop;
grant all on _who to public;

-- A member as Supabase Auth makes one (the auth.users trigger makes the
-- profile). p_signed_up is when they joined; p_confirmed false leaves the
-- address unconfirmed.
create function pg_temp.mk(p_tag text, p_signed_up timestamptz, p_name text default 'Sam Keeper',
                           p_confirmed boolean default true, p_role text default 'user')
returns text
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'life-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', case when p_confirmed then p_signed_up end,
          '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, p_signed_up, p_signed_up);
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  update public.profiles
     set full_name = p_name, role = p_role, email_notifications_enabled = true
   where email = v_email;
  insert into _who values (p_tag, v_id, v_email);
  return v_email;
end
$$;

create function pg_temp.em(p_tag text) returns text language sql as $$
  select email from _who where tag = p_tag
$$;

create function pg_temp.gecko(p_tag text, p_name text, p_at timestamptz, p_sire text default null)
returns text
language plpgsql
as $$
declare v_id text := 'life-gecko-' || p_tag || '-' || left(gen_random_uuid()::text, 8);
begin
  insert into public.geckos (id, name, created_by, created_date, morphs_traits, sire_name)
  values (v_id, p_name, pg_temp.em(p_tag), p_at, 'Lilly White Harlequin', p_sire);
  return v_id;
end
$$;

create function pg_temp.as_member(p_tag text) returns void language plpgsql as $$
declare w record;
begin
  perform set_config('role', 'postgres', true);
  select * into w from _who where tag = p_tag;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', w.uid, 'email', w.email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- What a step looks like for one member at one moment.
create function pg_temp.step_for(p_tag text, p_at timestamptz) returns text language sql as $$
  select c.step from public.lifecycle_email_candidates(p_at) c where c.email = pg_temp.em(p_tag)
$$;

-- The default privileges no longer grant EXECUTE to anyone, so the test
-- helpers need it said out loud to run while acting as a member.
grant execute on all functions in schema pg_temp to public;

-- The Vault key the job uses to call send-email.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notification_service_role_key') then
    perform vault.create_secret('local-test-key', 'notification_service_role_key', 'test');
  end if;
end $$;

create temp table _t0 on commit drop as
  select date_trunc('hour', now()) - interval '30 days' as t0,
         coalesce((select max(id) from net.http_request_queue), 0) as net_before;
grant all on _t0 to public;

-- 1. The switch exists, is off, and is not public ---------------------------
do $$
declare v jsonb;
begin
  select value into v from public.app_settings where key = 'lifecycle_emails_enabled';
  if v is distinct from 'false'::jsonb then
    raise exception 'FAIL: lifecycle_emails_enabled should default to false, got %', v;
  end if;
end $$;

select pg_temp.as_anon();
do $$
begin
  if exists (select 1 from public.app_settings where key = 'lifecycle_emails_enabled') then
    raise exception 'FAIL: a signed-out visitor can read the lifecycle switch';
  end if;
end $$;
select pg_temp.as_postgres();

-- 2. While the switch is off nothing is claimed or sent ---------------------
select pg_temp.mk('new', (select t0 from _t0));
do $$
declare v_t0 timestamptz := (select t0 from _t0);
begin
  if pg_temp.step_for('new', v_t0 + interval '1 hour') is distinct from 'day0' then
    raise exception 'FAIL: a member who joined an hour ago should be due day0';
  end if;
  if public.enqueue_lifecycle_emails(v_t0 + interval '1 hour') <> 0 then
    raise exception 'FAIL: the job sent with the switch off';
  end if;
  if exists (select 1 from public.lifecycle_email_sends where email = pg_temp.em('new')) then
    raise exception 'FAIL: the job claimed a step with the switch off';
  end if;
  if exists (select 1 from net.http_request_queue where id > (select net_before from _t0)) then
    raise exception 'FAIL: the job called send-email with the switch off';
  end if;
end $$;

update public.app_settings set value = 'true'::jsonb where key = 'lifecycle_emails_enabled';

-- 3. The full sequence for one member, never twice --------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_gecko text;
  v_body jsonb;
  v_n int;
begin
  -- Day 0, within the hour.
  if public.enqueue_lifecycle_emails(v_t0 + interval '1 hour') <> 1 then
    raise exception 'FAIL: day0 was not handed to send-email';
  end if;
  select convert_from(body, 'UTF8')::jsonb into v_body
    from net.http_request_queue where id > (select net_before from _t0) order by id desc limit 1;
  if v_body->>'type' <> 'lifecycle_day0' or v_body->>'user_email' <> pg_temp.em('new')
     or v_body->'facts'->>'first_name' <> 'Sam' or (v_body->'facts'->>'gecko_count')::int <> 0 then
    raise exception 'FAIL: day0 payload is wrong: %', v_body;
  end if;
  if (select url from net.http_request_queue order by id desc limit 1) not like '%/functions/v1/send-email' then
    raise exception 'FAIL: the job does not call send-email';
  end if;

  -- The same hour again, and a run two hours later: nothing new.
  if public.enqueue_lifecycle_emails(v_t0 + interval '1 hour') <> 0
     or public.enqueue_lifecycle_emails(v_t0 + interval '3 hours') <> 0 then
    raise exception 'FAIL: day0 was sent twice';
  end if;

  -- Day 1, still no gecko.
  if public.enqueue_lifecycle_emails(v_t0 + interval '25 hours') <> 1 then
    raise exception 'FAIL: day1 was not sent to a member with no gecko';
  end if;

  -- They add a gecko with a sire name on day 2. Day 3 is the lineage email.
  v_gecko := pg_temp.gecko('new', 'Mango', v_t0 + interval '2 days', 'Spud');
  if pg_temp.step_for('new', v_t0 + interval '3 days 1 hour') is distinct from 'day3' then
    raise exception 'FAIL: day3 not due for a member with a gecko';
  end if;
  if public.enqueue_lifecycle_emails(v_t0 + interval '3 days 1 hour') <> 1 then
    raise exception 'FAIL: day3 not sent';
  end if;
  select convert_from(body, 'UTF8')::jsonb into v_body
    from net.http_request_queue order by id desc limit 1;
  if v_body->>'type' <> 'lifecycle_day3' or v_body->'facts'->>'gecko_id' <> v_gecko
     or v_body->'facts'->>'gecko_name' <> 'Mango' or (v_body->'facts'->>'has_sire')::boolean is not true
     or (v_body->'facts'->>'has_dam')::boolean is not false then
    raise exception 'FAIL: day3 facts are wrong: %', v_body;
  end if;

  -- Nothing between the windows.
  if pg_temp.step_for('new', v_t0 + interval '5 days 2 hours') is not null then
    raise exception 'FAIL: something is due on day 5';
  end if;

  -- One weigh-in, then day 7 carries it.
  insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by)
  values ('life-w1-' || v_gecko, v_gecko, 4.5, (v_t0 + interval '6 days')::date, pg_temp.em('new'));
  if public.enqueue_lifecycle_emails(v_t0 + interval '7 days 1 hour') <> 1 then
    raise exception 'FAIL: day7 not sent';
  end if;
  select convert_from(body, 'UTF8')::jsonb into v_body
    from net.http_request_queue order by id desc limit 1;
  if v_body->>'type' <> 'lifecycle_day7' or (v_body->'facts'->>'weight_count')::int <> 1
     or (v_body->'facts'->>'last_weight_grams')::numeric <> 4.5 then
    raise exception 'FAIL: day7 facts are wrong: %', v_body;
  end if;

  if public.enqueue_lifecycle_emails(v_t0 + interval '14 days 1 hour') <> 1 then
    raise exception 'FAIL: day14 not sent';
  end if;
  if public.enqueue_lifecycle_emails(v_t0 + interval '15 days 23 hours') <> 0
     or pg_temp.step_for('new', v_t0 + interval '20 days') is not null then
    raise exception 'FAIL: something was due after day 14';
  end if;

  select count(*) into v_n from public.lifecycle_email_sends where email = pg_temp.em('new');
  if v_n <> 5 then
    raise exception 'FAIL: expected 5 ledger rows (day0, 1, 3, 7, 14), got %', v_n;
  end if;
  select count(*) into v_n from net.http_request_queue
   where id > (select net_before from _t0)
     and convert_from(body, 'UTF8')::jsonb->>'user_email' = pg_temp.em('new');
  if v_n <> 5 then
    raise exception 'FAIL: expected 5 send-email calls, got %', v_n;
  end if;
end $$;

-- 4. Who is left out ---------------------------------------------------------
do $$
declare v_t0 timestamptz := (select t0 from _t0);
begin
  -- Has a gecko on day 1: no "add your first gecko" email.
  perform pg_temp.mk('keeper', v_t0);
  perform pg_temp.gecko('keeper', 'Juniper', v_t0 + interval '10 minutes');
  insert into public.lifecycle_email_sends (email, step, created_date)
  values (pg_temp.em('keeper'), 'day0', v_t0 + interval '1 hour');
  if pg_temp.step_for('keeper', v_t0 + interval '25 hours') is not null then
    raise exception 'FAIL: day1 is due for a member who already has a gecko';
  end if;

  -- No gecko by day 3: no lineage or weigh-in email to point at nothing.
  perform pg_temp.mk('empty', v_t0);
  if pg_temp.step_for('empty', v_t0 + interval '3 days 1 hour') is not null
     or pg_temp.step_for('empty', v_t0 + interval '7 days 1 hour') is not null then
    raise exception 'FAIL: a member with no gecko is due a lineage or weigh-in email';
  end if;

  -- Unconfirmed address.
  perform pg_temp.mk('unconfirmed', v_t0, p_confirmed => false);
  if pg_temp.step_for('unconfirmed', v_t0 + interval '1 hour') is not null then
    raise exception 'FAIL: an unconfirmed address is due an email';
  end if;

  -- Email notifications switched off.
  perform pg_temp.mk('off', v_t0);
  update public.profiles set email_notifications_enabled = false where email = pg_temp.em('off');
  if pg_temp.step_for('off', v_t0 + interval '1 hour') is not null then
    raise exception 'FAIL: a member with email off is due an email';
  end if;

  -- Deleted account.
  perform pg_temp.mk('deleted', v_t0);
  update auth.users set deleted_at = v_t0 where email = pg_temp.em('deleted');
  if pg_temp.step_for('deleted', v_t0 + interval '1 hour') is not null then
    raise exception 'FAIL: a deleted account is due an email';
  end if;

  -- A profile with no sign-in account (imported from the old platform).
  insert into public.profiles (email, full_name, email_notifications_enabled, created_date)
  values ('life-legacy@example.com', 'Legacy Keeper', true, v_t0);
  if exists (select 1 from public.lifecycle_email_candidates(v_t0 + interval '1 hour')
              where email = 'life-legacy@example.com') then
    raise exception 'FAIL: a profile with no login is due an email';
  end if;

  -- Joined long before the switch: no welcome, no late steps.
  perform pg_temp.mk('old', v_t0 - interval '60 days');
  if pg_temp.step_for('old', v_t0 + interval '1 hour') is not null then
    raise exception 'FAIL: a member from two months ago is due a lifecycle email';
  end if;

  -- Joined four days ago with a gecko, nothing sent yet: only day3, the
  -- welcome window has passed.
  perform pg_temp.mk('late', v_t0 - interval '4 days');
  perform pg_temp.gecko('late', 'Biscuit', v_t0 - interval '4 days');
  if pg_temp.step_for('late', v_t0) is distinct from 'day3' then
    raise exception 'FAIL: a 4-day-old member should be due day3, got %', pg_temp.step_for('late', v_t0);
  end if;

  -- Two steps due at once: one now, the other at least 20 hours later.
  perform pg_temp.mk('both', v_t0 - interval '36 hours');
  if pg_temp.step_for('both', v_t0) is distinct from 'day0' then
    raise exception 'FAIL: the earliest step should go first';
  end if;
  if public.enqueue_lifecycle_emails(v_t0) < 1 then
    raise exception 'FAIL: day0 not sent to the catch-up member';
  end if;
  if pg_temp.step_for('both', v_t0 + interval '10 hours') is not null then
    raise exception 'FAIL: a second lifecycle email inside 20 hours';
  end if;
  if pg_temp.step_for('both', v_t0 + interval '21 hours') is distinct from 'day1' then
    raise exception 'FAIL: day1 should follow 20 hours later';
  end if;
end $$;

-- 5. Delivery events and suppressions ----------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_a text := pg_temp.mk('bounce', v_t0);
  v_b text := pg_temp.mk('soft', v_t0);
  v_c text := pg_temp.mk('complain', v_t0);
  v_row record;
begin
  -- send-email's own record of a send, with the type.
  if not public.record_email_event('sent', 'sent:re_1', 're_1', upper(v_a), 'lifecycle_day0') then
    raise exception 'FAIL: a sent event was not recorded';
  end if;
  -- A webhook with no type or address borrows both from the sent row.
  perform public.record_email_event('delivered', 'msg_1', 're_1', null, null, v_t0, '{}'::jsonb);
  select * into v_row from public.email_deliveries where event_key = 'msg_1';
  if v_row.email_type is distinct from 'lifecycle_day0' or v_row.email is distinct from v_a then
    raise exception 'FAIL: the delivered event did not borrow type and address: % %', v_row.email_type, v_row.email;
  end if;
  -- Resend retries the same webhook: counted once.
  if public.record_email_event('delivered', 'msg_1', 're_1') then
    raise exception 'FAIL: a repeated webhook was recorded twice';
  end if;
  if (select count(*) from public.email_deliveries where resend_email_id = 're_1') <> 2 then
    raise exception 'FAIL: expected sent and delivered rows only';
  end if;
  -- Unknown events and missing keys are ignored.
  if public.record_email_event('scheduled', 'msg_x', 're_1')
     or public.record_email_event('opened', '  ', 're_1') then
    raise exception 'FAIL: an unknown event or blank key was recorded';
  end if;

  -- A hard bounce suppresses; a soft one does not.
  perform public.record_email_event('bounced', 'msg_2', 're_2', v_a, 'weekly_digest', v_t0,
                                    '{"bounce_type":"Permanent"}'::jsonb);
  perform public.record_email_event('bounced', 'msg_3', 're_3', v_b, 'weekly_digest', v_t0,
                                    '{"bounce_type":"Transient"}'::jsonb);
  if not public.email_is_suppressed(upper(v_a)) then
    raise exception 'FAIL: a hard bounce did not suppress the address';
  end if;
  if public.email_is_suppressed(v_b) then
    raise exception 'FAIL: a soft bounce suppressed the address';
  end if;

  -- A complaint suppresses, and outranks an earlier bounce.
  perform public.record_email_event('complained', 'msg_4', 're_4', v_c, 'lifecycle_day3', v_t0);
  perform public.record_email_event('complained', 'msg_5', 're_5', v_a, 'weekly_digest', v_t0);
  if not public.email_is_suppressed(v_c)
     or (select reason from public.email_suppressions where email = v_a) <> 'complained' then
    raise exception 'FAIL: a complaint did not suppress the address';
  end if;

  -- A suppressed address is not due a lifecycle email.
  if pg_temp.step_for('bounce', v_t0 + interval '1 hour') is not null
     or pg_temp.step_for('complain', v_t0 + interval '1 hour') is not null then
    raise exception 'FAIL: a suppressed address is due a lifecycle email';
  end if;
  if pg_temp.step_for('soft', v_t0 + interval '1 hour') is distinct from 'day0' then
    raise exception 'FAIL: a soft bounce stopped lifecycle email';
  end if;

  -- The weekly numbers: one lifecycle_day0 email sent and delivered.
  select * into v_row from public.email_delivery_stats where email_type = 'lifecycle_day0';
  if v_row.sent <> 1 or v_row.delivered <> 1 or v_row.opened <> 0 then
    raise exception 'FAIL: email_delivery_stats is wrong for lifecycle_day0: %', row_to_json(v_row);
  end if;
  select * into v_row from public.email_delivery_stats where email_type = 'weekly_digest';
  -- Two digests bounced (a bounce means it was sent) and a third drew a
  -- complaint with no sent row of its own here, so it is not counted as
  -- sent. The week is the week each email was first seen.
  if v_row.sent <> 2 or v_row.bounced <> 2 or v_row.complained <> 1 or v_row.delivered <> 0 then
    raise exception 'FAIL: email_delivery_stats is wrong for weekly_digest: %', row_to_json(v_row);
  end if;
end $$;

-- 6. Who can read and run what -----------------------------------------------
select pg_temp.mk('admin', now(), 'Admin', p_role => 'admin');
select pg_temp.mk('member', now());

select pg_temp.as_member('member');
do $$
begin
  if exists (select 1 from public.email_deliveries)
     or exists (select 1 from public.email_suppressions)
     or exists (select 1 from public.lifecycle_email_sends)
     or exists (select 1 from public.email_delivery_stats) then
    raise exception 'FAIL: a member can read the delivery log, suppressions or ledger';
  end if;
  begin
    insert into public.email_deliveries (event_key, event) values ('forged', 'opened');
    raise exception 'FAIL: a member can write to the delivery log';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.email_suppressions;
    if exists (select 1 from public.email_suppressions) then null; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.record_email_event('opened', 'forged-2', 're_1');
    raise exception 'FAIL: a member can call record_email_event';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.email_is_suppressed('someone@example.com');
    raise exception 'FAIL: a member can call email_is_suppressed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.lifecycle_email_candidates();
    raise exception 'FAIL: a member can call lifecycle_email_candidates';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.enqueue_lifecycle_emails();
    raise exception 'FAIL: a member can call enqueue_lifecycle_emails';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_anon();
do $$
begin
  begin
    perform 1 from public.email_delivery_stats;
    raise exception 'FAIL: a signed-out visitor can read email_delivery_stats';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.email_deliveries;
    raise exception 'FAIL: a signed-out visitor can read email_deliveries';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_postgres();
do $$
begin
  if (select count(*) from public.email_suppressions) <> 2 then
    raise exception 'FAIL: a member deleted suppressions';
  end if;
end $$;

select pg_temp.as_member('admin');
do $$
begin
  if not exists (select 1 from public.email_deliveries)
     or not exists (select 1 from public.email_delivery_stats)
     or not exists (select 1 from public.lifecycle_email_sends) then
    raise exception 'FAIL: an admin cannot read the delivery log, stats or ledger';
  end if;
  -- An admin lifts a suppression.
  delete from public.email_suppressions where reason = 'complained' and email like 'life-complain-%';
  if exists (select 1 from public.email_suppressions where email like 'life-complain-%') then
    raise exception 'FAIL: an admin cannot lift a suppression';
  end if;
end $$;

select pg_temp.as_postgres();
select 'lifecycle regressions: all passed' as result;
rollback;
