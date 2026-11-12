import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CONSENT_EVENT, needsConsentPrompt, setConsent } from '@/lib/analyticsConsent';
import { useFloatingNotice } from '@/components/shared/floatingNoticeQueue';

/**
 * The analytics question for visitors in the EEA and the UK.
 *
 * Google Analytics and PostHog set cookies, which EU and UK law only allows
 * after the visitor agrees. This banner asks once and remembers the answer
 * in this browser; after that, the switch on the privacy policy
 * (AnalyticsChoice.jsx) is where the visitor changes it. Everyone else
 * never sees it (needsConsentPrompt in src/lib/analyticsConsent.js decides).
 *
 * The wording names Google Analytics and PostHog on purpose and promises
 * only that those two stay off. Geck Inspect's own page and feature count
 * (src/lib/telemetry.js, the user_events table behind the admin
 * dashboards) is not part of this choice and keeps running, so the banner
 * must never say that nothing is counted. Section 5 of the privacy policy
 * describes that count.
 *
 * It does not block the page: until the visitor answers, Google Analytics
 * and PostHog simply stay off. It is second in the floating notice queue
 * (floatingNoticeQueue.js), so it waits behind an app update notice and
 * shows ahead of the offline status and the guest tour.
 */
export default function ConsentBanner() {
  const [open, setOpen] = useState(() => (typeof window === 'undefined' ? false : needsConsentPrompt()));

  useEffect(() => {
    // A choice made elsewhere (the privacy policy's switch) fires this
    // event; the banner closes once any choice is stored.
    const recheck = () => setOpen(needsConsentPrompt());
    window.addEventListener(CONSENT_EVENT, recheck);
    return () => window.removeEventListener(CONSENT_EVENT, recheck);
  }, []);

  const showing = useFloatingNotice('consent', open);
  if (!showing) return null;

  const choose = (choice) => {
    setConsent(choice);
    setOpen(false);
  };

  return (
    <div
      role="region"
      aria-label="Analytics choice"
      data-consent-banner
      data-floating-notice="consent"
      data-follows-bottom-bar
      className="fixed left-4 right-4 sm:right-auto sm:max-w-sm bottom-[calc(var(--bottom-bar-h)+1rem)] md:bottom-4 z-[70] rounded-xl border border-slate-700 bg-slate-900/95 p-4 text-sm text-slate-300 shadow-xl shadow-black/40 backdrop-blur"
    >
      <p className="font-semibold text-slate-100">Allow analytics cookies?</p>
      <p className="mt-1 leading-relaxed">
        We use Google Analytics and PostHog to see which pages help keepers. They set cookies, so we ask first.
        Google Analytics and PostHog stay off unless you accept.{' '}
        <Link to="/PrivacyPolicy" className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300">
          Privacy policy
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => choose('granted')}>
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={() => choose('denied')}>
          Decline
        </Button>
      </div>
    </div>
  );
}
