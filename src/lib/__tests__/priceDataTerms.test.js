import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPEN_DATASETS, openDataJsonLd, DATA_LICENSE } from '../../data/open-datasets.js';
import { PRICE_DATA_LICENSE, PRICE_DATA_TERMS, PRICE_INDEX_WHAT } from '../priceIndexPolicy.js';
import { loadPriceIndex, priceIndexToMarkdown, morphMarkdown, normalizeMorph } from '../../../scripts/lib/agent-content.mjs';
import { MORPHS } from '../../data/morph-guide.js';

// Tennyson's decision of 16 Oct 2026: the Price Index is "an asking-price
// snapshot from public marketplace listings", not "original data", and its
// numbers are free to cite with a link, not CC BY 4.0. The morph and
// genetics data stay CC BY 4.0. The source sites are not named.

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const CC_BY = /creativecommons\.org\/licenses\/by|CC BY/i;
const ORIGINAL = /original (asking-price )?data/i;
// Marketplace names the price copy must not carry until counsel says so.
const SOURCE_NAMES = /morph ?market|pangea|fauna classifieds|kingsnake|largest online reptile marketplaces/i;

describe('Price Index terms', () => {
  it('are stated once and copied exactly where a module must stay dependency-free', () => {
    expect(PRICE_DATA_LICENSE).toBe('Free to cite with a link');
    expect(PRICE_DATA_TERMS).toBe('Free to cite with a link: you may quote and cite these numbers, with a link to the page they came from.');
    expect(PRICE_INDEX_WHAT).toBe('an asking-price snapshot from public marketplace listings');
    const price = OPEN_DATASETS.find((d) => d.id === 'price-index');
    expect(price.license).toBeNull();
    expect(price.licenseNote).toBe(PRICE_DATA_TERMS);
  });

  it('keep the Dataset markup for prices off CC BY, and the morph and genetics data on it', () => {
    const nodes = Object.fromEntries(openDataJsonLd('2026-10-16').filter((n) => n['@type'] === 'Dataset').map((n) => [n['@id'].split('#')[1], n]));
    expect(nodes['price-index'].license).toBeUndefined();
    expect(nodes['price-index'].usageInfo).toBe(PRICE_DATA_TERMS);
    expect(nodes['price-index'].description).toMatch(/^An asking-price snapshot from public marketplace listings/);
    expect(nodes.morphs.license).toBe(DATA_LICENSE);
    expect(nodes.genetics.license).toBe(DATA_LICENSE);
    for (const node of Object.values(nodes)) expect(JSON.stringify(node)).not.toMatch(SOURCE_NAMES);
  });

  it('are what the committed price snapshot says', () => {
    const snapshot = JSON.parse(read('public/data/price-index.json'));
    expect(snapshot.license).toBe(PRICE_DATA_TERMS);
    expect(snapshot.license).not.toMatch(CC_BY);
    expect(snapshot.licenseName).toBe(PRICE_DATA_LICENSE);
    expect(snapshot.description.toLowerCase()).toContain(PRICE_INDEX_WHAT);
    expect(snapshot.description).not.toMatch(ORIGINAL);
    expect(snapshot.description).not.toMatch(SOURCE_NAMES);
  });

  it('are in the generated price markdown and per-morph price tables, which never say "original data"', () => {
    const index = loadPriceIndex();
    const prices = priceIndexToMarkdown(index);
    expect(prices).toContain(PRICE_DATA_TERMS);
    expect(prices).toContain('An asking-price snapshot from public marketplace listings');
    const harlequin = morphMarkdown(normalizeMorph(MORPHS.find((m) => m.slug === 'harlequin')), { full: true, priceIndex: index, nameOf: (s) => s });
    expect(harlequin).toContain(PRICE_DATA_TERMS);
    // The morph's own sources may name a breeder's site; the price paragraph may not.
    const priceParagraph = harlequin.split('\n').find((line) => line.includes('Geck Inspect Price Index'));
    for (const text of [prices, priceParagraph]) {
      expect(text).not.toMatch(ORIGINAL);
      expect(text).not.toMatch(SOURCE_NAMES);
    }
  });

  it('replace "original data" and the CC BY claim for prices in every file written for agents and people', () => {
    for (const file of [
      'public/llms.txt',
      'public/llms-full.txt',
      'public/.well-known/mcp/server-card.json',
      'api/_lib/mcp-core.js',
      'scripts/build-agent-data.mjs',
      'scripts/lib/agent-content.mjs',
      'scripts/mcp/core.js',
      'scripts/prerender.mjs',
      'src/pages/OpenData.jsx',
      'src/data/open-datasets.js',
    ]) {
      const text = read(file);
      expect(text, file).not.toMatch(ORIGINAL);
      expect(text, file).not.toMatch(/price, morph and genetics data are licensed CC BY/i);
      expect(text, file).not.toMatch(/Data (files )?(are )?CC BY 4\.0\./);
      expect(text, file).not.toMatch(/largest online reptile marketplaces/i);
    }
    const llms = read('public/llms.txt');
    expect(llms).toContain('an asking-price snapshot from public marketplace listings');
    expect(llms).toContain('Price Index numbers are free to cite with a link: you may quote and cite them, with a link to the page they came from.');
    expect(read('public/llms-full.txt')).toContain(PRICE_DATA_TERMS);
    expect(read('api/_lib/mcp-core.js')).toContain(PRICE_DATA_TERMS);
    expect(read('src/pages/OpenData.jsx')).toContain('The Price Index is free to cite with a link');
  });
});

describe('the MCP server', () => {
  beforeAll(() => {
    // get_prices refreshes from the live site; answer from the bundled copy.
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  });
  afterAll(() => vi.unstubAllGlobals());

  it('describes prices as an asking-price snapshot that is free to cite, in its instructions, tool and answers', async () => {
    const { INSTRUCTIONS, TOOLS, callTool } = await import('../../../scripts/mcp/core.js');
    expect(INSTRUCTIONS).toContain(PRICE_INDEX_WHAT);
    expect(INSTRUCTIONS).toMatch(/free to cite with a link/);
    const getPrices = TOOLS.find((t) => t.name === 'get_prices');
    expect(getPrices.description).toContain(PRICE_INDEX_WHAT);
    const answer = await callTool('get_prices', { trait: 'Lilly White', market: 'US' });
    expect(answer.structuredContent?.note || JSON.stringify(answer)).toContain(PRICE_DATA_TERMS);
    expect(JSON.stringify(answer)).not.toMatch(CC_BY);
  });
});
