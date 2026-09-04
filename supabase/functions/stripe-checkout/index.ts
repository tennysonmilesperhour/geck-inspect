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
//                               When set, attached as a second line item on
//                               every new subscription so the monthly
//                               report-social-overage cron has somewhere to
//                               post usage records.
//
// Body shape:
//   { tier: 'keeper' | 'breeder' | 'enterprise',
//     billing_cycle?: 'monthly' | 'annual',
//     price_id?: string,          // must match the catalog for tier+cycle
//     returnUrl?: string,
//     intent?: 'keeper_trial' }
//
// Trial behavior:
//   intent='keeper_trial' AND tier='keeper' AND profile.keeper_trial_used=false
//     -> 30-day trial, marks keeper_trial_used=true on the profile so the
//        same user can never trial again
//   default                                   -> 7-day trial

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
// ids are public identifiers, not secrets. Lifetime rows are absent on
// purpose: they are not for sale until a price exists in Stripe.
type Cycle = "monthly" | "annual";
const PRICE_CATALOG: Record<string, Partial<Record<Cycle, string>>> = {
  keeper: {
    monthly: "price_1TUxEsLBdc4xGjxqyPV4DOYb",
    annual: "price_1TVMLeLBdc4xGjxqA856z0Oe",
  },
  breeder: {
    monthly: "price_1TUxHGLBdc4xGjxqeieYNdE4",
    annual: "price_1TVMOCLBdc4xGjxqK2HTmGfm",
  },
  enterprise: {
    monthly: "price_1TVLvmLBdc4xGjxqCVzbz0GQ",
    annual: "price_1TVMQYLBdc4xGjxqpZFuqV96",
  },
};

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
  if (cycleRaw === "lifetime") {
    return jsonResponse(
      { error: "Lifetime plans are not available yet. Pick monthly or annual." },
      400,
    );
  }
  if (cycleRaw !== "monthly" && cycleRaw !== "annual") {
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
    .select("stripe_customer_id, subscription_status, keeper_trial_used")
    .eq("email", user.email)
    .maybeSingle();

  if (profile?.subscription_status === "grandfathered") {
    return jsonResponse(
      {
        error: "This account is grandfathered into Breeder, no checkout needed.",
      },
      400,
    );
  }

  let customerId = profile?.stripe_customer_id || null;
  if (!customerId) {
    customerId = await findOrCreateCustomer(stripeKey, user.email);
    const { error: saveErr } = await admin
      .from("profiles")
      .update({ stripe_customer_id: customerId, updated_date: new Date().toISOString() })
      .eq("email", user.email);
    if (saveErr) console.error("could not save stripe_customer_id:", saveErr.message);
  }

  // Trial-period decision tree.
  //   keeper_trial intent + tier=keeper + first-time = 30 days, mark used
  //   otherwise                                      = 7-day trial
  let trialDays = 7;
  let isKeeperPromoTrial = false;
  if (intent === "keeper_trial" && tier === "keeper") {
    if (profile?.keeper_trial_used) {
      return jsonResponse(
        { error: "You have already used your one Keeper trial.", trial_already_used: true },
        400,
      );
    }
    trialDays = 30;
    isKeeperPromoTrial = true;
  }

  const returnUrl = safeReturnUrl(body.returnUrl);
  const sessionForm = new URLSearchParams();
  sessionForm.set("mode", "subscription");
  sessionForm.set("customer", customerId!);
  sessionForm.set("line_items[0][price]", priceId);
  sessionForm.set("line_items[0][quantity]", "1");

  // Optional metered overage line. Attached when STRIPE_OVERAGE_PRICE_ID is
  // set so the report-social-overage cron has a subscription_item to post
  // usage records against. Metered prices do NOT take a quantity field on
  // line_items (the quantity is reported per-period via usage records).
  // Monthly subscriptions only: the overage price bills monthly, and
  // Stripe Checkout refuses a session that mixes billing intervals
  // ("Checkout does not support multiple prices with different billing
  // intervals"), which made every annual checkout fail.
  const overagePriceId = Deno.env.get("STRIPE_OVERAGE_PRICE_ID");
  if (overagePriceId && cycle === "monthly") {
    sessionForm.set("line_items[1][price]", overagePriceId);
  }

  sessionForm.set("success_url", `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  sessionForm.set("cancel_url", `${returnUrl}?checkout=cancelled`);
  sessionForm.set("subscription_data[trial_period_days]", String(trialDays));
  sessionForm.set("subscription_data[metadata][supabase_email]", user.email);
  sessionForm.set("subscription_data[metadata][tier]", tier);
  sessionForm.set("subscription_data[metadata][billing_cycle]", cycle);
  sessionForm.set("metadata[supabase_email]", user.email);
  sessionForm.set("metadata[tier]", tier);
  sessionForm.set("metadata[billing_cycle]", cycle);
  sessionForm.set("metadata[intent]", intent);
  sessionForm.set("metadata[keeper_promo_trial]", isKeeperPromoTrial ? "1" : "0");
  sessionForm.set("allow_promotion_codes", "true");

  try {
    const session = await stripeRequest(
      "/checkout/sessions",
      "POST",
      stripeKey,
      sessionForm,
    );
    if (isKeeperPromoTrial) {
      await admin
        .from("profiles")
        .update({
          keeper_trial_used: true,
          keeper_trial_started_at: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        })
        .eq("email", user.email);
    }
    return jsonResponse({ url: session.url, id: session.id });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 502);
  }
});
