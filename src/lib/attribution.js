// First-touch attribution: where a browser first came from.
//
// Recorded once per browser, on the first page load, before the referral
// and store-grant helpers strip their query parameters. It answers "which
// channel brought this keeper in" for the signup_completed event and the
// admin Funnel tile, which had no referrer or UTM data at all before
// October 2026 (docs/planning/growth-funnel-2026-10.md, section 8).
//
// Privacy: only the referrer's host is kept (never the full URL), and
// paths that carry a secret (claim and collection-invite tokens) are
// reduced to their prefix. Nothing here identifies a person.

const STORAGE_KEY = 'geck_first_touch_v1';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const MAX_LEN = 120;

const SEARCH_HOSTS = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|brave|yandex|baidu|startpage)\./i;
const SOCIAL_HOSTS = /(^|\.)(facebook|fb|instagram|tiktok|reddit|youtube|pinterest|threads|bsky|twitter|x|t|discord|lnkd|linkedin)\.(com|net|co|app|gg|in)$/i;
const AI_HOSTS = /(^|\.)(chatgpt|openai|perplexity|claude|gemini|copilot)\./i;

function clip(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_LEN) : null;
}

/** Which special entry route the visitor landed on, if any. */
export function entryFromPath(pathname = '', search = '') {
  const path = String(pathname || '').toLowerCase();
  if (path.startsWith('/passport/')) return 'passport';
  if (path.startsWith('/waitlist/')) return 'waitlist';
  if (path.startsWith('/claim/')) return 'claim';
  if (path.startsWith('/collection-invite/')) return 'invite';
  if (path === '/store' || path.startsWith('/store/') || path.startsWith('/storepage')) return 'store';
  try {
    const params = new URLSearchParams(search || '');
    if (params.get('ref')) return 'referral';
    if (params.get('grant')) return 'store_grant';
  } catch {
    // ignore
  }
  return null;
}

/** The landing path with any secret token removed. */
export function safeLandingPath(pathname = '') {
  const path = String(pathname || '/');
  if (/^\/claim\//i.test(path)) return '/claim';
  if (/^\/collection-invite\//i.test(path)) return '/collection-invite';
  if (/^\/passport\//i.test(path)) return '/passport';
  return path.slice(0, MAX_LEN) || '/';
}

/** The referrer's host, or null for direct visits and in-site navigation. */
export function referrerHost(referrer, ownHost) {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    const own = String(ownHost || '').replace(/^www\./, '').toLowerCase();
    if (!host || host === own) return null;
    return host.slice(0, MAX_LEN);
  } catch {
    return null;
  }
}

/**
 * One short channel label for grouping in the Funnel tile. UTM source
 * wins, then a special entry route, then the referrer's kind.
 */
export function sourceBucket(touch) {
  if (!touch) return 'unknown';
  if (touch.utm_source) return `utm:${String(touch.utm_source).toLowerCase().slice(0, 40)}`;
  if (touch.entry) return touch.entry;
  const host = touch.referrer_host;
  if (!host) return 'direct';
  if (SEARCH_HOSTS.test(host)) return 'search';
  if (AI_HOSTS.test(host)) return 'ai_assistant';
  if (SOCIAL_HOSTS.test(host)) return 'social';
  if (/morphmarket\./i.test(host)) return 'morphmarket';
  return 'other_site';
}

/** Build the first-touch record from a location and referrer. */
export function buildFirstTouch({ href, referrer, now = Date.now() } = {}) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const params = url.searchParams;
  const touch = {
    referrer_host: referrerHost(referrer, url.hostname),
    landing_path: safeLandingPath(url.pathname),
    entry: entryFromPath(url.pathname, url.search),
    captured_at: new Date(now).toISOString(),
  };
  for (const key of UTM_KEYS) touch[key] = clip(params.get(key));
  touch.source = sourceBucket(touch);
  return touch;
}

/**
 * Store the first touch for this browser. Safe to call on every load: it
 * only writes when nothing is stored yet. Must run before
 * captureReferralFromUrl and captureSignupGrantFromUrl, which remove their
 * query parameters from the address bar.
 */
export function captureFirstTouch() {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return JSON.parse(existing);
    const touch = buildFirstTouch({
      href: window.location.href,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    });
    if (touch) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(touch));
    return touch;
  } catch {
    return null;
  }
}

/** The stored first touch, or null (private window, cleared storage). */
export function getFirstTouch() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Flat event properties, prefixed so they never collide with others. */
export function firstTouchProperties(touch = getFirstTouch()) {
  if (!touch) return { ft_source: 'unknown' };
  return {
    ft_source: touch.source || sourceBucket(touch),
    ft_referrer_host: touch.referrer_host || null,
    ft_utm_source: touch.utm_source || null,
    ft_utm_medium: touch.utm_medium || null,
    ft_utm_campaign: touch.utm_campaign || null,
    ft_utm_content: touch.utm_content || null,
    ft_landing_path: touch.landing_path || null,
    ft_entry: touch.entry || null,
  };
}

// Last sign-up prompt clicked: which in-page call to action (a Morph
// Guide page, the calculator, a members-only page) sent this browser to
// the sign-up form. First touch says how a visitor arrived; this says
// which page finally convinced them. Kept for 7 days, so a visitor who
// clicks, reads the confirmation email the next morning and finishes
// sign-up is still credited. Only the page path and a short label are
// stored; nothing identifies a person.
const SIGNUP_CTA_KEY = 'geck_signup_cta_v1';
const SIGNUP_CTA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function rememberSignupCta({ cta, page, pageType } = {}, now = Date.now()) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SIGNUP_CTA_KEY,
      JSON.stringify({
        cta: clip(cta),
        page: page ? safeLandingPath(page) : null,
        page_type: clip(pageType),
        at: now,
      }),
    );
  } catch {
    // private window: the click event itself is still recorded
  }
}

export function getSignupCta(now = Date.now()) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SIGNUP_CTA_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || now - parsed.at > SIGNUP_CTA_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Flat event properties for the last sign-up prompt clicked, if any. */
export function signupCtaProperties(cta = getSignupCta()) {
  if (!cta) return { signup_cta: null };
  return {
    signup_cta: cta.cta || null,
    signup_cta_page: cta.page || null,
    signup_cta_page_type: cta.page_type || null,
  };
}
