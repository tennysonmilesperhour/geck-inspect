import { useEffect, useMemo, useState } from 'react';
import { APP_LOGO_URL, DEFAULT_GECKO_IMAGE } from "@/lib/constants";
import { Link, useParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ArrowRight,
  Dna,
  Sparkles,
  BookOpen,
  GitBranch,
  Star,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import {
  morphSlug,
  morphDisplayName,
  pickBestMorphRecord,
  KNOWN_MORPH_SLUGS,
} from '@/lib/morphUtils';
import {
  getMorph,
  MORPH_CATEGORIES,
  INHERITANCE,
  PRICE_TIERS,
} from '@/data/morph-guide';
import { authorSchema, bylineText, editorialFor } from '@/lib/editorial';

const LOGO_URL = APP_LOGO_URL;

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very Rare',
};

const RARITY_COLORS = {
  common: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  uncommon: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  rare: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  very_rare: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

// Safe-enough image — strips the broken external URLs we found during
// the migration so Wikipedia rate-limited / YouTube-404 images don't
// render as broken thumbnails on the hero.
function sanitizeImage(url) {
  if (!url) return null;
  if (
    url.includes('ytimg.com') ||
    url.includes('altitudeexotics.com') ||
    url.endsWith('.html')
  ) {
    return null;
  }
  return url;
}

export default function MorphDetail() {
  const { slug } = useParams();
  const [record, setRecord] = useState(null);
  const [communityImages, setCommunityImages] = useState([]);
  const [relatedMorphs, setRelatedMorphs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const displayName = useMemo(() => morphDisplayName(slug), [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setNotFound(false);
      try {
        // Broad fetch of every morph_guide record, then dedupe in JS.
        // Tiny table (<100 rows) so no indexing concerns.
        const { data, error } = await supabase
          .from('morph_guides')
          .select(
            'id, morph_name, description, key_features, example_image_url, rarity, breeding_info'
          )
          .limit(200);
        if (error) throw error;
        if (cancelled) return;

        const matches = (data || []).filter(
          (r) => morphSlug(r.morph_name) === slug
        );
        const best = pickBestMorphRecord(matches);
        const localMorph = getMorph(slug);

        // Fall back to local dataset if no DB record exists — our
        // local morph-guide.js is the authoritative reference and
        // covers every KNOWN_MORPH_SLUGS entry.
        if (!best && !localMorph) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setRecord(
          best ||
            (localMorph && {
              morph_name: localMorph.name,
              description: localMorph.description,
              key_features: localMorph.keyFeatures,
              rarity: localMorph.rarity,
              example_image_url: null,
              breeding_info: null,
            }),
        );

        // Related morphs: pull a small set of other morphs for cross-linking
        const others = {};
        for (const r of data || []) {
          const s = morphSlug(r.morph_name);
          if (!s || s === slug) continue;
          if (!others[s]) others[s] = r;
        }
        setRelatedMorphs(
          Object.entries(others)
            .slice(0, 8)
            .map(([s, r]) => ({ slug: s, name: r.morph_name, rarity: r.rarity }))
        );

        // Community photos of this morph from the gallery — nice touch if we have them
        try {
          const normalized = best.morph_name.toLowerCase();
          const firstWord = normalized.split(/\s+/)[0];
          const { data: imgs } = await supabase
            .from('gecko_images')
            .select('id, image_url, primary_morph')
            .ilike('primary_morph', `%${firstWord}%`)
            .limit(8);
          if (!cancelled) setCommunityImages(imgs || []);
        } catch {
          /* gallery is a bonus; ignore failures */
        }
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // --- loading state ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // --- not found state ---
  if (notFound || !record) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-4">
          <Dna className="w-12 h-12 text-slate-600 mx-auto" />
          <h1 className="text-2xl font-bold">Morph not found</h1>
          <p className="text-slate-400">
            We couldn&rsquo;t find a morph guide entry for &ldquo;{displayName}&rdquo;.
          </p>
          <Link to="/MorphGuide">
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to the morph guide
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // --- success state ---
  const morphName = record.morph_name;
  const heroImage = sanitizeImage(record.example_image_url) || communityImages[0]?.image_url || DEFAULT_GECKO_IMAGE;
  const rarityLabel = RARITY_LABELS[record.rarity] || record.rarity || 'Unknown';
  const rarityColor = RARITY_COLORS[record.rarity] || 'bg-slate-700/40 text-slate-300 border-slate-600';
  // Prefer local dataset's key features over DB field so the
  // authoritative reference wins even if DB has sparse data.
  const localMorph = getMorph(slug);
  const keyFeatures = localMorph?.keyFeatures?.length
    ? localMorph.keyFeatures
    : Array.isArray(record.key_features)
    ? record.key_features
    : [];
  const description = localMorph?.description || record.description;
  const inheritance = localMorph?.inheritance
    ? INHERITANCE[localMorph.inheritance]
    : null;
  const category = localMorph?.category
    ? MORPH_CATEGORIES.find((c) => c.id === localMorph.category)
    : null;

  // Schema.org: treat each morph as both an Article and a DefinedTerm. The
  // DefinedTerm is what makes the morph name itself a structured piece of
  // data that AI assistants and Google Knowledge Graph can cite.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        '@id': `https://geckinspect.com/MorphGuide/${slug}#term`,
        name: morphName,
        description: record.description,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: 'Crested Gecko Morphs',
          url: 'https://geckinspect.com/MorphGuide',
        },
      },
      (() => {
        const editorial = editorialFor(`/MorphGuide/${slug}`);
        return {
          '@type': 'Article',
          '@id': `https://geckinspect.com/MorphGuide/${slug}#article`,
          headline: `${morphName} — Crested Gecko Morph Guide`,
          description: record.description?.slice(0, 280),
          url: `https://geckinspect.com/MorphGuide/${slug}`,
          image: heroImage,
          about: {
            '@type': 'Thing',
            name: 'Crested gecko',
            alternateName: 'Correlophus ciliatus',
            sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
          },
          mentions: [{ '@id': `https://geckinspect.com/MorphGuide/${slug}#term` }],
          author: authorSchema(),
          reviewedBy: authorSchema(),
          datePublished: editorial.published,
          dateModified: editorial.modified,
          publisher: {
            '@type': 'Organization',
            name: 'Geck Inspect',
            logo: LOGO_URL,
          },
        };
      })(),
    ],
  };

  const metaDescription = `${morphName} is a ${rarityLabel.toLowerCase()} crested gecko morph. ${
    record.description ? record.description.slice(0, 200) : ''
  }`.trim();

  return (
    <>
      <Seo
        title={`${morphName} Morph — Crested Gecko Guide`}
        description={metaDescription}
        path={`/MorphGuide/${slug}`}
        image={heroImage}
        jsonLd={jsonLd}
        type="article"
      />

      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Top nav */}
        <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img src={LOGO_URL} alt="Geck Inspect" className="h-10 w-10 rounded-xl" />
            <span className="text-xl font-bold tracking-tight">Geck Inspect</span>
          </Link>
          <Link to={createPageUrl('AuthPortal')}>
            <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
              Sign In
            </Button>
          </Link>
        </header>

        {/* Hero */}
        <article className="max-w-4xl mx-auto px-6 pt-8 pb-16">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-6">
            <Link to="/" className="hover:text-slate-300">Home</Link>
            <span>/</span>
            <Link to="/MorphGuide" className="hover:text-slate-300">Morph Guide</Link>
            <span>/</span>
            <span className="text-slate-400">{morphName}</span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
            <Dna className="w-3.5 h-3.5" />
            Crested Gecko Morph
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
            {morphName}
          </h1>

          <p className="text-xs text-slate-500 mb-4">{bylineText(`/MorphGuide/${slug}`)}</p>

          <div className="flex flex-wrap gap-2 mb-8">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${rarityColor}`}>
              <Star className="w-3 h-3" />
              {rarityLabel}
            </span>
            {category && (
              // Link the category pill to the taxonomy hub so crawlers
              // get one more path into the programmatic SEO graph.
              <Link
                to={`/MorphGuide/category/${category.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200 transition-colors"
              >
                {category.label}
              </Link>
            )}
            {inheritance && (
              <Link
                to={`/MorphGuide/inheritance/${inheritance.id}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold hover:brightness-125 transition ${inheritance.color}`}
              >
                <Dna className="w-3 h-3" />
                {inheritance.label}
              </Link>
            )}
            {localMorph?.priceTier && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200">
                {localMorph.priceTier}
                {localMorph.priceRange ? ` · ${localMorph.priceRange}` : ''}
              </span>
            )}
          </div>

          {/* Hero image */}
          {heroImage && (
            <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 mb-10">
              <img
                src={heroImage}
                alt={`Example ${morphName} crested gecko`}
                className="w-full max-h-[500px] object-cover"
                loading="eager"
              />
            </div>
          )}

          {/* Summary (from local dataset if available) */}
          {localMorph?.summary && (
            <p className="text-lg md:text-xl text-slate-200 leading-relaxed mb-8 border-l-4 border-emerald-500/50 pl-4">
              {localMorph.summary}
            </p>
          )}

          {/* Description */}
          {description && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                About the {morphName} morph
              </h2>
              <div className="text-slate-300 leading-relaxed space-y-3">
                {description.split(/\n+/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}

          {/* Genetics + pricing at-a-glance */}
          {(inheritance || localMorph?.priceTier) && (
            <section className="mb-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              {inheritance && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-2">
                    <Dna className="w-3.5 h-3.5" />
                    Inheritance
                  </div>
                  <div className="text-white font-semibold text-lg mb-1.5">
                    {inheritance.label}
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {inheritance.description}
                  </p>
                </div>
              )}
              {localMorph?.priceTier && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-2">
                    <Star className="w-3.5 h-3.5" />
                    Price tier
                  </div>
                  <div className="text-white font-semibold text-lg mb-1.5">
                    {PRICE_TIERS[localMorph.priceTier]?.label || localMorph.priceTier}
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {localMorph.priceRange
                      ? `Typical adult range: ${localMorph.priceRange}. `
                      : ''}
                    {PRICE_TIERS[localMorph.priceTier]?.description || ''}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Key features */}
          {keyFeatures.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Key features
              </h2>
              <ul className="space-y-2">
                {keyFeatures.map((feat, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-slate-300 leading-relaxed"
                  >
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Visual identifiers */}
          {localMorph?.visualIdentifiers?.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-emerald-400" />
                How to identify a {morphName}
              </h2>
              <ul className="space-y-2">
                {localMorph.visualIdentifiers.map((v, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-slate-300 leading-relaxed"
                  >
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2" />
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* History */}
          {localMorph?.history && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                Origin and history
              </h2>
              <p className="text-slate-300 leading-relaxed">{localMorph.history}</p>
            </section>
          )}

          {/* Combines with */}
          {localMorph?.combinesWith?.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-emerald-400" />
                Combines with
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Common and compatible morph pairings that produce {morphName}-based combos.
              </p>
              <div className="flex flex-wrap gap-2">
                {localMorph.combinesWith.map((s) => {
                  const target = getMorph(s);
                  const name = target?.name || morphDisplayName(s);
                  return (
                    <Link
                      key={s}
                      to={`/MorphGuide/${s}`}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/50 hover:bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200 hover:text-emerald-100 transition-colors"
                    >
                      {name}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Notes / warnings */}
          {localMorph?.notes && (
            <section className="mb-10">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Breeder note
                </div>
                <p className="text-slate-200 leading-relaxed">{localMorph.notes}</p>
              </div>
            </section>
          )}

          {/* Breeding info (from DB) */}
          {record.breeding_info && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-emerald-400" />
                Breeding information
              </h2>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 text-slate-300 leading-relaxed">
                {record.breeding_info.split(/\n+/).map((p, i) => (
                  <p key={i} className={i > 0 ? 'mt-3' : ''}>
                    {p}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* Community examples */}
          {communityImages.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-2">
                <Dna className="w-5 h-5 text-emerald-400" />
                From the Geck Inspect community
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                {morphName} crested geckos uploaded by keepers tracking their collections
                on Geck Inspect.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {communityImages.map((img) => (
                  <div
                    key={img.id}
                    className="aspect-square rounded-xl overflow-hidden border border-slate-800 bg-slate-900"
                  >
                    <img
                      src={img.image_url}
                      alt={`${morphName} crested gecko`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related morphs */}
          {relatedMorphs.length > 0 && (
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-white mb-3">Other crested gecko morphs</h2>
              <div className="flex flex-wrap gap-2">
                {relatedMorphs.map((m) => (
                  <Link
                    key={m.slug}
                    to={`/MorphGuide/${m.slug}`}
                    className="rounded-full border border-slate-700 bg-slate-900 hover:border-emerald-500/40 hover:bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:text-emerald-200 transition-colors"
                  >
                    {m.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="mt-12 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
              Track your {morphName} geckos on Geck Inspect
            </h2>
            <p className="text-slate-300 mb-5 leading-relaxed">
              Free to use. Log weights, plan breedings, visualize lineages, and identify morphs
              with AI — built specifically for the crested gecko hobby.
            </p>
            <Link to={createPageUrl('AuthPortal')}>
              <Button
                size="lg"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-lg shadow-emerald-500/30"
              >
                Create a free account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </section>
        </article>

        {/* Footer */}
        <footer className="border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Geck Inspect" className="h-6 w-6 rounded" />
              <span>© {new Date().getFullYear()} Geck Inspect · geckOS</span>
            </div>
            <div className="flex items-center gap-5">
              <Link to="/" className="hover:text-slate-300">Home</Link>
              <Link to="/MorphGuide" className="hover:text-slate-300">Morph Guide</Link>
              <Link to={createPageUrl('CareGuide')} className="hover:text-slate-300">
                Care Guide
              </Link>
              <Link to={createPageUrl('AuthPortal')} className="hover:text-slate-300">
                Sign in
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

// Re-export for consumers that want the known-slug list
export { KNOWN_MORPH_SLUGS };
