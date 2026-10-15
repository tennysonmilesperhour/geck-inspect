-- Morph ID share card and one free identification a month.
-- Regression checks for supabase/migrations/20261016120000_morph_id_share_card.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/morphcard_regressions.sql
--
-- Each block raises "FAIL: ..." when a rule is broken, and also checks
-- that the legitimate flow next to it still works.
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text, p_role text default 'user', p_tier text default 'free',
                           p_created timestamptz default now())
returns void
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'morphcard-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, p_created, now());
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  update public.profiles set role = p_role, membership_tier = p_tier where email = v_email;
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
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.uid(p_tag text) returns uuid language sql stable as $$
  select uid from _who where tag = p_tag
$$;
-- A photo address in the member's own folder, as uploadFile writes it.
create function pg_temp.photo(p_tag text, p_folder text default 'uploads') returns text language sql stable as $$
  select 'https://mmuglfphhwlaluyfyxsp.supabase.co/storage/v1/object/public/geck-inspect-media/'
         || coalesce(p_folder || '/', '') || uid::text || '/' || gen_random_uuid()::text || '.webp'
    from _who where tag = p_tag
$$;
create function pg_temp.must_fail(p_label text, p_sql text, p_error_like text default '%') returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not ilike p_error_like then
      raise exception 'FAIL: % failed for the wrong reason: %', p_label, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAIL: % was allowed', p_label;
end $$;
create function pg_temp.scans(p_user uuid, p_tier text, p_monthly integer) returns integer language sql stable as $$
  select (public.morph_id_scans_remaining(p_user, p_tier, p_monthly)->>'remaining')::integer;
$$;
grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('alice');
select pg_temp.mk('bob');
select pg_temp.mk('carol');
select pg_temp.mk('old', 'user', 'free', now() - interval '10 days');
select pg_temp.mk('admin', 'admin');
select pg_temp.mk('free2');
select pg_temp.mk('free3');
select pg_temp.mk('keeper', 'user', 'keeper');

-- A finished Morph ID answer as recognize-gecko-morph stores it, with
-- the model's free-text reasons that must not reach the card.
create function pg_temp.answer(p_status text default 'tentative') returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'success', true,
    'tier', 'free',
    'analysis', jsonb_build_object(
      'primary_morph', 'harlequin',
      'genetic_traits', jsonb_build_array('lily_white', 'Not An Id!'),
      'secondary_traits', jsonb_build_array('high_contrast'),
      'candidate_morphs', jsonb_build_array(
        jsonb_build_object('morph', 'harlequin', 'score', 58, 'why', 'Private model reasoning', 'source', 'model'),
        jsonb_build_object('morph', 'dalmatian', 'score', 25, 'why', 'x', 'source', 'photo_lookup'),
        jsonb_build_object('morph', '<script>', 'score', 90)
      ),
      'confidence_score', 58,
      'assessment_status', p_status,
      'explanation', 'Long private explanation',
      'taxonomy_version', '2026-09'
    )
  )
$$;
grant execute on all functions in schema pg_temp to public;

insert into public.morph_id_requests (user_id, request_key, status, response) values
  (pg_temp.uid('alice'), 'alice-key-0001', 'done', pg_temp.answer()),
  (pg_temp.uid('alice'), 'alice-key-poor', 'done', pg_temp.answer('insufficient_evidence')),
  (pg_temp.uid('alice'), 'alice-key-runs', 'running', null),
  (pg_temp.uid('bob'), 'bob-key-00001', 'done', pg_temp.answer());

-- =====================================================================
-- 1. One free identification a month
-- =====================================================================
do $t$
declare n integer; v_inc integer; v_con integer;
begin
  -- A new Free member has 1 this month, even when the caller passes 0
  -- (an edge function that was not redeployed).
  if pg_temp.scans(pg_temp.uid('free2'), 'free', 0) <> 1 then
    raise exception 'FAIL: new Free member should have 1 scan, got %', pg_temp.scans(pg_temp.uid('free2'), 'free', 0);
  end if;
  perform public.consume_morph_id_credit(pg_temp.uid('free2'), 'free', 0);
  if pg_temp.scans(pg_temp.uid('free2'), 'free', 0) <> 0 then
    raise exception 'FAIL: Free scan should be spent';
  end if;
  -- The second scan in the same month is refused (the paid "upgrade"
  -- rule must never apply to a Free caller, or Free would not run out).
  perform pg_temp.must_fail('second Free scan in one month',
    format('select public.consume_morph_id_credit(%L, %L, 0)', pg_temp.uid('free2'), 'free'),
    'morph_id_credits_exhausted');
  perform pg_temp.must_fail('Free caller passing a big allowance',
    format('select public.consume_morph_id_credit(%L, %L, 50)', pg_temp.uid('free2'), 'free'),
    'morph_id_credits_exhausted');

  -- A Free member who used last month's scan gets a new one this month.
  insert into public.morph_id_usage (user_id, month_key, tier_at_start, credits_included, credits_consumed)
  values (pg_temp.uid('free3'), '2020-01', 'free', 1, 1);
  if pg_temp.scans(pg_temp.uid('free3'), 'free', 0) <> 1 then
    raise exception 'FAIL: a new month should bring a new Free scan';
  end if;
  perform public.consume_morph_id_credit(pg_temp.uid('free3'), 'free', 0);
  select credits_included, credits_consumed into v_inc, v_con
    from public.morph_id_usage where user_id = pg_temp.uid('free3') and month_key = public.month_key_now();
  if v_inc <> 1 or v_con <> 1 then
    raise exception 'FAIL: this month''s Free row should be 1 of 1, got % of %', v_con, v_inc;
  end if;

  -- The member's own read (no arguments) says 1 for a fresh Free account.
  perform pg_temp.as_member('carol');
  n := (public.morph_id_scans_remaining()->>'remaining')::integer;
  perform pg_temp.as_postgres();
  if n <> 1 then raise exception 'FAIL: Free member reading their own allowance got %', n; end if;

  -- Paid plans keep their allowances.
  if pg_temp.scans(pg_temp.uid('keeper'), 'keeper', 3) <> 3 then
    raise exception 'FAIL: Keeper should still have 3';
  end if;
end
$t$;

-- =====================================================================
-- 2. Making a card
-- =====================================================================
do $t$
declare r jsonb; r2 jsonb; c jsonb; n integer; v_id text;
begin
  perform pg_temp.as_member('alice');
  r := public.create_morph_id_share('alice-key-0001', pg_temp.photo('alice'));
  if (r->>'id') !~ '^[0-9a-f]{16}$' or (r->>'created')::boolean is not true then
    raise exception 'FAIL: card not created: %', r;
  end if;
  v_id := r->>'id';
  perform set_config('morphcard.share', v_id, true);

  -- Sharing the same answer again hands back the same card.
  r2 := public.create_morph_id_share('alice-key-0001', pg_temp.photo('alice', null));
  if r2->>'id' <> v_id or (r2->>'created')::boolean then
    raise exception 'FAIL: second share of one answer made a new card: %', r2;
  end if;

  -- The owner can see their own card.
  select count(*) into n from public.morph_id_shares;
  if n <> 1 then raise exception 'FAIL: owner should see 1 card, saw %', n; end if;

  -- Not someone else's photo, not a photo from another place.
  perform pg_temp.must_fail('card with another member''s photo',
    format('select public.create_morph_id_share(%L, %L)', 'alice-key-0001', pg_temp.photo('bob')),
    'morph_share_bad_photo');
  perform pg_temp.must_fail('card with an outside photo',
    format('select public.create_morph_id_share(%L, %L)', 'alice-key-0001',
           'https://evil.example/' || pg_temp.uid('alice') || '/x.webp'),
    'morph_share_bad_photo');
  perform pg_temp.must_fail('card with a path that climbs out of the folder',
    format('select public.create_morph_id_share(%L, %L)', 'alice-key-0001',
           'https://x.supabase.co/storage/v1/object/public/geck-inspect-media/../' || pg_temp.uid('alice') || '/a.webp'),
    'morph_share_bad_photo');

  -- Not someone else's answer, not an unfinished one, not "better photos needed".
  perform pg_temp.must_fail('card from another member''s answer',
    format('select public.create_morph_id_share(%L, %L)', 'bob-key-00001', pg_temp.photo('alice')),
    'morph_share_no_result');
  perform pg_temp.must_fail('card from a running answer',
    format('select public.create_morph_id_share(%L, %L)', 'alice-key-runs', pg_temp.photo('alice')),
    'morph_share_no_result');
  perform pg_temp.must_fail('card from an insufficient answer',
    format('select public.create_morph_id_share(%L, %L)', 'alice-key-poor', pg_temp.photo('alice')),
    'morph_share_nothing_to_share');

  -- A member cannot write their own result onto a card.
  perform pg_temp.must_fail('member card from browser-supplied answer',
    format('select public.create_morph_id_share(null, %L, %L::jsonb)', pg_temp.photo('alice'),
           '{"primary_morph":"extreme_harlequin","assessment_status":"best_match","confidence_score":100}'),
    'morph_share_no_result');
  perform pg_temp.must_fail('member card from an unknown key plus an answer',
    format('select public.create_morph_id_share(%L, %L, %L::jsonb)', 'made-up-key-1', pg_temp.photo('alice'),
           '{"primary_morph":"extreme_harlequin","assessment_status":"best_match"}'),
    'morph_share_no_result');
  perform pg_temp.must_fail('malformed request key',
    format('select public.create_morph_id_share(%L, %L)', 'bad key!', pg_temp.photo('alice')),
    'morph_share_bad_request');

  -- Direct writes are closed: cards come only from the function.
  perform pg_temp.must_fail('direct insert',
    format($q$insert into public.morph_id_shares (id, owner_id, image_path, card)
              values ('0123456789abcdef', %L, 'x', '{}')$q$, pg_temp.uid('alice')),
    '%permission denied%');
  perform pg_temp.must_fail('direct update of the counters',
    $q$update public.morph_id_shares set view_count = 1000$q$, '%permission denied%');

  perform pg_temp.as_postgres();

  -- The card holds ids and scores only: no model text, no bad ids.
  select card into c from public.morph_id_shares where id = v_id;
  if c::text ilike '%private%' or c::text ilike '%explanation%' or c::text like '%<script>%'
     or c::text like '%Not An Id%' then
    raise exception 'FAIL: card kept free text or a bad id: %', c;
  end if;
  if c->>'primary_morph' <> 'harlequin' or jsonb_array_length(c->'candidate_morphs') <> 2
     or c->'genetic_traits' <> '["lily_white"]'::jsonb or (c->>'confidence_score')::int <> 58 then
    raise exception 'FAIL: card content wrong: %', c;
  end if;
  if (select image_path from public.morph_id_shares where id = v_id) !~ ('^uploads/' || pg_temp.uid('alice') || '/') then
    raise exception 'FAIL: stored photo path is wrong';
  end if;

  select count(*) into n from public.user_events
   where event_name = 'morph_share_created' and properties->>'share_id' = v_id;
  if n <> 1 then raise exception 'FAIL: expected one morph_share_created event, found %', n; end if;

  -- An admin (whose scans skip the request store) can make a card from
  -- the answer on screen.
  perform pg_temp.as_member('admin');
  r := public.create_morph_id_share(null, pg_temp.photo('admin'), (pg_temp.answer()->'analysis'));
  if (r->>'id') !~ '^[0-9a-f]{16}$' then raise exception 'FAIL: admin card not created: %', r; end if;
  perform pg_temp.as_postgres();

  -- 30 cards a day, then a polite refusal.
  insert into public.morph_id_shares (id, owner_id, image_path, card)
  select substr(md5(g::text || 'rate'), 1, 16), pg_temp.uid('carol'), 'x', '{}'::jsonb
    from generate_series(1, 30) g;
  insert into public.morph_id_requests (user_id, request_key, status, response)
  values (pg_temp.uid('carol'), 'carol-key-0001', 'done', pg_temp.answer());
  perform pg_temp.as_member('carol');
  perform pg_temp.must_fail('31st card in a day',
    format('select public.create_morph_id_share(%L, %L)', 'carol-key-0001', pg_temp.photo('carol')),
    'morph_share_rate_limited');
  perform pg_temp.as_postgres();
end
$t$;

-- =====================================================================
-- 3. Reading a card: one at a time, never a list
-- =====================================================================
do $t$
declare r jsonb; n integer; v_id text := current_setting('morphcard.share');
begin
  perform pg_temp.as_anon();
  perform pg_temp.must_fail('anon listing cards', 'select count(*) from public.morph_id_shares', '%permission denied%');
  r := public.get_morph_id_share(v_id);
  if r is null or r->'card'->>'primary_morph' <> 'harlequin' or r->>'image_path' is null then
    raise exception 'FAIL: anon could not read the card by id: %', r;
  end if;
  -- The photo path carries the storage folder id (as every public photo
  -- address does); nothing else about the owner may come back.
  if r ? 'owner_id' or r ? 'request_key' or r ? 'view_count' or r::text ilike '%@example.com%' then
    raise exception 'FAIL: card read names the owner: %', r;
  end if;
  if public.get_morph_id_share('ffffffffffffffff') is not null
     or public.get_morph_id_share('nope') is not null
     or public.get_morph_id_share(null) is not null then
    raise exception 'FAIL: unknown ids should read as null';
  end if;
  -- A view counted by the share page.
  r := public.get_morph_id_share(v_id, true);
  r := public.get_morph_id_share(v_id, true);
  -- A link preview robot: read without counting.
  r := public.get_morph_id_share(v_id, false);
  -- Counting an unknown id logs nothing.
  r := public.get_morph_id_share('ffffffffffffffff', true);
  perform pg_temp.must_fail('anon making a card',
    format('select public.create_morph_id_share(%L, %L)', 'alice-key-0001', 'https://x/y'), '%permission denied%');
  perform pg_temp.must_fail('anon recording a sign-up',
    format('select public.record_morph_id_share_signup(%L)', v_id), '%permission denied%');
  perform pg_temp.as_postgres();

  if (select view_count from public.morph_id_shares where id = v_id) <> 2 then
    raise exception 'FAIL: expected 2 views, got %', (select view_count from public.morph_id_shares where id = v_id);
  end if;
  select count(*) into n from public.user_events where event_name = 'morph_share_viewed';
  if n <> 2 then raise exception 'FAIL: expected 2 morph_share_viewed events, found %', n; end if;

  -- Another member sees none of Alice's cards and cannot delete them.
  perform pg_temp.as_member('bob');
  select count(*) into n from public.morph_id_shares;
  if n <> 0 then raise exception 'FAIL: another member listed % cards', n; end if;
  delete from public.morph_id_shares where id = v_id;
  perform pg_temp.as_postgres();
  if not exists (select 1 from public.morph_id_shares where id = v_id) then
    raise exception 'FAIL: another member deleted the card';
  end if;

  if has_function_privilege('authenticated', 'public.morph_id_share_card_from(jsonb)', 'execute')
     or has_function_privilege('anon', 'public.morph_id_share_card_from(jsonb)', 'execute') then
    raise exception 'FAIL: the card builder is callable from the API';
  end if;
  if has_table_privilege('anon', 'public.morph_id_share_signups', 'select')
     or has_table_privilege('authenticated', 'public.morph_id_share_signups', 'select') then
    raise exception 'FAIL: sign-up rows are readable from the API';
  end if;
end
$t$;

-- =====================================================================
-- 4. Sign-ups from a card
-- =====================================================================
do $t$
declare n integer; ok boolean; v_id text := current_setting('morphcard.share');
begin
  perform pg_temp.as_member('carol');
  ok := public.record_morph_id_share_signup(v_id);
  if not ok then raise exception 'FAIL: a new account from a card was not counted'; end if;
  ok := public.record_morph_id_share_signup(v_id);
  if ok then raise exception 'FAIL: one account counted twice'; end if;

  perform pg_temp.as_member('alice');
  if public.record_morph_id_share_signup(v_id) then raise exception 'FAIL: owner counted on their own card'; end if;
  perform pg_temp.as_member('old');
  if public.record_morph_id_share_signup(v_id) then raise exception 'FAIL: a 10-day-old account counted as a sign-up'; end if;
  perform pg_temp.as_member('bob');
  if public.record_morph_id_share_signup('ffffffffffffffff') then raise exception 'FAIL: unknown card counted'; end if;
  perform pg_temp.as_postgres();

  if (select signup_count from public.morph_id_shares where id = v_id) <> 1 then
    raise exception 'FAIL: expected 1 sign-up on the card';
  end if;
  select count(*) into n from public.user_events where event_name = 'morph_share_signup' and properties->>'share_id' = v_id;
  if n <> 1 then raise exception 'FAIL: expected one morph_share_signup event, found %', n; end if;
end
$t$;

-- =====================================================================
-- 5. Deleting: by the owner, and with the account
-- =====================================================================
do $t$
declare n integer; v_id text := current_setting('morphcard.share');
begin
  perform pg_temp.as_member('alice');
  delete from public.morph_id_shares where id = v_id;
  perform pg_temp.as_anon();
  if public.get_morph_id_share(v_id) is not null then
    raise exception 'FAIL: a deleted card can still be read';
  end if;
  perform pg_temp.as_postgres();
  if exists (select 1 from public.morph_id_share_signups where share_id = v_id) then
    raise exception 'FAIL: sign-up rows outlived their card';
  end if;

  delete from auth.users where id = pg_temp.uid('admin');
  select count(*) into n from public.morph_id_shares where owner_id = pg_temp.uid('admin');
  if n <> 0 then raise exception 'FAIL: cards outlived their account'; end if;
end
$t$;

select 'morphcard regressions passed' as result;
rollback;
