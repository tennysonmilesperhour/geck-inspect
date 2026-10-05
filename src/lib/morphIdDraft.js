/**
 * Turn an AI Morph ID result into a pre-filled new-gecko draft.
 *
 * The Recognition page identifies a gecko's morphs but used to throw the
 * result away, forcing the user to re-key everything in the add-gecko
 * form. This maps the recognition analysis (snake_case taxonomy ids) to
 * the add-gecko form's shape: the uploaded photos, the morph tags the tag
 * picker understands, and a notes line summarizing what the AI found.
 *
 * Mapping is best-effort and never invents tags: a recognition id is
 * included only if its display label exists in the tag catalog. Anything
 * unmapped still shows up in the notes, and the user reviews everything
 * before saving.
 */
import { labelFor } from '@/components/morph-id/morphTaxonomy';
import { morphHeadline } from '@/components/morph-id/morphHeadline';
import { ALL_MORPHS } from '@/components/my-geckos/morphTagCatalog';

// Case-insensitive lookup from a display label to the canonical tag string.
const TAG_BY_LOWER = new Map([...ALL_MORPHS].map((t) => [t.toLowerCase(), t]));

// Recognition ids whose display label differs from the catalog tag, for
// example "Full Pinstripe (100%)" vs "Full Pinstripe". Without these the
// trait was silently dropped from the saved gecko, so the value estimate
// could not price it either.
const ID_TO_TAG = {
  full_pinstripe: 'Full Pinstripe',
  ink_spot: 'Ink Spots',
  red_dalmatian: 'Dalmatian',
  axanthic: 'Axanthic',
  axanthic_vca: 'Axanthic',
  axanthic_tsm: 'Axanthic',
  tiger_striping: 'Tiger Striping',
  speckled: 'Speckled',
  white_tipped_crests: 'White Tipped Crests',
  kneecaps: 'Kneecaps',
  side_stripe: 'Side Stripe',
  crowned: 'Crowned',
  tailless: 'Tailless',
  fired_up_look: 'Fired Up',
  fired_down_look: 'Fired Down',
  crimson: 'Dark Red Base',
  burnt_orange: 'Orange Base',
  buttery: 'Yellow Base',
  coral: 'Pink Base',
  mahogany: 'Dark Brown Base',
  black_base: 'Near Black Base',
  charcoal: 'Near Black Base',
  near_black: 'Near Black Base',
};

function idToTag(id) {
  if (!id) return null;
  if (ID_TO_TAG[id]) return ID_TO_TAG[id];
  const label = labelFor(id, null);
  if (!label) return null;
  // Base colors are labelled "Cream" in Morph ID and "Cream Base" in the tag
  // picker.
  return TAG_BY_LOWER.get(label.toLowerCase())
    || TAG_BY_LOWER.get(`${label.toLowerCase()} base`)
    || null;
}

const VISUAL_AXIS_TO_TAXONOMY_ID = {
  partial: 'partial_pinstripe',
  full: 'full_pinstripe',
  phantom: 'phantom_pinstripe',
  reverse: 'reverse_pinstripe',
  quad: 'quad_stripe',
};

function visualProfileIds(profile) {
  if (!profile) return [];
  return [
    profile.pattern_family,
    VISUAL_AXIS_TO_TAXONOMY_ID[profile.pinning] || profile.pinning,
    profile.banding,
    profile.spotting,
    ...(profile.white_cream_traits || []),
  ].filter((id) => id && !['unknown', 'none'].includes(id));
}

/** All morph/trait ids the analysis identified, primary first. */
function analysisIds(analysis) {
  return [
    analysis.primary_morph,
    analysis.base_color,
    ...(analysis.genetic_traits || analysis.genetics || []),
    ...(analysis.secondary_traits || []),
    ...visualProfileIds(analysis.visual_profile),
  ].filter(Boolean);
}

/**
 * @param {object} analysis - the recognize-gecko-morph result
 * @param {string[]} imageUrls - the photos that were analyzed
 * @returns {{ image_urls: string[], morph_tags: string[], notes: string } | null}
 */
export function buildGeckoDraftFromAnalysis(analysis, imageUrls = []) {
  if (!analysis) return null;

  const ids = analysisIds(analysis);
  const morph_tags = [...new Set(ids.map(idToTag).filter(Boolean))];

  const conf = Number(analysis.model_signal ?? analysis.confidence_score ?? analysis.confidence ?? 0);
  const labels = ids.map((id) => labelFor(id, null)).filter(Boolean);
  const { name } = morphHeadline(analysis.primary_morph, analysis.genetic_traits || analysis.genetics || []);
  const listed = labels.length ? labels.join(', ') : 'see the analysis';
  const summary = name && labels.length ? `${name} (${listed})` : listed;
  const confText = conf ? ` (model signal ${Math.round(conf)}/100)` : '';
  const notes =
    `Unverified Morph ID suggestion from Geck Inspect${confText}: ${summary}. ` +
    'Review and edit before saving.';

  return {
    image_urls: Array.isArray(imageUrls) ? imageUrls : [],
    morph_tags,
    // Plain-language morph for the short add form and the value estimate,
    // for example "Lilly White Harlequin". Editable before saving.
    morphs_traits: name || labels.join(' ') || '',
    notes,
  };
}

/**
 * Apply the member's corrections from the result panel to the AI analysis,
 * so "Add to my collection" saves what they confirmed, not what the AI
 * first said. When they change the primary morph, the AI's visual profile
 * (pattern family, pinning) no longer describes their pick, so it is
 * dropped rather than re-adding the morph they just corrected away.
 *
 * @param {object} analysis - the recognize-gecko-morph result
 * @param {object|null} corrected - MorphCorrectionPanel state
 */
export function applyCorrections(analysis, corrected) {
  if (!analysis || !corrected) return analysis;
  const changedMorph = Boolean(corrected.primary_morph)
    && corrected.primary_morph !== analysis.primary_morph;
  return {
    ...analysis,
    primary_morph: corrected.primary_morph || analysis.primary_morph,
    genetic_traits: corrected.genetics ?? analysis.genetic_traits,
    secondary_traits: corrected.secondary_traits ?? analysis.secondary_traits,
    base_color: corrected.base_color || analysis.base_color,
    visual_profile: changedMorph ? null : analysis.visual_profile,
  };
}
