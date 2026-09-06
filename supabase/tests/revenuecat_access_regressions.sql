-- Safe on production: every entitlement/profile/rate-limit change rolls back.
begin;
do $test$
declare
  u uuid;
  email_address text;
  event_id text := 'verification:' || gen_random_uuid()::text;
begin
  select a.id, a.email into u, email_address from auth.users a
    join public.profiles p on p.email = a.email
    where p.role is distinct from 'admin' limit 1;
  if u is null then raise exception 'A non-admin fixture account is required'; end if;
  -- Fixture setup uses the service role; the tier still resolves this ordinary
  -- user's profile and auth UUID. Explicit grant checks below cover callers.
  perform set_config('request.jwt.claims', jsonb_build_object('sub',u,'email',email_address,'role','service_role')::text,true);
  update public.profiles set membership_tier='free', subscription_status='inactive' where email=email_address;
  delete from public.revenuecat_entitlements where app_user_id=u;
  perform public.apply_revenuecat_event(jsonb_build_object('event',jsonb_build_object('id',event_id,'type','TEST_FIXTURE')),
    jsonb_build_array(jsonb_build_object('app_user_id',u,'entitlement_identifier','Unrelated product','is_active',true,'will_renew',false,'last_event_at',now())));
  if public.effective_tier_for_current_user() <> 'free' then raise exception 'Unrelated product granted Breeder'; end if;
  insert into public.revenuecat_entitlements(app_user_id,entitlement_identifier,is_active,expires_at)
    values(u,'Geck Inspect Pro',true,now()+interval '1 day');
  if public.effective_tier_for_current_user() <> 'breeder' then raise exception 'Store Pro did not unlock Breeder'; end if;
  update public.profiles set membership_tier='enterprise' where email=email_address;
  if public.effective_tier_for_current_user() <> 'enterprise' then raise exception 'Pro downgraded Enterprise'; end if;
  update public.profiles set membership_tier='keeper' where email=email_address;
  update public.revenuecat_entitlements set expires_at=now()-interval '1 second' where app_user_id=u and entitlement_identifier='Geck Inspect Pro';
  if public.effective_tier_for_current_user() <> 'keeper' then raise exception 'Expired Pro did not fall back to Stripe tier'; end if;
  update public.profiles set membership_tier='free' where email=email_address;
  insert into public.revenuecat_entitlements(app_user_id,entitlement_identifier,is_active,expires_at)
    values(u,'keeper',true,now()+interval '1 day');
  if public.effective_tier_for_current_user() <> 'keeper' then raise exception 'Native Keeper tier mismatch'; end if;
  insert into public.revenuecat_entitlements(app_user_id,entitlement_identifier,is_active,expires_at)
    values(u,'breeder',true,now()+interval '1 day');
  if public.effective_tier_for_current_user() <> 'breeder' then raise exception 'Native Breeder tier mismatch'; end if;
  update public.revenuecat_entitlements set is_active=false where app_user_id=u and entitlement_identifier='breeder';
  if public.effective_tier_for_current_user() <> 'keeper' then raise exception 'Expired Breeder did not fall back to active Keeper'; end if;
  update public.profiles set membership_tier='breeder' where email=email_address;
  if public.effective_tier_for_current_user() <> 'breeder' then raise exception 'Native Keeper downgraded Stripe Breeder'; end if;
  delete from public.revenuecat_sync_requests where app_user_id=u;
  if not public.reserve_revenuecat_sync(u) then raise exception 'First sync blocked'; end if;
  if public.reserve_revenuecat_sync(u) then raise exception 'Immediate duplicate sync allowed'; end if;
  if has_function_privilege('authenticated','public.apply_revenuecat_event(jsonb,jsonb)','execute') then raise exception 'Members can forge entitlements'; end if;
  if has_function_privilege('authenticated','public.reserve_revenuecat_sync(uuid)','execute') then raise exception 'Members can bypass sync limit'; end if;
  if has_function_privilege('anon','public.effective_tier_for_current_user()','execute') then raise exception 'Anonymous tier lookup allowed'; end if;
end;
$test$;
rollback;
