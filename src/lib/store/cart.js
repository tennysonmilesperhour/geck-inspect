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

function newLineId() {
  return crypto?.randomUUID?.() || `l-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Stable identity for a guest cart line. Lines added before customized
 * lines existed have no line_id, so they still fall back to product_id.
 */
function guestLineKey(item) {
  return item?.line_id || item?.product_id;
}

/**
 * Identity a component passes back to updateCartItemQuantity/removeFromCart.
 * Postgres-backed lines use their row id; guest lines use their line key.
 */
export function cartLineKey(item) {
  return item?.line_id || item?.product_id;
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
        id, quantity, unit_price_cents_snapshot, created_date, product_id, customization,
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

/**
 * Add a product to the cart.
 *
 * `customization` is an optional per-line payload (a custom sticker
 * design, for example). Customized lines never merge with an existing
 * line: two stickers of two different geckos are two separate lines even
 * though they share a catalog product. Plain catalog lines still merge by
 * product as before.
 */
export async function addToCart(product, quantity = 1, customization = null) {
  if (!product || !product.id) throw new Error('addToCart: product required');
  const user = await getCurrentUser();
  const unitPrice = product.our_price_cents ?? 0;
  if (user) {
    const cart = await ensureUserCart(user.id);
    if (!customization) {
      const { data: existing } = await supabase
        .from('store_cart_items')
        .select('*')
        .eq('cart_id', cart.id)
        .eq('product_id', product.id)
        .is('customization', null)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('store_cart_items')
          .update({ quantity: existing.quantity + quantity, updated_date: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }
    }
    const { error } = await supabase
      .from('store_cart_items')
      .insert({
        cart_id: cart.id,
        product_id: product.id,
        quantity,
        unit_price_cents_snapshot: unitPrice,
        customization,
      });
    if (error) throw error;
    return;
  }
  // Guest path
  const guest = readGuestCart();
  if (!customization) {
    const idx = guest.items.findIndex((i) => i.product_id === product.id && !i.customization);
    if (idx >= 0) {
      guest.items[idx].quantity += quantity;
      writeGuestCart(guest);
      return;
    }
  }
  guest.items.push({
    line_id: newLineId(),
    product_id: product.id,
    quantity,
    unit_price_cents_snapshot: unitPrice,
    customization,
    product,
  });
  writeGuestCart(guest);
}

export async function updateCartItemQuantity(itemId, lineKey, quantity) {
  const user = await getCurrentUser();
  if (quantity <= 0) return removeFromCart(itemId, lineKey);
  if (user) {
    const { error } = await supabase
      .from('store_cart_items')
      .update({ quantity, updated_date: new Date().toISOString() })
      .eq('id', itemId);
    if (error) throw error;
    return;
  }
  const guest = readGuestCart();
  const idx = guest.items.findIndex((i) => guestLineKey(i) === lineKey);
  if (idx >= 0) {
    guest.items[idx].quantity = quantity;
    writeGuestCart(guest);
  }
}

export async function removeFromCart(itemId, lineKey) {
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
  const next = guest.items.filter((i) => guestLineKey(i) !== lineKey);
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
