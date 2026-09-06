-- Event receipt and entitlement changes commit together. Older deliveries cannot
-- overwrite a newer cancellation or expiration.
create or replace function public.apply_revenuecat_event(p_event jsonb,p_rows jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.revenuecat_entitlements;
begin
  insert into public.revenuecat_webhook_events(event_id,event_type,app_user_id,payload)
    values(p_event->'event'->>'id',p_event->'event'->>'type',nullif(p_rows->0->>'app_user_id','')::uuid,p_event)
    on conflict(event_id) do nothing;
  if not found then return false; end if;
  for r in select * from jsonb_populate_recordset(null::public.revenuecat_entitlements,p_rows) loop
    insert into public.revenuecat_entitlements(
      app_user_id,entitlement_identifier,is_active,will_renew,period_type,store,product_identifier,
      latest_purchase_at,expires_at,unsubscribe_detected_at,billing_issue_detected_at,last_event_id,last_event_type,last_event_at,updated_at)
    values(r.app_user_id,r.entitlement_identifier,r.is_active,r.will_renew,r.period_type,r.store,r.product_identifier,
      r.latest_purchase_at,r.expires_at,r.unsubscribe_detected_at,r.billing_issue_detected_at,r.last_event_id,r.last_event_type,r.last_event_at,now())
    on conflict(app_user_id,entitlement_identifier) do update set
      is_active=excluded.is_active,will_renew=excluded.will_renew,period_type=excluded.period_type,store=excluded.store,
      product_identifier=excluded.product_identifier,latest_purchase_at=excluded.latest_purchase_at,expires_at=excluded.expires_at,
      unsubscribe_detected_at=excluded.unsubscribe_detected_at,billing_issue_detected_at=excluded.billing_issue_detected_at,
      last_event_id=excluded.last_event_id,last_event_type=excluded.last_event_type,last_event_at=excluded.last_event_at,updated_at=now()
    where public.revenuecat_entitlements.last_event_at is null or excluded.last_event_at >= public.revenuecat_entitlements.last_event_at;
  end loop;
  return true;
end $$;
revoke all on function public.apply_revenuecat_event(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_revenuecat_event(jsonb,jsonb) to service_role;
