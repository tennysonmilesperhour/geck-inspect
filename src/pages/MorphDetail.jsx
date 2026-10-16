import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { APP_LOGO_URL, DEFAULT_GECKO_IMAGE_URL } from '@/lib/constants';
import { Link, useNavigate, useParams } from 'react-router-dom';
// Loaded on first use, not with the page (src/lib/supabaseLazy.js).
import { getSupabase } from '@/lib/supabaseLazy';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronDown,
  CircleDollarSign,
  Dna,
  Eye,
  Images,
  Shuffle,
  Sparkles,
  Users,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import {
  morphSlug,
  morphDisplayName,
  pickBestMorphRecord,
  indexMorphsBySlug,
  KNOWN_MORPH_SLUGS,
} from '@/lib/morphUtils';
import {
  getMorph,
  MORPH_CATEGORIES,
  INHERITANCE,
  PRICE_TIERS,
} from '@/data/morph-guide';
import { article, morphSeo } from '@/lib/morphMeta';
import { isLivingMorph, notBredStatus } from '@/lib/morphNotBred';
import { morphSourceLinks } from '@/lib/morphSourceLabel';
import { galleryMorphTerm } from '@/lib/morphGallery';
import { authorSchema, bylineText, editorialFor } from '@/lib/editorial';
import { morphFaq, morphFaqSchema } from '@/lib/morphFaq';
import { getMorphReferenceImages } from '@/lib/geckDataClient';
import { licenseLabel } from '@/lib/imageLicenses';
import { fetchMorphCommunityPhotos } from '@/lib/morphPhotoSubmissions';
import { lazyOptional } from '@/components/gecko/record/loadOnDemand';
import { useBlockedMembers } from '@/hooks/useBlockedAuthors';
import PublicPageShell from '@/components/public/PublicPageShell';
import ContentSignupPrompt, { possessive } from '@/components/public/ContentSignupPrompt';
import MorphActions, { InlineMorphCta } from '@/components/morphguide/MorphActions';
import MorphLookalikes from '@/components/morphguide/MorphLookalikes';
import RelatedMorphs, { MorphPrevNext } from '@/components/morphguide/RelatedMorphs';
import MorphSectionNav from '@/components/morphguide/MorphSectionNav';
import Reveal from '@/components/morphguide/Reveal';
import { calculatorHref, trackMorphCta } from '@/components/morphguide/morphCta';
import {
  CALCULATOR_PAGES_BY_SLUG,
  COMPLEX_OPTIONS_BY_VALUE,
  SIMPLE_TRAITS,
} from '@/lib/genetics/calculatorCatalog';
import MorphText from '@/components/morphguide/MorphText';
import { MorphImageContext, morphInitials } from '@/components/morphguide/MorphPreviewCard';
import MorphGeneticsDemo, { geneticsDemoFor } from '@/components/morphguide/MorphGeneticsDemo';
import MorphProgressBar from '@/components/morphguide/MorphProgressBar';
import MorphSwipeNav from '@/components/morphguide/MorphSwipeNav';
import PatternSpectrum, { spectrumPositionFor } from '@/components/morphguide/PatternSpectrum';
import IllustratedGecko, { hasIllustration } from '@/components/morphguide/IllustratedGecko';

// The report button on member photos loads with the first photo, not with
// the page: it renders nothing for signed-out visitors, and its dialog,
// select and moderation code were about 12 kB of every visit's download.
// lazyOptional, not React.lazy: a tab open across a release asks for a
// file name that no longer exists, and a phone can drop one request. The
// download is retried twice and then the button is left out, instead of
// the whole page falling through to the app's "Something went wrong"
// screen (for signed-out visitors too, who never see the button).
const ReportContent = lazyOptional(() => import('@/components/support/ReportContent'));

/**
 * The badge the genetics calculator gives the gene behind a morph page:
 * 'proven', 'emerging', or null when the calculator does not model it.
 * Reads the one-copy pages (/calculator/<slug>), the Cappuccino group's
 * combos and supers (Luwak, Super Sable) and the supers of the other genes
 * (Super Empty Back takes Empty Back's badge).
 */
export function calculatorBadge(slug) {
  const page = CALCULATOR_PAGES_BY_SLUG[slug];
  if (page) return page.confidence;
  const option = COMPLEX_OPTIONS_BY_VALUE[String(slug).replace(/-/g, '_')];
  if (option?.confidence) return option.confidence;
  const gene = SIMPLE_TRAITS.find((t) => t.super_label?.toLowerCase().replace(/\s+/g, '-') === slug);
  return gene?.confidence || null;
}

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very rare',
};

// Fallback hero wash per category, used when there is no photo yet.
const HERO_FALLBACK_TONE = {
  base: 'from-orange-500/25 via-amber-500/10',
  color: 'from-violet-500/25 via-fuchsia-500/10',
  pattern: 'from-emerald-500/25 via-teal-500/10',
  structure: 'from-sky-500/25 via-cyan-500/10',
  combo: 'from-amber-500/25 via-rose-500/10',
};

// Safe-enough image: strips the broken external URLs we found during
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

/**
 * Lets the Morph Guide index put the visitor back where they were: the
 * index reads this key on load and scrolls to the card for `slug`.
 */
function rememberGuideReturn(slug) {
  try {
    window.sessionStorage.setItem('morphGuide:return', JSON.stringify({ slug, at: Date.now() }));
  } catch {
    /* storage blocked: the index just opens at the top */
  }
}

/**
 * Hero photo in a fixed 4:3 box so the page never jumps when it loads.
 * With no photo (or a broken one) the box shows a styled placeholder and
 * an invitation to add a photo, instead of collapsing to nothing.
 */
function HeroImage({ src, name, slug, category, invitePhoto = true }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const showPhoto = src && !failed;
  return (
    <figure className="m-0">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
        {showPhoto ? (
          <img
            src={src}
            alt={`${name} crested gecko`}
            width="800"
            height="600"
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
            onError={() => setFailed(true)}
            // React 18 drops the camelCase fetchPriority prop, so pass the
            // lowercase attribute straight through (same as Home.jsx).
            {...{ fetchpriority: 'high' }}
          />
        ) : (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${
              HERO_FALLBACK_TONE[category] || 'from-emerald-500/25 via-teal-500/10'
            } to-neutral-950`}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:18px_18px]"
            />
            {hasIllustration(slug) ? (
              <IllustratedGecko morph={slug} decorative className="relative w-[92%] h-auto max-h-[85%]" />
            ) : (
              <span
                aria-hidden="true"
                className="relative text-6xl md:text-7xl font-bold tracking-tight text-white/80"
              >
                {morphInitials(name)}
              </span>
            )}
            {invitePhoto ? (
              <>
                <span className="relative mt-2 text-sm text-neutral-300">{hasIllustration(slug) ? `${name} · illustrative feature study` : `${name} · documented photo needed`}</span>
                <Link
                  to={`/MorphGuideSubmission?morph=${slug}`}
                  onClick={() => trackMorphCta(slug, '/MorphGuideSubmission', 'hero_add_photo')}
                  className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-black/50 hover:text-white transition-colors"
                >
                  <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                  Have one? Add the first photo
                </Link>
              </>
            ) : (
              <span className="relative mt-2 text-sm text-neutral-300">{`${name} · no living animal to photograph`}</span>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

/**
 * Shown instead of the "identify it, price it, breed it" strip on a super
 * form breeders avoid making (src/lib/morphNotBred.js): what the page is
 * about, and the pairing to use instead.
 */
function NotBredNote({ slug, status }) {
  const lethal = status.reason === 'lethal';
  const pairingTo = status.pairingHref || (status.parent ? calculatorHref(status.parent.slug) : '/calculator');
  return (
    <aside
      aria-label={status.title}
      className={`rounded-xl border p-4 sm:p-5 ${lethal ? 'border-rose-500/30 bg-rose-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}
    >
      <div className={`flex items-center gap-2 text-sm font-semibold ${lethal ? 'text-rose-200' : 'text-amber-200'}`}>
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {status.title}
      </div>
      {status.safeText && <p className="mt-2 leading-relaxed text-neutral-200">{status.safeText}</p>}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
        <Link
          to={pairingTo}
          onClick={() => trackMorphCta(slug, pairingTo, 'not_bred_safe_pairing')}
          className="inline-flex items-center min-h-11 text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
        >
          {status.safeLabel ? `See ${status.safeLabel} in the calculator` : 'Check a pairing in the calculator'}
        </Link>
        {status.parent && (
          <Link
            to={`/MorphGuide/${status.parent.slug}`}
            onClick={() => trackMorphCta(slug, `/MorphGuide/${status.parent.slug}`, 'not_bred_parent')}
            className="inline-flex items-center min-h-11 text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            Read the {status.parent.name} guide
          </Link>
        )}
      </div>
    </aside>
  );
}

function SectionHeading({ icon: Icon, children }) {
  return (
    <h2 className="text-2xl md:text-[1.7rem] font-bold text-white mb-4 flex items-center gap-2.5 leading-tight">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
        <Icon className="w-[18px] h-[18px] text-emerald-300" aria-hidden="true" />
      </span>
      {children}
    </h2>
  );
}

function BulletList({ items, linkSlug }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3 text-neutral-300 leading-relaxed">
          <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2.5" />
          <span>{linkSlug ? <MorphText text={item} currentSlug={linkSlug} /> : item}</span>
        </li>
      ))}
    </ul>
  );
}

function localRecordFor(slug) {
  const localMorph = getMorph(slug);
  return localMorph && {
    morph_name: localMorph.name,
    description: localMorph.description,
    key_features: localMorph.keyFeatures,
    rarity: localMorph.rarity,
    example_image_url: null,
    breeding_info: null,
  };
}

export default function MorphDetail() {
  const { slug } = useParams();
  // The built-in guide is there at once, so the first render already shows
  // the page instead of a spinner for one frame.
  const [record, setRecord] = useState(() => localRecordFor(slug) || null);
  const [communityImages, setCommunityImages] = useState([]);
  // Approved Morph Guide photo submissions, credited by display name.
  const [submittedPhotos, setSubmittedPhotos] = useState([]);
  const [referenceImages, setReferenceImages] = useState([]);
  // Best photo per morph from the morph_guides rows, for link previews
  // and the lookalike comparison tiles.
  const [imageBySlug, setImageBySlug] = useState({});
  const articleRef = useRef(null);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(() => !getMorph(slug));
  const [notFound, setNotFound] = useState(false);
  const blocked = useBlockedMembers();

  const displayName = useMemo(() => morphDisplayName(slug), [slug]);

  // Member photos approved from /MorphGuideSubmission. Loaded on their own
  // so a failed morph_guides request does not hide them; any error (or the
  // database function not existing yet) leaves the list empty.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setSubmittedPhotos([]);
    fetchMorphCommunityPhotos(slug).then((rows) => {
      if (!cancelled) setSubmittedPhotos(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    // The built-in guide (src/data/morph-guide.js) covers every known morph,
    // so show it at once and let the database add photos.
    // Before 29 Sep 2026 the page waited on the database first and, if that
    // request failed, said "Morph not found" even for Harlequin.
    const localRecord = localRecordFor(slug);
    setCommunityImages([]);
    setReferenceImages([]);
    (async () => {
      setNotFound(false);
      if (localRecord) {
        setRecord(localRecord);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
      try {
        // Broad fetch of every morph_guide record, then dedupe in JS.
        // Tiny table (<100 rows) so no indexing concerns.
        const supabase = await getSupabase();
        const { data, error } = await supabase
          .from('morph_guides')
          .select(
            'id, morph_name, description, key_features, example_image_url, rarity, breeding_info'
          )
          .limit(200);
        if (error) throw error;
        if (cancelled) return;

        const bySlug = indexMorphsBySlug(data || []);
        const images = {};
        for (const [s, r] of Object.entries(bySlug)) {
          const url = sanitizeImage(r?.example_image_url);
          if (url) images[s] = url;
        }
        setImageBySlug(images);

        const matches = (data || []).filter(
          (r) => morphSlug(r.morph_name) === slug
        );
        const best = pickBestMorphRecord(matches);

        // Fall back to local dataset if no DB record exists; our
        // local morph-guide.js is the authoritative reference and
        // covers every KNOWN_MORPH_SLUGS entry.
        if (!best && !localRecord) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setRecord(best || localRecord);

        // Community photos of this morph from the gallery; nice touch if we have them.
        try {
          // First word of the name, or the whole name for "Super ..." and
          // "Extreme ..." (src/lib/morphGallery.js).
          const firstWord = galleryMorphTerm(best?.morph_name || displayName);
          // Reviewed photos from members only. gecko_images also holds about
          // 3,800 scraped marketplace listing photos (created_by is null),
          // which the caption below would otherwise call keeper uploads.
          // owner_profile_id is set exactly when a member uploaded the photo,
          // and unlike created_by it is readable when signed out.
          const { data: imgs } = await supabase
            .from('gecko_images')
            .select('id, image_url, primary_morph, owner_profile_id')
            .ilike('primary_morph', `%${firstWord}%`)
            .eq('verified', true)
            .not('owner_profile_id', 'is', null)
            .limit(8);
          if (!cancelled) setCommunityImages(imgs || []);
        } catch {
          /* gallery is a bonus; ignore failures */
        }

        // Licensed reference photos from geck-data (external sources such as
        // iNaturalist, with licence and attribution). Marketplace listing
        // photos are no longer used here (13 Oct 2026). Best-effort: a
        // failure renders no section instead of taking down the page.
        try {
          const morphName = best?.morph_name || displayName;
          const { data: refs } = await getMorphReferenceImages(morphName, { limit: 12 });
          if (!cancelled) setReferenceImages(refs || []);
        } catch {
          /* reference panel is optional */
        }
      } catch {
        if (!cancelled && !localRecord) setNotFound(true);
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
      <PublicPageShell>
        <div className="text-neutral-100 flex items-center justify-center p-8 min-h-[50vh]">
          <div className="text-center max-w-md space-y-4">
            <Dna className="w-12 h-12 text-neutral-600 mx-auto" />
            <h1 className="text-2xl font-bold">Morph not found</h1>
            <p className="text-neutral-400">
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
      </PublicPageShell>
    );
  }

  // --- success state ---
  const localMorph = getMorph(slug);
  const morphName = localMorph?.name || record.morph_name;
  const seoMorph = localMorph || { slug, name: morphName, summary: record.description, rarity: record.rarity };
  const seo = morphSeo(seoMorph);
  // Photos from members the viewer blocked are left out, and a lethal
  // super shows none: a photo tagged with it is always a mislabel.
  const memberPhotos = isLivingMorph(localMorph)
    ? [...submittedPhotos, ...communityImages].filter((img) => !blocked.isBlocked(img))
    : [];
  const heroImage = sanitizeImage(record.example_image_url) || memberPhotos[0]?.image_url || null;
  const rarityLabel = RARITY_LABELS[record.rarity] || record.rarity || 'Unknown';
  // Prefer local dataset's key features over DB field so the
  // authoritative reference wins even if DB has sparse data.
  const keyFeatures = localMorph?.keyFeatures?.length
    ? localMorph.keyFeatures
    : Array.isArray(record.key_features)
    ? record.key_features
    : [];
  const visualIdentifiers = localMorph?.visualIdentifiers || [];
  const description = localMorph?.description || record.description;
  const inheritance = localMorph?.inheritance ? INHERITANCE[localMorph.inheritance] : null;
  const category = localMorph?.category
    ? MORPH_CATEGORIES.find((c) => c.id === localMorph.category)
    : null;
  const priceTier = localMorph?.priceTier ? PRICE_TIERS[localMorph.priceTier] : null;
  const lookalikes = localMorph?.lookalikes || [];
  const faqs = morphFaq(localMorph || { slug, name: morphName, summary: record.description });
  const calcHref = calculatorHref(slug);
  // Set only on a super form breeders avoid making (Super Lilly White,
  // Super Cappuccino, Super Highway): no breed, price or value prompts.
  const notBred = notBredStatus(localMorph);
  const hasDemo = Boolean(geneticsDemoFor(localMorph));
  // Photo source for previews and comparison tiles: this page's hero for
  // its own morph, the best morph_guides photo for any other.
  const imageFor = (s) => (s === slug ? heroImage : imageBySlug[s] || null);
  const backToGuide = (e, placement) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    rememberGuideReturn(slug);
    trackMorphCta(slug, '/MorphGuide', placement);
    navigate('/MorphGuide');
  };
  const path = `/MorphGuide/${slug}`;

  const hasGenetics = Boolean(inheritance || localMorph?.foundationGenetics || localMorph?.notes || record.breeding_info);
  const hasPrice = Boolean(localMorph) && !notBred;
  const sections = [
    description && { id: 'about', label: 'About' },
    (keyFeatures.length > 0 || visualIdentifiers.length > 0) && { id: 'identify', label: 'Identify' },
    hasGenetics && { id: 'genetics', label: 'Genetics' },
    hasPrice && { id: 'price', label: 'Price' },
    lookalikes.length > 0 && { id: 'lookalikes', label: 'Lookalikes' },
    (referenceImages.length > 0 || memberPhotos.length > 0) && { id: 'photos', label: 'Photos' },
    faqs.length > 0 && { id: 'faq', label: 'FAQ' },
    localMorph && { id: 'related', label: 'Related' },
  ].filter(Boolean);

  // Schema.org: treat each morph as both an Article and a DefinedTerm. The
  // DefinedTerm is what makes the morph name itself a structured piece of
  // data that AI assistants and Google Knowledge Graph can cite.
  const faqSchema = morphFaqSchema(localMorph || { slug, name: morphName, summary: record.description });
  const editorial = editorialFor(path);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'DefinedTerm',
        '@id': `https://geckinspect.com${path}#term`,
        name: morphName,
        description: seo.definition,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          name: 'Crested Gecko Morphs',
          url: 'https://geckinspect.com/MorphGuide',
        },
      },
      // FAQ schema is included inside @graph so Google can associate
      // it with the Article's canonical URL without a second script
      // tag. The FAQ renders visibly below the morph article body.
      ...(faqSchema ? [faqSchema] : []),
      {
        '@type': 'Article',
        '@id': `https://geckinspect.com${path}#article`,
        headline: seo.h1,
        description: seo.description,
        url: `https://geckinspect.com${path}`,
        image: heroImage || DEFAULT_GECKO_IMAGE_URL,
        about: {
          '@type': 'Thing',
          name: 'Crested gecko',
          alternateName: 'Correlophus ciliatus',
          sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
        },
        mentions: [{ '@id': `https://geckinspect.com${path}#term` }],
        author: authorSchema(),
        reviewedBy: { '@id': authorSchema()['@id'] },
        datePublished: editorial.published,
        dateModified: editorial.modified,
        publisher: {
          '@type': 'Organization',
          name: 'Geck Inspect',
          logo: APP_LOGO_URL,
        },
      },
    ],
  };

  const facts = [
    {
      label: 'Inheritance',
      value: inheritance?.label || 'Not recorded',
      to: inheritance ? `/MorphGuide/inheritance/${inheritance.id}` : null,
    },
    { label: 'Rarity', value: notBred?.reason === 'lethal' ? 'Never survives' : rarityLabel },
    notBred
      ? { label: 'Breeding', value: notBred.fact, to: '#genetics' }
      : {
          label: 'Typical price',
          value: localMorph?.priceRange || (localMorph ? 'No guide price yet' : 'Varies'),
          to: '#price',
        },
  ];

  return (
    <PublicPageShell>
      <MorphImageContext.Provider value={imageFor}>
      <MorphProgressBar targetRef={articleRef} />
      {localMorph && <MorphSwipeNav morph={localMorph} targetRef={articleRef} />}
      <Seo
        title={seo.title}
        description={seo.description}
        path={path}
        image={heroImage || DEFAULT_GECKO_IMAGE_URL}
        jsonLd={jsonLd}
        type="article"
      />

      <article ref={articleRef} className="max-w-5xl mx-auto px-4 sm:px-6 pt-2 md:pt-6 pb-16 text-neutral-300">
        {/* Answer first: name, the three facts people search for, the
            one-sentence definition and a photo, all on the first screen. */}
        <header className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-5 md:gap-10 md:items-center">
          <div>
            {/* neutral-400, not 500: #737373 on the page background measured 3.8
                to 1 in an axe pass (October 2026); small text needs 4.5. */}
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-400 mb-3">
              <Link
                to="/MorphGuide"
                onClick={(e) => backToGuide(e, 'breadcrumb_all_morphs')}
                className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:text-neutral-200 hover:bg-neutral-800/60 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                All morphs
              </Link>
              {category && (
                <>
                  <span aria-hidden="true">/</span>
                  <Link to={`/MorphGuide/category/${category.id}`} className="hover:text-neutral-300">
                    {category.label}
                  </Link>
                </>
              )}
            </nav>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.1]">
              {seo.h1}
            </h1>

            <dl className="mt-4 grid grid-cols-3 divide-x divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900/60">
              {facts.map(({ label, value, to }) => {
                const inner = (
                  <>
                    <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-neutral-100 leading-snug">{value}</dd>
                  </>
                );
                const cls = 'block px-3 py-2.5 min-w-0';
                if (!to) return <div key={label} className={cls}>{inner}</div>;
                if (to.startsWith('#')) {
                  return (
                    <a key={label} href={to} className={`${cls} hover:bg-neutral-800/50 rounded-r-xl transition-colors`}>
                      {inner}
                    </a>
                  );
                }
                return (
                  <Link key={label} to={to} className={`${cls} hover:bg-neutral-800/50 rounded-l-xl transition-colors`}>
                    {inner}
                  </Link>
                );
              })}
            </dl>

            <p className="mt-4 text-base sm:text-lg text-neutral-200 leading-relaxed">
              {seo.definition}
            </p>

            <p className="mt-3 text-xs text-neutral-400">{bylineText(path)}</p>
          </div>

          <HeroImage src={heroImage} name={morphName} slug={slug} category={localMorph?.category} invitePhoto={isLivingMorph(localMorph)} />
        </header>

        <div className="mt-6">
          {notBred ? (
            <NotBredNote slug={slug} status={notBred} />
          ) : (
            <MorphActions slug={slug} name={morphName} priceRange={localMorph?.priceRange} />
          )}
        </div>

        {/* Not wrapped in its own div: a sticky element only sticks
            within its parent, so the parent has to be the whole article. */}
        <MorphSectionNav sections={sections} className="mt-8" />

        <div className="mt-8 max-w-3xl space-y-14">
          {description && (
            <Reveal as="section" id="about" className="scroll-mt-20">
              <SectionHeading icon={BookOpen}>About the {morphName} morph</SectionHeading>
              <div className="leading-relaxed space-y-3">
                {description.split(/\n+/).map((p, i) => (
                  <p key={i}>{localMorph ? <MorphText text={p} currentSlug={slug} /> : p}</p>
                ))}
              </div>
              {localMorph?.history && (
                <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Origin and history
                  </div>
                  <p className="leading-relaxed"><MorphText text={localMorph.history} currentSlug={slug} /></p>
                </div>
              )}
            </Reveal>
          )}

          {(keyFeatures.length > 0 || visualIdentifiers.length > 0) && (
            <Reveal as="section" id="identify" className="scroll-mt-20">
              <SectionHeading icon={Eye}>How to identify {article(morphName)} {morphName}</SectionHeading>
              {keyFeatures.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">Key features</h3>
                  <BulletList items={keyFeatures} />
                </>
              )}
              {visualIdentifiers.length > 0 && (
                <>
                  <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-neutral-400 mb-3">What to check</h3>
                  <BulletList items={visualIdentifiers} linkSlug={slug} />
                </>
              )}
              <p className="mt-5 text-sm text-neutral-400">Visible features can suggest comparisons, but a photograph or illustration does not establish genotype. Use several views, natural firing states and documented lineage when assessing an animal.</p>
              {localMorph?.sources?.length > 0 && <div className="mt-4 rounded-xl border border-neutral-800 p-4"><h3 className="text-sm font-semibold text-white">Specimens and breeder references</h3><ul className="mt-2 space-y-2 text-sm">{morphSourceLinks(localMorph.sources).map(({ url, label }) => <li key={url}><a href={url} target="_blank" rel="noreferrer" className="text-emerald-300 underline">{label}</a></li>)}</ul></div>}
              {spectrumPositionFor(slug) !== null && (
                <PatternSpectrum key={slug} focusSlug={slug} className="mt-8" />
              )}
              {/* No "is your gecko one?" check on a super breeders avoid
                  making: lineage, not a photo, says whether one hatched. */}
              {!notBred && (
                <InlineMorphCta slug={slug} to="/Recognition" placement="after_identify" icon={Camera}>
                  Not sure? Upload a photo to Morph ID and get a second opinion in seconds.
                </InlineMorphCta>
              )}
            </Reveal>
          )}

          {hasGenetics && (
            <Reveal as="section" id="genetics" className="scroll-mt-20">
              <SectionHeading icon={Dna}>{morphName} genetics</SectionHeading>
              {inheritance && (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Inheritance</span>
                    <Link
                      to={`/MorphGuide/inheritance/${inheritance.id}`}
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold hover:brightness-125 transition ${inheritance.color}`}
                    >
                      {inheritance.label}
                    </Link>
                  </div>
                  <p className="leading-relaxed">{inheritance.description}</p><p className="mt-2 text-sm text-neutral-400">This explains the listed inheritance model. It does not confirm the genotype of an animal from its appearance; terminology and proposed models can differ between breeding projects.</p>
                </div>
              )}

              {hasDemo && <MorphGeneticsDemo morph={localMorph} />}

              {/* Dual inheritance models: traditional hobby label vs the
                  Foundation Genetics single-locus reading. Only present on
                  entries where the two frameworks describe the trait
                  differently. */}
              {localMorph?.foundationGenetics && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Two ways to read the genetics</h3>
                  <p className="leading-relaxed"><MorphText text={localMorph.foundationGenetics} currentSlug={slug} /></p>
                </div>
              )}

              {localMorph?.notes && (
                <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300 mb-2">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    Breeder note
                  </div>
                  <p className="text-neutral-200 leading-relaxed"><MorphText text={localMorph.notes} currentSlug={slug} /></p>
                </div>
              )}

              {/* Breeding info (from DB) */}
              {record.breeding_info && (
                <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 leading-relaxed">
                  {record.breeding_info.split(/\n+/).map((p, i) => (
                    <p key={i} className={i > 0 ? 'mt-3' : ''}>
                      {p}
                    </p>
                  ))}
                </div>
              )}

              {/* The demo above ends in its own calculator button. */}
              {notBred && (
                <InlineMorphCta
                  slug={slug}
                  to={notBred.pairingHref || (notBred.parent ? calculatorHref(notBred.parent.slug) : '/calculator')}
                  placement="genetics_safe_pairing"
                  icon={Shuffle}
                >
                  {notBred.safeLabel
                    ? `Plan ${notBred.safeLabel} in the calculator instead and see the odds for every egg.`
                    : 'Check a pairing in the calculator before you pair two carriers.'}
                </InlineMorphCta>
              )}
              {!hasDemo && !notBred && (
                <InlineMorphCta slug={slug} to={calcHref} placement="genetics" icon={Shuffle}>
                  {calcHref === '/calculator'
                    ? 'Run this pairing in the calculator and see the odds for every egg.'
                    : `Run ${article(morphName)} ${morphName} pairing in the calculator and see the odds for every egg.`}
                </InlineMorphCta>
              )}
            </Reveal>
          )}

          {hasPrice && (
            <Reveal as="section" id="price" className="scroll-mt-20">
              <SectionHeading icon={CircleDollarSign}>What {article(morphName)} {morphName} costs</SectionHeading>
              {priceTier ? (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-2xl font-bold text-white">{localMorph.priceRange}</span>
                    <span className="text-sm text-neutral-400">typical adult, USD</span>
                  </div>
                  <p className="mt-2 leading-relaxed">
                    {/* Tier name only: the tier's own band ("Mid ($150 to $400)")
                        contradicted this morph's range shown just above. */}
                    {priceTier.label.split(' (')[0]} price tier. {priceTier.description} Line quality, sex, age and
                    proven lineage all move the price within that range.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
                  {/* No priceRange is a gap in this guide, not proof there
                      is no market: the Price Index has hundreds of Phantom
                      and Empty Back listings. "Until the trait is proven"
                      unless the calculator badges the gene Proven: Emerging
                      genes, and Albino, which the calculator does not model
                      because its inheritance is not shown yet. */}
                  <p className="leading-relaxed">
                    Geck Inspect does not give a typical price for {morphName} yet. See the{' '}
                    <Link to="/crested-gecko-price" className="text-emerald-300 underline">Price Index</Link>{' '}
                    for current asking prices.
                    {calculatorBadge(slug) !== 'proven' && ' Treat any listing with caution until the trait is proven and animals sell openly.'}
                  </p>
                </div>
              )}
              <InlineMorphCta slug={slug} to="/crested-gecko-price" placement="price" icon={CircleDollarSign}>
                See the full crested gecko price guide and what moves a price up or down.
              </InlineMorphCta>

              {/* Mid-page sign-up prompt, right after the price, which is
                  where a keeper starts wondering about their own gecko. */}
              <ContentSignupPrompt
                pageType="morph"
                ctaId="morph_mid"
                className="mt-6"
                headline={`Track your own ${possessive(morphName)} lineage and value, free`}
                body="Add your gecko with a photo and a name. Geck Inspect keeps its weights and parents together, builds its pedigree as you add the sire and dam, and estimates its value from real crested gecko listings."
              />
            </Reveal>
          )}

          {lookalikes.length > 0 && (
            <Reveal as="section" id="lookalikes" className="scroll-mt-20">
              <SectionHeading icon={Users}>Often confused with</SectionHeading>
              <p className="mb-4 leading-relaxed">
                These morphs get mixed up with {morphName} in listings and forums. Here is the quickest way to tell them apart.
              </p>
              <MorphLookalikes slug={slug} name={morphName} lookalikes={lookalikes} showIdLink={!notBred} />
            </Reveal>
          )}

          {(referenceImages.length > 0 || memberPhotos.length > 0) && (
            <Reveal as="section" id="photos" className="scroll-mt-20">
              <SectionHeading icon={Images}>{morphName} photos</SectionHeading>

              {/* Reference photos pulled from geck-data: outside photos whose
                  licence allows commercial use (src/lib/imageLicenses.js).
                  The credit and licence sit under every photo, always
                  visible, as CC BY asks; they used to appear only on hover,
                  so phones never showed them. */}
              {referenceImages.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-white mb-1">Reference photos</h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    Photos from outside sources, shared under licences that allow use with credit. Each one is credited below it.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {referenceImages.map((img, i) => {
                      const image = (
                        <img
                          src={img.url}
                          alt={`${morphName} reference photo${img.attribution ? `, ${img.attribution}` : ''}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      );
                      const licence = licenseLabel(img.license);
                      return (
                        <figure key={`ref-${i}`} className="m-0">
                          <div className="aspect-square rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900">
                            {img.source_url ? (
                              <a href={img.source_url} target="_blank" rel="noopener noreferrer">{image}</a>
                            ) : image}
                          </div>
                          <figcaption className="mt-1 text-xs text-neutral-300 leading-snug">
                            {img.attribution ? <span className="block truncate" title={img.attribution}>{img.attribution}</span> : null}
                            {licence.url ? (
                              <a href={licence.url} target="_blank" rel="noopener noreferrer license" className="underline underline-offset-2">{licence.name}</a>
                            ) : licence.name}
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Community examples: approved Morph Guide submissions (with the
                  member's name) first, then reviewed collection photos. */}
              {memberPhotos.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">From the Geck Inspect community</h3>
                  <p className="text-sm text-neutral-400 mb-4">
                    {morphName} crested geckos from keepers on Geck Inspect.{' '}
                    <Link to={`/MorphGuideSubmission?morph=${slug}`} className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">
                      Add your photo
                    </Link>
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {memberPhotos.map((img) => (
                      <figure key={img.id} className="m-0">
                        <div className="aspect-square rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900">
                          <img
                            src={img.image_url}
                            alt={img.credit ? `${morphName} crested gecko, photo by ${img.credit}` : `${morphName} crested gecko`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          {img.credit ? (
                            <figcaption className="text-xs text-neutral-400 truncate">
                              Photo by {img.credit}
                            </figcaption>
                          ) : <span />}
                          <Suspense fallback={null}>
                            <ReportContent
                              targetType={img.submission_id ? 'morph_photo' : 'gecko_image'}
                              targetId={img.submission_id || img.id}
                              authorProfileId={img.owner_profile_id}
                              excerpt={img.image_url}
                              compact
                              className="h-7 px-2 shrink-0"
                            />
                          </Suspense>
                        </div>
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </Reveal>
          )}

          {/* FAQ generated from the structured morph data. Surfaces
              in Google's "People also ask" and in AI Overviews / Perplexity
              answer extraction via the FAQPage JSON-LD emitted alongside
              the Article schema. The first two start open so the answers
              are visible without a tap. */}
          {faqs.length > 0 && (
            <Reveal as="section" id="faq" className="scroll-mt-20">
              <SectionHeading icon={BookOpen}>{morphName} questions</SectionHeading>
              <div className="space-y-3">
                {faqs.map(({ question, answer }, i) => (
                  <details
                    key={question}
                    open={i < 2}
                    className="group rounded-xl border border-neutral-800 bg-neutral-900/60 open:border-emerald-500/25 px-5 py-4 transition-colors"
                  >
                    <summary className="cursor-pointer list-none flex items-start touch:items-center touch:min-h-11 justify-between gap-4 [&::-webkit-details-marker]:hidden">
                      <h3 className="text-base md:text-lg font-semibold text-neutral-100 leading-snug">
                        {question}
                      </h3>
                      <ChevronDown className="mt-1 h-4 w-4 text-neutral-500 group-open:rotate-180 transition-transform flex-shrink-0" aria-hidden="true" />
                    </summary>
                    <p className="mt-3 leading-relaxed">{answer}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          )}
        </div>

        {localMorph && (
          <Reveal as="section" id="related" className="scroll-mt-20 mt-14">
            <h2 className="text-2xl md:text-[1.7rem] font-bold text-white mb-4 leading-tight">
              Keep exploring crested gecko morphs
            </h2>
            <RelatedMorphs morph={localMorph} />
            <div className="mt-6">
              <MorphPrevNext morph={localMorph} />
            </div>
            <div className="mt-4 text-sm">
              <Link
                to="/MorphGuide"
                onClick={(e) => backToGuide(e, 'footer_all_morphs')}
                className="inline-flex items-center gap-1.5 min-h-11 text-emerald-300 hover:text-emerald-200"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                All crested gecko morphs
              </Link>
            </div>
          </Reveal>
        )}

        {/* End-of-page sign-up prompt. */}
        <ContentSignupPrompt
          variant="panel"
          pageType="morph"
          ctaId="morph_end"
          className="mt-12"
          headline={
            notBred?.parent
              ? `Keep your ${notBred.parent.name} geckos and their pairings in one place`
              : `Keep your ${morphName} geckos in one place`
          }
          body="Weights, parents, photos and a pedigree buyers can check, in one record per gecko. Plan pairings with the genetics calculator built for crested geckos."
        />
      </article>
      </MorphImageContext.Provider>
    </PublicPageShell>
  );
}

// Re-export for consumers that want the known-slug list
export { KNOWN_MORPH_SLUGS };
