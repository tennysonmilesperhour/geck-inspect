-- Stripe ledger regressions (migration 20261016130000_stripe_ledger.sql).
--
-- Plain SQL script for a local Postgres copy of the schema. It needs a
-- superuser: it writes auth.users and switches roles with set_config. It
-- is not pgTAP, and it is not meant for the Supabase SQL editor or for
-- production. Everything runs in one transaction and rolls back.
--
--   psql -X -v ON_ERROR_STOP=1 -d <scratch copy> -f supabase/tests/stripe_ledger_regressions.sql
--
-- The webhook log below has the same shape as production's on
-- 15 October 2026 (Stripe API 2026-04-22.dahlia), with made-up ids:
-- every invoice delivered twice (invoice.paid and
-- invoice.payment_succeeded), $0 invoices for a trial start, a
-- 100 percent coupon and a prorated plan switch, a Breeder invoice the old
-- webhook recorded as "free", a portal cancellation that sets cancel_at
-- (not cancel_at_period_end) followed a second later by the member's
-- feedback, a subscription that ended, one that was cancelled and then
-- resumed, a lifetime purchase, a store-webhook row and a payload that is
-- not JSON. Each check prints PASS or FAIL; the script ends with an error
-- when any check fails.
begin;

create schema ledger_test;
create table ledger_test.results (seq serial primary key, check_name text not null, ok boolean not null, detail text);
create function ledger_test.expect(p_name text, p_ok boolean, p_detail text default null) returns void
language sql as $$ insert into ledger_test.results (check_name, ok, detail) values (p_name, coalesce(p_ok, false), p_detail) $$;

create function ledger_test.mk_user(p_email text, p_customer text, p_role text default 'user') returns void
language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    lower(p_email), 'not-a-real-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );
  update public.profiles set stripe_customer_id = p_customer, role = p_role where email = lower(p_email);
end $$;

-- One webhook log row, written the way stripe-webhook writes it.
create function ledger_test.log(p_event_id text, p_type text, p_created bigint, p_object jsonb,
                                p_previous jsonb default null, p_source text default 'stripe-webhook')
returns void
language sql as $$
  insert into public.stripe_webhook_logs (id, stripe_event_id, stripe_event_type, processing_status, raw_payload, created_date, created_by)
  values (gen_random_uuid()::text, p_event_id, p_type, 'processed',
          jsonb_build_object('id', p_event_id, 'type', p_type, 'created', p_created, 'api_version', '2026-04-22.dahlia',
                             'data', case when p_previous is null then jsonb_build_object('object', p_object)
                                          else jsonb_build_object('object', p_object, 'previous_attributes', p_previous) end)::text,
          to_timestamp(p_created), p_source)
$$;

-- An invoice object as Stripe sends it, lines as (price, amount) pairs.
create function ledger_test.inv(p_id text, p_customer text, p_sub text, p_paid int, p_reason text, p_lines jsonb) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', p_id, 'object', 'invoice', 'customer', p_customer, 'status', 'paid', 'currency', 'usd',
    'amount_paid', p_paid, 'billing_reason', p_reason, 'customer_email', 'billing@ledger.test',
    'parent', jsonb_build_object('type', 'subscription_details', 'subscription_details', jsonb_build_object('subscription', p_sub)),
    'lines', jsonb_build_object('data', (
      select jsonb_agg(jsonb_build_object('amount', (l ->> 1)::int,
                                          'pricing', jsonb_build_object('type', 'price_details', 'price_details', jsonb_build_object('price', l ->> 0))))
      from jsonb_array_elements(p_lines) l)))
$$;

create function ledger_test.sub(p_id text, p_customer text, p_status text, p_price text,
                                p_cancel_at bigint default null, p_canceled_at bigint default null,
                                p_reason text default null, p_feedback text default null, p_ended_at bigint default null) returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', p_id, 'object', 'subscription', 'customer', p_customer, 'status', p_status,
    'cancel_at_period_end', false, 'cancel_at', p_cancel_at, 'canceled_at', p_canceled_at, 'ended_at', p_ended_at,
    'cancellation_details', jsonb_build_object('reason', p_reason, 'feedback', p_feedback, 'comment', null),
    'items', jsonb_build_object('data', jsonb_build_array(jsonb_build_object(
      'price', jsonb_build_object('id', p_price), 'current_period_end', extract(epoch from now() + interval '15 days')::bigint))))
$$;

do $setup$
declare
  keeper text := 'price_1TUxEsLBdc4xGjxqyPV4DOYb';
  breeder text := 'price_1TUxHGLBdc4xGjxqeieYNdE4';
  keeper_life text := 'price_1UQV93LBdc4xGjxq4AvXpui4';
  addon text := 'price_not_in_catalog';
  t_old bigint := extract(epoch from now() - interval '40 days')::bigint;
  t_recent bigint := extract(epoch from now() - interval '10 days')::bigint;
  t_c bigint := extract(epoch from now() - interval '14 days')::bigint;
  t_future bigint := extract(epoch from now() + interval '16 days')::bigint;
begin
  perform ledger_test.mk_user('keeper@ledger.test', 'cus_LEDGER_A');
  perform ledger_test.mk_user('coupon@ledger.test', 'cus_LEDGER_B');
  perform ledger_test.mk_user('breeder@ledger.test', 'cus_LEDGER_C');
  perform ledger_test.mk_user('lifetime@ledger.test', 'cus_LEDGER_D');
  perform ledger_test.mk_user('resumed@ledger.test', 'cus_LEDGER_E');
  perform ledger_test.mk_user('admin@ledger.test', null, 'admin');

  -- A: Keeper. Trial start ($0), the first real charge with a metered
  -- add-on line, and a renewal. Each invoice arrives twice.
  perform ledger_test.log('evt_A1a', 'invoice.payment_succeeded', t_old, ledger_test.inv('in_A1', 'cus_LEDGER_A', 'sub_A', 0, 'subscription_create', jsonb_build_array(jsonb_build_array(keeper, 0))));
  perform ledger_test.log('evt_A1b', 'invoice.paid', t_old, ledger_test.inv('in_A1', 'cus_LEDGER_A', 'sub_A', 0, 'subscription_create', jsonb_build_array(jsonb_build_array(keeper, 0))));
  perform ledger_test.log('evt_A2a', 'invoice.paid', t_old + 600, ledger_test.inv('in_A2', 'cus_LEDGER_A', 'sub_A', 299, 'subscription_update', jsonb_build_array(jsonb_build_array(keeper, 299), jsonb_build_array(addon, 0))));
  perform ledger_test.log('evt_A2b', 'invoice.payment_succeeded', t_old + 600, ledger_test.inv('in_A2', 'cus_LEDGER_A', 'sub_A', 299, 'subscription_update', jsonb_build_array(jsonb_build_array(keeper, 299), jsonb_build_array(addon, 0))));
  perform ledger_test.log('evt_A3a', 'invoice.paid', t_recent, ledger_test.inv('in_A3', 'cus_LEDGER_A', 'sub_A', 299, 'subscription_cycle', jsonb_build_array(jsonb_build_array(keeper, 299))));
  perform ledger_test.log('evt_A3b', 'invoice.payment_succeeded', t_recent, ledger_test.inv('in_A3', 'cus_LEDGER_A', 'sub_A', 299, 'subscription_cycle', jsonb_build_array(jsonb_build_array(keeper, 299))));

  -- B: a 100 percent coupon, a $0 switch to Breeder, a cancellation, and
  -- the end of the subscription.
  perform ledger_test.log('evt_B1', 'invoice.paid', t_recent, ledger_test.inv('in_B1', 'cus_LEDGER_B', 'sub_B', 0, 'subscription_create', jsonb_build_array(jsonb_build_array(keeper, 299))));
  perform ledger_test.log('evt_B2', 'invoice.paid', t_recent + 120, ledger_test.inv('in_B2', 'cus_LEDGER_B', 'sub_B', 0, 'subscription_update', jsonb_build_array(jsonb_build_array(keeper, 0), jsonb_build_array(breeder, 0))));
  perform ledger_test.log('evt_B3', 'customer.subscription.updated', t_recent + 240,
    ledger_test.sub('sub_B', 'cus_LEDGER_B', 'active', breeder, t_future, t_recent + 240, 'cancellation_requested'),
    '{"cancel_at": null, "canceled_at": null, "cancellation_details": {"reason": null}}'::jsonb);
  perform ledger_test.log('evt_B4', 'customer.subscription.deleted', t_recent + 3600,
    ledger_test.sub('sub_B', 'cus_LEDGER_B', 'canceled', breeder, null, t_recent + 240, 'cancellation_requested', null, t_recent + 3600));

  -- C: Breeder, $5.99, recorded as "free" by the old webhook; cancelled in
  -- the portal (cancel_at set), with feedback a second later.
  perform ledger_test.log('evt_C1a', 'invoice.paid', t_c, ledger_test.inv('in_C1', 'cus_LEDGER_C', 'sub_C', 599, 'subscription_create', jsonb_build_array(jsonb_build_array(breeder, 599))));
  perform ledger_test.log('evt_C1b', 'invoice.payment_succeeded', t_c, ledger_test.inv('in_C1', 'cus_LEDGER_C', 'sub_C', 599, 'subscription_create', jsonb_build_array(jsonb_build_array(breeder, 599))));
  perform ledger_test.log('evt_C2', 'customer.subscription.updated', t_c + 2000,
    ledger_test.sub('sub_C', 'cus_LEDGER_C', 'active', breeder, t_future, t_c + 2000, 'cancellation_requested'),
    '{"cancel_at": null, "canceled_at": null, "cancellation_details": {"reason": null}}'::jsonb);
  perform ledger_test.log('evt_C3', 'customer.subscription.updated', t_c + 2001,
    ledger_test.sub('sub_C', 'cus_LEDGER_C', 'active', breeder, t_future, t_c + 2000, 'cancellation_requested', 'unused'),
    '{"cancellation_details": {"feedback": null}}'::jsonb);
  insert into public.payment_events (id, user_email, stripe_event_id, stripe_invoice_id, stripe_customer_id, stripe_subscription_id,
                                     event_type, status, amount_cents, currency, membership_tier, billing_cycle, event_timestamp)
  values ('stripe-invoice:in_C1', 'breeder@ledger.test', 'evt_C1b', 'in_C1', 'cus_LEDGER_C', 'sub_C',
          'invoice.paid', 'paid', 599, 'usd', 'free', null, to_timestamp(t_c));
  -- The webhook already wrote the scheduled row from evt_C2, before the
  -- feedback arrived.
  insert into public.payment_events (id, user_email, stripe_event_id, stripe_customer_id, stripe_subscription_id,
                                     event_type, status, membership_tier, billing_cycle, cancellation_reason, cancel_at, event_timestamp)
  values ('stripe-cancel-scheduled:sub_C:' || (t_c + 2000), 'breeder@ledger.test', 'evt_C2', 'cus_LEDGER_C', 'sub_C',
          'cancel_scheduled', 'cancel_scheduled', 'breeder', 'monthly', 'cancellation_requested', to_timestamp(t_future), to_timestamp(t_c + 2000));

  -- D: a lifetime Keeper purchase.
  perform ledger_test.log('evt_D1', 'checkout.session.completed', t_recent,
    jsonb_build_object('id', 'cs_D', 'object', 'checkout.session', 'mode', 'payment', 'payment_status', 'paid',
                       'customer', 'cus_LEDGER_D', 'payment_intent', 'pi_D', 'amount_total', 14900, 'currency', 'usd',
                       'metadata', jsonb_build_object('supabase_email', 'lifetime@ledger.test', 'tier', 'keeper', 'billing_cycle', 'lifetime'),
                       'line_items', jsonb_build_object('data', jsonb_build_array(jsonb_build_object('amount', 14900, 'price', jsonb_build_object('id', keeper_life))))));

  -- E: cancelled, then resumed, and still paying.
  perform ledger_test.log('evt_E1', 'invoice.paid', t_recent, ledger_test.inv('in_E1', 'cus_LEDGER_E', 'sub_E', 299, 'subscription_cycle', jsonb_build_array(jsonb_build_array(keeper, 299))));
  perform ledger_test.log('evt_E2', 'customer.subscription.updated', t_recent + 100,
    ledger_test.sub('sub_E', 'cus_LEDGER_E', 'active', keeper, t_future, t_recent + 100, 'cancellation_requested'),
    '{"cancel_at": null, "canceled_at": null}'::jsonb);
  perform ledger_test.log('evt_E3', 'customer.subscription.updated', t_recent + 200,
    ledger_test.sub('sub_E', 'cus_LEDGER_E', 'active', keeper),
    jsonb_build_object('cancel_at', t_future, 'canceled_at', t_recent + 100));

  -- Not ours: the store webhook's row, and a payload that is not JSON.
  perform ledger_test.log('evt_store', 'invoice.paid', t_recent, ledger_test.inv('in_store', 'cus_LEDGER_A', null, 5000, 'manual', '[]'::jsonb), null, 'store-stripe-webhook');
  insert into public.stripe_webhook_logs (id, stripe_event_id, stripe_event_type, processing_status, raw_payload, created_by)
  values (gen_random_uuid()::text, 'evt_broken', 'invoice.paid', 'processed', '{not json', 'stripe-webhook');
end
$setup$;

-- The rebuild ---------------------------------------------------------------

do $t$
declare
  r jsonb;
  r2 jsonb;
  n_before integer;
begin
  r := public.rebuild_payment_events_from_webhook_log();
  perform ledger_test.expect('rebuild: six missing invoices added (C1 already existed)', (r ->> 'invoices_added')::int = 6, r::text);
  perform ledger_test.expect('rebuild: the Breeder invoice recorded as free is corrected', (r ->> 'invoice_plans_corrected')::int = 1, r::text);
  perform ledger_test.expect('rebuild: the lifetime purchase is added', (r ->> 'lifetime_added')::int = 1, r::text);
  perform ledger_test.expect('rebuild: scheduled cancellations for B and E added, C kept', (r ->> 'cancel_scheduled_added')::int = 2, r::text);
  perform ledger_test.expect('rebuild: C''s row picks up the later feedback', (r ->> 'cancel_scheduled_refreshed')::int = 1, r::text);
  perform ledger_test.expect('rebuild: the resumed subscription is recorded', (r ->> 'cancel_withdrawn_added')::int = 1, r::text);
  perform ledger_test.expect('rebuild: the ended subscription is recorded', (r ->> 'subscriptions_ended_added')::int = 1, r::text);

  select count(*) into n_before from public.payment_events;
  r2 := public.rebuild_payment_events_from_webhook_log();
  perform ledger_test.expect('rebuild again: adds and changes nothing',
    (select bool_and(value::int = 0) from jsonb_each_text(r2)) and (select count(*) from public.payment_events) = n_before, r2::text);
end
$t$;

do $t$
begin
  perform ledger_test.expect('one row per paid invoice, not one per delivery',
    (select count(*) from public.payment_events where id like 'stripe-invoice:%') = 7
    and (select count(distinct stripe_invoice_id) from public.payment_events where id like 'stripe-invoice:%') = 7);
  perform ledger_test.expect('store webhook and broken payloads are ignored',
    not exists (select 1 from public.payment_events where stripe_invoice_id = 'in_store' or stripe_event_id = 'evt_broken'));
  perform ledger_test.expect('Breeder invoice now reads breeder monthly, amount unchanged',
    (select membership_tier = 'breeder' and billing_cycle = 'monthly' and amount_cents = 599 and status = 'paid'
       from public.payment_events where id = 'stripe-invoice:in_C1'));
  perform ledger_test.expect('tier comes from the paid line, not the add-on or the credit',
    (select membership_tier from public.payment_events where id = 'stripe-invoice:in_A2') = 'keeper'
    and (select membership_tier from public.payment_events where id = 'stripe-invoice:in_B2') = 'breeder');
  perform ledger_test.expect('$0 invoices are recorded at $0',
    (select amount_cents from public.payment_events where id = 'stripe-invoice:in_B1') = 0);
  perform ledger_test.expect('invoice rows carry the subscription and the earliest event',
    (select stripe_subscription_id = 'sub_A' and stripe_event_id = 'evt_A1a' from public.payment_events where id = 'stripe-invoice:in_A1'));
  perform ledger_test.expect('lifetime row uses the webhook''s id and plan',
    (select membership_tier = 'keeper' and billing_cycle = 'lifetime' and amount_cents = 14900 and user_email = 'lifetime@ledger.test'
       from public.payment_events where id = 'stripe-lifetime:pi_D'));
  perform ledger_test.expect('C''s cancellation has Stripe''s reason and the member''s feedback',
    (select cancellation_reason = 'cancellation_requested' and cancellation_feedback = 'unused' and cancel_at > now()
       from public.payment_events where stripe_subscription_id = 'sub_C' and event_type = 'cancel_scheduled'));
  perform ledger_test.expect('one scheduled row for C despite two updates',
    (select count(*) from public.payment_events where stripe_subscription_id = 'sub_C' and event_type = 'cancel_scheduled') = 1);
  perform ledger_test.expect('B ended as churn, with its reason',
    (select status = 'subscription_cancelled' and cancellation_reason = 'cancellation_requested' and membership_tier = 'breeder'
       from public.payment_events where id = 'stripe-cancel:sub_B'));
  perform ledger_test.expect('E''s change of mind is keyed by its event',
    exists (select 1 from public.payment_events where id = 'stripe-cancel-withdrawn:evt_E3'));
  perform ledger_test.expect('no churn rows for a subscription that never cancelled',
    not exists (select 1 from public.payment_events where stripe_subscription_id = 'sub_A' and stripe_invoice_id is null));
end
$t$;

-- The admin figures ----------------------------------------------------------

do $t$
declare
  s jsonb;
  denied boolean := false;
begin
  perform set_config('request.jwt.claims', '{"email":"keeper@ledger.test","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  begin
    perform public.admin_revenue_summary();
  exception when others then
    denied := sqlerrm = 'admin_only';
  end;
  perform set_config('role', 'postgres', true);
  perform ledger_test.expect('a member cannot read the revenue figures', denied);

  perform set_config('request.jwt.claims', '{"email":"admin@ledger.test","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  s := public.admin_revenue_summary();
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  perform ledger_test.expect('MRR: Keeper 2.99 + Breeder 5.99 + resumed Keeper 2.99 (the coupon and the ended plan count nothing)',
    (s ->> 'mrr_cents')::numeric = 1197 and (s ->> 'paying_subscriptions')::int = 3, s::text);
  perform ledger_test.expect('MRR at risk is the Breeder plan waiting to cancel', (s ->> 'mrr_at_risk_cents')::numeric = 599, s::text);
  perform ledger_test.expect('all-time revenue: 2.99 + 2.99 + 5.99 + 2.99 + 149 lifetime', (s ->> 'revenue_cents')::numeric = 16396, s::text);
  perform ledger_test.expect('lifetime purchases counted', (s ->> 'lifetime_purchases')::int = 1 and (s ->> 'lifetime_cents')::numeric = 14900, s::text);
  perform ledger_test.expect('one cancellation scheduled (C), not the resumed or ended ones',
    (s ->> 'cancellations_scheduled')::int = 1 and s #>> '{scheduled,0,email}' = 'breeder@ledger.test'
    and s #>> '{scheduled,0,feedback}' = 'unused', s::text);
  perform ledger_test.expect('one cancellation in the last 30 days', (s ->> 'cancelled_30d')::int = 1, s::text);
  perform ledger_test.expect('paid invoices match the invoices Stripe shows as paid', (s ->> 'paid_invoices')::int = 7, s::text);

  -- Refunds come off revenue: a full refund of A2, a partial one of A3.
  update public.payment_events set status = 'refunded', amount_refunded_cents = 299 where id = 'stripe-invoice:in_A2';
  update public.payment_events set status = 'partial_refund', amount_refunded_cents = 100 where id = 'stripe-invoice:in_A3';
  perform set_config('request.jwt.claims', '{"email":"admin@ledger.test","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  s := public.admin_revenue_summary();
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  perform ledger_test.expect('refunds come off all-time revenue', (s ->> 'revenue_cents')::numeric = 16396 - 299 - 100
    and (s ->> 'refunded_cents')::numeric = 399, s::text);
  perform ledger_test.expect('a partial refund keeps the subscription in MRR', (s ->> 'mrr_cents')::numeric = 1197, s::text);
end
$t$;

-- Grants -----------------------------------------------------------------------

do $t$
begin
  perform ledger_test.expect('grants: the rebuild is server only',
    has_function_privilege('service_role', 'public.rebuild_payment_events_from_webhook_log()', 'execute')
    and not has_function_privilege('authenticated', 'public.rebuild_payment_events_from_webhook_log()', 'execute')
    and not has_function_privilege('anon', 'public.rebuild_payment_events_from_webhook_log()', 'execute'));
  perform ledger_test.expect('grants: revenue figures for signed-in callers (the function checks admin), not anon',
    has_function_privilege('authenticated', 'public.admin_revenue_summary()', 'execute')
    and not has_function_privilege('anon', 'public.admin_revenue_summary()', 'execute'));
  perform ledger_test.expect('grants: helpers are not callable from the API',
    not has_function_privilege('anon', 'public.stripe_price_plan(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.stripe_lines_plan(jsonb)', 'execute'));
end
$t$;

select case when ok then 'PASS' else 'FAIL' end as result, check_name, detail
  from ledger_test.results
 order by seq;

do $final$
declare
  v_failed integer;
  v_total integer;
begin
  select count(*) filter (where not ok), count(*) into v_failed, v_total from ledger_test.results;
  if v_failed > 0 then
    raise exception '% of % ledger checks failed', v_failed, v_total;
  end if;
  raise notice 'All % ledger checks passed', v_total;
end
$final$;

rollback;
