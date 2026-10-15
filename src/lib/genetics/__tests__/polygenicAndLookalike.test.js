import { describe, it, expect } from 'vitest';
import { translateMorphTags, tagsToSpec, POLYGENIC_LOCI } from '../tagTranslation';
import { predictWeighted } from '../predictWeighted';
import { polygenicLookChances } from '../polygenic';
import { LOOKALIKE_WARNING_CODE } from '../lethalLookalike';
import { waitlistOutcomes } from '@/lib/pairingWaitlist';

const labels = (prediction) => prediction.offspring_phenotypes.map((o) => o.phenotype_description);
const lookalike = (prediction) => prediction.warnings.find((w) => w.code === LOOKALIKE_WARNING_CODE);

describe('polygenic looks never get a Mendelian percentage', () => {
  it('Harlequin x Harlequin no longer prints "25% Extreme Harlequin"', () => {
    // Before: the engine treated Harlequin as one gene and returned
    // 25% / 50% / 25% Extreme Harlequin / Harlequin / normal.
    const s = translateMorphTags(['Harlequin']);
    const d = translateMorphTags(['Harlequin']);
    expect(s.spec.loci).toEqual({});
    expect(s.polygenic).toEqual([{ tag: 'Harlequin', look: 'Harlequin' }]);
    expect(s.notUsed[0].reason).toMatch(/Polygenic/);
    const looks = polygenicLookChances(s.polygenic, d.polygenic);
    expect(looks).toEqual([
      expect.objectContaining({ look: 'Harlequin', chance: 'likely' }),
    ]);
    expect(looks[0].text).not.toMatch(/%/);
  });

  it('every polygenic tag is kept out of the odds while single genes keep theirs', () => {
    for (const tag of [
      'Harlequin', 'Extreme Harlequin', 'Pinstripe', 'Partial Pinstripe', 'Dalmatian',
      'Super Dalmatian', 'Red Base', 'Yellow Base', 'Dark Base', 'Tricolor', 'White Pattern',
    ]) {
      const { spec, notUsed } = translateMorphTags([tag]);
      for (const locus of Object.keys(spec.loci)) expect(POLYGENIC_LOCI.has(locus)).toBe(false);
      expect(notUsed.map((n) => n.tag)).toContain(tag);
    }
    // Single-gene traits are untouched.
    expect(tagsToSpec(['Lilly White']).loci.L).toBeTruthy();
    expect(tagsToSpec(['Axanthic']).loci.AX).toBeTruthy();
    expect(tagsToSpec(['Cappuccino']).loci.SABLE_COMPLEX).toBeTruthy();
    expect(tagsToSpec(['Soft Scale']).loci.SS).toBeTruthy();
  });

  it('Lilly White Harlequin x Dalmatian: 50% Lilly White, nothing about Harlequin or Dalmatian in the odds', () => {
    const prediction = predictWeighted(
      tagsToSpec(['Lilly White', 'Harlequin']),
      tagsToSpec(['Dalmatian']),
    );
    const lilly = prediction.offspring_phenotypes.find((o) => /Lilly White/.test(o.phenotype_description));
    expect(lilly.probability).toBeCloseTo(0.5, 10);
    for (const label of labels(prediction)) expect(label).not.toMatch(/Harlequin|Dalmatian|XXX/);
  });

  it('a look on one parent only is "possible"', () => {
    const looks = polygenicLookChances(
      translateMorphTags(['Pinstripe', 'Tiger']).polygenic,
      translateMorphTags(['Dalmatian', 'Tiger']).polygenic,
    );
    expect(looks.map((l) => [l.look, l.chance])).toEqual([
      ['Tiger', 'likely'],
      ['Dalmatian', 'possible'],
      ['Pinstripe', 'possible'],
    ]);
  });

  it('waitlist outcomes (shown to buyers) carry no polygenic percentage', () => {
    const outcomes = waitlistOutcomes({ morph_tags: ['Harlequin', 'Pinstripe'] }, { morph_tags: ['Harlequin'] });
    expect(outcomes.every((o) => !/Harlequin|Pinstripe/.test(o.label))).toBe(true);
  });
});

describe('Lilly White look-alike warning (warn, never block)', () => {
  it('Lilly White x White Wall: the engine sees Whiteout and gives no lethal warning, so the app adds a caution', () => {
    const prediction = predictWeighted(tagsToSpec(['Lilly White']), tagsToSpec(['White Wall']));
    // No lethal outcome under the tags as written...
    expect(prediction.offspring_phenotypes.some((o) => o.health_risk === 'lethal')).toBe(false);
    // ...but the White Wall could be a misread Lilly White.
    const w = lookalike(prediction);
    expect(w).toBeTruthy();
    expect(w.severity).toBe('caution');
    expect(w.message).toMatch(/dam is tagged White Wall/);
    expect(w.message).toMatch(/1 in 4 eggs/);
  });

  it('works in either direction, for Whiteout and high white, and for a possible-het Lilly White', () => {
    expect(lookalike(predictWeighted(tagsToSpec(['Whiteout']), tagsToSpec(['Frappuccino'])))?.message).toMatch(/sire is tagged/);
    expect(lookalike(predictWeighted(tagsToSpec(['High White', 'Axanthic']), tagsToSpec(['Lilly White'])))).toBeTruthy();
    expect(lookalike(predictWeighted(tagsToSpec(['White Wall']), tagsToSpec(['Possible Het Lilly White'])))).toBeTruthy();
  });

  it('two look-alikes together also warn', () => {
    const w = lookalike(predictWeighted(tagsToSpec(['White Wall']), tagsToSpec(['Whiteout'])));
    expect(w.message).toMatch(/Both parents/);
  });

  it('does not fire without a white look-alike, and does not duplicate the real lethal warning', () => {
    expect(lookalike(predictWeighted(tagsToSpec(['White Wall']), tagsToSpec(['Axanthic'])))).toBeUndefined();
    expect(lookalike(predictWeighted(tagsToSpec(['Lilly White']), tagsToSpec(['Cappuccino'])))).toBeUndefined();
    // A gecko tagged both Lilly White and White Wall is already a Lilly
    // White, so the engine's own lethal warning covers it.
    const both = predictWeighted(tagsToSpec(['Lilly White', 'White Wall']), tagsToSpec(['Lilly White']));
    expect(lookalike(both)).toBeUndefined();
    expect(both.offspring_phenotypes.some((o) => o.health_risk === 'lethal')).toBe(true);
    expect(both.warnings.some((w) => w.severity === 'critical')).toBe(true);
  });
});
