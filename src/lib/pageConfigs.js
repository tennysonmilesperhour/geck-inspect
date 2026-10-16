/**
 * The page_config rows (which pages the admin has switched on or off),
 * loaded once per session and shared.
 *
 * The router (App.jsx) needs them to redirect a switched-off page, and the
 * sidebar (Layout.jsx) needs them to hide it. Each used to fetch the table
 * on its own as the app started, so every signed-in start sent the same
 * request twice (adversarial review, section 08). Both now call
 * loadPageConfigs(), which shares one request and its answer.
 *
 * After the admin changes a page (PageManagement), the cached answer is
 * dropped and the next call fetches again. A failed request is not kept,
 * so the next call retries.
 *
 * A rate-limited answer (HTTP 429) is tried again after a pause, as the
 * sidebar's own fetch was before it moved here (retryApiCall); otherwise
 * one throttled request at start-up would leave switched-off pages in the
 * sidebar and reachable until the next reload.
 */
import { api } from '@/api/appClient';
import { retryApiCall } from '@/lib/layoutCache';

// Pages a page_config row can never switch off: essential navigation, and
// pages that live screens link to (the passport quick log opens Field
// Mode, the Dashboard opens the Gallery, admins send expert reviewers to
// Training). Hiding them in the admin Pages tool only takes them out of
// the sidebar.
export const ALWAYS_ON_PAGES = Object.freeze([
  'Membership', 'Settings', 'AuthPortal', 'Notifications', 'Messages', 'FieldMode', 'Gallery', 'Training',
]);

export const PAGE_CONFIGS_CHANGED = 'page_configs_changed';

let shared = null;

/** The page_config rows. Concurrent and later calls share one request. */
export function loadPageConfigs() {
  if (!shared) {
    const request = Promise.resolve()
      .then(() => retryApiCall(() => api.entities.PageConfig.list()))
      .then((rows) => (Array.isArray(rows) ? rows : []));
    shared = request;
    // A failure is not cached: the next call asks again.
    request.catch(() => {
      if (shared === request) shared = null;
    });
  }
  return shared;
}

/** Forget the cached rows (an admin just changed them). */
export function invalidatePageConfigs() {
  shared = null;
}

/**
 * Page names the router should redirect away from. A page counts as off
 * only when every row for it is off, so a duplicate row the admin has
 * already switched back on does not hide the page.
 */
export function disabledPagesFrom(configs, alwaysOn = ALWAYS_ON_PAGES) {
  const byName = new Map();
  for (const c of Array.isArray(configs) ? configs : []) {
    if (!c?.page_name) continue;
    if (!byName.has(c.page_name)) byName.set(c.page_name, []);
    byName.get(c.page_name).push(c);
  }
  const disabled = new Set();
  for (const [name, rows] of byName.entries()) {
    if (rows.every((r) => r.is_enabled === false)) disabled.add(name);
  }
  for (const page of alwaysOn) disabled.delete(page);
  return disabled;
}

// Registered when this module first loads, before any component adds its
// own listener, so the cache is already empty when App and Layout refetch
// on the same event.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener(PAGE_CONFIGS_CHANGED, invalidatePageConfigs);
}
