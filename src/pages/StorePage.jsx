import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import Seo from '@/components/seo/Seo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import {
    ExternalLink, Mail, Store, ArrowLeft, GitBranch, FileText, MessageCircle,
} from 'lucide-react';
import { linkKindMeta } from '@/lib/storeLinks';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

/**
 * Public store page for Breeder / Enterprise tier members.
 *
 * Route: /store/:slug
 *
 * Pages are world-readable when is_published is true (RLS enforces).
 * Owners can preview drafts at the same URL while signed in.
 */
export default function StorePage() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const [page, setPage] = useState(null);
    const [owner, setOwner] = useState(null);
    const [featuredGeckos, setFeaturedGeckos] = useState([]);
    const [featuredPlans, setFeaturedPlans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

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
                    .select('id, full_name, breeder_name, profile_image_url, email')
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
            } catch (e) {
                if (!cancelled) setError('load_failed');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [slug]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            </div>
        );
    }

    if (error || !page) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <Store className="w-12 h-12 mx-auto text-slate-500 mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Store not found</h1>
                    <p className="text-slate-400 mb-6">
                        No published store lives at <code className="text-emerald-400">/store/{slug}</code> yet.
                    </p>
                    <Button onClick={() => navigate(createPageUrl('Home'))}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Geck Inspect
                    </Button>
                </div>
            </div>
        );
    }

    const ownerName = owner?.breeder_name || owner?.full_name || page.owner_email.split('@')[0];
    const externalLinks = Array.isArray(page.external_links) ? page.external_links : [];
    const contactIcon = page.contact_link?.startsWith('mailto:') ? Mail : MessageCircle;
    const ContactIcon = contactIcon;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-900">
            <Seo
                title={page.title}
                description={page.tagline || page.description?.slice(0, 160)}
                path={`/store/${slug}`}
                type="website"
            />
            {!page.is_published && (
                <div className="bg-amber-900/60 border-b border-amber-700 text-amber-100 text-center py-2 text-sm">
                    Draft preview. This page is not yet visible to the public.
                </div>
            )}

            {/* Hero */}
            {page.header_image_url && (
                <div className="relative w-full h-56 md:h-80 overflow-hidden">
                    <img
                        src={page.header_image_url}
                        alt={page.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                </div>
            )}

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-12">
                <div className="space-y-2">
                    <p className="text-sm uppercase tracking-widest text-emerald-300/80 font-semibold">
                        {ownerName}'s store on Geck Inspect
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold text-white">{page.title}</h1>
                    {page.tagline && (
                        <p className="text-xl text-slate-300">{page.tagline}</p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-4">
                        {page.contact_link && (
                            <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
                                <a href={page.contact_link} target="_blank" rel="noopener noreferrer">
                                    <ContactIcon className="w-4 h-4 mr-2" />
                                    Get in touch
                                </a>
                            </Button>
                        )}
                        {page.secondary_link && (
                            <Button asChild variant="outline" className="border-slate-700 text-slate-100 hover:bg-slate-800">
                                <a href={page.secondary_link} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Visit store
                                </a>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Featured geckos */}
                {featuredGeckos.length > 0 && (
                    <section className="space-y-4">
                        <div className="flex items-end justify-between">
                            <h2 className="text-2xl font-semibold text-white">Featured geckos</h2>
                            {owner?.id && (
                                <Link
                                    to={createPageUrl(`PublicProfile?userId=${owner.id}`)}
                                    className="text-sm text-emerald-300 hover:text-emerald-200"
                                >
                                    See full collection
                                </Link>
                            )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {featuredGeckos.map((g) => {
                                const img = g.image_urls?.[0] || DEFAULT_GECKO_IMAGE;
                                const morph = g.morphs_traits || '';
                                return (
                                    <Link
                                        key={g.id}
                                        to={createPageUrl(`GeckoDetail?id=${g.id}`)}
                                        className="group block rounded-xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-emerald-500/50 transition-colors"
                                    >
                                        <div className="aspect-square bg-slate-800 overflow-hidden">
                                            <img
                                                src={img}
                                                alt={g.name}
                                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                            />
                                        </div>
                                        <div className="p-3 space-y-1">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <p className="font-semibold text-slate-100 truncate">{g.name}</p>
                                                {g.asking_price && (
                                                    <p className="text-emerald-300 font-semibold text-sm shrink-0">${g.asking_price}</p>
                                                )}
                                            </div>
                                            {morph && (
                                                <p className="text-xs text-slate-400 truncate">{morph}</p>
                                            )}
                                            {g.status && g.status !== 'For Sale' && (
                                                <p className="text-[10px] uppercase tracking-wider text-slate-500">{g.status}</p>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Featured breeding pairs */}
                {featuredPlans.length > 0 && (
                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <GitBranch className="w-6 h-6 text-pink-400" /> Featured pairings
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {featuredPlans.map((p) => (
                                <Card key={p.id} className="bg-slate-900/60 border-slate-800">
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-semibold text-slate-100">
                                                {[p.sire?.name, p.dam?.name].filter(Boolean).join(' x ') || 'Pairing'}
                                            </p>
                                            {p.status && (
                                                <span className="text-[10px] uppercase tracking-wider text-pink-300 bg-pink-500/10 border border-pink-500/30 rounded-full px-2 py-0.5">
                                                    {p.status.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[p.sire, p.dam].map((parent, i) => (
                                                <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-950/60 border border-slate-800 p-2">
                                                    <img
                                                        src={parent?.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
                                                        alt={parent?.name || (i === 0 ? 'Sire' : 'Dam')}
                                                        className="w-10 h-10 rounded object-cover shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] uppercase text-slate-500">{i === 0 ? 'Sire' : 'Dam'}</p>
                                                        <p className="text-sm text-slate-100 truncate">{parent?.name || 'Unknown'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {p.notes && (
                                            <p className="text-xs text-slate-400 line-clamp-3">{p.notes}</p>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                )}

                {/* About */}
                {page.description && (
                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">About</h2>
                        <Card className="bg-slate-900/60 border-slate-800">
                            <CardContent className="prose prose-invert max-w-none p-6 whitespace-pre-wrap text-slate-200">
                                {page.description}
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* Policies */}
                {page.policies && (
                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-amber-300" /> Policies
                        </h2>
                        <Card className="bg-slate-900/60 border-slate-800">
                            <CardContent className="p-6 whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                                {page.policies}
                            </CardContent>
                        </Card>
                    </section>
                )}

                {/* External links */}
                {externalLinks.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-2xl font-semibold text-white">Find me elsewhere</h2>
                        <div className="flex flex-wrap gap-2">
                            {externalLinks.map((link, idx) => {
                                const meta = linkKindMeta(link.kind);
                                return (
                                    <a
                                        key={idx}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${meta.accent}`}
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        {link.label || meta.label}
                                    </a>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Owner card */}
                {owner && (
                    <Card className="bg-slate-900/40 border-slate-800">
                        <CardContent className="p-6 flex items-center gap-4">
                            {owner.profile_image_url ? (
                                <img
                                    src={owner.profile_image_url}
                                    alt={ownerName}
                                    className="w-14 h-14 rounded-full object-cover border border-slate-700"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-emerald-900/50 border border-emerald-700 flex items-center justify-center text-emerald-200 font-bold text-lg">
                                    {ownerName[0]?.toUpperCase() || '?'}
                                </div>
                            )}
                            <div className="flex-1">
                                <p className="text-slate-300 text-sm">Run by</p>
                                <Link
                                    to={createPageUrl(`PublicProfile?userId=${owner.id}`)}
                                    className="text-lg font-semibold text-emerald-300 hover:text-emerald-200"
                                >
                                    {ownerName}
                                </Link>
                            </div>
                            <Button asChild variant="outline" className="border-slate-700 text-slate-100 hover:bg-slate-800">
                                <Link to={createPageUrl(`PublicProfile?userId=${owner.id}`)}>
                                    See their profile
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <p className="text-center text-xs text-slate-500">
                    Powered by Geck Inspect. <Link to={createPageUrl('Home')} className="hover:text-emerald-300 underline">Build your own store</Link>.
                </p>
            </div>
        </div>
    );
}
