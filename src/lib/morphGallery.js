/**
 * The search term a Morph Guide page uses to find reviewed member photos
 * in gecko_images (an ilike match on primary_morph, which holds values
 * such as 'harlequin', 'lilly_white' or 'super_dalmatian').
 *
 * The page matches the whole morph name (Tennyson, 16 Oct 2026), so a
 * Red Base page no longer shows every photo whose tag starts with "red",
 * and a super page shows only that super's photos. The words are joined
 * with "_", which ilike reads as any one character, so the term matches
 * a tag written with a space or with an underscore: 'Lilly White' finds
 * both 'lilly_white' and 'Lilly White Harlequin'. A plain space would
 * not match the underscored tags, and the gallery would come up empty.
 */
export function galleryMorphTerm(morphName) {
  return String(morphName || '').toLowerCase().split(/\s+/).filter(Boolean).join('_');
}
