// Where an installed app (a home-screen or desktop install) should go
// when it opens, once per session (the handler is in src/App.jsx).
//
// The manifest starts the app at /Today, the phone's first tab (review
// item E3 25). Older installs keep the address they were saved with (iOS
// caches the manifest), so:
//   * a phone opening at /, /Messages or a plain /MyGeckos goes to Today;
//   * a laptop or desktop opening at /, /Messages or a plain /Today goes
//     to My Geckos, where desktop installs have always opened (Today is
//     the phone's home; the desktop keeps the sidebar).
// A launch with anything in the query string is a deep link (a reminder
// or a share) and is left alone. Returns the path to go to, or null.
export function pwaLaunchTarget(pathname, search, phone) {
  const path = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/Messages') return phone ? '/Today' : '/MyGeckos';
  if (search) return null;
  if (phone && path === '/MyGeckos') return '/Today';
  if (!phone && path === '/Today') return '/MyGeckos';
  return null;
}
