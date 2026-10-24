import { createElement, forwardRef } from 'react';

/**
 * A smaller stand-in for lucide-react's createLucideIcon. The production
 * build draws every lucide icon with it (scripts/vite-plugins/
 * lean-lucide-icons.mjs swaps it in for each icon file), while tests and
 * the dev server use lucide's own. The brand icons in
 * src/components/icons/BrandIcons.jsx use it everywhere.
 *
 * Why: lucide-react 1 draws its icons through a general-purpose builder
 * shared with its other frameworks, plus a settings provider
 * (LucideProvider) this app never uses. That added about 1 kB gzipped to
 * the main script, which every page downloads first, and pushed it past
 * its 150 kB budget. This draws the same <svg> for the props the app
 * passes (className, size, color, strokeWidth, absoluteStrokeWidth,
 * width, height and any other svg attribute), with the same classes and
 * the same aria-hidden rule. src/lib/__tests__/leanLucideIcon.test.jsx
 * renders both side by side, so a lucide update that changes what an
 * icon looks like fails a test instead of drifting quietly.
 */
export default function createLucideIcon(icon) {
  const names = ['lucide', ...[icon.name, ...(icon.aliases || [])].map((name) => `lucide-${name}`)];
  // The build drops the usual "size: 24" from each icon file (see the plugin).
  const box = icon.size || 24;
  return forwardRef(function LucideIcon({ color, size, strokeWidth, absoluteStrokeWidth, className, children, ...rest }, ref) {
    const width = rest.width ?? size ?? 24;
    const stroke = strokeWidth ?? 2;
    let labelled = Boolean(children);
    for (const key in rest) if (key.startsWith('aria-') || key === 'role' || key === 'title') labelled = true;
    return createElement(
      'svg',
      {
        ref,
        xmlns: 'http://www.w3.org/2000/svg',
        width,
        height: rest.height ?? size ?? 24,
        viewBox: `0 0 ${box} ${box}`,
        fill: 'none',
        stroke: color || 'currentColor',
        strokeWidth: absoluteStrokeWidth ? (Number(stroke) * box) / Number(width) : stroke,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className: [...new Set([...names, ...(className ? className.split(' ') : [])])].filter((name) => name.trim()).join(' '),
        'aria-hidden': labelled ? undefined : 'true',
        ...rest,
      },
      // One argument per shape, not an array, so the shapes need no React
      // keys (the build strips lucide's keys to save space).
      ...icon.node.map(([tag, attrs]) => createElement(tag, attrs)),
      children,
    );
  });
}
