import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Review item E3 31: no Google Analytics or PostHog call for an EEA or UK
// visitor before consent; everyone else keeps the old behaviour. These
// tests build a small fake browser (window, document, storage, time zone)
// for each case.

const ph = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  capture: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
  set_config: vi.fn(),
  get_distinct_id: vi.fn(() => 'anon-123'),
  debug: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: ph }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/lib/telemetry', () => ({ trackEvent: vi.fn(), withAnalyticsContext: (p) => p }));

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
  };
}

let appended;
function fakeBrowser({ timeZone = 'America/New_York', cookie = '', stored = {}, host = 'geckinspect.com', dnt = null, gpc = false } = {}) {
  appended = [];
  const win = new EventTarget();
  Object.assign(win, {
    location: { hostname: host, pathname: '/MorphGuide', search: '', href: `https://${host}/MorphGuide` },
    localStorage: memoryStorage(stored),
    requestIdleCallback: (fn) => fn(),
    setTimeout: (fn) => fn(),
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', {
    cookie,
    readyState: 'complete',
    head: { appendChild: (el) => appended.push(el) },
    createElement: (tag) => ({ tagName: tag }),
  });
  vi.stubGlobal('navigator', { doNotTrack: dnt, globalPrivacyControl: gpc });
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => ({ resolvedOptions: () => ({ timeZone }) }));
  return win;
}

// Lets the dynamic import('posthog-js') and its .then settle.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  ph.get_distinct_id.mockImplementation(() => 'anon-123');
  ph.init.mockImplementation((_key, config) => config.loaded?.(ph));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('who is asked', () => {
  it('asks for the EEA, the UK and their overseas parts, not for the US, Canada or Switzerland', async () => {
    const { countryNeedsConsent } = await import('../analyticsConsent');
    for (const c of ['DE', 'FR', 'IE', 'PL', 'GB', 'NO', 'IS', 'LI', 'RE', 'GP', 'gb', ' de ']) {
      expect(countryNeedsConsent(c), c).toBe(true);
    }
    for (const c of ['US', 'CA', 'AU', 'NZ', 'CH', 'JP', 'BR', '', null]) {
      expect(countryNeedsConsent(c), String(c)).toBe(false);
    }
  });

  it('treats a European time zone as "ask"', async () => {
    const { timeZoneNeedsConsent } = await import('../analyticsConsent');
    // Africa/Ceuta is Ceuta and Melilla, part of Spain (review of 16 Oct).
    for (const tz of ['Europe/Berlin', 'Europe/London', 'Europe/Dublin', 'Atlantic/Canary', 'Atlantic/Reykjavik', 'Africa/Ceuta', 'Asia/Nicosia', 'Indian/Reunion', 'GB']) {
      expect(timeZoneNeedsConsent(tz), tz).toBe(true);
    }
    for (const tz of ['America/New_York', 'America/Los_Angeles', 'America/Toronto', 'Australia/Sydney', 'Asia/Tokyo', 'Africa/Casablanca', 'UTC', '']) {
      expect(timeZoneNeedsConsent(tz), tz).toBe(false);
    }
  });

  it('asks when either the country cookie or the time zone says so', async () => {
    const { regionNeedsConsent } = await import('../analyticsConsent');
    expect(regionNeedsConsent({ cookie: 'gi_analytics_region=ask', timeZone: 'America/New_York' })).toBe(true);
    expect(regionNeedsConsent({ cookie: 'a=1; gi_analytics_region=open', timeZone: 'Europe/Paris' })).toBe(true);
    expect(regionNeedsConsent({ cookie: 'gi_analytics_region=open', timeZone: 'America/Chicago' })).toBe(false);
    expect(regionNeedsConsent({ cookie: '', timeZone: 'America/Chicago' })).toBe(false);
    // A cookie with a look-alike name does not count.
    expect(regionNeedsConsent({ cookie: 'xgi_analytics_region=ask', timeZone: 'America/Chicago' })).toBe(false);
  });
});

describe('the stored choice', () => {
  it('blocks analytics for an EEA visitor until they accept, and remembers the answer', async () => {
    fakeBrowser({ timeZone: 'Europe/Berlin' });
    const consent = await import('../analyticsConsent');
    expect(consent.analyticsAllowed()).toBe(false);
    expect(consent.needsConsentPrompt()).toBe(true);
    const heard = [];
    consent.onConsentChange((c) => heard.push(c));
    consent.setConsent('granted');
    expect(heard).toEqual(['granted']);
    expect(window.localStorage.getItem(consent.CONSENT_STORAGE_KEY)).toBe('granted');
    expect(consent.analyticsAllowed()).toBe(true);
    expect(consent.needsConsentPrompt()).toBe(false);
  });

  it('keeps today\'s behaviour elsewhere, and honours a decline anywhere', async () => {
    fakeBrowser({ timeZone: 'America/Denver', cookie: 'gi_analytics_region=open' });
    const consent = await import('../analyticsConsent');
    expect(consent.analyticsAllowed()).toBe(true);
    expect(consent.needsConsentPrompt()).toBe(false);
    consent.setConsent('denied');
    expect(consent.analyticsAllowed()).toBe(false);
  });

  it('never asks and never loads under Do Not Track or Global Privacy Control', async () => {
    fakeBrowser({ timeZone: 'Europe/Rome', dnt: '1' });
    let consent = await import('../analyticsConsent');
    expect(consent.needsConsentPrompt()).toBe(false);
    expect(consent.analyticsAllowed()).toBe(false);
    vi.resetModules();
    fakeBrowser({ timeZone: 'America/Denver', gpc: true, stored: { 'geckinspect.analytics-consent': 'granted' } });
    consent = await import('../analyticsConsent');
    expect(consent.analyticsAllowed()).toBe(false);
  });
});

describe('Google Analytics', () => {
  it('does not load for an EEA visitor who has not accepted, then loads once they do', async () => {
    fakeBrowser({ timeZone: 'Europe/Madrid' });
    const { loadGoogleAnalytics } = await import('../ga');
    const { setConsent } = await import('../analyticsConsent');
    expect(loadGoogleAnalytics()).toBe(false);
    expect(appended).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    setConsent('granted');
    expect(loadGoogleAnalytics()).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-WLGHJ7KC2N');
    // Starting it twice adds no second script.
    expect(loadGoogleAnalytics()).toBe(false);
    expect(appended).toHaveLength(1);
  });

  it('loads at once for a US visitor on the production host, never on a preview host', async () => {
    fakeBrowser({ timeZone: 'America/New_York' });
    const { loadGoogleAnalytics } = await import('../ga');
    expect(loadGoogleAnalytics()).toBe(true);
    const config = window.dataLayer.find((args) => args[0] === 'config');
    expect(config[2]).toMatchObject({ send_page_view: false, page_location: 'https://geckinspect.com/MorphGuide' });
    vi.resetModules();
    fakeBrowser({ timeZone: 'America/New_York', host: 'geck-inspect-git-main.vercel.app' });
    const preview = await import('../ga');
    expect(preview.loadGoogleAnalytics()).toBe(false);
  });

  it('stops sending after a decline', async () => {
    fakeBrowser({ timeZone: 'America/New_York' });
    const { loadGoogleAnalytics, disableGoogleAnalytics } = await import('../ga');
    loadGoogleAnalytics();
    disableGoogleAnalytics();
    expect(window['ga-disable-G-WLGHJ7KC2N']).toBe(true);
  });
});

describe('PostHog', () => {
  it('sends nothing for an EEA visitor before consent, then starts and identifies by account id', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    fakeBrowser({ timeZone: 'Europe/London' });
    const posthog = await import('../posthog');
    const { setConsent } = await import('../analyticsConsent');

    posthog.initPostHog();
    posthog.capturePageview('/MorphGuide');
    posthog.captureEvent('morph_viewed', { morph: 'lilly-white' });
    posthog.identifyUser({ id: 'a1b2', auth_user_id: 'a1b2', email: 'keeper@example.com', full_name: 'Keeper', membership_tier: 'breeder', role: 'user' });
    await settle();
    expect(ph.init).not.toHaveBeenCalled();
    expect(ph.capture).not.toHaveBeenCalled();
    expect(ph.identify).not.toHaveBeenCalled();

    setConsent('granted');
    await settle();
    expect(ph.init).toHaveBeenCalledTimes(1);
    // What happened before consent is not sent afterwards: one pageview,
    // for the page the visitor accepted on, and no morph_viewed event.
    const captured = ph.capture.mock.calls.map((c) => c[0]);
    expect(captured).toEqual(['$pageview']);
    expect(ph.identify).toHaveBeenCalledWith('a1b2', { membership_tier: 'breeder', role: 'user' });
    expect(JSON.stringify(ph.identify.mock.calls)).not.toMatch(/keeper@example\.com|Keeper/);
  });

  it('loads for a US visitor without asking, and identifies by account id, never email', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    fakeBrowser({ timeZone: 'America/New_York' });
    const posthog = await import('../posthog');
    posthog.initPostHog();
    await settle();
    expect(ph.init).toHaveBeenCalledTimes(1);
    posthog.identifyUser({ id: 'prof-legacy', auth_user_id: 'uuid-1', email: 'keeper@example.com', membership_tier: 'keeper', role: 'admin' });
    expect(ph.reset).not.toHaveBeenCalled();
    expect(ph.identify).toHaveBeenCalledWith('uuid-1', { membership_tier: 'keeper', role: 'admin' });
  });

  it('starts a browser that was identified by email afresh, so the old person is not linked', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    fakeBrowser({ timeZone: 'America/New_York' });
    let distinctId = 'keeper@example.com';
    ph.get_distinct_id.mockImplementation(() => distinctId);
    ph.reset.mockImplementation(() => {
      distinctId = 'fresh-random-id';
    });
    const posthog = await import('../posthog');
    posthog.initPostHog();
    // The first pageview is queued before posthog-js has arrived.
    posthog.capturePageview('/MorphGuide');
    await settle();
    // Review of 16 Oct 2026: the reset has to happen inside PostHog's
    // `loaded` callback, before the queued pageview replays (and before
    // posthog-js sends its flags request), not later in identifyUser.
    expect(ph.reset).toHaveBeenCalledTimes(1);
    expect(ph.reset).toHaveBeenCalledWith(true);
    expect(ph.capture).toHaveBeenCalledTimes(1);
    expect(ph.reset.mock.invocationCallOrder[0]).toBeLessThan(ph.capture.mock.invocationCallOrder[0]);
    posthog.identifyUser({ auth_user_id: 'uuid-1', email: 'keeper@example.com' });
    expect(ph.reset).toHaveBeenCalledTimes(1);
    expect(ph.identify).toHaveBeenCalledWith('uuid-1', { membership_tier: 'free', role: 'user' });
  });

  it('asks PostHog to delete its own id cookie and storage when a visitor opts out', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    fakeBrowser({ timeZone: 'America/New_York' });
    const posthog = await import('../posthog');
    posthog.initPostHog();
    await settle();
    expect(ph.init.mock.calls[0][1]).toMatchObject({ opt_out_persistence_by_default: true, respect_dnt: true });
  });

  it('opts out when a visitor declines after accepting', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
    fakeBrowser({ timeZone: 'America/New_York' });
    const posthog = await import('../posthog');
    const { setConsent } = await import('../analyticsConsent');
    posthog.initPostHog();
    await settle();
    setConsent('denied');
    expect(ph.opt_out_capturing).toHaveBeenCalledTimes(1);
  });

  it('cleans tokens from every address-like property before sending', async () => {
    const { cleanEventAddresses } = await import('../posthog');
    const event = cleanEventAddresses({
      properties: {
        $current_url: 'https://geckinspect.com/claim/secret-claim-token?x=1#access_token=abc',
        $pathname: '/collection-invite/secret-invite-token',
        $referrer: 'https://geckinspect.com/AuthPortal?code=pkce-code&next=/MyGeckos',
        path: '/claim/another-secret',
        $prev_pageview_pathname: '/collection-invite/secret-previous-invite',
        morph: 'lilly-white',
      },
      $set_once: {
        $initial_current_url: 'https://geckinspect.com/AuthPortal?token_hash=abc&type=recovery',
        // A signed-out invitee pressing Accept (CollectionInvite.jsx).
        $initial_referrer: 'https://geckinspect.com/AuthPortal?next=%2Fcollection-invite%2Fsecret-encoded-invite',
      },
      $set: { $current_url: 'https://geckinspect.com/Unsubscribe?t=secret-unsubscribe' },
    });
    const text = JSON.stringify(event);
    expect(text).not.toMatch(/secret|abc|pkce-code/);
    expect(event.properties.$current_url).toBe('https://geckinspect.com/claim/redacted?x=1');
    expect(event.properties.$pathname).toBe('/collection-invite/redacted');
    expect(event.$set_once.$initial_referrer).toBe('https://geckinspect.com/AuthPortal?next=%2Fcollection-invite%2Fredacted');
    expect(event.properties.morph).toBe('lilly-white');
  });
});

describe('the region cookie from middleware', () => {
  const page = (headers) => new Request('https://geckinspect.com/MyGeckos', { headers: { accept: 'text/html', ...headers } });

  it('sets "ask" for an EEA or UK country and "open" elsewhere, and lets the page through', async () => {
    const { default: middleware } = await import('../../../middleware.js');
    const de = await middleware(page({ 'x-vercel-ip-country': 'DE' }), {});
    expect(de.headers.get('x-middleware-next')).toBe('1');
    expect(de.headers.get('set-cookie')).toBe('gi_analytics_region=ask; Path=/; Max-Age=2592000; SameSite=Lax; Secure');
    const us = await middleware(page({ 'x-vercel-ip-country': 'US' }), {});
    expect(us.headers.get('set-cookie')).toMatch(/^gi_analytics_region=open;/);
  });

  it('sets nothing when the browser already has the value, with no country, or for non-page requests', async () => {
    const { default: middleware } = await import('../../../middleware.js');
    expect(await middleware(page({ 'x-vercel-ip-country': 'GB', cookie: 'gi_analytics_region=ask' }), {})).toBeUndefined();
    expect(await middleware(page({}), {})).toBeUndefined();
    const agent = new Request('https://geckinspect.com/llms.txt', { headers: { accept: '*/*', 'x-vercel-ip-country': 'FR' } });
    expect(await middleware(agent, {})).toBeUndefined();
  });
});
