import { describe, it, expect } from 'vitest';
import { MORPHS, MORPH_CATEGORIES, INHERITANCE, RARITY } from '../morph-guide';
import { KNOWN_MORPH_SLUGS, morphSlug } from '@/lib/morphUtils';

const CATEGORY_IDS = new Set(MORPH_CATEGORIES.map((c) => c.id));
const INHERITANCE_IDS = new Set(Object.values(INHERITANCE).map((i) => i.id));
const RARITY_IDS = new Set(Object.values(RARITY).map((r) => r.id));

describe('morph-guide MORPHS data integrity', () => {
  it('has a healthy number of morphs', () => {
    expect(MORPHS.length).toBeGreaterThanOrEqual(30);
  });

  it('gives every morph a unique, url-safe slug', () => {
    const slugs = MORPHS.map((m) => m.slug);
    for (const s of slugs) {
      expect(s, 'slug should be url-safe').toMatch(/^[a-z0-9-]+$/);
    }
    expect(new Set(slugs).size, 'slugs must be unique').toBe(slugs.length);
  });

  it('gives every morph a name and valid category / inheritance / rarity', () => {
    for (const m of MORPHS) {
      expect(m.name, `${m.slug} needs a name`).toBeTruthy();
      expect(CATEGORY_IDS.has(m.category), `${m.slug} category "${m.category}"`).toBe(true);
      expect(INHERITANCE_IDS.has(m.inheritance), `${m.slug} inheritance "${m.inheritance}"`).toBe(true);
      expect(RARITY_IDS.has(m.rarity), `${m.slug} rarity "${m.rarity}"`).toBe(true);
    }
  });

  it("keeps each slug consistent with its name via morphSlug (aliases aside)", () => {
    // Not every slug must equal morphSlug(name), but the ones that diverge
    // should be a small, understood set. Guard against accidental drift.
    const diverging = MORPHS.filter((m) => morphSlug(m.name) !== m.slug).map((m) => m.slug);
    expect(diverging).toEqual([]);
  });
});

describe('KNOWN_MORPH_SLUGS derives from the morph guide', () => {
  it('is exactly the set of morph-guide slugs (no hand-maintained drift)', () => {
    expect([...KNOWN_MORPH_SLUGS].sort()).toEqual(MORPHS.map((m) => m.slug).sort());
  });

  it('includes cream (the slug the old hardcoded list had dropped)', () => {
    expect(KNOWN_MORPH_SLUGS).toContain('cream');
  });
});
