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
-- Section 11 covers the fixes in 20261018150000_weekly_notes_visitor_fixes.sql,
-- 20261018150100_weekly_notes_visitor_fixes_2.sql and
-- 20261018150200_weekly_notes_visitor_fixes_3.sql; section 12 covers
-- 20261018150300_weekly_notes_visitor_fixes_4.sql; section 13 covers
-- 20261018150400_weekly_notes_visitor_fixes_5.sql; section 14 covers
-- 20261024182000_weekly_notes_visitor_fixes_6.sql (the reviews of 18 Oct
-- 2026).
--
-- Each block raises "FAIL: ..." when a rule is broken. The last line
-- prints "weekly notes visitor regressions: all passed".
begin;

-- Test members count as signed in now, so the relevance gate from
-- 20261020230000 (a gecko on record or a sign-in within 60 days) lets them
-- through. The gate's own checks set last_sign_in_at themselves. Rolled
-- back with everything else.
alter table auth.users alter column last_sign_in_at set default now();

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
  if (select count(*) from public.weekly_notes_signup_sends
       where email in ('bounced@example.com', 'email-off@example.com') and kind = 'quiet') <> 2
     or exists (select 1 from public.weekly_notes_signup_sends
                 where email in ('bounced@example.com', 'email-off@example.com') and kind <> 'quiet') then
    raise exception 'FAIL: a quiet request should be logged as quiet, never as an email';
  end if;
  -- A quiet address meets the same limit as any other, so its replies match.
  if pg_temp.ask('q3', 'bounced@example.com', v_at, null) <> 'quiet'
     or pg_temp.ask('q4', 'bounced@example.com', v_at, null) <> 'address-limit' then
    raise exception 'FAIL: a quiet address does not reach the limit like other addresses';
  end if;
  -- The suppression list is checked by inbox.
  if pg_temp.ask('q5', 'Bounced+gecko@example.com', v_at + interval '2 days', null) <> 'quiet' then
    raise exception 'FAIL: a plus-tag variant of a suppressed inbox got a confirmation';
  end if;
  insert into public.email_suppressions (email, reason) values ('jane.doe+x@gmail.com', 'complained');
  if pg_temp.ask('q7', 'JaneDoe@googlemail.com', v_at, null) <> 'quiet' then
    raise exception 'FAIL: another spelling of a suppressed Gmail inbox got a confirmation';
  end if;
  -- A bounce on a plus-tag address outside Gmail (some providers refuse plus
  -- tags) does not silence the plain address.
  insert into public.email_suppressions (email, reason) values ('kim+geckos@yahoo.com', 'bounced');
  if pg_temp.ask('q8', 'kim@yahoo.com', v_at, null) <> 'confirm' then
    raise exception 'FAIL: a bounce on a plus-tag address silenced the plain address';
  end if;
  if public.email_inbox_suppressed('kim@yahoo.com')
     or not public.email_inbox_suppressed('kim+geckos@yahoo.com')
     or not public.email_inbox_suppressed('bounced+new@example.com')
     or not public.email_inbox_suppressed('j.a.n.e.d.o.e@gmail.com') then
    raise exception 'FAIL: email_inbox_suppressed matched the wrong addresses';
  end if;
  -- The visitor candidates use the same match.
  -- (A confirmed visitor whose plain address bounced later.)
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('later-bounce+notes@example.com', 'notes:care', v_at - interval '5 days', v_at - interval '5 days');
  if not pg_temp.vcand('later-bounce+notes@example.com', v_at, true) then
    raise exception 'FAIL: setup, the confirmed visitor should be a candidate';
  end if;
  insert into public.email_suppressions (email, reason) values ('later-bounce@example.com', 'bounced');
  if pg_temp.vcand('later-bounce+notes@example.com', v_at, true) then
    raise exception 'FAIL: a visitor address whose plain inbox bounced is a candidate';
  end if;
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('q8'), v_at) <> 'confirmed'
     or not pg_temp.vcand('kim@yahoo.com', v_at + interval '1 hour', true) then
    raise exception 'FAIL: a plus-tag bounce kept the plain address from its notes';
  end if;
  -- A member with all email off gets nothing, whichever spelling is typed.
  perform pg_temp.mk_member('Jane.Off@gmail.com', v_member_old);
  update public.profiles set email_notifications_enabled = false where email = 'Jane.Off@gmail.com';
  if pg_temp.ask('q9', 'janeoff+notes@gmail.com', v_at, null) <> 'quiet'
     or pg_temp.ask('q10', 'email-off+x@example.com', v_at + interval '2 days', null) <> 'quiet' then
    raise exception 'FAIL: another spelling of a member''s address got a confirmation after they turned all email off';
  end if;
  -- An imported profile with no login and email off can still sign up.
  insert into public.profiles (email, email_notifications_enabled) values ('imported-off@example.com', false);
  if pg_temp.ask('q6', 'imported-off@example.com', v_at, null) <> 'confirm' then
    raise exception 'FAIL: an imported profile with no login was treated as a member with email off';
  end if;
  -- International domains are accepted again.
  if pg_temp.ask('idn1', 'hans@müller.de', v_at, null) <> 'confirm'
     or pg_temp.ask('idn2', 'someone@example.xn--p1ai', v_at, null) <> 'confirm' then
    raise exception 'FAIL: an international or punycode domain was refused';
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

  -- A confirmation dated before the request (a row confirmed before the
  -- form, asked during the first release) is not a candidate.
  insert into public.newsletter_subscribers (email, source, confirmed_at, weekly_notes_requested_at)
  values ('window@example.com', 'homepage', v_t0, v_at);
  if pg_temp.vcand('window@example.com', v_at + interval '1 hour', true) then
    raise exception 'FAIL: a confirmation older than the request made a candidate';
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

  -- A visitor who stopped and asked again without pressing the link: the
  -- unpressed link goes after 30 days, the earlier sign-up and stop stay.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
  values ('again@example.com', 'notes:care', v_at - interval '20 days', v_at - interval '20 days', v_at - interval '10 days');
  perform pg_temp.ask('again', 'again@example.com', v_at, null);
  perform public.weekly_notes_visitor_cleanup(v_at + interval '31 days');
  if exists (select 1 from public.newsletter_subscribers where email = 'again@example.com'
              and (confirm_token_hash is not null or confirm_sent_at is not null))
     or not exists (select 1 from public.newsletter_subscribers where email = 'again@example.com'
                     and unsubscribed_at is not null and weekly_notes_requested_at is not null) then
    raise exception 'FAIL: the cleanup kept an unpressed link on a stopped row, or dropped the stop';
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
  -- The new profile starts with the notes off, and the stop is recorded as
  -- the member's choice, dated when they pressed it. Settings shows them off.
  if (select email_weekly_notes_enabled from public.profiles where email = 'stopped-joiner@example.com') is not false
     or (select email_weekly_notes_choice_at from public.profiles where email = 'stopped-joiner@example.com')
          is distinct from v_old - interval '50 days' then
    raise exception 'FAIL: a stopped visitor''s new profile did not start with the notes off and the stop as its choice';
  end if;
  -- Even if something switched it on without a newer choice, the member rule holds.
  update public.profiles set email_weekly_notes_enabled = true where email = 'stopped-joiner@example.com';
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'stopped-joiner@example.com') then
    raise exception 'FAIL: a visitor who stopped got member notes after joining without choosing them';
  end if;
  update public.profiles set email_weekly_notes_choice_at = null where email = 'stopped-joiner@example.com';
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'stopped-joiner@example.com') then
    raise exception 'FAIL: a visitor who stopped got member notes with no choice recorded';
  end if;
  -- Turning them on in Settings afterwards is a newer choice, and wins.
  update public.profiles set email_weekly_notes_choice_at = now() where email = 'stopped-joiner@example.com';
  if not exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'stopped-joiner@example.com') then
    raise exception 'FAIL: turning the notes on in Settings after a visitor stop did not count';
  end if;

  -- A ticked sign-up box does not undo a visitor stop.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
  values ('ticked@example.com', 'notes:care', v_old - interval '60 days', v_old - interval '60 days', v_old - interval '50 days');
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'ticked@example.com',
          'x', v_old, '{"provider":"email","providers":["email"]}'::jsonb, '{"weekly_notes_at_signup": true}'::jsonb, v_old, v_old);
  if (select email_weekly_notes_enabled from public.profiles where email = 'ticked@example.com') is not false
     or (select email_weekly_notes_choice_at from public.profiles where email = 'ticked@example.com') is null then
    raise exception 'FAIL: the sign-up box turned the notes back on after a visitor stop';
  end if;
  update public.profiles set email_notifications_enabled = true where email = 'ticked@example.com';

  -- An odd row cannot block a member: a stop on a row that never asked for
  -- the notes does not count (section 10 checks future dates are cleared).
  perform pg_temp.mk_member('odd-row@example.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true where email = 'odd-row@example.com';
  insert into public.newsletter_subscribers (email, source, unsubscribed_at) values ('odd-row@example.com', 'homepage', now() + interval '70 years');
  if not exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'odd-row@example.com') then
    raise exception 'FAIL: a guide-form row with a future stop blocked a member';
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

-- The first sign-in leaves the stop alone too: the app runs the region rule
-- when the sign-up box looks unsaved, and it must find the stop as a choice
-- instead of saving the ticked box over it.
select pg_temp.as_member('ticked@example.com');
do $$
declare v text;
begin
  v := public.weekly_notes_region_default(false);
  if v is distinct from 'chosen' then
    raise exception 'FAIL: the first sign-in after a visitor stop should find a choice, got %', v;
  end if;
  v := public.weekly_notes_region_default(true);
  if v is distinct from 'chosen' then
    raise exception 'FAIL: the region rule after a visitor stop should find a choice, got %', v;
  end if;
end $$;
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = 'ticked@example.com') is not false then
    raise exception 'FAIL: the first sign-in saved the ticked sign-up box over a visitor stop';
  end if;
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'ticked@example.com') then
    raise exception 'FAIL: a visitor who stopped would get member notes after signing in';
  end if;
end $$;

-- 12. The fourth review (20261018150300): an inbox is one person -------------------------------------
do $$
declare
  v_old timestamptz := now() - interval '40 days';
  v_at timestamptz := (select t0 from _t0) + interval '150 days';
  v_token text;
  v_id uuid;
begin
  -- Spam complaints silence every spelling of the inbox; bounces do not.
  insert into public.email_suppressions (email, reason) values ('lee+notes@outlook.com', 'complained');
  if pg_temp.ask('c1', 'lee@outlook.com', v_at, null) <> 'quiet'
     or not public.email_inbox_suppressed('lee+other@outlook.com') then
    raise exception 'FAIL: a spam complaint on a plus-tag address did not silence the same inbox';
  end if;
  if public.email_inbox_suppressed('kim+other@yahoo.com') then
    raise exception 'FAIL: a bounce on one plus tag silenced a different plus tag outside Gmail';
  end if;

  -- An unsubscribe older than the notes request is not a stop of the notes.
  insert into public.newsletter_subscribers (email, source, unsubscribed_at, weekly_notes_requested_at, confirm_sent_at)
  values ('old-unsub@example.com', 'homepage', v_old - interval '200 days', v_old - interval '25 days', v_old - interval '25 days');
  if public.weekly_notes_visitor_stop_at('old-unsub@example.com') is not null then
    raise exception 'FAIL: an unsubscribe older than the notes request counted as a stop';
  end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'old-unsub@example.com',
          'x', v_old, '{"provider":"email","providers":["email"]}'::jsonb, '{"weekly_notes_at_signup": true}'::jsonb, v_old, v_old);
  if (select email_weekly_notes_enabled from public.profiles where email = 'old-unsub@example.com') is not true then
    raise exception 'FAIL: an old unsubscribe overrode the ticked sign-up box';
  end if;

  -- A newer confirmation on any spelling ends the stop.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
  values ('re.joined@gmail.com', 'notes:care', v_old - interval '60 days', v_old - interval '60 days', v_old - interval '50 days'),
         ('rejoined+again@gmail.com', 'notes:care', v_old - interval '30 days', v_old - interval '30 days', null);
  if public.weekly_notes_visitor_stop_at('rejoined@gmail.com') is not null then
    raise exception 'FAIL: a stop followed by a newer sign-up on the same inbox still counted';
  end if;

  -- A stop on one spelling holds for a member on another: the new profile
  -- starts off, with the stop as its choice.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
  values ('stop.var@gmail.com', 'notes:care', v_old - interval '60 days', v_old - interval '60 days', v_old - interval '50 days');
  perform pg_temp.mk_member('stopvar+me@gmail.com', v_old);
  if (select email_weekly_notes_enabled from public.profiles where email = 'stopvar+me@gmail.com') is not false
     or (select email_weekly_notes_choice_at from public.profiles where email = 'stopvar+me@gmail.com')
          is distinct from v_old - interval '50 days' then
    raise exception 'FAIL: a visitor stop on another spelling did not hold for the new member';
  end if;
  update public.profiles set email_weekly_notes_enabled = true where email = 'stopvar+me@gmail.com';
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'stopvar+me@gmail.com') then
    raise exception 'FAIL: the member rule ignored a visitor stop on another spelling';
  end if;

  -- An inbox with an account is a member whichever spelling is typed.
  perform pg_temp.mk_member('jane.on@gmail.com', v_old);
  if pg_temp.ask('m1', 'janeon+x@gmail.com', v_at, null) <> 'member' then
    raise exception 'FAIL: another spelling of a member''s inbox was not answered as a member';
  end if;
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('j.aneon@gmail.com', 'notes:care', v_at - interval '5 days', v_at - interval '5 days');
  if pg_temp.vcand('j.aneon@gmail.com', v_at, true) then
    raise exception 'FAIL: another spelling of a member''s inbox is a visitor candidate (two series to one inbox)';
  end if;
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirm_token_hash, confirm_sent_at)
  values ('jan.eon@gmail.com', 'notes:care', v_at, encode(extensions.digest('member-variant-token-0123456789abcdef', 'sha256'), 'hex'), v_at);
  if public.confirm_weekly_notes_signup_at('member-variant-token-0123456789abcdef', v_at) <> 'member' then
    raise exception 'FAIL: the confirm button started visitor notes for another spelling of a member''s inbox';
  end if;

  -- A second spelling of an inbox that already gets the notes: "already",
  -- on the form and on the confirm button.
  perform pg_temp.ask('two1', 'two.ways@gmail.com', v_at, null);
  perform pg_temp.ask('two2', 'twoways+b@gmail.com', v_at, null);
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('two1'), v_at) <> 'confirmed'
     or public.confirm_weekly_notes_signup_at(pg_temp.tok('two2'), v_at) <> 'already' then
    raise exception 'FAIL: two spellings of one inbox could both start the notes';
  end if;
  if pg_temp.ask('two3', 'TwoWays@gmail.com', v_at + interval '2 days', null) <> 'already' then
    raise exception 'FAIL: the form offered a new sign-up to an inbox that already gets the notes';
  end if;

  -- A stop on another spelling, newer than this row's confirmation, holds
  -- for visitor candidates.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
  values ('pa.tk@gmail.com', 'notes:care', v_at - interval '20 days', v_at - interval '20 days', null),
         ('patk+old@gmail.com', 'notes:care', v_at - interval '30 days', v_at - interval '30 days', v_at - interval '2 days');
  if pg_temp.vcand('pa.tk@gmail.com', v_at, true) then
    raise exception 'FAIL: a newer stop on another spelling of the inbox did not hold';
  end if;

  -- The stop link records a choice on a profile already off with no
  -- choice (an imported row with no login), on any spelling of the inbox.
  insert into public.profiles (email, email_notifications_enabled, email_weekly_notes_enabled) values ('Imported.Off@gmail.com', true, false);
  perform pg_temp.ask('imp', 'importedoff@gmail.com', v_at, null);
  perform public.confirm_weekly_notes_signup_at(pg_temp.tok('imp'), v_at);
  v_token := public.weekly_notes_subscriber_token('importedoff@gmail.com');
  -- (Its own statement: a query reads the table as it was when it started.)
  if not public.unsubscribe_weekly_notes_subscriber(v_token) then
    raise exception 'FAIL: the visitor stop link did not work';
  end if;
  if (select email_weekly_notes_choice_at from public.profiles where email = 'Imported.Off@gmail.com') is null then
    raise exception 'FAIL: the stop link left a profile that was already off without a choice';
  end if;
  -- Then they make an account with the box ticked; the profile exists, so
  -- the insert does nothing and the first sign-in must keep the stop.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'Imported.Off@gmail.com',
          'x', v_old, '{"provider":"email","providers":["email"]}'::jsonb, '{"weekly_notes_at_signup": true}'::jsonb, v_old, v_old);

  -- The first-sign-in rule keeps a stop on a profile with no choice, even
  -- one no other step reached (the choice cleared by hand here).
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
  values ('late-guard@example.com', 'notes:care', v_old - interval '60 days', v_old - interval '60 days', v_old - interval '50 days');
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'late-guard@example.com',
          'x', v_old, '{"provider":"email","providers":["email"]}'::jsonb, '{"weekly_notes_at_signup": true}'::jsonb, v_old, v_old);
  update public.profiles set email_weekly_notes_choice_at = null, email_notifications_enabled = true where email = 'late-guard@example.com';

  -- Form log rows for every spelling of a member's inbox go with the account.
  perform pg_temp.mk_member('pat.lee@gmail.com', v_old);
  update public.profiles set email_notifications_enabled = false where email = 'pat.lee@gmail.com';
  if pg_temp.ask('pl1', 'patlee+geckos@gmail.com', v_at, null) <> 'quiet' then
    raise exception 'FAIL: setup, a member with email off should be quiet';
  end if;
  perform public.admin_erase_account('pat.lee@gmail.com');
  if exists (select 1 from public.weekly_notes_signup_sends where inbox_key = 'patlee@gmail.com') then
    raise exception 'FAIL: account erasure left form log rows for another spelling of the inbox';
  end if;
  -- And with a visitor erasure.
  perform pg_temp.ask('ve1', 'vis.erase@example.com', v_at, null);
  perform pg_temp.ask('ve2', 'vis.erase+x@example.com', v_at, null);
  perform public.admin_erase_weekly_notes_visitor('vis.erase@example.com');
  if exists (select 1 from public.weekly_notes_signup_sends where inbox_key = 'vis.erase@example.com') then
    raise exception 'FAIL: visitor erasure left form log rows for another spelling of the inbox';
  end if;

  -- The daily cleanup keeps the guide form's log 30 days.
  insert into public.guide_email_sends (email, created_at) values ('guide-old@example.com', now() - interval '31 days'),
                                                                   ('guide-new@example.com', now() - interval '29 days');
  perform public.weekly_notes_visitor_cleanup(now());
  if exists (select 1 from public.guide_email_sends where email = 'guide-old@example.com')
     or not exists (select 1 from public.guide_email_sends where email = 'guide-new@example.com') then
    raise exception 'FAIL: the cleanup did not keep the guide form''s log for exactly 30 days';
  end if;
end $$;

-- The first sign-in after a stop, on a profile that existed first and on
-- one whose choice was cleared: both find the stop and keep the notes off.
select pg_temp.as_member('Imported.Off@gmail.com');
do $$
declare v text;
begin
  v := public.weekly_notes_region_default(false);
  if v is distinct from 'chosen' then
    raise exception 'FAIL: the first sign-in saved the sign-up box over a stop on an existing profile, got %', v;
  end if;
end $$;
select pg_temp.as_member('late-guard@example.com');
do $$
declare v text;
begin
  v := public.weekly_notes_region_default(false);
  if v is distinct from 'chosen' then
    raise exception 'FAIL: the first-sign-in rule did not keep a visitor stop on a profile with no choice, got %', v;
  end if;
end $$;
select pg_temp.as_postgres();
do $$
begin
  if (select email_weekly_notes_enabled from public.profiles where email = 'Imported.Off@gmail.com') is not false
     or (select email_weekly_notes_enabled from public.profiles where email = 'late-guard@example.com') is not false
     or (select email_weekly_notes_choice_at from public.profiles where email = 'late-guard@example.com') is null then
    raise exception 'FAIL: a first sign-in turned the notes back on after a visitor stop';
  end if;
end $$;

-- Round 6 (20261024182000) checks that need a small table. They run here,
-- before the cost checks below add thousands of rows, because each
-- visitor-candidates call is slow once those rows exist.

-- The 7-day and 20-hour rules allow for a run that starts a moment early.
-- The hourly job stamps polls and the ledger with its start time, which
-- varies by a fraction of a second, so the run 7 days or 20 hours later
-- can start just before the exact mark (on 18 Oct: 22:50:00.098 against a
-- poll at 02:50:00.306).
do $$
declare
  v_old timestamptz := now() - interval '60 days';
  -- A run start like production's, with the fraction of a second.
  v_t timestamptz := (select t0 from _t0) + interval '180 days 50 minutes 0.324977 seconds';
  v_week timestamptz := v_t + interval '7 days' - interval '0.3 seconds';
  v_day timestamptz := v_t + interval '20 hours' - interval '0.2 seconds';
begin
  -- A member with last week's note.
  perform pg_temp.mk_member('drift.m6@example.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true where email = 'drift.m6@example.com';
  insert into public.weekly_notes_sends (email, step, slug, created_date) values ('drift.m6@example.com', 1, 'a-note', v_t);
  insert into public.weekly_notes_polls (email, polled_at) values ('drift.m6@example.com', v_t);
  if not exists (select 1 from public.weekly_notes_candidates(v_week) c where c.email = 'drift.m6@example.com') then
    raise exception 'FAIL: a run that started 0.3 seconds earlier than last week''s missed the member';
  end if;
  if exists (select 1 from public.weekly_notes_candidates(v_t + interval '7 days' - interval '15 minutes', true) c where c.email = 'drift.m6@example.com') then
    raise exception 'FAIL: the member 7-day rule let a note through 15 minutes early';
  end if;
  if (public.claim_weekly_note('drift.m6@example.com', array['a-note', 'b-note'], v_week))->>'slug' is distinct from 'b-note' then
    raise exception 'FAIL: the claim refused the run that started 0.3 seconds early';
  end if;

  -- A member asked about 20 hours ago and not sent anything.
  perform pg_temp.mk_member('drift.p6@example.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true where email = 'drift.p6@example.com';
  insert into public.weekly_notes_polls (email, polled_at) values ('drift.p6@example.com', v_t);
  if not exists (select 1 from public.weekly_notes_candidates(v_day) c where c.email = 'drift.p6@example.com') then
    raise exception 'FAIL: a run that started 0.2 seconds early skipped a member asked about 20 hours before';
  end if;
  if exists (select 1 from public.weekly_notes_candidates(v_t + interval '20 hours' - interval '15 minutes') c where c.email = 'drift.p6@example.com') then
    raise exception 'FAIL: the member 20-hour rule let an ask through 15 minutes early';
  end if;
  -- The job itself takes the address (its own poll check has the same
  -- allowance). The other members here are switched off for this one run,
  -- so the job's limit cannot leave this member out, then put back.
  create temp table _drift_on on commit drop as
    select email from public.profiles where email_weekly_notes_enabled is true and email <> 'drift.p6@example.com';
  update public.profiles set email_weekly_notes_enabled = false where email in (select email from _drift_on);
  perform public.enqueue_weekly_notes(v_day, 1000);
  update public.profiles set email_weekly_notes_enabled = true where email in (select email from _drift_on);
  if (select polled_at from public.weekly_notes_polls where email = 'drift.p6@example.com') <> v_day then
    raise exception 'FAIL: the job found the member but skipped it as already taken';
  end if;

  -- The same for a visitor.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('drift.v6@example.com', 'notes:care', v_t - interval '30 days', v_t - interval '30 days'),
         ('drift.vp6@example.com', 'notes:care', v_t - interval '30 days', v_t - interval '30 days');
  insert into public.weekly_notes_sends (email, step, slug, created_date) values ('drift.v6@example.com', 1, 'a-note', v_t);
  insert into public.weekly_notes_polls (email, polled_at) values ('drift.v6@example.com', v_t), ('drift.vp6@example.com', v_t);
  if not pg_temp.vcand('drift.v6@example.com', v_week) then
    raise exception 'FAIL: a run that started 0.3 seconds earlier than last week''s missed the visitor';
  end if;
  if pg_temp.vcand('drift.v6@example.com', v_t + interval '7 days' - interval '15 minutes', true) then
    raise exception 'FAIL: the visitor 7-day rule let a note through 15 minutes early';
  end if;
  if not pg_temp.vcand('drift.vp6@example.com', v_day) then
    raise exception 'FAIL: a run that started 0.2 seconds early skipped a visitor asked about 20 hours before';
  end if;
  if pg_temp.vcand('drift.vp6@example.com', v_t + interval '20 hours' - interval '15 minutes') then
    raise exception 'FAIL: the visitor 20-hour rule let an ask through 15 minutes early';
  end if;
end $$;

-- The relevance gate from 20261020230000 stays in the member rule that
-- 20261024182000 rewrites: a gecko on record or a sign-in within 60 days.
do $$
declare
  v_old timestamptz := now() - interval '90 days';
begin
  perform pg_temp.mk_member('gate.six@example.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true where email = 'gate.six@example.com';
  update auth.users set last_sign_in_at = null where email = 'gate.six@example.com';
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'gate.six@example.com') then
    raise exception 'FAIL: a member with no gecko who never signed in got a note';
  end if;
  update auth.users set last_sign_in_at = now() - interval '61 days' where email = 'gate.six@example.com';
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'gate.six@example.com') then
    raise exception 'FAIL: a member with no gecko who last signed in 61 days ago got a note';
  end if;
  if (public.claim_weekly_note('gate.six@example.com', array['a-note'], now()))->>'reason' is distinct from 'not-eligible' then
    raise exception 'FAIL: the claim let through a member the relevance gate leaves out';
  end if;
  update auth.users set last_sign_in_at = now() - interval '59 days' where email = 'gate.six@example.com';
  if not exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'gate.six@example.com') then
    raise exception 'FAIL: a member who signed in 59 days ago was left out';
  end if;
  update auth.users set last_sign_in_at = now() - interval '61 days' where email = 'gate.six@example.com';
  insert into public.geckos (name, created_by) values ('Juniper', 'gate.six@example.com');
  if not exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'gate.six@example.com') then
    raise exception 'FAIL: a member with a gecko on record was left out';
  end if;
end $$;

-- A rough cost check: visitor candidates with many suppressions stay fast
-- (the inbox lookups use indexes).
do $$
declare
  v_start timestamptz;
  v_ms numeric;
begin
  insert into public.email_suppressions (email, reason)
  select 'perf' || g || case when g % 2 = 0 then '@gmail.com' else '@example.com' end, 'bounced' from generate_series(1, 2000) g;
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  select 'perfv' || g || case when g % 2 = 0 then '@gmail.com' else '@example.com' end, 'notes:care', now() - interval '2 days', now() - interval '2 days'
    from generate_series(1, 2000) g;
  analyze public.email_suppressions;
  analyze public.newsletter_subscribers;
  v_start := clock_timestamp();
  perform count(*) from public.weekly_notes_subscriber_candidates(now(), true);
  v_ms := extract(epoch from clock_timestamp() - v_start) * 1000;
  if v_ms > 5000 then
    raise exception 'FAIL: visitor candidates took % ms with 2,000 suppressions and 2,000 visitors', round(v_ms);
  end if;
  raise notice 'visitor candidates with 2,000 suppressions and 2,000 visitors: % ms', round(v_ms);
end $$;

-- 13. The fifth review (20261018150400) ------------------------------------------------------------
do $$
declare
  v_old timestamptz := now() - interval '40 days';
  v_at timestamptz := (select t0 from _t0) + interval '160 days';
  v_token text;
  v jsonb;
  v_key bigint;
begin
  -- "Already" only for a spelling that really gets the notes: a spelling
  -- that bounced does not lock the inbox out.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('kimx+geckos@example.org', 'notes:care', v_at - interval '9 days', v_at - interval '9 days');
  insert into public.email_suppressions (email, reason) values ('kimx+geckos@example.org', 'bounced');
  if pg_temp.ask('k1', 'kimx@example.org', v_at, null) <> 'confirm' then
    raise exception 'FAIL: a bounced spelling locked the inbox out with "already"';
  end if;
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('k1'), v_at) <> 'confirmed'
     or not pg_temp.vcand('kimx@example.org', v_at + interval '1 hour', true) then
    raise exception 'FAIL: the plain address could not sign up after a plus-tag bounce';
  end if;

  -- The stop link stops every spelling of the inbox and kills every
  -- pending link for it; a new sign-up afterwards is offered again.
  -- (Both links are asked for before either is pressed.)
  perform pg_temp.ask('sa1', 'stop.all@gmail.com', v_at, null);
  if pg_temp.ask('sa2', 'stopall+p@gmail.com', v_at, null) <> 'confirm' then
    raise exception 'FAIL: setup, the second spelling should get its own link';
  end if;
  perform public.confirm_weekly_notes_signup_at(pg_temp.tok('sa1'), v_at);
  v_token := public.weekly_notes_subscriber_token('stop.all@gmail.com');
  if not public.unsubscribe_weekly_notes_subscriber(v_token) then
    raise exception 'FAIL: the visitor stop link did not work';
  end if;
  -- (A spelling that never confirmed only loses its link: 20261024182000.)
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('sa2'), v_at) <> 'invalid'
     or exists (select 1 from public.newsletter_subscribers
                 where public.email_inbox_key(email) = 'stopall@gmail.com'
                   and (confirm_token_hash is not null or (confirmed_at is not null and unsubscribed_at is null))) then
    raise exception 'FAIL: a stop left another spelling of the inbox, or its pending link, alive';
  end if;
  if pg_temp.ask('sa3', 'stopall@gmail.com', v_at + interval '2 days', null) <> 'confirm' then
    raise exception 'FAIL: an inbox that stopped could not sign up again';
  end if;

  -- The confirm button takes the form's per-inbox lock.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirm_token_hash, confirm_sent_at)
  values ('lock.check@gmail.com', 'notes:care', v_at, encode(extensions.digest('lock-check-token-0123456789abcdefgh', 'sha256'), 'hex'), v_at);
  perform public.confirm_weekly_notes_signup_at('lock-check-token-0123456789abcdefgh', v_at);
  v_key := hashtextextended('weekly_notes_signup:' || public.email_inbox_key('lock.check@gmail.com'), 0);
  if not exists (select 1 from pg_locks l
                  where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.objsubid = 1
                    and ((l.classid::bigint << 32) | l.objid::bigint) = v_key) then
    raise exception 'FAIL: the confirm button did not take the per-inbox lock';
  end if;

  -- Spellings already confirmed side by side: one series, chosen before
  -- the 7-day rule, which counts the whole inbox.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('dup.one@gmail.com', 'notes:care', v_at - interval '30 days', v_at - interval '30 days'),
         ('dupone+b@gmail.com', 'notes:care', v_at - interval '20 days', v_at - interval '20 days');
  if (select count(*) from public.weekly_notes_subscriber_candidates(v_at, true) c
       where public.email_inbox_key(c.email) = 'dupone@gmail.com') <> 1
     or not pg_temp.vcand('dup.one@gmail.com', v_at, true) then
    raise exception 'FAIL: two spellings of one inbox both became visitor candidates';
  end if;
  insert into public.weekly_notes_sends (email, step, slug, created_date) values ('dupone+b@gmail.com', 1, 'a-note', v_at - interval '2 days');
  if exists (select 1 from public.weekly_notes_subscriber_candidates(v_at, true) c
              where public.email_inbox_key(c.email) = 'dupone@gmail.com') then
    raise exception 'FAIL: the 7-day rule let a second spelling of the inbox get a note';
  end if;

  -- No repeats across spellings: a visitor who signs up again under
  -- another spelling, and a visitor who joins under another spelling.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('mia.lopez@gmail.com', 'notes:care', v_at - interval '40 days', v_at - interval '40 days');
  insert into public.weekly_notes_sends (email, step, slug, created_date) values ('mia.lopez@gmail.com', 1, 'a-note', v_at - interval '20 days');
  update public.newsletter_subscribers set unsubscribed_at = v_at - interval '15 days' where email = 'mia.lopez@gmail.com';
  perform pg_temp.ask('mia', 'mialopez@gmail.com', v_at, null);
  if public.confirm_weekly_notes_signup_at(pg_temp.tok('mia'), v_at) <> 'confirmed' then
    raise exception 'FAIL: setup, the second spelling should confirm';
  end if;
  v := public.claim_weekly_note_subscriber('mialopez@gmail.com', array['a-note', 'b-note'], v_at + interval '1 hour', array[1, 2]);
  if v->>'slug' is distinct from 'b-note' then
    raise exception 'FAIL: signing up again under another spelling repeated a note, got %', v;
  end if;
  perform pg_temp.mk_member('sam@example.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true where email = 'sam@example.com';
  insert into public.weekly_notes_sends (email, step, slug, created_date) values ('sam+notes@example.com', 1, 'a-note', now() - interval '10 days');
  v := public.claim_weekly_note('sam@example.com', array['a-note', 'b-note'], now());
  if v->>'slug' is distinct from 'b-note' then
    raise exception 'FAIL: a visitor who joined under another spelling got a note again, got %', v;
  end if;

  -- The do-not-email check is by inbox for members too.
  insert into public.email_suppressions (email, reason) values ('lee2+notes@outlook.com', 'complained');
  perform pg_temp.mk_member('lee2@outlook.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true where email = 'lee2@outlook.com';
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'lee2@outlook.com')
     or not public.email_is_suppressed('lee2@outlook.com')
     or public.email_is_suppressed('kim@yahoo.com') then
    raise exception 'FAIL: the member path did not match the do-not-email list by inbox';
  end if;

  -- Erasure covers every spelling of the inbox.
  perform pg_temp.mk_member('era.se@gmail.com', v_old);
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('erase+notes@gmail.com', 'notes:care', v_old - interval '30 days', v_old - interval '30 days');
  insert into public.weekly_notes_sends (email, step, slug, created_date) values ('erase+notes@gmail.com', 1, 'a-note', v_old - interval '20 days');
  if (public.admin_erase_weekly_notes_visitor('erase+notes@gmail.com'))->>'reason' is distinct from 'has-account' then
    raise exception 'FAIL: a visitor erasure ran on an inbox that has an account';
  end if;
  perform public.admin_erase_account('era.se@gmail.com');
  if exists (select 1 from public.newsletter_subscribers where public.email_inbox_key(email) = 'erase@gmail.com')
     or exists (select 1 from public.weekly_notes_sends where public.email_inbox_key(email) = 'erase@gmail.com') then
    raise exception 'FAIL: account erasure left visitor rows or the ledger under another spelling';
  end if;

  -- The guide form's log knows the inbox.
  insert into public.guide_email_sends (email) values ('V.Ictim+1@gmail.com');
  if (select inbox_key from public.guide_email_sends where email = 'V.Ictim+1@gmail.com') <> 'victim@gmail.com' then
    raise exception 'FAIL: the guide form log has the wrong inbox key';
  end if;
end $$;

-- A rough cost check: the member candidates stay fast with many members
-- (the member rule reads a member's last choice only when there is a stop).
do $$
declare
  v_start timestamptz;
  v_ms numeric;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         'perfm' || g || '@example.com', 'x', now() - interval '40 days',
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now() - interval '40 days', now() - interval '40 days'
    from generate_series(1, 3000) g;
  update public.profiles set email_notifications_enabled = true, email_weekly_notes_enabled = true where email like 'perfm%@example.com';
  analyze public.profiles;
  v_start := clock_timestamp();
  perform count(*) from public.weekly_notes_candidates(now(), true);
  v_ms := extract(epoch from clock_timestamp() - v_start) * 1000;
  -- About 0.4 s here; the rule before 150400 took over 4 s.
  if v_ms > 2000 then
    raise exception 'FAIL: member candidates took % ms with 3,000 members', round(v_ms);
  end if;
  raise notice 'member candidates with 3,000 members: % ms', round(v_ms);
end $$;

-- 14. The sixth review (20261024182000) ------------------------------------------------------------
do $$
declare
  v_old timestamptz := now() - interval '40 days';
  v_at timestamptz := (select t0 from _t0) + interval '170 days';
  v_token text;
  v_id uuid;
begin
  -- Both claims lock the inbox, so two accounts on one inbox cannot claim
  -- at the same moment.
  perform public.claim_weekly_note('lock.member6@gmail.com', array['a-note'], now());
  if not exists (select 1 from pg_locks l
                  where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.objsubid = 1
                    and ((l.classid::bigint << 32) | l.objid::bigint) = hashtextextended('weekly_notes:lockmember6@gmail.com', 0)) then
    raise exception 'FAIL: the member claim did not lock the inbox';
  end if;
  -- The same for claim_weekly_note_from, the member claim send-email uses.
  perform public.claim_weekly_note_from('lock.from6@gmail.com', array['a-note'], array[1], now());
  if not exists (select 1 from pg_locks l
                  where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.objsubid = 1
                    and ((l.classid::bigint << 32) | l.objid::bigint) = hashtextextended('weekly_notes:lockfrom6@gmail.com', 0)) then
    raise exception 'FAIL: the member claim send-email uses did not lock the inbox';
  end if;
  perform public.claim_weekly_note_subscriber('lock.visitor6+x@gmail.com', array['a-note'], now(), array[1]);
  if not exists (select 1 from pg_locks l
                  where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.objsubid = 1
                    and ((l.classid::bigint << 32) | l.objid::bigint) = hashtextextended('weekly_notes:lockvisitor6@gmail.com', 0)) then
    raise exception 'FAIL: the visitor claim did not lock the inbox';
  end if;

  -- The stop link takes the form's per-inbox lock.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('stop.lock6@gmail.com', 'notes:care', v_at - interval '5 days', v_at - interval '5 days');
  v_token := public.weekly_notes_subscriber_token('stop.lock6@gmail.com');
  perform public.unsubscribe_weekly_notes_subscriber(v_token);
  if not exists (select 1 from pg_locks l
                  where l.locktype = 'advisory' and l.pid = pg_backend_pid() and l.objsubid = 1
                    and ((l.classid::bigint << 32) | l.objid::bigint) = hashtextextended('weekly_notes_signup:stoplock6@gmail.com', 0)) then
    raise exception 'FAIL: the stop link did not take the per-inbox lock';
  end if;

  -- The member 7-day rule counts every spelling of the inbox.
  perform pg_temp.mk_member('seven.day6@gmail.com', v_old);
  update public.profiles set email_weekly_notes_enabled = true where email = 'seven.day6@gmail.com';
  if not exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'seven.day6@gmail.com') then
    raise exception 'FAIL: setup, the member should be a candidate';
  end if;
  insert into public.weekly_notes_sends (email, step, slug, created_date) values ('sevenday6+v@gmail.com', 1, 'a-note', now() - interval '2 days');
  if exists (select 1 from public.weekly_notes_candidates(now(), true) c where c.email = 'seven.day6@gmail.com') then
    raise exception 'FAIL: the member 7-day rule missed a note to another spelling of the inbox';
  end if;

  -- The stop link does not mark a spelling that never confirmed as
  -- stopped; it only kills its link, and the cleanup still deletes it.
  perform pg_temp.ask('u1', 'unc.one6@gmail.com', v_at, null);
  perform pg_temp.ask('u2', 'uncone6+p@gmail.com', v_at, null);
  perform public.confirm_weekly_notes_signup_at(pg_temp.tok('u1'), v_at);
  v_token := public.weekly_notes_subscriber_token('unc.one6@gmail.com');
  if not public.unsubscribe_weekly_notes_subscriber(v_token) then
    raise exception 'FAIL: the visitor stop link did not work';
  end if;
  if (select unsubscribed_at from public.newsletter_subscribers where email = 'uncone6+p@gmail.com') is not null
     or (select confirm_token_hash from public.newsletter_subscribers where email = 'uncone6+p@gmail.com') is not null then
    raise exception 'FAIL: the stop link marked a never-confirmed spelling stopped, or left its link alive';
  end if;
  perform public.weekly_notes_visitor_cleanup(v_at + interval '31 days');
  if exists (select 1 from public.newsletter_subscribers where email = 'uncone6+p@gmail.com') then
    raise exception 'FAIL: the cleanup kept a never-confirmed spelling after 30 days';
  end if;

  -- Account erasure leaves another account on the same inbox alone.
  perform pg_temp.mk_member('alice6@gmail.com', v_old);
  perform pg_temp.mk_member('a.lice6@gmail.com', v_old);
  insert into public.weekly_notes_sends (email, step, slug, created_date)
  values ('alice6@gmail.com', 1, 'a-note', now() - interval '8 days'),
         ('a.lice6@gmail.com', 1, 'a-note', now() - interval '9 days');
  insert into public.weekly_notes_polls (email, polled_at) values ('alice6@gmail.com', now() - interval '1 day');
  insert into public.email_deliveries (event_key, email, email_type, event, detail)
  values ('sent:alice6-1', 'alice6@gmail.com', 'weekly_notes', 'sent', '{}');
  perform public.admin_erase_account('a.lice6@gmail.com');
  if not exists (select 1 from public.weekly_notes_sends where email = 'alice6@gmail.com')
     or not exists (select 1 from public.weekly_notes_polls where email = 'alice6@gmail.com')
     or not exists (select 1 from public.email_deliveries where event_key = 'sent:alice6-1' and email = 'alice6@gmail.com') then
    raise exception 'FAIL: erasing one account wiped another account''s rows on the same inbox';
  end if;
  if exists (select 1 from public.weekly_notes_sends where email = 'a.lice6@gmail.com') then
    raise exception 'FAIL: erasure left the erased account''s own ledger';
  end if;

  -- Erasure scrubs the delivery log for every spelling it erases.
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('pat.k6@gmail.com', 'notes:care', v_at - interval '20 days', v_at - interval '20 days');
  insert into public.email_deliveries (event_key, email, email_type, event, detail)
  values ('clicked:patk6-1', 'pat.k6@gmail.com', 'weekly_notes', 'clicked', '{"link":"https://geckinspect.com/CareGuide"}');
  if (public.admin_erase_weekly_notes_visitor('patk6@gmail.com'))->>'erased' is distinct from 'true' then
    raise exception 'FAIL: the visitor erasure did not run';
  end if;
  if exists (select 1 from public.email_deliveries where email = 'pat.k6@gmail.com')
     or (select detail from public.email_deliveries where event_key = 'clicked:patk6-1') <> '{}'::jsonb then
    raise exception 'FAIL: erasure left another spelling in the delivery log';
  end if;

  -- A visitor erasure is not refused because of an unconfirmed sign-up.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'erasme6+shop@gmail.com',
          'x', null, '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, v_old, v_old);
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
  values ('er.asme6@gmail.com', 'notes:care', v_at - interval '20 days', v_at - interval '20 days');
  if (public.admin_erase_weekly_notes_visitor('er.asme6@gmail.com'))->>'erased' is distinct from 'true' then
    raise exception 'FAIL: an unconfirmed sign-up blocked a visitor erasure';
  end if;
end $$;

-- A rough cost check with visitor stops: 3,000 members, 600 of them on an
-- inbox with a visitor stop (the branch that reads the member's last
-- choice, through profiles_email_lower_idx).
do $$
declare
  v_start timestamptz;
  v_ms numeric;
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         'perfs' || g || '@example.com', 'x', now() - interval '40 days',
         '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now() - interval '40 days', now() - interval '40 days'
    from generate_series(1, 3000) g;
  update public.profiles set email_notifications_enabled = true, email_weekly_notes_enabled = true where email like 'perfs%@example.com';
  insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
  select 'perfs' || g || '+v@example.com', 'notes:care', now() - interval '30 days', now() - interval '30 days', now() - interval '20 days'
    from generate_series(1, 600) g;
  analyze public.profiles;
  analyze public.newsletter_subscribers;
  v_start := clock_timestamp();
  perform count(*) from public.weekly_notes_candidates(now(), true);
  v_ms := extract(epoch from clock_timestamp() - v_start) * 1000;
  -- About 1 s here with profiles_email_lower_idx, about 4 s without it.
  if v_ms > 2000 then
    raise exception 'FAIL: member candidates took % ms with 600 visitor stops among 3,000 members', round(v_ms);
  end if;
  raise notice 'member candidates with 600 visitor stops among 3,000 members: % ms', round(v_ms);
end $$;

-- 10. Running the fixes migration again changes nothing ------------------------------------------
select pg_temp.ask('rerun', 'rerun@example.com', now(), null);
insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, unsubscribed_at)
values ('future-stop@example.com', 'notes:care', now() - interval '1 day', now() + interval '70 years');
select public.confirm_weekly_notes_signup_at(pg_temp.tok('rerun'), now());
insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at)
values ('future-confirm@example.com', 'homepage', now() - interval '1 day', now() + interval '70 years');
-- A profile the 150100 trigger left off with no choice (made before the
-- stop row here, so today's trigger does not record one).
insert into public.profiles (email, email_weekly_notes_enabled) values ('old-trigger@example.com', false);
-- A profile that chose before a stop on another spelling (possible before
-- 150300), and a spelling left confirmed beside a newer stop.
-- (Triggers off for this one row: the stamp trigger would date the choice now.)
set local session_replication_role = replica;
insert into public.profiles (email, email_weekly_notes_enabled, email_weekly_notes_choice_at) values ('chose.early@gmail.com', true, now() - interval '30 days');
set local session_replication_role = origin;
insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
values ('choseearly+v@gmail.com', 'notes:care', now() - interval '25 days', now() - interval '25 days', now() - interval '5 days'),
       ('chose.early+w@gmail.com', 'notes:care', now() - interval '24 days', now() - interval '24 days', null);
insert into public.newsletter_subscribers (email, source, weekly_notes_requested_at, confirmed_at, unsubscribed_at)
values ('old-trigger@example.com', 'notes:care', now() - interval '20 days', now() - interval '20 days', now() - interval '10 days');
\ir ../migrations/20261018150100_weekly_notes_visitor_fixes_2.sql
\ir ../migrations/20261018150200_weekly_notes_visitor_fixes_3.sql
\ir ../migrations/20261018150300_weekly_notes_visitor_fixes_4.sql
\ir ../migrations/20261018150400_weekly_notes_visitor_fixes_5.sql
\ir ../migrations/20261024182000_weekly_notes_visitor_fixes_6.sql
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
  if (select unsubscribed_at from public.newsletter_subscribers where email = 'future-stop@example.com') > now() then
    raise exception 'FAIL: the migration left a stop dated in the future';
  end if;
  if (select confirmed_at from public.newsletter_subscribers where email = 'future-confirm@example.com') is not null then
    raise exception 'FAIL: the migration left a confirmation dated in the future';
  end if;
  if (select email_weekly_notes_enabled from public.profiles where email = 'chose.early@gmail.com') is not false then
    raise exception 'FAIL: a profile that chose before a newer stop on another spelling still shows the notes on';
  end if;
  if (select unsubscribed_at from public.newsletter_subscribers where email = 'chose.early+w@gmail.com') is null then
    raise exception 'FAIL: a spelling left confirmed beside a newer stop was not stopped';
  end if;
  if (select email_weekly_notes_choice_at from public.profiles where email = 'old-trigger@example.com') is null
     or (select email_weekly_notes_enabled from public.profiles where email = 'old-trigger@example.com') is not false then
    raise exception 'FAIL: a profile the old trigger left without a choice still has none';
  end if;
  if (select count(*) from pg_trigger where tgname = 'profiles_weekly_notes_visitor_stop' and not tgisinternal) <> 1 then
    raise exception 'FAIL: the visitor-stop trigger should exist exactly once';
  end if;
  if (select count(*) from pg_proc where proname = 'confirm_weekly_notes_signup') <> 1
     or (select count(*) from pg_proc where proname = 'claim_weekly_note_subscriber') <> 1 then
    raise exception 'FAIL: an old confirm or claim function is still there';
  end if;
end $$;

select 'weekly notes visitor regressions: all passed' as result;
rollback;
