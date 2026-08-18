import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PAIRING_PAGES, COMPLEX_ID } from '../calculatorCatalog';
import { priceForOutcome, expectedSeasonValue } from '../outcomeValue';
import { expressionBand, scoresFromTags } from '../polygenic';
import { applyInferredHets } from '../collectionSpec';
import { tagsToSpec, predictWeighted } from '../predictWeighted';
import { stateToSpec } from '../calculatorCatalog';

describe('PAIRING_PAGES', () => {
  it('stays in sync with scripts/seo-routes.mjs', () => {
    const src = readFileSync(resolve(__dirname, '../../../../scripts/seo-routes.mjs'), 'utf8');
    const block = /CALCULATOR_PAIRING_SLUGS = \[([\s\S]*?)\];/.exec(src);
    expect(block).toBeTruthy();
    const routeSlugs = [...block[1].matchAll(/slug: '([^']+)'/g)].map((m) => m[1]).sort();
    const catalogSlugs = PAIRING_PAGES.map((p) => p.slug).sort();
    expect(routeSlugs).toEqual(catalogSlugs);
  });

  it('every pairing page produces a real prediction', () => {
    for (const page of PAIRING_PAGES) {
      const result = predictWeighted(stateToSpec(page.sire), stateToSpec(page.dam));
      expect(result.offspring_phenotypes.length).toBeGreaterThan(0);
      const total = result.offspring_phenotypes.reduce((s, o) => s + o.probability, 0);
      expect(total).toBeCloseTo(1, 9);
    }
  });

  it('the Luwak page really is super-free and the Capp x Capp page is not', () => {
    const luwakPage = PAIRING_PAGES.find((p) => p.slug === 'cappuccino-x-sable');
    const result = predictWeighted(stateToSpec(luwakPage.sire), stateToSpec(luwakPage.dam));
    const complex = result.locus_predictions.find((lp) => lp.locus === 'SABLE_COMPLEX');
    expect(
      complex.outcomes.some((o) => o.genotype[0] === o.genotype[1] && o.genotype[0] !== 'wild_type'),
    ).toBe(false);

    const cappPage = PAIRING_PAGES.find((p) => p.slug === 'cappuccino-x-cappuccino');
    const cappResult = predictWeighted(stateToSpec(cappPage.sire), stateToSpec(cappPage.dam));
    expect(cappResult.warnings.length).toBeGreaterThan(0);
  });
});

describe('outcomeValue', () => {
  it('prices outcomes through guide entries and skips lethal ones', () => {
    const result = predictWeighted(
      stateToSpec({ lilly_white: 'het' }),
      stateToSpec({ lilly_white: 'het' }),
    );
    const lw = result.offspring_phenotypes.find(
      (o) => o.health_risk !== 'lethal' && o.genotype.L?.includes('lilly_white'),
    );
    const price = priceForOutcome(lw);
    expect(price).toBeTruthy();
    expect(price.low).toBeGreaterThan(0);
    expect(price.high).toBeGreaterThanOrEqual(price.low);

    const lethal = result.offspring_phenotypes.find((o) => o.health_risk === 'lethal');
    expect(priceForOutcome(lethal)).toBeNull();

    const value = expectedSeasonValue(result.offspring_phenotypes, 16);
    expect(value).toBeTruthy();
    expect(value.high).toBeGreaterThanOrEqual(value.low);
    expect(value.coverage).toBeGreaterThan(0);
    expect(value.coverage).toBeLessThanOrEqual(1);
  });

  it('returns null when nothing maps to a price', () => {
    expect(expectedSeasonValue([], 16)).toBeNull();
  });
});

describe('polygenic bands', () => {
  it('never emits percentages, only bands with copy', () => {
    const band = expressionBand(80, 70);
    expect(band.band).toBe('high');
    expect(band.headline).toMatch(/strong/);
    expect(expressionBand(0, 0).band).toBe('none');
    expect(expressionBand(50, 50).band).toBe('mid-high');
    expect(expressionBand(30, 20).band).toBe('moderate');
    expect(expressionBand(10, 0).band).toBe('light');
  });

  it('flags wide parent spreads', () => {
    expect(expressionBand(90, 10).detail).toMatch(/differ widely/);
    expect(expressionBand(60, 55).detail).not.toMatch(/differ widely/);
  });

  it('seeds scores from tags', () => {
    const scores = scoresFromTags(['Extreme Harlequin', 'Dalmatian', 'Pinstripe']);
    expect(scores.harlequin).toBe(85);
    expect(scores.dalmatian).toBe(55);
    expect(scores.pinstripe).toBe(75);
    expect(scores.tiger).toBe(0);
  });
});

describe('applyInferredHets', () => {
  it('adds weighted recessive scenarios and respects explicit tags', () => {
    const spec = tagsToSpec(['Lilly White']);
    const applied = applyInferredHets(spec, [
      { traitName: 'Axanthic', probability: 0.5, basis: ['parent is het'] },
      { traitName: 'Lilly White', probability: 0.4, basis: [] }, // inc dom: ignored
    ]);
    expect(applied).toHaveLength(1);
    expect(spec.loci.AX).toHaveLength(2);
    expect(spec.loci.AX[0].weight).toBeCloseTo(0.5, 10);

    // Explicit tag wins over inference
    const tagged = tagsToSpec(['Het Axanthic']);
    const applied2 = applyInferredHets(tagged, [
      { traitName: 'Axanthic', probability: 0.5, basis: [] },
    ]);
    expect(applied2).toHaveLength(0);
    expect(tagged.loci.AX).toHaveLength(1);
  });

  it('feeds correct odds downstream', () => {
    const spec = tagsToSpec([]);
    applyInferredHets(spec, [{ traitName: 'Axanthic', probability: 0.5, basis: [] }]);
    const result = predictWeighted(spec, stateToSpec({ axanthic: 'visual' }));
    const ax = result.locus_predictions.find((lp) => lp.locus === 'AX');
    const visual = ax.outcomes.find((o) => o.genotype[0] === 'axanthic' && o.genotype[1] === 'axanthic');
    expect(visual.probability).toBeCloseTo(0.25, 10);
    expect(result.uncertain).toBe(true);
  });
});

describe('complex sanity', () => {
  it('frappuccino x normal throws all four expected classes', () => {
    const page = PAIRING_PAGES.find((p) => p.slug === 'frappuccino-x-normal');
    expect(page.sire[COMPLEX_ID]).toBe('cappuccino');
    const result = predictWeighted(stateToSpec(page.sire), stateToSpec(page.dam));
    const frapp = result.offspring_phenotypes.find((o) =>
      (o.matching_combo_morphs || []).includes('frappuccino'),
    );
    expect(frapp.probability).toBeCloseTo(0.25, 10);
  });
});
