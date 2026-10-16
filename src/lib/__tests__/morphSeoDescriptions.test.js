import { describe, it, expect } from 'vitest';
import { MORPHS } from '../../data/morph-guide.js';
import { MORPH_META_DESCRIPTIONS, morphMetaDescription } from '../../data/morph-seo-descriptions.js';
import { morphSeo } from '../morphMeta.js';

const bySlug = Object.fromEntries(MORPHS.map((m) => [m.slug, m]));
const slugs = Object.keys(MORPH_META_DESCRIPTIONS);

describe('hand-written morph snippets', () => {
  it('covers the ten highest-impression morph pages, all of them real', () => {
    expect(slugs).toHaveLength(10);
    for (const slug of slugs) expect(bySlug[slug], slug).toBeTruthy();
  });

  it('fits a search snippet, names the morph and carries the guide price', () => {
    for (const slug of slugs) {
      const m = bySlug[slug];
      const text = morphMetaDescription(m);
      expect(text.length, slug).toBeGreaterThanOrEqual(120);
      expect(text.length, slug).toBeLessThanOrEqual(158);
      expect(text.toLowerCase(), slug).toContain(m.name.toLowerCase());
      expect(text, slug).toContain(m.priceRange);
    }
  });

  it('uses no dashes as punctuation', () => {
    for (const slug of slugs) {
      const text = morphMetaDescription(bySlug[slug]);
      expect(text, slug).not.toMatch(/[\u2013\u2014]|--| - /);
    }
  });

  it('never gives a polygenic look a percentage', () => {
    for (const slug of slugs) {
      if (bySlug[slug].inheritance !== 'polygenic') continue;
      expect(morphMetaDescription(bySlug[slug]), slug).not.toMatch(/%/);
    }
  });

  it('is what the page and the server HTML use, and other morphs keep the generated snippet', () => {
    expect(morphSeo(bySlug.harlequin).description).toBe(morphMetaDescription(bySlug.harlequin));
    const other = MORPHS.find((m) => !MORPH_META_DESCRIPTIONS[m.slug]);
    expect(morphMetaDescription(other)).toBeNull();
    expect(morphSeo(other).description.length).toBeLessThanOrEqual(158);
  });

  it('follows a price change in the morph data', () => {
    const changed = { ...bySlug.cappuccino, priceRange: '$1 to $2' };
    expect(morphMetaDescription(changed)).toContain('$1 to $2');
  });
});
