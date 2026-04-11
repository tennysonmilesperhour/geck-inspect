/**
 * Hatchling ID generators.
 *
 * Format (April 2026): (SireFirst2)(DamFirst2)(OffspringNum)(EggLetter)(YY)
 *
 *   - SireFirst2   first two letters of the sire's name, title-cased (first
 *                  capital, second lowercase). e.g. Zeus -> "Ze"
 *   - DamFirst2    same, for the dam. e.g. Tiger -> "Ti"
 *   - OffspringNum 1-based sequential offspring number for THIS pair in the
 *                  CURRENT season (calendar year). Counts every egg from the
 *                  pair this year regardless of status.
 *   - EggLetter    which egg in its clutch: a = first, b = second, c...
 *                  A "clutch" is defined as eggs sharing the same lay_date;
 *                  if the egg's lay_date is unique the egg is treated as
 *                  clutch-of-one (letter 'a'). This matches typical crested
 *                  gecko reproductive biology where a clutch is 2 eggs laid
 *                  within hours of each other.
 *   - YY           2-digit year born (from the egg's lay_date, or current
 *                  year if no egg is attached)
 *
 * Example: Zeus x Tiger 2025, 3rd clutch second egg -> "ZeTi6b25"
 *          (3 clutches of 2 eggs each = 6 offspring this season, egg 'b')
 *
 * The hatched-from-egg path (generateHatchedGeckoIdFromEgg) has full clutch
 * info. The manual-add path (generateHatchedGeckoId) infers based on total
 * offspring count for this pair this year and assumes clutch-of-two.
 */

// First two letters of a name, title-cased. Strips non-alphanumerics.
function firstTwoTitleCase(name) {
    const clean = (name || '').replace(/[^A-Za-z0-9]/g, '');
    if (clean.length === 0) return 'Xx';
    const first = clean.charAt(0).toUpperCase();
    const second = (clean.charAt(1) || 'x').toLowerCase();
    return `${first}${second}`;
}

// 'a', 'b', 'c', ...
function letterFromIndex(zeroBasedIndex) {
    return String.fromCharCode('a'.charCodeAt(0) + zeroBasedIndex);
}

/**
 * Full-information hatch-time ID generator. Requires the egg that's
 * hatching plus every egg this pair has laid (in the current season or
 * otherwise) so it can compute clutch grouping + offspring number.
 *
 * @param {object} opts
 * @param {object} opts.sire            Sire gecko
 * @param {object} opts.dam             Dam gecko
 * @param {object} opts.egg             The egg being hatched (needs lay_date + id)
 * @param {Array}  opts.allEggsForPair  Every egg ever recorded for this pair
 * @returns {string}
 */
export function generateHatchedGeckoIdFromEgg({ sire, dam, egg, allEggsForPair }) {
    const layDate = egg?.lay_date ? new Date(egg.lay_date) : new Date();
    const year = layDate.getFullYear();

    const seasonEggs = (allEggsForPair || [])
        .filter((e) => {
            if (!e.lay_date) return false;
            return new Date(e.lay_date).getFullYear() === year;
        })
        .sort((a, b) => {
            const t = new Date(a.lay_date).getTime() - new Date(b.lay_date).getTime();
            if (t !== 0) return t;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });

    // Group into clutches: consecutive eggs with the same lay_date and a
    // max clutch size of 2 form one clutch. (Crested geckos almost always
    // lay 2 eggs per clutch.)
    const clutches = [];
    let current = [];
    let currentDate = null;
    for (const e of seasonEggs) {
        const d = e.lay_date;
        if (d !== currentDate || current.length >= 2) {
            if (current.length) clutches.push(current);
            current = [e];
            currentDate = d;
        } else {
            current.push(e);
        }
    }
    if (current.length) clutches.push(current);

    // Find the current egg in the clutch/season list
    let offspringNum = 0;
    let eggIdx = 0;
    let found = false;
    for (const clutch of clutches) {
        for (let i = 0; i < clutch.length; i++) {
            offspringNum += 1;
            if (clutch[i].id === egg?.id) {
                eggIdx = i;
                found = true;
                break;
            }
        }
        if (found) break;
    }

    // Fallback: if egg wasn't in the list, treat it as the next offspring
    // after everything we saw, in a new clutch-of-one.
    if (!found) {
        offspringNum = seasonEggs.length + 1;
        eggIdx = 0;
    }

    const siLetters = firstTwoTitleCase(sire?.name);
    const daLetters = firstTwoTitleCase(dam?.name);
    const eggLetter = letterFromIndex(eggIdx);
    const yy = String(year).slice(-2).padStart(2, '0');
    return `${siLetters}${daLetters}${offspringNum}${eggLetter}${yy}`;
}

/**
 * Manual-add ID generator. Used when the user creates a hatchling by hand
 * from the Add Gecko form and doesn't have the egg entity. Assumes a
 * clutch size of 2 so the egg letter alternates a/b by offspring number.
 *
 * @param {object|null} sire              Sire gecko
 * @param {object|null} dam               Dam gecko
 * @param {number}      offspringNumber   1-based offspring number for this
 *                                        pair in the current season
 * @param {number}      [year]            4-digit year, defaults to now
 * @returns {string}
 */
export function generateHatchedGeckoId(sire, dam, offspringNumber, year = new Date().getFullYear()) {
    const siLetters = firstTwoTitleCase(sire?.name);
    const daLetters = firstTwoTitleCase(dam?.name);
    // Egg letter assumes clutches of 2: odd offspring number -> 'a', even -> 'b'.
    const eggLetter = ((offspringNumber - 1) % 2) === 0 ? 'a' : 'b';
    const yy = String(year).slice(-2).padStart(2, '0');
    return `${siLetters}${daLetters}${offspringNumber}${eggLetter}${yy}`;
}

/**
 * Founder gecko ID (no parents). Unchanged from the old behavior.
 */
export function generateFounderGeckoId(user, allGeckos) {
    const userPrefix = (user?.breeder_name || user?.email?.split('@')[0] || 'GECK')
        .substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const founderGeckos = allGeckos.filter(
        g => !g.sire_id && !g.dam_id && g.gecko_id_code?.startsWith(userPrefix)
    );
    return `${userPrefix}-${String(founderGeckos.length + 1).padStart(3, '0')}`;
}
