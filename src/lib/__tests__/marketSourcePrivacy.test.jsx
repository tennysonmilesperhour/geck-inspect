// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { DATA_SOURCES, getSource } from '../marketAnalytics/sources';
import { scoreConfidence } from '../marketAnalytics/confidence';
import demo from '../marketAnalytics/v2/demoSnapshot.json';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));
import ListingCard from '@/components/market/ListingCard';

const SOURCE_NAMES = /morph ?market|pangea|facebook|terraristik|snakebuddies|kleinanzeigen|geck data/i;
const SRC = fileURLToPath(new URL('../../', import.meta.url));

describe('market source privacy', () => {
  it('keeps the source registry and demo generic without changing pricing confidence', () => {
    expect(JSON.stringify(DATA_SOURCES)).not.toMatch(SOURCE_NAMES);
    expect(JSON.stringify(demo.source)).not.toMatch(SOURCE_NAMES);
    expect(demo.source.id).toBe('external.marketplace');
    expect(scoreConfidence({ sourceId: 'external.marketplace', sampleSize: 100 }))
      .toBeCloseTo(0.8 * (1 - Math.exp(-5)));
    const unknown = getSource('external.private-supplier');
    expect(unknown.label).toBe('Market data');
    expect(unknown.short).toBe('Market');
  });

  it('does not link market cards to the scraped listing', () => {
    const html = renderToStaticMarkup(<ListingCard listing={{
      title: 'Harlequin', morphs: ['Harlequin'], price: 250,
      listing_url: 'https://www.morphmarket.com/us/c/reptiles/crested-geckos/123',
      similar_p25: 200, similar_p50: 250, similar_p75: 300,
    }} />);
    expect(html).toContain('Harlequin');
    expect(html).toContain('$250');
    expect(html).not.toMatch(/<a\b|morphmarket|Open the listing/);
  });

  it('keeps source names out of price, breeding, feed and analytics copy', () => {
    for (const file of [
      'pages/MarketPricing.jsx',
      'components/innovations/MorphPriceIndex.jsx',
      'components/breeding/PairingValuePanel.jsx',
      'components/breeding/SeasonProjectionPanel.jsx',
      'components/market/SellTimeEstimate.jsx',
      'components/market/MarketBriefPanel.jsx',
      'components/market/MarketTapePanel.jsx',
      'components/market-analytics/v2/MarketAnalyticsV2.jsx',
    ]) {
      expect(readFileSync(resolve(SRC, file), 'utf8'), file)
        .not.toMatch(SOURCE_NAMES);
    }
    const review = readFileSync(new URL('../../components/admin/ScrapedDataReview.jsx', import.meta.url), 'utf8');
    expect(review).not.toContain('record.source_website');
    const seller = readFileSync(new URL('../../components/market/SellerPanel.jsx', import.meta.url), 'utf8');
    expect(seller).not.toContain('r.listing_url');
  });
});
