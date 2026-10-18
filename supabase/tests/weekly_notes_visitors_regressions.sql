-- Weekly Gecko Notes for visitors without an account: the table closed to
-- the public API, the form's database step and its rate limits, the
-- confirmation link, who may get a note, the shared ledger with members,
-- the stop link, the hourly job, the daily cleanup and erasure. Regression
-- checks for supabase/migrations/20261018120000_weekly_notes_visitors.sql and
-- 20261018150000_weekly_notes_visitor_fixes.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser,
-- the same way as supabase/tests/weekly_notes_regressions.sql: it moves the
-- clock with the p_now argument the functions take and switches roles the
-- way the API does. Every change rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/weekly_notes_visitors_regressions.sql
--
-- send-email's visitor branch and the subscribe-weekly-notes function are
-- tested in src/lib/__tests__/weeklyNotesVisitors.test.js.
--
-- Section 11 covers the fixes in 20261018150000_weekly_notes_visitor_fixes.sql
-- (the review of 18 Oct 2026).
--
-- Each block raises "FAIL: ..." when a rule is broken. The last line
-- prints "weekly notes visitor regressions: all passed".
begin;

create temp table _t0 on commit drop as
  select date_trunc('hour', now()) - interval '200 days' as t0,
         coalesce((select max(id) from net.http_request_queue), 0) as net_before;
grant all on _t0 to public;

create temp table _tok (tag text primary key, token text) on commit drop;
grant all on _tok to public;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create function pg_temp.as_member(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  perform set_config('role', 'postgres', true);
  select id into v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_id, 'email', p_email, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end $$;

-- A member account, as Supabase Auth makes one.
create function pg_temp.mk_member(p_email text, p_at timestamptz) returns void language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', p_email,
          'not-a-real-password', p_at, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, p_at, p_at);
  if not exists (select 1 from public.profiles where email = p_email) then
    insert into public.profiles (email) values (p_email);
  end if;
  update public.profiles set email_notifications_enabled = true where email = p_email;
end $$;

-- Ask on the form and keep the link, as the edge function would email it.
create function pg_temp.ask(p_tag text, p_email text, p_at timestamptz, p_ip text default null)
returns text language plpgsql as $$
declare v jsonb;
begin
  v := public.request_weekly_notes_signup(p_email, 'morph-detail', p_ip, p_at);
  if v ? 'token' then
    insert into _tok values (p_tag, v->>'token') on conflict (tag) do update set token = excluded.token;
  end if;
  return v->>'status';
end $$;

create function pg_temp.tok(p_tag text) returns text language sql as $$
  select token from _tok where tag = p_tag
$$;

create function pg_temp.vcand(p_email text, p_at timestamptz, p_ignore_polls boolean default false)
returns boolean language sql as $$
  select exists (select 1 from public.weekly_notes_subscriber_candidates(p_at, p_ignore_polls) c where c.email = p_email)
$$;

grant execute on all functions in schema pg_temp to public;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notification_service_role_key') then
    perform vault.create_secret('local-test-key', 'notification_service_role_key', 'test');
  end if;
  if not exists (select 1 from vault.secrets where name = 'email_unsubscribe_secret') then
    perform vault.create_secret('local-unsubscribe-secret', 'email_unsubscribe_secret', 'test');
  end if;
end $$;

-- 1. The table is closed to the public API --------------------------------------
select pg_temp.as_anon();
do $$
begin
  begin
    insert into public.newsletter_subscribers (email, weekly_notes_requested_at, confirmed_at)
    values ('stranger@example.com', now(), now());
    raise exception 'FAIL: a signed-out visitor inserted a confirmed subscriber';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform 1 from public.newsletter_subscribers;
    raise exception 'FAIL: a signed-out visitor can read the subscriber list';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.request_weekly_notes_signup('x@example.com', 'p', null, now());
    raise exception 'FAIL: a signed-out visitor can call the form''s database step';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.weekly_notes_subscriber_token('x@example.com');
    raise exception 'FAIL: a signed-out visitor can make a stop-link token';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.admin_erase_weekly_notes_visitor('x@example.com');
    raise exception 'FAIL: a signed-out visitor can erase a subscriber';
  exception when insufficient_privilege then
    null;
  end;
end $$;
select pg_temp.as_postgres();

select pg_temp.mk_member('visitor-admin@example.com', now() - interval '400 days');
update public.profiles set role = 'admin' where email = 'visitor-admin@example.com';
select pg_temp.mk_member('visitor-plain@example.com', now() - interval '400 days');

insert into public.newsletter_subscribers (email, source) values ('guide-reader@example.com', 'homepage');

select pg_temp.as_member('visitor-plain@example.com');
do $$
begin
  if exists (select 1 from public.newsletter_subscribers) then
    raise exception 'FAIL: a member who is not an admin can read the subscriber list';
  end if;
  begin
    update public.newsletter_subscribers set confirmed_at = now();
    raise exception 'FAIL: a member can update the subscriber list';
  exception when insufficient_privilege then
    null;
  end;
end $$;
select pg_temp.as_member('visitor-admin@example.com');
do $$
begin
  if not exists (select 1 from public.newsletter_subscribers where email = 'guide-reader@example.com') then
    raise exception 'FAIL: an admin cannot read the subscriber list';
  end if;
end $$;
select pg_temp.as_postgres();

-- 2. The form's database step ---------------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_row public.newsletter_subscribers%rowtype;
  v jsonb;
begin
  if public.request_weekly_notes_signup('not an address', null, null, v_t0)->>'status' <> 'bad-email' then
    raise exception 'FAIL: a bad address was not refused';
  end if;

  if pg_temp.ask('ana', ' Ana@Example.com ', v_t0, 'net-a') <> 'confirm' then
    raise exception 'FAIL: a new address should get a confirmation';
  end if;
  select * into v_row from public.newsletter_subscribers where email = 'ana@example.com';
  if v_row.id is null or v_row.weekly_notes_requested_at <> v_t0 or v_row.confirmed_at is not null
     or v_row.source <> 'notes:morph-detail' or v_row.weekly_notes_source <> 'morph-detail'
     or v_row.confirm_sent_at <> v_t0 then
    raise exception 'FAIL: the new row is not what the form should make: %', row_to_json(v_row);
  end if;
  if v_row.confirm_token_hash <> encode(extensions.digest(pg_temp.tok('ana'), 'sha256'), 'hex') then
    raise exception 'FAIL: the stored hash is not the hash of the link';
  end if;
  if position(pg_temp.tok('ana') in row_to_json(v_row)::text) > 0 then
    raise exception 'FAIL: the link itself is stored';
  end if;
  if length(pg_temp.tok('ana')) < 40 or pg_temp.tok('ana') !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'FAIL: the link token is short or not URL-safe: %', pg_temp.tok('ana');
  end if;
  if (select count(*) from public.weekly_notes_signup_sends where email = 'ana@example.com' and kind = 'confirm') <> 1 then
    raise exception 'FAIL: the confirmation email was not logged';
  end if;

  -- Unconfirmed: not a candidate.
  if pg_temp.vcand('ana@example.com', v_t0 + interval '1 hour') then
    raise exception 'FAIL: an unconfirmed visitor is a candidate';
  end if;

  -- A second request replaces the link: the first one stops working.
  if pg_temp.ask('ana2', 'ana@example.com', v_t0 + interval '1 minute', 'net-a') <> 'confirm' then
    raise exception 'FAIL: a second request in a day should still get a confirmation';
  end if;
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('ana'), v_t0 + interval '2 minutes') <> 'invalid' then
    raise exception 'FAIL: an older link still works after a new one was sent';
  end if;
  -- A third request in 24 hours is refused and logs nothing.
  if pg_temp.ask('ana3', 'ana@example.com', v_t0 + interval '2 minutes', 'net-a') <> 'address-limit' then
    raise exception 'FAIL: a third email to one address in a day was not refused';
  end if;
  if (select count(*) from public.weekly_notes_signup_sends where email = 'ana@example.com') <> 2 then
    raise exception 'FAIL: a refused request was logged';
  end if;
  if pg_temp.tok('ana3') is not null then
    raise exception 'FAIL: a refused request made a link';
  end if;

  -- The network limit: ten emails an hour from one network.
  for i in 1..8 loop
    perform pg_temp.ask('n' || i, 'net-' || i || '@example.com', v_t0 + interval '3 minutes', 'net-a');
  end loop;
  if pg_temp.ask('n9', 'net-9@example.com', v_t0 + interval '4 minutes', 'net-a') <> 'network-limit' then
    raise exception 'FAIL: an eleventh email from one network in an hour was not refused';
  end if;
  if pg_temp.ask('n9b', 'net-9@example.com', v_t0 + interval '4 minutes', 'net-b') <> 'confirm' then
    raise exception 'FAIL: another network was refused';
  end if;
  if pg_temp.ask('n9c', 'net-10@example.com', v_t0 + interval '65 minutes', 'net-a') <> 'confirm' then
    raise exception 'FAIL: the network limit did not reset after an hour';
  end if;

  -- The guide form's row keeps its source and consent, and gets no notes
  -- until confirmed.
  if pg_temp.ask('guide', 'guide-reader@example.com', v_t0, null) <> 'confirm' then
    raise exception 'FAIL: a guide reader cannot ask for the notes';
  end if;
  select * into v_row from public.newsletter_subscribers where email = 'guide-reader@example.com';
  if v_row.source <> 'homepage' or v_row.weekly_notes_requested_at is null then
    raise exception 'FAIL: asking changed the guide row''s source or did not record the request';
  end if;
  if pg_temp.vcand('guide-reader@example.com', v_t0 + interval '1 hour') then
    raise exception 'FAIL: an unconfirmed guide reader is a candidate';
  end if;

  -- An address with an account gets the member email and no row.
  if pg_temp.ask('member', 'Visitor-Plain@example.com', v_t0, null) <> 'member' then
    raise exception 'FAIL: an address with an account was not told so';
  end if;
  if exists (select 1 from public.newsletter_subscribers where email = 'visitor-plain@example.com') then
    raise exception 'FAIL: an address with an account got a subscriber row';
  end if;
  if (select kind from public.weekly_notes_signup_sends where email = 'visitor-plain@example.com') <> 'member' then
    raise exception 'FAIL: the member email was not logged';
  end if;
end $$;

-- 3. The confirmation link -----------------------------------------------------------
-- Signed out, only the button's own function is open, and it uses the
-- database's clock (the tokens here were sent 200 days ago, so expired).
select pg_temp.as_anon();
do $$
begin
  begin
    perform public.confirm_weekly_notes_signup_at(pg_temp.tok('ana2'), now() - interval '200 days');
    raise exception 'FAIL: a signed-out visitor can confirm with a clock of their choosing';
  exception when insufficient_privilege then
    null;
  end;
  if public.confirm_weekly_notes_signup(pg_temp.tok('n2')) <> 'expired' then
    raise exception 'FAIL: the public confirm did not use the database clock';
  end if;
  if public.confirm_weekly_notes_signup('made-up-token-that-is-long-enough-to-pass') <> 'invalid' then
    raise exception 'FAIL: the public confirm accepted a made-up link';
  end if;
end $$;
select pg_temp.as_postgres();

do $$
declare v_t0 timestamptz := (select t0 from _t0);
begin
  if public.confirm_weekly_notes_signup_at('short', v_t0) <> 'invalid'
     or public.confirm_weekly_notes_signup_at(null, v_t0) <> 'invalid'
     or public.confirm_weekly_notes_signup_at(repeat('a', 43), v_t0) <> 'invalid' then
    raise exception 'FAIL: a made-up link was accepted';
  end if;
  -- Expired after 7 days.
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('n1'), v_t0 + interval '8 days') <> 'expired' then
    raise exception 'FAIL: an 8-day-old link was not expired';
  end if;
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('ana2'), v_t0 + interval '1 hour') <> 'confirmed' then
    raise exception 'FAIL: the latest link did not confirm';
  end if;
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('ana2'), v_t0 + interval '2 hours') <> 'already' then
    raise exception 'FAIL: a second press should say already';
  end if;
end $$;

do $$
declare v_t0 timestamptz := (select t0 from _t0);
begin
  if (select confirmed_at from public.newsletter_subscribers where email = 'ana@example.com') <> v_t0 + interval '1 hour' then
    raise exception 'FAIL: confirming did not record the time';
  end if;
  if not pg_temp.vcand('ana@example.com', v_t0 + interval '2 hours') then
    raise exception 'FAIL: a confirmed visitor is not a candidate';
  end if;
  -- Already subscribed: the form says so and makes no new link.
  if pg_temp.ask('ana4', 'ana@example.com', v_t0 + interval '2 days', null) <> 'already' or pg_temp.tok('ana4') is not null then
    raise exception 'FAIL: a subscribed visitor should get the already email and no link';
  end if;
end $$;

-- 4. Who is left out -----------------------------------------------------------------
do $$
declare v_t0 timestamptz := (select t0 from _t0);
begin
  perform pg_temp.ask('sup', 'suppressed@example.com', v_t0, null);
  perform public.confirm_weekly_notes_signup_at(pg_temp.tok('sup'), v_t0);
  if not pg_temp.vcand('suppressed@example.com', v_t0 + interval '1 hour') then
    raise exception 'FAIL: setup, the visitor should be a candidate before suppression';
  end if;
  insert into public.email_suppressions (email, reason) values ('suppressed@example.com', 'bounced');
  if pg_temp.vcand('suppressed@example.com', v_t0 + interval '1 hour') then
    raise exception 'FAIL: a suppressed address is a candidate';
  end if;

  -- A visitor who makes an account leaves the visitor list.
  perform pg_temp.ask('joiner', 'joiner@example.com', v_t0, null);
  perform public.confirm_weekly_notes_signup_at(pg_temp.tok('joiner'), v_t0);
  if not pg_temp.vcand('joiner@example.com', v_t0 + interval '1 hour') then
    raise exception 'FAIL: setup, the joiner should be a candidate';
  end if;
  perform pg_temp.mk_member('Joiner@example.com', v_t0 + interval '2 hours');
  if pg_temp.vcand('joiner@example.com', v_t0 + interval '3 hours') then
    raise exception 'FAIL: a visitor with an account is still a visitor candidate';
  end if;
  -- A link pressed after making an account says so.
  perform pg_temp.ask('joiner2', 'late-joiner@example.com', v_t0, null);
  perform pg_temp.mk_member('late-joiner@example.com', v_t0 + interval '1 hour');
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('joiner2'), v_t0 + interval '2 hours') <> 'member' then
    raise exception 'FAIL: confirming after making an account should say member';
  end if;
end $$;

-- 5. The claim and the shared ledger ---------------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v jsonb;
  v_slugs text[] := array['heat-is-the-bigger-risk', 'watch-the-weight-trend', 'fresh-cgd-every-feeding'];
begin
  v := public.claim_weekly_note_subscriber('ana@example.com', v_slugs, v_t0 + interval '3 hours');
  if v->>'slug' <> 'heat-is-the-bigger-risk' or (v->>'step')::int <> 1 then
    raise exception 'FAIL: the first claim should be the first slug, got %', v;
  end if;
  if public.claim_weekly_note_subscriber('ana@example.com', v_slugs, v_t0 + interval '4 hours')->>'reason' <> 'not-eligible' then
    raise exception 'FAIL: a second note within 7 days was not refused';
  end if;
  if pg_temp.vcand('ana@example.com', v_t0 + interval '6 days 23 hours', true) then
    raise exception 'FAIL: a visitor is a candidate within 7 days of a note';
  end if;
  v := public.claim_weekly_note_subscriber('ana@example.com', v_slugs, v_t0 + interval '7 days 3 hours');
  if v->>'slug' <> 'watch-the-weight-trend' then
    raise exception 'FAIL: the second claim a week later should be the next slug, got %', v;
  end if;
  if public.claim_weekly_note_subscriber('ana@example.com', array['bad slug'], v_t0 + interval '30 days')->>'reason' <> 'bad-catalog' then
    raise exception 'FAIL: a bad catalog was not refused';
  end if;
  if public.claim_weekly_note_subscriber('nobody@example.com', v_slugs, v_t0 + interval '30 days')->>'reason' <> 'not-eligible' then
    raise exception 'FAIL: an unknown address was not refused';
  end if;
  if public.claim_weekly_note_subscriber('guide-reader@example.com', v_slugs, v_t0 + interval '30 days')->>'reason' <> 'not-eligible' then
    raise exception 'FAIL: an unconfirmed guide reader could claim';
  end if;

  -- Caught up: no row.
  perform public.claim_weekly_note_subscriber('ana@example.com', v_slugs, v_t0 + interval '14 days 3 hours');
  if public.claim_weekly_note_subscriber('ana@example.com', v_slugs, v_t0 + interval '21 days 3 hours')->>'reason' <> 'caught-up' then
    raise exception 'FAIL: a caught-up visitor should get caught-up';
  end if;
  if (select count(*) from public.weekly_notes_sends where email = 'ana@example.com') <> 3 then
    raise exception 'FAIL: the visitor should have exactly three ledger rows';
  end if;

  -- The joiner had one note as a visitor; as a member the ledger skips it.
  insert into public.weekly_notes_sends (email, step, slug, created_date)
  values ('joiner@example.com', 1, 'heat-is-the-bigger-risk', v_t0 + interval '1 hour');
  update public.profiles set email_weekly_notes_enabled = true where email = 'Joiner@example.com';
  update auth.users set created_at = v_t0 - interval '20 days' where email = 'Joiner@example.com';
  v := public.claim_weekly_note('joiner@example.com', v_slugs, v_t0 + interval '9 days');
  if v->>'slug' <> 'watch-the-weight-trend' then
    raise exception 'FAIL: a member who had a note as a visitor got it again, or nothing: %', v;
  end if;
end $$;

-- 6. The stop link -----------------------------------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_token text := public.weekly_notes_subscriber_token('ANA@example.com');
  v_member_id text := (select id::text from public.profiles where email = 'visitor-plain@example.com');
begin
  if v_token is null or split_part(v_token, '.', 1) <> (select id::text from public.newsletter_subscribers where email = 'ana@example.com') then
    raise exception 'FAIL: the stop-link token should start with the subscriber id, got %', v_token;
  end if;
  if public.weekly_notes_subscriber_token('nobody@example.com') is not null then
    raise exception 'FAIL: an unknown address got a token';
  end if;
  -- A visitor's token is not a member's token, and the other way round.
  if public.unsubscribe_email_by_token(v_token) or public.unsubscribe_weekly_notes_by_token(v_token) then
    raise exception 'FAIL: a visitor stop link worked as a member link';
  end if;
  if public.unsubscribe_weekly_notes_subscriber(public.email_unsubscribe_token(v_member_id)) then
    raise exception 'FAIL: a member link worked as a visitor stop link';
  end if;
  insert into _tok values ('ana-stop', v_token);
end $$;

select pg_temp.as_anon();
do $$
begin
  if public.unsubscribe_weekly_notes_subscriber(pg_temp.tok('ana-stop') || 'x') then
    raise exception 'FAIL: a changed stop link worked';
  end if;
  if public.unsubscribe_weekly_notes_subscriber('not-a-uuid.abc') then
    raise exception 'FAIL: a malformed stop link worked';
  end if;
  if not public.unsubscribe_weekly_notes_subscriber(pg_temp.tok('ana-stop')) then
    raise exception 'FAIL: the stop link did not work signed out';
  end if;
  if not public.unsubscribe_weekly_notes_subscriber(pg_temp.tok('ana-stop')) then
    raise exception 'FAIL: pressing the stop link again should still say true';
  end if;
end $$;
select pg_temp.as_postgres();

do $$
declare v_t0 timestamptz := (select t0 from _t0);
begin
  if pg_temp.vcand('ana@example.com', v_t0 + interval '60 days', true) then
    raise exception 'FAIL: a visitor who stopped is still a candidate';
  end if;
  if (select confirm_token_hash from public.newsletter_subscribers where email = 'ana@example.com') is not null then
    raise exception 'FAIL: stopping did not kill the confirmation link';
  end if;
  -- Signing up again needs a new link, pressed.
  if pg_temp.ask('ana5', 'ana@example.com', v_t0 + interval '60 days', null) <> 'confirm' then
    raise exception 'FAIL: a visitor who stopped cannot sign up again';
  end if;
  if pg_temp.vcand('ana@example.com', v_t0 + interval '60 days 1 hour', true) then
    raise exception 'FAIL: asking again turned the notes back on without a click';
  end if;
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('ana5'), v_t0 + interval '60 days 1 hour') <> 'confirmed' then
    raise exception 'FAIL: the new link did not confirm';
  end if;
  if not pg_temp.vcand('ana@example.com', v_t0 + interval '60 days 2 hours', true) then
    raise exception 'FAIL: confirming again did not turn the notes back on';
  end if;
end $$;

-- 7. The hourly job ------------------------------------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_at timestamptz := (select t0 from _t0) + interval '90 days';
  v_body jsonb;
  v_n integer;
begin
  update public.app_settings set value = 'false'::jsonb where key = 'weekly_notes_enabled';
  if public.enqueue_weekly_notes(v_at) <> 0 then
    raise exception 'FAIL: the job asked with the switch off';
  end if;
  update public.app_settings set value = 'true'::jsonb where key = 'weekly_notes_enabled';
  -- Members out of the way, so only visitors are asked here.
  update public.profiles set email_weekly_notes_enabled = false;

  v_n := public.enqueue_weekly_notes(v_at, 50);
  select convert_from(q.body, 'UTF8')::jsonb into v_body
    from net.http_request_queue q
   where q.id > (select net_before from _t0)
     and convert_from(q.body, 'UTF8')::jsonb->>'user_email' = 'ana@example.com';
  if v_body is null then
    raise exception 'FAIL: the job did not ask about a confirmed visitor';
  end if;
  if v_body->>'type' <> 'weekly_notes' or v_body->'weekly'->>'audience' <> 'visitor'
     or (v_body->'weekly'->>'run_at')::timestamptz <> v_at then
    raise exception 'FAIL: the visitor call is not marked as a visitor run: %', v_body;
  end if;
  if exists (
    select 1 from net.http_request_queue q
     where q.id > (select net_before from _t0)
       and convert_from(q.body, 'UTF8')::jsonb->>'user_email' in ('guide-reader@example.com', 'suppressed@example.com', 'n1@example.com')
  ) then
    raise exception 'FAIL: the job asked about an unconfirmed or suppressed visitor';
  end if;
  if (select polled_at from public.weekly_notes_polls where email = 'ana@example.com') <> v_at then
    raise exception 'FAIL: the job did not write the visitor''s poll row';
  end if;
  if public.enqueue_weekly_notes(v_at + interval '1 hour', 50) <> 0 then
    raise exception 'FAIL: the job asked about a visitor again within 20 hours';
  end if;
  -- The claim right after the run is stamped with the run's time.
  if public.claim_weekly_note_subscriber('ana@example.com', array['heat-is-the-bigger-risk', 'watch-the-weight-trend',
       'fresh-cgd-every-feeding', 'shed-rhythm-by-stage'], v_at + interval '30 seconds')->>'slug' <> 'shed-rhythm-by-stage' then
    raise exception 'FAIL: the visitor should get the first note not yet had';
  end if;
  if (select created_date from public.weekly_notes_sends where email = 'ana@example.com' and slug = 'shed-rhythm-by-stage') <> v_at then
    raise exception 'FAIL: the claim was not stamped with the run''s time';
  end if;
end $$;

-- 8. The daily cleanup ------------------------------------------------------------------------
do $$
declare v_t0 timestamptz := (select t0 from _t0);
begin
  perform pg_temp.ask('stale', 'stale@example.com', v_t0, null);
  perform pg_temp.ask('stale-guide', 'guide-two@example.com', v_t0, null);
  update public.newsletter_subscribers set source = 'homepage' where email = 'guide-two@example.com';
  perform public.weekly_notes_visitor_cleanup(v_t0 + interval '29 days');
  if not exists (select 1 from public.newsletter_subscribers where email = 'stale@example.com' and confirm_token_hash is not null) then
    raise exception 'FAIL: the cleanup dropped a request younger than 30 days';
  end if;
  perform public.weekly_notes_visitor_cleanup(v_t0 + interval '31 days');
  if exists (select 1 from public.newsletter_subscribers where email = 'stale@example.com') then
    raise exception 'FAIL: the cleanup kept a row the notes form made that nobody confirmed';
  end if;
  if not exists (select 1 from public.newsletter_subscribers
                  where email = 'guide-two@example.com' and weekly_notes_requested_at is null and confirm_token_hash is null) then
    raise exception 'FAIL: the cleanup should keep a guide row but drop its unconfirmed request';
  end if;
  if not exists (select 1 from public.newsletter_subscribers where email = 'ana@example.com') then
    raise exception 'FAIL: the cleanup deleted a confirmed visitor';
  end if;
  if exists (select 1 from public.weekly_notes_signup_sends where created_at < v_t0 + interval '1 day') then
    raise exception 'FAIL: the cleanup kept send-log rows older than 30 days';
  end if;
  if (select count(*) from cron.job where jobname = 'weekly-notes-visitor-cleanup') <> 1 then
    raise exception 'FAIL: the cleanup job is not scheduled exactly once';
  end if;
end $$;

-- 9. Erasure ------------------------------------------------------------------------------------
select pg_temp.as_member('visitor-admin@example.com');
do $$
begin
  begin
    perform public.admin_erase_weekly_notes_visitor('ana@example.com');
    raise exception 'FAIL: an API call could erase a visitor';
  exception when insufficient_privilege then
    null;
  end;
end $$;
select pg_temp.as_postgres();

do $$
declare v jsonb;
begin
  v := public.admin_erase_weekly_notes_visitor('visitor-plain@example.com');
  if (v->>'erased')::boolean or v->>'reason' <> 'has-account' then
    raise exception 'FAIL: erasing an address with an account should be refused, got %', v;
  end if;
  v := public.admin_erase_weekly_notes_visitor(' ANA@example.com ');
  if not (v->>'erased')::boolean then
    raise exception 'FAIL: the visitor was not erased: %', v;
  end if;
  if exists (select 1 from public.newsletter_subscribers where email = 'ana@example.com')
     or exists (select 1 from public.weekly_notes_sends where email = 'ana@example.com')
     or exists (select 1 from public.weekly_notes_polls where email = 'ana@example.com')
     or exists (select 1 from public.weekly_notes_signup_sends where email = 'ana@example.com') then
    raise exception 'FAIL: erasure left rows behind';
  end if;
end $$;

-- 11. The review fixes (20261018150000) ------------------------------------------------------------
do $$
declare
  v_t0 timestamptz := (select t0 from _t0);
  v_at timestamptz := (select t0 from _t0) + interval '120 days';
  v jsonb;
  v_tok text;
  v_member_old timestamptz := now() - interval '40 days';
begin
  -- One inbox, one limit: plus tags and Gmail dots count together.
  if pg_temp.ask('bob1', 'bob+one@example.com', v_at, null) <> 'confirm'
     or pg_temp.ask('bob2', 'bob+two@example.com', v_at, null) <> 'confirm'
     or pg_temp.ask('bob3', 'Bob@example.com', v_at, null) <> 'address-limit' then
    raise exception 'FAIL: plus tags gave one inbox more than 2 emails a day';
  end if;
  if pg_temp.ask('g1', 'a.b.c@gmail.com', v_at, null) <> 'confirm'
     or pg_temp.ask('g2', 'abc+x@googlemail.com', v_at, null) <> 'confirm'
     or pg_temp.ask('g3', 'ab.c@gmail.com', v_at, null) <> 'address-limit' then
    raise exception 'FAIL: Gmail dots gave one inbox more than 2 emails a day';
  end if;
  if public.email_inbox_key(' A.B.C+news@GoogleMail.com ') <> 'abc@gmail.com'
     or public.email_inbox_key('first.last+x@example.com') <> 'first.last@example.com' then
    raise exception 'FAIL: the inbox key is wrong';
  end if;
  -- Odd characters are refused before anything is written.
  if pg_temp.ask('odd1', '<x>@example.com', v_at, null) <> 'bad-email'
     or pg_temp.ask('odd2', 'a b@example.com', v_at, null) <> 'bad-email'
     or pg_temp.ask('odd3', '"a"@example.com', v_at, null) <> 'bad-email'
     or pg_temp.ask('odd4', 'a@b@example.com', v_at, null) <> 'bad-email' then
    raise exception 'FAIL: an address with odd characters was accepted';
  end if;
  if pg_temp.ask('ok1', 'o''brien@example.co.uk', v_at, null) <> 'confirm' then
    raise exception 'FAIL: a real address with an apostrophe was refused';
  end if;

  -- Quiet: nothing for a suppressed address or a member with all email off.
  insert into public.email_suppressions (email, reason) values ('bounced@example.com', 'bounced');
  if pg_temp.ask('q1', 'bounced@example.com', v_at, null) <> 'quiet' then
    raise exception 'FAIL: the form would email an address that bounced';
  end if;
  perform pg_temp.mk_member('email-off@example.com', v_member_old);
  update public.profiles set email_notifications_enabled = false where email = 'email-off@example.com';
  if pg_temp.ask('q2', 'email-off@example.com', v_at, null) <> 'quiet' then
    raise exception 'FAIL: the form would email a member who turned all email off';
  end if;
  if exists (select 1 from public.weekly_notes_signup_sends where email in ('bounced@example.com', 'email-off@example.com')) then
    raise exception 'FAIL: a quiet request was logged as an email';
  end if;

  -- A half-finished sign-up is not a member.
  perform pg_temp.ask('half', 'half@example.com', v_at, null);
  perform public.confirm_weekly_notes_signup_at(pg_temp.tok('half'), v_at);
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'half@example.com',
          'x', null, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, v_at, v_at);
  if not pg_temp.vcand('half@example.com', v_at + interval '1 hour') then
    raise exception 'FAIL: an unconfirmed sign-up stopped a confirmed visitor''s notes';
  end if;

  -- A row marked confirmed before it ever asked is not trusted.
  insert into public.newsletter_subscribers (email, source, confirmed_at) values ('preconfirmed@example.com', 'homepage', v_t0);
  if pg_temp.ask('pre', 'preconfirmed@example.com', v_at, null) <> 'confirm' then
    raise exception 'FAIL: a pre-confirmed row should still get a confirmation link';
  end if;
  if pg_temp.vcand('preconfirmed@example.com', v_at + interval '1 hour', true) then
    raise exception 'FAIL: a row confirmed before the form became a candidate without a click';
  end if;
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('pre'), v_at) <> 'confirmed'
     or not pg_temp.vcand('preconfirmed@example.com', v_at + interval '1 hour', true) then
    raise exception 'FAIL: the click did not confirm the pre-confirmed row';
  end if;

  -- The cleanup counts from the newest link.
  perform pg_temp.ask('late1', 'late@example.com', v_at, null);
  perform pg_temp.ask('late2', 'late@example.com', v_at + interval '29 days', null);
  perform public.weekly_notes_visitor_cleanup(v_at + interval '31 days');
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('late2'), v_at + interval '31 days') <> 'confirmed' then
    raise exception 'FAIL: the cleanup killed a 2-day-old link';
  end if;

  -- The visitor claim records the catalog step.
  perform pg_temp.ask('steps', 'steps@example.com', v_at, null);
  perform public.confirm_weekly_notes_signup_at(pg_temp.tok('steps'), v_at);
  if public.claim_weekly_note_subscriber('steps@example.com', array['a-note', 'b-note'], v_at + interval '1 hour', array[1])->>'reason' <> 'bad-catalog' then
    raise exception 'FAIL: steps that do not match the slugs were accepted';
  end if;
  v := public.claim_weekly_note_subscriber('steps@example.com', array['a-note', 'b-note'], v_at + interval '1 hour', array[1, 4]);
  if (v->>'step')::int <> 1 then
    raise exception 'FAIL: the first claim should record step 1, got %', v;
  end if;
  v := public.claim_weekly_note_subscriber('steps@example.com', array['a-note', 'b-note'], v_at + interval '8 days', array[1, 4]);
  if (v->>'step')::int <> 4 or (select step from public.weekly_notes_sends where email = 'steps@example.com' and slug = 'b-note') <> 4 then
    raise exception 'FAIL: the visitor ledger did not record the catalog step, got %', v;
  end if;
end $$;

-- A visitor's stop holds once the address has an account.
do $$
declare
  v_old timestamptz := now() - interval '40 days';
  v_token text;
  v_id uuid;
begin
  -- A member (account 40 days old, notes on) who was a visitor first.
  perform pg_temp.mk_member('carry@example.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true where email = 'carry@example.com';
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('carry@example.com', 'notes:morph-detail', v_old - interval '30 days', v_old - interval '30 days');
  if not exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'carry@example.com') then
    raise exception 'FAIL: setup, the member should be a member candidate';
  end if;
  -- They press stop in an old visitor note.
  v_token := public.weekly_notes_subscriber_token('carry@example.com');
  if not public.unsubscribe_weekly_notes_subscriber(v_token) then
    raise exception 'FAIL: the visitor stop link did not work';
  end if;
  if (select email_weekly_notes_enabled from public.profiles where email = 'carry@example.com') is not false
     or (select email_weekly_notes_choice_at from public.profiles where email = 'carry@example.com') is null then
    raise exception 'FAIL: the visitor stop did not turn off the member switch and record the choice';
  end if;
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'carry@example.com') then
    raise exception 'FAIL: member notes would keep coming after a visitor stop';
  end if;

  -- A visitor who stopped, then joins with no choice (Google sign-in).
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
  values ('stopped-joiner@example.com', 'notes:care', v_old - interval '60 days', v_old - interval '60 days', v_old - interval '50 days');
  perform pg_temp.mk_member('stopped-joiner@example.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true, email_weekly_notes_choice_at = null where email = 'stopped-joiner@example.com';
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'stopped-joiner@example.com') then
    raise exception 'FAIL: a visitor who stopped got member notes after joining without choosing them';
  end if;
  -- Turning them on in Settings afterwards is a newer choice, and wins.
  update public.profiles set email_weekly_notes_choice_at = now() where email = 'stopped-joiner@example.com';
  if not exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'stopped-joiner@example.com') then
    raise exception 'FAIL: turning the notes on in Settings after a visitor stop did not count';
  end if;

  -- Erasure: a visitor's address leaves the delivery log; a member's
  -- account erasure removes the form's send log.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at) values ('erase-me@example.com', 'notes:care', now());
  insert into public.email_deliveries (event_key, email, email_type, event, detail)
  values ('sent:erase-me-1', 'erase-me@example.com', 'weekly_notes_signup_confirm', 'sent', '{"link":"x"}');
  perform public.admin_erase_weekly_notes_visitor('erase-me@example.com');
  if exists (select 1 from public.email_deliveries where email = 'erase-me@example.com')
     or (select detail from public.email_deliveries where event_key = 'sent:erase-me-1') <> '{}'::jsonb then
    raise exception 'FAIL: erasing a visitor left the address in the delivery log';
  end if;
  insert into public.weekly_notes_signup_sends (email, inbox_key, kind) values ('carry@example.com', 'carry@example.com', 'member');
  perform public.admin_erase_account('carry@example.com');
  if exists (select 1 from public.weekly_notes_signup_sends where email = 'carry@example.com') then
    raise exception 'FAIL: account erasure left the form''s send log';
  end if;
end $$;

-- 10. Running the fixes migration again changes nothing ------------------------------------------
select pg_temp.ask('rerun', 'rerun@example.com', now(), null);
select public.confirm_weekly_notes_signup_at(pg_temp.tok('rerun'), now());
\ir ../migrations/20261018150000_weekly_notes_visitor_fixes.sql
do $$
begin
  if not exists (select 1 from public.newsletter_subscribers where email = 'rerun@example.com' and confirmed_at is not null) then
    raise exception 'FAIL: running the migration again lost a confirmation';
  end if;
  if (select count(*) from cron.job where jobname = 'weekly-notes-visitor-cleanup') <> 1 then
    raise exception 'FAIL: running the migration again duplicated the cleanup job';
  end if;
  if (select count(*) from pg_policies where tablename = 'newsletter_subscribers') <> 1 then
    raise exception 'FAIL: the subscriber table should have exactly one policy (admin read)';
  end if;
  -- One function per name, so the API can never pick the old one.
  if (select count(*) from pg_proc where proname = 'confirm_weekly_notes_signup') <> 1
     or (select count(*) from pg_proc where proname = 'claim_weekly_note_subscriber') <> 1 then
    raise exception 'FAIL: an old confirm or claim function is still there';
  end if;
end $$;

select 'weekly notes visitor regressions: all passed' as result;
rollback;
