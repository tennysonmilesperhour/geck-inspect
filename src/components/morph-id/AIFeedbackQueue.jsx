import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { GeckoImage } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, Check, X as XIcon, ChevronLeft, ChevronRight,
  RefreshCw, Scale, ShieldCheck, Plus,
} from 'lucide-react';

import MorphPicker from './MorphPicker';
import TraitPicker from './TraitPicker';
import PhotoSlideshow from './PhotoSlideshow';
import { labelFor, TAXONOMY_VERSION } from './morphTaxonomy';

function urlsFor(row) {
  if (Array.isArray(row?.image_urls) && row.image_urls.length > 0) return row.image_urls;
  const fallback = row?.training_meta?.image_urls;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  return row?.image_url ? [row.image_url] : [];
}

function describeOutcome(action, result) {
  if (action === 'reject') return 'Rejection recorded. Sample stays unverified.';
  if (result?.verified) return 'Consensus reached — sample promoted to training-grade.';
  const count = result?.approve_count ?? 1;
  return `Approval recorded (${count}/2). Needs one more reviewer to verify.`;
}

const PAGE_SIZE = 25;

export default function AIFeedbackQueue() {
  const { toast } = useToast();
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpertReviewer, setIsExpertReviewer] = useState(false);
  const [edits, setEdits] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rows, expertRpc] = await Promise.all([
        GeckoImage.filter({ verified: false }, 'created_date', PAGE_SIZE).catch(() => []),
        supabase.rpc('is_expert_reviewer').then((r) => r.data).catch(() => false),
      ]);
      setIsExpertReviewer(Boolean(expertRpc));
      setQueue(rows || []);
      setHasMore((rows || []).length === PAGE_SIZE);
      setIdx(0);
    } catch (err) {
      toast({ title: 'Failed to load queue', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const next = await GeckoImage.filter(
        { verified: false },
        'created_date',
        PAGE_SIZE,
        queue.length,
      ).catch(() => []);
      const dedup = (next || []).filter((r) => !queue.some((q) => q.id === r.id));
      setQueue((prev) => [...prev, ...dedup]);
      setHasMore(dedup.length === PAGE_SIZE);
    } catch (err) {
      toast({ title: 'Failed to load more', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoadingMore(false);
    }
  }, [queue, toast]);

  useEffect(() => { load(); }, [load]);

  const current = queue[idx] || null;
  useEffect(() => {
    if (!current) { setEdits(null); return; }
    setEdits({
      primary_morph: current.primary_morph || '',
      secondary_traits: current.secondary_traits || [],
    });
  }, [current]);

  const step = (delta) => {
    setIdx((i) => Math.max(0, Math.min(queue.length - 1, i + delta)));
  };

  const persist = async (action) => {
    if (!current) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('review_gecko_image', {
        p_image_id: current.id,
        p_verdict: action,
        p_primary_morph: edits?.primary_morph || current.primary_morph,
        p_secondary_traits: edits?.secondary_traits || current.secondary_traits || [],
        p_edits: { taxonomy_version: TAXONOMY_VERSION, edits },
        p_notes: null,
      });
      if (error) throw error;

      toast({
        title: action === 'reject' ? 'Rejected' : 'Approved',
        description: describeOutcome(action, data),
      });

      // Once a sample is rejected or has reached consensus, it leaves the
      // unverified queue. Otherwise keep it visible so a second reviewer can
      // confirm the same row.
      if (action === 'reject' || data?.verified) {
        const next = queue.filter((q) => q.id !== current.id);
        setQueue(next);
        setIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
      } else {
        step(1);
      }
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
            No unverified samples right now. Contribute more — or come back later
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            Peer review · {idx + 1} of {queue.length}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <PhotoSlideshow
              urls={urlsFor(current)}
              alt="Sample awaiting review"
            />
            <p className="text-xs text-slate-500 mt-2">
              Submitted {submittedAgo}
              {urlsFor(current).length > 1 && ` · ${urlsFor(current).length} photos`}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Submitted as</p>
              <p className="text-xl font-bold text-slate-100">
                {labelFor(current.primary_morph, 'Unclassified')}
              </p>
              {current.confidence_score != null && (
                <p className="text-xs text-slate-400 mt-1">
                  contributor confidence: {Math.round(current.confidence_score)}%
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

            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Your call — edit before approving if needed
              </p>
              {edits && (
                <>
                  <MorphPicker
                    primary={edits.primary_morph}
                    onPrimaryChange={(v) => setEdits((e) => ({ ...e, primary_morph: v }))}
                  />
                  <TraitPicker
                    value={edits.secondary_traits}
                    onChange={(v) => setEdits((e) => ({ ...e, secondary_traits: v }))}
                    compact
                  />
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
            disabled={isSaving}
            className="text-rose-300 border-rose-600/50 hover:bg-rose-950"
          >
            <XIcon className="w-4 h-4 mr-2" /> Reject
          </Button>
          <Button
            onClick={() => persist('approve')}
            disabled={isSaving || !edits?.primary_morph || !isExpertReviewer}
            title={isExpertReviewer
              ? 'Promote this sample to verified training data'
              : 'Only expert reviewers can approve — your edits will still be saved if you submit feedback from /recognition.'}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSaving
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Check className="w-4 h-4 mr-2" />}
            Approve &amp; verify
          </Button>
          {!isExpertReviewer && (
            <span className="text-xs text-slate-500">
              You can review + suggest edits, but only expert reviewers can verify.
            </span>
          )}
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
