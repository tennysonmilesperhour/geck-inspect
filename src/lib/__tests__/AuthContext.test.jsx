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
vi.mock('@/lib/posthog', () => ({ identifyUser: vi.fn(), resetUser: vi.fn(), captureEvent: vi.fn(), setGuestAnalyticsMode: vi.fn() }));
vi.mock('@/lib/referral', () => ({ applyPendingReferral: vi.fn() }));
vi.mock('@/lib/store/signupGrant', () => ({ applyPendingSignupGrant: vi.fn() }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false, setGuestMode: vi.fn(), GUEST_USER: { id: 'guest' } }));
// The Weekly Gecko Notes region rule (src/lib/weeklyNotesConsent.js) has its
// own tests; here only that the provider hands it the account and profile.
const weekly = vi.hoisted(() => ({ calls: [] }));
vi.mock('@/lib/weeklyNotesConsent', () => ({
  applyWeeklyNotesRegionDefault: (authUser, profile) => { weekly.calls.push([authUser, profile]); return Promise.resolve('skipped'); },
}));
import { AuthProvider, useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { queryClientInstance } from '../query-client';
import { dataCache } from '../layoutCache';
import SignOutButton from '@/components/auth/SignOutButton';
import { getQueueOwner } from '../offlineQueue';
import { __resetSupabaseLazy, hasSessionHint } from '../supabaseLazy';

let auth, tree;
const a = { id: 'auth-a', email: 'a@example.com' };
const b = { id: 'auth-b', email: 'b@example.com' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function Consumer() { auth = useAuth(); return null; }
// The client loads through a dynamic import (src/lib/supabaseLazy.js), so
// wait for it before the test drives auth events.
async function mount(children) {
  await act(async () => { tree = create(<AuthProvider><Consumer />{children}</AuthProvider>); });
  await act(async () => { await vi.dynamicImportSettled(); });
}
async function emit(event, user) { await act(async () => state.callback(event, user ? { user } : null)); }
beforeEach(() => {
  state.session = null; state.entitlements = []; state.profiles.clear(); weekly.calls = [];
  toast.mockClear();
  supabase.auth.signOut.mockReset().mockImplementation(async () => { state.callback('SIGNED_OUT', null); return { error: null }; });
  supabase.auth.getSession.mockImplementation(() => Promise.resolve({ data: { session: state.session } }));
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, location: { href: '/Dashboard' } });
  vi.stubGlobal('document', { addEventListener() {}, removeEventListener() {} });
  // A browser that holds a Supabase sign-in, so the client loads at once
  // (the signed-out start is covered at the end of this file).
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: vi.fn(), length: 1, key: () => 'sb-test-auth-token' });
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

describe('Weekly Gecko Notes region rule', () => {
  it('runs after sign-in with the account and its loaded profile, in the background', async () => {
    state.profiles.set(a.email, Promise.resolve({ data: { id: 'legacy-a', email_weekly_notes_enabled: true, email_weekly_notes_choice_at: null } }));
    await mount(); await emit('SIGNED_IN', a);
    expect(weekly.calls).toHaveLength(1);
    expect(weekly.calls[0][0]).toBe(a);
    expect(weekly.calls[0][1]).toMatchObject({ id: 'legacy-a', email: a.email, email_weekly_notes_choice_at: null });
    expect(auth.isAuthenticated).toBe(true);
  });
  it('does not run for an account that signed out before its profile loaded', async () => {
    const profile = deferred(); state.profiles.set(a.email, profile.promise);
    await mount(); await emit('SIGNED_IN', a); await emit('SIGNED_OUT', null);
    await act(async () => profile.resolve({ data: { id: 'legacy-a', email_weekly_notes_choice_at: null } }));
    expect(weekly.calls).toEqual([]);
  });
});

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

describe('signed-out start (no stored sign-in in this browser)', () => {
  let idle;
  beforeEach(() => {
    __resetSupabaseLazy();
    state.callback = null;
    supabase.auth.getSession.mockClear();
    idle = [];
    vi.stubGlobal('localStorage', { getItem: () => null, removeItem: vi.fn(), length: 0, key: () => null });
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, location: { href: '/', hash: '', search: '' }, requestIdleCallback: (cb) => { idle.push(cb); return idle.length; } });
    vi.stubGlobal('document', { readyState: 'complete', addEventListener() {}, removeEventListener() {} });
  });

  it('shows the page at once and only loads the Supabase client once the page is idle', async () => {
    expect(hasSessionHint()).toBe(false);
    await mount();
    expect(auth.isLoadingAuth).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
    expect(state.callback).toBeNull();
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    await act(async () => { idle.splice(0).forEach((cb) => cb()); });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(typeof state.callback).toBe('function');
    expect(auth.user).toBeNull();
  });

  it('picks up a sign-in finished on the sign-in form before the idle moment', async () => {
    state.profiles.set(a.email, Promise.resolve({ data: { id: 'legacy-a' } }));
    await mount();
    expect(auth.isAuthenticated).toBe(false);
    // The form signed in through the same client before this page listened.
    state.session = { user: a };
    await act(async () => { idle.splice(0).forEach((cb) => cb()); });
    await act(async () => { await vi.dynamicImportSettled(); });
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user).toMatchObject({ id: 'legacy-a', auth_user_id: a.id });
  });

  it('still hears a sign-in that happens after the client arrives', async () => {
    state.profiles.set(a.email, Promise.resolve({ data: { id: 'legacy-a' } }));
    await mount();
    await act(async () => { idle.splice(0).forEach((cb) => cb()); });
    await act(async () => { await vi.dynamicImportSettled(); });
    await emit('SIGNED_IN', a);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user).toMatchObject({ id: 'legacy-a', auth_user_id: a.id });
  });
});

describe('hasSessionHint', () => {
  const browser = (location, keys = []) => {
    vi.stubGlobal('window', { location, localStorage: { length: keys.length, key: (i) => keys[i] } });
  };
  it('is true for a stored sign-in or a sign-in link, false for a plain visit', () => {
    browser({ hash: '', search: '' });
    expect(hasSessionHint()).toBe(false);
    browser({ hash: '', search: '?utm_source=instagram' }, ['geckinspect.theme']);
    expect(hasSessionHint()).toBe(false);
    browser({ hash: '', search: '' }, ['sb-mmuglfphhwlaluyfyxsp-auth-token']);
    expect(hasSessionHint()).toBe(true);
    browser({ hash: '#access_token=x&type=signup', search: '' });
    expect(hasSessionHint()).toBe(true);
    browser({ hash: '', search: '?code=abc' });
    expect(hasSessionHint()).toBe(true);
    browser({ hash: '#error=access_denied&error_description=x', search: '' });
    expect(hasSessionHint()).toBe(true);
  });
  it('treats the native app as possibly signed in', () => {
    vi.stubGlobal('window', { location: { hash: '', search: '' }, Capacitor: { isNativePlatform: () => true } });
    expect(hasSessionHint()).toBe(true);
  });
});
