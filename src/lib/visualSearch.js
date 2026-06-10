/**
 * Visual similarity search over the gecko_images embedding index.
 *
 * findSimilar(imageUrl) wraps the similar_gecko_images_by_url RPC, which
 * returns the nearest gecko_images rows by embedding distance (excluding
 * the queried URL itself). The RPC returns zero rows when the queried URL
 * has no embedding yet, so on a miss we look up the gecko_images row for
 * that URL, ask the embed-gecko-image edge function to generate and
 * persist its embedding (request: { imageUrl, geckoImageId }), then retry
 * the RPC once.
 *
 * Failures degrade to an empty result list, never a thrown error: the UI
 * treats "no matches" and "embedding unavailable" the same way.
 */
import { supabase } from '@/lib/supabaseClient';

async function queryRpc(imageUrl, count) {
  const { data, error } = await supabase.rpc('similar_gecko_images_by_url', {
    p_image_url: imageUrl,
    match_count: count,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Ensures the gecko_images row for this URL has an embedding.
 * Returns true when an embedding was generated and persisted.
 */
async function embedOnMiss(imageUrl) {
  // The edge function only persists when given the row id, and persistence
  // is what makes the retry RPC see the embedding. No row, no index entry.
  const { data: row, error: lookupError } = await supabase
    .from('gecko_images')
    .select('id')
    .eq('image_url', imageUrl)
    .maybeSingle();
  if (lookupError || !row?.id) return false;

  const { data, error } = await supabase.functions.invoke('embed-gecko-image', {
    body: { imageUrl, geckoImageId: row.id },
  });
  if (error) return false;
  return Boolean(data?.persisted);
}

/**
 * Finds gecko images that look like the one at imageUrl.
 *
 * @param {string} imageUrl - URL of a gecko_images photo to match against.
 * @param {{ count?: number }} [options] - count caps the number of matches (default 8).
 * @returns {Promise<Array<{ id: string, image_url: string, primary_morph: string,
 *   secondary_traits: string[], base_color: string, created_by: string,
 *   similarity: number }>>} Nearest matches, or [] when none / embedding unavailable.
 */
export async function findSimilar(imageUrl, { count = 8 } = {}) {
  if (!imageUrl) return [];

  const matches = await queryRpc(imageUrl, count);
  if (matches.length > 0) return matches;

  // Zero rows usually means this image has no embedding yet. Generate one,
  // then retry exactly once. If embedding fails, settle for the empty state.
  let embedded = false;
  try {
    embedded = await embedOnMiss(imageUrl);
  } catch {
    return [];
  }
  if (!embedded) return [];

  try {
    return await queryRpc(imageUrl, count);
  } catch {
    return [];
  }
}
