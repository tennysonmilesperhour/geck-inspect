/**
 * Store checkout availability.
 *
 * Online checkout runs through the `store-checkout` and
 * `store-stripe-webhook` edge functions. Until both are deployed with
 * their Stripe secrets, the store only offers what can actually be
 * bought: affiliate products, which open the seller's own page.
 * While this is false:
 *   - the cart and the custom tee builder
 *     (/Store/cart, /Store/tees) redirect to /Store,
 *     and the store navigation hides their links;
 *   - the sticker designer stays open for design previews and downloads,
 *     with purchase actions disabled;
 *   - products sold through Geck Inspect stay visible in the catalog but
 *     are labelled "Not available yet", with no add-to-cart button and
 *     no price offer in their search markup (see isAwaitingCheckout);
 *   - the "Picks for this gecko" panel recommends affiliate products only.
 *
 * Flip this to true once both functions are live and a test order has
 * been paid end to end; every one of those screens comes back as it was.
 */
import { isCartEligible } from '@/lib/store/format';
import { CUSTOM_STICKER_SLUG } from '@/lib/store/customSticker';
import { CUSTOM_SHIRT_SLUG } from '@/lib/store/customShirt';

export const STORE_CHECKOUT_ENABLED = false;

/**
 * True for a product that can only be bought through Geck Inspect's own
 * checkout (sold by Geck Inspect, made to order, shipped by a partner, or
 * one of the custom sticker and tee builders) while that checkout is
 * closed. Affiliate products are never awaiting checkout.
 */
export function isAwaitingCheckout(product, checkoutEnabled = STORE_CHECKOUT_ENABLED) {
  if (checkoutEnabled || !product) return false;
  return (
    isCartEligible(product.fulfillment_mode) ||
    product.slug === CUSTOM_STICKER_SLUG ||
    product.slug === CUSTOM_SHIRT_SLUG
  );
}
