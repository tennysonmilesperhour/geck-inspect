import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Store, Lock, Crown } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabaseClient';
import { tierOf } from '@/lib/tierLimits';
import { createPageUrl } from '@/utils';

/**
 * Dashboard hero button for the per-breeder store page.
 *
 * Behavior by tier:
 *   - breeder / enterprise / grandfathered:
 *       - if they have a published store, link to /store/:slug
 *       - if they have a draft, link to Settings#breeder-store
 *       - if they have nothing, link to Settings#breeder-store to create one
 *   - free / keeper:
 *       - clicking the button opens an upgrade-explainer dialog
 */
export default function MyStoreButton({ user }) {
    const navigate = useNavigate();
    const [storePage, setStorePage] = useState(null);
    const [loaded, setLoaded] = useState(false);

    const tier = tierOf(user);
    const hasPerk =
        tier === 'breeder' ||
        tier === 'enterprise' ||
        user?.subscription_status === 'grandfathered';

    useEffect(() => {
        if (!hasPerk || !user?.email) {
            setLoaded(true);
            return;
        }
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('breeder_store_pages')
                .select('slug, is_published')
                .eq('owner_email', user.email)
                .maybeSingle();
            if (!cancelled) {
                setStorePage(data || null);
                setLoaded(true);
            }
        })();
        return () => { cancelled = true; };
    }, [hasPerk, user?.email]);

    if (!user) return null;

    if (!hasPerk) {
        return (
            <Dialog>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        className="border-slate-600 bg-slate-900/60 text-slate-300 hover:bg-slate-800 backdrop-blur-sm"
                    >
                        <Lock className="w-4 h-4 mr-2" />
                        My Store
                    </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-300">
                            <Crown className="w-5 h-5" /> Custom store pages are a Breeder perk
                        </DialogTitle>
                        <DialogDescription className="text-slate-300 pt-2">
                            Breeder and Enterprise members can publish a dedicated store page on Geck Inspect, with a custom URL like
                            <code className="text-emerald-300 mx-1">geckinspect.com/store/your-name</code>,
                            a header image, an about section, and one-click contact links you can share anywhere. Upgrade to unlock it.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
                            <Link to={createPageUrl('Membership')}>See plans</Link>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    if (!loaded) {
        return (
            <Button variant="outline" disabled className="border-slate-700 bg-slate-900/60 text-slate-400">
                <Store className="w-4 h-4 mr-2" /> My Store
            </Button>
        );
    }

    if (storePage?.is_published && storePage.slug) {
        return (
            <Button
                onClick={() => navigate(createPageUrl('MyStore'))}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
            >
                <Store className="w-4 h-4 mr-2" /> My Store
            </Button>
        );
    }

    return (
        <Button
            onClick={() => navigate(createPageUrl('MyStore'))}
            variant="outline"
            className="border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/40"
        >
            <Store className="w-4 h-4 mr-2" />
            {storePage ? 'Finish my store' : 'Set up my store'}
        </Button>
    );
}
