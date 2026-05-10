/**
 * Thin Google Analytics 4 helper.
 *
 * The gtag loader + initial `config` call live inline in index.html
 * and are gated on prod hostnames, so this module only needs to
 * guard against gtag being missing (staging, preview, or environments
 * where the loader was blocked by a tracker blocker).
 *
 * Usage:
 *   import { trackEvent } from '@/lib/ga';
 *   trackEvent('signup_completed', { method: 'email' });
 *   trackEvent('gecko_added', { morph: 'lilly-white' });
 *
 * Page views are handled by src/lib/GA4PageTracker.jsx ,  do not fire
 * `page_view` events manually from feature code.
 */

export const GA_ID = 'G-WLGHJ7KC2N';

/**
 * Returns true when the gtag loader has finished and the global is
 * callable. False on staging, preview, when adblockers blocked the
 * loader, or during SSR.
 */
export function gaReady() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
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
    window.gtag('event', name, params);
  } catch {
    // Swallow ,  analytics failures must never break the UX.
  }
}

/**
 * Explicit page_view emission. Prefer the GA4PageTracker component
 * over calling this directly.
 */
export function trackPageView(pathWithQuery, title) {
  if (!gaReady()) return;
  try {
    window.gtag('event', 'page_view', {
      page_path: pathWithQuery,
      page_location: typeof window !== 'undefined' ? window.location.href : undefined,
      page_title: title || (typeof document !== 'undefined' ? document.title : undefined),
    });
  } catch {
    // no-op
  }
}
