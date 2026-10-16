import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { closure, collectChecks, pagesWithoutEntry } from '../../../scripts/check-bundle-size.mjs';

const manifest = {
  'index.html': { file: 'assets/index-a.js', isEntry: true, imports: ['_vendor.js', '_core.js'] },
  '_vendor.js': { file: 'assets/vendor-b.js' },
  '_core.js': { file: 'assets/core-c.js', imports: ['_vendor.js'] },
  'src/pages/Home.jsx': { file: 'assets/Home-d.js', isDynamicEntry: true, imports: ['_core.js', '_icons.js'] },
  'src/pages/Big.jsx': { file: 'assets/Big-e.js', isDynamicEntry: true },
  '_icons.js': { file: 'assets/icons-f.js' },
};
const sizes = { 'assets/index-a.js': 10_000, 'assets/vendor-b.js': 90_000, 'assets/core-c.js': 40_000, 'assets/Home-d.js': 20_000, 'assets/Big-e.js': 70_000, 'assets/icons-f.js': 5_000 };
const budget = (allowances = {}) => ({
  limits: { entryKb: 150, routeKb: 60, publicPageKb: 200, publicImageKb: 200 },
  publicPages: { '/': 'src/pages/Home.jsx' },
  allowances,
});
const run = (allowances, publicFiles = []) => collectChecks({ manifest, budget: budget(allowances), sizeOf: (f) => sizes[f], publicFiles });

describe('size budget', () => {
  it('counts the main script with everything it loads up front', () => {
    expect([...closure(manifest, 'index.html')]).toEqual(['index.html', '_vendor.js', '_core.js']);
    const entry = run().find((c) => c.id === 'entry');
    expect(entry.size).toBe(140_000);
    expect(entry.over).toBe(false);
  });

  it('fails a route over 60 kB unless it has an allowance, and fails again if it grows past it', () => {
    expect(run().find((c) => c.id === 'route:src/pages/Big.jsx').over).toBe(true);
    expect(run({ 'route:src/pages/Big.jsx': 70 }).find((c) => c.id === 'route:src/pages/Big.jsx').over).toBe(false);
    expect(run({ 'route:src/pages/Big.jsx': 69 }).find((c) => c.id === 'route:src/pages/Big.jsx').over).toBe(true);
  });

  it('adds a public page to the main script without counting shared files twice', () => {
    const page = run().find((c) => c.id === 'page:/');
    expect(page.size).toBe(140_000 + 20_000 + 5_000);
  });

  it('checks public images by their size on disk', () => {
    const [img] = run({}, [['public/big.jpg', 250_000]]).filter((c) => c.id.startsWith('image:'));
    expect(img.over).toBe(true);
  });

  it('names a page the manifest lists only under a hashed name, since it then has no check', () => {
    const lost = {
      ...manifest,
      // A lazy part imports something only the page holds: no 'src/pages/MorphGuide.jsx' key.
      '_MorphGuide-g.js': { file: 'assets/MorphGuide-g.js', name: 'MorphGuide', isDynamicEntry: true },
      '_Layout-h.js': { file: 'assets/Layout-h.js', name: 'Layout', isDynamicEntry: true },
    };
    expect(pagesWithoutEntry(lost, ['Home', 'Big', 'MorphGuide'])).toEqual(['MorphGuide']);
    expect(pagesWithoutEntry(manifest, ['Home', 'Big'])).toEqual([]);
  });

  it('ships allowances only for things that are over their limit', () => {
    const real = JSON.parse(readFileSync('scripts/bundle-budget.json', 'utf8'));
    for (const [id, value] of Object.entries(real.allowances)) {
      const base = id.startsWith('route:') ? real.limits.routeKb : id.startsWith('page:') ? real.limits.publicPageKb : real.limits.publicImageKb;
      expect(value, id).toBeGreaterThan(base);
    }
    expect(real.limits).toEqual({ entryKb: 150, routeKb: 60, publicPageKb: 200, publicImageKb: 200 });
  });
});
