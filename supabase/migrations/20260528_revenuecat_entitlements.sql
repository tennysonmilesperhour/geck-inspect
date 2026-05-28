-- RevenueCat entitlements mirror, kept up to date by the
-- `revenuecat-webhook` edge function. The Web SDK's CustomerInfo is the
-- authoritative source while the user is online, but the moment a
-- purchase happens on iOS or Android the only signal we get is the
-- RevenueCat webhook. This table is what server-side code (RLS
-- policies, edge functions, the admin panel) reads instead of trusting
-- the client.
--
-- One row per (app_user_id, entitlement_identifier). Keyed by the
-- Supabase auth.users.id so the same user gets the same row whether
-- they purchased on web, iOS, or Android.

CREATE TABLE IF NOT EXISTS public.revenuecat_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id uuid NOT NULL,
  entitlement_identifier text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  will_renew boolean NOT NULL DEFAULT false,
  period_type text,
  store text,
  product_identifier text,
  latest_purchase_at timestamptz,
  original_purchase_at timestamptz,
  expires_at timestamptz,
  unsubscribe_detected_at timestamptz,
  billing_issue_detected_at timestamptz,
  last_event_id text,
  last_event_type text,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_user_id, entitlement_identifier)
);

CREATE INDEX IF NOT EXISTS revenuecat_entitlements_app_user_id_idx
  ON public.revenuecat_entitlements (app_user_id);

CREATE INDEX IF NOT EXISTS revenuecat_entitlements_active_idx
  ON public.revenuecat_entitlements (entitlement_identifier, is_active)
  WHERE is_active = true;

ALTER TABLE public.revenuecat_entitlements ENABLE ROW LEVEL SECURITY;

-- Users can read their own entitlement rows so the client can check Pro
-- status without re-fetching CustomerInfo from RevenueCat every render.
DROP POLICY IF EXISTS revenuecat_entitlements_select_self
  ON public.revenuecat_entitlements;
CREATE POLICY revenuecat_entitlements_select_self
  ON public.revenuecat_entitlements
  FOR SELECT
  USING (app_user_id = auth.uid());

-- Writes are blocked from anon / authenticated. Only the service role
-- (the edge function) can upsert rows, which keeps the entitlement
-- truth server-side.
GRANT SELECT ON public.revenuecat_entitlements TO authenticated;

-- Idempotency table for the webhook. RevenueCat retries on non-2xx so
-- we record every event id we've already processed and short-circuit
-- duplicates. Keyed by RC's globally-unique event id.
CREATE TABLE IF NOT EXISTS public.revenuecat_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  app_user_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS revenuecat_webhook_events_received_at_idx
  ON public.revenuecat_webhook_events (received_at DESC);

ALTER TABLE public.revenuecat_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reads/writes this table.
