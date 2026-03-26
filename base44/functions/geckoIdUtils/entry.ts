/**
 * Generates a gecko ID code for a newly hatched gecko from two parents.
 *
 * @param {object|null} sire - Sire gecko object (with gecko_id_code and name)
 * @param {object|null} dam  - Dam gecko object (with gecko_id_code and name)
 * @param {number} offspringNumber - 1-based index among offspring of this pair
 * @returns {string} - e.g. "ABCxDEF-01"
 */
export function generateHatchedGeckoId(sire, dam, offspringNumber) {
    const sireCode = (sire?.gecko_id_code || sire?.name?.substring(0, 3) || 'UNK')
        .toUpperCase().replace(/[^A-Z0-9]/g, '');
    const damCode = (dam?.gecko_id_code || dam?.name?.substring(0, 3) || 'UNK')
        .toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${sireCode}x${damCode}-${String(offspringNumber).padStart(2, '0')}`;
}

/**
 * Generates an ID code for a founder gecko (no parents in collection).
 *
 * @param {object} user       - Current user (needs breeder_name or email)
 * @param {Array}  allGeckos  - All geckos in the user's collection
 * @returns {string} - e.g. "USR-001"
 */
export function generateFounderGeckoId(user, allGeckos) {
    const userPrefix = (user?.breeder_name || user?.email?.split('@')[0] || 'GECK')
        .substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const founderGeckos = allGeckos.filter(
        g => !g.sire_id && !g.dam_id && g.gecko_id_code?.startsWith(userPrefix)
    );
    return `${userPrefix}-${String(founderGeckos.length + 1).padStart(3, '0')}`;
}