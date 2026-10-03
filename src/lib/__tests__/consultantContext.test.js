import { describe, expect, it } from 'vitest';
import { buildTraitValueIndex } from '../traitValuation';
import { buildConsultantFacts, findMentionedGeckos, isPairingQuestion, isValueQuestion } from '../consultantContext';
import { pairingEggValue } from '../pairingValue';

const index = buildTraitValueIndex([
  { trait: 'Lilly White', aliases: ['lilly white', 'lily white'], age_class: 'hatchling', sex_class: 'unsexed', n: 60, p25: 175, p50: 250, p75: 350 },
  { trait: 'Lilly White', aliases: ['lilly white', 'lily white'], age_class: 'adult', sex_class: 'female', n: 40, p25: 400, p50: 600, p75: 900 },
  { trait: 'Harlequin', aliases: ['harlequin'], age_class: 'hatchling', sex_class: 'unsexed', n: 190, p25: 80, p50: 120, p75: 175 },
]);

const geckos = [
  { id: 'g1', name: 'Luna', sex: 'Female', morph_tags: ['Lilly White', 'Harlequin', 'Moonglow'], weight_grams: 45 },
  { id: 'g2', name: 'Atlas', sex: 'Male', morph_tags: ['Soft Scale', 'Het Axanthic'], weight_grams: 40 },
  { id: 'g3', name: 'Luna Belle', sex: 'Female', morph_tags: ['Harlequin'] },
];

describe('question detection', () => {
  it('spots pairing and value questions', () => {
    expect(isPairingQuestion('What would Luna x Atlas make?')).toBe(true);
    expect(isPairingQuestion('Should I pair Luna with Atlas?')).toBe(true);
    expect(isPairingQuestion('How often should I mist?')).toBe(false);
    expect(isValueQuestion('What is Luna worth?')).toBe(true);
    expect(isValueQuestion('How warm should the tank be?')).toBe(false);
  });
});

describe('findMentionedGeckos', () => {
  it('finds names in message order and prefers the longer name', () => {
    expect(findMentionedGeckos('pair Atlas with Luna', geckos).map((g) => g.name)).toEqual(['Atlas', 'Luna']);
    expect(findMentionedGeckos('is Luna Belle a good match', geckos).map((g) => g.name)).toEqual(['Luna Belle']);
    expect(findMentionedGeckos('lunatic', geckos)).toEqual([]);
  });
});

describe('buildConsultantFacts', () => {
  it('adds nothing for an everyday question', () => {
    expect(buildConsultantFacts('How often should I mist?', { geckos, priceIndex: index })).toBe('');
  });

  it('uses the calculator and value table for a collection pairing', () => {
    const facts = buildConsultantFacts('What would Luna and Atlas produce?', { geckos, priceIndex: index });
    expect(facts).toMatch(/Use these numbers exactly as given/);
    // Male listed first, Soft Scale translated (not dropped), Moonglow flagged.
    expect(facts.indexOf('Atlas (male)')).toBeLessThan(facts.indexOf('Luna (female)'));
    expect(facts).toMatch(/Tags the calculator cannot use: Moonglow/);
    const expected = pairingEggValue(geckos[1], geckos[0], index);
    expect(facts).toContain(`Expected value per egg: $${expected.perEgg.toLocaleString('en-US')}`);
  });

  it('reads a typed pairing with the omnibox parser', () => {
    const facts = buildConsultantFacts('odds for lilly white x lilly white?', { geckos: [], priceIndex: null });
    expect(facts).toMatch(/Pairing as typed/);
    expect(facts).toMatch(/25\.0% Super Lilly White \(does not survive\)/);
    expect(facts).not.toMatch(/Expected value per egg/);
  });

  it('prices one gecko from the value table', () => {
    const facts = buildConsultantFacts('What is Luna worth?', { geckos, priceIndex: index });
    expect(facts).toMatch(/Value table estimate for Luna: about \$/);
  });
});
