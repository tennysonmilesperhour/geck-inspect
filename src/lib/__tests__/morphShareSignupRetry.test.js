// A sign-up that came from a shared Morph ID card is credited to the card
// once (record_morph_id_share_signup). The signup event has its own
// once-only flag, so before this fix a credit call that failed (no
// signal, a deploy under way) was never tried again: the flag was set
// before the call and every later session skipped it.
//
// The retry must not count a card the member opened after joining: the
// database only checks the account's age and that it was not credited
// before, so the browser sends only an id it kept before the account
// was created.
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

import { captureEvent } from '@/lib/posthog';
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
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(captureEvent).mockClear();
});

const MINUTE = 60 * 1000;
const storeCardAt = (at) => window.localStorage.setItem('geck_morph_share_ref_v1', JSON.stringify({ id: CARD, at }));

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

  it('does not credit a card opened after the account was created (later session)', async () => {
    // Account A signed up two hours ago without any card, and its first
    // session was recorded. Today it opens member B's card, which keeps
    // ?ms= on this browser. That card did not bring A here.
    const created = Date.now() - 120 * MINUTE;
    const user = { id: 'u3', email: 'a@example.test', created_at: new Date(created).toISOString() };
    window.localStorage.setItem('geck_signup_tracked:u3', '1');
    storeCardAt(Date.now());
    state.rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await recordSignupIfNew(user, { id: 'p3', extra_data: { signup_tracked_at: 'x' } })).toBe(false);
    await settle();
    expect(state.rpc).not.toHaveBeenCalled();
    // Forgotten, so later auth events (token refresh, focus) do not send it.
    expect(getMorphShareRef()).toBeNull();
    await recordSignupIfNew(user, { id: 'p3', extra_data: { signup_tracked_at: 'x' } });
    await settle();
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('does not credit a card opened after the account was created (first session on this browser)', async () => {
    // A second device where the profile has not recorded the signup yet.
    const created = Date.now() - 90 * MINUTE;
    const user = { id: 'u4', email: 'b@example.test', created_at: new Date(created).toISOString() };
    storeCardAt(created + 60 * MINUTE);
    state.rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await recordSignupIfNew(user, { id: 'p4', extra_data: {} })).toBe(true);
    await settle();
    expect(state.rpc).not.toHaveBeenCalled();
    expect(captureEvent).toHaveBeenCalledWith('signup_completed', expect.not.objectContaining({ morph_share_id: CARD }));
    expect(getMorphShareRef()).toBeNull();
  });

  it('credits a card kept before sign-up, even a day earlier', async () => {
    const created = Date.now() - 60 * MINUTE;
    const user = { id: 'u5', email: 'c@example.test', created_at: new Date(created).toISOString() };
    storeCardAt(created - 24 * 60 * MINUTE);
    state.rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await recordSignupIfNew(user, { id: 'p5', extra_data: {} })).toBe(true);
    await settle();
    expect(state.rpc).toHaveBeenCalledWith('record_morph_id_share_signup', { p_share_id: CARD });
    expect(captureEvent).toHaveBeenCalledWith('signup_completed', expect.objectContaining({ morph_share_id: CARD }));
  });

  it('allows a few minutes for a phone clock that runs ahead of the server', async () => {
    const created = Date.now() - 30 * MINUTE;
    const user = { id: 'u6', email: 'd@example.test', created_at: new Date(created).toISOString() };
    window.localStorage.setItem('geck_signup_tracked:u6', '1');
    storeCardAt(created + 5 * MINUTE);
    state.rpc = vi.fn(async () => ({ data: true, error: null }));
    await recordSignupIfNew(user, { id: 'p6', extra_data: { signup_tracked_at: 'x' } });
    await settle();
    expect(state.rpc).toHaveBeenCalledWith('record_morph_id_share_signup', { p_share_id: CARD });

    // Past the ten minutes it is a visit after sign-up, and nothing is sent.
    state.rpc = vi.fn(async () => ({ data: true, error: null }));
    storeCardAt(created + 11 * MINUTE);
    await recordSignupIfNew(user, { id: 'p6', extra_data: { signup_tracked_at: 'x' } });
    await settle();
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
