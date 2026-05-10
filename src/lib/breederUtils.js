/**
 * Breeder attribution helpers.
 *
 * Base44 stored the breeder a gecko came from as free-text in
 * `geckos.sire_name` / `geckos.dam_name` / `geckos.notes`. These helpers
 * turn those messy strings into a normalized slug so we can:
 *
 *   1. Link to a public /Breeder?slug=... page
 *   2. Find every gecko in the DB attributed to a given breeder
 *   3. Render a pretty display name from a slug in the URL
 *
 * There is no `breeders` table yet ,  attribution is derived at query
 * time. When we eventually add a normalized table, this module is the
 * only place we'll need to update the mapping logic.
 */

// Strip common TLDs, protocol prefixes, and trailing dots/slashes so
// "Altitudeexotics.com" and "altitude exotics" map to the same key.
function stripChrome(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .replace(/\.(com|net|org|co|io|app|shop|store|us|gg)\b.*$/, '');
}

/**
 * Pretty, URL-safe slug with dashes. Use this in links / URL params.
 *   breederSlug('Altitude Exotics')    → 'altitude-exotics'
 *   breederSlug('Altitudeexotics.com') → 'altitudeexotics'
 */
export function breederSlug(name) {
  if (!name) return null;
  const stripped = stripChrome(name);
  const slug = stripped
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

/**
 * Fully alphanumeric canonical form ,  used to match two variants of the
 * same breeder name that differ only in punctuation/spacing.
 *   breederCanonical('Altitude Exotics')    → 'altitudeexotics'
 *   breederCanonical('Altitudeexotics.com') → 'altitudeexotics'
 */
export function breederCanonical(name) {
  if (!name) return null;
  const canon = stripChrome(name).replace(/[^a-z0-9]/g, '');
  return canon || null;
}

/**
 * Best-effort reverse: turn a dash-separated slug back into a display
 * name. For the current crop of breeder references this produces a
 * reasonable Title Case label (e.g. 'altitude-exotics' → 'Altitude
 * Exotics'). Swap this for a real lookup once we have a breeders table.
 */
export function breederDisplayName(slug) {
  if (!slug) return '';
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Decide whether a free-text sire_name / dam_name looks like it's
 * referring to a breeder (a kennel, website, company) rather than an
 * individual gecko. Heuristics:
 *   - Contains a TLD ('.com', '.net', etc.)         → breeder
 *   - Has multiple capitalized words                → probably breeder
 *   - Is a single word / all lowercase              → probably a gecko name
 *
 * Only used for deciding whether to render a link in GeckoDetail; the
 * page itself doesn't depend on this being perfect.
 */
export function looksLikeBreederName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;
  if (/\.(com|net|org|co|io|app|shop|store|us|gg)\b/i.test(trimmed)) return true;
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    const capitalized = words.filter((w) => /^[A-Z]/.test(w)).length;
    if (capitalized >= 2) return true;
  }
  return false;
}
