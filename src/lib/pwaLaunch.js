// Where an installed app (a home-screen or desktop install) should go
// when it opens, once per session (handlePwaLaunch, called from
// src/App.jsx), and which page the first screen shows (warmFirstScreen in
// src/App.jsx starts downloading it early).
//
// The manifest (public/manifest.json) starts the app at /Today, the
// phone's first tab (review item E3 25). Before that it started at
// /MyGeckos, and older installs keep the address they were saved with
// (iOS caches the manifest), so:
//   * a phone opening at /, /Messages or a plain /MyGeckos goes to Today;
//   * a laptop or desktop opening at /, /Messages or a plain /Today goes
//     to My Geckos, where desktop installs have always opened (Today is
//     the phone's home; the desktop keeps the sidebar).
// A launch with anything in the query string is a deep link (a reminder
// or a share) and is left alone.
//
// The manifest also names the app "id": "/MyGeckos". Without an id, a
// browser identifies an installed app by its start address, so moving
// start_url from /MyGeckos to /Today would have made existing installs a
// different app that never receives manifest updates. The id keeps the
// identity they were installed with.

/**
 * Phones: the width below which the app shows the bottom tab bar and opens
 * on Today (Tailwind's md breakpoint, as in Layout.jsx).
 */
export const PHONE_QUERY = '(max-width: 767px)';

/** Set for the rest of the session once a launch has been handled. */
export const LAUNCH_HANDLED_KEY = 'pwa_launch_handled';

const normalisePath = (pathname) => String(pathname || '/').replace(/\/+$/, '') || '/';

/**
 * Path to go to when an installed app opens at pathname + search + hash, or
 * null to stay. An address with a fragment stays put: a sign-up
 * confirmation or sign-in link returns with its tokens after '#', and moving
 * the page before the session is saved from them would lose the sign-in.
 */
export function pwaLaunchTarget(pathname, search, phone, hash = '') {
  if (hash && hash !== '#') return null;
  const path = normalisePath(pathname);
  if (path === '/' || path === '/Messages') return phone ? '/Today' : '/MyGeckos';
  if (search) return null;
  if (phone && path === '/MyGeckos') return '/Today';
  if (!phone && path === '/Today') return '/MyGeckos';
  return null;
}

/**
 * Where a member lands after signing in when nothing else was asked for:
 * Today on a phone (the phone's first tab), My Geckos on a larger screen.
 */
export function memberHome(win = globalThis.window) {
  return isPhoneScreen(win) ? '/Today' : '/MyGeckos';
}

/** Whether this window is phone sized (see PHONE_QUERY). */
export function isPhoneScreen(win = globalThis.window) {
  try {
    return Boolean(win?.matchMedia?.(PHONE_QUERY).matches);
  } catch {
    return false;
  }
}

/** Whether this window is the installed app rather than a browser tab. */
export function isInstalledApp(win = globalThis.window) {
  try {
    return Boolean(win?.matchMedia?.('(display-mode: standalone)').matches || win?.navigator?.standalone === true);
  } catch {
    return false;
  }
}

function launchAlreadyHandled(win) {
  try {
    return Boolean(win.sessionStorage.getItem(LAUNCH_HANDLED_KEY));
  } catch {
    // No session storage: the handler could not remember it ran, so it
    // never sends anyone anywhere (a loop would be worse than no move).
    return true;
  }
}

/**
 * Where this open of the installed app is about to be sent, without
 * handling it: null in a browser tab, after the first open of the
 * session, or when the app stays where it opened.
 */
export function pendingPwaLaunch(win = globalThis.window) {
  if (!win || launchAlreadyHandled(win) || !isInstalledApp(win)) return null;
  return pwaLaunchTarget(win.location?.pathname, win.location?.search, isPhoneScreen(win), win.location?.hash);
}

/**
 * The launch handler: on the first open of a session in the installed
 * app, remembers that the launch was handled and calls go(target) when
 * the app should open somewhere else. Returns the target, or null.
 */
export function handlePwaLaunch(win, go) {
  if (!win || launchAlreadyHandled(win) || !isInstalledApp(win)) return null;
  try {
    win.sessionStorage.setItem(LAUNCH_HANDLED_KEY, '1');
  } catch {
    return null;
  }
  const target = pwaLaunchTarget(win.location?.pathname, win.location?.search, isPhoneScreen(win), win.location?.hash);
  if (target) go(target);
  return target;
}

/**
 * The page a signed-in member (or a demo guest) first sees at path:
 * 'Today', 'Dashboard', 'MyGeckos', or null for anything else. "/" is
 * Today on a phone (Layout.jsx moves phones there) and the Dashboard on
 * wider screens.
 */
export function firstScreenPage(pathname, phone) {
  const path = normalisePath(pathname);
  if (path === '/Today') return 'Today';
  if (path === '/') return phone ? 'Today' : 'Dashboard';
  if (path === '/Dashboard') return 'Dashboard';
  if (path === '/MyGeckos') return 'MyGeckos';
  return null;
}
