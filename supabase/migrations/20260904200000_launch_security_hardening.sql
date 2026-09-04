-- Launch security hardening (2026-09-04, the night before launch).
--
-- Closes the four critical findings from the pre-launch review plus two
-- small high-severity ones that ship in the same shape:
--
--   1. profiles: any signed-in user could UPDATE their own role,
--      membership_tier, is_expert, subscription_status and Stripe columns
--      (profiles_update_own has no column restriction). A BEFORE trigger
--      now reverts those columns to their previous values unless the
--      caller is the service role, a direct DB session (migrations,
--      cron, SQL editor) or an admin. Non-privileged writes still succeed,
--      they just cannot touch privileged columns.
--
--   2. transfer_requests: the table was world-readable, so anyone could
--      enumerate pending claim tokens, and claim_transfer() never checked
--      that the claimer is the intended recipient. Reads are now limited
--      to sender and recipient, claim_transfer() enforces to_email, and a
--      SECURITY DEFINER get_transfer_preview(token) serves the public
--      claim page the display fields it needs (and nothing else).
--
--   3. send-email / send-push: the notifications dispatcher sends a Vault
--      secret as a bearer token but the functions never checked it. The
--      secret is rotated to a fresh random value here and
--      verify_notification_dispatch_secret() lets the functions confirm
--      it server-side (only the service role may call it). The functions
--      themselves are redeployed with the check in the same change.
--
--   4. consume_feature_credit: trusted the client-supplied p_included, so
--      any user could raise their own AI allotment. Allotments now come
--      from feature_credit_allotments keyed by the caller's real tier.
--
--   5. Storage: two policies let the anonymous role write into the public
--      media bucket (sticker-uploads/ and anon/). Both are dropped and the
--      bucket now only accepts image MIME types.
--
-- Everything here is idempotent so it can be re-applied safely.

-- ---------------------------------------------------------------------
-- 1. profiles: protect privileged columns
-- ---------------------------------------------------------------------

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
  -- No JWT at all (migrations, cron, SQL editor, direct connections) or
  -- the service role: trusted, leave the row alone.
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
    new.paid_membership_started_at := null;
    new.social_post_credits := 0;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_privileged_columns() from public;

drop trigger if exists profiles_protect_privileged_columns on public.profiles;
create trigger profiles_protect_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ---------------------------------------------------------------------
-- 2. transfer_requests: reads limited to sender and recipient, claims
--    limited to the intended recipient, public preview by token only.
-- ---------------------------------------------------------------------

drop policy if exists "Public can read transfer requests" on public.transfer_requests;
drop policy if exists "Sender and recipient read transfer requests" on public.transfer_requests;
create policy "Sender and recipient read transfer requests"
  on public.transfer_requests for select
  to authenticated
  using (
    created_by = (auth.jwt() ->> 'email')
    or lower(to_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create or replace function public.get_transfer_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tr transfer_requests%rowtype;
  v_local text;
  v_domain text;
  v_masked text;
begin
  if p_token is null or length(p_token) < 8 then
    return null;
  end if;

  select * into v_tr from transfer_requests where token = p_token;
  if not found then
    return null;
  end if;

  -- Mask the recipient address so the page can say which account to
  -- sign in with without exposing the full email to whoever holds the link.
  v_local := split_part(coalesce(v_tr.to_email, ''), '@', 1);
  v_domain := split_part(coalesce(v_tr.to_email, ''), '@', 2);
  v_masked := case
    when v_local = '' then null
    else left(v_local, 1) || repeat('*', greatest(length(v_local) - 1, 2)) || '@' || v_domain
  end;

  return jsonb_build_object(
    'id', v_tr.id,
    'status', v_tr.status,
    'expires_at', v_tr.expires_at,
    'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type,
    'message', v_tr.message,
    'sale_price', v_tr.sale_price,
    'to_email_masked', v_masked
  );
end;
$$;

revoke all on function public.get_transfer_preview(text) from public;
grant execute on function public.get_transfer_preview(text) to anon, authenticated, service_role;

create or replace function public.claim_transfer(p_token text, p_contribute boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := auth.jwt() ->> 'email';
  v_uid   uuid := auth.uid();
  v_name  text;
  v_tr    transfer_requests%rowtype;
  v_now   timestamptz := now();
  v_cid   uuid;
begin
  if v_email is null or v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v_tr
  from transfer_requests
  where token = p_token
  for update;

  if not found then
    raise exception 'transfer not found';
  end if;

  if v_tr.status = 'claimed' then
    raise exception 'already claimed';
  end if;
  if v_tr.status = 'cancelled' then
    raise exception 'transfer cancelled';
  end if;
  if v_tr.status = 'expired' or v_tr.expires_at < v_now then
    raise exception 'transfer expired';
  end if;

  -- The link is not the credential. Only the address the sender named
  -- may claim this animal.
  if lower(coalesce(v_tr.to_email, '')) <> lower(v_email) then
    raise exception 'not the intended recipient';
  end if;

  select coalesce(full_name, v_email) into v_name
  from profiles where email = v_email;
  v_name := coalesce(v_name, v_email);

  update transfer_requests
  set status = 'claimed',
      to_user_id = v_uid,
      claimed_at = v_now,
      updated_date = v_now
  where id = v_tr.id;

  if v_tr.animal_type = 'other_reptile' then
    update other_reptiles
    set created_by = v_email,
        archived = false,
        archived_date = null,
        updated_date = v_now
    where id = v_tr.animal_id;
  else
    select id into v_cid
    from collections
    where lower(owner_email) = lower(v_email) and is_default = true
    limit 1;

    if v_cid is null then
      insert into collections (owner_email, name, description, is_default)
      values (v_email, 'My collection', 'Default collection.', true)
      returning id into v_cid;

      insert into collection_members
          (collection_id, member_email, role, status, accepted_at)
      values (v_cid, v_email, 'owner', 'accepted', v_now)
      on conflict (collection_id, lower(member_email)) do nothing;
    end if;

    update geckos
    set created_by = v_email,
        collection_id = v_cid,
        status = 'Owned',
        updated_date = v_now
    where id = v_tr.animal_id;
  end if;

  insert into ownership_records (
    animal_id, owner_user_id, owner_name, acquired_date,
    transfer_method, sale_price, contributed_to_market_data,
    created_by, created_date, updated_date
  ) values (
    v_tr.animal_id, v_uid, v_name, v_now::date,
    'purchased', v_tr.sale_price,
    (p_contribute and v_tr.sale_price is not null),
    v_email, v_now, v_now
  );

  return jsonb_build_object(
    'ok', true,
    'animal_id', v_tr.animal_id,
    'animal_type', v_tr.animal_type
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Notification dispatch secret: rotate to a random value and let the
--    edge functions verify it without needing a copy in their own env.
-- ---------------------------------------------------------------------

do $$
declare
  v_id uuid;
  v_current text;
begin
  select s.id, d.decrypted_secret into v_id, v_current
  from vault.secrets s
  join vault.decrypted_secrets d on d.id = s.id
  where s.name = 'notification_service_role_key'
  limit 1;

  -- 64 hex chars of randomness from two v4 UUIDs (core Postgres, no
  -- pgcrypto dependency).
  if v_id is null then
    perform vault.create_secret(
      md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text),
      'notification_service_role_key',
      'Bearer secret the notifications dispatcher sends to send-email / send-push'
    );
  elsif v_current is null or v_current !~ '^[0-9a-f]{64}$' then
    perform vault.update_secret(v_id, md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text));
  end if;
end;
$$;

create or replace function public.verify_notification_dispatch_secret(p_secret text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, vault
as $$
declare
  v_secret text;
begin
  if p_secret is null or p_secret = '' then
    return false;
  end if;
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'notification_service_role_key'
  limit 1;
  if v_secret is null then
    return false;
  end if;
  -- Compare digests so the comparison cost does not depend on where the
  -- strings first differ.
  return md5(v_secret) = md5(p_secret);
end;
$$;

revoke all on function public.verify_notification_dispatch_secret(text) from public, anon, authenticated;
grant execute on function public.verify_notification_dispatch_secret(text) to service_role;

-- ---------------------------------------------------------------------
-- 4. Feature credits: allotments come from the server, not the client.
--    Mirrors TIER_LIMITS in src/lib/tierLimits.js (June 2026 wave).
-- ---------------------------------------------------------------------

create table if not exists public.feature_credit_allotments (
  feature text not null,
  tier text not null,
  included integer,               -- null = unlimited
  primary key (feature, tier)
);
alter table public.feature_credit_allotments enable row level security;
drop policy if exists "feature_credit_allotments public read" on public.feature_credit_allotments;
create policy "feature_credit_allotments public read"
  on public.feature_credit_allotments for select
  to anon, authenticated
  using (true);

insert into public.feature_credit_allotments (feature, tier, included) values
  ('assistant_message', 'free', 10),   ('assistant_message', 'keeper', 100),
  ('assistant_message', 'breeder', 400), ('assistant_message', 'enterprise', 1000),
  ('health_screen', 'free', 1),        ('health_screen', 'keeper', 5),
  ('health_screen', 'breeder', 15),    ('health_screen', 'enterprise', 40),
  ('iot_poll', 'free', 0),             ('iot_poll', 'keeper', 200),
  ('iot_poll', 'breeder', 2000),       ('iot_poll', 'enterprise', 10000),
  ('visual_search', 'free', 5),        ('visual_search', 'keeper', 50),
  ('visual_search', 'breeder', 250),   ('visual_search', 'enterprise', 1000),
  ('growth_reel', 'free', 3),          ('growth_reel', 'keeper', 20),
  ('growth_reel', 'breeder', null),    ('growth_reel', 'enterprise', null)
on conflict (feature, tier) do update set included = excluded.included;

-- Effective tier for the calling user, same priority order as
-- resolveTier() in src/lib/tierLimits.js.
create or replace function public.effective_tier_for_current_user()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := auth.email();
  v_uid uuid := auth.uid();
  v_prof record;
  v_rc boolean := false;
begin
  if v_email is null then
    return 'free';
  end if;
  select id, role, subscription_status, membership_tier
    into v_prof
  from profiles where email = v_email limit 1;

  if v_prof.role = 'admin' then return 'enterprise'; end if;
  if v_prof.subscription_status = 'grandfathered' then return 'breeder'; end if;

  select exists (
    select 1 from revenuecat_entitlements e
    where e.is_active = true
      and (e.expires_at is null or e.expires_at > now())
      and (e.app_user_id = v_uid or e.app_user_id::text = v_prof.id)
  ) into v_rc;
  if v_rc then return 'breeder'; end if;

  if v_prof.membership_tier in ('free', 'keeper', 'breeder', 'enterprise') then
    return v_prof.membership_tier;
  end if;
  return 'free';
end;
$$;

revoke all on function public.effective_tier_for_current_user() from public;
grant execute on function public.effective_tier_for_current_user() to authenticated, service_role;

create or replace function public.consume_feature_credit(
  p_feature text,
  p_tier text,
  p_included integer,
  p_cost integer default 1
)
returns public.feature_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_tier text;
  v_included integer;
  v_known boolean;
  v_row public.feature_usage;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_cost is null or p_cost < 1 then
    p_cost := 1;
  end if;

  -- p_tier and p_included are accepted for backwards compatibility with
  -- existing callers but are no longer trusted.
  v_tier := public.effective_tier_for_current_user();
  select true, a.included into v_known, v_included
  from public.feature_credit_allotments a
  where a.feature = p_feature and a.tier = v_tier;
  if v_known is not true then
    raise exception 'unknown_feature';
  end if;

  if v_included is not null and v_included <= 0 then
    raise exception 'feature_credits_exhausted';
  end if;

  insert into public.feature_usage (user_id, feature, month_key, tier_at_start, credits_included)
  values (v_user, p_feature, v_month, v_tier, v_included)
  on conflict (user_id, feature, month_key) do nothing;

  select * into v_row
  from public.feature_usage
  where user_id = v_user and feature = p_feature and month_key = v_month
  for update;

  -- Tier upgrades mid-month raise the allotment in place; downgrades
  -- keep what the month started with.
  if v_included is null then
    v_row.credits_included := null;
  elsif v_row.credits_included is not null and v_included > v_row.credits_included then
    v_row.credits_included := v_included;
  end if;

  if v_row.credits_included is not null
     and v_row.credits_consumed + p_cost > v_row.credits_included then
    raise exception 'feature_credits_exhausted';
  end if;

  update public.feature_usage
  set credits_consumed = credits_consumed + p_cost,
      credits_included = v_row.credits_included,
      tier_at_start = v_tier,
      updated_date = now()
  where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Storage: no anonymous writes into the public media bucket, images only.
-- ---------------------------------------------------------------------

drop policy if exists "Sticker uploads writable by anyone" on storage.objects;
drop policy if exists "geck-inspect-media anon insert" on storage.objects;

update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
where id = 'geck-inspect-media';
