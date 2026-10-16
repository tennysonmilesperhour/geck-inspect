-- Regression checks for supabase/migrations/20261016090500_revenue_counts.sql.
--
-- Plain SQL for a local Postgres copy of the schema, run as a superuser
-- after every migration. Everything happens inside one transaction and is
-- rolled back. Each check compares the admin numbers before and after a
-- fixture is added, so other rows in the copy do not matter.
--
-- 1. A subscription whose latest invoice charged $0 (a renewal under a
--    100% coupon) adds nothing to monthly recurring revenue; one whose
--    latest invoice charged money adds its plan's monthly price.
-- 2. A lifetime plan backed only by an older monthly payment is an
--    unverified lifetime plan, not a paying member; a lifetime payment
--    makes it paying.

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
  v_email text := 'revcount-' || p_tag || '-' || left(v_id::text, 8) || '@example.com';
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          'not-a-real-password', now(), '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb, now(), now());
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
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.who(p_tag text) returns text language sql stable as $$
  select email from _who where tag = p_tag
$$;
create function pg_temp.revenue() returns jsonb language plpgsql as $$
declare s jsonb;
begin
  perform pg_temp.as_member('admin');
  s := public.admin_revenue_summary();
  perform pg_temp.as_postgres();
  return s;
end $$;
create function pg_temp.board() returns jsonb language plpgsql as $$
declare s jsonb;
begin
  perform pg_temp.as_member('admin');
  s := public.admin_scoreboard();
  perform pg_temp.as_postgres();
  return s;
end $$;
-- Paying lifetime members on the board, comped or not.
create function pg_temp.lifetime_payers(s jsonb) returns integer language sql as $$
  select coalesce(sum((r ->> 'n')::int), 0)::int
  from jsonb_array_elements(s -> 'paid_plans') r
  where r ->> 'cycle' = 'lifetime'
$$;

grant execute on all functions in schema pg_temp to public;

select pg_temp.mk('admin', 'admin');
select pg_temp.mk('coupon');     -- paid once, then renewed under a 100% coupon
select pg_temp.mk('charged');    -- paid, then renewed and charged again
select pg_temp.mk('handlife');   -- paid monthly once, later given lifetime by hand
select pg_temp.mk('buylife');    -- bought lifetime

-- 1. Monthly recurring revenue ---------------------------------------------

do $t$
declare
  before jsonb;
  after_coupon jsonb;
  after_charged jsonb;
begin
  before := pg_temp.revenue();

  insert into public.payment_events (id, user_email, stripe_event_id, stripe_invoice_id, stripe_customer_id,
                                     stripe_subscription_id, event_type, status, amount_cents, currency,
                                     membership_tier, billing_cycle, event_timestamp)
  values
    ('stripe-invoice:in_rc_coupon_1', pg_temp.who('coupon'), 'evt_rc_coupon_1', 'in_rc_coupon_1', 'cus_rc_coupon',
     'sub_rc_coupon', 'invoice.paid', 'paid', 599, 'usd', 'breeder', 'monthly', now() - interval '35 days'),
    ('stripe-invoice:in_rc_coupon_2', pg_temp.who('coupon'), 'evt_rc_coupon_2', 'in_rc_coupon_2', 'cus_rc_coupon',
     'sub_rc_coupon', 'invoice.paid', 'paid', 0, 'usd', 'breeder', 'monthly', now() - interval '5 days');
  after_coupon := pg_temp.revenue();
  if (after_coupon ->> 'mrr_cents')::int <> (before ->> 'mrr_cents')::int then
    raise exception 'FAIL: a $0 renewal added % cents of MRR (before %, after %)',
      (after_coupon ->> 'mrr_cents')::int - (before ->> 'mrr_cents')::int, before ->> 'mrr_cents', after_coupon ->> 'mrr_cents';
  end if;
  if (after_coupon ->> 'paying_subscriptions')::int <> (before ->> 'paying_subscriptions')::int then
    raise exception 'FAIL: a $0 renewal counted as a paying subscription';
  end if;

  insert into public.payment_events (id, user_email, stripe_event_id, stripe_invoice_id, stripe_customer_id,
                                     stripe_subscription_id, event_type, status, amount_cents, currency,
                                     membership_tier, billing_cycle, event_timestamp)
  values
    ('stripe-invoice:in_rc_charged_1', pg_temp.who('charged'), 'evt_rc_charged_1', 'in_rc_charged_1', 'cus_rc_charged',
     'sub_rc_charged', 'invoice.paid', 'paid', 599, 'usd', 'breeder', 'monthly', now() - interval '35 days'),
    ('stripe-invoice:in_rc_charged_2', pg_temp.who('charged'), 'evt_rc_charged_2', 'in_rc_charged_2', 'cus_rc_charged',
     'sub_rc_charged', 'invoice.paid', 'paid', 599, 'usd', 'breeder', 'monthly', now() - interval '5 days');
  after_charged := pg_temp.revenue();
  if (after_charged ->> 'mrr_cents')::int - (after_coupon ->> 'mrr_cents')::int
     <> public.stripe_plan_monthly_cents('breeder', 'monthly') then
    raise exception 'FAIL: a charged renewal should add the Breeder monthly price, added %',
      (after_charged ->> 'mrr_cents')::int - (after_coupon ->> 'mrr_cents')::int;
  end if;
  if (after_charged ->> 'paying_subscriptions')::int <> (after_coupon ->> 'paying_subscriptions')::int + 1 then
    raise exception 'FAIL: a charged renewal should count as one paying subscription';
  end if;
end
$t$;

-- 2. Lifetime plans need a lifetime payment --------------------------------

do $t$
declare
  before jsonb;
  after_hand jsonb;
  after_buy jsonb;
begin
  before := pg_temp.board();

  update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'lifetime',
         subscription_status = 'active'
   where email = pg_temp.who('handlife');
  insert into public.payment_events (id, user_email, stripe_event_id, stripe_invoice_id, stripe_subscription_id,
                                     event_type, status, amount_cents, currency, membership_tier, billing_cycle,
                                     event_timestamp)
  values ('stripe-invoice:in_rc_hand_1', pg_temp.who('handlife'), 'evt_rc_hand_1', 'in_rc_hand_1', 'sub_rc_hand',
          'invoice.paid', 'paid', 599, 'usd', 'breeder', 'monthly', now() - interval '90 days');
  after_hand := pg_temp.board();
  if pg_temp.lifetime_payers(after_hand) <> pg_temp.lifetime_payers(before) then
    raise exception 'FAIL: a hand-granted lifetime plan with only a monthly payment counted as paying (%)', after_hand -> 'paid_plans';
  end if;
  if (after_hand ->> 'unverified_lifetime')::int <> (before ->> 'unverified_lifetime')::int + 1 then
    raise exception 'FAIL: a hand-granted lifetime plan should be one more unverified lifetime plan, got % then %',
      before ->> 'unverified_lifetime', after_hand ->> 'unverified_lifetime';
  end if;

  update public.profiles set membership_tier = 'breeder', membership_billing_cycle = 'lifetime',
         subscription_status = 'active'
   where email = pg_temp.who('buylife');
  insert into public.payment_events (id, user_email, stripe_event_id, stripe_customer_id, event_type, status,
                                     amount_cents, currency, membership_tier, billing_cycle, event_timestamp)
  values ('stripe-lifetime:pi_rc_buy', pg_temp.who('buylife'), 'evt_rc_buy', 'cus_rc_buy', 'checkout.session.completed',
          'paid', 14900, 'usd', 'breeder', 'lifetime', now() - interval '2 days');
  after_buy := pg_temp.board();
  if pg_temp.lifetime_payers(after_buy) <> pg_temp.lifetime_payers(after_hand) + 1 then
    raise exception 'FAIL: a bought lifetime plan should count as one paying lifetime member (%)', after_buy -> 'paid_plans';
  end if;
  if (after_buy ->> 'unverified_lifetime')::int <> (after_hand ->> 'unverified_lifetime')::int then
    raise exception 'FAIL: a bought lifetime plan should not be unverified';
  end if;
end
$t$;

select 'revenue_counts_regressions: all checks passed' as result;
rollback;
