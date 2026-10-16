import { trackEvent, withAnalyticsContext } from '@/lib/telemetry';
import { isGuestMode } from '@/lib/guestMode';
import { sanitizeUrl } from '@/lib/ga';
import { homepageExperimentProperties, isHomepagePreview } from '@/lib/homepageExperiment';

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
  if (API_KEY && pending.length < 50) pending.push(fn);
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

// Experiments opt in to eager loading; every other page keeps idle loading.
export function ensurePostHog() {
  if (initialized) return Promise.resolve(posthog);
  if (loading) return loading;
  if (!API_KEY || typeof window === 'undefined' || isGuestMode() || isHomepagePreview()) return Promise.resolve(null);
  loading = import('posthog-js').then(({ default: ph }) => {
    initClient(ph);
    return posthog;
  }).catch(() => null);
  return loading;
}

let scheduled = false;
export function initPostHog() {
  if (initialized || loading || scheduled || !API_KEY || typeof window === 'undefined' || isGuestMode() || isHomepagePreview()) return;
  scheduled = true;
  afterFirstPaint(() => { scheduled = false; void ensurePostHog(); });
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
      // Clean every event's page address before it leaves the browser:
      // sign-in tokens can sit after "#" or in ?code= for a moment.
      before_send: (event) => {
        if (isHomepagePreview()) return null;
        if (event?.properties?.$current_url) {
          event.properties.$current_url = sanitizeUrl(event.properties.$current_url);
        }
        return event;
      },
      // Uncaught errors and unhandled rejections. console.error stays off.
      capture_exceptions: !isGuestMode(),
      loaded: (client) => {
        if (import.meta.env.DEV) client.debug(false);
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

export function identifyUser(user) {
  if (!user?.email || isGuestMode()) return;
  withClient((ph) =>
    ph.identify(user.email, {
      email: user.email,
      name: user.full_name || null,
      membership_tier: user.membership_tier || 'free',
      role: user.role || 'user',
    }),
  );
}

export function resetUser() {
  // An anonymous INITIAL_SESSION must not erase the ID from a previous visit.
  withClient((ph) => { if (ph.get_property('$user_id')) ph.reset(); });
}

export function capturePageview(path) {
  if (isGuestMode() || isHomepagePreview()) return;
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
  if (isGuestMode() || isHomepagePreview()) return;
  // Fire-and-forget; trackEvent swallows its own errors.
  const props = withAnalyticsContext({ ...homepageExperimentProperties(), ...properties });
  trackEvent(name, props);
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
