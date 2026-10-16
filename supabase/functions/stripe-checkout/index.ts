// Supabase Edge Function: stripe-checkout
//
// Creates a Stripe Checkout Session for a subscription tier and returns
// the session URL. The client redirects the browser there. On success,
// Stripe redirects back to /Membership?checkout=success and the webhook
// function (stripe-webhook) updates the profile row.
//
// Required env vars (set via `supabase secrets set`):
//   STRIPE_SECRET_KEY           sk_live_... or sk_test_...
// Optional:
//   STRIPE_KEEPER_PRICE_ID      price_... overrides the monthly Keeper price
//   STRIPE_BREEDER_PRICE_ID     price_... overrides the monthly Breeder price
//   STRIPE_ENTERPRISE_PRICE_ID  price_... overrides the monthly Enterprise price
//   STRIPE_OVERAGE_PRICE_ID     price_... (metered $0.50/post overage line).
//   STRIPE_OVERAGE_ENABLED      must be "true" to attach the metered line.
//                               When set, attached as a second line item on
//                               every new subscription so the monthly
//                               report-social-overage cron has somewhere to
//                               post usage records.
//
// Body shape:
//   { tier: 'keeper' | 'breeder' | 'enterprise',
//     billing_cycle?: 'monthly' | 'annual' | 'lifetime',
//     price_id?: string,          // must match the catalog for tier+cycle
//     returnUrl?: string,
//     intent?: 'purchase' | 'trial' | 'keeper_trial' }
//
// Trial behavior. A trial is opt-in: the member has to ask for one, so
// "buy a membership" means billed today, not billed in a week.
//   intent='trial' AND profile.free_trial_used=false
//     -> STANDARD_TRIAL_DAYS trial; the webhook marks free_trial_used=true
//        when the checkout completes, so the same account cannot claim a
//        second one
//   intent='keeper_trial' AND tier='keeper' AND profile.keeper_trial_used=false
//     -> KEEPER_PROMO_TRIAL_DAYS trial (the one-time first-timer promo the
//        Promote page offers); the webhook marks keeper_trial_used=true when
//        the checkout completes, so closing the tab does not spend it
//   anything else (the default)               -> no trial, billed immediately
//
// Plan changes. Checkout starts a new subscription, so a member who
// already pays is refused (409, code already_subscribed) and the
// Membership page sends them to the billing portal, which switches the
// existing subscription instead of adding a second one.
//
// Lifetime is the exception. It is a one-time payment (mode=payment),
// with no trial. A member who already pays monthly or yearly can buy
// it. After that payment succeeds, stripe-webhook cancels the old
// subscription immediately with no credit and no proration. A member
// who already has lifetime access is refused (409, code already_lifetime).
//
// Paying twice. A member with a live App Store or Google Play subscription
// is refused (409, code already_subscribed_store): Stripe cannot cancel a
// store plan for them, so the two would bill side by side. And only the
// newest Checkout page can be paid: any page this member still has open
// (another tab, a double tap) is expired before a new one is made. If an
// open page cannot be expired because it is finishing at that moment, the
// request is refused (409, code checkout_in_progress) rather than risk a
// second charge.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Price catalog, tier x billing cycle. Mirrors TIER_PRICING in
// src/lib/stripe-config.js (a unit test keeps the two in sync). Price
// ids are public identifiers, not secrets. Lifetime is a one-time
// price: Checkout uses mode=payment, not a subscription.
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

// Trial lengths, mirroring TRIAL_DAYS and KEEPER_PROMO_TRIAL_DAYS in
// src/lib/stripe-config.js. A unit test keeps the two copies in sync so the
// trial length the Membership page promises is the one Stripe applies.
const STANDARD_TRIAL_DAYS = 7;
const KEEPER_PROMO_TRIAL_DAYS = 30;

// Env overrides for the monthly prices, kept so an existing deployment
// that set STRIPE_<TIER>_PRICE_ID keeps working unchanged.
const MONTHLY_ENV_OVERRIDES: Record<string, string | undefined> = {
  keeper: Deno.env.get("STRIPE_KEEPER_PRICE_ID"),
  breeder: Deno.env.get("STRIPE_BREEDER_PRICE_ID"),
  enterprise: Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID"),
};

function resolvePriceId(tier: string, cycle: Cycle): string | null {
  if (cycle === "monthly" && MONTHLY_ENV_OVERRIDES[tier]) return MONTHLY_ENV_OVERRIDES[tier]!;
  return PRICE_CATALOG[tier]?.[cycle] || null;
}

// Subscription states that still bill or can bill again. A member with one
// of these changes plans in the billing portal, never through Checkout.
const LIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"]);

const DEFAULT_RETURN_URL = "https://geckinspect.com/Membership";
const ALLOWED_RETURN_PREFIXES = [
  "https://geckinspect.com/",
  "https://www.geckinspect.com/",
];

function safeReturnUrl(candidate: unknown): string {
  if (typeof candidate !== "string") return DEFAULT_RETURN_URL;
  return ALLOWED_RETURN_PREFIXES.some((p) => candidate.startsWith(p)) ? candidate : DEFAULT_RETURN_URL;
}

async function stripeRequest(
  path: string,
  method: "GET" | "POST",
  apiKey: string,
  form?: URLSearchParams,
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Stripe ${path} failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`,
    );
  }
  return data;
}

// Reuse an existing Stripe customer for this email before creating one.
// A failed attempt earlier in the flow (or a lost profile write) must not
// leave a trail of duplicate customers in Stripe.
async function findOrCreateCustomer(stripeKey: string, email: string): Promise<string> {
  const q = new URLSearchParams({ email, limit: "1" });
  try {
    const found = await stripeRequest(`/customers?${q}`, "GET", stripeKey);
    const existing = found?.data?.[0]?.id;
    if (existing) return existing;
  } catch (err) {
    console.warn("customer lookup failed, creating a new one:", (err as Error).message);
  }
  const form = new URLSearchParams();
  form.set("email", email);
  form.set("metadata[supabase_email]", email);
  const customer = await stripeRequest("/customers", "POST", stripeKey, form);
  return customer.id;
}

// A live App Store or Google Play subscription, from the rows the
// RevenueCat webhook keeps. Test Store and promotional grants are not
// money, so they do not block a Stripe checkout.
function hasLiveStoreSubscription(
  rows: Array<{ is_active?: boolean; expires_at?: string | null; store?: string | null }> | null | undefined,
  now: number,
): boolean {
  return (rows || []).some((row) =>
    row?.is_active === true &&
    (!row.expires_at || Date.parse(row.expires_at) > now) &&
    !["test_store", "promotional"].includes(String(row.store || "").toLowerCase())
  );
}

// Expires every Checkout page this customer still has open, so only the
// page made next can be paid. Throws { stage: "list" } when Stripe cannot
// be asked, and { stage: "expire" } when an open page could not be
// expired (usually because it was being paid at that moment).
async function expireOpenCheckoutSessions(stripeKey: string, customerId: string): Promise<number> {
  let open: { data?: Array<{ id?: string }> };
  try {
    const q = new URLSearchParams({ customer: customerId, status: "open", limit: "20" });
    open = await stripeRequest(`/checkout/sessions?${q}`, "GET", stripeKey);
  } catch (err) {
    throw Object.assign(new Error((err as Error).message), { stage: "list" });
  }
  let expired = 0;
  for (const session of open?.data || []) {
    if (!session?.id) continue;
    try {
      await stripeRequest(`/checkout/sessions/${encodeURIComponent(session.id)}/expire`, "POST", stripeKey);
      expired += 1;
    } catch (err) {
      throw Object.assign(new Error((err as Error).message), { stage: "expire" });
    }
  }
  return expired;
}

// Why checkout is refused before a session is created. Lifetime does not
// use the already_subscribed refusal: a paying member may buy it, and the
// webhook cancels the old subscription after the payment succeeds.
function checkoutRefusal(input: {
  grandfathered?: boolean;
  billingCycle?: string | null;
  cycle: string;
  hasLiveSubscription?: boolean;
  hasStoreSubscription?: boolean;
}): { status: number; error: string; code?: string } | null {
  if (input.grandfathered) {
    return {
      status: 400,
      error: "This account is grandfathered into Breeder, no checkout needed.",
    };
  }
  if (input.billingCycle === "lifetime") {
    return {
      status: 409,
      code: "already_lifetime",
      error: "You already have lifetime access.",
    };
  }
  if (input.hasStoreSubscription) {
    return {
      status: 409,
      code: "already_subscribed_store",
      error: "You already have a membership through the App Store or Google Play. Change or cancel it in your phone's subscription settings, so you are never charged twice.",
    };
  }
  if (input.cycle !== "lifetime" && input.hasLiveSubscription) {
    return {
      status: 409,
      code: "already_subscribed",
      error: "You already have a membership. Change your plan or billing cycle in the billing portal so you are never charged twice.",
    };
  }
  return null;
}

function randomLetters(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Dashboard label for comparing this checkout flow. The suffix is 8 random
// letters, which is what Stripe asks for on integration_identifier.
function lifetimeIntegrationId(suffix: string): string {
  return `geck_lifetime_${suffix}`;
}

// One-time Checkout. No subscription_data and no trial. invoice_creation
// writes an invoice so a later refund or dispute can be matched. The
// PaymentIntent metadata is what the webhook reads if the invoice is not
// on the charge yet.
function buildLifetimeCheckoutForm(args: {
  customerId: string;
  priceId: string;
  tier: string;
  userId: string;
  email: string;
  returnUrl: string;
  intent: string;
  integrationId: string;
}): URLSearchParams {
  const sessionForm = new URLSearchParams();
  sessionForm.set("mode", "payment");
  sessionForm.set("customer", args.customerId);
  sessionForm.set("line_items[0][price]", args.priceId);
  sessionForm.set("line_items[0][quantity]", "1");
  sessionForm.set("invoice_creation[enabled]", "true");
  sessionForm.set("invoice_creation[invoice_data][metadata][user_id]", args.userId);
  sessionForm.set("invoice_creation[invoice_data][metadata][tier]", args.tier);
  sessionForm.set("invoice_creation[invoice_data][metadata][billing_cycle]", "lifetime");
  sessionForm.set("payment_intent_data[metadata][user_id]", args.userId);
  sessionForm.set("payment_intent_data[metadata][tier]", args.tier);
  sessionForm.set("payment_intent_data[metadata][billing_cycle]", "lifetime");
  sessionForm.set("success_url", `${args.returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  sessionForm.set("cancel_url", `${args.returnUrl}?checkout=cancelled`);
  sessionForm.set("metadata[supabase_email]", args.email);
  sessionForm.set("metadata[user_id]", args.userId);
  sessionForm.set("metadata[tier]", args.tier);
  sessionForm.set("metadata[billing_cycle]", "lifetime");
  sessionForm.set("metadata[intent]", args.intent || "purchase");
  sessionForm.set("allow_promotion_codes", "true");
  sessionForm.set("integration_identifier", args.integrationId);
  return sessionForm;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return jsonResponse({ error: "STRIPE_SECRET_KEY not set" }, 500);
  }

  let body: {
    tier?: string;
    billing_cycle?: string;
    price_id?: string | null;
    returnUrl?: string;
    intent?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const tier = (body.tier || "").toLowerCase();
  const intent = (body.intent || "").toLowerCase();
  const cycleRaw = (body.billing_cycle || "monthly").toLowerCase();
  if (cycleRaw !== "monthly" && cycleRaw !== "annual" && cycleRaw !== "lifetime") {
    return jsonResponse({ error: `Unknown billing cycle '${cycleRaw}'.` }, 400);
  }
  const cycle = cycleRaw as Cycle;
  const priceId = resolvePriceId(tier, cycle);
  if (!priceId) {
    return jsonResponse(
      { error: `No Stripe price configured for tier '${tier}' (${cycle}).` },
      400,
    );
  }
  // The browser sends the price id it displayed. If it disagrees with the
  // catalog here, the two config copies have drifted; refuse rather than
  // charge a price the customer did not see.
  if (body.price_id && body.price_id !== priceId) {
    console.error(`price_id mismatch for ${tier}/${cycle}: client sent ${body.price_id}, catalog has ${priceId}`);
    return jsonResponse(
      { error: "Pricing is out of date on this page. Refresh and try again." },
      409,
    );
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // Two clients on purpose. `userClient` carries the caller's JWT so
  // getUser() tells us who is asking. `admin` carries no user header, so
  // its writes run as the service role. Writing through the user-scoped
  // client made the profile update run as the member, and the
  // profiles_protect_privileged_columns trigger (correctly) reverts
  // stripe_customer_id and keeper_trial_used for non-privileged callers,
  // which silently dropped the customer id after checkout.
  const userClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user?.email) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, subscription_status, membership_billing_cycle, keeper_trial_used, free_trial_used")
    .eq("email", user.email)
    .maybeSingle();

  // Store subscriptions live in revenuecat_entitlements, keyed by the auth
  // user id. Fails closed, like the Stripe check below.
  const { data: storeRows, error: storeErr } = await admin
    .from("revenuecat_entitlements")
    .select("is_active, expires_at, store")
    .eq("app_user_id", user.id)
    .eq("is_active", true);
  if (storeErr) {
    console.error("store subscription check failed:", storeErr.message);
    return jsonResponse(
      { error: "Could not check your current membership. Try again in a minute." },
      502,
    );
  }

  const earlyBlock = checkoutRefusal({
    grandfathered: profile?.subscription_status === "grandfathered",
    billingCycle: profile?.membership_billing_cycle,
    cycle,
    hasLiveSubscription: false,
    hasStoreSubscription: hasLiveStoreSubscription(storeRows, Date.now()),
  });
  if (earlyBlock) {
    return jsonResponse(
      { error: earlyBlock.error, ...(earlyBlock.code ? { code: earlyBlock.code } : {}) },
      earlyBlock.status,
    );
  }

  let customerId = profile?.stripe_customer_id || null;
  if (!customerId) {
    customerId = await findOrCreateCustomer(stripeKey, user.email);
    // Upsert, not update. An account with no profile row would otherwise
    // silently drop its Stripe customer id here, and then the webhook could
    // not match the subscription back to the member.
    const { error: saveErr } = await admin
      .from("profiles")
      .upsert(
        {
          email: user.email,
          created_by: user.email,
          stripe_customer_id: customerId,
          updated_date: new Date().toISOString(),
        },
        { onConflict: "email" },
      );
    if (saveErr) console.error("could not save stripe_customer_id:", saveErr.message);
  }

  // Ask Stripe, not the profile, whether this member already pays: the
  // profile can lag a webhook. A Keeper who picked Breeder used to end up
  // with two subscriptions billing side by side. Fails closed, since a
  // missed check could start a second subscription. Lifetime skips this
  // refusal on purpose: the webhook cancels the live subscription after
  // the one-time payment succeeds, with no credit and no proration.
  if (cycle !== "lifetime") {
    try {
      const q = new URLSearchParams({ customer: customerId!, status: "all", limit: "20" });
      const subs = await stripeRequest(`/subscriptions?${q}`, "GET", stripeKey);
      const live = (subs?.data || []).find((s: { status?: string }) =>
        LIVE_SUBSCRIPTION_STATUSES.has(s?.status || "")
      );
      const block = checkoutRefusal({
        billingCycle: profile?.membership_billing_cycle,
        cycle,
        hasLiveSubscription: Boolean(live),
      });
      if (block) {
        return jsonResponse(
          { error: block.error, ...(block.code ? { code: block.code } : {}) },
          block.status,
        );
      }
    } catch (err) {
      console.error("subscription check failed:", (err as Error).message);
      return jsonResponse(
        { error: "Could not check your current membership. Try again in a minute." },
        502,
      );
    }
  }

  // Trial-period decision tree. Zero means no trial, which is the default:
  // someone who clicks "Get Keeper" is buying a membership and expects the
  // first charge today. Only an explicit trial intent adds free days.
  // Decided before any open Checkout page is expired below, so a refused
  // trial request never cancels a checkout the member has open in another
  // tab. A lifetime purchase has no trial and ignores a trial intent.
  let trialDays = 0;
  let isKeeperPromoTrial = false;
  let isStandardTrial = false;
  if (cycle === "lifetime") {
    // no trial on a one-time price
  } else if (intent === "keeper_trial" && tier === "keeper") {
    if (profile?.keeper_trial_used) {
      return jsonResponse(
        { error: "You have already used your one Keeper trial.", trial_already_used: true },
        400,
      );
    }
    trialDays = KEEPER_PROMO_TRIAL_DAYS;
    isKeeperPromoTrial = true;
  } else if (intent === "trial") {
    if (profile?.free_trial_used) {
      return jsonResponse(
        {
          error:
            "You have already used your free trial. Starting this plan bills you today.",
          trial_already_used: true,
        },
        400,
      );
    }
    trialDays = STANDARD_TRIAL_DAYS;
    isStandardTrial = true;
  }

  try {
    await expireOpenCheckoutSessions(stripeKey, customerId!);
  } catch (err) {
    const stage = (err as { stage?: string }).stage;
    console.error(`open checkout cleanup failed (${stage}):`, (err as Error).message);
    if (stage === "expire") {
      return jsonResponse(
        {
          code: "checkout_in_progress",
          error: "A checkout you started a moment ago is still finishing. Wait a minute, then refresh this page before trying again.",
        },
        409,
      );
    }
    return jsonResponse(
      { error: "Could not check your current membership. Try again in a minute." },
      502,
    );
  }

  const returnUrl = safeReturnUrl(body.returnUrl);
  if (cycle === "lifetime") {
    // No trial on a one-time price. A trial intent is ignored so the
    // member is billed today instead of being offered free days.
    const sessionForm = buildLifetimeCheckoutForm({
      customerId: customerId!,
      priceId,
      tier,
      userId: user.id,
      email: user.email,
      returnUrl,
      intent: intent || "purchase",
      integrationId: lifetimeIntegrationId(randomLetters(8)),
    });
    try {
      const session = await stripeRequest("/checkout/sessions", "POST", stripeKey, sessionForm);
      return jsonResponse({ url: session.url, id: session.id });
    } catch (err) {
      return jsonResponse({ error: (err as Error).message }, 502);
    }
  }

  const sessionForm = new URLSearchParams();
  sessionForm.set("mode", "subscription");
  sessionForm.set("customer", customerId!);
  sessionForm.set("line_items[0][price]", priceId);
  sessionForm.set("line_items[0][quantity]", "1");

  // Social posting is paused. Explicitly opt in only when it returns; a
  // metered add-on prevents plan switching in the Stripe customer portal.
  // The report-social-overage cron uses this subscription_item to post
  // usage records against. Metered prices do NOT take a quantity field on
  // line_items (the quantity is reported per-period via usage records).
  // Monthly subscriptions only: the overage price bills monthly, and
  // Stripe Checkout refuses a session that mixes billing intervals
  // ("Checkout does not support multiple prices with different billing
  // intervals"), which made every annual checkout fail.
  const overagePriceId = Deno.env.get("STRIPE_OVERAGE_PRICE_ID");
  if (Deno.env.get("STRIPE_OVERAGE_ENABLED") === "true" && overagePriceId && cycle === "monthly") {
    sessionForm.set("line_items[1][price]", overagePriceId);
  }

  sessionForm.set("success_url", `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  sessionForm.set("cancel_url", `${returnUrl}?checkout=cancelled`);
  // Stripe treats trial_period_days=0 as an error, and omitting it is what
  // "bill me now" means.
  if (trialDays > 0) {
    sessionForm.set("subscription_data[trial_period_days]", String(trialDays));
  }
  sessionForm.set("subscription_data[metadata][supabase_email]", user.email);
  sessionForm.set("subscription_data[metadata][tier]", tier);
  sessionForm.set("subscription_data[metadata][billing_cycle]", cycle);
  sessionForm.set("metadata[supabase_email]", user.email);
  sessionForm.set("metadata[tier]", tier);
  sessionForm.set("metadata[billing_cycle]", cycle);
  sessionForm.set("metadata[intent]", intent);
  sessionForm.set("metadata[keeper_promo_trial]", isKeeperPromoTrial ? "1" : "0");
  sessionForm.set("metadata[free_trial]", isStandardTrial ? "1" : "0");
  sessionForm.set("metadata[trial_days]", String(trialDays));
  sessionForm.set("allow_promotion_codes", "true");

  try {
    const session = await stripeRequest(
      "/checkout/sessions",
      "POST",
      stripeKey,
      sessionForm,
    );
    // Both trials are spent by the webhook when the checkout completes
    // (metadata[keeper_promo_trial] and metadata[free_trial]). The Keeper
    // promo used to be marked here, so opening Checkout and closing the
    // tab lost it.
    return jsonResponse({ url: session.url, id: session.id });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 502);
  }
});
