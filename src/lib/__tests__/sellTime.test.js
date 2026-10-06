import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));

import { buildTraitValueIndex } from '../traitValuation';
import {
  daysUntilShare,
  estimateSellTime,
  formatSellDays,
  priceBandFor,
  soldWithin,
} from '../sellTime';

const index = buildTraitValueIndex([
  { trait: 'Cappuccino', aliases: ['cappuccino', 'capp'], age_class: 'any', sex_class: 'any', n: 268, p25: 300, p50: 450, p75: 700 },
  { trait: 'Lilly White', aliases: ['lilly white'], age_class: 'any', sex_class: 'any', n: 686, p25: 250, p50: 375, p75: 600 },
  { trait: 'Partial Pinstripe', aliases: ['partial pinstripe'], age_class: 'any', sex_class: 'any', n: 247, p25: 100, p50: 150, p75: 250 },
]);

// Shaped like public.sell_time_model() output (6 Oct 2026), trimmed.
const MODEL = {
  allowed: true,
  rate: 0.011978,
  listings: 6520,
  sold: 1774,
  window: { from: '2026-05-17', to: '2026-06-07' },
  age_medians: { adult: 350, juvenile: 225, subadult: 300, hatchling: 175 },
  factors: {
    age: { adult: { factor: 0.852 }, hatchling: { factor: 1.241 } },
    sex: { male: { factor: 0.868 }, female: { factor: 1.025 }, unsexed: { factor: 1.247 } },
    price: { well_below: { factor: 1.213 }, typical: { factor: 0.88 }, above: { factor: 0.815 } },
    trait: { cappuccino: { factor: 1.238 }, 'lilly white': { factor: 1.012 }, 'partial pinstripe': { factor: 0.704 } },
  },
};

describe('steady-rate helpers', () => {
  it('half sell at ln 2 / rate', () => {
    expect(daysUntilShare(0.0119, 0.5)).toBeCloseTo(Math.LN2 / 0.0119, 6);
    expect(soldWithin(0.0119, daysUntilShare(0.0119, 0.5))).toBeCloseTo(0.5, 6);
  });

  it('formats days in plain words', () => {
    expect(formatSellDays(9.4)).toBe('9 days');
    expect(formatSellDays(35)).toBe('about 5 weeks');
    expect(formatSellDays(91)).toBe('about 3 months');
    expect(formatSellDays(400)).toBe('more than 6 months');
  });

  it('bands a price against the median like the SQL', () => {
    expect(priceBandFor(60, 100)).toBe('well_below');
    expect(priceBandFor(85, 100)).toBe('below');
    expect(priceBandFor(115, 100)).toBe('typical');
    expect(priceBandFor(140, 100)).toBe('above');
    expect(priceBandFor(200, 100)).toBe('well_above');
    expect(priceBandFor(null, 100)).toBeNull();
  });
});

describe('estimateSellTime', () => {
  it('returns null without an allowed model', () => {
    expect(estimateSellTime({}, { allowed: false }, index)).toBeNull();
    expect(estimateSellTime({}, null, index)).toBeNull();
  });

  it('a gecko with nothing known sells at the market pace', () => {
    const est = estimateSellTime({ sex: 'Unknown-ish' }, { ...MODEL, factors: {} }, index);
    expect(est.multiplier).toBe(1);
    expect(est.medianDays).toBeCloseTo(est.marketMedianDays, 6);
  });

  it('a cheap Cappuccino hatchling sells faster than the market', () => {
    const est = estimateSellTime(
      { morph_tags: ['Cappuccino'], weight_grams: 6, sex: 'Unsexed' },
      MODEL, index, { price: 200, median: 450 },
    );
    expect(est.medianDays).toBeLessThan(est.marketMedianDays);
    expect(est.faster.map((r) => r.label)).toEqual(
      expect.arrayContaining(['Hatchling', 'Unsexed', 'Cappuccino', 'Priced well below similar geckos']),
    );
    expect(est.slower).toEqual([]);
  });

  it('an overpriced adult male Partial Pinstripe sells slower', () => {
    const est = estimateSellTime(
      { morph_tags: ['Partial Pinstripe'], weight_grams: 50, sex: 'Male' },
      MODEL, index, { price: 200, median: 150 },
    );
    expect(est.medianDays).toBeGreaterThan(est.marketMedianDays);
    expect(est.slower[0].label).toBe('Partial Pinstripe');
    expect(est.slower.map((r) => r.label)).toEqual(expect.arrayContaining(['Adult', 'Male', 'Priced above similar geckos']));
  });

  it('averages trait factors instead of stacking them', () => {
    const one = estimateSellTime({ morph_tags: ['Cappuccino'] }, MODEL, index);
    const two = estimateSellTime({ morph_tags: ['Cappuccino', 'Lilly White'] }, MODEL, index);
    const sex = MODEL.factors.sex.unsexed.factor;
    expect(one.multiplier).toBeCloseTo(sex * 1.238, 6);
    expect(two.multiplier).toBeCloseTo(sex * Math.sqrt(1.238 * 1.012), 6);
    expect(two.traitsMatched).toBe(2);
  });

  it('falls back to the age median for price position without a trait median', () => {
    const est = estimateSellTime({ weight_grams: 50, sex: 'Female' }, MODEL, index, { price: 350 });
    expect(est.priceBand).toBe('typical');
  });

  it('keeps the total multiplier within bounds', () => {
    const wild = { ...MODEL, factors: { age: { adult: { factor: 50 } } } };
    const est = estimateSellTime({ weight_grams: 50 }, wild, index);
    expect(est.multiplier).toBe(3);
  });
});
