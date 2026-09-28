import { describe, expect, it } from 'vitest';
import {
  FEMALE_IDEAL_AGE_MONTHS,
  FEMALE_IDEAL_WEIGHT_G,
  FEMALE_MIN_AGE_MONTHS,
  FEMALE_MIN_WEIGHT_G,
  femaleReadiness,
  latestWeightOf,
  readinessFor,
  showReadinessOnCard,
} from '../breedingReadiness';
import { CARE_CATEGORIES } from '@/data/care-guide';

const NOW = new Date(2026, 8, 28); // 28 Sep 2026, local time

function female(overrides = {}) {
  return { id: 'f1', sex: 'Female', species: 'Crested Gecko', hatch_date: '2024-09-01', ...overrides };
}

const weighed = (grams, date = '2026-09-20') => ({ grams, date });

describe('the badge follows the care guide', () => {
  const breeding = CARE_CATEGORIES.find((category) => category.id === 'breeding');
  const readinessSection = breeding.sections.find((section) => section.id === 'breeding-readiness');
  const femaleRow = readinessSection.body.find((block) => block.type === 'table').rows.find((row) => row[0] === 'Female');

  it('uses the same minimum weight and age', () => {
    expect(breeding.quickFacts.find((fact) => fact.label === 'Female minimum').value)
      .toBe(`${FEMALE_MIN_WEIGHT_G} g + ${FEMALE_MIN_AGE_MONTHS} months old`);
    expect(femaleRow[1]).toContain(`${FEMALE_MIN_WEIGHT_G} g`);
    expect(femaleRow[2]).toBe(`${FEMALE_MIN_AGE_MONTHS} months`);
  });

  it('uses the same ideal window', () => {
    expect(femaleRow[3]).toContain(`${FEMALE_IDEAL_WEIGHT_G}`);
    expect(femaleRow[3]).toContain(`${FEMALE_IDEAL_AGE_MONTHS}+ months`);
  });
});

describe('latestWeightOf', () => {
  it('takes the newest weigh-in for that gecko', () => {
    const records = [
      { gecko_id: 'f1', weight_grams: 38, record_date: '2026-08-01' },
      { gecko_id: 'f1', weight_grams: 41, record_date: '2026-09-15' },
      { gecko_id: 'other', weight_grams: 60, record_date: '2026-09-27' },
    ];
    expect(latestWeightOf(female(), records)).toEqual({ grams: 41, date: '2026-09-15' });
  });

  it('falls back to the weight on the gecko record, undated', () => {
    expect(latestWeightOf(female({ weight_grams: 42 }), [])).toEqual({ grams: 42, date: null });
    expect(latestWeightOf(female(), [])).toEqual({ grams: null, date: null });
  });
});

describe('femaleReadiness', () => {
  it('only judges crested gecko females', () => {
    expect(femaleReadiness(female({ sex: 'Male' }), weighed(50), NOW)).toBeNull();
    expect(femaleReadiness(female({ species: 'Gargoyle Gecko' }), weighed(50), NOW)).toBeNull();
    expect(femaleReadiness(female({ species: null }), weighed(50), NOW)).not.toBeNull();
  });

  it('is ready at 40 g and 18 months', () => {
    const result = femaleReadiness(female({ hatch_date: '2025-03-20' }), weighed(40), NOW);
    expect(result).toMatchObject({ level: 'ready', label: 'Breeding ready', ageMonths: 18, stale: false });
    expect(result.reason).toBe('40 g at 18 months, past the 40 g and 18 month minimum. Ideal is 45 to 55 g at 24 months or more.');
  });

  it('marks the ideal window', () => {
    const result = femaleReadiness(female({ hatch_date: '2024-06-01' }), weighed(48), NOW);
    expect(result.level).toBe('ideal');
    expect(result.reason).toContain('in the ideal window');
  });

  it('says exactly what is missing when she is nearly there', () => {
    const result = femaleReadiness(female({ hatch_date: '2025-05-15' }), weighed(37), NOW);
    expect(result).toMatchObject({ level: 'nearly', label: 'Nearly ready', ageMonths: 16 });
    expect(result.reason).toBe('37 g at 16 months. Needs 3 g more weight and 2 months more age. The care guide minimum is 40 g and 18 months.');
  });

  it('is not ready when either number is far off', () => {
    expect(femaleReadiness(female({ hatch_date: '2025-10-01' }), weighed(31), NOW).level).toBe('not_yet');
    const heavyButYoung = femaleReadiness(female({ hatch_date: '2026-01-01' }), weighed(44), NOW);
    expect(heavyButYoung.level).toBe('not_yet');
    expect(heavyButYoung.reason).toContain('44 g at 8 months. Needs 10 months more age.');
  });

  it('asks for what it cannot judge', () => {
    expect(femaleReadiness(female(), weighed(null), NOW)).toMatchObject({ level: 'unknown' });
    expect(femaleReadiness(female({ hatch_date: null }), weighed(42), NOW).reason).toContain('Add a hatch date');
    expect(femaleReadiness(female({ hatch_date: null }), weighed(30), NOW).level).toBe('not_yet');
  });

  it('flags an old or undated weight', () => {
    expect(femaleReadiness(female(), weighed(45, '2026-06-01'), NOW)).toMatchObject({ stale: true, daysSinceWeighed: 119 });
    expect(femaleReadiness(female(), weighed(45, null), NOW).stale).toBe(true);
  });

  it('works from loaded weigh-ins', () => {
    const records = [{ gecko_id: 'f1', weight_grams: 46, record_date: '2026-09-20' }];
    expect(readinessFor(female(), records, NOW).level).toBe('ideal');
  });
});

describe('showReadinessOnCard', () => {
  const ready = { level: 'ready' };
  it('shows ready and nearly on live breeding stock only', () => {
    expect(showReadinessOnCard(female(), ready)).toBe(true);
    expect(showReadinessOnCard(female(), { level: 'nearly' })).toBe(true);
    expect(showReadinessOnCard(female(), { level: 'not_yet' })).toBe(false);
    expect(showReadinessOnCard(female({ status: 'Pet' }), ready)).toBe(false);
    expect(showReadinessOnCard(female({ archived: true }), ready)).toBe(false);
    expect(showReadinessOnCard(female(), null)).toBe(false);
  });
});
