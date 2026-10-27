// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DATA_SOURCES, getSource } from '../marketAnalytics/sources';
import { scoreConfidence } from '../marketAnalytics/confidence';
import demo from '../marketAnalytics/v2/demoSnapshot.json';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('@/entities/User', () => ({ User: {} }));
import { supabase } from '@/lib/supabaseClient';
import ListingCard from '@/components/market/ListingCard';
import SellerPanel from '@/components/market/SellerPanel';

afterEach(cleanup);

const SOURCE_NAMES = /morph ?market|pangea|facebook|terraristik|snakebuddies|kleinanzeigen|geck data/i;
const SRC = resolve('src');

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

  it('links to the original listing with generic visible text', () => {
    const html = renderToStaticMarkup(<ListingCard listing={{
      title: 'Harlequin', morphs: ['Harlequin'], price: 250,
      listing_url: 'https://www.morphmarket.com/us/c/reptiles/crested-geckos/123',
      similar_p25: 200, similar_p50: 250, similar_p75: 300,
    }} />);
    expect(html).toContain('Harlequin');
    expect(html).toContain('$250');
    const container = document.createElement('div');
    container.innerHTML = html;
    const link = container.querySelector('a');
    expect(link.textContent).toBe('View listing');
    expect(link.href).toBe('https://www.morphmarket.com/us/c/reptiles/crested-geckos/123');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(container.textContent).not.toMatch(SOURCE_NAMES);
  });

  it.each([undefined, '', 'javascript:alert(1)', 'https://user:password@example.com/listing'])('does not link missing or unsafe metadata: %s', (listing_url) => {
    const html = renderToStaticMarkup(<ListingCard listing={{ title: 'Harlequin', price: 250, listing_url }} />);
    expect(html).toContain('Harlequin');
    expect(html).not.toContain('<a ');
  });

  it('preserves neutral links to cheaper similar listings', async () => {
    const url = 'https://www.morphmarket.com/us/c/reptiles/crested-geckos/456';
    supabase.rpc.mockResolvedValueOnce({ data: {
      slug: 'demo-store', listings: [{
        listing_id: 'own', title: 'Harlequin', price: 250, under_7d: 2,
        cheapest_new: [
          { listing_id: 'rival', title: 'Harlequin', price: 200, listing_url: url },
          { listing_id: 'unsafe', title: 'Harlequin', price: 190, listing_url: 'javascript:alert(1)' },
        ],
      }],
    }, error: null });
    const { container } = render(<SellerPanel />);
    const link = await screen.findByRole('link', { name: 'View listing' });
    expect(link.getAttribute('href')).toBe(url);
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(container.textContent).not.toMatch(SOURCE_NAMES);
  });

  it('keeps source names out of price, breeding, feed and analytics copy', () => {
    for (const file of [
      'pages/MarketPricing.jsx',
      'pages/Portfolio.jsx',
      'components/gecko/MarketValueCard.jsx',
      'components/market/DemoMarketBrief.jsx',
      'components/dashboard/HomeValues.jsx',
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
    const review = readFileSync(resolve(SRC, 'components/admin/ScrapedDataReview.jsx'), 'utf8');
    expect(review).not.toContain('record.source_website');
  });
});
