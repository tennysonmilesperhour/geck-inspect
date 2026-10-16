import React from 'react';
import { act, create } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => {
  const store = new Map();
  const attrs = {};
  const state = { store, attrs, cloud: null, cloudWrites: [] };
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
  });
  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: (k, v) => { attrs[k] = v; },
      hasAttribute: (k) => Object.prototype.hasOwnProperty.call(attrs, k),
    },
    querySelector: () => null,
  });
  return state;
});
afterAll(() => vi.unstubAllGlobals());

// ThemeContext reaches the client through src/lib/supabaseLazy.js (round 3
// performance work), so the lazy loader hands back the same fake.
vi.mock('@/lib/supabaseLazy', async () => {
  const { supabase } = await import('@/lib/supabaseClient');
  return {
    getSupabase: async () => supabase,
    getSupabaseWhenIdle: async () => supabase,
  };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: env.cloud ? { user: { id: 'u1' } } : null } }),
      getUser: async () => ({ data: { user: env.cloud ? { id: 'u1', email: 'keeper@example.com' } : null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: env.cloud, error: null }) }) }),
      update: (row) => ({ eq: async () => { env.cloudWrites.push(row); return { error: null }; } }),
    }),
  },
}));

import { DEFAULT_SECONDARY, DEFAULT_THEME, ThemeProvider, useTheme } from '../ThemeContext';

let api;
function Probe() { api = useTheme(); return null; }
async function mount() {
  let tree;
  await act(async () => { tree = create(<ThemeProvider><Probe /></ThemeProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return tree;
}

beforeEach(() => {
  env.store.clear();
  for (const k of Object.keys(env.attrs)) delete env.attrs[k];
  env.cloud = null;
  env.cloudWrites = [];
});

describe('Emerald is the default for new visitors', () => {
  it('a new visitor sees Emerald, and the default is not saved as a choice', async () => {
    expect(DEFAULT_THEME).toBe('normal');
    expect(DEFAULT_SECONDARY).toBe('normal');
    const tree = await mount();
    expect(env.attrs['data-theme']).toBe('normal');
    expect(env.attrs['data-secondary']).toBe('normal');
    expect(env.store.has('geckinspect.theme')).toBe(false);
    expect(env.store.has('geckinspect.secondary')).toBe(false);
    act(() => tree.unmount());
  });

  it('a member who already has Blizzard saved keeps it', async () => {
    env.store.set('geckinspect.theme', 'blizzard');
    env.store.set('geckinspect.secondary', 'blizzard');
    const tree = await mount();
    expect(env.attrs['data-theme']).toBe('blizzard');
    expect(env.attrs['data-secondary']).toBe('blizzard');
    act(() => tree.unmount());
  });

  it('a theme saved on the profile follows the member to a new device', async () => {
    env.cloud = { ui_theme: 'tangerine', ui_secondary: 'blizzard' };
    const tree = await mount();
    expect(env.attrs['data-theme']).toBe('tangerine');
    expect(env.store.get('geckinspect.theme')).toBe('tangerine');
    act(() => tree.unmount());
  });

  it('picking a theme in Settings saves it', async () => {
    env.cloud = { ui_theme: null, ui_secondary: null };
    const tree = await mount();
    expect(env.cloudWrites).toEqual([]);
    await act(async () => { api.setTheme('lavender'); });
    expect(env.attrs['data-theme']).toBe('lavender');
    expect(env.store.get('geckinspect.theme')).toBe('lavender');
    expect(env.cloudWrites).toContainEqual({ ui_theme: 'lavender' });
    // The accent was never picked, so it is still not saved.
    expect(env.store.has('geckinspect.secondary')).toBe(false);
    act(() => tree.unmount());
  });

  it('the first-paint script in index.html uses the same default', () => {
    const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
    expect(html).toMatch(/var fallback = hold \? 'blizzard' : 'normal';/);
    expect(html).toMatch(/allowed\.indexOf\(v\) !== -1 \? v : fallback/);
    expect(html).toContain('<meta name="theme-color" content="#0a1913" />');
  });
});

// While the homepage A/B test runs (docs/planning/homepage-ab-test-2026-10.md),
// a signed-out visit that opens on "/" keeps the launch look. Remove these
// tests with the hold when the test ends.
describe('homepage experiment hold', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const themeScript = html
    .match(/<script>\s*\(function \(\) \{\s*var allowed = [\s\S]*?<\/script>/)[0]
    .replace(/^<script>/, '')
    .replace(/<\/script>$/, '');

  function runThemeScript({ path, stored = {}, guest = false }) {
    const attrs = {};
    const local = new Map(Object.entries(stored));
    const fakeWindow = {
      location: { pathname: path },
      localStorage: {
        getItem: (k) => (local.has(k) ? local.get(k) : null),
        key: (i) => [...local.keys()][i] ?? null,
        get length() { return local.size; },
      },
      sessionStorage: { getItem: (k) => (guest && k === 'geck_inspect_guest_mode' ? '1' : null) },
      document: {
        documentElement: {
          setAttribute: (k, v) => { attrs[k] = v; },
          classList: { add() {} },
        },
        querySelector: () => null,
      },
    };
    new Function('location', 'localStorage', 'sessionStorage', 'document', themeScript)(
      fakeWindow.location, fakeWindow.localStorage, fakeWindow.sessionStorage, fakeWindow.document,
    );
    return attrs;
  }

  it('a signed-out visit that opens on the homepage keeps Blizzard and is marked', () => {
    const attrs = runThemeScript({ path: '/' });
    expect(attrs['data-theme']).toBe('blizzard');
    expect(attrs['data-secondary']).toBe('blizzard');
    expect(attrs).toHaveProperty('data-landing-hold');
    expect(runThemeScript({ path: '/Home' })).toHaveProperty('data-landing-hold');
  });

  it('other pages, members and the guest demo get Emerald and no hold', () => {
    for (const attrs of [
      runThemeScript({ path: '/MorphGuide' }),
      runThemeScript({ path: '/', stored: { 'sb-abc-auth-token': '{}' } }),
      runThemeScript({ path: '/', guest: true }),
    ]) {
      expect(attrs['data-theme']).toBe('normal');
      expect(attrs).not.toHaveProperty('data-landing-hold');
    }
  });

  it('a saved theme still wins on the homepage', () => {
    const attrs = runThemeScript({ path: '/', stored: { 'geckinspect.theme': 'lavender' } });
    expect(attrs['data-theme']).toBe('lavender');
  });

  it('the app keeps the Blizzard default for a held visit and saves nothing', async () => {
    env.attrs['data-landing-hold'] = '';
    await mount();
    expect(api.theme).toBe('blizzard');
    expect(api.secondary).toBe('blizzard');
    expect(env.store.size).toBe(0);
  });

  it('the October text and link rules skip a held visit', () => {
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
    expect(css).toContain(':root[data-theme]:not([data-landing-hold]) {');
    expect(css).toContain(':where(:root:not([data-landing-hold])) p a:where(');
  });
});

describe('body text does not re-tint with the theme', () => {
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
  it('the text end of the slate scale is a neutral grey after every theme block', () => {
    const neutral = css.indexOf(':root[data-theme]:not([data-landing-hold]) {');
    expect(neutral).toBeGreaterThan(css.lastIndexOf(':root[data-theme="super-hypo"] {'));
    const block = css.slice(neutral, css.indexOf('}', neutral));
    for (const step of [50, 100, 200, 300, 400, 500]) {
      expect(block).toMatch(new RegExp(`--slate-${step}:\\s+0 0% \\d+%;`));
    }
  });
  it('slate-500 passes 4.5 to 1 on the darkest and the card surfaces of every theme', () => {
    const lum = (l) => { const c = l / 100; const v = c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; return v; };
    const hslToRgb = (h, s, l) => {
      s /= 100; l /= 100;
      const k = (n) => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return [f(0), f(8), f(4)].map((x) => x * 100);
    };
    const relLum = (hsl) => { const [r, g, b] = hslToRgb(...hsl).map(lum); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const text = [0, 0, 62];
    const surfaces = [...css.matchAll(/--slate-(900|950):\s+(\d+) (\d+)% (\d+)%;/g)].map((m) => [Number(m[2]), Number(m[3]), Number(m[4])]);
    expect(surfaces.length).toBeGreaterThanOrEqual(12);
    for (const surface of surfaces) expect(ratio(text, surface)).toBeGreaterThan(4.5);
  });
  it('links inside sentences are underlined', () => {
    expect(css).toMatch(/:where\(:root:not\(\[data-landing-hold\]\)\) p a:where\(:not\(\[class\*="bg-"\]\):not\(\[role="button"\]\)\) \{\s*text-decoration-line: underline;/);
  });
});
