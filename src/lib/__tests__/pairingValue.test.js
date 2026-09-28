import { describe, expect, it } from 'vitest';
import { buildTraitValueIndex } from '../traitValuation';
import { eggValue, pairingEggValue, viableEggCount } from '../pairingValue';

// Hatchling bands in the shape of public.trait_value_table() output.
const index = buildTraitValueIndex([
  { trait: 'Lilly White', aliases: ['lilly white', 'lily white'], age_class: 'hatchling', sex_class: 'unsexed', n: 60, p25: 175, p50: 250, p75: 350 },
  { trait: 'Harlequin', aliases: ['harlequin'], age_class: 'hatchling', sex_class: 'unsexed', n: 190, p25: 80, p50: 120, p75: 175 },
  { trait: 'Pinstripe', aliases: ['pinstripe'], age_class: 'hatchling', sex_class: 'unsexed', n: 120, p25: 100, p50: 150, p75: 220 },
]);

describe('eggValue', () => {
  it('weights each outcome by its odds, with untraited babies at the floor price', () => {
    const phenotypes = [
      { phenotype_description: 'Harlequin', probability: 0.5 },
      { phenotype_description: 'Pinstripe', probability: 0.25 },
      { phenotype_description: 'Wild-type', probability: 0.25 },
    ];
    const v = eggValue(phenotypes, index);
    // 0.5 x 120 + 0.25 x 150 + 0.25 x floor (80, the low end of Harlequin)
    expect(v.perEgg).toBe(118);
    expect(v.outcomes[0]).toMatchObject({ label: 'Harlequin', probability: 0.5, price: 120, matched: true });
    expect(v.outcomes.find((o) => o.label === 'Wild-type')).toMatchObject({ price: 80, matched: false });
  });

  it('groups outcomes by the trait that sets the price', () => {
    const v = eggValue([
      { phenotype_description: 'Lilly White, Harlequin', probability: 0.25 },
      { phenotype_description: 'Lilly White', probability: 0.25 },
      { phenotype_description: 'Harlequin', probability: 0.25 },
      { phenotype_description: 'Super Lilly White', probability: 0.25, health_risk: 'lethal' },
    ], index);
    expect(v.groups.map((g) => [g.label, g.probability, g.price])).toEqual([
      ['Lilly White', 0.5, 250],
      ['Harlequin', 0.25, 120],
      ['Does not survive', 0.25, 0],
    ]);
  });

  it('returns zero without a price table', () => {
    expect(eggValue([{ phenotype_description: 'Harlequin', probability: 1 }], null).perEgg).toBe(0);
  });
});

describe('pairingEggValue', () => {
  it('counts the lethal Super Lilly White quarter as $0 for Lilly White x Lilly White', () => {
    const lw = { id: 'a', morph_tags: ['lilly_white'] };
    const v = pairingEggValue(lw, { ...lw, id: 'b' }, index);
    expect(v.lethalShare).toBe(0.25);
    // 0.5 x 250 (Lilly White) + 0.25 x 80 (Wild-type at the floor) + 0.25 x 0
    expect(v.perEgg).toBe(145);
    expect(v.outcomes.find((o) => o.lethal)).toMatchObject({ probability: 0.25, price: 0 });
  });

  it('returns null when a parent is missing', () => {
    expect(pairingEggValue(null, { id: 'b' }, index)).toBeNull();
  });
});

describe('viableEggCount', () => {
  it('counts incubating and hatched eggs only', () => {
    expect(viableEggCount([
      { status: 'Incubating' }, { status: 'Hatched' }, { status: 'Slug' },
      { status: 'Infertile' }, { status: 'Hatched', archived: true },
    ])).toBe(2);
  });
});
