import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import Seo from '@/components/seo/Seo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { ExternalLink, Mail, Store, ArrowLeft } from 'lucide-react';

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

            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="space-y-2 mb-8">
                    <p className="text-sm uppercase tracking-widest text-emerald-300/80 font-semibold">
                        {ownerName}'s store on Geck Inspect
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold text-white">{page.title}</h1>
                    {page.tagline && (
                        <p className="text-xl text-slate-300">{page.tagline}</p>
                    )}
                </div>

                {page.description && (
                    <Card className="bg-slate-900/60 border-slate-800 mb-8">
                        <CardContent className="prose prose-invert max-w-none p-6 whitespace-pre-wrap text-slate-200">
                            {page.description}
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-wrap gap-3 mb-10">
                    {page.contact_link && (
                        <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
                            <a href={page.contact_link} target="_blank" rel="noopener noreferrer">
                                {page.contact_link.startsWith('mailto:') ? (
                                    <Mail className="w-4 h-4 mr-2" />
                                ) : (
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                )}
                                Get in touch
                            </a>
                        </Button>
                    )}
                    {page.secondary_link && (
                        <Button asChild variant="outline" className="border-slate-700">
                            <a href={page.secondary_link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Visit store
                            </a>
                        </Button>
                    )}
                </div>

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
                            <Button asChild variant="outline" className="border-slate-700">
                                <Link to={createPageUrl(`PublicProfile?userId=${owner.id}`)}>
                                    See their profile
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <p className="text-center text-xs text-slate-500 mt-10">
                    Powered by Geck Inspect. <Link to={createPageUrl('Home')} className="hover:text-emerald-300 underline">Build your own store</Link>.
                </p>
            </div>
        </div>
    );
}
