/**
 * Rough market context for predicted outcomes.
 *
 * Breeders already do this by hand: calculator odds on one screen,
 * MorphMarket prices on another. This module joins the calculator's
 * outcome list to the Morph Guide's curated price ranges and produces
 * an expected-value BAND for a season, never a fake-precise number.
 *
 * Honesty rules:
 *   - Only outcomes that map to a priced Morph Guide entry contribute;
 *     coverage is reported so a band built from 40% of outcomes says so.
 *   - Lethal outcomes contribute zero (they are eggs, not animals).
 *   - Polygenic quality moves real prices far more than gene lists do,
 *     so everything renders with a "quality decides the real number"
 *     caveat in the UI.
 */
import { MORPHS } from '@/data/morph-guide';
import { getComboMorph } from '@/lib/genetics';
import { MORPH_GUIDE_SLUGS } from './calculatorCatalog';

// slug -> { low, high } parsed once from the guide's "$120-$400" style
// strings (the guide uses an en-dash range separator in data).
const PRICE_BY_SLUG = (() => {
  const map = new Map();
  for (const m of MORPHS) {
    if (!m?.slug || !m?.priceRange) continue;
    const nums = String(m.priceRange).match(/\d[\d,]*/g);
    if (!nums || nums.length === 0) continue;
    const low = Number(nums[0].replace(/,/g, ''));
    const high = Number((nums[1] || nums[0]).replace(/,/g, ''));
    if (Number.isFinite(low) && Number.isFinite(high)) {
      map.set(m.slug, { low, high, name: m.name });
    }
  }
  return map;
})();

/** Price band for one outcome, or null when nothing priced maps. */
export function priceForOutcome(outcome) {
  if (outcome.health_risk === 'lethal') return null;
  const candidates = [];
  for (const comboId of outcome.matching_combo_morphs || []) {
    const slug = MORPH_GUIDE_SLUGS[comboId];
    const price = slug && PRICE_BY_SLUG.get(slug);
    if (price) candidates.push({ ...price, source: getComboMorph(comboId)?.name || comboId });
  }
  if (candidates.length === 0) {
    // Fall back to the priciest single expressed gene with a guide entry.
    for (const [, pair] of Object.entries(outcome.genotype || {})) {
      for (const allele of pair) {
        const slug = MORPH_GUIDE_SLUGS[allele];
        const price = slug && PRICE_BY_SLUG.get(slug);
        if (price) candidates.push({ ...price, source: price.name });
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.high - a.high);
  return candidates[0];
}

/**
 * Expected value band for a season of `eggs` eggs.
 * Returns { low, high, coverage } where coverage is the probability
 * mass of outcomes that had a price, or null when nothing priced.
 */
export function expectedSeasonValue(outcomes, eggs) {
  let low = 0;
  let high = 0;
  let coverage = 0;
  for (const o of outcomes || []) {
    const price = priceForOutcome(o);
    if (!price) continue;
    coverage += o.probability;
    low += o.probability * price.low * eggs;
    high += o.probability * price.high * eggs;
  }
  if (coverage <= 0) return null;
  return { low: Math.round(low), high: Math.round(high), coverage };
}
