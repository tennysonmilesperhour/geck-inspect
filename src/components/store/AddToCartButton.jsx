import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ExternalLink, Check, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addToCart } from '@/lib/store/cart';
import { isCartEligible } from '@/lib/store/format';
import { CUSTOM_STICKER_SLUG } from '@/lib/store/customSticker';
import { CUSTOM_SHIRT_SLUG } from '@/lib/store/customShirt';
import { captureEvent } from '@/lib/posthog';
import { supabase } from '@/lib/supabaseClient';

/**
 * AddToCartButton handles all four fulfillment modes.
 *
 *   direct_self / direct_pod / dropship_wholesale → adds to cart
 *   affiliate_redirect → POSTs an affiliate-click row, then opens the
 *                        vendor URL in a new tab with our partner tag
 *
 * Compact variant (used on cards) shows just the icon + short label;
 * default variant shows full button text on the PDP.
 *
 * The custom sticker product is the one exception: it can't be added to
 * the cart without a design, so it sends the customer to the builder.
 */
export default function AddToCartButton({ product, compact = false, quantity = 1 }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!product) return null;
  const cartEligible = isCartEligible(product.fulfillment_mode);

  if (product.slug === CUSTOM_SHIRT_SLUG) {
    return (
      <Link to="/Store/tees" className="block">
        <Button
          size={compact ? 'sm' : 'default'}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Wand2 className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} mr-1`} />
          {compact ? 'Build' : 'Build your tee'}
        </Button>
      </Link>
    );
  }

  if (product.slug === CUSTOM_STICKER_SLUG) {
    return (
      <Link to="/Store/stickers" className="block">
        <Button
          size={compact ? 'sm' : 'default'}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Wand2 className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} mr-1`} />
          {compact ? 'Build' : 'Build your sticker'}
        </Button>
      </Link>
    );
  }

  async function handleAdd() {
    setBusy(true);
    try {
      await addToCart(product, quantity);
      captureEvent('store_add_to_cart', {
        product_id: product.id,
        product_name: product.name,
        fulfillment_mode: product.fulfillment_mode,
        unit_price_cents: product.our_price_cents,
        quantity,
      });
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch (e) {
      console.error('addToCart failed:', e);
    } finally {
      setBusy(false);
    }
  }

  async function handleAffiliate() {
    if (!product.vendor_product_url) return;
    setBusy(true);
    try {
      // Best-effort log, never block the click.
      try {
        await supabase.from('store_affiliate_clicks').insert({
          product_id: product.id,
          vendor_id: product.vendor_id,
          source_path: typeof window !== 'undefined' ? window.location.pathname : null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          destination_url: product.vendor_product_url,
        });
      } catch (e) {
        console.warn('affiliate click log failed', e);
      }
      captureEvent('store_affiliate_click', {
        product_id: product.id,
        product_name: product.name,
        vendor_id: product.vendor_id,
        destination_url: product.vendor_product_url,
      });
      window.open(product.vendor_product_url, '_blank', 'noopener,noreferrer,sponsored');
    } finally {
      setBusy(false);
    }
  }

  if (cartEligible) {
    return (
      <Button
        size={compact ? 'sm' : 'default'}
        disabled={busy}
        onClick={handleAdd}
        className={`w-full ${
          done
            ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {done ? (
          <>
            <Check className="w-4 h-4 mr-1" /> Added
          </>
        ) : (
          <>
            <ShoppingCart className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} mr-1`} />
            {compact ? 'Add' : 'Add to cart'}
          </>
        )}
      </Button>
    );
  }

  // Affiliate redirect
  return (
    <Button
      size={compact ? 'sm' : 'default'}
      variant="outline"
      disabled={busy || !product.vendor_product_url}
      onClick={handleAffiliate}
      className="w-full border-amber-700/50 text-amber-200 hover:bg-amber-500/10"
    >
      <ExternalLink className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} mr-1`} />
      {compact ? 'Buy at vendor' : 'Buy at vendor'}
    </Button>
  );
}
