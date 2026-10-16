import { useEffect, useMemo, useState } from 'react';
import { MorphGuide } from '@/entities/MorphGuide';
// Loaded on first use, not with the page (src/lib/supabaseLazy.js).
import { getSupabase } from '@/lib/supabaseLazy';
import { fetchHeroAnchorPhotos } from '@/lib/publicGeckoPhotos';
import { morphSlug, pickBestMorphRecord } from '@/lib/morphUtils';
import { MORPHS } from '@/data/morph-guide';

/**
 * Photos and database rows for the Morph Guide index and hub pages.
 *
 * The pages render straight away from the local MORPHS list (the text,
 * genetics, rarity and prices all live in the bundle). Photos come from
 * Supabase and are merged in when they arrive, so a slow or failed network
 * never leaves the visitor looking at skeleton boxes.
 *
 * The three requests run in parallel, once per browser session: the result
 * is kept in a module-level cache so moving between the index and the
 * category hubs does not fetch the same photos again.
 */

const EMPTY = { dbRecords: [], communityImages: [], heroAnchors: [], loaded: false };

let cache = null;
let inflight = null;

async function fetchMorphGuideData() {
  const [db, community, heroes] = await Promise.allSettled([
    MorphGuide.list(),
    // Reviewed member photos tagged with a morph; see MorphDetail for why
    // only verified photos with an owner are used.
    getSupabase().then((supabase) => supabase
      .from('gecko_images')
      .select('image_url, primary_morph')
      .not('primary_morph', 'is', null)
      .not('image_url', 'is', null)
      .eq('verified', true)
      .not('owner_profile_id', 'is', null)
      .limit(500)),
    // Show-winner photos. The public function returns the image and
    // caption only. It does not select the JSON column that can hold
    // a reviewer email. If that function is not applied yet, this
    // resolves to an empty list and the curated image plus the
    // community pool still fill the card.
    getSupabase().then((supabase) => fetchHeroAnchorPhotos(supabase, 200)),
  ]);

  const rows = (r) => {
    if (r.status !== 'fulfilled') return [];
    const v = r.value;
    if (Array.isArray(v)) return v;
    return Array.isArray(v?.data) ? v.data : [];
  };

  return {
    dbRecords: rows(db),
    communityImages: rows(community),
    heroAnchors: rows(heroes),
    loaded: true,
  };
}

function loadOnce() {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetchMorphGuideData()
      .then((data) => {
        cache = data;
        return data;
      })
      .catch((err) => {
        console.error('Morph guide photo fetch failed:', err);
        return { ...EMPTY, loaded: true };
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Skip known-broken external images.
export function sanitizeImage(url) {
  if (!url) return null;
  if (
    url.includes('ytimg.com') ||
    url.includes('altitudeexotics.com') ||
    url.endsWith('.html')
  ) {
    return null;
  }
  return url;
}

// Lower-case and collapse separators so 'Extreme Harlequin' and
// 'extreme_harlequin' both map to 'extreme harlequin'. Used to match
// hero-anchor rows (snake_case canonical ids) against MORPHS names.
export function normMorph(s) {
  return (s || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

/**
 * Raw rows from Supabase, starting empty and filling in once the requests
 * settle. `loaded` turns true even when every request failed.
 */
export function useMorphGuideRows() {
  const [data, setData] = useState(cache || EMPTY);
  useEffect(() => {
    if (cache) return undefined;
    let cancelled = false;
    loadOnce().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}

/**
 * Local MORPHS merged with the photo sources. Image priority per morph:
 * show-winner photo, then the curated morph_guides image, then the
 * community pool. Database rows that have no local entry are appended so
 * community additions still show up.
 *
 * Returns the lookup maps too, so the Project Lines tab can match its own
 * photos against the same data.
 */
export function useMorphGuideData() {
  const { dbRecords, communityImages, heroAnchors, loaded } = useMorphGuideRows();

  const aliasToSlug = useMemo(() => {
    const map = {};
    for (const m of MORPHS) {
      map[m.slug] = m.slug;
      for (const alias of m.aliases || []) {
        const s = morphSlug(alias);
        if (s && !map[s]) map[s] = m.slug;
      }
    }
    return map;
  }, []);

  const dbBySlug = useMemo(() => {
    const bySlug = {};
    for (const r of dbRecords) {
      const rawSlug = morphSlug(r.morph_name);
      if (!rawSlug) continue;
      const slug = aliasToSlug[rawSlug] || rawSlug;
      (bySlug[slug] ||= []).push(r);
    }
    const out = {};
    for (const [slug, records] of Object.entries(bySlug)) {
      out[slug] = pickBestMorphRecord(records);
    }
    return out;
  }, [dbRecords, aliasToSlug]);

  // Bucket community photos by normalized morph tag and individual words
  // (for single-word morph names) so multi-word morphs like Extreme Brindle
  // or Super Soft Scale only match photos of that exact morph.
  const communityByKeyword = useMemo(() => {
    const buckets = {};
    for (const img of communityImages) {
      const norm = normMorph(img.primary_morph);
      if (!norm || !img.image_url) continue;
      (buckets[norm] ||= []).push(img.image_url);
      for (const word of norm.split(/\s+/).filter(Boolean)) {
        if (word !== norm) (buckets[`word:${word}`] ||= []).push(img.image_url);
      }
    }
    return buckets;
  }, [communityImages]);

  // First by recency wins (the query is already ordered).
  const heroByNorm = useMemo(() => {
    const map = new Map();
    for (const h of heroAnchors) {
      const key = normMorph(h.primary_morph);
      if (key && !map.has(key)) map.set(key, h);
    }
    return map;
  }, [heroAnchors]);

  const allMorphs = useMemo(() => {
    // Cap at 6 photos per morph: plenty for a rotating preview.
    const community = (name) => {
      const norm = normMorph(name);
      if (!norm) return [];
      const exact = communityByKeyword[norm] || [];
      if (norm.includes(' ')) return exact.slice(0, 6);
      const wordMatches = communityByKeyword[`word:${norm}`] || [];
      return [...exact, ...wordMatches].slice(0, 6);
    };
    const merged = MORPHS.map((m) => {
      const dbMatch = dbBySlug[m.slug];
      const dbImg = sanitizeImage(dbMatch?.example_image_url);
      const hero = heroByNorm.get(normMorph(m.name));
      const heroImg = hero?.image_url ? sanitizeImage(hero.image_url) : null;
      const heroImages = [heroImg, dbImg, ...community(m.name)].filter(Boolean);
      return {
        ...m,
        heroImage: heroImages[0] || null,
        heroImages,
        heroPhotoCredit: hero?.photo_credit || null,
        heroGeckoName: hero?.gecko_name || null,
        heroAward: hero?.award || null,
        isHeroAnchor: Boolean(heroImg),
        dbDescription: dbMatch?.description,
        keyFeaturesDb: dbMatch?.key_features,
      };
    });
    return merged;
  }, [dbBySlug, communityByKeyword, heroByNorm]);

  return { allMorphs, dbBySlug, communityByKeyword, heroByNorm, loaded };
}
