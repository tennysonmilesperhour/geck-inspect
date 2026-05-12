// Supabase Edge Function: stripe-checkout
//
// Creates a Stripe Checkout Session for a subscription tier and returns
// the session URL. The client redirects the browser there. On success,
// Stripe redirects back to /Membership?checkout=success and the webhook
// function (stripe-webhook) updates the profile row.
//
// Required env vars (set via `supabase secrets set`):
//   STRIPE_SECRET_KEY           sk_live_... or sk_test_...
//   STRIPE_KEEPER_PRICE_ID      price_... (monthly Keeper)
//   STRIPE_BREEDER_PRICE_ID     price_... (monthly Breeder)
//   STRIPE_ENTERPRISE_PRICE_ID  price_... (monthly Enterprise $99.99)
// Optional:
//   STRIPE_OVERAGE_PRICE_ID     price_... (metered $0.50/post overage line).
//                               When set, attached as a second line item on
//                               every new subscription so the monthly
//                               report-social-overage cron has somewhere to
//                               post usage records.
//
// Body shape:
//   { tier: 'keeper' | 'breeder', returnUrl?: string, intent?: 'keeper_trial' }
//
// Trial behavior:
//   intent='keeper_trial' AND tier='keeper' AND profile.keeper_trial_used=false
//     -> 30-day trial, marks keeper_trial_used=true on the profile so the
//        same user can never trial again
//   default                                   -> 7-day trial (legacy behavior)

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

const PRICE_IDS: Record<string, string | undefined> = {
  keeper: Deno.env.get("STRIPE_KEEPER_PRICE_ID"),
  breeder: Deno.env.get("STRIPE_BREEDER_PRICE_ID"),
  enterprise: Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID"),
};

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

  let body: { tier?: string; returnUrl?: string; intent?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const tier = (body.tier || "").toLowerCase();
  const intent = (body.intent || "").toLowerCase();
  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    return jsonResponse(
      {
        error: `No Stripe price configured for tier '${tier}'. Set STRIPE_${tier.toUpperCase()}_PRICE_ID on the edge function.`,
      },
      400,
    );
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.email) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  const { data: profile } = await supabase
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
    const customerForm = new URLSearchParams();
    customerForm.set("email", user.email);
    customerForm.set("metadata[supabase_email]", user.email);
    const customer = await stripeRequest("/customers", "POST", stripeKey, customerForm);
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId, updated_date: new Date().toISOString() })
      .eq("email", user.email);
  }

  // Trial-period decision tree.
  //   keeper_trial intent + tier=keeper + first-time = 30 days, mark used
  //   otherwise                                      = legacy 7-day trial
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

  const returnUrl = body.returnUrl || "https://geckinspect.com/Membership";
  const sessionForm = new URLSearchParams();
  sessionForm.set("mode", "subscription");
  sessionForm.set("customer", customerId!);
  sessionForm.set("line_items[0][price]", priceId);
  sessionForm.set("line_items[0][quantity]", "1");

  // Optional metered overage line. Attached when STRIPE_OVERAGE_PRICE_ID is
  // set so the report-social-overage cron has a subscription_item to post
  // usage records against. Metered prices do NOT take a quantity field on
  // line_items (the quantity is reported per-period via usage records).
  const overagePriceId = Deno.env.get("STRIPE_OVERAGE_PRICE_ID");
  if (overagePriceId) {
    sessionForm.set("line_items[1][price]", overagePriceId);
  }

  sessionForm.set("success_url", `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`);
  sessionForm.set("cancel_url", `${returnUrl}?checkout=cancelled`);
  sessionForm.set("subscription_data[trial_period_days]", String(trialDays));
  sessionForm.set("metadata[supabase_email]", user.email);
  sessionForm.set("metadata[tier]", tier);
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
      await supabase
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
