import { createClient } from '@supabase/supabase-js';

/**
 * Read-only public projections of the shared geck_data schema, hosted in the
 * main Supabase project. Eye in the Sky supplies listing observations;
 * Geck Intellect analyzes them. This client consumes reference images and
 * inventory counts. Imported inventory is not a verified training corpus.
 *
 * VITE_GECK_DATA_SUPABASE_URL / VITE_GECK_DATA_SUPABASE_ANON_KEY can override
 * the default shared project. Helpers return { data, error } for partial UI.
 */
export const CRESTED_SPECIES = 'Correlophus ciliatus';

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

function normMorph(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/**
 * Fetch reference images for a named morph from the curated
 * external_reference_images table, with source/license metadata as stored.
 * Returns up to `limit` rows, each shaped { url, source, license,
 * attribution, source_url }.
 *
 * It used to top up with marketplace listing photos (market_listings joined
 * to listing_images). Those are third-party photos with no licence, shown on
 * public Morph Guide pages, so the top-up was removed on 13 Oct 2026 and the
 * listing tables are members-only (docs/DECISIONS.md, decision 44).
 */
export async function getMorphReferenceImages(morphName, { limit = 24, species = CRESTED_SPECIES } = {}) {
  if (!geckData) return { data: [], error: 'geck-data anon key not configured' };
  if (!morphName) return { data: [], error: 'morphName required' };

  const norm = normMorph(morphName);
  try {
    const { data: external, error: eErr } = await geckData
      .from('external_reference_images')
      .select('image_url, storage_path, storage_bucket, license, attribution, source_kind, source_url')
      .eq('species', species)
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

    return { data: out.slice(0, limit), error: null };
  } catch (e) {
    return { data: [], error: e.message ?? String(e) };
  }
}

/**
 * Fetch the canonical morph taxonomy entry for a named morph (description,
 * inheritance, source URL). Returns null if no row exists.
 */
export async function getMorphTaxonomy(morphName, species = CRESTED_SPECIES) {
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
