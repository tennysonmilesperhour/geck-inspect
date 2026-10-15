-- Stripe payment ledger: churn rows, a rebuild from the webhook log, and
-- the admin revenue figures (plan item E2 20 in
-- docs/planning/comprehensive-review-2026-10-14.md).
--
-- Why: on 15 October payment_events held 2 rows against 6 paid Stripe
-- invoices, one of them a Breeder invoice recorded as "free", and nothing
-- recorded that a member had cancelled. The admin could not tell revenue
-- or churn from the database. The stripe-webhook function now writes a row
-- for every paid invoice and every cancellation; this file adds the
-- columns those rows need, rebuilds the missing history from
-- stripe_webhook_logs (which keeps every event the function received),
-- and gives the admin panel one function to read.
--
-- 1. payment_events gains cancellation_reason, cancellation_feedback,
--    cancellation_comment, cancel_at and amount_refunded_cents.
-- 2. stripe_object_id, stripe_price_plan and stripe_plan_monthly_cents:
--    small helpers that read a Stripe id, map a price id to its tier and
--    billing cycle, and give a plan's price per month. The catalog mirrors
--    src/lib/stripe-config.js; src/lib/__tests__/stripeCatalogSync.test.js
--    fails if they drift.
-- 3. rebuild_payment_events_from_webhook_log(): writes the rows the
--    webhook log proves should exist (paid invoices, lifetime purchases,
--    cancellations) and corrects the tier on invoice rows from the
--    invoice's own lines. Row ids are the same ones the webhook uses, and
--    every insert skips a row that already exists, so running it again
--    adds nothing. It runs once at the end of this file.
-- 4. admin_revenue_summary(): monthly recurring revenue, all-time
--    revenue, refunds, and the cancellations waiting to take effect, for
--    the admin overview. It checks is_admin() and raises for anyone else.
--    A lifetime purchase is counted once, from its grant row, although
--    Stripe also sends its receipt as a paid invoice.
--
-- Refund and dispute events are not rebuilt from the log: the current
-- Stripe API leaves the invoice off a charge, and finding it needs a
-- Stripe API call, which SQL cannot make. Production had none on
-- 15 October; the webhook records new ones as they arrive.
--
-- Safe to run more than once. Every function grants EXECUTE explicitly
-- (default privileges no longer do; supabase/SCHEMA_CONVENTIONS.md 4a).

-- 1. Columns ---------------------------------------------------------------

alter table public.payment_events add column if not exists cancellation_reason text;
alter table public.payment_events add column if not exists cancellation_feedback text;
alter table public.payment_events add column if not exists cancellation_comment text;
alter table public.payment_events add column if not exists cancel_at timestamptz;
alter table public.payment_events add column if not exists amount_refunded_cents numeric;

comment on column public.payment_events.cancellation_reason is
  'Stripe cancellation_details.reason: cancellation_requested, payment_failed or payment_disputed.';
comment on column public.payment_events.cancellation_feedback is
  'The member''s portal answer (cancellation_details.feedback), such as too_expensive or unused.';
comment on column public.payment_events.cancellation_comment is
  'Free text the member typed when cancelling, if any.';
comment on column public.payment_events.cancel_at is
  'When a scheduled cancellation takes effect, or when the subscription ended.';
comment on column public.payment_events.amount_refunded_cents is
  'Money returned on this payment, so revenue can be counted net of refunds.';

create index if not exists payment_events_subscription_time_idx
  on public.payment_events (stripe_subscription_id, event_timestamp desc);

-- 2. Helpers ---------------------------------------------------------------

-- A Stripe reference is a bare id string, or an expanded object with an id.
create or replace function public.stripe_object_id(p_value jsonb)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case jsonb_typeof(p_value)
           when 'string' then nullif(p_value #>> '{}', '')
           when 'object' then nullif(p_value ->> 'id', '')
         end;
$function$;

-- Price id to plan. Mirrors PRICE_CATALOG in
-- supabase/functions/stripe-webhook/index.ts and TIER_PRICING in
-- src/lib/stripe-config.js (a unit test keeps all of them in sync).
create or replace function public.stripe_price_plan(p_price_id text)
returns table (tier text, cycle text)
language sql
immutable
set search_path to 'public'
as $function$
  select c.tier, c.cycle
  from (values
    ('price_1TUxEsLBdc4xGjxqyPV4DOYb', 'keeper', 'monthly'),
    ('price_1TVMLeLBdc4xGjxqA856z0Oe', 'keeper', 'annual'),
    ('price_1UQV93LBdc4xGjxq4AvXpui4', 'keeper', 'lifetime'),
    ('price_1TUxHGLBdc4xGjxqeieYNdE4', 'breeder', 'monthly'),
    ('price_1TVMOCLBdc4xGjxqK2HTmGfm', 'breeder', 'annual'),
    ('price_1UQV94LBdc4xGjxqwzNWvXyI', 'breeder', 'lifetime'),
    ('price_1TVLvmLBdc4xGjxqCVzbz0GQ', 'enterprise', 'monthly'),
    ('price_1TVMQYLBdc4xGjxqpZFuqV96', 'enterprise', 'annual')
  ) as c(price_id, tier, cycle)
  where c.price_id = p_price_id;
$function$;

-- A plan's list price per month, in cents (an annual plan is divided by
-- twelve). Lifetime plans are one-time and add nothing to monthly revenue.
create or replace function public.stripe_plan_monthly_cents(p_tier text, p_cycle text)
returns numeric
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_tier = 'keeper' and p_cycle = 'monthly' then 299::numeric
    when p_tier = 'keeper' and p_cycle = 'annual' then round(3000::numeric / 12, 2)
    when p_tier = 'breeder' and p_cycle = 'monthly' then 599::numeric
    when p_tier = 'breeder' and p_cycle = 'annual' then round(6000::numeric / 12, 2)
    when p_tier = 'enterprise' and p_cycle = 'monthly' then 9999::numeric
    when p_tier = 'enterprise' and p_cycle = 'annual' then round(100000::numeric / 12, 2)
    else 0::numeric
  end;
$function$;

-- The plan an invoice line, subscription item or Checkout line is for.
-- Same order as linePriceId in the webhook: price, then
-- pricing.price_details.price (API versions from 2025-03), then plan.
create or replace function public.stripe_line_price_id(p_line jsonb)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select coalesce(
    public.stripe_object_id(p_line -> 'price'),
    public.stripe_object_id(p_line #> '{pricing,price_details,price}'),
    public.stripe_object_id(p_line -> 'plan')
  );
$function$;

-- The membership line of a list of lines, the way membershipLine in the
-- webhook picks it: only catalog prices count, and when several do (a
-- prorated switch lists the old and the new price) the last line with a
-- positive amount wins, or the last one if none is positive.
create or replace function public.stripe_lines_plan(p_lines jsonb)
returns table (tier text, cycle text)
language sql
immutable
set search_path to 'public'
as $function$
  select sp.tier, sp.cycle
  from jsonb_array_elements(case when jsonb_typeof(p_lines) = 'array' then p_lines else '[]'::jsonb end)
         with ordinality as li(v, n)
  cross join lateral public.stripe_price_plan(public.stripe_line_price_id(li.v)) sp
  order by (coalesce(
              case when jsonb_typeof(li.v -> 'amount') = 'number' then (li.v ->> 'amount')::numeric end,
              case when jsonb_typeof(li.v -> 'amount_excluding_tax') = 'number' then (li.v ->> 'amount_excluding_tax')::numeric end,
              0) > 0) desc,
           li.n desc
  limit 1;
$function$;

revoke all on function public.stripe_object_id(jsonb) from public, anon, authenticated;
revoke all on function public.stripe_price_plan(text) from public, anon, authenticated;
revoke all on function public.stripe_plan_monthly_cents(text, text) from public, anon, authenticated;
revoke all on function public.stripe_line_price_id(jsonb) from public, anon, authenticated;
revoke all on function public.stripe_lines_plan(jsonb) from public, anon, authenticated;
grant execute on function public.stripe_object_id(jsonb) to service_role;
grant execute on function public.stripe_price_plan(text) to service_role;
grant execute on function public.stripe_plan_monthly_cents(text, text) to service_role;
grant execute on function public.stripe_line_price_id(jsonb) to service_role;
grant execute on function public.stripe_lines_plan(jsonb) to service_role;

-- 3. Rebuild from the webhook log ------------------------------------------

create or replace function public.rebuild_payment_events_from_webhook_log()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_invoices integer := 0;
  v_retagged integer := 0;
  v_lifetime integer := 0;
  v_scheduled integer := 0;
  v_scheduled_refreshed integer := 0;
  v_withdrawn integer := 0;
  v_ended integer := 0;
begin
  -- Only this function's own log rows (the store webhook shares the
  -- table), and only payloads that parse.
  create temporary table if not exists pg_temp._ledger_events (
    stripe_event_id text,
    event_type text,
    created bigint,
    obj jsonb,
    previous jsonb
  ) on commit drop;
  truncate pg_temp._ledger_events;

  insert into pg_temp._ledger_events
  select distinct on (l.stripe_event_id)
         l.stripe_event_id,
         l.stripe_event_type,
         coalesce(nullif(j.p ->> 'created', '')::bigint, extract(epoch from l.created_date)::bigint),
         j.p -> 'data' -> 'object',
         j.p -> 'data' -> 'previous_attributes'
  from public.stripe_webhook_logs l
  cross join lateral (select l.raw_payload::jsonb as p) j
  where coalesce(l.created_by, 'stripe-webhook') = 'stripe-webhook'
    and l.raw_payload is not null
    and pg_input_is_valid(l.raw_payload, 'jsonb')
    and l.stripe_event_type in (
      'invoice.paid', 'invoice.payment_succeeded',
      'checkout.session.completed', 'checkout.session.async_payment_succeeded',
      'customer.subscription.created', 'customer.subscription.updated',
      'customer.subscription.deleted'
    )
  order by l.stripe_event_id, l.created_date;

  -- 3a. Paid invoices. One row per invoice, from its earliest event.
  with inv as (
    select distinct on (e.obj ->> 'id')
           e.stripe_event_id, e.created, e.obj
    from pg_temp._ledger_events e
    where e.event_type in ('invoice.paid', 'invoice.payment_succeeded')
      and coalesce(e.obj ->> 'id', '') <> ''
      and coalesce(e.obj ->> 'status', 'paid') = 'paid'
    order by e.obj ->> 'id', e.created, e.stripe_event_id
  )
  insert into public.payment_events (
    id, user_email, stripe_event_id, stripe_invoice_id, stripe_customer_id,
    stripe_subscription_id, event_type, status, amount_cents, currency,
    membership_tier, billing_cycle, event_timestamp, created_by
  )
  select 'stripe-invoice:' || (i.obj ->> 'id'),
         who.email,
         i.stripe_event_id,
         i.obj ->> 'id',
         public.stripe_object_id(i.obj -> 'customer'),
         coalesce(i.obj #>> '{parent,subscription_details,subscription}', public.stripe_object_id(i.obj -> 'subscription')),
         'invoice.paid',
         'paid',
         coalesce(nullif(i.obj ->> 'amount_paid', '')::numeric, 0),
         coalesce(i.obj ->> 'currency', 'usd'),
         plan.tier,
         plan.cycle,
         to_timestamp(i.created),
         'stripe-ledger-rebuild'
  from inv i
  left join lateral public.stripe_lines_plan(i.obj #> '{lines,data}') plan on true
  cross join lateral (
    select coalesce(
      (select p.email from public.profiles p
        where p.stripe_customer_id = public.stripe_object_id(i.obj -> 'customer')
        order by p.email limit 1),
      nullif(i.obj ->> 'customer_email', '')
    ) as email
  ) who
  where who.email is not null
  on conflict do nothing;
  get diagnostics v_invoices = row_count;

  -- 3b. Correct the plan on invoice rows that already existed, from the
  -- invoice's own lines. Status and amounts are left alone.
  with inv as (
    select distinct on (e.obj ->> 'id') e.obj
    from pg_temp._ledger_events e
    where e.event_type in ('invoice.paid', 'invoice.payment_succeeded')
      and coalesce(e.obj ->> 'id', '') <> ''
    order by e.obj ->> 'id', e.created
  ),
  tagged as (
    select 'stripe-invoice:' || (i.obj ->> 'id') as id, plan.tier, plan.cycle
    from inv i
    cross join lateral public.stripe_lines_plan(i.obj #> '{lines,data}') plan
  )
  update public.payment_events pe
     set membership_tier = t.tier,
         billing_cycle = t.cycle,
         updated_date = now()
    from tagged t
   where pe.id = t.id
     and (pe.membership_tier is distinct from t.tier or pe.billing_cycle is distinct from t.cycle);
  get diagnostics v_retagged = row_count;

  -- 3c. Lifetime purchases: paid one-time Checkout sessions for a lifetime
  -- price. The webhook writes these as it grants access; this only fills a
  -- row that is missing. Same id as the webhook: stripe-lifetime:<intent>.
  with sess as (
    select distinct on (coalesce(public.stripe_object_id(e.obj -> 'payment_intent'), e.obj ->> 'id'))
           e.stripe_event_id, e.created, e.obj,
           public.stripe_object_id(e.obj -> 'payment_intent') as pi
    from pg_temp._ledger_events e
    where e.event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
      and e.obj ->> 'mode' = 'payment'
      and e.obj ->> 'payment_status' = 'paid'
    order by coalesce(public.stripe_object_id(e.obj -> 'payment_intent'), e.obj ->> 'id'), e.created
  ),
  life as (
    select s.*,
           case
             when plan.cycle = 'lifetime' and plan.tier in ('keeper', 'breeder') then plan.tier
             when s.obj #>> '{metadata,tier}' in ('keeper', 'breeder') then s.obj #>> '{metadata,tier}'
           end as tier
    from sess s
    left join lateral public.stripe_lines_plan(s.obj #> '{line_items,data}') plan on true
    where plan.cycle = 'lifetime' or s.obj #>> '{metadata,billing_cycle}' = 'lifetime'
  )
  insert into public.payment_events (
    id, user_email, stripe_event_id, stripe_invoice_id, stripe_customer_id,
    stripe_subscription_id, event_type, status, amount_cents, currency,
    membership_tier, billing_cycle, event_timestamp, created_by
  )
  select case when l.pi is not null then 'stripe-lifetime:' || l.pi
              else 'stripe-lifetime-session:' || (l.obj ->> 'id') end,
         who.email,
         l.stripe_event_id,
         public.stripe_object_id(l.obj -> 'invoice'),
         public.stripe_object_id(l.obj -> 'customer'),
         null,
         'checkout.session.completed',
         'paid',
         nullif(l.obj ->> 'amount_total', '')::numeric,
         coalesce(l.obj ->> 'currency', 'usd'),
         l.tier,
         'lifetime',
         to_timestamp(l.created),
         'stripe-ledger-rebuild'
  from life l
  cross join lateral (
    select coalesce(
      nullif(l.obj #>> '{metadata,supabase_email}', ''),
      nullif(l.obj #>> '{customer_details,email}', ''),
      (select p.email from public.profiles p
        where p.stripe_customer_id = public.stripe_object_id(l.obj -> 'customer')
        order by p.email limit 1)
    ) as email
  ) who
  where who.email is not null and l.tier is not null
  on conflict do nothing;
  get diagnostics v_lifetime = row_count;

  -- 3d. Cancellations, with the same ids and rules as cancellationRecord
  -- in the webhook.
  create temporary table if not exists pg_temp._ledger_subs (
    stripe_event_id text,
    event_type text,
    created bigint,
    obj jsonb,
    email text,
    pending boolean,
    was_pending boolean
  ) on commit drop;
  truncate pg_temp._ledger_subs;

  insert into pg_temp._ledger_subs
  select e.stripe_event_id, e.event_type, e.created, e.obj,
         (select p.email from public.profiles p
           where p.stripe_customer_id = public.stripe_object_id(e.obj -> 'customer')
           order by p.email limit 1),
         -- Waiting to cancel: still billing, with cancel_at set or
         -- cancel_at_period_end on. coalesce turns "field missing" (SQL
         -- null) into false, or "not pending" would read as unknown.
         coalesce((e.obj ->> 'status') in ('active', 'trialing', 'past_due', 'unpaid', 'paused')
           and ((e.obj -> 'cancel_at_period_end') = 'true'::jsonb
                or jsonb_typeof(e.obj -> 'cancel_at') = 'number'), false),
         -- Was waiting before this update. Stripe lists only the changed
         -- fields in previous_attributes; an unlisted one kept its value.
         coalesce(jsonb_typeof(e.previous) = 'object'
           and (e.previous ? 'cancel_at' or e.previous ? 'cancel_at_period_end' or e.previous ? 'canceled_at')
           and ((case when e.previous ? 'cancel_at_period_end' then e.previous -> 'cancel_at_period_end'
                      else e.obj -> 'cancel_at_period_end' end) = 'true'::jsonb
                or jsonb_typeof(case when e.previous ? 'cancel_at' then e.previous -> 'cancel_at'
                                     else e.obj -> 'cancel_at' end) = 'number'), false)
  from pg_temp._ledger_events e
  where e.event_type in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted')
    and coalesce(e.obj ->> 'id', '') <> '';

  -- Scheduled: one row per cancellation request. The first event gives the
  -- row its event id and time; the newest non-empty reason, feedback and
  -- comment win, because Stripe sends the member's feedback in a second
  -- update a moment later.
  with sched as (
    select s.*,
           'stripe-cancel-scheduled:' || (s.obj ->> 'id') || ':' ||
             coalesce(s.obj ->> 'canceled_at', s.obj ->> 'cancel_at', s.created::text) as row_id
    from pg_temp._ledger_subs s
    where s.event_type in ('customer.subscription.created', 'customer.subscription.updated')
      and s.pending
      and s.email is not null
  ),
  grouped as (
    select row_id,
           (array_agg(stripe_event_id order by created, stripe_event_id))[1] as first_event,
           min(created) as first_created,
           (array_agg(obj order by created desc, stripe_event_id desc))[1] as last_obj,
           (array_agg(email order by created desc))[1] as email,
           (array_agg(obj #>> '{cancellation_details,reason}' order by created desc)
              filter (where nullif(obj #>> '{cancellation_details,reason}', '') is not null))[1] as reason,
           (array_agg(obj #>> '{cancellation_details,feedback}' order by created desc)
              filter (where nullif(obj #>> '{cancellation_details,feedback}', '') is not null))[1] as feedback,
           (array_agg(obj #>> '{cancellation_details,comment}' order by created desc)
              filter (where nullif(obj #>> '{cancellation_details,comment}', '') is not null))[1] as comment
    from sched
    group by row_id
  )
  insert into public.payment_events (
    id, user_email, stripe_event_id, stripe_customer_id, stripe_subscription_id,
    event_type, status, amount_cents, membership_tier, billing_cycle,
    cancellation_reason, cancellation_feedback, cancellation_comment, cancel_at,
    event_timestamp, created_by
  )
  select g.row_id, g.email, g.first_event,
         public.stripe_object_id(g.last_obj -> 'customer'),
         g.last_obj ->> 'id',
         'cancel_scheduled', 'cancel_scheduled', null,
         plan.tier, plan.cycle,
         g.reason, g.feedback, g.comment,
         to_timestamp(coalesce(nullif(g.last_obj ->> 'cancel_at', '')::bigint,
                               nullif(g.last_obj ->> 'current_period_end', '')::bigint,
                               nullif(g.last_obj #>> '{items,data,0,current_period_end}', '')::bigint)),
         to_timestamp(g.first_created),
         'stripe-ledger-rebuild'
  from grouped g
  left join lateral public.stripe_lines_plan(g.last_obj #> '{items,data}') plan on true
  on conflict do nothing;
  get diagnostics v_scheduled = row_count;

  -- A row the webhook wrote before the feedback arrived picks it up here.
  with sched as (
    select 'stripe-cancel-scheduled:' || (s.obj ->> 'id') || ':' ||
             coalesce(s.obj ->> 'canceled_at', s.obj ->> 'cancel_at', s.created::text) as row_id,
           s.created, s.obj
    from pg_temp._ledger_subs s
    where s.event_type in ('customer.subscription.created', 'customer.subscription.updated')
      and s.pending
  ),
  grouped as (
    select row_id,
           (array_agg(obj #>> '{cancellation_details,reason}' order by created desc)
              filter (where nullif(obj #>> '{cancellation_details,reason}', '') is not null))[1] as reason,
           (array_agg(obj #>> '{cancellation_details,feedback}' order by created desc)
              filter (where nullif(obj #>> '{cancellation_details,feedback}', '') is not null))[1] as feedback,
           (array_agg(obj #>> '{cancellation_details,comment}' order by created desc)
              filter (where nullif(obj #>> '{cancellation_details,comment}', '') is not null))[1] as comment
    from sched
    group by row_id
  )
  update public.payment_events pe
     set cancellation_reason = coalesce(g.reason, pe.cancellation_reason),
         cancellation_feedback = coalesce(g.feedback, pe.cancellation_feedback),
         cancellation_comment = coalesce(g.comment, pe.cancellation_comment),
         updated_date = now()
    from grouped g
   where pe.id = g.row_id
     and (pe.cancellation_reason is distinct from coalesce(g.reason, pe.cancellation_reason)
          or pe.cancellation_feedback is distinct from coalesce(g.feedback, pe.cancellation_feedback)
          or pe.cancellation_comment is distinct from coalesce(g.comment, pe.cancellation_comment));
  get diagnostics v_scheduled_refreshed = row_count;

  -- Withdrawn: the member undid a cancellation before it took effect.
  insert into public.payment_events (
    id, user_email, stripe_event_id, stripe_customer_id, stripe_subscription_id,
    event_type, status, amount_cents, membership_tier, billing_cycle,
    event_timestamp, created_by
  )
  select 'stripe-cancel-withdrawn:' || s.stripe_event_id, s.email, s.stripe_event_id,
         public.stripe_object_id(s.obj -> 'customer'), s.obj ->> 'id',
         'cancel_withdrawn', 'cancel_withdrawn', null, plan.tier, plan.cycle,
         to_timestamp(s.created), 'stripe-ledger-rebuild'
  from pg_temp._ledger_subs s
  left join lateral public.stripe_lines_plan(s.obj #> '{items,data}') plan on true
  where s.event_type = 'customer.subscription.updated'
    and not s.pending
    and s.was_pending
    and s.email is not null
  on conflict do nothing;
  get diagnostics v_withdrawn = row_count;

  -- Ended. A lifetime member's old subscription is marked as replaced by
  -- the lifetime plan, which is an upgrade, not churn. The webhook cancels
  -- the old plan seconds after the lifetime purchase, so only an ending
  -- within a day of a lifetime purchase counts as replaced: a member who
  -- cancelled for real and bought lifetime months later stays churn. A
  -- lifetime member with no purchase row at all (bought before the ledger)
  -- falls back to the profile.
  insert into public.payment_events (
    id, user_email, stripe_event_id, stripe_customer_id, stripe_subscription_id,
    event_type, status, amount_cents, membership_tier, billing_cycle,
    cancellation_reason, cancellation_feedback, cancellation_comment, cancel_at,
    event_timestamp, created_by
  )
  select distinct on (s.obj ->> 'id')
         'stripe-cancel:' || (s.obj ->> 'id'), s.email, s.stripe_event_id,
         public.stripe_object_id(s.obj -> 'customer'), s.obj ->> 'id',
         'subscription_cancelled',
         case
           when exists (
             select 1 from public.payment_events l
              where l.id like 'stripe-lifetime%'
                and l.stripe_customer_id = public.stripe_object_id(s.obj -> 'customer')
                and l.event_timestamp between to_timestamp(s.created) - interval '1 day'
                                          and to_timestamp(s.created) + interval '1 day'
           ) then 'replaced_by_lifetime'
           when not exists (
             select 1 from public.payment_events l
              where l.id like 'stripe-lifetime%'
                and l.stripe_customer_id = public.stripe_object_id(s.obj -> 'customer')
           ) and exists (
             select 1 from public.profiles p
              where p.stripe_customer_id = public.stripe_object_id(s.obj -> 'customer')
                and p.membership_billing_cycle = 'lifetime'
           ) then 'replaced_by_lifetime'
           else 'subscription_cancelled'
         end,
         null, plan.tier, plan.cycle,
         nullif(s.obj #>> '{cancellation_details,reason}', ''),
         nullif(s.obj #>> '{cancellation_details,feedback}', ''),
         nullif(s.obj #>> '{cancellation_details,comment}', ''),
         to_timestamp(coalesce(nullif(s.obj ->> 'ended_at', '')::bigint,
                               nullif(s.obj ->> 'canceled_at', '')::bigint,
                               s.created)),
         to_timestamp(s.created), 'stripe-ledger-rebuild'
  from pg_temp._ledger_subs s
  left join lateral public.stripe_lines_plan(s.obj #> '{items,data}') plan on true
  where s.event_type = 'customer.subscription.deleted'
    and s.email is not null
  order by s.obj ->> 'id', s.created
  on conflict do nothing;
  get diagnostics v_ended = row_count;

  return jsonb_build_object(
    'invoices_added', v_invoices,
    'invoice_plans_corrected', v_retagged,
    'lifetime_added', v_lifetime,
    'cancel_scheduled_added', v_scheduled,
    'cancel_scheduled_refreshed', v_scheduled_refreshed,
    'cancel_withdrawn_added', v_withdrawn,
    'subscriptions_ended_added', v_ended
  );
end;
$function$;

revoke all on function public.rebuild_payment_events_from_webhook_log() from public, anon, authenticated;
grant execute on function public.rebuild_payment_events_from_webhook_log() to service_role;

-- 4. Admin revenue figures --------------------------------------------------

-- Monthly recurring revenue counts each subscription that is still
-- billing: it has paid real money at least once, its newest invoice is
-- neither refunded nor disputed and is recent enough for its cycle (a
-- month or a year, plus ten days of grace), and it has not ended. Each
-- counts at its plan's list price per month. That matches Stripe's MRR
-- while no coupon is in use (none was on 15 October); a coupon would make
-- this figure higher than Stripe's. A trial that has not paid yet, and a
-- 100 percent coupon, count nothing, as in Stripe. A subscription waiting
-- to cancel still counts until it ends, as in Stripe, and the amount at
-- risk is shown next to it.
--
-- All-time revenue is money kept: paid invoices and lifetime purchases,
-- less refunds. Disputed payments are left out until the dispute is won.
-- App Store purchases are not in this table and are not counted.
create or replace function public.admin_revenue_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  -- One lifetime purchase writes two rows: the grant row
  -- (stripe-lifetime:<payment intent>) and, because stripe-checkout asks
  -- Stripe for a receipt invoice, an invoice row for the same money. The
  -- grant row carries the money and its refunds, so the invoice row is
  -- left out here. It stays in the table: the referral claim uses it as a
  -- lock. Matched on the invoice id, or for a grant row that has none, on
  -- the lifetime price and the customer.
  with lifetime_rows as (
    select pe.stripe_invoice_id, pe.stripe_customer_id
    from public.payment_events pe
    where pe.id like 'stripe-lifetime%'
  ),
  charges as (
    select pe.*
    from public.payment_events pe
    where pe.id like 'stripe-lifetime%'
       or (pe.id like 'stripe-invoice:%'
           and not exists (select 1 from lifetime_rows l where l.stripe_invoice_id = pe.stripe_invoice_id)
           and not (pe.billing_cycle = 'lifetime'
                    and exists (select 1 from lifetime_rows l where l.stripe_customer_id = pe.stripe_customer_id)))
  ),
  money as (
    select
      -- A paid row can still carry an earlier partial refund (a dispute
      -- that was won after it), so refunds always come off.
      coalesce(sum(case
        when status = 'paid' then amount_cents - coalesce(amount_refunded_cents, 0)
        when status = 'partial_refund' then amount_cents - coalesce(amount_refunded_cents, 0)
        when status = 'refunded' then amount_cents - coalesce(amount_refunded_cents, amount_cents)
        else 0 end), 0) as net_cents,
      coalesce(sum(amount_cents) filter (where status in ('paid', 'partial_refund', 'refunded', 'disputed')), 0) as gross_cents,
      coalesce(sum(case
        when status in ('paid', 'partial_refund') then coalesce(amount_refunded_cents, 0)
        when status = 'refunded' then coalesce(amount_refunded_cents, amount_cents)
        else 0 end), 0) as refunded_cents,
      coalesce(sum(amount_cents) filter (where status = 'disputed'), 0) as disputed_cents,
      count(*) filter (where id like 'stripe-invoice:%' and status <> 'disputed') as paid_invoices,
      count(*) filter (where id like 'stripe-invoice:%' and coalesce(amount_cents, 0) > 0) as charged_invoices,
      count(*) filter (where id like 'stripe-lifetime%' and status in ('paid', 'partial_refund')) as lifetime_purchases,
      coalesce(sum(case when id like 'stripe-lifetime%' and status in ('paid', 'partial_refund')
                        then amount_cents - coalesce(amount_refunded_cents, 0) else 0 end), 0) as lifetime_cents,
      max(event_timestamp) filter (where coalesce(amount_cents, 0) > 0 and status = 'paid') as last_payment_at
    from charges
  ),
  latest_invoice as (
    select distinct on (stripe_subscription_id)
           stripe_subscription_id, user_email, status, membership_tier, billing_cycle, event_timestamp
    from charges
    where id like 'stripe-invoice:%' and stripe_subscription_id is not null
    order by stripe_subscription_id, event_timestamp desc, id desc
  ),
  ever_paid as (
    select distinct stripe_subscription_id
    from charges
    where id like 'stripe-invoice:%' and coalesce(amount_cents, 0) > 0 and status in ('paid', 'partial_refund')
  ),
  ended as (
    select distinct stripe_subscription_id
    from public.payment_events
    where event_type = 'subscription_cancelled' and stripe_subscription_id is not null
  ),
  billing as (
    select li.*,
           public.stripe_plan_monthly_cents(li.membership_tier, li.billing_cycle) as monthly_cents
    from latest_invoice li
    join ever_paid ep using (stripe_subscription_id)
    where li.status in ('paid', 'partial_refund')
      and not exists (select 1 from ended e where e.stripe_subscription_id = li.stripe_subscription_id)
      and li.event_timestamp > now() - case when li.billing_cycle = 'annual'
                                             then interval '375 days' else interval '41 days' end
  ),
  lifecycle as (
    select distinct on (stripe_subscription_id) *
    from public.payment_events
    where event_type in ('cancel_scheduled', 'cancel_withdrawn', 'subscription_cancelled')
      and stripe_subscription_id is not null
    order by stripe_subscription_id, event_timestamp desc,
             (event_type = 'subscription_cancelled') desc, id desc
  ),
  pending as (
    select lc.*, b.monthly_cents
    from lifecycle lc
    left join billing b using (stripe_subscription_id)
    where lc.event_type = 'cancel_scheduled'
      and (lc.cancel_at is null or lc.cancel_at > now())
  ),
  churn as (
    select *
    from public.payment_events
    where event_type = 'subscription_cancelled' and status = 'subscription_cancelled'
  )
  select jsonb_build_object(
    'mrr_cents', (select coalesce(sum(monthly_cents), 0) from billing),
    'paying_subscriptions', (select count(*) from billing),
    'mrr_by_tier', (select coalesce(jsonb_object_agg(t.membership_tier, jsonb_build_object('subscriptions', t.n, 'mrr_cents', t.cents)), '{}'::jsonb)
                      from (select coalesce(membership_tier, 'unknown') as membership_tier, count(*) as n, sum(monthly_cents) as cents
                              from billing group by 1) t),
    'mrr_at_risk_cents', (select coalesce(sum(monthly_cents), 0) from pending),
    'revenue_cents', m.net_cents,
    'gross_cents', m.gross_cents,
    'refunded_cents', m.refunded_cents,
    'disputed_cents', m.disputed_cents,
    'paid_invoices', m.paid_invoices,
    'charged_invoices', m.charged_invoices,
    'lifetime_purchases', m.lifetime_purchases,
    'lifetime_cents', m.lifetime_cents,
    'last_payment_at', m.last_payment_at,
    'cancellations_scheduled', (select count(*) from pending),
    'scheduled', (select coalesce(jsonb_agg(jsonb_build_object(
                     'email', p.user_email,
                     'tier', p.membership_tier,
                     'cycle', p.billing_cycle,
                     'cancel_at', p.cancel_at,
                     'cancelled_on', p.event_timestamp,
                     'reason', p.cancellation_reason,
                     'feedback', p.cancellation_feedback,
                     'comment', p.cancellation_comment,
                     'monthly_cents', p.monthly_cents
                   ) order by p.cancel_at nulls last), '[]'::jsonb) from pending p),
    'cancelled_30d', (select count(*) from churn where event_timestamp > now() - interval '30 days'),
    'recent_cancellations', (select coalesce(jsonb_agg(jsonb_build_object(
                     'email', c.user_email,
                     'kind', c.event_type,
                     'status', c.status,
                     'tier', c.membership_tier,
                     'at', c.event_timestamp,
                     'cancel_at', c.cancel_at,
                     'reason', c.cancellation_reason,
                     'feedback', c.cancellation_feedback
                   ) order by c.event_timestamp desc), '[]'::jsonb)
                   from (select * from public.payment_events
                          where event_type in ('cancel_scheduled', 'cancel_withdrawn', 'subscription_cancelled')
                          order by event_timestamp desc limit 10) c),
    'as_of', now()
  )
  into v_result
  from money m;

  return v_result;
end;
$function$;

revoke all on function public.admin_revenue_summary() from public, anon;
grant execute on function public.admin_revenue_summary() to authenticated, service_role;

-- 5. Run the rebuild once. -------------------------------------------------

select public.rebuild_payment_events_from_webhook_log();
