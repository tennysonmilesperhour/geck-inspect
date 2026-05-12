import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Dna, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/seo/Seo';
import PublicPageShell from '@/components/public/PublicPageShell';
import {
  MORPHS,
  MORPH_CATEGORIES,
  INHERITANCE,
  RARITY,
} from '@/data/morph-guide';
import { breadcrumbSchema, ORG_ID, SITE_URL } from '@/lib/organization-schema';
import { createPageUrl } from '@/utils';

/**
 * Programmatic taxonomy hub page for the morph catalog.
 *
 * Two variants, driven by the URL:
 *   /MorphGuide/category/<categoryId>     ,  pattern / base / color / structure / combo
 *   /MorphGuide/inheritance/<inheritance> ,  recessive / co-dominant / dominant / polygenic / line-bred
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

const RARITY_LABEL = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very Rare',
};

function MorphTile({ morph }) {
  const rarityColor = RARITY[morph.rarity]?.color || 'bg-slate-700/40 text-slate-300 border-slate-600';
  return (
    <Link
      to={`/MorphGuide/${morph.slug}`}
      className="group rounded-xl border border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 hover:bg-slate-900 p-4 transition-colors block"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-slate-100 group-hover:text-emerald-200 leading-tight">
          {morph.name}
        </h3>
        {morph.rarity && (
          <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider rounded-full border px-2 py-0.5 ${rarityColor}`}>
            {RARITY_LABEL[morph.rarity] || morph.rarity}
          </span>
        )}
      </div>
      {morph.summary && (
        <p className="text-xs text-slate-400 leading-snug line-clamp-3">{morph.summary}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wider font-semibold">
        {morph.inheritance && INHERITANCE[morph.inheritance] && (
          <span className={`rounded-full border px-2 py-0.5 ${INHERITANCE[morph.inheritance].color}`}>
            {INHERITANCE[morph.inheritance].short}
          </span>
        )}
        {morph.priceTier && (
          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300">
            {morph.priceTier}
          </span>
        )}
      </div>
    </Link>
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
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${url}#webpage`,
      name: `${label} ,  Crested Gecko Morph Guide`,
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
        title={`${label} ,  Crested Gecko Morphs`}
        description={seoDescription}
        path={path}
        keywords={seoKeywords}
        jsonLd={jsonLd}
      />

      <section className="max-w-5xl mx-auto px-6 pt-4 pb-16">
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
        <p className="text-slate-300 leading-relaxed max-w-3xl mb-8">{bodyIntro}</p>
        <p className="text-slate-500 text-sm mb-10">{morphs.length} documented morphs.</p>

        {morphs.length === 0 ? (
          <p className="text-slate-400">No morphs match this filter yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {morphs.map((m) => (
              <MorphTile key={m.slug} morph={m} />
            ))}
          </div>
        )}

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
                  className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:text-emerald-200 transition-colors"
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
                  className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:text-emerald-200 transition-colors"
                >
                  {inh.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>

        <section className="mt-12 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Track {label.toLowerCase()} on Geck Inspect</h2>
          <p className="text-slate-300 mb-5 leading-relaxed">
            Free collection manager built for the crested gecko hobby. Log weights, plan breedings, visualize lineage, and identify morphs with AI.
          </p>
          <Link to={createPageUrl('AuthPortal')}>
            <Button size="lg" className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-lg shadow-emerald-500/30">
              Create a free account <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </section>
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
