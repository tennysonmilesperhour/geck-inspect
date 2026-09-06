import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ callback: null, session: null, profiles: new Map() }));
vi.mock('@/lib/supabaseClient', () => ({
  normalizeSupabaseUser: user => ({ id: user.id, email: user.email, role: 'user' }),
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: state.session } })),
      onAuthStateChange: cb => { state.callback = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => state.callback('SIGNED_OUT', null),
    },
    from: table => ({ select: () => ({ eq: (_, email) => table === 'profiles' ? { maybeSingle: () => state.profiles.get(email) } : Promise.resolve({ data: state.entitlements || [] }) }) }),
  },
}));
vi.mock('@/lib/posthog', () => ({ identifyUser: vi.fn(), resetUser: vi.fn(), captureEvent: vi.fn() }));
vi.mock('@/lib/referral', () => ({ applyPendingReferral: vi.fn() }));
vi.mock('@/lib/store/signupGrant', () => ({ applyPendingSignupGrant: vi.fn() }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false, setGuestMode: vi.fn(), GUEST_USER: { id: 'guest' } }));
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { queryClientInstance } from '../query-client';
import { dataCache } from '../layoutCache';

let auth, tree;
const a = { id: 'auth-a', email: 'a@example.com' };
const b = { id: 'auth-b', email: 'b@example.com' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function Consumer() { auth = useAuth(); return null; }
async function mount() { await act(async () => { tree = create(<AuthProvider><Consumer /></AuthProvider>); }); }
async function emit(event, user) { await act(async () => state.callback(event, user ? { user } : null)); }
beforeEach(() => {
  state.session = null; state.entitlements = []; state.profiles.clear();
  supabase.auth.getSession.mockImplementation(() => Promise.resolve({ data: { session: state.session } }));
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('sessionStorage', { getItem: () => null });
});
afterEach(() => { if (tree) act(() => tree.unmount()); vi.unstubAllGlobals(); });

describe('session enrichment isolation', () => {
  it('does not resurrect a signed-out account when its profile finishes loading', async () => {
    const profile = deferred(); state.profiles.set(a.email, profile.promise);
    await mount(); await emit('SIGNED_IN', a); await emit('SIGNED_OUT', null);
    await act(async () => profile.resolve({ data: { id: 'legacy-a', role: 'admin' } }));
    expect(auth.user).toBeNull(); expect(auth.isAuthenticated).toBe(false);
  });
  it('ignores the previous account profile and billing extras after account switching', async () => {
    const profile = deferred(); state.profiles.set(a.email, profile.promise);
    state.profiles.set(b.email, Promise.resolve({ data: { id: 'legacy-b', role: 'user' } }));
    await mount(); await emit('SIGNED_IN', a);
    queryClientInstance.setQueryData(['dashboard', 'me'], a); dataCache.set('account-data', a);
    await emit('SIGNED_IN', b);
    expect(queryClientInstance.getQueryData(['dashboard', 'me'])).toBeUndefined();
    expect(dataCache.get('account-data')).toBeNull();
    await act(async () => { profile.resolve({ data: { id: 'legacy-a', role: 'admin' } }); auth.mergeUserExtras({ revenuecat_tier: 'breeder' }, a.id); });
    expect(auth.user).toMatchObject({ id: 'legacy-b', auth_user_id: b.id, role: 'user' });
    expect(auth.user.revenuecat_tier).toBe('free');
  });
  it('preserves legacy identity, role and verified billing extras while refreshing the same session', async () => {
    state.session = { user: a }; state.profiles.set(a.email, Promise.resolve({ data: { id: 'legacy-a', role: 'admin' } }));
    state.entitlements = [{ entitlement_identifier: 'keeper', is_active: true }];
    await mount();
    const profile = deferred(); state.profiles.set(a.email, profile.promise);
    await emit('TOKEN_REFRESHED', a);
    expect(auth.user).toMatchObject({ id: 'legacy-a', auth_user_id: a.id, role: 'admin', revenuecat_tier: 'keeper' });
    await act(async () => profile.resolve({ data: { id: 'legacy-a', role: 'admin' } }));
    expect(auth.user.revenuecat_tier).toBe('keeper');
  });
  it('does not replace a new sign-in with a slower boot session', async () => {
    const boot = deferred(); supabase.auth.getSession.mockReturnValue(boot.promise);
    state.profiles.set(b.email, Promise.resolve({ data: { id: 'legacy-b' } }));
    await mount(); await emit('SIGNED_IN', b);
    await act(async () => boot.resolve({ data: { session: { user: a } } }));
    expect(auth.user.auth_user_id).toBe(b.id);
  });
});
