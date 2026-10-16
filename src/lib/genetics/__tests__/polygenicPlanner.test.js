import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TRAITS, COMBO_MORPHS } from '@/lib/genetics';
import { predictGeckoPair, pairingEggValue } from '@/lib/pairingValue';
import { translateMorphTags, POLYGENIC_LOCI, comboTouchesPolygenic, tagsToSpec } from '../tagTranslation';
import { predictWeighted } from '../predictWeighted';
import { buildMorphTargetOptions, scoreMorphTarget } from '../plannerTargets';
import { applyInferredHets } from '../collectionSpec';
import { LOOKALIKE_WARNING_CODE } from '../lethalLookalike';

// Review round 2 (15 Oct 2026): follow-ups to keeping polygenic looks out
// of the Punnett math.

const looksOf = (tags) => translateMorphTags(tags).polygenic;
const plannerScore = (target, sireTags, damTags) => {
  const prediction = predictGeckoPair({ morph_tags: sireTags }, { morph_tags: damTags });
  return scoreMorphTarget(target, prediction.offspring_phenotypes, looksOf(sireTags), looksOf(damTags));
};

describe('Pairing Planner morph targets', () => {
  const options = buildMorphTargetOptions();
  const values = options.map((o) => o.value);

  it('offers no polygenic trait as a percentage target', () => {
    // Before: "trait:Harlequin" was offered and every pairing read "0% chance per egg".
    for (const trait of TRAITS.filter((t) => POLYGENIC_LOCI.has(t.locus))) {
      expect(values).not.toContain(`trait:${trait.name}`);
    }
    // Unconfirmed traits never reach the odds either.
    for (const name of ['Snowflake', 'Furry', 'Marbling']) expect(values).not.toContain(`trait:${name}`);
  });

  it('offers no combo that needs (or excludes) a polygenic look', () => {
    for (const combo of COMBO_MORPHS.filter(comboTouchesPolygenic)) {
      expect(values).not.toContain(`combo:${combo.name}`);
    }
    for (const name of ['Extreme Harlequin', 'XXX', 'Tricolor', 'Halloween', 'Patternless', 'Brindlequin']) {
      expect(values).not.toContain(`combo:${name}`);
    }
  });

  it('keeps single-gene traits and combos, and offers polygenic looks without a percentage', () => {
    for (const v of ['trait:Lilly White', 'trait:Axanthic', 'trait:Cappuccino', 'trait:Phantom', 'combo:Frappuccino', 'combo:Lucy']) {
      expect(values).toContain(v);
    }
    expect(options.find((o) => o.value === 'trait:Softscale').label).toBe('Soft Scale');
    expect(values).toContain('look:Harlequin');
    expect(values).toContain('look:Pinstripe');
    // A Tangerine tag is not read as a look, so it could never be met.
    expect(values).not.toContain('look:Tangerine');
  });

  it('Harlequin x Lilly White Harlequin: Harlequin is "likely", never "0% chance per egg"', () => {
    const r = plannerScore('look:Harlequin', ['Harlequin'], ['Harlequin', 'Lilly White']);
    expect(r.label).toBe('Harlequin likely (both parents show it)');
    expect(r.label).not.toMatch(/%/);
    expect(r.score).toBe(2);
  });

  it('a look on one parent is "possible"; on neither it says so', () => {
    expect(plannerScore('look:Pinstripe', ['Pinstripe'], ['Lilly White'])).toEqual({
      score: 1,
      label: 'Pinstripe possible (one parent shows it)',
    });
    expect(plannerScore('look:Dalmatian', ['Harlequin'], ['Lilly White']).score).toBe(0);
  });

  it('single-gene targets keep their per-egg percentage', () => {
    // Lilly White x normal: one copy from one parent, so 1/2 per egg.
    expect(plannerScore('trait:Lilly White', ['Harlequin'], ['Harlequin', 'Lilly White'])).toEqual({
      score: 50,
      label: '50% chance per egg',
    });
  });
});

describe('Patternless combo with polygenic looks kept out of the math', () => {
  const describeAll = (p) => p.offspring_phenotypes.map((o) => [o.phenotype_description, o.matching_combo_morphs, o.probability]);

  it('Harlequin Phantom x Harlequin Phantom is not labelled Patternless', () => {
    // Before this fix: [["Visual Phantom [combos: Patternless]", ["patternless"], 1]].
    // Patternless means "visual Phantom that is NOT Harlequin", so it cannot apply here.
    const p = predictGeckoPair({ morph_tags: ['Phantom', 'Harlequin'] }, { morph_tags: ['Phantom', 'Harlequin'] });
    expect(describeAll(p)).toEqual([['Visual Phantom', [], 1]]);
  });

  it('a Dalmatian on one side also drops it, and outcomes still sum to 1', () => {
    // Phantom (2 copies) x Het Phantom: 1/2 visual, 1/2 het.
    const p = predictGeckoPair({ morph_tags: ['Phantom', 'Dalmatian'] }, { morph_tags: ['Het Phantom'] });
    expect(describeAll(p)).toEqual([
      ['Visual Phantom', [], 0.5],
      ['Het Phantom', [], 0.5],
    ]);
  });

  it('carries the polygenic loci on the spec so predictWeighted can see them', () => {
    expect(tagsToSpec(['Phantom', 'Extreme Harlequin', 'Super Dalmatian']).polygenicLoci).toEqual(['DAL', 'HQ']);
    expect(tagsToSpec(['Phantom']).polygenicLoci).toBeUndefined();
  });

  it('two plain Phantoms keep the engine label (nothing says they are patterned)', () => {
    const p = predictWeighted(tagsToSpec(['Phantom']), tagsToSpec(['Phantom']));
    expect(p.offspring_phenotypes[0].matching_combo_morphs).toEqual(['patternless']);
  });
});

describe('landing page pairing card', () => {
  const home = readFileSync(resolve(__dirname, '../../../pages/HomeControl.jsx'), 'utf8');

  it('shows no polygenic percentage', () => {
    expect(home).not.toMatch(/'[\d.]+%',\s*'(Harlequin|Pinstripe|Dalmatian|Extreme Harlequin)'/);
    expect(home).not.toMatch(/Offspring odds for [^']*Harlequin/);
    expect(home).not.toMatch(/\$186/);
  });

  it('matches what the app returns for Lilly White Harlequin x Pinstripe', () => {
    const value = pairingEggValue({ morph_tags: ['Lilly White', 'Harlequin'] }, { morph_tags: ['Pinstripe'] }, null);
    expect(value.outcomes.map((o) => [o.label, o.probability])).toEqual([
      ['Lilly White', 0.5],
      ['Wild-type', 0.5],
    ]);
    // The card: 0.5 x $250 + 0.5 x $65 = $157.50, shown as $158.
    expect(home).toMatch(/\['50%', 'Lilly White', '\$250'\]/);
    expect(home).toMatch(/\['50%', 'No single-gene trait', '\$65'\]/);
    expect(home).toMatch(/\$158/);
  });
});

describe('Lilly White look-alike spellings', () => {
  const warns = (a, b) => predictGeckoPair({ morph_tags: a }, { morph_tags: b }).warnings
    .some((w) => w.code === LOOKALIKE_WARNING_CODE);

  it('"White Out" and "Het White Wall" are look-alikes too', () => {
    expect(warns(['White Out'], ['Lilly White'])).toBe(true);
    expect(warns(['Lilly White'], ['Het White Wall'])).toBe(true);
    // "White Out" is now read as the engine's Whiteout instead of an unknown tag.
    expect(translateMorphTags(['White Out']).spec.loci.WO).toBeDefined();
  });

  it('a Possible Het White Wall tag describes no look, so it does not warn', () => {
    expect(warns(['Possible Het White Wall'], ['Lilly White'])).toBe(false);
  });
});

describe('inferred certain hets reach the calculator', () => {
  it('a probability-1 inferred het becomes a definite single copy', () => {
    // A normal-looking baby out of a visual Axanthic must carry one copy.
    const spec = tagsToSpec([]);
    const applied = applyInferredHets(spec, [{ traitName: 'Axanthic', probability: 1, basis: ['Sire is visual Axanthic'] }]);
    expect(applied).toHaveLength(1);
    expect(spec.loci.AX).toEqual([{ pair: ['axanthic', 'wild_type'], weight: 1 }]);
    // Het x visual Axanthic: 1/2 visual per egg, with no uncertainty left.
    const result = predictWeighted(spec, tagsToSpec(['Axanthic']));
    const ax = result.locus_predictions.find((lp) => lp.locus === 'AX');
    const visual = ax.outcomes.find((o) => o.genotype[0] === 'axanthic' && o.genotype[1] === 'axanthic');
    expect(visual.probability).toBeCloseTo(0.5, 10);
    expect(result.uncertain).toBe(false);
  });
});
