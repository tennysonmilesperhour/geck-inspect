/**
 * Single source of truth for tier pricing across cadences and the
 * Stripe price IDs the `stripe-checkout` edge function
 * (supabase/functions/stripe-checkout) uses to create Checkout
 * sessions.
 *
 * Display values are read by src/pages/Membership.jsx; price IDs are
 * sent to the edge function as `body.price_id` so the function does
 * not have to know the catalog.
 *
 * To activate billing:
 *   1. Create the products + prices in Stripe.
 *   2. Replace each `price_id: null` below with the live `price_…` id
 *      (lifetime rows are hidden from the Membership page while their
 *      price_id is null, so adding the id is what turns them on).
 *   3. The webhook handler should set `membership_tier` to `tier` and
 *      `membership_billing_cycle` to `billing_cycle` on the user's
 *      profile (lifetime users keep `billing_cycle = 'lifetime'`
 *      forever, which the entitlement layer treats as a permanent
 *      grant. See PlanLimitChecker.isLifetimeMember.
 */

export const BILLING_CYCLES = ['monthly', 'annual', 'lifetime'];

/**
 * Trial policy, single source of truth. These mirror what the
 * `stripe-checkout` edge function actually configures on the Stripe
 * subscription (subscription_data[trial_period_days]), so any copy
 * derived from these constants stays truthful:
 *   - TRIAL_DAYS: default trial attached to every recurring (monthly
 *     or annual) checkout, all paid tiers.
 *   - KEEPER_PROMO_TRIAL_DAYS: the one-time first-timer promo used by
 *     the Promote flow (?intent=keeper_trial); the function enforces
 *     keeper_trial_used so it can never be claimed twice.
 * The store's guest signup grant is a third, separate mechanism whose
 * duration is admin-configured in the DB
 * (store_signup_grant_duration_days), not a Stripe trial; do not
 * describe it with these constants.
 */
export const TRIAL_DAYS = 7;
export const KEEPER_PROMO_TRIAL_DAYS = 30;

/**
 * Percent saved by paying annually instead of 12x monthly for a tier,
 * rounded to the nearest whole percent. Returns null when either price
 * is missing or free. Use this instead of hardcoding "Save 20%" style
 * badges so the claim always matches the actual numbers.
 */
export function annualSavingsPercent(tierKey) {
  const tier = TIER_PRICING[tierKey];
  if (!tier?.monthly || !tier?.annual) return null;
  const toNumber = (p) => Number(String(p).replace(/[^0-9.]/g, ''));
  const monthly = toNumber(tier.monthly.price);
  const annual = toNumber(tier.annual.price);
  if (!monthly || !annual) return null;
  return Math.round((1 - annual / (monthly * 12)) * 100);
}

/** The best annual savings across paid tiers, for the cadence toggle badge. */
export function maxAnnualSavingsPercent() {
  return Math.max(
    ...Object.keys(TIER_PRICING)
      .map((k) => annualSavingsPercent(k) ?? 0),
  );
}

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
    monthly:  { price: '$2.99',  billing: '/month',   priceCaption: `${TRIAL_DAYS}-day free trial. Billed monthly. Cancel anytime.`,      mode: 'subscription',  price_id: 'price_1TUxEsLBdc4xGjxqyPV4DOYb', cta: 'Start Keeper' },
    annual:   { price: '$30',    billing: '/year',    priceCaption: `${TRIAL_DAYS}-day free trial. Billed yearly, save vs monthly. Cancel anytime.`, mode: 'subscription',  price_id: 'price_1TVMLeLBdc4xGjxqA856z0Oe', cta: 'Start Keeper' },
    lifetime: { price: '$149',   billing: 'one-time', priceCaption: 'Pay once. Lifetime access. No renewals.', mode: 'payment',   price_id: null, cta: 'Get Lifetime Keeper' },
  },
  breeder: {
    monthly:  { price: '$5.99',  billing: '/month',   priceCaption: `${TRIAL_DAYS}-day free trial. Billed monthly. Cancel anytime.`,      mode: 'subscription',  price_id: 'price_1TUxHGLBdc4xGjxqeieYNdE4', cta: 'Start Breeder' },
    annual:   { price: '$60',    billing: '/year',    priceCaption: `${TRIAL_DAYS}-day free trial. Billed yearly, save vs monthly. Cancel anytime.`, mode: 'subscription',  price_id: 'price_1TVMOCLBdc4xGjxqK2HTmGfm', cta: 'Start Breeder' },
    lifetime: { price: '$349',   billing: 'one-time', priceCaption: 'Pay once. Lifetime access. No renewals.', mode: 'payment',   price_id: null, cta: 'Get Lifetime Breeder' },
  },
  // Enterprise: real pricing, $99.99/mo or $1,000/yr, both self-serve. No
  // lifetime entry; Enterprise doesn't get a one-time pay-once option.
  enterprise: {
    monthly:  { price: '$99.99', billing: '/month',   priceCaption: `${TRIAL_DAYS}-day free trial. Billed monthly. Cancel anytime.`, mode: 'subscription',  price_id: 'price_1TVLvmLBdc4xGjxqCVzbz0GQ', cta: 'Start Enterprise' },
    annual:   { price: '$1,000', billing: '/year',    priceCaption: `${TRIAL_DAYS}-day free trial. Billed yearly, save ~17% vs monthly.`, mode: 'subscription',  price_id: 'price_1TVMQYLBdc4xGjxqpZFuqV96', cta: 'Start Enterprise' },
    // No lifetime row. The UI surfaces a "Lifetime not available" message.
  },
};

export function getTierPricing(tierKey, cycle) {
  const tier = TIER_PRICING[tierKey];
  if (!tier) return null;
  return tier[cycle] || null;
}
