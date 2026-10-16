import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// How PostHog identity works with the homepage A/B test
// (docs/planning/homepage-ab-test-2026-10.md) and the October privacy rules:
// members are identified by account id, never email; a signed-out visit keeps
// its anonymous id so the experiment can join exposure to signup; and a
// browser still carrying an email as its PostHog id starts afresh as soon as
// PostHog loads, before any flag request.
const state = vi.hoisted(() => ({
  userId: null, distinctId: 'anon-device-1', allowed: true,
  reset: vi.fn(), capture: vi.fn(), init: vi.fn(), track: vi.fn(), identify: vi.fn(),
}));
vi.mock('posthog-js', () => {
  const client = {
    init: (key, config) => { state.init(key, config); config?.loaded?.(client); },
    capture: state.capture,
    identify: state.identify,
    reset: (...args) => { state.reset(...args); state.distinctId = 'anon-device-2'; },
    get_property: (key) => (key === '$user_id' ? state.userId : undefined),
    get_distinct_id: () => state.distinctId,
    has_opted_out_capturing: () => false,
    debug: () => {},
  };
  return { default: client };
});
// The consent gate is covered in analyticsConsent.test.js; here analytics are
// allowed, so the result does not depend on the machine's time zone.
vi.mock('@/lib/analyticsConsent', () => ({
  analyticsAllowed: () => state.allowed,
  onConsentChange: () => () => {},
  readConsent: () => (state.allowed ? 'granted' : null),
}));
vi.mock('@/lib/telemetry', () => ({ trackEvent: state.track, withAnalyticsContext: (props) => props }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/lib/ga', () => ({ sanitizeUrl: (x) => x }));

const MEMBER_ID = '6f1c2a8e-4b7d-4e2a-9c3b-0d5e7f9a1b2c';

beforeEach(() => {
  vi.resetModules(); vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  state.userId = null; state.distinctId = 'anon-device-1'; state.allowed = true;
  Object.values(state).forEach((x) => x?.mockClear?.());
  const store = new Map();
  vi.stubGlobal('window', { location: { search: '', href: 'https://geckinspect.com/' }, localStorage: { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) }, sessionStorage: { getItem: () => null, setItem() {} } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('experiment identity and conversion tracking', () => {
  it('preserves anonymous identity on initial signed-out auth reconciliation', async () => {
    const api = await import('../posthog'); api.resetUser(); await api.ensurePostHog();
    expect(state.reset).not.toHaveBeenCalled();
  });

  it('resets an identified account on sign-out', async () => {
    state.userId = MEMBER_ID; state.distinctId = MEMBER_ID;
    const api = await import('../posthog');
    await api.ensurePostHog(); api.resetUser(); expect(state.reset).toHaveBeenCalledOnce();
  });

  it('identifies a member by account id with no email or name', async () => {
    const api = await import('../posthog'); await api.ensurePostHog();
    api.identifyUser({ auth_user_id: MEMBER_ID, email: 'member@example.test', full_name: 'A Member', membership_tier: 'keeper' });
    expect(state.identify).toHaveBeenCalledWith(MEMBER_ID, { membership_tier: 'keeper', role: 'user' });
    expect(JSON.stringify(state.identify.mock.calls)).not.toContain('example.test');
  });

  it('starts afresh when the browser still carries an email as its PostHog id, before anything is sent', async () => {
    state.distinctId = 'member@example.test';
    const api = await import('../posthog'); await api.ensurePostHog();
    expect(state.reset).toHaveBeenCalledWith(true);
    expect(state.capture).not.toHaveBeenCalled();
  });

  it('adds the rendered homepage attribution to actual signup and activation events', async () => {
    const { rememberHomepageExposure } = await import('../homepageExperiment'); rememberHomepageExposure('business');
    const api = await import('../posthog'); await api.ensurePostHog();
    for (const event of ['signup_completed', 'first_gecko_added']) {
      api.captureEvent(event, { source: 'test' });
      expect(state.capture).toHaveBeenCalledWith(event, expect.objectContaining({ homepage_variant: 'business', homepage_experiment: 'homepage-business-assistant-v1' }));
      expect(state.track).toHaveBeenCalledWith(event, expect.objectContaining({ homepage_variant: 'business' }));
    }
  });

  it('does not load PostHog for a visitor who has not allowed analytics, so the experiment falls back to control', async () => {
    state.allowed = false;
    const api = await import('../posthog');
    await expect(api.ensurePostHog()).resolves.toBeNull();
    expect(state.init).not.toHaveBeenCalled();
  });

  it('does not initialize analytics or capture preview conversions', async () => {
    window.location.search = '?homepage_preview=business';
    const api = await import('../posthog'); await api.ensurePostHog(); api.captureEvent('signup_completed');
    expect(state.init).not.toHaveBeenCalled(); expect(state.capture).not.toHaveBeenCalled(); expect(state.track).not.toHaveBeenCalled();
  });
});
