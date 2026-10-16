import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INHERITANCE, MORPHS } from '../../data/morph-guide.js';
import {
  GENETICS_GUIDE_DESCRIPTION,
  GENETICS_GUIDE_TITLE,
  SINGLE_GENE_INHERITANCE,
  geneticsGuideMorphGroups,
} from '../geneticsGuideSeo.js';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const bySlug = Object.fromEntries(MORPHS.map((m) => [m.slug, m]));
const slugOf = (item) => item.href.replace('/MorphGuide/', '');

describe('Genetics Guide server HTML morph lists', () => {
  const { singleGene, polygenic } = geneticsGuideMorphGroups(MORPHS, INHERITANCE);

  it('never lists a polygenic or line-bred look under "Punnett squares work"', () => {
    expect(singleGene.length).toBeGreaterThan(3);
    for (const item of singleGene) {
      const morph = bySlug[slugOf(item)];
      expect(morph, item.href).toBeTruthy();
      expect(SINGLE_GENE_INHERITANCE, morph.slug).toContain(morph.inheritance);
      expect(item.note, morph.slug).not.toMatch(/polygenic|line-bred/i);
    }
    // The 16 Oct 2026 review found this one in the hand-typed list.
    expect(singleGene.map(slugOf)).not.toContain('phantom-pinstripe');
  });

  it('lists the proven genes with their inheritance as the note', () => {
    const notes = Object.fromEntries(singleGene.map((i) => [slugOf(i), i.note]));
    expect(notes['lilly-white']).toBe('incomplete dominant');
    expect(notes.cappuccino).toBe('incomplete dominant');
    expect(notes['soft-scale']).toBe('incomplete dominant');
    expect(notes.axanthic).toBe('recessive');
  });

  it('leaves out the unproven Albino, combinations and super forms', () => {
    const slugs = singleGene.map(slugOf);
    expect(slugs).not.toContain('albino');
    expect(slugs).not.toContain('frappuccino');
    expect(slugs.some((s) => s.startsWith('super-'))).toBe(false);
  });

  it('only gives polygenic examples that the Morph Guide files as polygenic', () => {
    expect(polygenic.length).toBeGreaterThan(3);
    for (const item of polygenic) expect(bySlug[slugOf(item)].inheritance, item.href).toBe('polygenic');
  });

  it('follows the data: a morph refiled as polygenic leaves the single-gene list', () => {
    const refiled = MORPHS.map((m) => (m.slug === 'sable' ? { ...m, inheritance: 'polygenic' } : m));
    const groups = geneticsGuideMorphGroups(refiled, INHERITANCE);
    expect(groups.singleGene.map(slugOf)).not.toContain('sable');
    const harlequinAsGene = MORPHS.map((m) => (m.slug === 'harlequin' ? { ...m, inheritance: 'recessive' } : m));
    expect(geneticsGuideMorphGroups(harlequinAsGene, INHERITANCE).polygenic.map(slugOf)).not.toContain('harlequin');
  });

  it('prerender builds the lists from this function, not a typed slug list', () => {
    const src = readFileSync(resolve(ROOT, 'scripts/prerender.mjs'), 'utf8');
    expect(src).toContain('geneticsGuideMorphGroups(MORPH_LIST, INHERITANCE)');
    expect(src).not.toMatch(/\[[^\]]*'phantom-pinstripe'[^\]]*\]/);
  });

  it('keeps the snippet short enough for a search result, with no dashes', () => {
    expect(GENETICS_GUIDE_DESCRIPTION.length).toBeLessThanOrEqual(160);
    expect(GENETICS_GUIDE_TITLE).toMatch(/^Crested Gecko Genetics/);
    for (const text of [GENETICS_GUIDE_TITLE, GENETICS_GUIDE_DESCRIPTION]) expect(text).not.toMatch(/[\u2013\u2014]|--/);
  });
});
