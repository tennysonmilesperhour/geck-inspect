/**
 * RevenueCat's REST snapshot is authoritative. A webhook is a refresh signal:
 * cancellation may leave paid time, a product change may be deferred, and a
 * transfer must refresh both owners. Never grant access from client JSON.
 *
 * No Deno or database side effects: Vitest exercises the exact mapping used by
 * the deployed webhook and purchase-sync endpoint. See docs/BILLING.md.
 */
export const PRO_ENTITLEMENT = "Geck Inspect Pro";
export const MEMBERSHIP_ENTITLEMENTS = ["keeper", "breeder", PRO_ENTITLEMENT] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

type Purchase = {
  store?: string;
  is_sandbox?: boolean;
  purchase_date?: string;
  original_purchase_date?: string;
  period_type?: string;
  unsubscribe_detected_at?: string | null;
  billing_issues_detected_at?: string | null;
  refunded_at?: string | null;
};

export type CustomerSnapshot = {
  request_date_ms?: number;
  request_date?: string;
  subscriber: {
    entitlements: Record<string, {
      product_identifier: string;
      purchase_date: string;
      expires_date: string | null;
      grace_period_expires_date?: string | null;
    }>;
    subscriptions?: Record<string, Purchase>;
    non_subscriptions?: Record<string, Purchase[]>;
  };
};

/** Only Supabase Auth UUIDs can own access. Reconcile every affected alias. */
export function affectedUsers(event: RevenueCatEvent): string[] {
  const ids = event.type === "TRANSFER"
    ? [...(event.transferred_from || []), ...(event.transferred_to || [])]
    : [event.app_user_id, event.original_app_user_id, ...(event.aliases || [])];
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && UUID.test(id))
    .map((id) => id.toLowerCase()))];
}

function iso(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new Error("Invalid RevenueCat timestamp");
  return new Date(time).toISOString();
}

/**
 * Emit each supported entitlement even when absent, to revoke refunds and transferred access. expires_at
 * includes verified billing grace. Test Store and web sandbox purchases cannot
 * unlock production; validated Apple/Google sandbox receipts support store review.
 */
export function entitlementRow(appUserId: string, snapshot: CustomerSnapshot, event: RevenueCatEvent, requestedAt: number, entitlementId: string = PRO_ENTITLEMENT) {
  if (!snapshot?.subscriber?.entitlements || typeof snapshot.subscriber.entitlements !== "object") {
    throw new Error("Invalid RevenueCat customer response");
  }
  const subscriber = snapshot.subscriber;
  const entitlement = subscriber.entitlements[entitlementId];
  if (entitlement && (typeof entitlement.product_identifier !== "string" ||
    typeof entitlement.purchase_date !== "string" ||
    (entitlement.expires_date !== null && typeof entitlement.expires_date !== "string"))) {
    throw new Error("Invalid RevenueCat entitlement response");
  }
  const product = entitlement?.product_identifier;
  const subscription = product ? subscriber.subscriptions?.[product] : undefined;
  const purchases = product ? subscriber.non_subscriptions?.[product] || [] : [];
  // Match the lifetime transaction supplying the entitlement, not an earlier
  // refunded transaction for the same product.
  const purchase = subscription || purchases.find((p) => p.purchase_date === entitlement?.purchase_date);
  const store = purchase?.store?.toLowerCase() || null;
  const expires = iso(entitlement?.expires_date);
  const grace = iso(entitlement?.grace_period_expires_date);
  const accessUntil = expires && grace && grace > expires ? grace : expires;
  const sandboxAllowed = !purchase?.is_sandbox || store === "app_store" || store === "play_store";
  const active = Boolean(entitlement && purchase && store !== "test_store" && sandboxAllowed &&
    !purchase.refunded_at && (!accessUntil || Date.parse(accessUntil) > requestedAt));

  return {
    app_user_id: appUserId,
    entitlement_identifier: entitlementId,
    product_identifier: product || null,
    is_active: active,
    will_renew: Boolean(active && subscription && store !== "promotional" &&
      !purchase?.unsubscribe_detected_at && !purchase?.billing_issues_detected_at),
    period_type: purchase?.period_type || null,
    store,
    latest_purchase_at: iso(entitlement?.purchase_date),
    original_purchase_at: iso(purchase?.original_purchase_date || entitlement?.purchase_date),
    expires_at: accessUntil,
    unsubscribe_detected_at: iso(purchase?.unsubscribe_detected_at),
    billing_issue_detected_at: iso(purchase?.billing_issues_detected_at),
    last_event_id: event.id,
    last_event_type: event.type,
    // Order snapshots, not delivery times. Old webhooks fetch today's state;
    // a slower, older request must not replace a newer snapshot.
    last_event_at: iso(snapshot.request_date_ms ?? snapshot.request_date ?? requestedAt),
  };
}

export async function fetchMembershipEntitlements(appUserId: string, event: RevenueCatEvent, apiKey: string, fetcher: typeof fetch = fetch) {
  const requestedAt = Date.now();
  const response = await fetcher(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`RevenueCat customer lookup failed (${response.status})`);
  const snapshot = await response.json();
  return MEMBERSHIP_ENTITLEMENTS.map((id) => entitlementRow(appUserId, snapshot, event, requestedAt, id));
}

/** RevenueCat sends the configured Authorization header verbatim. */
export function authorizationMatches(provided: string, expected: string): boolean {
  if (!expected || provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function validEvent(value: unknown): value is RevenueCatEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Record<string, unknown>;
  return typeof event.id === "string" && event.id.length > 0 && event.id.length <= 255 &&
    typeof event.type === "string" && event.type.length > 0 && event.type.length <= 100 &&
    ["aliases", "transferred_from", "transferred_to"].every((key) =>
      event[key] == null || (Array.isArray(event[key]) && event[key].every((id) => typeof id === "string")));
}
