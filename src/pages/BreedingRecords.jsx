import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Egg,
  CalendarClock,
  LineChart,
  GitBranch,
  ArrowRight,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema, faqPageSchema, SITE_URL } from '@/lib/organization-schema';

const LAST_UPDATED = '2026-08-18';

const FEATURES = [
  {
    icon: ClipboardList,
    title: 'Every pairing on record',
    body: 'Log which male went with which female, when, and why. Each pairing keeps its own history so next season you are working from data, not memory.',
  },
  {
    icon: Egg,
    title: 'Clutch and egg tracking',
    body: 'Record lay dates, egg counts, fertility, and incubation for every clutch. Watch a season unfold instead of reconstructing it from sticky notes.',
  },
  {
    icon: CalendarClock,
    title: 'Hatch dates and reminders',
    body: 'Incubation timers and expected hatch windows keep you ahead of every clutch, so nothing gets missed during the busy months.',
  },
  {
    icon: GitBranch,
    title: 'Offspring linked to parents',
    body: 'Every hatchling you log connects back to its sire and dam automatically, so your breeding records and your lineage stay in sync.',
  },
];

const STEPS = [
  {
    n: 1,
    title: 'Set up a pairing',
    body: 'Pick the two animals from your collection and record the pairing. Their morphs and proven hets come along automatically.',
  },
  {
    n: 2,
    title: 'Log each clutch',
    body: 'Add lay date, egg count, and incubation details as the season goes. Photos and notes attach to the clutch record.',
  },
  {
    n: 3,
    title: 'Record hatchlings',
    body: 'When eggs hatch, add the offspring. Each one links to its parents, so the family tree extends without extra work.',
  },
  {
    n: 4,
    title: 'Review the season',
    body: 'See fertility, hatch rate, and outcomes per pairing so next year’s decisions are grounded in your own numbers.',
  },
];

const FAQ = [
  {
    question: 'What are crested gecko breeding records?',
    answer:
      'Crested gecko breeding records are a structured log of your breeding season: which animals you paired, when they laid, how many eggs each clutch produced, fertility and hatch rates, incubation details, and the offspring that resulted. Geck Inspect keeps these records digitally and links every hatchling back to its parents, so your breeding log doubles as a lineage record.',
  },
  {
    question: 'Why use a breeding log instead of a spreadsheet?',
    answer:
      'A spreadsheet holds numbers but does not connect them. A digital breeding log links each clutch to a specific pairing, each hatchling to its parents, and each animal to its morph and het status, so recording a hatch also updates the pedigree and the collection. It also travels with you: you can log a lay date from your phone next to the enclosure instead of retyping it later.',
  },
  {
    question: 'Can I track egg-lay and hatch dates?',
    answer:
      'Yes. Each clutch record holds the lay date, egg count, incubation temperature and medium, and expected and actual hatch dates. Incubation timing helps you anticipate hatch windows so nothing is missed during a busy season.',
  },
  {
    question: 'Do breeding records connect to the pedigree?',
    answer:
      'They do. Logging a clutch and its hatchlings automatically extends the multi-generation family tree, so the breeding records and the pedigree tracker are two views of the same data rather than two things to maintain.',
  },
  {
    question: 'Are breeding records free to keep?',
    answer:
      'You can start keeping breeding records for free. The free plan covers a starter collection, and paid plans raise the animal limit and unlock the full breeding suite. No card is required to begin.',
  },
];

const JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/breeding-records#webpage`,
    name: 'Crested Gecko Breeding Records & Clutch Tracker',
    url: `${SITE_URL}/breeding-records`,
    description:
      'Keep complete crested gecko breeding records: pairings, clutches, egg-lay and hatch dates, incubation, and per-offspring outcomes, all linked back to parents.',
    dateModified: LAST_UPDATED,
    inLanguage: 'en-US',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: { '@id': `${SITE_URL}/breeding-records#faq` },
  },
  {
    ...faqPageSchema(FAQ),
    '@id': `${SITE_URL}/breeding-records#faq`,
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Breeding Records', path: '/breeding-records' },
  ]),
];

export default function BreedingRecords() {
  return (
    <PublicPageShell>
      <Seo
        title="Crested Gecko Breeding Records & Clutch Tracker"
        description="Keep complete crested gecko breeding records: pairings, clutches, egg-lay and hatch dates, incubation, and per-offspring outcomes. A digital breeding log that replaces the spreadsheet and links every hatchling back to its parents. Free to start."
        path="/breeding-records"
        type="article"
        modifiedTime={LAST_UPDATED}
        keywords={[
          'crested gecko breeding records',
          'gecko breeding records',
          'crested gecko breeding log',
          'crested gecko clutch tracker',
          'reptile breeding records',
          'gecko egg tracking',
        ]}
        jsonLd={JSON_LD}
      />

      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Breeding Records</span>
        </div>

        {/* Hero */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 space-y-4 mb-8">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
                Crested Gecko Breeding Records
              </h1>
              <p className="text-slate-500 text-sm">
                A digital breeding log and clutch tracker for crested gecko (Correlophus ciliatus) breeders.
              </p>
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">
            Breeding season generates more data than any spreadsheet survives: pairings, lay dates, egg counts, incubation, hatch dates, and which hatchling came from which pair. Geck Inspect keeps it all as connected breeding records. Log a clutch and its offspring, and every hatchling links back to its parents, so your records and your pedigree stay in sync without doing the work twice.
          </p>

          <Link
            to="/AuthPortal"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            Start keeping breeding records free
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
            <LineChart className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-slate-100">How breeding records work</h2>
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
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Breeding records questions</h2>
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
          <Link to="/pedigree-tracker" className="text-emerald-400 hover:text-emerald-300">pedigree tracker</Link>,{' '}
          <Link to="/calculator" className="text-emerald-400 hover:text-emerald-300">morph and breeding calculator</Link>,{' '}
          and the{' '}
          <Link to="/CareGuide" className="text-emerald-400 hover:text-emerald-300">crested gecko care guide</Link>.
        </p>
      </section>
    </PublicPageShell>
  );
}
