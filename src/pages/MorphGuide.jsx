import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MorphGuide } from '@/entities/MorphGuide';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search, BookOpen, Filter, Dna, Sparkles, ArrowRight, Info,
  ShieldCheck, GitBranch,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { supabase } from '@/lib/supabaseClient';
import { morphSlug, pickBestMorphRecord } from '@/lib/morphUtils';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import {
  MORPHS,
  MORPH_CATEGORIES,
  INHERITANCE,
  RARITY,
} from '@/data/morph-guide';
import { PROJECT_LINES, LINE_CONFIDENCE, lineImageKeywords } from '@/data/project-lines';
import RotatingMorphImage from '@/components/morphguide/RotatingMorphImage';

// DefinedTermSet treats the morph guide as a controlled vocabulary for
// AI assistants ,  every morph becomes a DefinedTerm that can be cited
// back ("the term 'Lilly White' as defined by Geck Inspect..."). The
// parallel ItemList preserves the ordered presentation for crawlers
// that prefer ItemList over DefinedTermSet, and links each entry to its
// canonical /MorphGuide/<slug> URL.
const MORPH_TERMS = MORPHS.map((m) => ({
  '@type': 'DefinedTerm',
  '@id': `https://geckinspect.com/MorphGuide/${m.slug}#term`,
  name: m.name,
  ...(Array.isArray(m.aliases) && m.aliases.length > 0 && { alternateName: m.aliases }),
  termCode: m.slug,
  url: `https://geckinspect.com/MorphGuide/${m.slug}`,
  description: m.summary || m.description || `${m.name} ,  crested gecko morph.`,
  inDefinedTermSet: { '@id': 'https://geckinspect.com/MorphGuide#termset' },
}));

const MORPH_GUIDE_JSON_LD = [
  {
    '@type': 'CollectionPage',
    '@id': 'https://geckinspect.com/MorphGuide#collection',
    name: 'Crested Gecko Morph Guide',
    url: 'https://geckinspect.com/MorphGuide',
    description:
      'Complete reference for crested gecko morphs covering base colors, color modifiers, pattern types, structural traits, and named combinations. Includes inheritance model (recessive / co-dominant / incomplete-dominant / polygenic / line-bred), rarity, price tier, and combination notes.',
    about: {
      '@type': 'Thing',
      name: 'Crested gecko',
      alternateName: 'Correlophus ciliatus',
      sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
    },
    isPartOf: { '@id': 'https://geckinspect.com/#website' },
    publisher: { '@id': 'https://geckinspect.com/#organization' },
    mainEntity: { '@id': 'https://geckinspect.com/MorphGuide#termset' },
  },
  {
    '@type': 'DefinedTermSet',
    '@id': 'https://geckinspect.com/MorphGuide#termset',
    name: 'Crested Gecko Morph Vocabulary',
    description:
      'Controlled vocabulary of named crested gecko morphs maintained by Geck Inspect ,  base colors, color modifiers, pattern types, structural traits, and named combinations, each with inheritance model and rarity.',
    url: 'https://geckinspect.com/MorphGuide',
    inLanguage: 'en-US',
    publisher: { '@id': 'https://geckinspect.com/#organization' },
    hasDefinedTerm: MORPH_TERMS,
  },
  {
    '@type': 'ItemList',
    '@id': 'https://geckinspect.com/MorphGuide#itemlist',
    name: 'Crested Gecko Morphs',
    numberOfItems: MORPHS.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: MORPHS.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://geckinspect.com/MorphGuide/${m.slug}`,
      name: m.name,
    })),
  },
  {
    '@type': 'BreadcrumbList',
    '@id': 'https://geckinspect.com/MorphGuide#breadcrumbs',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://geckinspect.com/' },
      { '@type': 'ListItem', position: 2, name: 'Morph Guide', item: 'https://geckinspect.com/MorphGuide' },
    ],
  },
];

// Skip known-broken external images.
function sanitizeImage(url) {
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

function MorphCard({ morph }) {
  const rarity = RARITY[morph.rarity] || RARITY.common;
  const inh = INHERITANCE[morph.inheritance];
  const images = morph.heroImages && morph.heroImages.length > 0
    ? morph.heroImages
    : [morph.heroImage || DEFAULT_GECKO_IMAGE];
  return (
    <Link
      to={`/MorphGuide/${morph.slug}`}
      className="group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-emerald-500/50 hover:bg-slate-900 transition-all duration-200 flex flex-col"
    >
      <div className="aspect-[4/3] bg-slate-800 relative overflow-hidden">
        <RotatingMorphImage
          images={images}
          alt={`${morph.name} crested gecko morph`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${rarity.color}`}
          >
            {rarity.label}
          </span>
          <div className="flex items-center gap-1.5">
            {morph.isHeroAnchor && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-950/80 backdrop-blur-sm px-2 py-1 text-[10px] font-semibold text-emerald-200"
                title={morph.heroAward || 'Competition-winning reference photo'}
              >
                <span aria-hidden>★</span>
                {morph.heroAward || 'Show-winner'}
              </span>
            )}
            {morph.priceTier && (
              <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/70 px-2 py-1 text-[11px] font-semibold text-slate-300">
                {morph.priceTier}
              </span>
            )}
          </div>
        </div>
        {(morph.heroPhotoCredit || morph.heroGeckoName) && (
          <div className="absolute inset-x-0 bottom-0 px-3 py-1.5 text-[10px] leading-tight text-white/90">
            <div className="rounded-md bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-1">
              {morph.heroGeckoName && (
                <span className="font-medium">&ldquo;{morph.heroGeckoName}&rdquo;</span>
              )}
              {morph.heroGeckoName && morph.heroPhotoCredit && (
                <span className="text-white/50"> · </span>
              )}
              {morph.heroPhotoCredit && (
                <span className="text-white/80">{morph.heroPhotoCredit}</span>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 p-5 flex flex-col">
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
          {morph.name}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 flex-1">
          {morph.summary || morph.description || 'Crested gecko morph reference.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {inh && (
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${inh.color}`}
            >
              {inh.short}
            </span>
          )}
          {morph.priceRange && (
            <span className="text-[11px] text-slate-500">{morph.priceRange}</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
            Read
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function LineCard({ line }) {
  const confidence = LINE_CONFIDENCE[line.confidence] || LINE_CONFIDENCE['community-attributed'];
  const rarity = RARITY[line.rarity] || RARITY.uncommon;
  const hasImages = Array.isArray(line.heroImages) && line.heroImages.length > 0;
  return (
    <Link
      to={`/MorphGuide/lines/${line.slug}`}
      className="group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-violet-500/50 hover:bg-slate-900 transition-all duration-200 flex flex-col"
    >
      <div className="aspect-[4/3] bg-gradient-to-br from-violet-950/40 via-slate-900 to-slate-950 relative overflow-hidden flex items-center justify-center">
        {hasImages ? (
          <RotatingMorphImage
            images={line.heroImages}
            alt={`${line.name} crested gecko line reference`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
            </div>
            <GitBranch className="w-16 h-16 text-violet-500/40 group-hover:text-violet-400/60 transition-colors" />
          </>
        )}
        {hasImages && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent pointer-events-none" />
        )}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${confidence.color}`}
            title={confidence.description}
          >
            <ShieldCheck className="w-3 h-3" />
            {confidence.short}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${rarity.color}`}
          >
            {rarity.label}
          </span>
        </div>
      </div>
      <div className="flex-1 p-5 flex flex-col">
        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-violet-300 transition-colors">
          {line.name}
        </h3>
        {line.founder && (
          <p className="text-xs text-slate-500 mb-2 line-clamp-1">{line.founder}</p>
        )}
        <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 flex-1">
          {line.summary}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {line.priceRange && (
            <span className="text-[11px] text-slate-500">{line.priceRange}</span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-violet-400 group-hover:text-violet-300">
            Read
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function InheritanceLegend() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center gap-2 mb-3 text-slate-300">
        <Dna className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold uppercase tracking-wider">Inheritance models</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.values(INHERITANCE).map((i) => (
          <div
            key={i.id}
            className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2"
          >
            <span
              className={`mt-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${i.color}`}
            >
              {i.short}
            </span>
            <div className="text-[11px] text-slate-400 leading-snug">
              <span className="text-slate-200 font-semibold">{i.label}</span>
              <br />
              {i.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Lower-case + collapse separators so 'Extreme Harlequin' and
// 'extreme_harlequin' both map to 'extreme harlequin'. Used to match
// hero-anchor rows from gecko_images (snake_case canonical ids) against
// the MORPHS list (Title Case display names).
function normMorph(s) {
  return (s || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
}

export default function MorphGuidePage() {
  const [dbRecords, setDbRecords] = useState([]);
  const [communityImages, setCommunityImages] = useState([]);
  const [heroAnchors, setHeroAnchors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [inheritanceFilter, setInheritanceFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rarity_rare_first');
  const [isLoading, setIsLoading] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  // Top-level tab toggle: 'morphs' (default) | 'lines'. Synced with the
  // ?tab=lines query param so deep links from ProjectLineDetail land on
  // the correct tab.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('tab') === 'lines' ? 'lines' : 'morphs';
  const [view, setView] = useState(initialView);
  const [confidenceFilter, setConfidenceFilter] = useState('all');

  const setViewAndUrl = (next) => {
    setView(next);
    const next_params = new URLSearchParams(searchParams);
    if (next === 'lines') next_params.set('tab', 'lines');
    else next_params.delete('tab');
    setSearchParams(next_params, { replace: true });
  };

  const filteredLines = useMemo(() => {
    let list = [...PROJECT_LINES];
    if (confidenceFilter !== 'all') {
      list = list.filter((l) => l.confidence === confidenceFilter);
    }
    if (rarityFilter !== 'all') {
      list = list.filter((l) => l.rarity === rarityFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.aliases || []).some((a) => a.toLowerCase().includes(q)) ||
          (l.summary || '').toLowerCase().includes(q) ||
          (l.description || '').toLowerCase().includes(q) ||
          (l.founder || '').toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      // Verified first, then community, then disputed; tiebreak alphabetical.
      const order = { verified: 0, 'community-attributed': 1, disputed: 2 };
      const ai = order[a.confidence] ?? 3;
      const bi = order[b.confidence] ?? 3;
      return ai - bi || a.name.localeCompare(b.name);
    });
    return list;
  }, [confidenceFilter, rarityFilter, searchTerm]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await MorphGuide.list();
        setDbRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading morph guide:', err);
        setDbRecords([]);
      }
      setIsLoading(false);
    })();
  }, []);

  // Pull community gecko photos tagged with a primary_morph so we can
  // use them as card thumbnails when the morph_guides row doesn't have
  // its own example_image_url. Same source MorphDetail already uses for
  // its community gallery strip ,  just surfaced earlier on the list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('gecko_images')
          .select('image_url, primary_morph')
          .not('primary_morph', 'is', null)
          .not('image_url', 'is', null)
          .limit(500);
        if (!cancelled) setCommunityImages(data || []);
      } catch (err) {
        console.error('Community images fetch failed:', err);
        if (!cancelled) setCommunityImages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Pull HERO ANCHOR photos ,  competition / show-winner images flagged
  // with training_meta.verification_tier='hero_anchor'. These take
  // priority over morph_guides.example_image_url because they're the
  // gold-standard exemplar per morph, sourced from judged competitions.
  // Each carries photo_credit + gecko_name for attribution.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('gecko_images')
          .select('image_url, primary_morph, training_meta, created_date')
          .eq('verified', true)
          .not('primary_morph', 'is', null)
          .not('image_url', 'is', null)
          .filter('training_meta->>verification_tier', 'eq', 'hero_anchor')
          .order('created_date', { ascending: false })
          .limit(200);
        if (!cancelled) setHeroAnchors(data || []);
      } catch (err) {
        console.error('Hero anchor fetch failed:', err);
        if (!cancelled) setHeroAnchors([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Index DB records by slug for quick lookup.
  const dbBySlug = useMemo(() => {
    const bySlug = {};
    for (const r of dbRecords) {
      const slug = morphSlug(r.morph_name);
      if (!slug) continue;
      (bySlug[slug] ||= []).push(r);
    }
    const out = {};
    for (const [slug, records] of Object.entries(bySlug)) {
      out[slug] = pickBestMorphRecord(records);
    }
    return out;
  }, [dbRecords]);

  // Bucket community images by morph keyword (first word of morph name,
  // lower-cased). Uses the same matcher MorphDetail uses so coverage is
  // consistent between list and detail views.
  const communityByKeyword = useMemo(() => {
    const buckets = {};
    for (const img of communityImages) {
      const tag = (img.primary_morph || '').toLowerCase();
      if (!tag || !img.image_url) continue;
      // Index on every word in the tag so a "harlequin pinstripe" photo
      // falls under both "harlequin" and "pinstripe".
      for (const word of tag.split(/[\s/,]+/).filter(Boolean)) {
        (buckets[word] ||= []).push(img.image_url);
      }
    }
    return buckets;
  }, [communityImages]);

  function findCommunityImages(name) {
    if (!name) return [];
    const firstWord = name.toLowerCase().split(/\s+/)[0];
    // Cap at 6 images per morph ,  plenty for a rotating preview,
    // and keeps the DOM lightweight on morph-heavy pages.
    return (communityByKeyword[firstWord] || []).slice(0, 6);
  }

  // Index hero anchors by normalized morph name so each MORPHS entry can
  // look up its show-winner photo. First-by-recency wins (the query is
  // already ordered).
  const heroByNorm = useMemo(() => {
    const map = new Map();
    for (const h of heroAnchors) {
      const key = normMorph(h.primary_morph);
      if (!key) continue;
      if (!map.has(key)) map.set(key, h);
    }
    return map;
  }, [heroAnchors]);

  // Merge local + DB. Local morph-guide entries are the source of truth.
  // Image priority per card: hero_anchor (competition winner) >
  // morph_guides.example_image_url (curated DB) > community pool.
  // Any DB record not covered by the local dataset is appended as-is so
  // community additions still show up.
  const allMorphs = useMemo(() => {
    const localSlugs = new Set(MORPHS.map((m) => m.slug));
    const merged = MORPHS.map((m) => {
      const dbMatch = dbBySlug[m.slug];
      const dbImg = sanitizeImage(dbMatch?.example_image_url);
      const hero = heroByNorm.get(normMorph(m.name));
      const heroImg = hero?.image_url ? sanitizeImage(hero.image_url) : null;
      const communityImgs = findCommunityImages(m.name);
      // Stack hero anchor first (highest authority), then curated DB,
      // then community pool. Dedup happens inside RotatingMorphImage.
      const heroImages = [heroImg, dbImg, ...communityImgs].filter(Boolean);
      const photoCredit = hero?.training_meta?.photo_credit || null;
      const geckoName = hero?.training_meta?.gecko_name || null;
      const heroAward = hero?.training_meta?.award || null;
      return {
        ...m,
        heroImage: heroImages[0] || null,
        heroImages,
        heroPhotoCredit: photoCredit,
        heroGeckoName: geckoName,
        heroAward,
        isHeroAnchor: Boolean(heroImg),
        dbDescription: dbMatch?.description,
        keyFeaturesDb: dbMatch?.key_features,
      };
    });
    for (const [slug, rec] of Object.entries(dbBySlug)) {
      if (localSlugs.has(slug)) continue;
      const dbImg = sanitizeImage(rec.example_image_url);
      const communityImgs = findCommunityImages(rec.morph_name);
      const heroImages = dbImg ? [dbImg, ...communityImgs] : communityImgs;
      merged.push({
        slug,
        name: rec.morph_name,
        category: 'combo',
        inheritance: 'line-bred',
        rarity: rec.rarity || 'uncommon',
        summary: rec.description?.slice(0, 180),
        description: rec.description,
        keyFeatures: rec.key_features || [],
        heroImage: heroImages[0] || null,
        heroImages,
        priceTier: null,
        priceRange: null,
      });
    }
    return merged;
  }, [dbBySlug, communityByKeyword]);

  // Wire real images into each line by matching the line's name/aliases
  // against the same hero anchor, curated DB, and community pool data
  // already fetched for the morph grid. Intentionally does NOT fall back
  // to relatedMorphs, that would put the same generic harlequin photos
  // on every harlequin-adjacent line and mislead readers into thinking
  // each line had its own visual identity proven by those photos.
  // Must be declared AFTER dbBySlug/communityByKeyword/heroByNorm or it
  // hits a temporal-dead-zone error in production (minifier captures
  // them by reference; useMemo deps array evaluates immediately).
  const filteredLinesWithImages = useMemo(() => {
    return filteredLines.map((line) => {
      const keywords = lineImageKeywords(line);
      const imgs = [];
      for (const kw of keywords) {
        const firstWord = kw.split(' ')[0];
        const heroNorm = normMorph(kw);
        const hero = heroByNorm.get(heroNorm);
        if (hero?.image_url) {
          const safe = sanitizeImage(hero.image_url);
          if (safe && !imgs.includes(safe)) imgs.push(safe);
        }
        const dbMatch = dbBySlug[firstWord] || dbBySlug[heroNorm.replace(/\s+/g, '-')];
        const dbImg = sanitizeImage(dbMatch?.example_image_url);
        if (dbImg && !imgs.includes(dbImg)) imgs.push(dbImg);
        const community = communityByKeyword[firstWord] || [];
        for (const url of community) {
          const safe = sanitizeImage(url);
          if (safe && !imgs.includes(safe)) imgs.push(safe);
          if (imgs.length >= 6) break;
        }
        if (imgs.length >= 6) break;
      }
      return {
        ...line,
        heroImage: imgs[0] || null,
        heroImages: imgs,
      };
    });
  }, [filteredLines, communityByKeyword, heroByNorm, dbBySlug]);

  const filtered = useMemo(() => {
    let list = [...allMorphs];

    if (category !== 'all') {
      list = list.filter((m) => m.category === category);
    }
    if (inheritanceFilter !== 'all') {
      list = list.filter((m) => m.inheritance === inheritanceFilter);
    }
    if (rarityFilter !== 'all') {
      list = list.filter((m) => m.rarity === rarityFilter);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.aliases?.some((a) => a.toLowerCase().includes(q)) ||
          (m.summary || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q) ||
          (m.keyFeatures || []).some((f) => f.toLowerCase().includes(q)),
      );
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'alphabetical_desc':
          return b.name.localeCompare(a.name);
        case 'rarity_common_first':
          return (
            (RARITY[a.rarity]?.order || 5) - (RARITY[b.rarity]?.order || 5) ||
            a.name.localeCompare(b.name)
          );
        case 'price_low_first':
          return (
            (a.priceTier?.length || 9) - (b.priceTier?.length || 9) ||
            a.name.localeCompare(b.name)
          );
        case 'price_high_first':
          return (
            (b.priceTier?.length || 0) - (a.priceTier?.length || 0) ||
            a.name.localeCompare(b.name)
          );
        case 'rarity_rare_first':
        default:
          return (
            (RARITY[b.rarity]?.order || 0) - (RARITY[a.rarity]?.order || 0) ||
            a.name.localeCompare(b.name)
          );
      }
    });

    return list;
  }, [allMorphs, category, inheritanceFilter, rarityFilter, searchTerm, sortBy]);

  const categoryCounts = useMemo(() => {
    const c = { all: allMorphs.length };
    for (const cat of MORPH_CATEGORIES) {
      c[cat.id] = allMorphs.filter((m) => m.category === cat.id).length;
    }
    return c;
  }, [allMorphs]);

  return (
    <>
      <Seo
        title="Crested Gecko Morph Guide"
        description="Complete reference for crested gecko (Correlophus ciliatus) morphs ,  base colors, color modifiers, pattern types, structural traits, and named combinations. Inheritance models (recessive, co-dominant, incomplete-dominant, polygenic, line-bred), rarity, price tier, and combination notes for Harlequin, Pinstripe, Dalmatian, Lilly White, Axanthic, Cappuccino, Soft Scale, White Wall, and more."
        path="/MorphGuide"
        imageAlt="Crested gecko morph reference guide"
        keywords={[
          'crested gecko morph guide',
          'gecko morph list',
          'crestie morphs',
          'crested gecko genetics',
          'harlequin crested gecko',
          'extreme harlequin',
          'pinstripe gecko',
          'phantom pinstripe',
          'dalmatian gecko',
          'super dalmatian',
          'lilly white',
          'axanthic',
          'cappuccino',
          'frappuccino',
          'soft scale',
          'white wall',
          'flame crested gecko',
          'tiger crested gecko',
          'brindle gecko',
          'patternless gecko',
          'bicolor tricolor',
          'red base gecko',
          'orange base gecko',
          'yellow base gecko',
          'olive gecko',
          'chocolate gecko',
          'lavender gecko',
          'crested gecko rarity',
          'crested gecko pricing',
          'recessive crested gecko morph',
          'incomplete dominant crested gecko',
        ]}
        jsonLd={MORPH_GUIDE_JSON_LD}
      />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Hero */}
        <section className="relative border-b border-slate-800/50 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-6xl mx-auto px-6 py-14 md:py-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-5">
              <BookOpen className="w-3.5 h-3.5" />
              Morph Reference
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
              Crested Gecko Morph Guide
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
              Every major crested gecko morph, with the genetics, rarity, and
              price tier that matter. Pattern, structure, base color, color
              modifier, and named combinations ,  all in one place, structured
              for keepers and breeders.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
          {/* Top-level tab toggle: Morphs vs Project Lines */}
          <div
            role="tablist"
            aria-label="Morph guide sections"
            className="inline-flex rounded-2xl border border-slate-800 bg-slate-900/60 p-1"
          >
            <button
              role="tab"
              aria-selected={view === 'morphs'}
              type="button"
              onClick={() => setViewAndUrl('morphs')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                view === 'morphs'
                  ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Dna className="w-4 h-4" />
              Morphs
              <span className="text-[10px] opacity-60">{MORPHS.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={view === 'lines'}
              type="button"
              onClick={() => setViewAndUrl('lines')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                view === 'lines'
                  ? 'bg-violet-600/20 text-violet-200 border border-violet-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <GitBranch className="w-4 h-4" />
              Project Lines
              <span className="text-[10px] opacity-60">{PROJECT_LINES.length}</span>
            </button>
          </div>

          {view === 'lines' && (
            <>
              <div className="rounded-2xl border border-violet-500/20 bg-violet-950/10 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-violet-300 mt-0.5 shrink-0" />
                  <div className="text-sm text-slate-300 leading-relaxed">
                    <p className="font-semibold text-violet-200 mb-1">What is a project line?</p>
                    <p>
                      A project line is a named bloodline maintained through selective pairings rather than a single Mendelian gene. Some lines (like the Rialto founders behind Sable) eventually prove out as morphs; others stay as a recognizable look passed across generations. Verification is the buyer&apos;s responsibility, this guide flags how well-documented each line is.
                    </p>
                  </div>
                </div>
              </div>

              {/* Search + filters for lines */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      placeholder="Search lines, founders, or aliases..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    />
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                      <SelectTrigger className="w-48 bg-slate-950 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Confidence" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                        <SelectItem value="all">All confidence levels</SelectItem>
                        {Object.values(LINE_CONFIDENCE).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={rarityFilter} onValueChange={setRarityFilter}>
                      <SelectTrigger className="w-36 bg-slate-950 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Rarity" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                        <SelectItem value="all">All rarities</SelectItem>
                        <SelectItem value="common">Common</SelectItem>
                        <SelectItem value="uncommon">Uncommon</SelectItem>
                        <SelectItem value="rare">Rare</SelectItem>
                        <SelectItem value="very_rare">Very rare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs">
                  <span className="text-slate-400">
                    <span className="text-white font-semibold">{filteredLinesWithImages.length}</span> lines shown
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">
                    <span className="text-white font-semibold">{PROJECT_LINES.length}</span> documented total
                  </span>
                </div>
              </div>

              {/* Confidence legend */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                <div className="flex items-center gap-2 mb-3 text-slate-300">
                  <ShieldCheck className="w-4 h-4 text-violet-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Confidence levels</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {Object.values(LINE_CONFIDENCE).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900/40 p-2"
                    >
                      <span
                        className={`mt-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${c.color}`}
                      >
                        {c.short}
                      </span>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        <span className="text-slate-200 font-semibold">{c.label}</span>
                        <br />
                        {c.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lines grid */}
              {filteredLinesWithImages.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                  <GitBranch className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-300 font-semibold mb-1">No lines match those filters</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setConfidenceFilter('all');
                      setRarityFilter('all');
                    }}
                    className="bg-white text-slate-900 hover:bg-slate-100 border-white/40 mt-3"
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredLinesWithImages.map((l) => (
                    <LineCard key={l.slug} line={l} />
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'morphs' && <>
          {/* Browse-by block ,  real <Link>s to the taxonomy hubs so
              crawlers can follow every branch of the morph taxonomy
              even without running the client-side filter state. Each
              linked destination is an indexable hub page with its own
              CollectionPage + ItemList + BreadcrumbList JSON-LD. */}
          <nav aria-label="Browse morphs by category and inheritance" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-3">Browse the morph guide</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">By category</div>
                <div className="flex flex-wrap gap-1.5">
                  {MORPH_CATEGORIES.map((c) => (
                    <Link
                      key={c.id}
                      to={`/MorphGuide/category/${c.id}`}
                      className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:text-emerald-200 transition-colors"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">By inheritance</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(INHERITANCE).map((i) => (
                    <Link
                      key={i.id}
                      to={`/MorphGuide/inheritance/${i.id}`}
                      className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:text-emerald-200 transition-colors"
                    >
                      {i.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                category === 'all'
                  ? 'border-emerald-500/50 bg-emerald-600/20 text-emerald-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/30'
              }`}
            >
              All
              <span className="text-[10px] opacity-75">{categoryCounts.all}</span>
            </button>
            {MORPH_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  category === cat.id
                    ? 'border-emerald-500/50 bg-emerald-600/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/30'
                }`}
              >
                {cat.label}
                <span className="text-[10px] opacity-75">{categoryCounts[cat.id] || 0}</span>
              </button>
            ))}
          </div>

          {/* Active category blurb */}
          {category !== 'all' && (
            <p className="text-sm text-slate-400 -mt-2">
              {MORPH_CATEGORIES.find((c) => c.id === category)?.blurb}
            </p>
          )}

          {/* Filters */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search morphs, features, or aliases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500"
                />
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <Select value={inheritanceFilter} onValueChange={setInheritanceFilter}>
                    <SelectTrigger className="w-44 bg-slate-950 border-slate-700 text-slate-200">
                      <SelectValue placeholder="Genetics" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                      <SelectItem value="all">All genetics</SelectItem>
                      {Object.values(INHERITANCE).map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Select value={rarityFilter} onValueChange={setRarityFilter}>
                  <SelectTrigger className="w-36 bg-slate-950 border-slate-700 text-slate-200">
                    <SelectValue placeholder="Rarity" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="all">All rarities</SelectItem>
                    <SelectItem value="common">Common</SelectItem>
                    <SelectItem value="uncommon">Uncommon</SelectItem>
                    <SelectItem value="rare">Rare</SelectItem>
                    <SelectItem value="very_rare">Very rare</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-44 bg-slate-950 border-slate-700 text-slate-200">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="rarity_rare_first">Rarest first</SelectItem>
                    <SelectItem value="rarity_common_first">Common first</SelectItem>
                    <SelectItem value="price_high_first">Price high to low</SelectItem>
                    <SelectItem value="price_low_first">Price low to high</SelectItem>
                    <SelectItem value="alphabetical">A–Z</SelectItem>
                    <SelectItem value="alphabetical_desc">Z–A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-3 text-xs">
              <span className="text-slate-400">
                <span className="text-white font-semibold">{filtered.length}</span> morphs shown
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">
                <span className="text-white font-semibold">{allMorphs.length}</span> total in guide
              </span>
              <button
                type="button"
                onClick={() => setShowLegend((x) => !x)}
                className="ml-auto inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-xs font-semibold"
              >
                <Info className="w-3.5 h-3.5" />
                {showLegend ? 'Hide' : 'Show'} genetics key
              </button>
            </div>

            {showLegend && (
              <div className="mt-4">
                <InheritanceLegend />
              </div>
            )}
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Dna className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 font-semibold mb-1">No morphs match those filters</p>
              <p className="text-slate-500 text-sm mb-5">
                Try clearing a filter or broadening your search.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setCategory('all');
                  setInheritanceFilter('all');
                  setRarityFilter('all');
                }}
                className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40"
              >
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((m) => (
                <MorphCard key={m.slug} morph={m} />
              ))}
            </div>
          )}

          </>}

          {/* Related guides CTA */}
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-3 text-emerald-300">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Keep reading</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Everything else you need to know about crested geckos
            </h2>
            <p className="text-slate-400 mb-6 max-w-2xl">
              Morphs are one piece of the hobby. Dive into husbandry, the genetics
              behind these traits, and the community gallery to see each morph in
              real animals from real keepers.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/CareGuide">
                <Button
                  variant="outline"
                  className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40 font-semibold"
                >
                  Care Guide
                </Button>
              </Link>
              <Link to="/GeneticsGuide">
                <Button
                  variant="outline"
                  className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40 font-semibold"
                >
                  Genetics Guide
                </Button>
              </Link>
              <Link to="/Gallery">
                <Button
                  variant="outline"
                  className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40 font-semibold"
                >
                  Community Gallery
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
