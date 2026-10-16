-- Guard switches: a second pass over every trigger that decides who may
-- change a protected column, and every server function that writes one.
--
-- Written 16 Oct 2026. Round 1 (20261015120000_ownership_checks.sql) found
-- two trusted functions whose writes a guard quietly undid, because a
-- SECURITY DEFINER function still carries the caller's role (auth.role()
-- is 'authenticated' or 'anon' inside it). That file fixed claim_transfer
-- and redeem_signup_grant with transaction-local switches. This file
-- checks the other callers.
--
-- What was checked (every pair was run on a copy of the production schema
-- as the real caller: a member, a signed-out visitor, the server key, the
-- scheduled jobs and the sign-in service):
--
--   Profile plan and billing guard (protect_profile_privileged_columns)
--     redeem_signup_grant (member, round 1 switch), award_referral_reward
--     and charge_social_publish (server), the daily referral lapse job and
--     clear_lapsed_featured_breeders (scheduled, no caller),
--     moderate_content (admins), unsubscribe_email_by_token (touches no
--     protected column): every write lands.
--   Referral guard (protect_profile_referral_columns)
--     apply_referral_code (member), award_referral_reward (server), the
--     referral lapse job (scheduled): every write lands. See change 2.
--   Breeder trust guard (breeder_profiles_protect_trust_columns)
--     admin_set_breeder_verified and moderate_content (admins): land.
--   Gecko owner guard (guard_gecko_ownership)
--     claim_transfer (round 1 switch), the collection delete trigger that
--     sends geckos home, admin_erase_account (server): land.
--   Transfer guard (guard_transfer_request)
--     claim_transfer (round 1 switch), admin_erase_account (server): land.
--   Waitlist guard (guard_waitlist_signup)
--     waitlist_join_pending, join_waitlist, confirm_waitlist_signup and
--     the waitlist-signup edge function (all server key): land.
--   Invitation guard (guard_collection_member_update)
--     accept_collection_invite (member), decline_collection_invite
--     (member or signed-out visitor), admin_erase_account: land.
--   Error log throttle, content report limit, and the guards that check
--     current_user (moderation_hidden, Q and A counters, forum posts,
--     messages, notifications, support tickets): a SECURITY DEFINER
--     function runs as its owner, so these never undo a server write.
--   Artwork triggers (geck_private.sync_owner_artwork and
--     geck_private.inherit_gecko_artwork): BROKEN. See change 1.
--
-- Change 1: new members could not sign up.
--   The sign-in service (Supabase Auth) creates a member by inserting into
--   auth.users while logged in to the database as supabase_auth_admin,
--   with no member token. That insert runs handle_new_auth_user, which
--   inserts the profile, which runs sync_owner_artwork. Since 14 Oct 2026
--   that trigger refused any write with no member token unless the
--   database login was postgres or supabase_admin, so the whole signup
--   was refused ("Authentication required") and the account was never
--   created. The two artwork triggers now also accept the sign-in
--   service's own login. A member can never become that login: every API
--   request arrives as the authenticator login, and only a superuser can
--   change the login of a session. Nothing else about either trigger
--   changes.
--
-- Change 2: apply_referral_code now turns its switch off again.
--   It turned on geck.referral_bypass for its own write and left it on
--   until the end of the transaction. Nothing in the app runs a second
--   statement in that transaction today (the API runs one statement per
--   request), but if one ever did (for example a GraphQL request with two
--   mutations), the member's second write would skip the referral guard.
--   It now matches claim_transfer and redeem_signup_grant: on for its own
--   write, off straight after.
--
-- Can a member turn a switch on themselves? No:
--   * set_config lives in pg_catalog, which the API does not expose, and
--     no function the API exposes calls set_config with a name or value
--     the caller chooses (every call names a fixed switch).
--   * Request headers and cookies reach the database as one JSON setting
--     each (request.headers, request.cookies), never as their own
--     settings, so a header called geck.anything sets nothing.
--   * The member token is signed by Supabase Auth, so its claims cannot be
--     edited.
--   * Each switch is transaction-local (set_config(..., true)), so it ends
--     with the request, and every switch a member's call can turn on is
--     now turned off again inside that same function.
--
-- Safe for the app version already open in members' browsers: no table,
-- column, policy or function signature changes; only three function
-- bodies. Safe to run twice: every function is create or replace and every
-- grant is restated.

-- ===========================================================================
-- 1. Artwork triggers: let the sign-in service create profiles
-- ===========================================================================

-- Live definition (20261014184837) with supabase_auth_admin added to the
-- trusted logins.
create or replace function geck_private.inherit_gecko_artwork()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  new.inherited_placeholder_style := (
    select p.gecko_artwork_style from public.profiles p where p.email = new.created_by
  );
  return new;
end;
$$;

-- Live definition (20261014184837) with supabase_auth_admin added to the
-- trusted logins. This is the trigger the signup insert reaches.
create or replace function geck_private.sync_owner_artwork()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  update public.geckos g
    set inherited_placeholder_style = new.gecko_artwork_style
    where g.created_by = new.email
      and g.inherited_placeholder_style is distinct from new.gecko_artwork_style;
  return new;
end;
$$;

-- Trigger functions only: nobody calls them directly.
revoke all on function geck_private.inherit_gecko_artwork() from public, anon, authenticated, service_role;
revoke all on function geck_private.sync_owner_artwork() from public, anon, authenticated, service_role;

-- ===========================================================================
-- 2. apply_referral_code: switch off straight after its own write
-- ===========================================================================

-- Live definition (20261002220130_referrals_new_accounts_only.sql, which
-- production matches) with one line added, marked "Added 16 Oct 2026".
create or replace function public.apply_referral_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
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
  -- Added 16 Oct 2026: off again, so nothing after this write in the same
  -- transaction gets past the referral guard.
  perform set_config('geck.referral_bypass', 'off', true);
  return true;
end;
$$;

revoke all on function public.apply_referral_code(text) from public, anon;
grant execute on function public.apply_referral_code(text) to authenticated, service_role;

notify pgrst, 'reload schema';
