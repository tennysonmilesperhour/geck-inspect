/**
 * Money + display helpers for the store. Everything in cents internally.
 */

export function formatCents(cents, opts = {}) {
  const { currency = 'usd', placeholder = '—' } = opts;
  if (cents == null || Number.isNaN(Number(cents))) return placeholder;
  const n = Number(cents) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(n);
}

export function priceTierLabel(tier) {
  switch (tier) {
    case 'under_15': return 'Under $15';
    case 'under_25': return 'Under $25';
    case 'under_50': return 'Under $50';
    case 'under_100': return 'Under $100';
    case 'over_100': return '$100+';
    default: return null;
  }
}

export function fulfillmentBadge(mode, vendorName) {
  switch (mode) {
    case 'direct_self':
      return { label: 'Sold by Geck Inspect', tone: 'emerald' };
    case 'direct_pod':
      return { label: 'Made-to-order by Geck Inspect', tone: 'emerald' };
    case 'dropship_wholesale':
      return { label: `Sold by Geck Inspect · Ships from ${vendorName || 'partner'}`, tone: 'sky' };
    case 'affiliate_redirect':
      return { label: `Affiliate · Buy at ${vendorName || 'vendor'}`, tone: 'amber' };
    default:
      return { label: '', tone: 'slate' };
  }
}

export function isCartEligible(mode) {
  return mode === 'direct_self' || mode === 'direct_pod' || mode === 'dropship_wholesale';
}
