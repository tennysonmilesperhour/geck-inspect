/**
 * The analytics region cookie, set by middleware.js on page requests.
 *
 * Vercel tells the middleware which country a request comes from
 * (x-vercel-ip-country). The page itself cannot see that header, so the
 * middleware hands it over as a small cookie: gi_analytics_region=ask for
 * the EEA, the UK and the places listed in src/lib/analyticsConsent.js,
 * and =open for everyone else. The app reads it to decide whether to ask
 * before Google Analytics and PostHog load. It holds no identifier, only
 * one of those two words, and lasts 30 days.
 */
import { countryNeedsConsent, regionFromCookie, REGION_COOKIE } from '../../src/lib/analyticsConsent.js';

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** 'ask', 'open', or null when the request carries no country. */
export function regionForRequest(request) {
  const country = request.headers.get('x-vercel-ip-country');
  if (!country) return null;
  return countryNeedsConsent(country) ? 'ask' : 'open';
}

/**
 * The Set-Cookie value for this request, or null when nothing needs to be
 * set (not a page load, no country header, or the browser already has the
 * right value).
 */
export function regionCookieFor(request) {
  // Only page loads need it; agents fetching llms.txt or a CSV do not.
  if (!String(request.headers.get('accept') || '').includes('text/html')) return null;
  const region = regionForRequest(request);
  if (!region) return null;
  if (regionFromCookie(request.headers.get('cookie')) === region) return null;
  return `${REGION_COOKIE}=${region}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax; Secure`;
}

/**
 * Let the request continue to the page or file it asked for, adding the
 * cookie to the response. This is what next({ headers }) from
 * @vercel/functions returns; it is written out here so the middleware
 * needs no extra package.
 */
export function continueWithRegionCookie(request) {
  const cookie = regionCookieFor(request);
  if (!cookie) return undefined;
  return new Response(null, {
    headers: { 'x-middleware-next': '1', 'set-cookie': cookie },
  });
}
