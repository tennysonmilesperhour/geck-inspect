import { useState, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  Search, Dna, ArrowRight, Info, ShieldCheck, GitBranch, SlidersHorizontal, X,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { useInAppShell } from '@/lib/appShell';
import { faqPageSchema } from '@/lib/organization-schema';
import {
  MORPHS,
  MORPH_CATEGORIES,
  INHERITANCE,
  RARITY,
} from '@/data/morph-guide';
import { PROJECT_LINES, LINE_CONFIDENCE, lineImageKeywords } from '@/data/project-lines';
import RotatingMorphImage from '@/components/morphguide/RotatingMorphImage';
import MorphIndexCard from '@/components/morphguide/MorphIndexCard';
import MorphIndexHero from '@/components/morphguide/MorphIndexHero';
import MorphIndexSpotlight from '@/components/morphguide/MorphIndexSpotlight';
import MorphIndexCompareTable from '@/components/morphguide/MorphIndexCompareTable';
import MorphIndexFaq, { MORPH_INDEX_FAQ } from '@/components/morphguide/MorphIndexFaq';
import MorphIndexAppHooks from '@/components/morphguide/MorphIndexAppHooks';
import { useMorphGuideData, sanitizeImage, normMorph } from '@/components/morphguide/MorphIndexData';
import ContentSignupPrompt from '@/components/public/ContentSignupPrompt';

const MORPH_COUNT = MORPHS.length;
const SEO_TITLE = `Crested Gecko Morphs: Guide to All ${MORPH_COUNT} Morphs`;
const SEO_DESCRIPTION =
  'Every crested gecko morph in one guide: Harlequin, Pinstripe, Lilly White, Axanthic, Cappuccino and the new Albino, with genetics, rarity and price for each.';

// Sits in the morph grid after the first eight cards (four rows on a
// phone, two on a desktop), full width, so it reads as part of the page
// rather than a pop-up.
const MORPH_GRID_PROMPT_AFTER = 8;
function MorphGuideSignupPrompt({ className = '' }) {
  return (
    <ContentSignupPrompt
      pageType="morph_guide"
      ctaId="morph_guide_grid"
      className={className}
      headline="Know which morphs are in your collection? Keep them all in one place, free"
      body="Log each gecko's morph, hets, parents and weights. Geck Inspect builds the pedigree as you go and estimates each gecko's value from real crested gecko listings."
    />
  );
}

// DefinedTermSet treats the morph guide as a controlled vocabulary for
// AI assistants, every morph becomes a DefinedTerm that can be cited
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
  description: m.definition || m.summary || m.description || `${m.name}, crested gecko morph.`,
  inDefinedTermSet: { '@id': 'https://geckinspect.com/MorphGuide#termset' },
}));

// FAQPage for the questions shown near the foot of the page. The helper
// adds its own @context, which is redundant inside the page's @graph.
const MORPH_FAQ_SCHEMA = (() => {
  const schema = { ...faqPageSchema(MORPH_INDEX_FAQ) };
  delete schema['@context'];
  return { ...schema, '@id': 'https://geckinspect.com/MorphGuide#faq' };
})();

const MORPH_GUIDE_JSON_LD = [
  {
    '@type': 'CollectionPage',
    '@id': 'https://geckinspect.com/MorphGuide#collection',
    name: 'Crested Gecko Morphs: The Complete Guide',
    url: 'https://geckinspect.com/MorphGuide',
    description: SEO_DESCRIPTION,
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
      'Controlled vocabulary of named crested gecko morphs maintained by Geck Inspect: base colors, color modifiers, pattern types, structural traits, and named combinations, each with inheritance model and rarity.',
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
  MORPH_FAQ_SCHEMA,
  {
    '@type': 'BreadcrumbList',
    '@id': 'https://geckinspect.com/MorphGuide#breadcrumbs',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://geckinspect.com/' },
      { '@type': 'ListItem', position: 2, name: 'Morph Guide', item: 'https://geckinspect.com/MorphGuide' },
    ],
  },
];

const SEO_KEYWORDS = [
  'crested gecko morphs',
  'crested gecko morph guide',
  'crested gecko morph list',
  'crestie morphs',
  'crested gecko genetics',
  'harlequin crested gecko',
  'extreme harlequin',
  'pinstripe crested gecko',
  'phantom pinstripe',
  'dalmatian crested gecko',
  'super dalmatian',
  'lilly white',
  'axanthic crested gecko',
  'albino crested gecko',
  'moonglow crested gecko',
  'cappuccino',
  'frappuccino',
  'soft scale',
  'white wall',
  'flame crested gecko',
  'tiger crested gecko',
  'brindle crested gecko',
  'patternless crested gecko',
  'crested gecko rarity',
  'crested gecko price by morph',
  'recessive crested gecko morph',
  'incomplete dominant crested gecko',
];

const RARITY_OPTIONS = [
  ['all', 'All rarities'],
  ['common', 'Common'],
  ['uncommon', 'Uncommon'],
  ['rare', 'Rare'],
  ['very_rare', 'Very rare'],
];

const SORT_OPTIONS = [
  ['rarity_rare_first', 'Rarest first'],
  ['rarity_common_first', 'Common first'],
  ['price_high_first', 'Price high to low'],
  ['price_low_first', 'Price low to high'],
  ['alphabetical', 'A to Z'],
  ['alphabetical_desc', 'Z to A'],
];

const TRIGGER_CLASS = 'h-10 bg-slate-950 border-slate-700 text-slate-200 text-sm';
const CONTENT_CLASS = 'bg-slate-900 border-slate-700 text-slate-200';

function MorphFilterSelects({
  inheritanceFilter, setInheritanceFilter, rarityFilter, setRarityFilter, sortBy, setSortBy, wide = false,
}) {
  return (
    <>
      <Select value={inheritanceFilter} onValueChange={setInheritanceFilter}>
        <SelectTrigger aria-label="Genetics" className={`${TRIGGER_CLASS} ${wide ? 'w-full' : 'w-44'}`}>
          <SelectValue placeholder="Genetics" />
        </SelectTrigger>
        <SelectContent className={CONTENT_CLASS}>
          <SelectItem value="all">All genetics</SelectItem>
          {Object.values(INHERITANCE).map((i) => (
            <SelectItem key={i.id} value={i.id}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={rarityFilter} onValueChange={setRarityFilter}>
        <SelectTrigger aria-label="Rarity" className={`${TRIGGER_CLASS} ${wide ? 'w-full' : 'w-36'}`}>
          <SelectValue placeholder="Rarity" />
        </SelectTrigger>
        <SelectContent className={CONTENT_CLASS}>
          {RARITY_OPTIONS.map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortBy} onValueChange={setSortBy}>
        <SelectTrigger aria-label="Sort" className={`${TRIGGER_CLASS} ${wide ? 'w-full' : 'w-40'}`}>
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent className={CONTENT_CLASS}>
          {SORT_OPTIONS.map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function MorphGridItem({ morph, withPrompt }) {
  if (!withPrompt) return <MorphIndexCard morph={morph} />;
  return (
    <>
      <MorphIndexCard morph={morph} />
      <MorphGuideSignupPrompt className="col-span-full" />
    </>
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
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${confidence.color}`}
            title={confidence.description}
          >
            <ShieldCheck className="w-3 h-3" />
            {confidence.short}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${rarity.color}`}
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
            <span className="text-xs text-slate-500">{line.priceRange}</span>
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
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
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
              className={`mt-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold uppercase ${i.color}`}
            >
              {i.short}
            </span>
            <div className="text-xs text-slate-400 leading-snug">
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

export default function MorphGuidePage() {
  const inAppShell = useInAppShell();
  const { allMorphs, dbBySlug, communityByKeyword, heroByNorm } = useMorphGuideData();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('all');
  const [inheritanceFilter, setInheritanceFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('rarity_rare_first');
  const [showLegend, setShowLegend] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsRef = useRef(null);

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

  const jumpToResults = () => {
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // Wire real images into each line by matching the line's name/aliases
  // against the same hero anchor, curated DB, and community pool data
  // the morph grid uses. Intentionally does NOT fall back to
  // relatedMorphs: that would put the same generic harlequin photos on
  // every harlequin-adjacent line and mislead readers into thinking each
  // line had its own visual identity proven by those photos.
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

  const activeFilterCount =
    (inheritanceFilter !== 'all' ? 1 : 0) + (rarityFilter !== 'all' ? 1 : 0);
  const anyFilter = Boolean(searchTerm) || category !== 'all' || activeFilterCount > 0;
  const clearAll = () => {
    setSearchTerm('');
    setCategory('all');
    setInheritanceFilter('all');
    setRarityFilter('all');
  };

  const selectProps = {
    inheritanceFilter, setInheritanceFilter, rarityFilter, setRarityFilter, sortBy, setSortBy,
  };

  const chipClass = (active) =>
    `inline-flex shrink-0 items-center gap-1.5 min-h-9 rounded-full border px-3 py-1 text-sm font-semibold whitespace-nowrap transition-colors ${
      active
        ? 'border-emerald-500/60 bg-emerald-600/25 text-emerald-100'
        : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-500/40'
    }`;

  const content = (
    <div className={`bg-slate-950 text-slate-100 ${inAppShell ? 'min-h-screen' : ''}`}>
      <Seo
        title={SEO_TITLE}
        description={SEO_DESCRIPTION}
        path="/MorphGuide"
        imageAlt="Crested gecko morph guide"
        keywords={SEO_KEYWORDS}
        jsonLd={MORPH_GUIDE_JSON_LD}
      />

      <MorphIndexHero
        morphs={allMorphs}
        total={MORPH_COUNT}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        matchCount={view === 'lines' ? filteredLinesWithImages.length : filtered.length}
        onJumpToResults={jumpToResults}
      />

      <section className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 md:space-y-8">
        {/* Top-level tab toggle: Morphs vs Project Lines */}
        <div
          role="tablist"
          aria-label="Morph guide sections"
          className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1"
        >
          <button
            role="tab"
            aria-selected={view === 'morphs'}
            type="button"
            onClick={() => setViewAndUrl('morphs')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 touch:min-h-11 text-sm font-semibold transition-colors ${
              view === 'morphs'
                ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Dna className="w-4 h-4" />
            Morphs
            <span className="text-xs opacity-70">{MORPHS.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={view === 'lines'}
            type="button"
            onClick={() => setViewAndUrl('lines')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 touch:min-h-11 text-sm font-semibold transition-colors ${
              view === 'lines'
                ? 'bg-violet-600/20 text-violet-200 border border-violet-500/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            Project Lines
            <span className="text-xs opacity-70">{PROJECT_LINES.length}</span>
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
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
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
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
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
                        className={`mt-0.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold uppercase ${c.color}`}
                      >
                        {c.short}
                      </span>
                      <div className="text-xs text-slate-400 leading-snug">
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
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-12 text-center">
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

        {view === 'morphs' && (
          <>
            <MorphIndexSpotlight morphs={allMorphs} />

            {/* The filter bar sticks to the top of the screen while the
                visitor scrolls the grid (public pages only: inside the app
                the app's own header already sticks there). */}
            <div ref={resultsRef} className="scroll-mt-2">
              <div
                className={`${inAppShell ? '' : 'sticky top-0'} z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-2.5 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80`}
              >
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      type="search"
                      aria-label="Search morphs"
                      placeholder="Search morphs or features"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-10 pl-9 bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((x) => !x)}
                    aria-expanded={filtersOpen}
                    aria-controls="morph-filter-panel"
                    className={`md:hidden inline-flex items-center gap-1.5 h-10 shrink-0 rounded-md border px-3 text-sm font-semibold ${
                      filtersOpen || activeFilterCount
                        ? 'border-emerald-500/60 bg-emerald-600/20 text-emerald-100'
                        : 'border-slate-700 bg-slate-900 text-slate-300'
                    }`}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && <span className="text-xs">({activeFilterCount})</span>}
                  </button>
                  <div className="hidden md:flex items-center gap-2">
                    <MorphFilterSelects {...selectProps} />
                  </div>
                </div>
                {filtersOpen && (
                  <div id="morph-filter-panel" className="md:hidden mt-2 grid grid-cols-3 gap-2">
                    <MorphFilterSelects {...selectProps} wide />
                  </div>
                )}
                <div
                  role="group"
                  aria-label="Filter by category"
                  className="mt-2 -mx-4 px-4 md:mx-0 md:px-0 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')} className={chipClass(category === 'all')}>
                    All
                    <span className="text-xs opacity-75">{categoryCounts.all}</span>
                  </button>
                  {MORPH_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={category === cat.id}
                      onClick={() => setCategory(cat.id)}
                      className={chipClass(category === cat.id)}
                    >
                      {cat.label}
                      <span className="text-xs opacity-75">{categoryCounts[cat.id] || 0}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-slate-400">
                  <span className="text-white font-semibold">{filtered.length}</span>
                  {filtered.length === allMorphs.length ? ' morphs' : ` of ${allMorphs.length} morphs`}
                </span>
                {category !== 'all' && (
                  <span className="text-slate-500 hidden sm:inline">
                    {MORPH_CATEGORIES.find((c) => c.id === category)?.blurb}
                  </span>
                )}
                {anyFilter && (
                  <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 text-slate-300 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowLegend((x) => !x)}
                  aria-expanded={showLegend}
                  className="ml-auto inline-flex items-center gap-1 touch:min-h-11 text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  <Info className="w-3.5 h-3.5" />
                  {showLegend ? 'Hide' : 'Show'} genetics key
                </button>
              </div>

              {showLegend && (
                <div className="mb-4">
                  <InheritanceLegend />
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-10 text-center">
                  <Dna className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-300 font-semibold mb-1">No morphs match those filters</p>
                  <p className="text-slate-500 text-sm mb-5">
                    Try clearing a filter or broadening your search.
                  </p>
                  <Button
                    variant="outline"
                    onClick={clearAll}
                    className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40"
                  >
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                    {filtered.map((m, i) => (
                      <MorphGridItem
                        key={m.slug}
                        morph={m}
                        withPrompt={i === MORPH_GRID_PROMPT_AFTER - 1 && filtered.length > MORPH_GRID_PROMPT_AFTER}
                      />
                    ))}
                  </div>
                  {filtered.length <= MORPH_GRID_PROMPT_AFTER && <MorphGuideSignupPrompt className="mt-6" />}
                </>
              )}
            </div>

            <MorphIndexCompareTable />

            {/* Browse-by block: real <Link>s to the taxonomy hubs so
                crawlers can follow every branch of the morph taxonomy
                without running the client-side filters. Each hub is an
                indexable page with its own CollectionPage, ItemList and
                BreadcrumbList JSON-LD. */}
            <nav aria-label="Browse morphs by category and inheritance" className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:p-5">
              <h2 className="text-base font-semibold text-white mb-3">Browse the morph guide</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">By category</div>
                  <div className="flex flex-wrap gap-1.5">
                    {MORPH_CATEGORIES.map((c) => (
                      <Link
                        key={c.id}
                        to={`/MorphGuide/category/${c.id}`}
                        className="inline-flex items-center touch:min-h-11 rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:text-emerald-200 transition-colors"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">By inheritance</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(INHERITANCE).map((i) => (
                      <Link
                        key={i.id}
                        to={`/MorphGuide/inheritance/${i.id}`}
                        className="inline-flex items-center touch:min-h-11 rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1 text-sm text-slate-300 hover:text-emerald-200 transition-colors"
                      >
                        {i.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </nav>
          </>
        )}

        <MorphIndexFaq />

        <MorphIndexAppHooks />
      </section>
    </div>
  );

  // Signed-out visitors get the public logo bar and footer, like the price
  // guide. Inside the app the app's own header and sidebar are already there.
  return inAppShell ? content : <PublicPageShell>{content}</PublicPageShell>;
}
