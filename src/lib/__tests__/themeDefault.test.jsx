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
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; } },
    querySelector: () => null,
  });
  return state;
});
afterAll(() => vi.unstubAllGlobals());

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
    expect(html).toMatch(/allowed\.indexOf\(v\) !== -1 \? v : 'normal'/);
    expect(html).toContain('<meta name="theme-color" content="#0a1913" />');
  });
});

describe('body text does not re-tint with the theme', () => {
  const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
  it('the text end of the slate scale is a neutral grey after every theme block', () => {
    const neutral = css.indexOf(':root[data-theme] {');
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
    expect(css).toMatch(/p a:where\(:not\(\[class\*="bg-"\]\):not\(\[role="button"\]\)\) \{\s*text-decoration-line: underline;/);
  });
});
