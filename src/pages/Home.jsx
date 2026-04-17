import { APP_LOGO_URL } from "@/lib/constants";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import '@/styles/layout-theme.css';
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
  Eye,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';

const LOGO_URL =
  APP_LOGO_URL;

// Jungle hero background from Unsplash (free-license, hotlinking allowed).
// Sebastian Unrau's classic forest — dense, misty, reads as wild habitat
// once darkened with an overlay. Swap this URL for a more specifically
// tropical photo whenever you find one you like; the overlay will handle it.
const BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2400&q=80';

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
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://geckinspect.com/#webpage',
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
    },
    {
      '@type': 'FAQPage',
      '@id': 'https://geckinspect.com/#faq',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Geck Inspect?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Geck Inspect is a free web platform built specifically for crested gecko keepers and breeders. It combines collection management, breeding planning, AI-powered morph identification, lineage tracking, a community gallery, a forum, and a verified marketplace into one tool. It is used by hobbyists with a single gecko through commercial breeders managing hundreds of animals.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is Geck Inspect free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Creating an account and using Geck Inspect is free. Premium membership tiers may unlock advanced features in the future, but the core collection tracking, breeding planning, and community features are free for all users.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can Geck Inspect identify the morph of my crested gecko?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Geck Inspect has an AI-powered morph identification feature. Upload a photo of your gecko and the model will return a classification of primary morph, secondary traits, and base color. The classifier is trained on thousands of verified crested gecko photos from the community.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does Geck Inspect help with breeding planning?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. You can plan pairings, track copulation events, schedule monthly egg checks, log eggs and incubation dates, auto-generate hatchling records when eggs hatch, and visualize multi-generation lineage trees and pedigree charts for any gecko in your collection.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I track my crested gecko collection?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Create a free account, then add each gecko with name, ID code, sex, hatch date, weight, morph tags, photos, and optionally the sire/dam lineage. Geck Inspect tracks weight history, photos over time, feeding group, and breeding history automatically. You can export your roster as CSV or PDF at any time.',
          },
        },
      ],
    },
  ],
};

export default function Home() {
  const { enterGuestMode, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleContinueAsGuest = () => {
    enterGuestMode();
    navigate(createPageUrl('Dashboard'));
  };

  // Hide the guest entry for already-signed-in users who just happen
  // to land on /Home — they don't need a second, weaker session.
  const showGuestCta = !isAuthenticated;

  return (
    <>
      <Seo
        title="Crested Gecko Collection, Breeding & Community Platform"
        description="Geck Inspect is the professional platform for crested gecko (Correlophus ciliatus) breeders and keepers. Track collections, plan breedings with lineage trees, log weights over time, identify morphs with AI, research genetics, sync with MorphMarket and Palm Street, and connect with a community of serious breeders."
        path="/"
        imageAlt="Geck Inspect — crested gecko breeding and collection platform"
        keywords={[
          'crested gecko app',
          'gecko breeding software',
          'Correlophus ciliatus platform',
          'crestie collection tracker',
          'reptile breeding software',
          'gecko lineage tree',
          'gecko morph ID AI',
          'crested gecko marketplace',
          'geckOS',
          'gecko breeder community',
          'reptile collection manager',
          'crested gecko genetics calculator',
        ]}
        jsonLd={LANDING_JSON_LD}
      />

      <div
        className="min-h-screen text-slate-100 relative"
        style={{ background: 'linear-gradient(135deg, #0a0f0a 0%, #1a2920 100%)' }}
      >
        {/* Jungle background — fixed so it parallax-feels as you scroll.
            Layered on top of the same 135deg gradient used by the
            authenticated app shell so the landing transition into the
            app feels continuous. Overlays (in order):
              1. The jungle photo itself
              2. A darkening slate tint to tame the photo's colors
              3. A vertical gradient for top/bottom text contrast
              4. A diagonal sage/emerald tint matching --gecko-surface */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src={BACKGROUND_IMAGE}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-70"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0" style={{ background: 'rgba(13, 31, 23, 0.78)' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d1f17]/95 via-[#0d1f17]/40 to-[#0d1f17]/95" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-transparent to-emerald-900/25" />
          {/* Subtle scale pattern matching the in-app .gecko-scale-pattern */}
          <div className="absolute inset-0 gecko-scale-pattern opacity-30" />
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
            <Link to={createPageUrl('Marketplace')} className="hover:text-emerald-300 transition-colors">
              Marketplace
            </Link>
            <Link to={createPageUrl('Shipping')} className="hover:text-emerald-300 transition-colors">
              Shipping
            </Link>
            <Link to={createPageUrl('Giveaways')} className="hover:text-emerald-300 transition-colors">
              Giveaways
            </Link>
          </nav>
          <Link to={createPageUrl('AuthPortal')}>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
              Sign In
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-300 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Welcome to <span className="font-bold">geckOS</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 bg-gradient-to-b from-white via-white to-emerald-200 bg-clip-text text-transparent">
            The ultimate gecko
            <br />
            operating system.
          </h1>
          <p className="text-xl md:text-2xl text-emerald-200/90 max-w-2xl mx-auto mb-4 font-medium">
            Every gecko in your collection, finally in one place.
          </p>
          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Track, breed, and identify crested geckos with a platform built specifically for the
            hobby. AI morph identification, breeding planning, lineage trees, community — your
            new <span className="font-semibold text-emerald-200">geckOS</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link to={createPageUrl('AuthPortal')}>
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base px-8 py-6 gecko-glow"
              >
                Create your account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to={createPageUrl('AuthPortal')}>
              <Button
                size="lg"
                variant="outline"
                className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold text-base px-8 py-6 backdrop-blur"
              >
                Sign In
              </Button>
            </Link>
          </div>
          {/* Secondary entry — no-signup tour. Guests get the public
              tabs fully interactive and the private ones in view-only
              mode, so they can evaluate the app before committing. */}
          {showGuestCta && (
            <div className="mt-5 flex flex-col items-center">
              <button
                type="button"
                onClick={handleContinueAsGuest}
                className="group inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/5 px-5 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-300/40 hover:text-emerald-100 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Continue as guest
                <span className="hidden sm:inline text-[11px] font-normal text-emerald-300/70">
                  (view-only)
                </span>
                <ArrowRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <p className="text-[11px] text-emerald-200/60 mt-2">
                Explore the full app without signing up. Saving requires a free account.
              </p>
            </div>
          )}
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
                  className="group gecko-card backdrop-blur p-6 transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center mb-4 group-hover:bg-emerald-500/25 group-hover:border-emerald-300/40 transition-colors">
                    <Icon className="w-6 h-6 text-emerald-300" />
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

        {/* Featured morphs — visual entry points into the per-morph pages.
            Each card hard-codes the slug so the landing page doesn't need
            a DB fetch, and the morph description is short and AI-friendly. */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
              <Dna className="w-3.5 h-3.5" />
              Featured morphs
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Explore the crested gecko morph universe
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              From classic Harlequins to rare Lilly Whites, every major morph has its own page with descriptions, rarity, key features, and breeding info.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { slug: 'harlequin',         name: 'Harlequin',         blurb: 'Extensive pattern on sides and legs' },
              { slug: 'pinstripe',         name: 'Pinstripe',         blurb: 'Raised dorsal scales running head to tail' },
              { slug: 'dalmatian',         name: 'Dalmatian',         blurb: 'Spots scattered across the body' },
              { slug: 'lilly-white',       name: 'Lilly White',       blurb: 'Co-dominant white body markings' },
              { slug: 'cappuccino',        name: 'Cappuccino',        blurb: 'Recessive coffee-brown color' },
              { slug: 'flame',             name: 'Flame',             blurb: 'Classic dorsal stripe morph' },
              { slug: 'brindle',           name: 'Brindle',           blurb: 'Fine chaotic marbled striping' },
              { slug: 'axanthic',          name: 'Axanthic',          blurb: 'Black, white, and gray only' },
            ].map((m) => (
              <Link
                key={m.slug}
                to={`/MorphGuide/${m.slug}`}
                className="group gecko-card p-5 transition-all"
              >
                <div className="text-sm font-bold text-white mb-1 group-hover:text-emerald-300 transition-colors">
                  {m.name}
                </div>
                <div className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                  {m.blurb}
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 group-hover:text-emerald-200">
                  Read guide
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/MorphGuide">
              <Button
                variant="outline"
                className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold backdrop-blur"
              >
                View all morphs
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Crested gecko context — this is valuable SEO/AI content */}
        <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
          <div className="gecko-card backdrop-blur p-8 md:p-12">
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
                including{' '}
                <Link to="/MorphGuide/harlequin" className="text-emerald-300 hover:text-emerald-200 font-semibold">Harlequin</Link>,{' '}
                <Link to="/MorphGuide/pinstripe" className="text-emerald-300 hover:text-emerald-200 font-semibold">Pinstripe</Link>,{' '}
                <Link to="/MorphGuide/dalmatian" className="text-emerald-300 hover:text-emerald-200 font-semibold">Dalmatian</Link>,{' '}
                <Link to="/MorphGuide/lilly-white" className="text-emerald-300 hover:text-emerald-200 font-semibold">Lilly White</Link>,{' '}
                <Link to="/MorphGuide/flame" className="text-emerald-300 hover:text-emerald-200 font-semibold">Flame</Link>,{' '}
                <Link to="/MorphGuide/brindle" className="text-emerald-300 hover:text-emerald-200 font-semibold">Brindle</Link>,{' '}
                <Link to="/MorphGuide/tiger" className="text-emerald-300 hover:text-emerald-200 font-semibold">Tiger</Link>,{' '}
                <Link to="/MorphGuide/cappuccino" className="text-emerald-300 hover:text-emerald-200 font-semibold">Cappuccino</Link>,
                and many more. Geck Inspect treats these as structured, searchable data rather
                than free-text descriptions, so you can finally answer questions like
                &ldquo;how many harlequin pinstripes are in my collection?&rdquo; or
                &ldquo;what&rsquo;s the lineage of this particular Lilly White?&rdquo;
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
                <Button variant="outline" className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold backdrop-blur">
                  <BookOpen className="w-4 h-4 mr-2 text-emerald-300" />
                  Care Guide
                </Button>
              </Link>
              <Link to={createPageUrl('MorphGuide')}>
                <Button variant="outline" className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold backdrop-blur">
                  <Dna className="w-4 h-4 mr-2 text-emerald-300" />
                  Morph Guide
                </Button>
              </Link>
              <Link to={createPageUrl('GeneticsGuide')}>
                <Button variant="outline" className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold backdrop-blur">
                  Genetics
                </Button>
              </Link>
              <Link to={createPageUrl('Gallery')}>
                <Button variant="outline" className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold backdrop-blur">
                  <Images className="w-4 h-4 mr-2 text-emerald-300" />
                  Community Gallery
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Visible FAQ — mirrors the FAQPage JSON-LD in LANDING_JSON_LD.
            Google requires the HTML content to match the structured data
            for rich result eligibility, so we render the same Q&A here. */}
        <section className="relative z-10 max-w-3xl mx-auto px-6 pb-24">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Frequently asked questions
            </h2>
            <p className="text-slate-400">
              Common questions about Geck Inspect and the crested gecko hobby.
            </p>
          </div>
          <div className="space-y-4">
            {[
              {
                q: 'What is Geck Inspect?',
                a: 'Geck Inspect is a free web platform built specifically for crested gecko keepers and breeders. It combines collection management, breeding planning, AI-powered morph identification, lineage tracking, a community gallery, a forum, and a verified marketplace into one tool. It is used by hobbyists with a single gecko through commercial breeders managing hundreds of animals.',
              },
              {
                q: 'Is Geck Inspect free?',
                a: 'Yes. Creating an account and using Geck Inspect is free. Premium membership tiers may unlock advanced features in the future, but the core collection tracking, breeding planning, and community features are free for all users.',
              },
              {
                q: 'Can Geck Inspect identify the morph of my crested gecko?',
                a: 'Yes. Geck Inspect has an AI-powered morph identification feature. Upload a photo of your gecko and the model will return a classification of primary morph, secondary traits, and base color. The classifier is trained on thousands of verified crested gecko photos from the community.',
              },
              {
                q: 'Does Geck Inspect help with breeding planning?',
                a: 'Yes. You can plan pairings, track copulation events, schedule monthly egg checks, log eggs and incubation dates, auto-generate hatchling records when eggs hatch, and visualize multi-generation lineage trees and pedigree charts for any gecko in your collection.',
              },
              {
                q: 'How do I track my crested gecko collection?',
                a: "Create a free account, then add each gecko with name, ID code, sex, hatch date, weight, morph tags, photos, and optionally the sire/dam lineage. Geck Inspect tracks weight history, photos over time, feeding group, and breeding history automatically. You can export your roster as CSV or PDF at any time.",
              },
            ].map((item, i) => (
              <details
                key={i}
                className="group gecko-card backdrop-blur-sm transition-colors"
              >
                <summary className="cursor-pointer list-none p-5 flex items-center justify-between gap-4">
                  <span className="text-base md:text-lg font-semibold text-white">
                    {item.q}
                  </span>
                  <span className="text-emerald-400 text-2xl leading-none flex-shrink-0 group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 pt-0 text-slate-300 leading-relaxed text-sm md:text-base">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Boot up your geckOS.
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Create a free account and start cataloging your collection in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Link to={createPageUrl('AuthPortal')}>
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base px-8 py-6 gecko-glow"
              >
                Get started — it&rsquo;s free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            {showGuestCta && (
              <button
                type="button"
                onClick={handleContinueAsGuest}
                className="group inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/5 px-5 py-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 hover:border-emerald-300/40 hover:text-emerald-100 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Continue as guest
              </button>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-slate-800/50 mt-12">
          <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Geck Inspect" className="h-6 w-6 rounded" />
              <span>© {new Date().getFullYear()} Geck Inspect · geckOS</span>
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
