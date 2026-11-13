import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  firstScreenPage,
  handlePwaLaunch,
  isPhoneScreen,
  memberHome,
  LAUNCH_HANDLED_KEY,
  pendingPwaLaunch,
  PHONE_QUERY,
  pwaLaunchTarget,
} from '@/lib/pwaLaunch';

// One home on every device (experience review C1, decision 2).
describe('the one home screen', () => {
  it('is Today, whatever the window', () => {
    const win = (phone) => ({ matchMedia: () => ({ matches: phone }) });
    expect(memberHome()).toBe('/Today');
    expect(memberHome(win(true))).toBe('/Today');
    expect(memberHome(win(false))).toBe('/Today');
    expect(memberHome({})).toBe('/Today');
  });

  // Every way in asks memberHome(): no other file names the home page.
  const src = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

  it('decides where a sign-in, a password reset and an email link land', () => {
    expect(src('components/auth/LoginPortal.jsx')).toContain('authContinuationPath(continuation) : memberHome()');
    expect(src('components/auth/SetNewPassword.jsx')).toContain('|| memberHome()');
    expect(src('lib/emailLinkAuth.js')).toContain('memberHome(win)');
    expect(src('App.jsx')).toContain('<Navigate to={target || memberHome()} replace />');
  });

  it('decides "/" for a signed-in member or a demo guest, and leaves the landing page to signed-out visitors', () => {
    const app = src('App.jsx');
    expect(app).toContain('<Navigate to={`${memberHome()}${search}`} replace />');
    expect(app).toContain('<Route path="/" element={<HomeRedirect />} />');
    // The signed-out route set still shows the landing page at "/".
    expect(app).toContain('<Route path="/" element={<Home />} />');
    expect(app).not.toContain('MainPage');
  });

  it('decides where the logo and the menu home link lead, with no phone redirect left in the shell', () => {
    const layout = src('Layout.jsx');
    // The logo in the phone menu and in the laptop sidebar, and the home link.
    expect(layout.match(/<Link to=\{memberHome\(\)\} aria-label="Geck Inspect, home"/g)).toHaveLength(2);
    expect(layout).toContain('const homeUrl = memberHome();');
    expect(layout).not.toContain('createPageUrl("Dashboard")');
    expect(layout).not.toContain("createPageUrl('Dashboard')");
    expect(layout).not.toContain('navigate(`/Today');
  });
});

describe('where an installed app opens', () => {
  it('opens on Today on every device, from the new start address and from old installs', () => {
    expect(pwaLaunchTarget('/Today', '')).toBeNull();
    expect(pwaLaunchTarget('/', '')).toBe('/Today');
    expect(pwaLaunchTarget('/Messages', '')).toBe('/Today');
    expect(pwaLaunchTarget('/MyGeckos', '')).toBe('/Today');
    expect(pwaLaunchTarget('/MyGeckos/', '')).toBe('/Today');
  });

  it('leaves deep links and other pages alone', () => {
    expect(pwaLaunchTarget('/MyGeckos', '?id=g1')).toBeNull();
    expect(pwaLaunchTarget('/Today', '?retired=Promote')).toBeNull();
    expect(pwaLaunchTarget('/log', '?type=feeding')).toBeNull();
    expect(pwaLaunchTarget('/Breeding', '')).toBeNull();
    expect(pwaLaunchTarget('/Dashboard', '')).toBeNull();
  });
});

// A stand-in window: the installed app or a browser tab, phone or desktop.
function fakeWindow({ path = '/', search = '', hash = '', installed = true, phone = false, iosStandalone = false, handled = false, storageThrows = false } = {}) {
  const store = new Map(handled ? [[LAUNCH_HANDLED_KEY, '1']] : []);
  const storage = {
    getItem: (k) => { if (storageThrows) throw new Error('blocked'); return store.has(k) ? store.get(k) : null; },
    setItem: (k, v) => { if (storageThrows) throw new Error('blocked'); store.set(k, String(v)); },
  };
  return {
    store,
    location: { pathname: path, search, hash },
    navigator: { standalone: iosStandalone },
    sessionStorage: storage,
    matchMedia: (query) => ({
      matches: query === '(display-mode: standalone)' ? installed : query === PHONE_QUERY ? phone : false,
    }),
  };
}

describe('the launch handler', () => {
  it('sends an old desktop install opening at /MyGeckos to Today, once', () => {
    const win = fakeWindow({ path: '/MyGeckos', phone: false });
    const go = vi.fn();
    expect(handlePwaLaunch(win, go)).toBe('/Today');
    expect(go).toHaveBeenCalledWith('/Today');
    expect(win.store.get(LAUNCH_HANDLED_KEY)).toBe('1');
    // Later in the session the member can open My Geckos on purpose.
    go.mockClear();
    expect(handlePwaLaunch(win, go)).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it('keeps an install on Today on a phone and on a desktop, and moves an old phone install to it', () => {
    const go = vi.fn();
    expect(handlePwaLaunch(fakeWindow({ path: '/Today', phone: true }), go)).toBeNull();
    expect(handlePwaLaunch(fakeWindow({ path: '/Today', phone: false }), go)).toBeNull();
    expect(go).not.toHaveBeenCalled();
    expect(handlePwaLaunch(fakeWindow({ path: '/MyGeckos', phone: true }), go)).toBe('/Today');
    // An iPhone home-screen app reports navigator.standalone.
    expect(handlePwaLaunch(fakeWindow({ path: '/', phone: true, installed: false, iosStandalone: true }), go)).toBe('/Today');
  });

  it('does nothing in a browser tab, after the first open, or without session storage', () => {
    const go = vi.fn();
    expect(handlePwaLaunch(fakeWindow({ path: '/MyGeckos', installed: false }), go)).toBeNull();
    expect(handlePwaLaunch(fakeWindow({ path: '/MyGeckos', handled: true }), go)).toBeNull();
    expect(handlePwaLaunch(fakeWindow({ path: '/MyGeckos', storageThrows: true }), go)).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it('pendingPwaLaunch tells where the handler will go without handling it', () => {
    const win = fakeWindow({ path: '/MyGeckos', phone: false });
    expect(pendingPwaLaunch(win)).toBe('/Today');
    expect(win.store.has(LAUNCH_HANDLED_KEY)).toBe(false);
    expect(pendingPwaLaunch(fakeWindow({ path: '/MyGeckos', installed: false }))).toBeNull();
  });

  it('uses the same phone width as the tab bar', () => {
    expect(PHONE_QUERY).toBe('(max-width: 767px)');
    expect(isPhoneScreen(fakeWindow({ phone: true }))).toBe(true);
    expect(isPhoneScreen(fakeWindow({ phone: false }))).toBe(false);
    expect(isPhoneScreen(undefined)).toBe(false);
  });
});

describe('the web manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../public/manifest.json', import.meta.url), 'utf8'));

  it('starts on the home screen, so an install opening there stays', () => {
    expect(manifest.start_url).toBe(memberHome());
    expect(pwaLaunchTarget(manifest.start_url, '')).toBeNull();
  });

  // Without an id a browser identifies the installed app by its start
  // address, so changing start_url would turn existing installs (made
  // when it was /MyGeckos) into a different app that gets no updates.
  it('keeps the identity existing installs were made with', () => {
    expect(manifest.id).toBe('/MyGeckos');
  });
});

describe('the first screen to warm for a signed-in member', () => {
  it('is Today at "/", the home', () => {
    expect(firstScreenPage('/')).toBe('Today');
    expect(firstScreenPage('')).toBe('Today');
  });

  it('is the page itself for Today, Dashboard and My Geckos', () => {
    expect(firstScreenPage('/Today')).toBe('Today');
    expect(firstScreenPage('/Today/')).toBe('Today');
    expect(firstScreenPage('/Dashboard')).toBe('Dashboard');
    expect(firstScreenPage('/MyGeckos')).toBe('MyGeckos');
    expect(firstScreenPage('/Breeding')).toBeNull();
  });

  it('follows the installed app to where the launch handler sends it', () => {
    const phoneLaunch = fakeWindow({ path: '/', phone: true });
    expect(firstScreenPage(pendingPwaLaunch(phoneLaunch) || '/')).toBe('Today');
    const desktopLaunch = fakeWindow({ path: '/MyGeckos', phone: false });
    expect(firstScreenPage(pendingPwaLaunch(desktopLaunch) || '/MyGeckos')).toBe('Today');
  });
});

describe('App.jsx uses these helpers', () => {
  const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
  const warm = app.match(/function warmFirstScreen\(\) \{[\s\S]*?\n\}/)?.[0] || '';

  it('warms Today for the home, and the page itself for the Dashboard and My Geckos', () => {
    expect(warm).toContain('firstScreenPage(pendingPwaLaunch(window) || path)');
    expect(warm).toMatch(/page === 'Today'\) import\('\.\/pages\/Today'\)/);
    expect(warm).toMatch(/page === 'Dashboard'\) import\('\.\/pages\/Dashboard'\)/);
  });

  it('runs the launch handler, with no phone test of its own', () => {
    expect(app).toContain('handlePwaLaunch(window,');
    expect(app).not.toContain("matchMedia?.('(max-width: 767px)')");
  });

  it('leaves a sign-in return alone, so its tokens are saved before anything moves', () => {
    const go = vi.fn();
    const win = fakeWindow({ path: '/MyGeckos', hash: '#access_token=abc&refresh_token=def&type=signup', phone: true });
    expect(handlePwaLaunch(win, go)).toBeNull();
    expect(go).not.toHaveBeenCalled();
    expect(pwaLaunchTarget('/', '', '#access_token=abc')).toBeNull();
    expect(pwaLaunchTarget('/MyGeckos', '', '#')).toBe('/Today');
  });
});
