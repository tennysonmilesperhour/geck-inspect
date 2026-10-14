// Stripe sends the member back to /Membership?checkout=success. The return
// URL is not proof of payment. This module polls until the account really
// shows a paid plan, and says so when that never happens.
//
// Stripe's webhook log stays the record of money. These events are the
// in-app step. See docs/planning/instrumentation-2026-10.md.
import { resolveTier } from '@/lib/tierLimits';

export const CHECKOUT_POLL_LIMIT = 6;
// Waits before attempts 2 through 6. Six reads spread across about a minute,
// matching the confirmation copy ("your plan switches on within a minute").
// The old 2.5s gap gave up in about 15 seconds, before a cold webhook.
export const CHECKOUT_POLL_GAPS_MS = [8000, 10000, 12000, 12000, 14000];

const PENDING_KEY = 'geck_checkout_pending';
const PENDING_TTL_MS = 3 * 60 * 1000;

const fallbackStore = {
  data: new Map(),
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; },
  setItem(key, value) { this.data.set(key, String(value)); },
  removeItem(key) { this.data.delete(key); },
};

function box(store) {
  if (store) return store;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch {
    // private mode falls through
  }
  return fallbackStore;
}

/** Paid tier on the account, or null while it is still Free (or unknown). */
export function paidPlanTier(user) {
  if (!user) return null;
  const tier = resolveTier(user);
  return tier && tier !== 'free' ? tier : null;
}

export function readCheckoutPending(now = Date.now(), store) {
  try {
    const parsed = JSON.parse(box(store).getItem(PENDING_KEY) || 'null');
    if (!parsed || parsed.status !== 'success') return null;
    if (now - Number(parsed.at || 0) > PENDING_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePending(record, store) {
  try {
    box(store).setItem(PENDING_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

export function clearCheckoutPending(store) {
  try {
    box(store).removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

/**
 * Read ?checkout= from the address. Success is remembered for this tab so
 * a remount that already removed the query can keep polling. Cancelled
 * drops any pending success.
 */
export function takeCheckoutReturn(search, now = Date.now(), store) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const value = params.get('checkout');
  if (value === 'cancelled') {
    clearCheckoutPending(store);
    return { status: 'cancelled', emitReturned: false };
  }
  if (value === 'success') {
    const existing = readCheckoutPending(now, store);
    const record = existing && !existing.settled
      ? existing
      : { status: 'success', at: now, returned: false, settled: false };
    writePending(record, store);
    return { status: 'success', emitReturned: !record.returned };
  }
  const pending = readCheckoutPending(now, store);
  if (pending && !pending.settled) {
    return { status: 'success', emitReturned: !pending.returned };
  }
  return { status: null, emitReturned: false };
}

/** True the first time this tab records the return. A second effect run does not. */
export function markCheckoutReturned(store) {
  const pending = readCheckoutPending(Date.now(), store);
  if (!pending || pending.returned) return false;
  pending.returned = true;
  writePending(pending, store);
  return true;
}

/** First caller to finish the poll owns the outcome event. */
export function claimCheckoutSettlement(store) {
  const pending = readCheckoutPending(Date.now(), store);
  if (!pending || pending.settled) return false;
  pending.returned = true;
  pending.settled = true;
  writePending(pending, store);
  return true;
}

/** Search string with ?checkout= removed. Keeps session_id and the hash. */
export function stripCheckoutQuery(search, hash = '') {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  params.delete('checkout');
  const rest = params.toString();
  return `${rest ? `?${rest}` : ''}${hash || ''}`;
}

/**
 * Read the member until a paid plan shows up, or the attempt budget runs out.
 * `wait` and `shouldStop` are injected so tests do not sleep and a remount
 * can abandon the wait without dropping a paid plan already observed.
 */
export async function pollForPaidPlan({
  loadUser,
  limit = CHECKOUT_POLL_LIMIT,
  gaps = CHECKOUT_POLL_GAPS_MS,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  shouldStop = () => false,
  onUser,
}) {
  let lastUser = null;
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    if (shouldStop()) return { outcome: 'stopped', tier: null, attempts: attempt, user: lastUser };
    let user = null;
    try {
      user = await loadUser();
    } catch {
      user = null;
    }
    if (user) {
      lastUser = user;
      if (!shouldStop()) onUser?.(user);
    }
    const tier = paidPlanTier(user);
    if (tier) return { outcome: 'paid', tier, attempts: attempt, user };
    if (shouldStop()) return { outcome: 'stopped', tier: null, attempts: attempt, user: lastUser };
    if (attempt < limit) await wait(gaps[attempt - 1] ?? 10000);
  }
  return {
    outcome: 'timeout',
    tier: paidPlanTier(lastUser),
    attempts: limit,
    user: lastUser,
  };
}
