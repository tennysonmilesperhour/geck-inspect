import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Eye, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, ScanSearch, Check, Tags, X } from 'lucide-react';
import { MORPHS } from '@/data/morph-guide';
import { createPageUrl } from '@/utils';

/**
 * "Help ID these" surface. Single-card cycle with small left/right
 * arrows over the image for navigation, plus Looks-right / Wrong
 * buttons below. Only surfaces genuine user-submitted ID-request
 * uploads, the next_unvoted_id_candidates RPC filters out scraper
 * training rows (created_by NULL).
 */

const BATCH_SIZE = 20;

// Classifications a member can put on an image when the AI's card is
// missing them. Primary morph is any documented morph; traits are the
// pattern, structure, colour and combo morphs that stack on a primary.
const MORPH_OPTIONS = [...MORPHS]
    .map((m) => ({ slug: m.slug, name: m.name, category: m.category }))
    .sort((a, b) => a.name.localeCompare(b.name));
const TRAIT_CATEGORIES = new Set(['pattern', 'structure', 'color', 'combo']);
const BASE_COLORS = ['red', 'orange', 'yellow', 'cream', 'lavender', 'buckskin', 'olive', 'brown', 'dark', 'black', 'white', 'patternless'];
const slugify = (v) => String(v || '').toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');

export default function IdNeedsPanel({ currentUserEmail }) {
    const { toast } = useToast();
    const [queue, setQueue] = useState(null); // null = loading, [] = empty
    const [index, setIndex] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [exhausted, setExhausted] = useState(false);
    const [votedCount, setVotedCount] = useState(0);
    const [correcting, setCorrecting] = useState(false);
    const [suggestedMorph, setSuggestedMorph] = useState('');
    const [traits, setTraits] = useState([]);
    const [baseColor, setBaseColor] = useState('');

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

    // A fresh card starts with the AI's own call selected, so "add what is
    // missing" is one or two clicks and "it is a different morph" is a
    // change of the dropdown.
    useEffect(() => {
        setCorrecting(false);
        setSuggestedMorph(slugify(current?.primary_morph));
        setTraits([]);
        setBaseColor(slugify(current?.base_color));
    }, [current?.id]);

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

    const submitVote = useCallback(async (verdict, extra = null) => {
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
            // A correction carries the member's own classification. The
            // AI's call stays in primary_morph so the vote still counts
            // for or against it; the suggestion lives in edits.
            ...(extra ? {
                secondary_traits: extra.secondary_traits,
                base_color: extra.base_color || null,
                edits: extra,
            } : {}),
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

    const submitCorrection = useCallback(async () => {
        if (!current) return;
        const aiSlug = slugify(current.primary_morph);
        const primaryChanged = suggestedMorph && suggestedMorph !== aiSlug;
        const extra = {
            primary_morph: suggestedMorph || aiSlug,
            secondary_traits: traits,
            base_color: baseColor || null,
            source: 'dashboard_help_id',
        };
        // Different primary morph: the AI was wrong. Same morph with traits
        // or a base colour added: the AI was right but incomplete.
        await submitVote(primaryChanged ? 'reject' : 'approve', extra);
        toast({ title: 'Thanks, classification saved', description: primaryChanged ? 'Logged as a correction.' : 'Logged as a confirmation with your additions.' });
    }, [current, suggestedMorph, traits, baseColor, submitVote, toast]);

    const toggleTrait = (slug) => {
        setTraits((prev) => (prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]));
    };

    useEffect(() => {
        if (!current) return undefined;
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
            if (correcting) return;
            if (e.key === 'a' || e.key === 'y') { e.preventDefault(); submitVote('approve'); }
            if (e.key === 'r' || e.key === 'n') { e.preventDefault(); submitVote('reject'); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [current, submitVote, goNext, goPrev, correcting]);

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
                        <button
                            type="button"
                            onClick={() => setCorrecting((v) => !v)}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
                        >
                            {correcting ? <X className="w-3.5 h-3.5" /> : <Tags className="w-3.5 h-3.5" />}
                            {correcting ? 'Cancel' : 'Add or correct classifications'}
                        </button>
                    </div>

                    {correcting && (
                        <div className="border-t border-slate-800 p-3 space-y-3" data-no-select>
                            <label className="block">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Primary morph</span>
                                <select
                                    value={suggestedMorph}
                                    onChange={(e) => setSuggestedMorph(e.target.value)}
                                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 focus:border-emerald-600 focus:outline-none"
                                >
                                    <option value="">Not sure</option>
                                    {MORPH_OPTIONS.map((m) => (
                                        <option key={m.slug} value={m.slug}>{m.name}</option>
                                    ))}
                                </select>
                            </label>

                            <div>
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Traits you can see</span>
                                <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                    {MORPH_OPTIONS.filter((m) => TRAIT_CATEGORIES.has(m.category) && m.slug !== suggestedMorph).map((m) => {
                                        const on = traits.includes(m.slug);
                                        return (
                                            <button
                                                key={m.slug}
                                                type="button"
                                                onClick={() => toggleTrait(m.slug)}
                                                aria-pressed={on}
                                                className={`rounded-full border px-2.5 py-1 text-[11px] leading-none transition-colors ${
                                                    on
                                                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-100'
                                                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                                                }`}
                                            >
                                                {m.name}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <label className="block">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Base colour</span>
                                <select
                                    value={baseColor}
                                    onChange={(e) => setBaseColor(e.target.value)}
                                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 capitalize focus:border-emerald-600 focus:outline-none"
                                >
                                    <option value="">Not sure</option>
                                    {BASE_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </label>

                            <Button
                                size="sm"
                                onClick={submitCorrection}
                                disabled={submitting || (!suggestedMorph && traits.length === 0 && !baseColor)}
                                className="w-full h-9 text-xs bg-emerald-600 hover:bg-emerald-500"
                            >
                                <Check className="w-3.5 h-3.5 mr-1" /> Save classification and next
                            </Button>
                        </div>
                    )}
                </div>

                {!correcting && <div className="flex gap-2 mt-3">
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
                </div>}
            </CardContent>
        </Card>
    );
}
