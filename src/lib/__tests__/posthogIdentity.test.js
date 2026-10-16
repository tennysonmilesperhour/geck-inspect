import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ userId: null, reset: vi.fn(), capture: vi.fn(), init: vi.fn(), track: vi.fn() }));
vi.mock('posthog-js', () => ({ default: { init: state.init, capture: state.capture, reset: state.reset, get_property: key => key === '$user_id' ? state.userId : undefined } }));
vi.mock('@/lib/telemetry', () => ({ trackEvent: state.track, withAnalyticsContext: props => props }));
vi.mock('@/lib/guestMode', () => ({ isGuestMode: () => false }));
vi.mock('@/lib/ga', () => ({ sanitizeUrl: x => x }));
beforeEach(() => {
  vi.resetModules(); vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  state.userId = null; Object.values(state).forEach(x => x?.mockClear?.());
  const store = new Map();
  vi.stubGlobal('window', { location: { search: '', href: 'https://geckinspect.com/' }, localStorage: { getItem: k => store.get(k) || null, setItem: (k,v) => store.set(k,v) }, sessionStorage: { getItem: () => null, setItem() {} } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('experiment identity and conversion tracking', () => {
  it('preserves anonymous identity on initial signed-out auth reconciliation', async () => {
    const api = await import('../posthog'); api.resetUser(); await api.ensurePostHog();
    expect(state.reset).not.toHaveBeenCalled();
  });
  it('resets an identified account on sign-out', async () => {
    state.userId = 'member@example.test'; const api = await import('../posthog');
    await api.ensurePostHog(); api.resetUser(); expect(state.reset).toHaveBeenCalledOnce();
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
  it('does not initialize analytics or capture preview conversions', async () => {
    window.location.search = '?homepage_preview=business';
    const api = await import('../posthog'); await api.ensurePostHog(); api.captureEvent('signup_completed');
    expect(state.init).not.toHaveBeenCalled(); expect(state.capture).not.toHaveBeenCalled(); expect(state.track).not.toHaveBeenCalled();
  });
});
