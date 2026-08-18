import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  pAtLeastOne,
  expectedCount,
  eggsForConfidence,
  simpleFraction,
  scatterHits,
} from '../clutchMath';
import {
  stateToSpec,
  stateToChips,
  encodeParentState,
  decodeParentState,
  CALCULATOR_PAGES,
  COMPLEX_ID,
} from '../calculatorCatalog';
import { predictWeighted, expandScenarios, tagsToSpec } from '../predictWeighted';

describe('clutchMath', () => {
  it('computes at-least-one probability', () => {
    expect(pAtLeastOne(0.25, 8)).toBeCloseTo(1 - 0.75 ** 8, 10);
    expect(pAtLeastOne(0, 8)).toBe(0);
    expect(pAtLeastOne(1, 3)).toBe(1);
  });

  it('computes eggs needed for confidence', () => {
    // 25% per egg: 9 eggs clears 90% confidence, 8 does not
    expect(eggsForConfidence(0.25, 0.9)).toBe(9);
    expect(pAtLeastOne(0.25, 8)).toBeLessThan(0.9);
    expect(pAtLeastOne(0.25, 9)).toBeGreaterThanOrEqual(0.9);
    expect(eggsForConfidence(0)).toBe(Infinity);
  });

  it('labels simple fractions and rejects awkward ones', () => {
    expect(simpleFraction(0.25)).toBe('1/4');
    expect(simpleFraction(0.5)).toBe('1/2');
    expect(simpleFraction(1 / 3)).toBe('1/3');
    expect(simpleFraction(0.29)).toBeNull();
  });

  it('scatters hits deterministically per seed', () => {
    const a = scatterHits(16, 4, 42);
    const b = scatterHits(16, 4, 42);
    const c = scatterHits(16, 4, 43);
    expect(a).toEqual(b);
    expect(a.filter(Boolean)).toHaveLength(4);
    expect(c.filter(Boolean)).toHaveLength(4);
    expect(expectedCount(0.25, 16)).toBe(4);
  });
});

describe('calculatorCatalog', () => {
  it('builds definite genotype specs', () => {
    const spec = stateToSpec({ lilly_white: 'het', axanthic: 'visual' });
    expect(spec.loci.L).toEqual([{ pair: ['lilly_white', 'wild_type'], weight: 1 }]);
    expect(spec.loci.AX).toEqual([{ pair: ['axanthic', 'axanthic'], weight: 1 }]);
  });

  it('expands possible hets into weighted scenarios', () => {
    const spec = stateToSpec({ axanthic: 'ph66' });
    expect(spec.loci.AX).toHaveLength(2);
    const weights = spec.loci.AX.map((o) => o.weight);
    expect(weights[0]).toBeCloseTo(2 / 3, 10);
    expect(weights[1]).toBeCloseTo(1 / 3, 10);
  });

  it('expresses the Cappuccino complex including Luwak', () => {
    const spec = stateToSpec({ [COMPLEX_ID]: 'luwak' });
    expect(spec.loci.SABLE_COMPLEX).toEqual([
      { pair: ['cappuccino', 'sable'], weight: 1 },
    ]);
    expect(stateToChips({ [COMPLEX_ID]: 'luwak' })).toContain('Luwak');
  });

  it('round-trips URL state and drops junk', () => {
    const state = { lilly_white: 'het', axanthic: 'ph66', [COMPLEX_ID]: 'sable' };
    expect(decodeParentState(encodeParentState(state))).toEqual(state);
    expect(decodeParentState('nonsense:val,axanthic:visual')).toEqual({ axanthic: 'visual' });
    // A recessive-only state on an incomplete dominant is rejected
    expect(decodeParentState('lilly_white:ph66')).toEqual({});
  });

  it('keeps SEO calculator slugs in sync with scripts/seo-routes.mjs', () => {
    const src = readFileSync(
      resolve(__dirname, '../../../../scripts/seo-routes.mjs'),
      'utf8',
    );
    const block = /CALCULATOR_MORPH_SLUGS = \[([\s\S]*?)\];/.exec(src);
    expect(block).toBeTruthy();
    const routeSlugs = [...block[1].matchAll(/slug: '([^']+)'/g)].map((m) => m[1]).sort();
    const catalogSlugs = CALCULATOR_PAGES.map((p) => p.slug).sort();
    expect(routeSlugs).toEqual(catalogSlugs);
  });
});

describe('predictWeighted', () => {
  it('computes Lilly White x Lilly White with the lethal super and a warning', () => {
    const spec = stateToSpec({ lilly_white: 'het' });
    const result = predictWeighted(spec, spec);
    const byDesc = Object.fromEntries(
      result.offspring_phenotypes.map((o) => [o.phenotype_description, o]),
    );
    const superOutcome = result.offspring_phenotypes.find((o) => o.health_risk === 'lethal');
    expect(superOutcome).toBeTruthy();
    expect(superOutcome.probability).toBeCloseTo(0.25, 10);
    const total = result.offspring_phenotypes.reduce((s, o) => s + o.probability, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(result.warnings.some((w) => w.severity === 'critical')).toBe(true);
    expect(result.warnings.every((w) => w.conditional === false)).toBe(true);
    expect(result.uncertain).toBe(false);
    expect(byDesc).toBeTruthy();
  });

  it('computes het x visual recessive at 50%', () => {
    const result = predictWeighted(
      stateToSpec({ axanthic: 'het' }),
      stateToSpec({ axanthic: 'visual' }),
    );
    const ax = result.locus_predictions.find((lp) => lp.locus === 'AX');
    const visual = ax.outcomes.find((o) => o.genotype[0] === 'axanthic' && o.genotype[1] === 'axanthic');
    expect(visual.probability).toBeCloseTo(0.5, 10);
  });

  it('marginalizes possible hets: 66% poss het x visual is one third visual', () => {
    const result = predictWeighted(
      stateToSpec({ axanthic: 'ph66' }),
      stateToSpec({ axanthic: 'visual' }),
    );
    expect(result.uncertain).toBe(true);
    const ax = result.locus_predictions.find((lp) => lp.locus === 'AX');
    const visual = ax.outcomes.find((o) => o.genotype[0] === 'axanthic' && o.genotype[1] === 'axanthic');
    expect(visual.probability).toBeCloseTo((2 / 3) * 0.5, 10);
    const total = ax.outcomes.reduce((s, o) => s + o.probability, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('produces Luwak from Cappuccino x Sable and never a super', () => {
    const result = predictWeighted(
      stateToSpec({ [COMPLEX_ID]: 'cappuccino' }),
      stateToSpec({ [COMPLEX_ID]: 'sable' }),
    );
    const luwak = result.offspring_phenotypes.find((o) =>
      (o.matching_combo_morphs || []).includes('luwak'),
    );
    expect(luwak).toBeTruthy();
    expect(luwak.probability).toBeCloseTo(0.25, 10);
    const complex = result.locus_predictions.find((lp) => lp.locus === 'SABLE_COMPLEX');
    const superForm = complex.outcomes.find(
      (o) => o.genotype[0] === o.genotype[1] && o.genotype[0] !== 'wild_type',
    );
    expect(superForm).toBeUndefined();
  });

  it('supports legacy tag specs', () => {
    const spec = tagsToSpec(['Lilly White']);
    expect(spec.loci.L).toBeTruthy();
    expect(expandScenarios(spec)).toHaveLength(1);
  });

  it('caps pathological scenario counts', () => {
    const loci = {};
    for (let i = 0; i < 10; i++) {
      loci[`FAKE_${i}`] = [
        { pair: ['a', 'wild_type'], weight: 0.5 },
        { pair: ['wild_type', 'wild_type'], weight: 0.5 },
      ];
    }
    expect(() => expandScenarios({ loci })).toThrow();
  });
});
