// Supabase Edge Function: stripe-webhook
//
// Stripe posts subscription lifecycle events here. We verify the
// signature and mirror the relevant state into the `profiles` table.
// On the first paid invoice we also fire the referral signup bonus
// (separate from the lifetime 10% revenue share).
//
// Required env vars:
//   STRIPE_SECRET_KEY          sk_live_... / sk_test_...
//   STRIPE_WEBHOOK_SECRET      whsec_... (from the Stripe dashboard endpoint)
//   STRIPE_KEEPER_PRICE_ID     price_... (used to map price_id -> tier)
//   STRIPE_BREEDER_PRICE_ID    price_...
//   STRIPE_ENTERPRISE_PRICE_ID price_...
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (available automatically)
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

function priceIdToTier(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get("STRIPE_KEEPER_PRICE_ID")) return "keeper";
  if (priceId === Deno.env.get("STRIPE_BREEDER_PRICE_ID")) return "breeder";
  if (priceId === Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID")) return "enterprise";
  return null;
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

  await supabase.from("stripe_webhook_logs").insert({
    event_type: event.type,
    payload: event,
    created_date: new Date().toISOString(),
  }).throwOnError().then(() => {}, (err) => {
    console.warn("Failed to log webhook event:", err.message);
  });

  const findProfileFromCustomer = async (customerId: string | null) => {
    if (!customerId) return null;
    const { data } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data || null;
  };

  const upsertProfileByEmail = async (
    email: string,
    patch: Record<string, unknown>,
  ) => {
    const { error } = await supabase
      .from("profiles")
      .update({ ...patch, updated_date: new Date().toISOString() })
      .eq("email", email);
    if (error) console.warn("profile update failed:", error.message);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const profile = session.customer
          ? await findProfileFromCustomer(session.customer)
          : null;
        const email =
          session.metadata?.supabase_email ||
          session.customer_details?.email ||
          profile?.email ||
          null;
        if (email) {
          const tier = session.metadata?.tier || null;
          const isKeeperPromoTrial = session.metadata?.keeper_promo_trial === "1";
          await upsertProfileByEmail(email, {
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_status: "active",
            ...(tier ? { membership_tier: tier } : {}),
            ...(isKeeperPromoTrial
              ? { keeper_trial_used: true, keeper_trial_started_at: new Date().toISOString() }
              : {}),
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const profile = await findProfileFromCustomer(sub.customer);
        if (profile?.email) {
          const priceId = sub.items?.data?.[0]?.price?.id;
          const tier = priceIdToTier(priceId);
          await upsertProfileByEmail(profile.email, {
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            ...(tier ? { membership_tier: tier } : {}),
            membership_expires_at: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const profile = await findProfileFromCustomer(sub.customer);
        if (profile?.email) {
          await upsertProfileByEmail(profile.email, {
            subscription_status: "canceled",
            membership_tier: "free",
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object;
        const profile = await findProfileFromCustomer(inv.customer);
        if (profile?.email) {
          await upsertProfileByEmail(profile.email, {
            subscription_status: "past_due",
          });
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const inv = event.data.object;
        const billingReason = inv.billing_reason || "";
        const isFirstPaidInvoice = billingReason === "subscription_create";
        if (isFirstPaidInvoice && (inv.amount_paid || 0) > 0) {
          const profile = await findProfileFromCustomer(inv.customer);
          if (profile?.id && profile.email) {
            const priceId = inv.lines?.data?.[0]?.price?.id || inv.lines?.data?.[0]?.pricing?.price_details?.price;
            const tier = priceIdToTier(priceId) || "keeper";
            try {
              await supabase.rpc("award_referral_signup_bonus", {
                p_referred_user_id: profile.id,
                p_referred_email: profile.email,
                p_referred_tier: tier,
                p_stripe_invoice_id: inv.id,
              });
            } catch (err) {
              console.warn("award_referral_signup_bonus failed:", (err as Error).message);
            }
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler crash:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }

  return jsonResponse({ received: true });
});
