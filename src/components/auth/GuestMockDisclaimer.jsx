import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { ChevronUp, Info, LogIn, UserPlus, X } from 'lucide-react';

/**
 * Bottom-right floating disclaimer shown throughout guest mode.
 *
 * Requirements (from the product ask):
 *   - Semi-transparent yellow, demo-y and distinct from the green app
 *   - Distinguishes sample collection records from public community activity
 *   - Notes the images are fair-use demos and may not actually match
 *     the traits they're being paired with
 *   - Login / Create-account buttons adjacent, but not obtrusive
 *   - Dismissible, so the user can hide it mid-demo if it's in the way
 *
 * Dismissal is per-tab (sessionStorage), when guest mode ends the
 * flag can go stale but that's fine since we stop rendering anyway.
 * The guest write-block toast lives in GuestDemoGuide, which is mounted
 * for the whole guest session (this notice is not, during the tour).
 */
const DISMISS_KEY = 'geck_inspect_guest_disclaimer_dismissed';
// Opens AuthPortal on the Create Account tab rather than Sign In.
const SIGNUP_URL = '/AuthPortal?mode=signup';

export default function GuestMockDisclaimer() {
  const { isGuest } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (!isGuest || dismissed) return null;

  const handleDismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-floating-notice
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] pointer-events-auto"
    >
      <div
        className="rounded-xl border border-yellow-300/50 bg-yellow-400/20 text-yellow-50 shadow-lg shadow-black/30 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(250, 204, 21, 0.18)' }}
      >
        {/* On phones the notice starts as one slim line so it does not
            cover the demo it is describing; the full text is one tap away.
            From md up there is room, so it always shows in full. */}
        <div className="flex items-center md:items-start gap-2 md:gap-2.5 p-2 md:p-3">
          <Info className="w-4 h-4 shrink-0 md:mt-0.5 text-yellow-200" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-bold text-yellow-200 whitespace-nowrap md:mb-1">
              Guest demo
            </p>
            {!expanded && (
              <p className="md:hidden text-[11px] leading-tight text-yellow-100/90 truncate">
                Sample data only
              </p>
            )}
            <div className={expanded ? 'block mt-1' : 'hidden md:block'}>
              <p className="text-xs leading-snug text-yellow-50/95">
                Demo collection records are samples; public community activity may
                be live. Sample photos illustrate the layout and may not match
                their listed traits. Create an account to save your own records.
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  to={createPageUrl('AuthPortal')}
                  className="inline-flex items-center gap-1 touch:min-h-11 rounded-md bg-yellow-300/25 hover:bg-yellow-300/40 px-2.5 py-1.5 text-[11px] font-semibold text-yellow-50"
                >
                  <LogIn className="w-3 h-3" />
                  Sign in
                </Link>
                <Link
                  to={SIGNUP_URL}
                  className="inline-flex items-center gap-1 touch:min-h-11 rounded-md bg-emerald-500/80 hover:bg-emerald-400/90 px-2.5 py-1.5 text-[11px] font-semibold text-white"
                >
                  <UserPlus className="w-3 h-3" />
                  Create account
                </Link>
              </div>
            </div>
          </div>
          {!expanded && (
            <>
              <Link
                to={SIGNUP_URL}
                className="md:hidden shrink-0 inline-flex items-center gap-1 min-h-9 touch:min-h-11 rounded-md bg-emerald-500/80 hover:bg-emerald-400/90 px-3 text-xs font-semibold text-white"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Sign up
              </Link>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="md:hidden shrink-0 inline-flex items-center justify-center min-h-9 min-w-9 touch:min-h-11 touch:min-w-11 rounded hover:bg-yellow-300/20 text-yellow-100/80 hover:text-yellow-50"
                aria-label="Show guest demo details"
                aria-expanded="false"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 inline-flex items-center justify-center min-h-9 min-w-9 md:min-h-0 md:min-w-0 md:p-1 touch:min-h-11 touch:min-w-11 rounded hover:bg-yellow-300/20 text-yellow-100/80 hover:text-yellow-50"
            aria-label="Dismiss guest demo notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
