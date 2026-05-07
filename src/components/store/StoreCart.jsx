import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, Sparkles } from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';
import Seo from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import {
  fetchCart,
  updateCartItemQuantity,
  removeFromCart,
  cartSubtotalCents,
  getSessionToken,
} from '@/lib/store/cart';
import { formatCents } from '@/lib/store/format';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { captureEvent } from '@/lib/posthog';

export default function StoreCart() {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState({
    free_shipping_threshold_cents: 5000,
    loyalty_min_cart_cents: 4000,
    loyalty_min_tenure_days: 60,
    signup_grant_min_order_cents: 1000,
    signup_grant_duration_days: 90,
    loyalty_samples_enabled: false,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const c = await fetchCart();
      setItems(c.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', [
            'store_free_shipping_threshold_cents',
            'store_loyalty_cgd_min_cart_cents',
            'store_loyalty_cgd_min_tenure_days',
            'store_signup_grant_min_order_cents',
            'store_signup_grant_duration_days',
            'store_loyalty_samples_enabled',
          ]);
        if (cancelled || !data) return;
        const map = Object.fromEntries(data.map((r) => [r.key, r.value]));
        setSettings({
          free_shipping_threshold_cents: Number(map.store_free_shipping_threshold_cents ?? 5000),
          loyalty_min_cart_cents: Number(map.store_loyalty_cgd_min_cart_cents ?? 4000),
          loyalty_min_tenure_days: Number(map.store_loyalty_cgd_min_tenure_days ?? 60),
          signup_grant_min_order_cents: Number(map.store_signup_grant_min_order_cents ?? 1000),
          signup_grant_duration_days: Number(map.store_signup_grant_duration_days ?? 90),
          loyalty_samples_enabled: Boolean(map.store_loyalty_samples_enabled ?? false),
        });
      } catch (e) {
        console.warn('cart settings load failed', e);
      }
    }
    loadSettings();
    return () => { cancelled = true; };
  }, []);

  async function handleQty(item, q) {
    setBusy(true);
    try {
      await updateCartItemQuantity(item.id, item.product_id, q);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(item) {
    setBusy(true);
    try {
      await removeFromCart(item.id, item.product_id);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckout() {
    setBusy(true);
    try {
      captureEvent('store_checkout_started', {
        item_count: items.length,
        subtotal_cents: cartSubtotalCents(items),
      });
      const cart = await fetchCart();
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const body = {
        success_url: `${origin}/Store/checkout/success`,
        cancel_url: `${origin}/Store/cart`,
      };
      if (cart.mode === 'user' && cart.cart?.id) {
        body.cart_id = cart.cart.id;
        if (user?.email) body.customer_email = user.email;
      } else {
        body.session_token = getSessionToken();
      }
      const { data, error } = await supabase.functions.invoke('store-checkout', { body });
      if (error || !data?.url) {
        const msg = error?.message || data?.error || 'checkout_unavailable';
        if (msg === 'stripe_not_configured') {
          alert(
            'Checkout requires Stripe credentials to be configured on the server. ' +
            'Once STRIPE_SECRET_KEY is set on the store-checkout edge function, this button will work.'
          );
        } else {
          alert(`Checkout error: ${msg}`);
        }
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      console.error('checkout failed', e);
      alert(`Checkout error: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  const subtotal = cartSubtotalCents(items);
  const remainingForFreeShipping = Math.max(0, settings.free_shipping_threshold_cents - subtotal);

  // Loyalty perk eligibility — paid subscriber, tenure check is server-side
  // at order time; here we surface the cart-side dollar threshold only.
  const loyaltyTier = user?.membership_tier;
  const isPaidTier = loyaltyTier && loyaltyTier !== 'free';
  const remainingForLoyalty = Math.max(0, settings.loyalty_min_cart_cents - subtotal);

  // Signup-grant preview for guests — see CLAUDE.md / proposal: the receipt
  // includes a 3-month Keeper trial for guest checkouts above the min order.
  const remainingForGrant = Math.max(0, settings.signup_grant_min_order_cents - subtotal);

  return (
    <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Cart' }]}>
      <Seo
        title="Cart — Geck Inspect Supplies"
        description="Review your Geck Inspect cart and check out."
        path="/Store/cart"
        noIndex
      />
      <h1 className="text-2xl font-bold text-slate-100 mb-4">Your cart</h1>

      {loading ? (
        <div className="h-40 flex items-center justify-center text-slate-500 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 p-10 text-center">
          <ShoppingBag className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h2 className="text-base font-semibold text-slate-200">Your cart is empty.</h2>
          <p className="text-sm text-slate-400 mt-1">Find something you like.</p>
          <Link to="/Store" className="inline-block mt-4">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">Shop Supplies</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-3">
            {items.map((item) => {
              const p = item.product;
              const primary =
                (Array.isArray(p?.images) && p.images.find((i) => i.is_primary)) ||
                (Array.isArray(p?.images) && p.images[0]);
              return (
                <div
                  key={item.id || item.product_id}
                  className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                >
                  <Link
                    to={`/Store/p/${p?.slug}`}
                    className="w-20 h-20 shrink-0 rounded overflow-hidden bg-slate-950"
                  >
                    {primary ? (
                      <img src={primary.url} alt={primary.alt || p?.name} className="w-full h-full object-cover" />
                    ) : null}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/Store/p/${p?.slug}`} className="text-sm font-semibold text-slate-100 hover:text-emerald-200">
                      {p?.name}
                    </Link>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatCents(item.unit_price_cents_snapshot ?? p?.our_price_cents)} each
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleQty(item, item.quantity - 1)}>
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <span className="w-7 text-center text-sm text-slate-200">{item.quantity}</span>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleQty(item, item.quantity + 1)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-300 hover:bg-rose-500/10 ml-auto"
                        disabled={busy}
                        onClick={() => handleRemove(item)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-emerald-200">
                      {formatCents((item.unit_price_cents_snapshot ?? p?.our_price_cents ?? 0) * item.quantity)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 h-max sticky top-20">
            <h2 className="text-sm font-bold text-slate-200">Summary</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="text-slate-200">{formatCents(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping</span>
                <span className="text-slate-500 italic">Calculated at checkout</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tax</span>
                <span className="text-slate-500 italic">Calculated at checkout</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {remainingForFreeShipping > 0 ? (
                <div className="text-xs rounded border border-slate-700 bg-slate-950 px-2.5 py-2 text-slate-300">
                  Add <strong className="text-emerald-300">{formatCents(remainingForFreeShipping)}</strong> for free shipping.
                </div>
              ) : (
                <div className="text-xs rounded border border-emerald-700/40 bg-emerald-500/10 px-2.5 py-2 text-emerald-200">
                  ✓ Free shipping unlocked.
                </div>
              )}

              {!isAuthenticated && remainingForGrant > 0 && (
                <div className="text-xs rounded border border-slate-700 bg-slate-950 px-2.5 py-2 text-slate-300">
                  Spend <strong className="text-emerald-300">{formatCents(remainingForGrant)}</strong> more
                  and your receipt includes a free {settings.signup_grant_duration_days}-day Keeper
                  membership when you create an account.
                </div>
              )}
              {!isAuthenticated && remainingForGrant === 0 && (
                <div className="text-xs rounded border border-emerald-700/40 bg-emerald-500/10 px-2.5 py-2 text-emerald-200">
                  ✓ Your receipt will include a free {settings.signup_grant_duration_days}-day Keeper membership.
                </div>
              )}

              {isAuthenticated && isPaidTier && (
                <div
                  className={`text-xs rounded border px-2.5 py-2 ${
                    remainingForLoyalty > 0
                      ? 'border-slate-700 bg-slate-950 text-slate-300'
                      : settings.loyalty_samples_enabled
                        ? 'border-emerald-700/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-700/40 bg-amber-500/10 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    Member perk
                  </div>
                  {remainingForLoyalty > 0 ? (
                    <div className="mt-1">
                      Spend {formatCents(remainingForLoyalty)} more and we'll tuck a free CGD sample
                      into your shipment (subscribers, {settings.loyalty_min_tenure_days}-day tenure).
                    </div>
                  ) : settings.loyalty_samples_enabled ? (
                    <div className="mt-1">✓ Free CGD sample qualifying.</div>
                  ) : (
                    <div className="mt-1">✓ Threshold met. Free CGD sample is rolling out soon.</div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 my-4" />

            <div className="flex justify-between text-base font-bold">
              <span className="text-slate-200">Estimated total</span>
              <span className="text-emerald-200">{formatCents(subtotal)}</span>
            </div>

            <Button
              disabled={busy || items.length === 0}
              onClick={handleCheckout}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {busy ? 'Working…' : 'Continue to checkout'}
            </Button>
            <p className="text-[11px] text-slate-500 mt-2 text-center">
              Stripe-hosted checkout · Apple Pay · Google Pay · Cards
            </p>
          </aside>
        </div>
      )}
    </StoreLayout>
  );
}
