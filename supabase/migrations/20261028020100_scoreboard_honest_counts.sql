-- Make the weekly scoreboard honest (survey items 27, 41, 0 and 10).
--
-- Three things the scoreboard counted wrong, or could not count at all:
--
-- 1. App Store sandbox purchases counted as paying. TestFlight, App Review
--    and a developer's own phone buy with Apple's sandbox, which charges
--    nothing. On 27 October the one "paying" App Store Breeder was a
--    TestFlight annual plan that renews every day in the sandbox. Sandbox
--    purchases must keep unlocking features (App Review has to see Breeder
--    work), so access is not touched; they only stop counting.
--    public.revenuecat_entitlements gets is_sandbox (default false),
--    backfilled from the webhook ledger, and apply_revenuecat_event()
--    writes it: from the row's own is_sandbox when the shared row builder
--    sends one, otherwise from the webhook's event.environment, otherwise
--    (a purchase sync, which has no environment) it keeps what is stored.
--    The flag is stored, not read from payloads, because the privacy job
--    empties RevenueCat payloads after 90 days.
-- 2. Internal accounts counted. The scoreboard left the admin out of
--    everything, but the Morph ID evaluation account only out of activity,
--    and QA and App Review accounts were counted everywhere. Now one list
--    is left out of every number (paying, recurring revenue, passports,
--    activity, members and signups): the admin, accounts with
--    app_metadata morph_eval = true, and accounts with app_metadata
--    internal = true. app_metadata can be written by the service role
--    alone, so a member cannot flag or unflag themselves. Flagging the QA
--    and App Review accounts is a one-off data change made by hand in
--    production; no account is named here.
-- 3. A prepaid Founding Breeder year had nowhere to go. A breeder who pays
--    for a year outside the app (a Payment Link, a transfer) gets access
--    through membership_comps, and a comp is not evidence of paying. A new
--    'prepaid' kind of scoreboard entry (breeder name and amount required)
--    counts that breeder as paying, and a twelfth of the amount as
--    recurring revenue, for 12 months from the entry date.
--
-- Function bodies are restated in full from their newest definitions,
-- which match production (pg_get_functiondef md5 checked on 28 October):
--   * apply_revenuecat_event: 20260906181502_revenuecat_access_consistency.sql
--   * admin_scoreboard: 20261016090500_revenue_counts.sql
-- Only the marked lines change. Their return shapes only gain keys, so the
-- app already open in a tab keeps working.
--
-- Safe to run more than once: the column and its backfill run only when
-- the column is missing, the constraints are replaced by name only while
-- their definition lacks 'prepaid', and the functions are create or replace.

-- 1. Sandbox purchases --------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revenuecat_entitlements' and column_name = 'is_sandbox'
  ) then
    alter table public.revenuecat_entitlements
      add column is_sandbox boolean not null default false;

    -- Backfill, once, when the column is new. A row takes the environment
    -- of the webhook that last wrote it, or else of the newest webhook for
    -- that member that names one. Sync receipts and the dashboard's TEST
    -- events say nothing about a member's purchase, so they are skipped.
    update public.revenuecat_entitlements re
       set is_sandbox = true
      from (
        select e.id,
               coalesce(
                 (select upper(w.payload -> 'event' ->> 'environment')
                    from public.revenuecat_webhook_events w
                   where w.event_id = e.last_event_id
                     and w.event_type <> 'TEST'
                     and w.payload -> 'event' ? 'environment'),
                 (select upper(w.payload -> 'event' ->> 'environment')
                    from public.revenuecat_webhook_events w
                   where (w.app_user_id = e.app_user_id
                          or lower(w.payload -> 'event' ->> 'app_user_id') = e.app_user_id::text)
                     and w.event_type <> 'TEST'
                     and w.payload -> 'event' ? 'environment'
                   order by w.received_at desc
                   limit 1)
               ) as environment
          from public.revenuecat_entitlements e
      ) src
     where src.id = re.id
       and src.environment = 'SANDBOX';
  end if;
end
$$;

comment on column public.revenuecat_entitlements.is_sandbox is
  'True when the purchase behind this entitlement was made in the Apple or Google sandbox (TestFlight, App Review, a developer device). It still unlocks access, so store review works, but it is not money: admin_scoreboard() never counts it as paying.';

-- Starts from 20260906181502_revenuecat_access_consistency.sql. Changed:
-- the declare block, and is_sandbox in the insert and in the update.
create or replace function public.apply_revenuecat_event(p_event jsonb,p_rows jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  r public.revenuecat_entitlements;
  -- A webhook says which store environment it came from. A purchase sync
  -- (revenuecat-sync) carries none, so it is null there.
  v_event_sandbox boolean := case upper(coalesce(p_event->'event'->>'environment', ''))
                               when 'SANDBOX' then true
                               when 'PRODUCTION' then false
                             end;
  v_sandbox boolean;
begin
  insert into public.revenuecat_webhook_events(event_id,event_type,app_user_id,payload)
    values(p_event->'event'->>'id',p_event->'event'->>'type',nullif(p_rows->0->>'app_user_id','')::uuid,p_event)
    on conflict(event_id) do nothing;
  if not found then return false; end if;
  for r in select * from jsonb_populate_recordset(null::public.revenuecat_entitlements,p_rows) loop
    -- The row's own flag (read from the purchase in the customer snapshot)
    -- wins, then the webhook's environment. With neither, an existing row
    -- keeps its flag and a new row starts as not sandbox.
    v_sandbox := coalesce(r.is_sandbox, v_event_sandbox);
    insert into public.revenuecat_entitlements(
      app_user_id,entitlement_identifier,is_active,will_renew,period_type,store,product_identifier,
      latest_purchase_at,original_purchase_at,expires_at,unsubscribe_detected_at,billing_issue_detected_at,last_event_id,last_event_type,last_event_at,
      is_sandbox,updated_at)
    values(r.app_user_id,r.entitlement_identifier,r.is_active,r.will_renew,r.period_type,r.store,r.product_identifier,
      r.latest_purchase_at,r.original_purchase_at,r.expires_at,r.unsubscribe_detected_at,r.billing_issue_detected_at,r.last_event_id,r.last_event_type,r.last_event_at,
      coalesce(v_sandbox,false),now())
    on conflict(app_user_id,entitlement_identifier) do update set
      is_active=excluded.is_active,will_renew=excluded.will_renew,period_type=excluded.period_type,store=excluded.store,
      product_identifier=excluded.product_identifier,latest_purchase_at=excluded.latest_purchase_at,original_purchase_at=excluded.original_purchase_at,expires_at=excluded.expires_at,
      unsubscribe_detected_at=excluded.unsubscribe_detected_at,billing_issue_detected_at=excluded.billing_issue_detected_at,
      last_event_id=excluded.last_event_id,last_event_type=excluded.last_event_type,last_event_at=excluded.last_event_at,
      is_sandbox=coalesce(v_sandbox,public.revenuecat_entitlements.is_sandbox),updated_at=now()
    where public.revenuecat_entitlements.last_event_at is null or excluded.last_event_at >= public.revenuecat_entitlements.last_event_at;
  end loop;
  return true;
end $$;
revoke all on function public.apply_revenuecat_event(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_revenuecat_event(jsonb,jsonb) to service_role;

-- 2. Prepaid years on the scoreboard ----------------------------------------
--
-- The checks from 20261015151500_scoreboard.sql gain 'prepaid'. Each is
-- replaced by name, and only while its definition lacks 'prepaid', so a
-- second run changes nothing. Every existing row passes the new checks:
-- they only widen what the old ones allowed. The app already open in a
-- tab writes only the three old kinds, which pass exactly as before.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.scoreboard_entries'::regclass
      and conname = 'scoreboard_entries_kind_check'
      and pg_get_constraintdef(oid) like '%prepaid%'
  ) then
    alter table public.scoreboard_entries drop constraint if exists scoreboard_entries_kind_check;
    alter table public.scoreboard_entries
      add constraint scoreboard_entries_kind_check
      check (kind in ('conversation', 'import', 'monthly_cost', 'prepaid'));
  end if;
  -- A cost entry and a prepaid year are dollar amounts (a prepaid year more
  -- than nothing); conversations and imports carry none.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.scoreboard_entries'::regclass
      and conname = 'scoreboard_entries_amount_check'
      and pg_get_constraintdef(oid) like '%prepaid%'
  ) then
    alter table public.scoreboard_entries drop constraint if exists scoreboard_entries_amount_check;
    alter table public.scoreboard_entries
      add constraint scoreboard_entries_amount_check
      check (
        (kind = 'monthly_cost' and amount_usd is not null and amount_usd >= 0)
        or (kind = 'prepaid' and amount_usd is not null and amount_usd > 0)
        or (kind not in ('monthly_cost', 'prepaid') and amount_usd is null)
      );
  end if;
  -- A prepaid year says who paid.
  if not exists (select 1 from pg_constraint where conname = 'scoreboard_entries_prepaid_breeder_check') then
    alter table public.scoreboard_entries
      add constraint scoreboard_entries_prepaid_breeder_check
      check (kind <> 'prepaid' or (breeder_name is not null and btrim(breeder_name) <> ''));
  end if;
end
$$;

-- 3. The computed numbers ----------------------------------------------------
--
-- Starts from 20261016090500_revenue_counts.sql. Changed: v_today,
-- v_excluded and v_left_out in the declare block; the excluded list built
-- once at the top and used by every section; is_sandbox in store_payers;
-- the prepaid rows added to paid_plans; the passport counts; signups; and
-- the new left_out key in the result.
CREATE OR REPLACE FUNCTION public.admin_scoreboard()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_week timestamptz := now() - interval '7 days';
  v_today date := (now() at time zone 'America/Denver')::date;
  v_excluded text[];
  v_paid jsonb;
  v_unverified_lifetime integer;
  v_passports jsonb;
  v_activity jsonb;
  v_breeder_weeks jsonb;
  v_signups jsonb;
  v_email jsonb;
  v_left_out jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  -- Accounts that never count, in any number below: the admin, the Morph
  -- ID evaluation account (app_metadata morph_eval = true) and accounts
  -- flagged internal (app_metadata internal = true), such as the QA and
  -- App Review accounts. Only the service role can write app_metadata.
  select coalesce(array_agg(distinct x.email), '{}'::text[]) into v_excluded
  from (
    select lower(p.email) as email from public.profiles p
    where p.role = 'admin' and p.email is not null
    union
    select lower(au.email) from auth.users au
    where au.email is not null
      and (coalesce(au.raw_app_meta_data ->> 'morph_eval', 'false') = 'true'
           or coalesce(au.raw_app_meta_data ->> 'internal', 'false') = 'true')
  ) x;

  -- Paying members. A member counts when their plan is live and money is
  -- behind it: a Stripe subscription that is active or past due (not a
  -- trial, not grandfathered), a lifetime plan with a lifetime payment on record (an older monthly
  -- payment does not make a hand-granted lifetime plan a paid one),
  -- or an active App Store entitlement that is not a trial and not a
  -- sandbox purchase. Members who
  -- also hold a current complimentary grant are returned with comped =
  -- true so the card can leave them out of "paying" and still show them.
  with excluded as (
    select unnest(v_excluded) as email
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
      and lower(p.email) not in (select email from excluded)
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
  -- Keeper. Trials, promotional grants, the RevenueCat Test Store and
  -- Apple or Google sandbox purchases (is_sandbox) are not money.
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
      and not re.is_sandbox
      and coalesce(re.period_type, 'normal') <> 'trial'
      and coalesce(re.store, '') not in ('test_store', 'promotional')
      and (re.expires_at is null or re.expires_at > v_now)
      and au.email is not null
      and lower(au.email) not in (select email from excluded)
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

  -- Prepaid years recorded by hand on the card (kind 'prepaid'): a breeder
  -- who paid for a year outside the app's checkout. Each counts as a paying
  -- Breeder, and a twelfth of what was paid as recurring revenue, from the
  -- entry date for 12 months, whatever gives them access (usually a comp).
  -- One row, after the others; monthly_usd is the row's total, so the card
  -- does not price it from the list. n counts breeders by name, so a second
  -- entry for the same breeder adds money but not another breeder.
  select v_paid || coalesce(jsonb_agg(jsonb_build_object(
           'tier', 'breeder',
           'cycle', 'annual',
           'source', 'prepaid',
           'comped', false,
           'n', x.n,
           'monthly_usd', x.monthly_usd)), '[]'::jsonb)
  into v_paid
  from (
    select count(distinct lower(btrim(e.breeder_name))) as n,
           round(sum(e.amount_usd) / 12, 2) as monthly_usd
    from public.scoreboard_entries e
    where e.kind = 'prepaid'
      and e.amount_usd > 0
      and e.entry_date <= v_today
      and v_today < (e.entry_date + interval '12 months')::date
    having count(*) > 0
  ) x;

  -- Lifetime plans marked active with no payment on record (hand grants,
  -- or purchases from before payments were logged). Shown, not counted.
  select count(*) into v_unverified_lifetime
  from public.profiles p
  where p.membership_billing_cycle = 'lifetime'
    and p.subscription_status = 'active'
    and coalesce(p.role, 'user') <> 'admin'
    and lower(coalesce(p.email, '')) <> all (v_excluded)
    and not exists (
      select 1 from public.payment_events pe
      where lower(pe.user_email) = lower(p.email) and coalesce(pe.amount_cents, 0) > 0
        and pe.status in ('paid', 'partial_refund')
        and (pe.billing_cycle = 'lifetime' or pe.id like 'stripe-lifetime%')
    );

  -- What the paying numbers leave out, so the card can say so: members
  -- whose live App Store plan is a sandbox purchase, and accounts on the
  -- excluded list other than the admin.
  select jsonb_build_object(
    'sandbox_store', (
      select count(distinct re.app_user_id)
      from public.revenuecat_entitlements re
      join auth.users au on au.id = re.app_user_id
      where re.entitlement_identifier in ('keeper', 'breeder', 'Geck Inspect Pro')
        and re.is_active
        and re.is_sandbox
        and coalesce(re.period_type, 'normal') <> 'trial'
        and coalesce(re.store, '') not in ('test_store', 'promotional')
        and (re.expires_at is null or re.expires_at > v_now)
        and lower(coalesce(au.email, '')) not in (select lower(p.email) from public.profiles p
                                                 where p.role = 'admin' and p.email is not null)
    ),
    'internal_accounts', (
      select count(*) from auth.users au
      where au.email is not null
        and lower(au.email) = any (v_excluded)
        and lower(au.email) not in (select lower(p.email) from public.profiles p
                                    where p.role = 'admin' and p.email is not null)
    )
  ) into v_left_out;

  -- Passports. Issued means a gecko has a passport code. Claimed means a
  -- buyer accepted a transfer. The admin account's own geckos and sales
  -- are counted separately so the headline shows other breeders' use.
  -- Geckos and transfers of the other excluded accounts (internal and
  -- test accounts) are counted apart too, and a claim counts only when
  -- neither the seller nor the buyer is on the excluded list.
  with admin_emails as (
    select lower(p.email) as email from public.profiles p
    where p.role = 'admin' and p.email is not null
  ),
  excluded as (
    select unnest(v_excluded) as email
  ),
  claims as (
    select
      t.claimed_at,
      lower(coalesce(t.created_by, '')) in (select email from admin_emails) as seller_is_admin,
      lower(coalesce(t.created_by, '')) in (select email from excluded) as seller_excluded,
      lower(coalesce(
        (select au.email from auth.users au where au.id = t.to_user_id),
        t.to_email
      )) as claimer_email
    from public.transfer_requests t
    where t.status = 'claimed' and t.claimed_at is not null
  ),
  counted_claims as (
    select * from claims c
    where not c.seller_excluded
      and coalesce(c.claimer_email, '') not in (select email from excluded)
  )
  select jsonb_build_object(
    'issued', (select count(*) from public.geckos g
               where g.passport_code is not null
                 and lower(coalesce(g.created_by, '')) not in (select email from excluded)),
    'issued_admin', (select count(*) from public.geckos g
                     where g.passport_code is not null
                       and lower(coalesce(g.created_by, '')) in (select email from admin_emails)),
    'issued_internal', (select count(*) from public.geckos g
                        where g.passport_code is not null
                          and lower(coalesce(g.created_by, '')) in (select email from excluded)
                          and lower(coalesce(g.created_by, '')) not in (select email from admin_emails)),
    'claimed', (select count(*) from counted_claims),
    'claimed_7d', (select count(*) from counted_claims where claimed_at >= v_week),
    'claimed_admin', (select count(*) from claims where seller_is_admin),
    'claimed_internal', (select count(*) from claims c
                         where not c.seller_is_admin
                           and (c.seller_excluded
                                or coalesce(c.claimer_email, '') in (select email from excluded))),
    -- Day 60 asks for claimers still active two weeks after claiming:
    -- any signed-in app use or sign-in from 14 days after the claim on.
    -- Buyers of the admin's own sales are left out, like the claim counts.
    'claimers_eligible_14d', (select count(distinct claimer_email) from counted_claims
                              where claimed_at <= v_now - interval '14 days'),
    'claimers_active_after_14d', (
      select count(distinct c.claimer_email) from counted_claims c
      where c.claimed_at <= v_now - interval '14 days'
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
  with excluded as (
    select unnest(v_excluded) as email
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
  with accounts as (
    select au.email, au.created_at
    from auth.users au
    where au.email is not null
      and au.created_at >= v_now - interval '8 days'
      and lower(au.email) <> all (v_excluded)
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
    'email_delivery', v_email,
    'left_out', v_left_out
  );
end;
$function$;

revoke all on function public.admin_scoreboard() from public, anon;
grant execute on function public.admin_scoreboard() to authenticated, service_role;
