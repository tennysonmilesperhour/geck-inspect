// Supabase Edge Function: report-social-overage
//
// Monthly cron that reads each user's social_post_usage row, finds any
// overage_posts that haven't been reported to Stripe yet, and reports
// them via Stripe's metered usage API. The user's next invoice picks up
// the line.
//
// Schedule: configure via Supabase scheduled-functions. Recommended
// schedule is 02:00 UTC on the 1st of each month so it covers the prior
// month's usage. Manually invokable by passing { month_key: 'YYYY-MM' }
// in the body for backfills.
//
// What you must set up before this works:
//   1. Create a metered Stripe Product+Price for "Geck Inspect Posting
//      Overage" at $0.50 per unit, billing_scheme=per_unit, recurring
//      usage_type=metered.
//   2. Save the price ID as a secret on this function:
//        STRIPE_OVERAGE_PRICE_ID  price_...
//      ALSO store a corresponding subscription_item id per customer:
//      that's done at subscription creation time (modify stripe-checkout
//      to add the metered line to the line_items array, or add it to
//      every existing subscription via the Stripe Dashboard / API).
//   3. The user's profile must have stripe_subscription_id populated
//      (it already is, via the existing webhook).
//
// Required env vars:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   STRIPE_SECRET_KEY
//   STRIPE_OVERAGE_PRICE_ID    price of the metered overage line
//
// Callers: the monthly-overage-billing cron job (it sends the Vault secret
// notification_service_role_key), server code holding the service-role
// key, or a signed-in admin. JWT verification is off at the gateway
// because the cron's secret is not a JWT, so the check happens here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_OVERAGE_PRICE_ID = Deno.env.get("STRIPE_OVERAGE_PRICE_ID") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function stripeRequest(path: string, method: "GET" | "POST", form?: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

function priorMonthKey(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Before this check any signed-in member could report Stripe usage for a
// month of their choosing and read back other members' ids.
async function isAuthorizedCaller(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !SUPABASE_URL || !SERVICE_ROLE_KEY) return false;
  if (constantTimeEq(token, SERVICE_ROLE_KEY)) return true;
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: isCron } = await admin.rpc("verify_notification_dispatch_secret", { p_secret: token });
    if (isCron === true) return true;
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user?.email) return false;
    const { data: profile } = await admin.from("profiles")
      .select("role")
      .eq("email", user.email)
      .maybeSingle();
    return profile?.role === "admin";
  } catch (err) {
    console.warn("report-social-overage: caller check failed", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!(await isAuthorizedCaller(req))) return json({ error: "unauthorized" }, 401);
  if (!STRIPE_SECRET_KEY) return json({ error: "STRIPE_SECRET_KEY not set" }, 500);
  if (!STRIPE_OVERAGE_PRICE_ID) {
    return json({
      error: "STRIPE_OVERAGE_PRICE_ID not set",
      hint: "Create a metered Stripe Price at $0.50 / unit and set the secret",
    }, 500);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let body: { month_key?: string } = {};
  try { body = await req.json(); } catch { /* allow empty body for cron */ }
  const monthKey = body.month_key || priorMonthKey();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey)) {
    return json({ error: "month_key must look like YYYY-MM" }, 400);
  }

  const { data: rows, error: rowsErr } = await supabase
    .from("social_post_usage")
    .select("id, user_id, month_key, overage_posts, overage_cents, stripe_usage_record_id")
    .eq("month_key", monthKey)
    .gt("overage_posts", 0)
    .is("stripe_usage_record_id", null);
  if (rowsErr) return json({ error: "db_query_failed", detail: rowsErr.message }, 500);

  const results: Array<{ user_id: string; reported: boolean; reason?: string; usage_record_id?: string }> = [];

  for (const row of (rows || [])) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", row.user_id)
      .maybeSingle();

    if (!profile?.stripe_subscription_id) {
      results.push({ user_id: row.user_id, reported: false, reason: "no_subscription" });
      continue;
    }

    let subscriptionItemId: string | null = null;
    try {
      const sub = await stripeRequest(`/subscriptions/${profile.stripe_subscription_id}`, "GET");
      const items = sub?.items?.data || [];
      const meteredItem = items.find((it: { price?: { id?: string } }) =>
        it?.price?.id === STRIPE_OVERAGE_PRICE_ID,
      );
      subscriptionItemId = meteredItem?.id || null;
    } catch (err) {
      results.push({ user_id: row.user_id, reported: false, reason: `subscription_lookup_failed: ${(err as Error).message}` });
      continue;
    }

    if (!subscriptionItemId) {
      results.push({ user_id: row.user_id, reported: false, reason: "no_metered_item_on_subscription" });
      continue;
    }

    try {
      const form = new URLSearchParams();
      form.set("quantity", String(row.overage_posts));
      form.set("action", "set");
      const usageRec = await stripeRequest(
        `/subscription_items/${subscriptionItemId}/usage_records`,
        "POST",
        form,
      );
      await supabase
        .from("social_post_usage")
        .update({
          stripe_usage_record_id: usageRec.id,
          updated_date: new Date().toISOString(),
        })
        .eq("id", row.id);
      results.push({ user_id: row.user_id, reported: true, usage_record_id: usageRec.id });
    } catch (err) {
      results.push({ user_id: row.user_id, reported: false, reason: `report_failed: ${(err as Error).message}` });
    }
  }

  return json({
    ok: true,
    month_key: monthKey,
    processed: results.length,
    results,
  });
});
