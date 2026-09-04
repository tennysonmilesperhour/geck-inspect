// Supabase Edge Function: stripe-billing-portal
//
// Opens a Stripe Customer Portal session for the signed-in user and
// returns its URL. The portal is where members update their card,
// switch plans, download invoices, and cancel. Without it, "cancel
// anytime" on the pricing page has no button behind it.
//
// Flow:
//   1. Browser calls this with the user's Supabase session token.
//   2. We look up profiles.stripe_customer_id for that email.
//   3. We ask Stripe for a portal session tied to that customer and
//      send the browser its one-time URL.
//
// Required env vars (already set for stripe-checkout):
//   STRIPE_SECRET_KEY   sk_live_... or sk_test_...
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (available automatically)
//
// One-time Stripe dashboard setup: Settings, Billing, Customer portal
// must be activated (Stripe returns "No configuration provided" until
// it is). Turn on "Cancel subscriptions" and "Update payment method"
// there. Plan switching is optional.
//
// Body shape: { returnUrl?: string }
// Response:   { url: string } or { error: string, message?: string }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_RETURN_URL = "https://geckinspect.com/Membership";

// Only send members back to our own site after the portal. An attacker
// who could pick the return URL would have a Stripe-hosted page that
// bounces to anywhere they like.
const ALLOWED_RETURN_PREFIXES = [
  "https://geckinspect.com/",
  "https://www.geckinspect.com/",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function safeReturnUrl(candidate: unknown): string {
  if (typeof candidate !== "string") return DEFAULT_RETURN_URL;
  const ok = ALLOWED_RETURN_PREFIXES.some((p) => candidate.startsWith(p));
  return ok ? candidate : DEFAULT_RETURN_URL;
}

async function stripeRequest(
  path: string,
  apiKey: string,
  form: URLSearchParams,
) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
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

  let body: { returnUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthenticated" }, 401);
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
    return jsonResponse({ error: "unauthenticated" }, 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, subscription_status, membership_billing_cycle")
    .eq("email", user.email)
    .maybeSingle();

  if (profile?.subscription_status === "grandfathered") {
    return jsonResponse(
      {
        error: "grandfathered",
        message: "This account is grandfathered into Breeder. There is no subscription to manage.",
      },
      400,
    );
  }
  if (profile?.membership_billing_cycle === "lifetime") {
    return jsonResponse(
      {
        error: "lifetime",
        message: "Lifetime access has no recurring billing to manage.",
      },
      400,
    );
  }
  if (!profile?.stripe_customer_id) {
    return jsonResponse(
      {
        error: "no_billing_account",
        message: "No billing record yet. Start a paid plan first and this button will open your Stripe billing portal.",
      },
      404,
    );
  }

  try {
    const form = new URLSearchParams();
    form.set("customer", profile.stripe_customer_id);
    form.set("return_url", safeReturnUrl(body.returnUrl));
    const session = await stripeRequest("/billing_portal/sessions", stripeKey, form);
    if (!session?.url) {
      return jsonResponse({ error: "portal_unavailable" }, 502);
    }
    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("stripe-billing-portal failed:", (err as Error).message);
    return jsonResponse(
      {
        error: "portal_unavailable",
        message: "Stripe could not open the billing portal. Email support and we will sort it out by hand.",
      },
      502,
    );
  }
});
