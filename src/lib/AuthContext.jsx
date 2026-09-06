import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';
import { identifyUser, resetUser, captureEvent } from '@/lib/posthog';
import { isGuestMode, setGuestMode, GUEST_USER } from '@/lib/guestMode';
import { applyPendingReferral } from '@/lib/referral';
import { applyPendingSignupGrant } from '@/lib/store/signupGrant';
import { loadUserProfile } from '@/lib/userProfile';
import { queryClientInstance } from '@/lib/query-client';
import { dataCache } from '@/lib/layoutCache';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(() => isGuestMode());
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Invalidates pending profile reads on account changes, sign-out and unmount.
  const revisionRef = useRef(0);
  const sessionOwnerRef = useRef(null);

  useEffect(() => {
    let initialHandled = false;
    let mounted = true;
    const reconcile = (event, session) => {
      if (!mounted || (event === 'INITIAL_SESSION' && initialHandled)) return;
      initialHandled = true;
      const owner = session?.user?.id || null;
      if (owner !== sessionOwnerRef.current) {
        queryClientInstance.clear();
        dataCache.clearAll();
        sessionOwnerRef.current = owner;
      }
      const revision = ++revisionRef.current;
      setIsLoadingAuth(false);
      if (!session?.user) {
        setIsAuthenticated(false);
        resetUser();
        const guest = isGuestMode();
        setUser(guest ? GUEST_USER : null);
        setIsGuest(guest);
        return;
      }
      setGuestMode(false);
      setIsGuest(false);
      const basic = normalizeSupabaseUser(session.user);
      setUser((prev) => (prev?.auth_user_id || prev?.id) === basic.id
        ? { ...basic, ...prev, auth_user_id: basic.id, email: basic.email }
        : { ...basic, auth_user_id: basic.id });
      setIsAuthenticated(true);
      identifyUser(basic);
      if (event === 'SIGNED_IN') captureEvent('login_completed');
      // Defer I/O outside Supabase's synchronous auth callback. A completed
      // profile read must still belong to the current session before applying.
      Promise.resolve().then(() => loadUserProfile(session.user)).then((enriched) => {
        if (revision !== revisionRef.current) return;
        setUser((prev) => ({ ...prev, ...enriched }));
        identifyUser(enriched);
        applyPendingReferral(enriched);
        applyPendingSignupGrant();
      });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange(reconcile);
    // Fallback for SDKs that have not emitted INITIAL_SESSION yet. A newer auth
    // event takes precedence over a slow initial getSession response.
    supabase.auth.getSession().then(({ data: { session } }) => reconcile('INITIAL_SESSION', session))
      .catch(() => { if (!initialHandled) reconcile('INITIAL_SESSION', null); });
    return () => { mounted = false; revisionRef.current++; subscription.unsubscribe(); };
  }, []);

  // Ephemeral session: if the user chose not to stay signed in, clear
  // the session when the browser tab/window closes. sessionStorage is
  // automatically cleared on tab close, so we just check for the flag
  // on page load, if it survived a refresh (sessionStorage persists
  // across refreshes) that's fine, but on a fresh tab open after the
  // old one closed the flag will be gone and the Supabase session
  // token in localStorage is what keeps the user logged in.
  // We listen for `beforeunload` and mark a timestamp; on next mount
  // if the gap is >10s the tab was actually closed (not just refreshed).
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionStorage.getItem('geck_inspect_ephemeral_session') === '1') {
        localStorage.setItem('geck_inspect_unload_ts', String(Date.now()));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // On mount: if ephemeral flag existed AND the tab was closed (not
    // a refresh), sign out. Using 10s threshold to avoid false positives
    // on slow connections or heavy pages.
    const unloadTs = localStorage.getItem('geck_inspect_unload_ts');
    if (
      unloadTs &&
      !sessionStorage.getItem('geck_inspect_ephemeral_session') &&
      Date.now() - Number(unloadTs) > 10000
    ) {
      localStorage.removeItem('geck_inspect_unload_ts');
      supabase.auth.signOut();
    }

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Supabase refreshes tokens on foregrounding; reload profile changes as well.
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      const revision = revisionRef.current;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || revision !== revisionRef.current) return;
      const enriched = await loadUserProfile(session.user);
      if (revision !== revisionRef.current) return;
      setUser((prev) => (prev?.auth_user_id || prev?.id) === session.user.id ? { ...prev, ...enriched } : prev);
    };
    const onVisible = () => { void handleVisibilityChange().catch(err => console.warn('Session refresh failed:', err.message)); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const logout = async (shouldRedirect = true) => {
    revisionRef.current++;
    await supabase.auth.signOut();
    setGuestMode(false);
    setIsGuest(false);
    setUser(null);
    setIsAuthenticated(false);
    resetUser();
    if (shouldRedirect) {
      window.location.href = '/';
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/AuthPortal';
  };

  const enterGuestMode = () => {
    revisionRef.current++;
    queryClientInstance.clear();
    dataCache.clearAll();
    captureEvent('guest_mode_entered');
    setGuestMode(true);
    setUser(GUEST_USER);
    setIsGuest(true);
    setIsAuthenticated(false);
  };

  const exitGuestMode = () => {
    setGuestMode(false);
    setIsGuest(false);
    setUser(null);
  };

  // Lets ambient providers (RevenueCatProvider) graft fields onto the
  // current user without overwriting profile state. Used to surface
  // `revenuecat_pro_active` so the synchronous `effectiveTier(user)`
  // check in PlanLimitChecker can see it.
  const mergeUserExtras = (extras, expectedAuthUserId) => {
    if (!extras || typeof extras !== 'object') return;
    setUser((prev) => {
      if (!prev || (expectedAuthUserId && (prev.auth_user_id || prev.id) !== expectedAuthUserId)) return prev;
      return { ...prev, ...extras };
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isGuest,
      isLoadingAuth,
      // Kept for API compatibility with components that destructure these
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      enterGuestMode,
      exitGuestMode,
      mergeUserExtras,
      checkAppState: () => {},
    }}>
      <React.Fragment key={user?.auth_user_id || (user?.is_guest ? 'guest' : 'signed-out')}>
        {children}
      </React.Fragment>
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
