import { describe, it, expect } from 'vitest';
import { buildGeckoDraftFromAnalysis } from '../morphIdDraft';
import { ALL_MORPHS } from '@/components/my-geckos/morphTagCatalog';

describe('buildGeckoDraftFromAnalysis', () => {
  it('returns null for a missing analysis', () => {
    expect(buildGeckoDraftFromAnalysis(null, [])).toBeNull();
  });

  it('carries the analyzed photos onto the draft', () => {
    const urls = ['https://x/1.webp', 'https://x/2.webp'];
    const draft = buildGeckoDraftFromAnalysis({ primary_morph: 'harlequin' }, urls);
    expect(draft.image_urls).toEqual(urls);
  });

  it('maps recognized morph ids to real tag-catalog tags only', () => {
    const draft = buildGeckoDraftFromAnalysis(
      {
        primary_morph: 'harlequin',
        genetic_traits: ['lily_white'],
        secondary_traits: [],
        confidence_score: 88,
      },
      [],
    );
    // Every produced tag must be a real entry in the catalog (no invented tags).
    for (const tag of draft.morph_tags) {
      expect(ALL_MORPHS.has(tag)).toBe(true);
    }
    // Harlequin is a common tag and should map.
    expect(draft.morph_tags.some((t) => t.toLowerCase() === 'harlequin')).toBe(true);
  });

  it('never emits duplicate tags', () => {
    const draft = buildGeckoDraftFromAnalysis(
      { primary_morph: 'harlequin', secondary_traits: ['harlequin'] },
      [],
    );
    expect(new Set(draft.morph_tags).size).toBe(draft.morph_tags.length);
  });

  it('carries co-occurring visual axes into the collection draft', () => {
    const draft = buildGeckoDraftFromAnalysis(
      {
        primary_morph: 'harlequin',
        visual_profile: {
          pattern_family: 'harlequin',
          pinning: 'partial',
          banding: 'tiger',
          spotting: 'dalmatian',
          white_cream_traits: ['portholes'],
        },
      },
      [],
    );

    expect(draft.morph_tags).toEqual(expect.arrayContaining([
      'Harlequin',
      'Partial Pinstripe',
      'Tiger',
      'Dalmatian',
      'Portholes',
    ]));
  });

  it('writes a notes line that marks the suggestion unverified and labels the model signal', () => {
    const draft = buildGeckoDraftFromAnalysis(
      { primary_morph: 'harlequin', confidence_score: 73 },
      [],
    );
    expect(draft.notes).toMatch(/Unverified Morph ID suggestion/);
    expect(draft.notes).toMatch(/model signal 73\/100/);
    expect(draft.notes).toMatch(/Harlequin/);
  });

  it('does not throw on an analysis with unknown ids and produces no bad tags', () => {
    const draft = buildGeckoDraftFromAnalysis(
      { primary_morph: 'not_a_real_morph_id', genetic_traits: ['also_fake'] },
      [],
    );
    for (const tag of draft.morph_tags) {
      expect(ALL_MORPHS.has(tag)).toBe(true);
    }
  });
});
