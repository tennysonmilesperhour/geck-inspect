import { useState } from 'react';
import { CreditCard, X } from 'lucide-react';
import { openBillingPortal } from '@/lib/billingPortal';
import { TIER_LIMITS } from '@/lib/tierLimits';
import { SUPPORT_EMAIL } from '@/lib/supportContact';

const DISMISS_KEY = 'geck_payment_issue_dismissed';

function dismissedThisSession() {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

/**
 * Tells a member when Stripe could not take their last membership payment
 * (subscription_status past_due). Stripe keeps retrying and access stays on
 * while it does, but without this the member would only find out when the
 * plan ends. Dismissing hides it for this browser session only, so it comes
 * back until the card is fixed.
 */
export default function PaymentIssueBanner({ user }) {
  const [hidden, setHidden] = useState(dismissedThisSession);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!user || user.is_guest || user.subscription_status !== 'past_due' || hidden) return null;

  const label = TIER_LIMITS[user.membership_tier]?.label || 'membership';

  const update = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const here = typeof window !== 'undefined' ? window.location.pathname : '';
      await openBillingPortal({ returnPath: here || '/Membership' });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* still hide it for now */ }
    setHidden(true);
  };

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-amber-600/40 bg-amber-950/60 px-4 py-2.5 text-sm text-amber-50"
    >
      <CreditCard className="h-4 w-4 flex-shrink-0 text-amber-300" aria-hidden="true" />
      <span className="flex-1 leading-snug">
        Your last {label} payment did not go through. Update your card so your plan keeps working.
        {failed && ` The billing page would not open. Email ${SUPPORT_EMAIL} and we will sort it out.`}
      </span>
      <button
        type="button"
        onClick={update}
        disabled={busy}
        className="flex-shrink-0 inline-flex items-center touch:min-h-11 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60 transition-colors"
      >
        {busy ? 'Opening...' : 'Update payment'}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide the payment notice for now"
        className="touch:min-h-11 touch:min-w-11 flex-shrink-0 rounded-md p-1 text-amber-200/70 hover:text-amber-50 hover:bg-amber-900/40 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
