import { describe, expect, it } from 'vitest';
import { MORPHS, getMorph } from '@/data/morph-guide';
import {
  GUIDE_CALCULATOR_ALIASES,
  MORPH_GUIDE_SLUGS,
  MORPH_PRICE_SLUGS,
  SIMPLE_TRAITS,
  stateToSpec,
} from '../calculatorCatalog';
import { priceForOutcome } from '../outcomeValue';
import { predictWeighted } from '../predictWeighted';
import { calculatorHref } from '@/components/morphguide/morphCta';
import { CALCULATOR_STATUS, withGeckInspectStatus } from '../../../../scripts/lib/agent-content.mjs';
import { TRAITS } from '../index';

const slugs = new Set(MORPHS.map((m) => m.slug));

describe('calculator outcome links to the Morph Guide', () => {
  it('only name real Morph Guide pages', () => {
    for (const [id, slug] of Object.entries(MORPH_GUIDE_SLUGS)) expect(slugs.has(slug), `${id} -> ${slug}`).toBe(true);
    for (const [id, slug] of Object.entries(MORPH_PRICE_SLUGS)) expect(slugs.has(slug), `${id} -> ${slug}`).toBe(true);
  });

  it('send each gene to its own page, including the pages added in October 2026', () => {
    expect(MORPH_GUIDE_SLUGS).toMatchObject({
      whiteout: 'whiteout',
      phantom: 'phantom',
      empty_back: 'empty-back',
      sable: 'sable',
      highway: 'highway',
      luwak: 'luwak',
    });
  });

  it('do not change what an outcome is worth', () => {
    // Whiteout is still valued as White Wall and Sable is still unpriced.
    expect(MORPH_PRICE_SLUGS.whiteout).toBe('white-wall');
    expect(MORPH_PRICE_SLUGS.sable).toBeUndefined();
    const whiteout = predictWeighted(stateToSpec({ whiteout: 'het' }), stateToSpec({}))
      .offspring_phenotypes.find((o) => JSON.stringify(o.genotype).includes('whiteout'));
    expect(priceForOutcome(whiteout)?.name).toBe('White Wall');
    const sable = predictWeighted(stateToSpec({ sable_complex: 'sable' }), stateToSpec({}))
      .offspring_phenotypes.find((o) => JSON.stringify(o.genotype).includes('sable'));
    expect(priceForOutcome(sable)).toBeNull();
  });

  it('keep the Morph Guide calculator buttons on the right calculator page', () => {
    expect(calculatorHref('whiteout')).toBe('/calculator/whiteout');
    expect(calculatorHref('white-wall')).toBe('/calculator/whiteout');
    expect(calculatorHref('sable')).toBe('/calculator/sable');
    expect(calculatorHref('soft-scale')).toBe('/calculator/soft-scale');
    // The Phantom Pinstripe page says the label does not prove the gene.
    expect(calculatorHref('phantom-pinstripe')).toBe('/calculator');
    for (const [page, calc] of Object.entries(GUIDE_CALCULATOR_ALIASES)) {
      expect(slugs.has(page), page).toBe(true);
      expect(calculatorHref(page)).toBe(`/calculator/${calc}`);
    }
  });
});

describe('Empty Back stays Emerging (decision of 16 Oct 2026)', () => {
  it('in the calculator and the Morph Guide', () => {
    expect(SIMPLE_TRAITS.find((t) => t.id === 'empty_back').confidence).toBe('emerging');
    const guide = getMorph('empty-back');
    expect(`${guide.summary} ${guide.description}`).toMatch(/Emerging/);
    expect(`${guide.summary} ${guide.description}`).toMatch(/not yet independently proven/);
    expect(`${guide.summary} ${guide.description}`).not.toMatch(/\bis (a )?proven\b/i);
  });

  it('in the published genetics data, which follows the calculator badge, not the engine flag', () => {
    const engine = TRAITS.find((t) => t.id === 'empty_back');
    expect(engine.confirmed).toBe(true);
    expect(withGeckInspectStatus(engine)).toMatchObject({ confirmed: false, status: 'emerging' });
    expect(withGeckInspectStatus(TRAITS.find((t) => t.id === 'lilly_white'))).toMatchObject({ confirmed: true, status: 'proven' });
    expect(CALCULATOR_STATUS).toMatchObject({ cappuccino: 'proven', sable: 'emerging', highway: 'emerging', whiteout: 'emerging' });
    // A trait the calculator does not offer keeps the engine's own flag.
    const harlequin = TRAITS.find((t) => t.id === 'harlequin');
    expect(withGeckInspectStatus(harlequin)).toBe(harlequin);
  });
});
