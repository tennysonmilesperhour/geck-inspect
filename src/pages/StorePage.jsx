import StorefrontWebsite from '@/components/storefront/StorefrontWebsite';
import { readStoreSettings } from '@/components/storefront/StorefrontSections';
import GeckoImage from '@/components/shared/GeckoImage';
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { breederSlugForProfile } from '@/lib/memberActions';
import Seo from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import ReportContent from '@/components/support/ReportContent';
import { useBlockedMembers } from '@/hooks/useBlockedAuthors';
import { Store, ArrowLeft, ArrowUpRight, X,
} from 'lucide-react';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { BREEDER_STORE_PAGE_PUBLIC_COLUMNS, publicDisplayName } from '@/lib/publicColumns';
import useModalOverlay from '@/hooks/useModalOverlay';

/**
 * Public breeder storefront. Route: /store/:slug
 *
 * Renders chrome-free (no app sidebar / header) so the page reads as
 * the breeder's own site. Only nav back to Geck Inspect is a small
 * floating pill in the top-right corner.
 *
 * Pages are world-readable when is_published is true (RLS enforces).
 * Owners can preview drafts at the same URL while signed in.
 */

function formatAge(hatchDate) {
    if (!hatchDate) return null;
    const d = new Date(hatchDate);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const months =
        (now.getFullYear() - d.getFullYear()) * 12 +
        (now.getMonth() - d.getMonth());
    if (months < 1) return 'Hatchling';
    if (months < 12) return `${months} mo`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem === 0 ? `${years} yr` : `${years} yr ${rem} mo`;
}

function GeckInspectPill() {
    return (
        <Link
            to="/"
            className="touch-hit fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-black/80 hover:border-emerald-400/40 hover:text-emerald-200 transition-colors shadow-lg"
            aria-label="Go to Geck Inspect"
        >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden />
            Geck Inspect
            <ArrowUpRight className="w-3 h-3 opacity-70" />
        </Link>
    );
}

function GeckoLightbox({ gecko, onClose }) {
    // Dialog role, Escape to close and data-state="open" (which the rule
    // that hides floating widgets over dialogs looks for) come from the
    // shared hook. It also leaves Escape to a menu open above the lightbox.
    const overlay = useModalOverlay(onClose, Boolean(gecko));
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    if (!gecko) return null;
    const images = (gecko.image_urls || []).filter(Boolean);
    const main = images[0] || DEFAULT_GECKO_IMAGE;
    const age = formatAge(gecko.hatch_date);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={onClose}
            {...overlay}
            aria-label={gecko.name || 'Gecko photos'}
        >
            <button
                type="button"
                onClick={onClose}
                className="touch-hit absolute top-4 right-4 z-10 inline-flex items-center justify-center rounded-full w-10 h-10 bg-white/10 hover:bg-white/20 text-white"
                aria-label="Close"
            >
                <X className="w-5 h-5" />
            </button>
            <div
                className="relative max-w-6xl w-full max-h-full flex flex-col md:flex-row gap-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="md:flex-[2] min-h-0 flex items-center justify-center">
                    <GeckoImage
                        gecko={gecko}
                        src={main}
                        alt={gecko.name}
                        className="max-h-[70vh] w-full object-contain rounded-lg shadow-2xl"
                    />
                </div>
                <div className="md:flex-1 md:max-w-sm text-white space-y-4 md:overflow-y-auto">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300/80 mb-1">
                            {gecko.gecko_id_code || 'Crested gecko'}
                        </p>
                        <h2 className="font-serif text-3xl font-bold leading-tight">{gecko.name}</h2>
                    </div>
                    {gecko.morphs_traits && (
                        <p className="text-sm text-slate-300 leading-relaxed">{gecko.morphs_traits}</p>
                    )}
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        {gecko.sex && (
                            <div>
                                <dt className="text-[10px] uppercase tracking-wider text-slate-500">Sex</dt>
                                <dd className="text-slate-100">{gecko.sex}</dd>
                            </div>
                        )}
                        {age && (
                            <div>
                                <dt className="text-[10px] uppercase tracking-wider text-slate-500">Age</dt>
                                <dd className="text-slate-100">{age}</dd>
                            </div>
                        )}
                        {gecko.status && (
                            <div>
                                <dt className="text-[10px] uppercase tracking-wider text-slate-500">Status</dt>
                                <dd className="text-slate-100">{gecko.status}</dd>
                            </div>
                        )}
                        {gecko.asking_price && (
                            <div>
                                <dt className="text-[10px] uppercase tracking-wider text-slate-500">Asking</dt>
                                <dd className="text-emerald-300 font-semibold">${gecko.asking_price}</dd>
                            </div>
                        )}
                    </dl>
                    {images.length > 1 && (
                        <div className="grid grid-cols-4 gap-2 pt-2">
                            {images.slice(1, 9).map((url, i) => (
                                <img
                                    key={i}
                                    src={url}
                                    alt={`${gecko.name} ${i + 2}`}
                                    className="aspect-square object-cover rounded-md opacity-80"
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function StorePage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [page, setPage] = useState(null);
    const [owner, setOwner] = useState(null);
    const [featuredGeckos, setFeaturedGeckos] = useState([]);
    const [featuredPlans, setFeaturedPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openGecko, setOpenGecko] = useState(null);
    const [waitlist, setWaitlist] = useState(null);
    // The public breeder page now lives at /Breeder/:custom_slug. When this
    // store's owner has a breeder profile, redirect there so there is one
    // canonical public page. If they have no profile slug yet, we keep
    // rendering the original store body below as a fallback so shared
    // /store/:slug links never break.
    const [redirectSlug, setRedirectSlug] = useState(null);
    const blocked = useBlockedMembers();

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            setError(null); setRedirectSlug(null); setFeaturedGeckos([]); setFeaturedPlans([]); setWaitlist(null);
            try {
                // Explicit columns: signed-out visitors cannot read
                // owner_email. The owner is found by owner_profile_id.
                const { data, error } = await supabase
                    .from('breeder_store_pages')
                    .select(BREEDER_STORE_PAGE_PUBLIC_COLUMNS.join(','))
                    .eq('slug', slug)
                    .maybeSingle();
                if (cancelled) return;
                if (error) throw error;
                if (!data) {
                    setError('not_found');
                    return;
                }
                setPage(data);

                // Prefer redirecting to the canonical /Breeder page when the
                // owner has a breeder profile with a custom slug. The slug is
                // looked up by profile id on the server: profiles no longer
                // carry other members' emails.
                const profilesRes = data.owner_profile_id
                    ? await supabase
                        .rpc('read_profiles')
                        .select('id, full_name, business_name, profile_image_url, bio, location, instagram_handle')
                        .eq('id', data.owner_profile_id)
                        .maybeSingle()
                    : { data: null };
                if (cancelled) return;
                if (data.owner_profile_id && data.is_published) {
                    const customSlug = await breederSlugForProfile(data.owner_profile_id).catch(() => null);
                    if (!cancelled && customSlug) {
                        setRedirectSlug(customSlug);
                        return;
                    }
                }
                if (!cancelled && profilesRes.data) setOwner(profilesRes.data);

                const settings = readStoreSettings(data.external_links);
                if (settings.waitlistId) {
                    const { data: wl } = await supabase.from('gecko_waitlists')
                        .select('id, slug, title, description, is_open, closes_at').eq('id', settings.waitlistId).maybeSingle();
                    if (cancelled) return;
                    setWaitlist(wl || null);
                }
                const geckoIds = Array.isArray(data.featured_gecko_ids) ? data.featured_gecko_ids : [];
                if (geckoIds.length) {
                    const geckoRes = await supabase
                        .from('geckos')
                        .select('id, name, morphs_traits, sex, image_urls, status, hatch_date, asking_price, gecko_id_code')
                        .in('id', geckoIds)
                        .eq('is_public', true)
                        .eq('archived', false);
                    if (!cancelled && geckoRes.data) {
                        const byId = new Map(geckoRes.data.map((g) => [g.id, g]));
                        setFeaturedGeckos(geckoIds.map((id) => byId.get(id)).filter(Boolean));
                    }
                }

                if (!geckoIds.length && settings.showAvailable && data.owner_profile_id) {
                    const { data: available } = await supabase.from('geckos')
                        .select('id, name, morphs_traits, sex, image_urls, status, asking_price, passport_code')
                        .eq('owner_profile_id', data.owner_profile_id).eq('is_public', true).eq('archived', false)
                        .or('status.ilike.%sale%,status.eq.For Sale').order('asking_price', { ascending: true, nullsFirst: false }).limit(12);
                    if (cancelled) return;
                    setFeaturedGeckos(available || []);
                }
                const planIds = Array.isArray(data.featured_breeding_plan_ids) ? data.featured_breeding_plan_ids : [];
                if (planIds.length) {
                    const planRes = await supabase
                        .from('breeding_plans')
                        .select('id, sire_id, dam_id, status, pairing_date, notes')
                        .in('id', planIds)
                        .eq('is_public', true).eq('archived', false);
                    if (!cancelled && planRes.data) {
                        const sireIds = planRes.data.map((p) => p.sire_id).filter(Boolean);
                        const damIds = planRes.data.map((p) => p.dam_id).filter(Boolean);
                        const parentIds = Array.from(new Set([...sireIds, ...damIds]));
                        const parentRes = parentIds.length
                            ? await supabase
                                .from('geckos')
                                .select('id, name, morphs_traits, image_urls')
                                .in('id', parentIds).eq('is_public', true).eq('archived', false)
                            : { data: [] };
                        const parentMap = new Map((parentRes.data || []).map((g) => [g.id, g]));
                        const enriched = planRes.data.map((p) => ({
                            ...p,
                            sire: parentMap.get(p.sire_id) || null,
                            dam: parentMap.get(p.dam_id) || null,
                        }));
                        const byId = new Map(enriched.map((p) => [p.id, p]));
                        setFeaturedPlans(planIds.map((id) => byId.get(id)).filter(Boolean));
                    }
                }
            } catch {
                if (!cancelled) setError('load_failed');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [slug]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (redirectSlug) {
        return <Navigate to={`/Breeder/${redirectSlug}`} replace />;
    }

    if (error || !page) {
        return (
            <div className="min-h-screen bg-stone-950 text-stone-200 flex items-center justify-center p-6">
                <GeckInspectPill />
                <div className="text-center max-w-md">
                    <Store className="w-12 h-12 mx-auto text-stone-500 mb-4" />
                    <h1 className="font-serif text-3xl font-bold mb-2 text-white">Not here yet</h1>
                    <p className="text-stone-400 mb-6">
                        No published store at <code className="text-emerald-400">/store/{slug}</code>.
                    </p>
                    <Button onClick={() => navigate(createPageUrl('Home'))} className="bg-emerald-600 hover:bg-emerald-500">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Geck Inspect
                    </Button>
                </div>
            </div>
        );
    }

    if (blocked.isBlocked({ owner_profile_id: page.owner_profile_id })) {
        return (
            <div className="min-h-screen bg-stone-950 text-stone-200 flex items-center justify-center p-6">
                <div className="text-center max-w-md space-y-3">
                    <h1 className="font-serif text-3xl font-bold text-white">You blocked this breeder</h1>
                    <p className="text-stone-400 text-sm">Their store, posts, photos and listings are hidden for you. You can unblock them in Settings.</p>
                    <Button onClick={() => navigate(createPageUrl('Settings'))} className="bg-emerald-600 hover:bg-emerald-500">Open Settings</Button>
                </div>
            </div>
        );
    }

    const ownerName = publicDisplayName(owner, page.title || 'Geck Inspect breeder');


    return (
        <div className="min-h-screen bg-stone-950 text-stone-100">
            <Seo
                title={page.title}
                description={page.tagline || page.description?.slice(0, 160)}
                path={`/store/${slug}`}
                type="website"
            />
            <GeckInspectPill />

            {!page.is_published && (
                <div className="bg-amber-900/80 border-b border-amber-700 text-amber-100 text-center py-2 text-sm">
                    Draft preview, this page is not yet visible to the public.
                </div>
            )}

            <StorefrontWebsite page={page} profile={{ ...owner, display_name: ownerName }}
                settings={readStoreSettings(page.external_links)} geckos={featuredGeckos}
                plans={featuredPlans} waitlist={waitlist} onOpenGecko={setOpenGecko} />
            <div className="flex justify-center py-4">
                <ReportContent targetType="store_page" targetId={page.id} authorProfileId={page.owner_profile_id}
                    excerpt={[page.title, page.tagline, page.description].filter(Boolean).join('\n')} label="Report this store" />
            </div>

            <GeckoLightbox gecko={openGecko} onClose={() => setOpenGecko(null)} />
        </div>
    );
}
