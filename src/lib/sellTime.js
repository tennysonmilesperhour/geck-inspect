/**
 * Time to sell: how long a crested gecko like this one usually takes to
 * sell on MorphMarket. Enterprise only (Market Intelligence).
 *
 * public.sell_time_model() returns the market's sales rate (sales per
 * listing-day, from listings checked for "sold" between 17 May and 7 Jun
 * 2026) and a multiplier for each age class, sex, price position and
 * trait. This module multiplies the ones that fit a gecko and turns the
 * rate into plain numbers, assuming the rate holds steady while the
 * gecko is listed (a listing that has not sold yet is as likely to sell
 * tomorrow as it was on day one). Under that assumption half sell within
 * ln 2 / rate days. The sales window was only three weeks, so anything
 * past about a month is an extrapolation and is labelled as one.
 *
 * Pure functions plus one cached loader, so tests run without a database.
 */
import { supabase } from '@/lib/supabaseClient';
import { ageClassFor, matchGeckoTraits, sexClassFor } from '@/lib/traitValuation';

// The total multiplier stays within these bounds. Each factor is already
// pulled toward 1 for small groups, but several can stack.
const MIN_MULTIPLIER = 1 / 3;
const MAX_MULTIPLIER = 3;
// A factor this close to 1 is not worth naming as a reason.
const NOTABLE = 0.08;

const AGE_LABELS = { hatchling: 'Hatchling', juvenile: 'Juvenile', subadult: 'Subadult', adult: 'Adult' };
const SEX_LABELS = { male: 'Male', female: 'Female', unsexed: 'Unsexed' };
const PRICE_LABELS = {
  well_below: 'Priced well below similar geckos',
  below: 'Priced below similar geckos',
  typical: 'Priced like similar geckos',
  above: 'Priced above similar geckos',
  well_above: 'Priced well above similar geckos',
};

/** Price band for a price against the median for similar geckos (matches the SQL). */
export function priceBandFor(price, median) {
  const p = Number(price);
  const m = Number(median);
  if (!(p > 0) || !(m > 0)) return null;
  const ratio = p / m;
  if (ratio < 0.7) return 'well_below';
  if (ratio < 0.9) return 'below';
  if (ratio <= 1.15) return 'typical';
  if (ratio <= 1.5) return 'above';
  return 'well_above';
}

/** Chance a listing has sold within `days`, at a steady daily rate. */
export function soldWithin(rate, days) {
  return 1 - Math.exp(-rate * days);
}

/** Days by which a share `p` (0 to 1) of listings like this have sold. */
export function daysUntilShare(rate, p) {
  return -Math.log(1 - p) / rate;
}

/**
 * Estimate for one gecko.
 *
 *   gecko       gecko row (morph_tags / morphs_traits, sex, weight_grams,
 *               hatch_date) as the value estimate uses it
 *   model       sell_time_model() result with allowed = true
 *   traitIndex  trait value index, to match the gecko's traits the same
 *               way the value estimate does
 *   price       asking price, optional
 *   median      median asking price for similar geckos (the value
 *               estimate's band p50), optional; with price it sets the
 *               price position
 *
 * Returns null when there is no model.
 */
export function estimateSellTime(gecko, model, traitIndex, { price = null, median = null, now = new Date() } = {}) {
  if (!model?.allowed || !(Number(model.rate) > 0)) return null;
  const factors = model.factors || {};
  const reasons = [];
  let multiplier = 1;

  const apply = (dim, key, label) => {
    const f = Number(factors[dim]?.[key]?.factor);
    if (!(f > 0)) return;
    multiplier *= f;
    reasons.push({ dim, key, label, factor: f });
  };

  const ageClass = gecko ? ageClassFor(gecko, now) : null;
  if (ageClass) apply('age', ageClass, AGE_LABELS[ageClass]);

  const sexClass = gecko ? sexClassFor(gecko) : null;
  if (sexClass) apply('sex', sexClass, SEX_LABELS[sexClass]);

  const band = priceBandFor(price, median ?? (ageClass ? model.age_medians?.[ageClass] : null));
  if (band) apply('price', band, PRICE_LABELS[band]);

  // A gecko has several traits and they travel together (Lilly White
  // with Harlequin, say), so multiplying every trait's factor would count
  // the same effect more than once. The geometric mean of the matched
  // traits stands for "the traits" as one factor.
  const traitFactors = [];
  if (gecko && traitIndex) {
    for (const key of matchGeckoTraits(gecko, traitIndex)) {
      const t = factors.trait?.[key];
      const f = Number(t?.factor);
      if (f > 0) traitFactors.push({ key, label: traitIndex.traits.get(key)?.name || key, factor: f });
    }
  }
  if (traitFactors.length > 0) {
    const mean = Math.exp(traitFactors.reduce((s, t) => s + Math.log(t.factor), 0) / traitFactors.length);
    multiplier *= mean;
    for (const t of traitFactors) reasons.push({ dim: 'trait', key: t.key, label: t.label, factor: t.factor });
  }

  multiplier = Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, multiplier));
  const rate = Number(model.rate) * multiplier;

  return {
    rate,
    multiplier,
    medianDays: daysUntilShare(rate, 0.5),
    within14: soldWithin(rate, 14),
    within30: soldWithin(rate, 30),
    marketMedianDays: daysUntilShare(Number(model.rate), 0.5),
    priceBand: band,
    faster: reasons.filter((r) => r.factor >= 1 + NOTABLE).sort((a, b) => b.factor - a.factor),
    slower: reasons.filter((r) => r.factor <= 1 - NOTABLE).sort((a, b) => a.factor - b.factor),
    traitsMatched: traitFactors.length,
  };
}

/** "9 days", "about 5 weeks", "about 3 months", "more than 6 months". */
export function formatSellDays(days) {
  if (!Number.isFinite(days)) return 'unknown';
  if (days < 14) return `${Math.max(1, Math.round(days))} days`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  if (days <= 180) return `about ${Math.round(days / 30.4)} months`;
  return 'more than 6 months';
}

const TTL_MS = 30 * 60_000;
let cache = null;
let inflight = null;

/**
 * Resolves to the model, or { allowed: false } for members without
 * Enterprise. Cached for the session; it only moves when sales are
 * tracked again.
 */
export async function loadSellTimeModel() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.model;
  if (!inflight) {
    inflight = supabase.rpc('sell_time_model')
      .then(({ data, error }) => {
        if (error) throw error;
        cache = { model: data || { allowed: false }, at: Date.now() };
        return cache.model;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
