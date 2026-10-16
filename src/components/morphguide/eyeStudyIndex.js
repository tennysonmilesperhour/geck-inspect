/**
 * Which close-up eye study a Morph Guide page shows, by morph slug.
 *
 * Kept apart from the studies themselves (MorphEyeGuide.jsx: the plates,
 * text and the index section) so a morph page can tell whether it has an
 * eye study without downloading them. The page loads the panel only when
 * this returns an id.
 */
const EYE_STUDY_BY_MORPH = new Map([
  ['albino', 'ruby-albino'],
  ['axanthic', 'silver-gray'],
  ['moonglow', 'silver-gray'],
  ['lavender', 'silver-gray'],
  ['cappuccino', 'melanistic-dark'],
  ['sable', 'melanistic-dark'],
  ['frappuccino', 'melanistic-dark'],
  ['olive', 'olive-green'],
  ['phantom-pinstripe', 'olive-green'],
  ['red-base', 'copper-amber'],
  ['orange-base', 'copper-amber'],
]);

/** The eye study id for a morph slug, or null when it has none. */
export function eyeStudyIdForMorph(slug) {
  return EYE_STUDY_BY_MORPH.get(slug) || null;
}
