/**
 * Analytics consent for visitors in the EEA and the UK.
 *
 * Why: EU and UK law (ePrivacy article 5(3) and PECR) needs a visitor's
 * consent before a site stores analytics cookies on their device. Google
 * Analytics and PostHog both do, so for these visitors neither loads until
 * they press Accept on the consent banner (src/components/shared/
 * ConsentBanner.jsx). The switch on the privacy policy (src/components/
 * shared/AnalyticsChoice.jsx) changes the choice later. Everyone else keeps
 * the old behaviour: analytics load unless the browser sends Do Not Track
 * or Global Privacy Control.
 *
 * This covers Google Analytics and PostHog only. Geck Inspect's own page
 * and feature count (src/lib/telemetry.js) does not read this choice; the
 * privacy policy (section 5) says so.
 *
 * How a visitor is placed (review item E3 31):
 *   1. middleware.js reads Vercel's country header (x-vercel-ip-country)
 *      and sets the cookie gi_analytics_region=ask for the countries in
 *      CONSENT_COUNTRIES, or =open for the rest.
 *   2. The browser's time zone, for when that cookie is missing (local
 *      development, the native apps, a blocked cookie) and as a second
 *      opinion: a European time zone means ask.
 * Either signal saying "ask" is enough. A visitor is never asked less
 * because of one of them, so a VPN exit in the US does not skip the
 * question for someone whose phone is on Berlin time. Some visitors outside
 * the EEA and UK are asked too (Europe/ covers Switzerland, Serbia, Turkey
 * and others); asking a few extra people costs nothing.
 *
 * The choice is kept in this browser's localStorage. "denied" is honoured
 * for everyone, wherever they are.
 */

export const CONSENT_STORAGE_KEY = 'geckinspect.analytics-consent';
export const REGION_COOKIE = 'gi_analytics_region';
export const CONSENT_EVENT = 'geckinspect:analytics-consent';

/**
 * Countries whose visitors are asked first: the 27 EU members, the three
 * other EEA members (Iceland, Liechtenstein, Norway), the UK, the parts of
 * France and Finland that Vercel reports under their own codes (French
 * Guiana, Guadeloupe, Martinique, Reunion, Mayotte, Saint Martin, Aland),
 * and the UK-linked places with their own copy of the GDPR (Gibraltar,
 * Guernsey, Jersey, the Isle of Man).
 */
export const CONSENT_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB',
  'GF', 'GP', 'MQ', 'RE', 'YT', 'MF', 'AX',
  'GI', 'GG', 'JE', 'IM',
]);

/**
 * European time zones, including the Atlantic, African and overseas zones
 * of EU members (Canaries, Madeira, Azores, Ceuta and Melilla, Cyprus, the
 * French overseas regions) and the old aliases some browsers still report.
 */
export const CONSENT_TIME_ZONE = /^(?:Europe\/|Atlantic\/(?:Canary|Madeira|Azores|Reykjavik|Faroe|Faeroe|Jan_Mayen)$|Africa\/Ceuta$|Arctic\/Longyearbyen$|Asia\/(?:Nicosia|Famagusta)$|America\/(?:Cayenne|Guadeloupe|Martinique|Marigot)$|Indian\/(?:Reunion|Mayotte)$|(?:GB|GB-Eire|Eire|Iceland|Poland|Portugal|WET|CET|MET|EET)$)/;

export function countryNeedsConsent(country) {
  return CONSENT_COUNTRIES.has(String(country || '').trim().toUpperCase());
}

export function timeZoneNeedsConsent(timeZone) {
  return CONSENT_TIME_ZONE.test(String(timeZone || ''));
}

/** The region cookie's value from a Cookie string: 'ask', 'open' or null. */
export function regionFromCookie(cookieString) {
  const match = String(cookieString || '').match(/(?:^|;\s*)gi_analytics_region=(ask|open)(?:;|$)/);
  return match ? match[1] : null;
}

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

function readCookie() {
  try {
    return typeof document !== 'undefined' ? document.cookie : '';
  } catch {
    return '';
  }
}

/** Whether this visitor has to be asked before analytics load. */
export function regionNeedsConsent({ cookie = readCookie(), timeZone = browserTimeZone() } = {}) {
  return regionFromCookie(cookie) === 'ask' || timeZoneNeedsConsent(timeZone);
}

/** Do Not Track or Global Privacy Control: no analytics, and no question. */
export function browserOptsOut(nav = typeof navigator !== 'undefined' ? navigator : undefined) {
  const win = typeof window !== 'undefined' ? window : {};
  const dnt = nav?.doNotTrack || win.doNotTrack || nav?.msDoNotTrack;
  return dnt === '1' || dnt === 'yes' || nav?.globalPrivacyControl === true;
}

/** The stored choice: 'granted', 'denied' or null when the visitor has not chosen. */
export function readConsent() {
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Whether Google Analytics and PostHog may load now. Storage that cannot
 * be read counts as "not chosen", so an EEA or UK visitor in a locked-down
 * browser gets no analytics rather than unconsented ones.
 */
export function analyticsAllowed(options) {
  if (browserOptsOut()) return false;
  const choice = readConsent();
  if (choice === 'denied') return false;
  if (choice === 'granted') return true;
  return !regionNeedsConsent(options);
}

/** Whether to show the consent banner. */
export function needsConsentPrompt(options) {
  if (browserOptsOut()) return false;
  if (readConsent() !== null) return false;
  return regionNeedsConsent(options);
}

const listeners = new Set();

/**
 * Run `fn(choice)` whenever the visitor makes or changes a choice. Returns
 * an unsubscribe function.
 */
export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Store the visitor's choice and tell the analytics loaders. */
export function setConsent(choice) {
  if (choice !== 'granted' && choice !== 'denied') return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
  } catch {
    // Not remembered (private mode): the banner asks again next visit, and
    // nothing loads before then.
  }
  for (const fn of [...listeners]) {
    try {
      fn(choice);
    } catch {
      // A listener's failure must not stop the others.
    }
  }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
  } catch {
    // Old browsers without CustomEvent: the listeners above already ran.
  }
}
