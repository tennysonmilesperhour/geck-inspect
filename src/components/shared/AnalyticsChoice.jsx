import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { analyticsAllowed, browserOptsOut, CONSENT_EVENT, setConsent } from '@/lib/analyticsConsent';

/**
 * The privacy policy's analytics switch: says whether Google Analytics and
 * PostHog run in this browser and lets the visitor change it. Withdrawing
 * consent has to be as easy as giving it, and this works for every
 * visitor, not only those asked by the consent banner.
 *
 * Every label names Google Analytics and PostHog, because that is all the
 * switch controls. Geck Inspect's own page and feature count
 * (src/lib/telemetry.js) keeps running either way, so a bare "analytics
 * off" would overstate what the switch does.
 */
export default function AnalyticsChoice() {
  const [on, setOn] = useState(() => (typeof window === 'undefined' ? false : analyticsAllowed()));

  useEffect(() => {
    const refresh = () => setOn(analyticsAllowed());
    window.addEventListener(CONSENT_EVENT, refresh);
    return () => window.removeEventListener(CONSENT_EVENT, refresh);
  }, []);

  if (typeof window !== 'undefined' && browserOptsOut()) {
    return (
      <p data-analytics-choice="browser-off">
        Your browser sends Do Not Track or Global Privacy Control, so Google Analytics and PostHog are off in this browser.
      </p>
    );
  }

  return (
    <div data-analytics-choice={on ? 'on' : 'off'} className="flex flex-wrap items-center gap-3">
      <span>Google Analytics and PostHog in this browser: <strong className="text-slate-300">{on ? 'on' : 'off'}</strong>.</span>
      {on ? (
        <Button size="sm" variant="outline" onClick={() => setConsent('denied')}>
          Turn them off
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setConsent('granted')}>
          Allow them
        </Button>
      )}
    </div>
  );
}
