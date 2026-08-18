import { describe, it, expect, afterEach } from 'vitest';
import {
  genotypeToState,
  applyTraitOverrides,
  resetTraitOverrides,
  getSimpleTraits,
  stateToSpec,
  encodeParentState,
  decodeParentState,
  COMPLEX_ID,
} from '../calculatorCatalog';
import { predictWeighted, tagsToSpec } from '../predictWeighted';
import { scanCollection, scanCollectionTwoGen } from '../reverseSolver';
import {
  PUZZLES,
  PUZZLES_BY_ID,
  initialBench,
  crossOptions,
  satisfiesTarget,
} from '../clutchLab';

afterEach(() => resetTraitOverrides());

describe('genotypeToState', () => {
  it('round trips predicted offspring into picker states', () => {
    expect(genotypeToState({ L: ['lilly_white', 'wild_type'] })).toEqual({ lilly_white: 'het' });
    expect(genotypeToState({ AX: ['axanthic', 'axanthic'] })).toEqual({ axanthic: 'visual' });
    expect(genotypeToState({ SABLE_COMPLEX: ['cappuccino', 'sable'] })).toEqual({
      [COMPLEX_ID]: 'luwak',
    });
    // Lethal supers cannot become parents
    expect(genotypeToState({ L: ['lilly_white', 'lilly_white'] })).toBeNull();
    // Polygenic loci from collection tags are skipped, not corrupted
    expect(genotypeToState({ HQ: ['harlequin', 'wild_type'] })).toEqual({});
  });
});

describe('trait overrides', () => {
  it('patches existing traits without touching the static list', () => {
    const applied = applyTraitOverrides([
      { id: 'whiteout', enabled: true, patch: { confidence: 'proven' } },
      { id: 'whiteout', enabled: false, patch: { confidence: 'emerging' } },
      { id: 'nonsense_locus_free', enabled: true, patch: { new: true } }, // invalid: missing shape
    ]);
    expect(applied).toEqual(['whiteout']);
    const whiteout = getSimpleTraits().find((t) => t.id === 'whiteout');
    expect(whiteout.confidence).toBe('proven');
  });

  it('adds a brand-new trait that computes end to end without the engine knowing it', () => {
    applyTraitOverrides([
      {
        id: 'moonglow_test',
        enabled: true,
        patch: {
          new: true,
          label: 'Moonglow (test)',
          locus: 'MGTEST',
          dominance: 'recessive',
          confidence: 'emerging',
        },
      },
    ]);
    expect(getSimpleTraits().some((t) => t.id === 'moonglow_test')).toBe(true);

    const het = stateToSpec({ moonglow_test: 'het' });
    expect(het.loci.MGTEST).toEqual([{ pair: ['moonglow_test', 'wild_type'], weight: 1 }]);

    const result = predictWeighted(het, het);
    const locus = result.locus_predictions.find((lp) => lp.locus === 'MGTEST');
    const visual = locus.outcomes.find(
      (o) => o.genotype[0] === 'moonglow_test' && o.genotype[1] === 'moonglow_test',
    );
    expect(visual.probability).toBeCloseTo(0.25, 10);
    expect(visual.phenotype_label).toBe('Moonglow (test)');
    const total = result.offspring_phenotypes.reduce((s, o) => s + o.probability, 0);
    expect(total).toBeCloseTo(1, 9);

    // Mixed with an engine-known gene, distributions still multiply.
    const mixed = predictWeighted(
      stateToSpec({ moonglow_test: 'visual', lilly_white: 'het' }),
      stateToSpec({ moonglow_test: 'het' }),
    );
    const both = mixed.offspring_phenotypes.find(
      (o) => o.phenotype_description.includes('Moonglow (test)') &&
             o.phenotype_description.includes('Lilly White'),
    );
    expect(both.probability).toBeCloseTo(0.5 * 0.5, 10);

    // Permalink codec accepts the new trait too.
    const state = { moonglow_test: 'ph66' };
    expect(decodeParentState(encodeParentState(state))).toEqual(state);
  });

  it('flags a lethal override super with a warning', () => {
    applyTraitOverrides([
      {
        id: 'testlethal',
        enabled: true,
        patch: {
          new: true,
          label: 'Test Lethal',
          locus: 'TL',
          dominance: 'incomplete_dominant',
          super_lethal: true,
          super_label: 'Super Test Lethal',
        },
      },
    ]);
    const spec = stateToSpec({ testlethal: 'het' });
    const result = predictWeighted(spec, spec);
    expect(result.warnings.some((w) => w.code === 'override_lethal_testlethal')).toBe(true);
    const lethal = result.offspring_phenotypes.find((o) => o.health_risk === 'lethal');
    expect(lethal.probability).toBeCloseTo(0.25, 10);
  });
});

describe('scanCollectionTwoGen', () => {
  const gecko = (id, sex, tags) => ({ id, name: id, sex, spec: tagsToSpec(tags) });

  it('finds a back-cross route when one generation cannot get there', () => {
    const geckos = [
      gecko('m-sable', 'Male', ['Sable']),
      gecko('f-normal', 'Female', []),
    ];
    // Direct: sable x normal can never make Super Sable.
    expect(scanCollection('super_sable', geckos).results).toHaveLength(0);

    const { results } = scanCollectionTwoGen('super_sable', geckos);
    expect(results.length).toBeGreaterThan(0);
    const best = results[0];
    // Hold back a Sable (1/2), breed back to the Sable parent (1/4).
    expect(best.gen1.p).toBeCloseTo(0.5, 10);
    expect(best.gen2.p).toBeCloseTo(0.25, 10);
    expect(best.score).toBeCloseTo(0.125, 10);
    expect(best.backcross).toBe(true);
    expect(best.holdbackLabel.toLowerCase()).toContain('sable');
  });

  it('never holds back a dead Super Lilly White', () => {
    const geckos = [
      gecko('m-lw', 'Male', ['Lilly White']),
      gecko('f-lw', 'Female', ['Lilly White']),
    ];
    const { results } = scanCollectionTwoGen('lilly_white', geckos);
    for (const r of results) {
      expect(r.holdbackLabel).not.toContain('Super Lilly');
    }
  });
});

describe('Clutch Lab puzzles', () => {
  const findOption = (options, predicate) => {
    const hit = options.find((o) => !o.lethal && predicate(o.genotype));
    expect(hit).toBeTruthy();
    return hit;
  };

  it('cross options are exhaustive distributions', () => {
    const bench = initialBench(PUZZLES_BY_ID['hidden-carriers']);
    const options = crossOptions(bench[0].genotype, bench[1].genotype);
    const total = options.reduce((s, o) => s + o.p, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('every puzzle has a target and a par', () => {
    for (const puzzle of PUZZLES) {
      expect(puzzle.par).toBeGreaterThan(0);
      expect(puzzle.target).toBeTruthy();
      expect(initialBench(puzzle).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('one-cross puzzles solve in one cross', () => {
    for (const id of ['first-lilly', 'hidden-carriers', 'frappuccino']) {
      const puzzle = PUZZLES_BY_ID[id];
      const bench = initialBench(puzzle);
      const options = crossOptions(bench[0].genotype, bench[1].genotype);
      findOption(options, (g) => satisfiesTarget(g, puzzle.target));
      expect(puzzle.par).toBe(1);
    }
  });

  it('safe-luwak solves via Sable and forbids Capp x Capp', () => {
    const puzzle = PUZZLES_BY_ID['safe-luwak'];
    const bench = initialBench(puzzle);
    const kona = bench.find((a) => a.name === 'Kona');
    const espresso = bench.find((a) => a.name === 'Espresso');
    const latte = bench.find((a) => a.name === 'Latte');
    expect(puzzle.forbidden.test(kona.genotype, espresso.genotype)).toBe(true);
    expect(puzzle.forbidden.test(kona.genotype, latte.genotype)).toBe(false);
    const options = crossOptions(kona.genotype, latte.genotype);
    findOption(options, (g) => satisfiesTarget(g, 'luwak'));
  });

  it('axanthic-lilly solves in two crosses (hold back, breed back)', () => {
    const puzzle = PUZZLES_BY_ID['axanthic-lilly'];
    const bench = initialBench(puzzle);
    const cloud = bench.find((a) => a.name === 'Cloud');
    const ghost = bench.find((a) => a.name === 'Ghost');
    const gen1 = crossOptions(cloud.genotype, ghost.genotype);
    const holdback = findOption(
      gen1,
      (g) => g.L?.includes('lilly_white') && g.AX?.includes('axanthic'),
    );
    const gen2 = crossOptions(holdback.genotype, ghost.genotype);
    findOption(gen2, (g) => satisfiesTarget(g, 'axanthic_lilly'));
    expect(puzzle.par).toBe(2);
  });

  it('phantom-frapp solves in two crosses', () => {
    const puzzle = PUZZLES_BY_ID['phantom-frapp'];
    const bench = initialBench(puzzle);
    const solo = bench.find((a) => a.name === 'Solo');
    const shadow = bench.find((a) => a.name === 'Shadow');
    const gen1 = crossOptions(solo.genotype, shadow.genotype);
    const holdback = findOption(
      gen1,
      (g) =>
        g.SABLE_COMPLEX?.includes('cappuccino') &&
        g.L?.includes('lilly_white') &&
        g.PH?.includes('phantom'),
    );
    const gen2 = crossOptions(holdback.genotype, shadow.genotype);
    findOption(gen2, (g) => satisfiesTarget(g, 'phantom_frappuccino'));
    expect(puzzle.par).toBe(2);
  });
});
