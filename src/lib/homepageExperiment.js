// One experiment, one browser assignment (PostHog device-id bucketing).
// This module stores attribution, never invents a random fallback assignment.
export const HOMEPAGE_FLAG = 'homepage-business-assistant-v1';
export const HOMEPAGE_TIMEOUT_MS = 1500;
const ATTRIBUTION_KEY = 'geck_homepage_exposure_v1';
const PREVIEW_KEY = 'geck_homepage_preview_v1';
const previewWindows = new WeakSet();
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const isHomepageVariant = value => value === 'control' || value === 'business';

export function homepagePreview(search = typeof window === 'undefined' ? '' : window.location.search) {
  const value = new URLSearchParams(search).get('homepage_preview');
  if (!isHomepageVariant(value)) return null;
  if (typeof window !== 'undefined') previewWindows.add(window);
  try { window.sessionStorage.setItem(PREVIEW_KEY, '1'); } catch { /* optional storage */ }
  return value;
}

export function isHomepagePreview() {
  if (typeof window === 'undefined') return false;
  if (homepagePreview() || previewWindows.has(window)) return true;
  try { return window.sessionStorage.getItem(PREVIEW_KEY) === '1'; } catch { return false; }
}

export function homepageEligible({ hostname, isAuthenticated, isGuest, isLoadingAuth, doNotTrack, userAgent, webdriver, preview }) {
  return !preview && !isAuthenticated && !isGuest && !isLoadingAuth &&
    ['geckinspect.com', 'www.geckinspect.com'].includes(hostname) &&
    doNotTrack !== '1' && doNotTrack !== 'yes' && !webdriver &&
    !/bot|crawler|spider|headless|lighthouse|prerender/i.test(userAgent || '');
}

/** Wait for a fresh flag response, not stale cached flags after a kill switch. */
export function readHomepageVariant(client, signal) {
  return new Promise(resolve => {
    let finished = false;
    let armed = false;
    let unsubscribe = () => {};
    const finish = value => {
      if (finished) return;
      finished = true;
      unsubscribe();
      signal?.removeEventListener('abort', abort);
      resolve(value);
    };
    const abort = () => finish(null);
    if (!client || signal?.aborted || client.has_opted_out_capturing()) return finish(null);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      unsubscribe = client.onFeatureFlags((_flags, _variants, context) => {
        // onFeatureFlags can immediately replay the cached response.
        if (!armed) return;
        if (context?.errorsLoading || client.has_opted_out_capturing()) return finish(null);
        const variant = client.getFeatureFlag(HOMEPAGE_FLAG, { send_event: false });
        finish(isHomepageVariant(variant) ? variant : null);
      });
      armed = true;
      client.reloadFeatureFlags();
    } catch { finish(null); }
  });
}

export function rememberHomepageExposure(variant, now = Date.now()) {
  if (!isHomepageVariant(variant) || isHomepagePreview()) return;
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    const previous = raw ? JSON.parse(raw) : null;
    // Preserve first exposure for downstream attribution; never extend its life.
    if (previous && isHomepageVariant(previous.variant) && now >= previous.at && now - previous.at <= MAX_AGE_MS) return;
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify({ variant, at: now }));
  } catch { /* analytics must not block navigation */ }
}

export function homepageExperimentProperties(now = Date.now()) {
  if (isHomepagePreview()) return { homepage_preview: true };
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    const exposure = raw ? JSON.parse(raw) : null;
    if (!exposure || !isHomepageVariant(exposure.variant) || !Number.isFinite(exposure.at) || now < exposure.at || now - exposure.at > MAX_AGE_MS) return {};
    return { homepage_experiment: HOMEPAGE_FLAG, homepage_variant: exposure.variant };
  } catch { return {}; }
}
