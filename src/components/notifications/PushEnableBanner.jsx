import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { isPushSupported, getPushStatus } from '@/lib/webPush';

const DISMISS_KEY = 'geck_push_banner_dismissed_v1';

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent || '');

const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
};

/**
 * One-line discoverability banner that nudges authenticated users to
 * turn on push notifications on the current device. Per-device dismissal
 * lives in localStorage so dismissing on desktop still nudges on phone,
 * which matches push being a per-device subscription anyway.
 */
export default function PushEnableBanner({ user }) {
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);

  const dismissed = useCallback(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; }
    catch { return false; }
  }, []);

  const evaluate = useCallback(async () => {
    if (!user?.email) { setVisible(false); return; }
    if (dismissed()) { setVisible(false); return; }
    if (!isPushSupported()) { setVisible(false); return; }

    const onIOS = isIOS();
    const installed = isStandalone();
    if (onIOS && !installed) {
      setNeedsInstall(true);
      setVisible(true);
      return;
    }

    const status = await getPushStatus();
    if (status.subscribed) { setVisible(false); return; }
    if (status.permission === 'denied') { setVisible(false); return; }

    setNeedsInstall(false);
    setVisible(true);
  }, [user?.email, dismissed]);

  useEffect(() => { evaluate(); }, [evaluate, location.pathname]);

  useEffect(() => {
    const onFocus = () => evaluate();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [evaluate]);

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setVisible(false);
  };

  const onSettings = location.pathname.toLowerCase().startsWith('/settings');
  if (!visible || onSettings) return null;

  const copy = needsInstall
    ? 'Get push alerts on this iPhone. Tap Share, then Add to Home Screen, then open Geck Inspect from the icon.'
    : 'Turn on push notifications so messages, hatch alerts, and inquiries reach you on this device.';

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-emerald-700/40 bg-emerald-900/40 px-4 py-2.5 text-sm text-emerald-50 backdrop-blur"
    >
      <Bell className="h-4 w-4 flex-shrink-0 text-emerald-300" aria-hidden="true" />
      <span className="flex-1 leading-snug">{copy}</span>
      <Link
        to={`${createPageUrl('Settings')}#push-notifications`}
        className="flex-shrink-0 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
      >
        Enable
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss push notification reminder"
        className="flex-shrink-0 rounded-md p-1 text-emerald-200/70 hover:text-emerald-50 hover:bg-emerald-800/40 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
