import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Eye, ThumbsUp, MessageCircle, ScanSearch } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * "Help ID these" surface. Pulls recent unverified gecko_images
 * (where an AI guess exists but no expert has signed off yet) and
 * lets any signed-in keeper one-tap agree with the AI's call.
 *
 * Each "Agree" insert creates a classification_votes row with
 * verdict='agree'. The actual majority-rules verification logic
 * lives elsewhere; this surface just makes voting cheap and
 * social. "Comment" jumps to the gallery image detail for the
 * deeper conversation.
 */
export default function IdNeedsPanel({ currentUserEmail }) {
    const { toast } = useToast();
    const [items, setItems] = useState(null);
    const [voted, setVoted] = useState(new Set());

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('gecko_images')
                .select('id, image_url, primary_morph, base_color, created_date, created_by, verified')
                .eq('verified', false)
                .not('primary_morph', 'is', null)
                .not('image_url', 'is', null)
                .order('created_date', { ascending: false })
                .limit(5);
            if (!cancelled) setItems(Array.isArray(data) ? data : []);
        })();
        return () => { cancelled = true; };
    }, []);

    const handleAgree = async (item) => {
        if (!currentUserEmail) {
            toast({ title: 'Sign in to vote', description: 'Voting helps train the morph ID model.', variant: 'destructive' });
            return;
        }
        setVoted(new Set([...voted, item.id]));
        const { error } = await supabase.from('classification_votes').insert({
            gecko_image_id: item.id,
            primary_morph: item.primary_morph,
            verdict: 'agree',
            created_by: currentUserEmail,
            reviewer_email: currentUserEmail,
        });
        if (error) {
            // Revert
            const next = new Set(voted);
            next.delete(item.id);
            setVoted(next);
            toast({ title: "Couldn't save your vote", description: error.message || 'Try again in a minute.', variant: 'destructive' });
        } else {
            toast({ title: 'Vote logged', description: `You agreed with the ${item.primary_morph?.replace(/_/g, ' ')} call.` });
        }
    };

    if (items === null) {
        return (
            <Card className="gecko-card">
                <CardHeader>
                    <CardTitle className="text-gecko-text flex items-center gap-2">
                        <ScanSearch className="w-5 h-5 text-gecko-accent" /> Help ID these
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-20 rounded-lg bg-slate-800/40 border border-slate-800 animate-pulse" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (items.length === 0) return null;

    return (
        <Card className="gecko-card">
            <CardHeader>
                <CardTitle className="text-gecko-text flex items-center gap-2">
                    <ScanSearch className="w-5 h-5 text-gecko-accent" /> Help ID these
                </CardTitle>
                <p className="text-xs text-slate-500">
                    Fresh uploads waiting for a second opinion. One tap to agree with the AI's call, or jump into the photo to dig in.
                </p>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {items.map((item) => {
                        const morph = item.primary_morph ? item.primary_morph.replace(/_/g, ' ') : 'unknown morph';
                        const didVote = voted.has(item.id);
                        return (
                            <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 hover:border-emerald-500/30 transition-colors">
                                <Link to={createPageUrl('Gallery')} className="shrink-0">
                                    <img
                                        src={item.image_url}
                                        alt={morph}
                                        className="w-16 h-16 rounded-lg object-cover border border-slate-700"
                                    />
                                </Link>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-200">
                                        AI calls it a <span className="font-semibold text-emerald-300 capitalize">{morph}</span>.
                                    </p>
                                    {item.base_color && (
                                        <p className="text-xs text-slate-500 capitalize">Base: {item.base_color.replace(/_/g, ' ')}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <Button
                                            size="sm"
                                            onClick={() => handleAgree(item)}
                                            disabled={didVote}
                                            className="h-7 text-xs bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50"
                                        >
                                            <ThumbsUp className="w-3 h-3 mr-1" />
                                            {didVote ? 'Voted' : 'Looks right'}
                                        </Button>
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs border-slate-700"
                                        >
                                            <Link to={createPageUrl('Gallery')}>
                                                <Eye className="w-3 h-3 mr-1" /> Open
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs border-slate-700"
                                        >
                                            <Link to={createPageUrl('Forum')}>
                                                <MessageCircle className="w-3 h-3 mr-1" /> Discuss
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
