import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { Eye, UserPlus, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { GUEST_WRITE_BLOCKED_EVENT } from '@/lib/guestMode';

/**
 * Shown when a guest is browsing the authenticated shell. Two jobs:
 *   1. A dismissible banner reminding the visitor they're in view-only
 *      mode with a one-click upgrade path to the AuthPortal.
 *   2. A global listener that turns any blocked-write attempt (from
 *      the Supabase entity layer) into a friendly toast, so the user
 *      never sees a raw RLS / permission error.
 */
export default function GuestBanner() {
  const { isGuest, exitGuestMode } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!isGuest) return;
    const onBlocked = (event) => {
      const action = event?.detail?.action || 'save changes';
      toast({
        title: 'Guest mode is view-only',
        description: `Create a free account to ${action}. Your work can't be saved while browsing as a guest.`,
        action: (
          <Link
            to={createPageUrl('AuthPortal')}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Sign up
          </Link>
        ),
      });
    };
    window.addEventListener(GUEST_WRITE_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(GUEST_WRITE_BLOCKED_EVENT, onBlocked);
  }, [isGuest, toast]);

  if (!isGuest) return null;

  return (
    <div
      role="status"
      className="relative z-20 flex items-center gap-3 border-b border-emerald-500/30 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 px-4 py-2.5 text-sm text-emerald-100 backdrop-blur"
    >
      <Eye className="w-4 h-4 shrink-0 text-emerald-300" />
      <span className="flex-1">
        You&rsquo;re browsing as a <span className="font-semibold text-emerald-200">guest</span> — view-only on private features.
        Create a free account to save geckos, post, and unlock everything.
      </span>
      <Link
        to={createPageUrl('AuthPortal')}
        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 whitespace-nowrap"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Create account
      </Link>
      <button
        type="button"
        onClick={exitGuestMode}
        className="p-1 rounded hover:bg-emerald-500/20 text-emerald-200/70 hover:text-emerald-100"
        aria-label="Exit guest mode"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
