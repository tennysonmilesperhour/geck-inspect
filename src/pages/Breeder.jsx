import StorefrontWebsite from '@/components/storefront/StorefrontWebsite';
import { BREEDER_STORE_PAGE_PUBLIC_COLUMNS } from '@/lib/publicColumns';
import GeckoImage from '@/components/shared/GeckoImage';
import { useEffect, useMemo, useState } from 'react';
import { APP_LOGO_URL, DEFAULT_GECKO_IMAGE } from "@/lib/constants";
import { Link, useLocation, useParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, ArrowRight, GitBranch, MapPin, ShieldCheck, Sparkles,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { breederCanonical, breederDisplayName, breederSlug } from '@/lib/breederUtils';
import BuyerInquiryModal from '@/components/breeder/BuyerInquiryModal';
import BreederReviews, { PUBLIC_REVIEW_COLUMNS } from '@/components/breeder/BreederReviews';
import { useInAppShell } from '@/lib/appShell';
import TrustPanel from '@/components/marketplace/TrustPanel';
import ReportContent from '@/components/support/ReportContent';
import { useBlockedMembers } from '@/hooks/useBlockedAuthors';
import {
  DEFAULT_STORE_SETTINGS, readStoreSettings, BuiltOnGeckInspect,
} from '@/components/storefront/StorefrontSections';

const LOGO_URL = APP_LOGO_URL;

// Inferred tile, same look as the original Breeder page when no
// breeder_profiles row exists; used by the fallback "people referenced
// this name in their lineage" mode.
function InferredTile({ gecko }) {
  return (
    <Link
      to={createPageUrl(`GeckoDetail?id=${gecko.id}`)}
      className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 transition-colors"
    >
      <div className="aspect-square bg-slate-800">
        <GeckoImage
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

export default function Breeder() {
  const location = useLocation();
  const params = useParams();
  const inAppShell = useInAppShell();
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
  // Optional hand-picked showcase (the old StorePage curation). When the
  // owner set featured geckos on their store page, we show those instead
  // of the auto "Available now" grid.
  const [curatedGeckos, setCuratedGeckos] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [storePolicy, setStorePolicy] = useState('');
  const [inferredGeckos, setInferredGeckos] = useState([]);
  const [uniqueOwners, setUniqueOwners] = useState(0);
  // True once the inferred lookup has finished, so a slug nobody's geckos
  // mention can be kept out of search results (any URL rendered a page).
  const [inferredDone, setInferredDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const blocked = useBlockedMembers();

  // Mini-site settings (accent theme, "Available now" toggle, attached
  // waitlist), read from reserved entries in the owner's published
  // breeder_store_pages.external_links jsonb. Defaults to the emerald
  // theme with the grid shown when no settings row exists.
  const [storeSettings, setStoreSettings] = useState(DEFAULT_STORE_SETTINGS);
  const [waitlist, setWaitlist] = useState(null);
  const [storePage, setStorePage] = useState(null);
  const [featuredPlans, setFeaturedPlans] = useState([]);

  // Inquiry modal state, `inquiryGecko` is null for the generic
  // "Contact breeder" button, set to a gecko object when the buyer
  // clicked "Inquire" on a specific listing.
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryGecko, setInquiryGecko] = useState(null);

  const inferredDisplayName = breederDisplayName(slug);
  const canonical = breederCanonical(slug);

  useEffect(() => {
    setStorePage(null);
    setFeaturedPlans([]);
    setCuratedGeckos([]);
    setWaitlist(null);
    setStoreSettings(DEFAULT_STORE_SETTINGS);
    if (!slug) {
      setMode('inferred');
      return;
    }
    let cancelled = false;
    (async () => {
      setMode('loading');
      setInferredDone(false);
      setErrorMsg(null);
      try {
        // 1. Curated lookup first, does a breeder_profiles row claim
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
          // Only public geckos appear, capped at 12 for the grid.
          if (ownerEmail) {
            // Signed-out visitors cannot read geckos.created_by (it holds
            // the owner's email), so listings are matched on the owner's
            // profile id instead.
            const { data: ownerProf } = await supabase
              .rpc('read_profiles', { p_emails: [ownerEmail] })
              .select('id, store_policy')
              .eq('email', ownerEmail)
              .maybeSingle();
            if (cancelled) return;
            const [{ data: geckos }, { data: revs }, { data: storePage }] = await Promise.all([
              ownerProf?.id
                ? supabase
                    .from('geckos')
                    .select('id, name, morphs_traits, image_urls, asking_price, passport_code, sex, status')
                    .eq('owner_profile_id', ownerProf.id)
                    .eq('is_public', true)
                    .eq('archived', false)
                    .or('status.ilike.%sale%,status.eq.For Sale')
                    .order('asking_price', { ascending: true, nullsFirst: false })
                    .limit(12)
                : Promise.resolve({ data: [] }),
              bp.user_id
                ? supabase
                    .from('breeder_reviews')
                    .select(PUBLIC_REVIEW_COLUMNS)
                    .eq('reviewed_user_id', bp.user_id)
                    // Only reviews from a claimed transfer (D9). Rows
                    // written before that rule existed are not shown.
                    .eq('is_verified', true)
                    .order('created_date', { ascending: false })
                    .limit(20)
                : Promise.resolve({ data: [] }),
              // Mini-site settings carrier. RLS only exposes published
              // rows to visitors, and we filter on is_published here too
              // so owners preview exactly what the public sees. Matched on
              // the owner's profile id: signed-out visitors cannot read
              // owner_email.
              ownerProf?.id
                ? supabase
                    .from('breeder_store_pages')
                    .select(BREEDER_STORE_PAGE_PUBLIC_COLUMNS.join(','))
                    .eq('owner_profile_id', ownerProf.id)
                    .eq('is_published', true)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
            ]);
            if (cancelled) return;
            setStorePage(storePage || null);
            setForSaleGeckos(geckos || []);
            setReviews(revs || []);
            if (ownerProf?.store_policy) setStorePolicy(ownerProf.store_policy);

            // Hand-picked showcase from the store editor, in the owner's
            // chosen order. Only public, non-archived geckos.
            const curatedIds = Array.isArray(storePage?.featured_gecko_ids)
              ? storePage.featured_gecko_ids
              : [];
            if (curatedIds.length) {
              const { data: curated } = await supabase
                .from('geckos')
                .select('id, name, morphs_traits, image_urls, asking_price, passport_code, sex, status')
                .in('id', curatedIds)
                .eq('is_public', true)
                .eq('archived', false);
              if (!cancelled && Array.isArray(curated)) {
                const byId = new Map(curated.map((g) => [g.id, g]));
                setCuratedGeckos(curatedIds.map((id) => byId.get(id)).filter(Boolean));
              }
            }

            const planIds = Array.isArray(storePage?.featured_breeding_plan_ids) ? storePage.featured_breeding_plan_ids : [];
            if (planIds.length) {
              const { data: publicPlans } = await supabase.from('breeding_plans')
                .select('id, sire_id, dam_id, status, notes').in('id', planIds).eq('is_public', true).eq('archived', false);
              if (cancelled) return;
              const parentIds = [...new Set((publicPlans || []).flatMap(p => [p.sire_id, p.dam_id]).filter(Boolean))];
              const parentRes = parentIds.length ? await supabase.from('geckos')
                .select('id, name, morphs_traits, image_urls').in('id', parentIds).eq('is_public', true).eq('archived', false) : { data: [] };
              if (cancelled) return;
              const parents = new Map((parentRes.data || []).map(g => [g.id, g]));
              const byId = new Map((publicPlans || []).map(p => [p.id, { ...p, sire: parents.get(p.sire_id), dam: parents.get(p.dam_id) }]));
              setFeaturedPlans(planIds.map(id => byId.get(id)).filter(Boolean));
            }
            const settings = readStoreSettings(storePage?.external_links);
            setStoreSettings(settings);
            if (settings.waitlistId) {
              const { data: wl } = await supabase
                .from('gecko_waitlists')
                .select('id, slug, title, description, is_open, closes_at')
                .eq('id', settings.waitlistId)
                .maybeSingle();
              if (!cancelled) setWaitlist(wl || null);
            }
          }
          return;
        }

        // 2. No curated profile, fall back to the inferred SEO page.
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
          .select('id, name, sex, status, image_urls, dam_name, sire_name, notes, owner_profile_id')
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
        setUniqueOwners(new Set(matches.map((g) => g.owner_profile_id).filter(Boolean)).size);
        setInferredDone(true);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Failed to load breeder');
          setMode('inferred');
          setInferredDone(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, inferredDisplayName, canonical]);

  const reloadReviews = async () => {
    if (!profile?.user_id) return;
    const { data } = await supabase
      .from('breeder_reviews')
      .select(PUBLIC_REVIEW_COLUMNS)
      .eq('reviewed_user_id', profile.user_id)
      .eq('is_verified', true)
      .order('created_date', { ascending: false })
      .limit(20);
    if (Array.isArray(data)) setReviews(data);
  };

  // Invalid slug guard, rarely hit, but render a clean 404-ish page
  if (!slug) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-slate-100">No breeder specified</h1>
          <p className="text-slate-400">
            This page needs a slug, e.g. <code>/Breeder/altitude-exotics</code>.
          </p>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" /> Back to Geck Inspect
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const breederUrl = `https://geckinspect.com/Breeder/${slug}`;
  const isCurated = mode === 'curated' && profile;
  if (isCurated && blocked.isBlocked({ created_by: profile.created_by })) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-3">
          <h1 className="text-2xl font-bold">You blocked this breeder</h1>
          <p className="text-slate-400 text-sm">Their page, posts, photos and listings are hidden for you. You can unblock them in Settings.</p>
          <Button asChild><Link to={createPageUrl('Settings')}>Open Settings</Link></Button>
        </div>
      </div>
    );
  }
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
          description: profile.bio || `${displayName}, ${profile.is_verified ? 'a verified' : 'a'} crested gecko breeder on Geck Inspect.`,
          logo: profile.profile_photo || LOGO_URL,
          image: profile.banner_photo || profile.profile_photo || LOGO_URL,
          ...(profile.location ? { address: { '@type': 'PostalAddress', addressLocality: profile.location } } : {}),
          ...(storeSettings.showAvailable && forSaleGeckos.length > 0 ? {
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

  const inferredEmpty = mode === 'inferred' && inferredDone && inferredGeckos.length === 0;

  const seoTitle = isCurated
    ? `${displayName}, Crested Gecko Breeder on Geck Inspect`
    : `${displayName}, Crested Gecko Breeder`;
  const seoDescription = isCurated
    ? (profile.bio
        ? profile.bio.slice(0, 200)
        : `Browse crested geckos for sale from ${displayName}${profile.location ? ` in ${profile.location}` : ''}. Tracked pedigrees, photo timelines, and direct contact on Geck Inspect.`)
    : `${displayName} is a crested gecko breeder referenced across the Geck Inspect community. Explore geckos whose lineage traces back to ${displayName}.`;

  return (
    <>
      <Seo
        title={seoTitle}
        description={seoDescription}
        path={`/Breeder/${slug}`}
        jsonLd={jsonLd}
        noIndex={inferredEmpty}
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
        {/* Top nav, mirrors the landing page for a coherent public feel.
            Inside the app the shell already has a header. */}
        {!inAppShell && !isCurated && (
          <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link to="/" className="touch:min-h-11 flex items-center gap-3 hover:opacity-90 transition-opacity">
              <img src={LOGO_URL} alt="Geck Inspect" className="h-10 w-10 rounded-xl" />
              <span className="text-xl font-bold tracking-tight">Geck Inspect</span>
            </Link>
            <Link to={createPageUrl('AuthPortal')}>
              <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                Sign In
              </Button>
            </Link>
          </header>
        )}

        {mode === 'loading' && (
          <div className="max-w-5xl mx-auto px-6 pt-10 pb-24">
            <div className="animate-pulse space-y-6">
              <div className="h-48 rounded-xl bg-slate-900 border border-slate-700" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-slate-900 border border-slate-700" />
                ))}
              </div>
            </div>
          </div>
        )}

        {isCurated && (
          <>
            <StorefrontWebsite page={{ ...storePage, policies: storePage?.policies || storePolicy }} profile={profile}
              settings={storeSettings} geckos={curatedGeckos.length ? curatedGeckos : forSaleGeckos}
              plans={featuredPlans} waitlist={waitlist}
              onInquire={profile.accepts_inquiries === false ? undefined : gecko => { setInquiryGecko(gecko); setInquiryOpen(true); }}
              trust={profile.created_by ? <TrustPanel email={profile.created_by} variant="full" /> : null}
              reviews={<BreederReviews reviews={reviews} breederUserId={profile.user_id} breederName={displayName} onReviewsChanged={reloadReviews} />} />
            <div className="max-w-5xl mx-auto px-6 py-4">
              <ReportContent targetType="breeder_page" targetId={profile.id} authorEmail={profile.created_by}
                excerpt={[profile.display_name, profile.bio].filter(Boolean).join('\n')} />
            </div>
          </>
        )}

        {mode === 'inferred' && (
          <>
            {/* Hero, inferred / SEO mode */}
            <section className="max-w-5xl mx-auto px-6 pt-10 pb-12">
              <Link
                to="/"
                className="touch:min-h-11 inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6"
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
                {inferredEmpty
                  ? `No geckos in the Geck Inspect community name ${displayName} as their breeder yet.`
                  : `${displayName} is a crested gecko breeder referenced by keepers in the Geck Inspect community. This page is built automatically from attribution data in our database.`}
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
                    <span className="text-white font-semibold">{displayName}</span> as your breeder page. Show your for-sale animals and lineages, and collect reviews from buyers who claim your geckos through a Geck Inspect transfer.
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
                <div className="rounded-xl border border-slate-700 bg-slate-900 p-10 text-center">
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
        {!inAppShell && !isCurated && (
          <footer className="border-t border-slate-800/50">
            <div className="max-w-6xl mx-auto px-6 py-8 space-y-4">
              <BuiltOnGeckInspect className="text-center" />
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
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
            </div>
          </footer>
        )}
      </div>
    </>
  );
}

// Re-export utils so consumers can `import { breederSlug } from '@/pages/Breeder'`
// if they prefer a single import source.
export { breederSlug, breederCanonical, breederDisplayName };
