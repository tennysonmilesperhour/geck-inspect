import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { MorphGuide } from '@/entities/MorphGuide';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, BookOpen, Filter, Dna, Sparkles, ArrowRight } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { morphSlug, pickBestMorphRecord } from '@/lib/morphUtils';

const DEFAULT_GECKO_IMAGE = 'https://i.imgur.com/sw9gnDp.png';

const MORPH_GUIDE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Crested Gecko Morph Guide',
  url: 'https://geckinspect.com/MorphGuide',
  description:
    'Reference guide for crested gecko morphs: Harlequin, Dalmatian, Pinstripe, Lilly White, Flame, Cream, Brindle, Tiger, Cappuccino, Patternless, and more. Detailed morph descriptions, rarity, key features, and breeding information.',
  about: {
    '@type': 'Thing',
    name: 'Crested gecko',
    alternateName: 'Correlophus ciliatus',
    sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
  },
};

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very Rare',
};

const RARITY_COLORS = {
  common: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  uncommon: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  rare: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  very_rare: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

const RARITY_ORDER = { common: 1, uncommon: 2, rare: 3, very_rare: 4 };

// Sanitize example_image_url — the same heuristic MorphDetail uses to skip
// known-broken externals (YouTube thumbs, Wikipedia rate limits, etc.).
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

function MorphGridCard({ slug, name, rarity, description, heroImage }) {
  const rarityLabel = RARITY_LABELS[rarity] || rarity || 'Unknown';
  const rarityColor = RARITY_COLORS[rarity] || 'bg-slate-700/40 text-slate-300 border-slate-600';
  return (
    <Link
      to={`/MorphGuide/${slug}`}
      className="group rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-emerald-500/50 hover:bg-slate-900 transition-all duration-200 flex flex-col"
    >
      <div className="aspect-[4/3] bg-slate-800 relative overflow-hidden">
        <img
          src={heroImage || DEFAULT_GECKO_IMAGE}
          alt={`${name} crested gecko morph`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${rarityColor}`}>
            {rarityLabel}
          </span>
        </div>
      </div>
      <div className="flex-1 p-5 flex flex-col">
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
          {name}
        </h3>
        <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 flex-1">
          {description || 'Learn about this crested gecko morph — description, key features, and breeding information.'}
        </p>
        <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
          Read guide
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}

export default function MorphGuidePage() {
  const [allRecords, setAllRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rarity_rare_first');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await MorphGuide.list();
        setAllRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading morph guide:', err);
        setAllRecords([]);
      }
      setIsLoading(false);
    })();
  }, []);

  // Dedupe by slug and pick the best record per morph (longest description,
  // has valid image, etc.). Memoized so filter/sort don't re-dedupe.
  const uniqueMorphs = useMemo(() => {
    const bySlug = {};
    for (const r of allRecords) {
      const slug = morphSlug(r.morph_name);
      if (!slug) continue;
      (bySlug[slug] ||= []).push(r);
    }
    return Object.entries(bySlug)
      .map(([slug, records]) => {
        const best = pickBestMorphRecord(records);
        return {
          slug,
          name: best.morph_name,
          rarity: best.rarity,
          description: best.description,
          heroImage: sanitizeImage(best.example_image_url),
          keyFeatures: best.key_features,
        };
      })
      .filter((m) => m.name);
  }, [allRecords]);

  const filteredAndSorted = useMemo(() => {
    let list = [...uniqueMorphs];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q) ||
          (m.keyFeatures || []).some((f) => f.toLowerCase().includes(q))
      );
    }

    if (rarityFilter !== 'all') {
      list = list.filter((m) => m.rarity === rarityFilter);
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'alphabetical_desc':
          return b.name.localeCompare(a.name);
        case 'rarity_common_first':
          return (
            (RARITY_ORDER[a.rarity] || 5) - (RARITY_ORDER[b.rarity] || 5) ||
            a.name.localeCompare(b.name)
          );
        case 'rarity_rare_first':
        default:
          return (
            (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0) ||
            a.name.localeCompare(b.name)
          );
      }
    });

    return list;
  }, [uniqueMorphs, searchTerm, rarityFilter, sortBy]);

  const rarityCounts = useMemo(() => {
    const c = { common: 0, uncommon: 0, rare: 0, very_rare: 0 };
    uniqueMorphs.forEach((m) => {
      if (c[m.rarity] != null) c[m.rarity]++;
    });
    return c;
  }, [uniqueMorphs]);

  return (
    <>
      <Seo
        title="Crested Gecko Morph Guide"
        description="Complete visual reference for every major crested gecko (Correlophus ciliatus) morph — Harlequin, Extreme Harlequin, Dalmatian, Pinstripe, Lilly White, Flame, Cream, Brindle, Tiger, Cappuccino, Frappuccino, Soft Scale, Patternless, Axanthic, and more. Rarity ratings, key identifying features, breeding information, and example photos for every proven morph and polygenic trait."
        path="/MorphGuide"
        imageAlt="Crested gecko morph reference guide"
        keywords={[
          'crested gecko morph guide',
          'gecko morph list',
          'crestie morphs',
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
          'crested gecko rarity',
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
              Every major crested gecko morph in one place. Descriptions, rarity,
              key identifying features, and breeding information for Harlequin,
              Pinstripe, Dalmatian, Lilly White, Flame, Cappuccino, Brindle,
              Tiger, Patternless, and more.
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-10">
          {/* Filters */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search morphs, features, or descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-950 border-slate-700 text-slate-200 placeholder:text-slate-500"
                />
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <Select value={rarityFilter} onValueChange={setRarityFilter}>
                    <SelectTrigger className="w-36 bg-slate-950 border-slate-700 text-slate-200">
                      <SelectValue placeholder="Rarity" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                      <SelectItem value="all">All Rarities</SelectItem>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="uncommon">Uncommon</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="very_rare">Very Rare</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-44 bg-slate-950 border-slate-700 text-slate-200">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="rarity_rare_first">Rarest first</SelectItem>
                    <SelectItem value="rarity_common_first">Common first</SelectItem>
                    <SelectItem value="alphabetical">A - Z</SelectItem>
                    <SelectItem value="alphabetical_desc">Z - A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats strip */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-4 text-xs">
              <span className="text-slate-400">
                <span className="text-white font-semibold">{uniqueMorphs.length}</span> morphs in guide
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400">
                Showing <span className="text-white font-semibold">{filteredAndSorted.length}</span>
              </span>
              <span className="text-slate-500">·</span>
              {['common', 'uncommon', 'rare', 'very_rare'].map((r) =>
                rarityCounts[r] > 0 ? (
                  <span
                    key={r}
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 ${RARITY_COLORS[r]}`}
                  >
                    {RARITY_LABELS[r]}: {rarityCounts[r]}
                  </span>
                ) : null
              )}
            </div>
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
          ) : filteredAndSorted.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Dna className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 font-semibold mb-1">No morphs match those filters</p>
              <p className="text-slate-500 text-sm mb-5">
                Try clearing the search or rarity filter.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('');
                  setRarityFilter('all');
                }}
                className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40"
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAndSorted.map((m) => (
                <MorphGridCard key={m.slug} {...m} />
              ))}
            </div>
          )}

          {/* Related guides CTA */}
          <div className="mt-16 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-3 text-emerald-300">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Keep reading</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              Everything else you need to know about crested geckos
            </h2>
            <p className="text-slate-400 mb-6 max-w-2xl">
              Morphs are just one piece of the hobby. Dive into care basics,
              genetics, and the community gallery to see these morphs in real
              animals from real keepers.
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
