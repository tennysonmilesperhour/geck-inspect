/**
 * Cart client utilities.
 *
 * Cart state is persisted in Postgres (store_carts + store_cart_items)
 * with RLS for authenticated users. Guests use a session_token stored
 * in localStorage; the upcoming `store-cart` edge function handles
 * guest-cart reads/writes server-side using the service role.
 *
 * For Phase 1, authenticated users hit Postgres directly via the
 * supabase client; guest users stage their cart locally and the
 * edge function takes over at checkout. This keeps Phase 1 small
 * without compromising the eventual unified flow.
 */

import { supabase } from '@/lib/supabaseClient';

const SESSION_KEY = 'gi_store_session_token';
const GUEST_CART_KEY = 'gi_store_guest_cart_v1';

export function getSessionToken() {
  if (typeof window === 'undefined') return null;
  let t = window.localStorage.getItem(SESSION_KEY);
  if (!t) {
    t = (crypto?.randomUUID?.() || `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    window.localStorage.setItem(SESSION_KEY, t);
  }
  return t;
}

export function clearGuestCart() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GUEST_CART_KEY);
}

function readGuestCart() {
  if (typeof window === 'undefined') return { items: [] };
  try {
    const raw = window.localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return { items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

function writeGuestCart(cart) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
}

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
}

async function ensureUserCart(userId) {
  const { data: existing } = await supabase
    .from('store_carts')
    .select('*')
    .eq('owner_user_id', userId)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabase
    .from('store_carts')
    .insert({ owner_user_id: userId, status: 'open' })
    .select('*')
    .single();
  if (error) throw error;
  return created;
}

export async function fetchCart() {
  const user = await getCurrentUser();
  if (user) {
    const cart = await ensureUserCart(user.id);
    const { data: items, error } = await supabase
      .from('store_cart_items')
      .select(`
        id, quantity, unit_price_cents_snapshot, created_date, product_id,
        product:store_products (
          id, slug, name, short_description, our_price_cents, images,
          fulfillment_mode, vendor_id, status, free_shipping_eligible
        )
      `)
      .eq('cart_id', cart.id)
      .order('created_date', { ascending: true });
    if (error) throw error;
    return { mode: 'user', cart, items: items || [] };
  }
  // Guest cart from localStorage. Items are stored as
  //   { product_id, quantity, unit_price_cents_snapshot, product:{...} }
  const guest = readGuestCart();
  return { mode: 'guest', cart: { id: null, session_token: getSessionToken() }, items: guest.items };
}

export async function addToCart(product, quantity = 1) {
  if (!product || !product.id) throw new Error('addToCart: product required');
  const user = await getCurrentUser();
  const unitPrice = product.our_price_cents ?? 0;
  if (user) {
    const cart = await ensureUserCart(user.id);
    const { data: existing } = await supabase
      .from('store_cart_items')
      .select('*')
      .eq('cart_id', cart.id)
      .eq('product_id', product.id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from('store_cart_items')
        .update({ quantity: existing.quantity + quantity, updated_date: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('store_cart_items')
        .insert({
          cart_id: cart.id,
          product_id: product.id,
          quantity,
          unit_price_cents_snapshot: unitPrice,
        });
      if (error) throw error;
    }
    return;
  }
  // Guest path
  const guest = readGuestCart();
  const idx = guest.items.findIndex((i) => i.product_id === product.id);
  if (idx >= 0) {
    guest.items[idx].quantity += quantity;
  } else {
    guest.items.push({
      product_id: product.id,
      quantity,
      unit_price_cents_snapshot: unitPrice,
      product,
    });
  }
  writeGuestCart(guest);
}

export async function updateCartItemQuantity(itemId, productId, quantity) {
  const user = await getCurrentUser();
  if (quantity <= 0) return removeFromCart(itemId, productId);
  if (user) {
    const { error } = await supabase
      .from('store_cart_items')
      .update({ quantity, updated_date: new Date().toISOString() })
      .eq('id', itemId);
    if (error) throw error;
    return;
  }
  const guest = readGuestCart();
  const idx = guest.items.findIndex((i) => i.product_id === productId);
  if (idx >= 0) {
    guest.items[idx].quantity = quantity;
    writeGuestCart(guest);
  }
}

export async function removeFromCart(itemId, productId) {
  const user = await getCurrentUser();
  if (user) {
    const { error } = await supabase
      .from('store_cart_items')
      .delete()
      .eq('id', itemId);
    if (error) throw error;
    return;
  }
  const guest = readGuestCart();
  const next = guest.items.filter((i) => i.product_id !== productId);
  writeGuestCart({ ...guest, items: next });
}

export function cartSubtotalCents(items) {
  return (items || []).reduce(
    (sum, i) =>
      sum + Number(i.unit_price_cents_snapshot ?? i.product?.our_price_cents ?? 0) * (i.quantity || 0),
    0
  );
}

export function cartItemCount(items) {
  return (items || []).reduce((n, i) => n + (i.quantity || 0), 0);
}
