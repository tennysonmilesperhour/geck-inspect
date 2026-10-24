import { describe, expect, it } from 'vitest';
import { homeSeasonCounts, homeSeasonValue } from '../homeProjection';
import { buildMorphAverages, valueGecko } from '../portfolioValue';

describe('homepage values', () => {
  it('counts this lay season, keeping hatched archives but excluding deleted incubating eggs', () => {
    expect(homeSeasonCounts([
      { lay_date: '2026-03-01', status: 'Hatched', archived: true },
      { lay_date: '2026-03-01', status: 'Incubating' },
      { lay_date: '2026-03-01', status: 'Incubating', archived: true },
      { lay_date: '2026-03-01', status: 'Infertile' },
      { lay_date: '2025-03-01', status: 'Hatched' },
    ], 2026)).toEqual({ hatched: 1, incubating: 1 });
  });
  it('applies hatch rate only to unhatched eggs and retains fractional expected hatchlings', () => {
    const input = { hatched: 14, incubating: 6, plannedEggs: 12, hatchRate: 80, averageValue: 225 };
    expect(homeSeasonValue(input)).toBe(6390);
    expect(homeSeasonValue({ ...input, averageValue: 250 })).toBe(7100);
    expect(homeSeasonValue({ ...input, hatchRate: 0 })).toBe(3150);
    for (const invalid of [{ hatchRate: 101 }, { plannedEggs: -1 }, { averageValue: NaN }, { averageValue: 0 }]) {
      expect(homeSeasonValue({ ...input, ...invalid })).toBeNull();
    }
  });
  it('keeps Portfolio valuation precedence and missing-data coverage', () => {
    const averages = buildMorphAverages([]);
    expect(valueGecko({ listing_price: 400, asking_price: 300 }, averages, null)).toMatchObject({ value: 400, basis: 'listing' });
    expect(valueGecko({ asking_price: 300 }, averages, null)).toMatchObject({ value: 300, basis: 'asking' });
    expect(valueGecko({ market_price_estimate: '{"average":250}' }, averages, null)).toMatchObject({ value: 250, basis: 'ai_estimate' });
    expect(valueGecko({ market_price_estimate: 'invalid' }, averages, null)).toMatchObject({ value: 0, basis: 'unpriced' });
  });
});
