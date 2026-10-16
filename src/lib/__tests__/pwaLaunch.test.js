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

describe('where an installed app opens', () => {
  it('opens on Today on a phone, from the new start address and from old installs', () => {
    expect(pwaLaunchTarget('/Today', '', true)).toBeNull();
    expect(pwaLaunchTarget('/', '', true)).toBe('/Today');
    expect(pwaLaunchTarget('/Messages', '', true)).toBe('/Today');
    expect(pwaLaunchTarget('/MyGeckos', '', true)).toBe('/Today');
    expect(pwaLaunchTarget('/MyGeckos/', '', true)).toBe('/Today');
  });

  it('keeps desktop installs opening on My Geckos, even with the new start address', () => {
    expect(pwaLaunchTarget('/Today', '', false)).toBe('/MyGeckos');
    expect(pwaLaunchTarget('/', '', false)).toBe('/MyGeckos');
    expect(pwaLaunchTarget('/Messages', '', false)).toBe('/MyGeckos');
    expect(pwaLaunchTarget('/MyGeckos', '', false)).toBeNull();
  });

  it('leaves deep links and other pages alone', () => {
    expect(pwaLaunchTarget('/MyGeckos', '?id=g1', true)).toBeNull();
    expect(pwaLaunchTarget('/Today', '?retired=Promote', false)).toBeNull();
    expect(pwaLaunchTarget('/log', '?type=feeding', true)).toBeNull();
    expect(pwaLaunchTarget('/Breeding', '', false)).toBeNull();
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
  it('sends a desktop install opening at the manifest start address to My Geckos, once', () => {
    const win = fakeWindow({ path: '/Today', phone: false });
    const go = vi.fn();
    expect(handlePwaLaunch(win, go)).toBe('/MyGeckos');
    expect(go).toHaveBeenCalledWith('/MyGeckos');
    expect(win.store.get(LAUNCH_HANDLED_KEY)).toBe('1');
    // Later in the session the member can open Today on purpose.
    go.mockClear();
    expect(handlePwaLaunch(win, go)).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it('keeps a phone on Today, and moves an old phone install to it', () => {
    const go = vi.fn();
    expect(handlePwaLaunch(fakeWindow({ path: '/Today', phone: true }), go)).toBeNull();
    expect(go).not.toHaveBeenCalled();
    expect(handlePwaLaunch(fakeWindow({ path: '/MyGeckos', phone: true }), go)).toBe('/Today');
    // An iPhone home-screen app reports navigator.standalone.
    expect(handlePwaLaunch(fakeWindow({ path: '/', phone: true, installed: false, iosStandalone: true }), go)).toBe('/Today');
  });

  it('does nothing in a browser tab, after the first open, or without session storage', () => {
    const go = vi.fn();
    expect(handlePwaLaunch(fakeWindow({ path: '/Today', installed: false }), go)).toBeNull();
    expect(handlePwaLaunch(fakeWindow({ path: '/Today', handled: true }), go)).toBeNull();
    expect(handlePwaLaunch(fakeWindow({ path: '/Today', storageThrows: true }), go)).toBeNull();
    expect(go).not.toHaveBeenCalled();
  });

  it('pendingPwaLaunch tells where the handler will go without handling it', () => {
    const win = fakeWindow({ path: '/Today', phone: false });
    expect(pendingPwaLaunch(win)).toBe('/MyGeckos');
    expect(win.store.has(LAUNCH_HANDLED_KEY)).toBe(false);
    expect(pendingPwaLaunch(fakeWindow({ path: '/Today', installed: false }))).toBeNull();
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

  it('starts on Today, and a desktop install opening there goes to its old home', () => {
    expect(manifest.start_url).toBe('/Today');
    expect(pwaLaunchTarget(manifest.start_url, '', true)).toBeNull();
    expect(pwaLaunchTarget(manifest.start_url, '', false)).toBe('/MyGeckos');
  });

  // Without an id a browser identifies the installed app by its start
  // address, so changing start_url would turn existing installs (made
  // when it was /MyGeckos) into a different app that gets no updates.
  it('keeps the identity existing installs were made with', () => {
    expect(manifest.id).toBe('/MyGeckos');
  });
});

describe('the first screen to warm for a signed-in member', () => {
  it('is Today on a phone and the Dashboard on a desktop at "/"', () => {
    expect(firstScreenPage('/', true)).toBe('Today');
    expect(firstScreenPage('/', false)).toBe('Dashboard');
  });

  it('is the page itself for Today, Dashboard and My Geckos', () => {
    expect(firstScreenPage('/Today', true)).toBe('Today');
    expect(firstScreenPage('/Today/', false)).toBe('Today');
    expect(firstScreenPage('/Dashboard', true)).toBe('Dashboard');
    expect(firstScreenPage('/MyGeckos', false)).toBe('MyGeckos');
    expect(firstScreenPage('/Breeding', true)).toBeNull();
  });

  it('follows the installed app to where the launch handler sends it', () => {
    const phoneLaunch = fakeWindow({ path: '/', phone: true });
    expect(firstScreenPage(pendingPwaLaunch(phoneLaunch) || '/', true)).toBe('Today');
    const desktopLaunch = fakeWindow({ path: '/Today', phone: false });
    expect(firstScreenPage(pendingPwaLaunch(desktopLaunch) || '/Today', false)).toBe('MyGeckos');
  });
});

describe('App.jsx uses these helpers', () => {
  const app = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
  const warm = app.match(/function warmFirstScreen\(\) \{[\s\S]*?\n\}/)?.[0] || '';

  it('warms Today, not the Dashboard, for the phone home, with the launch handler phone test', () => {
    expect(warm).toContain('firstScreenPage(pendingPwaLaunch(window) || path, isPhoneScreen(window))');
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
    expect(pwaLaunchTarget('/', '', true, '#access_token=abc')).toBeNull();
    expect(pwaLaunchTarget('/MyGeckos', '', true, '#')).toBe('/Today');
  });
});


describe('where a member lands after signing in', () => {
  const win = (phone) => ({ matchMedia: () => ({ matches: phone }) });
  it('is Today on a phone and My Geckos on a larger screen', () => {
    expect(memberHome(win(true))).toBe('/Today');
    expect(memberHome(win(false))).toBe('/MyGeckos');
    expect(memberHome({})).toBe('/MyGeckos');
  });
});
