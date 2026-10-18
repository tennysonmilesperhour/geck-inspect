-- Weekly Gecko Notes: who may get one, the 7-day and 20-hour spacing, the
-- lifecycle window, never twice, the claim, the drip-only unsubscribe,
-- the sign-up box and the region rule for the EEA and the UK, and account
-- erasure. Regression checks for
-- supabase/migrations/20261018002200_weekly_notes.sql and
-- 20261018002300_erase_weekly_notes.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members, moves the clock with the p_now argument the
-- functions take, and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/weekly_notes_regressions.sql
--
-- send-email's part (the postal address, the login, suppression and token
-- checks, then the claim) is tested in src/lib/__tests__/weeklyNotes.test.js.
-- Here, a skip in send-email looks like what it leaves behind in the
-- database: a poll row and no ledger row.
--
-- Each block raises "FAIL: ..." when a rule is broken. The last line
-- prints "weekly notes regressions: all passed".
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
) on commit drop;
grant all on _who to public;

-- The test's clock, and where the send-email queue stood when it began.
create temp table _t0 on commit drop as
  select date_trunc('hour', now()) - interval '200 days' as t0,
         coalesce((select max(id) from net.http_request_queue), 0) as net_before;
grant all on _t0 to public;

-- A member as Supabase Auth makes one (the auth.users trigger makes the
-- profile). The helpers copy supabase/tests/lifecycle_regressions.sql.
-- p_meta is the sign-up metadata (the sign-up form's box travels in it);
-- p_profile_first makes the profile row before the account, like a row
-- imported from the old platform.
create function pg_temp.mk(p_tag text, p_signed_up timestamptz, p_name text default 'Sam Keeper',
                           p_confirmed boolean default true, p_role text default 'user',
                           p_meta jsonb default '{}'::jsonb, p_profile_first boolean default false)
returns text
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'weekly-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  if p_profile_first then
    insert into public.profiles (email) values (v_email);
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', case when p_confirmed then p_signed_up end,
          '{"provider":"email","providers":["email"]}'::jsonb, p_meta, p_signed_up, p_signed_up);
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

-- Is this member a candidate at this moment?
create function pg_temp.cand(p_tag text, p_at timestamptz, p_ignore_polls boolean default false)
returns boolean language sql as $$
  select exists (
    select 1 from public.weekly_notes_candidates(p_at, p_ignore_polls) c where c.email = pg_temp.em(p_tag)
  )
$$;

-- How many ledger rows a member has.
create function pg_temp.sent(p_tag text) returns integer language sql as $$
  select count(*)::int from public.weekly_notes_sends where email = pg_temp.em(p_tag)
$$;

-- The send-email calls queued since the test began, for one member.
create function pg_temp.posts(p_tag text) returns integer language sql as $$
  select count(*)::int from net.http_request_queue q
   where q.id > (select net_before from _t0)
     and convert_from(q.body, 'UTF8')::jsonb->>'user_email' = pg_temp.em(p_tag)
$$;

-- Switch a member's weekly notes off, so a later block's counts only see
-- its own members.
create function pg_temp.retire(p_tag text) returns void language sql as $$
  update public.profiles set email_weekly_notes_enabled = false where email = pg_temp.em(p_tag)
$$;

grant execute on all functions in schema pg_temp to public;

-- The Vault secrets: the key the job sends to send-email, and the one that
-- signs unsubscribe links.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notification_service_role_key') then
    perform vault.create_secret('local-test-key', 'notification_service_role_key', 'test');
  end if;
  if not exists (select 1 from vault.secrets where name = 'email_unsubscribe_secret') then
    perform vault.create_secret('local-unsubscribe-secret', 'email_unsubscribe_secret', 'test');
  end if;
end $$;

-- 1. The switch exists, is off and is not public; while it is off the job
--    does nothing ----------------------------------------------------------
do $$
declare v record;
begin
  select value, is_public into v from public.app_settings where key = 'weekly_notes_enabled';
  if v.value is distinct from 'false'::jsonb or v.is_public is distinct from false then
    raise exception 'FAIL: weekly_notes_enabled should be false and not public, got % %', v.value, v.is_public;
  end if;
end $$;

select pg_temp.as_anon();
do $$
begin
  if exists (select 1 from public.app_settings where key = 'weekly_notes_enabled') then
    raise exception 'FAIL: a signed-out visitor can read the weekly notes switch';
  end if;
end $$;
select pg_temp.as_postgres();

select pg_temp.mk('off', (select t0 from _t0) - interval '30 days');
do $$
declare v_t0 timestamptz := (select t0 from _t0);
begin
  if not pg_temp.cand('off', v_t0) then
    raise exception 'FAIL: a 30-day-old member should be a candidate';
  end if;
  if public.enqueue_weekly_notes(v_t0) <> 0 then
    raise exception 'FAIL: the job asked send-email with the switch off';
  end if;
  if exists (select 1 from net.http_request_queue where id > (select net_before from _t0)) then
    raise exception 'FAIL: the job queued a call with the switch off';
  end if;
  if exists (select 1 from public.weekly_notes_polls) or exists (select 1 from public.weekly_notes_sends) then
    raise exception 'FAIL: the job wrote a poll or ledger row with the switch off';
  end if;
end $$;
select pg_temp.retire('off');

-- 2. Who is left out, and each one back at its boundary ----------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_old timestamptz := (select t0 from _t0) - interval '30 days';
begin
  perform pg_temp.mk('ok', v_old);
  if not pg_temp.cand('ok', v_t0) then
    raise exception 'FAIL: an ordinary 30-day-old member is not a candidate';
  end if;

  perform pg_temp.mk('unconfirmed', v_old, p_confirmed => false);
  if pg_temp.cand('unconfirmed', v_t0) then
    raise exception 'FAIL: an unconfirmed address is a candidate';
  end if;

  perform pg_temp.mk('deleted', v_old);
  update auth.users set deleted_at = v_old + interval '1 day' where email = pg_temp.em('deleted');
  if pg_temp.cand('deleted', v_t0) then
    raise exception 'FAIL: a deleted account is a candidate';
  end if;

  perform pg_temp.mk('anonymous', v_old);
  update auth.users set is_anonymous = true where email = pg_temp.em('anonymous');
  if pg_temp.cand('anonymous', v_t0) then
    raise exception 'FAIL: an anonymous account is a candidate';
  end if;

  perform pg_temp.mk('banned', v_old);
  update auth.users set banned_until = v_t0 + interval '1 day' where email = pg_temp.em('banned');
  if pg_temp.cand('banned', v_t0) then
    raise exception 'FAIL: a banned account is a candidate';
  end if;
  if not pg_temp.cand('banned', v_t0 + interval '1 day 1 second') then
    raise exception 'FAIL: a member whose ban has ended is not a candidate';
  end if;

  -- Joined under 16 days ago: still in the getting-started window.
  perform pg_temp.mk('young', v_t0 - interval '10 days');
  if pg_temp.cand('young', v_t0) then
    raise exception 'FAIL: a 10-day-old member is a candidate';
  end if;
  if pg_temp.cand('young', v_t0 - interval '10 days' + interval '16 days' - interval '1 second') then
    raise exception 'FAIL: a member one second short of 16 days is a candidate';
  end if;
  if not pg_temp.cand('young', v_t0 - interval '10 days' + interval '16 days') then
    raise exception 'FAIL: a member exactly 16 days old is not a candidate';
  end if;

  perform pg_temp.mk('master', v_old);
  update public.profiles set email_notifications_enabled = false where email = pg_temp.em('master');
  if pg_temp.cand('master', v_t0) then
    raise exception 'FAIL: a member with email off is a candidate';
  end if;

  perform pg_temp.mk('weeklyoff', v_old);
  perform pg_temp.retire('weeklyoff');
  if pg_temp.cand('weeklyoff', v_t0) then
    raise exception 'FAIL: a member with weekly notes off is a candidate';
  end if;

  perform pg_temp.mk('suppressed', v_old);
  insert into public.email_suppressions (email, reason) values (pg_temp.em('suppressed'), 'bounced');
  if pg_temp.cand('suppressed', v_t0) then
    raise exception 'FAIL: a suppressed address is a candidate';
  end if;

  -- A lifecycle email 10 hours ago (a day 14 email sent late).
  perform pg_temp.mk('life', v_old);
  insert into public.lifecycle_email_sends (email, step, created_date)
  values (pg_temp.em('life'), 'day14', v_t0 - interval '10 hours');
  if pg_temp.cand('life', v_t0) then
    raise exception 'FAIL: a member with a lifecycle email 10 hours ago is a candidate';
  end if;
  if pg_temp.cand('life', v_t0 + interval '10 hours' - interval '1 second') then
    raise exception 'FAIL: a member just under 20 hours after a lifecycle email is a candidate';
  end if;
  if not pg_temp.cand('life', v_t0 + interval '10 hours') then
    raise exception 'FAIL: a member exactly 20 hours after a lifecycle email is not a candidate';
  end if;

  -- A weekly note 6 days ago.
  perform pg_temp.mk('note', v_old);
  insert into public.weekly_notes_sends (email, step, slug, created_date)
  values (pg_temp.em('note'), 1, 'a', v_t0 - interval '6 days');
  if pg_temp.cand('note', v_t0) then
    raise exception 'FAIL: a member with a weekly note 6 days ago is a candidate';
  end if;
  if not pg_temp.cand('note', v_t0 + interval '1 day') then
    raise exception 'FAIL: a member exactly 7 days after a weekly note is not a candidate';
  end if;

  -- Asked about 10 hours ago.
  perform pg_temp.mk('polled', v_old);
  insert into public.weekly_notes_polls (email, polled_at) values (pg_temp.em('polled'), v_t0 - interval '10 hours');
  if pg_temp.cand('polled', v_t0) then
    raise exception 'FAIL: a member polled 10 hours ago is a candidate';
  end if;
  if not pg_temp.cand('polled', v_t0, true) then
    raise exception 'FAIL: the claim (p_ignore_polls) should not see the poll';
  end if;
  if not pg_temp.cand('polled', v_t0 + interval '10 hours') then
    raise exception 'FAIL: a member exactly 20 hours after a poll is not a candidate';
  end if;

  -- A profile with no sign-in account (imported from the old platform).
  insert into public.profiles (email, full_name, email_notifications_enabled, created_date)
  values ('weekly-legacy@example.com', 'Legacy Keeper', true, v_old);
  if exists (select 1 from public.weekly_notes_candidates(v_t0) where email = 'weekly-legacy@example.com') then
    raise exception 'FAIL: a profile with no login is a candidate';
  end if;
end $$;

-- Block 2's members are done; switch them off so later counts are exact.
update public.profiles set email_weekly_notes_enabled = false where email like 'weekly-%';
update public.app_settings set value = 'true'::jsonb where key = 'weekly_notes_enabled';

-- 3. The job, with the switch on ----------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_p timestamptz := (select t0 from _t0) + interval '1 hour';
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'notification_service_role_key' limit 1);
  v_q record;
  v_body jsonb;
begin
  perform pg_temp.mk('job1', v_t0 - interval '30 days');
  perform pg_temp.mk('job2', v_t0 - interval '30 days');
  perform pg_temp.mk('job3', v_t0 - interval '30 days');

  if public.enqueue_weekly_notes(v_p) <> 3 then
    raise exception 'FAIL: the job should ask about all three new members';
  end if;
  select * into v_q from net.http_request_queue
   where id > (select net_before from _t0)
     and convert_from(body, 'UTF8')::jsonb->>'user_email' = pg_temp.em('job1');
  v_body := convert_from(v_q.body, 'UTF8')::jsonb;
  if v_q.url <> 'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-email'
     or v_q.headers->>'Authorization' <> 'Bearer ' || v_key
     or v_q.headers->>'Content-Type' <> 'application/json' then
    raise exception 'FAIL: the job did not call send-email with the bearer key: % %', v_q.url, v_q.headers;
  end if;
  if v_body->>'type' <> 'weekly_notes' or jsonb_typeof(v_body->'weekly') <> 'object'
     or (v_body->'weekly'->>'run_at')::timestamptz <> v_p
     or v_body ? 'title' or v_body ? 'body' then
    raise exception 'FAIL: the payload is wrong: %', v_body;
  end if;
  if (select polled_at from public.weekly_notes_polls where email = pg_temp.em('job1')) <> v_p then
    raise exception 'FAIL: the job did not write a poll row';
  end if;
  -- The job only asks; send-email claims. Nothing is in the ledger yet.
  if pg_temp.sent('job1') <> 0 then
    raise exception 'FAIL: the job wrote a ledger row itself';
  end if;

  -- The same run again (or an overlapping one) asks about nobody.
  if public.enqueue_weekly_notes(v_p) <> 0 or public.enqueue_weekly_notes(v_p + interval '19 hours') <> 0 then
    raise exception 'FAIL: a member was asked about twice inside 20 hours';
  end if;
  if pg_temp.posts('job1') <> 1 then
    raise exception 'FAIL: expected one call for job1, got %', pg_temp.posts('job1');
  end if;
  -- Two runs that overlap (both read the candidates before either wrote its
  -- poll row) are kept apart by the poll claim's guard: the second run's
  -- insert finds the first run's row and changes nothing. One session
  -- cannot reproduce that timing (here the candidates already leave the
  -- member out), so check the guard is in the job.
  -- (20 hours less the 10 minutes' allowance for a run that starts a moment
  -- early, from 20261018172000.)
  if position($g$where w.polled_at <= p_now - (interval '20 hours' - interval '10 minutes')$g$ in
              pg_get_functiondef('public.enqueue_weekly_notes(timestamptz, integer)'::regprocedure)) = 0 then
    raise exception 'FAIL: the job no longer guards its poll claim against an overlapping run';
  end if;

  -- 20 hours later each is asked again, p_limit at a time, oldest poll first.
  if public.enqueue_weekly_notes(v_p + interval '20 hours', 1) <> 1 then
    raise exception 'FAIL: p_limit 1 should ask about exactly one member';
  end if;
  if public.enqueue_weekly_notes(v_p + interval '20 hours', 0) <> 0 then
    raise exception 'FAIL: p_limit 0 should ask about nobody';
  end if;
  if public.enqueue_weekly_notes(v_p + interval '20 hours', 5) <> 2 then
    raise exception 'FAIL: the other two should be asked about 20 hours later';
  end if;
  if pg_temp.posts('job1') <> 2 or pg_temp.posts('job2') <> 2 or pg_temp.posts('job3') <> 2 then
    raise exception 'FAIL: each member should have been asked about twice';
  end if;

  -- What a skip in send-email leaves (no postal address, a failed check,
  -- a caught-up member): poll rows and no ledger row. Nothing was used up,
  -- so the first real claim is still step 1.
  if pg_temp.sent('job1') <> 0 then
    raise exception 'FAIL: a skipped run used up a note';
  end if;
  if (public.claim_weekly_note(pg_temp.em('job1'), array['first', 'second'], v_p + interval '40 hours')->>'step')::int <> 1 then
    raise exception 'FAIL: after skipped runs the first claim should be step 1';
  end if;
  -- Claimed: no further call for 7 days.
  if pg_temp.cand('job1', v_p + interval '6 days') or not pg_temp.cand('job1', v_p + interval '40 hours' + interval '7 days') then
    raise exception 'FAIL: the 7-day gap after a claimed note is wrong';
  end if;
end $$;

select pg_temp.retire('job1');
select pg_temp.retire('job2');
select pg_temp.retire('job3');

-- 4. The claim ---------------------------------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_e text := pg_temp.mk('claim', (select t0 from _t0) - interval '30 days');
  v jsonb;
begin
  v := public.claim_weekly_note(upper(v_e), array['a', 'b'], v_t0);
  if v->>'slug' <> 'a' or (v->>'step')::int <> 1 or (v->>'has_gecko')::boolean is not false then
    raise exception 'FAIL: the first claim should be step 1 slug a with no gecko: %', v;
  end if;
  if (select email from public.weekly_notes_sends where email = v_e and slug = 'a') <> v_e then
    raise exception 'FAIL: the ledger row is not stored under the lower-case address';
  end if;

  -- A repeat at the same moment, or days later: inside the 7-day gap.
  v := public.claim_weekly_note(v_e, array['a', 'b'], v_t0);
  if v->>'reason' <> 'not-eligible' or v ? 'slug' then
    raise exception 'FAIL: a repeat claim should be not-eligible: %', v;
  end if;
  v := public.claim_weekly_note(v_e, array['a', 'b'], v_t0 + interval '6 days 23 hours');
  if v->>'reason' <> 'not-eligible' then
    raise exception 'FAIL: a claim inside 7 days should be not-eligible: %', v;
  end if;
  if pg_temp.sent('claim') <> 1 then
    raise exception 'FAIL: a refused claim wrote a ledger row';
  end if;

  -- 7 days later, the next one.
  v := public.claim_weekly_note(v_e, array['a', 'b'], v_t0 + interval '7 days');
  if v->>'slug' <> 'b' or (v->>'step')::int <> 2 then
    raise exception 'FAIL: the second claim should be step 2 slug b: %', v;
  end if;

  -- Caught up: nothing written, nothing used up.
  v := public.claim_weekly_note(v_e, array['a', 'b'], v_t0 + interval '14 days');
  if v->>'reason' <> 'caught-up' or pg_temp.sent('claim') <> 2 then
    raise exception 'FAIL: a caught-up member should get caught-up and no row: % (% rows)', v, pg_temp.sent('claim');
  end if;
  -- A caught-up member is asked again about a day later (no note was sent
  -- in the last 7 days), and the next note written reaches them then.
  if not pg_temp.cand('claim', v_t0 + interval '14 days 21 hours') then
    raise exception 'FAIL: a caught-up member should still be a candidate';
  end if;
  v := public.claim_weekly_note(v_e, array['a', 'b', 'c'], v_t0 + interval '14 days 21 hours');
  if v->>'slug' <> 'c' or (v->>'step')::int <> 3 then
    raise exception 'FAIL: a newly written note should go to a caught-up member: %', v;
  end if;
end $$;

do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_e text := pg_temp.mk('insert', (select t0 from _t0) - interval '30 days');
  v_l text := pg_temp.mk('lifecycle', (select t0 from _t0) - interval '30 days');
  v_g text := pg_temp.mk('gecko', (select t0 from _t0) - interval '30 days');
  v_p text := pg_temp.mk('pollfirst', (select t0 from _t0) - interval '30 days');
  v jsonb;
  v_bad text[];
begin
  -- An unsent note placed earlier in the catalog goes first; its step is
  -- where it sits now.
  insert into public.weekly_notes_sends (email, step, slug, created_date) values
    (v_e, 1, 'a', v_t0 - interval '20 days'),
    (v_e, 2, 'b', v_t0 - interval '10 days');
  v := public.claim_weekly_note(v_e, array['a', 'new', 'b', 'c'], v_t0);
  if v->>'slug' <> 'new' or (v->>'step')::int <> 2 then
    raise exception 'FAIL: the earlier unsent note should be picked first: %', v;
  end if;

  -- A bad catalog is refused and writes nothing.
  for v_bad in
    select c from (values
      (array['Bad Slug', 'x']), (array['a', 'a']), (array['ok', 'trailing-']), (array['under_score']),
      (array[repeat('a', 65)])
    ) as bad(c)
  loop
    v := public.claim_weekly_note(v_g, v_bad, v_t0);
    if v->>'reason' <> 'bad-catalog' then
      raise exception 'FAIL: % should be bad-catalog, got %', v_bad, v;
    end if;
  end loop;
  if public.claim_weekly_note(v_g, '{}'::text[], v_t0)->>'reason' <> 'bad-catalog'
     or public.claim_weekly_note(v_g, null, v_t0)->>'reason' <> 'bad-catalog'
     or public.claim_weekly_note(v_g, array[null::text], v_t0)->>'reason' <> 'bad-catalog'
     or public.claim_weekly_note(v_g, array[array['a', 'b'], array['c', 'd']], v_t0)->>'reason' <> 'bad-catalog' then
    raise exception 'FAIL: an empty, null or two-dimensional catalog should be bad-catalog';
  end if;
  if public.claim_weekly_note('  ', array['a'], v_t0)->>'reason' <> 'no-email' then
    raise exception 'FAIL: a blank address should be no-email';
  end if;
  if pg_temp.sent('gecko') <> 0 then
    raise exception 'FAIL: a refused catalog wrote a ledger row';
  end if;

  -- A lifecycle email 10 hours earlier.
  insert into public.lifecycle_email_sends (email, step, created_date) values (v_l, 'day14', v_t0 - interval '10 hours');
  if public.claim_weekly_note(v_l, array['a'], v_t0)->>'reason' <> 'not-eligible' or pg_temp.sent('lifecycle') <> 0 then
    raise exception 'FAIL: a claim 10 hours after a lifecycle email should be not-eligible';
  end if;

  -- has_gecko follows the gecko's owner, whatever the address's case.
  insert into public.geckos (id, name, created_by, created_date, morphs_traits)
  values ('weekly-gecko-' || left(gen_random_uuid()::text, 8), 'Mango', upper(v_g), v_t0, 'Lilly White Harlequin');
  v := public.claim_weekly_note(v_g, array['a'], v_t0);
  if (v->>'has_gecko')::boolean is not true then
    raise exception 'FAIL: has_gecko should be true for a member with a gecko: %', v;
  end if;

  -- The claim runs right after the job wrote the poll row; the poll must
  -- not block it.
  insert into public.weekly_notes_polls (email, polled_at) values (v_p, v_t0);
  if public.claim_weekly_note(v_p, array['a'], v_t0)->>'slug' <> 'a' then
    raise exception 'FAIL: the job''s own poll row blocked the claim';
  end if;

  -- The member's weekly switch is checked by the claim too.
  perform pg_temp.retire('lifecycle');
  update public.lifecycle_email_sends set created_date = v_t0 - interval '30 days' where email = v_l;
  if public.claim_weekly_note(v_l, array['a'], v_t0)->>'reason' <> 'not-eligible' then
    raise exception 'FAIL: a member who stopped weekly notes can still be claimed for';
  end if;
end $$;

-- 4b. The ledger row carries the run's time, not the claim's -----------------------
--
-- The job asks at the run's clock (its p_now, written to the poll row) and
-- send-email claims a few seconds later. Stamped with the claim's own
-- clock, the member would be left out one week later at the same minute
-- and every note would come an hour after the last.
do $$
declare
  v_t0 timestamptz := (select t0 from _t0) + interval '50 minutes';
  v_e text := pg_temp.mk('stamp', (select t0 from _t0) - interval '30 days');
  v_late text := pg_temp.mk('stamplate', (select t0 from _t0) - interval '30 days');
  v jsonb;
begin
  insert into public.weekly_notes_polls (email, polled_at) values (v_e, v_t0);
  v := public.claim_weekly_note(v_e, array['a', 'b'], v_t0 + interval '3 seconds');
  if v->>'slug' <> 'a' then
    raise exception 'FAIL: the stamp member should get note a: %', v;
  end if;
  if (select created_date from public.weekly_notes_sends where email = v_e and slug = 'a') <> v_t0 then
    raise exception 'FAIL: the ledger row should carry the run''s time %, got %', v_t0,
      (select created_date from public.weekly_notes_sends where email = v_e and slug = 'a');
  end if;
  -- The same minute one week later: due again, so the next note keeps its hour.
  if not pg_temp.cand('stamp', v_t0 + interval '7 days') then
    raise exception 'FAIL: one week after a note, at the same minute, the member should be due again';
  end if;
  v := public.claim_weekly_note(v_e, array['a', 'b'], v_t0 + interval '7 days 4 seconds');
  if v->>'slug' <> 'b' then
    raise exception 'FAIL: the second note should go a week after the first: %', v;
  end if;

  -- A poll from more than an hour before the claim is not this run's: the
  -- claim's own time is used.
  insert into public.weekly_notes_polls (email, polled_at) values (v_late, v_t0 - interval '2 hours');
  perform public.claim_weekly_note(v_late, array['a'], v_t0);
  if (select created_date from public.weekly_notes_sends where email = v_late) <> v_t0 then
    raise exception 'FAIL: an old poll should not set the ledger time';
  end if;
end $$;
select pg_temp.retire('stamp');
select pg_temp.retire('stamplate');

-- 4c. One address, two profile rows (an imported row that differs in case) ----------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_e text := pg_temp.mk('dupe', (select t0 from _t0) - interval '30 days');
  v_upper text;
begin
  v_upper := upper(left(v_e, 1)) || substr(v_e, 2);
  insert into public.profiles (email, full_name, email_notifications_enabled, created_date)
  values (v_upper, 'Imported Keeper', true, v_t0 - interval '400 days');
  if not pg_temp.cand('dupe', v_t0) then
    raise exception 'FAIL: a member with two profile rows, both on, should be a candidate';
  end if;
  -- The stop link turns off the row send-email found (the lower-case one).
  update public.profiles set email_weekly_notes_enabled = false where email = v_e;
  if pg_temp.cand('dupe', v_t0) or public.claim_weekly_note(v_e, array['a'], v_t0)->>'reason' <> 'not-eligible' then
    raise exception 'FAIL: the imported row kept weekly notes going after the member stopped them';
  end if;
  update public.profiles set email_weekly_notes_enabled = true where email = v_e;
  update public.profiles set email_weekly_notes_enabled = false where email = v_upper;
  if pg_temp.cand('dupe', v_t0) then
    raise exception 'FAIL: either row being off should stop the notes';
  end if;
end $$;
select pg_temp.retire('dupe');

-- 5. Never twice ---------------------------------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_e text := pg_temp.mk('twice', (select t0 from _t0) - interval '30 days');
  v1 jsonb;
  v2 jsonb;
begin
  v1 := public.claim_weekly_note(v_e, array['a', 'b'], v_t0);
  v2 := public.claim_weekly_note(v_e, array['a', 'b'], v_t0);
  if v1->>'slug' <> 'a' or v2 ? 'slug' or pg_temp.sent('twice') <> 1 then
    raise exception 'FAIL: two claims at the same moment should leave exactly one row: % %', v1, v2;
  end if;
  -- And the key itself refuses a second row for the same note.
  begin
    insert into public.weekly_notes_sends (email, step, slug, created_date) values (v_e, 9, 'a', v_t0 + interval '30 days');
    raise exception 'FAIL: the ledger accepted the same note twice';
  exception when unique_violation then null;
  end;
  -- Upper-case addresses and bad slugs cannot get in by hand either.
  begin
    insert into public.weekly_notes_sends (email, step, slug) values (upper(v_e), 1, 'z');
    raise exception 'FAIL: the ledger accepted an upper-case address';
  exception when check_violation then null;
  end;
  begin
    insert into public.weekly_notes_sends (email, step, slug) values (v_e, 1, 'Not A Slug');
    raise exception 'FAIL: the ledger accepted a bad slug';
  exception when check_violation then null;
  end;
end $$;

-- 6. "Stop Weekly Gecko Notes" ----------------------------------------------------
select pg_temp.mk('unsub', now() - interval '30 days');
select pg_temp.mk('tamper', now() - interval '30 days');
create temp table _tok on commit drop as
  select public.email_unsubscribe_token((select id from public.profiles where email = pg_temp.em('unsub'))) as good,
         public.email_unsubscribe_token((select id from public.profiles where email = pg_temp.em('tamper'))) as other;
grant all on _tok to public;

do $$
begin
  if (select good from _tok) is null then
    raise exception 'FAIL: no unsubscribe token (is email_unsubscribe_secret in the Vault?)';
  end if;
end $$;

select pg_temp.as_anon();
do $$
declare
  v_good text := (select good from _tok);
  v_bad text := (select other from _tok);
begin
  if public.unsubscribe_weekly_notes_by_token(v_good) is not true then
    raise exception 'FAIL: a valid token did not stop weekly notes';
  end if;
  if public.unsubscribe_weekly_notes_by_token(v_good) is not true then
    raise exception 'FAIL: a repeat of a valid token should return true again';
  end if;
  -- One changed character in the signature.
  v_bad := left(v_bad, length(v_bad) - 1) || case when right(v_bad, 1) = '0' then '1' else '0' end;
  if public.unsubscribe_weekly_notes_by_token(v_bad) is not false
     or public.unsubscribe_weekly_notes_by_token('nonsense') is not false
     or public.unsubscribe_weekly_notes_by_token(null) is not false then
    raise exception 'FAIL: a tampered or malformed token was accepted';
  end if;
end $$;
select pg_temp.as_postgres();

do $$
declare v record;
begin
  select email_weekly_notes_enabled, email_notifications_enabled, email_weekly_notes_choice_at into v
    from public.profiles where email = pg_temp.em('unsub');
  if v.email_weekly_notes_enabled is not false or v.email_notifications_enabled is not true then
    raise exception 'FAIL: the weekly unsubscribe should turn off weekly notes only: %', row_to_json(v);
  end if;
  -- Stopping is the member's choice: it is recorded, so the region rule
  -- never acts on this member again.
  if v.email_weekly_notes_choice_at is distinct from now() then
    raise exception 'FAIL: the weekly unsubscribe should record the choice: %', row_to_json(v);
  end if;
  select email_weekly_notes_enabled, email_notifications_enabled, email_weekly_notes_choice_at into v
    from public.profiles where email = pg_temp.em('tamper');
  if v.email_weekly_notes_enabled is not true or v.email_notifications_enabled is not true
     or v.email_weekly_notes_choice_at is not null then
    raise exception 'FAIL: a tampered token changed a profile: %', row_to_json(v);
  end if;
  if pg_temp.cand('unsub', now()) then
    raise exception 'FAIL: a member who stopped weekly notes is still a candidate';
  end if;
end $$;

-- 6b. Stopping all email stops the notes for good ------------------------------------
--
-- The all-email link (every lifecycle and notification email, and the
-- second button on the stop page) and the Settings master switch turn the
-- weekly switch off too. Turning email back on, or a stale Settings tab
-- saving the old master value, does not restart the notes; only the
-- member's own weekly switch does.
select pg_temp.mk('allstop', now() - interval '30 days');
select pg_temp.mk('masteroff', now() - interval '30 days');
create temp table _tok2 on commit drop as
  select public.email_unsubscribe_token((select id from public.profiles where email = pg_temp.em('allstop'))) as good;
grant all on _tok2 to public;

select pg_temp.as_anon();
do $$
begin
  if public.unsubscribe_email_by_token((select good from _tok2)) is not true then
    raise exception 'FAIL: the all-email unsubscribe refused a valid token';
  end if;
end $$;
select pg_temp.as_postgres();

do $$
declare v record;
begin
  select email_weekly_notes_enabled, email_notifications_enabled into v
    from public.profiles where email = pg_temp.em('allstop');
  if v.email_notifications_enabled is not false or v.email_weekly_notes_enabled is not false then
    raise exception 'FAIL: the all-email unsubscribe should stop the weekly notes too: %', row_to_json(v);
  end if;
end $$;

-- The member turns email back on (or an old Settings tab saves master on).
select pg_temp.as_member('allstop');
update public.profiles set email_notifications_enabled = true where email = pg_temp.em('allstop');
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('allstop')) is not false
     or pg_temp.cand('allstop', now()) then
    raise exception 'FAIL: turning email back on restarted the weekly notes';
  end if;
end $$;

-- Only the member's own weekly switch brings them back.
select pg_temp.as_member('allstop');
update public.profiles set email_weekly_notes_enabled = true where email = pg_temp.em('allstop');
select pg_temp.as_postgres();
do $$
begin
  if not pg_temp.cand('allstop', now()) then
    raise exception 'FAIL: a member who turned the weekly switch back on is not a candidate';
  end if;
end $$;

-- The Settings master switch, saved by the member under row security.
select pg_temp.as_member('masteroff');
update public.profiles set email_notifications_enabled = false, bio = 'Keeps Lilly Whites' where email = pg_temp.em('masteroff');
update public.profiles set email_notifications_enabled = true where email = pg_temp.em('masteroff');
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('masteroff')) is not false then
    raise exception 'FAIL: switching all email off in Settings should stop the weekly notes';
  end if;
  -- A save that leaves email on (the whole-form Save) changes nothing.
  update public.profiles set email_weekly_notes_enabled = true where email = pg_temp.em('masteroff');
  update public.profiles set email_notifications_enabled = true, bio = 'Keeps Harlequins' where email = pg_temp.em('masteroff');
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('masteroff')) is not true then
    raise exception 'FAIL: a save with email still on turned the weekly notes off';
  end if;
end $$;
select pg_temp.retire('allstop');
select pg_temp.retire('masteroff');

-- 7. A member changes their own switch, never someone else's ---------------------
select pg_temp.as_member('tamper');
do $$
begin
  update public.profiles set email_weekly_notes_enabled = false where email = pg_temp.em('tamper');
  update public.profiles set email_weekly_notes_enabled = true where email = pg_temp.em('unsub');
end $$;
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('tamper')) is not false then
    raise exception 'FAIL: a member could not turn off their own weekly notes';
  end if;
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('unsub')) is not false then
    raise exception 'FAIL: a member changed another member''s weekly notes switch';
  end if;
end $$;
select pg_temp.as_member('tamper');
update public.profiles set email_weekly_notes_enabled = true where email = pg_temp.em('tamper');
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('tamper')) is not true then
    raise exception 'FAIL: a member could not turn their weekly notes back on';
  end if;
end $$;

-- 8. New members start with weekly notes on ----------------------------------------
do $$
declare v_e text := pg_temp.mk('fresh', now());
begin
  if (select email_weekly_notes_enabled from public.profiles where email = v_e) is not true then
    raise exception 'FAIL: a new member should start with weekly notes on';
  end if;
  if (select email_weekly_notes_choice_at from public.profiles where email = v_e) is not null then
    raise exception 'FAIL: a member who signed up with no box should have no recorded choice';
  end if;
  insert into public.profiles (email) values ('weekly-bare@example.com');
  if (select email_weekly_notes_enabled from public.profiles where email = 'weekly-bare@example.com') is not true then
    raise exception 'FAIL: a profile inserted without the column should default to on';
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'email_weekly_notes_enabled' and is_nullable = 'YES'
  ) then
    raise exception 'FAIL: email_weekly_notes_enabled should be not null';
  end if;
end $$;

-- 9. The two series never overlap ------------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_e text := pg_temp.mk('series', (select t0 from _t0) - interval '20 days');
begin
  insert into public.weekly_notes_sends (email, step, slug, created_date) values (v_e, 1, 'a', v_t0 - interval '1 day');
  if exists (select 1 from public.lifecycle_email_candidates(v_t0) where email = v_e) then
    raise exception 'FAIL: a member with a weekly note is due a lifecycle email';
  end if;
  -- And a member inside the lifecycle window is never a weekly candidate.
  if exists (
    select 1 from public.lifecycle_email_candidates(v_t0) l
      join public.weekly_notes_candidates(v_t0, true) w on w.email = l.email
  ) then
    raise exception 'FAIL: someone is a candidate for both series at once';
  end if;
end $$;

-- 10. Deleting an account erases the weekly notes rows -----------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_e text := pg_temp.mk('erase', (select t0 from _t0) - interval '30 days');
  v_keep text := pg_temp.mk('keep', (select t0 from _t0) - interval '30 days');
  v_before jsonb;
  v_after jsonb;
begin
  perform public.claim_weekly_note(v_e, array['a'], v_t0);
  perform public.claim_weekly_note(v_keep, array['a'], v_t0);
  insert into public.weekly_notes_polls (email, polled_at) values (v_e, v_t0), (v_keep, v_t0);
  perform public.record_email_event('sent', 'sent:re_weekly_erase', 're_weekly_erase', v_e, 'weekly_notes', v_t0);
  perform public.record_email_event('complained', 'msg_weekly_erase', 're_weekly_erase', v_e, 'weekly_notes', v_t0 + interval '1 hour');
  select jsonb_agg(to_jsonb(s) order by s.week, s.email_type) into v_before from public.email_delivery_stats s;

  perform public.admin_erase_account(v_e);

  if exists (select 1 from public.weekly_notes_sends where email = v_e)
     or exists (select 1 from public.weekly_notes_polls where email = v_e) then
    raise exception 'FAIL: the weekly notes rows survived erasure';
  end if;
  if pg_temp.sent('keep') <> 1 or not exists (select 1 from public.weekly_notes_polls where email = v_keep) then
    raise exception 'FAIL: erasure removed another member''s weekly notes rows';
  end if;
  if exists (select 1 from public.profiles where lower(email) = v_e) then
    raise exception 'FAIL: the profile (and its weekly switch) survived erasure';
  end if;
  select jsonb_agg(to_jsonb(s) order by s.week, s.email_type) into v_after from public.email_delivery_stats s;
  if v_after is distinct from v_before then
    raise exception 'FAIL: erasure changed the delivery counts: % then %', v_before, v_after;
  end if;
  if not public.email_is_suppressed(v_e) then
    raise exception 'FAIL: erasure removed the suppression';
  end if;
end $$;

-- 11. Who can read and run what ---------------------------------------------------
select pg_temp.mk('admin', now(), 'Admin', p_role => 'admin');
select pg_temp.mk('member', now());

select pg_temp.as_member('member');
do $$
begin
  if exists (select 1 from public.weekly_notes_sends) or exists (select 1 from public.weekly_notes_polls) then
    raise exception 'FAIL: a member can read the weekly notes ledger or polls';
  end if;
  begin
    insert into public.weekly_notes_sends (email, step, slug) values ('x@example.com', 1, 'a');
    raise exception 'FAIL: a member can write to the ledger';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.weekly_notes_polls (email, polled_at) values ('x@example.com', now());
    raise exception 'FAIL: a member can write to the polls';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.weekly_notes_candidates();
    raise exception 'FAIL: a member can call weekly_notes_candidates';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_weekly_note(pg_temp.em('member'), array['a']);
    raise exception 'FAIL: a member can call claim_weekly_note';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.enqueue_weekly_notes();
    raise exception 'FAIL: a member can call enqueue_weekly_notes';
  exception when insufficient_privilege then null;
  end;
  -- The region rule is the one weekly function a member may run, on
  -- their own profile (block 12b).
  if public.weekly_notes_region_default(false) is distinct from 'unchanged' then
    raise exception 'FAIL: a member should be able to run weekly_notes_region_default';
  end if;
end $$;

select pg_temp.as_anon();
do $$
begin
  begin
    perform 1 from public.weekly_notes_sends;
    raise exception 'FAIL: a signed-out visitor can read the ledger';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.weekly_notes_candidates();
    raise exception 'FAIL: a signed-out visitor can call weekly_notes_candidates';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.claim_weekly_note('x@example.com', array['a']);
    raise exception 'FAIL: a signed-out visitor can call claim_weekly_note';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.enqueue_weekly_notes();
    raise exception 'FAIL: a signed-out visitor can call enqueue_weekly_notes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.weekly_notes_region_default(true);
    raise exception 'FAIL: a signed-out visitor can call weekly_notes_region_default';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_member('admin');
do $$
begin
  if not exists (select 1 from public.weekly_notes_sends) or not exists (select 1 from public.weekly_notes_polls) then
    raise exception 'FAIL: an admin cannot read the weekly notes ledger and polls';
  end if;
end $$;
select pg_temp.as_postgres();

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'weekly-notes-hourly' and schedule = '50 * * * *'
                   and command like '%enqueue_weekly_notes()%') then
    raise exception 'FAIL: the weekly-notes-hourly job is not scheduled at 50 past';
  end if;
end $$;

-- 12. The admin numbers: weekly notes show as one email type ----------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_e text := pg_temp.mk('stats', (select t0 from _t0) - interval '30 days');
  v_row record;
begin
  -- Three weeks on, so block 10's events are in another week.
  v_t0 := v_t0 + interval '21 days';
  perform public.record_email_event('sent', 'sent:re_weekly_1', 're_weekly_1', v_e, 'weekly_notes', v_t0);
  perform public.record_email_event('delivered', 'msg_weekly_1', 're_weekly_1', null, null, v_t0);
  perform public.record_email_event('opened', 'msg_weekly_2', 're_weekly_1', null, null, v_t0 + interval '1 hour');
  select * into v_row from public.email_delivery_stats
   where email_type = 'weekly_notes' and week = (date_trunc('week', v_t0 at time zone 'utc'))::date;
  if v_row.sent <> 1 or v_row.delivered <> 1 or v_row.opened <> 1 then
    raise exception 'FAIL: email_delivery_stats is wrong for weekly_notes: %', row_to_json(v_row);
  end if;
end $$;

-- 12b. Members in the EEA and the UK: the sign-up box, the region rule and
--      the recorded choice
--
-- Decision of 18 Oct 2026 (docs/planning/weekly-notes-2026-10.md, section
-- 1). The sign-up form sends its box as weekly_notes_at_signup in the
-- sign-up metadata, and the profile is made with it as the member's
-- choice. Google sign-in sends no box, which is no choice. For a member
-- who never chose, the app calls weekly_notes_region_default(true) when
-- the browser is in the EEA or the UK, and the notes go off. A recorded
-- choice (the box, the Settings switch, the stop link) is never overridden.
select pg_temp.mk('box_on', now() - interval '30 days', p_meta => '{"full_name":"Ana Keeper","weekly_notes_at_signup":true}');
select pg_temp.mk('box_off', now() - interval '30 days', p_meta => '{"full_name":"Ben Keeper","weekly_notes_at_signup":false}');
select pg_temp.mk('google', now() - interval '30 days',
                  p_meta => '{"full_name":"Cat Keeper","avatar_url":"https://example.com/cat.png","email_verified":true}');
select pg_temp.mk('box_text', now() - interval '30 days', p_meta => '{"weekly_notes_at_signup":"false"}');
select pg_temp.mk('eea_new', now() - interval '30 days');
select pg_temp.mk('eea_other', now() - interval '30 days');
select pg_temp.mk('us', now() - interval '30 days');
select pg_temp.mk('settings', now() - interval '30 days');
-- Profile rows that existed before the account (imported), so the sign-up
-- trigger's insert does nothing and the box waits for the first sign-in.
select pg_temp.mk('pre_off', now() - interval '30 days', p_meta => '{"weekly_notes_at_signup":false}', p_profile_first => true);
select pg_temp.mk('pre_on', now() - interval '30 days', p_meta => '{"weekly_notes_at_signup":true}', p_profile_first => true);
update public.profiles set email_weekly_notes_enabled = false where email = pg_temp.em('pre_on');

-- The box is saved with the profile.
do $$
declare
  v record;
  v_id uuid;
  v_email text;
begin
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('box_on');
  if v.is_on is not true or v.chosen_at is distinct from now() then
    raise exception 'FAIL: a ticked sign-up box should save the notes on, as a choice: %', row_to_json(v);
  end if;
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('box_off');
  if v.is_on is not false or v.chosen_at is distinct from now() then
    raise exception 'FAIL: an unticked sign-up box should save the notes off, as a choice: %', row_to_json(v);
  end if;
  if pg_temp.cand('box_off', now()) or not pg_temp.cand('box_on', now()) then
    raise exception 'FAIL: the sign-up box should decide who is a candidate';
  end if;
  -- Google sign-in, and a box that is not a JSON true or false: no choice,
  -- so the default (on) and room for the region rule.
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('google');
  if v.is_on is not true or v.chosen_at is not null then
    raise exception 'FAIL: a Google sign-up should keep the default with no choice: %', row_to_json(v);
  end if;
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('box_text');
  if v.is_on is not true or v.chosen_at is not null then
    raise exception 'FAIL: a box that is not true or false should count as no choice: %', row_to_json(v);
  end if;
  -- The sign-up trigger still does its old job: the name from the
  -- metadata (full_name, or Google's name), created_by, and the dates.
  v_id := gen_random_uuid();
  v_email := 'weekly-trigger-' || left(v_id::text, 8) || '@example.com';
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', '{"provider":"email","providers":["email"]}'::jsonb,
          '{"full_name":"  Dee Keeper  ","weekly_notes_at_signup":false}'::jsonb, now(), now());
  select full_name, created_by, created_date, email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at
    into v from public.profiles where email = v_email;
  if v.full_name is distinct from 'Dee Keeper' or v.created_by is distinct from v_email
     or v.created_date is distinct from now() or v.is_on is not false or v.chosen_at is distinct from now() then
    raise exception 'FAIL: the sign-up trigger should fill the profile and save the box: %', row_to_json(v);
  end if;
  v_id := gen_random_uuid();
  v_email := 'weekly-trigger-' || left(v_id::text, 8) || '@example.com';
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', '{"provider":"google","providers":["google"]}'::jsonb,
          '{"name":"Eve Keeper","email_verified":true}'::jsonb, now(), now());
  select full_name, email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at
    into v from public.profiles where email = v_email;
  if v.full_name is distinct from 'Eve Keeper' or v.is_on is not true or v.chosen_at is not null then
    raise exception 'FAIL: a Google sign-up should get its name and the default with no choice: %', row_to_json(v);
  end if;
  update public.profiles set email_weekly_notes_enabled = false where email like 'weekly-trigger-%';
  -- A profile that already existed is left alone at sign-up.
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('pre_off');
  if v.is_on is not true or v.chosen_at is not null then
    raise exception 'FAIL: the sign-up trigger changed a profile that already existed: %', row_to_json(v);
  end if;
  if not pg_temp.cand('eea_new', now()) or not pg_temp.cand('eea_other', now()) then
    raise exception 'FAIL: members with no choice should start as candidates';
  end if;
end $$;

-- The region rule turns the notes off for a member who never chose, and
-- records no choice.
select pg_temp.as_member('eea_new');
do $$
declare v text;
begin
  v := public.weekly_notes_region_default(true);
  if v is distinct from 'region-off' then
    raise exception 'FAIL: the region rule should turn off a member with no choice, got %', v;
  end if;
  -- A second call (another tab) changes nothing.
  v := public.weekly_notes_region_default(true);
  if v is distinct from 'unchanged' then
    raise exception 'FAIL: a second region call should change nothing, got %', v;
  end if;
end $$;
select pg_temp.as_postgres();
do $$
declare v record;
begin
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('eea_new');
  if v.is_on is not false or v.chosen_at is not null then
    raise exception 'FAIL: the region rule should turn the notes off without recording a choice: %', row_to_json(v);
  end if;
  if pg_temp.cand('eea_new', now()) then
    raise exception 'FAIL: a member the region rule turned off is still a candidate';
  end if;
  -- Never another member: nothing in the call names one.
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('eea_other');
  if v.is_on is not true or v.chosen_at is not null or not pg_temp.cand('eea_other', now()) then
    raise exception 'FAIL: the region rule changed another member: %', row_to_json(v);
  end if;
end $$;

-- Outside the region nothing changes for a member with no box.
select pg_temp.as_member('us');
do $$
begin
  if public.weekly_notes_region_default(false) is distinct from 'unchanged' then
    raise exception 'FAIL: outside the region the call should change nothing';
  end if;
end $$;
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('us')) is not true then
    raise exception 'FAIL: a member outside the region lost the default';
  end if;
end $$;

-- Never after an explicit choice: the sign-up box ...
select pg_temp.as_member('box_on');
do $$
begin
  if public.weekly_notes_region_default(true) is distinct from 'chosen' then
    raise exception 'FAIL: the region rule should leave a ticked sign-up box alone';
  end if;
end $$;
-- ... even when the sign-up metadata is edited later: the box is saved once.
select pg_temp.as_postgres();
update auth.users set raw_user_meta_data = '{"weekly_notes_at_signup":true}' where email = pg_temp.em('box_off');
select pg_temp.as_member('box_off');
do $$
begin
  if public.weekly_notes_region_default(false) is distinct from 'chosen' then
    raise exception 'FAIL: edited sign-up metadata should not change a recorded choice';
  end if;
end $$;
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('box_on')) is not true
     or (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('box_off')) is not false then
    raise exception 'FAIL: the region rule or the metadata overrode a sign-up choice';
  end if;
end $$;

-- ... the Settings switch (the browser's clock is replaced with the
-- database's) ...
select pg_temp.as_member('settings');
update public.profiles
   set email_weekly_notes_enabled = true, email_weekly_notes_choice_at = '2001-01-01T00:00:00Z'
 where email = pg_temp.em('settings');
do $$
begin
  if public.weekly_notes_region_default(true) is distinct from 'chosen' then
    raise exception 'FAIL: the region rule should leave a Settings choice alone';
  end if;
end $$;
-- A later save that does not touch the choice keeps its time.
update public.profiles set bio = 'Keeps Axanthics' where email = pg_temp.em('settings');
select pg_temp.as_postgres();
do $$
declare v record;
begin
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('settings');
  if v.is_on is not true or v.chosen_at is distinct from now() then
    raise exception 'FAIL: a Settings choice should be kept, on the database clock: %', row_to_json(v);
  end if;
end $$;

-- ... and the stop link (block 6): the member later turns the notes back
-- on in Settings, and the region rule leaves that alone too.
select pg_temp.as_member('unsub');
do $$
begin
  if public.weekly_notes_region_default(true) is distinct from 'chosen' then
    raise exception 'FAIL: the region rule should leave a member who used the stop link alone';
  end if;
  update public.profiles
     set email_weekly_notes_enabled = true, email_weekly_notes_choice_at = now()
   where email = pg_temp.em('unsub');
  if public.weekly_notes_region_default(true) is distinct from 'chosen' then
    raise exception 'FAIL: the region rule should leave a member who turned the notes back on alone';
  end if;
end $$;
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('unsub')) is not true then
    raise exception 'FAIL: the region rule overrode a member who turned the notes back on';
  end if;
end $$;

-- A member the region rule turned off can still turn the notes on.
select pg_temp.as_member('eea_new');
update public.profiles
   set email_weekly_notes_enabled = true, email_weekly_notes_choice_at = now()
 where email = pg_temp.em('eea_new');
do $$
begin
  if public.weekly_notes_region_default(true) is distinct from 'chosen' then
    raise exception 'FAIL: after turning the notes on the region rule should leave the member alone';
  end if;
end $$;
select pg_temp.as_postgres();
do $$
begin
  if not pg_temp.cand('eea_new', now()) then
    raise exception 'FAIL: a member who turned the notes on after the region rule is not a candidate';
  end if;
end $$;

-- A profile that existed before sign-up: the box is saved on the first
-- sign-in, inside the region or not, and wins over the region rule.
select pg_temp.as_member('pre_off');
do $$
begin
  if public.weekly_notes_region_default(false) is distinct from 'signup-choice' then
    raise exception 'FAIL: an unsaved sign-up box should be saved on the first sign-in';
  end if;
  if public.weekly_notes_region_default(false) is distinct from 'chosen' then
    raise exception 'FAIL: a saved sign-up box should be saved only once';
  end if;
end $$;
select pg_temp.as_member('pre_on');
do $$
begin
  if public.weekly_notes_region_default(true) is distinct from 'signup-choice' then
    raise exception 'FAIL: a ticked box in the region should be saved as the choice';
  end if;
end $$;
select pg_temp.as_postgres();
do $$
declare v record;
begin
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('pre_off');
  if v.is_on is not false or v.chosen_at is distinct from now() then
    raise exception 'FAIL: the unticked box should be saved off as a choice: %', row_to_json(v);
  end if;
  select email_weekly_notes_enabled as is_on, email_weekly_notes_choice_at as chosen_at into v
    from public.profiles where email = pg_temp.em('pre_on');
  if v.is_on is not true or v.chosen_at is distinct from now() then
    raise exception 'FAIL: the ticked box should be saved on as a choice (consent in the region): %', row_to_json(v);
  end if;
end $$;

-- With no sign-in there is nobody to act for.
do $$
begin
  if public.weekly_notes_region_default(true) is distinct from 'not-signed-in' then
    raise exception 'FAIL: the region rule acted with no signed-in caller';
  end if;
end $$;

select pg_temp.retire('box_on');
select pg_temp.retire('google');
select pg_temp.retire('box_text');
select pg_temp.retire('eea_new');
select pg_temp.retire('eea_other');
select pg_temp.retire('us');
select pg_temp.retire('settings');
select pg_temp.retire('pre_on');
select pg_temp.retire('unsub');

-- 13. The one-time backfill, and the file run twice ---------------------------
--
-- Back to the moment before the column existed: four members whose
-- announcement setting differs, then the migration file itself. The
-- sign-up trigger goes back to its baseline definition (20260410025954),
-- which knows nothing of the weekly columns.
drop trigger profiles_weekly_notes_follow_email_off on public.profiles;
drop trigger profiles_weekly_notes_stamp_choice on public.profiles;
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.email is null or new.email = '' then
    return new;
  end if;
  insert into public.profiles (email, full_name, created_by, created_date, updated_date)
  values (
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), ''),
    new.email,
    now(),
    now()
  )
  on conflict (email) do nothing;
  return new;
end;
$function$;
drop function public.weekly_notes_region_default(boolean);
alter table public.profiles drop column email_weekly_notes_enabled;
alter table public.profiles drop column email_weekly_notes_choice_at;
select pg_temp.mk('bf_on', now() - interval '30 days');
select pg_temp.mk('bf_off', now() - interval '30 days');
select pg_temp.mk('bf_null', now() - interval '30 days');
select pg_temp.mk('bf_empty', now() - interval '30 days');
select pg_temp.mk('bf_master', now() - interval '30 days');
update public.profiles set email_notification_types = array['announcements', 'breeding_updates'] where email = pg_temp.em('bf_on');
-- Announcements on, but all email off (the all-email unsubscribe).
update public.profiles set email_notification_types = array['announcements'], email_notifications_enabled = false
 where email = pg_temp.em('bf_master');
update public.profiles set email_notification_types = array['breeding_updates'] where email = pg_temp.em('bf_off');
update public.profiles set email_notification_types = null where email = pg_temp.em('bf_null');
update public.profiles set email_notification_types = '{}'::text[] where email = pg_temp.em('bf_empty');

\ir ../migrations/20261018002200_weekly_notes.sql

do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('bf_on')) is not true then
    raise exception 'FAIL: a member with announcements on should start with weekly notes on';
  end if;
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('bf_off')) is not false
     or (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('bf_null')) is not false
     or (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('bf_empty')) is not false then
    raise exception 'FAIL: a member with announcements off (or an empty or null list) should start opted out';
  end if;
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('bf_master')) is not false then
    raise exception 'FAIL: a member with all email off should start opted out, so turning email on later does not start the notes';
  end if;
  -- Nobody who was there before has a recorded choice, so the region rule
  -- can reach them when they next sign in.
  if exists (select 1 from public.profiles where email like 'weekly-bf%' and email_weekly_notes_choice_at is not null) then
    raise exception 'FAIL: the migration recorded a choice for an existing member';
  end if;
end $$;

-- Members change their minds; a second run of the file must not undo it.
update public.profiles set email_weekly_notes_enabled = false, email_weekly_notes_choice_at = now() where email = pg_temp.em('bf_on');
update public.profiles set email_weekly_notes_enabled = true where email = pg_temp.em('bf_off');

\ir ../migrations/20261018002200_weekly_notes.sql
\ir ../migrations/20261018002300_erase_weekly_notes.sql

do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('bf_on')) is not false
     or (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('bf_off')) is not true then
    raise exception 'FAIL: running the migration again changed a member''s choice';
  end if;
  if (select count(*) from cron.job where jobname = 'weekly-notes-hourly') <> 1
     or (select value from public.app_settings where key = 'weekly_notes_enabled') <> 'true'::jsonb then
    raise exception 'FAIL: a second run duplicated the job or reset the switch';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.profiles'::regclass
        and tgname = 'profiles_weekly_notes_follow_email_off' and not tgisinternal) <> 1 then
    raise exception 'FAIL: the stop-all trigger should exist exactly once after a second run';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.profiles'::regclass
        and tgname = 'profiles_weekly_notes_stamp_choice' and not tgisinternal) <> 1 then
    raise exception 'FAIL: the choice-time trigger should exist exactly once after a second run';
  end if;
  if (select email_weekly_notes_choice_at from public.profiles where email = pg_temp.em('bf_on')) is distinct from now()
     or (select email_weekly_notes_choice_at from public.profiles where email = pg_temp.em('bf_off')) is not null then
    raise exception 'FAIL: running the migration again changed a recorded choice';
  end if;
end $$;

-- After both runs the sign-up trigger saves the box again.
select pg_temp.mk('bf_box', now(), p_meta => '{"weekly_notes_at_signup":false}');
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = pg_temp.em('bf_box')) is not false
     or (select email_weekly_notes_choice_at from public.profiles where email = pg_temp.em('bf_box')) is distinct from now() then
    raise exception 'FAIL: after the migration ran twice the sign-up box is not saved';
  end if;
end $$;

select 'weekly notes regressions: all passed' as result;
rollback;
