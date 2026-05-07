-- =============================================================================
-- Signup-grant redemption + paid-membership tenure tracking
-- =============================================================================
-- A SECURITY DEFINER function so authenticated clients can redeem a token
-- without ever needing to read the underlying row directly. The function:
--   1. Looks up the token, validates it (not expired/voided/redeemed)
--   2. Confirms the calling user's email matches granted_email
--      (case-insensitive trim) so a token leak doesn't grant tier on
--      the wrong account
--   3. Marks the grant redeemed and applies the tier extension to the
--      calling user's profile, choosing max(existing expiry, now()+grant)
--      so paying members never get downgraded
-- =============================================================================

create or replace function public.redeem_signup_grant(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant public.store_signup_grants%rowtype;
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_current_expiry timestamptz;
  v_new_expiry timestamptz;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select email into v_user_email from auth.users where id = v_user_id;
  if v_user_email is null then
    return jsonb_build_object('ok', false, 'reason', 'user_email_missing');
  end if;

  select * into v_grant from public.store_signup_grants
   where token = p_token
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'token_not_found');
  end if;

  if v_grant.voided_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'voided');
  end if;

  if v_grant.redeemed_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;

  if v_grant.expires_at < now() then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if lower(trim(v_grant.granted_email)) <> lower(trim(v_user_email)) then
    return jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  end if;

  -- Apply the grant: extend membership_tier_expires_at by the granted duration,
  -- never reducing an existing later expiry.
  select membership_expires_at into v_current_expiry from public.profiles
   where id = v_user_id;

  v_new_expiry := greatest(
    coalesce(v_current_expiry, now()),
    now() + (v_grant.granted_duration_days || ' days')::interval
  );

  update public.profiles
     set membership_tier = case
           when membership_tier in ('breeder', 'enterprise') then membership_tier
           else v_grant.granted_tier
         end,
         membership_expires_at = v_new_expiry,
         updated_date = now()
   where id = v_user_id;

  update public.store_signup_grants
     set redeemed_at = now(),
         redeemed_by_user_id = v_user_id
   where id = v_grant.id;

  return jsonb_build_object(
    'ok', true,
    'tier', v_grant.granted_tier,
    'duration_days', v_grant.granted_duration_days,
    'expires_at', v_new_expiry
  );
end;
$$;

-- Allow authenticated clients to invoke the function. It performs all
-- safety checks internally, so granting EXECUTE is safe.
grant execute on function public.redeem_signup_grant(text) to authenticated;

comment on function public.redeem_signup_grant(text) is
  'Atomically validate and redeem a store_signup_grants token for the calling user. Tier is only set when it would not downgrade an existing breeder/enterprise member; expiry is monotonic.';

-- =============================================================================
-- profiles.paid_membership_started_at
-- =============================================================================
-- Tracks the first time the user's account became a paid subscriber. Used
-- by the loyalty CGD-sample perk to enforce the minimum-tenure rule
-- (default 60 days). The membership Stripe webhook (lives in the
-- Supabase project, not this repo) should set this on the first
-- successful charge if it's null. Backfill: any user currently on a
-- paid tier whose value is null gets created_date as a fallback so
-- existing subscribers aren't penalized.
-- =============================================================================
alter table public.profiles
  add column if not exists paid_membership_started_at timestamptz;

create index if not exists profiles_paid_started_idx
  on public.profiles(paid_membership_started_at)
  where paid_membership_started_at is not null;

update public.profiles
   set paid_membership_started_at = coalesce(paid_membership_started_at, created_date)
 where membership_tier is not null
   and membership_tier <> 'free'
   and paid_membership_started_at is null;

comment on column public.profiles.paid_membership_started_at is
  'First time this account became a paid subscriber. Set by the membership Stripe webhook on first successful charge. Used by store loyalty perks (CGD sample) to enforce minimum tenure.';
