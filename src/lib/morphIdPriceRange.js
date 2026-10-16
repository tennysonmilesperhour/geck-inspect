/**
 * Asking prices for the looks a Morph ID answer found, from the Price Index.
 *
 * Morph ID used to ask the model to guess a "conservative retail price
 * band" from the photo. That number had no source and no sample size, and
 * it contradicted the promise that Geck Inspect values come from real
 * listings. Now the result shows, for each look, the middle half of asking
 * prices on public crested gecko listings (the trait value table behind
 * the Price Index and the gecko value estimate) and how many listings that
 * rests on. A look with too few listings shows nothing rather than a
 * number that would move with one sale, and so does a look the index has
 * no trait of its own for, rather than another trait's listings.
 *
 * Pure functions: the panel loads the index (loadTraitValueIndex) and
 * passes it in.
 */
import { labelFor } from '../components/morph-id/morphTaxonomy.js';
import { toWords } from './traitValuation.js';

/** Fewer listings than this and the range is not shown. */
export const MIN_LISTINGS = 10;

const AGE_WORDS = {
  hatchling: 'hatchlings',
  juvenile: 'juveniles',
  subadult: 'subadults',
  adult: 'adults',
};

// Taxonomy labels sometimes carry a note in brackets ("Full Pinstripe
// (100%)", "Axanthic (VCA)"); the look is the name before it.
function plainLabel(id) {
  return labelFor(id, '').replace(/\s*\([^)]*\)/g, '').trim();
}

/** The listings band to use: this age class when there are enough, else every age. */
function bandFor(trait, ageStage) {
  const age = AGE_WORDS[ageStage] ? ageStage : null;
  if (age) {
    const band = trait.bands.get(`${age}|any`);
    if (band && band.n >= MIN_LISTINGS) return { ...band, slice: AGE_WORDS[age] };
  }
  const all = trait.bands.get('any|any');
  if (all && all.n >= MIN_LISTINGS) return { ...all, slice: 'all ages' };
  return null;
}

/**
 * @param {{ primary_morph?: string, genetics?: string[], genetic_traits?: string[] }} looks
 *   the leading look and the possible genes (MorphCorrectionPanel state or a raw answer)
 * @param {object|null} index - from buildTraitValueIndex / loadTraitValueIndex
 * @param {string} [ageStage] - Morph ID age stage (hatchling, juvenile, subadult, adult, unknown)
 * @returns {{ look: string, trait: string, low: number, median: number, high: number,
 *   listings: number, slice: string, gene: boolean }[]}
 */
export function morphIdPriceRows(looks, index, ageStage = 'unknown', { max = 3 } = {}) {
  if (!looks || !index?.traits?.size) return [];
  const genes = looks.genetics ?? looks.genetic_traits ?? [];
  const wanted = [
    { id: looks.primary_morph, gene: false },
    ...(Array.isArray(genes) ? genes : []).map((id) => ({ id, gene: true })),
  ].filter((item) => typeof item.id === 'string' && item.id);

  const rows = [];
  const used = new Set();
  for (const { id, gene } of wanted) {
    const look = plainLabel(id);
    if (!look) continue;
    // Only a trait whose name or alias is the whole look: "Lilly White"
    // prices as Lilly White. A look the index has no listings of shows
    // nothing rather than a trait that shares a word with it: Super
    // Harlequin is not priced from Harlequin listings, Extreme Brindle from
    // Brindle or Red Dalmatian from every listing that says "red" (October
    // 2026 review).
    const key = index.aliases.get(toWords(look).join(' '));
    if (!key || used.has(key)) continue;
    const trait = index.traits.get(key);
    const band = trait && bandFor(trait, ageStage);
    if (!band) continue;
    used.add(key);
    rows.push({
      look,
      trait: trait.name,
      low: band.p25,
      median: band.p50,
      high: band.p75,
      listings: band.n,
      slice: band.slice,
      gene,
    });
    if (rows.length >= max) break;
  }
  return rows;
}

/** "$120" with thousands separators. */
export function dollars(value) {
  return `$${Math.round(Number(value) || 0).toLocaleString('en-US')}`;
}
