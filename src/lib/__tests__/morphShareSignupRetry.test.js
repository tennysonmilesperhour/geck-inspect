// A sign-up that came from a shared Morph ID card is credited to the card
// once (record_morph_id_share_signup). The signup event has its own
// once-only flag, so before this fix a credit call that failed (no
// signal, a deploy under way) was never tried again: the flag was set
// before the call and every later session skipped it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ rpc: null, store: new Map() }));

vi.mock('@/lib/supabaseClient', () => {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: { extra_data: {} }, error: null }),
    update: () => query,
    then: (resolve) => resolve({ error: null }),
  };
  return { supabase: { rpc: (...args) => state.rpc(...args), from: () => query } };
});
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));
vi.mock('@/lib/attribution', () => ({
  getFirstTouch: () => null,
  firstTouchProperties: () => ({}),
  getSignupCta: () => null,
  signupCtaProperties: () => ({}),
}));

import { recordSignupIfNew } from '../activation';
import { getMorphShareRef } from '../morphShareRef';

const CARD = '0123456789abcdef';
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  state.store = new Map();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k) => (state.store.has(k) ? state.store.get(k) : null),
      setItem: (k, v) => state.store.set(k, String(v)),
      removeItem: (k) => state.store.delete(k),
    },
  });
  window.localStorage.setItem('geck_morph_share_ref_v1', JSON.stringify({ id: CARD, at: Date.now() }));
});
afterEach(() => vi.unstubAllGlobals());

describe('crediting a sign-up to the Morph ID card it came from', () => {
  it('tries again on a later session when the first call failed, then stops', async () => {
    const user = { id: 'u1', email: 'new@example.test', created_at: new Date().toISOString() };
    state.rpc = vi.fn(async () => ({ data: null, error: { message: 'Failed to fetch' } }));
    expect(await recordSignupIfNew(user, { id: 'p1', extra_data: {} })).toBe(true);
    await settle();
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(getMorphShareRef()).toBe(CARD);

    // Next session: the signup is already recorded, but the credit is not.
    state.rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await recordSignupIfNew(user, { id: 'p1', extra_data: { signup_tracked_at: 'x' } })).toBe(false);
    await settle();
    expect(state.rpc).toHaveBeenCalledWith('record_morph_id_share_signup', { p_share_id: CARD });
    expect(getMorphShareRef()).toBeNull();

    // And once it went through, never again.
    await recordSignupIfNew(user, { id: 'p1', extra_data: { signup_tracked_at: 'x' } });
    await settle();
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an account that is not new', async () => {
    state.rpc = vi.fn(async () => ({ data: true, error: null }));
    const old = { id: 'u2', email: 'old@example.test', created_at: '2025-01-01T00:00:00Z' };
    expect(await recordSignupIfNew(old, { id: 'p2', extra_data: {} })).toBe(false);
    await settle();
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
