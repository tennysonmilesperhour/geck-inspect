import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Eye, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, ScanSearch, Check } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * "Help ID these" surface. Single-card cycle with small left/right
 * arrows over the image for navigation, plus Looks-right / Wrong
 * buttons below. Only surfaces genuine user-submitted ID-request
 * uploads, the next_unvoted_id_candidates RPC filters out scraper
 * training rows (created_by NULL).
 */

const BATCH_SIZE = 20;

export default function IdNeedsPanel({ currentUserEmail }) {
    const { toast } = useToast();
    const [queue, setQueue] = useState(null); // null = loading, [] = empty
    const [index, setIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [exhausted, setExhausted] = useState(false);
    const [votedCount, setVotedCount] = useState(0);

    const fetchBatch = useCallback(async () => {
        const { data, error } = await supabase.rpc('next_unvoted_id_candidates', {
            reviewer: currentUserEmail,
            lim: BATCH_SIZE,
        });
        if (error) {
            console.warn('next_unvoted_id_candidates failed:', error);
            return [];
        }
        return Array.isArray(data) ? data : [];
    }, [currentUserEmail]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!currentUserEmail) { setQueue([]); return; }
            const batch = await fetchBatch();
            if (cancelled) return;
            setQueue(batch);
            setIndex(0);
            if (batch.length === 0) setExhausted(true);
        })();
        return () => { cancelled = true; };
    }, [currentUserEmail, fetchBatch]);

    const current = queue && queue[index];

    const goNext = useCallback(async () => {
        if (!queue) return;
        const next = index + 1;
        if (next < queue.length) {
            setIndex(next);
        } else {
            const batch = await fetchBatch();
            if (batch.length === 0) {
                setExhausted(true);
                setQueue([]);
                setIndex(0);
            } else {
                setQueue(batch);
                setIndex(0);
            }
        }
    }, [queue, index, fetchBatch]);

    const goPrev = useCallback(() => {
        if (!queue || index === 0) return;
        setIndex(index - 1);
    }, [queue, index]);

    const submitVote = useCallback(async (verdict) => {
        if (!current || submitting) return;
        if (!currentUserEmail) {
            toast({ title: 'Sign in to vote', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        const { error } = await supabase.from('classification_votes').insert({
            gecko_image_id: current.id,
            primary_morph: current.primary_morph,
            verdict,
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
        await goNext();
        setSubmitting(false);
    }, [current, submitting, currentUserEmail, toast, goNext]);

    useEffect(() => {
        if (!current) return undefined;
        const onKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'a' || e.key === 'y') { e.preventDefault(); submitVote('approve'); }
            if (e.key === 'r' || e.key === 'n') { e.preventDefault(); submitVote('reject'); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [current, submitVote, goNext, goPrev]);

    if (queue === null) {
        return (
            <Card className="gecko-card">
                <CardHeader>
                    <CardTitle className="text-gecko-text flex items-center gap-2">
                        <ScanSearch className="w-5 h-5 text-gecko-accent" /> Help ID these
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 rounded-lg bg-slate-800/40 border border-slate-800 animate-pulse" />
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
                                : 'No community ID requests waiting right now.'}
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

    return (
        <Card className="gecko-card">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <CardTitle className="text-gecko-text flex items-center gap-2">
                            <ScanSearch className="w-5 h-5 text-gecko-accent" /> Help ID these
                        </CardTitle>
                        <p className="text-xs text-slate-500 mt-1">
                            Community ID requests. Confirm or correct the AI&apos;s call.
                        </p>
                    </div>
                    <div className="text-right shrink-0">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500">Session</p>
                        <p className="text-sm font-semibold text-emerald-300 tabular-nums">{votedCount} voted</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                    <div className="relative bg-slate-950 group">
                        <Link
                            to={createPageUrl('Gallery')}
                            className="block"
                            aria-label="Open in gallery"
                        >
                            <img
                                src={current.image_url}
                                alt={morph}
                                className="w-full aspect-[4/3] object-contain"
                                loading="eager"
                            />
                        </Link>
                        {/* Prev arrow */}
                        <button
                            type="button"
                            onClick={goPrev}
                            disabled={index === 0}
                            aria-label="Previous"
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 text-white/90 hover:bg-black/80 hover:border-emerald-400/40 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {/* Next arrow */}
                        <button
                            type="button"
                            onClick={goNext}
                            aria-label="Next"
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 text-white/90 hover:bg-black/80 hover:border-emerald-400/40 flex items-center justify-center transition-colors"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-3">
                        <p className="text-sm text-slate-200">
                            AI calls it a <span className="font-semibold text-emerald-300 capitalize">{morph}</span>.
                        </p>
                        {current.base_color && (
                            <p className="text-xs text-slate-500 capitalize mt-0.5">
                                Base: {current.base_color.replace(/_/g, ' ')}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex gap-2 mt-3">
                    <Button
                        size="sm"
                        onClick={() => submitVote('reject')}
                        disabled={submitting}
                        variant="outline"
                        className="flex-1 h-8 text-xs border-rose-500/40 text-rose-300 hover:bg-rose-950/30 hover:text-rose-200"
                    >
                        <ThumbsDown className="w-3.5 h-3.5 mr-1" /> Wrong
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => submitVote('approve')}
                        disabled={submitting}
                        className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-500"
                    >
                        <ThumbsUp className="w-3.5 h-3.5 mr-1" /> Looks right
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
