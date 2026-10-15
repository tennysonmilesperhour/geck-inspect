// Plain-language helpers for the admin revenue card. The numbers come from
// public.admin_revenue_summary() (migration 20261016130000_stripe_ledger),
// which reads the payment ledger the Stripe webhook keeps. Amounts arrive
// in cents.

const TIER_LABELS = { keeper: 'Keeper', breeder: 'Breeder', enterprise: 'Enterprise' };
const CYCLE_LABELS = { monthly: 'monthly', annual: 'yearly', lifetime: 'lifetime' };

// Stripe's cancellation_details.reason values.
const REASON_LABELS = {
  cancellation_requested: 'Member cancelled',
  payment_failed: 'Card kept failing',
  payment_disputed: 'Payment disputed',
};

// Stripe's portal feedback options (cancellation_details.feedback).
const FEEDBACK_LABELS = {
  too_expensive: 'Too expensive',
  unused: 'Not using it enough',
  missing_features: 'Missing features',
  switched_service: 'Switched to another service',
  too_complex: 'Too complicated',
  low_quality: 'Quality not good enough',
  customer_service: 'Customer service',
  other: 'Other reason',
};

export function formatCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${(n / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function planLabel(tier, cycle) {
  const t = TIER_LABELS[tier] || (tier ? String(tier) : 'Unknown plan');
  const c = CYCLE_LABELS[cycle];
  return c ? `${t} ${c}` : t;
}

/** Why a member left, in words: Stripe's reason plus their own answer. */
export function cancellationWhy(row) {
  const parts = [];
  if (row?.feedback) parts.push(FEEDBACK_LABELS[row.feedback] || String(row.feedback));
  else if (row?.reason) parts.push(REASON_LABELS[row.reason] || String(row.reason));
  if (row?.comment) parts.push(`"${row.comment}"`);
  return parts.length ? parts.join(': ') : 'No reason given';
}

export function shortDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** What one lifecycle row says happened, for the recent list. */
export function lifecycleLabel(row) {
  if (row?.kind === 'cancel_scheduled') return `Cancelled, ends ${shortDate(row.cancel_at) || 'at period end'}`;
  if (row?.kind === 'cancel_withdrawn') return 'Changed their mind and stayed';
  if (row?.status === 'replaced_by_lifetime') return 'Moved to a lifetime plan';
  if (row?.kind === 'subscription_cancelled') return 'Subscription ended';
  return row?.kind || '';
}

/** The numbers the card shows, with safe defaults for a missing field. */
export function summarizeRevenue(data) {
  const s = data || {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return {
    mrrCents: num(s.mrr_cents),
    payingSubscriptions: num(s.paying_subscriptions),
    mrrByTier: Object.entries(s.mrr_by_tier || {}).map(([tier, v]) => ({
      tier,
      subscriptions: num(v?.subscriptions),
      mrrCents: num(v?.mrr_cents),
    })),
    atRiskCents: num(s.mrr_at_risk_cents),
    revenueCents: num(s.revenue_cents),
    refundedCents: num(s.refunded_cents),
    disputedCents: num(s.disputed_cents),
    paidInvoices: num(s.paid_invoices),
    chargedInvoices: num(s.charged_invoices),
    lifetimePurchases: num(s.lifetime_purchases),
    lifetimeCents: num(s.lifetime_cents),
    cancellationsScheduled: num(s.cancellations_scheduled),
    cancelled30d: num(s.cancelled_30d),
    scheduled: Array.isArray(s.scheduled) ? s.scheduled : [],
    recent: Array.isArray(s.recent_cancellations) ? s.recent_cancellations : [],
    lastPaymentAt: s.last_payment_at || null,
  };
}
