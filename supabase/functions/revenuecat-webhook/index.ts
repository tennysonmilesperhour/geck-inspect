// Supabase Edge Function: revenuecat-webhook
//
// Receives RevenueCat platform events (purchases, renewals, refunds,
// cancellations, billing issues) and mirrors the resulting entitlement
// state into `public.revenuecat_entitlements`. The mirror is what
// server-side code reads when it needs to know if a user has access to
// "Geck Inspect Pro" without trusting the client.
//
// Idempotent on event.id (RevenueCat retries on non-2xx).
//
// Deploy:
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//
// RevenueCat dashboard config:
//   Webhook URL:     https://<project>.functions.supabase.co/revenuecat-webhook
//   Authorization:   set to a long random string and store the SAME
//                    value as REVENUECAT_WEBHOOK_AUTHORIZATION in
//                    Supabase secrets. RC will send it back verbatim
//                    in the Authorization header of every delivery.
//
// Secrets (`supabase secrets set …`):
//   REVENUECAT_WEBHOOK_AUTHORIZATION   the bearer string above
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const EXPECTED_AUTHORIZATION = Deno.env.get(
  "REVENUECAT_WEBHOOK_AUTHORIZATION",
) || "";

// Events that change the activation state of an entitlement. Anything
// not in this list is ack-only (recorded as received but doesn't mutate
// the mirror).
const PURCHASE_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "TEMPORARY_ENTITLEMENT_GRANT",
  "TRANSFER",
]);

const CANCELLATION_EVENTS = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "REFUND",
  "SUBSCRIPTION_PAUSED",
]);

const BILLING_ISSUE_EVENTS = new Set(["BILLING_ISSUE"]);

type RCEvent = {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  period_type?: string | null;
  store?: string | null;
  environment?: string | null;
  purchased_at_ms?: number | null;
  expiration_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  cancel_reason?: string | null;
  is_trial_conversion?: boolean;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function msToIso(ms: number | null | undefined): string | null {
  if (!ms || typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function entitlementIds(event: RCEvent): string[] {
  if (Array.isArray(event.entitlement_ids) && event.entitlement_ids.length > 0) {
    return event.entitlement_ids;
  }
  if (typeof event.entitlement_id === "string" && event.entitlement_id) {
    return [event.entitlement_id];
  }
  return [];
}

// RC's app_user_id is whatever the client passed at Purchases.configure.
// Geck Inspect always configures with the Supabase auth.users.id (a
// uuid), so we expect uuid-shaped strings here. Anything else (legacy
// or anonymous ids) is dropped, since the mirror is keyed by uuid.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveAppUserUuid(event: RCEvent): string | null {
  const candidates = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases || []),
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  for (const c of candidates) {
    if (UUID_RE.test(c)) return c.toLowerCase();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  if (!EXPECTED_AUTHORIZATION) {
    console.error("[revenuecat-webhook] missing REVENUECAT_WEBHOOK_AUTHORIZATION secret");
    return jsonResponse({ error: "server_misconfigured" }, 500);
  }

  const auth = req.headers.get("authorization") || "";
  // RC sends the configured value verbatim. We accept either the raw
  // value or "Bearer <value>" since the dashboard UI is inconsistent
  // about which form it stores.
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!constantTimeEq(provided, EXPECTED_AUTHORIZATION)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let payload: { api_version?: string; event?: RCEvent };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  const event = payload?.event;
  if (!event || !event.id || !event.type) {
    return jsonResponse({ error: "missing_event" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotency check. ON CONFLICT DO NOTHING returns 0 rows if we've
  // already seen this event id, which lets us short-circuit before
  // doing any entitlement math.
  const insertEvent = await supabase
    .from("revenuecat_webhook_events")
    .insert({
      event_id: event.id,
      event_type: event.type,
      app_user_id: resolveAppUserUuid(event),
      payload: payload as unknown as Record<string, unknown>,
    })
    .select("event_id");

  if (insertEvent.error) {
    const code = (insertEvent.error as { code?: string }).code;
    if (code === "23505") {
      // Duplicate, already processed. Ack with 200 so RC stops retrying.
      return jsonResponse({ ok: true, duplicate: true });
    }
    console.error("[revenuecat-webhook] insert event failed:", insertEvent.error);
    return jsonResponse({ error: "insert_failed" }, 500);
  }

  const appUserUuid = resolveAppUserUuid(event);
  if (!appUserUuid) {
    console.warn(
      `[revenuecat-webhook] no uuid app_user_id on event ${event.id}, type ${event.type}`,
    );
    return jsonResponse({ ok: true, skipped: "non_uuid_app_user_id" });
  }

  const ents = entitlementIds(event);
  if (ents.length === 0) {
    return jsonResponse({ ok: true, skipped: "no_entitlements_in_event" });
  }

  const isPurchase = PURCHASE_EVENTS.has(event.type);
  const isCancel = CANCELLATION_EVENTS.has(event.type);
  const isBillingIssue = BILLING_ISSUE_EVENTS.has(event.type);
  const eventAt = msToIso(event.event_timestamp_ms) || new Date().toISOString();

  const rows = ents.map((entitlementId) => {
    const base = {
      app_user_id: appUserUuid,
      entitlement_identifier: entitlementId,
      product_identifier: event.product_id ?? null,
      period_type: event.period_type ?? null,
      store: event.store ?? null,
      latest_purchase_at: msToIso(event.purchased_at_ms),
      expires_at: msToIso(event.expiration_at_ms),
      last_event_id: event.id,
      last_event_type: event.type,
      last_event_at: eventAt,
      updated_at: new Date().toISOString(),
    };

    if (isPurchase) {
      return {
        ...base,
        is_active: true,
        will_renew: event.type !== "NON_RENEWING_PURCHASE",
        unsubscribe_detected_at: null,
        billing_issue_detected_at: null,
      };
    }
    if (isCancel) {
      // For CANCELLATION we keep is_active=true until the entitlement
      // actually expires (will_renew flips to false). For EXPIRATION /
      // REFUND, the entitlement is gone right now.
      const active = event.type === "CANCELLATION";
      return {
        ...base,
        is_active: active,
        will_renew: false,
        unsubscribe_detected_at: eventAt,
      };
    }
    if (isBillingIssue) {
      return {
        ...base,
        is_active: true,
        will_renew: false,
        billing_issue_detected_at: eventAt,
      };
    }
    return { ...base, is_active: false, will_renew: false };
  });

  const upsert = await supabase
    .from("revenuecat_entitlements")
    .upsert(rows, { onConflict: "app_user_id,entitlement_identifier" });

  if (upsert.error) {
    console.error("[revenuecat-webhook] upsert failed:", upsert.error);
    return jsonResponse({ error: "upsert_failed" }, 500);
  }

  return jsonResponse({ ok: true, applied: rows.length });
});
