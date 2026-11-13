// Fetch the code for the phone's tab screens while the first screen sits
// idle (experience review L4), so the first tap on Today, Geckos or Log
// does not wait on the network.
//
// Only the signed-in shell calls this (src/Layout.jsx), never a public
// page: those are size-budgeted, and a visitor reading the Morph Guide
// should not pay for screens they may never open.
//
// The imports name the same files as the routes (src/pages.config.js and
// src/App.jsx), so the browser fetches each file once and the route then
// finds it already loaded. A failed fetch is ignored: the route loads the
// page itself when it is opened.
const loadTabs = () => {
  import('@/pages/Today').catch(() => {});
  import('@/pages/MyGeckos').catch(() => {});
  import('@/pages/QuickLog').catch(() => {});
};

/**
 * True when the phone asked to save data, or reports a 2G connection.
 * Browsers that do not report a connection (Safari, Firefox) count as fine.
 */
export function onSlowConnection(nav = globalThis.navigator) {
  const connection = nav?.connection;
  return Boolean(connection?.saveData) || /(^|-)2g$/.test(String(connection?.effectiveType || ''));
}

/**
 * Starts the fetch once the browser is idle (or after 2 seconds where it
 * cannot say when it is idle). Returns a function that cancels a fetch
 * that has not started yet.
 */
export function warmPhoneTabs({ win = globalThis.window, nav = globalThis.navigator, load = loadTabs } = {}) {
  if (!win || onSlowConnection(nav)) return () => {};
  if (typeof win.requestIdleCallback === 'function') {
    const id = win.requestIdleCallback(() => load(), { timeout: 4000 });
    return () => win.cancelIdleCallback?.(id);
  }
  const timer = win.setTimeout(() => load(), 2000);
  return () => win.clearTimeout(timer);
}
