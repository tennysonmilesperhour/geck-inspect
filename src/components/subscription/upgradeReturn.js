// Where the member was when a plan limit sent them to the plans page
// (experience review, finding J5). After paying they used to be left on
// /Membership; now the confirmation offers one button back to that page.
//
// The path is written when an upgrade link is followed
// (UpgradePlansButton.jsx) and read once by the Membership page when the
// new plan is confirmed. It lives in sessionStorage, so it stays in the
// tab that goes to Stripe and comes back, and it is checked on the way in
// and again on the way out: only a path inside Geck Inspect is ever used.
import { safeInternalPath } from '@/lib/safeInternalPath';

const RETURN_KEY = 'geck_upgrade_return_path';
// The same hour the clicked prompt is remembered for (src/lib/upgradePrompt.js).
const RETURN_TTL_MS = 60 * 60 * 1000;
const MAX_PATH_LENGTH = 2000;

function box(store) {
  if (store) return store;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch {
    // private mode: nothing is remembered and the page behaves as before
  }
  return null;
}

function currentPath() {
  try {
    const { pathname, search = '', hash = '' } = window.location;
    return typeof pathname === 'string' ? `${pathname}${search}${hash}` : null;
  } catch {
    return null;
  }
}

/**
 * The path if it is a page inside Geck Inspect worth going back to, or
 * null. Another website, a protocol-relative link and the plans page
 * itself are all refused.
 */
export function upgradeReturnPath(path) {
  const safe = safeInternalPath(path, null);
  if (!safe || safe.length > MAX_PATH_LENGTH) return null;
  const pathname = safe.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  if (pathname === '/membership') return null;
  return safe;
}

/** Remember the page an upgrade link was followed from. Defaults to this page. */
export function rememberUpgradeReturn(path, now = Date.now(), store) {
  const safe = upgradeReturnPath(path === undefined ? currentPath() : path);
  const target = box(store);
  if (!safe || !target) return false;
  try {
    target.setItem(RETURN_KEY, JSON.stringify({ path: safe, at: now }));
    return true;
  } catch {
    return false;
  }
}

/** The remembered page, or null when there is none, it is stale or it is not ours. */
export function readUpgradeReturn(now = Date.now(), store) {
  const target = box(store);
  if (!target) return null;
  try {
    const parsed = JSON.parse(target.getItem(RETURN_KEY) || 'null');
    if (!parsed || now - Number(parsed.at || 0) > RETURN_TTL_MS) return null;
    return upgradeReturnPath(parsed.path);
  } catch {
    return null;
  }
}

export function clearUpgradeReturn(store) {
  try {
    box(store)?.removeItem(RETURN_KEY);
  } catch {
    // nothing to clear
  }
}

/** Read the remembered page and forget it, so it is offered once. */
export function takeUpgradeReturn(now = Date.now(), store) {
  const path = readUpgradeReturn(now, store);
  clearUpgradeReturn(store);
  return path;
}
