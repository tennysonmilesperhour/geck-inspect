/**
 * Search the morph tag catalogue as the member types (experience review
 * D4). The catalogue itself is morphTagCatalog.js; nothing here changes it.
 */
import { MORPH_CATEGORIES } from '../morphTagCatalog';

// Lower case, single spaces, and doubled letters folded to one, so "lily
// white" finds Lilly White and "capuccino" finds Cappuccino.
const fold = (text) => String(text || '')
  .toLowerCase()
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/(.)\1+/g, '$1');

const CATALOGUE = Object.entries(MORPH_CATEGORIES).flatMap(([category, { morphs }]) =>
  morphs.map((morph) => ({ morph, category, folded: fold(morph) })),
);

/**
 * Catalogue tags that match what was typed, best first: names that start
 * with it, then names with a word that starts with it, then names that
 * contain it. Ties keep the catalogue's own order. Returns up to `limit`
 * entries of { morph, category }.
 */
export function searchMorphTags(query, limit = 12) {
  const q = fold(query);
  if (!q) return [];
  const ranked = [];
  CATALOGUE.forEach((entry, index) => {
    const at = entry.folded.indexOf(q);
    if (at === -1) return;
    const rank = at === 0 ? 0 : entry.folded.includes(` ${q}`) ? 1 : 2;
    ranked.push({ rank, index, morph: entry.morph, category: entry.category });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.slice(0, limit).map(({ morph, category }) => ({ morph, category }));
}

/** How many catalogue tags match in all (the list above may be cut short). */
export function countMorphMatches(query) {
  const q = fold(query);
  return q ? CATALOGUE.filter((entry) => entry.folded.includes(q)).length : 0;
}
