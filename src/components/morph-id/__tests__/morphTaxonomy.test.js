import { describe, expect, it } from 'vitest';
import {
  BASE_COLORS,
  GENETIC_TRAITS,
  MORPH_ID_CAPABILITIES,
  PATTERN_COLORS,
  PRIMARY_MORPHS,
  SECONDARY_TRAITS,
} from '../morphTaxonomy';
import { normalizeMorphText } from '../normalizeMorphText';

describe('Morph ID competitive coverage', () => {
  it('covers every trait ReptiDex publicly names as detectable', () => {
    const supported = new Set(MORPH_ID_CAPABILITIES.flatMap((group) => group.items));
    for (const id of [
      'lily_white', 'harlequin', 'pinstripe', 'dalmatian',
      'phantom_expression', 'axanthic', 'cream_on_cream',
      'partial_pinstripe', 'flame', 'tiger', 'black_base',
      'brindle', 'quad_stripe', 'white_wall',
    ]) {
      expect(supported.has(id), `${id} should be in the public capability manifest`).toBe(true);
    }
  });

  it('keeps generic photo-level expressions distinct from lineage-specific labels', () => {
    const geneticIds = new Set(GENETIC_TRAITS.map((trait) => trait.id));
    expect(geneticIds.has('axanthic')).toBe(true);
    expect(geneticIds.has('axanthic_vca')).toBe(true);
    expect(geneticIds.has('axanthic_tsm')).toBe(true);
    expect(normalizeMorphText('Axanthic dark base phantom').genetic_traits).toEqual(
      expect.arrayContaining(['axanthic', 'phantom_expression']),
    );
  });

  it('normalizes competitor vocabulary without folding it into a primary pattern', () => {
    const result = normalizeMorphText('Cream on cream dark base');
    expect(result.primary_morph).toBeNull();
    expect(result.genetic_traits).toContain('cream_on_cream');
    expect(result.base_color).toBe('black_base');
  });

  it('offers distinct base and pattern color vocabularies', () => {
    expect(BASE_COLORS.some((color) => color.id === 'black_base')).toBe(true);
    expect(PATTERN_COLORS.map((color) => color.id)).toEqual(
      expect.arrayContaining(['cream_white', 'orange_yellow', 'red_pink', 'mixed']),
    );
  });

  it('treats Tricolor as a color description on top of a pattern', () => {
    expect(PRIMARY_MORPHS.some((morph) => morph.id === 'tricolor')).toBe(false);
    expect(SECONDARY_TRAITS.some((trait) => trait.id === 'tricolor')).toBe(true);
    const result = normalizeMorphText('Tricolor Harlequin');
    expect(result.primary_morph).toBe('harlequin');
    expect(result.secondary_traits).toContain('tricolor');
    expect(normalizeMorphText('Tri-color').primary_morph).toBeNull();
  });
});
