import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMorphMarketCSV, exportMorphMarketCSV, MORPHMARKET_EXPORT_BLOCKED_REASON } from '../morphmarketSync';

afterEach(() => vi.unstubAllGlobals());

describe('MorphMarket export safety pause', () => {
  it.each([
    { id: 'missing-values' },
    { id: 'complete', asking_price: 125, hatch_date: '2025-06-08', weight_grams: 35,
      sex: 'Male', status: 'For Sale', morphs_traits: 'Lilly White',
      marketplace_description: 'Healthy', image_urls: ['https://example.com/a.jpg'] },
  ])('refuses CSV creation and download for $id before browser side effects', (gecko) => {
    const blob = vi.fn();
    vi.stubGlobal('Blob', blob);
    expect(() => buildMorphMarketCSV([gecko])).toThrow(MORPHMARKET_EXPORT_BLOCKED_REASON);
    expect(() => exportMorphMarketCSV([gecko])).toThrow(MORPHMARKET_EXPORT_BLOCKED_REASON);
    expect(blob).not.toHaveBeenCalled();
  });
});
