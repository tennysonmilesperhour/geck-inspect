// Supabase Edge Function — store-stripe-webhook
//
// Receives Stripe events for store checkout sessions, marks orders paid,
// expands order items from the cart snapshot, mints the guest signup
// grant if eligible, and triggers fulfillment routing per item.
//
// Idempotent on stripe_event_id; safe to receive duplicates.
//
// Deploy:
//   supabase functions deploy store-stripe-webhook --no-verify-jwt
//
// Stripe dashboard: configure webhook with the events
//   checkout.session.completed
//   checkout.session.async_payment_succeeded
//   checkout.session.async_payment_failed
//   charge.refunded
//
// Secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET   whsec_…  (the per-endpoint secret)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const enc = new TextEncoder();

// Constant-time string compare for HMAC.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Stripe-Signature: t=<unix>,v1=<hex>,v1=<hex>...
async function verifyStripeSignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  );
  const t = parts["t"];
  const sigs = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || sigs.length === 0) return false;
  // 5-minute tolerance
  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  return sigs.some((s) => timingSafeEqual(s, expected));
}

async function callStripe<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`stripe_${path}: ${json?.error?.message || res.status}`);
  return json as T;
}

function randomToken(byteCount = 24): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hashPostal(country: string | null | undefined, postal: string | null | undefined): Promise<string | null> {
  const c = (country || "").toUpperCase();
  const p = (postal || "").toUpperCase().replace(/\s+/g, "");
  if (!c || !p) return null;
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(`${c}|${p}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature");
  const ok = await verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("bad_signature", { status: 400 });

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("invalid_json", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Idempotency — leverage existing stripe_webhook_logs table if present;
  // soft-fail if it isn't.
  try {
    const { data: existing } = await supabase
      .from("stripe_webhook_logs")
      .select("id")
      .eq("stripe_event_id", event.id)
      .maybeSingle();
    if (existing) return new Response("already_processed", { status: 200 });
  } catch {
    // table might not exist in this branch — ignore
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Record<string, unknown>;
    const orderId = (session.metadata as Record<string, string> | null)?.order_id;
    const cartId = (session.metadata as Record<string, string> | null)?.cart_id;
    if (!orderId) return new Response("no_order_id", { status: 200 });

    // Pull line items so we know what to write to store_order_items.
    let cartItems: Array<{
      id: string;
      quantity: number;
      unit_price_cents_snapshot: number;
      product: {
        id: string;
        name: string;
        vendor_id: string;
        vendor_sku: string | null;
        vendor_extra: Record<string, unknown> | null;
        fulfillment_mode: string;
      } | null;
    }> = [];
    if (cartId) {
      const { data } = await supabase
        .from("store_cart_items")
        .select(`
          id, quantity, unit_price_cents_snapshot,
          product:store_products ( id, name, vendor_id, vendor_sku, vendor_extra, fulfillment_mode )
        `)
        .eq("cart_id", cartId);
      cartItems = (data as typeof cartItems) || [];
    }

    const customerDetails = session.customer_details as
      | { email?: string; name?: string; address?: { country?: string; postal_code?: string; line1?: string; line2?: string; city?: string; state?: string } }
      | null;
    const shipping = (session.shipping_details as
      | { address?: { country?: string; postal_code?: string; line1?: string; line2?: string; city?: string; state?: string }; name?: string }
      | null) || null;

    const totalCents = Number(session.amount_total ?? 0);
    const subtotalCents = Number(session.amount_subtotal ?? totalCents);
    const taxCents = Number(((session as { total_details?: { amount_tax?: number } }).total_details?.amount_tax) ?? 0);
    const shippingCents = Number(((session as { total_details?: { amount_shipping?: number } }).total_details?.amount_shipping) ?? 0);

    const updatePayload: Record<string, unknown> = {
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent as string | null,
      stripe_customer_id: session.customer as string | null,
      customer_email: customerDetails?.email || (session.customer_email as string | null) || "",
      customer_name: customerDetails?.name || shipping?.name || null,
      subtotal_cents: subtotalCents,
      tax_cents: taxCents,
      shipping_cents: shippingCents,
      total_cents: totalCents,
      ship_to: shipping?.address ? { ...shipping.address, name: shipping.name } : null,
    };
    await supabase.from("store_orders").update(updatePayload).eq("id", orderId);

    // Fan out cart items into store_order_items snapshots
    if (cartItems.length > 0) {
      const rows = cartItems
        .filter((ci) => ci.product)
        .map((ci) => ({
          order_id: orderId,
          product_id: ci.product!.id,
          vendor_id: ci.product!.vendor_id,
          fulfillment_mode: ci.product!.fulfillment_mode,
          product_name_snapshot: ci.product!.name,
          vendor_sku_snapshot: ci.product!.vendor_sku,
          quantity: ci.quantity,
          unit_price_cents: ci.unit_price_cents_snapshot,
          line_total_cents: Number(ci.unit_price_cents_snapshot) * Number(ci.quantity),
          vendor_extra_snapshot: ci.product!.vendor_extra,
        }));
      if (rows.length > 0) await supabase.from("store_order_items").insert(rows);

      // Convert the cart so it doesn't get reused.
      await supabase
        .from("store_carts")
        .update({ status: "converted", updated_date: new Date().toISOString() })
        .eq("id", cartId);
    }

    // Guest signup grant — only when there's no owner_user_id on the order
    // and the subtotal clears the threshold.
    try {
      const { data: order } = await supabase
        .from("store_orders")
        .select("id, owner_user_id, customer_email, subtotal_cents, ship_to")
        .eq("id", orderId)
        .maybeSingle();
      if (order && !order.owner_user_id && order.customer_email) {
        const { data: settings } = await supabase
          .from("app_settings")
          .select("key, value")
          .in("key", [
            "store_signup_grant_min_order_cents",
            "store_signup_grant_duration_days",
            "store_signup_grant_tier",
          ]);
        const cfg = Object.fromEntries((settings || []).map((r) => [r.key, r.value]));
        const minCents = Number(cfg.store_signup_grant_min_order_cents ?? 1000);
        const durationDays = Number(cfg.store_signup_grant_duration_days ?? 90);
        const tier = String(cfg.store_signup_grant_tier ?? "keeper");
        if (Number(order.subtotal_cents) >= minCents) {
          // De-dupe: one active grant per email
          const { data: existingGrant } = await supabase
            .from("store_signup_grants")
            .select("id")
            .eq("granted_email", order.customer_email)
            .is("redeemed_at", null)
            .is("voided_at", null)
            .gt("expires_at", new Date().toISOString())
            .maybeSingle();
          if (!existingGrant) {
            const shipTo = order.ship_to as { country?: string; postal_code?: string } | null;
            const postalHash = await hashPostal(shipTo?.country, shipTo?.postal_code);
            const expires = new Date();
            expires.setUTCDate(expires.getUTCDate() + durationDays);
            const token = randomToken(24);
            const { data: grant } = await supabase
              .from("store_signup_grants")
              .insert({
                token,
                source_order_id: order.id,
                granted_email: order.customer_email,
                granted_tier: tier,
                granted_duration_days: durationDays,
                ship_to_postal_hash: postalHash,
                expires_at: expires.toISOString(),
              })
              .select("id")
              .single();
            if (grant) {
              await supabase
                .from("store_orders")
                .update({ signup_grant_id: grant.id })
                .eq("id", order.id);
            }
          }
        }
      }
    } catch (e) {
      console.warn("signup grant issuance failed", e);
    }
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Record<string, unknown>;
    const pi = charge.payment_intent as string | null;
    if (pi) {
      const { data: order } = await supabase
        .from("store_orders")
        .select("id, total_cents")
        .eq("stripe_payment_intent_id", pi)
        .maybeSingle();
      if (order) {
        const refunded = Number((charge as { amount_refunded?: number }).amount_refunded ?? 0);
        const newStatus = refunded >= Number(order.total_cents) ? "refunded" : "partial_refund";
        await supabase.from("store_orders").update({ status: newStatus }).eq("id", order.id);
      }
    }
  }

  // Best-effort idempotency log.
  try {
    await supabase.from("stripe_webhook_logs").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
    });
  } catch {
    // table may not exist; ignore.
  }

  return new Response("ok", { status: 200 });
});
