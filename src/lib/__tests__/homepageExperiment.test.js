import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOMEPAGE_FLAG, homepageEligible, homepagePreview, homepageExperimentProperties, rememberHomepageExposure, readHomepageVariant } from '../homepageExperiment';
const storage = () => { const m = new Map(); return { getItem: k => m.get(k) || null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
beforeEach(() => vi.stubGlobal('window', { location: { search: '' }, localStorage: storage(), sessionStorage: storage() }));
afterEach(() => vi.unstubAllGlobals());
const eligible = { hostname: 'geckinspect.com', isAuthenticated: false, isGuest: false, isLoadingAuth: false, userAgent: 'Mozilla', doNotTrack: '0' };

describe('homepage audience', () => {
  it('includes logged-out production web visitors', () => expect(homepageEligible(eligible)).toBe(true));
  it.each([{ hostname: 'www.kiwipop.fun' }, { hostname: 'localhost' }, { isAuthenticated: true }, { isGuest: true }, { isLoadingAuth: true }, { doNotTrack: '1' }, { doNotTrack: 'yes' }, { webdriver: true }, { userAgent: 'Googlebot' }, { preview: true }])('excludes %j', change => expect(homepageEligible({ ...eligible, ...change })).toBe(false));
});

describe('fresh flag evaluation', () => {
  function client(value = 'business') {
    let callback;
    return {
      has_opted_out_capturing: vi.fn(() => false),
      getFeatureFlag: vi.fn(() => value),
      unsubscribe: vi.fn(),
      onFeatureFlags(fn) { callback = fn; fn([], {}, {}); return this.unsubscribe; },
      reloadFeatureFlags: vi.fn(),
      respond(context = {}) { callback([], {}, context); },
    };
  }
  it('ignores cached responses and reads fresh values without sending exposure', async () => {
    const ph = client();
    const result = readHomepageVariant(ph);
    expect(ph.getFeatureFlag).not.toHaveBeenCalled();
    expect(ph.reloadFeatureFlags).toHaveBeenCalledOnce();
    ph.respond();
    expect(await result).toBe('business');
    expect(ph.getFeatureFlag).toHaveBeenCalledWith(HOMEPAGE_FLAG, { send_event: false });
    expect(ph.unsubscribe).toHaveBeenCalledOnce();
  });
  it.each([false, undefined, true, 'unexpected'])('does not enroll disabled/invalid value %s', async value => {
    const ph = client('business'); ph.getFeatureFlag.mockReturnValue(value);
    const result = readHomepageVariant(ph); ph.respond(); expect(await result).toBeNull();
  });
  it('fails closed on errors and removes subscriptions', async () => {
    const ph = client(); const result = readHomepageVariant(ph); ph.respond({ errorsLoading: true });
    expect(await result).toBeNull(); expect(ph.unsubscribe).toHaveBeenCalledOnce();
  });
  it('ignores late responses after timeout/navigation', async () => {
    const ph = client(); const controller = new AbortController();
    const result = readHomepageVariant(ph, controller.signal); controller.abort(); ph.respond();
    expect(await result).toBeNull(); expect(ph.unsubscribe).toHaveBeenCalledOnce();
  });
  it('does not request flags for an analytics opt-out', async () => {
    const ph = client(); ph.has_opted_out_capturing.mockReturnValue(true);
    expect(await readHomepageVariant(ph)).toBeNull(); expect(ph.reloadFeatureFlags).not.toHaveBeenCalled();
  });
});

describe('conversion attribution', () => {
  it('preserves first exposure through reloads and signup, with a bounded lifetime', () => {
    const now = Date.now();
    rememberHomepageExposure('business', now);
    rememberHomepageExposure('control', now + 1000);
    expect(homepageExperimentProperties(now + 2000)).toEqual({ homepage_experiment: HOMEPAGE_FLAG, homepage_variant: 'business' });
    expect(homepageExperimentProperties(now + 31 * 86400000)).toEqual({});
    expect(homepageExperimentProperties(now - 1000)).toEqual({});
  });
  it('marks the entire preview session and never enrolls it', () => {
    expect(homepagePreview('?homepage_preview=business')).toBe('business');
    rememberHomepageExposure('business');
    expect(homepageExperimentProperties()).toEqual({ homepage_preview: true });
    expect(window.localStorage.getItem('geck_homepage_exposure_v1')).toBeNull();
  });
  it('ignores unrecognized preview parameters and malformed storage', () => {
    expect(homepagePreview('?homepage_preview=evil')).toBeNull();
    window.localStorage.setItem('geck_homepage_exposure_v1', 'invalid-json');
    expect(homepageExperimentProperties()).toEqual({});
  });
  it('survives browsers that deny storage', () => {
    window.localStorage.getItem = () => { throw new Error('blocked'); };
    window.sessionStorage.getItem = () => { throw new Error('blocked'); };
    expect(() => rememberHomepageExposure('business')).not.toThrow();
    expect(homepageExperimentProperties()).toEqual({});
  });
});
