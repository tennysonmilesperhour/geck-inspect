// Supabase Edge Function — store-checkout
//
// Builds a Stripe Checkout Session for the customer's cart and
// returns the redirect URL. Server-side re-prices every line so the
// client cannot tamper with totals; rejects the request if the cart
// holds any affiliate_redirect items (those should never reach the
// cart).
//
// Contract:
//   POST /store-checkout
//   Body (auth or guest):
//     {
//       cart_id?:        string,    // for authenticated users
//       session_token?:  string,    // for guests
//       success_url:     string,    // returned to after successful payment
//       cancel_url:      string,    // returned to if user backs out
//       customer_email?: string,    // pre-fill, optional
//     }
//   Response: { url: string, order_id: string, order_number: string }
//
// Secrets:
//   STRIPE_SECRET_KEY               sk_live_… or sk_test_…
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SITE_URL                        used to build absolute URLs in fallbacks
//
// Deploy:
//   supabase functions deploy store-checkout

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://geckinspect.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CartItemRow {
  id: string;
  quantity: number;
  unit_price_cents_snapshot: number;
  product: {
    id: string;
    slug: string;
    name: string;
    short_description: string | null;
    our_price_cents: number;
    images: Array<{ url: string; alt?: string; is_primary?: boolean }> | null;
    fulfillment_mode: string;
    pricing_constraint: string;
    map_floor_cents: number | null;
    vendor_id: string;
    vendor_extra: Record<string, unknown> | null;
    status: string;
    free_shipping_eligible: boolean;
    weight_grams: number | null;
    shipping_class: string;
  };
}

const CART_ELIGIBLE_MODES = new Set(["direct_self", "direct_pod", "dropship_wholesale"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callStripe<T = unknown>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    form.append(k, String(v));
  }
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed: ${json?.error?.message || res.status}`);
  }
  return json as T;
}

async function nextOrderNumber(supabase: ReturnType<typeof createClient>): Promise<string> {
  // GI-YYMMDD-<seq>; seq is count of today's orders + 1. Cheap, collision-rare
  // at our volume; we rely on the unique index on order_number to retry on
  // the unlikely race.
  const today = new Date();
  const yymmdd = `${String(today.getUTCFullYear()).slice(2)}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(today.getUTCDate()).padStart(2, "0")}`;
  const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
  const { count } = await supabase
    .from("store_orders")
    .select("id", { count: "exact", head: true })
    .gte("created_date", startOfDay);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  return `GI-${yymmdd}-${seq}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  if (!STRIPE_SECRET_KEY) return jsonResponse({ error: "stripe_not_configured" }, 500);

  let body: {
    cart_id?: string;
    session_token?: string;
    success_url?: string;
    cancel_url?: string;
    customer_email?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }

  const { cart_id, session_token, success_url, cancel_url, customer_email } = body;
  if (!cart_id && !session_token) return jsonResponse({ error: "cart_or_session_required" }, 400);
  if (!success_url || !cancel_url) return jsonResponse({ error: "redirect_urls_required" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Resolve the cart (server-side, bypassing RLS)
  let cart: { id: string; owner_user_id: string | null; session_token: string | null; status: string } | null = null;
  if (cart_id) {
    const { data } = await supabase.from("store_carts").select("*").eq("id", cart_id).maybeSingle();
    cart = data;
  } else if (session_token) {
    const { data } = await supabase
      .from("store_carts")
      .select("*")
      .eq("session_token", session_token)
      .eq("status", "open")
      .maybeSingle();
    cart = data;
  }
  if (!cart) return jsonResponse({ error: "cart_not_found" }, 404);
  if (cart.status !== "open") return jsonResponse({ error: "cart_not_open" }, 409);

  const { data: items, error: itemsErr } = await supabase
    .from("store_cart_items")
    .select(`
      id, quantity, unit_price_cents_snapshot,
      product:store_products (
        id, slug, name, short_description, our_price_cents, images,
        fulfillment_mode, pricing_constraint, map_floor_cents, vendor_id,
        vendor_extra, status, free_shipping_eligible, weight_grams, shipping_class
      )
    `)
    .eq("cart_id", cart.id);
  if (itemsErr) return jsonResponse({ error: itemsErr.message }, 500);
  const cartItems = (items as unknown as CartItemRow[]) || [];
  if (cartItems.length === 0) return jsonResponse({ error: "cart_empty" }, 400);

  // Validate every item is cart-eligible and active
  for (const it of cartItems) {
    if (!it.product) return jsonResponse({ error: `product_missing_for_item_${it.id}` }, 400);
    if (it.product.status !== "active") return jsonResponse({ error: `product_inactive_${it.product.slug}` }, 400);
    if (!CART_ELIGIBLE_MODES.has(it.product.fulfillment_mode)) {
      return jsonResponse({ error: `not_cart_eligible_${it.product.slug}` }, 400);
    }
    if (it.product.pricing_constraint === "map" && it.product.map_floor_cents != null) {
      if (it.product.our_price_cents < it.product.map_floor_cents) {
        return jsonResponse({ error: `map_violation_${it.product.slug}` }, 400);
      }
    }
  }

  // Re-price server-side; pull free-shipping threshold from app_settings
  const { data: thresholdRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "store_free_shipping_threshold_cents")
    .maybeSingle();
  const freeShippingThreshold = Number((thresholdRow?.value as number) ?? 5000);

  let subtotalCents = 0;
  for (const it of cartItems) {
    subtotalCents += Number(it.product.our_price_cents) * Number(it.quantity);
  }
  const shippingCents = subtotalCents >= freeShippingThreshold ? 0 : 800; // $8 flat else free over threshold

  // Mint an Order row in pending state. The webhook flips it to paid.
  const orderNumber = await nextOrderNumber(supabase);
  const { data: orderInsert, error: orderErr } = await supabase
    .from("store_orders")
    .insert({
      order_number: orderNumber,
      owner_user_id: cart.owner_user_id,
      customer_email: customer_email || "",
      status: "pending",
      subtotal_cents: subtotalCents,
      shipping_cents: shippingCents,
      total_cents: subtotalCents + shippingCents,
    })
    .select("id, order_number")
    .single();
  if (orderErr || !orderInsert) return jsonResponse({ error: orderErr?.message || "order_insert_failed" }, 500);

  // Stripe Checkout — flat-fee shipping line baked in as a separate line
  // item rather than via shipping_options, which keeps the math identical
  // to what we wrote into the order row.
  const params: Record<string, string | number | undefined> = {
    mode: "payment",
    success_url: `${success_url}?session_id={CHECKOUT_SESSION_ID}&order=${orderNumber}`,
    cancel_url,
    "automatic_tax[enabled]": "true",
    customer_creation: "if_required",
    "billing_address_collection": "required",
    "shipping_address_collection[allowed_countries][0]": "US",
    "metadata[order_id]": orderInsert.id,
    "metadata[order_number]": orderInsert.order_number,
    "metadata[cart_id]": cart.id,
  };
  if (customer_email) params["customer_email"] = customer_email;

  cartItems.forEach((it, i) => {
    const primary =
      (Array.isArray(it.product.images) && it.product.images.find((img) => img.is_primary)) ||
      (Array.isArray(it.product.images) && it.product.images[0]);
    params[`line_items[${i}][quantity]`] = it.quantity;
    params[`line_items[${i}][price_data][currency]`] = "usd";
    params[`line_items[${i}][price_data][unit_amount]`] = it.product.our_price_cents;
    params[`line_items[${i}][price_data][tax_behavior]`] = "exclusive";
    params[`line_items[${i}][price_data][product_data][name]`] = it.product.name.slice(0, 100);
    if (it.product.short_description) {
      params[`line_items[${i}][price_data][product_data][description]`] =
        String(it.product.short_description).slice(0, 200);
    }
    if (primary?.url) {
      params[`line_items[${i}][price_data][product_data][images][0]`] = primary.url;
    }
    params[`line_items[${i}][price_data][product_data][metadata][product_id]`] = it.product.id;
    params[`line_items[${i}][price_data][product_data][metadata][cart_item_id]`] = it.id;
  });

  if (shippingCents > 0) {
    const idx = cartItems.length;
    params[`line_items[${idx}][quantity]`] = 1;
    params[`line_items[${idx}][price_data][currency]`] = "usd";
    params[`line_items[${idx}][price_data][unit_amount]`] = shippingCents;
    params[`line_items[${idx}][price_data][tax_behavior]`] = "exclusive";
    params[`line_items[${idx}][price_data][product_data][name]`] = "Shipping";
  }

  let session: { id: string; url: string };
  try {
    session = await callStripe<{ id: string; url: string }>("checkout/sessions", params);
  } catch (e) {
    await supabase
      .from("store_orders")
      .update({ status: "cancelled", notes: `stripe_create_failed: ${(e as Error).message}` })
      .eq("id", orderInsert.id);
    return jsonResponse({ error: (e as Error).message }, 500);
  }

  await supabase
    .from("store_orders")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", orderInsert.id);

  return jsonResponse({ url: session.url, order_id: orderInsert.id, order_number: orderInsert.order_number });
});
