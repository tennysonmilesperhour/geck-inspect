import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, normalizeSupabaseUser } from '@/lib/supabaseClient';
import { identifyUser, resetUser } from '@/lib/posthog';
import { isGuestMode, setGuestMode, GUEST_USER } from '@/lib/guestMode';
import { applyPendingReferral } from '@/lib/referral';

const AuthContext = createContext();

async function buildUser(supabaseUser) {
  const base = normalizeSupabaseUser(supabaseUser);
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', supabaseUser.email)
      .maybeSingle();
    if (profile) return { ...base, ...profile };
  } catch (e) {
    console.warn('Profile enrichment failed:', e);
  }
  return base;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(() => isGuestMode());
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // Hydrate from any existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // A real session always wins over a stale guest flag.
        setGuestMode(false);
        setIsGuest(false);
        // Set basic user immediately so loading clears, then enrich with profile
        const basic = normalizeSupabaseUser(session.user);
        setUser(basic);
        setIsAuthenticated(true);
        identifyUser(basic);
        buildUser(session.user).then((enriched) => {
          setUser(enriched);
          identifyUser(enriched);
        });
      } else if (isGuestMode()) {
        // Keep guest mode alive across refreshes within the tab.
        setUser(GUEST_USER);
        setIsGuest(true);
      }
      setIsLoadingAuth(false);
    });

    // Keep auth state in sync with Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setGuestMode(false);
        setIsGuest(false);
        const basic = normalizeSupabaseUser(session.user);
        setUser(basic);
        setIsAuthenticated(true);
        identifyUser(basic);
        buildUser(session.user).then((enriched) => {
          setUser(enriched);
          identifyUser(enriched);
          // Best-effort: link this account to whoever referred them, if a
          // ?ref=<code> was captured before signup. Fire-and-forget; any
          // failure is logged but never blocks the auth flow.
          applyPendingReferral(enriched);
        });
      } else {
        setIsAuthenticated(false);
        resetUser();
        if (isGuestMode()) {
          setUser(GUEST_USER);
          setIsGuest(true);
        } else {
          setUser(null);
          setIsGuest(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Ephemeral session: if the user chose not to stay signed in, clear
  // the session when the browser tab/window closes. sessionStorage is
  // automatically cleared on tab close, so we just check for the flag
  // on page load — if it survived a refresh (sessionStorage persists
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

  // Proactively refresh the session when the tab regains visibility.
  // Without this, a tab left in the background can accumulate an expired
  // JWT — and every API call fails with 401 until the user hard-refreshes.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user) {
            buildUser(session.user).then((enriched) => {
              setUser(enriched);
              identifyUser(enriched);
            });
          }
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const logout = async (shouldRedirect = true) => {
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
      checkAppState: () => {},
    }}>
      {children}
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
