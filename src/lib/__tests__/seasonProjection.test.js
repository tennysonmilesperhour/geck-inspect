import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }));

import { buildTraitValueIndex } from '../traitValuation';
import {
  basicValueAt,
  chanceAtLeast,
  listingAgeAdvice,
  outcomeSeasonOdds,
  percentileValue,
  seasonSellTime,
  seededRandom,
  simulateSeason,
} from '../seasonProjection';

const band = (trait, age, sex, n, p25, p50, p75) => ({ trait, aliases: [trait.toLowerCase()], age_class: age, sex_class: sex, n, p25, p50, p75 });
const index = buildTraitValueIndex([
  band('Lilly White', 'any', 'any', 600, 250, 375, 600),
  band('Lilly White', 'hatchling', 'unsexed', 80, 200, 300, 450),
  band('Lilly White', 'adult', 'any', 120, 350, 500, 700),
  band('Dalmatian', 'any', 'any', 400, 100, 180, 300),
  band('Dalmatian', 'hatchling', 'unsexed', 60, 65, 100, 150),
  band('Dalmatian', 'adult', 'any', 90, 150, 220, 320),
]);

// Hand-built outcomes: half Lilly White, a quarter Dalmatian, a quarter lethal.
const OUTCOMES = [
  { label: 'Lilly White', text: 'Lilly White', probability: 0.5, lethal: false, prices: { hatchling: 300, juvenile: 340, subadult: 420, adult: 500 } },
  { label: 'Dalmatian', text: 'Dalmatian', probability: 0.25, lethal: false, prices: { hatchling: 100, juvenile: 130, subadult: 170, adult: 220 } },
  { label: 'Super Lilly White', text: 'Super Lilly White', probability: 0.25, lethal: true, prices: { hatchling: 0, juvenile: 0, subadult: 0, adult: 0 } },
];

describe('seededRandom', () => {
  it('repeats for the same seed and stays in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 100; i += 1) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('simulateSeason', () => {
  const sim = simulateSeason(OUTCOMES, { eggs: 16, hatchRate: 0.75, ageKey: 'hatchling', monthlyUpkeep: 0, seed: 7 });

  it('averages close to the expected value', () => {
    // 16 eggs x 0.75 hatch x (0.5 x 300 + 0.25 x 100) = 2100
    expect(sim.mean).toBeGreaterThan(2000);
    expect(sim.mean).toBeLessThan(2200);
  });

  it('keeps totals sorted and percentiles ordered', () => {
    expect(sim.totals[0]).toBeLessThanOrEqual(sim.totals[sim.totals.length - 1]);
    expect(percentileValue(sim, 10)).toBeLessThan(percentileValue(sim, 90));
  });

  it('reads chances off the simulated seasons', () => {
    expect(chanceAtLeast(sim, -1)).toBe(1);
    expect(chanceAtLeast(sim, 1e9)).toBe(0);
    const median = percentileValue(sim, 50);
    expect(chanceAtLeast(sim, median)).toBeGreaterThan(0.45);
    expect(chanceAtLeast(sim, median)).toBeLessThan(0.6);
  });

  it('takes upkeep off each hatchling', () => {
    const kept = simulateSeason(OUTCOMES, { eggs: 16, hatchRate: 0.75, ageKey: 'adult', monthlyUpkeep: 10, seed: 7 });
    // adult: 0.5 x 500 + 0.25 x 220 = 305 per egg, less 180 upkeep per survivor (0.75 of eggs)
    const expected = 16 * 0.75 * (0.5 * 500 + 0.25 * 220) - 16 * 0.75 * 0.75 * 180;
    expect(Math.abs(kept.mean - expected) / expected).toBeLessThan(0.05);
  });

  it('is the same every time for the same seed', () => {
    const again = simulateSeason(OUTCOMES, { eggs: 16, hatchRate: 0.75, monthlyUpkeep: 0, seed: 7 });
    expect(again.totals).toEqual(sim.totals);
  });
});

describe('outcomeSeasonOdds', () => {
  it('expects p x hatch x eggs and the chance of at least one', () => {
    const odds = outcomeSeasonOdds({ probability: 0.0625 }, { eggs: 16, hatchRate: 0.75 });
    expect(odds.expected).toBeCloseTo(0.75, 6);
    expect(odds.atLeastOne).toBeCloseTo(1 - (1 - 0.046875) ** 16, 6);
  });
});

describe('basicValueAt', () => {
  it('takes the cheapest low end at that age', () => {
    expect(basicValueAt(index, 'hatchling')).toBe(65);
    expect(basicValueAt(index, 'adult')).toBe(150);
  });
});

describe('listingAgeAdvice', () => {
  it('picks the age that earns most after upkeep', () => {
    const cheap = listingAgeAdvice(OUTCOMES, { monthlyUpkeep: 1 });
    expect(cheap.best.key).toBe('adult');
    const costly = listingAgeAdvice(OUTCOMES, { monthlyUpkeep: 30 });
    expect(costly.best.key).toBe('hatchling');
  });

  it('adds the wait for a buyer when the sell model is there', () => {
    const model = { allowed: true, rate: 0.012, factors: {}, age_medians: {} };
    const advice = listingAgeAdvice(OUTCOMES, { monthlyUpkeep: 8, sellModel: model, index });
    const hatch = advice.ages.find((a) => a.key === 'hatchling');
    expect(hatch.sell.halfDays).toBeCloseTo(Math.LN2 / 0.012, 0);
    expect(hatch.upkeep).toBeGreaterThan(8 * 4);
  });
});

describe('seasonSellTime', () => {
  it('is null without Enterprise', () => {
    expect(seasonSellTime(OUTCOMES, { allowed: false }, index)).toBeNull();
  });

  it('mixes outcome rates and orders half before most', () => {
    const model = { allowed: true, rate: 0.012, factors: { trait: { 'lilly white': { factor: 2 } } }, age_medians: {} };
    const t = seasonSellTime(OUTCOMES, model, index);
    expect(t.halfDays).toBeLessThan(t.mostDays);
    expect(t.halfDays).toBeLessThan(Math.LN2 / 0.012);
  });
});
