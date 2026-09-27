import { describe, it, expect } from 'vitest';
import {
  toWords,
  buildTraitValueIndex,
  matchTraitsInText,
  matchGeckoTraits,
  ageClassFor,
  sexClassFor,
  bandFor,
  valueFromTraitTable,
} from '../traitValuation';

// A slice of real public.trait_value_table() output (27 Sep 2026).
const ROWS = [
  { trait: 'Lilly White', aliases: ['lilly', 'lilly white', 'lily', 'lily white'], age_class: 'any', sex_class: 'any', n: 563, p25: 250, p50: 375, p75: 600 },
  { trait: 'Lilly White', aliases: ['lilly', 'lilly white', 'lily', 'lily white'], age_class: 'adult', sex_class: 'any', n: 126, p25: 350, p50: 500, p75: 700 },
  { trait: 'Lilly White', aliases: ['lilly', 'lilly white', 'lily', 'lily white'], age_class: 'adult', sex_class: 'female', n: 59, p25: 395, p50: 600, p75: 800 },
  { trait: 'Lilly White', aliases: ['lilly', 'lilly white', 'lily', 'lily white'], age_class: 'any', sex_class: 'male', n: 207, p25: 275, p50: 400, p75: 600 },
  { trait: 'Harlequin', aliases: ['harlequin', 'harley'], age_class: 'any', sex_class: 'any', n: 756, p25: 100, p50: 175, p75: 300 },
  { trait: 'Harlequin', aliases: ['harlequin', 'harley'], age_class: 'hatchling', sex_class: 'unsexed', n: 190, p25: 80, p50: 120, p75: 175 },
  { trait: 'Extreme Harlequin', aliases: ['ex harley', 'extreme harlequin', 'extreme harley'], age_class: 'any', sex_class: 'any', n: 485, p25: 200, p50: 300, p75: 450 },
  { trait: 'Tri-color', aliases: ['tri color', 'tri-color', 'tricolor'], age_class: 'any', sex_class: 'any', n: 571, p25: 200, p50: 300, p75: 450 },
  { trait: 'Axanthic', aliases: ['axan', 'axanthic'], age_class: 'any', sex_class: 'any', n: 66, p25: 600, p50: 813, p75: 1450 },
  { trait: 'Het Axanthic', aliases: ['het ax', 'het axanthic'], age_class: 'any', sex_class: 'any', n: 90, p25: 275, p50: 398, p75: 538 },
  { trait: 'Dalmatian', aliases: ['dal', 'dalmatian'], age_class: 'any', sex_class: 'any', n: 421, p25: 100, p50: 180, p75: 300 },
  { trait: 'Super Dalmatian', aliases: ['super dal', 'super dalmatian'], age_class: 'any', sex_class: 'any', n: 151, p25: 200, p50: 350, p75: 550 },
  { trait: 'Phantom', aliases: ['phantom'], age_class: 'any', sex_class: 'any', n: 248, p25: 150, p50: 278, p75: 412 },
  { trait: 'Empty Back', aliases: ['empty back'], age_class: 'any', sex_class: 'any', n: 161, p25: 150, p50: 250, p75: 400 },
  { trait: 'Cream', aliases: ['cream'], age_class: 'any', sex_class: 'any', n: 108, p25: 150, p50: 250, p75: 356 },
  { trait: 'Red', aliases: ['red'], age_class: 'any', sex_class: 'any', n: 305, p25: 150, p50: 300, p75: 450 },
  { trait: 'Red Base', aliases: ['red base'], age_class: 'any', sex_class: 'any', n: 159, p25: 150, p50: 280, p75: 500 },
];

const index = buildTraitValueIndex(ROWS);
const names = (keys) => keys.map((k) => index.traits.get(k).name);

describe('toWords', () => {
  it('lowercases, strips punctuation and fixes common misspellings', () => {
    expect(toWords('Tri-Color / Dalmation!')).toEqual(['tri', 'color', 'dalmatian']);
    expect(toWords('LillyWhite')).toEqual(['lilly', 'white']);
  });
});

describe('matchTraitsInText', () => {
  it('matches taxonomy synonyms and spelling variants', () => {
    expect(names(matchTraitsInText('Tricolor', index))).toEqual(['Tri-color']);
    expect(names(matchTraitsInText('Tri-Color Harlequin', index))).toEqual(['Tri-color', 'Harlequin']);
    expect(names(matchTraitsInText('Lily White', index))).toEqual(['Lilly White']);
    expect(names(matchTraitsInText('Super dalmation', index))).toEqual(['Super Dalmatian']);
  });

  it('prefers the longest phrase', () => {
    expect(names(matchTraitsInText('Extreme Harlequin', index))).toEqual(['Extreme Harlequin']);
    expect(names(matchTraitsInText('Red Base Confetti', index))).toEqual(['Red Base']);
  });

  it('finds every trait in compound free text', () => {
    expect(names(matchTraitsInText('Axanthic Lilly White', index))).toEqual(['Axanthic', 'Lilly White']);
    expect(names(matchTraitsInText('Red and yellow Lilly white ', index))).toEqual(['Red', 'Lilly White']);
    expect(names(matchTraitsInText('Cream Base', index))).toEqual(['Cream']);
  });

  it('counts a proven het only when the table prices it, and never as the visual trait', () => {
    expect(names(matchTraitsInText('Lilly White Het Axanthic', index))).toEqual(['Lilly White', 'Het Axanthic']);
    expect(names(matchTraitsInText('100% het Axanthic', index))).toEqual(['Het Axanthic']);
    expect(names(matchTraitsInText('Het Phantom\nHarlequin', index))).toEqual(['Harlequin']);
    expect(names(matchTraitsInText('Het Empty Back', index))).toEqual([]);
  });

  it('skips possible hets', () => {
    expect(matchTraitsInText('Possible het Axanthic', index)).toEqual([]);
    expect(matchTraitsInText('pos het axanthic', index)).toEqual([]);
    expect(matchTraitsInText('50% het Axanthic', index)).toEqual([]);
    expect(matchTraitsInText('ph Axanthic', index)).toEqual([]);
  });

  it('returns nothing for notes with no trait in them', () => {
    expect(matchTraitsInText('From breeder katarzyna pas', index)).toEqual([]);
    expect(matchTraitsInText('', index)).toEqual([]);
    expect(matchTraitsInText(null, index)).toEqual([]);
  });
});

describe('matchGeckoTraits', () => {
  it('uses selected morph tags first', () => {
    const gecko = { morph_tags: ['Lilly White', 'Portholes'], morphs_traits: 'Harlequin' };
    expect(names(matchGeckoTraits(gecko, index))).toEqual(['Lilly White']);
  });

  it('falls back to the free-text traits field', () => {
    const gecko = { morph_tags: ['Full Tail'], morphs_traits: 'Tricolor Lilly white' };
    expect(names(matchGeckoTraits(gecko, index))).toEqual(['Tri-color', 'Lilly White']);
  });
});

describe('ageClassFor and sexClassFor', () => {
  const now = new Date('2026-09-27T12:00:00Z');

  it('uses weight first', () => {
    expect(ageClassFor({ weight_grams: 4 }, now)).toBe('hatchling');
    expect(ageClassFor({ weight_grams: 15 }, now)).toBe('juvenile');
    expect(ageClassFor({ weight_grams: 30, hatch_date: '2026-08-01' }, now)).toBe('subadult');
    expect(ageClassFor({ weight_grams: 45 }, now)).toBe('adult');
  });

  it('falls back to hatch date, then estimated hatch year', () => {
    expect(ageClassFor({ hatch_date: '2026-06-01' }, now)).toBe('hatchling');
    expect(ageClassFor({ hatch_date: '2025-12-01' }, now)).toBe('juvenile');
    expect(ageClassFor({ estimated_hatch_year: 2023 }, now)).toBe('adult');
    expect(ageClassFor({}, now)).toBeNull();
  });

  it('maps app sex values to listing sex classes', () => {
    expect(sexClassFor({ sex: 'Female' })).toBe('female');
    expect(sexClassFor({ sex: 'Male' })).toBe('male');
    expect(sexClassFor({ sex: 'Unsexed' })).toBe('unsexed');
    expect(sexClassFor({})).toBe('unsexed');
  });
});

describe('bandFor', () => {
  const lilly = index.traits.get('lilly white');

  it('uses the most specific band with data', () => {
    expect(bandFor(lilly, 'adult', 'female')).toMatchObject({ level: 'age_sex', p50: 600 });
    expect(bandFor(lilly, 'adult', 'male')).toMatchObject({ level: 'age', p50: 500 });
    expect(bandFor(lilly, 'juvenile', 'male')).toMatchObject({ level: 'sex', p50: 400 });
    expect(bandFor(lilly, null, 'unsexed')).toMatchObject({ level: 'all', p50: 375 });
  });
});

describe('valueFromTraitTable', () => {
  const now = new Date('2026-09-27T12:00:00Z');

  it('prices off the most valuable matched trait', () => {
    const v = valueFromTraitTable({ morph_tags: ['Harlequin', 'Axanthic'], sex: 'Unsexed' }, index, 'breeder', now);
    expect(v.trait).toBe('Axanthic');
    expect(v.value).toBe(813);
    expect(v.matchedTraits).toEqual(['Harlequin', 'Axanthic']);
  });

  it('matches on age and sex', () => {
    const v = valueFromTraitTable({ morph_tags: ['Lilly White'], sex: 'Female', weight_grams: 48 }, index, 'breeder', now);
    expect(v.value).toBe(600);
    expect(v.levelLabel).toBe('adult female');
  });

  it('moves along the band with quality tier', () => {
    const gecko = { morph_tags: ['Lilly White'], sex: 'Female', weight_grams: 48 };
    expect(valueFromTraitTable(gecko, index, 'pet', now).value).toBe(395);
    expect(valueFromTraitTable(gecko, index, 'high_end', now).value).toBe(700);
    expect(valueFromTraitTable(gecko, index, 'investment', now).value).toBe(800);
    expect(valueFromTraitTable(gecko, index, 'unknown_tier', now).value).toBe(600);
  });

  it('returns null when nothing matches or the table is empty', () => {
    expect(valueFromTraitTable({ morph_tags: ['Full Tail'] }, index, 'breeder', now)).toBeNull();
    expect(valueFromTraitTable({ morph_tags: ['Lilly White'] }, buildTraitValueIndex([]), 'breeder', now)).toBeNull();
    expect(valueFromTraitTable({ morph_tags: ['Lilly White'] }, null, 'breeder', now)).toBeNull();
  });
});
