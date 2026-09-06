-- Apple sells Keeper and Breeder separately. Retain the legacy Pro entitlement
-- as Breeder while resolving the highest active entitlement across providers.
create or replace function public.effective_tier_for_current_user()
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_prof record;
  v_tier text := 'free';
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
  return v_tier;
end;
$$;
revoke all on function public.effective_tier_for_current_user() from public, anon;
grant execute on function public.effective_tier_for_current_user() to authenticated, service_role;
comment on table public.revenuecat_entitlements is
  'Verified store access owned by auth.users.id, never profiles.id. keeper maps to Keeper; breeder and legacy Geck Inspect Pro map to Breeder. Only server reconciliation writes.';
