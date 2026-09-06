-- One tier resolver for browser, native purchases and every metered function.
-- Pro is an entitlement name, not every future RevenueCat product. It is a
-- Breeder floor and cannot reduce a member's existing Enterprise access.
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
  if v_prof.subscription_status = 'grandfathered' then return 'breeder'; end if;
  if exists (
    select 1 from public.revenuecat_entitlements
    where app_user_id = v_uid and entitlement_identifier = 'Geck Inspect Pro'
      and is_active and (expires_at is null or expires_at > now())
  ) then return 'breeder'; end if;
  return v_tier;
end;
$$;
revoke all on function public.effective_tier_for_current_user() from public, anon;
grant execute on function public.effective_tier_for_current_user() to authenticated, service_role;

-- Private rate-limit state: clients cannot impersonate another owner or clear it.
create table if not exists public.revenuecat_sync_requests (
  app_user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table public.revenuecat_sync_requests enable row level security;
revoke all on public.revenuecat_sync_requests from public, anon, authenticated;
grant all on public.revenuecat_sync_requests to service_role;

create or replace function public.reserve_revenuecat_sync(p_user_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.revenuecat_sync_requests(app_user_id, requested_at)
  values (p_user_id, now())
  on conflict(app_user_id) do update set requested_at = excluded.requested_at
    where public.revenuecat_sync_requests.requested_at < now() - interval '10 seconds';
  return found;
end;
$$;
revoke all on function public.reserve_revenuecat_sync(uuid) from public, anon, authenticated;
grant execute on function public.reserve_revenuecat_sync(uuid) to service_role;

comment on table public.revenuecat_entitlements is
  'Verified RevenueCat entitlement snapshots. app_user_id is auth.users.id, never profiles.id. Pro maps to at least Breeder. Only server reconciliation writes.';
comment on column public.revenuecat_entitlements.last_event_at is
  'Snapshot request timestamp for ordering reconciliations. Original webhook timestamps remain in revenuecat_webhook_events.payload.';
comment on table public.revenuecat_webhook_events is
  'Atomic receipt ledger. A receipt exists only when its entitlement changes committed. TEST receipts never grant access.';

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
      latest_purchase_at,original_purchase_at,expires_at,unsubscribe_detected_at,billing_issue_detected_at,last_event_id,last_event_type,last_event_at,updated_at)
    values(r.app_user_id,r.entitlement_identifier,r.is_active,r.will_renew,r.period_type,r.store,r.product_identifier,
      r.latest_purchase_at,r.original_purchase_at,r.expires_at,r.unsubscribe_detected_at,r.billing_issue_detected_at,r.last_event_id,r.last_event_type,r.last_event_at,now())
    on conflict(app_user_id,entitlement_identifier) do update set
      is_active=excluded.is_active,will_renew=excluded.will_renew,period_type=excluded.period_type,store=excluded.store,
      product_identifier=excluded.product_identifier,latest_purchase_at=excluded.latest_purchase_at,original_purchase_at=excluded.original_purchase_at,expires_at=excluded.expires_at,
      unsubscribe_detected_at=excluded.unsubscribe_detected_at,billing_issue_detected_at=excluded.billing_issue_detected_at,
      last_event_id=excluded.last_event_id,last_event_type=excluded.last_event_type,last_event_at=excluded.last_event_at,updated_at=now()
    where public.revenuecat_entitlements.last_event_at is null or excluded.last_event_at >= public.revenuecat_entitlements.last_event_at;
  end loop;
  return true;
end $$;
revoke all on function public.apply_revenuecat_event(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_revenuecat_event(jsonb,jsonb) to service_role;
