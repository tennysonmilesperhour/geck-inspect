import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Sparkles, Users, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema, ORG_ID, SITE_URL } from '@/lib/organization-schema';
import { createPageUrl } from '@/utils';

const ABOUT_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${SITE_URL}/About#webpage`,
    name: 'About Geck Inspect',
    url: `${SITE_URL}/About`,
    description:
      'Geck Inspect is the professional platform for crested gecko (Correlophus ciliatus) breeders and keepers — combining collection management, breeding planning, AI morph identification, lineage tracking, and community tools.',
    about: { '@id': ORG_ID },
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: { '@id': ORG_ID },
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'About', path: '/About' },
  ]),
];

function Stat({ value, label }) {
  return (
    <div>
      <div className="text-3xl font-bold text-emerald-300">{value}</div>
      <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function About() {
  return (
    <PublicPageShell>
      <Seo
        title="About Geck Inspect"
        description="Geck Inspect is the professional platform for crested gecko breeders and keepers — collection management, breeding planning, AI morph identification, lineage tracking, and community. Built by people who breed crested geckos, for people who breed crested geckos."
        path="/About"
        type="article"
        keywords={[
          'about geck inspect',
          'crested gecko platform',
          'crested gecko software',
          'gecko breeder tools',
          'geckOS',
        ]}
        jsonLd={ABOUT_JSON_LD}
      />

      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">About</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-5">
          <Sparkles className="w-3.5 h-3.5" />
          About
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          We built the platform we wanted as breeders
        </h1>
        <p className="text-lg text-slate-300 leading-relaxed max-w-3xl">
          Geck Inspect is a free, professional web platform for crested gecko (<em>Correlophus ciliatus</em>) breeders and keepers. It combines collection management, breeding planning, AI-powered morph identification, multi-generation lineage tracking, and a verified community — in one place, built specifically for this species.
        </p>

        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 border-y border-slate-800/50 py-6">
          <Stat value="30+" label="Morphs documented" />
          <Stat value="50+" label="Care topics" />
          <Stat value="15+" label="Years of captive history covered" />
          <Stat value="Free" label="Every feature" />
        </div>

        <div className="mt-12 space-y-10">
          <section>
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" /> What Geck Inspect is
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Crested geckos were rediscovered in 1994 and the hobby has exploded in the years since. Spreadsheets, breeder Facebook groups, and generic reptile apps have not kept up. Geck Inspect treats this species as the specialist domain it is: morphs and their polygenic/Mendelian distinctions are modeled as first-class data, lineage is tracked across breeders not just owners, and the AI morph identifier is trained on community-uploaded crested geckos — not a generic reptile dataset.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" /> What you can do here
            </h2>
            <ul className="space-y-2 text-slate-300 leading-relaxed">
              <li className="flex gap-3"><span className="text-emerald-400 mt-1.5">•</span><span>Track every gecko in your collection with weights, photos, notes, and full pedigree back to the breeder.</span></li>
              <li className="flex gap-3"><span className="text-emerald-400 mt-1.5">•</span><span>Plan breedings with a genetics calculator that understands Lilly White (co-dominant, lethal super), Cappuccino, Axanthic, and Soft Scale.</span></li>
              <li className="flex gap-3"><span className="text-emerald-400 mt-1.5">•</span><span>Log egg lays, incubation temps, and hatch dates and watch hatchlings graduate into juveniles and adults.</span></li>
              <li className="flex gap-3"><span className="text-emerald-400 mt-1.5">•</span><span>Identify morphs with AI from a photo — primary morph, secondary traits, and base color.</span></li>
              <li className="flex gap-3"><span className="text-emerald-400 mt-1.5">•</span><span>Read the <Link to="/CareGuide" className="text-emerald-300 underline-offset-2 hover:underline">Care Guide</Link>, <Link to="/MorphGuide" className="text-emerald-300 underline-offset-2 hover:underline">Morph Guide</Link>, and <Link to="/GeneticsGuide" className="text-emerald-300 underline-offset-2 hover:underline">Genetics Guide</Link> — written for beginners, deep enough for long-time breeders.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" /> Our editorial approach
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Care and genetics content on Geck Inspect is written and reviewed by breeders with lived experience of the species, and every guide carries a <em>last updated</em> date. When we cite a figure (temperature ranges, breeding weights, incubation timing), it is drawn from established references — de Vosjoli's <em>Crested Gecko Manual</em>, Repashy and Pangea diet formulation notes, and collective community data from keepers tracking real animals on the platform. Corrections are welcomed at <Link to="/Contact" className="text-emerald-300 underline-offset-2 hover:underline">/Contact</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-3">Also branded as geckOS</h2>
            <p className="text-slate-300 leading-relaxed">
              You'll sometimes see Geck Inspect referred to as <strong className="text-white">geckOS</strong> — "the gecko operating system." Same platform; the dual branding reflects the platform's role as the underlying operating system for serious crested gecko projects.
            </p>
          </section>
        </div>

        <section className="mt-16 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Track your collection for free</h2>
          <p className="text-slate-300 mb-5 leading-relaxed">
            Every feature is free. Create an account to start logging weights, planning breedings, and visualizing lineage.
          </p>
          <Link to={createPageUrl('AuthPortal')}>
            <Button size="lg" className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-lg shadow-emerald-500/30">
              Create a free account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </section>
      </section>
    </PublicPageShell>
  );
}
