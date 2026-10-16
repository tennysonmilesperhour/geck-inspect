/**
 * The search term a Morph Guide page uses to find reviewed member photos
 * in gecko_images (an ilike match on primary_morph, which holds values
 * such as 'harlequin', 'lilly_white' or 'super_dalmatian').
 *
 * The page matches on the first word of the morph name, so 'Lilly White'
 * also finds photos tagged plain 'lilly'. "Super" and "Extreme" are too
 * general on their own: on 16 Oct 2026, 8 reviewed member photos tagged
 * super_dalmatian would have shown (one as the hero) on every new super
 * page, Super Lilly White included, and 3 tagged extreme_harlequin
 * already showed on Extreme Brindle. Those names match in full, with "_"
 * between the words, which ilike reads as any one character (a space or
 * an underscore).
 */
const GENERIC_FIRST_WORDS = new Set(['super', 'extreme']);

export function galleryMorphTerm(morphName) {
  const words = String(morphName || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return GENERIC_FIRST_WORDS.has(words[0]) ? words.join('_') : words[0];
}
