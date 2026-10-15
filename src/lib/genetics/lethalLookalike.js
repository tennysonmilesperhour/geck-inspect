/**
 * Lilly White look-alike safety check.
 *
 * Lilly White x Lilly White is the one pairing in the hobby with a lethal
 * outcome: about 1 in 4 eggs is a Super Lilly White, which dies in the
 * egg. The engine warns about it, but only when BOTH parents are tagged
 * Lilly White.
 *
 * White Wall, Whiteout and line-bred high white can look very like Lilly
 * White, and the Morph ID prompt itself says photos mix them up. Morph ID
 * results are saved straight into morph_tags with nothing marking them as
 * unconfirmed, and the calculator reads "White Wall" as the engine's
 * Whiteout (a separate gene with a healthy super). So a real Lilly White
 * that was tagged White Wall would quietly switch the lethal warning off.
 *
 * This check is deliberately conservative: a White Wall, Whiteout or
 * high white parent counts as a possible Lilly White. When it is paired
 * with a Lilly White (or another look-alike) we show a caution. It warns,
 * it never blocks: plenty of these animals really are White Walls.
 *
 * Plain JS with relative imports so the Node MCP build can use it.
 */

/** Tag bodies (lowercase, after any Het prefix) that can hide a Lilly White. */
export const LILLY_WHITE_LOOKALIKE_TAGS = new Set([
  'white wall',
  'whitewall',
  'super white wall',
  'super whitewall',
  'whiteout',
  'super whiteout',
  'white out',
  'super white out',
  'high white',
]);

export const LOOKALIKE_WARNING_CODE = 'lilly_white_lookalike';

/** True when a spec carries (or may carry) a Lilly White allele. */
export function specCarriesLillyWhite(spec) {
  return (spec?.loci?.L || []).some(
    (option) => option.weight > 0 && option.pair.includes('lilly_white'),
  );
}

/**
 * The caution for a pairing, or null. Specs come from translateMorphTags,
 * which sets `lillyWhiteLookalike` on a gecko tagged White Wall, Whiteout
 * or high white that is not already tagged Lilly White.
 */
export function lillyWhiteLookalikeWarning(sireSpec, damSpec) {
  const sireLook = Boolean(sireSpec?.lillyWhiteLookalike);
  const damLook = Boolean(damSpec?.lillyWhiteLookalike);
  const sireLilly = specCarriesLillyWhite(sireSpec);
  const damLilly = specCarriesLillyWhite(damSpec);

  const lethalOdds =
    'about 1 in 4 eggs would be a Super Lilly White, which dies in the egg';
  const advice =
    'Confirm its lineage, or test-pair it to a non-white gecko, before relying on these odds.';

  let message = null;
  if (sireLook && damLook) {
    message =
      'Both parents are tagged White Wall, Whiteout or high white, which can look like Lilly White (photo IDs mix them up). ' +
      `If both are actually Lilly Whites, ${lethalOdds}. Confirm their lineage, or test-pair them to non-white geckos, before relying on these odds.`;
  } else if ((sireLook && damLilly) || (damLook && sireLilly)) {
    const who = sireLook ? 'sire' : 'dam';
    message =
      `The ${who} is tagged White Wall, Whiteout or high white, which can look like Lilly White (photo IDs mix them up). ` +
      `If it is actually a Lilly White, this is a Lilly White x Lilly White pairing and ${lethalOdds}. ${advice}`;
  }
  if (!message) return null;
  return {
    severity: 'caution',
    code: LOOKALIKE_WARNING_CODE,
    message,
    // The "if" is in the message itself; this is not the possible-het case.
    conditional: false,
  };
}
