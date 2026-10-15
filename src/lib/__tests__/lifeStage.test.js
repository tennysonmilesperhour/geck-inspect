import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CARE_CATEGORIES } from '@/data/care-guide';
import {
  JUVENILE_MAX_GRAMS,
  JUVENILE_MAX_MONTHS,
  SUBADULT_MAX_GRAMS,
  SUBADULT_MAX_MONTHS,
  lifeStage,
  monthsBefore,
  weighInIntervalDays,
} from '@/lib/lifeStage';

// The same cases as supabase/tests/logging_regressions.sql (section 1),
// all measured on 16 Oct 2026, so the app's dates and the reminder job
// agree.
const SHARED_CASES = [
  [null, null, 14],
  [2.5, null, 14],
  [14.9, null, 14],
  [15, null, 21],
  [34.9, null, 21],
  [35, null, 30],
  [null, '2026-01-01', 14],
  [null, '2025-10-17', 14],
  [null, '2025-10-16', 21],
  [null, '2025-04-17', 21],
  [null, '2025-04-16', 30],
  [40, '2026-03-01', 14],
  [10, '2020-01-01', 14],
  [25, '2020-01-01', 21],
  [50, '2024-01-01', 30],
];

describe('weigh-in cadence by life stage', () => {
  it.each(SHARED_CASES)('weight %s g, hatched %s: every %s days', (weight, hatch, expected) => {
    expect(weighInIntervalDays({ weight_grams: weight, hatch_date: hatch }, '2026-10-16')).toBe(expected);
    expect(weighInIntervalDays({ weight_grams: weight, hatch_date: hatch }, new Date(2026, 9, 16))).toBe(expected);
  });

  it('a newer weigh-in wins over the stored weight', () => {
    const gecko = { weight_grams: 12, hatch_date: null };
    expect(weighInIntervalDays(gecko, '2026-10-16')).toBe(14);
    expect(weighInIntervalDays(gecko, '2026-10-16', { weightGrams: 38 })).toBe(30);
  });

  it('names the stages', () => {
    expect(lifeStage({ weightGrams: 2, today: '2026-10-16' })).toBe('growing');
    expect(lifeStage({ weightGrams: 22, today: '2026-10-16' })).toBe('subadult');
    expect(lifeStage({ weightGrams: 48, today: '2026-10-16' })).toBe('adult');
    expect(lifeStage({ weightGrams: 'not a number', today: '2026-10-16' })).toBe('growing');
  });

  it('counts months the way Postgres does at a month end', () => {
    expect(monthsBefore({ y: 2026, m: 3, d: 31 }, 1)).toEqual({ y: 2026, m: 2, d: 28 });
    expect(monthsBefore({ y: 2024, m: 3, d: 31 }, 1)).toEqual({ y: 2024, m: 2, d: 29 });
    expect(monthsBefore({ y: 2026, m: 1, d: 15 }, 12)).toEqual({ y: 2025, m: 1, d: 15 });
    expect(monthsBefore({ y: 2026, m: 1, d: 15 }, 18)).toEqual({ y: 2024, m: 7, d: 15 });
  });
});

describe('the thresholds are the care guide life stages', () => {
  const stages = CARE_CATEGORIES.find((c) => c.id === 'life-stages');
  const fact = (label) => stages.quickFacts.find((f) => f.label === label)?.value || '';

  it('juvenile ends at 15 g and 12 months', () => {
    expect(fact('Juvenile')).toContain(`${JUVENILE_MAX_GRAMS} g`);
    expect(fact('Juvenile')).toContain(`${JUVENILE_MAX_MONTHS} months`);
  });
  it('sub-adult ends at 35 g and 18 months', () => {
    expect(fact('Sub-adult')).toContain(`${SUBADULT_MAX_GRAMS} g`);
    expect(fact('Sub-adult')).toContain(`${SUBADULT_MAX_MONTHS} months`);
    expect(fact('Adult')).toContain(`${SUBADULT_MAX_GRAMS} g+`);
  });
});

describe('the reminder job uses the same numbers', () => {
  const sql = readFileSync(
    new URL('../../../supabase/migrations/20261015151100_reminders_and_offline_logging.sql', import.meta.url),
    'utf8',
  );
  it('has the same grams, months and days', () => {
    expect(sql).toContain(`p_weight_grams < ${JUVENILE_MAX_GRAMS})`);
    expect(sql).toContain(`interval '${JUVENILE_MAX_MONTHS} months'`);
    expect(sql).toContain(`p_weight_grams < ${SUBADULT_MAX_GRAMS})`);
    expect(sql).toContain(`interval '${SUBADULT_MAX_MONTHS} months'`);
  });
});
