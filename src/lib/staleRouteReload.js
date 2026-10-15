/**
 * One reload for a "Page not found" reached from inside a running app.
 *
 * Members keep tabs open for hours. After a deploy, a tab still runs the
 * app it loaded, which does not know pages added since: tapping "View" on
 * a reminder that links to a new page (for example the one-tap log at
 * /log) showed "Page not found" until the member reloaded by hand. A fresh
 * load fetches the current app, which may know the address, so the
 * not-found page reloads once by itself.
 *
 * It only does so when the address is not the one this page load started
 * on: a not-found on the first load already came from the current app
 * (the server answers unknown addresses with a 404 there). A per-tab
 * marker for each address makes sure it never reloads twice for the same
 * one, so a link that is really broken shows "Page not found" after a
 * single extra load.
 */

const KEY_PREFIX = 'gi:notfound-reload:';

// Where this page load started, read once when the app starts.
const BOOT_PATH = typeof window !== 'undefined' && window.location ? window.location.pathname : null;

function sessionStore() {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/**
 * True when a not-found for `pathname` should reload the page once, and
 * marks it so it will not again. `bootPath` and `storage` are for tests.
 */
export function claimStaleRouteReload(pathname, { bootPath = BOOT_PATH, storage = sessionStore() } = {}) {
  if (!pathname || !bootPath || pathname === bootPath || !storage) return false;
  const key = KEY_PREFIX + pathname;
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, '1');
    // Read it back: storage that silently drops writes would otherwise
    // reload on every visit.
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}
