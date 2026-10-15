-- Ownership regressions (migration 20261015120000_ownership_checks.sql).
--
-- Plain SQL script for a local Postgres copy of the schema. It needs a
-- superuser: it writes auth.users and switches roles with set_config. It
-- is not pgTAP, and it is not meant for the Supabase SQL editor or for
-- production. Everything runs in one transaction and rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/ownership_regressions.sql
--
-- Each check acts as a signed-in member the way the API does (JWT claims
-- in request.jwt.claims, role authenticated), then looks at the result as
-- the database owner. Every check prints PASS or FAIL; the script ends
-- with an error when any check fails. Run it before the migration and the
-- exploit checks fail (that is the proof the holes were real); run it
-- after and everything passes.
--
-- Covered: transfer takeover, forged care records and eggs, owner deletes
-- of forged rows, created_by freeze, collection placement and moves
-- (including a member's own gecko after they leave a shared collection),
-- invitations (pending start, owner cannot accept, pending sees nothing
-- inside), collaborator and gecko caps per plan (including unarchive and
-- claims), profile planting, email and "member since" changes, the
-- signup and onboarding profile paths, redeem_signup_grant, and helper
-- grants. Legitimate flows are checked next to each exploit.
begin;

create schema ownership_test;
grant usage on schema ownership_test to anon, authenticated;

create table ownership_test.results (
  seq serial primary key,
  check_name text not null,
  ok boolean not null,
  detail text
);
create table ownership_test.fx (k text primary key, v text);

create function ownership_test.fx(p_k text) returns text
language sql stable as $$ select v from ownership_test.fx where k = p_k $$;

create function ownership_test.put(p_k text, p_v text) returns void
language sql as $$ insert into ownership_test.fx values (p_k, p_v) on conflict (k) do update set v = excluded.v $$;

create function ownership_test.expect(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into ownership_test.results (check_name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail) $$;

-- Act as a caller. null = back to the database owner with no JWT.
create function ownership_test.become(p_email text) returns void
language plpgsql as $$
declare
  v_id uuid;
begin
  perform set_config('role', 'postgres', true);
  if p_email is null then
    perform set_config('request.jwt.claims', '', true);
    return;
  end if;
  if p_email = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
    return;
  end if;
  select id into v_id from auth.users where email = lower(p_email);
  if v_id is null then
    raise exception 'no auth.users row for %', p_email;
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id, 'email', lower(p_email), 'role', 'authenticated',
                      'aud', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Run one statement as a caller. Returns 'ok:<rows>' or 'error:<message>'.
-- A failed statement rolls back to before it, role switch included.
create function ownership_test.try_as(p_email text, p_sql text) returns text
language plpgsql as $$
declare
  v_n bigint;
  v_r text;
begin
  begin
    perform ownership_test.become(p_email);
    execute p_sql;
    get diagnostics v_n = row_count;
    v_r := 'ok:' || v_n;
  exception when others then
    v_r := 'error:' || sqlerrm;
  end;
  perform ownership_test.become(null);
  return v_r;
end $$;

-- Run a count(*) query as a caller. -1 when it errors.
create function ownership_test.count_as(p_email text, p_sql text) returns bigint
language plpgsql as $$
declare
  v_n bigint;
begin
  begin
    perform ownership_test.become(p_email);
    execute p_sql into v_n;
  exception when others then
    v_n := -1;
  end;
  perform ownership_test.become(null);
  return v_n;
end $$;

grant execute on all functions in schema ownership_test to anon, authenticated;

create function ownership_test.mk_user(p_email text, p_tier text default 'free') returns uuid
language plpgsql as $$
declare
  v_id uuid := gen_random_uuid();
begin
  -- The signup trigger (handle_new_auth_user) creates the profile row.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    lower(p_email), 'not-a-real-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );
  update public.profiles set membership_tier = p_tier where email = lower(p_email);
  return v_id;
end $$;

create function ownership_test.mk_gecko(p_owner text, p_name text, p_public boolean default false, p_archived boolean default false)
returns text
language plpgsql as $$
declare
  v_id text := 'own-test-' || gen_random_uuid()::text;
begin
  insert into public.geckos (id, name, created_by, is_public, archived, status)
  values (v_id, p_name, lower(p_owner), p_public, p_archived, 'Pet');
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Fixtures (as the database owner)
-- ---------------------------------------------------------------------------
do $fx$
declare
  v_a text := 'own-a@example.com';   -- Breeder: owns a shared collection
  v_cid uuid;
  v_ga text;
  v_gp text;
begin
  perform ownership_test.mk_user(v_a, 'breeder');
  perform ownership_test.mk_user('own-b@example.com');            -- attacker, Free
  perform ownership_test.mk_user('own-e@example.com');            -- editor of A's collection
  perform ownership_test.mk_user('own-v@example.com');            -- viewer of A's collection
  perform ownership_test.mk_user('own-p@example.com');            -- pending invitee
  perform ownership_test.mk_user('own-p2@example.com');           -- pending invitee who declines
  perform ownership_test.mk_user('own-y@example.com');            -- buyer, Free
  perform ownership_test.mk_user('own-f@example.com');            -- Free, for caps
  perform ownership_test.mk_user('own-k@example.com', 'keeper');  -- Keeper, for caps
  perform ownership_test.mk_user('own-o@example.com', 'keeper');  -- becomes over-cap Free
  perform ownership_test.mk_user('own-n1@example.com');           -- brand new, no collection
  perform ownership_test.mk_user('own-n2@example.com');           -- brand new, uses save_gecko_record
  perform ownership_test.mk_user('own-n3@example.com');           -- brand new, no profile row

  v_ga := ownership_test.mk_gecko(v_a, 'Lilly White A', true);
  v_gp := ownership_test.mk_gecko(v_a, 'Harlequin private A');
  select collection_id into v_cid from public.geckos where id = v_ga;
  perform ownership_test.put('ga', v_ga);
  perform ownership_test.put('gp', v_gp);
  perform ownership_test.put('cid_a', v_cid::text);

  insert into public.collection_members (collection_id, member_email, role, status, accepted_at)
  values (v_cid, 'own-e@example.com', 'editor', 'accepted', now()),
         (v_cid, 'own-v@example.com', 'viewer', 'accepted', now());
  insert into public.collection_members (collection_id, member_email, role, status, invite_token, expires_at)
  values (v_cid, 'own-p@example.com', 'viewer', 'pending', 'own-test-invite-p-0000001', now() + interval '7 days'),
         (v_cid, 'own-p2@example.com', 'viewer', 'pending', 'own-test-invite-p2-000001', now() + interval '7 days');

  perform ownership_test.put('gb', ownership_test.mk_gecko('own-b@example.com', 'Phantom B'));
  perform ownership_test.put('cid_b', (select collection_id::text from public.geckos where id = ownership_test.fx('gb')));
  perform ownership_test.put('ge', ownership_test.mk_gecko('own-e@example.com', 'Cappuccino E'));
  perform ownership_test.put('cid_e', (select collection_id::text from public.geckos where id = ownership_test.fx('ge')));
  perform ownership_test.put('gf', ownership_test.mk_gecko('own-f@example.com', 'Axanthic F 1'));
  perform ownership_test.put('cid_f', (select collection_id::text from public.geckos where id = ownership_test.fx('gf')));
  perform ownership_test.put('gk', ownership_test.mk_gecko('own-k@example.com', 'Sable K 1'));
  perform ownership_test.put('cid_k', (select collection_id::text from public.geckos where id = ownership_test.fx('gk')));

  insert into public.other_reptiles (id, name, species, created_by)
  values ('own-test-reptile-a', 'Leo A', 'Leopard Gecko', v_a),
         ('own-test-reptile-t', 'Leo for sale', 'Leopard Gecko', v_a);

  insert into public.breeding_plans (id, sire_id, dam_id, created_by)
  values ('own-test-plan-a', v_ga, v_gp, v_a);
end
$fx$;

-- ---------------------------------------------------------------------------
-- 1. Transfers
-- ---------------------------------------------------------------------------
do $t$
declare
  g text;
  r text;
  b_uid uuid := (select id from auth.users where email = 'own-b@example.com');
  e_uid uuid := (select id from auth.users where email = 'own-e@example.com');
  a_uid uuid := (select id from auth.users where email = 'own-a@example.com');
begin
  -- Exploit: B writes a transfer for A's gecko and claims it.
  g := ownership_test.mk_gecko('own-a@example.com', 'Takeover target 1', true);
  r := ownership_test.try_as('own-b@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, status, created_by, expires_at)
       values (%L, 'gecko', %L, 'own-b@example.com', 'own-test-tok-b1', 'pending', 'own-b@example.com', now() + interval '3 days')$s$, g, b_uid));
  perform ownership_test.try_as('own-b@example.com', $s$select public.claim_transfer('own-test-tok-b1', false)$s$);
  perform ownership_test.expect('transfer: member cannot start a transfer for someone else''s gecko',
    r like 'error:%' and (select created_by from public.geckos where id = g) = 'own-a@example.com', r);

  -- Exploit: a forged row that already exists (written before the fix)
  -- cannot be claimed, because the sender does not own the gecko.
  g := ownership_test.mk_gecko('own-a@example.com', 'Takeover target 2', true);
  insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, status, created_by, expires_at)
  values (g, 'gecko', b_uid, 'own-b@example.com', 'own-test-tok-b2', 'pending', 'own-b@example.com', now() + interval '3 days');
  r := ownership_test.try_as('own-b@example.com', $s$select public.claim_transfer('own-test-tok-b2', false)$s$);
  perform ownership_test.expect('transfer: claim re-checks that the sender owns the gecko',
    r like 'error:%' and (select created_by from public.geckos where id = g) = 'own-a@example.com', r);

  -- A collection editor is not the owner and cannot transfer.
  g := ownership_test.mk_gecko('own-a@example.com', 'Shared gecko', true);
  update public.geckos set collection_id = ownership_test.fx('cid_a')::uuid where id = g;
  r := ownership_test.try_as('own-e@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, status, created_by, expires_at)
       values (%L, 'gecko', %L, 'own-e@example.com', 'own-test-tok-e1', 'pending', 'own-e@example.com', now() + interval '3 days')$s$, g, e_uid));
  perform ownership_test.expect('transfer: collection editor cannot transfer the owner''s gecko', r like 'error:%', r);

  -- A's own transfer cannot be pointed at B's gecko afterwards.
  g := ownership_test.mk_gecko('own-a@example.com', 'Retarget source');
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, created_by, expires_at)
       values (%L, 'gecko', %L, 'own-a@example.com', 'own-test-tok-a-r', 'own-a@example.com', now() + interval '3 days')$s$, g, a_uid));
  r := ownership_test.try_as('own-a@example.com', format(
    $s$update public.transfer_requests set animal_id = %L where token = 'own-test-tok-a-r'$s$, ownership_test.fx('gb')));
  perform ownership_test.expect('transfer: sender cannot re-point a transfer at someone else''s gecko',
    (select animal_id from public.transfer_requests where token = 'own-test-tok-a-r') = g, r);

  -- Legitimate: A sells a gecko to Y, Y claims it.
  g := ownership_test.mk_gecko('own-a@example.com', 'Sold to Y');
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, sale_price, created_by, expires_at)
       values (%L, 'gecko', %L, 'own-y@example.com', 'own-test-tok-a1', 250, 'own-a@example.com', now() + interval '3 days')$s$, g, a_uid));
  perform ownership_test.expect('transfer (legit): owner starts a transfer', r = 'ok:1', r);
  r := ownership_test.try_as('own-y@example.com', $s$select public.claim_transfer('own-test-tok-a1', true)$s$);
  perform ownership_test.expect('transfer (legit): buyer claims, owner and history move',
    r = 'ok:1'
    and (select created_by from public.geckos where id = g) = 'own-y@example.com'
    and (select owner_profile_id from public.geckos where id = g) = (select id from public.profiles where email = 'own-y@example.com')
    and exists (select 1 from public.collections c join public.geckos x on x.collection_id = c.id
                 where x.id = g and c.owner_email = 'own-y@example.com')
    and exists (select 1 from public.ownership_records where animal_id = g and created_by = 'own-y@example.com')
    and (select status from public.transfer_requests where token = 'own-test-tok-a1') = 'claimed', r);

  -- Once claimed, the sender cannot relabel the sale as cancelled.
  r := ownership_test.try_as('own-a@example.com',
    $s$update public.transfer_requests set status = 'cancelled', updated_date = now() where token = 'own-test-tok-a1'$s$);
  perform ownership_test.expect('transfer: a claimed transfer cannot be cancelled afterwards',
    (select status from public.transfer_requests where token = 'own-test-tok-a1') = 'claimed', r);

  -- Legitimate: the sender cancels a pending transfer.
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, created_by, expires_at)
       values (%L, 'gecko', %L, 'own-y@example.com', 'own-test-tok-a2', 'own-a@example.com', now() + interval '3 days')$s$,
    ownership_test.fx('gp'), a_uid));
  r := ownership_test.try_as('own-a@example.com',
    $s$update public.transfer_requests set status = 'cancelled', updated_date = now() where token = 'own-test-tok-a2' and status = 'pending'$s$);
  perform ownership_test.expect('transfer (legit): sender cancels',
    r = 'ok:1' and (select status from public.transfer_requests where token = 'own-test-tok-a2') = 'cancelled', r);

  -- A member cannot mark their own transfer claimed from the browser.
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, created_by, expires_at)
       values (%L, 'gecko', %L, 'own-y@example.com', 'own-test-tok-a5', 'own-a@example.com', now() + interval '3 days')$s$,
    ownership_test.fx('gp'), a_uid));
  r := ownership_test.try_as('own-a@example.com',
    $s$update public.transfer_requests set status = 'claimed' where token = 'own-test-tok-a5'$s$);
  perform ownership_test.expect('transfer: status claimed is set only by the claim',
    (select status from public.transfer_requests where token = 'own-test-tok-a5') = 'pending', r);

  -- Legitimate: another reptile.
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, created_by, expires_at)
       values ('own-test-reptile-t', 'other_reptile', %L, 'own-y@example.com', 'own-test-tok-a3', 'own-a@example.com', now() + interval '3 days')$s$, a_uid));
  r := ownership_test.try_as('own-y@example.com', $s$select public.claim_transfer('own-test-tok-a3', false)$s$);
  perform ownership_test.expect('transfer (legit): other reptile claimed',
    r = 'ok:1' and (select created_by from public.other_reptiles where id = 'own-test-reptile-t') = 'own-y@example.com', r);

  -- The sender gave the gecko to someone else before the buyer claimed.
  g := ownership_test.mk_gecko('own-a@example.com', 'Sold twice');
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, created_by, expires_at)
       values (%L, 'gecko', %L, 'own-y@example.com', 'own-test-tok-a4', 'own-a@example.com', now() + interval '3 days')$s$, g, a_uid));
  update public.geckos set created_by = 'own-e@example.com' where id = g;
  r := ownership_test.try_as('own-y@example.com', $s$select public.claim_transfer('own-test-tok-a4', false)$s$);
  perform ownership_test.expect('transfer: claim fails once the sender no longer owns the gecko',
    r like 'error:%no longer owns%' and (select created_by from public.geckos where id = g) = 'own-e@example.com', r);
end
$t$;

-- ---------------------------------------------------------------------------
-- 2. Care records and eggs
-- ---------------------------------------------------------------------------
do $c$
declare
  ga text := ownership_test.fx('ga');
  r text;
  q text;
  t record;
begin
  for t in
    select * from (values
      ('weight_records',    $s$insert into public.weight_records (gecko_id, weight_grams, record_date, created_by) values (%L, 35, current_date, %L)$s$),
      ('feeding_records',   $s$insert into public.feeding_records (animal_id, date, food_type, created_by) values (%L, current_date, 'CGD', %L)$s$),
      ('shed_records',      $s$insert into public.shed_records (animal_id, date, quality, created_by) values (%L, current_date, 'complete', %L)$s$),
      ('vet_records',       $s$insert into public.vet_records (animal_id, date, created_by) values (%L, current_date, %L)$s$),
      ('gecko_events',      $s$insert into public.gecko_events (gecko_id, event_type, event_date, created_by) values (%L, 'note', now(), %L)$s$),
      ('ownership_records', $s$insert into public.ownership_records (animal_id, owner_name, transfer_method, created_by) values (%L, 'Forged owner', 'gifted', %L)$s$)
    ) v(tbl, sql)
  loop
    r := ownership_test.try_as('own-b@example.com', format(t.sql, ga, 'own-b@example.com'));
    perform ownership_test.expect('records: member cannot write ' || t.tbl || ' on someone else''s gecko', r like 'error:%', r);

    r := ownership_test.try_as('own-a@example.com', format(t.sql, ga, 'own-a@example.com'));
    perform ownership_test.expect('records (legit): owner writes ' || t.tbl, r = 'ok:1', r);

    r := ownership_test.try_as('own-e@example.com', format(t.sql, ga, 'own-e@example.com'));
    perform ownership_test.expect('records (legit): collection editor writes ' || t.tbl, r = 'ok:1', r);

    r := ownership_test.try_as('own-v@example.com', format(t.sql, ga, 'own-v@example.com'));
    perform ownership_test.expect('records: collection viewer cannot write ' || t.tbl, r like 'error:%', r);
  end loop;

  -- Moving a record onto someone else's gecko with an update.
  r := ownership_test.try_as('own-b@example.com', format(
    $s$update public.weight_records set gecko_id = %L where created_by = 'own-b@example.com'$s$, ga));
  insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by)
  values ('own-test-w-b', ownership_test.fx('gb'), 20, current_date, 'own-b@example.com');
  r := ownership_test.try_as('own-b@example.com', format(
    $s$update public.weight_records set gecko_id = %L where id = 'own-test-w-b'$s$, ga));
  perform ownership_test.expect('records: member cannot move a weigh-in onto someone else''s gecko',
    (select gecko_id from public.weight_records where id = 'own-test-w-b') = ownership_test.fx('gb'), r);

  -- Other reptiles.
  q := $s$insert into public.reptile_events (reptile_id, event_type, event_date, created_by) values ('own-test-reptile-a', 'weight', now(), %L)$s$;
  r := ownership_test.try_as('own-b@example.com', format(q, 'own-b@example.com'));
  perform ownership_test.expect('records: member cannot write reptile_events on someone else''s reptile', r like 'error:%', r);
  r := ownership_test.try_as('own-a@example.com', format(q, 'own-a@example.com'));
  perform ownership_test.expect('records (legit): reptile owner writes reptile_events', r = 'ok:1', r);

  -- Eggs on a breeding plan.
  q := $s$insert into public.eggs (breeding_plan_id, lay_date, created_by) values ('own-test-plan-a', current_date, %L)$s$;
  r := ownership_test.try_as('own-b@example.com', format(q, 'own-b@example.com'));
  perform ownership_test.expect('eggs: member cannot add eggs to someone else''s breeding plan', r like 'error:%', r);
  r := ownership_test.try_as('own-a@example.com', format(q, 'own-a@example.com'));
  perform ownership_test.expect('eggs (legit): plan owner adds eggs', r = 'ok:1', r);

  -- Atomic gecko save (GeckoForm) by a collection editor, with a weigh-in.
  r := ownership_test.try_as('own-e@example.com', format(
    $s$select public.save_gecko_record('{"name":"Lilly White A","weight_grams":36}'::jsonb, gen_random_uuid(), %L, true, current_date)$s$, ga));
  perform ownership_test.expect('records (legit): editor saves the gecko form with a weigh-in', r = 'ok:1', r);

  -- Signed-out visitors still cannot write.
  r := ownership_test.try_as('anon', format(
    $s$insert into public.weight_records (gecko_id, weight_grams, record_date) values (%L, 1, current_date)$s$, ga));
  perform ownership_test.expect('records: signed-out visitor cannot write', r like 'error:%', r);
end
$c$;

do $d$
declare
  ga text := ownership_test.fx('ga');
  r text;
begin
  -- Rows forged before the fix: the gecko's owner can now remove them.
  insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by)
  values ('own-test-forged-w', ga, 999, current_date, 'own-b@example.com');
  insert into public.feeding_records (id, animal_id, date, created_by)
  values ('f0000000-0000-4000-8000-00000000000f', ga, current_date, 'own-b@example.com');
  insert into public.reptile_events (id, reptile_id, event_type, event_date, created_by)
  values ('own-test-forged-r', 'own-test-reptile-a', 'note', now(), 'own-b@example.com');

  r := ownership_test.try_as('own-a@example.com', $s$delete from public.weight_records where id = 'own-test-forged-w'$s$);
  perform ownership_test.expect('records: owner deletes a forged weigh-in on their gecko',
    not exists (select 1 from public.weight_records where id = 'own-test-forged-w'), r);
  r := ownership_test.try_as('own-a@example.com', $s$delete from public.feeding_records where id = 'f0000000-0000-4000-8000-00000000000f'$s$);
  perform ownership_test.expect('records: owner deletes a forged feeding on their gecko',
    not exists (select 1 from public.feeding_records where id = 'f0000000-0000-4000-8000-00000000000f'), r);
  r := ownership_test.try_as('own-a@example.com', $s$delete from public.reptile_events where id = 'own-test-forged-r'$s$);
  perform ownership_test.expect('records: owner deletes a forged event on their reptile',
    not exists (select 1 from public.reptile_events where id = 'own-test-forged-r'), r);

  -- Tables the owner could not even read before (events, vet visits, eggs
  -- on their plan): they can now see the forged row and delete it.
  insert into public.gecko_events (id, gecko_id, event_type, event_date, created_by)
  values ('own-test-forged-ev', ga, 'note', now(), 'own-b@example.com');
  insert into public.vet_records (id, animal_id, date, created_by)
  values ('e0000000-0000-4000-8000-00000000000e', ga, current_date, 'own-b@example.com');
  insert into public.eggs (id, breeding_plan_id, lay_date, created_by)
  values ('own-test-forged-egg', 'own-test-plan-a', current_date, 'own-b@example.com');
  r := ownership_test.try_as('own-a@example.com', $s$delete from public.gecko_events where id = 'own-test-forged-ev'$s$);
  perform ownership_test.expect('records: owner deletes a forged event on their gecko',
    not exists (select 1 from public.gecko_events where id = 'own-test-forged-ev'), r);
  r := ownership_test.try_as('own-a@example.com', $s$delete from public.vet_records where id = 'e0000000-0000-4000-8000-00000000000e'$s$);
  perform ownership_test.expect('records: owner deletes a forged vet visit on their gecko',
    not exists (select 1 from public.vet_records where id = 'e0000000-0000-4000-8000-00000000000e'), r);
  r := ownership_test.try_as('own-a@example.com', $s$delete from public.eggs where id = 'own-test-forged-egg'$s$);
  perform ownership_test.expect('eggs: plan owner deletes a forged egg on their plan',
    not exists (select 1 from public.eggs where id = 'own-test-forged-egg'), r);

  -- The new owner read rules do not open anyone else's records.
  perform ownership_test.expect('records: member cannot read events on someone else''s gecko',
    ownership_test.count_as('own-b@example.com', format(
      $s$select count(*) from public.gecko_events where gecko_id = %L and created_by <> 'own-b@example.com'$s$, ga)) = 0);

  -- Someone else cannot delete the owner's records.
  insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by)
  values ('own-test-real-w', ga, 30, current_date, 'own-a@example.com');
  r := ownership_test.try_as('own-b@example.com', $s$delete from public.weight_records where id = 'own-test-real-w'$s$);
  perform ownership_test.expect('records: member cannot delete the owner''s weigh-in',
    exists (select 1 from public.weight_records where id = 'own-test-real-w'), r);
end
$d$;

-- ---------------------------------------------------------------------------
-- 3. Gecko owner freeze and collections
-- ---------------------------------------------------------------------------
do $g$
declare
  g text;
  r text;
  cid_a uuid := ownership_test.fx('cid_a')::uuid;
  cid_b uuid := ownership_test.fx('cid_b')::uuid;
  cid_e uuid := ownership_test.fx('cid_e')::uuid;
  cid_a2 uuid;
begin
  g := ownership_test.mk_gecko('own-a@example.com', 'Freeze target 1');
  r := ownership_test.try_as('own-e@example.com', format(
    $s$update public.geckos set created_by = 'own-e@example.com' where id = %L$s$, g));
  perform ownership_test.expect('geckos: collection editor cannot take over created_by',
    (select created_by from public.geckos where id = g) = 'own-a@example.com', r);

  g := ownership_test.mk_gecko('own-a@example.com', 'Freeze target 2');
  r := ownership_test.try_as('own-a@example.com', format(
    $s$update public.geckos set created_by = 'own-b@example.com' where id = %L$s$, g));
  perform ownership_test.expect('geckos: owner cannot hand a gecko to someone without a transfer',
    (select created_by from public.geckos where id = g) = 'own-a@example.com', r);

  r := ownership_test.try_as('own-a@example.com', format(
    $s$update public.geckos set name = 'Lilly White A renamed' where id = %L$s$, ownership_test.fx('ga')));
  perform ownership_test.expect('geckos (legit): owner edits', r = 'ok:1', r);
  r := ownership_test.try_as('own-e@example.com', format(
    $s$update public.geckos set notes = 'Weighed by the editor' where id = %L$s$, ownership_test.fx('ga')));
  perform ownership_test.expect('geckos (legit): collection editor edits', r = 'ok:1', r);

  r := ownership_test.try_as('own-b@example.com', format(
    $s$insert into public.geckos (id, name, created_by, collection_id) values ('own-test-planted', 'Planted', 'own-b@example.com', %L)$s$, cid_a));
  perform ownership_test.expect('collections: member cannot add a gecko to someone else''s collection',
    not exists (select 1 from public.geckos where id = 'own-test-planted'), r);

  r := ownership_test.try_as('own-b@example.com', format(
    $s$update public.geckos set collection_id = %L where id = %L$s$, cid_a, ownership_test.fx('gb')));
  perform ownership_test.expect('collections: member cannot move their gecko into someone else''s collection',
    (select collection_id from public.geckos where id = ownership_test.fx('gb')) = cid_b, r);

  g := ownership_test.mk_gecko('own-a@example.com', 'Carry-off target');
  r := ownership_test.try_as('own-e@example.com', format(
    $s$update public.geckos set collection_id = %L where id = %L$s$, cid_e, g));
  perform ownership_test.expect('collections: editor cannot move the owner''s gecko into their own collection',
    (select collection_id from public.geckos where id = g) = cid_a, r);

  r := ownership_test.try_as('own-e@example.com', format(
    $s$insert into public.geckos (id, name, created_by, collection_id) values ('own-test-editor-add', 'Added by editor', 'own-e@example.com', %L)$s$, cid_a));
  perform ownership_test.expect('collections (legit): editor adds a gecko to the shared collection',
    (select collection_id from public.geckos where id = 'own-test-editor-add') = cid_a, r);

  r := ownership_test.try_as('own-n1@example.com',
    $s$insert into public.geckos (id, name, created_by) values ('own-test-first', 'First gecko', 'own-n1@example.com')$s$);
  perform ownership_test.expect('collections (legit): a brand new member''s first gecko creates their default collection',
    r = 'ok:1' and exists (select 1 from public.geckos x join public.collections c on c.id = x.collection_id
                             where x.id = 'own-test-first' and c.owner_email = 'own-n1@example.com'), r);

  r := ownership_test.try_as('own-n2@example.com',
    $s$select public.save_gecko_record('{"name":"First via form","weight_grams":4}'::jsonb, 'aaaaaaaa-0000-4000-8000-000000000001', null, true, current_date)$s$);
  perform ownership_test.expect('collections (legit): first gecko through the gecko form, with a weigh-in',
    r = 'ok:1' and exists (select 1 from public.weight_records where gecko_id = 'aaaaaaaa-0000-4000-8000-000000000001'), r);

  -- Deleting a collection sends each gecko back to its owner's default.
  r := ownership_test.try_as('own-a@example.com',
    $s$insert into public.collections (owner_email, name, is_default) values ('own-a@example.com', 'Project: Lilly White x Phantom', false)$s$);
  select id into cid_a2 from public.collections where owner_email = 'own-a@example.com' and name = 'Project: Lilly White x Phantom';
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.collection_members (collection_id, member_email, role, status, accepted_at) values (%L, 'own-a@example.com', 'owner', 'accepted', now())$s$, cid_a2));
  perform ownership_test.expect('collections (legit): owner creates a collection and their own seat', r = 'ok:1', r);
  insert into public.collection_members (collection_id, member_email, role, status, accepted_at)
  values (cid_a2, 'own-e@example.com', 'editor', 'accepted', now());
  r := ownership_test.try_as('own-e@example.com', format(
    $s$insert into public.geckos (id, name, created_by, collection_id) values ('own-test-rehome', 'Rehome me', 'own-e@example.com', %L)$s$, cid_a2));
  r := ownership_test.try_as('own-a@example.com', format($s$delete from public.collections where id = %L$s$, cid_a2));
  perform ownership_test.expect('collections (legit): deleting a collection rehomes an editor''s gecko',
    r = 'ok:1' and (select collection_id from public.geckos where id = 'own-test-rehome') = cid_e, r);
end
$g$;

-- A member's own gecko filed in someone else's shared collection stays
-- editable after they leave, are removed, or are made a viewer (the
-- collection is only checked when a gecko moves). Each case gets its own
-- collection owned by A with E as an accepted editor.
do $leave$
declare
  r text;
  v_case text;
  v_cid uuid;
  v_g text;
  cid_b uuid := ownership_test.fx('cid_b')::uuid;
  cid_e uuid := ownership_test.fx('cid_e')::uuid;
begin
  foreach v_case in array array['left', 'removed', 'made viewer'] loop
    insert into public.collections (owner_email, name, is_default)
    values ('own-a@example.com', 'Shared Harlequin project (' || v_case || ')', false)
    returning id into v_cid;
    insert into public.collection_members (collection_id, member_email, role, status, accepted_at)
    values (v_cid, 'own-a@example.com', 'owner', 'accepted', now()),
           (v_cid, 'own-e@example.com', 'editor', 'accepted', now());
    v_g := 'own-test-left-' || replace(v_case, ' ', '-');
    r := ownership_test.try_as('own-e@example.com', format(
      $s$insert into public.geckos (id, name, created_by, collection_id) values (%L, 'E Sable', 'own-e@example.com', %L)$s$, v_g, v_cid));
    perform ownership_test.expect('collections (legit): editor files their own gecko in the shared collection (' || v_case || ')', r = 'ok:1', r);

    -- The three ways a member stops being an editor. Leaving and removal
    -- are what CollectionsCard does (leave sets declined, remove deletes
    -- the seat); a role change to viewer is covered as well.
    if v_case = 'left' then
      r := ownership_test.try_as('own-e@example.com', format(
        $s$update public.collection_members set status = 'declined', declined_at = now() where collection_id = %L and member_email = 'own-e@example.com'$s$, v_cid));
    elsif v_case = 'removed' then
      r := ownership_test.try_as('own-a@example.com', format(
        $s$delete from public.collection_members where collection_id = %L and member_email = 'own-e@example.com'$s$, v_cid));
    else
      r := ownership_test.try_as('own-a@example.com', format(
        $s$update public.collection_members set role = 'viewer' where collection_id = %L and member_email = 'own-e@example.com'$s$, v_cid));
    end if;
    perform ownership_test.expect('collections (legit): editor seat ends (' || v_case || ')', r = 'ok:1', r);

    r := ownership_test.try_as('own-e@example.com', format(
      $s$update public.geckos set name = 'E Sable renamed' where id = %L$s$, v_g));
    perform ownership_test.expect('collections (legit): owner renames their gecko after the seat ends (' || v_case || ')',
      r = 'ok:1' and (select name from public.geckos where id = v_g) = 'E Sable renamed', r);

    -- The gecko form re-sends the unchanged collection_id.
    r := ownership_test.try_as('own-e@example.com', format(
      $s$select public.save_gecko_record(jsonb_build_object('name', 'E Sable via form', 'collection_id', %L), gen_random_uuid(), %L, false, current_date)$s$,
      v_cid, v_g));
    perform ownership_test.expect('collections (legit): owner saves through the gecko form after the seat ends (' || v_case || ')',
      r = 'ok:1' and (select name from public.geckos where id = v_g) = 'E Sable via form', r);

    r := ownership_test.try_as('own-e@example.com', format(
      $s$update public.geckos set archived = true, archived_date = now() where id = %L$s$, v_g));
    perform ownership_test.expect('collections (legit): owner archives their gecko after the seat ends (' || v_case || ')',
      r = 'ok:1' and (select archived from public.geckos where id = v_g), r);

    -- Still no way into a collection they cannot edit (B's default one).
    r := ownership_test.try_as('own-e@example.com', format(
      $s$update public.geckos set collection_id = %L where id = %L$s$, cid_b, v_g));
    perform ownership_test.expect('collections: after the seat ends, owner still cannot move the gecko into a collection they cannot edit (' || v_case || ')',
      (select collection_id from public.geckos where id = v_g) = v_cid, r);

    -- Moving it home to their own collection works.
    r := ownership_test.try_as('own-e@example.com', format(
      $s$update public.geckos set collection_id = %L where id = %L$s$, cid_e, v_g));
    perform ownership_test.expect('collections (legit): owner moves the gecko back to their own collection (' || v_case || ')',
      r = 'ok:1' and (select collection_id from public.geckos where id = v_g) = cid_e, r);
  end loop;
end
$leave$;

do $m$
declare
  r text;
  cid_a uuid := ownership_test.fx('cid_a')::uuid;
  gp text := ownership_test.fx('gp');
begin
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.collection_members (collection_id, member_email, role, status, accepted_at) values (%L, 'own-b@example.com', 'editor', 'accepted', now())$s$, cid_a));
  perform ownership_test.expect('invites: owner cannot add someone as already accepted', r like 'error:%', r);

  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.collection_members (collection_id, member_email, role, status) values (%L, 'own-x0@example.com', 'owner', 'pending')$s$, cid_a));
  perform ownership_test.expect('invites: owner cannot invite someone as owner', r like 'error:%', r);

  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.collection_members (collection_id, member_email, role, status, invite_token, invited_by_email, expires_at)
       values (%L, 'own-x9@example.com', 'editor', 'pending', 'own-test-invite-x9-000001', 'own-a@example.com', now() + interval '30 days')$s$, cid_a));
  perform ownership_test.expect('invites (legit): owner sends a pending invitation', r = 'ok:1', r);

  r := ownership_test.try_as('own-a@example.com', format(
    $s$update public.collection_members set status = 'accepted', accepted_at = now() where collection_id = %L and member_email = 'own-x9@example.com'$s$, cid_a));
  perform ownership_test.expect('invites: owner cannot accept on the invitee''s behalf',
    (select status from public.collection_members where collection_id = cid_a and member_email = 'own-x9@example.com') = 'pending', r);

  perform ownership_test.expect('invites: pending invitee cannot see geckos inside the collection',
    ownership_test.count_as('own-p@example.com', format($s$select count(*) from public.geckos where id = %L$s$, gp)) = 0);
  perform ownership_test.expect('invites (legit): pending invitee still sees the collection name',
    ownership_test.count_as('own-p@example.com', format($s$select count(*) from public.collections where id = %L$s$, cid_a)) = 1);
  perform ownership_test.expect('invites (legit): pending invitee sees their own invitation',
    ownership_test.count_as('own-p@example.com', format($s$select count(*) from public.collection_members where collection_id = %L$s$, cid_a)) = 1);

  r := ownership_test.try_as('own-p@example.com', $s$select public.accept_collection_invite('own-test-invite-p-0000001')$s$);
  perform ownership_test.expect('invites (legit): invitee accepts and then sees the collection''s geckos',
    r = 'ok:1' and ownership_test.count_as('own-p@example.com', format($s$select count(*) from public.geckos where id = %L$s$, gp)) = 1, r);

  r := ownership_test.try_as('own-p2@example.com', $s$select public.decline_collection_invite('own-test-invite-p2-000001')$s$);
  perform ownership_test.expect('invites (legit): invitee declines',
    r = 'ok:1' and (select status from public.collection_members where invite_token = 'own-test-invite-p2-000001') = 'declined', r);

  r := ownership_test.try_as('own-v@example.com', format(
    $s$update public.collection_members set status = 'declined', declined_at = now() where collection_id = %L and member_email = 'own-v@example.com'$s$, cid_a));
  perform ownership_test.expect('invites (legit): a member leaves the collection', r = 'ok:1', r);
end
$m$;

-- ---------------------------------------------------------------------------
-- 4. Plan caps
-- ---------------------------------------------------------------------------
do $cap$
declare
  r text;
  i integer;
  g text;
  cid_f uuid := ownership_test.fx('cid_f')::uuid;
  cid_k uuid := ownership_test.fx('cid_k')::uuid;
  a_uid uuid := (select id from auth.users where email = 'own-a@example.com');
begin
  -- Collaborators: Free 1, Keeper 5.
  r := ownership_test.try_as('own-f@example.com', format(
    $s$insert into public.collection_members (collection_id, member_email, role, status) values (%L, 'own-x1@example.com', 'editor', 'pending')$s$, cid_f));
  perform ownership_test.expect('caps (legit): Free invites its 1 collaborator', r = 'ok:1', r);
  r := ownership_test.try_as('own-f@example.com', format(
    $s$insert into public.collection_members (collection_id, member_email, role, status) values (%L, 'own-x2@example.com', 'editor', 'pending')$s$, cid_f));
  perform ownership_test.expect('caps: Free cannot invite a 2nd collaborator', r like 'error:%collaborator%', r);

  for i in 1..5 loop
    r := ownership_test.try_as('own-k@example.com', format(
      $s$insert into public.collection_members (collection_id, member_email, role, status) values (%L, %L, 'viewer', 'pending')$s$,
      cid_k, 'own-kx' || i || '@example.com'));
  end loop;
  perform ownership_test.expect('caps (legit): Keeper invites 5 collaborators', r = 'ok:1', r);
  r := ownership_test.try_as('own-k@example.com', format(
    $s$insert into public.collection_members (collection_id, member_email, role, status) values (%L, 'own-kx6@example.com', 'viewer', 'pending')$s$, cid_k));
  perform ownership_test.expect('caps: Keeper cannot invite a 6th collaborator', r like 'error:%collaborator%', r);

  -- Geckos: Free 10. F has 1; add 9 more to reach the cap.
  for i in 2..10 loop
    perform ownership_test.mk_gecko('own-f@example.com', 'Axanthic F ' || i);
  end loop;
  r := ownership_test.try_as('own-f@example.com',
    $s$insert into public.geckos (id, name, created_by) values ('own-test-f-11', 'Eleventh', 'own-f@example.com')$s$);
  perform ownership_test.expect('caps: Free cannot add an 11th active gecko', r like 'error:%holds up to 10 active geckos%', r);

  r := ownership_test.try_as('own-f@example.com',
    $s$insert into public.geckos (id, name, created_by, archived) values ('own-test-f-arch', 'Archived add', 'own-f@example.com', true)$s$);
  perform ownership_test.expect('caps (legit): an archived gecko can be added at the cap', r = 'ok:1', r);
  r := ownership_test.try_as('own-f@example.com',
    $s$update public.geckos set archived = false, archived_date = null where id = 'own-test-f-arch'$s$);
  perform ownership_test.expect('caps: unarchiving past the cap is blocked',
    (select archived from public.geckos where id = 'own-test-f-arch'), r);

  -- Claiming a transfer counts too.
  g := ownership_test.mk_gecko('own-a@example.com', 'Into a full account');
  r := ownership_test.try_as('own-a@example.com', format(
    $s$insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, created_by, expires_at)
       values (%L, 'gecko', %L, 'own-f@example.com', 'own-test-tok-cap', 'own-a@example.com', now() + interval '3 days')$s$, g, a_uid));
  r := ownership_test.try_as('own-f@example.com', $s$select public.claim_transfer('own-test-tok-cap', false)$s$);
  perform ownership_test.expect('caps: claiming a transfer past the cap is blocked',
    r like 'error:%holds up to 10 active geckos%' and (select created_by from public.geckos where id = g) = 'own-a@example.com', r);

  -- Keeper: 50. K has 1; add 49 more.
  for i in 2..50 loop
    perform ownership_test.mk_gecko('own-k@example.com', 'Sable K ' || i);
  end loop;
  r := ownership_test.try_as('own-k@example.com',
    $s$insert into public.geckos (id, name, created_by) values ('own-test-k-51', 'Fifty-first', 'own-k@example.com')$s$);
  perform ownership_test.expect('caps: Keeper cannot add a 51st active gecko', r like 'error:%Keeper plan holds up to 50%', r);

  -- An account already over its cap keeps editing and archiving.
  for i in 1..12 loop
    perform ownership_test.mk_gecko('own-o@example.com', 'Highway O ' || i);
  end loop;
  update public.profiles set membership_tier = 'free' where email = 'own-o@example.com';
  select id into g from public.geckos where created_by = 'own-o@example.com' order by id limit 1;
  r := ownership_test.try_as('own-o@example.com', format($s$update public.geckos set name = 'Highway O renamed' where id = %L$s$, g));
  perform ownership_test.expect('caps (legit): over-cap account still edits', r = 'ok:1', r);
  r := ownership_test.try_as('own-o@example.com', format(
    $s$update public.geckos set archived = true, archived_date = current_date, archive_reason = 'sold' where id = %L$s$, g));
  perform ownership_test.expect('caps (legit): over-cap account still archives', r = 'ok:1', r);
  r := ownership_test.try_as('own-o@example.com', format($s$update public.geckos set archived = false where id = %L$s$, g));
  perform ownership_test.expect('caps: over-cap account cannot unarchive', (select archived from public.geckos where id = g), r);
end
$cap$;

-- ---------------------------------------------------------------------------
-- 5. Profiles
-- ---------------------------------------------------------------------------
do $p$
declare
  r text;
begin
  r := ownership_test.try_as('own-b@example.com',
    $s$insert into public.profiles (email, full_name, business_name, created_by) values ('not-signed-up@example.com', 'Planted', 'Fake Geckos', 'own-b@example.com')$s$);
  perform ownership_test.expect('profiles: member cannot create a profile for another address',
    not exists (select 1 from public.profiles where email = 'not-signed-up@example.com'), r);

  -- A planted row from before the fix can no longer be edited by the planter.
  insert into public.profiles (email, full_name, created_by) values ('planted-earlier@example.com', 'Real person', 'own-b@example.com');
  r := ownership_test.try_as('own-b@example.com',
    $s$update public.profiles set business_name = 'Fake Geckos', bio = 'Scam' where email = 'planted-earlier@example.com'$s$);
  perform ownership_test.expect('profiles: planter cannot keep editing a planted profile',
    (select business_name from public.profiles where email = 'planted-earlier@example.com') is null, r);

  r := ownership_test.try_as('own-b@example.com',
    $s$update public.profiles set created_date = '2020-01-01' where email = 'own-b@example.com'$s$);
  perform ownership_test.expect('profiles: member cannot backdate member since',
    (select created_date from public.profiles where email = 'own-b@example.com') > now() - interval '1 day', r);

  r := ownership_test.try_as('own-b@example.com',
    $s$update public.profiles set email = 'someone-else@example.com', created_by = 'someone-else@example.com' where email = 'own-b@example.com'$s$);
  perform ownership_test.expect('profiles: member cannot move their profile to another address',
    exists (select 1 from public.profiles where email = 'own-b@example.com' and created_by = 'own-b@example.com'), r);

  perform ownership_test.put('b_profile_id', (select id::text from public.profiles where email = 'own-b@example.com'));
  r := ownership_test.try_as('own-b@example.com',
    $s$update public.profiles set id = gen_random_uuid() where email = 'own-b@example.com'$s$);
  perform ownership_test.expect('profiles: member cannot change their profile id',
    (select id::text from public.profiles where email = 'own-b@example.com') = ownership_test.fx('b_profile_id'), r);

  r := ownership_test.try_as('own-b@example.com',
    $s$update public.profiles set full_name = 'Member B', bio = 'Lilly White projects' where email = 'own-b@example.com'$s$);
  perform ownership_test.expect('profiles (legit): member edits their own profile',
    r = 'ok:1' and (select full_name from public.profiles where email = 'own-b@example.com') = 'Member B', r);

  -- Settings and onboarding save through an upsert keyed on email.
  r := ownership_test.try_as('own-b@example.com',
    $s$insert into public.profiles (email, full_name, updated_date) values ('own-b@example.com', 'Member B again', now())
       on conflict (email) do update set full_name = excluded.full_name, updated_date = excluded.updated_date$s$);
  perform ownership_test.expect('profiles (legit): settings upsert saves',
    r = 'ok:1' and (select full_name from public.profiles where email = 'own-b@example.com') = 'Member B again', r);

  -- A member whose profile row is missing can create their own; the
  -- server fills created_by and created_date.
  delete from public.profiles where email = 'own-n3@example.com';
  r := ownership_test.try_as('own-n3@example.com',
    $s$insert into public.profiles (email, full_name, created_by, created_date) values ('own-n3@example.com', 'N3', 'someone@example.com', '2019-01-01')$s$);
  perform ownership_test.expect('profiles (legit): member creates their own missing profile, dates set by the server',
    r = 'ok:1' and exists (select 1 from public.profiles where email = 'own-n3@example.com'
                             and created_by = 'own-n3@example.com' and created_date > now() - interval '1 day'), r);

  perform ownership_test.expect('profiles (legit): signup trigger creates the profile',
    exists (select 1 from public.profiles where email = 'own-y@example.com' and created_by = 'own-y@example.com'));

  r := ownership_test.try_as('own-y@example.com',
    $s$update public.profiles set membership_tier = 'breeder', role = 'admin' where email = 'own-y@example.com'$s$);
  perform ownership_test.expect('profiles: member still cannot raise their own plan or role',
    (select membership_tier = 'free' and role = 'user' from public.profiles where email = 'own-y@example.com'), r);

  -- redeem_signup_grant (store signup codes) now really changes the plan.
  insert into public.store_signup_grants (token, granted_email, granted_tier, granted_duration_days, expires_at)
  values ('own-test-grant-b', 'own-b@example.com', 'keeper', 90, now() + interval '1 day');
  r := ownership_test.try_as('own-b@example.com', $s$select public.redeem_signup_grant('own-test-grant-b')$s$);
  perform ownership_test.expect('profiles (legit): redeem_signup_grant gives the plan it promises',
    (select membership_tier = 'keeper' and membership_expires_at > now() + interval '80 days'
       from public.profiles where email = 'own-b@example.com'), r);
  perform ownership_test.expect('profiles: the plan switch does not outlive the grant call',
    coalesce(current_setting('geck.profile_privileged_write', true), '') <> 'on');
end
$p$;

-- ---------------------------------------------------------------------------
-- 6. Helper grants
-- ---------------------------------------------------------------------------
do $h$
declare
  f text;
begin
  foreach f in array array[
    'public.can_edit_gecko(text)', 'public.can_edit_reptile(text)', 'public.owns_animal(text)',
    'public.is_animal_owner(text,text)', 'public.can_edit_breeding_plan(text)',
    'public.can_write_collection(uuid)', 'public.is_collection_invitee(uuid)'
  ] loop
    perform ownership_test.expect('grants: ' || f || ' is security definer, authenticated only',
      to_regprocedure(f) is not null
      and (select prosecdef and proconfig is not null from pg_proc where oid = to_regprocedure(f))
      and has_function_privilege('authenticated', f, 'execute')
      and not has_function_privilege('anon', f, 'execute'));
  end loop;
end
$h$;

select case when ok then 'PASS' else 'FAIL' end as result, check_name, detail
  from ownership_test.results
 order by seq;

do $final$
declare
  v_failed integer;
  v_total integer;
begin
  select count(*) filter (where not ok), count(*) into v_failed, v_total from ownership_test.results;
  if v_failed > 0 then
    raise exception '% of % ownership checks failed', v_failed, v_total;
  end if;
  raise notice 'All % ownership checks passed', v_total;
end
$final$;

rollback;
