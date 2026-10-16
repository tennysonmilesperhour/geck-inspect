import { describe, expect, it } from 'vitest';
import { CARE_CATEGORIES } from '@/data/care-guide';
import {
  ADULT_MAX_G,
  ADULT_MIN_G,
  STAGE_PACE,
  ageInMonths,
  growthBandAt,
  growthVerdict,
  withGrowthBand,
} from '../growthBand';

const fact = (categoryId, label) =>
  CARE_CATEGORIES.find((c) => c.id === categoryId).quickFacts.find((f) => f.label === label).value;

describe('growth band follows the care guide', () => {
  it('uses the Life Stages pace and the adult weight range', () => {
    // Each Life Stages fact ends its range with the stage's end weight and
    // end age: "under 3 g · 0 to 3 months", "3 to 15 g · 3 to 12 months".
    const stage = (label) => fact('life-stages', label).match(/(\d+)\s*g\b.*?(\d+)\s*months/);
    const hatchling = stage('Hatchling');
    const juvenile = stage('Juvenile');
    const subadult = stage('Sub-adult');
    expect(STAGE_PACE).toEqual([
      [Number(hatchling[2]), Number(hatchling[1])],
      [Number(juvenile[2]), Number(juvenile[1])],
      [Number(subadult[2]), Number(subadult[1])],
    ]);
    expect(STAGE_PACE).toEqual([[3, 3], [12, 15], [18, 35]]);
    const adult = fact('overview', 'Adult weight').match(/(\d+)\D+(\d+)/);
    expect([ADULT_MIN_G, ADULT_MAX_G]).toEqual([Number(adult[1]), Number(adult[2])]);
  });

  it('gives sensible ranges at key ages', () => {
    expect(growthBandAt(0)).toEqual({ low: 1.5, high: 3 });
    expect(growthBandAt(6)).toEqual({ low: 3, high: 15 });
    expect(growthBandAt(12)).toEqual({ low: 11, high: 35 });
    expect(growthBandAt(18)).toEqual({ low: 25, high: 47.5 });
    expect(growthBandAt(24)).toEqual({ low: 35, high: 60 });
    expect(growthBandAt(60)).toEqual({ low: 35, high: 60 });
    expect(growthBandAt(-1)).toBeNull();
  });

  it('never has the lower edge above the upper edge', () => {
    for (let m = 0; m <= 36; m += 0.5) {
      const band = growthBandAt(m);
      expect(band.low).toBeLessThanOrEqual(band.high);
    }
  });
});

describe('growth verdict', () => {
  const gecko = { species: 'Crested Gecko', hatch_date: '2026-01-29' };
  const on = new Date(2026, 8, 29); // eight months old

  it('answers "is 18 g normal at 8 months?"', () => {
    const band = growthBandAt(ageInMonths(gecko.hatch_date, on));
    expect(band.low).toBeLessThan(10);
    // 18 g at 8 months is a healthy, fast-growing gecko (members' median
    // at 6 to 9 months was 14 g on 16 Oct 2026), so it sits inside the band.
    expect(growthVerdict(gecko, 18, on).level).toBe('within');
    expect(growthVerdict(gecko, 25, on).level).toBe('above');
    expect(growthVerdict(gecko, 10, on).level).toBe('within');
    expect(growthVerdict(gecko, 3, on).level).toBe('below');
    expect(growthVerdict(gecko, 10, on).text).toMatch(/within the typical .* for 8 months/);
  });

  it('calls a heavy adult above range, not ahead', () => {
    const adult = { species: 'Crested Gecko', hatch_date: '2023-01-01' };
    expect(growthVerdict(adult, 70, on).text).toMatch(/above the typical 35 to 60 g for an adult/);
  });

  it('does not warn about fat pads on a normal adult weight before 24 months', () => {
    // 20 months old on `on`: the band tops out near 51 g, but 55 g is a
    // normal adult weight (35 to 60 g).
    const young = { species: 'Crested Gecko', hatch_date: '2025-01-29' };
    const verdict = growthVerdict(young, 55, on);
    expect(verdict.level).toBe('above');
    expect(verdict.text).not.toMatch(/fat pads|for an adult/);
    expect(verdict.text).toMatch(/ahead of the typical/);
    expect(growthVerdict(young, 66, on).text).toMatch(/for an adult. Watch for fat pads/);
  });

  it('skips other species and unknown hatch dates', () => {
    expect(growthVerdict({ species: 'Leachianus', hatch_date: '2026-01-29' }, 10, on)).toBeNull();
    expect(growthVerdict({ species: 'Crested Gecko', hatch_date: null }, 10, on)).toBeNull();
    expect(growthVerdict(gecko, null, on)).toBeNull();
  });

  it('adds a band to each chart point', () => {
    const points = withGrowthBand([{ record_date: '2027-01-29', weight: 20 }], gecko);
    expect(points[0].band).toEqual([11, 35]);
    expect(withGrowthBand([{ record_date: '2027-01-29' }], { hatch_date: null })[0].band).toBeUndefined();
  });
});
