import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MORPHS } from '@/data/morph-guide';
import { MORPH_SLUG_ALIASES } from '../../../scripts/seo-routes.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const SLUGS = new Set(MORPHS.map((m) => m.slug));

// Vercel applies redirects before it serves a prerendered page, so an
// alias that shares a name with a real morph page sends every direct
// visit (and every sitemap crawl) to a different page. That happened to
// /MorphGuide/phantom and /MorphGuide/super-lilly-white when they got
// their own entries on 16 Oct 2026.
describe('morph slug aliases', () => {
  it('never shadow a real morph page', () => {
    const clashes = Object.keys(MORPH_SLUG_ALIASES).filter((from) => SLUGS.has(from));
    expect(clashes).toEqual([]);
  });

  it('point at a real morph page', () => {
    const broken = Object.entries(MORPH_SLUG_ALIASES).filter(([, to]) => !SLUGS.has(to));
    expect(broken).toEqual([]);
  });

  it('leave no redirect in vercel.json away from a real morph page', () => {
    const vercel = JSON.parse(readFileSync(resolve(ROOT, 'vercel.json'), 'utf8'));
    const shadowed = (vercel.redirects || [])
      .map((r) => r.source)
      .filter((source) => {
        const m = /^\/MorphGuide\/([a-z0-9-]+)$/.exec(source || '');
        return m && SLUGS.has(m[1]);
      });
    expect(shadowed).toEqual([]);
  });
});
