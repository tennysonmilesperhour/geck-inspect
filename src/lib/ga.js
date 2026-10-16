/**
 * Thin Google Analytics 4 helper.
 *
 * loadGoogleAnalytics() starts gtag.js. GA4PageTracker.jsx calls it when
 * the app mounts and again when a visitor accepts analytics on the consent
 * banner. It does nothing on staging and preview hosts, under Do Not
 * Track or Global Privacy Control, after a visitor declined, and for EEA
 * and UK visitors who have not accepted yet (src/lib/analyticsConsent.js).
 * The loader used to sit inline in index.html; it moved here so the
 * consent rules live in one place and the page has one inline script fewer
 * for the Content Security Policy to allow.
 *
 * Usage:
 *   import { trackEvent } from '@/lib/ga';
 *   trackEvent('signup_completed', { method: 'email' });
 *   trackEvent('gecko_added', { morph: 'lilly-white' });
 *
 * Page views are handled by src/lib/GA4PageTracker.jsx, do not fire
 * `page_view` events manually from feature code.
 */

import { isGuestMode } from '@/lib/guestMode';
import { analyticsAllowed } from '@/lib/analyticsConsent';

export const GA_ID = 'G-WLGHJ7KC2N';

const PRODUCTION_HOSTS = new Set(['geckinspect.com', 'www.geckinspect.com']);

let gaStarted = false;

/**
 * Start Google Analytics if this visitor may be counted. Safe to call
 * more than once; returns true only on the call that started it.
 */
export function loadGoogleAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  // Staging and preview builds stay out of the GA stream.
  if (!PRODUCTION_HOSTS.has(window.location.hostname)) return false;
  if (!analyticsAllowed()) return false;
  // Already running: undo a "Decline" made earlier in this visit.
  window[`ga-disable-${GA_ID}`] = false;
  if (gaStarted) return false;
  gaStarted = true;
  window.dataLayer = window.dataLayer || [];
  // gtag.js reads the arguments object itself, so this has to be a plain
  // function that pushes `arguments`, exactly as Google's snippet does.
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  // send_page_view: false because GA4PageTracker sends one page_view per
  // route change, the first included. page_location is the cleaned
  // address, so GA's own events never carry a sign-in token either.
  window.gtag('config', GA_ID, { send_page_view: false, page_location: currentLocation() });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);
  return true;
}

/**
 * Stop sending to Google Analytics in this visit (the visitor declined
 * after accepting) and remove its cookies from this browser.
 */
export function disableGoogleAnalytics() {
  if (typeof window === 'undefined') return;
  // Google's documented switch: gtag stops sending while this is true.
  window[`ga-disable-${GA_ID}`] = true;
  try {
    const host = window.location.hostname;
    const domains = ['', `; domain=${host}`, `; domain=.${host.replace(/^www\./, '')}`];
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0].trim();
      if (name === '_ga' || name.startsWith('_ga_') || name === '_gid') {
        for (const domain of domains) {
          document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
        }
      }
    }
  } catch {
    // Cookies blocked: there is nothing to remove.
  }
}

/**
 * Returns true when the gtag loader has finished and the global is
 * callable. False on staging, preview, when adblockers blocked the
 * loader, or during SSR.
 */
export function gaReady() {
  return !isGuestMode() && typeof window !== 'undefined' && typeof window.gtag === 'function';
}

/**
 * Fire a GA4 custom event. Silently no-ops if gtag isn't present,
 * so call sites don't need to guard.
 *
 *   trackEvent('click_cta', { cta_id: 'signup_hero' });
 */
export function trackEvent(name, params = {}) {
  if (!gaReady()) return;
  try {
    // Every event carries page_location; give it the cleaned address so
    // a token in the URL bar at that moment is never sent.
    window.gtag('event', name, { page_location: currentLocation(), ...params });
  } catch {
    // Swallow, analytics failures must never break the UX.
  }
}

// A link often travels inside another link, percent-encoded: a signed-out
// invitee is sent to /AuthPortal?next=%2Fcollection-invite%2F<token>. So
// every pattern below matches "/", "?", "&" and "=" both as they are and
// encoded (%2F, %3F, %26, %3D, once or more, any letter case), or the
// secret would slip through inside ?next= or ?redirect=.
const enc = (hex) => `%(?:25)*${hex}`;
const SLASH = `(?:/|${enc('2F')})`;
const PARAM_START = `(?:[?&]|${enc('3F')}|${enc('26')})`;
const EQUALS = `(?:=|${enc('3D')})`;
// A value runs to the next "&" (plain or encoded) or "#".
const VALUE = `(?:(?!${enc('26')})[^&#])*`;
const paramPattern = (names) => new RegExp(`(${PARAM_START}(?:${names.join('|')})${EQUALS})${VALUE}`, 'gi');

// Links like /PublicProfile?email= and /Messages?recipient= carry a
// member's email address, which must never be sent to Google Analytics.
const EMAIL_PARAMS = paramPattern(['email', 'recipient']);

// Sign-in links land with tokens in the address: after "#" for the browser
// sign-in flow (access_token, refresh_token) and sometimes in the query
// (code, token, token_hash). Email links carry their own: /Unsubscribe?t=
// (send-email) and /waitlist/<slug>?confirm= (waitlist-signup). None of
// that may reach Google Analytics or PostHog, so the part after "#" is
// dropped and these query values are redacted.
const TOKEN_PARAMS = paramPattern([
  'access_token', 'refresh_token', 'provider_token', 'id_token', 'code', 'token', 'token_hash', 'grant', 't', 'confirm',
]);
// Claim links and collection invites carry their secret in the path
// (/claim/<token>, /collection-invite/<token>); anyone holding the address
// can take the gecko or open and decline the invite, so the token is
// redacted too.
const TOKEN_PATHS = new RegExp(`(${SLASH}(?:claim|collection-invite)${SLASH})[^/?#&%]+`, 'gi');
export const sanitizeUrl = (s) => {
  if (!s) return s;
  const noHash = String(s).split('#')[0];
  return noHash
    .replace(EMAIL_PARAMS, '$1redacted')
    .replace(TOKEN_PARAMS, '$1redacted')
    .replace(TOKEN_PATHS, '$1redacted');
};

const currentLocation = () => (typeof window !== 'undefined' ? sanitizeUrl(window.location.href) : undefined);

/**
 * Explicit page_view emission. Prefer the GA4PageTracker component
 * over calling this directly.
 */
export function trackPageView(pathWithQuery, title) {
  if (!gaReady()) return;
  try {
    // Later automatic GA events (engagement, scrolls) report this page.
    window.gtag('set', { page_location: currentLocation() });
    window.gtag('event', 'page_view', {
      page_path: sanitizeUrl(pathWithQuery),
      page_location: currentLocation(),
      page_title: title || (typeof document !== 'undefined' ? document.title : undefined),
    });
  } catch {
    // no-op
  }
}
