-- effective_tier_for_current_user compared revenuecat_entitlements.app_user_id
-- (a uuid) against text values, which raises "operator does not exist:
-- uuid = text" for every signed-in caller. consume_feature_credit calls
-- this function first, so every metered feature (health screen, invoke-llm,
-- IoT polling, visual search, growth reel, image import) failed with a
-- 500 instead of spending a credit. Compare uuid to uuid and cast only
-- for the legacy text profiles.id.
--
-- Applied to production by hand as effective_tier_uuid_fix on 2026-09-05.

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

  -- app_user_id is the Supabase auth uuid the app hands to
  -- Purchases.configure, so match it as a uuid. profiles.id is legacy
  -- text, so that one comparison casts.
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
