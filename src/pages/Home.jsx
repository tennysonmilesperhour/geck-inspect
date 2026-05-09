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
  Egg,
  CalendarDays,
  Truck,
  Shield,
  ShieldCheck,
  Scale,
  FileSpreadsheet,
  BadgeCheck,
  QrCode,
  Lock,
  Smartphone,
  Download,
  Check,
  X,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import Testimonials from '@/components/landing/Testimonials';
import LiveStats from '@/components/landing/LiveStats';
import ProductTour from '@/components/landing/ProductTour';
import EmailCaptureCard from '@/components/landing/EmailCaptureCard';

const LOGO_URL =
  APP_LOGO_URL;

// Jungle hero background from Unsplash (free-license, hotlinking allowed).
// Sebastian Unrau's classic forest, dense, misty, reads as wild habitat
// once darkened with an overlay. Swap this URL for a more specifically
// tropical photo whenever you find one you like; the overlay will handle it.
const BACKGROUND_IMAGE =
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2400&q=80';

const FEATURES = [
  {
    icon: Dna,
    title: 'AI Morph Identification',
    desc: 'Upload a photo and get an instant classification of primary morph, secondary traits, and base color. The classifier is trained on thousands of verified crested geckos.',
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
    desc: 'Reference guides for every major crested gecko morph (Harlequin, Dalmatian, Pinstripe, Lilly White, Flame, Cream and more), alongside husbandry guides.',
  },
  {
    icon: Users,
    title: 'Community &amp; Forum',
    desc: 'Gallery, forum, direct messaging, and a verified expert network. Ask morph IDs, share projects, and connect with other serious keepers.',
  },
  {
    icon: ShoppingCart,
    title: 'Verified Marketplace',
    desc: 'Buy and sell crested geckos from keepers you can verify, with full lineage, weight history, and photo history attached to every listing.',
  },
];

const INNOVATIVE_FEATURES = [
  {
    icon: Egg,
    title: 'Egg &amp; Incubation Timeline',
    desc: 'Log every clutch, auto-track incubation days, and get hatch alerts. Eggs promote to hatchling records the day they emerge, lineage and clutch already wired up.',
  },
  {
    icon: CalendarDays,
    title: 'Season Planner',
    desc: 'Plan every pairing, feeding group, vet check, and cooldown for the season. Due-date notifications so nothing slips through on a 200-animal schedule.',
  },
  {
    icon: LineChartIcon,
    title: 'Market Analytics',
    desc: 'See which morph combos are actually moving, at what price, across regions. Real sales data from the hobby, not guesswork, not last year&rsquo;s wiki.',
  },
  {
    icon: Images,
    title: 'Photo Timeline per Gecko',
    desc: 'Every photo stays with its gecko. Watch a hatchling morph out into adulthood in one auto-advancing slideshow. This is the history a buyer actually wants to see.',
  },
  {
    icon: Truck,
    title: 'Built-in Reptile Shipping',
    desc: 'Breeder-tier accounts ship through integrated reptile-safe couriers. Rates, labels, and buyer notifications without a separate account or portal.',
  },
  {
    icon: Shield,
    title: 'Verified Expert Network',
    desc: 'Ask vetted breeders and morph specialists for IDs, breeding advice, or project planning. Expert status is earned through real contributions, not purchased.',
  },
  {
    icon: Scale,
    title: 'Lineage Pedigrees &amp; Transfers',
    desc: 'Every gecko carries a digital passport: parents, hatch date, weight history, photos. Transfer full provenance to the new owner when you sell, in one click.',
  },
  {
    icon: FileSpreadsheet,
    title: 'MorphMarket &amp; CSV Sync',
    desc: 'Import existing records from a spreadsheet, sync listings to MorphMarket and Palm Street, and export your whole roster to CSV or PDF whenever you want.',
  },
  {
    icon: Sparkles,
    title: 'Genetics &amp; Trait Projections',
    desc: 'Project punnett outcomes across co-dominant, recessive, and polygenic traits before you pair. Stop breeding blind. See the range of possible offspring first.',
  },
];

// Single source of truth for the landing FAQ. Both the visible section
// and the FAQPage JSON-LD below are derived from this array, Google
// requires the two to match for rich-result eligibility, so keep them
// in sync by editing this list only.
const LANDING_FAQS = [
  // Buyer-objection FAQs first, cost, lock-in, "vs spreadsheet", so the
  // top of the visible FAQ closes objections before scrolling into
  // capability questions. Order matters here for conversion; the JSON-LD
  // FAQPage schema is derived from this same array.
  {
    q: 'Is Geck Inspect free?',
    a: 'Yes. Creating an account and using Geck Inspect is free, including the genetics calculator, morph guide, care guide, community forum, and core collection tracking. Paid tiers (Keeper and Breeder) unlock larger collections, advanced breeding tools, marketplace sync, and white-label pedigree certificates, but you never need to pay to use the app.',
  },
  {
    q: 'Is my collection data private, and can I export it?',
    a: 'Yes. Your collection is private by default. Only geckos you explicitly publish to the gallery, forum, or marketplace are visible to other users. Data is stored on Supabase with row-level security so other users cannot read your records. You own your data and can export your full roster, weight history, breeding log, and photos as CSV or PDF at any time.',
  },
  {
    q: 'How is Geck Inspect better than a spreadsheet?',
    a: 'A spreadsheet stores text. Geck Inspect stores structured records that connect to each other. Every weight, photo, pairing, clutch, and lineage edge is queryable. You can ask "how many harlequin pinstripe females over 35 grams have I bred this season?" and get an answer. When you sell a gecko, the entire history (parents, weights, photos, medical notes) transfers as a verified digital passport with one click, something a spreadsheet cannot do for any buyer.',
  },
  {
    q: 'What is Geck Inspect?',
    a: 'Geck Inspect is a free web platform built specifically for crested gecko keepers and breeders. It combines collection management, breeding planning, AI-powered morph identification, lineage tracking, a community gallery, a forum, and a verified marketplace into one tool. It is used by hobbyists with a single gecko through commercial breeders managing hundreds of animals.',
  },
  {
    q: 'How do I track my crested gecko collection?',
    a: "Create a free account, then add each gecko with name, ID code, sex, hatch date, weight, morph tags, photos, and optionally the sire/dam lineage. Geck Inspect tracks weight history, photos over time, feeding group, and breeding history automatically. You can export your roster as CSV or PDF at any time.",
  },
  {
    q: 'Does Geck Inspect help with crested gecko breeding planning?',
    a: 'Yes. You can plan pairings, track copulation events, schedule monthly egg checks, log eggs and incubation dates, auto-generate hatchling records when eggs hatch, and visualize multi-generation lineage trees and pedigree charts for any gecko in your collection.',
  },
  {
    q: 'Can I track eggs, incubation, and hatch rates per clutch?',
    a: 'Yes. Every pairing has its own clutch log. Geck Inspect records lay date, incubation temperature, days-to-hatch, and outcome for each egg. Eggs promote to hatchling records the day they emerge, with lineage and clutch automatically attached, and season-level hatch-rate stats roll up on the breeding dashboard.',
  },
  {
    q: 'How does the crested gecko genetics calculator work?',
    a: 'The genetics calculator models co-dominant, recessive, and polygenic inheritance across the major crested gecko traits including Lilly White, Axanthic, Cappuccino, Super Dalmatian, Pinstripe, and Harlequin. Pick a sire and dam from your collection (or enter genotypes manually) and the calculator returns the full offspring distribution with expected percentages.',
  },
  {
    q: 'Can Geck Inspect identify the morph of my crested gecko?',
    a: 'Yes. Geck Inspect has an AI-powered morph identification feature. Upload a photo of your gecko and the model will return a classification of primary morph, secondary traits, and base color. The classifier is trained on thousands of verified crested gecko photos from the community.',
  },
  {
    q: 'How accurate is the AI crested gecko morph identifier?',
    a: 'The morph identifier performs well on common primary morphs (Harlequin, Pinstripe, Dalmatian, Flame, and base colors) and reports a confidence score with every prediction. For ambiguous animals, expressing traits (partial pin, dal spotting, tiger, brindle) are returned as secondary tags. You can always request a human second-opinion from the verified expert network inside the app.',
  },
  {
    q: 'Does Geck Inspect sync with MorphMarket or Palm Street?',
    a: 'Yes. You can import an existing roster from a CSV export, and Geck Inspect can push listings with photos, weight history, and lineage to MorphMarket and Palm Street without retyping. Sold animals can be transferred with full provenance to the buyer in one click.',
  },
  {
    q: 'Can I use Geck Inspect on my phone?',
    a: 'Yes. Geck Inspect is a responsive web app designed to work on any modern phone or tablet browser. No app store install required. You can also "Add to Home Screen" on iOS or Android to get a full-screen icon that behaves like a native app, and photo uploads use the device camera directly.',
  },
  {
    q: 'How long do crested geckos live?',
    a: 'In captivity, crested geckos (Correlophus ciliatus) routinely live 15 to 20 years with proper husbandry, and some well-kept animals have reached their mid-20s. Geck Inspect is built with that long lifespan in mind. Weight history, photo timelines, and breeding records persist for the entire life of each gecko.',
  },
  {
    q: 'What are the most popular crested gecko morphs?',
    a: 'The most common primary morphs are Harlequin, Pinstripe, Dalmatian, Flame, and Patternless, often combined with base colors like red, olive, chocolate, buckskin, and yellow. High-demand recessive and co-dominant traits include Lilly White, Axanthic, Cappuccino, and Super Dalmatian. The in-app Morph Guide has photo-led references for every major morph.',
  },
  {
    q: 'Does Geck Inspect support other reptiles besides crested geckos?',
    a: 'Geck Inspect is purpose-built for crested geckos (Correlophus ciliatus) right now. The AI morph ID, genetics calculator, and morph guide are all tuned for the species. Support for gargoyle geckos (Rhacodactylus auriculatus) and Leachianus is on the roadmap; other reptiles are not currently planned.',
  },
];

const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://geckinspect.com/#webpage',
      name: 'Geck Inspect: Crested Gecko Collection, Breeding & Community Platform',
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
      mainEntity: LANDING_FAQS.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
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
  // to land on /Home, they don't need a second, weaker session.
  const showGuestCta = !isAuthenticated;

  return (
    <>
      <Seo
        title="Crested Gecko Collection, Breeding & Community Platform"
        description="Geck Inspect is the professional platform for crested gecko (Correlophus ciliatus) breeders and keepers. Track collections, plan breedings with lineage trees, log weights over time, identify morphs with AI, research genetics, sync with MorphMarket and Palm Street, and connect with a community of serious breeders."
        path="/"
        imageAlt="Geck Inspect, crested gecko breeding and collection platform"
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
        className="landing-font min-h-screen text-slate-100 relative"
        style={{ background: 'linear-gradient(135deg, #0a0f0a 0%, #1a2920 100%)' }}
      >
        {/* Jungle background, fixed so it parallax-feels as you scroll.
            Overlay is neutral black (not green-tinted) so the forest
            photo reads as a real photo rather than a uniformly
            green-washed surface, and section accent colors below pop
            against it. Overlays (in order):
              1. The jungle photo itself
              2. A neutral black tint to tame the photo and protect text contrast
              3. A vertical gradient for top/bottom text contrast */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src={BACKGROUND_IMAGE}
            alt="Lush tropical rainforest canopy, the natural habitat of the crested gecko (Correlophus ciliatus) in New Caledonia."
            className="w-full h-full object-cover opacity-80"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.65)' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/25 to-black/85" />
          {/* Subtle scale pattern matching the in-app .gecko-scale-pattern */}
          <div className="absolute inset-0 gecko-scale-pattern opacity-25" />
        </div>

        {/* Top nav */}
        <header className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={LOGO_URL} alt="Geck Inspect" className="h-10 w-10 rounded-md" />
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
            Welcome To The <span className="font-bold">Geck OS</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 bg-gradient-to-b from-white via-white to-emerald-200 bg-clip-text text-transparent">
            Track, breed, and verify
            <br />
            your crested geckos.
          </h1>
          <p className="text-xl md:text-2xl text-emerald-200/90 max-w-2xl mx-auto mb-4 font-medium">
            Every gecko, every clutch, every gene. In one place.
          </p>
          <p className="text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed bg-gradient-to-b from-sky-200 via-sky-300 to-blue-500 bg-clip-text text-transparent">
            The crested gecko platform built for the way breeders actually work: AI morph ID, multi-trait
            breeding projections, lineage trees, digital pedigrees buyers can verify, marketplace analytics
            and trends, social-media posting assistance and automation, and a gecko quality scoring rubric.
            Your new <span className="font-semibold text-emerald-200">geckOS</span>.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {showGuestCta ? (
              <Button
                size="lg"
                onClick={handleContinueAsGuest}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base px-8 py-6 gecko-glow"
              >
                Try Now for Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Link to={createPageUrl('Dashboard')}>
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base px-8 py-6 gecko-glow"
                >
                  Open your dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
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
          <p className="text-xs text-slate-500 mt-6">
            No credit card required. Saving requires a free account, and your collection stays yours.
          </p>
        </section>

        {/* Hero product preview, sits between the CTA copy and the
            trust strip so a visitor scrolling sees a tangible "this is
            what you'd be using" before the trust signals. */}
        <ProductTour />

        {/* Trust strip in its own section now that the slideshow has
            been hoisted out of the hero. Visual order on the page is
            still hero, slideshow, trust, stats, features. */}
        <section className="relative z-10 max-w-5xl mx-auto px-6 pb-12 -mt-6">
          {/* Trust strip, short, scannable proof points addressing the
              three buyer objections (privacy, lock-in, install). Appears
              just under the hero so cold visitors see them before
              scrolling into features. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-3xl mx-auto">
            <div className="flex items-start gap-3 rounded border border-sky-500/25 bg-sky-950/30 backdrop-blur px-4 py-3">
              <Lock className="w-5 h-5 text-sky-300 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-white">Private by default</div>
                <div className="text-xs text-slate-400 leading-snug">Row-level security on every record. Only what you publish is public.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded border border-sky-500/25 bg-sky-950/30 backdrop-blur px-4 py-3">
              <Download className="w-5 h-5 text-sky-300 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-white">Yours to export</div>
                <div className="text-xs text-slate-400 leading-snug">Roster, weights, photos, lineage. CSV or PDF, anytime. No lock-in.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded border border-sky-500/25 bg-sky-950/30 backdrop-blur px-4 py-3">
              <Smartphone className="w-5 h-5 text-sky-300 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-semibold text-white">Works on every phone</div>
                <div className="text-xs text-slate-400 leading-snug">Add to home screen on iOS or Android. No app store required.</div>
              </div>
            </div>
          </div>
        </section>

        {/* Live stats strip pulls real counts via the public.landing_stats
            RPC. Self-hides if any number is below the credibility floor. */}
        <LiveStats />

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
            {FEATURES.map((f, idx) => {
              const Icon = f.icon;
              // Two complementary cool tones across the two rows of three.
              // Row 1 (idx 0-2): sky (clean tech-blue, echoes the trust strip).
              // Row 2 (idx 3-5): teal (cool green-blue bridge).
              // Distinct from the amber/rose/violet trio used by the
              // INNOVATIVE_FEATURES grid below so the two sections read
              // as distinct sets, not one long undifferentiated wall.
              const FEATURE_ROW_TONES = [
                {
                  tint: 'card-tint-sky',
                  iconBox: 'bg-sky-500/15 border-sky-400/25 group-hover:bg-sky-500/25 group-hover:border-sky-300/40',
                  iconText: 'text-sky-300',
                },
                {
                  tint: 'card-tint-teal',
                  iconBox: 'bg-teal-500/15 border-teal-400/25 group-hover:bg-teal-500/25 group-hover:border-teal-300/40',
                  iconText: 'text-teal-300',
                },
              ];
              const tone = FEATURE_ROW_TONES[Math.floor(idx / 3)] || FEATURE_ROW_TONES[0];
              return (
                <div
                  key={f.title}
                  className={`group gecko-card ${tone.tint} backdrop-blur p-6 transition-all duration-200`}
                >
                  <div className={`w-12 h-12 rounded-md border flex items-center justify-center mb-4 transition-colors ${tone.iconBox}`}>
                    <Icon className={`w-6 h-6 ${tone.iconText}`} />
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

        {/* Second feature grid, the innovative/unique capabilities that
            differentiate Geck Inspect from a spreadsheet or a generic
            reptile app. Same card style as the first grid so the first
            few scrolls read as one confident feature tour. */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Built for the hobby, not adapted to it
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Tools you won&rsquo;t find anywhere else
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Every feature is built around how keepers and breeders actually work, from a single hatchling&rsquo;s first weigh-in to a 200-animal breeding season.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {INNOVATIVE_FEATURES.map((f, idx) => {
              const Icon = f.icon;
              // Three complementary tones across the three rows of three.
              // Row 1 (idx 0–2): amber/gold (warm).
              // Row 2 (idx 3–5): rose (warm-pink).
              // Row 3 (idx 6–8): violet (cool purple).
              // Tailwind classes are written out as full literals so the
              // JIT compiler picks them up.
              const ROW_TONES = [
                {
                  tint: 'card-tint-amber',
                  iconBox: 'bg-amber-500/15 border-amber-400/25 group-hover:bg-amber-500/25 group-hover:border-amber-300/40',
                  iconText: 'text-amber-300',
                },
                {
                  tint: 'card-tint-rose',
                  iconBox: 'bg-rose-500/15 border-rose-400/25 group-hover:bg-rose-500/25 group-hover:border-rose-300/40',
                  iconText: 'text-rose-300',
                },
                {
                  tint: 'card-tint-violet',
                  iconBox: 'bg-violet-500/15 border-violet-400/25 group-hover:bg-violet-500/25 group-hover:border-violet-300/40',
                  iconText: 'text-violet-300',
                },
              ];
              const tone = ROW_TONES[Math.floor(idx / 3)] || ROW_TONES[0];
              return (
                <div
                  key={f.title}
                  className={`group gecko-card ${tone.tint} backdrop-blur p-6 transition-all duration-200`}
                >
                  <div className={`w-12 h-12 rounded-md border flex items-center justify-center mb-4 transition-colors ${tone.iconBox}`}>
                    <Icon className={`w-6 h-6 ${tone.iconText}`} />
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

        {/* Verifiable pedigrees, the buyer-trust angle. Surfaces the
            AnimalPassport / lineage-transfer machinery that already
            exists in the app but never got marketed on the landing page.
            This is the section a prospective buyer browsing a seller's
            listing should read. */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300 mb-4">
              <BadgeCheck className="w-3.5 h-3.5" />
              For breeders &amp; buyers
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Pedigrees buyers can verify
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Every gecko gets a digital passport. When you sell, the new owner inherits the full
              history (parents, weights, photos, medical notes) with a scannable QR. No more
              screenshots. No more &ldquo;trust me.&rdquo;
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pedigrees row tints: one distinct hue per card so the
                three trust facets read as three pillars, not one block.
                Hues are pulled from the not-yet-used end of the
                landing palette (emerald, lime, fuchsia) so they don't
                collide with the FEATURES (sky/teal) or INNOVATIVE
                (amber/rose/violet) grids above. */}
            <div className="group gecko-card card-tint-emerald backdrop-blur p-6 transition-all duration-200">
              <div className="w-12 h-12 rounded-md bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center mb-4 transition-colors group-hover:bg-emerald-500/25 group-hover:border-emerald-300/40">
                <QrCode className="w-6 h-6 text-emerald-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Animal Passport</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                A scannable, public-by-permission record of every gecko: parents, hatch date, weight
                history, every photo it&rsquo;s ever had, and notes. Ship it as a QR card with the
                animal.
              </p>
            </div>
            <div className="group gecko-card card-tint-lime backdrop-blur p-6 transition-all duration-200">
              <div className="w-12 h-12 rounded-md bg-lime-500/15 border border-lime-400/25 flex items-center justify-center mb-4 transition-colors group-hover:bg-lime-500/25 group-hover:border-lime-300/40">
                <ShieldCheck className="w-6 h-6 text-lime-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">One-click ownership transfer</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Sold an animal? Issue a claim link, the buyer creates an account, and the entire
                provenance (lineage, weights, photos) moves with it. The history persists across
                owners for life.
              </p>
            </div>
            <div className="group gecko-card card-tint-fuchsia backdrop-blur p-6 transition-all duration-200">
              <div className="w-12 h-12 rounded-md bg-fuchsia-500/15 border border-fuchsia-400/25 flex items-center justify-center mb-4 transition-colors group-hover:bg-fuchsia-500/25 group-hover:border-fuchsia-300/40">
                <BadgeCheck className="w-6 h-6 text-fuchsia-300" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Build a verifiable reputation</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your public breeder profile shows real animals you&rsquo;ve produced and transferred,
                not just listings. Buyers see lineage they can trace back. Reputation, in data, not
                screenshots.
              </p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link to={createPageUrl('MarketplaceVerification')}>
              <Button
                variant="outline"
                className="bg-sky-950/40 text-sky-100 hover:bg-sky-900/60 hover:text-white border-sky-500/40 font-semibold backdrop-blur"
              >
                How marketplace verification works
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Comparison block, directly contrasts the three options a
            keeper actually considers (spreadsheet, generic reptile app,
            Geck Inspect). Drives conversion by naming the pain in a
            spreadsheet and the gap in a generic app. */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Built for the crested gecko hobby
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              A spreadsheet stores text. A generic reptile app stores generic records. Geck Inspect
              speaks crestie.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="text-left">
                  <th className="p-4 font-semibold text-slate-400">&nbsp;</th>
                  <th className="p-4 font-semibold text-slate-400 border-b border-slate-800">Spreadsheet</th>
                  <th className="p-4 font-semibold text-slate-400 border-b border-slate-800">Generic reptile app</th>
                  <th className="p-4 font-semibold text-emerald-300 border-b border-emerald-500/30 bg-emerald-500/5 rounded-t-lg">Geck Inspect</th>
                </tr>
              </thead>
              <tbody className="text-slate-300">
                {[
                  ['Crested-specific morphs', 'Free text', 'Generic morph list', '33 crested morphs, structured'],
                  ['Multi-trait genetics calculator', 'Manual Punnett squares', 'Single trait at a time', 'Multi-trait + Monte Carlo simulator'],
                  ['Lineage on every animal', 'One sheet per generation', 'Limited tree depth', 'Full multi-generation tree, drag to explore'],
                  ['Pedigree transfers to buyers', 'PDF if you remember', 'Not supported', 'One-click verifiable digital passport'],
                  ['Marketplace sync', 'Re-type each listing', 'Internal only', 'Push to MorphMarket &amp; Palm Street'],
                  ['Photo timeline per animal', 'A folder somewhere', 'Single photo', 'Auto-advancing slideshow from hatchling to adult'],
                  ['Built for the species', 'Built for nothing', 'Built for everything', 'Built for crested geckos and only crested geckos'],
                ].map(([row, sheet, generic, gi], i) => (
                  <tr key={i} className="border-b border-slate-800/60">
                    <td className="p-4 font-semibold text-white">{row}</td>
                    <td className="p-4 text-slate-400">
                      <X className="w-4 h-4 text-slate-600 inline mr-2" />
                      <span className="text-xs">{sheet}</span>
                    </td>
                    <td className="p-4 text-slate-400">
                      <X className="w-4 h-4 text-slate-600 inline mr-2" />
                      <span className="text-xs">{generic}</span>
                    </td>
                    <td className="p-4 text-slate-200 bg-emerald-500/5 border-l border-r border-emerald-500/20">
                      <Check className="w-4 h-4 text-emerald-400 inline mr-2" />
                      <span className="text-xs" dangerouslySetInnerHTML={{ __html: gi }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Email capture lead-magnet, sends Care Guide and Genetics
            Guide PDFs via Resend. Recorded in newsletter_subscribers.
            Sits after the comparison block so visitors who've already
            seen the differentiation can opt in for a deeper read. */}
        <EmailCaptureCard source="homepage" />

        {/* Testimonials, self-hides until at least 3 approved quotes
            exist in the testimonials table. Curated via the admin tab. */}
        <Testimonials />

        {/* Crested gecko context, this is valuable SEO/AI content */}
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
                during feeding rounds, and the reference you come back to every time you&rsquo;re
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

          {/* Multi-species roadmap callout, sets expectations for visitors
              who arrive looking for gargoyle / leachianus support, and
              keeps them in the funnel by making clear the upgrade path
              is included with their existing account. */}
          <div className="mt-6 rounded-md border border-amber-500/25 bg-amber-950/20 backdrop-blur p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded bg-amber-500/15 border border-amber-400/25 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Crested-only today. Gargoyle &amp; Leachianus next.
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Geck Inspect is purpose-built for crested geckos right now. The AI morph ID,
                  genetics calculator, and morph guide are all tuned for <em>Correlophus ciliatus</em>.
                  Support for gargoyle geckos (<em>Rhacodactylus auriculatus</em>) and Leachianus
                  (<em>Rhacodactylus leachianus</em>) is on the roadmap. Sign up now and you&rsquo;ll
                  get the species upgrade for free when it ships.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Visible FAQ, mirrors the FAQPage JSON-LD in LANDING_JSON_LD.
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
            {LANDING_FAQS.map((item, i) => (
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
          <p className="text-slate-400 mb-3 text-lg">
            Create a free account and start cataloging your collection in minutes.
          </p>
          <p className="text-emerald-200/70 mb-8 text-sm flex items-center justify-center gap-2">
            <Smartphone className="w-4 h-4" />
            Add to your iOS or Android home screen, full-screen, like a native app, no app store needed.
          </p>
          <div className="flex justify-center items-center">
            {showGuestCta ? (
              <Button
                size="lg"
                onClick={handleContinueAsGuest}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base px-8 py-6 gecko-glow"
              >
                Try Now for Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Link to={createPageUrl('Dashboard')}>
                <Button
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base px-8 py-6 gecko-glow"
                >
                  Open your dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </section>

        {/* Footer, dense internal linking to every top-level public
            surface. Crawlers pulling just the homepage now reach every
            programmatic hub and content page within one hop. */}
        <footer className="relative z-10 border-t border-slate-800/50 mt-12">
          <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
            <div className="col-span-2">
              <div className="flex items-center gap-3">
                <img src={LOGO_URL} alt="Geck Inspect" className="h-8 w-8 rounded" />
                <span className="font-bold text-slate-100">Geck Inspect</span>
              </div>
              <p className="text-slate-500 mt-3 leading-relaxed max-w-md">
                The professional platform for crested gecko (<em>Correlophus ciliatus</em>) breeders and keepers.
              </p>
              <div className="flex gap-4 mt-4">
                <a href="https://www.instagram.com/the.gecko.garden/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 transition-colors" aria-label="The Gecko Garden on Instagram">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="https://www.instagram.com/the.reptile.garden/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-emerald-400 transition-colors" aria-label="The Reptile Garden on Instagram">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Reference</div>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/MorphGuide" className="hover:text-white">Morph Guide</Link></li>
                <li><Link to="/CareGuide" className="hover:text-white">Care Guide</Link></li>
                <li><Link to="/GeneticsGuide" className="hover:text-white">Genetics Guide</Link></li>
                <li><Link to="/calculator" className="hover:text-white">Genetics Calculator</Link></li>
                <li><Link to="/blog" className="hover:text-white">Blog</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Browse morphs</div>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/MorphGuide/category/pattern" className="hover:text-white">Pattern morphs</Link></li>
                <li><Link to="/MorphGuide/category/base" className="hover:text-white">Base colors</Link></li>
                <li><Link to="/MorphGuide/inheritance/recessive" className="hover:text-white">Recessive morphs</Link></li>
                <li><Link to="/MorphGuide/inheritance/co-dominant" className="hover:text-white">Co-dominant morphs</Link></li>
                <li><Link to="/MorphGuide/inheritance/polygenic" className="hover:text-white">Polygenic morphs</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Company</div>
              <ul className="space-y-2 text-slate-400">
                <li><Link to="/About" className="hover:text-white">About</Link></li>
                <li><Link to="/Contact" className="hover:text-white">Contact</Link></li>
                <li><Link to="/MarketplaceVerification" className="hover:text-white">Marketplace Trust</Link></li>
                <li><Link to="/Terms" className="hover:text-white">Terms</Link></li>
                <li><Link to="/PrivacyPolicy" className="hover:text-white">Privacy</Link></li>
                <li><Link to={createPageUrl('AuthPortal')} className="hover:text-white">Sign in</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800/50">
            <div className="max-w-6xl mx-auto px-6 py-5 text-xs text-slate-500 flex flex-col md:flex-row items-center justify-between gap-2">
              <span>© {new Date().getFullYear()} Geck Inspect · geckOS</span>
              <span>Built for the crested gecko hobby.</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}