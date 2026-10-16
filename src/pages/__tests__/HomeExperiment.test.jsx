import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ search: '', auth: { isAuthenticated: false, isGuest: false, isLoadingAuth: false }, captures: vi.fn(), ensure: vi.fn(), read: vi.fn(), remember: vi.fn() }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ search: state.search }) }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('@/lib/posthog', () => ({ captureEvent: state.captures, ensurePostHog: state.ensure }));
vi.mock('@/lib/homepageExperiment', async importOriginal => ({ ...await importOriginal(), readHomepageVariant: state.read, rememberHomepageExposure: state.remember }));
vi.mock('../HomeControl', () => ({ default: () => <h1>Current homepage</h1> }));
vi.mock('@/components/landing/business/BusinessHome', () => ({ default: () => <h1>Business assistant</h1> }));
let tree;
async function mount(enabled = '1') {
  vi.stubEnv('VITE_HOMEPAGE_EXPERIMENT_ENABLED', enabled);
  const { default: Home } = await import('../Home');
  await act(async () => { tree = create(<Home />); });
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers();
  state.search = ''; state.auth = { isAuthenticated: false, isGuest: false, isLoadingAuth: false };
  state.captures.mockClear(); state.remember.mockClear(); state.read.mockReset().mockResolvedValue('business'); state.ensure.mockReset().mockResolvedValue({});
  vi.stubGlobal('window', { location: { hostname: 'geckinspect.com', search: '' }, sessionStorage: { getItem: () => null, setItem() {} } });
  vi.stubGlobal('navigator', { userAgent: 'Mozilla', doNotTrack: '0' });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('homepage allocation and exposure', () => {
  it('leaves control immediate and does not initialize flags when disabled', async () => {
    await mount('0'); expect(tree.root.findByType('h1').children).toEqual(['Current homepage']);
    expect(state.ensure).not.toHaveBeenCalled(); expect(state.captures).not.toHaveBeenCalled();
  });
  it.each(['control', 'business'])('records only the committed %s variant', async variant => {
    state.read.mockResolvedValue(variant); await mount();
    expect(tree.root.findByType('h1').children).toEqual([variant === 'business' ? 'Business assistant' : 'Current homepage']);
    expect(state.captures).toHaveBeenCalledTimes(1);
    expect(state.captures).toHaveBeenCalledWith('$experiment_exposure', expect.objectContaining({ $feature_flag_response: variant, homepage_rendered: true }));
    expect(state.remember).toHaveBeenCalledWith(variant);
  });
  it('does not replace the control when a flag arrives after the deadline', async () => {
    let resolve; state.read.mockReturnValue(new Promise(r => { resolve = r; }));
    await mount(); expect(tree.root.findByProps({ role: 'status' })).toBeTruthy();
    await act(async () => vi.advanceTimersByTime(1501));
    expect(tree.root.findByType('h1').children).toEqual(['Current homepage']);
    await act(async () => resolve('business'));
    expect(tree.root.findByType('h1').children).toEqual(['Current homepage']);
    expect(state.captures).not.toHaveBeenCalled();
  });
  it('does not expose disabled or unavailable flag results', async () => {
    state.read.mockResolvedValue(null); await mount();
    expect(tree.root.findByType('h1').children).toEqual(['Current homepage']);
    expect(state.captures).not.toHaveBeenCalled();
  });
  it('previews the alternative while the experiment is off, without exposure', async () => {
    state.search = '?homepage_preview=business'; window.location.search = state.search;
    await mount('0'); expect(tree.root.findByType('h1').children).toEqual(['Business assistant']);
    expect(state.ensure).not.toHaveBeenCalled(); expect(state.captures).not.toHaveBeenCalled();
  });
  it('does not enroll signed-in visitors', async () => {
    state.auth.isAuthenticated = true; await mount();
    expect(tree.root.findByType('h1').children).toEqual(['Current homepage']);
    expect(state.ensure).not.toHaveBeenCalled(); expect(state.captures).not.toHaveBeenCalled();
  });
  it('cancels enrollment when visitors leave before flags resolve', async () => {
    let resolve; state.read.mockReturnValue(new Promise(r => { resolve = r; }));
    await mount(); await act(async () => tree.unmount());
    await act(async () => resolve('business'));
    expect(state.captures).not.toHaveBeenCalled();
  });
});
