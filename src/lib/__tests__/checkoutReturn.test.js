import { describe, expect, it, vi } from 'vitest';
import {
  CHECKOUT_POLL_LIMIT,
  claimCheckoutSettlement,
  markCheckoutReturned,
  paidPlanTier,
  pollForPaidPlan,
  stripCheckoutQuery,
  takeCheckoutReturn,
} from '../checkoutReturn';

function memoryStore() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => { data.set(key, String(value)); },
    removeItem: (key) => { data.delete(key); },
  };
}

const keeper = { membership_tier: 'keeper', role: 'user' };
const free = { membership_tier: 'free', role: 'user' };

describe('checkout return polling', () => {
  it('treats a non-free resolved tier as paid', () => {
    expect(paidPlanTier(free)).toBeNull();
    expect(paidPlanTier(keeper)).toBe('keeper');
    expect(paidPlanTier(null)).toBeNull();
    expect(paidPlanTier({ membership_tier: 'free', subscription_status: 'grandfathered' })).toBe('breeder');
    // Lifetime is a paid plan once the profile tier is written. The billing
    // cycle itself is not a second rule; resolveTier still decides.
    expect(paidPlanTier({ membership_tier: 'keeper', membership_billing_cycle: 'lifetime', role: 'user' })).toBe('keeper');
    expect(paidPlanTier({ membership_tier: 'breeder', membership_billing_cycle: 'lifetime', role: 'user' })).toBe('breeder');
  });

  it('emits the paid outcome on the attempt that first sees the plan', async () => {
    const loadUser = vi.fn()
      .mockResolvedValueOnce(free)
      .mockResolvedValueOnce(free)
      .mockResolvedValueOnce(keeper);
    const result = await pollForPaidPlan({
      loadUser,
      wait: async () => {},
    });
    expect(result).toMatchObject({ outcome: 'paid', tier: 'keeper', attempts: 3 });
    expect(loadUser).toHaveBeenCalledTimes(3);
  });

  it('reports a timeout after six reads that stay Free', async () => {
    const loadUser = vi.fn().mockResolvedValue(free);
    const result = await pollForPaidPlan({
      loadUser,
      wait: async () => {},
    });
    expect(result).toMatchObject({
      outcome: 'timeout',
      tier: null,
      attempts: CHECKOUT_POLL_LIMIT,
      user: free,
    });
    expect(loadUser).toHaveBeenCalledTimes(CHECKOUT_POLL_LIMIT);
  });

  it('still reports a paid plan observed on the in-flight read after stop', async () => {
    let stopped = false;
    const loadUser = vi.fn(async () => {
      stopped = true;
      return keeper;
    });
    const result = await pollForPaidPlan({
      loadUser,
      wait: async () => {},
      shouldStop: () => stopped,
    });
    expect(result.outcome).toBe('paid');
    expect(result.tier).toBe('keeper');
    expect(result.attempts).toBe(1);
  });

  it('remembers a success return so a remount can keep polling without a second return event', () => {
    const store = memoryStore();
    const now = Date.now();
    const first = takeCheckoutReturn('?checkout=success&session_id=cs_test', now, store);
    expect(first).toEqual({ status: 'success', emitReturned: true });
    expect(markCheckoutReturned(store)).toBe(true);
    expect(markCheckoutReturned(store)).toBe(false);
    const again = takeCheckoutReturn('', now + 1000, store);
    expect(again).toEqual({ status: 'success', emitReturned: false });
    expect(stripCheckoutQuery('?checkout=success&session_id=cs_test', '')).toBe('?session_id=cs_test');
  });

  it('lets only the first finished poll own the outcome', () => {
    const store = memoryStore();
    takeCheckoutReturn('?checkout=success', Date.now(), store);
    expect(claimCheckoutSettlement(store)).toBe(true);
    expect(claimCheckoutSettlement(store)).toBe(false);
    expect(takeCheckoutReturn('', Date.now(), store).status).toBeNull();
  });

  it('clears a pending success when checkout is cancelled', () => {
    const store = memoryStore();
    takeCheckoutReturn('?checkout=success', Date.now(), store);
    expect(takeCheckoutReturn('?checkout=cancelled', Date.now(), store)).toEqual({
      status: 'cancelled',
      emitReturned: false,
    });
    expect(takeCheckoutReturn('', Date.now(), store).status).toBeNull();
  });
});
