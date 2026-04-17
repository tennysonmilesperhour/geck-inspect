import { Link } from 'react-router-dom';
import { ShieldCheck, Package, User, MessageSquare, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import { breadcrumbSchema, ORG_ID, SITE_URL } from '@/lib/organization-schema';
import { authorSchema, bylineText, editorialFor } from '@/lib/editorial';
import { createPageUrl } from '@/utils';

const PATH = '/MarketplaceVerification';
const URL = `${SITE_URL}${PATH}`;
const EDITORIAL = editorialFor(PATH);

const VERIFICATION_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${URL}#article`,
    headline: 'Geck Inspect Marketplace — Breeder Verification & Trust Policy',
    description:
      'How Geck Inspect verifies breeders and marketplace sellers, the Zero\'s Geckos shipping partnership, buyer protections, and what to expect when buying or selling a crested gecko through the platform.',
    url: URL,
    author: authorSchema(),
    reviewedBy: authorSchema(),
    datePublished: EDITORIAL.published,
    dateModified: EDITORIAL.modified,
    about: [
      {
        '@type': 'Thing',
        name: 'Crested gecko',
        alternateName: 'Correlophus ciliatus',
        sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
      },
      { '@type': 'Thing', name: 'Online marketplace trust' },
      { '@type': 'Thing', name: 'Reptile shipping' },
    ],
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': `${SITE_URL}/#website` },
  },
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Marketplace', path: '/Marketplace' },
    { name: 'Verification & Trust', path: PATH },
  ]),
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${URL}#faq`,
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How does Geck Inspect verify breeders on the marketplace?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sellers on the Geck Inspect marketplace operate from accounts tied to an email-verified identity and a visible profile history. Listings carry the gecko\'s tracked weight history, lineage, and photo timeline as stored on Geck Inspect — so the animal\'s ownership history is transparent rather than asserted in free text. We don\'t issue a single binary "verified" badge; instead we surface the on-platform data (account age, number of geckos tracked, listing history, lineage provenance) so buyers can evaluate sellers with real signal.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the Zero\'s Geckos shipping partnership?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Geck Inspect partners with Zero\'s Geckos, a specialty reptile shipping service, to offer temperature-controlled overnight shipping with live-arrival guarantees on marketplace purchases. Sellers who opt in to Zero\'s Geckos shipping follow standardized packing protocols (insulated box, heat or cold pack as appropriate, ventilation) and the animal is tracked door-to-door.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Geck Inspect a party to marketplace transactions?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. The marketplace is a listing platform. Payment, shipping, and ownership transfer happen directly between buyer and seller. Geck Inspect does not take custody of funds or animals, does not escrow payments, and does not mediate returns. Sellers are responsible for compliance with all applicable shipping, welfare, and commerce laws in their jurisdiction.',
        },
      },
      {
        '@type': 'Question',
        name: 'What should I check before buying a crested gecko through the marketplace?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Ask for the animal\'s hatch date, current weight, last feeding, last shed, and sire/dam information — the seller already has these in their Geck Inspect tracking. Check the lineage view for multi-generation provenance. Request additional photos with a recent date stamp. Confirm the seller\'s shipping option (Zero\'s Geckos vs independent) and their live-arrival policy in writing before paying.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I report a fraudulent listing or a seller who misrepresented an animal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Send a direct message through the in-app inbox with the listing URL, the gecko\'s ID, and a description of the issue. We review reports within 72 hours and remove listings that violate our standards. Patterns of misrepresentation result in account suspension.',
        },
      },
    ],
  },
];

function Section({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
      <h2 className="text-xl md:text-2xl font-bold text-white mb-3 flex items-center gap-2">
        <Icon className="w-5 h-5 text-emerald-400" />
        {title}
      </h2>
      <div className="text-slate-300 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function MarketplaceVerification() {
  return (
    <PublicPageShell>
      <Seo
        title="Marketplace Verification & Trust"
        description="How Geck Inspect verifies marketplace sellers, the Zero's Geckos shipping partnership, buyer protections, and what to expect when buying or selling a crested gecko on the platform."
        path={PATH}
        type="article"
        modifiedTime={EDITORIAL.modified}
        keywords={[
          'crested gecko marketplace',
          'gecko breeder verification',
          'reptile shipping guarantee',
          "Zero's Geckos shipping",
          'safe gecko marketplace',
          'buy crested gecko online',
        ]}
        jsonLd={VERIFICATION_JSON_LD}
      />

      <section className="max-w-3xl mx-auto px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <Link to="/Marketplace" className="hover:text-slate-300">Marketplace</Link>
          <span>/</span>
          <span className="text-slate-400">Verification & Trust</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
          <ShieldCheck className="w-3.5 h-3.5" />
          Trust & Safety
        </div>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          Marketplace Verification & Trust
        </h1>
        <p className="text-lg text-slate-300 leading-relaxed max-w-3xl mb-3">
          How we surface trust signals on marketplace listings, the Zero's Geckos shipping partnership, what Geck Inspect is and isn't responsible for, and how to evaluate a seller before you buy.
        </p>
        <p className="text-xs text-slate-500 mb-10">{bylineText(PATH)}</p>

        <div className="space-y-6">
          <Section icon={User} title="How we verify sellers">
            <p>
              Every marketplace listing is posted by an account tied to a verified email and a visible profile history. We don't issue a binary "verified breeder" badge — instead, buyers see the on-platform data the seller has actually accumulated: account age, number of geckos tracked, lineage depth, previous listing history, and photo timeline for the specific animal being sold.
            </p>
            <p>
              Geck Inspect stores every gecko's weight log, photo history, and parent attribution as part of normal collection management. When a seller lists that animal, that full history is inherited by the listing. Buyers get real provenance — not a claim in a free-text field.
            </p>
          </Section>

          <Section icon={Package} title="Zero's Geckos shipping partnership">
            <p>
              Live animal shipping is the highest-risk step in a marketplace transaction. Geck Inspect partners with <strong className="text-slate-100">Zero's Geckos</strong>, a specialty reptile shipping service, so sellers can offer standardized temperature-controlled overnight shipping with a live-arrival guarantee.
            </p>
            <p>
              Sellers who opt in follow a standard packing protocol (insulated box, heat or cold pack appropriate to forecast temperatures, ventilation, stability). The animal is tracked door-to-door. If the worst happens and the animal arrives unhealthy despite proper packing, the Zero's Geckos guarantee engages.
            </p>
            <p className="text-sm text-slate-400">
              Sellers who ship independently set their own policies. Always confirm the live-arrival policy with your seller in writing before paying.
            </p>
          </Section>

          <Section icon={ShieldCheck} title="What Geck Inspect is (and isn't) responsible for">
            <p>
              The marketplace is a listing platform. Payment, shipping, and ownership transfer happen directly between buyer and seller. Geck Inspect does not take custody of funds or animals, does not escrow payments, and does not mediate returns or disputes.
            </p>
            <p>
              We enforce community standards against fraudulent listings, misrepresentation, and activity that violates shipping, welfare, or commerce law in the seller's jurisdiction. Listings that violate those standards are removed; patterns of violations result in account suspension.
            </p>
          </Section>

          <Section icon={MessageSquare} title="What to check before you buy">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Ask for the hatch date, current weight, last feeding, and last shed — the seller has these on hand in their Geck Inspect tracking.</li>
              <li>Check the lineage view for sire/dam + multi-generation provenance.</li>
              <li>Request recent, date-stamped photos of the specific animal.</li>
              <li>Confirm the shipping option (Zero's Geckos or independent) and the live-arrival policy in writing before paying.</li>
              <li>Verify that the seller is shipping to your jurisdiction — some states and countries have restrictions on reptile imports.</li>
              <li>Prefer sellers with visible account history and lineage depth over new accounts.</li>
            </ul>
          </Section>

          <Section icon={MessageSquare} title="Report a listing or seller">
            <p>
              Send a direct message through the in-app inbox with the listing URL, the gecko's ID, and a description of the issue. We review reports within 72 hours. Persistent patterns of misrepresentation lead to account suspension.
            </p>
            <div className="mt-4">
              <Link to={createPageUrl('AuthPortal')}>
                <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                  Sign in to send a report <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </Section>
        </div>
      </section>
    </PublicPageShell>
  );
}
