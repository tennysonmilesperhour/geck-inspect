/**
 * Email links (sign-up confirmation, password reset, invites, email
 * change) and the sign-in flow the website uses.
 *
 * Why this file exists (review item E3 31, "PKCE on web"):
 * The website signs in with Supabase's implicit flow, which puts the
 * session tokens in the address after "#" when someone comes back from
 * Google or opens an email link. PKCE puts a one-time code there instead,
 * and only the browser that started the sign-in can trade it for a
 * session. That second part is the catch: with Supabase's default email
 * templates, a reset link requested in the iPhone home-screen app but
 * opened from Mail (which opens Safari, a separate browser) could never be
 * completed, and neither could a confirmation link opened on another
 * device. So the website stays on the implicit flow (WEB_AUTH_FLOW) until
 * the email templates send token links instead:
 *
 *   {{ .SiteURL }}/AuthPortal?token_hash={{ .TokenHash }}&type=recovery&next={{ .RedirectTo }}
 *
 * Those work in any browser on any device, because the browser that opens
 * the link asks Supabase to check the token (verifyOtp) and gets the
 * session in the reply, never in the address. completeEmailLink() below
 * handles them, and it works with either flow, so the order is:
 *   1. this code ships (it does nothing until a token link arrives),
 *   2. the five templates are changed in the Supabase dashboard,
 *   3. WEB_AUTH_FLOW becomes 'pkce' (one line; Google sign-in then stops
 *      putting tokens in the address too).
 * The native apps already use PKCE with their own callback address
 * (src/lib/nativeAuth.js); a token link they asked for is passed on to the
 * app by completeEmailLink().
 */

import { safeInternalPath } from '@/lib/safeInternalPath';
import { memberHome } from '@/lib/pwaLaunch';

/** The website's Supabase sign-in flow. See the steps above before changing it. */
export const WEB_AUTH_FLOW = 'implicit';

export const NATIVE_CALLBACK_PREFIX = 'com.geckinspect.app://auth/callback';

const EMAIL_LINK_TYPES = new Set(['signup', 'email', 'magiclink', 'recovery', 'invite', 'email_change']);

/** The token link's parts, or null when the address is not one. */
export function readEmailLink(search) {
  const params = new URLSearchParams(search || '');
  const tokenHash = params.get('token_hash');
  const type = params.get('type');
  if (!tokenHash || !EMAIL_LINK_TYPES.has(type)) return null;
  return { tokenHash, type, next: params.get('next') || '' };
}

/** A same-site path from `next` (a full URL on this site or a path), or null. */
function sameSitePath(next, origin) {
  if (!next) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return null;
    const path = safeInternalPath(url.pathname + url.search, '');
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Where to go once a token link is checked. A reset or an invite needs a
 * password chosen (the form on /AuthPortal?mode=reset); an email change
 * ends in Settings; a confirmation goes where the sign-up asked (the app's
 * first screen by default, or a claim link or invite page).
 */
export function destinationFor({ type, next }, origin, home = '/MyGeckos') {
  if (type === 'recovery' || type === 'invite') return '/AuthPortal?mode=reset';
  if (type === 'email_change') return '/Settings';
  const path = sameSitePath(next, origin);
  if (!path || path.startsWith('/AuthPortal')) return home;
  return path;
}

/** The app address that hands a token link to the native app. */
export function nativeHandoff({ tokenHash, type, next }) {
  if (!String(next || '').startsWith(NATIVE_CALLBACK_PREFIX)) return null;
  const sep = next.includes('?') ? '&' : '?';
  return `${next}${sep}token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}`;
}

/**
 * Finish a token link if the address holds one. Returns what it did:
 * 'none' (not a token link), 'native' (passed to the app), 'done'
 * (signed in and moved on) or 'failed' (expired or used; the sign-in page
 * says so). Never throws.
 */
export async function completeEmailLink(supabase, win = typeof window !== 'undefined' ? window : undefined) {
  if (!win?.location) return 'none';
  const link = readEmailLink(win.location.search);
  if (!link) return 'none';
  const handoff = nativeHandoff(link);
  if (handoff) {
    win.location.replace(handoff);
    return 'native';
  }
  try {
    const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
    if (error) throw error;
    // A full load of the next page: the session is stored by now, and the
    // token leaves the address and the history entry.
    win.location.replace(destinationFor(link, win.location.origin, memberHome(win)));
    return 'done';
  } catch {
    const reset = link.type === 'recovery' || link.type === 'invite';
    win.location.replace(`/AuthPortal?authError=link${reset ? '&mode=reset' : ''}`);
    return 'failed';
  }
}

/**
 * With WEB_AUTH_FLOW = 'pkce', Supabase refuses a link that still carries
 * tokens after "#" (one emailed before the switch, or sent from the
 * dashboard before the templates changed). This signs such a link in the
 * way the implicit flow would have, and clears the address.
 */
export async function completeLegacyTokenLink(supabase, win = typeof window !== 'undefined' ? window : undefined) {
  if (!win?.location || WEB_AUTH_FLOW !== 'pkce') return false;
  const params = new URLSearchParams(String(win.location.hash || '').replace(/^#/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  win.history?.replaceState?.(win.history.state, '', win.location.pathname + win.location.search);
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return !error;
}

/**
 * A PKCE link opened in a browser that did not ask for it: the address has
 * ?code= but this browser holds no code verifier, so Supabase leaves it
 * alone. The sign-in page uses this to explain (the email is confirmed, or
 * the reset link has to be opened where it was requested).
 */
export function isPkceLinkFromAnotherBrowser(win = typeof window !== 'undefined' ? window : undefined) {
  if (!win?.location) return false;
  const params = new URLSearchParams(win.location.search || '');
  if (!params.get('code')) return false;
  // The same two places Supabase looks: the verifier for this flow's id
  // (sb_flow_id in the address), or the single older verifier slot.
  const flowId = params.get('sb_flow_id');
  const wanted = flowId ? `-flow-${flowId}-code-verifier` : '-auth-token-code-verifier';
  try {
    const storage = win.localStorage;
    for (let i = 0; i < (storage?.length || 0); i++) {
      const key = storage.key(i) || '';
      if (key.startsWith('sb-') && key.endsWith(wanted) && storage.getItem(key)) return false;
    }
  } catch {
    // Storage blocked: no verifier can be here either.
  }
  return true;
}
