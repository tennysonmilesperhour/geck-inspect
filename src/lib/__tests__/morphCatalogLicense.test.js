import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MorphGuide from '../../data/morph-guide.js';
import { DATA_LICENSE, OPEN_DATASETS, openDataJsonLd } from '../../data/open-datasets.js';
import { PRICE_DATA_TERMS } from '../priceIndexPolicy.js';
import {
  loadPriceIndex,
  morphCatalogMarkdown,
  morphCatalogRecord,
  morphMarkdown,
  normalizeMorph,
  priceRowsForMorph,
  setMorphLabels,
} from '../../../scripts/lib/agent-content.mjs';

// The morph catalog (data/morphs.json, its CSV and llms/morphs.md, plus the
// MorphGuide/<slug>.md twins it links) is published under CC BY 4.0. The
// Price Index is not CC BY: its numbers are free to cite with a link
// (Tennyson's decision of 16 Oct 2026). So the catalog carries no Price
// Index numbers; each morph links to its rows in the index instead, and the
// catalog's machine-readable license is true for everything in it.

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

setMorphLabels(MorphGuide);
const MORPHS = MorphGuide.MORPHS.map(normalizeMorph);
const bySlug = Object.fromEntries(MORPHS.map((m) => [m.slug, m]));
const index = loadPriceIndex();
// Field names only Price Index rows carry.
const PRICE_ROW_KEYS = /"(askingPrices|p25|p75|median|listings|checked_on)"/;

describe('morph catalog license', () => {
  it('has Price Index rows to keep out (the snapshot covers morphs in the guide)', () => {
    expect(priceRowsForMorph(index, bySlug['lilly-white']).length).toBeGreaterThan(0);
  });

  it('data/morphs.json records carry a link to the Price Index, not its numbers', () => {
    const records = MORPHS.map((m) => morphCatalogRecord(m, index));
    expect(JSON.stringify(records)).not.toMatch(PRICE_ROW_KEYS);
    const lilly = records.find((r) => r.slug === 'lilly-white');
    expect(lilly.priceIndex).toEqual({
      name: 'Geck Inspect Price Index',
      traits: ['Lilly White'],
      json: 'https://geckinspect.com/data/price-index.json',
      csv: 'https://geckinspect.com/data/price-index.csv',
      terms: PRICE_DATA_TERMS,
    });
    // A morph the index has no rows for gets no link.
    const without = MORPHS.find((m) => priceRowsForMorph(index, m).length === 0);
    expect(records.find((r) => r.slug === without.slug).priceIndex).toBeNull();
  });

  it('the catalog markdown links the index instead of copying its table', () => {
    const md = morphCatalogMarkdown(bySlug['lilly-white'], { priceIndex: index });
    expect(md).not.toMatch(/\| Market \| Listings \|/);
    expect(md).not.toMatch(/\$\d[\d,]* \|/);
    expect(md).toContain('under the trait label "Lilly White": https://geckinspect.com/data/price-index.json');
    expect(md).toContain(PRICE_DATA_TERMS);
  });

  it('the MCP answer for one morph still shows its asking prices, read from the index', async () => {
    const table = morphMarkdown(bySlug['lilly-white'], { full: true, priceIndex: index });
    expect(table).toMatch(/\| Market \| Listings \|/);
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    try {
      const { callTool } = await import('../../../scripts/mcp/core.js');
      const answer = await callTool('get_morph', { morph: 'Lilly White' });
      expect(answer.structuredContent.askingPrices.length).toBeGreaterThan(0);
      expect(JSON.stringify(answer)).toMatch(/\| Market \| Listings \|/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('the build writes the catalog files from those functions and never copies askingPrices', () => {
    const build = read('scripts/build-agent-data.mjs');
    expect(build).not.toMatch(/askingPrices|priceRowsForMorph/);
    expect(build).toContain('morphs.map((m) => morphCatalogRecord(m, priceIndex))');
    expect(build).toMatch(/write\(`MorphGuide\/\$\{m\.slug\}\.md`, `\$\{morphCatalogMarkdown\(/);
    expect(build).toMatch(/write\('llms\/morphs\.md'[\s\S]*?morphCatalogMarkdown\(m, \{ level: 2/);
  });

  it('the /data page and llms.txt say the catalog links prices rather than carrying them', () => {
    const morphs = OPEN_DATASETS.find((d) => d.id === 'morphs');
    expect(morphs.license).toBe(DATA_LICENSE);
    expect(morphs.description).toMatch(/asking prices are not in this dataset/i);
    const node = openDataJsonLd('2026-10-16').find((n) => n['@id'] === 'https://geckinspect.com/data#morphs');
    expect(node.license).toBe(DATA_LICENSE);
    const llms = read('public/llms.txt');
    expect(llms).not.toMatch(/where the Price Index has them, current asking prices/);
    expect(llms).toContain('and a link to its asking prices in the Price Index where it has them');
  });
});

describe('the MCP bundle', () => {
  it('is rebuilt from the current agent-content helpers', () => {
    const bundle = read('api/_lib/mcp-core.js');
    expect(bundle).toContain('function priceIndexPointer(');
    expect(bundle).toContain('priceTable = true');
  });
});
