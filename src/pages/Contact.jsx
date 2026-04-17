import { Link } from 'react-router-dom';
import { Mail, MessageSquare, HelpCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema, ORG_ID, SITE_URL } from '@/lib/organization-schema';
import { createPageUrl } from '@/utils';

const CONTACT_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${SITE_URL}/Contact#webpage`,
    name: 'Contact Geck Inspect',
    url: `${SITE_URL}/Contact`,
    description:
      'How to reach the Geck Inspect team for platform support, partnerships, content corrections, and press inquiries related to the crested gecko collection and breeding platform.',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: { '@id': ORG_ID },
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Contact', path: '/Contact' },
  ]),
];

const CHANNELS = [
  {
    icon: MessageSquare,
    title: 'Support',
    body: 'The fastest way to reach us is from inside the app — any account can send a direct message from the inbox. Every support conversation is tied to your account so we can look at the exact gecko record, breeding pair, or import file you\'re asking about.',
    cta: { label: 'Sign in to send a message', path: '/AuthPortal' },
  },
  {
    icon: HelpCircle,
    title: 'Corrections & editorial feedback',
    body: 'Spotted something inaccurate in a Care Guide, Morph Guide, or Genetics Guide article? Corrections are welcomed and we update guides on a rolling basis with a visible last-updated date. Send the page URL and what you think is off.',
    cta: { label: 'Browse the Care Guide', path: '/CareGuide' },
  },
  {
    icon: Mail,
    title: 'Partnerships & press',
    body: 'Breeders, shops, diet manufacturers, reptile publications, and academic researchers: Geck Inspect partners selectively on content, datasets, and co-branded tooling. Introduce yourself and what you have in mind.',
    cta: { label: 'About Geck Inspect', path: '/About' },
  },
];

export default function Contact() {
  return (
    <PublicPageShell>
      <Seo
        title="Contact Geck Inspect"
        description="Reach the Geck Inspect team for support, content corrections, partnerships, or press about the crested gecko collection and breeding platform."
        path="/Contact"
        type="article"
        keywords={[
          'contact geck inspect',
          'geck inspect support',
          'crested gecko platform help',
          'gecko breeder app contact',
        ]}
        jsonLd={CONTACT_JSON_LD}
      />

      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Contact</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-5">
          <Mail className="w-3.5 h-3.5" />
          Contact
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          Get in touch
        </h1>
        <p className="text-lg text-slate-300 leading-relaxed max-w-3xl">
          Geck Inspect is operated from the United States. The quickest way to reach us is through the in-app messaging system after creating a free account — we can then see the data you're asking about and reply with specifics.
        </p>

        <div className="mt-10 space-y-5">
          {CHANNELS.map(({ icon: Icon, title, body, cta }) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <Icon className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-white mb-1.5">{title}</h2>
                  <p className="text-slate-400 leading-relaxed mb-3">{body}</p>
                  <Link to={createPageUrl(cta.path.replace(/^\//, ''))}>
                    <Button variant="outline" className="bg-slate-950 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white">
                      {cta.label}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-3">Frequently asked before emailing</h2>
          <div className="space-y-4 text-slate-300 leading-relaxed">
            <div>
              <h3 className="font-semibold text-slate-100 mb-1">Is Geck Inspect really free?</h3>
              <p className="text-sm text-slate-400">Yes. Every feature — collection management, breeding planning, AI morph identification, lineage tracking, the marketplace — is free to use.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 mb-1">Do you support species other than crested geckos?</h3>
              <p className="text-sm text-slate-400">Geck Inspect is built specifically for <em>Correlophus ciliatus</em>. Adjacent species support is an active area of development; join the platform and request the species you'd like to see.</p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 mb-1">I want to contribute morph photos to the training set.</h3>
              <p className="text-sm text-slate-400">Upload photos of your geckos from inside the app; you can opt those photos in as training data for the AI morph identifier from the gecko's profile.</p>
            </div>
          </div>
        </section>
      </section>
    </PublicPageShell>
  );
}
