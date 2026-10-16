import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getMorph } from '@/data/morph-guide';

// /calculator/whiteout and /calculator/phantom link to the gene's own Morph
// Guide page now that it exists, as the prerendered HTML does.
describe('calculator morph pages link to the gene page', () => {
  const source = readFileSync(resolve(__dirname, '../../pages/CalculatorMorph.jsx'), 'utf8');

  it('the gene page wins over the old look-alike page', () => {
    expect(source).toContain('getMorph(page.slug) || getMorph(MORPH_PAGE_FOR_CALCULATOR[page.slug])');
    for (const slug of ['whiteout', 'phantom']) expect(getMorph(slug)?.slug).toBe(slug);
  });

  it('only promises a price when the page has one', () => {
    expect(source).toContain("morphPage.priceRange ? 'how to identify it, genetics and price' : 'how to identify it and its genetics'");
  });
});
