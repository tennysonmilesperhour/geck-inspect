import { describe, it, expect } from 'vitest';
import { buildTraitValueIndex, valueFromTraitTable } from '../../../src/lib/traitValuation.js';
import { CORE_TRAITS, REFERENCE_GECKOS } from '../references.mjs';

// The bands each reference gecko uses, from live public.trait_value_table()
// output on 5 Oct 2026 (after the 'crested-gecko' species fix).
const row = (trait, aliases, age, sex, n, p25, p50, p75) => ({
  trait, aliases, age_class: age, sex_class: sex, n, p25, p50, p75,
});
const LW = ['lilly', 'lilly white', 'lily', 'lily white'];
const HQ = ['harlequin', 'harley'];
const AX = ['axan', 'axanthic'];
const DAL = ['dal', 'dalmatian'];
const LIVE_ROWS = [
  row('Lilly White', LW, 'any', 'any', 1686, 250, 400, 600),
  row('Lilly White', LW, 'adult', 'female', 199, 350, 545, 700),
  row('Harlequin', HQ, 'any', 'any', 2257, 120, 190, 300),
  row('Harlequin', HQ, 'hatchling', 'unsexed', 432, 75, 120, 175),
  row('Axanthic', AX, 'any', 'any', 214, 595, 800, 1200),
  row('Axanthic', AX, 'adult', 'male', 16, 900, 1225, 1600),
  row('Dalmatian', DAL, 'any', 'any', 1268, 109, 200, 350),
  row('Dalmatian', DAL, 'juvenile', 'female', 89, 125, 225, 375),
  row('Red', ['red'], 'any', 'any', 948, 150, 250, 400),
  row('Red', ['red'], 'juvenile', 'female', 76, 183, 300, 400),
];

describe('daily canary reference geckos', () => {
  const index = buildTraitValueIndex(LIVE_ROWS);
  const NOW = new Date('2026-10-05T12:00:00Z');

  for (const ref of REFERENCE_GECKOS) {
    it(`${ref.label} prices inside its alarm band on real data`, () => {
      const estimate = valueFromTraitTable(ref.gecko, index, 'breeder', NOW);
      expect(estimate).not.toBeNull();
      expect(estimate.value).toBeGreaterThanOrEqual(ref.min);
      expect(estimate.value).toBeLessThanOrEqual(ref.max);
    });
  }

  it('uses the most specific band (age and sex) when one exists', () => {
    const lilly = REFERENCE_GECKOS.find((r) => r.label.includes('Lilly White'));
    const estimate = valueFromTraitTable(lilly.gecko, index, 'breeder', NOW);
    expect(estimate.band.p50).toBe(545);
  });

  it('would fail on an empty table instead of passing silently', () => {
    const empty = buildTraitValueIndex([]);
    for (const ref of REFERENCE_GECKOS) {
      expect(valueFromTraitTable(ref.gecko, empty, 'breeder', NOW)).toBeNull();
    }
  });

  it('lists the core crested gecko morphs', () => {
    expect(CORE_TRAITS).toEqual(expect.arrayContaining(['Lilly White', 'Axanthic', 'Cappuccino', 'Harlequin']));
  });
});
