-- The Free plan's 10-gecko limit, enforced by the database
-- (2 Oct 2026, feature completeness audit step 28, decision D12).
--
-- The app checked the limit only when the full add form opened, so Quick
-- Add's "Add another", the CSV import and any direct insert could take a
-- free account past 10. This trigger refuses a NEW gecko row that would
-- give a Free plan owner more than 10 active geckos.
--
-- What counts, matching the app (src/lib/geckoLimit.js):
--   * the owner is the row's created_by (or the signed-in member when it
--     is empty), the same email every add path writes;
--   * active means not archived. Archived geckos (sold, passed away,
--     other) do not count, so archiving one frees a slot.
--
-- What it never does (D12): it runs on INSERT only, so editing,
-- archiving, unarchiving or transferring a gecko is never blocked, and no
-- existing gecko is touched. An archived row inserted directly is allowed.
-- (Unarchiving is an update, so the app checks that case itself before
-- it restores a gecko.)
--
-- The plan comes from effective_tier_for_email(), the same rules as the
-- app's resolveTier() and effective_tier_for_current_user(): admins are
-- Enterprise; otherwise the highest of the profile plan, a grandfathered
-- Breeder grant, and an active app store (RevenueCat) entitlement.

create or replace function public.effective_tier_for_email(p_email text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_prof record;
  v_tier text := 'free';
  v_uid uuid;
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

  return v_tier;
end;
$function$;

-- Internal helper for the trigger. Members must not look up other
-- members' plans through it.
revoke all on function public.effective_tier_for_email(text) from public, anon, authenticated;
grant execute on function public.effective_tier_for_email(text) to service_role;

create or replace function public.enforce_free_gecko_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_owner text := nullif(btrim(coalesce(new.created_by, auth.email(), '')), '');
  v_free_limit constant integer := 10;
  v_active integer;
begin
  if v_owner is null or coalesce(new.archived, false) then
    return new;
  end if;
  if public.effective_tier_for_email(v_owner) <> 'free' then
    return new;
  end if;

  -- Two adds at the same moment (a double tap, a CSV import running
  -- alongside Quick Add) must not both see 9 and both succeed.
  perform pg_advisory_xact_lock(hashtextextended('free_gecko_limit:' || lower(v_owner), 0));

  select count(*) into v_active
    from public.geckos
   where lower(created_by) = lower(v_owner)
     and coalesce(archived, false) = false;

  if v_active >= v_free_limit then
    raise exception 'The Free plan holds up to % active geckos. Archive one you no longer keep, or upgrade your plan to add more.', v_free_limit
      using errcode = 'P0001', hint = 'gecko_limit_reached';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_free_gecko_limit() from public, anon, authenticated;

create or replace trigger geckos_enforce_free_limit
  before insert on public.geckos
  for each row execute function public.enforce_free_gecko_limit();
