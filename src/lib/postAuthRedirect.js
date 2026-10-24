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
 * Google. Email and OAuth callbacks carry the same target in the URL,
 * so a different browser does not depend on this local fallback.
 *
 * Only paths inside the app are accepted, so the link cannot be used to
 * send someone to another site.
 */

const KEY = 'geck_inspect_post_auth_redirect';
const MAX_AGE_MS = 72 * 60 * 60 * 1000;

export function safeRedirectPath(value) {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || (path.includes('\\') || [...path].some((char) => char.charCodeAt(0) <= 32))) return null;
  // Reject encoded separators and controls too; a later router may decode them.
  if (/%(?:25)*(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20)/i.test(path.split(/[?#]/)[0])) return null;
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

/** Read without consuming: auth retries and confirmation resends need the same target. */
export function peekPostAuthRedirect(now = Date.now()) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw);
    if (!Number.isFinite(at) || at > now || now - at >= MAX_AGE_MS) return null;
    return safeRedirectPath(path);
  } catch {
    return null;
  }
}

export function clearPostAuthRedirect() {
  try { localStorage.removeItem(KEY); } catch { /* Storage may be blocked. */ }
}

/** Returns the saved target once. Never use this before recovery is finished. */
export function takePostAuthRedirect(now = Date.now()) {
  const path = peekPostAuthRedirect(now);
  clearPostAuthRedirect();
  return path;
}

/** Keep continuation in the callback URL as well as browser storage. */
export function authContinuationPath(target, { reset = false } = {}) {
  const safe = safeRedirectPath(target);
  const params = new URLSearchParams();
  if (reset) params.set('mode', 'reset');
  if (safe) params.set('redirect', safe);
  return `/AuthPortal${params.size ? `?${params}` : ''}`;
}
