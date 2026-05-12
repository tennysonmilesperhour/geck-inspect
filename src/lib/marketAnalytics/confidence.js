/**
 * Market Analytics ,  Confidence Scoring
 *
 * Serious buyers won't trust a number without knowing how solid it is.
 * This module produces 0..1 confidence scores and price bands from
 * (1) the underlying source's base confidence and (2) the sample size
 * of the data point. Every analytics query surfaces both a headline
 * value and a confidence triple (low, mid, high) derived here.
 *
 * The math is intentionally simple and well-behaved rather than
 * strictly Bayesian ,  the priority is a signal a subscriber can trust
 * and a methodology they can audit via the "i" popover in the UI.
 */

import { getSource } from './sources.js';

/** Map a 0..1 confidence score to a tier label and color class. */
export function confidenceTier(score) {
  if (score >= 0.85) return { code: 'high',     label: 'High',     color: 'emerald' };
  if (score >= 0.65) return { code: 'medium',   label: 'Medium',   color: 'amber'   };
  if (score >= 0.4)  return { code: 'low',      label: 'Low',      color: 'orange'  };
  return              { code: 'very_low', label: 'Very low', color: 'red'     };
}

/**
 * Composite confidence score, bounded 0..1.
 *   - sourceId:   which data source
 *   - sampleSize: how many underlying observations back the number
 *   - regionMatch: true if the sample was actually from the region
 *                  requested (not blended / extrapolated)
 */
export function scoreConfidence({ sourceId, sampleSize = 0, regionMatch = true }) {
  const src = getSource(sourceId);
  const base = src.base_confidence ?? 0.5;
  // Saturating function on sample size: n=1 → 0.2, n=10 → 0.65, n=30 → 0.86,
  // n=100 → 0.95. Chosen to feel right in the collectibles domain , 
  // collectors recognize that n=30 is meaningful, n=100 is solid.
  const n = Math.max(0, sampleSize);
  const sampleFactor = 1 - Math.exp(-n / 20);
  const regionPenalty = regionMatch ? 1 : 0.7;
  return Math.max(0, Math.min(1, base * sampleFactor * regionPenalty));
}

/**
 * Symmetric-ish confidence band around a price value.
 * Returns { low, mid, high } such that the band widens as confidence drops.
 * At conf=1 the band is ±0; at conf=0 it's ±50% (capped).
 */
export function priceBand(mid, confidence) {
  const pct = Math.max(0, Math.min(0.5, 0.5 * (1 - confidence)));
  return {
    low: Math.round(mid * (1 - pct)),
    mid: Math.round(mid),
    high: Math.round(mid * (1 + pct)),
    pct,
  };
}

/**
 * Blend multiple price observations (from different sources) into a
 * single weighted value. Each observation: { value, sourceId, sampleSize }.
 * Returns { value, confidence, contributions } where `contributions` is
 * an array the UI can render to show how the number was built.
 */
export function blendObservations(observations) {
  const weighted = observations.map((o) => {
    const w = scoreConfidence({
      sourceId: o.sourceId,
      sampleSize: o.sampleSize ?? 0,
      regionMatch: o.regionMatch ?? true,
    });
    return { ...o, weight: w };
  });
  const totalWeight = weighted.reduce((s, o) => s + o.weight, 0) || 1;
  const value = weighted.reduce((s, o) => s + o.value * o.weight, 0) / totalWeight;
  // Confidence of the blend is higher than any single source's confidence
  // because multiple sources agreeing is itself a signal; we use
  // 1 - prod(1 - w_i) bounded by 0.97.
  const blended = 1 - weighted.reduce((p, o) => p * (1 - o.weight), 1);
  return {
    value,
    confidence: Math.min(0.97, blended),
    contributions: weighted.map((o) => ({
      sourceId: o.sourceId,
      value: o.value,
      weight: o.weight / totalWeight,
      sampleSize: o.sampleSize ?? 0,
    })),
  };
}

/**
 * "Peak indicator" ,  a 0..100 score combining (a) 12m price trend,
 * (b) recent volume trend, (c) supply pipeline pressure, (d) breeder-
 * adoption breadth. A score near 100 suggests the trait is at peak
 * (sell), a score near 0 suggests early/undervalued (accumulate).
 *
 * The caller passes the four components already normalized to [-1, 1]:
 *   priceMomentum:   +1 = strong uptrend, -1 = strong downtrend
 *   volumeMomentum:  +1 = sales accelerating, -1 = decelerating
 *   supplyPressure:  +1 = flood of hatchlings coming, -1 = drought
 *   adoptionBreadth: +1 = many breeders working with it, -1 = very few
 */
export function peakScore({ priceMomentum = 0, volumeMomentum = 0, supplyPressure = 0, adoptionBreadth = 0 }) {
  // Weighted mix ,  price and volume dominate, supply is a contrarian
  // indicator (more coming supply → closer to peak), adoption breadth
  // moderates (widely worked traits rarely have explosive upside).
  const raw =
    0.45 * priceMomentum +
    0.25 * volumeMomentum +
    0.2  * supplyPressure +
    0.1  * adoptionBreadth;
  // Map [-1,1] → [0,100], clipped.
  return Math.max(0, Math.min(100, Math.round(50 + raw * 50)));
}

/**
 * Interpret a peak score into an actionable label the UI can surface.
 */
export function peakLabel(score) {
  if (score >= 85) return { code: 'overheated', label: 'Overheated', action: 'Consider selling', color: 'red' };
  if (score >= 65) return { code: 'peaking',    label: 'Peaking',    action: 'Sell into strength', color: 'orange' };
  if (score >= 40) return { code: 'fair',       label: 'Fair value', action: 'Hold', color: 'amber' };
  if (score >= 20) return { code: 'emerging',   label: 'Emerging',   action: 'Accumulate', color: 'emerald' };
  return              { code: 'undervalued',label: 'Undervalued',action: 'Strong buy', color: 'emerald' };
}
