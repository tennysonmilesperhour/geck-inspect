import { Link } from 'react-router-dom';
import {
  Award,
  ScrollText,
  CheckCircle2,
  ImageOff,
  ExternalLink,
  Scale,
  Eye,
  Sparkles,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema, SITE_URL } from '@/lib/organization-schema';

const LAST_UPDATED = '2026-05-09';

const RUBRIC = [
  {
    n: 1,
    name: 'Body structure',
    blurb:
      'Robust, symmetrical body. Adult weight at or above the structure threshold. No kinks, no scoliosis, no metabolic bone disease signs. Healthy hips, straight spine.',
  },
  {
    n: 2,
    name: 'Head shape',
    blurb:
      'Wide, prominent, well-proportioned head. Clear sexual dimorphism in adult males. Strong jaw line. Not pinched or undersized for body.',
  },
  {
    n: 3,
    name: 'Eye quality',
    blurb:
      'Clean, alert eyes. Not bulging or sunken. No cloudiness. Color appropriate to morph. Buggy or undersized eyes are downgraded.',
  },
  {
    n: 4,
    name: 'Crown crests',
    blurb:
      'Full, even, well-formed crests around the orbital rim. No bald patches. Symmetrical between left and right.',
  },
  {
    n: 5,
    name: 'Dorsal crests and stripe',
    blurb:
      'Continuous crest line from head to tail base. Dorsal stripe (when relevant to the morph) is clean and well-defined.',
  },
  {
    n: 6,
    name: 'Pattern coverage',
    blurb:
      'Pattern matches the morph standard for the category. Harlequins reach the upper laterals. Extreme harlequins connect dorsal to lateral. Pinstripes have full bilateral pin coverage. Dalmatians show appropriate spot density.',
  },
  {
    n: 7,
    name: 'Pattern quality',
    blurb:
      'Clean lines, no muddiness, no stress-broken pattern. Edges are crisp. Bilateral symmetry where the morph calls for it.',
  },
  {
    n: 8,
    name: 'Color saturation',
    blurb:
      'Strong, fully expressed base color. No washed-out or fired-down appearance during evaluation.',
  },
  {
    n: 9,
    name: 'Contrast',
    blurb:
      'Strong tonal break between dorsal and lateral, or between base color and pattern. Especially weighted for harlequin and extreme harlequin categories.',
  },
  {
    n: 10,
    name: 'Overall presence and breeding suitability',
    blurb:
      'Active, alert, well-conditioned animal that represents its morph category cleanly. No disqualifying traits like severe floppy tail syndrome, missing tail base, or visible deformity.',
  },
];

const GRADE_BANDS = [
  { label: 'Pet', range: '0.0 to 4.9', color: 'bg-slate-700/40 border-slate-600 text-slate-200' },
  { label: 'Breeder', range: '5.0 to 6.9', color: 'bg-emerald-900/40 border-emerald-700 text-emerald-200' },
  { label: 'High-end', range: '7.0 to 8.4', color: 'bg-sky-900/40 border-sky-700 text-sky-200' },
  { label: 'Investment', range: '8.5 to 10.0', color: 'bg-amber-900/40 border-amber-700 text-amber-200' },
];

const CATEGORIES = [
  {
    id: 'harlequin',
    name: 'Harlequin',
    description:
      'Pattern reaches up onto the laterals from a contrasting dorsal. Bilateral symmetry and pattern reach are the heaviest scoring traits.',
    weighted: ['Pattern coverage', 'Contrast', 'Pattern quality'],
  },
  {
    id: 'extreme-harlequin',
    name: 'Extreme Harlequin',
    description:
      'Pattern coverage exceeds roughly 80 percent of the upper laterals and frequently connects the dorsal to the lateral pattern. Strong tonal break is expected.',
    weighted: ['Pattern coverage', 'Contrast', 'Color saturation'],
  },
  {
    id: 'pinstripe',
    name: 'Pinstripe',
    description:
      'Raised dorsal scale rows form a continuous bilateral pin from shoulder to hip. Full pins on both sides score above partial.',
    weighted: ['Dorsal crests and stripe', 'Pattern quality', 'Body structure'],
  },
  {
    id: 'lilly-white',
    name: 'Lilly White',
    description:
      'Co-dominant trait expressing high white saturation across the body. Clean white expression, even distribution, and absence of muddied pattern score highest.',
    weighted: ['Color saturation', 'Pattern quality', 'Overall presence'],
  },
  {
    id: 'yellow-base',
    name: 'Yellow Base',
    description:
      'Strong, saturated yellow base color across body and laterals. Avoid fired-down or muted expression during evaluation.',
    weighted: ['Color saturation', 'Contrast', 'Body structure'],
  },
  {
    id: 'red-base',
    name: 'Red Base',
    description:
      'Strong red expression, ideally extending into the laterals and limbs rather than localized blotches. Sustained color across firing states is rewarded.',
    weighted: ['Color saturation', 'Contrast', 'Pattern coverage'],
  },
  {
    id: 'dalmatian',
    name: 'Dalmatian',
    description:
      'Discrete dark spots distributed across body and limbs. High-grade animals show high spot density without spots running together into blotches.',
    weighted: ['Pattern coverage', 'Pattern quality', 'Color saturation'],
  },
  {
    id: 'phantom',
    name: 'Phantom',
    description:
      'Reduced or absent cream coloration in the dorsal and lateral patterning, leaving a cleaner base expression. Even reduction across the body scores above patchy reduction.',
    weighted: ['Pattern quality', 'Contrast', 'Overall presence'],
  },
  {
    id: 'axanthic',
    name: 'Axanthic',
    description:
      'Recessive trait removing yellow and red pigment, producing black, white, and gray expression. Clean tonal range and absence of yellow bleed score highest.',
    weighted: ['Color saturation', 'Contrast', 'Pattern quality'],
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino (any base morph)',
    description:
      'Recessive cap-allelic trait producing a rich brown base with characteristic dorsal expression. Judged across whichever morph category the animal also expresses.',
    weighted: ['Color saturation', 'Pattern coverage', 'Overall presence'],
  },
];

const QUALITY_SCALE_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/QualityScale#webpage`,
    name: 'Crested Gecko Quality Scale (Geck Inspect Standard)',
    url: `${SITE_URL}/QualityScale`,
    description:
      'The Geck Inspect Standard is a free 10-point rubric for evaluating crested gecko structure, head, pattern, and color. Score your gecko, see which grade tier it falls into, and understand what it is worth.',
    dateModified: LAST_UPDATED,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Quality Scale', path: '/QualityScale' },
  ]),
];

function PlaceholderTile({ tier }) {
  return (
    <div className="aspect-square rounded-lg border border-dashed border-slate-700 bg-slate-900/60 flex flex-col items-center justify-center text-center px-2">
      <ImageOff className="w-5 h-5 text-slate-600 mb-1" />
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{tier}</p>
      <p className="text-[10px] text-slate-600 mt-1">Reference photo coming</p>
    </div>
  );
}

export default function QualityScale() {
  return (
    <PublicPageShell>
      <Seo
        title="Crested Gecko Quality Scale (Geck Inspect Standard)"
        description="Free 10-point rubric for evaluating crested gecko quality across structure, head, pattern, and color. Score your gecko, see which grade tier it lands in, and understand what it is worth."
        path="/QualityScale"
        type="article"
        modifiedTime={LAST_UPDATED}
        keywords={[
          'crested gecko quality',
          'crested gecko grading',
          'crested gecko valuation',
          'gold standard gecko',
          'breeder grade crested gecko',
          'investment grade crested gecko',
        ]}
        jsonLd={QUALITY_SCALE_JSON_LD}
      />

      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Quality Scale</span>
        </div>

        {/* Hero */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 space-y-4 mb-8">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-amber-400 flex-shrink-0" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
                Crested Gecko Quality Scale
              </h1>
              <p className="text-slate-500 text-sm">
                The Geck Inspect Standard. A free 10-point rubric for figuring out where your gecko falls on the quality scale.
              </p>
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">
            Most crested gecko sellers price their animals by morph alone, which is why the same "harlequin male, six months" can be listed at $80 and at $400 in the same week. The missing piece is <strong className="text-slate-100">structure and quality</strong>: head shape, body proportion, pattern coverage, color contrast. This page gives you the rubric breeders use, so you can score your own gecko honestly and understand which grade tier it actually belongs in.
          </p>

          <p className="text-slate-400 text-sm leading-relaxed">
            Reference photos for each tier are being added over the next few weeks. The rubric and scoring system below are usable right now.
          </p>
        </div>

        {/* Eligibility floor */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-100">Eligibility floor</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            A gecko has to be structurally mature before structure can be fairly judged. These thresholds match the public Gold Standard Gecko Club (GSGC) entry requirements, the broadest community-accepted floor in the hobby.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Age</p>
              <p className="text-slate-200">18 months or older</p>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Health</p>
              <p className="text-slate-200">No active illness, mites, or open wounds</p>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Weight, full tail</p>
              <p className="text-slate-200">45 g or more for full structure point (40 g minimum to enter)</p>
            </div>
            <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Weight, no tail</p>
              <p className="text-slate-200">40 g or more for full structure point (35 g minimum to enter)</p>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-4">
            Animals under the floor can still be scored on color, pattern, and head traits. The structure point is reduced or withheld instead of the whole animal failing.
          </p>
        </div>

        {/* The rubric */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ScrollText className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-100">The 10-point rubric</h2>
          </div>
          <p className="text-slate-400 text-sm mb-5">
            Award each criterion 0 to 1 point. Half-points are fine. Add the ten scores together to get a total out of 10.
          </p>
          <ol className="space-y-4">
            {RUBRIC.map((r) => (
              <li key={r.n} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center justify-center mt-0.5">
                  {r.n}
                </span>
                <div>
                  <p className="text-slate-100 font-medium text-sm">{r.name}</p>
                  <p className="text-slate-400 text-sm leading-relaxed mt-0.5">{r.blurb}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Score-to-grade */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-slate-100">Score-to-grade mapping</h2>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Once you have a total score, this is the tier your gecko sits in. The tier feeds directly into the Market Pricing data on Geck Inspect, so you get a price band based on actual sales of geckos in the same tier.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {GRADE_BANDS.map((b) => (
              <div key={b.label} className={`rounded-lg border p-4 ${b.color}`}>
                <p className="text-xs uppercase tracking-wider opacity-70">{b.range}</p>
                <p className="text-lg font-semibold mt-1">{b.label}</p>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-4">
            See aggregated price bands per morph and grade on the{' '}
            <Link to="/MarketPricing" className="text-emerald-400 hover:text-emerald-300 underline">
              Market Pricing
            </Link>{' '}
            page.
          </p>
        </div>

        {/* Per-category */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-slate-100">Per-category standards</h2>
          </div>
          <p className="text-slate-400 text-sm mb-5">
            The rubric weights are universal but the interpretation of pattern, contrast, and color shifts by morph category. Each category has its own reference plate showing what a Pet, Breeder, High-end, and Investment exemplar looks like.
          </p>
          <div className="space-y-6">
            {CATEGORIES.map((c) => (
              <div key={c.id} id={c.id} className="border border-slate-800 rounded-lg p-4 bg-slate-950/40">
                <h3 className="text-base font-semibold text-slate-100">{c.name}</h3>
                <p className="text-slate-400 text-sm mt-1">{c.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">Most weighted:</span>
                  {c.weighted.map((w) => (
                    <span
                      key={w}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300"
                    >
                      {w}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Pet', 'Breeder', 'High-end', 'Investment'].map((tier) => (
                    <PlaceholderTile key={tier} tier={tier} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How to use it */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-100">How to use this rubric</h2>
          </div>
          <ol className="text-slate-300 text-sm leading-relaxed space-y-2 list-decimal list-inside">
            <li>Photograph your gecko in good light against a neutral backdrop. Take a clear top-down shot and a clear side shot.</li>
            <li>Confirm your gecko meets the eligibility floor. If it does not, expect a reduced structure score, not a failed evaluation.</li>
            <li>Walk the 10 criteria. Score each one 0 to 1 in 0.5 increments. Be honest. Optimistic scoring of your own animal is the most common source of mispriced listings.</li>
            <li>Add up the score and read the grade tier from the table above.</li>
            <li>
              Cross-check your tier against recent sales for your morph on the{' '}
              <Link to="/MarketPricing" className="text-emerald-400 underline">Market Pricing</Link> page.
            </li>
          </ol>
          <p className="text-slate-500 text-xs mt-4">
            An interactive worksheet that scores your gecko inside the Animal Passport is on the roadmap. For now, a notebook or a notes app works fine.
          </p>
        </div>

        {/* Credit and sources */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-2">What this standard is built on</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            The Geck Inspect Standard is our own rubric. It is informed by, and gives credit to, the public work the <strong className="text-slate-200">Gold Standard Gecko Club</strong> has done in setting judging criteria for crested geckos. GSGC was founded by Danny Utrera and Manny Durand of Tiki's Geckos and is the closest thing the hobby has to a recognized standards body. Their rules, eligibility thresholds, and category list directly informed this page. We are not reusing their score sheets or assets without permission.
          </p>
          <p className="text-slate-400 text-sm leading-relaxed mt-3">
            Verified public sources:
          </p>
          <ul className="text-slate-400 text-sm space-y-1.5 mt-2">
            {[
              ['Gold Standard Gecko Club', 'https://www.goldstandardgeckoclub.com/'],
              ['GSGC Rules and Regulations', 'https://www.goldstandardgeckoclub.com/general-5'],
              ['GSGC Species Standard', 'https://www.goldstandardgeckoclub.com/single-project'],
              ['GSGC Forum', 'https://www.goldstandardgeckoclub.com/forum'],
              ['GSGC YouTube (judging videos)', 'https://www.youtube.com/playlist?list=PLBYqDmT358pxaK8t9Taz6OyauOBpxRCtw'],
              ['Tiki’s Geckos', 'https://tikisgeckos.com/'],
              ['Reptiles Magazine: Danny Utrera and Manny Durand of Tiki’s Geckos', 'https://reptilesmagazine.com/danny-utrera-and-manny-durand-of-tikis-geckos/'],
            ].map(([label, href]) => (
              <li key={href} className="flex items-start gap-2">
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mt-1" />
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 underline break-all"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-slate-500 text-xs mt-4">
            Last updated {LAST_UPDATED}.
          </p>
        </div>
      </section>
    </PublicPageShell>
  );
}
