// The member's home screen, and how each way in reaches it.
//
// One home on every device (experience review C1, decision 2, 13 Nov
// 2026): Today. memberHome() below is the only place that says so. It
// answers for a sign-in, for "/" opened by a signed-in member or a demo
// guest (HomeRedirect in src/App.jsx), for the logo and the home link in
// the menu (src/Layout.jsx), and for the installed app's first open of a
// session (handlePwaLaunch, called from src/App.jsx). Before this a phone
// opened on Today, a laptop on My Geckos after signing in and on the
// Dashboard at "/" or from the logo. The Dashboard is still a page:
// Today's toggle and the quick search call it "Overview".
//
// The manifest (public/manifest.json) starts the app at /Today. Before
// review item E3 25 it started at /MyGeckos, and older installs keep the
// address they were saved with (iOS caches the manifest), so an install
// opening at /, /Messages or a plain /MyGeckos goes to Today. A launch
// with anything in the query string is a deep link (a reminder or a
// share) and is left alone.
//
// The manifest also names the app "id": "/MyGeckos". Without an id, a
// browser identifies an installed app by its start address, so moving
// start_url from /MyGeckos to /Today would have made existing installs a
// different app that never receives manifest updates. The id keeps the
// identity they were installed with.

/**
 * Phones: the width below which the app shows the bottom tab bar
 * (Tailwind's md breakpoint, as in Layout.jsx).
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
export function pwaLaunchTarget(pathname, search, hash = '') {
  if (hash && hash !== '#') return null;
  const path = normalisePath(pathname);
  const home = memberHome();
  if (path === '/' || path === '/Messages') return home;
  if (search || path === home) return null;
  return path === '/MyGeckos' ? home : null;
}

/**
 * The member's home screen, the same on every device: where a sign-in
 * lands when nothing else was asked for, where "/" and the logo lead, and
 * where the installed app opens. Change the home here and nowhere else.
 */
export function memberHome() {
  return '/Today';
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
  return pwaLaunchTarget(win.location?.pathname, win.location?.search, win.location?.hash);
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
  const target = pwaLaunchTarget(win.location?.pathname, win.location?.search, win.location?.hash);
  if (target) go(target);
  return target;
}

/**
 * The page a signed-in member (or a demo guest) first sees at path:
 * 'Today', 'Dashboard', 'MyGeckos', or null for anything else. "/" is the
 * home (memberHome), so it is Today.
 */
export function firstScreenPage(pathname) {
  const path = normalisePath(pathname);
  const page = (path === '/' ? memberHome() : path).slice(1);
  return ['Today', 'Dashboard', 'MyGeckos'].includes(page) ? page : null;
}
