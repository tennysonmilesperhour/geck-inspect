-- The weekly scoreboard (admin Funnel card).
-- Regression checks for supabase/migrations/20261015151500_scoreboard.sql.
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
insert into public.payment_events (id, stripe_event_id, user_email, event_type, amount_cents, status)
values ('pe_score_life', 'evt_score_life', pg_temp.who('lifepaid'), 'checkout.session.completed', 34900, 'paid');
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

-- 4. Email delivery passes through when the view exists, and a broken view
--    does not take the card down. ---------------------------------------------

-- Swap in a small stand-in view (the real one, if present, is put back by
-- the rollback at the end).
drop view if exists public.email_delivery_stats;
create view public.email_delivery_stats as
  select 'reminder'::text as category, 10 as sent, 9 as delivered, 1 as bounced;
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
  select 'reminder'::text as category, 10 / (select 0) as sent, 9 as delivered, 1 as bounced;
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

select 'scoreboard_regressions: all checks passed' as result;
rollback;
