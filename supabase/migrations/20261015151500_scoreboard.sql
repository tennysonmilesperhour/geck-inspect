-- The weekly scoreboard on the admin Funnel card (comprehensive review,
-- Part E5, and C15 item 13).
--
-- Why: the 90-day plan ends in a decision on 17 January 2027 (invest,
-- maintain or reference) that rests on a handful of numbers: breeder
-- conversations, collections imported by hand, paying breeders, monthly
-- recurring revenue, passports issued and claimed, weekly active breeders,
-- and signups with their day-one first gecko rate. Until now those numbers
-- were pulled by hand with ad hoc queries, and two different meanings of
-- "weekly active" were quoted side by side without saying which was which.
-- This file gives the card one place to read them, with one definition
-- each.
--
-- 1. public.scoreboard_entries: a small table where Tennyson records the
--    things only he knows (a breeder conversation held, a collection
--    imported for a breeder, the month's running cost). Admins only.
-- 2. A trigger on public.user_events that sets user_email (and
--    created_by) from the session for calls from the app, so a row can
--    only name the member who wrote it. The "weekly active" numbers below
--    read that table, and before this a signed-out visitor could write a
--    row naming any member and make them count as active.
-- 3. public.admin_scoreboard(): every other number, computed live. Admin
--    accounts and the Morph ID evaluation account are left out, the same
--    way admin_growth_funnel() leaves them out. It also passes through
--    public.email_delivery_stats when that view exists (another migration
--    creates it); when it does not, the card says so and carries on.
--
-- Safe to run more than once. The table and the function answer admins
-- only: the table through row security, the function by checking
-- is_admin() itself.

-- 1. Hand-recorded scoreboard entries --------------------------------------

create table if not exists public.scoreboard_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  entry_date date not null default ((now() at time zone 'America/Denver')::date),
  breeder_name text,
  amount_usd numeric(10, 2),
  notes text,
  created_by text default (auth.jwt() ->> 'email'),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

-- Constraints are added by name so a second run does not stack copies.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scoreboard_entries_kind_check') then
    alter table public.scoreboard_entries
      add constraint scoreboard_entries_kind_check
      check (kind in ('conversation', 'import', 'monthly_cost'));
  end if;
  -- A cost entry is a dollar amount; the other two are about a breeder.
  if not exists (select 1 from pg_constraint where conname = 'scoreboard_entries_amount_check') then
    alter table public.scoreboard_entries
      add constraint scoreboard_entries_amount_check
      check (
        (kind = 'monthly_cost' and amount_usd is not null and amount_usd >= 0)
        or (kind <> 'monthly_cost' and amount_usd is null)
      );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scoreboard_entries_text_length_check') then
    alter table public.scoreboard_entries
      add constraint scoreboard_entries_text_length_check
      check (char_length(coalesce(breeder_name, '')) <= 200 and char_length(coalesce(notes, '')) <= 2000);
  end if;
end
$$;

create index if not exists scoreboard_entries_kind_date_idx
  on public.scoreboard_entries (kind, entry_date desc);

alter table public.scoreboard_entries enable row level security;

drop policy if exists scoreboard_entries_admin_all on public.scoreboard_entries;
create policy scoreboard_entries_admin_all on public.scoreboard_entries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Signed-out visitors get nothing; signed-in members get the table only
-- through the policy above, which lets admins alone through.
revoke all on table public.scoreboard_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.scoreboard_entries to authenticated;
grant all on table public.scoreboard_entries to service_role;

-- Keep updated_date honest when an entry is corrected.
create or replace function public.scoreboard_entries_touch()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_date := now();
  return new;
end;
$function$;

-- The trigger runs as the admin who edits the row, so authenticated needs
-- EXECUTE (default privileges no longer grant it, SCHEMA_CONVENTIONS 4a).
revoke all on function public.scoreboard_entries_touch() from public, anon;
grant execute on function public.scoreboard_entries_touch() to authenticated, service_role;

drop trigger if exists scoreboard_entries_touch on public.scoreboard_entries;
create trigger scoreboard_entries_touch
  before update on public.scoreboard_entries
  for each row execute function public.scoreboard_entries_touch();

-- 2. Analytics rows name only the member who wrote them ----------------------
--
-- The insert policy 'anyone can record events' lets the app write
-- analytics rows signed in or out, and nothing pinned user_email, so a
-- signed-out visitor could write a row in any member's name. The app only
-- ever writes its own address there (src/lib/telemetry.js), or none when
-- signed out, so taking the address from the session changes nothing for
-- it, in this release or an older one still open in a tab. Server code
-- (the service role, and security definer functions such as the Morph ID
-- card events) is left alone. Rows written before this are not changed.
create or replace function public.user_events_stamp_caller()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
begin
  if current_user in ('anon', 'authenticated') then
    new.user_email := auth.email();
    new.created_by := auth.email();
  end if;
  return new;
end;
$function$;

-- Runs as whoever inserts the row, so the API roles need EXECUTE
-- (SCHEMA_CONVENTIONS 4a). A trigger function cannot be called directly.
revoke all on function public.user_events_stamp_caller() from public;
grant execute on function public.user_events_stamp_caller() to anon, authenticated, service_role;

drop trigger if exists user_events_stamp_caller on public.user_events;
create trigger user_events_stamp_caller
  before insert on public.user_events
  for each row execute function public.user_events_stamp_caller();

-- 3. The computed numbers ----------------------------------------------------

create or replace function public.admin_scoreboard()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
  -- trial, not grandfathered), a lifetime plan with a payment on record,
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

revoke all on function public.admin_scoreboard() from public, anon;
grant execute on function public.admin_scoreboard() to authenticated, service_role;
