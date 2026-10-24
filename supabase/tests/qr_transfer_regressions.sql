-- Fixture-only tests. Run on a disposable schema copy with sql-harness.
-- All rows and test helpers roll back. Never run against production.
begin;
create schema qr_transfer_test;
grant usage on schema qr_transfer_test to anon, authenticated;
create table qr_transfer_test.results (name text, ok boolean, detail text);

create function qr_transfer_test.expect(p_name text, p_ok boolean, p_detail text default null)
returns void language sql as $$
  insert into qr_transfer_test.results values (p_name, coalesce(p_ok, false), p_detail);
$$;

create function qr_transfer_test.become(p_email text) returns void language plpgsql as $$
declare v_id uuid;
begin
  perform set_config('role', 'postgres', true);
  if p_email is null then perform set_config('request.jwt.claims', '', true); return; end if;
  if p_email = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true); return;
  end if;
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then raise exception 'missing fixture user'; end if;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_id, 'email', p_email, 'role', 'authenticated', 'aud', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function qr_transfer_test.call_as(p_email text, p_sql text) returns jsonb language plpgsql as $$
declare v_result jsonb;
begin
  begin
    perform qr_transfer_test.become(p_email);
    execute p_sql into v_result;
  exception when others then
    v_result := jsonb_build_object('error', sqlerrm, 'code', sqlstate);
  end;
  perform qr_transfer_test.become(null);
  return v_result;
end $$;

create function qr_transfer_test.read_as_claims(p_claims jsonb, p_id uuid) returns bigint language plpgsql as $$
declare v_count bigint;
begin
  perform set_config('request.jwt.claims', p_claims::text, true);
  perform set_config('role', 'authenticated', true);
  select count(*) into v_count from public.transfer_requests where id = p_id;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v_count;
end $$;
grant execute on all functions in schema qr_transfer_test to anon, authenticated;

create function qr_transfer_test.user(p_email text, p_verified boolean default true) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values (v_id, 'authenticated', 'authenticated', p_email, case when p_verified then now() end,
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  update public.profiles set membership_tier = 'breeder' where email = p_email;
  return v_id;
end $$;

create function qr_transfer_test.gecko(p_id text, p_owner text default 'qr-owner@example.com') returns text language plpgsql as $$
begin
  insert into public.geckos (id, name, created_by, is_public, status, notes, genetics_notes, image_urls, passport_code)
  values (p_id, 'Private Lilly White ' || p_id, p_owner, false, 'For Sale', 'Private keeper note ' || p_id,
    'Recorded lineage', '["https://example.invalid/private-gecko.jpg"]', 'QR-' || p_id);
  return p_id;
end $$;

do $$ begin
  perform qr_transfer_test.user('qr-owner@example.com');
  perform qr_transfer_test.user('qr-buyer@example.com');
  perform qr_transfer_test.user('qr-other@example.com');
  perform qr_transfer_test.user('qr-editor@example.com');
  perform qr_transfer_test.user('qr-unverified@example.com', false);
  perform qr_transfer_test.user('qr-deleted@example.com');
  perform qr_transfer_test.user('qr-banned@example.com');
  perform qr_transfer_test.user('qr-full@example.com');
  insert into auth.users (id, aud, role, is_anonymous, phone, created_at, updated_at)
  values ('30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', true, null, now(), now()),
         ('30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', false, '+15555550123', now(), now());
  update auth.users set deleted_at = now() where email = 'qr-deleted@example.com';
  update auth.users set banned_until = now() + interval '1 day' where email = 'qr-banned@example.com';
end $$;

do $tests$
declare
  g text;
  t jsonb;
  t2 jsonb;
  p jsonb;
  r jsonb;
  old_owner uuid := (select id from auth.users where email = 'qr-owner@example.com');
  recipient uuid := (select id from auth.users where email = 'qr-buyer@example.com');
  key text;
  n integer;
begin
  g := qr_transfer_test.gecko('qr-basic');
  insert into public.collection_members (collection_id, member_email, role, status, accepted_at)
    select collection_id, 'qr-editor@example.com', 'editor', 'accepted', now() from public.geckos where id = g;
  r := qr_transfer_test.call_as('anon', format('select public.create_transfer(%L)', g));
  perform qr_transfer_test.expect('anonymous cannot create', r ? 'error', r::text);
  r := qr_transfer_test.call_as('qr-other@example.com', format('select public.create_transfer(%L)', g));
  perform qr_transfer_test.expect('stranger cannot create', r ->> 'code' = '42501', r::text);
  r := qr_transfer_test.call_as('qr-editor@example.com', format('select public.create_transfer(%L)', g));
  perform qr_transfer_test.expect('collection editor cannot create', r ->> 'code' = '42501', r::text);
  r := qr_transfer_test.call_as('qr-owner@example.com', format('select public.create_transfer(%L, ''gecko'', ''qr-owner@example.com'')', g));
  perform qr_transfer_test.expect('self email rejected', r ->> 'error' = 'cannot transfer to yourself', r::text);
  t := qr_transfer_test.call_as('qr-owner@example.com', format('select public.create_transfer(%L)', g));
  perform qr_transfer_test.expect('owner creates one 256-bit link', t ->> 'token' ~ '^[0-9a-f]{64}$' and t ->> 'claim_mode' = 'link', t::text);
  perform qr_transfer_test.expect('server bounds expiry to 72 hours', (t ->> 'expires_at')::timestamptz = now() + interval '72 hours');
  perform qr_transfer_test.expect('owner identity comes from authentication',
    (select from_user_id = old_owner and created_by = 'qr-owner@example.com' from public.transfer_requests where id = (t ->> 'id')::uuid));
  foreach key in array array['anon', 'qr-other@example.com', 'qr-unverified@example.com'] loop
    p := qr_transfer_test.call_as(key, format('select public.get_transfer_preview(%L)', t ->> 'token'));
    perform qr_transfer_test.expect('QR preview redacts private data for ' || key,
      p ->> 'status' = 'pending' and not (p ?| array['animal_id', 'animal_name', 'animal_image', 'passport_code', 'message', 'sale_price', 'to_email_masked', 'id'])
      and p ->> 'recipient_authorized' = 'false', p::text);
  end loop;
  p := qr_transfer_test.call_as('qr-owner@example.com', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('current owner may preview own gecko', p ->> 'animal_id' = g);
  r := qr_transfer_test.call_as('qr-other@example.com', 'select to_jsonb(count(*)) from public.transfer_requests');
  perform qr_transfer_test.expect('stranger cannot enumerate bearer tokens', r = '0'::jsonb, r::text);
  r := qr_transfer_test.call_as('qr-buyer@example.com', format('select to_jsonb(count(*)) from public.transfer_requests where id = %L', t ->> 'id'));
  perform qr_transfer_test.expect('future recipient cannot read pending bearer row', r = '0'::jsonb, r::text);
  perform qr_transfer_test.expect('authenticated anonymous session cannot read raw QR row',
    qr_transfer_test.read_as_claims('{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","is_anonymous":true}', (t ->> 'id')::uuid) = 0);
  perform qr_transfer_test.expect('phone-only account cannot read raw QR row',
    qr_transfer_test.read_as_claims('{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated"}', (t ->> 'id')::uuid) = 0);
  perform qr_transfer_test.expect('verified account with missing email JWT cannot read raw QR row',
    qr_transfer_test.read_as_claims(jsonb_build_object('sub', recipient, 'role', 'authenticated'), (t ->> 'id')::uuid) = 0);
  perform qr_transfer_test.expect('owner UID without valid email session cannot read raw QR row',
    qr_transfer_test.read_as_claims(jsonb_build_object('sub', old_owner, 'role', 'authenticated'), (t ->> 'id')::uuid) = 0);
  r := qr_transfer_test.call_as('qr-owner@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('owner cannot claim own QR', r ->> 'error' = 'cannot transfer to yourself');
  foreach key in array array['qr-unverified@example.com', 'qr-deleted@example.com', 'qr-banned@example.com'] loop
    r := qr_transfer_test.call_as(key, format('select public.claim_transfer(%L)', t ->> 'token'));
    perform qr_transfer_test.expect('ineligible account cannot claim: ' || key, r ->> 'error' = 'verified email required', r::text);
  end loop;
  r := qr_transfer_test.call_as('qr-other@example.com', format('select public.revoke_transfer(%L)', t ->> 'id'));
  perform qr_transfer_test.expect('stranger cannot revoke', r ->> 'error' = 'transfer not found');
  r := qr_transfer_test.call_as('qr-owner@example.com', format(
    'with changed as (update public.transfer_requests set expires_at = now() + interval ''7 days'' where id = %L returning id) select to_jsonb(count(*)) from changed', t ->> 'id'));
  perform qr_transfer_test.expect('expiry cannot be extended', r ? 'error');
  r := qr_transfer_test.call_as('qr-owner@example.com', format(
    'with changed as (update public.transfer_requests set token = ''replacement-token'' where id = %L returning id) select to_jsonb(count(*)) from changed', t ->> 'id'));
  perform qr_transfer_test.expect('token cannot be replaced in place', r ? 'error');
  r := qr_transfer_test.call_as('qr-owner@example.com', format(
    'with changed as (insert into public.transfer_requests (animal_id, from_user_id, to_email, token, created_by, claim_mode) values (%L, %L, '''', ''manual-link-token'', ''qr-owner@example.com'', ''link'') returning id) select to_jsonb(count(*)) from changed', g, old_owner));
  perform qr_transfer_test.expect('direct insert cannot mint an open QR token', r ? 'error');
  r := qr_transfer_test.call_as('qr-owner@example.com', format('select public.revoke_transfer(%L)', t ->> 'id'));
  perform qr_transfer_test.expect('sender revokes link', r ->> 'status' = 'cancelled');
  r := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('revocation prevents claim', r ->> 'error' = 'transfer cancelled');
  r := qr_transfer_test.call_as('qr-owner@example.com', format(
    'with changed as (update public.transfer_requests set status = ''pending'' where id = %L returning id) select to_jsonb(count(*)) from changed', t ->> 'id'));
  perform qr_transfer_test.expect('cancelled token cannot be revived', r ? 'error');
  t := qr_transfer_test.call_as('qr-owner@example.com', format('select public.create_transfer(%L)', g));
  t2 := qr_transfer_test.call_as('qr-owner@example.com', format('select public.create_transfer(%L)', g));
  perform qr_transfer_test.expect('replacement creates a distinct token', t ->> 'token' <> t2 ->> 'token');
  r := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('replacement cancels previous token', r ->> 'error' = 'transfer cancelled');
  t := t2;
  update public.transfer_requests set expires_at = now() where id = (t ->> 'id')::uuid;
  p := qr_transfer_test.call_as('anon', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('expiry boundary is closed', p ->> 'status' = 'expired');
  r := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('expired token cannot claim', r ->> 'error' = 'transfer expired');

  -- Private record and its original history keep their identities/authorship.
  insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by, notes)
    values ('qr-weight', g, 24, current_date, 'qr-owner@example.com', 'Private weight note');
  insert into public.vet_records (id, animal_id, date, created_by, findings)
    values ('20000000-0000-0000-0000-000000000001', g, current_date, 'qr-owner@example.com', 'Recorded vet findings');
  insert into public.gecko_events (id, gecko_id, event_type, event_date, created_by, notes)
    values ('qr-event', g, 'note', now(), 'qr-owner@example.com', 'Private care note');
  t := qr_transfer_test.call_as('qr-owner@example.com', format('select public.create_transfer(%L)', g));
  r := qr_transfer_test.call_as('QR-BUYER@EXAMPLE.COM', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('verified QR recipient claims with email case preserved', r ->> 'ok' = 'true' and r ->> 'animal_id' = g, r::text);
  r := qr_transfer_test.call_as('qr-buyer@example.com', format('select to_jsonb(count(*)) from public.transfer_requests where id = %L and to_user_id = auth.uid()', t ->> 'id'));
  perform qr_transfer_test.expect('QR claimant can read completed incoming transfer history', r = '1'::jsonb, r::text);
  r := qr_transfer_test.call_as('qr-other@example.com', format('select to_jsonb(count(*)) from public.transfer_requests where id = %L', t ->> 'id'));
  perform qr_transfer_test.expect('stranger cannot read completed QR transfer', r = '0'::jsonb, r::text);
  perform qr_transfer_test.expect('same gecko, photos, lineage and privacy preserved', exists (
    select 1 from public.geckos where id = g and created_by = 'qr-buyer@example.com' and status = 'Pet'
      and not is_public and genetics_notes = 'Recorded lineage' and passport_code = 'QR-' || g
      and image_urls ->> 0 = 'https://example.invalid/private-gecko.jpg'));
  perform qr_transfer_test.expect('gecko moves to recipient default collection', exists (
    select 1 from public.geckos x join public.collections c on c.id = x.collection_id
      where x.id = g and c.owner_email = 'qr-buyer@example.com' and c.is_default));
  perform qr_transfer_test.expect('private keeper notes removed from transferred row', (select notes is null from public.geckos where id = g));
  perform qr_transfer_test.expect('private keeper notes preserved for original owner', exists (
    select 1 from public.gecko_transfer_private_notes where transfer_id = (t ->> 'id')::uuid
      and owner_user_id = old_owner and animal_id = g and notes = 'Private keeper note ' || g));
  r := qr_transfer_test.call_as('qr-owner@example.com', 'select to_jsonb(count(*)) from public.gecko_transfer_private_notes');
  perform qr_transfer_test.expect('original owner can read note archive', r = '1'::jsonb, r::text);
  r := qr_transfer_test.call_as('qr-buyer@example.com', 'select to_jsonb(count(*)) from public.gecko_transfer_private_notes');
  perform qr_transfer_test.expect('recipient cannot read old private notes', r = '0'::jsonb, r::text);
  r := qr_transfer_test.call_as('qr-editor@example.com', 'select to_jsonb(count(*)) from public.gecko_transfer_private_notes');
  perform qr_transfer_test.expect('previous collection editor cannot read archive', r = '0'::jsonb);
  r := qr_transfer_test.call_as('anon', 'select to_jsonb(count(*)) from public.gecko_transfer_private_notes');
  perform qr_transfer_test.expect('anonymous cannot access archive', r ? 'error');
  perform qr_transfer_test.expect('care and weight rows retain original authorship',
    (select created_by = 'qr-owner@example.com' from public.weight_records where id = 'qr-weight') and
    (select created_by = 'qr-owner@example.com' from public.vet_records where id = '20000000-0000-0000-0000-000000000001') and
    (select created_by = 'qr-owner@example.com' from public.gecko_events where id = 'qr-event'));
  r := qr_transfer_test.call_as('qr-buyer@example.com', 'select to_jsonb(count(*)) from public.vet_records where id = ''20000000-0000-0000-0000-000000000001''');
  perform qr_transfer_test.expect('recipient retains existing animal-owner vet history access', r = '1'::jsonb, r::text);
  r := qr_transfer_test.call_as('qr-other@example.com', 'select to_jsonb(count(*)) from public.vet_records where id = ''20000000-0000-0000-0000-000000000001''');
  perform qr_transfer_test.expect('unrelated account gains no vet history access', r = '0'::jsonb, r::text);
  r := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('same claimant may recover lost success response', r ->> 'already_claimed' = 'true');
  perform qr_transfer_test.expect('retry creates no duplicate ownership history',
    (select count(*) = 1 from public.ownership_records where animal_id = g and owner_user_id = recipient));
  r := qr_transfer_test.call_as('qr-other@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('replay by another account is rejected', r ->> 'error' = 'already claimed');
  p := qr_transfer_test.call_as('anon', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('claimed QR stays redacted to visitors', p ->> 'status' = 'claimed' and not (p ? 'animal_id'));
  p := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('current claimant gets success preview', p ->> 'claimed_by_you' = 'true' and p ->> 'animal_id' = g);
  r := qr_transfer_test.call_as('qr-owner@example.com', format('select public.revoke_transfer(%L)', t ->> 'id'));
  perform qr_transfer_test.expect('claimed link cannot be revoked', r ->> 'error' = 'already claimed');
  -- Once the gecko is transferred onward, the earlier success token cannot
  -- restore old ownership or expose the new owner's record.
  t2 := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.create_transfer(%L)', g));
  r := qr_transfer_test.call_as('qr-other@example.com', format('select public.claim_transfer(%L)', t2 ->> 'token'));
  perform qr_transfer_test.expect('new owner may transfer onward', r ->> 'ok' = 'true');
  r := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('old success token never restores ownership', r ->> 'error' = 'already claimed');
  p := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('former claimant no longer sees details', p ->> 'claimed_by_you' = 'false' and not (p ? 'animal_id'));

  g := qr_transfer_test.gecko('qr-email');
  t := qr_transfer_test.call_as('qr-owner@example.com', format('select public.create_transfer(%L, ''gecko'', ''QR-BUYER@example.com'', 250, ''Handoff message'')', g));
  perform qr_transfer_test.expect('email restriction normalized', t ->> 'claim_mode' = 'email');
  p := qr_transfer_test.call_as('anon', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('email preview leaks no recipient email or message', not (p ?| array['animal_id', 'to_email_masked', 'message', 'sale_price']));
  p := qr_transfer_test.call_as('qr-other@example.com', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('wrong signed-in account has no email preview', p ->> 'recipient_authorized' = 'false' and not (p ? 'animal_id'));
  p := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('verified intended email sees details', p ->> 'animal_id' = g and p ->> 'message' = 'Handoff message');
  r := qr_transfer_test.call_as('qr-other@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('wrong email cannot claim', r ->> 'error' = 'not the intended recipient');
  update public.geckos set created_by = 'qr-other@example.com' where id = g;
  r := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('ownership rechecked at claim time', r ->> 'error' = 'the sender no longer owns this animal');
  p := qr_transfer_test.call_as('qr-buyer@example.com', format('select public.get_transfer_preview(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('stale offer does not reveal new owner data', p ->> 'status' = 'cancelled' and not (p ? 'animal_id'));
  g := qr_transfer_test.gecko('qr-unverified-email');
  t2 := qr_transfer_test.call_as('qr-owner@example.com', format('select public.create_transfer(%L, ''gecko'', ''qr-unverified@example.com'')', g));
  r := qr_transfer_test.call_as('qr-unverified@example.com', format('select to_jsonb(count(*)) from public.transfer_requests where id = %L', t2 ->> 'id'));
  perform qr_transfer_test.expect('unverified intended email cannot read invitation details directly', r = '0'::jsonb, r::text);
  -- A stale JWT email and user-editable metadata cannot substitute for the
  -- verified email from auth.users.
  update auth.users set email = 'qr-renamed@example.com', raw_user_meta_data = '{"email_verified":true}'
    where email = 'qr-unverified@example.com';
  perform qr_transfer_test.become('qr-renamed@example.com');
  perform set_config('request.jwt.claims', json_build_object('sub', auth.uid(), 'email', 'qr-buyer@example.com', 'role', 'authenticated')::text, true);
  begin
    perform public.claim_transfer(t ->> 'token');
    r := '{}'::jsonb;
  exception when others then r := jsonb_build_object('error', sqlerrm); end;
  perform qr_transfer_test.become(null);
  perform qr_transfer_test.expect('user metadata cannot confer email verification', r ->> 'error' = 'verified email required');
  update auth.users set email_confirmed_at = now() where email = 'qr-renamed@example.com';
  perform qr_transfer_test.become('qr-renamed@example.com');
  perform set_config('request.jwt.claims', json_build_object('sub', auth.uid(), 'email', 'qr-buyer@example.com', 'role', 'authenticated')::text, true);
  begin perform public.claim_transfer(t ->> 'token'); r := '{}'::jsonb;
  exception when others then r := jsonb_build_object('error', sqlerrm); end;
  perform qr_transfer_test.become(null);
  perform qr_transfer_test.expect('stale email token must sign in again', r ->> 'error' = 'sign in again');
  perform qr_transfer_test.expect('ownership switch is off after successful calls', coalesce(current_setting('geck.ownership_transfer', true), 'off') <> 'on');
  perform qr_transfer_test.expect('private implementations are not callable by API roles',
    not has_function_privilege('authenticated', 'geck_private.claim_transfer(text,boolean)', 'execute')
    and not has_function_privilege('anon', 'public.claim_transfer(text,boolean)', 'execute'));
  -- A failure after status/notes writes must roll back the whole handoff.
  for n in 1..10 loop perform qr_transfer_test.gecko('qr-cap-' || n, 'qr-full@example.com'); end loop;
  update public.profiles set membership_tier = 'free' where email = 'qr-full@example.com';
  g := qr_transfer_test.gecko('qr-cap-blocked');
  t := qr_transfer_test.call_as('qr-owner@example.com', format('select public.create_transfer(%L)', g));
  r := qr_transfer_test.call_as('qr-full@example.com', format('select public.claim_transfer(%L)', t ->> 'token'));
  perform qr_transfer_test.expect('existing plan cap rejects claim', r ->> 'error' like '%holds up to 10 active geckos%', r::text);
  perform qr_transfer_test.expect('failed claim retains original owner and private notes', exists (
    select 1 from public.geckos where id = g and created_by = 'qr-owner@example.com' and notes = 'Private keeper note ' || g));
  perform qr_transfer_test.expect('failed claim restores pending token and empty claim fields', exists (
    select 1 from public.transfer_requests where id = (t ->> 'id')::uuid and status = 'pending'
      and to_user_id is null and claimed_at is null));
  perform qr_transfer_test.expect('failed claim writes no archive or history',
    not exists (select 1 from public.gecko_transfer_private_notes where transfer_id = (t ->> 'id')::uuid)
    and not exists (select 1 from public.ownership_records where animal_id = g));
  p := qr_transfer_test.call_as('anon', 'select public.get_transfer_preview(null)');
  perform qr_transfer_test.expect('invalid link has no preview', p is null);
  r := qr_transfer_test.call_as('qr-buyer@example.com', 'select public.claim_transfer(''no-such-qr-token'')');
  perform qr_transfer_test.expect('unknown token cannot claim', r ->> 'error' = 'transfer not found');
end $tests$;

select case when ok then 'PASS' else 'FAIL' end as result, name, detail from qr_transfer_test.results order by name;
do $$ declare n integer; begin
  select count(*) into n from qr_transfer_test.results where not ok;
  if n > 0 then raise exception 'FAIL: % QR transfer regressions', n; end if;
  raise notice 'PASS: % QR transfer checks', (select count(*) from qr_transfer_test.results);
end $$;
rollback;
