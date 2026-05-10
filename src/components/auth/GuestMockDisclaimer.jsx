import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { Info, LogIn, UserPlus, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { GUEST_WRITE_BLOCKED_EVENT } from '@/lib/guestMode';

/**
 * Bottom-right floating disclaimer shown throughout guest mode.
 *
 * Requirements (from the product ask):
 *   - Semi-transparent yellow ,  demo-y and distinct from the green app
 *   - Explains that everything on screen is mock data
 *   - Notes the images are fair-use demos and may not actually match
 *     the traits they're being paired with
 *   - Login / Create-account buttons adjacent, but not obtrusive
 *   - Dismissible, so the user can hide it mid-demo if it's in the way
 *
 * Dismissal is per-tab (sessionStorage) ,  when guest mode ends the
 * flag can go stale but that's fine since we stop rendering anyway.
 * We also pipe guest write-block events into a toast here, keeping
 * all guest-mode UX in one component.
 */
const DISMISS_KEY = 'geck_inspect_guest_disclaimer_dismissed';

export default function GuestMockDisclaimer() {
  const { isGuest } = useAuth();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!isGuest) return;
    const onBlocked = (event) => {
      const action = event?.detail?.action || 'save changes';
      toast({
        title: 'Guest mode is view-only',
        description: `Create a free account to ${action}. Nothing gets saved while you're browsing as a guest.`,
      });
    };
    window.addEventListener(GUEST_WRITE_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(GUEST_WRITE_BLOCKED_EVENT, onBlocked);
  }, [isGuest, toast]);

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
      className="fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] pointer-events-auto"
    >
      <div
        className="rounded-xl border border-yellow-300/50 bg-yellow-400/20 text-yellow-50 shadow-lg shadow-black/30 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(250, 204, 21, 0.18)' }}
      >
        <div className="flex items-start gap-2.5 p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-yellow-200" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider font-bold text-yellow-200 mb-1">
              Guest demo
            </p>
            <p className="text-xs leading-snug text-yellow-50/95">
              Everything shown here is mock data. Photos are fair-use demo
              images and don&rsquo;t necessarily reflect the traits they&rsquo;re
              paired with ,  they&rsquo;re here only to show what the UI looks
              like populated.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <Link
                to={createPageUrl('AuthPortal')}
                className="inline-flex items-center gap-1 rounded-md bg-yellow-300/25 hover:bg-yellow-300/40 px-2.5 py-1 text-[11px] font-semibold text-yellow-50"
              >
                <LogIn className="w-3 h-3" />
                Sign in
              </Link>
              <Link
                to={createPageUrl('AuthPortal')}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-500/80 hover:bg-emerald-400/90 px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                <UserPlus className="w-3 h-3" />
                Create account
              </Link>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded hover:bg-yellow-300/20 text-yellow-100/80 hover:text-yellow-50"
            aria-label="Dismiss guest demo notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
