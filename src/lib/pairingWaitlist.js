/**
 * Waitlists with deposits, tied to a pairing (P9.2).
 *
 * A breeder opens a waitlist for a pairing. The genetics engine works out
 * the pairing's likely babies when the list is created, and the list keeps
 * that snapshot (label and odds) so the public page can show it without
 * reading the parents' private records. Buyers join, say which outcome
 * they hope for, and the breeder tracks each one:
 *
 *   waiting > deposit paid > matched with a hatchling > completed
 *   (or withdrawn, or refunded, at any point)
 *
 * Each list can carry written deposit terms. Buyers must agree to them to
 * join, and the database keeps the exact wording they agreed to.
 * Creating a waitlist is part of the Breeder plan.
 *
 * Geck Inspect records deposits; it does not take payments. Matching can
 * start a reserve in Sales with the deposit as the first payment, so the
 * rest of the sale runs through the existing reserve tracker.
 */
import { pairingEggValue } from '@/lib/pairingValue';

export const SIGNUP_STATUSES = [
  { id: 'waiting', label: 'Waiting' },
  { id: 'deposit_paid', label: 'Deposit paid' },
  { id: 'matched', label: 'Matched' },
  { id: 'completed', label: 'Completed' },
  { id: 'withdrawn', label: 'Withdrawn' },
  { id: 'refunded', label: 'Refunded' },
];

// Statuses that take a buyer out of the line.
export const OUT_OF_LINE = new Set(['withdrawn', 'refunded']);

/**
 * Starting terms for a new waitlist with a deposit. The breeder can edit
 * them; most deposit disputes come from terms nobody wrote down.
 */
export const DEFAULT_DEPOSIT_TERMS = [
  '1. Your deposit holds your place in line and counts toward the price of the gecko.',
  '2. It is fully refundable until you accept a match with a specific hatchling.',
  '3. If this pairing does not produce what you asked for by the end of the season, you choose: a refund, moving to next season, or putting the deposit toward another gecko.',
  '4. Once you accept a match, the deposit is non-refundable, but you can ask to transfer it to another gecko.',
  '5. If I cancel your spot for any reason, you get a full refund.',
].join('\n');

export const signupStatusLabel = (id) => SIGNUP_STATUSES.find((s) => s.id === id)?.label || 'Waiting';

/**
 * The outcomes a buyer can choose from: the likeliest babies that survive,
 * at least `min` odds each, at most `max` of them.
 * @returns {{ label: string, probability: number }[]}
 */
export function waitlistOutcomes(sire, dam, { max = 8, min = 0.03 } = {}) {
  const value = pairingEggValue(sire, dam, null);
  if (!value) return [];
  const merged = new Map();
  for (const o of value.outcomes) {
    if (o.lethal) continue;
    const label = o.label && o.label !== 'Wild-type' ? o.label : 'Normal (no listed traits)';
    merged.set(label, (merged.get(label) || 0) + (Number(o.probability) || 0));
  }
  return [...merged.entries()]
    .map(([label, probability]) => ({ label, probability: Math.round(probability * 1000) / 1000 }))
    .filter((o) => o.probability >= min)
    .sort((a, b) => b.probability - a.probability || a.label.localeCompare(b.label))
    .slice(0, max);
}

const nameOf = (gecko, fallback) => gecko?.name || gecko?.morphs_traits || fallback;

/** "Kiwi x Mango (2026)" for a breeding plan. */
export function pairingLabel(plan, geckosById = new Map()) {
  if (!plan) return '';
  const sire = geckosById.get(plan.sire_id);
  const dam = geckosById.get(plan.dam_id);
  const season = plan.breeding_season ? ` (${plan.breeding_season})` : '';
  return `${nameOf(sire, 'Unknown sire')} x ${nameOf(dam, 'Unknown dam')}${season}`;
}

/** Default title for a new pairing waitlist. */
export function defaultWaitlistTitle(plan, geckosById = new Map()) {
  if (!plan) return '';
  const sire = geckosById.get(plan.sire_id);
  const dam = geckosById.get(plan.dam_id);
  const season = plan.breeding_season || new Date().getFullYear();
  return `${nameOf(sire, 'Sire')} x ${nameOf(dam, 'Dam')} ${season} babies`;
}

/** Signups in line order (oldest first), each with its place among active ones. */
export function orderedSignups(signups = []) {
  const sorted = [...signups].sort((a, b) =>
    String(a.created_date).localeCompare(String(b.created_date)) || String(a.id).localeCompare(String(b.id)));
  let place = 0;
  return sorted.map((s) => (OUT_OF_LINE.has(s.status) ? { ...s, place: null } : { ...s, place: ++place }));
}

/** Headline numbers for one waitlist. */
export function waitlistSummary(signups = []) {
  const active = signups.filter((s) => !OUT_OF_LINE.has(s.status));
  const held = active.filter((s) => ['deposit_paid', 'matched'].includes(s.status));
  return {
    active: active.length,
    deposits: held.filter((s) => Number(s.deposit_paid) > 0).length,
    depositTotal: held.reduce((sum, s) => sum + (Number(s.deposit_paid) || 0), 0),
    waitingForDeposit: active.filter((s) => s.status === 'waiting').length,
    matched: active.filter((s) => s.status === 'matched' || s.status === 'completed').length,
    refundedTotal: signups
      .filter((s) => s.status === 'refunded')
      .reduce((sum, s) => sum + (Number(s.refund_amount) || 0), 0),
  };
}

/** Babies from this pairing that could go to someone on the list. */
export function matchableHatchlings(plan, geckos = []) {
  if (!plan?.sire_id || !plan?.dam_id) return [];
  return geckos.filter((g) =>
    g.sire_id === plan.sire_id && g.dam_id === plan.dam_id && !g.archived
    && !['Sold', 'Deceased'].includes(g.status));
}

/**
 * A reserve (pending sale) for a matched buyer, carrying their deposit as a
 * paid first payment.
 */
export function reserveFromSignup({ signup, gecko, userEmail, price, today }) {
  const deposit = Number(signup?.deposit_paid) || 0;
  const reservePrice = Number(price ?? gecko?.asking_price) || 0;
  return {
    user_email: userEmail,
    gecko_id: gecko?.id || null,
    gecko_name: gecko?.name || gecko?.morphs_traits || 'Hatchling',
    buyer_name: signup?.name || null,
    reserve_price: Math.max(reservePrice, deposit),
    amount_paid: deposit,
    payment_schedule: deposit > 0
      ? [{ amount: deposit, due_date: signup?.deposit_paid_on || today, paid: true, paid_date: signup?.deposit_paid_on || today, note: 'Waitlist deposit' }]
      : [],
    notes: [`From the waitlist. Buyer email: ${signup?.email || 'unknown'}.`, signup?.wanted_outcome ? `Hoped for: ${signup.wanted_outcome}.` : null]
      .filter(Boolean).join(' '),
    status: 'pending',
  };
}

/** Random 8-character link slug (the database keeps them unique). */
export const makeWaitlistSlug = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
