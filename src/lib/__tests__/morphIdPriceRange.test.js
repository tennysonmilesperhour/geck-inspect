// Morph ID's price section: asking prices from the Price Index with their
// sample size, never the model's own dollar guess; and its 0 to 100 scores
// shown as words that say they are the AI's own estimate.
import { describe, expect, it } from 'vitest';
import { buildTraitValueIndex } from '../traitValuation';
import { dollars, MIN_LISTINGS, morphIdPriceRows } from '../morphIdPriceRange';
import { evidenceWord, fitWord } from '../../components/morph-id/modelSignal';

const index = buildTraitValueIndex([
  { trait: 'Harlequin', aliases: ['harlequin', 'harley'], age_class: 'any', sex_class: 'any', n: 410, p25: 90, p50: 150, p75: 250 },
  { trait: 'Harlequin', aliases: ['harlequin'], age_class: 'hatchling', sex_class: 'any', n: 190, p25: 80, p50: 120, p75: 175 },
  { trait: 'Lilly White', aliases: ['lilly white', 'lily white'], age_class: 'any', sex_class: 'any', n: 220, p25: 250, p50: 400, p75: 650 },
  // Too few hatchling listings: falls back to all ages.
  { trait: 'Lilly White', aliases: ['lilly white'], age_class: 'hatchling', sex_class: 'any', n: 4, p25: 100, p50: 120, p75: 140 },
  // Too few listings at any age: never shown.
  { trait: 'Axanthic', aliases: ['axanthic'], age_class: 'any', sex_class: 'any', n: 6, p25: 300, p50: 500, p75: 900 },
]);

describe('morphIdPriceRows', () => {
  it('gives the middle half of asking prices and how many listings it rests on', () => {
    const rows = morphIdPriceRows({ primary_morph: 'harlequin', genetics: ['lilly_white'] }, index, 'hatchling');
    expect(rows).toEqual([
      { look: 'Harlequin', trait: 'Harlequin', low: 80, median: 120, high: 175, listings: 190, slice: 'hatchlings', gene: false },
      { look: 'Lilly White', trait: 'Lilly White', low: 250, median: 400, high: 650, listings: 220, slice: 'all ages', gene: true },
    ]);
  });

  it('shows nothing for a look with fewer than the minimum listings', () => {
    expect(MIN_LISTINGS).toBe(10);
    expect(morphIdPriceRows({ primary_morph: 'axanthic' }, index, 'adult')).toEqual([]);
  });

  it('uses all ages when the age is unknown, and nothing without an index', () => {
    expect(morphIdPriceRows({ primary_morph: 'harlequin' }, index, 'unknown')[0]).toMatchObject({ listings: 410, slice: 'all ages' });
    expect(morphIdPriceRows({ primary_morph: 'harlequin' }, null)).toEqual([]);
    expect(morphIdPriceRows(null, index)).toEqual([]);
  });

  it('reads a raw answer (genetic_traits) as well as the corrected panel state (genetics)', () => {
    const rows = morphIdPriceRows({ primary_morph: 'not_in_index', genetic_traits: ['lilly_white'] }, index, 'adult');
    expect(rows.map((r) => r.trait)).toEqual(['Lilly White']);
  });

  it('formats dollars with separators', () => {
    expect(dollars(1250)).toBe('$1,250');
  });
});

describe('model score words', () => {
  it('turns a fit score into a word', () => {
    expect(fitWord(82)).toBe('close fit');
    expect(fitWord(55)).toBe('partial fit');
    expect(fitWord(12)).toBe('weak fit');
    expect(fitWord(undefined)).toBe('weak fit');
  });

  it('turns a photo evidence score into a word', () => {
    expect(evidenceWord(90)).toBe('clear evidence');
    expect(evidenceWord(40)).toBe('some evidence');
    expect(evidenceWord('x')).toBe('little evidence');
  });
});
