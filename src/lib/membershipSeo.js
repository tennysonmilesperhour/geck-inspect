/**
 * Membership copy and schema shared by the pricing page and the
 * prerendered HTML.
 *
 * scripts/prerender.mjs runs in Node and cannot execute the React page,
 * so non-JS crawlers (GPTBot, ClaudeBot, CCBot) only see what this module
 * puts in the static shell. Prices come from stripe-config.js and gecko
 * caps from tierLimits.js. Lifetime rows stay out of the table and the
 * Offer list until they have a live Stripe price id, which is the same
 * rule the Membership page uses for the Lifetime toggle and its buy
 * buttons. A live lifetime price is a one-time Offer, not a subscription.
 */

import { ORG_ID, SITE_URL } from './organization-schema.js';
import { ENTERPRISE_ON_SALE, TIER_PRICING, TRIAL_DAYS, maxAnnualSavingsPercent } from './stripe-config.js';
import { TIER_LIMITS } from './tierLimits.js';

// Enterprise is listed only while it is on sale (ENTERPRISE_ON_SALE).
const PAID_TIERS = ENTERPRISE_ON_SALE ? ['keeper', 'breeder', 'enterprise'] : ['keeper', 'breeder'];
const PLAN_ORDER = ['free', ...PAID_TIERS];

const PLAN_LABEL = {
  free: 'Free',
  keeper: 'Keeper',
  breeder: 'Breeder',
  enterprise: 'Enterprise',
};

function priceToNumber(price) {
  return Number(String(price).replace(/[^0-9.]/g, ''));
}

function spokenMonthly(tierKey) {
  return `${TIER_PRICING[tierKey].monthly.price} a month`;
}

function spokenYearly(tierKey) {
  return `${TIER_PRICING[tierKey].annual.price} a year`;
}

/** Live purchasable cycles only. Free is not a Stripe price. */
function liveCycles(tierKey) {
  return Object.entries(TIER_PRICING[tierKey] || {}).filter(([, row]) => row?.price_id);
}

export const MEMBERSHIP_OFFERS = PAID_TIERS.flatMap((tier) =>
  liveCycles(tier).map(([cycle, row]) => ({
    '@type': 'Offer',
    name: `Geck Inspect ${tier[0].toUpperCase() + tier.slice(1)} (${cycle})`,
    price: priceToNumber(row.price).toFixed(2),
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: `${SITE_URL}/Membership`,
    category: cycle === 'lifetime' ? 'one-time' : 'subscription',
    description: row.priceCaption,
  })),
);

const MEMBERSHIP_HIGH_PRICE = Math.max(
  ...MEMBERSHIP_OFFERS.map((offer) => Number(offer.price)),
).toFixed(0);

/** Meta description. Same sentence the Membership page puts in <Seo>. */
export function membershipMetaDescription() {
  const freeGeckos = TIER_LIMITS.free.maxGeckos;
  const keeper = TIER_PRICING.keeper;
  const breeder = TIER_PRICING.breeder;
  const enterprise = TIER_PRICING.enterprise;
  const keeperPrice = keeper.lifetime?.price_id
    ? `${keeper.monthly.price}/mo, ${keeper.annual.price}/yr, or ${keeper.lifetime.price} lifetime`
    : `${keeper.monthly.price}/mo or ${keeper.annual.price}/yr`;
  const breederPrice = breeder.lifetime?.price_id
    ? `${breeder.monthly.price}/mo, ${breeder.annual.price}/yr, or ${breeder.lifetime.price} lifetime`
    : `${breeder.monthly.price}/mo or ${breeder.annual.price}/yr`;
  const enterprisePart = ENTERPRISE_ON_SALE
    ? `, and Enterprise (${enterprise.monthly.price}/mo or ${enterprise.annual.price}/yr)`
    : '';
  return `Geck Inspect plans for crested gecko keepers and breeders. Free (${freeGeckos} geckos), Keeper (${keeperPrice}), Breeder (${breederPrice})${enterprisePart}. Optional ${TRIAL_DAYS}-day free trial on monthly and yearly plans. Cancel anytime.`;
}

/**
 * One list for the visible FAQ, the FAQPage JSON-LD, and the prerendered
 * noscript. Google expects the visible questions and the structured data
 * to match.
 */
export const MEMBERSHIP_FAQS = [
  {
    q: 'How much does Geck Inspect cost?',
    a: `Geck Inspect has a Free plan (up to ${TIER_LIMITS.free.maxGeckos} geckos), Keeper at ${spokenMonthly('keeper')} or ${spokenYearly('keeper')}, and Breeder at ${spokenMonthly('breeder')} or ${spokenYearly('breeder')}. Lifetime is ${TIER_PRICING.keeper.lifetime.price} for Keeper and ${TIER_PRICING.breeder.lifetime.price} for Breeder, paid once, with no renewals.${ENTERPRISE_ON_SALE ? ` Enterprise, with Market Intelligence, is ${spokenMonthly('enterprise')} or ${spokenYearly('enterprise')}.` : ''} Subscribing bills you straight away, and each monthly or yearly paid plan also offers an optional ${TRIAL_DAYS}-day free trial. A lifetime purchase has no trial. Paying yearly saves about ${maxAnnualSavingsPercent()}%.`,
  },
  {
    q: 'Can I try a paid plan before subscribing?',
    a: `Yes. Every monthly or yearly paid plan has a ${TRIAL_DAYS}-day free trial you can start from the plan card. It is one per account, and it is optional: subscribing without it bills you today.`,
  },
  {
    q: 'What is included in the Free plan?',
    a: `Up to ${TIER_LIMITS.free.maxGeckos} geckos, 1 active breeding pair, weights, feeding groups and event logs, lineage trees, sales and cost records, value estimates from real listings, one free Morph ID a month, the genetics calculator and guides, and the community forum. It is free for as long as you use it, with no credit card.`,
  },
  {
    q: 'Can I export my records?',
    a: 'Yes, on every plan. Export your roster to CSV or PDF from My Geckos, and your collection and care records as JSON from Settings. Your records stay yours if you ever leave.',
  },
  {
    q: 'When do monthly allowances reset?',
    a: 'At midnight UTC on the 1st of each month. In the US that is the evening of the last day of the month: 8 pm Eastern or 5 pm Pacific while daylight saving time is on, 7 pm Eastern or 4 pm Pacific in winter. Morph IDs, health checks and AI drafts all reset together, and unused monthly allowance does not roll over.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Monthly and yearly subscriptions can be cancelled at any time. Use the Manage billing button on this page or in Settings to open your Stripe billing portal, where you can cancel, change plans, update your card, or download invoices. Lifetime access does not renew, so there is nothing to cancel.',
  },
  {
    q: 'Can I buy lifetime access?',
    a: `Yes. Keeper lifetime is ${TIER_PRICING.keeper.lifetime.price} and Breeder lifetime is ${TIER_PRICING.breeder.lifetime.price}. Each is a one-time payment with no renewals and no free trial. If you already pay monthly or yearly, you can buy lifetime and that subscription stops right away. Unused time on the old plan is not credited.${ENTERPRISE_ON_SALE ? ' Enterprise has no lifetime option.' : ''}`,
  },
];

export const MEMBERSHIP_JSON_LD = [
  {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/Membership#softwareapplication`,
    name: 'Geck Inspect',
    description:
      'Crested gecko collection, breeding, and community platform. Plans for hobbyists through professional breeders, with AI morph ID, lineage trees, marketplace sync, and certificates.',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Reptile breeding and collection management',
    operatingSystem: 'Web, iOS Safari, Android Chrome',
    url: `${SITE_URL}/Membership`,
    publisher: { '@id': ORG_ID },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '0',
      highPrice: MEMBERSHIP_HIGH_PRICE,
      offerCount: MEMBERSHIP_OFFERS.length + 3, // + 3 free-tier rows
      offers: MEMBERSHIP_OFFERS,
    },
    featureList: [
      'Crested gecko collection tracker',
      'Breeding pair manager with lineage tree',
      'AI-powered morph identification',
      'Weight and feeding logs',
      'MorphMarket CSV sync (Breeder tier)',
      'Pairing waitlists with deposit tracking (Breeder tier)',
      'Genetics calculator and morph guide',
      'Community forum and marketplace',
      ...(ENTERPRISE_ON_SALE ? ['Crested gecko Market Intelligence (Enterprise tier)'] : []),
    ],
  },
  {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Membership',
        item: `${SITE_URL}/Membership`,
      },
    ],
  },
  {
    '@type': 'FAQPage',
    mainEntity: MEMBERSHIP_FAQS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  },
];

function listedPrice(tierKey) {
  if (tierKey === 'free') return '$0';
  const bits = [];
  const monthly = TIER_PRICING[tierKey]?.monthly;
  const annual = TIER_PRICING[tierKey]?.annual;
  const lifetime = TIER_PRICING[tierKey]?.lifetime;
  if (monthly?.price_id) bits.push(`${monthly.price}/mo`);
  if (annual?.price_id) bits.push(`${annual.price}/yr`);
  if (lifetime?.price_id) bits.push(`${lifetime.price} one-time`);
  return bits.join(' or ');
}

function collectionLine(tierKey) {
  const cap = TIER_LIMITS[tierKey]?.maxGeckos;
  if (cap == null) return 'Unlimited geckos';
  return `Up to ${cap} geckos`;
}

function includesLine(tierKey) {
  const trial = `Optional ${TRIAL_DAYS}-day free trial.`;
  if (tierKey === 'free') return `${collectionLine('free')}. Free forever, no credit card.`;
  if (tierKey === 'keeper') return `${collectionLine('keeper')}. ${trial}`;
  if (tierKey === 'breeder') return `${collectionLine('breeder')} and breeding pairs. ${trial}`;
  return `Everything in Breeder, plus Market Intelligence. ${trial}`;
}

/** Visible plan table for the prerendered noscript body. */
export const MEMBERSHIP_PLAN_TABLE = {
  title: 'Plans and prices',
  headers: ['Plan', 'Price', 'Includes'],
  rows: PLAN_ORDER.map((tierKey) => [
    PLAN_LABEL[tierKey],
    listedPrice(tierKey),
    includesLine(tierKey),
  ]),
};

/** Heading and lead, matching the Membership page header. */
export function membershipShellCopy() {
  const freeGeckos = TIER_LIMITS.free.maxGeckos;
  const keeperMonthly = TIER_PRICING.keeper.monthly.price;
  const keeperLife = TIER_PRICING.keeper.lifetime;
  const breederLife = TIER_PRICING.breeder.lifetime;
  const lifetimeLine = keeperLife?.price_id && breederLife?.price_id
    ? ` Lifetime Keeper is ${keeperLife.price} and lifetime Breeder is ${breederLife.price}, each a one-time payment with no renewals.`
    : '';
  return {
    heading: 'Plans for every crested gecko collection',
    lead: `Start free with up to ${freeGeckos} geckos. Upgrade when your collection or your breeding outgrows it, from ${keeperMonthly} a month.`,
    paragraphs: [
      `Paid plans start today, or after an optional ${TRIAL_DAYS}-day free trial. Cancel anytime.${lifetimeLine}`,
      'Your records are yours. Export your whole collection to CSV or PDF from My Geckos at any time, on every plan.',
    ],
  };
}
