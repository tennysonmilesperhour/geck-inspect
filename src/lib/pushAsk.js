/**
 * When to ask a member to turn on phone notifications.
 *
 * Until October 2026 a banner asked every signed-in member on every page
 * from their first minute, promising "messages, hatch alerts, and
 * inquiries" that a new keeper does not have. Permission asks work when
 * they arrive at the moment the notification would be useful, so the ask
 * now appears only:
 *
 *   - when the member has a gecko AND a reminder switched on for it (there
 *     is something to receive), and
 *   - inside a screen about that reminder (the first-gecko payoff screen,
 *     an in-app feeding reminder), never as a page-wide banner.
 *
 * "Not now" is remembered per device (push is a per-device subscription),
 * and Settings, Notifications always has the full control.
 */

export const PUSH_ASK_DISMISS_KEY = 'geck_push_ask_dismissed_v1';

export function isIOSDevice(nav = typeof navigator !== 'undefined' ? navigator : null) {
  return Boolean(nav) && /iPad|iPhone|iPod/.test(nav.userAgent || '');
}

export function isStandaloneApp(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  try {
    return Boolean(win.matchMedia?.('(display-mode: standalone)').matches) || win.navigator?.standalone === true;
  } catch {
    return false;
  }
}

export function readPushAskDismissed(storage = safeLocalStorage()) {
  try { return storage?.getItem(PUSH_ASK_DISMISS_KEY) === '1'; } catch { return false; }
}

export function writePushAskDismissed(storage = safeLocalStorage()) {
  try { storage?.setItem(PUSH_ASK_DISMISS_KEY, '1'); } catch { /* private mode: ask again next time */ }
}

function safeLocalStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/**
 * Pure decision. Returns one of:
 *   'hidden'  : do not ask
 *   'install' : iPhone in the browser, where Apple only allows push for a
 *               web app added to the Home Screen; show the steps
 *   'ask'     : offer a button that asks the browser for permission
 *
 * Inputs:
 *   user        the signed-in profile (guests never get asked)
 *   hasReminder the member has a gecko with a reminder switched on
 *   supported   the browser can do web push (isPushSupported())
 *   ios, standalone
 *   status      { permission, subscribed } from getPushStatus(), or null
 *               while it loads
 *   dismissed   "Not now" was chosen on this device
 */
export function pushAskState({ user, hasReminder, supported, ios, standalone, status, dismissed }) {
  if (!user?.email || user.is_guest) return 'hidden';
  if (!hasReminder) return 'hidden';
  if (dismissed) return 'hidden';
  // Safari on iPhone hides the push API until the site is on the Home
  // Screen, so the install steps come before any support check.
  if (ios && !standalone) return 'install';
  if (!supported) return 'hidden';
  if (!status) return 'hidden';
  if (status.subscribed) return 'hidden';
  if (status.permission === 'denied') return 'hidden';
  return 'ask';
}

/** Plain words for a failed subscribe, by the reason webPush returns. */
export function pushAskErrorMessage(reason) {
  if (reason === 'permission-denied') {
    return 'Notifications are blocked for Geck Inspect on this device. You can allow them in your browser or phone settings.';
  }
  if (reason === 'no-vapid-key' || reason === 'no-registration') {
    return 'Phone notifications are not available right now. Your reminders still show in the app.';
  }
  return 'That did not work. You can try again from Settings, Notifications. Your reminders still show in the app.';
}
