// A market whose newest full check is more than a week old is marked out of
// date in every copy of the Price Index. On 28 Oct 2026 the US rows dated
// from 6 Oct while Europe, Japan and South Korea were checked daily, and the
// pages, llms files and MCP answers all showed the US numbers as current.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRICE_INDEX_STALE_DAYS,
  priceCheckDay,
  staleMarketNote,
  staleMarkets,
} from '../priceIndexPolicy.js';

const NOW = Date.parse('2026-10-28T02:00:00Z');
const row = (market, checked_on, trait = null, listings = 500) => ({
  market, checked_on, trait, listings, p25: 100, median: 150, p75: 250, thin: false,
});
const INDEX = {
  generated_at: '2026-10-28T01:00:00Z',
  latest: [
    row('US', '2026-10-06'),
    row('US', '2026-10-06', 'Lilly White', 300),
    row('EU', '2026-10-27'),
    row('JP', '2026-10-27'),
    row('KR', '2026-10-27', 'Extreme Harlequin', 395),
  ],
  monthly: [],
};
const DASHES = new RegExp('[\\u2013\\u2014]| -- ');

describe('stale Price Index markets', () => {
  it('finds the market not fully checked for over a week, and only that one', () => {
    expect(staleMarkets(INDEX, NOW)).toEqual([{ market: 'US', checked_on: '2026-10-06', days: 22 }]);
    expect(staleMarkets(INDEX, INDEX.generated_at).map((s) => s.market)).toEqual(['US']);
  });

  it(`allows ${PRICE_INDEX_STALE_DAYS} days before calling a market out of date`, () => {
    const at = Date.parse(`2026-10-${String(6 + PRICE_INDEX_STALE_DAYS).padStart(2, '0')}T23:00:00Z`);
    expect(staleMarkets(INDEX, at).map((s) => s.market)).toEqual([]);
    expect(staleMarkets(INDEX, at + 86400000).map((s) => s.market)).toEqual(['US']);
    expect(staleMarkets(null, NOW)).toEqual([]);
    expect(staleMarkets(INDEX, 'not a date')).toEqual([]);
  });

  it('says it in plain words', () => {
    const note = staleMarketNote(staleMarkets(INDEX, NOW)[0], 'United States');
    expect(note).toBe('Out of date: the last full check of United States listings was 6 October 2026, 22 days ago. These prices may have moved since.');
    expect(note).not.toMatch(DASHES);
    expect(priceCheckDay('2026-10-06')).toBe('6 October 2026');
  });

  it('marks the market in the llms price markdown', async () => {
    const { priceIndexToMarkdown } = await import('../../../scripts/lib/agent-content.mjs');
    const md = priceIndexToMarkdown(INDEX);
    const us = md.slice(md.indexOf('### United States'), md.indexOf('### ', md.indexOf('### United States') + 4));
    expect(us).toContain('Out of date: the last full check of United States listings was 6 October 2026');
    const eu = md.slice(md.indexOf('### Europe'));
    expect(eu.split('\n### ')[0]).not.toContain('Out of date');
  });
});

describe('the MCP price answer', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('adds the out-of-date note for a stale market it shows, and lists it in the structured answer', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, json: () => Promise.resolve(INDEX) }));
    const { callTool } = await import('../../../scripts/mcp/core.js');
    const us = await callTool('get_prices', { market: 'US' });
    const text = us.content.map((c) => c.text).join('\n');
    expect(text).toContain('Out of date: the last full check of United States listings was 6 October 2026, 22 days ago.');
    expect(us.structuredContent.stale_markets).toEqual([{ market: 'US', checked_on: '2026-10-06', days: 22 }]);
    const eu = await callTool('get_prices', { market: 'EU' });
    expect(eu.content.map((c) => c.text).join('\n')).not.toContain('Out of date');
    expect(eu.structuredContent.stale_markets).toEqual([]);
  });
});
