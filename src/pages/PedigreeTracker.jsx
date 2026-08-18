import { Link } from 'react-router-dom';
import {
  GitBranch,
  Users,
  Share2,
  ShieldCheck,
  Dna,
  ArrowRight,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema, faqPageSchema, SITE_URL } from '@/lib/organization-schema';

const LAST_UPDATED = '2026-08-18';

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Multi-generation family tree',
    body: 'Every gecko links to its sire and dam, so a pairing you record today becomes a branch on a family tree that keeps growing. Trace any animal back through parents, grandparents, and beyond in one view.',
  },
  {
    icon: Dna,
    title: 'Genotype carried down the line',
    body: 'Known morphs and proven hets travel with each animal on the tree. See at a glance which offspring can carry Lilly White, Cappuccino, or Axanthic, and which pairings risk doubling up on a recessive.',
  },
  {
    icon: Users,
    title: 'Inbreeding awareness',
    body: 'When two animals share ancestors, the pedigree makes it visible before you pair them, so you can keep a line healthy instead of discovering an overlap three clutches later.',
  },
  {
    icon: Share2,
    title: 'Shareable lineage for buyers',
    body: 'Send a buyer a clean, verifiable lineage instead of a screenshot of a spreadsheet. A documented pedigree is one of the clearest trust signals a crested gecko seller can offer.',
  },
];

const STEPS = [
  {
    n: 1,
    title: 'Add your geckos',
    body: 'Create a record for each animal with its morph, sex, hatch date, and photos. Import your existing collection or start with your breeders.',
  },
  {
    n: 2,
    title: 'Link parents',
    body: 'Set the sire and dam on each gecko. Geck Inspect builds the family tree automatically as the links connect.',
  },
  {
    n: 3,
    title: 'Track each new clutch',
    body: 'When a pairing produces offspring, the hatchlings inherit their place on the tree and their parents’ genotype the moment you log them.',
  },
  {
    n: 4,
    title: 'Share or export the pedigree',
    body: 'Give a buyer a link to the animal’s verified lineage, or export a pedigree poster for your own records.',
  },
];

const FAQ = [
  {
    question: 'What is a crested gecko pedigree tracker?',
    answer:
      'A crested gecko pedigree tracker is a tool that records the parentage of each gecko and links animals together into a multi-generation family tree. Instead of keeping parentage in a spreadsheet or in your head, every gecko points to its sire and dam, so you can trace ancestry, follow morph and het inheritance down the line, and spot shared ancestors before you pair two animals. Geck Inspect builds this pedigree automatically as you link parents.',
  },
  {
    question: 'How is lineage tracking different from a breeding log?',
    answer:
      'A breeding log records events: which pair you set up, when they laid, when eggs hatched. Lineage (pedigree) tracking records relationships: who descends from whom across generations. Geck Inspect keeps both and connects them, so logging a clutch in the breeding records automatically extends the family tree.',
  },
  {
    question: 'Can I share a gecko’s pedigree with a buyer?',
    answer:
      'Yes. Each animal has a shareable lineage view, and Geck Inspect can also attach a digital passport with a QR code to a gecko so a buyer can scan it and see the verified parentage and history. A documented lineage is one of the strongest trust signals in a crested gecko sale.',
  },
  {
    question: 'Does the pedigree tracker help me avoid inbreeding?',
    answer:
      'It surfaces shared ancestry. When two animals you are considering pairing trace back to a common ancestor, the family tree makes that overlap visible before the pairing, so you can make an informed decision about the health of the line.',
  },
  {
    question: 'Is the pedigree tracker free?',
    answer:
      'You can start tracking lineage for free. The free plan covers a starter collection, and paid plans raise the animal limit and unlock the full breeding suite. No card is needed to begin.',
  },
];

const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/pedigree-tracker#webpage`,
    name: 'Crested Gecko Pedigree Tracker & Lineage Family Tree',
    url: `${SITE_URL}/pedigree-tracker`,
    description:
      'Track crested gecko pedigrees and multi-generation lineage. Build a visual family tree, follow het carriers across generations, and share a verified lineage with buyers.',
    dateModified: LAST_UPDATED,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: { '@id': `${SITE_URL}/pedigree-tracker#faq` },
  },
  {
    ...faqPageSchema(FAQ),
    '@id': `${SITE_URL}/pedigree-tracker#faq`,
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Pedigree Tracker', path: '/pedigree-tracker' },
  ]),
];

export default function PedigreeTracker() {
  return (
    <PublicPageShell>
      <Seo
        title="Crested Gecko Pedigree Tracker & Lineage Family Tree"
        description="Track crested gecko pedigrees and multi-generation lineage in one place. Build a visual family tree, follow het carriers and shared ancestry across generations, and share a verified lineage with buyers. Free to start."
        path="/pedigree-tracker"
        type="article"
        modifiedTime={LAST_UPDATED}
        keywords={[
          'crested gecko pedigree tracker',
          'crested gecko lineage tracking',
          'crested gecko family tree',
          'gecko pedigree software',
          'reptile lineage tracker',
          'crested gecko genetics tracking',
        ]}
        jsonLd={JSON_LD}
      />

      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Pedigree Tracker</span>
        </div>

        {/* Hero */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 space-y-4 mb-8">
          <div className="flex items-center gap-3">
            <GitBranch className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
                Crested Gecko Pedigree Tracker
              </h1>
              <p className="text-slate-500 text-sm">
                Multi-generation lineage and family trees for crested gecko (Correlophus ciliatus) breeders.
              </p>
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">
            Parentage lives in a spreadsheet until the day you actually need it, and then it is three tabs and a guess. Geck Inspect turns every pairing you record into a branch on a living family tree. Link a gecko to its sire and dam once, and you can trace that animal back through generations, follow which offspring carry Lilly White, Cappuccino, or Axanthic, and see shared ancestry before you make a pairing.
          </p>

          <Link
            to="/AuthPortal"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            Start tracking your lineage free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-slate-900 border border-slate-700 rounded-xl p-6">
              <f.icon className="w-6 h-6 text-emerald-400 mb-3" />
              <h2 className="text-base font-semibold text-slate-100 mb-1.5">{f.title}</h2>
              <p className="text-slate-400 text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-5">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-100">How pedigree tracking works</h2>
          </div>
          <ol className="space-y-4">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono flex items-center justify-center mt-0.5">
                  {s.n}
                </span>
                <div>
                  <p className="text-slate-100 font-medium text-sm">{s.title}</p>
                  <p className="text-slate-400 text-sm leading-relaxed mt-0.5">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* FAQ */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Pedigree tracking questions</h2>
          <div className="space-y-5">
            {FAQ.map((item) => (
              <div key={item.question}>
                <p className="text-slate-100 font-medium text-sm mb-1">{item.question}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Related */}
        <p className="text-slate-500 text-sm">
          Related tools:{' '}
          <Link to="/breeding-records" className="text-emerald-400 hover:text-emerald-300">breeding records</Link>,{' '}
          <Link to="/calculator" className="text-emerald-400 hover:text-emerald-300">morph and breeding calculator</Link>,{' '}
          and the{' '}
          <Link to="/MorphGuide" className="text-emerald-400 hover:text-emerald-300">crested gecko morph guide</Link>.
        </p>
      </section>
    </PublicPageShell>
  );
}
