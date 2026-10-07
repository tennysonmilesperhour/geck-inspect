import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Minus, Plus, ShoppingBag, Sparkles } from 'lucide-react';
import StoreLayout from '@/components/store/StoreLayout';
import Seo from '@/components/seo/Seo';
import FoodRunoutWidget from '@/components/store/FoodRunoutWidget';
import { Button } from '@/components/ui/button';
import {
  fetchCart,
  updateCartItemQuantity,
  updateStickerFinish,
  removeFromCart,
  cartSubtotalCents,
  cartLineKey,
  getSessionToken,
} from '@/lib/store/cart';
import { formatCents } from '@/lib/store/format';
import StickerPreview from '@/components/store/StickerThemePreviews';
import ShirtPreview from '@/components/store/ShirtPreview';
import { isCustomShirtLine, shirtDesignSummary } from '@/lib/store/customShirt';
import {
  isCustomStickerLine,
  designSummary,
  stickerOnlyCart,
  CUSTOM_STICKER_SHIPPING_CENTS,
} from '@/lib/store/customSticker';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { STORE_CHECKOUT_ENABLED } from '@/lib/store/checkoutFlags';
import { captureEvent } from '@/lib/posthog';
import { isPricedSticker, normalizeStickerFinish, STICKER_FINISHES, STICKER_BULK_MINIMUM, stickerCartQuantity } from '@/lib/store/stickerPricing';

export default function StoreCart() {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cartError, setCartError] = useState('');
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
      setCartError('');
    } catch (error) {
      setCartError(error.message || 'Your cart could not be loaded. Please try again.');
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
      await updateCartItemQuantity(item.id, cartLineKey(item), q);
      await refresh();
    } catch (error) {
      setCartError(error.message || 'The quantity could not be updated.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFinish(item, finish) {
    setBusy(true);
    try {
      await updateStickerFinish(item, finish);
      await refresh();
    } catch (error) {
      setCartError(error.message || 'The finish could not be updated.');
    } finally { setBusy(false); }
  }

  async function handleRemove(item) {
    setBusy(true);
    try {
      await removeFromCart(item.id, cartLineKey(item));
      await refresh();
    } catch (error) {
      setCartError(error.message || 'The item could not be removed.');
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

  // A cart made up only of custom stickers ships for a flat fee no matter
  // how many stickers are in it, so we can show a real number here instead
  // of deferring to checkout. Any other mix falls back to the usual rules.
  const stickersOnly = stickerOnlyCart(items);
  const estimatedShipping = stickersOnly ? CUSTOM_STICKER_SHIPPING_CENTS : null;
  const estimatedTotal = subtotal + (estimatedShipping ?? 0);

  // Loyalty perk eligibility, paid subscriber, tenure check is server-side
  // at order time; here we surface the cart-side dollar threshold only.
  const loyaltyTier = user?.membership_tier;
  const isPaidTier = loyaltyTier && loyaltyTier !== 'free';
  const remainingForLoyalty = Math.max(0, settings.loyalty_min_cart_cents - subtotal);

  // Signup-grant preview for guests, see CLAUDE.md / proposal: the receipt
  // includes a 3-month Keeper trial for guest checkouts above the min order.
  const remainingForGrant = Math.max(0, settings.signup_grant_min_order_cents - subtotal);
  const stickerQuantity = stickerCartQuantity(items);

  return (
    <StoreLayout breadcrumbs={[{ label: 'Supplies', to: '/Store' }, { label: 'Cart' }]}>
      <Seo
        title="Cart, Geck Inspect Supplies"
        description="Review your Geck Inspect cart and check out."
        path="/Store/cart"
        noIndex
      />
      <h1 className="text-2xl font-bold text-slate-100 mb-4">Your cart</h1>
      {cartError && <p role="alert" className="mb-4 rounded-lg bg-rose-950/30 p-3 text-sm text-rose-200">{cartError}</p>}

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
            {stickerQuantity > 0 && <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/30 p-4 text-sm" aria-live="polite">
              <p className="font-semibold text-emerald-100">{stickerQuantity >= STICKER_BULK_MINIMUM ? `Bulk pricing applied to all ${stickerQuantity} stickers` : `${STICKER_BULK_MINIMUM - stickerQuantity} more stickers to unlock bulk pricing`}</p>
              <p className="mt-1 text-xs text-slate-300">20+ across all designs and finishes: $5 standard, $7 holographic each. Below 20: $10 standard, $13 holographic.</p>
              <Link to="/Store/stickers" className="inline-block mt-2 min-h-10 py-2 text-xs text-emerald-200 underline">Create another sticker design</Link>
            </div>}
            {items.map((item) => {
              const p = item.product;
              const sticker = isCustomStickerLine(item);
              const shirt = isCustomShirtLine(item);
              const design = sticker || shirt ? item.customization : null;
              const primary =
                (Array.isArray(p?.images) && p.images.find((i) => i.is_primary)) ||
                (Array.isArray(p?.images) && p.images[0]);
              const detailPath = sticker ? '/Store/stickers' : shirt ? '/Store/tees' : `/Store/p/${p?.slug}`;
              return (
                <div
                  key={item.id || cartLineKey(item)}
                  className="flex gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                >
                  <Link
                    to={detailPath}
                    className={`shrink-0 rounded overflow-hidden bg-slate-950 ${sticker ? 'w-16' : shirt ? 'w-20' : 'w-20 h-20'}`}
                  >
                    {design ? (
                      shirt ? <ShirtPreview design={design} /> : <StickerPreview design={design} />
                    ) : primary ? (
                      <img src={primary.url} alt={primary.alt || p?.name} className="w-full h-full object-cover" />
                    ) : null}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={detailPath} className="text-sm font-semibold text-slate-100 hover:text-emerald-200">
                      {p?.name}
                    </Link>
                    {design && (
                      <div className="text-xs text-emerald-300/90 mt-0.5 break-words">
                        {shirt ? shirtDesignSummary(design) : designSummary(design)}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatCents(item.unit_price_cents_snapshot ?? p?.our_price_cents)} each
                    </div>
                    {isPricedSticker(item) && <label className="mt-2 block text-xs text-slate-400">Finish
                      <select aria-label={`Finish for ${design?.name || p.name}`} value={normalizeStickerFinish(design?.finish)} disabled={busy} onChange={(event) => handleFinish(item, event.target.value)} className="ml-2 min-h-10 max-w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-slate-200">
                        {STICKER_FINISHES.map((finish) => <option key={finish.value} value={finish.value}>{finish.label}</option>)}
                      </select>
                    </label>}
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="sm" aria-label={`Decrease quantity for ${design?.name || p?.name}`} className="touch:min-w-11" variant="ghost" disabled={busy} onClick={() => handleQty(item, item.quantity - 1)}>
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <input key={item.quantity} aria-label={`Quantity for ${design?.name || p?.name}`} type="number" inputMode="numeric" min="1" max="999999" step="1" defaultValue={item.quantity} disabled={busy} onBlur={async (event) => {
                        const input = event.currentTarget;
                        const next = Number(event.target.value);
                        if (Number.isSafeInteger(next) && next > 0 && next <= 999999 && next !== item.quantity) await handleQty(item, next);
                        // A successful refresh replaces this keyed input. On failure,
                        // restore the saved quantity so it agrees with the displayed total.
                        input.value = String(item.quantity);
                      }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="w-16 min-h-10 rounded border border-slate-700 bg-slate-950 text-center text-sm text-slate-200" />
                      <Button size="sm" aria-label={`Increase quantity for ${design?.name || p?.name}`} className="touch:min-w-11" variant="ghost" disabled={busy} onClick={() => handleQty(item, item.quantity + 1)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="touch:min-w-11 text-rose-300 hover:bg-rose-500/10 ml-auto"
                        disabled={busy}
                        aria-label={`Remove ${design?.name || p?.name}`}
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

          <aside className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 h-max sticky top-20 space-y-3">
            <FoodRunoutWidget compact />
            <h2 className="text-sm font-bold text-slate-200">Summary</h2>
            <div className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="text-slate-200">{formatCents(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Shipping</span>
                {estimatedShipping != null ? (
                  <span className="text-slate-200">{formatCents(estimatedShipping)}</span>
                ) : (
                  <span className="text-slate-500 italic">Calculated at checkout</span>
                )}
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tax</span>
                <span className="text-slate-500 italic">Calculated at checkout</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {stickersOnly ? (
                <div className="text-xs rounded border border-slate-700 bg-slate-950 px-2.5 py-2 text-slate-300">
                  Flat <strong className="text-emerald-300">{formatCents(CUSTOM_STICKER_SHIPPING_CENTS)}</strong> shipping
                  on a stickers-only order, however many you add. Add supplies to
                  the same order and the stickers ship inside it.
                </div>
              ) : remainingForFreeShipping > 0 ? (
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
              <span className="text-emerald-200">{formatCents(estimatedTotal)}</span>
            </div>

            <Button
              disabled={!STORE_CHECKOUT_ENABLED || busy || items.length === 0}
              onClick={handleCheckout}
              className="w-full mt-4 bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {!STORE_CHECKOUT_ENABLED
                ? 'Checkout opens soon'
                : busy ? 'Working…' : 'Continue to checkout'}
            </Button>
            <p className="text-[11px] text-slate-500 mt-2 text-center">
              {STORE_CHECKOUT_ENABLED
                ? 'Stripe-hosted checkout · Apple Pay · Google Pay · Cards'
                : 'Online checkout is being switched on. Your cart is saved and will be here when it opens.'}
            </p>
          </aside>
        </div>
      )}
    </StoreLayout>
  );
}
