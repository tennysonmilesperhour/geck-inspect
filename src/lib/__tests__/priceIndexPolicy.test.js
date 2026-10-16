import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MORPHS } from '../../data/morph-guide.js';
import {
  PRICE_INDEX_MIN_LISTINGS,
  PRICE_INDEX_SAMPLE_RULE,
  PRICE_INDEX_THIN_LISTINGS,
  PRICE_TRAIT_LINK_SLUGS,
  applyPricePolicy,
  isThinRow,
  priceTraitMorphSlug,
} from '../priceIndexPolicy.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('Price Index minimum sample', () => {
  it('leaves out rows under the minimum and marks thin ones', () => {
    const index = {
      latest: [
        { market: 'KR', trait: 'Harlequin', listings: 6 },
        { market: 'KR', trait: 'Extreme Harlequin', listings: 395 },
        { market: 'US', trait: 'Olive', listings: 29 },
        { market: 'US', trait: 'Patternless', listings: 30 },
        { market: 'US', trait: 'Buckskin', listings: 99 },
        { market: 'US', trait: null, listings: 6985 },
      ],
      monthly: [
        { market: 'US', trait: 'Olive', avg_listings: 17 },
        { market: 'US', trait: null, avg_listings: 7000 },
      ],
    };
    const out = applyPricePolicy(index);
    expect(out.latest.map((r) => r.trait)).toEqual(['Extreme Harlequin', 'Patternless', 'Buckskin', null]);
    expect(out.latest.map((r) => r.thin)).toEqual([false, true, true, false]);
    expect(out.monthly).toHaveLength(1);
    expect(applyPricePolicy(out)).toEqual(out);
    expect(applyPricePolicy(null)).toBeNull();
    expect(isThinRow({ listings: PRICE_INDEX_THIN_LISTINGS })).toBe(false);
  });

  it('is already applied to the committed snapshot the site falls back on', () => {
    const snapshot = JSON.parse(read('public/data/price-index.json'));
    expect(snapshot.latest.length).toBeGreaterThan(0);
    for (const row of snapshot.latest) {
      expect(row.listings, `${row.market} ${row.trait}`).toBeGreaterThanOrEqual(PRICE_INDEX_MIN_LISTINGS);
      expect(row.thin, `${row.market} ${row.trait}`).toBe(row.listings < PRICE_INDEX_THIN_LISTINGS);
    }
    expect(snapshot.methodology.join(' ')).toContain(PRICE_INDEX_SAMPLE_RULE);
  });

  it('matches the database function', () => {
    const sql = read('supabase/migrations/20261016090300_seo.sql');
    expect(sql.match(new RegExp(`for_sale >= ${PRICE_INDEX_MIN_LISTINGS}\\b`, 'g'))).toHaveLength(2);
    expect(sql).toContain(`'thin', for_sale < ${PRICE_INDEX_THIN_LISTINGS}`);
    expect(sql).not.toMatch(/for_sale >= 5\b/);
  });

  it('states the rule on the pages that show prices', () => {
    expect(PRICE_INDEX_SAMPLE_RULE).toContain(String(PRICE_INDEX_MIN_LISTINGS));
    expect(PRICE_INDEX_SAMPLE_RULE).not.toMatch(/[\u2013\u2014]/);
    expect(read('src/components/public/PriceIndexTable.jsx')).toContain('PRICE_INDEX_MIN_LISTINGS');
    expect(read('src/pages/OpenData.jsx')).toContain('PRICE_INDEX_SAMPLE_RULE');
    for (const file of ['src/components/public/PriceIndexTable.jsx', 'src/pages/OpenData.jsx', 'scripts/prerender.mjs', 'scripts/lib/agent-content.mjs', 'scripts/mcp/core.js', 'scripts/build-agent-data.mjs']) {
      expect(read(file), file).not.toMatch(/(least|fewer than|needs) 5 listings|5\+ listings/);
    }
  });

  it('links market traits only to real Morph Guide pages', () => {
    const slugs = new Set(MORPHS.map((m) => m.slug));
    for (const slug of PRICE_TRAIT_LINK_SLUGS) expect(slugs.has(slug), slug).toBe(true);
    expect(priceTraitMorphSlug('Reverse Pinstripe')).toBe('pinstripe');
    expect(priceTraitMorphSlug('Drippy')).toBeNull();
    expect(priceTraitMorphSlug('constructor')).toBeNull();
  });
});
