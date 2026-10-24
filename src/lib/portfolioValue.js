import { canonicalizeMorphTag } from '@/lib/genetics';
import { valueFromTraitTable, qualityTierFor } from '@/lib/traitValuation';

const TIER_MULTIPLIERS = {
  investment: 1.5,
  high_end: 1.25,
  breeder: 1.0,
  pet: 0.6,
};

const HET_PREFIX = /^(possible\s+het|pos\s+het|p\.?\s*het|het)\s+/i;

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** market_price_estimate is jsonb {low, high, average}; tolerate strings. */
function estimateAverage(gecko) {
  let est = gecko.market_price_estimate;
  if (!est) return null;
  if (typeof est === 'string') {
    try { est = JSON.parse(est); } catch { return null; }
  }
  return toNumber(est.average);
}

/**
 * Build a lookup of canonical morph name (lowercase) to the community
 * average price from morph_price_cache rows.
 */
export function buildMorphAverages(cacheRows) {
  const acc = new Map();
  for (const row of cacheRows || []) {
    const name = canonicalizeMorphTag(row.morph_name);
    const price = toNumber(row.price) || toNumber(row.average_price) || toNumber(row.min_price);
    if (!name || !price) continue;
    const key = name.toLowerCase();
    const cur = acc.get(key) || { sum: 0, count: 0, name };
    cur.sum += price;
    cur.count += 1;
    acc.set(key, cur);
  }
  const out = new Map();
  for (const [key, { sum, count, name }] of acc) {
    out.set(key, { average: sum / count, name });
  }
  return out;
}

/** Visual (non-het) canonical morph tags for a gecko. */
export function visualMorphs(gecko) {
  const tags = Array.isArray(gecko.morph_tags) ? gecko.morph_tags : [];
  return tags
    .filter((t) => typeof t === 'string' && t.trim() && !HET_PREFIX.test(t.trim()))
    .map((t) => canonicalizeMorphTag(t))
    .filter(Boolean);
}

/** Shared valuation model for Portfolio and the homepage. */
export function valueGecko(gecko, morphAverages, traitIndex) {
  const listing = toNumber(gecko.listing_price);
  if (listing) return { value: listing, basis: 'listing', drivingMorph: visualMorphs(gecko)[0] || null };

  const asking = toNumber(gecko.asking_price);
  if (asking) return { value: asking, basis: 'asking', drivingMorph: visualMorphs(gecko)[0] || null };

  const aiAvg = estimateAverage(gecko);
  if (aiAvg) return { value: aiAvg, basis: 'ai_estimate', drivingMorph: visualMorphs(gecko)[0] || null };

  // Geck Data trait value table: cross-reference the selected traits.
  const fromTraits = valueFromTraitTable(gecko, traitIndex, qualityTierFor(gecko));
  if (fromTraits) {
    return { ...fromTraits, basis: 'geck_data', drivingMorph: fromTraits.trait };
  }

  // Morph comp: best matching community average among visual morphs.
  let best = null;
  for (const morph of visualMorphs(gecko)) {
    const hit = morphAverages.get(morph.toLowerCase());
    if (hit && (!best || hit.average > best.average)) best = hit;
  }
  if (best) {
    const tier = qualityTierFor(gecko);
    const multiplier = TIER_MULTIPLIERS[tier] ?? 1.0;
    return {
      value: best.average * multiplier,
      basis: 'morph_comp',
      drivingMorph: best.name,
      compMorph: best.name,
      compAverage: best.average,
      tier,
      multiplier,
    };
  }

  return { value: 0, basis: 'unpriced', drivingMorph: visualMorphs(gecko)[0] || null };
}
