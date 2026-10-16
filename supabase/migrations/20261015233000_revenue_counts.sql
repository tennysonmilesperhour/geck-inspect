-- Two corrections to the admin money numbers from the review of round 2
-- (Codex, on PR #137). Both functions are restated in full from their live
-- definitions (migrations 20261015151400 and 20261015151500); only the
-- marked lines change. CREATE OR REPLACE keeps their grants, which are
-- restated below anyway.
--
-- 1. admin_revenue_summary: monthly recurring revenue counted a
--    subscription whose latest invoice charged $0 (a renewal under a 100%
--    coupon) at the plan's full list price. Such a subscription now adds
--    nothing until it is charged again.
-- 2. admin_scoreboard: a lifetime plan counted as paying when the member
--    had any earlier payment, so a former monthly subscriber later given a
--    lifetime plan by hand showed as a paying lifetime member. Now only a
--    lifetime payment (a stripe-lifetime ledger row, or a row billed as
--    lifetime) counts, and everyone else is shown as an unverified
--    lifetime plan.

CREATE OR REPLACE FUNCTION public.admin_revenue_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- that was won after it), so refunds always come off. Money held in
      -- a dispute on an older invoice (amount_disputed_cents, status left
      -- alone so access is not touched) comes off too.
      coalesce(sum(case
        when status = 'paid' then amount_cents - coalesce(amount_refunded_cents, 0) - coalesce(amount_disputed_cents, 0)
        when status = 'partial_refund' then amount_cents - coalesce(amount_refunded_cents, 0) - coalesce(amount_disputed_cents, 0)
        when status = 'refunded' then amount_cents - coalesce(amount_refunded_cents, amount_cents)
        else 0 end), 0) as net_cents,
      coalesce(sum(amount_cents) filter (where status in ('paid', 'partial_refund', 'refunded', 'disputed')), 0) as gross_cents,
      coalesce(sum(case
        when status in ('paid', 'partial_refund') then coalesce(amount_refunded_cents, 0)
        when status = 'refunded' then coalesce(amount_refunded_cents, amount_cents)
        else 0 end), 0) as refunded_cents,
      coalesce(sum(amount_cents) filter (where status = 'disputed'), 0)
        + coalesce(sum(amount_disputed_cents) filter (where status in ('paid', 'partial_refund')), 0) as disputed_cents,
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
           stripe_subscription_id, user_email, status, membership_tier, billing_cycle, event_timestamp, amount_cents
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
      -- A renewal that charged nothing (a 100% coupon, for example) is not
      -- recurring revenue, even if the subscription paid before.
      and coalesce(li.amount_cents, 0) > 0
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

CREATE OR REPLACE FUNCTION public.admin_scoreboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_week timestamptz := now() - interval '7 days';
  v_paid jsonb;
  v_unverified_lifetime integer;
  v_passports jsonb;
  v_activity jsonb;
  v_breeder_weeks jsonb;
  v_signups jsonb;
  v_email jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  -- Paying members. A member counts when their plan is live and money is
  -- behind it: a Stripe subscription that is active or past due (not a
  -- trial, not grandfathered), a lifetime plan with a lifetime payment on record (an older monthly
  -- payment does not make a hand-granted lifetime plan a paid one),
  -- or an active App Store entitlement that is not a trial. Members who
  -- also hold a current complimentary grant are returned with comped =
  -- true so the card can leave them out of "paying" and still show them.
  with admin_emails as (
    select lower(p.email) as email from public.profiles p
    where p.role = 'admin' and p.email is not null
  ),
  comped as (
    select distinct lower(c.email) as email from public.membership_comps c
    where c.starts_at <= v_now and (c.ends_at is null or c.ends_at > v_now)
  ),
  stripe_payers as (
    select distinct on (lower(p.email))
      lower(p.email) as email,
      p.membership_tier as tier,
      coalesce(p.membership_billing_cycle, 'monthly') as cycle,
      'stripe' as source
    from public.profiles p
    where p.email is not null
      and coalesce(p.role, 'user') <> 'admin'
      and lower(p.email) not in (select email from admin_emails)
      and p.membership_tier in ('keeper', 'breeder', 'enterprise')
      and p.subscription_status in ('active', 'past_due')
      and (
        (p.stripe_subscription_id is not null and coalesce(p.membership_billing_cycle, 'monthly') <> 'lifetime')
        or (
          p.membership_billing_cycle = 'lifetime'
          and exists (
            select 1 from public.payment_events pe
            where lower(pe.user_email) = lower(p.email) and coalesce(pe.amount_cents, 0) > 0
              and pe.status in ('paid', 'partial_refund')
              and (pe.billing_cycle = 'lifetime' or pe.id like 'stripe-lifetime%')
          )
        )
      )
    order by lower(p.email), p.updated_date desc nulls last
  ),
  -- App Store payers, mapped the way effective_tier_for_email maps them:
  -- the keeper entitlement is Keeper; breeder and the legacy 'Geck Inspect
  -- Pro' are Breeder (docs/BILLING.md). One row per member, Breeder over
  -- Keeper. Trials, promotional grants and the RevenueCat Test Store are
  -- not money. Apple sandbox purchases cannot be told apart in this table.
  store_payers as (
    select distinct on (lower(au.email))
      lower(au.email) as email,
      case when re.entitlement_identifier = 'keeper' then 'keeper' else 'breeder' end as tier,
      case
        when re.product_identifier ilike '%lifetime%' then 'lifetime'
        when re.product_identifier ilike '%annual%' or re.product_identifier ilike '%year%' then 'annual'
        else 'monthly'
      end as cycle,
      'app_store' as source
    from public.revenuecat_entitlements re
    join auth.users au on au.id = re.app_user_id
    where re.entitlement_identifier in ('keeper', 'breeder', 'Geck Inspect Pro')
      and re.is_active
      and coalesce(re.period_type, 'normal') <> 'trial'
      and coalesce(re.store, '') not in ('test_store', 'promotional')
      and (re.expires_at is null or re.expires_at > v_now)
      and au.email is not null
      and lower(au.email) not in (select email from admin_emails)
      and lower(au.email) not in (select email from stripe_payers)
    order by lower(au.email),
             (re.entitlement_identifier = 'keeper') asc,
             re.updated_at desc nulls last
  ),
  payers as (
    select * from stripe_payers
    union all
    select * from store_payers
  )
  select coalesce(jsonb_agg(to_jsonb(r) order by r.tier, r.cycle, r.source, r.comped), '[]'::jsonb)
  into v_paid
  from (
    select py.tier, py.cycle, py.source, (py.email in (select email from comped)) as comped, count(*) as n
    from payers py
    group by 1, 2, 3, 4
  ) r;

  -- Lifetime plans marked active with no payment on record (hand grants,
  -- or purchases from before payments were logged). Shown, not counted.
  select count(*) into v_unverified_lifetime
  from public.profiles p
  where p.membership_billing_cycle = 'lifetime'
    and p.subscription_status = 'active'
    and coalesce(p.role, 'user') <> 'admin'
    and not exists (
      select 1 from public.payment_events pe
      where lower(pe.user_email) = lower(p.email) and coalesce(pe.amount_cents, 0) > 0
        and pe.status in ('paid', 'partial_refund')
        and (pe.billing_cycle = 'lifetime' or pe.id like 'stripe-lifetime%')
    );

  -- Passports. Issued means a gecko has a passport code. Claimed means a
  -- buyer accepted a transfer. The admin account's own geckos and sales
  -- are counted separately so the headline shows other breeders' use.
  with admin_emails as (
    select lower(p.email) as email from public.profiles p
    where p.role = 'admin' and p.email is not null
  ),
  claims as (
    select
      t.claimed_at,
      lower(coalesce(t.created_by, '')) in (select email from admin_emails) as seller_is_admin,
      lower(coalesce(
        (select au.email from auth.users au where au.id = t.to_user_id),
        t.to_email
      )) as claimer_email
    from public.transfer_requests t
    where t.status = 'claimed' and t.claimed_at is not null
  )
  select jsonb_build_object(
    'issued', (select count(*) from public.geckos g
               where g.passport_code is not null
                 and lower(coalesce(g.created_by, '')) not in (select email from admin_emails)),
    'issued_admin', (select count(*) from public.geckos g
                     where g.passport_code is not null
                       and lower(coalesce(g.created_by, '')) in (select email from admin_emails)),
    'claimed', (select count(*) from claims where not seller_is_admin),
    'claimed_7d', (select count(*) from claims where not seller_is_admin and claimed_at >= v_week),
    'claimed_admin', (select count(*) from claims where seller_is_admin),
    -- Day 60 asks for claimers still active two weeks after claiming:
    -- any signed-in app use or sign-in from 14 days after the claim on.
    -- Buyers of the admin's own sales are left out, like the claim counts.
    'claimers_eligible_14d', (select count(distinct claimer_email) from claims
                              where claimed_at <= v_now - interval '14 days'
                                and not seller_is_admin),
    'claimers_active_after_14d', (
      select count(distinct c.claimer_email) from claims c
      where c.claimed_at <= v_now - interval '14 days'
        and not c.seller_is_admin
        and (
          exists (select 1 from public.user_events ue
                  where lower(ue.user_email) = c.claimer_email
                    and ue.created_date >= c.claimed_at + interval '14 days')
          or exists (select 1 from auth.users au
                     where lower(au.email) = c.claimer_email
                       and au.last_sign_in_at >= c.claimed_at + interval '14 days')
        )
    )
  ) into v_passports;

  -- The two activity definitions (C15 item 13), side by side.
  --
  -- Weekly active breeders: members who logged a weigh-in, feeding, shed,
  -- vet visit or event on a gecko they own in the last 7 days.
  -- Weekly active members (signed in): members who signed in or used the
  -- app while signed in during the last 7 days. "Used the app" reads
  -- user_events, whose address comes from the session since section 2.
  with admin_emails as (
    select lower(p.email) as email from public.profiles p
    where p.role = 'admin' and p.email is not null
  ),
  excluded as (
    select email from admin_emails
    union
    select lower(au.email) from auth.users au
    where au.email is not null and coalesce(au.raw_app_meta_data ->> 'morph_eval', 'false') = 'true'
  ),
  own_records as (
    select lower(r.created_by) as email, r.created_date
    from public.weight_records r join public.geckos g on g.id = r.gecko_id
    where r.created_date >= v_now - interval '56 days' and lower(r.created_by) = lower(g.created_by)
    union all
    select lower(r.created_by), r.created_date
    from public.feeding_records r join public.geckos g on g.id = r.animal_id
    where r.created_date >= v_now - interval '56 days' and lower(r.created_by) = lower(g.created_by)
    union all
    select lower(r.created_by), r.created_date
    from public.shed_records r join public.geckos g on g.id = r.animal_id
    where r.created_date >= v_now - interval '56 days' and lower(r.created_by) = lower(g.created_by)
    union all
    select lower(r.created_by), r.created_date
    from public.vet_records r join public.geckos g on g.id = r.animal_id
    where r.created_date >= v_now - interval '56 days' and lower(r.created_by) = lower(g.created_by)
    union all
    select lower(r.created_by), r.created_date
    from public.gecko_events r join public.geckos g on g.id = r.gecko_id
    where r.created_date >= v_now - interval '56 days' and lower(r.created_by) = lower(g.created_by)
  ),
  member_records as (
    select * from own_records where email is not null and email not in (select email from excluded)
  ),
  weeks as (
    -- Eight rolling 7-day windows, newest first (weeks_ago = 0 is the
    -- last 7 days), so "four straight weeks" can be read off the card.
    select k as weeks_ago,
           v_now - (k + 1) * interval '7 days' as starts_at,
           v_now - k * interval '7 days' as ends_at
    from generate_series(0, 7) as k
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'weeks_ago', w.weeks_ago,
           'ends_on', (w.ends_at at time zone 'America/Denver')::date,
           'active', (select count(distinct m.email) from member_records m
                      where m.created_date >= w.starts_at and m.created_date < w.ends_at)
         ) order by w.weeks_ago), '[]'::jsonb),
         jsonb_build_object(
           'weekly_active_breeders', (select count(distinct m.email) from member_records m
                                      where m.created_date >= v_week),
           'weekly_active_signed_in', (
             select count(*) from auth.users au
             where au.email is not null
               and lower(au.email) not in (select email from excluded)
               and (
                 au.last_sign_in_at >= v_week
                 or exists (select 1 from public.user_events ue
                            where lower(ue.user_email) = lower(au.email) and ue.created_date >= v_week)
               )
           ),
           'members', (select count(*) from auth.users au
                       where au.email is not null and lower(au.email) not in (select email from excluded))
         )
  into v_breeder_weeks, v_activity
  from weeks w;

  -- Signups and the day-one first gecko rate. The rate uses accounts from
  -- 8 to 1 days ago so every account in it has had its full first day.
  with admin_emails as (
    select lower(p.email) as email from public.profiles p
    where p.role = 'admin' and p.email is not null
  ),
  accounts as (
    select au.email, au.created_at
    from auth.users au
    where au.email is not null
      and au.created_at >= v_now - interval '8 days'
      and lower(au.email) not in (select email from admin_emails)
      and coalesce(au.raw_app_meta_data ->> 'morph_eval', 'false') <> 'true'
  )
  select jsonb_build_object(
    'signups_7d', (select count(*) from accounts where created_at >= v_week),
    'first_gecko_eligible', (select count(*) from accounts where created_at < v_now - interval '1 day'),
    'first_gecko_1d', (
      select count(*) from accounts a
      where a.created_at < v_now - interval '1 day'
        and exists (select 1 from public.geckos g
                    where lower(g.created_by) = lower(a.email)
                      and g.created_date < a.created_at + interval '1 day')
    )
  ) into v_signups;

  -- Email delivery, if the view from the lifecycle email work exists. Read
  -- through dynamic SQL so this function still compiles and runs before
  -- that view is created, and a broken view cannot take the card down.
  -- The view has a row per email type per week, about 30 types, so it is
  -- cut to the last eight weeks and sorted newest week first; the order is
  -- set inside jsonb_agg, because a subquery's order does not survive the
  -- aggregate. 300 rows is nine weeks of 30-odd types.
  if to_regclass('public.email_delivery_stats') is null then
    v_email := jsonb_build_object('available', false, 'reason', 'missing');
  else
    begin
      execute 'select coalesce(jsonb_agg(to_jsonb(s) order by s.week desc, s.email_type), ''[]''::jsonb)
                 from (select * from public.email_delivery_stats
                        where week >= (now() at time zone ''utc'')::date - 56
                        order by week desc, email_type
                        limit 300) s'
        into v_email;
      v_email := jsonb_build_object('available', true, 'rows', v_email);
    exception when others then
      v_email := jsonb_build_object('available', false, 'reason', 'error', 'message', sqlerrm);
    end;
  end if;

  return jsonb_build_object(
    'generated_at', v_now,
    'paid_plans', v_paid,
    'unverified_lifetime', v_unverified_lifetime,
    'passports', v_passports,
    'activity', v_activity,
    'breeder_weeks', v_breeder_weeks,
    'signups', v_signups,
    'email_delivery', v_email
  );
end;
$function$;

revoke all on function public.admin_revenue_summary() from public, anon;
grant execute on function public.admin_revenue_summary() to authenticated, service_role;
revoke all on function public.admin_scoreboard() from public, anon;
grant execute on function public.admin_scoreboard() to authenticated, service_role;
