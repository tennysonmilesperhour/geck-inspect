import posthog from 'posthog-js';

/**
 * PostHog client wrapper.
 *
 * Reads config from Vite env vars so nothing sensitive lives in the repo:
 *
 *   VITE_POSTHOG_KEY   — your PostHog project API key (phc_...)
 *   VITE_POSTHOG_HOST  — PostHog endpoint (defaults to US cloud)
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

// Whether PostHog is actually initialized — other modules check this before
// calling into the client to avoid a hard dependency in tests / local dev.
let initialized = false;

export function initPostHog() {
  if (initialized) return;
  if (!API_KEY) {
    // Intentionally quiet — noisy warnings in local dev are annoying.
    return;
  }
  try {
    posthog.init(API_KEY, {
      api_host: API_HOST,
      // SPAs need manual pageview capture (we do it in PostHogPageTracker).
      capture_pageview: false,
      capture_pageleave: true,
      // Autocapture clicks, form submits, etc. — the whole point of PostHog.
      autocapture: true,
      // Mask all inputs by default; PostHog will still track that an input
      // was touched, but it won't see the value. Safer default for a
      // community app with PII.
      mask_all_text: false,
      mask_all_element_attributes: false,
      // Session replay is off unless you explicitly enable it in the
      // PostHog dashboard. Keeps bandwidth and storage down.
      disable_session_recording: true,
      // Honor Do-Not-Track headers on user browsers.
      respect_dnt: true,
      loaded: (ph) => {
        if (import.meta.env.DEV) ph.debug(false);
      },
    });
    initialized = true;
  } catch (err) {
    console.warn('[posthog] init failed', err);
  }
}

export function identifyUser(user) {
  if (!initialized || !user?.email) return;
  try {
    posthog.identify(user.email, {
      email: user.email,
      name: user.full_name || null,
      membership_tier: user.membership_tier || 'free',
      role: user.role || 'user',
    });
  } catch {}
}

export function resetUser() {
  if (!initialized) return;
  try {
    posthog.reset();
  } catch {}
}

export function capturePageview(path) {
  if (!initialized) return;
  try {
    posthog.capture('$pageview', {
      $current_url: window.location.href,
      path,
    });
  } catch {}
}

/**
 * Capture a custom product event. Use sparingly and consistently — each
 * unique event name becomes a column in PostHog.
 *
 *   captureEvent('gecko_added', { status: 'Ready to Breed' });
 *   captureEvent('giveaway_created', { max_winners: 1 });
 */
export function captureEvent(name, properties = {}) {
  if (!initialized) return;
  try {
    posthog.capture(name, properties);
  } catch {}
}

export { posthog };
