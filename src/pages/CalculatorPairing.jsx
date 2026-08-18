import { useParams } from 'react-router-dom';
import GeneticCalculatorTool from './GeneticCalculatorTool';
import { PAIRING_PAGES_BY_SLUG } from '@/lib/genetics/calculatorCatalog';
import { breadcrumbSchema, ORG_ID } from '@/lib/organization-schema';
import PageNotFound from '@/lib/PageNotFound';

/**
 * Per-pairing calculator landing page at /calculator/pairing/<slug>.
 *
 * These are the crosses people actually type into search engines and
 * argue about in forums ("lilly white x lilly white", "cappuccino x
 * sable"). Each route pre-fills BOTH parents and adds a short
 * pairing-specific explainer, then reuses the main calculator.
 *
 * Slugs come from PAIRING_PAGES in
 * src/lib/genetics/calculatorCatalog.js, kept in sync with
 * scripts/seo-routes.mjs by a unit test. Unknown slugs 404.
 */
export default function CalculatorPairing() {
  const { pairing } = useParams();
  const page = PAIRING_PAGES_BY_SLUG[pairing];

  if (!page) {
    return <PageNotFound />;
  }

  const title = `${page.label}: Crested Gecko Odds`;
  const description = `What does ${page.label} produce? ${page.blurb} Free Punnett-square calculator, no signup required.`;
  const path = `/calculator/pairing/${page.slug}`;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': `https://geckinspect.com${path}#app`,
      name: title,
      url: `https://geckinspect.com${path}`,
      description,
      applicationCategory: 'UtilitiesApplication',
      applicationSubCategory: 'Reptile Breeding Calculator',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      creator: { '@id': ORG_ID },
    },
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Genetic Calculator', path: '/calculator' },
      { name: page.label, path },
    ]),
  ];

  const intro = (
    <div className="mb-6 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 md:p-5">
      <h2 className="text-base font-semibold text-purple-200 mb-1">
        {page.label}
      </h2>
      <p className="text-sm text-slate-300 leading-relaxed">{page.blurb}</p>
      <p className="text-xs text-slate-500 mt-2">
        Both parents are pre-filled below. Adjust either side to explore variations.
      </p>
    </div>
  );

  return (
    <GeneticCalculatorTool
      key={page.slug /* remount on slug change so the prefill applies cleanly */}
      initialSireZygosity={page.sire}
      initialDamZygosity={page.dam}
      pageTitle={title}
      pageDescription={description}
      pagePath={path}
      pageBreadcrumb={page.label}
      pageJsonLd={jsonLd}
      pageKeywords={[
        `${page.label.toLowerCase()} crested gecko`,
        `${page.label.toLowerCase()} odds`,
        `${page.label.toLowerCase()} what will it produce`,
        'crested gecko pairing calculator',
        'crested gecko breeding outcomes',
      ]}
      introSlot={intro}
    />
  );
}
