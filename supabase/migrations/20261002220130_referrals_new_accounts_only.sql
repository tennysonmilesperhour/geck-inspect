-- Referrals count only for new accounts, and rewards say what they give
-- (2 Oct 2026, feature completeness audit step 18).
--
-- 1. apply_referral_code() used to attribute any account that had no
--    referrer yet, so two existing subscribers could swap codes and both
--    collect a free month. Now it only attributes an account that:
--      * was created in the last 7 days (the link is applied at the first
--        sign-in after sign-up, so a real new member is always inside
--        that window), and
--      * has never had a plan: still Free, no subscription status, no
--        Stripe subscription, no paid start date, no free trial or Keeper
--        trial used, and no app store purchase on record.
--
-- 2. award_referral_reward() offered grandfathered Breeder members "a free
--    month of Keeper", which is worth nothing to them, and then told them
--    it would be "applied by hand". They now get an honest thank-you and a
--    'no_reward' row, so nobody waits for a month that cannot be given.
--    Everything else in the function is unchanged.

create or replace function public.apply_referral_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := auth.email();
  v_uid uuid := auth.uid();
  v_code text := lower(trim(coalesce(p_code, '')));
  v_prof public.profiles%rowtype;
  v_account_created timestamptz;
  v_referrer_email text;
begin
  if v_email is null or v_code = '' then
    return false;
  end if;

  select * into v_prof
    from public.profiles
   where email = v_email
   limit 1;
  if not found then
    return false;
  end if;
  if v_prof.referred_by is not null then
    return false;
  end if;

  -- New accounts only. The older of the sign-in record and the profile
  -- row decides, so recreating a profile does not make an account new.
  select u.created_at into v_account_created
    from auth.users u
   where u.id = v_uid;
  v_account_created := least(
    coalesce(v_account_created, v_prof.created_date),
    coalesce(v_prof.created_date, v_account_created)
  );
  if v_account_created is null or v_account_created < now() - interval '7 days' then
    return false;
  end if;

  -- Never had a plan of any kind.
  if coalesce(v_prof.membership_tier, 'free') <> 'free'
     or v_prof.subscription_status is not null
     or v_prof.stripe_subscription_id is not null
     or v_prof.paid_membership_started_at is not null
     or coalesce(v_prof.free_trial_used, false)
     or coalesce(v_prof.keeper_trial_used, false)
     or exists (
       select 1 from public.revenuecat_entitlements e
        where e.app_user_id = v_uid
     )
  then
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
$function$;

alter table public.referral_rewards
  drop constraint if exists referral_rewards_reward_kind_check;
alter table public.referral_rewards
  add constraint referral_rewards_reward_kind_check
  check (reward_kind = any (array['keeper_month'::text, 'stripe_credit'::text, 'needs_manual'::text, 'no_reward'::text]));

create or replace function public.award_referral_reward(p_referred_email text, p_referred_tier text, p_stripe_invoice_id text)
returns public.referral_rewards
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  elsif coalesce(v_referrer.subscription_status, '') = 'grandfathered' then
    -- Grandfathered Breeder is free for life, so a month of Keeper adds
    -- nothing. Record the referral, give no reward, and say so.
    v_kind := 'no_reward';
    v_note := 'Referrer is grandfathered on Breeder for free; there is no month to give.';
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
    v_note := 'Referrer is not on Stripe and not on the free tier (App Store or lifetime). Settle by hand.';
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
    when 'no_reward' then
      'A keeper you referred just started a paid plan. Thank you for spreading the word. Your Breeder plan is already free for life, so there is no month to add.'
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
$function$;
