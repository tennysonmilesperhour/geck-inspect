/**
 * GeckoForm helpers — pure functions, no React state.
 */

/**
 * Generate the next unique gecko_id_code for a user.
 *
 * Two cases:
 *   - hatched gecko (sire + dam provided) → "SIREcxDAMc-NN"
 *   - founder gecko (no parents) → "PREFIX-NNN" where PREFIX is derived
 *     from the user's breeder_name or email prefix
 *
 * Always falls back to a best-effort prefix so the returned code is
 * never empty.
 */
export async function generateNextGeckoId(user, allGeckos, sire = null, dam = null) {
  if (sire && dam) {
    const sireCode = (sire.gecko_id_code || sire.name.substring(0, 3))
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const damCode = (dam.gecko_id_code || dam.name.substring(0, 3))
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    const prefix = `${sireCode}x${damCode}-`;

    const siblings = allGeckos.filter(
      (g) => g.sire_id === sire.id && g.dam_id === dam.id
    );
    const nextId = siblings.length + 1;
    return `${prefix}${String(nextId).padStart(2, '0')}`;
  }

  const userPrefix = (
    user?.breeder_name || user?.email?.split('@')[0] || 'GECK'
  )
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const founderGeckos = allGeckos.filter(
    (g) => !g.sire_id && !g.dam_id && g.gecko_id_code?.startsWith(userPrefix)
  );
  const nextId = founderGeckos.length + 1;
  return `${userPrefix}-${String(nextId).padStart(3, '0')}`;
}
