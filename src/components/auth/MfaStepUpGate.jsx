import { Suspense, useEffect, useRef, useState } from 'react';
import { lazy } from '@/lib/lazyWithRetry';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

// The code screen is only ever drawn for an account with an authenticator
// (the admin), so members never download it.
const MfaCodePrompt = lazy(() => import('@/components/auth/MfaCodePrompt'));

// Auth events after which the session's assurance level may have changed.
const RECHECK_EVENTS = new Set(['SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED', 'MFA_CHALLENGE_VERIFIED']);

/**
 * True when the session has not passed the code step yet but the account
 * has a verified authenticator: what mfa.getAuthenticatorAssuranceLevel()
 * reports as currentLevel aal1 with nextLevel aal2. Kept here rather than
 * in src/lib/mfa.js so the app shell does not load the setup helpers.
 */
export function needsCodeStep(aal) {
  return Boolean(aal) && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
}

const Waiting = (
  <div className="fixed inset-0 flex items-center justify-center bg-slate-950" role="status" aria-label="Checking your sign-in">
    <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
  </div>
);

/**
 * Whether this session still owes an authenticator code: 'checking',
 * 'needed' or 'none', and a function that asks again. Asks Supabase
 * (mfa.getAuthenticatorAssuranceLevel, which reads the stored session, no
 * network) on sign-in and again after each auth event that can change the
 * answer.
 */
export function useCodeStep(active) {
  const [step, setStep] = useState(active ? 'checking' : 'none');
  const recheckRef = useRef(() => {});
  useEffect(() => {
    if (!active) {
      setStep('none');
      return undefined;
    }
    let live = true;
    setStep((prev) => (prev === 'none' ? 'checking' : prev));
    const check = () => supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data, error }) => {
        // On an error the app opens as before. The database is what
        // guards admin powers (is_admin() with the admin_requires_mfa
        // switch); this screen is where the code gets typed.
        if (live) setStep(!error && needsCodeStep(data) ? 'needed' : 'none');
      })
      .catch(() => { if (live) setStep('none'); });
    recheckRef.current = check;
    check();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Run after Supabase's own callback has finished (it holds a lock).
      if (RECHECK_EVENTS.has(event)) setTimeout(check, 0);
    });
    return () => {
      live = false;
      recheckRef.current = () => {};
      data?.subscription?.unsubscribe();
    };
  }, [active]);
  return [step, () => recheckRef.current()];
}

/**
 * Wraps the signed-in app shell (Layout). A session that signed in with a
 * password or link, on an account with an authenticator, sees the code
 * screen instead of any page until the code is typed. Everyone else sees
 * the app exactly as before; only an admin waits the moment it takes to
 * read the session, so an admin screen never shows before the question.
 */
export default function MfaStepUpGate({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [step, recheck] = useCodeStep(isAuthenticated);
  if (step === 'needed') {
    return (
      <Suspense fallback={Waiting}>
        <MfaCodePrompt onVerified={recheck} />
      </Suspense>
    );
  }
  if (step === 'checking' && user?.role === 'admin') return Waiting;
  return children;
}
