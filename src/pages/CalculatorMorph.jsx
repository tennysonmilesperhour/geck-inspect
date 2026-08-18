import { useParams } from 'react-router-dom';
import GeneticCalculatorTool from './GeneticCalculatorTool';
import { CALCULATOR_PAGES_BY_SLUG } from '@/lib/genetics/calculatorCatalog';
import { breadcrumbSchema, ORG_ID } from '@/lib/organization-schema';
import PageNotFound from '@/lib/PageNotFound';

/**
 * Per-morph calculator landing page at /calculator/<slug>.
 *
 * Each route pre-fills Parent A with the named trait so a visitor can
 * immediately see what crossing into that trait produces. The page
 * reuses the main GeneticCalculatorTool component (manual mode) and
 * only changes the title, description, JSON-LD, and a short
 * morph-specific intro.
 *
 * Slugs come from CALCULATOR_PAGES in
 * src/lib/genetics/calculatorCatalog.js (kept in sync with
 * scripts/seo-routes.mjs by a unit test). Unknown slugs fall through
 * to PageNotFound rather than to the bare calculator, because any
 * /calculator/:morph URL we shipped a route for is one we also shipped
 * a sitemap entry for; an unknown slug means a typo or a removed morph
 * and shouldn't 200.
 */
export default function CalculatorMorph() {
  const { morph } = useParams();
  const page = CALCULATOR_PAGES_BY_SLUG[morph];

  if (!page) {
    return <PageNotFound />;
  }

  const title = `${page.label} Genetics Calculator, Crested Gecko`;
  const description = `Free Punnett-square calculator for crested gecko ${page.label} pairings. Predict offspring outcomes when one parent carries ${page.label}. ${page.blurb} No signup required.`;
  const path = `/calculator/${page.slug}`;

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
      <h2 className="text-base font-semibold text-purple-200 mb-1 flex items-center gap-2">
        About {page.label}
        {page.confidence === 'emerging' && (
          <span className="text-[10px] uppercase tracking-wider border border-amber-700 bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded-full">
            Emerging
          </span>
        )}
      </h2>
      <p className="text-sm text-slate-300 leading-relaxed">
        {page.blurb}
      </p>
      {page.super_lethal && (
        <p className="text-xs text-red-300 mt-2 leading-relaxed">
          <strong>Lethal-super warning:</strong> homozygous{' '}
          <em>Super {page.label}</em> embryos die in the egg. The
          calculator includes that outcome in the math so you can see
          the expected loss percentage.
        </p>
      )}
      {page.super_warning && !page.super_lethal && (
        <p className="text-xs text-amber-300 mt-2 leading-relaxed">
          <strong>Health note:</strong> {page.super_warning}
        </p>
      )}
      <p className="text-xs text-slate-500 mt-2">
        Parent A has been pre-filled with{' '}
        <strong className="text-slate-300">{page.label}</strong>.
        Add genes to Parent B below to see the predicted offspring
        distribution.
      </p>
    </div>
  );

  return (
    <GeneticCalculatorTool
      key={page.slug /* remount on slug change so the prefill applies cleanly */}
      initialSireZygosity={page.defaultState}
      pageTitle={title}
      pageDescription={description}
      pagePath={path}
      pageBreadcrumb={page.label}
      pageJsonLd={jsonLd}
      pageKeywords={[
        `${page.label.toLowerCase()} crested gecko genetics`,
        `${page.label.toLowerCase()} breeding calculator`,
        `${page.label.toLowerCase()} punnett square`,
        'crested gecko genetics calculator',
        'crested gecko breeding outcomes',
        ...(page.super_lethal ? [`super ${page.label.toLowerCase()} lethal`] : []),
      ]}
      introSlot={intro}
    />
  );
}
