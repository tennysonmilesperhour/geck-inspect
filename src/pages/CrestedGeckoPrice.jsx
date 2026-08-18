import { Link } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  Scale,
  Venus,
  CalendarClock,
  Dna,
  ArrowRight,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema, faqPageSchema, SITE_URL } from '@/lib/organization-schema';

const LAST_UPDATED = '2026-08-18';

// Market ranges are for healthy, captive-bred crested geckos sold directly
// by breeders (not chain-store animals), in USD, reflecting 2026 hobby
// pricing. Ranges are wide on purpose: quality grade, sex, age, and
// lineage move an individual animal within and across these bands.
const PRICE_BANDS = [
  {
    tier: 'Starter / common',
    range: '$50 to $150',
    color: 'border-slate-600 bg-slate-800/40',
    morphs: 'Bicolor, Patternless, basic Flame, low-expression Harlequin, common Tiger',
    note: 'Healthy pet-grade animals. The floor of the hobby, and where most first geckos sit.',
  },
  {
    tier: 'Mid-tier',
    range: '$150 to $400',
    color: 'border-emerald-700 bg-emerald-900/30',
    morphs: 'Clean Harlequin, Pinstripe, Dalmatian, Phantom, strong Flame',
    note: 'Solid structure and pattern. Typical hobby-breeder stock and starter breeder projects.',
  },
  {
    tier: 'High-end',
    range: '$400 to $1,200',
    color: 'border-sky-700 bg-sky-900/30',
    morphs: 'Extreme Harlequin, high-white pattern, quality Dalmatian, tricolor, refined Pinstripe',
    note: 'Above-average structure, strong contrast, high pattern coverage. Animals that hold value.',
  },
  {
    tier: 'Designer / genetic',
    range: '$500 to $3,000+',
    color: 'border-amber-700 bg-amber-900/30',
    morphs: 'Lilly White, Cappuccino, Axanthic, and combos stacking these on quality bases',
    note: 'Proven genetic morphs and multi-trait combos. Exceptional specimens have sold well above this.',
  },
];

const DRIVERS = [
  {
    icon: Dna,
    title: 'Morph and genetics',
    body: 'The single biggest lever. A genetic morph like Lilly White, Cappuccino, or Axanthic commands a large premium over a bicolor, and combos that stack traits climb faster still.',
  },
  {
    icon: Scale,
    title: 'Quality and structure',
    body: 'Two geckos with the same morph label can sit a full price tier apart on structure, head, pattern coverage, and color. This is where the Quality Scale does the work.',
  },
  {
    icon: Venus,
    title: 'Sex',
    body: 'Proven females typically command a premium because they produce clutches. Unsexed hatchlings sell cheaper because the buyer carries the risk of sexing outcome.',
  },
  {
    icon: CalendarClock,
    title: 'Age and proven status',
    body: 'Hatchlings are cheapest. Sub-adults cost more, and proven breeders (an animal that has successfully produced offspring) carry the highest premium of the three.',
  },
];

const FAQ = [
  {
    question: 'How much is my crested gecko worth?',
    answer:
      'A healthy common-morph crested gecko (bicolor, patternless, basic flame) is typically worth $50 to $150. Nicer patterned animals such as clean harlequins, pinstripes, and dalmatians run $150 to $400. High-end animals (extreme harlequin, high white, quality dalmatian) reach $400 to $1,200, and genetic morphs like Lilly White, Cappuccino, and Axanthic, or combos of them, start around $500 and can pass $3,000. Your exact value depends on morph, quality grade, sex, age, and lineage. Score your gecko on the Geck Inspect Quality Scale to place it in a tier, then match that tier to these ranges.',
  },
  {
    question: 'What makes a crested gecko expensive?',
    answer:
      'Four things, in rough order of impact: genetics (a proven morph like Lilly White or Axanthic), quality (structure, head, pattern coverage, and color, which is what separates a $150 harlequin from an $800 one), sex (proven females command a premium), and lineage (documented, well-known bloodlines sell for more). A common morph with elite quality can outsell a rare morph with poor structure.',
  },
  {
    question: 'How much is a Lilly White crested gecko worth?',
    answer:
      'Lilly White is one of the most sought-after crested gecko morphs, and it carries a genetic premium. Entry Lilly Whites commonly start around $400 to $700, quality animals run $800 to $1,500, and top examples or Lilly White combos (for example Lilly White stacked on a strong harlequin or tricolor base) regularly pass $2,000. Because the homozygous "super" form is lethal, every Lilly White is a single-copy animal, which keeps demand high.',
  },
  {
    question: 'Does sex change how much a crested gecko is worth?',
    answer:
      'Yes. Proven females typically sell for the most because they produce clutches, followed by confirmed males, then unsexed hatchlings, which are cheapest because the buyer takes on the risk of how the animal sexes out. The same morph and quality can vary by a wide margin on sex alone.',
  },
  {
    question: 'How do I get an accurate value for my specific gecko?',
    answer:
      'Grade it on the free Geck Inspect Quality Scale (a 10-point rubric for structure, head, pattern, and color), which places the animal in a Pet, Breeder, High-end, or Investment tier. Combine that tier with its morph using the ranges on this page. For a trait-by-trait estimate you can also run the animal through the Morph Visualizer, which produces a rarity tier and an estimated retail range.',
  },
];

const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/crested-gecko-price#webpage`,
    name: 'How Much Is My Crested Gecko Worth? Crested Gecko Price Guide',
    url: `${SITE_URL}/crested-gecko-price`,
    description:
      'Crested gecko price guide by morph and quality. What common, high-end, and genetic morphs like Lilly White, Cappuccino, and Axanthic are worth, and the factors that set the price.',
    dateModified: LAST_UPDATED,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: { '@id': `${SITE_URL}/crested-gecko-price#faq` },
  },
  {
    ...faqPageSchema(FAQ),
    '@id': `${SITE_URL}/crested-gecko-price#faq`,
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Crested Gecko Price Guide', path: '/crested-gecko-price' },
  ]),
];

export default function CrestedGeckoPrice() {
  return (
    <PublicPageShell>
      <Seo
        title="How Much Is My Crested Gecko Worth? Price Guide by Morph"
        description="Crested gecko price guide by morph and quality. See what common, high-end, and genetic morphs like Lilly White, Cappuccino, and Axanthic are worth in 2026, and the factors (quality, sex, age, lineage) that set the price. Free to use."
        path="/crested-gecko-price"
        type="article"
        modifiedTime={LAST_UPDATED}
        keywords={[
          'how much is my crested gecko worth',
          'crested gecko price',
          'crested gecko price by morph',
          'crested gecko value',
          'lilly white crested gecko price',
          'crested gecko cost',
        ]}
        jsonLd={JSON_LD}
      />

      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Crested Gecko Price Guide</span>
        </div>

        {/* Hero */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 space-y-4 mb-8">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
                How much is my crested gecko worth?
              </h1>
              <p className="text-slate-500 text-sm">
                A crested gecko (Correlophus ciliatus) price guide by morph and quality.
              </p>
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">
            Crested gecko prices run from about $50 for a healthy common animal to several thousand dollars for a proven genetic morph, and the same "harlequin male" can honestly be worth $80 or $800 depending on quality. Price is set by four things: morph and genetics, quality and structure, sex, and age. This guide gives real 2026 market ranges by tier, then shows you how to place your own gecko.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/QualityScale"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              Grade your gecko on the Quality Scale
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Price bands */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-100">Crested gecko price by morph tier</h2>
          </div>
          <p className="text-slate-400 text-sm mb-5">
            Ranges are for healthy, captive-bred animals sold by breeders, in USD. They are wide because quality, sex, age, and lineage move an animal within and across bands.
          </p>
          <div className="space-y-3">
            {PRICE_BANDS.map((b) => (
              <div key={b.tier} className={`rounded-lg border p-4 ${b.color}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <span className="text-slate-100 font-semibold text-sm">{b.tier}</span>
                  <span className="text-slate-100 font-bold text-base">{b.range}</span>
                </div>
                <p className="text-slate-300 text-sm mb-1"><span className="text-slate-500">Examples:</span> {b.morphs}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{b.note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* What sets the price */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {DRIVERS.map((d) => (
            <div key={d.title} className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <d.icon className="w-6 h-6 text-emerald-400 mb-3" />
              <h2 className="text-base font-semibold text-slate-100 mb-1.5">{d.title}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">{d.body}</p>
            </div>
          ))}
        </div>

        {/* How to price yours */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-3">How to price your own crested gecko</h2>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center justify-center mt-0.5">1</span>
              <p className="text-slate-400 leading-relaxed">Identify the morph. Not sure? The <Link to="/MorphGuide" className="text-emerald-400 hover:text-emerald-300">morph guide</Link> and <Link to="/MorphVisualizer" className="text-emerald-400 hover:text-emerald-300">morph visualizer</Link> help you name the traits.</p>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center justify-center mt-0.5">2</span>
              <p className="text-slate-400 leading-relaxed">Grade the quality on the <Link to="/QualityScale" className="text-emerald-400 hover:text-emerald-300">Quality Scale</Link> to land in a Pet, Breeder, High-end, or Investment tier.</p>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center justify-center mt-0.5">3</span>
              <p className="text-slate-400 leading-relaxed">Match morph plus quality tier to the ranges above, then adjust for sex and age.</p>
            </li>
          </ol>
        </div>

        {/* FAQ */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Crested gecko value questions</h2>
          <div className="space-y-5">
            {FAQ.map((item) => (
              <div key={item.question}>
                <p className="text-slate-100 font-medium text-sm mb-1">{item.question}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-500 text-sm">
          Related:{' '}
          <Link to="/QualityScale" className="text-emerald-400 hover:text-emerald-300">Quality Scale</Link>,{' '}
          <Link to="/MorphGuide" className="text-emerald-400 hover:text-emerald-300">morph guide</Link>,{' '}
          and the{' '}
          <Link to="/calculator" className="text-emerald-400 hover:text-emerald-300">morph and breeding calculator</Link>.
        </p>
      </section>
    </PublicPageShell>
  );
}
