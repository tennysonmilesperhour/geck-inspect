-- Complimentary plans (5 Oct 2026).
--
-- A way to give a member a paid plan for a set time without Stripe or the
-- app stores: goodwill after a bug (the first use, a Breeder member whose
-- free Morph ID try was counted against the paid allowance), or the growth
-- plan's free Breeder year for the first crested breeders.
--
-- membership_comps holds one row per grant. Members can read their own
-- rows (the app shows the plan and when it ends). Only the service
-- role and admins (through the SQL editor) can write: the table has only
-- a read policy.
--
-- effective_tier_for_email() and effective_tier_for_current_user() return
-- the higher of the member's paid plan and an active comp. Everything that
-- gates on the plan (Morph ID credits, the free gecko limit, featured
-- breeders) reads one of those two functions. A Stripe cancellation sets
-- membership_tier to free but does not touch the comp, so the comp keeps
-- running to its end date.

create table if not exists public.membership_comps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tier text not null check (tier in ('keeper', 'breeder')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists membership_comps_email_idx
  on public.membership_comps (lower(email), ends_at);

alter table public.membership_comps enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'membership_comps'
       and policyname = 'membership_comps_read_own'
  ) then
    create policy membership_comps_read_own on public.membership_comps
      for select to authenticated
      using (lower(email) = lower((select auth.email())) or (select public.is_admin()));
  end if;
end
$$;

create or replace function public.active_comp_tier(p_email text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
  select case
           when bool_or(c.tier = 'breeder') then 'breeder'
           when bool_or(c.tier = 'keeper') then 'keeper'
         end
    from public.membership_comps c
   where lower(c.email) = lower(p_email)
     and c.starts_at <= now()
     and c.ends_at > now();
$function$;

create or replace function public.effective_tier_for_email(p_email text)
 returns text
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_prof record;
  v_tier text := 'free';
  v_uid uuid;
  v_comp text;
begin
  if p_email is null or btrim(p_email) = '' then
    return 'free';
  end if;

  select role, subscription_status, membership_tier into v_prof
    from public.profiles
   where lower(email) = lower(p_email)
   limit 1;
  if found then
    if v_prof.role = 'admin' then return 'enterprise'; end if;
    if v_prof.membership_tier in ('free', 'keeper', 'breeder', 'enterprise') then
      v_tier := v_prof.membership_tier;
    end if;
    if v_tier = 'enterprise' then return v_tier; end if;
    if v_prof.subscription_status = 'grandfathered' or v_tier = 'breeder' then return 'breeder'; end if;
  end if;

  v_comp := public.active_comp_tier(p_email);
  if v_comp = 'breeder' then return 'breeder'; end if;

  select id into v_uid from auth.users where lower(email) = lower(p_email) limit 1;
  if v_uid is not null then
    if exists (
      select 1 from public.revenuecat_entitlements
       where app_user_id = v_uid and entitlement_identifier in ('breeder', 'Geck Inspect Pro')
         and is_active and (expires_at is null or expires_at > now())
    ) then return 'breeder'; end if;
    if v_tier = 'free' and exists (
      select 1 from public.revenuecat_entitlements
       where app_user_id = v_uid and entitlement_identifier = 'keeper'
         and is_active and (expires_at is null or expires_at > now())
    ) then return 'keeper'; end if;
  end if;

  if v_tier = 'free' and v_comp = 'keeper' then return 'keeper'; end if;
  return v_tier;
end;
$function$;

create or replace function public.effective_tier_for_current_user()
 returns text
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_prof record;
  v_tier text := 'free';
  v_comp text;
begin
  if v_uid is null then return 'free'; end if;
  select role, subscription_status, membership_tier into v_prof
    from public.profiles where email = auth.email() limit 1;
  if v_prof.role = 'admin' then return 'enterprise'; end if;
  if v_prof.membership_tier in ('free','keeper','breeder','enterprise') then
    v_tier := v_prof.membership_tier;
  end if;
  if v_tier = 'enterprise' then return v_tier; end if;
  if v_prof.subscription_status = 'grandfathered' or v_tier = 'breeder' then return 'breeder'; end if;
  v_comp := public.active_comp_tier(auth.email());
  if v_comp = 'breeder' then return 'breeder'; end if;
  if exists (
    select 1 from public.revenuecat_entitlements
    where app_user_id = v_uid and entitlement_identifier in ('breeder','Geck Inspect Pro')
      and is_active and (expires_at is null or expires_at > now())
  ) then return 'breeder'; end if;
  if exists (
    select 1 from public.revenuecat_entitlements
    where app_user_id = v_uid and entitlement_identifier = 'keeper'
      and is_active and (expires_at is null or expires_at > now())
  ) then return 'keeper'; end if;
  if v_tier = 'free' and v_comp = 'keeper' then return 'keeper'; end if;
  return v_tier;
end;
$function$;
