/**
 * Which outside photo licences Geck Inspect may show.
 *
 * Geck Inspect is a commercial service (paid plans), so a photo under a
 * NonCommercial licence (CC BY-NC, CC BY-NC-SA) cannot be shown on it, and
 * a photo with no licence at all cannot be shown either. In October 2026
 * 28 of the 30 crested gecko reference photos in
 * geck_data.external_reference_images were NonCommercial (26 CC BY-NC,
 * 2 CC BY-NC-SA); only 2 were CC BY. The 12 rows with no licence are
 * leopard gecko pictures that the crested pages never read.
 *
 * Allowed: public domain (CC0, PDM), CC BY and CC BY-SA. Each of these
 * allows commercial use as long as the photographer is credited, so every
 * photo shown carries its credit and licence under it. NoDerivatives
 * licences are left out because the page crops photos to squares.
 */

const ALLOWED = new Set(['cc0', 'pdm', 'public-domain', 'cc-by', 'cc-by-sa']);

/**
 * Licence strings as stored by the importer (iNaturalist style). The
 * database's read policy allows exactly this list too
 * (supabase/migrations/20261016090400_ux.sql), so an older app copy or a
 * direct API call cannot fetch the others; a test keeps the two equal.
 */
export const COMMERCIAL_USE_LICENSES = ['cc0', 'cc-by', 'cc-by-sa', 'pdm'];

export function normaliseLicense(license) {
  return String(license || '')
    .trim()
    .toLowerCase()
    .replace(/\s+\d+(\.\d+)?$/, '') // "CC BY 4.0" -> "cc by"
    .replace(/[\s_]+/g, '-');
}

export function isCommercialUseLicense(license) {
  const key = normaliseLicense(license);
  if (!key) return false;
  return ALLOWED.has(key);
}

const LICENSE_LINKS = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/',
  pdm: 'https://creativecommons.org/publicdomain/mark/1.0/',
  'cc-by': 'https://creativecommons.org/licenses/by/4.0/',
  'cc-by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

const LICENSE_NAMES = {
  cc0: 'CC0',
  pdm: 'Public domain',
  'public-domain': 'Public domain',
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
};

/** { name, url } for showing the licence next to a photo. */
export function licenseLabel(license) {
  const key = normaliseLicense(license);
  return { name: LICENSE_NAMES[key] || String(license || ''), url: LICENSE_LINKS[key] || null };
}
