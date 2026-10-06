import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Dna, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import ContentSignupPrompt from '@/components/public/ContentSignupPrompt';
import PublicPageShell from '@/components/public/PublicPageShell';
import {
  MORPHS,
  MORPH_CATEGORIES,
  INHERITANCE,
} from '@/data/morph-guide';
import MorphIndexCard from '@/components/morphguide/MorphIndexCard';
import MorphHubCta from '@/components/morphguide/MorphHubCta';
import { useMorphGuideData } from '@/components/morphguide/MorphIndexData';
import { breadcrumbSchema, ORG_ID, SITE_URL } from '@/lib/organization-schema';

/**
 * Programmatic taxonomy hub page for the morph catalog.
 *
 * Two variants, driven by the URL:
 *   /MorphGuide/category/<categoryId>    , pattern / base / color / structure / combo
 *   /MorphGuide/inheritance/<inheritance>, recessive / co-dominant / dominant / polygenic / line-bred
 *
 * Each hub lists the morphs that match and emits:
 *   - Article + BreadcrumbList JSON-LD so the page is an indexable entity
 *   - ItemList with named members so AI crawlers can extract the full
 *     morph set from the page without running JS
 *   - Dense internal links to every matching MorphGuide/<slug> page
 *
 * The goal is two-fold: capture "all recessive crested gecko morphs"
 * style queries, and build an internal link graph that concentrates
 * topical authority across the ~30 morph pages.
 */

/**
 * Shown when a hub has no morphs, for example "Dominant": no crested gecko
 * gene has been proven to work that way. Explains why and points to the
 * hubs that do have entries instead of showing a bare "nothing here".
 */
function EmptyHub({ label }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8 text-center">
      <Dna className="w-10 h-10 text-slate-600 mx-auto mb-3" />
      <p className="text-slate-200 font-semibold mb-2">
        No crested gecko morph is documented as {label.toLowerCase()} yet
      </p>
      <p className="text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">
        Most proven crested gecko genes are incomplete dominant, like Lilly White, Cappuccino and
        Soft Scale, or recessive, like Axanthic. Pattern morphs such as Harlequin and Pinstripe are
        polygenic. If a new gene is proven, it will appear here.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link
          to="/MorphGuide/inheritance/incomplete-dominant"
          className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 px-3 py-1.5 text-sm text-slate-200 hover:text-emerald-200"
        >
          Incomplete dominant morphs
        </Link>
        <Link
          to="/MorphGuide/inheritance/recessive"
          className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 px-3 py-1.5 text-sm text-slate-200 hover:text-emerald-200"
        >
          Recessive morphs
        </Link>
        <Link
          to="/MorphGuide"
          className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 px-3 py-1.5 text-sm text-slate-200 hover:text-emerald-200"
        >
          All morphs
        </Link>
      </div>
    </div>
  );
}

function NotFound({ variant, id }) {
  return (
    <PublicPageShell>
      <Seo
        title="Morph taxonomy not found"
        description={`No crested gecko morph taxonomy found for ${variant}/${id}.`}
        path={`/MorphGuide/${variant}/${id}`}
        noIndex
      />
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-slate-100 mb-3">Nothing here</h1>
        <p className="text-slate-400 mb-6">No morphs match "{id}". Start from the full guide instead.</p>
        <Link to="/MorphGuide">
          <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to the Morph Guide
          </Button>
        </Link>
      </section>
    </PublicPageShell>
  );
}

export function MorphCategoryHub() {
  const { categoryId } = useParams();
  const cat = MORPH_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return <NotFound variant="category" id={categoryId} />;
  const morphs = MORPHS.filter((m) => m.category === categoryId);
  return (
    <TaxonomyHub
      variant="category"
      id={categoryId}
      label={cat.label}
      icon={Sparkles}
      path={`/MorphGuide/category/${categoryId}`}
      morphs={morphs}
      seoKeywords={[
        `crested gecko ${cat.label.toLowerCase()} morphs`,
        `crested gecko ${categoryId} morphs`,
        `list of crested gecko ${cat.label.toLowerCase()} morphs`,
      ]}
      seoDescription={`Every crested gecko ${cat.label.toLowerCase()} morph. ${cat.blurb} ${morphs.length} documented ${cat.label.toLowerCase()} morphs with inheritance, rarity, and links to per-morph detail pages.`}
      sectionTitle={`${cat.label} morphs`}
      bodyIntro={cat.blurb}
    />
  );
}

export function MorphInheritanceHub() {
  const { inheritanceId } = useParams();
  const inh = INHERITANCE[inheritanceId];
  if (!inh) return <NotFound variant="inheritance" id={inheritanceId} />;
  const morphs = MORPHS.filter((m) => m.inheritance === inheritanceId);
  return (
    <TaxonomyHub
      variant="inheritance"
      id={inheritanceId}
      label={`${inh.label} morphs`}
      icon={Dna}
      path={`/MorphGuide/inheritance/${inheritanceId}`}
      morphs={morphs}
      seoKeywords={[
        `${inh.label.toLowerCase()} crested gecko morphs`,
        `${inh.label.toLowerCase()} gecko genes`,
        `crested gecko ${inh.label.toLowerCase()} inheritance`,
      ]}
      seoDescription={`${inh.label} crested gecko morphs. ${inh.description} ${morphs.length} documented ${inh.label.toLowerCase()} morphs with rarity, visual cues, and links to per-morph detail pages.`}
      sectionTitle={`${inh.label} crested gecko morphs`}
      bodyIntro={inh.description}
    />
  );
}

function TaxonomyHub({
  variant,
  id,
  label,
  icon: Icon,
  path,
  morphs,
  seoKeywords,
  seoDescription,
  sectionTitle,
  bodyIntro,
}) {
  const url = `${SITE_URL}${path}`;
  // Same photos as the index cards. The list itself comes from the local
  // data, so the hub renders at once and photos fade in when they arrive.
  const { allMorphs } = useMorphGuideData();
  const cards = useMemo(() => {
    const bySlug = new Map(allMorphs.map((m) => [m.slug, m]));
    return morphs.map((m) => bySlug.get(m.slug) || m);
  }, [allMorphs, morphs]);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${url}#webpage`,
      name: `${label}, Crested Gecko Morph Guide`,
      url,
      description: seoDescription,
      about: {
        '@type': 'Thing',
        name: 'Crested gecko morphs',
        sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
      },
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': ORG_ID },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${url}#itemlist`,
      name: `${label} crested gecko morphs`,
      numberOfItems: morphs.length,
      itemListElement: morphs.map((m, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${SITE_URL}/MorphGuide/${m.slug}`,
        name: m.name,
      })),
    },
    breadcrumbSchema([
      { name: 'Home', path: '/' },
      { name: 'Morph Guide', path: '/MorphGuide' },
      { name: label, path },
    ]),
  ];

  return (
    <PublicPageShell>
      <Seo
        title={`${label}, Crested Gecko Morphs`}
        description={seoDescription}
        path={path}
        keywords={seoKeywords}
        jsonLd={jsonLd}
      />

      <section className="max-w-6xl mx-auto px-4 md:px-6 pt-4 pb-16">
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
          <Link to="/" className="hover:text-slate-300">Home</Link>
          <span>/</span>
          <Link to="/MorphGuide" className="hover:text-slate-300">Morph Guide</Link>
          <span>/</span>
          <span className="text-slate-400">{label}</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
          <Icon className="w-3.5 h-3.5" />
          {variant === 'inheritance' ? 'Inheritance' : 'Category'}
        </div>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] mb-3 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
          {sectionTitle}
        </h1>
        <p className="text-slate-300 leading-relaxed max-w-3xl mb-2">{bodyIntro}</p>
        <p className="text-slate-500 text-sm mb-6">
          {morphs.length === 0
            ? 'No documented morphs yet.'
            : `${morphs.length} documented ${morphs.length === 1 ? 'morph' : 'morphs'}.`}
        </p>

        {morphs.length === 0 ? (
          <EmptyHub label={label.replace(/ morphs$/, '')} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {cards.map((m) => (
              <MorphIndexCard key={m.slug} morph={m} />
            ))}
          </div>
        )}

        <MorphHubCta variant={variant} id={id} className="mt-8" />

        {/* Cross-links to sibling hubs keep crawlers moving across the
            taxonomy and build dense internal linking. */}
        <nav className="mt-12 border-t border-slate-800/60 pt-6 space-y-4">
          <div>
            <div className="text-xs uppercase font-semibold tracking-wider text-slate-500 mb-2">
              By category
            </div>
            <div className="flex flex-wrap gap-2">
              {MORPH_CATEGORIES.map((c) => (
                <Link
                  key={c.id}
                  to={`/MorphGuide/category/${c.id}`}
                  className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:text-emerald-200 transition-colors"
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase font-semibold tracking-wider text-slate-500 mb-2">
              By inheritance
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.values(INHERITANCE).map((inh) => (
                <Link
                  key={inh.id}
                  to={`/MorphGuide/inheritance/${inh.id}`}
                  className="touch:min-h-11 inline-flex items-center rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:text-emerald-200 transition-colors"
                >
                  {inh.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <ContentSignupPrompt
          variant="panel"
          pageType="morph_hub"
          ctaId="morph_hub_end"
          className="mt-12"
          headline="Track the morphs in your own collection, free"
          body="Log each gecko's morph, hets, parents and weights. Geck Inspect builds the pedigree as you go and estimates each gecko's value from real crested gecko listings."
        />
      </section>
    </PublicPageShell>
  );
}

// Default export for lazy-loading ergonomics in App.jsx. The router
// picks the right hub based on URL variant.
export default function MorphTaxonomyRouter() {
  const params = useParams();
  if (params.categoryId) return <MorphCategoryHub />;
  if (params.inheritanceId) return <MorphInheritanceHub />;
  return <NotFound variant="unknown" id={params.id || ''} />;
}
