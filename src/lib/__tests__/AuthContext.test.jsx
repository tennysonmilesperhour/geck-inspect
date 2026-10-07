import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ callback: null, session: null, profiles: new Map() }));
const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/button', () => ({ Button: props => <button {...props} /> }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/supabaseClient', () => ({
  normalizeSupabaseUser: user => ({ id: user.id, email: user.email, role: 'user' }),
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: state.session } })),
      onAuthStateChange: cb => { state.callback = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: vi.fn(async () => { state.callback('SIGNED_OUT', null); return { error: null }; }),
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
import SignOutButton from '@/components/auth/SignOutButton';
import { getQueueOwner } from '../offlineQueue';

let auth, tree;
const a = { id: 'auth-a', email: 'a@example.com' };
const b = { id: 'auth-b', email: 'b@example.com' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function Consumer() { auth = useAuth(); return null; }
async function mount(children) { await act(async () => { tree = create(<AuthProvider><Consumer />{children}</AuthProvider>); }); }
async function emit(event, user) { await act(async () => state.callback(event, user ? { user } : null)); }
beforeEach(() => {
  state.session = null; state.entitlements = []; state.profiles.clear();
  toast.mockClear();
  supabase.auth.signOut.mockReset().mockImplementation(async () => { state.callback('SIGNED_OUT', null); return { error: null }; });
  supabase.auth.getSession.mockImplementation(() => Promise.resolve({ data: { session: state.session } }));
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, location: { href: '/Dashboard' } });
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: vi.fn() });
  vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: vi.fn() });
});

describe('sign-out control', () => {
  it('clears the signed-in account and cached data, then returns home', async () => {
    state.session = { user: a };
    state.profiles.set(a.email, Promise.resolve({ data: { id: 'legacy-a' } }));
    const pending = deferred();
    supabase.auth.signOut.mockImplementationOnce(async () => {
      await pending.promise;
      state.callback('SIGNED_OUT', null);
      return { error: null };
    });
    await mount(<SignOutButton />);
    queryClientInstance.setQueryData(['dashboard', 'me'], a);
    dataCache.set('account-data', a);

    let signingOut;
    await act(async () => { signingOut = tree.root.findByType('button').props.onClick(); });
    expect(tree.root.findByType('button').props.disabled).toBe(true);

    await act(async () => { pending.resolve(); await signingOut; });
    expect(queryClientInstance.getQueryData(['dashboard', 'me'])).toBeUndefined();
    expect(dataCache.get('account-data')).toBeNull();
    expect(getQueueOwner()).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.user).toBeNull();
    expect(tree.root.findAllByType('button')).toHaveLength(0);
    expect(window.location.href).toBe('/');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('geck_inspect_ephemeral_session');
    expect(localStorage.removeItem).toHaveBeenCalledWith('geck_inspect_unload_ts');
  });

  it.each(['returned', 'thrown'])('keeps a %s sign-out error recoverable and lets the member retry', async (failure) => {
    state.session = { user: a };
    state.profiles.set(a.email, Promise.resolve({ data: { id: 'legacy-a' } }));
    const error = new Error('Connection interrupted');
    if (failure === 'returned') supabase.auth.signOut.mockResolvedValueOnce({ error });
    else supabase.auth.signOut.mockRejectedValueOnce(error);
    await mount(<SignOutButton />);
    queryClientInstance.setQueryData(['dashboard', 'me'], a);
    dataCache.set('account-data', a);

    await act(async () => tree.root.findByType('button').props.onClick());
    expect(auth.isAuthenticated).toBe(true);
    expect(queryClientInstance.getQueryData(['dashboard', 'me'])).toEqual(a);
    expect(dataCache.get('account-data')).toEqual(a);
    expect(getQueueOwner()).toBe(a.id);
    expect(window.location.href).toBe('/Dashboard');
    expect(tree.root.findByType('button').props.disabled).toBe(false);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not sign out' }));

    await act(async () => tree.root.findByType('button').props.onClick());
    expect(auth.isAuthenticated).toBe(false);
    expect(window.location.href).toBe('/');
  });

  it('does not offer sign out to a visitor without an account session', async () => {
    await mount(<SignOutButton />);
    expect(tree.root.findAllByType('button')).toHaveLength(0);
  });

  it('finishes local sign-out when Supabase ends the session but reports a remote error', async () => {
    state.session = { user: a };
    state.profiles.set(a.email, Promise.resolve({ data: { id: 'legacy-a' } }));
    supabase.auth.signOut.mockImplementationOnce(async () => {
      state.callback('SIGNED_OUT', null);
      return { error: new Error('Remote revocation unavailable') };
    });
    await mount(<SignOutButton />);
    queryClientInstance.setQueryData(['dashboard', 'me'], a);

    await act(async () => tree.root.findByType('button').props.onClick());
    expect(auth.isAuthenticated).toBe(false);
    expect(queryClientInstance.getQueryData(['dashboard', 'me'])).toBeUndefined();
    expect(window.location.href).toBe('/');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('geck_inspect_ephemeral_session');
    expect(toast).not.toHaveBeenCalled();
  });
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
