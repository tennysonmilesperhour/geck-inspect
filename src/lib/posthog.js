import { trackEvent, withAnalyticsContext } from '@/lib/telemetry';
import { isGuestMode } from '@/lib/guestMode';
import { sanitizeUrl } from '@/lib/ga';
import { analyticsAllowed, onConsentChange, readConsent } from '@/lib/analyticsConsent';

/**
 * PostHog client wrapper.
 *
 * Reads config from Vite env vars so nothing sensitive lives in the repo:
 *
 *   VITE_POSTHOG_KEY  , your PostHog project API key (phc_...)
 *   VITE_POSTHOG_HOST, PostHog endpoint (defaults to US cloud)
 *
 * When VITE_POSTHOG_KEY is unset, every function in this module becomes a
 * no-op so local dev and preview deployments don't ping PostHog with noise.
 *
 * PostHog does not load for EEA and UK visitors until they accept on the
 * consent banner, nor for anyone who declined or whose browser sends Do
 * Not Track or Global Privacy Control (src/lib/analyticsConsent.js).
 * Members are identified by their account id, never by email.
 *
 * Usage from anywhere in the app:
 *
 *   import { posthog, captureEvent } from '@/lib/posthog';
 *   captureEvent('gecko_added', { name: gecko.name });
 */

const API_KEY = import.meta.env.VITE_POSTHOG_KEY;
const API_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

// Whether PostHog is actually initialized, other modules check this before
// calling into the client to avoid a hard dependency in tests / local dev.
let initialized = false;
let posthog = null;
let loading = null;

// Calls made before the SDK has arrived are queued and replayed once it
// has, so the first pageview and any early product events are not lost.
// Nothing is queued while analytics are not allowed (no consent yet, or
// declined): what happens before consent is never sent after it.
const pending = [];
function withClient(fn) {
  if (initialized && posthog) {
    try {
      fn(posthog);
    } catch {
      // never let analytics break the app
    }
    return;
  }
  if (API_KEY && pending.length < 50 && analyticsAllowed()) pending.push(fn);
}

// The signed-in member, kept so a visitor who accepts analytics part way
// through a visit is identified from then on without signing in again.
let lastIdentity = null;
let consentHooked = false;

// Every address-like property PostHog sends (the page, the path, the
// referrer, and the "initial" copies it keeps on the person), cleaned of
// sign-in tokens, claim and invite tokens, and member emails.
const URL_LIKE_KEY = /(?:url|pathname|referrer|referring_domain)$|^path$/i;
function cleanAddresses(bag) {
  if (!bag || typeof bag !== 'object') return;
  for (const key of Object.keys(bag)) {
    if (typeof bag[key] === 'string' && URL_LIKE_KEY.test(key)) bag[key] = sanitizeUrl(bag[key]);
  }
}
export function cleanEventAddresses(event) {
  if (!event) return event;
  cleanAddresses(event.properties);
  cleanAddresses(event.$set);
  cleanAddresses(event.$set_once);
  cleanAddresses(event.properties?.$set);
  cleanAddresses(event.properties?.$set_once);
  return event;
}

// Run `fn` after the page has painted. posthog-js is about 150 KB, and
// nothing about analytics needs to be on the critical path.
function afterFirstPaint(fn) {
  const schedule = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 4000 });
    else window.setTimeout(fn, 1500);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
}

export function initPostHog() {
  if (initialized || loading) return;
  if (isGuestMode()) return;
  if (!API_KEY || typeof window === 'undefined') {
    // Intentionally quiet, noisy warnings in local dev are annoying.
    return;
  }
  if (!consentHooked) {
    consentHooked = true;
    onConsentChange(handleConsentChange);
  }
  // Waits for the consent banner when this visitor has to be asked.
  if (!analyticsAllowed()) return;
  afterFirstPaint(() => {
    if (loading || initialized) return;
    loading = import('posthog-js')
      .then(({ default: ph }) => {
        initClient(ph);
      })
      .catch((err) => {
        loading = null;
        console.warn('[posthog] failed to load', err);
      });
  });
}

function handleConsentChange(choice) {
  if (choice === 'granted') {
    if (initialized && posthog) {
      try {
        posthog.opt_in_capturing();
      } catch {
        // ignore
      }
      return;
    }
    initPostHog();
    // The page the visitor accepted on is the first one counted.
    capturePageview(typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined);
    if (lastIdentity) identifyUser(lastIdentity);
  } else if (choice === 'denied') {
    pending.length = 0;
    if (initialized && posthog) {
      try {
        // Stops capture, remembers the opt-out in PostHog's own storage
        // and (opt_out_persistence_by_default) deletes the PostHog id
        // cookie and localStorage entry from this browser.
        posthog.opt_out_capturing();
      } catch {
        // ignore
      }
    }
  }
}

function initClient(ph) {
  try {
    ph.init(API_KEY, {
      api_host: API_HOST,
      // SPAs need manual pageview capture (we do it in PostHogPageTracker).
      capture_pageview: false,
      capture_pageleave: !isGuestMode(),
      // Autocapture clicks, form submits, etc., the whole point of PostHog.
      autocapture: !isGuestMode(),
      // Mask all text and attributes by default to protect PII (bios,
      // messages, shipping addresses). PostHog still tracks interactions
      // structurally but never captures the actual content.
      mask_all_text: true,
      mask_all_element_attributes: true,
      // Session replay is off unless you explicitly enable it in the
      // PostHog dashboard. Keeps bandwidth and storage down.
      disable_session_recording: true,
      // Honor Do-Not-Track headers on user browsers.
      respect_dnt: true,
      // When a visitor turns analytics off, PostHog deletes its own cookie
      // and localStorage entry (ph_<key>_posthog, which holds the browser's
      // PostHog id) instead of leaving them behind. Only the small opt-out
      // flag stays, so the choice is remembered.
      opt_out_persistence_by_default: true,
      // Clean every event's addresses before they leave the browser:
      // sign-in tokens can sit after "#" or in ?code= for a moment, and
      // claim and invite links carry a token in the path.
      before_send: cleanEventAddresses,
      // Uncaught errors and unhandled rejections. console.error stays off.
      capture_exceptions: !isGuestMode(),
      loaded: (client) => {
        if (import.meta.env.DEV) client.debug(false);
        // A visitor who declined and later accepted: PostHog remembers the
        // opt-out in its own storage, so lift it to match the choice.
        try {
          if (readConsent() === 'granted' && client.has_opted_out_capturing?.()) client.opt_in_capturing();
        } catch {
          // ignore
        }
        // PostHog calls `loaded` before it sends anything (its feature flag
        // request, and the pageview queued above), so this is the moment to
        // drop an id that is an email address. Doing it later, in
        // identifyUser, let one pageview and one flags request go out under
        // the old email id first.
        forgetEmailDistinctId(client);
      },
    });
    posthog = ph;
    initialized = true;
    while (pending.length) {
      const fn = pending.shift();
      try {
        fn(ph);
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn('[posthog] init failed', err);
  }
}

/**
 * Tell PostHog which member this is, by the auth account id. The email and
 * name are not sent: PostHog only needs a stable id and the two properties
 * the funnels split on (plan and role).
 */
export function identifyUser(user) {
  const id = user?.auth_user_id || user?.id;
  if (!id || user?.is_guest || isGuestMode()) return;
  const properties = {
    membership_tier: user.membership_tier || 'free',
    role: user.role || 'user',
  };
  lastIdentity = { auth_user_id: String(id), ...properties };
  withClient((ph) => {
    // Normally already done in `loaded`; repeated here so identify can
    // never link the account id to an email-keyed person.
    forgetEmailDistinctId(ph);
    ph.identify(String(id), properties);
  });
}

/**
 * Until October 2026 members were identified by email, so a returning
 * browser can still carry an email address as its PostHog id. Such a
 * browser starts afresh (a new random id, a new device id), so the
 * account id is never linked to the old email-keyed person and nothing
 * more is sent under the address.
 */
function forgetEmailDistinctId(client) {
  try {
    const current = String(client.get_distinct_id?.() || '');
    if (current.includes('@')) client.reset(true);
  } catch {
    // never let analytics break the app
  }
}

export function resetUser() {
  lastIdentity = null;
  withClient((ph) => ph.reset());
}

export function capturePageview(path) {
  if (isGuestMode()) return;
  const url = typeof window !== 'undefined' ? sanitizeUrl(window.location.href) : null;
  withClient((ph) => ph.capture('$pageview', { $current_url: url, path }));
}

/**
 * Capture a custom product event. Use sparingly and consistently, each
 * unique event name becomes a column in PostHog.
 *
 *   captureEvent('gecko_added', { status: 'Ready to Breed' });
 *   captureEvent('giveaway_created', { max_winners: 1 });
 *
 * Every event is also mirrored into the first-party `user_events` table
 * (see src/lib/telemetry.js) so the admin Product Analytics tab can chart
 * funnels and feature usage without leaving the app. The mirror runs even
 * when PostHog isn't configured, telemetry must not depend on a third
 * party being wired up. Pageviews are NOT mirrored here: PostHogPageTracker
 * already records a first-party page_view per navigation, so mirroring
 * $pageview would double-count.
 */
export function captureEvent(name, properties = {}) {
  if (isGuestMode()) return;
  // Fire-and-forget; trackEvent swallows its own errors.
  trackEvent(name, properties);
  const props = withAnalyticsContext(properties);
  withClient((ph) => ph.capture(name, props));
}

/** Pause click autocapture for the browser-local, read-only guest demo. */
export function setGuestAnalyticsMode(enabled) {
  if (initialized && posthog) {
    try {
      posthog.set_config({
        autocapture: !enabled,
        capture_pageleave: !enabled,
        capture_exceptions: !enabled,
      });
    } catch {
      // Analytics must never affect the guest experience.
    }
  } else if (!enabled) {
    initPostHog();
  }
}

/** The live client, or null until posthog-js has loaded. */
export function getPostHog() {
  return initialized ? posthog : null;
}
