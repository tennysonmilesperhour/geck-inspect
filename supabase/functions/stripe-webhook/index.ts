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
// with these events: checkout.session.completed,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted, invoice.paid,
// invoice.payment_succeeded, invoice.payment_failed.
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

function priceIdToTier(priceId: string | null | undefined): string | null {
  return priceIdToPlan(priceId)?.tier || null;
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
      .select("id, email")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data || null;
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
          const cycle = session.metadata?.billing_cycle || null;
          const isKeeperPromoTrial = session.metadata?.keeper_promo_trial === "1";
          const isStandardTrial = session.metadata?.free_trial === "1";
          await upsertProfileByEmail(email, {
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_status: "active",
            ...(tier ? { membership_tier: tier } : {}),
            ...(cycle ? { membership_billing_cycle: cycle } : {}),
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
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const profile = await findProfileFromCustomer(sub.customer);
        if (profile?.email) {
          const priceId = sub.items?.data?.[0]?.price?.id;
          const plan = priceIdToPlan(priceId);
          const cycle = plan?.cycle || sub.metadata?.billing_cycle || null;
          // Stripe API versions from 2025-03 moved current_period_end from
          // the subscription to each subscription item.
          const periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;
          await upsertProfileByEmail(profile.email, {
            stripe_subscription_id: sub.id,
            subscription_status: sub.status,
            ...(plan ? { membership_tier: plan.tier } : {}),
            ...(cycle ? { membership_billing_cycle: cycle } : {}),
            membership_expires_at: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
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
            membership_billing_cycle: null,
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
        // Referral reward. award_referral_reward() hands out exactly one
        // reward per referred member and returns null for members nobody
        // referred, so it is safe to call on every paid invoice. It is not
        // limited to billing_reason=subscription_create because a member
        // who took the explicit trial pays their first real invoice on the
        // first renewal.
        if ((inv.amount_paid || 0) > 0) {
          const profile = await findProfileFromCustomer(inv.customer);
          if (profile?.email && event.livemode === true) {
            const { error: receiptError } = await supabase.from("payment_events").upsert({
              id: `stripe-invoice:${inv.id}`, user_email: profile.email,
              stripe_event_id: event.id, stripe_invoice_id: inv.id,
              stripe_customer_id: inv.customer, stripe_subscription_id: inv.subscription || null,
              event_type: "invoice.paid", status: "paid", amount_cents: inv.amount_paid,
              currency: inv.currency, membership_tier: profile.membership_tier,
              event_timestamp: new Date(event.created * 1000).toISOString(),
            }, { onConflict: "id" });
            if (receiptError) throw receiptError;
          }
          if (profile?.email) {
            const priceId = inv.lines?.data?.[0]?.price?.id || inv.lines?.data?.[0]?.pricing?.price_details?.price;
            const tier = priceIdToTier(priceId) || "keeper";
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
            }
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
