// "Save to a gecko you already have" (12 Nov 2026): what a Morph ID result
// maps to, and how the ticked traits join the tags a gecko already has.
// Both ways of keeping a result ("Add to my collection" and this one) must
// read the same list, and a save must never rewrite or drop an existing tag.
import { describe, expect, it } from 'vitest';
import { buildGeckoDraftFromAnalysis, mergeMorphTags, suggestedTagsFromAnalysis } from '@/lib/morphIdDraft';
import { ALL_MORPHS } from '@/components/my-geckos/morphTagCatalog';

const LILLY_HARLEQUIN = {
  primary_morph: 'harlequin',
  genetic_traits: ['lily_white'],
  secondary_traits: [],
  base_color: 'cream',
  assessment_status: 'best_match',
  model_signal: 82,
};
const AXANTHIC_PIN = {
  primary_morph: 'full_pinstripe',
  genetic_traits: ['axanthic_vca', 'cappuccino'],
  secondary_traits: ['kneecaps'],
  visual_profile: { pattern_family: 'harlequin', pinning: 'full', banding: 'none', spotting: 'dalmatian', white_cream_traits: [] },
};

describe('suggestedTagsFromAnalysis', () => {
  it('gives the same tags, in the same order, as the add form draft', () => {
    for (const analysis of [LILLY_HARLEQUIN, AXANTHIC_PIN, { primary_morph: 'dalmatian' }]) {
      expect(suggestedTagsFromAnalysis(analysis).map((entry) => entry.tag))
        .toEqual(buildGeckoDraftFromAnalysis(analysis, []).morph_tags);
    }
  });

  it('only offers real morph tags, each once', () => {
    const tags = suggestedTagsFromAnalysis(AXANTHIC_PIN).map((entry) => entry.tag);
    expect(tags.length).toBeGreaterThan(2);
    expect(new Set(tags).size).toBe(tags.length);
    for (const tag of tags) expect(ALL_MORPHS.has(tag), tag).toBe(true);
  });

  it('marks the traits named after a gene, which a photo cannot prove', () => {
    const byTag = Object.fromEntries(suggestedTagsFromAnalysis(AXANTHIC_PIN).map((entry) => [entry.tag, entry.gene]));
    expect(byTag.Axanthic).toBe(true);
    expect(byTag.Cappuccino).toBe(true);
    expect(byTag['Full Pinstripe']).toBe(false);
    expect(byTag.Dalmatian).toBe(false);

    const lilly = Object.fromEntries(suggestedTagsFromAnalysis(LILLY_HARLEQUIN).map((entry) => [entry.tag, entry.gene]));
    expect(lilly['Lilly White']).toBe(true);
    expect(lilly.Harlequin).toBe(false);
  });

  it('is empty without a result', () => {
    expect(suggestedTagsFromAnalysis(null)).toEqual([]);
    expect(suggestedTagsFromAnalysis({})).toEqual([]);
  });
});

describe('mergeMorphTags', () => {
  it('adds the ticked traits after the tags the gecko already has', () => {
    expect(mergeMorphTags(['Dalmatian', 'Harlequin'], ['Lilly White'])).toEqual(['Dalmatian', 'Harlequin', 'Lilly White']);
  });

  it('leaves existing tags exactly as they are, in order and spelling', () => {
    const existing = ['Het Axanthic', 'harlequin', 'Sable'];
    const merged = mergeMorphTags(existing, ['Harlequin', 'Highway']);
    expect(merged).toEqual(['Het Axanthic', 'harlequin', 'Sable', 'Highway']);
    // The gecko's own list is not changed in place.
    expect(existing).toEqual(['Het Axanthic', 'harlequin', 'Sable']);
  });

  it('never adds a tag twice or a blank one', () => {
    expect(mergeMorphTags(['Phantom'], ['Phantom', ' phantom ', '', null, 'Cappuccino', 'Cappuccino']))
      .toEqual(['Phantom', 'Cappuccino']);
  });

  it('starts a list for a gecko with no tags yet', () => {
    expect(mergeMorphTags(null, ['Harlequin'])).toEqual(['Harlequin']);
    expect(mergeMorphTags(undefined, [])).toEqual([]);
  });
});
