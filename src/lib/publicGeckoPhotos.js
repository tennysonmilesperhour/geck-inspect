/**
 * Photos the Morph Guide and project line pages may load while signed out.
 *
 * gecko_images.training_meta can hold a reviewer email, and
 * 20261003220100_anon_hide_owner_email_columns.sql takes that column
 * away from anon. These helpers never select it. Show-winner captions
 * come from public.public_gecko_photos, which returns only the image
 * and three caption fields. Until that function is applied, the pages
 * still load photos from columns anon is allowed to read.
 */
import { GECKO_IMAGE_PUBLIC_COLUMNS } from '@/lib/publicColumns';

/** Columns on gecko_images that a signed-out photo strip may select. */
export const PUBLIC_GECKO_PHOTO_COLUMNS = 'image_url, primary_morph, created_date';

const PHOTO_COLUMN_SET = new Set(PUBLIC_GECKO_PHOTO_COLUMNS.split(', '));

export function publicPhotoColumnsAreGranted() {
  return [...PHOTO_COLUMN_SET].every((column) => GECKO_IMAGE_PUBLIC_COLUMNS.includes(column));
}

function cleanPhrase(value) {
  return String(value || '').trim().replace(/[%_]/g, '');
}

/**
 * Show-winner photos (verification_tier hero_anchor), newest first.
 * Returns [] when the function is not installed yet. Callers then use
 * the curated morph image and the community pool, which do not need
 * this function.
 */
export async function fetchHeroAnchorPhotos(client, limit = 200) {
  const { data, error } = await client.rpc('public_gecko_photos', {
    p_kind: 'hero',
    p_query: null,
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];
  return data;
}

/**
 * Keyword match for a project line photo strip.
 * Uses the public function when it exists, so captions can come back
 * without training_meta. Otherwise selects only the granted photo columns.
 */
export async function fetchProjectLinePhotos(client, keyword, limit = 8) {
  const phrase = cleanPhrase(keyword);
  if (!phrase) return [];

  const { data, error } = await client.rpc('public_gecko_photos', {
    p_kind: 'search',
    p_query: phrase,
    p_limit: limit,
  });
  if (!error && Array.isArray(data)) {
    return data.map((row) => ({
      url: row.image_url,
      primaryMorph: row.primary_morph,
      credit: row.photo_credit || null,
      geckoName: row.gecko_name || null,
    }));
  }

  const { data: rows, error: fallbackError } = await client
    .from('gecko_images')
    .select(PUBLIC_GECKO_PHOTO_COLUMNS)
    .not('image_url', 'is', null)
    .ilike('primary_morph', `%${phrase}%`)
    .limit(limit);
  if (fallbackError || !Array.isArray(rows)) return [];
  return rows.map((row) => ({
    url: row.image_url,
    primaryMorph: row.primary_morph,
    credit: null,
    geckoName: null,
  }));
}
