import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, ExternalLink, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { createPageUrl } from '@/utils';

/**
 * Tiny stub inside Settings that points to the dedicated /MyStore
 * editor. Kept here so the historical #breeder-store anchor still works
 * and so a Settings-page visitor can discover the store feature.
 */
export default function BreederStoreCard({ userEmail }) {
    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userEmail) return;
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('breeder_store_pages')
                .select('slug, is_published')
                .eq('owner_email', userEmail)
                .maybeSingle();
            if (!cancelled) {
                setPage(data || null);
                setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [userEmail]);

    return (
        <section id="breeder-store">
            <Card className="bg-emerald-950/20 border-emerald-900/40 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-emerald-200 flex items-center gap-2">
                        <Store className="w-5 h-5" /> My Store Page
                    </CardTitle>
                    <CardDescription className="text-emerald-300/60">
                        Your public storefront with featured geckos, breeding pairs, policies, and links.
                        Lives at its own dedicated editor.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-3">
                    <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
                        <Link to={createPageUrl('MyStore')}>
                            {loading ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading</>
                            ) : page ? (
                                <>Open store editor <ArrowRight className="w-4 h-4 ml-2" /></>
                            ) : (
                                <>Set up my store <ArrowRight className="w-4 h-4 ml-2" /></>
                            )}
                        </Link>
                    </Button>
                    {page?.slug && page.is_published && (
                        <Button asChild variant="outline" className="border-slate-700">
                            <a href={`/store/${page.slug}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" /> View live page
                            </a>
                        </Button>
                    )}
                </CardContent>
            </Card>
        </section>
    );
}
