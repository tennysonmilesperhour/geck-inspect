import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Share2, Trash2, Eye, UserPlus, ShieldQuestion } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ShareMenu from '@/components/shared/ShareMenu';
import {
  canShareAnalysis,
  cardFromAnalysis,
  shareCardView,
  shareErrorMessage,
  shareUrl,
} from '@/lib/morphShareCard';

// Cards point at the live site even from a preview build or the phone app,
// because that is the address social apps can read.
const SITE = 'https://geckinspect.com';
const MY_SHARES_KEY = ['morph-id-shares'];

function CardWords({ view }) {
  return (
    <div className="space-y-2">
      <p className="text-lg font-semibold text-slate-100">{view.headline}</p>
      <p className="text-sm text-slate-300">
        <span className="font-medium text-emerald-200">{view.confidence.word}.</span> {view.confidence.detail}
      </p>
      {view.likely.length > 0 && (
        <p className="text-sm text-slate-300"><span className="text-slate-400">Likely:</span> {view.likely.join(', ')}</p>
      )}
      {view.possible.length > 0 && (
        <p className="text-sm text-slate-300"><span className="text-slate-400">Possible:</span> {view.possible.join(', ')}</p>
      )}
      <p className="text-xs text-amber-200/90">{view.disclaimer}.</p>
    </div>
  );
}

/**
 * Share a Morph ID result as a public card (plan item E2 17).
 *
 * Nothing is public until the member taps "Make a share link". The card
 * is built on the server from the stored answer (create_morph_id_share),
 * and the member can stop sharing at any time.
 */
export default function MorphShareCard({ analysis, imageUrl, requestKey, isAdmin }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('idle'); // idle | confirm | working | shared
  const [shareId, setShareId] = useState(null);
  const [error, setError] = useState(null);
  const view = useMemo(() => shareCardView(cardFromAnalysis(analysis)), [analysis]);

  if (!canShareAnalysis(analysis) || !imageUrl) return null;

  const create = async () => {
    setStep('working');
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('create_morph_id_share', {
      p_request_key: requestKey || null,
      p_image_url: imageUrl,
      // Only an admin's answer is accepted from the page (admin scans are
      // not stored for replay). The server ignores it for everyone else.
      p_analysis: isAdmin ? analysis : null,
    });
    if (rpcError || !data?.id) {
      setError(shareErrorMessage(rpcError));
      setStep('confirm');
      return;
    }
    setShareId(data.id);
    setStep('shared');
    queryClient.invalidateQueries({ queryKey: MY_SHARES_KEY });
  };

  const stopSharing = async () => {
    if (!shareId) return;
    const { error: delError } = await supabase.from('morph_id_shares').delete().eq('id', shareId);
    if (delError) {
      setError('Could not stop sharing just now. Please try again.');
      return;
    }
    setShareId(null);
    setStep('idle');
    queryClient.invalidateQueries({ queryKey: MY_SHARES_KEY });
  };

  const url = shareId ? shareUrl(shareId, SITE) : null;

  return (
    <Card className="bg-slate-900/80 border-slate-700">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Share2 className="w-5 h-5 mt-0.5 text-emerald-300 shrink-0" />
          <div>
            <p className="font-semibold text-slate-100">Share this result</p>
            <p className="text-sm text-slate-400 mt-1">
              Post it in a &ldquo;what morph is this?&rdquo; thread. The card shows the photo, the result in plain words and a link to try Morph ID.
            </p>
          </div>
        </div>

        {step === 'idle' && (
          <Button variant="outline" onClick={() => setStep('confirm')} className="touch:min-h-11">
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
        )}

        {(step === 'confirm' || step === 'working') && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 flex flex-col sm:flex-row gap-4">
              <img src={imageUrl} alt="The photo that will be on the card" className="w-full sm:w-32 h-40 sm:h-32 object-cover rounded-md bg-slate-800" />
              <CardWords view={view} />
            </div>
            <p className="text-xs text-slate-400 flex items-start gap-2">
              <ShieldQuestion className="w-4 h-4 shrink-0" />
              This makes a public page with this photo and the result. Anyone with the link can see it. Your name and email are not on it, and you can stop sharing at any time.
            </p>
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={create} disabled={step === 'working'} className="bg-emerald-600 hover:bg-emerald-500 touch:min-h-11">
                {step === 'working' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                Make a share link
              </Button>
              <Button variant="ghost" onClick={() => { setStep('idle'); setError(null); }} disabled={step === 'working'} className="touch:min-h-11">
                Not now
              </Button>
            </div>
          </div>
        )}

        {step === 'shared' && url && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-200">Your card is live. Anyone with this link can see it.</p>
            <p className="text-sm font-mono break-all text-slate-200 bg-slate-950/60 border border-slate-700 rounded-md px-3 py-2">{url}</p>
            {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <ShareMenu url={url} title={`${view.headline} crested gecko`} subtitle="Morph ID on Geck Inspect" />
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-300 underline underline-offset-4 touch:min-h-11 inline-flex items-center">
                Open the card
              </a>
              <Button variant="ghost" onClick={stopSharing} className="text-rose-300 hover:text-rose-200 touch:min-h-11">
                <Trash2 className="w-4 h-4 mr-2" /> Stop sharing
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The member's own cards, so a card shared last week can still be found
 * and taken down. Only the owner can read these rows.
 */
export function MyMorphShares({ userId }) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState(null);
  const query = useQuery({
    queryKey: [...MY_SHARES_KEY, userId],
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('morph_id_shares')
        .select('id, card, view_count, signup_count, created_date')
        .order('created_date', { ascending: false })
        .limit(20);
      // Before the share migration is applied the table does not exist:
      // show nothing rather than an error.
      if (error) return [];
      return data || [];
    },
  });
  const rows = query.data || [];
  if (!rows.length) return null;

  const remove = async (id) => {
    setRemoving(id);
    await supabase.from('morph_id_shares').delete().eq('id', id);
    setRemoving(null);
    queryClient.invalidateQueries({ queryKey: MY_SHARES_KEY });
  };

  return (
    <details className="rounded-xl border border-slate-700 p-4">
      <summary className="cursor-pointer font-medium text-slate-200 touch:py-2.5">Your shared cards ({rows.length})</summary>
      <ul className="mt-3 divide-y divide-slate-800">
        {rows.map((row) => {
          const view = shareCardView(row.card);
          const url = shareUrl(row.id, SITE);
          return (
            <li key={row.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-100 truncate">{view.headline}</p>
                <p className="text-xs text-slate-500 flex flex-wrap gap-3">
                  <span>{new Date(row.created_date).toLocaleDateString()}</span>
                  <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {row.view_count} {row.view_count === 1 ? 'view' : 'views'}</span>
                  <span className="inline-flex items-center gap-1"><UserPlus className="w-3 h-3" /> {row.signup_count} {row.signup_count === 1 ? 'sign-up' : 'sign-ups'}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-300 underline underline-offset-4 touch:min-h-11 inline-flex items-center">Open</a>
                <Button variant="ghost" size="sm" onClick={() => remove(row.id)} disabled={removing === row.id} className="text-rose-300 hover:text-rose-200 touch:min-h-11">
                  {removing === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />} Stop sharing
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
