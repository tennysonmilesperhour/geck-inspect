/**
 * GeckoForm helpers — pure functions, no React state.
 */

import { generateHatchedGeckoId, generateFounderGeckoId } from '@/components/shared/geckoIdUtils';

/**
 * Generate the next unique gecko_id_code for a user.
 *
 * Two cases:
 *   - hatched gecko (sire + dam provided) → uses the April 2026 format:
 *     (SireFirst2)(DamFirst2)(offspringNum)(eggLetter)(YY)
 *     Example: Zeus x Tiger 2025, 6th offspring -> "ZeTi6b25"
 *     offspringNum is computed from how many siblings this pair already
 *     has in the user's collection that were born in the current year.
 *   - founder gecko (no parents) → "PREFIX-NNN" where PREFIX is derived
 *     from the user's breeder_name or email prefix
 */
export async function generateNextGeckoId(user, allGeckos, sire = null, dam = null) {
  if (sire && dam) {
    const year = new Date().getFullYear();
    const siblingsThisSeason = (allGeckos || []).filter((g) => {
      if (g.sire_id !== sire.id || g.dam_id !== dam.id) return false;
      if (!g.hatch_date) return false;
      return new Date(g.hatch_date).getFullYear() === year;
    });
    const offspringNumber = siblingsThisSeason.length + 1;
    return generateHatchedGeckoId(sire, dam, offspringNumber, year);
  }

  return generateFounderGeckoId(user, allGeckos);
}
