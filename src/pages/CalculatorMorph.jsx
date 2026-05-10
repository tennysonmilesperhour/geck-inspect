import { useParams, Navigate } from 'react-router-dom';
import GeneticCalculatorTool from './GeneticCalculatorTool';
import { PICKER_TRAITS_BY_SLUG } from '../components/breeding/ManualGenotypePicker';
import { breadcrumbSchema, ORG_ID } from '@/lib/organization-schema';
import PageNotFound from '@/lib/PageNotFound';

/**
 * Per-morph calculator landing page at /calculator/<slug>.
 *
 * Each route pre-fills Parent A with one expressing copy of the named
 * trait so a visitor can immediately see what crossing into that trait
 * produces. The page reuses the main GeneticCalculatorTool component
 * (manual mode) and only changes the title, description, JSON-LD, and
 * a short morph-specific intro.
 *
 * Slugs are matched against the `slug` field in PICKER_TRAITS ,  see
 * src/components/breeding/ManualGenotypePicker.jsx. Unknown slugs
 * fall through to PageNotFound rather than to the bare calculator,
 * because any /calculator/:morph URL we shipped a route for is one we
 * also shipped a sitemap entry for; an unknown slug means a typo or a
 * removed morph and shouldn't 200.
 */
export default function CalculatorMorph() {
  const { morph } = useParams();
  const trait = PICKER_TRAITS_BY_SLUG[morph];

  if (!trait) {
    return <PageNotFound />;
  }

  // For incomplete-dominant traits with a super form, default to the
  // visible heterozygous expression (the common "I have one of these,
  // what happens if I breed it?" question). For recessives, default
  // to a het carrier (the second-most-common question after "what if
  // I cross two visuals"). For dominants, default to expressing.
  const defaultZyg = trait.dominance === 'recessive' ? 'het'
    : trait.dominance === 'incomplete_dominant' ? 'het'
    : 'visual';

  const initialSireZygosity = { [trait.id]: defaultZyg };

  const title = `${trait.label} Genetics Calculator ,  Crested Gecko`;
  const description = `Free Punnett-square calculator for crested gecko ${trait.label} pairings. Predict offspring outcomes when one parent carries ${trait.label}. ${trait.blurb} No signup required.`;
  const path = `/calculator/${trait.slug}`;

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
      { name: trait.label, path },
    ]),
  ];

  const intro = (
    <div className="mb-6 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 md:p-5">
      <h2 className="text-base font-semibold text-purple-200 mb-1">
        About {trait.label}
      </h2>
      <p className="text-sm text-slate-300 leading-relaxed">
        {trait.blurb}
      </p>
      {trait.super_lethal && (
        <p className="text-xs text-red-300 mt-2 leading-relaxed">
          <strong>Lethal-super warning:</strong> homozygous{' '}
          <em>Super {trait.label}</em> embryos die in the egg. The
          calculator includes that outcome in the math so you can see
          the expected loss percentage.
        </p>
      )}
      {trait.super_warning && !trait.super_lethal && (
        <p className="text-xs text-amber-300 mt-2 leading-relaxed">
          <strong>Health note:</strong> {trait.super_warning}
        </p>
      )}
      <p className="text-xs text-slate-500 mt-2">
        Parent A has been pre-filled with{' '}
        <strong className="text-slate-300">{trait.label}</strong>.
        Add traits to Parent B below to see the predicted offspring
        distribution.
      </p>
    </div>
  );

  return (
    <GeneticCalculatorTool
      key={trait.id /* remount on slug change so the prefill applies cleanly */}
      initialSireZygosity={initialSireZygosity}
      pageTitle={title}
      pageDescription={description}
      pagePath={path}
      pageBreadcrumb={trait.label}
      pageJsonLd={jsonLd}
      pageKeywords={[
        `${trait.label.toLowerCase()} crested gecko genetics`,
        `${trait.label.toLowerCase()} breeding calculator`,
        `${trait.label.toLowerCase()} punnett square`,
        'crested gecko genetics calculator',
        'crested gecko breeding outcomes',
        ...(trait.super_lethal ? [`super ${trait.label.toLowerCase()} lethal`] : []),
      ]}
      introSlot={intro}
    />
  );
}
