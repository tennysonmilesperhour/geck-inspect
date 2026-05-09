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

const FAQ_ITEMS = [
  {
    q: 'What is the Geck Inspect Quality Scale?',
    a: 'The Geck Inspect Quality Scale (also called the Geck Inspect Standard) is a free, public 10-point rubric for evaluating a crested gecko on body structure, head shape, eye quality, crests, dorsal pattern, lateral pattern, color saturation, contrast, pattern quality, and overall presence. The total score maps to one of four grade tiers: Pet (0.0 to 4.9), Breeder (5.0 to 6.9), High-end (7.0 to 8.4), and Investment (8.5 to 10.0).',
  },
  {
    q: 'How do I score my crested gecko?',
    a: 'Photograph the gecko in good light against a neutral backdrop, confirm it meets the eligibility floor (18 months old, 45 g with tail or 40 g without for the full structure point), then award 0 to 1 point in 0.5 steps for each of the 10 criteria on the rubric. Total the ten scores out of 10 and read the matching grade tier from the score-to-grade table.',
  },
  {
    q: 'What is the difference between Pet, Breeder, High-end, and Investment grade?',
    a: 'Pet grade (0 to 4.9) covers companion animals with no breeding ambitions. Breeder grade (5 to 6.9) is the typical hobby breeder line: clean structure, decent pattern, solid color. High-end (7 to 8.4) shows above-average structure, strong contrast, and refined pattern, the kind of animal that holds its value in the hobby. Investment grade (8.5 to 10) is show-quality, with elite structure, exceptional pattern coverage, and saturated color that breeders compete for.',
  },
  {
    q: 'How much is my crested gecko worth?',
    a: 'Value is driven by morph, sex, age, and quality grade. Pet-grade hatchlings typically sell for $50 to $150, breeder juveniles $150 to $400, high-end Harlequin adult females $400 to $1,200, and investment-grade Extreme Harlequins or proven Lilly Whites can reach $800 to $3,000. Match your scored grade against recent sales data on the Geck Inspect Market Pricing page for live price bands by morph and tier.',
  },
  {
    q: 'Is the Geck Inspect Standard related to the Gold Standard Gecko Club?',
    a: 'No, the Geck Inspect Standard is its own rubric. It is informed by the public work the Gold Standard Gecko Club (GSGC, founded by Danny Utrera and Manny Durand of Tiki’s Geckos) has done in setting judging criteria for crested geckos, and it credits GSGC openly with linked sources. Their published thresholds (18 months, 45 g full tail, 40 g no tail for full structure point) directly inform the eligibility floor on this page. Geck Inspect is not affiliated with GSGC.',
  },
  {
    q: 'Can I grade a hatchling crested gecko?',
    a: 'You can score color, pattern, and head traits on any age, but the structure point should be reduced or withheld until the gecko is at least 18 months old and meets the weight threshold (45 g with tail or 40 g without). A hatchling is not structurally mature, so structure cannot be fairly judged.',
  },
  {
    q: 'Does a higher score guarantee my gecko will sell for more?',
    a: 'No. Score correlates with price, but price is also affected by morph rarity, lineage, breeder reputation, sex (proven females typically command a premium), and current market demand. The rubric tells you which tier your gecko fits into. Market Pricing data on Geck Inspect tells you what that tier is selling for right now.',
  },
  {
    q: 'How is a crested gecko’s quality grade different from its morph?',
    a: 'Morph (Harlequin, Lilly White, Pinstripe, Dalmatian, etc.) describes the trait pattern the gecko expresses. Quality grade describes how well the gecko expresses that morph: structure, head, color saturation, contrast, pattern coverage. Two harlequins with the same morph label can sit in completely different grade tiers based on quality.',
  },
];

const HOWTO_STEPS = [
  {
    name: 'Photograph the gecko',
    text: 'Take a clear top-down shot and a clear side shot in good light against a neutral backdrop.',
  },
  {
    name: 'Confirm eligibility',
    text: 'Check that the gecko is at least 18 months old and meets the weight threshold (45 g with full tail, or 40 g without). If not, expect a reduced structure score, not a failed evaluation.',
  },
  {
    name: 'Walk the 10 criteria',
    text: 'Score each criterion (body structure, head shape, eye quality, crown crests, dorsal crests and stripe, pattern coverage, pattern quality, color saturation, contrast, overall presence) from 0 to 1 in 0.5 increments. Be honest. Optimistic scoring is the most common source of mispriced listings.',
  },
  {
    name: 'Total the score',
    text: 'Add the ten scores. The total falls into Pet (0 to 4.9), Breeder (5 to 6.9), High-end (7 to 8.4), or Investment (8.5 to 10).',
  },
  {
    name: 'Cross-check against market data',
    text: 'Compare the resulting tier against recent sales for your morph on the Geck Inspect Market Pricing page to land on a fair asking price.',
  },
];

const DEFINED_TIERS = [
  { id: 'pet', name: 'Pet grade crested gecko', range: '0.0 to 4.9', desc: 'Companion-animal tier. Healthy gecko with no breeding ambitions, possibly displaying minor structural or pattern shortfalls.' },
  { id: 'breeder', name: 'Breeder grade crested gecko', range: '5.0 to 6.9', desc: 'Typical hobby-breeder line. Clean structure, decent pattern, solid color. Suitable for breeding projects.' },
  { id: 'high-end', name: 'High-end grade crested gecko', range: '7.0 to 8.4', desc: 'Above-average structure, strong contrast, refined pattern. Animals that hold their value in the hobby.' },
  { id: 'investment', name: 'Investment grade crested gecko', range: '8.5 to 10.0', desc: 'Show-quality. Elite structure, exceptional pattern coverage, saturated color. The animals top breeders compete for.' },
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
    inLanguage: 'en-US',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    about: { '@id': `${SITE_URL}/QualityScale#defined-term-set` },
    mainEntity: { '@id': `${SITE_URL}/QualityScale#faq` },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${SITE_URL}/QualityScale#article`,
    headline: 'Crested Gecko Quality Scale: the Geck Inspect Standard',
    description:
      'A free 10-point rubric for grading a crested gecko on body structure, head, pattern, and color. Maps to four tiers (Pet, Breeder, High-end, Investment) and to live market price bands.',
    url: `${SITE_URL}/QualityScale`,
    datePublished: '2026-05-09',
    dateModified: LAST_UPDATED,
    author: {
      '@type': 'Organization',
      name: 'Geck Inspect',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Geck Inspect',
      url: SITE_URL,
    },
    isPartOf: { '@id': `${SITE_URL}/QualityScale#webpage` },
    mainEntityOfPage: { '@id': `${SITE_URL}/QualityScale#webpage` },
    keywords:
      'crested gecko quality, crested gecko grading, breeder grade crested gecko, investment grade crested gecko, crested gecko valuation, gold standard gecko club',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${SITE_URL}/QualityScale#defined-term-set`,
    name: 'Geck Inspect Standard quality grade tiers',
    url: `${SITE_URL}/QualityScale`,
    hasDefinedTerm: DEFINED_TIERS.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `${SITE_URL}/QualityScale#tier-${t.id}`,
      name: t.name,
      description: `${t.desc} Score range: ${t.range} on the Geck Inspect Standard 0 to 10 scale.`,
      inDefinedTermSet: `${SITE_URL}/QualityScale#defined-term-set`,
      url: `${SITE_URL}/QualityScale#${t.id === 'high-end' ? 'high-end' : t.id}`,
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${SITE_URL}/QualityScale#howto`,
    name: 'How to score a crested gecko on the Geck Inspect Quality Scale',
    description:
      'Five-step process for grading a crested gecko on the Geck Inspect Standard 10-point rubric and translating the score into a market value tier.',
    totalTime: 'PT10M',
    step: HOWTO_STEPS.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      url: `${SITE_URL}/QualityScale#step-${i + 1}`,
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/QualityScale#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
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
        title="Crested Gecko Quality Scale: Pet, Breeder, High-End, Investment"
        description="Free 10-point rubric for grading a crested gecko on structure, head, pattern, and color. Map your score to Pet, Breeder, High-end, or Investment grade and see what your gecko is actually worth."
        path="/QualityScale"
        type="article"
        modifiedTime={LAST_UPDATED}
        keywords={[
          'crested gecko quality',
          'crested gecko grading',
          'crested gecko quality grade',
          'crested gecko valuation',
          'how much is my crested gecko worth',
          'gold standard gecko club',
          'pet grade crested gecko',
          'breeder grade crested gecko',
          'high end crested gecko',
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
            <h2 className="text-lg font-semibold text-slate-100">Which crested geckos are eligible to be scored?</h2>
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
            <h2 className="text-lg font-semibold text-slate-100">How does the 10-point rubric work?</h2>
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
            <h2 className="text-lg font-semibold text-slate-100">What grade tier does my score correspond to?</h2>
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
            <h2 className="text-lg font-semibold text-slate-100">What changes per morph category?</h2>
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
            <h2 className="text-lg font-semibold text-slate-100">How do I score my crested gecko, step by step?</h2>
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

        {/* Frequently asked questions (visible block matched to FAQPage JSON-LD) */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Frequently asked questions</h2>
          <div className="space-y-5">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q}>
                <h3 className="text-sm font-semibold text-slate-100">{item.q}</h3>
                <p className="text-slate-400 text-sm leading-relaxed mt-1">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Credit and sources */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-2">What is this standard built on?</h2>
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
