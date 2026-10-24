import { describe, expect, it } from 'vitest';
import { COMPARISONS, MORPH_GUIDE_COUNT } from '@/data/comparisons';
import { MORPHS } from '@/data/morph-guide';
import { priceIndexProof } from '@/lib/priceIndexProof';

const FILLABLE = new Set(['freeGeckos', 'keeper', 'breeder', 'keeperAnnual', 'breederAnnual', 'morphCount']);
const allText = (c) => [c.metaTitle, c.metaDescription, c.heading, c.lead, c.pickThem, c.pickUs, ...c.theyWin, ...c.weWin, ...c.rows.flat()];

describe('comparison pages', () => {
  it('keeps the Morph Guide count true', () => {
    expect(MORPH_GUIDE_COUNT).toBe(MORPHS.length);
  });

  it('uses unique slugs that fit a URL', () => {
    const slugs = COMPARISONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('has no dash punctuation and only known placeholders', () => {
    for (const c of COMPARISONS) {
      for (const text of allText(c)) {
        expect(text, `${c.slug}: ${text}`).not.toMatch(/[\u2013\u2014]| -- /);
        for (const [, key] of text.matchAll(/\{(\w+)\}/g)) expect(FILLABLE.has(key), `${c.slug}: {${key}}`).toBe(true);
      }
    }
  });

  it('fits the SEO audit limits', () => {
    for (const c of COMPARISONS) {
      expect(c.metaTitle.length, c.slug).toBeLessThan(70);
      expect(c.metaDescription.length, c.slug).toBeGreaterThanOrEqual(60);
      expect(c.metaDescription.length, c.slug).toBeLessThanOrEqual(300);
    }
  });

  it('concedes something on every page and cites a source for every named product', () => {
    for (const c of COMPARISONS) {
      expect(c.theyWin.length, c.slug).toBeGreaterThan(0);
      if (!['spreadsheet', 'chatgpt-morph-id'].includes(c.slug)) expect(c.sources.length, c.slug).toBeGreaterThan(0);
    }
  });
});

describe('Price Index proof line', () => {
  const index = {
    latest: [
      { trait: null, market: 'US', listings: 6985, checked_on: '2026-10-06' },
      { trait: null, market: 'KR', listings: 2957, checked_on: '2026-10-06' },
      { trait: 'Harlequin', market: 'US', listings: 900, checked_on: '2026-10-06' },
    ],
  };
  const now = Date.parse('2026-10-20T12:00:00Z');

  it('counts each market total once and ignores trait rows', () => {
    expect(priceIndexProof(index, now)).toEqual({ listings: 9942, markets: 2, checkedOn: '2026-10-06' });
  });

  it('shows nothing when the data is old, small or missing', () => {
    expect(priceIndexProof(index, Date.parse('2026-12-31T00:00:00Z'))).toBe(null);
    expect(priceIndexProof({ latest: [{ trait: null, listings: 40, checked_on: '2026-10-06' }] }, now)).toBe(null);
    expect(priceIndexProof(null, now)).toBe(null);
  });
});
