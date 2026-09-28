import { describe, expect, it } from 'vitest';
import { getComboMorph, outcomeCombos, outcomeTraits } from '@/lib/genetics';

describe('outcome labels', () => {
  it('drops the engine suffix and the XXX marketing term', () => {
    expect(getComboMorph('xxx')?.is_marketing_term).toBe(true);
    const harlequin = {
      phenotype_description: 'Lilly White, Harlequin, Pinstripe [combos: XXX]',
      matching_combo_morphs: ['xxx'],
    };
    expect(outcomeTraits(harlequin)).toBe('Lilly White, Harlequin, Pinstripe');
    expect(outcomeCombos(harlequin)).toEqual([]);
  });

  it('keeps real combos', () => {
    const frapp = {
      phenotype_description: 'Lilly White, Cappuccino, Harlequin [combos: Frappuccino, XXX]',
      matching_combo_morphs: ['frappuccino', 'xxx'],
    };
    expect(outcomeCombos(frapp)).toEqual(['Frappuccino']);
    expect(outcomeTraits(frapp)).toBe('Lilly White, Cappuccino, Harlequin');
  });

  it('reads a missing description as Wild-type', () => {
    expect(outcomeTraits({})).toBe('Wild-type');
    expect(outcomeTraits({ phenotype_description: 'Wild-type' })).toBe('Wild-type');
  });
});
