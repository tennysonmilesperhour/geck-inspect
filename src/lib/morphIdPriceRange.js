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
 * number that would move with one sale.
 *
 * Pure functions: the panel loads the index (loadTraitValueIndex) and
 * passes it in.
 */
import { labelFor } from '../components/morph-id/morphTaxonomy.js';
import { matchTraitsInText } from './traitValuation.js';

/** Fewer listings than this and the range is not shown. */
export const MIN_LISTINGS = 10;

const AGE_WORDS = {
  hatchling: 'hatchlings',
  juvenile: 'juveniles',
  subadult: 'subadults',
  adult: 'adults',
};

// Taxonomy labels sometimes carry a number ("Full Pinstripe (100%)").
function plainLabel(id) {
  return labelFor(id, '').replace(/\s*\(\d+%\)/g, '').trim();
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
    // Only a trait the label itself names: "Lilly White" prices as Lilly
    // White, never as something that merely shares a word with it.
    const key = matchTraitsInText(look, index)[0];
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
