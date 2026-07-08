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
import { ALL_MORPHS } from '@/components/my-geckos/morphTagCatalog';

// Case-insensitive lookup from a display label to the canonical tag string.
const TAG_BY_LOWER = new Map([...ALL_MORPHS].map((t) => [t.toLowerCase(), t]));

function idToTag(id) {
  if (!id) return null;
  const label = labelFor(id, null);
  if (!label) return null;
  return TAG_BY_LOWER.get(label.toLowerCase()) || null;
}

/** All morph/trait ids the analysis identified, primary first. */
function analysisIds(analysis) {
  return [
    analysis.primary_morph,
    analysis.base_color,
    ...(analysis.genetic_traits || analysis.genetics || []),
    ...(analysis.secondary_traits || []),
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

  const conf = Number(analysis.confidence_score ?? analysis.confidence ?? 0);
  const labels = ids.map((id) => labelFor(id, null)).filter(Boolean);
  const summary = labels.length ? labels.join(', ') : 'see the analysis';
  const confText = conf ? ` (confidence ${Math.round(conf)}%)` : '';
  const notes =
    `Morph ID by Geck Inspect AI${confText}: ${summary}. ` +
    'Review and edit before saving.';

  return {
    image_urls: Array.isArray(imageUrls) ? imageUrls : [],
    morph_tags,
    notes,
  };
}
