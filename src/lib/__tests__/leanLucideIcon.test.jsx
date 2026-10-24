import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as lucide from 'lucide-react';
import { __iconData as xData } from 'lucide-react/dist/esm/icons/x.mjs';
import { __iconData as loaderData } from 'lucide-react/dist/esm/icons/loader-circle.mjs';
import { __iconData as circleCheckData } from 'lucide-react/dist/esm/icons/circle-check.mjs';
import { __iconData as menuData } from 'lucide-react/dist/esm/icons/menu.mjs';
import { __iconData as heartData } from 'lucide-react/dist/esm/icons/heart.mjs';
import createLucideIcon from '../leanLucideIcon';
import { Facebook, Instagram, Twitter, Youtube } from '@/components/icons/BrandIcons';
import { isLucideIconFactory, trimLucideIconFile } from '../../../scripts/vite-plugins/lean-lucide-icons.mjs';

// What the build ships: the icon data with the keys and size removed.
const asBuilt = ({ size: _size, ...icon }) => ({
  ...icon,
  node: icon.node.map(([tag, { key: _key, ...attrs }]) => [tag, attrs]),
});

const icons = [
  ['X', xData],
  ['Loader2', loaderData],
  ['CircleCheck', circleCheckData],
  ['Menu', menuData],
  ['Heart', heartData],
];

const propSets = [
  {},
  { className: 'w-4 h-4 text-emerald-400' },
  { className: '  w-5   h-5 ' },
  { className: 'lucide extra' },
  { size: 16 },
  { size: 18, strokeWidth: 1.5 },
  { color: '#10b981' },
  { absoluteStrokeWidth: true, size: 48 },
  { width: 10, height: 20 },
  { fill: 'currentColor', style: { opacity: 0.5 } },
  { 'aria-label': 'Close' },
  { 'aria-hidden': 'false' },
  { role: 'img' },
  { id: 'icon', 'data-state': 'open', onClick: () => {} },
];

describe('lean lucide icons (production build)', () => {
  it.each(icons)('%s draws the same svg as lucide-react for every prop the app passes', (name, data) => {
    const Real = lucide[name];
    const Lean = createLucideIcon(asBuilt(data));
    for (const props of propSets) {
      expect(renderToStaticMarkup(<Lean {...props} />)).toBe(renderToStaticMarkup(<Real {...props} />));
    }
    // A title inside the icon counts as a label, so it is not hidden.
    expect(renderToStaticMarkup(<Lean><title>Saved</title></Lean>)).toBe(renderToStaticMarkup(<Real><title>Saved</title></Real>));
  });

  it('forwards refs like lucide does', () => {
    const Lean = createLucideIcon(asBuilt(xData));
    expect(Lean.$$typeof).toBe(lucide.X.$$typeof);
  });

  it('draws the brand icons lucide 1 removed, with the usual classes and props', () => {
    for (const [Icon, name] of [[Instagram, 'instagram'], [Facebook, 'facebook'], [Youtube, 'youtube'], [Twitter, 'twitter']]) {
      const html = renderToStaticMarkup(<Icon className="w-4 h-4 text-pink-400" />);
      expect(html).toContain(`class="lucide lucide-${name} w-4 h-4 text-pink-400"`);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('stroke="currentColor"');
      expect(html).toMatch(/<(path|rect)\b/);
    }
    expect(renderToStaticMarkup(<Instagram aria-label="Instagram" size={16} />)).not.toContain('aria-hidden');
  });

  it('only redirects the import that lucide icon files make', () => {
    const icon = '/app/node_modules/.pnpm/lucide-react@1.59.0_react@18.3.1/node_modules/lucide-react/dist/esm/icons/x.mjs';
    expect(isLucideIconFactory('../createLucideIcon.mjs', icon)).toBe(true);
    expect(isLucideIconFactory('../createLucideIcon.mjs', '/app/src/components/Thing.jsx')).toBe(false);
    expect(isLucideIconFactory('../Icon.mjs', icon)).toBe(false);
  });

  it('matches the icon files lucide-react ships today', () => {
    // If a lucide update changes this, the build quietly falls back to
    // lucide's own (bigger) drawing function; this says so first.
    const require = createRequire(path.resolve('package.json'));
    const file = path.join(path.dirname(require.resolve('lucide-react/package.json')), 'dist', 'esm', 'icons', 'x.mjs');
    const source = readFileSync(file, 'utf8');
    expect(source).toContain("import createLucideIcon from '../createLucideIcon.mjs';");
    const trimmed = trimLucideIconFile(source);
    expect(trimmed).not.toMatch(/key:|size: 24|__iconData\.node;/);
    expect(trimmed).toContain('name: "x"');
    expect(trimmed).toContain('d: "M18 6 6 18"');
  });
});
