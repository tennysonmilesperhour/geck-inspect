import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getBlogPost } from '@/data/blog-posts';
import { getProjectLine } from '@/data/project-lines';
import { COMPLEX_OPTIONS_BY_VALUE, CALCULATOR_PAGES_BY_SLUG } from '../calculatorCatalog';

// Factual and welfare statements that two reviews found contradicting the
// rest of the app (15 Oct 2026). These guard against the old text coming back.

const ROOT = resolve(__dirname, '../../../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

describe('Lilly White origin', () => {
  it('the identification post credits Lilly Exotics (late 2010), with no invented naming story', () => {
    const post = JSON.stringify(getBlogPost('lilly-white-identification-breeding'));
    expect(post).not.toMatch(/Caponetto/);
    expect(post).not.toMatch(/daughter/);
    expect(post).not.toMatch(/2014/);
    expect(post).toMatch(/Lilly Exotics/);
    expect(post).toMatch(/late 2010/);
  });

  it('the ACR project line no longer claims to produce Super Lilly Whites, a lethal genotype', () => {
    const line = JSON.stringify(getProjectLine('lilly-white-acr'));
    expect(line).not.toMatch(/produce Lilly White and Super Lilly White/);
    expect(line).not.toMatch(/Founding line/);
    expect(line).toMatch(/Lilly Exotics/);
  });

  it('the genetics guide gives the same year as the morph guide', () => {
    expect(read('src/data/genetics-sections.jsx')).not.toMatch(/in 2014 by Lilly Exotics/);
  });

  it('the generated llms-full.txt carries the corrected text', () => {
    expect(read('public/llms-full.txt')).not.toMatch(/named after his daughter/);
  });
});

describe('super-form welfare statements agree with the calculator', () => {
  it('the keeper guide no longer lists Cappuccino among viable supers', () => {
    const guide = read('src/data/keepers-guides/morph.js');
    expect(guide).not.toMatch(/viable supers \(Cappuccino/);
    expect(guide).not.toMatch(/Super cappuccino exists and is viable/);
    expect(COMPLEX_OPTIONS_BY_VALUE.super_cappuccino.caution).toMatch(/severe health problems/);
  });

  it('Sable allelism and everything built on it is badged Emerging, not Proven', () => {
    for (const value of ['sable', 'luwak', 'super_sable', 'capp_highway', 'sable_highway']) {
      expect(COMPLEX_OPTIONS_BY_VALUE[value].confidence).toBe('emerging');
    }
    expect(CALCULATOR_PAGES_BY_SLUG.sable.confidence).toBe('emerging');
    expect(CALCULATOR_PAGES_BY_SLUG.cappuccino.confidence).toBe('proven');
  });

  it('compound hets with Highway carry a health caution', () => {
    expect(COMPLEX_OPTIONS_BY_VALUE.capp_highway.caution).toMatch(/not documented/);
    expect(COMPLEX_OPTIONS_BY_VALUE.sable_highway.caution).toMatch(/not documented/);
  });
});

describe('llms.txt single-gene list follows the calculator badges', () => {
  // llms.txt, which asks agents to cite it, listed Soft Scale and White
  // Wall as settled single-gene traits while the calculator and the guide
  // badge Soft Scale and Whiteout Emerging (October 2026 review).
  it('names as proven only the genes the calculator badges proven', () => {
    const line = read('public/llms.txt').split('\n').find((l) => l.includes('Proven single-gene traits:'));
    const proven = line.match(/Proven single-gene traits: ([^.]*)\./)[1];
    const emerging = line.match(/badges them Emerging: ([^.]*)\./)[1];
    for (const [slug, name] of [['lilly-white', 'Lilly White'], ['cappuccino', 'Cappuccino'], ['axanthic', 'Axanthic'], ['phantom', 'Phantom']]) {
      expect(CALCULATOR_PAGES_BY_SLUG[slug].confidence, slug).toBe('proven');
      expect(proven, name).toContain(name);
    }
    for (const [slug, name] of [['soft-scale', 'Soft Scale'], ['whiteout', 'Whiteout'], ['empty-back', 'Empty Back'], ['sable', 'Sable'], ['highway', 'Highway']]) {
      expect(CALCULATOR_PAGES_BY_SLUG[slug].confidence, slug).toBe('emerging');
      expect(emerging, name).toContain(name);
      expect(proven, name).not.toContain(name);
    }
    expect(proven).not.toContain('White Wall');
    // The pattern morphs get both views, as the Morph Guide gives them.
    expect(line).toContain('Foundation Genetics proposes single-gene models for Harlequin (incomplete dominant), Pinstripe and Dalmatian (dominant)');
  });
});

describe('landing claims', () => {
  it('the landing FAQ and product tour no longer promise co-dominant percentages or photos for every morph', () => {
    const home = read('src/pages/HomeControl.jsx');
    expect(home).not.toMatch(/models co-dominant, recessive, and polygenic/);
    expect(home).not.toMatch(/photo-led references for every major morph/);
    expect(read('src/data/product-tour.js')).not.toMatch(/Photo-led references for every major morph/);
  });
});
