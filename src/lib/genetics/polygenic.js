/**
 * Polygenic expression bands.
 *
 * Harlequin pattern, Pinstripe coverage, Dalmatian spotting, and Tiger
 * banding do not follow Punnett squares; respected breeders reason
 * about them as "best to best raises the odds, guarantees nothing."
 * This module encodes exactly that reasoning: per-parent expression
 * scores (0-100) in, a QUALITATIVE likelihood band out. Never a
 * percentage; a percentage here would be fake precision, which is the
 * fastest way to lose serious breeders' trust.
 *
 * The visual language downstream is deliberately different from the
 * probability chips: expression renders as meters, chance renders as
 * eggs and percents, because "95% pinstripe" (physical coverage) and
 * "66% het" (probability) are the two most-confused numbers in crested
 * gecko listings.
 */

export const POLYGENIC_LOOKS = [
  { id: 'harlequin', label: 'Harlequin pattern' },
  { id: 'pinstripe', label: 'Pinstripe coverage' },
  { id: 'dalmatian', label: 'Dalmatian spotting' },
  { id: 'tiger', label: 'Tiger / Brindle banding' },
];

/**
 * Rough expression scores from morph tags, for collection-mode parents
 * whose polygenic looks are recorded as tags rather than sliders.
 */
export function scoresFromTags(tags) {
  const t = (tags || []).map((x) => String(x).toLowerCase());
  const has = (s) => t.some((x) => x.includes(s));
  return {
    harlequin: has('extreme harlequin') ? 85 : has('harlequin') ? 60 : has('flame') ? 35 : 0,
    pinstripe: has('partial pinstripe') ? 40 : has('pinstripe') ? 75 : 0,
    dalmatian: has('super dalmatian') ? 85 : has('dalmatian') ? 55 : 0,
    tiger: has('brindle') ? 80 : has('tiger') ? 60 : 0,
  };
}

/**
 * Band for one polygenic look given both parents' scores.
 * Returns { band, headline, detail } with plain-language copy.
 */
export function expressionBand(a, b) {
  const sireScore = Math.max(0, Math.min(100, a || 0));
  const damScore = Math.max(0, Math.min(100, b || 0));
  const mid = (sireScore + damScore) / 2;
  const spreadWide = Math.abs(sireScore - damScore) >= 40;

  let band;
  let headline;
  if (mid >= 70) {
    band = 'high';
    headline = 'most offspring likely strong';
  } else if (mid >= 45) {
    band = 'mid-high';
    headline = 'most offspring likely mid to high';
  } else if (mid >= 25) {
    band = 'moderate';
    headline = 'a moderate range is typical';
  } else if (mid > 0) {
    band = 'light';
    headline = 'light expression is typical';
  } else {
    band = 'none';
    headline = 'unlikely to express strongly';
  }

  const detail = spreadWide
    ? 'The parents differ widely, so expect a broad spread; standouts in either direction are normal.'
    : 'Extremes in both directions are possible; lineage history tightens this more than any single pairing.';

  return { band, mid, headline, detail };
}
