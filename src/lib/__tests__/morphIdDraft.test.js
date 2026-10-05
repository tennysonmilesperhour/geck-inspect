import { describe, it, expect } from 'vitest';
import { buildGeckoDraftFromAnalysis, applyCorrections } from '../morphIdDraft';
import { ALL_MORPHS } from '@/components/my-geckos/morphTagCatalog';
import { PRIMARY_MORPHS, GENETIC_TRAITS, BASE_COLORS } from '@/components/morph-id/morphTaxonomy';

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

  // A Morph ID answer the tag picker cannot hold is dropped from the saved
  // gecko, and the value estimate then cannot price it. These ids have no
  // catalog tag on purpose (no honest equivalent); everything else must map.
  const NO_CATALOG_TAG = new Set(['super_harlequin', 'super_tiger', 'cream_on_cream', 'melanistic']);
  const tagsFor = (analysis) => buildGeckoDraftFromAnalysis(analysis, []).morph_tags;

  it.each(PRIMARY_MORPHS.map((m) => m.id).filter((id) => !NO_CATALOG_TAG.has(id)))(
    'saves primary morph %s as a catalog tag',
    (id) => {
      const tags = tagsFor({ primary_morph: id });
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) expect(ALL_MORPHS.has(tag)).toBe(true);
    },
  );

  it.each(GENETIC_TRAITS.map((m) => m.id).filter((id) => !NO_CATALOG_TAG.has(id)))(
    'saves genetic trait %s as a catalog tag',
    (id) => {
      const tags = tagsFor({ genetic_traits: [id] });
      expect(tags.length).toBeGreaterThan(0);
      for (const tag of tags) expect(ALL_MORPHS.has(tag)).toBe(true);
    },
  );

  it.each(BASE_COLORS.map((m) => m.id))('saves base color %s as a catalog tag', (id) => {
    const tags = tagsFor({ base_color: id });
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(ALL_MORPHS.has(tag)).toBe(true);
  });

  it('saves every Axanthic line as Axanthic', () => {
    for (const id of ['axanthic', 'axanthic_vca', 'axanthic_tsm']) {
      expect(tagsFor({ genetic_traits: [id] })).toContain('Axanthic');
    }
  });
});

describe('applyCorrections', () => {
  const ai = {
    primary_morph: 'harlequin',
    genetic_traits: [],
    secondary_traits: ['portholes'],
    base_color: 'red',
    visual_profile: { pattern_family: 'harlequin', pinning: 'partial' },
  };

  it('returns the analysis unchanged without corrections', () => {
    expect(applyCorrections(ai, null)).toBe(ai);
  });

  it('saves the corrected morph, genetics and base color', () => {
    const corrected = applyCorrections(ai, {
      primary_morph: 'extreme_harlequin',
      genetics: ['lily_white'],
      secondary_traits: [],
      base_color: 'cream',
    });
    const tags = buildGeckoDraftFromAnalysis(corrected, []).morph_tags;
    expect(tags).toContain('Extreme Harlequin');
    expect(tags).toContain('Cream Base');
    expect(tags).not.toContain('Red Base');
    // The AI's partial pinning described its own pick, not the correction.
    expect(tags).not.toContain('Partial Pinstripe');
  });

  it('keeps the visual profile when the morph was confirmed as is', () => {
    const corrected = applyCorrections(ai, { primary_morph: 'harlequin', genetics: [], secondary_traits: ['portholes'], base_color: 'red' });
    expect(corrected.visual_profile).toEqual(ai.visual_profile);
  });
});
