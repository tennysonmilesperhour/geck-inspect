import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Check, Sparkles } from 'lucide-react';

// Public waitlist signup page.
//
// Route: /waitlist/:slug — no auth required. The breeder shares this
// URL on social media; followers land here, see what the post is
// about, and drop name/email to be notified when the gecko/clutch is
// ready. Submissions land in gecko_waitlist_signups via an
// RLS-allowed anon insert.
export default function Waitlist() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [waitlist, setWaitlist] = useState(null);
  const [gecko, setGecko] = useState(null);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: w, error: wErr } = await supabase
          .from('gecko_waitlists')
          .select('id, slug, title, description, is_open, closes_at, max_signups, gecko_id, breeder_user_id')
          .eq('slug', slug)
          .maybeSingle();
        if (cancelled) return;
        if (wErr) {
          setError(wErr.message);
          return;
        }
        if (!w) {
          setError('This waitlist link is invalid or has been removed.');
          return;
        }
        setWaitlist(w);
        if (w.gecko_id) {
          const { data: g } = await supabase
            .from('geckos')
            .select('id, name, morph, morph_description, image_urls, sex, hatch_date')
            .eq('id', w.gecko_id)
            .maybeSingle();
          if (!cancelled) setGecko(g || null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const isClosed =
    !waitlist?.is_open ||
    (waitlist?.closes_at && new Date(waitlist.closes_at) < new Date());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!waitlist?.id || !name.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: insErr } = await supabase
        .from('gecko_waitlist_signups')
        .insert({
          waitlist_id: waitlist.id,
          name: name.trim(),
          email: email.trim(),
          notes: notes.trim() || null,
        });
      if (insErr) throw insErr;
      setSubmitted(true);
    } catch (err) {
      setError(err?.message || 'Signup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-950 text-emerald-100">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error && !waitlist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-950 text-emerald-100 p-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold mb-2">Waitlist unavailable</h1>
          <p className="text-emerald-200/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-emerald-900 text-emerald-100">
      <Helmet>
        <title>{`${waitlist.title} ,  Waitlist`}</title>
        <meta name="description" content={waitlist.description?.slice(0, 160) || waitlist.title} />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-2 mb-6 text-emerald-300/80">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Geck Inspect waitlist</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold mb-3">{waitlist.title}</h1>

        {gecko?.image_urls?.[0] && (
          <img
            src={gecko.image_urls[0]}
            alt={gecko.name || gecko.id}
            className="w-full aspect-video object-cover rounded-lg border border-emerald-800/40 mb-4"
            loading="lazy"
          />
        )}

        {gecko && (
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/40 p-4 mb-4">
            <div className="text-sm text-emerald-200/70 uppercase tracking-wider text-[10px] mb-1">
              About this gecko
            </div>
            <div className="text-lg font-semibold">{gecko.name || gecko.id}</div>
            {(gecko.morph_description || gecko.morph) && (
              <div className="text-sm text-emerald-200/80">
                {gecko.morph_description || gecko.morph}
              </div>
            )}
            {gecko.sex && (
              <div className="text-xs text-emerald-300/70 mt-1">Sex: {gecko.sex}</div>
            )}
          </div>
        )}

        {waitlist.description && (
          <div className="prose prose-invert prose-sm max-w-none mb-6 whitespace-pre-wrap text-emerald-100/90">
            {waitlist.description}
          </div>
        )}

        {isClosed ? (
          <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 p-4 text-amber-200 text-sm">
            This waitlist is closed for new signups. If you'd previously
            joined, the breeder will be in touch.
          </div>
        ) : submitted ? (
          <div className="rounded-lg border border-emerald-600/50 bg-emerald-800/40 p-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-200 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">You're on the list</div>
              <div className="text-sm text-emerald-200/80 mt-1">
                The breeder will reach out when this gecko (or a similar one from the project) is ready.
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-emerald-800/40 bg-emerald-950/40 p-4">
            <div className="text-sm font-semibold text-emerald-100">Join the waitlist</div>
            <div>
              <Label htmlFor="wl-name" className="text-xs">Your name</Label>
              <Input
                id="wl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Jane Crested"
              />
            </div>
            <div>
              <Label htmlFor="wl-email" className="text-xs">Email</Label>
              <Input
                id="wl-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div>
              <Label htmlFor="wl-notes" className="text-xs">Anything the breeder should know? (optional)</Label>
              <Textarea
                id="wl-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Looking for a specific morph combo, prefer male, etc."
              />
            </div>
            {error && (
              <div className="text-xs text-red-300">{error}</div>
            )}
            <Button
              type="submit"
              disabled={submitting || !name.trim() || !email.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 w-full"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Joining…</>
                : 'Join the waitlist'}
            </Button>
            <p className="text-[11px] text-emerald-200/60">
              Your details only reach the breeder who created this waitlist.
              Geck Inspect doesn't share or sell them.
            </p>
          </form>
        )}

        <div className="text-center mt-8 text-xs text-emerald-300/60">
          Powered by{' '}
          <a href="/" className="text-emerald-200/90 underline hover:text-emerald-100">
            Geck Inspect
          </a>
        </div>
      </div>
    </div>
  );
}
