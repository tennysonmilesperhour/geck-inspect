import { Link } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema, SITE_URL } from '@/lib/organization-schema';

const LAST_UPDATED = '2026-04-17';

const TERMS_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/Terms#webpage`,
    name: 'Geck Inspect Terms of Service',
    url: `${SITE_URL}/Terms`,
    description:
      'Terms of service governing use of the Geck Inspect crested gecko tracking and breeding platform.',
    dateModified: LAST_UPDATED,
    isPartOf: { '@id': `${SITE_URL}/#website` },
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Terms', path: '/Terms' },
  ]),
];

function Section({ n, title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-100">
        <span className="text-slate-500 font-mono mr-2">{n}.</span>
        {title}
      </h2>
      <div className="text-slate-400 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <PublicPageShell>
      <Seo
        title="Terms of Service"
        description="Terms of service governing use of Geck Inspect, the crested gecko tracking, breeding, and community platform."
        path="/Terms"
        type="article"
        modifiedTime={LAST_UPDATED}
        keywords={[
          'geck inspect terms',
          'terms of service',
          'crested gecko platform terms',
        ]}
        jsonLd={TERMS_JSON_LD}
      />

      <section className="max-w-3xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <span className="text-slate-400">Terms of Service</span>
        </div>

        <div className="bg-slate-900 border border-slate-700 rounded-xl p-8 space-y-8">
          <div className="flex items-center gap-3">
            <ScrollText className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Terms of Service</h1>
              <p className="text-slate-500 text-sm">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>

          <p className="text-slate-400 text-sm leading-relaxed">
            These Terms of Service (the "Terms") govern your access to and use of the Geck Inspect platform at geckinspect.com and any associated services (the "Service"), operated by Geck Inspect ("we", "us"). By creating an account or using any part of the Service you agree to these Terms. If you do not agree, do not use the Service.
          </p>

          <Section n="1" title="Eligibility">
            <p>You must be at least 13 years old to create an account. If you are between 13 and the age of majority in your jurisdiction, you represent that a parent or guardian has agreed to these Terms on your behalf.</p>
          </Section>

          <Section n="2" title="Your account">
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. Contact us promptly if you suspect unauthorized access.</p>
          </Section>

          <Section n="3" title="Your content">
            <p>You retain ownership of the gecko records, photos, breeding data, and other content you upload to the Service ("Your Content"). By submitting Your Content you grant us a non-exclusive, worldwide, royalty-free license to host, display, and process Your Content solely to operate and improve the Service, including training morph-identification models using content you explicitly opt in to training-data use.</p>
            <p>You represent that you have the rights necessary to grant this license for every piece of content you upload, and that Your Content does not infringe another party's rights or applicable law.</p>
          </Section>

          <Section n="4" title="Community standards">
            <p>In community areas (forum, gallery, marketplace listings, direct messages), you agree not to harass other users, misrepresent animals for sale, post content that depicts illegal activity, or post spam. We may remove content or suspend accounts that violate these standards.</p>
          </Section>

          <Section n="5" title="Marketplace and transactions">
            <p>The marketplace is a listing platform. Transactions between buyers and sellers are between those parties directly; we are not a party to the transaction and do not hold funds or ship animals. Sellers are responsible for compliance with all applicable shipping, welfare, and commerce laws in their jurisdictions.</p>
          </Section>

          <Section n="6" title="Educational content disclaimer">
            <p>Care guides, morph references, genetics explanations, and breeding recommendations on the Service are general reference material ,  not veterinary advice. Always consult a qualified reptile veterinarian for medical decisions concerning an individual animal.</p>
          </Section>

          <Section n="7" title="Changes to the Service">
            <p>We may add, remove, or change features at any time. We will give reasonable notice of changes that materially reduce the functionality available to you.</p>
          </Section>

          <Section n="8" title="Termination">
            <p>You may delete your account at any time from your account settings. We may suspend or terminate accounts that violate these Terms. On termination, you may lose access to Your Content; we recommend exporting anything you want to keep before deleting.</p>
          </Section>

          <Section n="9" title="Disclaimers and limitation of liability">
            <p>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL IMPLIED WARRANTIES AND SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF YOUR USE OF THE SERVICE.</p>
          </Section>

          <Section n="10" title="Governing law">
            <p>These Terms are governed by the laws of the United States and the State in which Geck Inspect is operated, without regard to conflict-of-law principles. Disputes shall be resolved in courts of that State.</p>
          </Section>

          <Section n="11" title="Contact">
            <p>Questions about these Terms? Reach us via the in-app messaging system after signing in, or see the <Link to="/Contact" className="text-emerald-300 hover:underline">Contact page</Link>.</p>
          </Section>
        </div>
      </section>
    </PublicPageShell>
  );
}
