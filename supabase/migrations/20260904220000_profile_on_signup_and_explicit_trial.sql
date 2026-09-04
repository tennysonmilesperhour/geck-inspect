-- =============================================================================
-- Profile row on signup + explicit free-trial opt-in
-- =============================================================================
-- Two launch bugs, one migration.
--
-- 1. Nothing ever created a public.profiles row for a new account. The only
--    code path that inserted one was User.updateMyUserData (entities/all.js),
--    which runs when a member edits their profile in Settings. Members who
--    never opened Settings had no profile row at all, and because the whole
--    billing pipeline keys on profiles.email, a paid Stripe subscription
--    updated zero rows and the member stayed on Free. At the time of writing
--    27 of 36 auth users had no profile row, including one with a live paid
--    Keeper subscription.
--
--    Fix: an AFTER INSERT trigger on auth.users that creates the row, plus a
--    backfill for every existing account that is missing one.
--
-- 2. The free trial had no opt-in. stripe-checkout attached a 7-day trial to
--    every subscription checkout, so a member who wanted to pay immediately
--    got a trial anyway. The trial is now an explicit choice
--    (intent='trial'), which needs a per-account flag so it can only be
--    claimed once. That is what free_trial_used tracks. It is separate from
--    keeper_trial_used, which guards the one-time 30-day Keeper promo the
--    Promote page offers.
-- =============================================================================

-- ---------------------------------------------------------------------
-- 1. Every auth user gets a profile row
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Email is the join key the rest of the app uses. An account without one
  -- (phone-only signup, which this app does not offer) gets no profile.
  if new.email is null or new.email = '' then
    return new;
  end if;

  insert into public.profiles (email, full_name, created_by, created_date, updated_date)
  values (
    new.email,
    nullif(trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), ''),
    new.email,
    now(),
    now()
  )
  on conflict (email) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;

comment on function public.handle_new_auth_user() is
  'Creates the public.profiles row for a new auth user. Without it the account is invisible to billing, tier checks, and every table that joins on profiles.email.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill: every existing account that never got a row.
insert into public.profiles (email, full_name, created_by, created_date, updated_date)
select
  u.email,
  nullif(trim(coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    ''
  )), ''),
  u.email,
  u.created_at,
  now()
from auth.users u
left join public.profiles p on p.email = u.email
where u.email is not null
  and u.email <> ''
  and p.email is null
on conflict (email) do nothing;

-- ---------------------------------------------------------------------
-- 2. Free-trial opt-in tracking
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists free_trial_used boolean not null default false,
  add column if not exists free_trial_started_at timestamptz;

comment on column public.profiles.free_trial_used is
  'True once the account has started the standard free trial (stripe-checkout intent=trial). One per account, so cancelling and re-subscribing does not hand out a second trial.';
comment on column public.profiles.free_trial_started_at is
  'When the standard free trial was started. Null for accounts that went straight to a billed subscription.';

-- ---------------------------------------------------------------------
-- 3. The new columns are privileged, same as keeper_trial_used
-- ---------------------------------------------------------------------
-- Recreated in full (Postgres has no "add a line to a function"). This is
-- the launch-hardening version plus free_trial_used.
create or replace function public.protect_profile_privileged_columns()
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
  -- No JWT at all (migrations, cron, triggers, SQL editor, direct
  -- connections) or the service role: trusted, leave the row alone.
  if v_role is null or v_role = '' or v_role = 'service_role' then
    return new;
  end if;

  -- Admins may change these columns on any row (UserManagement UI).
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
    new.role := old.role;
    new.is_expert := old.is_expert;
    new.is_featured_breeder := old.is_featured_breeder;
    new.membership_tier := old.membership_tier;
    new.membership_billing_cycle := old.membership_billing_cycle;
    new.membership_expires_at := old.membership_expires_at;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.keeper_trial_used := old.keeper_trial_used;
    new.free_trial_used := old.free_trial_used;
    new.free_trial_started_at := old.free_trial_started_at;
    new.paid_membership_started_at := old.paid_membership_started_at;
    new.social_post_credits := old.social_post_credits;
  else
    -- INSERT by a regular user: force the defaults for a new account.
    new.role := 'user';
    new.is_expert := false;
    new.is_featured_breeder := false;
    new.membership_tier := 'free';
    new.membership_billing_cycle := null;
    new.membership_expires_at := null;
    new.subscription_status := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.keeper_trial_used := false;
    new.free_trial_used := false;
    new.free_trial_started_at := null;
    new.paid_membership_started_at := null;
    new.social_post_credits := 0;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_privileged_columns() from public;
