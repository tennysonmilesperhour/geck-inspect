/**
 * Where to send someone after they sign in or create an account.
 *
 * A transfer claim link (/claim/:token) and a collection invite
 * (/collection-invite/:token) send a signed-out visitor to /AuthPortal with
 * ?redirect= or ?next=. Until 29 Sep 2026 nothing read either one, so a
 * buyer who made an account to claim a gecko landed on the dashboard and
 * lost the link. The sign-in page now saves the target here, and the app
 * sends the person there once they are signed in: straight away after a
 * password sign-in, or when they come back from the confirmation email or
 * Google (which return to /MyGeckos, possibly in a new tab).
 *
 * Only paths inside the app are accepted, so the link cannot be used to
 * send someone to another site.
 */

const KEY = 'geck_inspect_post_auth_redirect';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function safeRedirectPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (/^\/authportal/i.test(path)) return null;
  return path;
}

/** The target named in a query string (?redirect= or ?next=), if safe. */
export function redirectFromSearch(search) {
  const params = new URLSearchParams(search || '');
  return safeRedirectPath(params.get('redirect') || params.get('next'));
}

export function rememberPostAuthRedirect(path, now = Date.now()) {
  const safe = safeRedirectPath(path);
  if (!safe) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path: safe, at: now }));
  } catch {
    // Storage can be blocked; the ?redirect= on the sign-in page still works.
  }
}

/** Returns the saved target once (and forgets it), or null. */
export function takePostAuthRedirect(now = Date.now()) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw);
    if (!at || now - at > MAX_AGE_MS) return null;
    return safeRedirectPath(path);
  } catch {
    return null;
  }
}
