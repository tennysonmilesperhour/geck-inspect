import { Link } from 'react-router-dom';
import {
  ScanSearch, BookOpen, Layers, Calculator, GraduationCap, ArrowRight, Dna,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { createPageUrl } from '@/utils';
import { getMorph, RARITY } from '@/data/morph-guide';

// The five morph tools this hub fronts. Each links to an existing page
// via createPageUrl, so route changes in pages.config.js propagate here
// automatically.
const FEATURES = [
  {
    page: 'Recognition',
    icon: ScanSearch,
    name: 'Identify a Morph',
    description:
      'Upload a photo and let the AI tell you whether you are looking at a Lilly White, a Harlequin, or something rarer.',
    cta: 'Start identifying',
  },
  {
    page: 'MorphGuide',
    icon: BookOpen,
    name: 'Browse the Morph Guide',
    description:
      'Every major crested gecko morph from Buckskin to Axanthic, with inheritance, rarity, and price tier on each entry.',
    cta: 'Open the guide',
  },
  {
    page: 'MorphVisualizer',
    icon: Layers,
    name: 'Visualize Trait Combos',
    description:
      'Stack traits like Cappuccino, Phantom, and Dalmatian to preview how combinations express on a crested gecko.',
    cta: 'Build a combo',
  },
  {
    page: 'GeneticCalculatorTool',
    icon: Calculator,
    name: 'Genetics Calculator',
    description:
      'Predict pairing outcomes with Punnett squares, including the lethal super Lilly White warning every breeder needs.',
    cta: 'Run a pairing',
  },
  {
    page: 'GeneticsGuide',
    icon: GraduationCap,
    name: 'Genetics Guide',
    description:
      'Learn why Axanthic needs two copies, why Cappuccino shows with one, and how polygenic traits like Harlequin really work.',
    cta: 'Learn inheritance',
  },
];

// Hand-picked strip of the morphs visitors search for most. Slugs match
// src/data/morph-guide.js; getMorph keeps name and rarity in sync with
// the catalogue, and the filter drops any entry that gets renamed.
const POPULAR_SLUGS = [
  'lilly-white',
  'harlequin',
  'cappuccino',
  'axanthic',
  'pinstripe',
  'dalmatian',
  'phantom-pinstripe',
  'frappuccino',
  'soft-scale',
  'flame',
];

const POPULAR_MORPHS = POPULAR_SLUGS.map((slug) => getMorph(slug)).filter(Boolean);

const MORPHS_JSON_LD = [
  {
    '@type': 'CollectionPage',
    '@id': 'https://geckinspect.com/Morphs#collection',
    name: 'Crested Gecko Morphs',
    url: 'https://geckinspect.com/Morphs',
    description:
      'Hub for crested gecko morphs and genetics: AI photo identification, the full morph guide, a trait combo visualizer, a genetics calculator for pairing predictions, and a plain-language genetics guide.',
    about: {
      '@type': 'Thing',
      name: 'Crested gecko',
      alternateName: 'Correlophus ciliatus',
      sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
    },
    isPartOf: { '@id': 'https://geckinspect.com/#website' },
    publisher: { '@id': 'https://geckinspect.com/#organization' },
    hasPart: FEATURES.map((f) => ({
      '@type': 'WebPage',
      name: f.name,
      url: `https://geckinspect.com${createPageUrl(f.page)}`,
      description: f.description,
    })),
  },
  {
    '@type': 'BreadcrumbList',
    '@id': 'https://geckinspect.com/Morphs#breadcrumbs',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://geckinspect.com/' },
      { '@type': 'ListItem', position: 2, name: 'Morphs', item: 'https://geckinspect.com/Morphs' },
    ],
  },
];

function FeatureCard({ feature }) {
  const Icon = feature.icon;
  return (
    <Link
      to={createPageUrl(feature.page)}
      className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col hover:border-emerald-500/50 hover:bg-slate-900 transition-all duration-200"
    >
      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
        <Icon className="w-6 h-6 text-emerald-400" />
      </div>
      <h2 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">
        {feature.name}
      </h2>
      <p className="text-sm text-slate-400 leading-relaxed flex-1">
        {feature.description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">
        {feature.cta}
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}

export default function MorphsPage() {
  return (
    <>
      <Seo
        title="Crested Gecko Morphs: ID, Guide, Calculator & Visualizer"
        description="One hub for crested gecko morphs and genetics. Identify a morph from a photo with AI, browse the full morph guide, visualize trait combos, predict pairings with the genetics calculator, and learn how Lilly White, Cappuccino, and Axanthic inheritance works."
        path="/Morphs"
        imageAlt="Crested gecko morphs hub on Geck Inspect"
        keywords={[
          'crested gecko morphs',
          'crested gecko morph identifier',
          'gecko morph identification',
          'crested gecko morph guide',
          'crested gecko genetics calculator',
          'crested gecko morph calculator',
          'morph visualizer',
          'crested gecko genetics',
          'lilly white crested gecko',
          'cappuccino crested gecko',
          'axanthic crested gecko',
          'harlequin crested gecko',
          'phantom crested gecko',
        ]}
        jsonLd={MORPHS_JSON_LD}
      />
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Hero */}
        <section className="relative border-b border-slate-800/50 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          </div>
          <div className="relative max-w-6xl mx-auto px-6 py-14 md:py-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-5">
              <Dna className="w-3.5 h-3.5" />
              Morphs &amp; Genetics Hub
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
              Crested Gecko Morphs
            </h1>
            <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
              Everything Geck Inspect knows about crested gecko morphs and
              genetics, in one place. Identify a mystery gecko from a photo,
              browse the full morph guide, visualize how traits stack,
              calculate pairing odds before you breed, and learn how
              inheritance actually works (from recessive Axanthic to
              incomplete dominant Lilly White).
            </p>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-10">
          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <FeatureCard key={f.page} feature={f} />
            ))}
          </div>

          {/* Popular morphs strip */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 md:p-8">
            <div className="flex items-center gap-2 mb-2 text-emerald-300">
              <BookOpen className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Popular morphs</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Jump straight to a morph
            </h2>
            <p className="text-sm text-slate-400 mb-5 max-w-2xl">
              The morphs keepers look up most, each with full genetics, rarity,
              and pricing in the guide.
            </p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_MORPHS.map((m) => {
                const rarity = RARITY[m.rarity] || RARITY.common;
                return (
                  <Link
                    key={m.slug}
                    to={`/MorphGuide/${m.slug}`}
                    className="group inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1.5 transition-colors"
                  >
                    <span className="text-sm font-semibold text-slate-200 group-hover:text-emerald-200 transition-colors">
                      {m.name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${rarity.color}`}
                    >
                      {rarity.label}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-5">
              <Link
                to={createPageUrl('MorphGuide')}
                className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300"
              >
                See the full morph guide
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
