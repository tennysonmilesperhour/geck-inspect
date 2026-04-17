/**
 * Morph guide helpers.
 *
 * The `morph_guides` table contains multiple records for many morphs
 * (the result of Base44 letting different users add their own versions).
 * These helpers canonicalize morph names into URL slugs, turn a slug
 * back into a display name, and pick the "best" record when multiple
 * rows describe the same morph.
 */

/**
 * Turn a morph name into a URL slug.
 *   morphSlug('Harlequin')              → 'harlequin'
 *   morphSlug('Extreme Harlequin')      → 'extreme-harlequin'
 *   morphSlug('Hypo (Hypomelanistic)')  → 'hypo'
 *   morphSlug('Tiger / Brindle')        → 'tiger-brindle'
 *   morphSlug('Lilly White')            → 'lilly-white'
 */
export function morphSlug(name) {
  if (!name) return null;
  const slug = name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, ' ')  // strip "(Hypomelanistic)" etc.
    .replace(/\s*\/\s*/g, ' ')        // "Tiger / Brindle" → "tiger brindle"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

/**
 * Reverse: pretty-print a slug back into a display name. Good enough
 * when we don't have the original DB row handy.
 *   morphDisplayName('extreme-harlequin') → 'Extreme Harlequin'
 */
export function morphDisplayName(slug) {
  if (!slug) return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Given an array of morph_guides rows that describe the same morph,
 * pick the most useful one to render. Preference order:
 *   1. Has example_image_url that isn't obviously broken
 *   2. Has the longest description
 *   3. Has key_features
 */
export function pickBestMorphRecord(records) {
  if (!records || records.length === 0) return null;
  if (records.length === 1) return records[0];

  const score = (r) => {
    let s = 0;
    const img = r.example_image_url || '';
    const imgOk =
      img &&
      !img.includes('ytimg.com') &&
      !img.includes('altitudeexotics.com') &&
      !img.endsWith('.html');
    if (imgOk) s += 100;
    s += Math.min(50, (r.description || '').length / 10);
    s += Math.min(20, (r.key_features?.length || 0) * 2);
    s += (r.breeding_info || '').length > 0 ? 10 : 0;
    return s;
  };

  return [...records].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Dedupe an array of morph records by slug, keeping the best row per slug.
 * Returns an object keyed by slug for O(1) lookup.
 */
export function indexMorphsBySlug(records) {
  const bySlug = {};
  for (const r of records || []) {
    const slug = morphSlug(r.morph_name);
    if (!slug) continue;
    (bySlug[slug] ||= []).push(r);
  }
  const out = {};
  for (const [slug, rows] of Object.entries(bySlug)) {
    out[slug] = pickBestMorphRecord(rows);
  }
  return out;
}

/**
 * Canonical slug list used for sitemap generation and cross-linking.
 * Matches the actual morphs in the database as of migration time. If
 * you add new morph_guides records, add slugs here so they appear in
 * the static sitemap too.
 */
export const KNOWN_MORPH_SLUGS = [
  'axanthic',
  'bicolor',
  'brindle',
  'buckskin',
  'cappuccino',
  'chocolate',
  'dalmatian',
  'extreme-brindle',
  'extreme-harlequin',
  'flame',
  'frappuccino',
  'harlequin',
  'hypo',
  'lavender',
  'lilly-white',
  'moonglow',
  'olive',
  'orange-base',
  'patternless',
  'phantom-pinstripe',
  'pinstripe',
  'red-base',
  'soft-scale',
  'super-dalmatian',
  'super-soft-scale',
  'tiger',
  'tiger-brindle',
  'translucent',
  'tricolor',
  'white-wall',
  'white-wall-white-spot',
  'yellow-base',
];
