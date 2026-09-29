import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { captureEvent } from '@/lib/posthog';
import '@/styles/layout-theme.css';
import {
  Dna,
  GitBranch,
  DollarSign,
  Sparkles,
  BookOpen,
  Images,
  ArrowRight,
  Egg,
  Scale,
  Wallet,
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

// Header and footer show the mark at 32 to 40 px. The 600 px master
// (APP_LOGO_URL in constants, still used for Open Graph and schema) is
// 170 KB; this 96 px copy is 8 KB.
const LOGO_URL = '/logo-96.png';

// Jungle hero background from Unsplash (free-license, hotlinking allowed).
// Sebastian Unrau's classic forest, dense, misty, reads as wild habitat
// once darkened with an overlay. Swap this URL for a more specifically
// tropical photo whenever you find one you like; the overlay will handle it.
// Self-hosted WebP (launch review F30). The photo used to be hotlinked
// from Unsplash at 2,400 px for every screen; it now ships from our own
// origin at three widths so a phone downloads about 45 KB instead of a
// megabyte, and the request needs no third-party DNS lookup or TLS
// handshake. Source: Unsplash photo 1441974231531-c6227db76b6e (Unsplash
// licence, free to use). Regenerate with cwebp at q=62 from a 2,400 px
// JPEG export, see docs/planning/launch-review-2026-09-04.md (F30).
const BACKGROUND_IMAGE_WIDTHS = [800, 1600, 2400];
const heroImagePath = (w) => `/hero/crested-gecko-hero-${w}.webp`;
const BACKGROUND_IMAGE = heroImagePath(2400);
// One candidate per width so a phone downloads the 640 px file, not the
// 2400 px one. Keep in sync with the preload in scripts/prerender.mjs.
const BACKGROUND_IMAGE_SRCSET = BACKGROUND_IMAGE_WIDTHS.map((w) => `${heroImagePath(w)} ${w}w`).join(', ');

// Public, free reference/tool pages surfaced on the homepage. Anchor text
// is written to match how people search (morph calculator, breeding
// calculator, pedigree tracker, breeding records) so these internal links
// reinforce the target queries for each destination page.
const TOOL_LINKS = [
  {
    to: '/calculator',
    icon: Dna,
    title: 'Morph & Breeding Calculator',
    desc: 'Predict offspring morphs from any pairing. Punnett-square genetics for Lilly White, Cappuccino, Axanthic, and Soft Scale. No signup.',
  },
  {
    to: '/pedigree-tracker',
    icon: GitBranch,
    title: 'Pedigree Tracker',
    desc: 'Build a multi-generation family tree, follow het carriers down the line, and share a verified lineage with buyers.',
  },
  {
    to: '/breeding-records',
    icon: Egg,
    title: 'Breeding Records',
    desc: 'A digital breeding log and clutch tracker: pairings, egg-lay and hatch dates, incubation, and per-offspring outcomes.',
  },
  {
    to: '/MorphGuide',
    icon: Images,
    title: 'Morph Guide',
    desc: 'Every documented crested gecko morph, from Harlequin and Dalmatian to Lilly White and Axanthic, with inheritance and rarity.',
  },
  {
    to: '/CareGuide',
    icon: BookOpen,
    title: 'Care Guide',
    desc: 'Housing, temperature and humidity, diet, handling, shedding, and breeding readiness for Correlophus ciliatus.',
  },
  {
    to: '/GeneticsGuide',
    icon: Sparkles,
    title: 'Genetics Guide',
    desc: 'From Punnett squares to proving recessives: how Lilly White, Cappuccino, Axanthic, and Soft Scale actually inherit.',
  },
  {
    to: '/QualityScale',
    icon: Scale,
    title: 'Quality Scale',
    desc: 'A free 10-point rubric for grading a crested gecko on structure, head, pattern, and color, and seeing what it is worth.',
  },
  {
    to: '/crested-gecko-price',
    icon: DollarSign,
    title: 'Price Guide',
    desc: 'How much is my crested gecko worth? Market ranges by morph and quality, from common animals to Lilly White and Axanthic.',
  },
];

// The three landing sections (DECISIONS.md 32: the business side of
// breeding for new and small crested gecko breeders). Numbers in the
// visuals are real: asking-price bands from public.trait_value_table()
// and the pairing value math in src/lib/pairingValue.js, September 2026.
const BUSINESS_SECTIONS = [
  {
    id: 'worth',
    eyebrow: 'Know what it’s worth',
    icon: Wallet,
    title: 'Price every gecko from real listings',
    lead: 'Guessing is how a new breeder undersells a Lilly White or sits on a Harlequin nobody buys. Geck Inspect prices each gecko from thousands of crested gecko listings with the same traits, age and sex.',
    points: [
      'A value estimate and typical range on every gecko you own, free on every plan.',
      'Your Portfolio adds up the whole collection and tracks its value over time.',
      'Asking-price ranges for every trait, by age and sex.',
      'When you list a gecko, see where your price sits against geckos like it.',
    ],
  },
  {
    id: 'pair',
    eyebrow: 'Pair for profit',
    icon: Dna,
    title: 'See what a pairing’s eggs are worth before you pair',
    lead: 'Pick a sire and dam from your collection. Geck Inspect works out the odds for every baby and prices each outcome at what hatchlings with those traits list for.',
    points: [
      'Offspring odds for Lilly White, Cappuccino, Axanthic, Soft Scale, Harlequin, Pinstripe and more.',
      'Expected value per egg on every breeding plan, next to the costs you tied to that pairing.',
      'Lethal combinations like Lilly White x Lilly White are flagged and counted at $0.',
      'Readiness badges show which females are at the weight and age to breed.',
    ],
  },
  {
    id: 'sell',
    eyebrow: 'Sell with proof',
    icon: BadgeCheck,
    title: 'Hand every buyer the full history, and see what you made',
    lead: 'A buyer can check a gecko’s parents, weights and photos for themselves, and the record moves to their account when you sell.',
    points: [
      'A passport for every gecko: parents, hatch date, weights and photos behind a QR code.',
      'A one-page buyer packet PDF with the photo, lineage, weights, feeding notes and passport QR.',
      'One-click ownership transfer, plus a file for MorphMarket bulk import when you list.',
      'Record what each gecko sold for and see profit by season and by pairing.',
    ],
  },
];

// Everything else gets one line each (DECISIONS.md 13: no feature grids).
const ALSO_INCLUDED = [
  'AI Morph ID (your first one is free)',
  'Weight and growth tracking',
  'Egg and incubation timeline',
  'Multi-generation lineage',
  'Feeding reminders',
  'Morph, care and genetics guides',
  'Community forum and gallery',
  'CSV and PDF export',
];

function VisualFrame({ label, children, caption }) {
  return (
    <div className="gecko-card backdrop-blur p-5 md:p-6 w-full max-w-md mx-auto">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">{label}</p>
      {children}
      {caption && <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">{caption}</p>}
    </div>
  );
}

function ValueVisual() {
  // Lilly White, adult female band: p25 $395, median $600, p75 $800, 59 listings.
  const low = 395, mid = 600, high = 800, max = 1000;
  const pct = (v) => `${(v / max) * 100}%`;
  return (
    <VisualFrame
      label="Value estimate"
      caption="Real listing data, September 2026. Asking prices, not sale prices."
    >
      <p className="text-sm text-slate-300">Lilly White female, adult</p>
      <p className="text-4xl font-bold text-emerald-300 mt-1 tabular-nums">$600</p>
      <p className="text-sm text-slate-400">Typical range $395 to $800</p>
      <div className="relative h-2.5 bg-slate-800 rounded-full mt-4">
        <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-emerald-700 to-emerald-400" style={{ left: pct(low), width: `calc(${pct(high)} - ${pct(low)})` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-emerald-400" style={{ left: `calc(${pct(mid)} - 6px)` }} />
      </div>
      <p className="text-xs text-slate-500 mt-3">59 comparable listings, matched on trait, age and sex</p>
    </VisualFrame>
  );
}

function PairingVisual() {
  // pairingEggValue(Lilly White Harlequin sire, Pinstripe dam), Sept 2026 hatchling bands.
  const rows = [
    ['50%', 'Lilly White', '$250'],
    ['25%', 'Pinstripe', '$150'],
    ['12.5%', 'Harlequin', '$120'],
    ['12.5%', 'No listed trait', '$65'],
  ];
  return (
    <VisualFrame
      label="Pairing value"
      caption="Genetics calculator odds times median hatchling asking prices."
    >
      <p className="text-sm text-slate-300">Lilly White Harlequin &times; Pinstripe</p>
      <p className="text-4xl font-bold text-emerald-300 mt-1 tabular-nums">$186</p>
      <p className="text-sm text-slate-400">expected per egg</p>
      <ul className="mt-4 space-y-1.5">
        {rows.map(([share, trait, price]) => (
          <li key={trait} className="flex justify-between text-sm">
            <span className="text-slate-300"><span className="tabular-nums text-slate-400 mr-2">{share}</span>{trait}</span>
            <span className="text-slate-400 tabular-nums">{price} each</span>
          </li>
        ))}
      </ul>
    </VisualFrame>
  );
}

function PacketVisual() {
  const rows = [
    ['Sire', 'Zeus, Pinstripe'],
    ['Dam', 'Mango, Lilly White'],
    ['Latest weight', '24 g'],
    ['Diet', 'Complete diet, every 3 days'],
  ];
  return (
    <VisualFrame label="Buyer packet (example)" caption="One PDF per sale, plus a passport link that stays live for the new owner.">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold text-white">Pip</p>
          <p className="text-sm text-slate-400">Lilly White Harlequin, female</p>
        </div>
        <div className="w-14 h-14 rounded-md bg-white flex items-center justify-center shrink-0">
          <QrCode className="w-10 h-10 text-slate-900" />
        </div>
      </div>
      <dl className="mt-4 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm gap-3">
            <dt className="text-slate-500">{k}</dt>
            <dd className="text-slate-200 text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </VisualFrame>
  );
}

const SECTION_VISUALS = { worth: ValueVisual, pair: PairingVisual, sell: PacketVisual };

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
    a: 'Yes. Creating an account and using Geck Inspect is free, including the genetics calculator, morph guide, care guide, community forum, and core collection tracking. Paid tiers (Keeper and Breeder) unlock larger collections, advanced breeding tools, MorphMarket CSV export, and white-label pedigree certificates, but you never need to pay to use the app.',
  },
  {
    q: 'Can Geck Inspect track my breeding costs and profit?',
    a: 'Yes. Business Tools records every sale and cost. When you mark a gecko sold you enter what it sold for, and a priced ownership transfer counts as a sale too. Costs can be tied to a pairing or to one gecko, and the Profit tab shows revenue, costs and profit by season and by pairing. Each breeding plan also shows what an egg from that pairing is worth on average, from the genetics odds and real hatchling asking prices.',
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
    a: 'Geck Inspect is a web app for crested gecko breeders, built for the business side of breeding: what each gecko is worth, what a pairing\'s eggs should bring, what each season made, and proof of lineage for buyers. It also covers collection records, weights, breeding plans and eggs, lineage trees, AI-assisted morph identification (your first identification is free), morph and care guides, and a community forum. It is free to start and works for a keeper with one gecko as well as a breeder with hundreds.',
  },
  {
    q: 'How do I track my crested gecko collection?',
    a: "Create a free account, then add each gecko with name, ID code, sex, hatch date, weight, morph tags, photos, and optionally the sire/dam lineage. Geck Inspect tracks weight history, photos over time, feeding group, and breeding history automatically. You can export your roster as CSV or PDF at any time.",
  },
  {
    q: 'Can Geck Inspect tell me what my crested gecko is worth?',
    a: 'Yes, and it is free on every plan. Add a gecko with its morph traits (Lilly White, Harlequin, Axanthic, and so on) and Geck Inspect estimates its value from asking prices on real crested gecko listings, narrowed to animals of the same age and sex when there are enough of them. The most valuable trait sets the price, and a Quality Scale grade moves the estimate within the typical range. Each gecko page shows its estimate and range, and the Portfolio totals your collection and tracks its value over time. Estimates are market comparisons, not formal appraisals.',
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
    a: 'Yes. Geck Inspect has an AI-assisted visual identification feature for crested geckos. Upload a top view and a side view (and up to three more photos if you have them) and it returns a ranked morph shortlist, visible traits, photo-quality feedback, and the evidence behind the leading candidate. It also lets you submit a correction for independent expert review.',
  },
  {
    q: 'How accurate is the AI crested gecko morph identifier?',
    a: 'Morph ID is an identification aid, not a substitute for lineage records or an expert assessment. It ranks visual candidates and cites visible markers instead of presenting its model score as accuracy. Ambiguous or poor-quality submissions are marked tentative or held for better photos, and user corrections stay unverified until an approved expert reviews the full label set.',
  },
  {
    q: 'Does Geck Inspect sync with MorphMarket or Palm Street?',
    a: 'You can import a roster from CSV and export a file for MorphMarket’s bulk importer. You upload that file to MorphMarket yourself. Automatic marketplace syncing and Palm Street publishing are not available. For a sale, create a transfer invitation so the buyer can accept the animal and its history.',
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
    a: 'Geck Inspect is built for crested geckos (Correlophus ciliatus). The AI morph ID, genetics calculator, and morph guide are all tuned for the species. If you keep a few other reptiles, you can log basic records for them alongside your crested geckos, but every tool is designed around cresties first.',
  },
];

const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      '@id': 'https://geckinspect.com/#webpage',
      name: 'Geck Inspect: Crested Gecko Breeding App for Pricing, Pairings and Sales',
      url: 'https://geckinspect.com/',
      description:
        'The crested gecko (Correlophus ciliatus) app for the business side of breeding, built for new and small breeders: value estimates from real listings, expected value per egg for every pairing, profit by season and pairing, verifiable pedigrees and buyer packets, plus collection records, lineage, and AI morph identification.',
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

  const handleContinueAsGuest = (cta = 'hero') => {
    captureEvent('landing_cta_clicked', { cta, target: 'guest' });
    enterGuestMode();
    navigate(createPageUrl('Dashboard'));
  };

  // Hide the guest entry for already-signed-in users who just happen
  // to land on /Home, they don't need a second, weaker session.
  const showGuestCta = !isAuthenticated;

  return (
    <>
      <Seo
        title="Crested Gecko Breeding App: Pricing, Pairings and Sales"
        description="Geck Inspect is the crested gecko app for the business side of breeding. See what every gecko is worth from real listings, what a pairing's eggs should bring, and your profit by season and pairing, then sell with a verifiable pedigree and a buyer packet. Free to start."
        path="/"
        imageAlt="Geck Inspect, the crested gecko breeding app for pricing, pairings and sales"
        keywords={[
          'crested gecko app',
          'crested gecko breeding business',
          'crested gecko value',
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
            srcSet={BACKGROUND_IMAGE_SRCSET}
            sizes="100vw"
            width="2400"
            height="1598"
            alt="Sunlit forest of tall trees and dense green undergrowth, the kind of arboreal cover crested geckos (Correlophus ciliatus) live in."
            className="w-full h-full object-cover opacity-80"
            loading="eager"
            decoding="async"
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
            <Link to="/Membership" className="hover:text-emerald-300 transition-colors">
              Pricing
            </Link>
          </nav>
          <Link
            to={createPageUrl('AuthPortal')}
            onClick={() => captureEvent('landing_cta_clicked', { cta: 'nav', target: 'signin' })}
          >
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
              Sign In
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-semibold text-emerald-300 mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            For new and small crested gecko breeders
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6 bg-gradient-to-b from-white via-white to-emerald-200 bg-clip-text text-transparent">
            Price right. Pair smart.
            <br />
            Sell with proof.
          </h1>
          <p className="text-xl md:text-2xl text-emerald-200/90 max-w-2xl mx-auto mb-4 font-medium">
            The crested gecko app for the business side of breeding.
          </p>
          <p className="text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed text-slate-300">
            See what every gecko is worth from thousands of real listings, what a pairing&rsquo;s eggs
            should bring before you pair, and what each season made. When a gecko sells, hand the buyer its
            full history in one PDF. Built only for crested geckos, by a breeder who keeps them.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {showGuestCta ? (
              <>
                <Link
                  to="/AuthPortal?mode=signup"
                  onClick={() => captureEvent('landing_cta_clicked', { cta: 'hero', target: 'signup' })}
                >
                  <Button
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base px-8 py-6 gecko-glow"
                  >
                    Create free account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handleContinueAsGuest('hero')}
                  className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold text-base px-8 py-6 backdrop-blur"
                >
                  Try the demo first
                </Button>
              </>
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
          <p className="text-xs text-slate-500 mt-6">
            Free to start, no credit card. Your first AI Morph ID is free. Export your records to CSV or PDF any time.
            {showGuestCta && (
              <>
                {' '}Already have an account?{' '}
                <Link
                  to={createPageUrl('AuthPortal')}
                  onClick={() => captureEvent('landing_cta_clicked', { cta: 'hero', target: 'signin' })}
                  className="text-emerald-300 hover:text-white underline"
                >
                  Sign in
                </Link>
                .
              </>
            )}
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
                <div className="text-xs text-slate-400 leading-snug">Export your roster as CSV and your collection records as JSON. Photos are included as links.</div>
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

        {/* The three business sections (DECISIONS.md 13 and 32): each gets
            room, a short list, and a small product visual with real numbers.
            Everything else is one line in "Also in every account". */}
        {BUSINESS_SECTIONS.map((section, idx) => {
          const Icon = section.icon;
          const Visual = SECTION_VISUALS[section.id];
          const flip = idx % 2 === 1;
          return (
            <section key={section.id} id={section.id} className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div className={flip ? 'md:order-2' : ''}>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
                    <Icon className="w-3.5 h-3.5" />
                    {section.eyebrow}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">{section.title}</h2>
                  <p className="text-slate-300 leading-relaxed mb-6">{section.lead}</p>
                  <ul className="space-y-3">
                    {section.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-slate-300">
                        <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                  {section.id === 'sell' && (
                    <Link to={createPageUrl('MarketplaceVerification')} className="inline-flex items-center gap-1.5 text-sm text-emerald-300 hover:text-white mt-6">
                      How passports and transfers work <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
                <div className={flip ? 'md:order-1' : ''}>
                  <Visual />
                </div>
              </div>
            </section>
          );
        })}

        <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24 text-center">
          <h2 className="text-xl font-semibold text-white mb-4">Also in every account</h2>
          <ul className="flex flex-wrap justify-center gap-2">
            {ALSO_INCLUDED.map((item) => (
              <li key={item} className="rounded-full border border-slate-700 bg-slate-900/60 backdrop-blur px-3 py-1.5 text-sm text-slate-300">
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Comparison block, directly contrasts the three options a
            keeper actually considers (spreadsheet, generic reptile app,
            Geck Inspect). Drives conversion by naming the pain in a
            spreadsheet and the gap in a generic app. */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Built for crested gecko breeders
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              A spreadsheet stores text. A generic reptile app stores generic records. Geck Inspect knows
              crested gecko traits and what they sell for.
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
                  ['What a gecko is worth', 'Guess from a few listings', 'Not covered', 'Estimate from real listings, by trait, age and sex'],
                  ['What a pairing is worth', 'Your own formulas', 'Not covered', 'Offspring odds times hatchling prices, per egg'],
                  ['Profit per season and pairing', 'Formulas you maintain', 'Not the focus', 'Sales and costs tied to each pairing'],
                  ['Multi-trait genetics calculator', 'Manual Punnett squares', 'Single trait at a time', 'Multi-trait + Monte Carlo simulator'],
                  ['Pedigree transfers to buyers', 'PDF if you remember', 'Not supported', 'One-click verifiable digital passport'],
                  ['Marketplace export', 'Re-type each listing', 'Internal only', 'CSV for MorphMarket bulk import'],
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

        {/* Free tools and guides, descriptive anchor-text links to the
            public reference/tool pages. Doubles as internal-link equity to
            the money pages (calculator, pedigree tracker, breeding records)
            and as a directory for visitors who land on the homepage from a
            head-term search. */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Free crested gecko tools and guides
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Every reference and calculator below is free and needs no account. Built crested-gecko-first, not adapted from a generic reptile app.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {TOOL_LINKS.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className="group gecko-card backdrop-blur p-6 transition-all duration-200 hover:border-emerald-400/40"
                >
                  <div className="w-11 h-11 rounded-md border border-emerald-400/25 bg-emerald-500/15 flex items-center justify-center mb-4 transition-colors group-hover:bg-emerald-500/25">
                    <Icon className="w-5 h-5 text-emerald-300" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1.5">{t.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{t.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>

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
                popular reptile pets worldwide thanks to a manageable adult size (35 to 60 grams), a
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
              <Link to="/Membership">
                <Button variant="outline" className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold backdrop-blur">
                  <DollarSign className="w-4 h-4 mr-2 text-emerald-300" />
                  Pricing
                </Button>
              </Link>
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
            Create a free account, add your first gecko, and see what it&rsquo;s worth in minutes.
          </p>
          <p className="text-emerald-200/70 mb-8 text-sm flex items-center justify-center gap-2">
            <Smartphone className="w-4 h-4" />
            Add to your iOS or Android home screen, full-screen, like a native app, no app store needed.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
            {showGuestCta ? (
              <>
                <Link
                  to="/AuthPortal?mode=signup"
                  onClick={() => captureEvent('landing_cta_clicked', { cta: 'bottom', target: 'signup' })}
                >
                  <Button
                    size="lg"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base px-8 py-6 gecko-glow"
                  >
                    Create free account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handleContinueAsGuest('bottom')}
                  className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 hover:text-white border-emerald-500/40 font-semibold text-base px-8 py-6 backdrop-blur"
                >
                  Try the demo first
                </Button>
              </>
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
                The business side of breeding crested geckos (<em>Correlophus ciliatus</em>), for new and small breeders.
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
                <li><Link to="/calculator" className="hover:text-white">Morph & Breeding Calculator</Link></li>
                <li><Link to="/pedigree-tracker" className="hover:text-white">Pedigree Tracker</Link></li>
                <li><Link to="/breeding-records" className="hover:text-white">Breeding Records</Link></li>
                <li><Link to="/QualityScale" className="hover:text-white">Quality Scale</Link></li>
                <li><Link to="/crested-gecko-price" className="hover:text-white">Price Guide</Link></li>
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
                <li><Link to="/Membership" className="hover:text-white">Pricing</Link></li>
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
