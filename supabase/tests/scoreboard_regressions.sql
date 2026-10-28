-- The weekly scoreboard (admin Funnel card).
-- Regression checks for supabase/migrations/20261015151500_scoreboard.sql,
-- 20261016090500_revenue_counts.sql and
-- 20261028040100_scoreboard_honest_counts.sql (section 6: App Store sandbox
-- purchases, internal accounts and prepaid years).
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser:
-- it creates its own members and switches roles the way the API does
-- (request.jwt.claims plus SET ROLE). Every change rolls back. It is not
-- meant for the Supabase SQL editor.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/scoreboard_regressions.sql
--
-- It checks two things: only admins can read or write any of it, and each
-- number on the card follows its written definition (who counts as paying,
-- who counts as active, and that admin accounts are left out).
begin;

create temp table _who (
  tag text primary key,
  uid uuid not null,
  email text not null
) on commit drop;
grant all on _who to public;

create function pg_temp.mk(p_tag text, p_role text default 'user', p_age interval default interval '0')
returns void
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := 'score-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now() - p_age, now() - p_age);
  if not exists (select 1 from public.profiles where email = v_email) then
    insert into public.profiles (email) values (v_email);
  end if;
  update public.profiles set role = p_role, membership_tier = 'free' where email = v_email;
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
create function pg_temp.who(p_tag text) returns text language sql stable as $$
  select email from _who where tag = p_tag
$$;
create function pg_temp.gecko(p_tag text, p_owner text, p_passport text default null)
returns text language plpgsql as $$
declare v_id text := 'score-gecko-' || p_tag;
begin
  insert into public.geckos (id, name, created_by, is_public, archived, status, passport_code)
  values (v_id, 'Gecko ' || p_tag, pg_temp.who(p_owner), true, false, 'Pet', p_passport);
  return v_id;
end $$;

-- The role switchers are called while acting as a member or visitor.
grant execute on all functions in schema pg_temp to public;

-- The cast. Each line says what the scoreboard should make of them.
select pg_temp.mk('admin', 'admin');      -- the admin: never counted anywhere
select pg_temp.mk('payer');               -- Breeder monthly on Stripe: paying
select pg_temp.mk('annual');              -- Keeper annual on Stripe: paying keeper
select pg_temp.mk('comped');              -- pays, but holds a current comp: shown apart
select pg_temp.mk('trial');               -- Stripe trial: not paying
select pg_temp.mk('grand');               -- grandfathered: not paying
select pg_temp.mk('lifepaid');            -- lifetime with a payment on record: paying
select pg_temp.mk('lifefree');            -- lifetime with no payment: unverified, not paying
select pg_temp.mk('oldcomp');             -- an expired comp does not hide a payer
select pg_temp.mk('buyer');               -- claims a passport transfer
select pg_temp.mk('olduser', 'user', interval '3 days'); -- signed up 3 days ago, added a gecko within a day
select pg_temp.mk('slowuser', 'user', interval '5 days'); -- signed up 5 days ago, no gecko
select pg_temp.mk('ancient', 'user', interval '30 days'); -- outside every signup window

update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'monthly',
       subscription_status = 'active', stripe_subscription_id = 'sub_payer'
 where email = pg_temp.who('payer');
update public.profiles set membership_tier = 'keeper', membership_billing_cycle = 'annual',
       subscription_status = 'past_due', stripe_subscription_id = 'sub_annual'
 where email = pg_temp.who('annual');
update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'monthly',
       subscription_status = 'active', stripe_subscription_id = 'sub_comped'
 where email = pg_temp.who('comped');
insert into public.membership_comps (email, tier, starts_at, ends_at, reason)
values (upper(pg_temp.who('comped')), 'breeder', now() - interval '1 day', now() + interval '30 days', 'test');
update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'monthly',
       subscription_status = 'active', stripe_subscription_id = 'sub_oldcomp'
 where email = pg_temp.who('oldcomp');
insert into public.membership_comps (email, tier, starts_at, ends_at, reason)
values (pg_temp.who('oldcomp'), 'breeder', now() - interval '60 days', now() - interval '30 days', 'test');
update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'monthly',
       subscription_status = 'trialing', stripe_subscription_id = 'sub_trial'
 where email = pg_temp.who('trial');
update public.profiles set membership_tier = 'breeder', subscription_status = 'grandfathered'
 where email = pg_temp.who('grand');
update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'lifetime',
       subscription_status = 'active'
 where email in (pg_temp.who('lifepaid'), pg_temp.who('lifefree'));
-- A lifetime purchase as the Stripe ledger records it (billed as lifetime).
insert into public.payment_events (id, stripe_event_id, user_email, event_type, amount_cents, status, billing_cycle)
values ('pe_score_life', 'evt_score_life', pg_temp.who('lifepaid'), 'checkout.session.completed', 34900, 'paid', 'lifetime');
-- The admin on a paid plan must still not show up as a paying member.
update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'monthly',
       subscription_status = 'active', stripe_subscription_id = 'sub_admin'
 where email = pg_temp.who('admin');

-- Geckos and records.
select pg_temp.gecko('payer1', 'payer', 'PASS-PAYER-1');
select pg_temp.gecko('payer2', 'payer');
select pg_temp.gecko('annual1', 'annual');
select pg_temp.gecko('admin1', 'admin', 'PASS-ADMIN-1');
select pg_temp.gecko('admin2', 'admin', 'PASS-ADMIN-2');

-- payer logs a weigh-in on their own gecko today: weekly active breeder.
insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by)
values ('score-w1', 'score-gecko-payer1', 40, current_date, pg_temp.who('payer'));
-- annual logs a feeding on their own gecko 10 days ago: active the week before, not this week.
insert into public.feeding_records (animal_id, date, created_by, created_date)
values ('score-gecko-annual1', current_date - 10, pg_temp.who('annual'), now() - interval '10 days');
-- comped writes a record on someone else's gecko (only possible as the
-- superuser now, but older rows exist): not their animal, so not counted.
insert into public.shed_records (animal_id, date, created_by)
values ('score-gecko-payer2', current_date, pg_temp.who('comped'));
-- The admin logs on their own gecko: left out.
insert into public.vet_records (animal_id, date, created_by)
values ('score-gecko-admin1', current_date, pg_temp.who('admin'));
-- Capitalisation of the owner address must not matter.
insert into public.gecko_events (id, gecko_id, event_type, event_date, created_by)
values ('score-e1', 'score-gecko-payer2', 'note', now(), upper(pg_temp.who('payer')));

-- olduser added a gecko within a day of signing up 3 days ago.
insert into public.geckos (id, name, created_by, is_public, archived, status, created_date)
values ('score-gecko-old1', 'Old', pg_temp.who('olduser'), false, false, 'Pet', now() - interval '3 days' + interval '2 hours');

-- Transfers. A claim from payer to buyer 20 days ago; buyer came back
-- 16 days after the claim. A claim from the admin's own gecko is separate.
insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, status, created_by, claimed_at, expires_at)
values ('score-gecko-payer2', 'gecko', (select uid from _who where tag = 'payer'), pg_temp.who('buyer'), 'score-tok-1', 'claimed',
        pg_temp.who('payer'), now() - interval '20 days', now() + interval '3 days'),
       ('score-gecko-admin2', 'gecko', (select uid from _who where tag = 'admin'), pg_temp.who('buyer'), 'score-tok-2', 'claimed',
        pg_temp.who('admin'), now() - interval '2 days', now() + interval '3 days');
insert into public.user_events (event_name, user_email, created_date)
values ('page_view', pg_temp.who('buyer'), now() - interval '4 days');
-- slowuser used the app today; ancient signed in today.
insert into public.user_events (event_name, user_email, created_date)
values ('page_view', upper(pg_temp.who('slowuser')), now());
update auth.users set last_sign_in_at = now() - interval '1 hour' where email = pg_temp.who('ancient');
-- The admin was active too, and must not count.
update auth.users set last_sign_in_at = now() where email = pg_temp.who('admin');

-- Hand-recorded entries already in the table (as the superuser).
insert into public.scoreboard_entries (kind, breeder_name, created_by)
values ('conversation', 'Seeded breeder', pg_temp.who('admin'));

-- 1. Who can reach any of it -------------------------------------------------

do $t$
declare n integer; ok boolean;
begin
  -- A signed-out visitor cannot run the function or touch the table.
  perform pg_temp.as_anon();
  ok := false;
  begin
    perform public.admin_scoreboard();
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL: a signed-out visitor could run admin_scoreboard()'; end if;
  ok := false;
  begin
    perform count(*) from public.scoreboard_entries;
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL: a signed-out visitor could read scoreboard_entries'; end if;

  -- A signed-in member is refused by the function and sees no rows.
  perform pg_temp.as_member('payer');
  ok := false;
  begin
    perform public.admin_scoreboard();
  exception when sqlstate '42501' then ok := true;
  end;
  if not ok then raise exception 'FAIL: a member could run admin_scoreboard()'; end if;
  select count(*) into n from public.scoreboard_entries;
  if n <> 0 then raise exception 'FAIL: a member could read % scoreboard entries', n; end if;
  ok := false;
  begin
    insert into public.scoreboard_entries (kind, breeder_name) values ('conversation', 'Sneaky');
  exception when insufficient_privilege then ok := true;
  end;
  if not ok then raise exception 'FAIL: a member could add a scoreboard entry'; end if;
  update public.scoreboard_entries set breeder_name = 'Changed';
  delete from public.scoreboard_entries;
  perform pg_temp.as_postgres();
  if not exists (select 1 from public.scoreboard_entries where breeder_name = 'Seeded breeder') then
    raise exception 'FAIL: a member changed or deleted a scoreboard entry';
  end if;
end
$t$;

-- 2. The admin can record entries, and bad entries are refused -------------

do $t$
declare n integer; ok boolean; v_by text;
begin
  perform pg_temp.as_member('admin');
  insert into public.scoreboard_entries (kind, breeder_name, notes) values ('conversation', 'Lilly White breeder', 'Call');
  insert into public.scoreboard_entries (kind, breeder_name) values ('import', 'Harlequin breeder');
  insert into public.scoreboard_entries (kind, amount_usd, entry_date) values ('monthly_cost', 87.50, current_date);
  select count(*) into n from public.scoreboard_entries;
  if n <> 4 then raise exception 'FAIL: admin should see 4 entries, saw %', n; end if;
  select created_by into v_by from public.scoreboard_entries where breeder_name = 'Harlequin breeder';
  if v_by is distinct from pg_temp.who('admin') then
    raise exception 'FAIL: created_by should default to the admin, got %', v_by;
  end if;
  update public.scoreboard_entries set notes = 'Fixed' where breeder_name = 'Harlequin breeder';
  delete from public.scoreboard_entries where breeder_name = 'Lilly White breeder';

  ok := false;
  begin
    insert into public.scoreboard_entries (kind) values ('monthly_cost');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FAIL: a cost entry without an amount was accepted'; end if;
  ok := false;
  begin
    insert into public.scoreboard_entries (kind, amount_usd) values ('conversation', 5);
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FAIL: a conversation with a dollar amount was accepted'; end if;
  ok := false;
  begin
    insert into public.scoreboard_entries (kind) values ('signup');
  exception when check_violation then ok := true;
  end;
  if not ok then raise exception 'FAIL: an unknown kind was accepted'; end if;
  perform pg_temp.as_postgres();
end
$t$;

-- 3. Each number follows its definition --------------------------------------

do $t$
declare
  s jsonb;
  paid jsonb;
  n integer;
begin
  perform pg_temp.as_member('admin');
  s := public.admin_scoreboard();
  perform pg_temp.as_postgres();
  paid := s -> 'paid_plans';

  -- Paying: payer (breeder monthly), oldcomp (breeder monthly), annual
  -- (keeper annual, past due still counts), lifepaid (breeder lifetime).
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r
   where not (r ->> 'comped')::boolean and r ->> 'tier' = 'breeder' and r ->> 'cycle' = 'monthly';
  if n <> 2 then raise exception 'FAIL: expected 2 breeder monthly payers, got % (%)', n, paid; end if;
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r
   where not (r ->> 'comped')::boolean and r ->> 'tier' = 'keeper' and r ->> 'cycle' = 'annual';
  if n <> 1 then raise exception 'FAIL: expected 1 keeper annual payer, got % (%)', n, paid; end if;
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r
   where not (r ->> 'comped')::boolean and r ->> 'cycle' = 'lifetime';
  if n <> 1 then raise exception 'FAIL: expected 1 lifetime payer with a payment on record, got % (%)', n, paid; end if;
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r
   where (r ->> 'comped')::boolean;
  if n <> 1 then raise exception 'FAIL: expected 1 payer holding a comp (any capitalisation), got % (%)', n, paid; end if;
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r;
  if n <> 5 then raise exception 'FAIL: trial, grandfathered, unpaid lifetime or admin leaked into paying: % (%)', n, paid; end if;
  if (s ->> 'unverified_lifetime')::int <> 1 then
    raise exception 'FAIL: expected 1 lifetime plan with no payment, got %', s ->> 'unverified_lifetime';
  end if;

  -- Passports.
  if (s #>> '{passports,issued}')::int <> 1 then raise exception 'FAIL: issued %', s -> 'passports'; end if;
  if (s #>> '{passports,issued_admin}')::int <> 2 then raise exception 'FAIL: issued_admin %', s -> 'passports'; end if;
  if (s #>> '{passports,claimed}')::int <> 1 then raise exception 'FAIL: claimed %', s -> 'passports'; end if;
  if (s #>> '{passports,claimed_7d}')::int <> 0 then raise exception 'FAIL: claimed_7d %', s -> 'passports'; end if;
  if (s #>> '{passports,claimed_admin}')::int <> 1 then raise exception 'FAIL: claimed_admin %', s -> 'passports'; end if;
  if (s #>> '{passports,claimers_eligible_14d}')::int <> 1 then raise exception 'FAIL: claimers eligible %', s -> 'passports'; end if;
  if (s #>> '{passports,claimers_active_after_14d}')::int <> 1 then raise exception 'FAIL: claimers active %', s -> 'passports'; end if;

  -- Activity, both definitions.
  if (s #>> '{activity,weekly_active_breeders}')::int <> 1 then
    raise exception 'FAIL: weekly active breeders should be 1 (payer only), got %', s -> 'activity';
  end if;
  if (select (w ->> 'active')::int from jsonb_array_elements(s -> 'breeder_weeks') w where (w ->> 'weeks_ago')::int = 1) <> 1 then
    raise exception 'FAIL: the week before should show 1 (annual), got %', s -> 'breeder_weeks';
  end if;
  if jsonb_array_length(s -> 'breeder_weeks') <> 8 then raise exception 'FAIL: expected 8 weeks of history'; end if;
  -- Signed in or used the app this week: buyer (event 4 days ago),
  -- slowuser (event today, upper-case address), ancient (sign-in today).
  if (s #>> '{activity,weekly_active_signed_in}')::int <> 3 then
    raise exception 'FAIL: weekly active signed in should be 3, got %', s -> 'activity';
  end if;
  if (s #>> '{activity,members}')::int <> 12 then
    raise exception 'FAIL: members should be 12 (admin left out), got %', s -> 'activity';
  end if;

  -- Signups: 9 member accounts made now plus olduser and slowuser are in the
  -- last 7 days; ancient and the admin are not. The day-one rate looks at
  -- olduser and slowuser only (the others are under a day old).
  if (s #>> '{signups,signups_7d}')::int <> 11 then raise exception 'FAIL: signups %', s -> 'signups'; end if;
  if (s #>> '{signups,first_gecko_eligible}')::int <> 2 then raise exception 'FAIL: eligible %', s -> 'signups'; end if;
  if (s #>> '{signups,first_gecko_1d}')::int <> 1 then raise exception 'FAIL: first gecko %', s -> 'signups'; end if;

  -- Email delivery: available exactly when the lifecycle email view exists
  -- in this copy (it does once 20261015151200_lifecycle_emails.sql is in).
  if to_regclass('public.email_delivery_stats') is null then
    if (s #>> '{email_delivery,available}')::boolean then
      raise exception 'FAIL: email delivery should read as unavailable without the view';
    end if;
  elsif not (s #>> '{email_delivery,available}')::boolean then
    raise exception 'FAIL: email delivery should read the real view, got %', s -> 'email_delivery';
  end if;
end
$t$;

-- 3b. The email delivery table: the last eight weeks, newest first, every
--     type of the current week present ------------------------------------

do $t$
declare
  s jsonb;
  v_row jsonb;
  v_prev_week date;
  v_prev_type text;
  v_newest date := (date_trunc('week', now() at time zone 'utc'))::date;
  n integer;
begin
  if to_regclass('public.email_deliveries') is null then
    return;
  end if;
  -- 20 email types sent every week for ten weeks: 200 type-weeks, far
  -- more than the old 50-row read.
  insert into public.email_deliveries (event_key, resend_email_id, email_type, event, occurred_at)
  select 'sb-' || w || '-' || t, 'sb-re-' || w || '-' || t, 'type_' || lpad(t::text, 2, '0'), 'sent',
         now() - w * interval '7 days'
    from generate_series(0, 9) w, generate_series(1, 20) t;

  perform pg_temp.as_member('admin');
  s := public.admin_scoreboard();
  perform pg_temp.as_postgres();
  if not (s #>> '{email_delivery,available}')::boolean then
    raise exception 'FAIL: email delivery not available: %', s -> 'email_delivery';
  end if;
  for v_row in select * from jsonb_array_elements(s #> '{email_delivery,rows}') loop
    if (v_row ->> 'week')::date < current_date - 56 then
      raise exception 'FAIL: a week older than eight weeks came back: %', v_row;
    end if;
    if v_prev_week is not null and (v_row ->> 'week')::date > v_prev_week then
      raise exception 'FAIL: weeks are not newest first at %', v_row;
    end if;
    if v_prev_week = (v_row ->> 'week')::date and (v_row ->> 'email_type') <= v_prev_type then
      raise exception 'FAIL: email types out of order within a week at %', v_row;
    end if;
    v_prev_week := (v_row ->> 'week')::date;
    v_prev_type := v_row ->> 'email_type';
  end loop;
  if (s #>> '{email_delivery,rows,0,week}')::date <> v_newest then
    raise exception 'FAIL: the first row is not the current week: %', s #> '{email_delivery,rows,0}';
  end if;
  select count(*) into n from jsonb_array_elements(s #> '{email_delivery,rows}') r
   where (r ->> 'week')::date = v_newest and r ->> 'email_type' like 'type_%';
  if n <> 20 then raise exception 'FAIL: the current week shows % of its 20 email types', n; end if;
  select count(*) into n from jsonb_array_elements(s #> '{email_delivery,rows}') r
   where r ->> 'email_type' like 'type_%';
  if n % 20 <> 0 or n < 160 then
    raise exception 'FAIL: % rows came back, expected whole weeks of 20 types', n;
  end if;
  delete from public.email_deliveries where event_key like 'sb-%';
end
$t$;

-- 4. Email delivery passes through when the view exists, and a broken view
--    does not take the card down. ---------------------------------------------

-- Swap in a small stand-in view (the real one, if present, is put back by
-- the rollback at the end).
drop view if exists public.email_delivery_stats;
create view public.email_delivery_stats as
  select (date_trunc('week', now() at time zone 'utc'))::date as week, 'reminder'::text as email_type,
         10 as sent, 9 as delivered, 1 as bounced;
do $t$
declare s jsonb;
begin
  perform pg_temp.as_member('admin');
  s := public.admin_scoreboard();
  perform pg_temp.as_postgres();
  if not (s #>> '{email_delivery,available}')::boolean
     or (s #>> '{email_delivery,rows,0,delivered}')::int <> 9 then
    raise exception 'FAIL: email delivery rows not passed through: %', s -> 'email_delivery';
  end if;
end
$t$;

create or replace view public.email_delivery_stats as
  select (date_trunc('week', now() at time zone 'utc'))::date as week, 'reminder'::text as email_type,
         10 / (select 0) as sent, 9 as delivered, 1 as bounced;
do $t$
declare s jsonb;
begin
  perform pg_temp.as_member('admin');
  s := public.admin_scoreboard();
  perform pg_temp.as_postgres();
  if (s #>> '{email_delivery,available}')::boolean or s #>> '{email_delivery,reason}' <> 'error' then
    raise exception 'FAIL: a broken view should read as an error, got %', s -> 'email_delivery';
  end if;
  if (s #>> '{activity,weekly_active_breeders}') is null then
    raise exception 'FAIL: a broken email view took the rest of the scoreboard down';
  end if;
end
$t$;

-- 5. App Store payers, the admin's own sales, and who may write analytics
--    rows in a member's name ---------------------------------------------------

select pg_temp.mk('storekeep');    -- App Store Keeper (annual product): paying keeper
select pg_temp.mk('storebreed');   -- App Store Breeder monthly: paying breeder
select pg_temp.mk('storeboth');    -- Keeper and Breeder both active: counted once, as Breeder
select pg_temp.mk('storelegacy');  -- the legacy 'Geck Inspect Pro' entitlement from the App Store: Breeder
select pg_temp.mk('storepromo');   -- a promotional grant: not paying
select pg_temp.mk('storetrial');   -- an App Store trial: not paying
select pg_temp.mk('storetest');    -- the RevenueCat Test Store: not paying
select pg_temp.mk('adminbuyer');   -- bought from the admin and came back: not a claimer
select pg_temp.mk('idle');         -- did nothing this week

insert into public.revenuecat_entitlements
  (app_user_id, entitlement_identifier, is_active, period_type, store, product_identifier, expires_at, updated_at)
values
  ((select uid from _who where tag = 'storekeep'), 'keeper', true, 'normal', 'app_store', 'com.geckinspect.keeper.annual', now() + interval '300 days', now()),
  ((select uid from _who where tag = 'storebreed'), 'breeder', true, 'normal', 'app_store', 'com.geckinspect.breeder.monthly', now() + interval '20 days', now()),
  ((select uid from _who where tag = 'storeboth'), 'keeper', true, 'normal', 'app_store', 'com.geckinspect.keeper.monthly', now() + interval '20 days', now()),
  ((select uid from _who where tag = 'storeboth'), 'breeder', true, 'normal', 'app_store', 'com.geckinspect.breeder.monthly', now() + interval '20 days', now() - interval '1 day'),
  ((select uid from _who where tag = 'storelegacy'), 'Geck Inspect Pro', true, 'normal', 'app_store', 'com.geckinspect.pro.monthly', now() + interval '20 days', now()),
  ((select uid from _who where tag = 'storepromo'), 'breeder', true, 'normal', 'promotional', 'rc_promo_breeder_monthly', now() + interval '20 days', now()),
  ((select uid from _who where tag = 'storetrial'), 'breeder', true, 'trial', 'app_store', 'com.geckinspect.breeder.monthly', now() + interval '5 days', now()),
  ((select uid from _who where tag = 'storetest'), 'Geck Inspect Pro', false, 'normal', 'test_store', 'geck_pro_monthly', now() - interval '5 days', now()),
  ((select uid from _who where tag = 'storetest'), 'breeder', true, 'normal', 'test_store', 'geck_breeder_monthly', now() + interval '20 days', now()),
  -- payer already pays through Stripe: counted once, through Stripe.
  ((select uid from _who where tag = 'payer'), 'breeder', true, 'normal', 'app_store', 'com.geckinspect.breeder.monthly', now() + interval '20 days', now());

-- The admin sold a gecko 20 days ago; the buyer came back 16 days later.
insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, status, created_by, claimed_at, expires_at)
values ('score-gecko-admin1', 'gecko', (select uid from _who where tag = 'admin'), pg_temp.who('adminbuyer'), 'score-tok-3', 'claimed',
        pg_temp.who('admin'), now() - interval '20 days', now() + interval '3 days');
insert into public.user_events (event_name, user_email, created_date)
values ('page_view', pg_temp.who('adminbuyer'), now() - interval '4 days');

do $t$
declare
  s jsonb;
  paid jsonb;
  n integer;
  v_before integer;
  v_email text;
begin
  perform pg_temp.as_member('admin');
  s := public.admin_scoreboard();
  perform pg_temp.as_postgres();
  paid := s -> 'paid_plans';

  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r
   where r ->> 'source' = 'app_store' and r ->> 'tier' = 'keeper' and r ->> 'cycle' = 'annual';
  if n <> 1 then raise exception 'FAIL: expected 1 App Store keeper (annual), got % (%)', n, paid; end if;
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r
   where r ->> 'source' = 'app_store' and r ->> 'tier' = 'breeder';
  -- storebreed, storeboth (as Breeder) and storelegacy.
  if n <> 3 then raise exception 'FAIL: expected 3 App Store breeders, got % (%)', n, paid; end if;
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r
   where r ->> 'source' = 'app_store';
  if n <> 4 then
    raise exception 'FAIL: promotional, trial, Test Store or a Stripe payer leaked into App Store payers: % (%)', n, paid;
  end if;
  -- payer still counts once, through Stripe: the 5 Stripe rows from
  -- section 3 stand.
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(paid) r
   where r ->> 'source' = 'stripe';
  if n <> 5 then raise exception 'FAIL: Stripe payers changed to % (%)', n, paid; end if;

  -- The admin's buyer does not count toward claimers still active.
  if (s #>> '{passports,claimers_eligible_14d}')::int <> 1
     or (s #>> '{passports,claimers_active_after_14d}')::int <> 1 then
    raise exception 'FAIL: buyers of the admin''s own sales counted as claimers: %', s -> 'passports';
  end if;
  v_before := (s #>> '{activity,weekly_active_signed_in}')::int;

  -- A signed-out visitor writes an analytics row naming an idle member:
  -- the row keeps no address, and the member does not become active.
  perform pg_temp.as_anon();
  insert into public.user_events (event_name, user_email, page, created_by)
  values ('page_view', pg_temp.who('idle'), 'Home', pg_temp.who('idle'));
  -- A signed-in member tries the same: the row carries their own address.
  perform pg_temp.as_member('storetrial');
  insert into public.user_events (event_name, user_email, page, created_by)
  values ('page_view', pg_temp.who('idle'), 'Home', pg_temp.who('idle'));
  perform pg_temp.as_postgres();
  if exists (select 1 from public.user_events where lower(user_email) = pg_temp.who('idle')
                                                 or lower(created_by) = pg_temp.who('idle')) then
    raise exception 'FAIL: an analytics row was written in another member''s name';
  end if;
  select user_email into v_email from public.user_events where page = 'Home' and user_email is not null;
  if v_email is distinct from pg_temp.who('storetrial') then
    raise exception 'FAIL: a member''s analytics row should carry their own address, got %', v_email;
  end if;

  perform pg_temp.as_member('admin');
  s := public.admin_scoreboard();
  perform pg_temp.as_postgres();
  -- storetrial really used the app (+1); idle did not.
  if (s #>> '{activity,weekly_active_signed_in}')::int <> v_before + 1 then
    raise exception 'FAIL: weekly active signed in went from % to %', v_before, s #>> '{activity,weekly_active_signed_in}';
  end if;
end
$t$;

-- 6. Sandbox purchases, internal accounts and prepaid years
--    (20261028040100_scoreboard_honest_counts.sql) -------------------------
--
-- These checks write each failure to _fails and report them together at
-- the end, so one run against an older function body lists every rule it
-- breaks instead of stopping at the first.

create temp table _fails (msg text) on commit drop;
create temp table _snap (k text primary key, s jsonb) on commit drop;
grant all on _fails, _snap to public;

-- The scoreboard before this section's cast exists.
do $t$
begin
  perform pg_temp.as_member('admin');
  insert into _snap values ('before', public.admin_scoreboard());
  perform pg_temp.as_postgres();
end
$t$;

select pg_temp.mk('sandbox');   -- App Store Breeder bought in the sandbox (TestFlight): keeps access, never paying
select pg_temp.mk('qa');        -- flagged internal: pays on Stripe, logs, sells, signs in. Never counted
select pg_temp.mk('qastr');     -- flagged internal with the string "true", on a real App Store plan: never counted
select pg_temp.mk('evalpay');   -- the Morph ID test account on a paid plan: never counted as paying
select pg_temp.mk('qabuyer');   -- internal account that claims a real breeder's transfer
select pg_temp.mk('rcuser');    -- rows written through apply_revenuecat_event

update auth.users set raw_app_meta_data = raw_app_meta_data || '{"internal": true}'::jsonb
 where email in (pg_temp.who('qa'), pg_temp.who('qabuyer'));
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"internal": "true"}'::jsonb
 where email = pg_temp.who('qastr');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"morph_eval": true}'::jsonb
 where email = pg_temp.who('evalpay');

update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'monthly',
       subscription_status = 'active', stripe_subscription_id = 'sub_qa'
 where email = pg_temp.who('qa');
update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'annual',
       subscription_status = 'active', stripe_subscription_id = 'sub_evalpay'
 where email = pg_temp.who('evalpay');
insert into public.revenuecat_entitlements
  (app_user_id, entitlement_identifier, is_active, period_type, store, product_identifier, expires_at, is_sandbox, updated_at)
values
  ((select uid from _who where tag = 'sandbox'), 'breeder', true, 'normal', 'app_store', 'com.geckinspect.breeder.annual', now() + interval '1 day', true, now()),
  ((select uid from _who where tag = 'qastr'), 'keeper', true, 'normal', 'app_store', 'com.geckinspect.keeper.monthly', now() + interval '20 days', false, now());

-- qa logs a weigh-in on its own gecko, has a passport on it, and signs in.
select pg_temp.gecko('qa1', 'qa', 'PASS-QA-1');
insert into public.weight_records (id, gecko_id, weight_grams, record_date, created_by)
values ('score-w-qa', 'score-gecko-qa1', 41, current_date, pg_temp.who('qa'));
update auth.users set last_sign_in_at = now() where email in (pg_temp.who('qa'), pg_temp.who('qabuyer'));
-- payer sells a gecko to qabuyer, and qa sells one to the real buyer, both
-- 20 days ago, and both buyers come back: neither claim is real use.
select pg_temp.gecko('payer3', 'payer');
insert into public.transfer_requests (animal_id, animal_type, from_user_id, to_email, token, status, created_by, claimed_at, expires_at)
values ('score-gecko-payer3', 'gecko', (select uid from _who where tag = 'payer'), pg_temp.who('qabuyer'), 'score-tok-qa1', 'claimed',
        pg_temp.who('payer'), now() - interval '20 days', now() + interval '3 days'),
       ('score-gecko-qa1', 'gecko', (select uid from _who where tag = 'qa'), pg_temp.who('buyer'), 'score-tok-qa2', 'claimed',
        pg_temp.who('qa'), now() - interval '20 days', now() + interval '3 days');

-- 6a. apply_revenuecat_event stores whether a purchase is a sandbox one.
do $t$
declare
  u uuid := (select uid from _who where tag = 'rcuser');
  v boolean;
begin
  perform pg_temp.as_postgres();

  -- A TestFlight purchase: the webhook says SANDBOX, the row says nothing.
  perform public.apply_revenuecat_event(
    '{"event": {"id": "score-rc-1", "type": "INITIAL_PURCHASE", "environment": "SANDBOX"}}'::jsonb,
    jsonb_build_array(jsonb_build_object('app_user_id', u, 'entitlement_identifier', 'breeder', 'is_active', true,
      'will_renew', true, 'period_type', 'normal', 'store', 'app_store', 'product_identifier', 'com.geckinspect.breeder.annual',
      'expires_at', now() + interval '1 day', 'last_event_id', 'score-rc-1', 'last_event_at', now() - interval '10 minutes')));
  select is_sandbox into v from public.revenuecat_entitlements where app_user_id = u and entitlement_identifier = 'breeder';
  if v is distinct from true then insert into _fails values ('a SANDBOX webhook did not mark the entitlement as sandbox (got ' || coalesce(v::text, 'null') || ')'); end if;
  -- Sandbox purchases still unlock the plan, so App Review can test it.
  if public.effective_tier_for_email(pg_temp.who('rcuser')) <> 'breeder' then
    insert into _fails values ('a sandbox purchase no longer unlocks Breeder');
  end if;

  -- A purchase sync carries no environment: the stored flag stays, and a
  -- row seen for the first time starts as not sandbox.
  perform public.apply_revenuecat_event(
    jsonb_build_object('event', jsonb_build_object('id', 'score-rc-2', 'type', 'CUSTOMER_SYNC', 'app_user_id', u)),
    jsonb_build_array(
      jsonb_build_object('app_user_id', u, 'entitlement_identifier', 'breeder', 'is_active', true, 'will_renew', true,
        'store', 'app_store', 'expires_at', now() + interval '1 day', 'last_event_id', 'score-rc-2', 'last_event_at', now() - interval '9 minutes'),
      jsonb_build_object('app_user_id', u, 'entitlement_identifier', 'keeper', 'is_active', false, 'will_renew', false,
        'last_event_id', 'score-rc-2', 'last_event_at', now() - interval '9 minutes')));
  select is_sandbox into v from public.revenuecat_entitlements where app_user_id = u and entitlement_identifier = 'breeder';
  if v is distinct from true then insert into _fails values ('a purchase sync without an environment cleared the sandbox flag'); end if;
  select is_sandbox into v from public.revenuecat_entitlements where app_user_id = u and entitlement_identifier = 'keeper';
  if v is distinct from false then insert into _fails values ('a new row with no environment should start as not sandbox, got ' || coalesce(v::text, 'null')); end if;

  -- A PRODUCTION webhook with no row flag clears it.
  perform public.apply_revenuecat_event(
    '{"event": {"id": "score-rc-3", "type": "RENEWAL", "environment": "PRODUCTION"}}'::jsonb,
    jsonb_build_array(jsonb_build_object('app_user_id', u, 'entitlement_identifier', 'breeder', 'is_active', true, 'will_renew', true,
      'store', 'app_store', 'expires_at', now() + interval '1 day', 'last_event_id', 'score-rc-3', 'last_event_at', now() - interval '8 minutes')));
  select is_sandbox into v from public.revenuecat_entitlements where app_user_id = u and entitlement_identifier = 'breeder';
  if v is distinct from false then insert into _fails values ('a PRODUCTION webhook did not clear the sandbox flag'); end if;

  -- The row's own flag (the purchase in the customer snapshot) wins over
  -- the event, on a sync and on a webhook.
  perform public.apply_revenuecat_event(
    jsonb_build_object('event', jsonb_build_object('id', 'score-rc-4', 'type', 'CUSTOMER_SYNC', 'app_user_id', u)),
    jsonb_build_array(jsonb_build_object('app_user_id', u, 'entitlement_identifier', 'breeder', 'is_active', true, 'will_renew', true,
      'store', 'app_store', 'is_sandbox', true, 'expires_at', now() + interval '1 day', 'last_event_id', 'score-rc-4', 'last_event_at', now() - interval '7 minutes')));
  select is_sandbox into v from public.revenuecat_entitlements where app_user_id = u and entitlement_identifier = 'breeder';
  if v is distinct from true then insert into _fails values ('a sync row with is_sandbox true was not stored as sandbox'); end if;
  perform public.apply_revenuecat_event(
    '{"event": {"id": "score-rc-5", "type": "RENEWAL", "environment": "SANDBOX"}}'::jsonb,
    jsonb_build_array(jsonb_build_object('app_user_id', u, 'entitlement_identifier', 'breeder', 'is_active', true, 'will_renew', true,
      'store', 'app_store', 'is_sandbox', false, 'expires_at', now() + interval '1 day', 'last_event_id', 'score-rc-5', 'last_event_at', now() - interval '6 minutes')));
  select is_sandbox into v from public.revenuecat_entitlements where app_user_id = u and entitlement_identifier = 'breeder';
  if v is distinct from false then insert into _fails values ('the row''s is_sandbox false did not win over a SANDBOX webhook'); end if;

  -- Back to sandbox, then an older snapshot arrives late: it changes
  -- nothing, the flag included.
  perform public.apply_revenuecat_event(
    '{"event": {"id": "score-rc-6", "type": "RENEWAL", "environment": "sandbox"}}'::jsonb,
    jsonb_build_array(jsonb_build_object('app_user_id', u, 'entitlement_identifier', 'breeder', 'is_active', true, 'will_renew', true,
      'store', 'app_store', 'expires_at', now() + interval '1 day', 'last_event_id', 'score-rc-6', 'last_event_at', now() - interval '5 minutes')));
  perform public.apply_revenuecat_event(
    '{"event": {"id": "score-rc-7", "type": "RENEWAL", "environment": "PRODUCTION"}}'::jsonb,
    jsonb_build_array(jsonb_build_object('app_user_id', u, 'entitlement_identifier', 'breeder', 'is_active', true, 'will_renew', true,
      'store', 'app_store', 'is_sandbox', false, 'expires_at', now() + interval '1 day', 'last_event_id', 'score-rc-7', 'last_event_at', now() - interval '1 hour')));
  select is_sandbox into v from public.revenuecat_entitlements where app_user_id = u and entitlement_identifier = 'breeder';
  if v is distinct from true then insert into _fails values ('an older snapshot changed the sandbox flag, or a lower-case environment was not read'); end if;
end
$t$;

-- 6b. Prepaid years: what the table accepts.
do $t$
declare
  v_today date := (now() at time zone 'America/Denver')::date;
  ok boolean;
begin
  perform pg_temp.as_member('admin');
  begin
    insert into public.scoreboard_entries (kind, breeder_name, amount_usd, entry_date, notes) values
      ('prepaid', 'Crested Co Founding Breeder', 120, v_today - 30, 'Payment Link'),
      -- The same breeder again (a top-up), named with other capitals and spaces.
      ('prepaid', '  crested co founding breeder ', 60, v_today - 10, null),
      -- Exactly 12 months ago: the year is over.
      ('prepaid', 'Year Over Geckos', 120, (v_today - interval '12 months')::date, null),
      -- 12 months ago tomorrow: its last day is today.
      ('prepaid', 'Last Day Geckos', 120, (v_today - interval '12 months')::date + 1, null),
      -- Dated next week: not yet.
      ('prepaid', 'Next Week Geckos', 120, v_today + 7, null);
  exception when others then
    insert into _fails values ('the admin could not record prepaid years: ' || sqlerrm);
  end;

  ok := false;
  begin
    insert into public.scoreboard_entries (kind, amount_usd) values ('prepaid', 120);
  exception when check_violation then ok := true;
  end;
  if not ok then insert into _fails values ('a prepaid year without a breeder name was accepted'); end if;
  ok := false;
  begin
    insert into public.scoreboard_entries (kind, breeder_name, amount_usd) values ('prepaid', '   ', 120);
  exception when check_violation then ok := true;
  end;
  if not ok then insert into _fails values ('a prepaid year with a blank breeder name was accepted'); end if;
  ok := false;
  begin
    insert into public.scoreboard_entries (kind, breeder_name) values ('prepaid', 'No Amount Geckos');
  exception when check_violation then ok := true;
  end;
  if not ok then insert into _fails values ('a prepaid year without an amount was accepted'); end if;
  ok := false;
  begin
    insert into public.scoreboard_entries (kind, breeder_name, amount_usd) values ('prepaid', 'Free Year Geckos', 0);
  exception when check_violation then ok := true;
  end;
  if not ok then insert into _fails values ('a prepaid year of $0 was accepted'); end if;
  perform pg_temp.as_postgres();
end
$t$;

-- 6c. Every number leaves the sandbox and internal accounts out and
--     counts the prepaid years.
do $t$
declare
  s0 jsonb := (select s from _snap where k = 'before');
  s jsonb;
  pre jsonb;
  n integer;
  n0 integer;
begin
  perform pg_temp.as_member('admin');
  s := public.admin_scoreboard();
  perform pg_temp.as_postgres();

  -- Paying through Stripe or the App Store: nobody new. qa and evalpay
  -- pay on Stripe, qastr on the App Store, sandbox and rcuser in the
  -- sandbox, and none of that is a paying breeder.
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(s -> 'paid_plans') r where r ->> 'source' <> 'prepaid';
  select coalesce(sum((r ->> 'n')::int), 0) into n0 from jsonb_array_elements(s0 -> 'paid_plans') r where r ->> 'source' <> 'prepaid';
  if n <> n0 then insert into _fails values (format('sandbox or internal payers counted: Stripe and App Store payers went from %s to %s (%s)', n0, n, s -> 'paid_plans')); end if;
  select coalesce(sum((r ->> 'n')::int), 0) into n from jsonb_array_elements(s -> 'paid_plans') r
   where r ->> 'source' = 'app_store' and r ->> 'cycle' = 'annual' and r ->> 'tier' = 'breeder';
  if n <> 0 then insert into _fails values ('the sandbox Breeder annual counted as an App Store payer'); end if;
  if public.effective_tier_for_email(pg_temp.who('sandbox')) <> 'breeder' then
    insert into _fails values ('the sandbox Breeder lost access');
  end if;

  -- What was left out, for the card.
  if (s #>> '{left_out,sandbox_store}') is distinct from '2' then
    insert into _fails values ('left_out.sandbox_store should be 2 (sandbox, rcuser), got ' || coalesce(s #>> '{left_out,sandbox_store}', 'null'));
  end if;
  if (s #>> '{left_out,internal_accounts}') is distinct from '4' then
    insert into _fails values ('left_out.internal_accounts should be 4 (qa, qastr, evalpay, qabuyer), got ' || coalesce(s #>> '{left_out,internal_accounts}', 'null'));
  end if;

  -- Prepaid: Crested Co (two entries, one breeder) and Last Day Geckos.
  select r into pre from jsonb_array_elements(s -> 'paid_plans') r where r ->> 'source' = 'prepaid';
  if pre is null then
    insert into _fails values ('no prepaid row in paid_plans: ' || (s -> 'paid_plans')::text);
  else
    if (pre ->> 'n')::int <> 2 then insert into _fails values ('prepaid breeders should be 2, got ' || pre::text); end if;
    if (pre ->> 'monthly_usd')::numeric <> 25.00 then insert into _fails values ('prepaid recurring should be (120 + 60 + 120) / 12 = 25.00, got ' || pre::text); end if;
    if pre ->> 'tier' <> 'breeder' or (pre ->> 'comped')::boolean then insert into _fails values ('a prepaid year should be a non-comped Breeder: ' || pre::text); end if;
  end if;

  -- Passports: qa's passport and both of this section's claims sit apart.
  if (s #>> '{passports,issued}')::int <> (s0 #>> '{passports,issued}')::int then
    insert into _fails values ('an internal account''s passport counted as issued: ' || (s -> 'passports')::text);
  end if;
  if (s #>> '{passports,issued_internal}') is distinct from '1' then
    insert into _fails values ('issued_internal should be 1, got ' || coalesce(s #>> '{passports,issued_internal}', 'null'));
  end if;
  if (s #>> '{passports,claimed}')::int <> (s0 #>> '{passports,claimed}')::int
     or (s #>> '{passports,claimers_eligible_14d}')::int <> (s0 #>> '{passports,claimers_eligible_14d}')::int
     or (s #>> '{passports,claimers_active_after_14d}')::int <> (s0 #>> '{passports,claimers_active_after_14d}')::int then
    insert into _fails values ('a claim with an internal seller or buyer counted: before ' || (s0 -> 'passports')::text || ', after ' || (s -> 'passports')::text);
  end if;
  if (s #>> '{passports,claimed_internal}') is distinct from '2' then
    insert into _fails values ('claimed_internal should be 2, got ' || coalesce(s #>> '{passports,claimed_internal}', 'null'));
  end if;

  -- Activity: qa logged and signed in, qabuyer signed in; neither counts.
  -- sandbox and rcuser are new members but did nothing.
  if (s #>> '{activity,weekly_active_breeders}')::int <> (s0 #>> '{activity,weekly_active_breeders}')::int then
    insert into _fails values ('an internal account counted as a weekly active breeder: ' || (s -> 'activity')::text);
  end if;
  if (s #>> '{activity,weekly_active_signed_in}')::int <> (s0 #>> '{activity,weekly_active_signed_in}')::int then
    insert into _fails values ('an internal account counted as weekly active signed in: ' || (s -> 'activity')::text);
  end if;
  if (s #>> '{activity,members}')::int <> (s0 #>> '{activity,members}')::int + 2 then
    insert into _fails values ('members should grow by 2 (sandbox, rcuser), not by the internal accounts: ' || (s -> 'activity')::text);
  end if;
  if (s #>> '{signups,signups_7d}')::int <> (s0 #>> '{signups,signups_7d}')::int + 2 then
    insert into _fails values ('signups should grow by 2 (sandbox, rcuser), not by the internal accounts: ' || (s -> 'signups')::text);
  end if;
end
$t$;

do $t$
declare v text;
begin
  select string_agg(msg, '; ') into v from _fails;
  if v is not null then raise exception 'FAIL: %', v; end if;
end
$t$;

select 'scoreboard_regressions: all checks passed' as result;
rollback;
