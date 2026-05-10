/**
 * Single source of truth for tier pricing across cadences and the
 * Stripe price IDs the (still-to-be-built) `stripe-checkout` edge
 * function will use to create Checkout sessions.
 *
 * Display values are read by src/pages/Membership.jsx; price IDs are
 * sent to the edge function as `body.price_id` so the function does
 * not have to know the catalog.
 *
 * To activate billing:
 *   1. Create the products + prices in Stripe.
 *   2. Replace each `price_id: null` below with the live `price_…` id.
 *   3. Implement `supabase/functions/stripe-checkout/index.ts` to take
 *      `{ tier, billing_cycle, price_id, returnUrl }`, mint a Checkout
 *      session, and return `{ url }`. Set `mode: 'subscription'` for
 *      monthly/annual, `mode: 'payment'` for lifetime.
 *   4. The webhook handler should set `membership_tier` to `tier` and
 *      `membership_billing_cycle` to `billing_cycle` on the user's
 *      profile (lifetime users keep `billing_cycle = 'lifetime'`
 *      forever, which the entitlement layer treats as a permanent
 *      grant ,  see PlanLimitChecker.isLifetimeMember).
 */

export const BILLING_CYCLES = ['monthly', 'annual', 'lifetime'];

// `price` is the headline number we show on the card.
// `billing` is the unit label rendered next to it (e.g. "/month").
// `priceCaption` shows under the price ("Billed monthly", "One-time
// purchase, never expires", etc).
// `cta` overrides the default "Start <Tier>" copy when set.
// `mode` tells the checkout function which Stripe mode to use.
// `price_id` is the live Stripe Price; null = not yet configured.
export const TIER_PRICING = {
  free: {
    monthly:  { price: '$0',     billing: '/month',   priceCaption: 'Free forever',                         mode: null,            price_id: null, cta: 'Get Started Free' },
    annual:   { price: '$0',     billing: '/year',    priceCaption: 'Free forever',                         mode: null,            price_id: null, cta: 'Get Started Free' },
    lifetime: { price: '$0',     billing: '',         priceCaption: 'Free forever',                         mode: null,            price_id: null, cta: 'Get Started Free' },
  },
  keeper: {
    monthly:  { price: '$2.99',  billing: '/month',   priceCaption: 'Billed monthly. Cancel anytime.',      mode: 'subscription',  price_id: 'price_1TUxEsLBdc4xGjxqyPV4DOYb', cta: 'Start Keeper' },
    annual:   { price: '$30',    billing: '/year',    priceCaption: 'Annual launches June 2026. Save vs monthly. Cancel anytime.', mode: 'subscription',  price_id: null, cta: 'Start Keeper' },
    lifetime: { price: '$149',   billing: 'one-time', priceCaption: 'Pay once. Lifetime access. No renewals.', mode: 'payment',   price_id: null, cta: 'Get Lifetime Keeper' },
  },
  breeder: {
    monthly:  { price: '$5.99',  billing: '/month',   priceCaption: 'Billed monthly. Cancel anytime.',      mode: 'subscription',  price_id: 'price_1TUxHGLBdc4xGjxqeieYNdE4', cta: 'Start Breeder' },
    annual:   { price: '$70',    billing: '/year',    priceCaption: 'Annual launches June 2026. Save vs monthly. Cancel anytime.', mode: 'subscription',  price_id: null, cta: 'Start Breeder' },
    lifetime: { price: '$349',   billing: 'one-time', priceCaption: 'Pay once. Lifetime access. No renewals.', mode: 'payment',   price_id: null, cta: 'Get Lifetime Breeder' },
  },
  // Enterprise intentionally does NOT have a lifetime entry ,  that
  // tier is custom-quoted and stays on the waitlist for now. The
  // Membership page reads `TIER_PRICING.enterprise[cycle] ?? fallback`
  // so a missing key just renders the existing Coming Soon state.
  enterprise: {
    monthly:  { price: 'Custom', billing: 'pricing',  priceCaption: 'Talk to us about volume + custom needs.', mode: null,        price_id: null, cta: 'Join the Waitlist' },
    annual:   { price: 'Custom', billing: 'pricing',  priceCaption: 'Talk to us about volume + custom needs.', mode: null,        price_id: null, cta: 'Join the Waitlist' },
    // No lifetime row ,  surfaces a "Lifetime not available" message in the UI.
  },
};

export function getTierPricing(tierKey, cycle) {
  const tier = TIER_PRICING[tierKey];
  if (!tier) return null;
  return tier[cycle] || null;
}
