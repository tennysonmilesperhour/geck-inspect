/**
 * Clutch and season probability helpers for the genetics calculator.
 *
 * Crested geckos lay 2-egg clutches (occasionally 1), every 30-45 days,
 * across a roughly 8-month season, commonly 6-10 clutches per pairing
 * per year. Per-egg odds and season-level expectations are different
 * numbers and breeders think in both, so the calculator surfaces both.
 *
 * Risk-communication research (natural frequencies, icon arrays) says
 * to lead with expected counts over a fixed denominator rather than
 * bare percentages; these helpers produce those numbers.
 */

export const EGGS_PER_CLUTCH = 2;
export const DEFAULT_CLUTCHES_PER_SEASON = 8;
export const MAX_CLUTCHES_PER_SEASON = 10;

/** P(at least one success in n independent draws of probability p). */
export function pAtLeastOne(p, n) {
  if (p <= 0 || n <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - Math.pow(1 - p, n);
}

/** Expected number of successes in n draws. */
export function expectedCount(p, n) {
  return p * n;
}

/**
 * Eggs needed for `confidence` probability of at least one success.
 * Returns Infinity for p <= 0.
 */
export function eggsForConfidence(p, confidence = 0.9) {
  if (p <= 0) return Infinity;
  if (p >= 1) return 1;
  return Math.ceil(Math.log(1 - confidence) / Math.log(1 - p));
}

/**
 * Round an expected count for headline copy: one decimal under 1,
 * nearest half between 1 and 10, whole numbers above.
 */
export function roundExpected(x) {
  if (x < 1) return Math.round(x * 10) / 10;
  if (x < 10) return Math.round(x * 2) / 2;
  return Math.round(x);
}

/**
 * Nearest simple fraction label for a probability, or null when no
 * simple fraction is close enough to be honest (within ~1 point).
 * Punnett outcomes are always /2 /4 /8 /16 fractions, so weighted
 * poss-het mixes are the only inputs that miss.
 */
export function simpleFraction(p) {
  const candidates = [
    [1, 2], [1, 4], [3, 4], [1, 8], [3, 8], [5, 8], [7, 8],
    [1, 16], [3, 16], [5, 16], [7, 16], [9, 16], [11, 16], [13, 16], [15, 16],
    [1, 3], [2, 3], [1, 6], [1, 12],
  ];
  for (const [num, den] of candidates) {
    if (Math.abs(p - num / den) < 0.011) return `${num}/${den}`;
  }
  return null;
}

/** Format a probability as a percent string with sensible precision. */
export function pct(p) {
  const v = p * 100;
  if (v > 0 && v < 1) return v.toFixed(1) + '%';
  if (Math.abs(v - Math.round(v)) > 0.05) return v.toFixed(1) + '%';
  return Math.round(v) + '%';
}

/**
 * Deterministic scatter of `hits` marks across `total` egg slots so an
 * icon array shows outcomes dispersed, not blocked together. Seeded by
 * `seed` so the layout is stable for a given outcome but reshuffles
 * when the seed changes (research: randomized dispersion improves how
 * accurately people read the odds).
 */
export function scatterHits(total, hits, seed = 1) {
  const idx = Array.from({ length: total }, (_, i) => i);
  let s = seed >>> 0 || 1;
  const rand = () => {
    // xorshift32, deterministic and dependency-free
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const set = new Set(idx.slice(0, hits));
  return Array.from({ length: total }, (_, i) => set.has(i));
}
