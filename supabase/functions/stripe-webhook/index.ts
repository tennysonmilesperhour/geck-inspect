// Supabase Edge Function: stripe-webhook
//
// Stripe posts subscription lifecycle events here. We verify the
// signature and mirror the relevant state into the `profiles` table.
// On every paid invoice we also settle the referral reward for whoever
// referred the paying member (one free month of Keeper, see
// award_referral_reward in supabase/migrations).
//
// Required env vars:
//   STRIPE_WEBHOOK_SECRET      whsec_... (from the Stripe dashboard endpoint)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (available automatically)
// Optional:
//   STRIPE_KEEPER_PRICE_ID     price_... overrides the monthly Keeper price
//   STRIPE_BREEDER_PRICE_ID    price_... overrides the monthly Breeder price
//   STRIPE_ENTERPRISE_PRICE_ID price_... overrides the monthly Enterprise price
//
// Register the endpoint in Stripe as
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// Events already selected: checkout.session.completed,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted, invoice.paid,
// invoice.payment_succeeded, invoice.payment_failed.
// Add these in the Stripe Dashboard (the code handles them, and the
// dashboard is not changed from here): charge.refunded,
// charge.dispute.created, charge.dispute.updated, charge.dispute.closed,
// charge.dispute.funds_withdrawn, charge.dispute.funds_reinstated,
// customer.subscription.trial_will_end,
// checkout.session.async_payment_succeeded.
// Lifetime purchases are fulfilled from checkout.session.completed when
// payment_status is paid (and from async_payment_succeeded for delayed
// payment methods). A full refund or a dispute of that payment removes
// lifetime access. customer.subscription.updated and deleted for the old
// plan must not downgrade a lifetime member.
// Keep both invoice.paid and invoice.payment_succeeded. They are one
// payment delivered twice, and the handler applies that payment once.
//
// verify_jwt=false. Stripe can't send a Supabase JWT, so we authenticate
// via the webhook signature instead.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Price catalog, tier x billing cycle. Mirrors TIER_PRICING in
// src/lib/stripe-config.js and the copy in stripe-checkout (a unit test
// keeps all three in sync). Used to turn a Stripe price id back into a
// tier and a billing cycle when a subscription renews or changes.
type Cycle = "monthly" | "annual" | "lifetime";
const PRICE_CATALOG: Record<string, Partial<Record<Cycle, string>>> = {
  keeper: {
    monthly: "price_1TUxEsLBdc4xGjxqyPV4DOYb",
    annual: "price_1TVMLeLBdc4xGjxqA856z0Oe",
    lifetime: "price_1UQV93LBdc4xGjxq4AvXpui4",
  },
  breeder: {
    monthly: "price_1TUxHGLBdc4xGjxqeieYNdE4",
    annual: "price_1TVMOCLBdc4xGjxqK2HTmGfm",
    lifetime: "price_1UQV94LBdc4xGjxqwzNWvXyI",
  },
  enterprise: {
    monthly: "price_1TVLvmLBdc4xGjxqCVzbz0GQ",
    annual: "price_1TVMQYLBdc4xGjxqpZFuqV96",
  },
};

function priceIdToPlan(priceId: string | null | undefined): { tier: string; cycle: Cycle } | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get("STRIPE_KEEPER_PRICE_ID")) return { tier: "keeper", cycle: "monthly" };
  if (priceId === Deno.env.get("STRIPE_BREEDER_PRICE_ID")) return { tier: "breeder", cycle: "monthly" };
  if (priceId === Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID")) return { tier: "enterprise", cycle: "monthly" };
  for (const [tier, cycles] of Object.entries(PRICE_CATALOG)) {
    for (const [cycle, id] of Object.entries(cycles)) {
      if (id === priceId) return { tier, cycle: cycle as Cycle };
    }
  }
  return null;
}

// A Stripe id, whether the field is a bare id or an expanded object.
function stripeId(value: any): string | null {
  if (typeof value === "string" && value) return value;
  if (typeof value?.id === "string" && value.id) return value.id;
  return null;
}

// Price id from a subscription item or an invoice line. API versions from
// 2025-03 put invoice prices under pricing.price_details. Subscription
// items may still use price, and price may be a string when it is not
// expanded. Checkout writes metadata.tier once and the portal does not
// update it, so this id is the only plan source.
function linePriceId(line: any): string | null {
  if (!line) return null;
  const direct = stripeId(line.price) || stripeId(line.pricing?.price_details?.price) || stripeId(line.plan);
  return direct;
}

// Select the catalog price, never the position of a metered add-on.
// A prorated upgrade lists the old price and the new price. The line the
// member is paying for is the positive amount, which is the new plan.
function membershipLine(lines: any[] | undefined): any | undefined {
  const matches = (lines || []).filter((line) => priceIdToPlan(linePriceId(line)));
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  const positive = matches.filter((line) => Number(line.amount ?? line.amount_excluding_tax ?? 0) > 0);
  return positive[positive.length - 1] || matches[matches.length - 1];
}

// Subscription states that still bill or can bill again.
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);

// API versions from 2025-03 (this account runs 2026-04-22.dahlia) moved an
// invoice's subscription id under parent.subscription_details.
function invoiceSubscriptionId(inv: any): string | null {
  return inv?.parent?.subscription_details?.subscription ?? inv?.subscription ?? null;
}

// Each member has one current subscription, profiles.stripe_subscription_id.
// Events from any other subscription are ignored while the current one is
// live. A member with two subscriptions used to flip back to the old plan
// when it renewed and drop to Free when it was cancelled. A new
// subscription takes over once the current one has ended.
function isCurrentSubscription(
  profile: { stripe_subscription_id?: string | null; subscription_status?: string | null },
  subscriptionId: string | null,
): boolean {
  if (!subscriptionId || !profile.stripe_subscription_id) return true;
  if (profile.stripe_subscription_id === subscriptionId) return true;
  return !LIVE_STATUSES.has(profile.subscription_status || "");
}

// Statuses that still include the paid plan. past_due keeps access while
// Stripe retries the card. A paused subscription keeps the plan too.
const GRANTS_ACCESS = new Set(["active", "trialing", "past_due", "paused"]);
// Statuses that end paid access. incomplete_expired is how a trial ends
// when the first invoice is never paid. unpaid is the end of the retry
// schedule. customer.subscription.trial_will_end is not in this set: that
// event fires three days early and must not remove access.
const ENDS_ACCESS = new Set(["canceled", "unpaid", "incomplete_expired"]);

// Profile fields for one subscription object. The current item price wins.
// metadata.tier and metadata.billing_cycle are ignored on purpose, including
// when a Keeper to Breeder switch left tier=keeper on the subscription.
// A future phase on a subscription schedule is not the current price.
function subscriptionAccessPatch(sub: any): {
  stripe_subscription_id: string;
  subscription_status: string;
  membership_tier?: string;
  membership_billing_cycle?: string | null;
  period_end_unix: number | null;
} {
  const item = membershipLine(sub?.items?.data);
  const plan = priceIdToPlan(linePriceId(item));
  const periodEnd = sub?.current_period_end ?? item?.current_period_end ?? null;
  if (ENDS_ACCESS.has(sub?.status)) {
    return {
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      membership_tier: "free",
      membership_billing_cycle: null,
      period_end_unix: periodEnd,
    };
  }
  return {
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    ...(GRANTS_ACCESS.has(sub?.status) && plan
      ? { membership_tier: plan.tier, membership_billing_cycle: plan.cycle }
      : {}),
    period_end_unix: periodEnd,
  };
}

// Checkout Session metadata is the plan picked at purchase. A delayed
// delivery of that event must not put the original tier back after the
// member has already switched prices on the same subscription.
function checkoutPlan(
  session: any,
  profile: { stripe_subscription_id?: string | null; membership_tier?: string | null } | null,
): { tier: string | null; cycle: string | null } {
  const plan = priceIdToPlan(linePriceId(membershipLine(session?.line_items?.data)));
  if (plan) return { tier: plan.tier, cycle: plan.cycle };
  const paid = profile?.membership_tier === "keeper"
    || profile?.membership_tier === "breeder"
    || profile?.membership_tier === "enterprise";
  const sameSub = !!(
    paid
    && profile?.stripe_subscription_id
    && session?.subscription
    && profile.stripe_subscription_id === session.subscription
  );
  if (sameSub) return { tier: null, cycle: null };
  return {
    tier: session?.metadata?.tier || null,
    cycle: session?.metadata?.billing_cycle || null,
  };
}

function isFullRefund(charge: any): boolean {
  if (charge?.refunded === true) return true;
  const amount = Number(charge?.amount || 0);
  const refunded = Number(charge?.amount_refunded || 0);
  return amount > 0 && refunded >= amount;
}

function chargeInvoiceId(charge: any): string | null {
  return stripeId(charge?.invoice);
}

function chargePaymentIntentId(charge: any): string | null {
  return stripeId(charge?.payment_intent);
}

// API versions from 2025-03 (this account runs 2026-04-22.dahlia) removed
// charge.invoice. The invoice is found from the payment intent.
function invoicePaymentsPath(paymentIntentId: string): string {
  return `invoice_payments?limit=1&payment[type]=payment_intent&payment[payment_intent]=${encodeURIComponent(paymentIntentId)}`;
}

function disputeChargeId(dispute: any): string | null {
  return stripeId(dispute?.charge);
}

// "revoke" removes paid access. "partial" and "record" update the payment
// row only. An older invoice than the subscription's latest one must not
// take away a plan the member has already renewed.
function membershipChargeEffect(args: {
  invoiceId: string | null;
  linkedSubscriptionId: string | null;
  currentSubscriptionId: string | null;
  latestInvoiceId: string | null;
  fullRefund: boolean;
}): "revoke" | "partial" | "record" | "ignore" {
  if (!args.invoiceId || !args.linkedSubscriptionId || !args.currentSubscriptionId) return "ignore";
  if (args.linkedSubscriptionId !== args.currentSubscriptionId) return "ignore";
  if (args.latestInvoiceId && args.latestInvoiceId !== args.invoiceId) return "record";
  return args.fullRefund ? "revoke" : "partial";
}

// Open chargebacks remove access. An inquiry (warning_*) does not. Winning
// the dispute, or having the funds returned, can restore access. Losing it
// keeps access off.
function disputeAccessDecision(eventType: string, status: string | null | undefined): "revoke" | "restore" | "ignore" {
  if (status === "lost") return "revoke";
  if (status === "won" || eventType === "charge.dispute.funds_reinstated") return "restore";
  if (
    eventType === "charge.dispute.funds_withdrawn"
    || status === "needs_response"
    || status === "under_review"
  ) return "revoke";
  return "ignore";
}

function invoicePaymentKey(invoiceId: string): string {
  return `stripe-invoice:${invoiceId}`;
}

// The referral row records the plan that was paid for. An unknown price
// must not be stored as Keeper.
function referredTierForInvoice(inv: any, profileTier: string | null | undefined): string | null {
  const plan = priceIdToPlan(linePriceId(membershipLine(inv?.lines?.data)));
  if (plan) return plan.tier;
  if (profileTier === "keeper" || profileTier === "breeder" || profileTier === "enterprise") return profileTier;
  return null;
}

function accessBlockedByPaymentStatus(status: string | null | undefined): boolean {
  return status === "refunded" || status === "disputed";
}

function monthlyPriceIdForTier(tier: string): string | null {
  const envKey = `STRIPE_${tier.toUpperCase()}_PRICE_ID`;
  return Deno.env.get(envKey) || PRICE_CATALOG[tier]?.monthly || null;
}

// Referral reward for a referrer who already pays through Stripe: one month
// of their current plan, at the monthly price, credited to their Stripe
// customer balance. Stripe applies a negative balance to the next invoice
// on its own. Free-tier referrers are handled entirely inside
// award_referral_reward() (a 30 day Keeper grant), so this only acts on
// rows the database marked stripe_credit and has not applied yet.
async function applyReferralStripeCredit(supabase: any, reward: any) {
  if (!reward || reward.reward_kind !== "stripe_credit" || reward.applied_at) return;
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    console.warn("referral credit skipped: STRIPE_SECRET_KEY not set");
    return;
  }
  const tier = reward.referrer_tier_at_award || "keeper";
  const priceId = monthlyPriceIdForTier(tier);
  const customerId = reward.referrer_stripe_customer_id;
  if (!priceId || !customerId) {
    console.warn("referral credit skipped: no monthly price or customer for", tier);
    return;
  }

  // Claim the row before touching Stripe so a retried webhook delivery
  // (Stripe sends invoice.paid and invoice.payment_succeeded for the same
  // invoice) cannot credit the same referral twice.
  const { data: claimed } = await supabase
    .from("referral_rewards")
    .update({ stripe_balance_transaction_id: `pending:${reward.stripe_invoice_id || reward.id}` })
    .eq("id", reward.id)
    .is("stripe_balance_transaction_id", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return;

  const releaseClaim = async (why: string) => {
    console.warn("referral credit failed:", why);
    await supabase
      .from("referral_rewards")
      .update({ stripe_balance_transaction_id: null, note: `Stripe credit failed: ${why}` })
      .eq("id", reward.id);
  };

  const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const price = await priceRes.json();
  if (!priceRes.ok || !price?.unit_amount) {
    await releaseClaim(price?.error?.message || `price ${priceId} has no unit_amount`);
    return;
  }

  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const body = new URLSearchParams({
    amount: String(-price.unit_amount),
    currency: price.currency || "usd",
    description: `Geck Inspect referral reward: one free month of ${tierLabel}`,
  });
  const txRes = await fetch(`https://api.stripe.com/v1/customers/${customerId}/balance_transactions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `referral-${reward.id}`,
    },
    body,
  });
  const tx = await txRes.json();
  if (!txRes.ok || !tx?.id) {
    await releaseClaim(tx?.error?.message || `balance transaction returned ${txRes.status}`);
    return;
  }

  await supabase
    .from("referral_rewards")
    .update({
      stripe_balance_transaction_id: tx.id,
      amount_cents: price.unit_amount,
      currency: price.currency || "usd",
      applied_at: new Date().toISOString(),
    })
    .eq("id", reward.id);
}

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): Promise<boolean> {
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const tsPart = parts.find((p) => p.startsWith("t="));
  const v1Parts = parts.filter((p) => p.startsWith("v1="));
  if (!tsPart || v1Parts.length === 0) return false;

  const timestamp = parseInt(tsPart.slice(2), 10);
  const signedPayload = `${timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const matches = v1Parts.some((p) => p.slice(3) === expected);
  if (!matches) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;
  return true;
}

// A paid one-time Checkout session for a lifetime price. Unpaid sessions
// (delayed payment methods) wait for async_payment_succeeded. Line items
// are not always expanded, so session metadata is the fallback.
function lifetimeCheckoutFulfillable(session: any): boolean {
  if (session?.mode !== "payment" || session?.payment_status !== "paid") return false;
  const fromLine = priceIdToPlan(linePriceId(membershipLine(session?.line_items?.data)));
  if (fromLine?.cycle === "lifetime") return true;
  const cycle = session?.metadata?.billing_cycle
    || (typeof session?.payment_intent === "object" ? session.payment_intent?.metadata?.billing_cycle : null);
  return cycle === "lifetime";
}

function lifetimeTierFromSession(session: any): string | null {
  const fromLine = priceIdToPlan(linePriceId(membershipLine(session?.line_items?.data)));
  if (fromLine?.cycle === "lifetime" && (fromLine.tier === "keeper" || fromLine.tier === "breeder")) {
    return fromLine.tier;
  }
  const tier = session?.metadata?.tier
    || (typeof session?.payment_intent === "object" ? session.payment_intent?.metadata?.tier : null);
  if (tier === "keeper" || tier === "breeder") return tier;
  return null;
}

// Repeat delivery of the same paid session must not move the start date.
// A refunded or disputed payment must not be granted again.
function lifetimeGrantPatch(profile: { membership_billing_cycle?: string | null } | null, tier: string) {
  const already = profile?.membership_billing_cycle === "lifetime";
  return {
    membership_tier: tier,
    membership_billing_cycle: "lifetime" as const,
    stripe_subscription_id: null,
    subscription_status: "active",
    membership_expires_at: null,
    ...(already ? {} : { paid_membership_started_at: new Date().toISOString() }),
  };
}

function lifetimeGrantBlockedByPaymentStatus(status: string | null | undefined): boolean {
  return status === "refunded" || status === "disputed";
}

function lifetimePaymentKey(paymentIntentId: string): string {
  return `stripe-lifetime:${paymentIntentId}`;
}

// Subscription lifecycle events must not take lifetime access away.
// The database write also filters on billing cycle, because this snapshot
// can be stale if the lifetime grant commits while the event is in flight.
function shouldApplySubscriptionEvent(profile: { membership_billing_cycle?: string | null } | null): boolean {
  return profile?.membership_billing_cycle !== "lifetime";
}

function subscriptionAccessWrite(profile: { membership_billing_cycle?: string | null } | null, sub: any) {
  if (!shouldApplySubscriptionEvent(profile)) return null;
  return subscriptionAccessPatch(sub);
}

// Statuses that still bill. incomplete is included so a half-finished
// subscription cannot start charging after a lifetime purchase.
const CANCEL_AFTER_LIFETIME = new Set([
  "active", "trialing", "past_due", "unpaid", "paused", "incomplete",
]);

function subscriptionIdsToCancel(
  profileSubId: string | null | undefined,
  listed: { id?: string; status?: string }[] | null | undefined,
): string[] {
  const ids: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  add(profileSubId);
  for (const sub of listed || []) {
    if (CANCEL_AFTER_LIFETIME.has(sub?.status || "")) add(sub?.id);
  }
  return ids;
}

// DELETE /v1/subscriptions/:id. Both default to false; setting them makes
// the "no credit, no proration" choice explicit. prorate=true would credit
// unused time back to the customer.
function immediateCancelBody(): URLSearchParams {
  const body = new URLSearchParams();
  body.set("prorate", "false");
  body.set("invoice_now", "false");
  return body;
}

function revokeAccessPatch() {
  return {
    subscription_status: "canceled",
    membership_tier: "free",
    membership_billing_cycle: null,
    stripe_subscription_id: null,
    membership_expires_at: null,
  };
}

function lifetimeRestorePatch(tier: string) {
  return {
    membership_tier: tier,
    membership_billing_cycle: "lifetime" as const,
    stripe_subscription_id: null,
    subscription_status: "active",
    membership_expires_at: null,
  };
}

function lifetimeChargeMatched(args: {
  paymentEventCycle?: string | null;
  paymentIntentMetadataCycle?: string | null;
  invoiceCycle?: string | null;
}): boolean {
  return args.paymentEventCycle === "lifetime"
    || args.paymentIntentMetadataCycle === "lifetime"
    || args.invoiceCycle === "lifetime";
}

function lifetimeChargeDecision(matched: boolean, fullRefund: boolean): "revoke" | "partial" | "ignore" {
  if (!matched) return "ignore";
  return fullRefund ? "revoke" : "partial";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return jsonResponse({ error: "STRIPE_WEBHOOK_SECRET not set" }, 500);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ error: "Missing stripe-signature header" }, 400);
  }

  const payload = await req.text();
  const valid = await verifyStripeSignature(payload, signature, webhookSecret);
  if (!valid) {
    return jsonResponse({ error: "Invalid signature" }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Audit row. Column names match the stripe_webhook_logs table
  // (stripe_event_id, stripe_event_type, processing_status, raw_payload).
  // The previous version used event_type/payload, which do not exist, so
  // every insert failed silently and the table stayed empty.
  const logId = crypto.randomUUID();
  await supabase.from("stripe_webhook_logs").insert({
    id: logId,
    stripe_event_id: String(event.id || ""),
    stripe_event_type: String(event.type || "unknown"),
    processing_status: "received",
    raw_payload: payload,
    created_date: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.warn("Failed to log webhook event:", error.message);
  });

  const markLog = async (status: string, errorMessage?: string) => {
    await supabase
      .from("stripe_webhook_logs")
      .update({
        processing_status: status,
        processed_at: new Date().toISOString(),
        updated_date: new Date().toISOString(),
        ...(errorMessage ? { error_message: errorMessage.slice(0, 1000) } : {}),
      })
      .eq("id", logId)
      .then(() => {}, () => {});
  };

  const findProfileFromCustomer = async (customerId: string | null) => {
    if (!customerId) return null;
    const { data } = await supabase
      .from("profiles")
      .select("id, email, membership_tier, membership_billing_cycle, stripe_subscription_id, subscription_status")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data || null;
  };

  // Logged where the nightly error triage reads, so a second live
  // subscription is noticed and refunded by hand.
  const flagSecondSubscription = async (email: string, current: string, incoming: string) => {
    const message = `Second live Stripe subscription for one member: ${incoming} while ${current} is live`;
    console.error(message);
    await supabase.from("error_logs").insert({
      level: "error",
      message,
      user_email: email,
      context: { source: "stripe-webhook", current, incoming, event_id: event.id },
      created_by: "stripe-webhook",
    }).then(() => {}, () => {});
  };

  // Writes the billing columns for an account.
  //
  // This used to be a plain .update().eq("email"), which matches zero rows
  // and reports no error when the account has no profile row. Nothing
  // created a profile row on signup until the on_auth_user_created trigger
  // landed, so live paid subscriptions were being dropped on the floor: the
  // webhook logged "processed" and the member stayed on Free. A real upsert
  // means a missing row can never lose a payment again.
  const upsertProfileByEmail = async (
    email: string,
    patch: Record<string, unknown>,
  ) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        { email, created_by: email, ...patch, updated_date: now },
        { onConflict: "email" },
      )
      .select("id");
    if (error) {
      console.warn("profile upsert failed:", email, error.message);
      return;
    }
    if (!data || data.length === 0) {
      console.warn("profile upsert wrote no row:", email);
    }
  };

  const stripeGet = async (path: string) => {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) return null;
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.warn("stripe read failed:", path, res.status);
      return null;
    }
    return res.json();
  };

  const latestPaymentRow = async (subscriptionId: string | null) => {
    if (!subscriptionId) return null;
    const { data } = await supabase
      .from("payment_events")
      .select("status, stripe_invoice_id")
      .eq("stripe_subscription_id", subscriptionId)
      .order("event_timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || null;
  };

  // Writes the plan from the subscription's current price. A refunded or
  // disputed latest payment stays revoked until a newer invoice is paid.
  const applySubscriptionAccess = async (profile: any, sub: any) => {
    if (!profile?.email || !sub?.id) return;
    if (!shouldApplySubscriptionEvent(profile)) {
      console.warn(`ignored subscription ${sub.id}: lifetime access stays in place`);
      return;
    }
    if (!isCurrentSubscription(profile, sub.id)) {
      console.warn(`ignored subscription ${sub.id}: ${profile.stripe_subscription_id} is current`);
      return;
    }
    const patch = subscriptionAccessWrite(profile, sub);
    if (!patch) return;
    let tier = patch.membership_tier;
    let cycle = patch.membership_billing_cycle;
    if (tier && tier !== "free") {
      const latest = await latestPaymentRow(sub.id);
      if (accessBlockedByPaymentStatus(latest?.status)) {
        tier = undefined;
        cycle = undefined;
      }
    }
    await writeBillingUnlessLifetime(profile.email, {
      stripe_subscription_id: patch.stripe_subscription_id,
      subscription_status: patch.subscription_status,
      ...(tier ? { membership_tier: tier } : {}),
      ...(tier && cycle !== undefined ? { membership_billing_cycle: cycle } : {}),
      membership_expires_at: patch.period_end_unix
        ? new Date(patch.period_end_unix * 1000).toISOString()
        : null,
    });
  };

  // Older webhook payloads still include charge.invoice. Current ones do not.
  const invoiceIdForCharge = async (charge: any) => {
    const direct = chargeInvoiceId(charge);
    if (direct) return direct;
    const paymentIntentId = chargePaymentIntentId(charge);
    if (!paymentIntentId) return null;
    const listed = await stripeGet(invoicePaymentsPath(paymentIntentId));
    return stripeId(listed?.data?.[0]?.invoice);
  };

  const linkedSubscriptionId = async (invoiceId: string | null) => {
    if (!invoiceId) return null;
    const { data } = await supabase
      .from("payment_events")
      .select("stripe_subscription_id")
      .eq("stripe_invoice_id", invoiceId)
      .limit(1)
      .maybeSingle();
    if (data?.stripe_subscription_id) return String(data.stripe_subscription_id);
    const inv = await stripeGet(`invoices/${invoiceId}`);
    return invoiceSubscriptionId(inv);
  };

  const latestInvoiceIdFor = async (subscriptionId: string) => {
    const sub = await stripeGet(`subscriptions/${subscriptionId}`);
    const fromStripe = stripeId(sub?.latest_invoice);
    if (fromStripe) return fromStripe;
    const latest = await latestPaymentRow(subscriptionId);
    return latest?.stripe_invoice_id || null;
  };

  // insertIfMissing is only for a refund or dispute of the invoice that
  // currently grants access. Inserting a blocking row for an older invoice
  // would make that old invoice look like the latest payment.
  const markInvoiceStatus = async (
    invoiceId: string,
    status: string,
    extras: {
      email: string;
      eventId: string;
      eventType: string;
      customerId: string | null;
      subscriptionId: string | null;
      amount?: number | null;
      currency?: string | null;
      insertIfMissing: boolean;
    },
  ) => {
    const { data, error } = await supabase
      .from("payment_events")
      .update({ status })
      .eq("stripe_invoice_id", invoiceId)
      .select("id");
    if (error) {
      console.warn("payment status update failed:", error.message);
      return;
    }
    if ((data && data.length > 0) || !extras.insertIfMissing) return;
    const { error: insertError } = await supabase.from("payment_events").insert({
      id: invoicePaymentKey(invoiceId),
      user_email: extras.email,
      stripe_event_id: extras.eventId,
      stripe_invoice_id: invoiceId,
      stripe_customer_id: extras.customerId,
      stripe_subscription_id: extras.subscriptionId,
      event_type: extras.eventType,
      status,
      amount_cents: extras.amount ?? null,
      currency: extras.currency || "usd",
      membership_tier: "free",
      event_timestamp: new Date().toISOString(),
    });
    if (insertError && insertError.code !== "23505") {
      console.warn("payment status marker failed:", insertError.message);
    }
  };

  const claimPaidInvoice = async (inv: any, profile: any, tier: string | null, cycle: string | null = null) => {
    const id = invoicePaymentKey(inv.id);
    const { data: existing, error: readError } = await supabase
      .from("payment_events")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (existing?.id) return "duplicate";
    const { error } = await supabase.from("payment_events").insert({
      id,
      user_email: profile.email,
      stripe_event_id: String(event.id || ""),
      stripe_invoice_id: inv.id,
      stripe_customer_id: stripeId(inv.customer),
      stripe_subscription_id: invoiceSubscriptionId(inv),
      event_type: "invoice.paid",
      status: "paid",
      amount_cents: inv.amount_paid,
      currency: inv.currency,
      membership_tier: tier,
      billing_cycle: cycle,
      event_timestamp: new Date(Number(event.created || 0) * 1000).toISOString(),
    });
    if (error?.code === "23505") return "duplicate";
    if (error) throw error;
    return "claimed";
  };

  // Subscription writes skip a row whose billing cycle is already lifetime,
  // including when this event was read before the lifetime grant committed.
  // Null billing cycle still updates: SQL `<>` would drop those rows.
  const writeBillingUnlessLifetime = async (email: string, patch: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...patch, updated_date: new Date().toISOString() })
      .eq("email", email)
      .or("membership_billing_cycle.is.null,membership_billing_cycle.neq.lifetime")
      .select("id");
    if (error) {
      console.warn("billing update failed:", email, error.message);
      throw error;
    }
    if (data && data.length > 0) return "updated";
    const { data: existing } = await supabase
      .from("profiles")
      .select("id, membership_billing_cycle")
      .eq("email", email)
      .maybeSingle();
    if (existing?.membership_billing_cycle === "lifetime") return "lifetime";
    if (!existing) {
      await upsertProfileByEmail(email, patch);
      return "inserted";
    }
    console.warn("billing update matched no row", email);
    return "skipped";
  };

  const stripeSend = async (path: string, method: "POST" | "DELETE", form?: URLSearchParams) => {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) throw new Error("STRIPE_SECRET_KEY not set");
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  const cancelSubscriptionNow = async (subscriptionId: string) => {
    const result = await stripeSend(`subscriptions/${subscriptionId}`, "DELETE", immediateCancelBody());
    if (result.ok) return;
    const message = String(result.data?.error?.message || "");
    if (/canceled|incomplete_expired/i.test(message)) return;
    throw new Error(message || `cancel ${subscriptionId} failed (${result.status})`);
  };

  const cancelPriorSubscriptions = async (customerId: string | null, profileSubId: string | null) => {
    let listed: { id?: string; status?: string }[] = [];
    if (customerId) {
      const page = await stripeGet(
        `subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100`,
      );
      if (!page) throw new Error("could not list subscriptions after lifetime purchase");
      listed = page.data || [];
    }
    for (const id of subscriptionIdsToCancel(profileSubId, listed)) {
      await cancelSubscriptionNow(id);
    }
  };

  const lookupLifetimeCharge = async (charge: any) => {
    const pi = chargePaymentIntentId(charge);
    const invoiceId = await invoiceIdForCharge(charge);
    let paymentEvent: any = null;
    if (pi) {
      const { data } = await supabase
        .from("payment_events")
        .select("id, billing_cycle, membership_tier, status, stripe_invoice_id")
        .eq("id", lifetimePaymentKey(pi))
        .maybeSingle();
      paymentEvent = data;
    }
    if (!paymentEvent && invoiceId) {
      const { data } = await supabase
        .from("payment_events")
        .select("id, billing_cycle, membership_tier, status, stripe_invoice_id")
        .eq("stripe_invoice_id", invoiceId)
        .eq("billing_cycle", "lifetime")
        .limit(1);
      paymentEvent = data?.[0] || null;
    }
    let intentCycle: string | null = null;
    let intentTier: string | null = null;
    let intent: any = null;
    if (pi && !paymentEvent) {
      intent = await stripeGet(`payment_intents/${pi}`);
      intentCycle = intent?.metadata?.billing_cycle || null;
      intentTier = intent?.metadata?.tier || null;
    }
    let invoiceCycle: string | null = null;
    let invoiceTier: string | null = null;
    if (invoiceId && !paymentEvent && intentCycle !== "lifetime") {
      const inv = await stripeGet(`invoices/${invoiceId}`);
      if (inv?.metadata?.billing_cycle === "lifetime") invoiceCycle = "lifetime";
      const plan = priceIdToPlan(linePriceId(membershipLine(inv?.lines?.data)));
      if (plan?.cycle === "lifetime") {
        invoiceCycle = "lifetime";
        invoiceTier = plan.tier;
      }
    }
    const matched = lifetimeChargeMatched({
      paymentEventCycle: paymentEvent?.billing_cycle,
      paymentIntentMetadataCycle: intentCycle,
      invoiceCycle,
    });
    return {
      matched,
      tier: paymentEvent?.membership_tier || intentTier || invoiceTier || null,
      paymentEventId: paymentEvent?.id || (pi ? lifetimePaymentKey(pi) : null),
      invoiceId: paymentEvent?.stripe_invoice_id || invoiceId,
      status: paymentEvent?.status || null,
      intentUnreadable: Boolean(pi && !paymentEvent && !intent && intentCycle !== "lifetime"),
    };
  };

  const markLifetimePayment = async (
    match: { paymentEventId: string | null; invoiceId: string | null },
    status: string,
    extras: {
      email: string;
      customerId: string | null;
      amount?: number | null;
      currency?: string | null;
      tier?: string | null;
    },
  ) => {
    if (match.paymentEventId) {
      const { data, error } = await supabase
        .from("payment_events")
        .update({ status })
        .eq("id", match.paymentEventId)
        .select("id");
      if (error) console.warn("lifetime payment status update failed:", error.message);
      if ((!data || data.length === 0) && status !== "paid") {
        const { error: insertError } = await supabase.from("payment_events").insert({
          id: match.paymentEventId,
          user_email: extras.email,
          stripe_event_id: String(event.id || ""),
          stripe_invoice_id: match.invoiceId,
          stripe_customer_id: extras.customerId,
          event_type: event.type,
          status,
          amount_cents: extras.amount ?? null,
          currency: extras.currency || "usd",
          membership_tier: extras.tier || null,
          billing_cycle: "lifetime",
          event_timestamp: new Date().toISOString(),
        });
        if (insertError && insertError.code !== "23505") {
          console.warn("lifetime payment marker failed:", insertError.message);
        }
      }
    }
    if (match.invoiceId) {
      await markInvoiceStatus(match.invoiceId, status, {
        email: extras.email,
        eventId: String(event.id || ""),
        eventType: event.type,
        customerId: extras.customerId,
        subscriptionId: null,
        amount: extras.amount,
        currency: extras.currency,
        insertIfMissing: false,
      });
    }
  };

  const grantLifetimeFromSession = async (session: any) => {
    const customerId = stripeId(session.customer);
    const profile = customerId ? await findProfileFromCustomer(customerId) : null;
    const email = session.metadata?.supabase_email
      || session.customer_details?.email
      || profile?.email
      || null;
    if (!email) throw new Error("lifetime checkout has no member email");
    const tier = lifetimeTierFromSession(session);
    if (!tier) throw new Error("lifetime checkout has no keeper or breeder tier");
    const pi = stripeId(session.payment_intent);
    const paymentKey = pi ? lifetimePaymentKey(pi) : `stripe-lifetime-session:${session.id}`;
    const { data: existingPay } = await supabase
      .from("payment_events")
      .select("status")
      .eq("id", paymentKey)
      .maybeSingle();
    if (lifetimeGrantBlockedByPaymentStatus(existingPay?.status)) {
      console.warn("lifetime grant skipped: payment is", existingPay?.status);
      return;
    }
    const priorSubId = profile?.stripe_subscription_id || null;
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          email,
          created_by: email,
          stripe_customer_id: customerId,
          ...lifetimeGrantPatch(profile, tier),
          updated_date: new Date().toISOString(),
        },
        { onConflict: "email" },
      )
      .select("id");
    if (profileError) throw profileError;
    const { error: payError } = await supabase.from("payment_events").insert({
      id: paymentKey,
      user_email: email,
      stripe_event_id: String(event.id || ""),
      stripe_invoice_id: stripeId(session.invoice),
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      event_type: event.type,
      status: "paid",
      amount_cents: session.amount_total ?? null,
      currency: session.currency || "usd",
      membership_tier: tier,
      billing_cycle: "lifetime",
      event_timestamp: new Date(Number(event.created || 0) * 1000).toISOString(),
    });
    if (payError && payError.code !== "23505") throw payError;
    await cancelPriorSubscriptions(customerId, priorSubId);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.mode === "payment" || event.type === "checkout.session.async_payment_succeeded") {
          if (session.mode === "payment" && lifetimeCheckoutFulfillable(session)) {
            await grantLifetimeFromSession(session);
          } else if (session.mode === "payment" && session.payment_status === "paid") {
            console.warn("paid payment checkout is not a lifetime plan", session.id);
          }
          break;
        }
        const profile = session.customer
          ? await findProfileFromCustomer(stripeId(session.customer))
          : null;
        const email =
          session.metadata?.supabase_email ||
          session.customer_details?.email ||
          profile?.email ||
          null;
        if (email) {
          const chosen = checkoutPlan(session, profile);
          const isKeeperPromoTrial = session.metadata?.keeper_promo_trial === "1";
          const isStandardTrial = session.metadata?.free_trial === "1";
          // Checkout refuses members who already pay, so this only happens
          // when two checkouts were opened before either finished.
          if (
            profile?.stripe_subscription_id &&
            session.subscription &&
            profile.stripe_subscription_id !== session.subscription &&
            LIVE_STATUSES.has(profile.subscription_status || "")
          ) {
            await flagSecondSubscription(email, profile.stripe_subscription_id, session.subscription);
          }
          await upsertProfileByEmail(email, {
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_status: "active",
            ...(chosen.tier ? { membership_tier: chosen.tier } : {}),
            ...(chosen.cycle ? { membership_billing_cycle: chosen.cycle } : {}),
            paid_membership_started_at: new Date().toISOString(),
            ...(isKeeperPromoTrial
              ? { keeper_trial_used: true, keeper_trial_started_at: new Date().toISOString() }
              : {}),
            // The one standard free trial per account is spent here rather
            // than when the session was created, so abandoning Checkout
            // leaves the offer intact.
            ...(isStandardTrial
              ? { free_trial_used: true, free_trial_started_at: new Date().toISOString() }
              : {}),
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end": {
        // trial_will_end arrives about three days before the trial ends.
        // The subscription is still trialing, so this refreshes the plan
        // from the current price and does not remove access. Access ends
        // when a later update or delete moves the status to canceled,
        // unpaid, or incomplete_expired.
        const sub = event.data.object;
        const profile = await findProfileFromCustomer(stripeId(sub.customer));
        if (profile?.email) await applySubscriptionAccess(profile, sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const profile = await findProfileFromCustomer(stripeId(sub.customer));
        if (profile?.email) {
          if (!shouldApplySubscriptionEvent(profile)) {
            console.warn(`ignored ${event.type} for ${sub.id}: lifetime access stays in place`);
            break;
          }
          if (!isCurrentSubscription(profile, sub.id)) {
            console.warn(`ignored ${event.type} for ${sub.id}: ${profile.stripe_subscription_id} is current`);
            break;
          }
          await writeBillingUnlessLifetime(profile.email, {
            subscription_status: "canceled",
            membership_tier: "free",
            membership_billing_cycle: null,
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const profile = await findProfileFromCustomer(stripeId(inv.customer));
        if (!profile?.email) break;
        if (!shouldApplySubscriptionEvent(profile)) {
          console.warn(`ignored invoice.payment_failed: lifetime access stays in place`);
          break;
        }
        if (isCurrentSubscription(profile, invoiceSubscriptionId(inv))) {
          await writeBillingUnlessLifetime(profile.email, {
            subscription_status: "past_due",
          });
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object;
        const profile = await findProfileFromCustomer(stripeId(charge.customer));
        if (!profile?.email) {
          console.warn("ignored charge.refunded: could not match the charge to a member");
          break;
        }
        const lifetime = await lookupLifetimeCharge(charge);
        if (profile.membership_billing_cycle === "lifetime" && lifetime.intentUnreadable && !lifetime.matched) {
          throw new Error("could not read payment intent to match lifetime refund");
        }
        if (lifetime.matched) {
          const effect = lifetimeChargeDecision(true, isFullRefund(charge));
          await markLifetimePayment(
            lifetime,
            effect === "revoke" ? "refunded" : "partial_refund",
            {
              email: profile.email,
              customerId: stripeId(charge.customer),
              amount: charge.amount_refunded,
              currency: charge.currency,
              tier: lifetime.tier,
            },
          );
          if (effect === "revoke") {
            await upsertProfileByEmail(profile.email, revokeAccessPatch());
          }
          break;
        }
        const invoiceId = await invoiceIdForCharge(charge);
        const linked = await linkedSubscriptionId(invoiceId);
        const latestInvoiceId = linked ? await latestInvoiceIdFor(linked) : null;
        const effect = membershipChargeEffect({
          invoiceId,
          linkedSubscriptionId: linked,
          currentSubscriptionId: profile.stripe_subscription_id || null,
          latestInvoiceId,
          fullRefund: isFullRefund(charge),
        });
        if (effect === "ignore" || effect === "record") break;
        if (invoiceId) {
          await markInvoiceStatus(invoiceId, effect === "partial" ? "partial_refund" : "refunded", {
            email: profile.email,
            eventId: String(event.id || ""),
            eventType: event.type,
            customerId: stripeId(charge.customer),
            subscriptionId: linked,
            amount: charge.amount_refunded,
            currency: charge.currency,
            insertIfMissing: effect === "revoke",
          });
        }
        if (effect === "revoke") {
          await upsertProfileByEmail(profile.email, {
            subscription_status: "canceled",
            membership_tier: "free",
            membership_billing_cycle: null,
          });
        }
        break;
      }
      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed":
      case "charge.dispute.funds_withdrawn":
      case "charge.dispute.funds_reinstated": {
        const dispute = event.data.object;
        const decision = disputeAccessDecision(event.type, dispute.status);
        if (decision === "ignore") break;
        const chargeId = disputeChargeId(dispute);
        const charge = dispute.charge && typeof dispute.charge === "object"
          ? dispute.charge
          : (chargeId ? await stripeGet(`charges/${chargeId}`) : null);
        const profile = await findProfileFromCustomer(stripeId(charge?.customer));
        if (!profile?.email) {
          console.warn(`ignored ${event.type}: could not match the charge to a member`);
          break;
        }
        const lifetime = await lookupLifetimeCharge(charge || { payment_intent: dispute.payment_intent });
        if (profile.membership_billing_cycle === "lifetime" && lifetime.intentUnreadable && !lifetime.matched) {
          throw new Error("could not read payment intent to match lifetime dispute");
        }
        if (lifetime.matched) {
          const customerId = stripeId(charge?.customer);
          if (decision === "restore") {
            if (lifetime.status === "refunded") break;
            await markLifetimePayment(lifetime, "paid", {
              email: profile.email,
              customerId,
              tier: lifetime.tier,
            });
            if (lifetime.tier === "keeper" || lifetime.tier === "breeder") {
              await upsertProfileByEmail(profile.email, lifetimeRestorePatch(lifetime.tier));
            } else {
              console.warn("dispute won but the lifetime tier is unknown");
            }
            break;
          }
          await markLifetimePayment(lifetime, "disputed", {
            email: profile.email,
            customerId,
            amount: dispute.amount,
            currency: dispute.currency,
            tier: lifetime.tier,
          });
          await upsertProfileByEmail(profile.email, {
            ...revokeAccessPatch(),
            subscription_status: dispute.status === "lost" ? "canceled" : "disputed",
          });
          break;
        }
        const invoiceId = await invoiceIdForCharge(charge || { payment_intent: dispute.payment_intent });
        const linked = await linkedSubscriptionId(invoiceId);
        const latestInvoiceId = linked ? await latestInvoiceIdFor(linked) : null;
        const effect = membershipChargeEffect({
          invoiceId,
          linkedSubscriptionId: linked,
          currentSubscriptionId: profile.stripe_subscription_id || null,
          latestInvoiceId,
          fullRefund: true,
        });
        if (effect === "ignore" || effect === "record") break;
        if (decision === "restore") {
          if (invoiceId) {
            await markInvoiceStatus(invoiceId, "paid", {
              email: profile.email,
              eventId: String(event.id || ""),
              eventType: event.type,
              customerId: stripeId(charge?.customer),
              subscriptionId: linked,
              insertIfMissing: false,
            });
          }
          if (linked) {
            const sub = await stripeGet(`subscriptions/${linked}`);
            if (sub) await applySubscriptionAccess(profile, sub);
            else console.warn("dispute won but the subscription could not be read", linked);
          }
          break;
        }
        if (invoiceId) {
          await markInvoiceStatus(invoiceId, "disputed", {
            email: profile.email,
            eventId: String(event.id || ""),
            eventType: event.type,
            customerId: stripeId(charge?.customer),
            subscriptionId: linked,
            amount: dispute.amount,
            currency: dispute.currency,
            insertIfMissing: true,
          });
        }
        await upsertProfileByEmail(profile.email, {
          subscription_status: dispute.status === "lost" ? "canceled" : "disputed",
          membership_tier: "free",
          membership_billing_cycle: null,
        });
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const inv = event.data.object;
        // One payment produces both events. The first delivery inserts
        // payment_events id stripe-invoice:<invoice id> and is the only
        // delivery that applies the referral. The plan itself comes from the
        // subscription price, not from this invoice. The database still
        // allows one referral reward per referred member. award is not
        // limited to billing_reason=subscription_create because a member who
        // took the trial pays their first real invoice on renewal.
        if ((inv.amount_paid || 0) > 0) {
          const profile = await findProfileFromCustomer(stripeId(inv.customer));
          if (!profile?.email) break;
          const subscriptionId = invoiceSubscriptionId(inv);
          if (!isCurrentSubscription(profile, subscriptionId)) break;
          const tier = referredTierForInvoice(inv, profile.membership_tier);
          const plan = priceIdToPlan(linePriceId(membershipLine(inv.lines?.data)));
          // Live and test both claim the invoice id. invoice.paid and
          // invoice.payment_succeeded then cannot both apply the referral.
          // A lost race or a second delivery returns duplicate.
          const claim = await claimPaidInvoice(inv, profile, tier, plan?.cycle || null);
          if (claim !== "claimed") break;
          // The subscription event is what changes the plan. A paid invoice
          // can list the old price as a credit, so it must not write the tier.
          if (!plan) {
            console.warn("paid invoice has no catalog price", inv.id);
          }
          if (!tier) {
            console.warn("referral skipped: invoice has no known membership price", inv.id);
            break;
          }
          try {
            const { data: reward, error } = await supabase.rpc("award_referral_reward", {
              p_referred_email: profile.email,
              p_referred_tier: tier,
              p_stripe_invoice_id: inv.id,
            });
            if (error) throw error;
            await applyReferralStripeCredit(supabase, reward);
          } catch (err) {
            console.warn("referral reward failed:", (err as Error).message);
            await supabase.from("payment_events").delete().eq("id", invoicePaymentKey(inv.id));
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler crash:", err);
    await markLog("failed", (err as Error).message);
    return jsonResponse({ error: (err as Error).message }, 500);
  }

  await markLog("processed");
  return jsonResponse({ received: true });
});
