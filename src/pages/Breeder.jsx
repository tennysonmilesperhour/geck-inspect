import { useEffect, useMemo, useState } from 'react';
import { APP_LOGO_URL, DEFAULT_GECKO_IMAGE } from "@/lib/constants";
import { Link, useLocation, useParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, ArrowRight, GitBranch, MapPin, ShieldCheck, Sparkles,
  Mail, Star, FileText, Tag, ExternalLink,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { breederCanonical, breederDisplayName, breederSlug } from '@/lib/breederUtils';
import BuyerInquiryModal from '@/components/breeder/BuyerInquiryModal';

const LOGO_URL = APP_LOGO_URL;

// Curated tile ,  used when we have a breeder_profiles row and pull
// real for-sale geckos by created_by. Click opens a passport page if
// the gecko has one, otherwise the GeckoDetail page.
function ForSaleTile({ gecko, onInquire }) {
  const detailHref = gecko.passport_code
    ? `/passport/${gecko.passport_code}`
    : `/GeckoDetail?id=${gecko.id}`;
  return (
    <div className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 transition-colors flex flex-col">
      <Link to={detailHref} className="block">
        <div className="aspect-square bg-slate-800">
          <img
            src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
            alt={gecko.name || 'Crested gecko for sale'}
            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="p-3">
          <p className="text-sm font-semibold text-slate-100 truncate">
            {gecko.name || 'Unnamed gecko'}
          </p>
          <p className="text-xs text-slate-500 truncate">
            {gecko.morphs_traits || gecko.sex || 'Crested gecko'}
          </p>
          {gecko.asking_price != null && (
            <p className="text-sm font-bold text-emerald-300 mt-1">${gecko.asking_price}</p>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => onInquire(gecko)}
        className="mx-3 mb-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 text-xs font-semibold py-2 transition-colors"
      >
        <Mail className="w-3.5 h-3.5" />
        Inquire / reserve
      </button>
    </div>
  );
}

// Inferred tile ,  same look as the original Breeder page when no
// breeder_profiles row exists; used by the fallback "people referenced
// this name in their lineage" mode.
function InferredTile({ gecko }) {
  return (
    <Link
      to={createPageUrl(`GeckoDetail?id=${gecko.id}`)}
      className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 transition-colors"
    >
      <div className="aspect-square bg-slate-800">
        <img
          src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
          alt={gecko.name || 'Crested gecko'}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold text-slate-100 truncate">
          {gecko.name || 'Unnamed gecko'}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {gecko.status || gecko.sex || 'Tracked on Geck Inspect'}
        </p>
      </div>
    </Link>
  );
}

function StarRow({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className="w-3.5 h-3.5"
          fill={i <= rating ? '#f59e0b' : 'transparent'}
          style={{ color: i <= rating ? '#f59e0b' : '#475569' }}
        />
      ))}
    </div>
  );
}

export default function Breeder() {
  const location = useLocation();
  const params = useParams();
  // Support both the clean path form `/Breeder/<slug>` (preferred, what
  // the sitemap and canonical now point at) and the legacy query-string
  // form `/Breeder?slug=<slug>` (kept for inbound links that still exist).
  // The path parameter wins if both are present.
  const slug = useMemo(() => {
    if (params?.slug) return params.slug.toLowerCase().trim();
    const q = new URLSearchParams(location.search);
    return (q.get('slug') || '').toLowerCase().trim();
  }, [params?.slug, location.search]);

  // mode: 'loading' | 'curated' | 'inferred'
  // curated  → a breeder_profiles row exists with this custom_slug
  // inferred → no row, so we fall back to scraping `geckos` for any
  //            attribution to this slug in dam/sire/notes (long-tail SEO)
  const [mode, setMode] = useState('loading');
  const [profile, setProfile] = useState(null);
  const [forSaleGeckos, setForSaleGeckos] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [storePolicy, setStorePolicy] = useState('');
  const [inferredGeckos, setInferredGeckos] = useState([]);
  const [uniqueOwners, setUniqueOwners] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Inquiry modal state ,  `inquiryGecko` is null for the generic
  // "Contact breeder" button, set to a gecko object when the buyer
  // clicked "Inquire" on a specific listing.
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryGecko, setInquiryGecko] = useState(null);

  const inferredDisplayName = breederDisplayName(slug);
  const canonical = breederCanonical(slug);

  useEffect(() => {
    if (!slug) {
      setMode('inferred');
      return;
    }
    let cancelled = false;
    (async () => {
      setMode('loading');
      setErrorMsg(null);
      try {
        // 1. Curated lookup first ,  does a breeder_profiles row claim
        //    this slug? If so we render the rich storefront.
        const { data: bp } = await supabase
          .from('breeder_profiles')
          .select('*')
          .eq('custom_slug', slug)
          .maybeSingle();

        if (bp && !cancelled) {
          setProfile(bp);
          setMode('curated');

          const ownerEmail = bp.created_by;
          // For-sale listings owned by this breeder. We accept any
          // status that mentions "sale" to handle the schema's mixed
          // casing ("For Sale", "for_sale", "available_for_sale", etc).
          if (ownerEmail) {
            const [{ data: geckos }, { data: revs }, { data: ownerProf }] = await Promise.all([
              supabase
                .from('geckos')
                .select('id, name, morphs_traits, image_urls, asking_price, passport_code, sex, status')
                .eq('created_by', ownerEmail)
                .or('status.ilike.%sale%,status.eq.For Sale')
                .order('asking_price', { ascending: true, nullsFirst: false })
                .limit(60),
              bp.user_id
                ? supabase
                    .from('breeder_reviews')
                    .select('*')
                    .eq('reviewed_user_id', bp.user_id)
                    .order('created_date', { ascending: false })
                    .limit(20)
                : Promise.resolve({ data: [] }),
              supabase
                .from('profiles')
                .select('store_policy')
                .eq('email', ownerEmail)
                .maybeSingle(),
            ]);
            if (cancelled) return;
            setForSaleGeckos(geckos || []);
            setReviews(revs || []);
            if (ownerProf?.store_policy) setStorePolicy(ownerProf.store_policy);
          }
          return;
        }

        // 2. No curated profile ,  fall back to the inferred SEO page.
        //    Search the three likely columns using the first word of
        //    the display name as a broad ILIKE filter, then tighten
        //    client-side using canonicalized form.
        if (cancelled) return;
        setMode('inferred');
        const firstWord = inferredDisplayName.split(' ')[0]?.toLowerCase() || slug;
        const safe = firstWord.replace(/[%_\\]/g, '');
        const pattern = `%${safe}%`;
        const { data, error } = await supabase
          .from('geckos')
          .select('id, name, sex, status, image_urls, dam_name, sire_name, notes, created_by')
          .or(`dam_name.ilike.${pattern},sire_name.ilike.${pattern},notes.ilike.${pattern}`)
          .limit(500);
        if (error) throw error;
        if (cancelled) return;

        const matches = (data || []).filter((g) => {
          const hay = [
            breederCanonical(g.dam_name),
            breederCanonical(g.sire_name),
            breederCanonical(g.notes),
          ].filter(Boolean).join(' ');
          return hay.includes(canonical);
        });

        setInferredGeckos(matches);
        setUniqueOwners(new Set(matches.map((g) => g.created_by).filter(Boolean)).size);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Failed to load breeder');
          setMode('inferred');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, inferredDisplayName, canonical]);

  // Invalid slug guard ,  rarely hit, but render a clean 404-ish page
  if (!slug) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-slate-100">No breeder specified</h1>
          <p className="text-slate-400">
            This page needs a slug ,  e.g. <code>/Breeder/altitude-exotics</code>.
          </p>
          <Link to="/">
            <Button variant="outline" className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40 font-semibold">
              <ArrowLeft className="w-4 h-4 mr-2 text-slate-800" /> Back to Geck Inspect
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const breederUrl = `https://geckinspect.com/Breeder/${slug}`;
  const isCurated = mode === 'curated' && profile;
  const displayName = isCurated ? (profile.display_name || inferredDisplayName) : inferredDisplayName;
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : null;

  // SEO/JSON-LD branches by mode. Curated mode advertises the live
  // storefront with for-sale geckos; inferred mode advertises the
  // attribution page so crawlers index the long-tail breeder name.
  const jsonLd = isCurated
    ? [
        {
          '@type': 'LocalBusiness',
          '@id': `${breederUrl}#breeder`,
          name: displayName,
          alternateName: slug,
          url: breederUrl,
          description: profile.bio || `${displayName} ,  verified crested gecko breeder on Geck Inspect.`,
          logo: profile.profile_photo || LOGO_URL,
          image: profile.banner_photo || profile.profile_photo || LOGO_URL,
          ...(profile.location ? { address: { '@type': 'PostalAddress', addressLocality: profile.location } } : {}),
          ...(forSaleGeckos.length > 0 ? {
            makesOffer: forSaleGeckos.slice(0, 25).map((g) => ({
              '@type': 'Offer',
              name: g.name,
              ...(g.asking_price != null ? { price: String(g.asking_price), priceCurrency: 'USD' } : {}),
              availability: 'https://schema.org/InStock',
              itemOffered: {
                '@type': 'Product',
                name: g.name,
                description: g.morphs_traits || 'Crested gecko (Correlophus ciliatus)',
                ...(g.image_urls?.[0] ? { image: g.image_urls[0] } : {}),
              },
            })),
          } : {}),
          ...(avgRating ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: avgRating,
              reviewCount: reviews.length,
            },
          } : {}),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://geckinspect.com/' },
            { '@type': 'ListItem', position: 2, name: 'Breeders', item: 'https://geckinspect.com/#breeders' },
            { '@type': 'ListItem', position: 3, name: displayName, item: breederUrl },
          ],
        },
      ]
    : [
        {
          '@type': 'Organization',
          '@id': `${breederUrl}#breeder`,
          name: displayName,
          alternateName: slug,
          url: breederUrl,
          description: `${displayName} is a crested gecko breeder referenced by keepers on Geck Inspect. ${inferredGeckos.length} gecko${inferredGeckos.length === 1 ? '' : 's'} in the Geck Inspect community trace their lineage back to ${displayName}.`,
          logo: LOGO_URL,
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://geckinspect.com/' },
            { '@type': 'ListItem', position: 2, name: 'Breeders', item: 'https://geckinspect.com/#breeders' },
            { '@type': 'ListItem', position: 3, name: displayName, item: breederUrl },
          ],
        },
      ];

  const seoTitle = isCurated
    ? `${displayName} ,  Crested Gecko Breeder on Geck Inspect`
    : `${displayName} ,  Crested Gecko Breeder`;
  const seoDescription = isCurated
    ? (profile.bio
        ? profile.bio.slice(0, 200)
        : `Browse crested geckos for sale from ${displayName}${profile.location ? ` in ${profile.location}` : ''}. Verified pedigrees, photo timelines, and direct contact on Geck Inspect.`)
    : `${displayName} is a crested gecko breeder referenced across the Geck Inspect community. Explore geckos whose lineage traces back to ${displayName}.`;

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        path={`/Breeder/${slug}`}
        jsonLd={jsonLd}
      />

      <BuyerInquiryModal
        open={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
        breederEmail={profile?.created_by || ''}
        breederSlug={slug}
        breederName={displayName}
        gecko={inquiryGecko}
      />

      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Top nav ,  mirrors the landing page for a coherent public feel */}
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

        {mode === 'loading' && (
          <div className="max-w-5xl mx-auto px-6 pt-10 pb-24">
            <div className="animate-pulse space-y-6">
              <div className="h-48 rounded-2xl bg-slate-900/60 border border-slate-800" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-slate-900/60 border border-slate-800" />
                ))}
              </div>
            </div>
          </div>
        )}

        {isCurated && (
          <>
            {/* Banner */}
            <div
              className="relative h-48 md:h-64"
              style={{
                background: profile.banner_photo
                  ? `url(${profile.banner_photo}) center/cover`
                  : 'linear-gradient(135deg, #064e3b, #022c22)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/80" />
              <div className="absolute -bottom-10 left-6 md:left-10">
                <div
                  className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-slate-950 flex items-center justify-center text-3xl font-bold shadow-xl bg-slate-800 overflow-hidden"
                  style={{
                    backgroundImage: profile.profile_photo ? `url(${profile.profile_photo})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {!profile.profile_photo && (displayName || '?')[0]?.toUpperCase()}
                </div>
              </div>
            </div>

            <section className="max-w-5xl mx-auto px-6 pt-14 pb-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                    {displayName}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                    {profile.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        {profile.location}
                      </span>
                    )}
                    {profile.years_breeding && (
                      <span>{profile.years_breeding} {profile.years_breeding === 1 ? 'year' : 'years'} breeding</span>
                    )}
                    {avgRating && (
                      <span className="inline-flex items-center gap-1">
                        <Star className="w-3.5 h-3.5" fill="#f59e0b" style={{ color: '#f59e0b' }} />
                        <span className="text-white font-semibold">{avgRating}</span>
                        <span>({reviews.length} review{reviews.length === 1 ? '' : 's'})</span>
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setInquiryGecko(null); setInquiryOpen(true); }}
                  disabled={!profile.created_by}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold text-sm whitespace-nowrap shadow-lg shadow-emerald-500/20 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Contact breeder
                </button>
              </div>

              {profile.bio && (
                <p className="mt-5 text-slate-300 leading-relaxed max-w-3xl">
                  {profile.bio}
                </p>
              )}

              {(profile.specialty_morphs || []).length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.specialty_morphs.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200"
                    >
                      <Tag className="w-3 h-3" /> {m}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* For-sale grid */}
            <section className="max-w-6xl mx-auto px-6 pb-16">
              <div className="flex items-end justify-between mb-5">
                <h2 className="text-xl md:text-2xl font-bold text-white">
                  Available geckos
                </h2>
                <span className="text-xs text-slate-500">
                  {forSaleGeckos.length} listed
                </span>
              </div>
              {forSaleGeckos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {forSaleGeckos.map((g) => (
                    <ForSaleTile
                      key={g.id}
                      gecko={g}
                      onInquire={(gecko) => { setInquiryGecko(gecko); setInquiryOpen(true); }}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
                  <p className="text-slate-400">
                    No geckos currently for sale from {displayName}.
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    Use <span className="text-emerald-300">Contact breeder</span> above to ask about upcoming clutches or holds.
                  </p>
                </div>
              )}
            </section>

            {/* Store policy */}
            {storePolicy && (
              <section className="max-w-4xl mx-auto px-6 pb-12">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" /> Store policy
                </h2>
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {storePolicy}
                  </p>
                </div>
              </section>
            )}

            {/* Reviews */}
            <section className="max-w-4xl mx-auto px-6 pb-16">
              <h2 className="text-xl font-bold text-white mb-4">Reviews</h2>
              {reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <StarRow rating={r.rating || 0} />
                        {r.is_verified && (
                          <span className="text-[11px] rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 font-semibold">
                            Verified purchase
                          </span>
                        )}
                      </div>
                      {r.title && <p className="text-sm font-semibold text-white">{r.title}</p>}
                      {r.body && <p className="text-sm text-slate-300 mt-1 leading-relaxed">{r.body}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">No reviews yet.</p>
              )}
            </section>

            {/* Powered-by + sign-in nudge */}
            <section className="max-w-4xl mx-auto px-6 pb-20">
              <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-lg font-bold text-white">Pedigrees you can verify</h2>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Every gecko sold by {displayName} can ship with a digital passport ,  full lineage, weight history, photos, transferred to you in one click. Powered by Geck Inspect.
                  </p>
                </div>
                <Link to={createPageUrl('AuthPortal')}>
                  <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold whitespace-nowrap">
                    Create free account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </section>
          </>
        )}

        {mode === 'inferred' && (
          <>
            {/* Hero ,  inferred / SEO mode */}
            <section className="max-w-5xl mx-auto px-6 pt-10 pb-12">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Geck Inspect
              </Link>

              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-5">
                <Sparkles className="w-3 h-3" />
                Breeder on Geck Inspect
              </div>

              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
                {displayName}
              </h1>

              <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">
                {displayName} is a crested gecko breeder referenced by keepers in the Geck Inspect community. This page is built automatically from attribution data in our database.
              </p>

              <div className="mt-8 flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2 text-slate-300">
                  <GitBranch className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">{inferredGeckos.length}</span>
                  <span className="text-slate-400">
                    gecko{inferredGeckos.length === 1 ? '' : 's'} tracked
                  </span>
                </div>
                {uniqueOwners > 0 && (
                  <div className="flex items-center gap-2 text-slate-300">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-white">{uniqueOwners}</span>
                    <span className="text-slate-400">
                      keeper{uniqueOwners === 1 ? '' : 's'}
                    </span>
                  </div>
                )}
              </div>

              {/* Claim CTA */}
              <div className="mt-10 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-900/40 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="space-y-2 max-w-xl">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-xl font-bold text-white">Is this your breeding project?</h2>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Create a free Geck Inspect account and claim{' '}
                    <span className="text-white font-semibold">{displayName}</span> as your verified storefront. Show your for-sale animals, lineages, and reviews ,  all on this page.
                  </p>
                </div>
                <Link to={createPageUrl('AuthPortal')}>
                  <Button
                    size="lg"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-lg shadow-emerald-500/30 whitespace-nowrap"
                  >
                    Claim this page
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </section>

            {/* Inferred grid */}
            <section className="max-w-6xl mx-auto px-6 pb-24">
              <h2 className="text-2xl font-bold mb-6">
                Geckos tracked from {displayName}
              </h2>

              {errorMsg && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">
                  Couldn&rsquo;t load geckos: {errorMsg}
                </div>
              )}

              {!errorMsg && inferredGeckos.length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
                  <p className="text-slate-400">
                    No geckos in the Geck Inspect community are currently attributed to{' '}
                    <span className="text-white">{displayName}</span>.
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    If that seems wrong, check the spelling of the slug in the URL.
                  </p>
                </div>
              )}

              {!errorMsg && inferredGeckos.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {inferredGeckos.map((g) => (
                    <InferredTile key={g.id} gecko={g} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* Footer */}
        <footer className="border-t border-slate-800/50">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="Geck Inspect" className="h-6 w-6 rounded" />
              <span>© {new Date().getFullYear()} Geck Inspect · geckOS</span>
            </div>
            <div className="flex items-center gap-5">
              <Link to="/" className="hover:text-slate-300">Home</Link>
              <Link to={createPageUrl('MorphGuide')} className="hover:text-slate-300">
                Morph Guide
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

// Re-export utils so consumers can `import { breederSlug } from '@/pages/Breeder'`
// if they prefer a single import source.
export { breederSlug, breederCanonical, breederDisplayName };
