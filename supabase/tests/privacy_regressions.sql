-- Privacy: log retention and private breeding project finances.
-- Regression checks for supabase/migrations/20261015231000_privacy.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/privacy_regressions.sql
--
-- It checks:
--   1. Only the server can run the retention job, and it refuses a window
--      shorter than 30 days.
--   2. The job deletes error reports and crawler hits older than the
--      window and keeps newer ones.
--   3. Webhook rows the billing code needs stay; only their payloads are
--      cleared, and only once they are older than the window.
--   4. A second run changes nothing, and one cron job is registered.
--   5. Breeding projects, clutches and outcome predictions are readable by
--      their owner and by admins, not by other members or signed-out
--      visitors, and owners can still write them.
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text, p_role text default 'user')
returns void
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'privacy-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  update public.profiles set role = p_role where email = v_email;
  insert into _who values (p_tag, v_id, v_email);
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
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.who(p_tag text) returns text language sql stable as $$
  select email from _who where tag = p_tag
$$;

-- The role switchers are called while acting as a member or visitor.
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('owner');
select pg_temp.mk('other');
select pg_temp.mk('admin', 'admin');

-- 1. Who may run the retention job ------------------------------------------
do $t$
declare ok boolean;
begin
  perform pg_temp.as_anon();
  begin
    perform public.apply_privacy_retention(90);
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  perform pg_temp.as_postgres();
  if ok then raise exception 'FAIL: a signed-out visitor could run apply_privacy_retention()'; end if;

  perform pg_temp.as_member('admin');
  begin
    perform public.apply_privacy_retention(90);
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  perform pg_temp.as_postgres();
  if ok then raise exception 'FAIL: a signed-in member (even an admin) could run apply_privacy_retention()'; end if;

  begin
    perform public.apply_privacy_retention(7);
    ok := true;
  exception when others then
    ok := false;
    if sqlerrm not like '%keep at least 30 days%' then raise; end if;
  end;
  if ok then raise exception 'FAIL: a 7-day window was accepted'; end if;
end
$t$;

-- 2 and 3. What the job removes and what it keeps ---------------------------
-- Seed as postgres (the error log throttle lets the server through).
insert into public.error_logs (message, level, user_email, url, created_date)
values ('privacy-test old error', 'error', pg_temp.who('owner'), 'https://geckinspect.com/MyGeckos', now() - interval '91 days'),
       ('privacy-test recent error', 'error', pg_temp.who('owner'), 'https://geckinspect.com/MyGeckos', now() - interval '89 days');
-- The throttle trigger sets nothing on created_date; make sure the old row
-- really is old (a trigger could have reset it).
update public.error_logs set created_date = now() - interval '91 days' where message = 'privacy-test old error';

insert into geck_data.error_logs (message, user_email, created_date)
values ('privacy-test old market error', pg_temp.who('owner'), now() - interval '120 days'),
       ('privacy-test recent market error', pg_temp.who('owner'), now() - interval '10 days');

insert into public.agent_hits (agent, kind, path, ua, at)
values ('privacy-test-bot', 'crawler', '/old', 'PrivacyTestBot/1.0', now() - interval '91 days'),
       ('privacy-test-bot', 'crawler', '/recent', 'PrivacyTestBot/1.0', now() - interval '1 day');

insert into public.stripe_webhook_logs (id, stripe_event_id, stripe_event_type, processing_status, raw_payload, created_date, created_by)
values ('privacy-test-log-old', 'evt_privacy_old', 'invoice.paid', 'processed', '{"customer_email":"x@example.com"}', now() - interval '100 days', 'stripe-webhook'),
       ('privacy-test-log-new', 'evt_privacy_new', 'invoice.paid', 'processed', '{"customer_email":"y@example.com"}', now() - interval '5 days', 'stripe-webhook');

insert into public.payment_events (id, user_email, stripe_event_id, event_type, status, amount_cents, raw_stripe_payload, created_date, event_timestamp)
values ('privacy-test-pay-old', pg_temp.who('owner'), 'evt_privacy_old', 'invoice.paid', 'succeeded', 900, '{"raw":true}', now() - interval '100 days', now() - interval '100 days'),
       ('privacy-test-pay-new', pg_temp.who('owner'), 'evt_privacy_new', 'invoice.paid', 'succeeded', 900, '{"raw":true}', now() - interval '5 days', now() - interval '5 days');

insert into public.revenuecat_webhook_events (event_id, event_type, payload, received_at)
values ('rc-privacy-old', 'RENEWAL', '{"subscriber":"x"}', now() - interval '100 days'),
       ('rc-privacy-new', 'RENEWAL', '{"subscriber":"y"}', now() - interval '5 days');

do $t$
declare
  r jsonb;
  n int;
  v_text text;
  v_json jsonb;
begin
  -- The service role (an admin tool or an edge function) may run it.
  perform pg_temp.as_service();
  r := public.apply_privacy_retention(90);
  perform pg_temp.as_postgres();

  if (r ->> 'error_logs_deleted')::int < 1 then raise exception 'FAIL: no error log deleted: %', r; end if;
  select count(*) into n from public.error_logs where message = 'privacy-test old error';
  if n <> 0 then raise exception 'FAIL: a 91-day-old error report was kept'; end if;
  select count(*) into n from public.error_logs where message = 'privacy-test recent error';
  if n <> 1 then raise exception 'FAIL: an 89-day-old error report was deleted'; end if;

  select count(*) into n from geck_data.error_logs where message = 'privacy-test old market error';
  if n <> 0 then raise exception 'FAIL: an old Geck Intellect error report was kept'; end if;
  select count(*) into n from geck_data.error_logs where message = 'privacy-test recent market error';
  if n <> 1 then raise exception 'FAIL: a recent Geck Intellect error report was deleted'; end if;

  select count(*) into n from public.agent_hits where agent = 'privacy-test-bot' and path = '/old';
  if n <> 0 then raise exception 'FAIL: an old crawler hit was kept'; end if;
  select count(*) into n from public.agent_hits where agent = 'privacy-test-bot' and path = '/recent';
  if n <> 1 then raise exception 'FAIL: a recent crawler hit was deleted'; end if;

  -- The old webhook row stays, so the webhook still recognises the event
  -- as processed; only the payload is gone.
  select raw_payload into v_text from public.stripe_webhook_logs where id = 'privacy-test-log-old';
  if not found then raise exception 'FAIL: an old Stripe webhook row was deleted'; end if;
  if v_text is not null then raise exception 'FAIL: an old Stripe webhook payload was kept'; end if;
  select count(*) into n from public.stripe_webhook_logs
   where stripe_event_id = 'evt_privacy_old' and processing_status = 'processed';
  if n <> 1 then raise exception 'FAIL: the idempotency lookup no longer finds the old event'; end if;
  select raw_payload into v_text from public.stripe_webhook_logs where id = 'privacy-test-log-new';
  if v_text is null then raise exception 'FAIL: a recent Stripe webhook payload was cleared'; end if;

  select raw_stripe_payload into v_text from public.payment_events where id = 'privacy-test-pay-old';
  if not found then raise exception 'FAIL: an old payment ledger row was deleted'; end if;
  if v_text is not null then raise exception 'FAIL: an old payment payload was kept'; end if;
  select count(*) into n from public.payment_events where id = 'privacy-test-pay-old' and amount_cents = 900 and status = 'succeeded';
  if n <> 1 then raise exception 'FAIL: the old ledger row lost its amount or status'; end if;
  select raw_stripe_payload into v_text from public.payment_events where id = 'privacy-test-pay-new';
  if v_text is null then raise exception 'FAIL: a recent payment payload was cleared'; end if;

  select payload into v_json from public.revenuecat_webhook_events where event_id = 'rc-privacy-old';
  if not found then raise exception 'FAIL: an old RevenueCat event row was deleted'; end if;
  if v_json <> '{}'::jsonb then raise exception 'FAIL: an old RevenueCat payload was kept: %', v_json; end if;
  select payload into v_json from public.revenuecat_webhook_events where event_id = 'rc-privacy-new';
  if v_json = '{}'::jsonb then raise exception 'FAIL: a recent RevenueCat payload was cleared'; end if;

  -- 4. A second run (pg_cron's next day) finds nothing left to do.
  r := public.apply_privacy_retention(90);
  if (r ->> 'stripe_webhook_payloads_cleared')::int <> 0
     or (r ->> 'payment_event_payloads_cleared')::int <> 0
     or (r ->> 'revenuecat_payloads_cleared')::int <> 0
     or (r ->> 'error_logs_deleted')::int <> 0
     or (r ->> 'agent_hits_deleted')::int <> 0 then
    raise exception 'FAIL: the second run changed rows again: %', r;
  end if;

  select count(*) into n from cron.job where jobname = 'privacy-retention-daily';
  if n <> 1 then raise exception 'FAIL: expected one privacy-retention-daily cron job, found %', n; end if;
  select count(*) into n from cron.job
   where jobname = 'privacy-retention-daily' and command like '%apply_privacy_retention(90)%';
  if n <> 1 then raise exception 'FAIL: the cron job does not run apply_privacy_retention(90)'; end if;
end
$t$;

-- 5. Breeding project finances ----------------------------------------------
do $t$
declare
  v_project uuid;
  n int;
  ok boolean;
begin
  -- The owner can still create a project, a clutch and a prediction.
  perform pg_temp.as_member('owner');
  insert into public.breeding_projects (name, created_by, acquisition_cost_sire, actual_total_revenue)
  values ('Lilly White x Axanthic', pg_temp.who('owner'), 1200, 4800)
  returning id into v_project;
  insert into public.clutches (project_id, clutch_number, laid_date, created_by)
  values (v_project, 1, current_date, pg_temp.who('owner'));
  insert into public.genetic_outcome_predictions (project_id, morph_combination, probability, created_by)
  values (v_project, 'Lilly White', 0.5, pg_temp.who('owner'));

  select count(*) into n from public.breeding_projects where id = v_project;
  if n <> 1 then raise exception 'FAIL: the owner cannot read their own project'; end if;
  select count(*) into n from public.clutches where project_id = v_project;
  if n <> 1 then raise exception 'FAIL: the owner cannot read their own clutch'; end if;
  select count(*) into n from public.genetic_outcome_predictions where project_id = v_project;
  if n <> 1 then raise exception 'FAIL: the owner cannot read their own prediction'; end if;

  update public.breeding_projects set actual_total_revenue = 5000 where id = v_project;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'FAIL: the owner cannot update their own project'; end if;

  -- Another member sees nothing.
  perform pg_temp.as_member('other');
  select count(*) into n from public.breeding_projects where id = v_project;
  if n <> 0 then raise exception 'FAIL: another member can read the project''s costs and revenue'; end if;
  select count(*) into n from public.clutches where project_id = v_project;
  if n <> 0 then raise exception 'FAIL: another member can read the clutch'; end if;
  select count(*) into n from public.genetic_outcome_predictions where project_id = v_project;
  if n <> 0 then raise exception 'FAIL: another member can read the prediction'; end if;
  update public.breeding_projects set actual_total_revenue = 0 where id = v_project;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: another member changed the project'; end if;

  -- An admin can read them (support and account erasure checks).
  perform pg_temp.as_member('admin');
  select count(*) into n from public.breeding_projects where id = v_project;
  if n <> 1 then raise exception 'FAIL: an admin cannot read the project'; end if;
  select count(*) into n from public.clutches where project_id = v_project;
  if n <> 1 then raise exception 'FAIL: an admin cannot read the clutch'; end if;
  select count(*) into n from public.genetic_outcome_predictions where project_id = v_project;
  if n <> 1 then raise exception 'FAIL: an admin cannot read the prediction'; end if;

  -- A signed-out visitor has no access at all.
  perform pg_temp.as_anon();
  begin
    perform 1 from public.breeding_projects limit 1;
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  if ok then raise exception 'FAIL: a signed-out visitor can query breeding_projects'; end if;
  begin
    perform 1 from public.clutches limit 1;
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  if ok then raise exception 'FAIL: a signed-out visitor can query clutches'; end if;
  begin
    perform 1 from public.genetic_outcome_predictions limit 1;
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  if ok then raise exception 'FAIL: a signed-out visitor can query genetic_outcome_predictions'; end if;
  begin
    insert into public.breeding_projects (name) values ('anon write');
    ok := true;
  exception when insufficient_privilege then ok := false;
  end;
  if ok then raise exception 'FAIL: a signed-out visitor can write breeding_projects'; end if;
  perform pg_temp.as_postgres();

  -- No public read policy is left on any of the three tables.
  select count(*) into n from pg_policies
   where schemaname = 'public'
     and tablename in ('breeding_projects', 'clutches', 'genetic_outcome_predictions')
     and cmd = 'SELECT'
     and (qual = 'true' or 'public' = any (roles) or 'anon' = any (roles));
  if n <> 0 then raise exception 'FAIL: % open read policies remain', n; end if;
end
$t$;

select 'privacy_regressions: all checks passed' as result;
rollback;
