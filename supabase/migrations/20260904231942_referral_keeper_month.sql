-- Referral program: one free month of Keeper per paid referral (4 Sep 2026).
--
-- Replaces the never-applied 20260430_referral_program.sql, which promised a
-- lifetime 10 percent revenue share that nothing in the codebase could pay.
-- The reward here is one the platform can deliver on its own.
--
--   * Every profile gets a short referral_code. A link of the form
--     /?ref=<code> is captured by the app and applied after signup through
--     apply_referral_code(), which records referred_by exactly once.
--   * When a referred member pays their first real invoice, the Stripe
--     webhook calls award_referral_reward(). The referrer gets one reward
--     per referred member, recorded in referral_rewards:
--       - free-tier referrer: membership_tier becomes keeper for 30 days,
--         tracked in referral_grant_until (stacks when several referrals pay)
--       - Stripe subscriber: the webhook credits one month of their plan to
--         their Stripe customer balance (reward_kind = stripe_credit)
--       - anyone else (grandfathered, App Store, lifetime): the row is marked
--         needs_manual so an admin can settle it by hand
--   * expire_referral_grants() runs daily through pg_cron and returns lapsed
--     grants to free. It never touches a profile with a live Stripe or
--     RevenueCat subscription.
--
-- The referral columns are protected the same way the billing columns are:
-- regular users cannot write them, only the service role, admins, direct
-- database sessions, and the functions below (which set a transaction-local
-- bypass flag because a SECURITY DEFINER function still carries the caller's
-- JWT role).
--
-- Idempotent; safe to re-apply.

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by text,
  add column if not exists referral_signup_count integer not null default 0,
  add column if not exists referral_grant_until timestamptz;

create unique index if not exists profiles_referral_code_key
  on public.profiles(referral_code);
create index if not exists profiles_referred_by_idx
  on public.profiles(referred_by);
create index if not exists profiles_referral_grant_until_idx
  on public.profiles(referral_grant_until)
  where referral_grant_until is not null;

comment on column public.profiles.referral_code is
  'Short unique code for this member''s referral link (/?ref=<code>). Generated on insert.';
comment on column public.profiles.referred_by is
  'referral_code of the member who referred this account. Set once by apply_referral_code().';
comment on column public.profiles.referral_signup_count is
  'Number of referred members who have paid a first invoice.';
comment on column public.profiles.referral_grant_until is
  'End of the free Keeper month(s) earned through referrals. Null when no grant is active. expire_referral_grants() returns the member to free after this date.';

-- ---------------------------------------------------------------------
-- 2. Code generation
-- ---------------------------------------------------------------------
create or replace function public.generate_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
  attempt integer := 0;
begin
  loop
    candidate := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    perform 1 from public.profiles where referral_code = candidate;
    if not found then
      return candidate;
    end if;
    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'generate_referral_code: no unique code after 10 attempts';
    end if;
  end loop;
end;
$$;
revoke all on function public.generate_referral_code() from public;

create or replace function public.set_default_referral_code()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;
revoke all on function public.set_default_referral_code() from public;

-- ---------------------------------------------------------------------
-- 3. Regular users cannot write the referral columns
-- ---------------------------------------------------------------------
-- BEFORE triggers fire in name order, so this runs after
-- profiles_protect_privileged_columns and before profiles_set_referral_code
-- (which fills in the code this trigger blanks on a user insert).
create or replace function public.protect_profile_referral_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := auth.role();
  v_email text := auth.email();
  v_is_admin boolean := false;
begin
  if current_setting('geck.referral_bypass', true) = 'on' then
    return new;
  end if;
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return new;
  end if;
  if v_email is not null then
    select exists (
      select 1 from public.profiles p
      where p.email = v_email and p.role = 'admin'
    ) into v_is_admin;
  end if;
  if v_is_admin then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.referral_signup_count := old.referral_signup_count;
    new.referral_grant_until := old.referral_grant_until;
  else
    new.referral_code := null;
    new.referred_by := null;
    new.referral_signup_count := 0;
    new.referral_grant_until := null;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_referral_columns() from public;

drop trigger if exists profiles_protect_referral_columns on public.profiles;
create trigger profiles_protect_referral_columns
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_referral_columns();

drop trigger if exists profiles_set_referral_code on public.profiles;
create trigger profiles_set_referral_code
  before insert on public.profiles
  for each row
  execute function public.set_default_referral_code();

-- Backfill every existing profile so the sidebar card shows for everyone.
update public.profiles
   set referral_code = public.generate_referral_code()
 where referral_code is null or referral_code = '';

-- ---------------------------------------------------------------------
-- 4. Attribution, called by the app right after sign-in
-- ---------------------------------------------------------------------
-- Records referred_by once. Ignores unknown codes, self-referral, and any
-- account that already has a referrer, so a member cannot re-point their
-- own attribution later.
create or replace function public.apply_referral_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.email();
  v_code text := lower(trim(coalesce(p_code, '')));
  v_current text;
  v_referrer_email text;
begin
  if v_email is null or v_code = '' then
    return false;
  end if;

  select referred_by into v_current
    from public.profiles
   where email = v_email
   limit 1;
  if not found then
    return false;
  end if;
  if v_current is not null then
    return false;
  end if;

  select email into v_referrer_email
    from public.profiles
   where referral_code = v_code
   limit 1;
  if v_referrer_email is null or lower(v_referrer_email) = lower(v_email) then
    return false;
  end if;

  perform set_config('geck.referral_bypass', 'on', true);
  update public.profiles
     set referred_by = v_code,
         updated_date = now()
   where email = v_email;
  return true;
end;
$$;
revoke all on function public.apply_referral_code(text) from public;
grant execute on function public.apply_referral_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Reward ledger
-- ---------------------------------------------------------------------
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_email text not null,
  referred_email text not null unique,
  referred_tier text,
  referrer_tier_at_award text,
  referrer_stripe_customer_id text,
  reward_kind text not null
    check (reward_kind in ('keeper_month', 'stripe_credit', 'needs_manual')),
  grant_until timestamptz,
  amount_cents integer,
  currency text,
  stripe_invoice_id text,
  stripe_balance_transaction_id text,
  applied_at timestamptz,
  note text,
  created_date timestamptz not null default now()
);

create index if not exists referral_rewards_referrer_idx
  on public.referral_rewards(referrer_email);

alter table public.referral_rewards enable row level security;

drop policy if exists "Referrers read their rewards" on public.referral_rewards;
create policy "Referrers read their rewards"
  on public.referral_rewards
  for select
  to authenticated
  using (referrer_email = (select auth.email()));

revoke all on public.referral_rewards from anon;

comment on table public.referral_rewards is
  'One row per referred member who paid a first invoice. reward_kind says how the referrer was rewarded; applied_at is null until the reward is actually delivered.';

-- ---------------------------------------------------------------------
-- 6. Award, called by stripe-webhook on every paid invoice
-- ---------------------------------------------------------------------
create or replace function public.award_referral_reward(
  p_referred_email text,
  p_referred_tier text,
  p_stripe_invoice_id text
)
returns public.referral_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referred public.profiles%rowtype;
  v_referrer public.profiles%rowtype;
  v_reward public.referral_rewards%rowtype;
  v_kind text;
  v_until timestamptz;
  v_note text;
  v_content text;
  v_on_grant boolean;
begin
  if p_referred_email is null or p_referred_email = '' then
    return null;
  end if;

  select * into v_referred
    from public.profiles
   where lower(email) = lower(p_referred_email)
   limit 1;
  if not found or v_referred.referred_by is null then
    return null;
  end if;

  -- One reward per referred member, ever. A second paid invoice from the
  -- same member returns the row that already exists.
  select * into v_reward
    from public.referral_rewards
   where lower(referred_email) = lower(v_referred.email)
   limit 1;
  if found then
    return v_reward;
  end if;

  select * into v_referrer
    from public.profiles
   where referral_code = v_referred.referred_by
   limit 1;
  if not found or lower(v_referrer.email) = lower(v_referred.email) then
    return null;
  end if;

  perform set_config('geck.referral_bypass', 'on', true);

  v_on_grant := v_referrer.referral_grant_until is not null
                and v_referrer.referral_grant_until > now();

  if v_referrer.stripe_customer_id is not null
     and coalesce(v_referrer.subscription_status, '') in ('active', 'trialing', 'past_due') then
    v_kind := 'stripe_credit';
    v_note := 'stripe-webhook credits one month of the referrer''s plan to their Stripe customer balance.';
  elsif (coalesce(v_referrer.membership_tier, 'free') = 'free' or v_on_grant)
        and v_referrer.stripe_subscription_id is null
        and coalesce(v_referrer.subscription_status, '') not in ('active', 'trialing', 'grandfathered') then
    v_kind := 'keeper_month';
    v_until := greatest(coalesce(v_referrer.referral_grant_until, now()), now()) + interval '30 days';
    update public.profiles
       set membership_tier = 'keeper',
           referral_grant_until = v_until,
           updated_date = now()
     where email = v_referrer.email;
  else
    v_kind := 'needs_manual';
    v_note := 'Referrer is not on Stripe and not on the free tier (grandfathered, App Store, or lifetime). Settle by hand.';
  end if;

  update public.profiles
     set referral_signup_count = coalesce(referral_signup_count, 0) + 1,
         updated_date = now()
   where email = v_referrer.email;

  insert into public.referral_rewards (
    referrer_email, referred_email, referred_tier, referrer_tier_at_award,
    referrer_stripe_customer_id, reward_kind, grant_until, stripe_invoice_id,
    applied_at, note
  ) values (
    v_referrer.email, v_referred.email, p_referred_tier, v_referrer.membership_tier,
    v_referrer.stripe_customer_id, v_kind, v_until, p_stripe_invoice_id,
    case when v_kind = 'keeper_month' then now() else null end, v_note
  )
  returning * into v_reward;

  v_content := case v_kind
    when 'keeper_month' then
      format('A keeper you referred just started a paid plan. Your free month of Keeper is active until %s.',
             to_char(v_until, 'DD Mon YYYY'))
    when 'stripe_credit' then
      'A keeper you referred just started a paid plan. One month of your subscription has been credited to your next bill.'
    else
      'A keeper you referred just started a paid plan. We will apply your free month by hand and let you know.'
  end;

  insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
  values (
    v_referrer.email, 'referral_reward', v_content, '/Membership',
    jsonb_build_object('reward_id', v_reward.id, 'reward_kind', v_kind, 'source', 'stripe-webhook'),
    false, v_referrer.email
  );

  return v_reward;
end;
$$;
revoke all on function public.award_referral_reward(text, text, text) from public;
grant execute on function public.award_referral_reward(text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 7. Daily expiry of granted months
-- ---------------------------------------------------------------------
create or replace function public.expire_referral_grants()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  perform set_config('geck.referral_bypass', 'on', true);

  for r in
    select p.email
      from public.profiles p
     where p.referral_grant_until is not null
       and p.referral_grant_until < now()
       and p.stripe_subscription_id is null
       and coalesce(p.subscription_status, '') not in ('active', 'trialing', 'past_due', 'grandfathered')
       and not exists (
         select 1
           from public.revenuecat_entitlements e
           join auth.users u on u.id = e.app_user_id
          where lower(u.email) = lower(p.email)
            and e.is_active = true
            and (e.expires_at is null or e.expires_at > now())
       )
  loop
    update public.profiles
       set membership_tier = case when membership_tier = 'keeper' then 'free' else membership_tier end,
           referral_grant_until = null,
           updated_date = now()
     where email = r.email;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.email, 'referral_grant_ended',
      'Your free month of Keeper from a referral has ended. Refer another crested gecko keeper to earn the next one, or keep Keeper going from the Membership page.',
      '/Membership', jsonb_build_object('source', 'cron'), false, r.email
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke all on function public.expire_referral_grants() from public;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire-referral-grants') then
    perform cron.unschedule('expire-referral-grants');
  end if;
  perform cron.schedule(
    'expire-referral-grants',
    '30 4 * * *',
    $cron$ select public.expire_referral_grants(); $cron$
  );
end
$$;
