import { createClient } from '@supabase/supabase-js';

/**
 * geck-data Supabase client.
 *
 * Read-only public access to the geck-data project (the standalone Market
 * Intelligence app at geckintellect.geckinspect.com / geck-data.vercel.app).
 * That project ingests the Eye in the Sky extension's events plus the
 * external reference image importers (iNaturalist, Leopard Gecko Wiki,
 * ReptiDex). We hit it directly from the browser using its anon key; RLS on
 * the relevant tables (market_listings, listing_images,
 * external_reference_images, morph_taxonomy) exposes them as public-read.
 *
 * Environment:
 *   VITE_GECK_DATA_SUPABASE_URL       (optional, defaults to the prod project)
 *   VITE_GECK_DATA_SUPABASE_ANON_KEY  (optional, defaults to the published anon key)
 *
 * Failures here should NOT take down the page that uses them. Every helper
 * below returns a `{ data, error }` object so the caller can render an
 * empty state instead of throwing.
 */

const URL =
  import.meta.env.VITE_GECK_DATA_SUPABASE_URL ||
  'https://mmuglfphhwlaluyfyxsp.supabase.co';

const ANON_KEY =
  import.meta.env.VITE_GECK_DATA_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';

const fetchWithTimeout = (url, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
};

export const geckData = ANON_KEY
  ? createClient(URL, ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchWithTimeout },
    })
  : null;

/**
 * Counts of training-relevant rows in geck-data. Used by TrainModel to show
 * how much labeled inventory is available beyond the local base44 stores.
 */
export async function getGeckDataTrainingStats() {
  if (!geckData) {
    return { data: null, error: 'geck-data anon key not configured' };
  }
  try {
    const [listingImages, externalRefs, taxonomy, listings] = await Promise.all([
      geckData.from('listing_images').select('id', { count: 'exact', head: true }),
      geckData.from('external_reference_images').select('id', { count: 'exact', head: true }),
      geckData.from('morph_taxonomy').select('id', { count: 'exact', head: true }),
      geckData.from('market_listings').select('id', { count: 'exact', head: true }),
    ]);
    return {
      data: {
        listing_images: listingImages.count ?? 0,
        external_reference_images: externalRefs.count ?? 0,
        morph_taxonomy: taxonomy.count ?? 0,
        market_listings: listings.count ?? 0,
      },
      error: null,
    };
  } catch (e) {
    return { data: null, error: e.message ?? String(e) };
  }
}

function normMorph(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Fetch reference images for a named morph. Pulls from the curated
 * external_reference_images table first (Leopard Gecko Wiki + breeder
 * partnerships, all licensed); supplements with listing_images joined to
 * market_listings whose cached_traits include the morph name. Returns up to
 * `limit` rows, each shaped { url, source, license, attribution, source_url }.
 */
export async function getMorphReferenceImages(morphName, { limit = 24 } = {}) {
  if (!geckData) return { data: [], error: 'geck-data anon key not configured' };
  if (!morphName) return { data: [], error: 'morphName required' };

  const norm = normMorph(morphName);
  try {
    const { data: external, error: eErr } = await geckData
      .from('external_reference_images')
      .select('image_url, storage_path, storage_bucket, license, attribution, source_kind, source_url')
      .eq('norm_morph_label', norm)
      .limit(limit);
    if (eErr) return { data: [], error: eErr.message };

    const out = (external ?? []).map((row) => ({
      url: row.storage_path
        ? `${URL}/storage/v1/object/public/${row.storage_bucket || 'listing-images'}/${row.storage_path}`
        : row.image_url,
      source: row.source_kind,
      license: row.license,
      attribution: row.attribution,
      source_url: row.source_url,
    }));

    if (out.length >= limit) return { data: out.slice(0, limit), error: null };

    // Top up with listing-derived images that mention the morph in their
    // cached traits. We use a pattern match because cached_traits is
    // free text; PostgREST `ilike` keeps the round trip tiny.
    const remaining = limit - out.length;
    const { data: listings, error: lErr } = await geckData
      .from('market_listings')
      .select('id, title, cached_traits, listing_images(image_url, storage_path, storage_bucket)')
      .ilike('cached_traits', `%${morphName}%`)
      .limit(remaining);
    if (lErr) return { data: out, error: lErr.message };

    for (const row of listings ?? []) {
      const imgs = Array.isArray(row.listing_images) ? row.listing_images : [];
      for (const img of imgs) {
        out.push({
          url: img.storage_path
            ? `${URL}/storage/v1/object/public/${img.storage_bucket || 'listing-images'}/${img.storage_path}`
            : img.image_url,
          source: 'listing',
          license: null,
          attribution: row.title ?? null,
          source_url: null,
        });
        if (out.length >= limit) break;
      }
      if (out.length >= limit) break;
    }

    return { data: out, error: null };
  } catch (e) {
    return { data: [], error: e.message ?? String(e) };
  }
}

/**
 * Fetch the canonical morph taxonomy entry for a named morph (description,
 * inheritance, source URL). Returns null if no row exists.
 */
export async function getMorphTaxonomy(morphName, species = 'Eublepharis macularius') {
  if (!geckData) return { data: null, error: 'geck-data anon key not configured' };
  const norm = normMorph(morphName);
  try {
    const { data, error } = await geckData
      .from('morph_taxonomy')
      .select('canonical_name, inheritance, allele_group, description, source_kind, source_url, updated_at')
      .eq('species', species)
      .eq('norm_name', norm)
      .order('updated_at', { ascending: false })
      .limit(1);
    if (error) return { data: null, error: error.message };
    return { data: (data && data[0]) || null, error: null };
  } catch (e) {
    return { data: null, error: e.message ?? String(e) };
  }
}
