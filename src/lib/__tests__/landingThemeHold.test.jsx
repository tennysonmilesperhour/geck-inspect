// @vitest-environment jsdom
// Homepage experiment hold (docs/planning/homepage-ab-test-2026-10.md) for
// visitors who reach the homepage inside the app. A signed-out visitor who
// opens a Morph Guide page first and then taps the logo never runs the
// theme script in index.html, so the homepage itself applies the hold
// (src/lib/useLandingThemeHold.js). These tests render the real homepage
// selector (src/pages/Home.jsx) and the real ThemeProvider; only the two
// homepage designs, sign-in state, analytics and the Supabase client are
// stand-ins. Remove this file with the hold when the test ends.
import { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const state = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isGuest: false, isLoadingAuth: false },
  // What the control page saw once it had drawn, one entry per mount.
  seen: [],
  releaseClient: null,
}));

vi.mock('@/lib/AuthContext', () => ({ useAuth: () => state.auth }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn(), ensurePostHog: vi.fn() }));
vi.mock('@/pages/HomeControl', () => ({
  default: function ControlStandIn() {
    // A passive effect runs after every layout effect of the same commit,
    // and a child's effects run before its parent's, so this records the
    // theme the page was first drawn with only if Home applied the hold
    // in a layout effect.
    useEffect(() => {
      const root = document.documentElement;
      state.seen.push({
        hold: root.hasAttribute('data-landing-hold'),
        theme: root.getAttribute('data-theme'),
        secondary: root.getAttribute('data-secondary'),
      });
    }, []);
    return <h1>Current homepage</h1>;
  },
}));
vi.mock('@/components/landing/business/BusinessHome', () => ({ default: () => <h1>Business assistant</h1> }));
// The sign-in check finishes when the test says so, so the provider's
// effects can be made to run again while the visitor is on the homepage.
vi.mock('@/lib/supabaseLazy', () => {
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      getUser: async () => ({ data: { user: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  };
  const ready = new Promise((resolve) => { state.releaseClient = () => resolve(client); });
  return { getSupabase: () => ready, getSupabaseWhenIdle: () => ready };
});

import { ThemeProvider } from '@/lib/ThemeContext';
import Home from '@/pages/Home';

installDomHarness();

let go;
function Navigator() {
  go = useNavigate();
  return null;
}

function renderApp(path) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Navigator />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/Home" element={<Home />} />
          <Route path="/MorphGuide" element={<h1>Morph Guide</h1>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const root = () => document.documentElement;
const attrs = () => ({
  hold: root().hasAttribute('data-landing-hold'),
  theme: root().getAttribute('data-theme'),
  secondary: root().getAttribute('data-secondary'),
  statusBar: document.querySelector('meta[name="theme-color"]').getAttribute('content'),
});

beforeEach(() => {
  for (const name of ['data-landing-hold', 'data-theme', 'data-secondary']) root().removeAttribute(name);
  document.head.innerHTML = '<meta name="theme-color" content="#0a1913" />';
  state.auth = { isAuthenticated: false, isGuest: false, isLoadingAuth: false };
  state.seen = [];
});

describe('homepage hold for a visitor who reaches "/" inside the app', () => {
  it('holds the launch look from the first draw, keeps it when the sign-in check finishes, and lifts it on leaving', async () => {
    renderApp('/MorphGuide');
    expect(attrs()).toEqual({ hold: false, theme: 'normal', secondary: 'normal', statusBar: '#0a1913' });

    act(() => go('/'));
    const held = { hold: true, theme: 'blizzard', secondary: 'blizzard', statusBar: '#0a0f19' };
    expect(attrs()).toEqual(held);
    expect(state.seen).toEqual([{ hold: true, theme: 'blizzard', secondary: 'blizzard' }]);

    // The provider's effects run again once the sign-in check is done;
    // they must not repaint the homepage in Emerald.
    await act(async () => { state.releaseClient(); await new Promise((r) => setTimeout(r, 0)); });
    expect(attrs()).toEqual(held);

    act(() => go('/MorphGuide'));
    expect(attrs()).toEqual({ hold: false, theme: 'normal', secondary: 'normal', statusBar: '#0a1913' });

    // Coming back holds again; /Home is the same page.
    act(() => go('/Home'));
    expect(attrs()).toEqual(held);
  });

  it('keeps a theme the visitor saved, and holds the accent they did not save', () => {
    window.localStorage.setItem('geckinspect.theme', 'lavender');
    renderApp('/MorphGuide');
    act(() => go('/'));
    expect(attrs()).toMatchObject({ hold: true, theme: 'lavender', secondary: 'blizzard' });
    act(() => go('/MorphGuide'));
    expect(attrs()).toMatchObject({ hold: false, theme: 'lavender', secondary: 'normal' });
  });

  it('leaves a hold set by index.html in place after the visitor moves on, as before', () => {
    root().setAttribute('data-landing-hold', '');
    renderApp('/');
    expect(attrs()).toMatchObject({ hold: true, theme: 'blizzard', secondary: 'blizzard' });
    act(() => go('/MorphGuide'));
    expect(attrs()).toMatchObject({ hold: true, theme: 'blizzard', secondary: 'blizzard' });
  });

  it.each([
    ['a member', { isAuthenticated: true, isGuest: false, isLoadingAuth: false }],
    ['the guest demo', { isAuthenticated: false, isGuest: true, isLoadingAuth: false }],
  ])('gives %s no hold on the homepage', (_who, auth) => {
    state.auth = auth;
    renderApp('/MorphGuide');
    act(() => go('/'));
    expect(attrs()).toEqual({ hold: false, theme: 'normal', secondary: 'normal', statusBar: '#0a1913' });
    expect(state.seen).toEqual([{ hold: false, theme: 'normal', secondary: 'normal' }]);
  });

  it('lifts an in-app hold when the visitor signs in on the homepage', () => {
    const view = renderApp('/MorphGuide');
    act(() => go('/'));
    expect(attrs().hold).toBe(true);
    state.auth = { isAuthenticated: true, isGuest: false, isLoadingAuth: false };
    view.rerender(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/']}>
          <Navigator />
          <Routes>
            <Route path="/" element={<Home />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(attrs()).toEqual({ hold: false, theme: 'normal', secondary: 'normal', statusBar: '#0a1913' });
  });
});
