import { trackEvent } from '@/lib/telemetry';

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

export function initPostHog() {
  if (initialized || loading) return;
  if (!API_KEY || typeof window === 'undefined') {
    // Intentionally quiet, noisy warnings in local dev are annoying.
    return;
  }
  afterFirstPaint(() => {
    loading = import('posthog-js')
      .then(({ default: ph }) => {
        initClient(ph);
      })
      .catch((err) => {
        console.warn('[posthog] failed to load', err);
      });
  });
}

function initClient(ph) {
  try {
    ph.init(API_KEY, {
      api_host: API_HOST,
      // SPAs need manual pageview capture (we do it in PostHogPageTracker).
      capture_pageview: false,
      capture_pageleave: true,
      // Autocapture clicks, form submits, etc., the whole point of PostHog.
      autocapture: true,
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
  if (!user?.email) return;
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
  withClient((ph) => ph.reset());
}

export function capturePageview(path) {
  const url = typeof window !== 'undefined' ? window.location.href : null;
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
  // Fire-and-forget; trackEvent swallows its own errors.
  trackEvent(name, properties);
  withClient((ph) => ph.capture(name, properties));
}

/** The live client, or null until posthog-js has loaded. */
export function getPostHog() {
  return initialized ? posthog : null;
}
