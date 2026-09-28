import { describe, expect, it } from 'vitest';
import { buildShortlist, leadingPattern } from '../../../supabase/functions/_shared/morph-naming.ts';
import { PRIMARY_MORPH_IDS } from '../../../supabase/functions/recognize-gecko-morph/taxonomy.ts';

const noLookup = { status: 'unavailable', neighbors: [], consensus: null };

function lookup(ranking, depth = 16) {
  return { status: 'available', neighbors: [], consensus: null, ranking, ranking_depth: depth };
}

describe('leadingPattern', () => {
  it('lets full pinning lead over a plain harlequin', () => {
    expect(leadingPattern('harlequin', 'full', [])).toEqual({ morph: 'pinstripe', reason: 'full pinstripe' });
  });

  it('lets the tricolor look lead over a plain harlequin', () => {
    expect(leadingPattern('harlequin', 'none', ['tricolor']).morph).toBe('tricolor');
  });

  it('breaks a tie the way the reference labels do, first alphabetically', () => {
    expect(leadingPattern('harlequin', 'partial', ['tricolor']).morph).toBe('partial_pinstripe');
    expect(leadingPattern('harlequin', 'quad', ['tricolor']).morph).toBe('quad_stripe');
  });

  it('keeps Harlequin when nothing else is present', () => {
    expect(leadingPattern('harlequin', 'none', ['high_contrast'])).toEqual({ morph: 'harlequin', reason: null });
    expect(leadingPattern('harlequin', 'unknown', [])).toEqual({ morph: 'harlequin', reason: null });
  });

  it('never replaces Extreme Harlequin or any other pattern', () => {
    expect(leadingPattern('extreme_harlequin', 'full', ['tricolor']).morph).toBe('extreme_harlequin');
    expect(leadingPattern('dalmatian', 'full', []).morph).toBe('dalmatian');
    expect(leadingPattern(null, 'full', []).morph).toBeNull();
  });
});

describe('buildShortlist', () => {
  const model = [
    { morph: 'harlequin', score: 80, why: 'Pattern climbs the flanks.' },
    { morph: 'extreme_harlequin', score: 60, why: 'Heavy leg coverage.' },
    { morph: 'flame', score: 20, why: 'Dorsal pattern only.' },
  ];

  it('puts the leading pattern first and keeps the Harlequin base second', () => {
    const list = buildShortlist(leadingPattern('harlequin', 'full', []), 'harlequin', model, noLookup, PRIMARY_MORPH_IDS);
    expect(list.map((c) => c.morph)).toEqual(['pinstripe', 'harlequin', 'extreme_harlequin']);
    expect(list[0].score).toBe(80);
    expect(list[0].why).toContain('full pinstripe');
  });

  it('fills the other slots from the photo lookup before the model runners-up', () => {
    const evidence = lookup([
      { primary_morph: 'harlequin', share: 0.4, support: 6, mean_similarity: 0.9 },
      { primary_morph: 'tricolor', share: 0.3, support: 5, mean_similarity: 0.9 },
      { primary_morph: 'pinstripe', share: 0.2, support: 3, mean_similarity: 0.9 },
    ]);
    const list = buildShortlist(leadingPattern('harlequin', 'none', []), 'harlequin', model, evidence, PRIMARY_MORPH_IDS);
    expect(list.map((c) => c.morph)).toEqual(['harlequin', 'tricolor', 'pinstripe']);
    expect(list[1]).toMatchObject({ source: 'photo_lookup', score: 30 });
    expect(list[1].why).toBe('5 of the 16 closest breeder-tagged reference photos carry this pattern.');
  });

  it('keeps the model reasoning when the lookup agrees with a model candidate', () => {
    const evidence = lookup([{ primary_morph: 'extreme_harlequin', share: 0.5, support: 8, mean_similarity: 0.9 }]);
    const list = buildShortlist(leadingPattern('harlequin', 'none', []), 'harlequin', model, evidence, PRIMARY_MORPH_IDS);
    expect(list[1]).toMatchObject({ morph: 'extreme_harlequin', why: 'Heavy leg coverage.', source: 'both' });
    expect(list[2].morph).toBe('flame');
  });

  it('skips lookup labels outside the taxonomy', () => {
    const evidence = lookup([{ primary_morph: 'not_a_morph', share: 0.9, support: 14, mean_similarity: 0.9 }]);
    const list = buildShortlist(leadingPattern('harlequin', 'none', []), 'harlequin', model, evidence, PRIMARY_MORPH_IDS);
    expect(list.map((c) => c.morph)).toEqual(['harlequin', 'extreme_harlequin', 'flame']);
  });
});
