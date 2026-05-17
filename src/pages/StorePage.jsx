import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import Seo from '@/components/seo/Seo';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import {
    Mail, Store, ArrowLeft, MessageCircle, ArrowUpRight, X,
} from 'lucide-react';
import { linkKindMeta } from '@/lib/storeLinks';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

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
            className="fixed top-4 right-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white/90 hover:bg-black/80 hover:border-emerald-400/40 hover:text-emerald-200 transition-colors shadow-lg"
            aria-label="Go to Geck Inspect"
        >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden />
            Geck Inspect
            <ArrowUpRight className="w-3 h-3 opacity-70" />
        </Link>
    );
}

function GeckoLightbox({ gecko, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    if (!gecko) return null;
    const images = (gecko.image_urls || []).filter(Boolean);
    const main = images[0] || DEFAULT_GECKO_IMAGE;
    const age = formatAge(gecko.hatch_date);

    return (
        <div
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 z-10 inline-flex items-center justify-center rounded-full w-10 h-10 bg-white/10 hover:bg-white/20 text-white"
                aria-label="Close"
            >
                <X className="w-5 h-5" />
            </button>
            <div
                className="relative max-w-6xl w-full max-h-full flex flex-col md:flex-row gap-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="md:flex-[2] min-h-0 flex items-center justify-center">
                    <img
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

function GeckoTile({ gecko, onOpen }) {
    const img = gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE;
    const age = formatAge(gecko.hatch_date);
    return (
        <button
            type="button"
            onClick={() => onOpen(gecko)}
            className="group block text-left w-full"
        >
            <div className="aspect-[4/5] bg-slate-900 overflow-hidden rounded-md relative">
                <img
                    src={img}
                    alt={gecko.name}
                    className="w-full h-full object-cover transition-transform duration-[800ms] group-hover:scale-[1.04]"
                    loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                {gecko.status && gecko.status !== 'For Sale' && (
                    <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-widest bg-black/60 backdrop-blur-sm text-white/90 border border-white/20 rounded-full px-2.5 py-1">
                        {gecko.status}
                    </span>
                )}
            </div>
            <div className="pt-3 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-lg text-slate-100 group-hover:text-emerald-200 transition-colors leading-tight">
                        {gecko.name}
                    </h3>
                    {gecko.asking_price && (
                        <span className="text-sm font-semibold text-emerald-300 tabular-nums shrink-0">
                            ${Number(gecko.asking_price).toLocaleString()}
                        </span>
                    )}
                </div>
                {gecko.morphs_traits && (
                    <p className="text-xs text-slate-400 line-clamp-1">{gecko.morphs_traits}</p>
                )}
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
                    {[gecko.sex, age].filter(Boolean).join(' · ')}
                </p>
            </div>
        </button>
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

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('breeder_store_pages')
                    .select('*')
                    .eq('slug', slug)
                    .maybeSingle();
                if (cancelled) return;
                if (error) throw error;
                if (!data) {
                    setError('not_found');
                    return;
                }
                setPage(data);

                const profilesRes = await supabase
                    .from('profiles')
                    .select('id, full_name, breeder_name, profile_image_url, email, bio, location, instagram_handle')
                    .eq('email', data.owner_email)
                    .maybeSingle();
                if (!cancelled && profilesRes.data) setOwner(profilesRes.data);

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

                const planIds = Array.isArray(data.featured_breeding_plan_ids) ? data.featured_breeding_plan_ids : [];
                if (planIds.length) {
                    const planRes = await supabase
                        .from('breeding_plans')
                        .select('id, sire_id, dam_id, status, pairing_date, notes')
                        .in('id', planIds)
                        .eq('is_public', true);
                    if (!cancelled && planRes.data) {
                        const sireIds = planRes.data.map((p) => p.sire_id).filter(Boolean);
                        const damIds = planRes.data.map((p) => p.dam_id).filter(Boolean);
                        const parentIds = Array.from(new Set([...sireIds, ...damIds]));
                        const parentRes = parentIds.length
                            ? await supabase
                                .from('geckos')
                                .select('id, name, morphs_traits, image_urls')
                                .in('id', parentIds)
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

    const ownerName = owner?.breeder_name || owner?.full_name || page.owner_email.split('@')[0];
    const externalLinks = Array.isArray(page.external_links) ? page.external_links : [];
    const ContactIcon = page.contact_link?.startsWith('mailto:') ? Mail : MessageCircle;
    const hasHero = Boolean(page.header_image_url);
    const forSaleCount = featuredGeckos.filter((g) => g.status === 'For Sale' || g.status === 'Available').length;

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

            {/* Hero */}
            <header
                className={
                    hasHero
                        ? 'relative w-full h-[70vh] min-h-[480px] overflow-hidden'
                        : 'relative w-full overflow-hidden bg-gradient-to-br from-stone-950 via-emerald-950/40 to-stone-900 py-24 md:py-36'
                }
            >
                {hasHero && (
                    <>
                        <img
                            src={page.header_image_url}
                            alt={page.title}
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-stone-950/20" />
                    </>
                )}
                <div className="relative h-full max-w-5xl mx-auto px-6 md:px-10 flex flex-col justify-end pb-12 md:pb-16">
                    <p className="text-[11px] md:text-xs uppercase tracking-[0.3em] text-emerald-300/90 font-semibold mb-3">
                        {ownerName}{owner?.location ? `  ·  ${owner.location}` : ''}
                    </p>
                    <h1 className="font-serif text-5xl md:text-7xl font-bold leading-[1.02] text-white drop-shadow-sm">
                        {page.title}
                    </h1>
                    {page.tagline && (
                        <p className="mt-5 text-lg md:text-xl text-stone-200/90 max-w-2xl leading-relaxed">
                            {page.tagline}
                        </p>
                    )}
                </div>
            </header>

            {/* Anchor nav */}
            <nav className="sticky top-0 z-30 border-b border-stone-800/80 bg-stone-950/90 backdrop-blur-md">
                <div className="max-w-5xl mx-auto px-6 md:px-10 flex items-center gap-6 overflow-x-auto py-3 text-[11px] uppercase tracking-[0.2em] text-stone-400">
                    {page.description && (
                        <a href="#about" className="hover:text-emerald-300 whitespace-nowrap">About</a>
                    )}
                    {featuredGeckos.length > 0 && (
                        <a href="#collection" className="hover:text-emerald-300 whitespace-nowrap">
                            The Collection
                            {forSaleCount > 0 && <span className="ml-1.5 text-emerald-400/80 normal-case tracking-normal">({forSaleCount} available)</span>}
                        </a>
                    )}
                    {featuredPlans.length > 0 && (
                        <a href="#pairings" className="hover:text-emerald-300 whitespace-nowrap">Pairings</a>
                    )}
                    {page.policies && (
                        <a href="#policies" className="hover:text-emerald-300 whitespace-nowrap">Policies</a>
                    )}
                    {(page.contact_link || externalLinks.length > 0) && (
                        <a href="#contact" className="hover:text-emerald-300 whitespace-nowrap ml-auto">Contact</a>
                    )}
                </div>
            </nav>

            <main className="max-w-5xl mx-auto px-6 md:px-10 py-16 md:py-24 space-y-24 md:space-y-32">
                {/* About */}
                {page.description && (
                    <section id="about" className="grid md:grid-cols-12 gap-8 items-start scroll-mt-24">
                        <p className="md:col-span-3 text-[11px] uppercase tracking-[0.25em] text-emerald-300/80 font-semibold pt-2">
                            About
                        </p>
                        <div className="md:col-span-9 font-serif text-xl md:text-2xl text-stone-100 leading-[1.55] whitespace-pre-wrap">
                            {page.description}
                        </div>
                    </section>
                )}

                {/* Featured geckos */}
                {featuredGeckos.length > 0 && (
                    <section id="collection" className="scroll-mt-24">
                        <div className="flex items-end justify-between mb-10 gap-6">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80 font-semibold mb-2">
                                    The Collection
                                </p>
                                <h2 className="font-serif text-3xl md:text-4xl text-white">
                                    Animals on offer
                                </h2>
                            </div>
                            {owner?.id && (
                                <Link
                                    to={createPageUrl(`PublicProfile?userId=${owner.id}`)}
                                    className="hidden sm:inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-stone-400 hover:text-emerald-300 whitespace-nowrap"
                                >
                                    Full collection
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-10 md:gap-x-8 md:gap-y-14">
                            {featuredGeckos.map((g) => (
                                <GeckoTile key={g.id} gecko={g} onOpen={setOpenGecko} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Featured pairings */}
                {featuredPlans.length > 0 && (
                    <section id="pairings" className="scroll-mt-24">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80 font-semibold mb-2">
                            This Season
                        </p>
                        <h2 className="font-serif text-3xl md:text-4xl text-white mb-10">Planned pairings</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {featuredPlans.map((p) => (
                                <article key={p.id} className="border border-stone-800 rounded-md p-6 bg-stone-900/40">
                                    <div className="flex items-center justify-between gap-3 mb-5">
                                        <h3 className="font-serif text-xl text-stone-100">
                                            {[p.sire?.name, p.dam?.name].filter(Boolean).join('  ×  ') || 'Pairing'}
                                        </h3>
                                        {p.status && (
                                            <span className="text-[10px] uppercase tracking-[0.15em] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                                                {p.status.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[p.sire, p.dam].map((parent, i) => (
                                            <div key={i} className="space-y-2">
                                                <div className="aspect-square bg-stone-900 overflow-hidden rounded-sm">
                                                    <img
                                                        src={parent?.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
                                                        alt={parent?.name || (i === 0 ? 'Sire' : 'Dam')}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500">{i === 0 ? 'Sire' : 'Dam'}</p>
                                                    <p className="text-sm text-stone-100">{parent?.name || 'Unknown'}</p>
                                                    {parent?.morphs_traits && (
                                                        <p className="text-[11px] text-stone-400 line-clamp-1">{parent.morphs_traits}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {p.notes && (
                                        <p className="mt-5 text-sm text-stone-300 leading-relaxed">{p.notes}</p>
                                    )}
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                {/* Policies */}
                {page.policies && (
                    <section id="policies" className="grid md:grid-cols-12 gap-8 items-start scroll-mt-24">
                        <p className="md:col-span-3 text-[11px] uppercase tracking-[0.25em] text-emerald-300/80 font-semibold pt-2">
                            Policies
                        </p>
                        <div className="md:col-span-9 text-sm md:text-base text-stone-300 leading-relaxed whitespace-pre-wrap font-light">
                            {page.policies}
                        </div>
                    </section>
                )}

                {/* Contact */}
                {(page.contact_link || externalLinks.length > 0 || owner) && (
                    <section id="contact" className="border-t border-stone-800 pt-16 scroll-mt-24">
                        <div className="grid md:grid-cols-12 gap-8 items-start">
                            <div className="md:col-span-5">
                                <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80 font-semibold mb-3">
                                    Get in touch
                                </p>
                                <h2 className="font-serif text-3xl md:text-4xl text-white mb-6 leading-tight">
                                    {page.contact_link
                                        ? "Reach out about an animal."
                                        : "Find me on the platforms below."}
                                </h2>
                                {page.contact_link && (
                                    <Button
                                        asChild
                                        size="lg"
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                    >
                                        <a href={page.contact_link} target="_blank" rel="noopener noreferrer">
                                            <ContactIcon className="w-4 h-4 mr-2" />
                                            {page.contact_link.startsWith('mailto:') ? 'Email' : 'Message'} {ownerName}
                                        </a>
                                    </Button>
                                )}
                            </div>
                            {externalLinks.length > 0 && (
                                <div className="md:col-span-7 space-y-2">
                                    <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 font-semibold mb-3">
                                        Elsewhere
                                    </p>
                                    <ul className="divide-y divide-stone-800/80">
                                        {externalLinks.map((link, idx) => {
                                            const meta = linkKindMeta(link.kind);
                                            return (
                                                <li key={idx}>
                                                    <a
                                                        href={link.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="group flex items-center justify-between gap-3 py-3 text-sm hover:text-emerald-200 transition-colors"
                                                    >
                                                        <span className="font-medium text-stone-100 group-hover:text-emerald-200">
                                                            {link.label || meta.label}
                                                        </span>
                                                        <ArrowUpRight className="w-4 h-4 text-stone-500 group-hover:text-emerald-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                                    </a>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Owner signature */}
                {owner && (
                    <section className="border-t border-stone-800 pt-16">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                            {owner.profile_image_url ? (
                                <img
                                    src={owner.profile_image_url}
                                    alt={ownerName}
                                    className="w-16 h-16 rounded-full object-cover border border-stone-700"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center text-emerald-200 font-serif font-bold text-xl">
                                    {ownerName[0]?.toUpperCase() || '?'}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.25em] text-stone-500 mb-1">
                                    Bred by
                                </p>
                                <p className="font-serif text-xl text-white">
                                    {ownerName}
                                </p>
                                {owner.bio && (
                                    <p className="text-sm text-stone-400 mt-1 line-clamp-2">{owner.bio}</p>
                                )}
                            </div>
                            {owner.id && (
                                <Link
                                    to={createPageUrl(`PublicProfile?userId=${owner.id}`)}
                                    className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-stone-400 hover:text-emerald-300 whitespace-nowrap"
                                >
                                    Public profile
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                            )}
                        </div>
                    </section>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-stone-900 py-8 text-center text-xs text-stone-500">
                <p>
                    A breeder storefront on{' '}
                    <Link to="/" className="hover:text-emerald-300 underline underline-offset-2">
                        Geck Inspect
                    </Link>
                    .
                </p>
            </footer>

            <GeckoLightbox gecko={openGecko} onClose={() => setOpenGecko(null)} />
        </div>
    );
}
