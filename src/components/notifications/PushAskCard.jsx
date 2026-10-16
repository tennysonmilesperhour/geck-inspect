import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { getPushStatus, isPushSupported, subscribeToPush } from '@/lib/webPush';
import { captureEvent } from '@/lib/posthog';
import {
  isIOSDevice,
  isStandaloneApp,
  pushAskErrorMessage,
  pushAskState,
  readPushAskDismissed,
  writePushAskDismissed,
} from '@/lib/pushAsk';

/**
 * The only place Geck Inspect asks for phone notifications outside
 * Settings. It sits next to a reminder the member just switched on (the
 * first-gecko payoff screen) or one the app is showing (a feeding
 * reminder), and stays hidden unless there is a reminder to receive.
 * See src/lib/pushAsk.js for the rules.
 *
 * Props:
 *   user        signed-in profile
 *   hasReminder at least one reminder is on for a gecko
 *   subject     what the reminders are about, e.g. "Mango's reminders"
 *   source      where it is shown, for the push_ask event
 *   compact     one line, for the floating reminder stack
 */
export default function PushAskCard({ user, hasReminder, subject = 'your reminders', source, compact = false }) {
  const [status, setStatus] = useState(null);
  const [dismissed, setDismissed] = useState(() => readPushAskDismissed());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }

  const supported = isPushSupported();
  const ios = isIOSDevice();
  const standalone = isStandaloneApp();

  useEffect(() => {
    if (!hasReminder || !user?.email || user.is_guest || !supported) return undefined;
    let cancelled = false;
    getPushStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus(null); });
    return () => { cancelled = true; };
  }, [hasReminder, user?.email, user?.is_guest, supported]);

  const state = pushAskState({ user, hasReminder, supported, ios, standalone, status, dismissed });

  useEffect(() => {
    if (state !== 'hidden') captureEvent('push_ask', { action: 'shown', kind: state, source });
  }, [state, source]);

  if (result?.ok) {
    return (
      <p role="status" className={`flex items-center gap-2 text-sm text-slate-200 ${compact ? 'rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2' : ''}`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
        Done. {capitalise(subject)} will reach this device.
      </p>
    );
  }
  if (state === 'hidden') return null;

  const notNow = () => {
    writePushAskDismissed();
    setDismissed(true);
    captureEvent('push_ask', { action: 'not_now', kind: state, source });
  };

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    captureEvent('push_ask', { action: 'clicked', source });
    try {
      const res = await subscribeToPush(user.email);
      if (res.ok) {
        setResult({ ok: true });
        captureEvent('push_ask', { action: 'enabled', source });
      } else {
        setResult({ ok: false, message: pushAskErrorMessage(res.reason) });
        captureEvent('push_ask', { action: 'failed', reason: res.reason, source });
      }
    } catch {
      setResult({ ok: false, message: pushAskErrorMessage('subscribe-failed') });
    }
    setBusy(false);
  };

  const settingsLink = `${createPageUrl('Settings')}#push-notifications`;

  if (compact) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-200">
        {state === 'install' ? (
          <p>
            Want these on your iPhone? <Link to={settingsLink} className="underline underline-offset-2 text-slate-50">See how</Link>
            {' · '}
            <button type="button" onClick={notNow} className="touch:min-h-11 underline underline-offset-2 text-slate-300">Not now</button>
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Bell className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>Get {subject} on this device.</span>
            <button type="button" onClick={turnOn} disabled={busy} className="touch:min-h-11 font-semibold underline underline-offset-2 text-slate-50">
              {busy ? 'Turning on...' : 'Turn on'}
            </button>
            <button type="button" onClick={notNow} className="touch:min-h-11 underline underline-offset-2 text-slate-300">Not now</button>
          </p>
        )}
        {result && !result.ok && <p role="alert" className="mt-1 text-amber-200">{result.message}</p>}
      </div>
    );
  }

  return (
    <section aria-label="Phone notifications" className="rounded-xl border border-slate-700 bg-slate-800/40 p-3">
      {state === 'install' ? (
        <div className="flex items-start gap-2.5">
          <Smartphone className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-slate-100">Get {subject} on your iPhone</p>
            <p className="text-xs text-slate-300">
              Apple only sends notifications to web apps on the Home Screen. In Safari, tap Share, then Add to Home Screen,
              then open Geck Inspect from the new icon and turn notifications on in Settings.
            </p>
            <button type="button" onClick={notNow} className="touch:min-h-11 text-xs text-slate-300 underline underline-offset-2">
              Not now
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5">
          <Bell className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <p className="text-sm font-medium text-slate-100">Get {subject} as phone notifications</p>
              <p className="text-xs text-slate-300">So a weigh-in or feeding day reaches you even when Geck Inspect is closed. You can switch it off in Settings.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={turnOn}
                disabled={busy}
                className="inline-flex min-h-11 items-center rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-70"
              >
                {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Turning on...</> : 'Turn on notifications'}
              </button>
              <button type="button" onClick={notNow} className="min-h-11 px-2 text-sm text-slate-300 underline underline-offset-2">
                Not now
              </button>
            </div>
            {result && !result.ok && <p role="alert" className="text-xs text-amber-200">{result.message}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function capitalise(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
