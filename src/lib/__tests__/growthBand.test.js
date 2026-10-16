import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

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

  it('reads plainly from 18 to 23 months, when a gecko is an adult but the band is still below 60 g', () => {
    for (const months of [18, 19, 20, 21, 22, 23]) {
      const hatch = new Date(on);
      hatch.setMonth(hatch.getMonth() - months);
      const adultAge = { species: 'Crested Gecko', hatch_date: hatch.toISOString().slice(0, 10) };
      const band = growthBandAt(ageInMonths(adultAge.hatch_date, on));
      expect(band.high, `${months} months`).toBeLessThan(ADULT_MAX_G);
      // Inside the adult range but above the band: no "fast growth", no
      // adult warning, and the adult range is named.
      const heavy = growthVerdict(adultAge, 58, on).text;
      expect(heavy, `${months} months`).toMatch(new RegExp(`ahead of the typical .* for ${months} months, but inside the ${ADULT_MIN_G} to ${ADULT_MAX_G} g adult range, which is fine\\.$`));
      expect(heavy).not.toMatch(/Fast growth|fat pads|above the typical/);
      // Past the adult ceiling it is the adult warning, with the adult range.
      expect(growthVerdict(adultAge, 62, on).text).toBe(`62 g is above the typical ${ADULT_MIN_G} to ${ADULT_MAX_G} g for an adult. Watch for fat pads and feed CGD three times a week.`);
      expect(growthVerdict(adultAge, 40, on).text).toMatch(new RegExp(`^40 g is within the typical [\\d.]+ to [\\d.]+ g for ${months} months\\.$`));
    }
    // A juvenile ahead of the band still reads as fast growth.
    expect(growthVerdict(gecko, 25, on).text).toMatch(/Fast growth is usually fine/);
  });

  it('marks the re-fit upper edge as provisional until there is more data', () => {
    const source = readFileSync(resolve(ROOT, 'src/lib/growthBand.js'), 'utf8');
    expect(source).toMatch(/PROVISIONAL/);
    expect(source).toMatch(/50 or\s+(\*\s+)?more geckos/);
    expect(source).toMatch(/at least 5 keepers/);
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
