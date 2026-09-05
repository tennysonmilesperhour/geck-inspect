import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { GeckoImage } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, Check, X as XIcon, ChevronLeft, ChevronRight,
  RefreshCw, Scale, ShieldCheck, Plus,
} from 'lucide-react';

import MorphPicker from './MorphPicker';
import TraitPicker from './TraitPicker';
import PhotoSlideshow from './PhotoSlideshow';
import {
  BASE_COLORS,
  PATTERN_INTENSITIES,
  WHITE_AMOUNTS,
  FIRED_STATES,
  labelFor,
  TAXONOMY_VERSION,
} from './morphTaxonomy';

function urlsFor(row) {
  if (Array.isArray(row?.image_urls) && row.image_urls.length > 0) return row.image_urls;
  const fallback = row?.training_meta?.image_urls;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  return row?.image_url ? [row.image_url] : [];
}

function describeOutcome(action, result) {
  if (action === 'reject') return 'Rejection recorded. This sample is excluded from the review queue.';
  if (result?.verified) {
    return 'Expert review complete. This sample is now training-grade.';
  }
  const matching = result?.matching_approve_count ?? result?.approve_count ?? 1;
  const required = result?.required_approve_count ?? 1;
  return `Review recorded (${matching}/${required} approvals).`;
}

const PAGE_SIZE = 100;
// Default to NEWEST first. The previous oldest-first default buried freshly
// seeded scraper candidates behind a backlog of legacy user submissions, so
// the queue looked empty even with ~3,700 pending rows. Users still
// processing the backlog can toggle to oldest-first via the sort control.
const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first', expr: '-created_date' },
  { id: 'oldest', label: 'Oldest first', expr: 'created_date' },
];

// Pull initial genetic_traits off whichever well the seeder used. Older rows
// store the array in training_meta.genetic_traits; the seeder PR also writes
// it there so the same accessor works for both.
function initialEdits(row) {
  const meta = row?.training_meta || {};
  return {
    primary_morph:     row?.primary_morph || '',
    genetics:          Array.isArray(meta.genetic_traits) ? meta.genetic_traits : [],
    secondary_traits:  row?.secondary_traits || [],
    base_color:        row?.base_color || '',
    pattern_intensity: row?.pattern_intensity || 'unknown',
    white_amount:      row?.white_amount || 'unknown',
    fired_state:       row?.fired_state || 'unknown',
  };
}

export default function AIFeedbackQueue() {
  const { toast } = useToast();
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpertReviewer, setIsExpertReviewer] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [edits, setEdits] = useState(null);
  const [sortMode, setSortMode] = useState('newest');
  const [totalCount, setTotalCount] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [fetchOffset, setFetchOffset] = useState(0);
  const [reviewedIds, setReviewedIds] = useState(() => new Set());

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const sortExpr = SORT_OPTIONS.find((s) => s.id === sortMode)?.expr ?? '-created_date';
      const [expertRpc, adminRpc, authRes] = await Promise.all([
        supabase.rpc('is_expert_reviewer').then((r) => r.data).catch(() => false),
        supabase.rpc('is_admin').then((r) => r.data).catch(() => false),
        supabase.auth.getUser().catch(() => ({ data: { user: null } })),
      ]);
      const canReview = Boolean(expertRpc) || Boolean(adminRpc);
      setIsExpertReviewer(Boolean(expertRpc));
      setIsAdmin(Boolean(adminRpc));
      if (!canReview) {
        setQueue([]);
        setTotalCount(0);
        setHasMore(false);
        return;
      }

      const reviewerEmail = authRes?.data?.user?.email;
      const [rows, countRes, voteRes] = await Promise.all([
        GeckoImage.filter({ verified: false }, sortExpr, PAGE_SIZE).catch(() => []),
        supabase
          .from('gecko_images')
          .select('id', { count: 'exact', head: true })
          .eq('verified', false)
          .then((r) => r)
          .catch(() => ({ count: null })),
        reviewerEmail
          ? supabase
            .from('classification_votes')
            .select('gecko_image_id')
            .eq('reviewer_email', reviewerEmail)
            .not('label_fingerprint', 'is', null)
          : Promise.resolve({ data: [] }),
      ]);
      const alreadyVoted = new Set((voteRes?.data || []).map((vote) => String(vote.gecko_image_id)));
      const availableRows = (rows || []).filter((row) => (
        row?.training_meta?.review_status !== 'rejected'
        && !alreadyVoted.has(String(row.id))
      ));
      setQueue(availableRows);
      setReviewedIds(alreadyVoted);
      setFetchOffset((rows || []).length);
      setHasMore((rows || []).length === PAGE_SIZE);
      setTotalCount(typeof countRes?.count === 'number' ? countRes.count : null);
      setIdx(0);
    } catch (err) {
      toast({ title: 'Failed to load queue', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast, sortMode]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const sortExpr = SORT_OPTIONS.find((s) => s.id === sortMode)?.expr ?? '-created_date';
      const next = await GeckoImage.filter(
        { verified: false },
        sortExpr,
        PAGE_SIZE,
        fetchOffset,
      ).catch(() => []);
      const dedup = (next || []).filter((row) => (
        row?.training_meta?.review_status !== 'rejected'
        && !reviewedIds.has(String(row.id))
        && !queue.some((queued) => queued.id === row.id)
      ));
      setQueue((prev) => [...prev, ...dedup]);
      setFetchOffset((offset) => offset + (next || []).length);
      setHasMore((next || []).length === PAGE_SIZE);
    } catch (err) {
      toast({ title: 'Failed to load more', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchOffset, queue, reviewedIds, toast, sortMode]);

  useEffect(() => { load(); }, [load]);

  const current = queue[idx] || null;
  useEffect(() => {
    if (!current) { setEdits(null); return; }
    setEdits(initialEdits(current));
    setReviewNotes('');
  }, [current]);

  const step = (delta) => {
    setIdx((i) => Math.max(0, Math.min(queue.length - 1, i + delta)));
  };

  const setEdit = (k, v) => setEdits((e) => (e ? { ...e, [k]: v } : e));

  const removeCurrentFromQueue = () => {
    const next = queue.filter((q) => q.id !== current.id);
    setQueue(next);
    setIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
  };

  // Standard expert review. The database owns the current approval threshold.
  const persist = async (action) => {
    if (!current || !edits) return;
    if (reviewNotes.trim().length < 10) {
      toast({
        title: 'Add a short evidence note',
        description: 'Name the visible feature that supports your call or makes the photo unsuitable.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('review_gecko_image', {
        p_image_id:          current.id,
        p_verdict:           action,
        p_primary_morph:     edits.primary_morph || current.primary_morph,
        p_secondary_traits:  edits.secondary_traits || current.secondary_traits || [],
        p_edits:             { taxonomy_version: TAXONOMY_VERSION, edits },
        p_notes:             reviewNotes.trim(),
        p_genetic_traits:    edits.genetics || [],
        p_base_color:        edits.base_color || null,
        p_pattern_intensity: edits.pattern_intensity || null,
        p_white_amount:      edits.white_amount || null,
        p_fired_state:       edits.fired_state || null,
      });
      if (error) throw error;

      toast({
        title: action === 'reject' ? 'Rejected' : 'Approved',
        description: describeOutcome(action, data),
      });

      // A reviewer should never see their own completed item again.
      removeCurrentFromQueue();
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-8 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin inline mr-2" /> Loading review queue…
        </CardContent>
      </Card>
    );
  }

  if (!isExpertReviewer && !isAdmin) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Expert review queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-400">
            This queue is limited to approved expert reviewers. You can still submit a correction from Morph ID for independent review.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!current) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> Review queue empty
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-slate-400">
            No unverified samples right now. Contribute more, or come back later
            as new ones flow in from Recognition and community uploads.
          </p>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </CardContent>
      </Card>
    );
  }

  const submittedAgo = current.created_date
    ? formatDistanceToNowStrict(new Date(current.created_date), { addSuffix: true })
    : 'at an unknown time';

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              Peer review · {idx + 1} of {queue.length} loaded
            </CardTitle>
            {totalCount != null && (
              <p className="mt-1 text-xs text-slate-400">
                {totalCount.toLocaleString()} unverified in the queue · sorted{' '}
                {SORT_OPTIONS.find((s) => s.id === sortMode)?.label.toLowerCase()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortMode} onValueChange={(v) => setSortMode(v)}>
              <SelectTrigger className="h-8 w-36 bg-slate-800 border-slate-600 text-slate-100 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 text-slate-100">
                {SORT_OPTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <PhotoSlideshow
              urls={urlsFor(current)}
              alt="Sample awaiting review"
            />
            <p className="text-xs text-slate-500 mt-2">
              Submitted {submittedAgo}
              {urlsFor(current).length > 1 && ` · ${urlsFor(current).length} photos`}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Submitted as</p>
                <p className="text-xl font-bold text-slate-100">
                  {labelFor(current.primary_morph, 'Unclassified')}
                </p>
                {current.confidence_score != null && (
                  <p className="text-xs text-slate-400 mt-1">
                    {current.training_meta?.reviewer_verdict === 'agree' ? 'model signal' : 'contributor confidence'}:{' '}
                    {Math.round(current.confidence_score)}/100
                  </p>
                )}
              </div>

              {current.secondary_traits?.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Secondary traits</p>
                  <div className="flex flex-wrap gap-2">
                    {current.secondary_traits.map((t) => (
                      <Badge key={t} variant="secondary" className="bg-slate-700 text-slate-200">
                        {labelFor(t)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {current.notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Notes</p>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-800 p-2 rounded border border-slate-700">
                    {current.notes}
                  </pre>
                </div>
              )}

              {current.training_meta?.provenance && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Provenance</p>
                  <Badge variant="outline" className="text-xs">
                    {current.training_meta.provenance}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Your call, edit before approving if needed
              </p>
              {edits && (
                <>
                  <MorphPicker
                    primary={edits.primary_morph}
                    onPrimaryChange={(v) => setEdit('primary_morph', v)}
                    genetics={edits.genetics}
                    onGeneticsChange={(v) => setEdit('genetics', v)}
                  />

                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide mb-1 block">
                      Secondary traits
                    </Label>
                    <TraitPicker
                      value={edits.secondary_traits}
                      onChange={(v) => setEdit('secondary_traits', v)}
                      compact
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-slate-300 text-xs uppercase tracking-wide">Base color</Label>
                      <Select value={edits.base_color || ''} onValueChange={(v) => setEdit('base_color', v)}>
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                          <SelectValue placeholder="Pick color" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600 max-h-60">
                          {BASE_COLORS.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs uppercase tracking-wide">Fired state</Label>
                      <Select value={edits.fired_state || 'unknown'} onValueChange={(v) => setEdit('fired_state', v)}>
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {FIRED_STATES.map((f) => (
                            <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs uppercase tracking-wide">Pattern intensity</Label>
                      <Select value={edits.pattern_intensity || 'unknown'} onValueChange={(v) => setEdit('pattern_intensity', v)}>
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {PATTERN_INTENSITIES.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300 text-xs uppercase tracking-wide">White amount</Label>
                      <Select value={edits.white_amount || 'unknown'} onValueChange={(v) => setEdit('white_amount', v)}>
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-slate-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {WHITE_AMOUNTS.map((w) => (
                            <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300 text-xs uppercase tracking-wide">Evidence note</Label>
                    <Textarea
                      value={reviewNotes}
                      onChange={(event) => setReviewNotes(event.target.value)}
                      placeholder="Name the visible feature that supports this label, the closest alternative you ruled out, or why the photo is unusable."
                      className="bg-slate-800 border-slate-600 text-slate-100 mt-2"
                    />
                    <p className="text-xs text-slate-500 mt-1">Required so later reviewers can audit why this decision was made.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700">
          <Button variant="ghost" size="sm" onClick={() => step(-1)} disabled={idx === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Button>
          <Button
            variant="outline"
            onClick={() => persist('reject')}
            disabled={isSaving || reviewNotes.trim().length < 10}
            className="text-rose-300 border-rose-600/50 hover:bg-rose-950"
          >
            <XIcon className="w-4 h-4 mr-2" /> Reject
          </Button>
          <Button
            onClick={() => persist('approve')}
            disabled={isSaving || !edits?.primary_morph || (!isExpertReviewer && !isAdmin) || reviewNotes.trim().length < 10}
            title="Record an independent label. Two matching full label sets are required."
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Check className="w-4 h-4 mr-2" />}
            Approve
          </Button>
          <div className="flex-1" />
          {hasMore && idx >= queue.length - 3 && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Plus className="w-4 h-4 mr-2" />}
              Load more
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => step(1)} disabled={idx >= queue.length - 1}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
