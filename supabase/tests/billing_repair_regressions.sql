begin;
do $test$
declare u uuid := (select id from auth.users limit 1); e text := 'audit-'||gen_random_uuid()::text; newer jsonb; older jsonb; applied boolean;
begin
  newer:=jsonb_build_array(jsonb_build_object('app_user_id',u,'entitlement_identifier','audit-only','is_active',false,'will_renew',false,'last_event_id',e,'last_event_type','EXPIRATION','last_event_at',now()));
  applied:=public.apply_revenuecat_event(jsonb_build_object('event',jsonb_build_object('id',e,'type','EXPIRATION')),newer);
  if not applied then raise exception 'New event skipped'; end if;
  applied:=public.apply_revenuecat_event(jsonb_build_object('event',jsonb_build_object('id',e,'type','EXPIRATION')),newer);
  if applied then raise exception 'Duplicate event replayed'; end if;
  older:=jsonb_build_array(jsonb_build_object('app_user_id',u,'entitlement_identifier','audit-only','is_active',true,'will_renew',true,'last_event_id',e||'-older','last_event_type','RENEWAL','last_event_at',now()-interval '1 day'));
  perform public.apply_revenuecat_event(jsonb_build_object('event',jsonb_build_object('id',e||'-older','type','RENEWAL')),older);
  if (select is_active from public.revenuecat_entitlements where app_user_id=u and entitlement_identifier='audit-only') then raise exception 'Old event restored expired access'; end if;
  begin
    perform public.apply_revenuecat_event(jsonb_build_object('event',jsonb_build_object('id',e||'-invalid','type','RENEWAL')),'[{"is_active":true}]'::jsonb);
    raise exception 'Invalid entitlement accepted';
  exception when others then if sqlerrm='Invalid entitlement accepted' then raise; end if; end;
  if exists(select 1 from public.revenuecat_webhook_events where event_id=e||'-invalid') then raise exception 'Failed event cannot be retried'; end if;
end $test$;
rollback;
