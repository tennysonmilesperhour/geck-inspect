import { useEffect, useState } from 'react';
import { Star, ShieldCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

/**
 * Reviews on a breeder page (decision D9).
 *
 * Only a buyer with a completed transfer from this breeder can write one:
 * the seller sent a Geck Inspect transfer and the buyer claimed it. The
 * database enforces that (submit_breeder_review), so every review shown
 * here is a verified purchase. One review per transfer; writing again
 * edits it.
 */

// Columns safe to show anyone. Never select created_by (it can hold an
// email on old rows).
export const PUBLIC_REVIEW_COLUMNS = 'id, rating, title, body, is_verified, created_date, updated_date';

function StarRow({ rating, size = 'w-3.5 h-3.5' }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={size}
          fill={i <= rating ? '#f59e0b' : 'transparent'}
          style={{ color: i <= rating ? '#f59e0b' : '#475569' }}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          role="radio"
          aria-checked={value === i}
          aria-label={`${i} star${i === 1 ? '' : 's'}`}
          onClick={() => onChange(i)}
          className="touch:min-h-11 touch:min-w-11 p-1"
        >
          <Star
            className="w-6 h-6"
            fill={i <= value ? '#f59e0b' : 'transparent'}
            style={{ color: i <= value ? '#f59e0b' : '#64748b' }}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ transfer, breederName, onSaved }) {
  const { toast } = useToast();
  const [rating, setRating] = useState(transfer.rating || 0);
  const [title, setTitle] = useState(transfer.title || '');
  const [body, setBody] = useState(transfer.body || '');
  const [saving, setSaving] = useState(false);
  const editing = Boolean(transfer.review_id);

  const save = async () => {
    if (!rating) {
      toast({ title: 'Pick a star rating', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('submit_breeder_review', {
      p_transfer_id: transfer.transfer_id,
      p_rating: rating,
      p_title: title.trim() || null,
      p_body: body.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Review not saved', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editing ? 'Review updated' : 'Review posted', description: `Thanks for reviewing ${breederName}.` });
    onSaved();
  };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3">
      <p className="text-sm text-slate-200">
        {editing ? 'Edit your review' : 'Review your purchase'} of <span className="font-semibold">{transfer.gecko_name}</span>
      </p>
      <StarPicker value={rating} onChange={setRating} />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, 120))}
        placeholder="Headline (optional), e.g. Healthy Harlequin, packed well"
        className="bg-slate-900 border-slate-700 text-slate-100"
      />
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, 2000))}
        placeholder="How was the gecko on arrival, communication, shipping?"
        className="bg-slate-900 border-slate-700 text-slate-100 min-h-[90px]"
      />
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800 text-white">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {editing ? 'Save changes' : 'Post review'}
        </Button>
      </div>
    </div>
  );
}

export default function BreederReviews({ reviews, breederUserId, breederName, onReviewsChanged }) {
  const { isAuthenticated, user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const isOwner = Boolean(user?.auth_user_id && breederUserId && user.auth_user_id === breederUserId);

  useEffect(() => {
    if (!isAuthenticated || !breederUserId || isOwner) {
      setTransfers([]);
      return undefined;
    }
    let cancelled = false;
    supabase
      .rpc('my_reviewable_transfers', { p_breeder_user_id: breederUserId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn('Could not check review eligibility:', error.message);
          setTransfers([]);
          return;
        }
        setTransfers(Array.isArray(data) ? data : []);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, breederUserId, isOwner, refreshKey]);

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
    onReviewsChanged?.();
  };

  return (
    <section className="max-w-4xl mx-auto px-6 pb-16">
      <h2 className="text-xl font-bold text-white mb-1">Reviews</h2>
      <p className="text-xs text-slate-400 mb-4 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        Only buyers who received a gecko from this breeder through a Geck Inspect transfer can leave a review.
      </p>

      {transfers.length > 0 && (
        <div className="space-y-3 mb-6">
          {transfers.map((t) => (
            <ReviewForm key={t.transfer_id} transfer={t} breederName={breederName} onSaved={handleSaved} />
          ))}
        </div>
      )}

      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
              <div className="flex items-center gap-2 mb-2">
                <StarRow rating={r.rating || 0} />
                {r.is_verified && (
                  <span className="text-[11px] rounded-full bg-emerald-500/15 text-emerald-300 px-2 py-0.5 font-semibold">
                    Verified purchase
                  </span>
                )}
                {r.created_date && (
                  <span className="text-[11px] text-slate-500">
                    {new Date(r.created_date).toLocaleDateString()}
                  </span>
                )}
              </div>
              {r.title && <p className="text-sm font-semibold text-white">{r.title}</p>}
              {r.body && <p className="text-sm text-slate-300 mt-1 leading-relaxed whitespace-pre-wrap">{r.body}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">No reviews yet.</p>
      )}
    </section>
  );
}
