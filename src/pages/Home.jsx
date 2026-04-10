import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import {
  Dna,
  GitBranch,
  LineChart as LineChartIcon,
  Sparkles,
  Users,
  BookOpen,
  ShoppingCart,
  Images,
  ArrowRight,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';

const LOGO_URL =
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68929cdad944c572926ab6cb/2ba53d481_Inspect.png';

const FEATURES = [
  {
    icon: Dna,
    title: 'AI Morph Identification',
    desc: 'Upload a photo and get an instant classification of primary morph, secondary traits, and base color — trained on thousands of verified crested geckos.',
  },
  {
    icon: GitBranch,
    title: 'Breeding Plans &amp; Lineage',
    desc: 'Pair sires and dams, project offspring traits, track eggs through incubation, and visualize multi-generation family trees with breeder attribution.',
  },
  {
    icon: LineChartIcon,
    title: 'Growth &amp; Weight Tracking',
    desc: 'Log weights over time and watch growth curves for every gecko in your collection. Get hatch alerts and never miss a milestone.',
  },
  {
    icon: BookOpen,
    title: 'Morph &amp; Care Guides',
    desc: 'Reference guides for every major crested gecko morph — Harlequin, Dalmatian, Pinstripe, Lilly White, Flame, Cream and more — alongside husbandry guides.',
  },
  {
    icon: Users,
    title: 'Community &amp; Forum',
    desc: 'Gallery, forum, direct messaging, and a verified expert network. Ask morph IDs, share projects, and connect with other serious keepers.',
  },
  {
    icon: ShoppingCart,
    title: 'Verified Marketplace',
    desc: 'Buy and sell crested geckos from keepers you can verify — with full lineage, weight history, and photo history attached to every listing.',
  },
];

const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Geck Inspect — Crested Gecko Collection, Breeding & Community Platform',
  url: 'https://geckinspect.com/',
  description:
    'The professional platform for crested gecko (Correlophus ciliatus) breeders and keepers. Collection management, breeding planning, AI-powered morph identification, lineage tracking, and community tools.',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Geck Inspect',
    url: 'https://geckinspect.com/',
  },
  about: {
    '@type': 'Thing',
    name: 'Crested gecko',
    alternateName: 'Correlophus ciliatus',
    sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
  },
  mainEntity: {
    '@type': 'SoftwareApplication',
    name: 'Geck Inspect',
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  },
};

export default function Home() {
  return (
    <>
      <Seo
        title="Crested Gecko Collection, Breeding & Community Platform"
        description="Geck Inspect is the professional platform for crested gecko breeders and keepers. Track collections, plan breedings, log weights, identify morphs with AI, research lineages, and connect with the community."
        path="/"
        jsonLd={LANDING_JSON_LD}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-slate-100">
        {/* Ambient glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[40rem] h-[40rem] bg-green-500/10 rounded-full blur-3xl" />
        </div>

        {/* Top nav */}
        <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Geck Inspect" className="h-10 w-10 rounded-xl" />
            <span className="text-xl font-bold tracking-tight">Geck Inspect</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
            <Link to={createPageUrl('MorphGuide')} className="hover:text-emerald-300 transition-colors">
              Morph Guide
            </Link>
            <Link to={createPageUrl('CareGuide')} className="hover:text-emerald-300 transition-colors">
              Care Guide
            </Link>
            <Link to={createPageUrl('GeneticsGuide')} className="hover:text-emerald-300 transition-colors">
              Genetics
            </Link>
            <Link to={createPageUrl('Gallery')} className="hover:text-emerald-300 transition-colors">
              Gallery
            </Link>
            <Link to={createPageUrl('Marketplace')} className="hover:text-emerald-300 transition-colors">
              Marketplace
            </Link>
          </nav>
          <Link to={createPageUrl('AuthPortal')}>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
              Sign In
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Built for serious crested gecko keepers &amp; breeders
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 bg-gradient-to-b from-white via-white to-emerald-200 bg-clip-text text-transparent">
            Every gecko in your collection,
            <br />
            finally in one place.
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track, breed, and identify crested geckos with a platform built specifically for the
            hobby. AI morph identification, breeding planning, lineage trees, community — all of it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link to={createPageUrl('AuthPortal')}>
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base px-8 py-6 shadow-lg shadow-emerald-500/20"
              >
                Create your account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to={createPageUrl('MorphGuide')}>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-600 text-slate-200 hover:bg-slate-800 font-semibold text-base px-8 py-6"
              >
                Browse morph guide
              </Button>
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-6">
            Free to use. No credit card required. Your collection stays yours.
          </p>
        </section>

        {/* Feature grid */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              The complete toolkit for the hobby
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From your first gecko to a full breeding project, Geck Inspect grows with you.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur p-6 hover:border-emerald-500/40 hover:bg-slate-900/80 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                    <Icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3
                    className="text-lg font-semibold text-white mb-2"
                    dangerouslySetInnerHTML={{ __html: f.title }}
                  />
                  <p
                    className="text-sm text-slate-400 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: f.desc }}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Crested gecko context — this is valuable SEO/AI content */}
        <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              About the crested gecko (<em>Correlophus ciliatus</em>)
            </h2>
            <div className="space-y-4 text-slate-300 leading-relaxed">
              <p>
                The crested gecko is a species of arboreal gecko native to southern New Caledonia.
                Thought extinct until its rediscovery in 1994, it has become one of the most
                popular reptile pets worldwide thanks to a manageable adult size (35–60 grams), a
                docile temperament, low care requirements, and the extraordinary trait diversity
                that breeders have developed over the past three decades.
              </p>
              <p>
                Modern crested gecko breeding is built around a vocabulary of morphs and traits
                including <strong>Harlequin</strong>, <strong>Pinstripe</strong>,{' '}
                <strong>Dalmatian</strong>, <strong>Lilly White</strong>,{' '}
                <strong>Flame</strong>, <strong>Cream</strong>, <strong>Brindle</strong>,{' '}
                <strong>Tiger</strong>, <strong>Cappuccino</strong>, and many more. Geck Inspect
                treats these as structured, searchable data rather than free-text descriptions, so
                you can finally answer questions like &ldquo;how many harlequin pinstripes are in
                my collection?&rdquo; or &ldquo;what&rsquo;s the lineage of this particular
                Lilly White?&rdquo;
              </p>
              <p>
                Whether you&rsquo;re keeping your first gecko or running a project with hundreds
                of animals, Geck Inspect is designed to be the single tool you open every morning
                during feeding rounds — and the reference you come back to every time you&rsquo;re
                planning a pairing or identifying a new morph.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={createPageUrl('CareGuide')}>
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Care Guide
                </Button>
              </Link>
              <Link to={createPageUrl('MorphGuide')}>
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                  <Dna className="w-4 h-4 mr-2" />
                  Morph Guide
                </Button>
              </Link>
              <Link to={createPageUrl('GeneticsGuide')}>
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                  Genetics
                </Button>
              </Link>
              <Link to={createPageUrl('Gallery')}>
                <Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-800">
                  <Images className="w-4 h-4 mr-2" />
                  Community Gallery
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to inspect your geckos?
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Create a free account and start cataloging your collection in minutes.
          </p>
          <Link to={createPageUrl('AuthPortal')}>
            <Button
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base px-8 py-6 shadow-lg shadow-emerald-500/20"
            >
              Get started — it&rsquo;s free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-slate-800/50 mt-12">
          <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Geck Inspect" className="h-6 w-6 rounded" />
              <span>© {new Date().getFullYear()} Geck Inspect</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to={createPageUrl('PrivacyPolicy')} className="hover:text-slate-300">
                Privacy
              </Link>
              <Link to={createPageUrl('AuthPortal')} className="hover:text-slate-300">
                Sign in
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
