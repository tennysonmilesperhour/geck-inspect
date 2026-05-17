import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Eye, ThumbsUp, ThumbsDown, SkipForward, ScanSearch, Check } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * "Help ID these" surface. One large card at a time, swipe-style: vote
 * approve, vote reject, or skip, then auto-advance to the next image
 * the current keeper hasn't seen yet.
 *
 * Backed by the next_unvoted_id_candidates RPC, which returns the next
 * batch of images that have an AI primary_morph guess and haven't been
 * voted on by this reviewer. Includes verified=true images because the
 * pool of verified=false images is tiny, but every verified image still
 * benefits from a community confirmation vote toward the consensus
 * signal that drives morph_ID training.
 */

const BATCH_SIZE = 20;

export default function IdNeedsPanel({ currentUserEmail }) {
    const { toast } = useToast();
    const [queue, setQueue] = useState(null); // null = loading, [] = empty
    const [index, setIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [exhausted, setExhausted] = useState(false);
    const [votedCount, setVotedCount] = useState(0);

    const loadBatch = useCallback(async () => {
        if (!currentUserEmail) {
            setQueue([]);
            return;
        }
        const { data, error } = await supabase.rpc('next_unvoted_id_candidates', {
            reviewer: currentUserEmail,
            lim: BATCH_SIZE,
        });
        if (error) {
            console.warn('next_unvoted_id_candidates failed:', error);
            setQueue([]);
            return;
        }
        setQueue(Array.isArray(data) ? data : []);
        setIndex(0);
        if (!data || data.length === 0) setExhausted(true);
    }, [currentUserEmail]);

    useEffect(() => {
        loadBatch();
    }, [loadBatch]);

    const current = queue && queue[index];

    const advance = useCallback(async () => {
        if (!queue) return;
        const next = index + 1;
        if (next < queue.length) {
            setIndex(next);
        } else {
            // Reached the end of the current batch, fetch the next one.
            const { data, error } = await supabase.rpc('next_unvoted_id_candidates', {
                reviewer: currentUserEmail,
                lim: BATCH_SIZE,
            });
            if (error || !data || data.length === 0) {
                setExhausted(true);
                setQueue([]);
                setIndex(0);
                return;
            }
            setQueue(data);
            setIndex(0);
        }
    }, [queue, index, currentUserEmail]);

    const submitVote = useCallback(async (verdict) => {
        if (!current || submitting) return;
        if (!currentUserEmail) {
            toast({
                title: 'Sign in to vote',
                description: 'Voting helps train the morph ID model.',
                variant: 'destructive',
            });
            return;
        }
        setSubmitting(true);
        const { error } = await supabase.from('classification_votes').insert({
            gecko_image_id: current.id,
            primary_morph: current.primary_morph,
            verdict, // 'approve' or 'reject'
            created_by: currentUserEmail,
            reviewer_email: currentUserEmail,
        });
        if (error) {
            toast({
                title: "Couldn't save your vote",
                description: error.message || 'Try again in a minute.',
                variant: 'destructive',
            });
            setSubmitting(false);
            return;
        }
        setVotedCount((c) => c + 1);
        await advance();
        setSubmitting(false);
    }, [current, submitting, currentUserEmail, toast, advance]);

    const skip = useCallback(async () => {
        if (submitting) return;
        await advance();
    }, [submitting, advance]);

    // Keyboard shortcuts: a/y = approve, r/n = reject, s/space = skip.
    useEffect(() => {
        if (!current) return undefined;
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'a' || e.key === 'y') { e.preventDefault(); submitVote('approve'); }
            if (e.key === 'r' || e.key === 'n') { e.preventDefault(); submitVote('reject'); }
            if (e.key === 's' || e.key === ' ') { e.preventDefault(); skip(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [current, submitVote, skip]);

    if (queue === null) {
        return (
            <Card className="gecko-card">
                <CardHeader>
                    <CardTitle className="text-gecko-text flex items-center gap-2">
                        <ScanSearch className="w-5 h-5 text-gecko-accent" /> Help ID these
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-72 rounded-lg bg-slate-800/40 border border-slate-800 animate-pulse" />
                </CardContent>
            </Card>
        );
    }

    if (exhausted || !current) {
        return (
            <Card className="gecko-card">
                <CardHeader>
                    <CardTitle className="text-gecko-text flex items-center gap-2">
                        <ScanSearch className="w-5 h-5 text-gecko-accent" /> Help ID these
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-4 py-8 text-center">
                        <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                        <p className="text-slate-100 font-semibold mb-1">All caught up</p>
                        <p className="text-xs text-slate-400 mb-4">
                            {votedCount > 0
                                ? `You voted on ${votedCount} ${votedCount === 1 ? 'image' : 'images'} this session.`
                                : "You've reviewed everything in the community queue."}
                        </p>
                        <Button asChild size="sm" variant="outline" className="border-slate-700">
                            <Link to={createPageUrl('Gallery')}>
                                <Eye className="w-3.5 h-3.5 mr-1.5" /> Browse the gallery
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const morph = current.primary_morph ? current.primary_morph.replace(/_/g, ' ') : 'unknown morph';
    const remaining = queue.length - index;

    return (
        <Card className="gecko-card">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle className="text-gecko-text flex items-center gap-2">
                            <ScanSearch className="w-5 h-5 text-gecko-accent" /> Help ID these
                        </CardTitle>
                        <p className="text-xs text-slate-500 mt-1">
                            Confirm or correct the AI&apos;s morph call. Your vote feeds the training signal.
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">This session</p>
                        <p className="text-sm font-semibold text-emerald-300 tabular-nums">{votedCount} voted</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                    <Link
                        to={createPageUrl('Gallery')}
                        className="block relative bg-slate-950"
                        aria-label="Open in gallery"
                    >
                        <img
                            src={current.image_url}
                            alt={morph}
                            className="w-full aspect-[4/3] object-contain"
                            loading="eager"
                        />
                        <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 px-2 py-1 text-[10px] font-semibold text-white/90">
                            {remaining > BATCH_SIZE ? `${BATCH_SIZE}+ to go` : `${remaining} to go`}
                        </span>
                    </Link>
                    <div className="p-3 space-y-2">
                        <p className="text-sm text-slate-200">
                            AI calls it a <span className="font-semibold text-emerald-300 capitalize">{morph}</span>.
                        </p>
                        {current.base_color && (
                            <p className="text-xs text-slate-500 capitalize">
                                Base: {current.base_color.replace(/_/g, ' ')}
                            </p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                    <Button
                        size="sm"
                        onClick={() => submitVote('reject')}
                        disabled={submitting}
                        variant="outline"
                        className="h-9 text-xs border-rose-500/40 text-rose-300 hover:bg-rose-950/30 hover:text-rose-200"
                        title="Reject (R)"
                    >
                        <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Wrong
                    </Button>
                    <Button
                        size="sm"
                        onClick={skip}
                        disabled={submitting}
                        variant="outline"
                        className="h-9 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
                        title="Skip (S)"
                    >
                        <SkipForward className="w-3.5 h-3.5 mr-1" /> Skip
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => submitVote('approve')}
                        disabled={submitting}
                        className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500"
                        title="Approve (A)"
                    >
                        <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Looks right
                    </Button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                    Shortcuts: <kbd className="text-slate-400">A</kbd> approve · <kbd className="text-slate-400">R</kbd> reject · <kbd className="text-slate-400">S</kbd> skip
                </p>
            </CardContent>
        </Card>
    );
}
