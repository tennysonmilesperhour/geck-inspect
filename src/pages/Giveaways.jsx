import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_LOGO_URL, DEFAULT_GECKO_IMAGE } from "@/lib/constants";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/lib/supabaseClient';
import { Giveaway, GiveawayEntry, Gecko } from '@/api/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  Gift,
  Trophy,
  Sparkles,
  Plus,
  Calendar,
  CheckCircle,
  ExternalLink,
  ArrowLeft,
  Shuffle,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import { captureEvent } from '@/lib/posthog';

const LOGO_URL = APP_LOGO_URL;

const ENTRY_METHOD_LABELS = {
  enter_on_site: 'Enter directly on Geck Inspect',
  follow_social: 'Follow the breeder on social media',
  tag_friend: 'Tag a friend on a post',
  external: 'External form / giveaway page',
};

function formatDate(iso) {
  if (!iso) return 'No deadline';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function isExpired(g) {
  if (!g.end_date) return false;
  return new Date(g.end_date).getTime() < Date.now();
}

const PAGE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Crested Gecko Giveaways — Geck Inspect',
  url: 'https://geckinspect.com/Giveaways',
  description:
    'Active and upcoming crested gecko giveaways hosted by breeders on Geck Inspect. Browse, enter, and track winners for gecko giveaways from verified keepers.',
};

// ---------------------------------------------------------------------------
// Create giveaway modal
// ---------------------------------------------------------------------------
function CreateGiveawayModal({ open, onOpenChange, user, onCreated }) {
  const { toast } = useToast();
  const [myGeckos, setMyGeckos] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    gecko_id: '',
    entry_method: 'enter_on_site',
    entry_instructions: '',
    entry_url: '',
    end_date: '',
    max_winners: 1,
  });

  useEffect(() => {
    if (!open || !user?.email) return;
    Gecko.filter({ created_by: user.email })
      .then((r) => setMyGeckos(Array.isArray(r) ? r.filter((g) => !g.archived) : []))
      .catch(() => setMyGeckos([]));
  }, [open, user?.email]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const selectedGecko = myGeckos.find((g) => g.id === form.gecko_id);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        gecko_id: form.gecko_id || null,
        entry_method: form.entry_method,
        entry_instructions: form.entry_instructions.trim() || null,
        entry_url: form.entry_url.trim() || null,
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        max_winners: Math.max(1, parseInt(form.max_winners, 10) || 1),
        status: 'active',
        image_urls: selectedGecko?.image_urls || [],
        created_by: user.email,
      };
      const created = await Giveaway.create(payload);
      captureEvent('giveaway_created', {
        entry_method: payload.entry_method,
        max_winners: payload.max_winners,
        has_gecko: Boolean(payload.gecko_id),
        has_end_date: Boolean(payload.end_date),
      });
      toast({
        title: 'Giveaway created',
        description: `"${payload.title}" is now live.`,
      });
      onCreated?.(created);
      onOpenChange(false);
      setForm({
        title: '',
        description: '',
        gecko_id: '',
        entry_method: 'enter_on_site',
        entry_instructions: '',
        entry_url: '',
        end_date: '',
        max_winners: 1,
      });
    } catch (err) {
      toast({
        title: 'Could not create giveaway',
        description: err.message,
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Start a giveaway
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Pick a gecko from your collection, define the entry rules, and Geck Inspect will
            handle the rest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-slate-200">Title *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Harlequin hatchling giveaway"
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>

          <div>
            <Label className="text-slate-200">Gecko from your collection</Label>
            <Select
              value={form.gecko_id}
              onValueChange={(v) => setForm({ ...form, gecko_id: v })}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                <SelectValue placeholder="Select a gecko" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {myGeckos.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-slate-400">
                    You don&rsquo;t have any geckos yet.
                  </div>
                )}
                {myGeckos.map((g) => (
                  <SelectItem key={g.id} value={g.id} className="focus:bg-slate-800">
                    {g.name || 'Unnamed gecko'}
                    {g.gecko_id_code ? ` — ${g.gecko_id_code}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-200">Description</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Tell people what they're entering to win, when you'll draw the winner, any special conditions..."
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-200">Entry method</Label>
              <Select
                value={form.entry_method}
                onValueChange={(v) => setForm({ ...form, entry_method: v })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                  {Object.entries(ENTRY_METHOD_LABELS).map(([v, label]) => (
                    <SelectItem key={v} value={v} className="focus:bg-slate-800">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-200">Max winners</Label>
              <Input
                type="number"
                min={1}
                value={form.max_winners}
                onChange={(e) => setForm({ ...form, max_winners: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div>
            <Label className="text-slate-200">Entry instructions</Label>
            <Textarea
              rows={2}
              value={form.entry_instructions}
              onChange={(e) => setForm({ ...form, entry_instructions: e.target.value })}
              placeholder="e.g. Follow @mybreedery on Instagram and tag a friend in the giveaway post."
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-200">External URL (optional)</Label>
              <Input
                value={form.entry_url}
                onChange={(e) => setForm({ ...form, entry_url: e.target.value })}
                placeholder="https://instagram.com/p/..."
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-slate-200">End date</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40"
          >
            Cancel
          </Button>
          <Button
            disabled={isSaving || !form.title.trim()}
            onClick={handleSubmit}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold disabled:opacity-50"
          >
            {isSaving ? 'Creating…' : 'Launch giveaway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Giveaway card
// ---------------------------------------------------------------------------
function GiveawayCard({ giveaway, user, myEntries, onEntered, onPickWinner, onRefresh }) {
  const { toast } = useToast();
  const [isEntering, setIsEntering] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const isMine = user?.email && giveaway.created_by === user.email;
  const isEntered = myEntries.has(giveaway.id);
  const expired = isExpired(giveaway);
  const ended = giveaway.status !== 'active' || expired;
  const winnerEmails = Array.isArray(giveaway.winner_emails)
    ? giveaway.winner_emails
    : [];
  const heroImage = giveaway.image_urls?.[0] || DEFAULT_GECKO_IMAGE;

  const handleEnter = async () => {
    if (!user?.email) return;
    setIsEntering(true);
    try {
      await GiveawayEntry.create({
        giveaway_id: giveaway.id,
        user_email: user.email,
        user_name: user.full_name || user.email,
      });
      captureEvent('giveaway_entered', {
        giveaway_id: giveaway.id,
        giveaway_title: giveaway.title,
        entry_method: giveaway.entry_method,
      });
      toast({ title: "You're entered!", description: giveaway.title });
      onEntered?.(giveaway.id);
    } catch (err) {
      toast({
        title: 'Could not enter',
        description: err.message,
        variant: 'destructive',
      });
    }
    setIsEntering(false);
  };

  const handlePickWinner = async () => {
    setIsPicking(true);
    try {
      const { data, error } = await supabase
        .from('giveaway_entries')
        .select('user_email, user_name')
        .eq('giveaway_id', giveaway.id);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({
          title: 'No entries yet',
          description: "Can't pick a winner until someone enters.",
          variant: 'destructive',
        });
        setIsPicking(false);
        return;
      }

      // Random winners (up to max_winners, without replacement)
      const pool = [...data];
      const winners = [];
      const count = Math.min(giveaway.max_winners || 1, pool.length);
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(idx, 1)[0]);
      }

      await Giveaway.update(giveaway.id, {
        status: 'ended',
        winner_emails: winners.map((w) => w.user_email),
      });

      toast({
        title: winners.length === 1 ? 'Winner picked!' : 'Winners picked!',
        description: winners.map((w) => w.user_name || w.user_email).join(', '),
      });
      onPickWinner?.(giveaway.id, winners);
      onRefresh?.();
    } catch (err) {
      toast({
        title: 'Pick failed',
        description: err.message,
        variant: 'destructive',
      });
    }
    setIsPicking(false);
  };

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/60 hover:border-emerald-500/40 transition-colors flex flex-col">
      {/* Hero image */}
      <div className="aspect-[16/10] bg-slate-800 relative">
        <img
          src={heroImage}
          alt={giveaway.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
          {ended ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur">
              <CheckCircle className="w-3 h-3" /> Ended
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 backdrop-blur">
              <Sparkles className="w-3 h-3" /> Active
            </span>
          )}
          {isMine && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-1 text-[11px] font-semibold text-purple-300 backdrop-blur">
              Your giveaway
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-3 flex-1 flex flex-col">
        <h3 className="text-lg font-bold text-white leading-tight line-clamp-2">
          {giveaway.title}
        </h3>
        {giveaway.description && (
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
            {giveaway.description}
          </p>
        )}

        <div className="flex flex-wrap gap-3 text-xs text-slate-400 pt-1">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Ends {formatDate(giveaway.end_date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            {giveaway.max_winners || 1} winner{(giveaway.max_winners || 1) > 1 ? 's' : ''}
          </span>
        </div>

        {giveaway.entry_instructions && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-slate-200">How to enter:</span>{' '}
            {giveaway.entry_instructions}
          </div>
        )}

        {ended && winnerEmails.length > 0 && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
            <span className="font-semibold text-emerald-100">Winner{winnerEmails.length > 1 ? 's' : ''}:</span>{' '}
            {winnerEmails.join(', ')}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          {!user ? (
            <Link to={createPageUrl('AuthPortal')} className="flex-1">
              <Button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                Sign in to enter
              </Button>
            </Link>
          ) : ended ? (
            <Button
              disabled
              className="flex-1 bg-slate-800 text-slate-500 cursor-not-allowed"
            >
              Ended
            </Button>
          ) : isEntered ? (
            <Button
              disabled
              className="flex-1 bg-slate-800 text-emerald-300 cursor-default"
            >
              <CheckCircle className="w-4 h-4 mr-2" /> Entered
            </Button>
          ) : giveaway.entry_method === 'external' && giveaway.entry_url ? (
            <a
              href={giveaway.entry_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                Enter externally
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
          ) : (
            <Button
              disabled={isEntering}
              onClick={handleEnter}
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold disabled:opacity-60"
            >
              {isEntering ? 'Entering…' : 'Enter giveaway'}
            </Button>
          )}

          {isMine && !ended && (
            <Button
              disabled={isPicking}
              onClick={handlePickWinner}
              variant="outline"
              className="bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900 border-white/40 font-semibold"
              title="Pick a random winner now"
            >
              {isPicking ? '…' : <Shuffle className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function Giveaways() {
  const { user, isAuthenticated } = useAuth();
  const [giveaways, setGiveaways] = useState([]);
  const [myEntries, setMyEntries] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [showCreate, setShowCreate] = useState(false);

  const loadGiveaways = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await Giveaway.filter({}, '-created_date', 200);
      setGiveaways(Array.isArray(all) ? all : []);
    } catch {
      setGiveaways([]);
    }
    setIsLoading(false);
  }, []);

  const loadMyEntries = useCallback(async () => {
    if (!user?.email) {
      setMyEntries(new Set());
      return;
    }
    try {
      const entries = await GiveawayEntry.filter({ user_email: user.email });
      setMyEntries(new Set((entries || []).map((e) => e.giveaway_id)));
    } catch {
      setMyEntries(new Set());
    }
  }, [user?.email]);

  useEffect(() => {
    loadGiveaways();
  }, [loadGiveaways]);

  useEffect(() => {
    loadMyEntries();
  }, [loadMyEntries]);

  const { activeGiveaways, endedGiveaways } = useMemo(() => {
    const active = [];
    const ended = [];
    for (const g of giveaways) {
      if (g.status !== 'active' || isExpired(g)) ended.push(g);
      else active.push(g);
    }
    return { activeGiveaways: active, endedGiveaways: ended };
  }, [giveaways]);

  const visible = filter === 'active' ? activeGiveaways : endedGiveaways;

  return (
    <>
      <Seo
        title="Crested Gecko Giveaways"
        description="Active and upcoming crested gecko giveaways hosted by breeders on Geck Inspect. Browse, enter, and track winners."
        path="/Giveaways"
        jsonLd={PAGE_JSON_LD}
      />

      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Top nav (public-facing so unauth visitors can browse) */}
        {!isAuthenticated && (
          <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <img src={LOGO_URL} alt="Geck Inspect" className="h-10 w-10 rounded-xl" />
              <span className="text-xl font-bold tracking-tight">Geck Inspect</span>
            </Link>
            <Link to={createPageUrl('AuthPortal')}>
              <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold">
                Sign In
              </Button>
            </Link>
          </header>
        )}

        <section className="max-w-6xl mx-auto px-6 pt-8 pb-12">
          {!isAuthenticated && (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 mb-6"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Geck Inspect
            </Link>
          )}

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
                <Gift className="w-3.5 h-3.5" />
                Giveaways
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-3 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
                Win a gecko.
              </h1>
              <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
                Crested gecko giveaways hosted by breeders on Geck Inspect. Enter directly on
                the site, through a social media link, or wherever the host chooses to run it.
              </p>
            </div>

            {isAuthenticated && (
              <Button
                size="lg"
                onClick={() => setShowCreate(true)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-lg shadow-emerald-500/30 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 mr-2" />
                Start a giveaway
              </Button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="inline-flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1 mb-6">
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                filter === 'active'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active ({activeGiveaways.length})
            </button>
            <button
              onClick={() => setFilter('ended')}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                filter === 'ended'
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ended ({endedGiveaways.length})
            </button>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse"
                />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <Gift className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 font-semibold mb-1">
                No {filter === 'active' ? 'active' : 'ended'} giveaways yet
              </p>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                {filter === 'active'
                  ? 'Be the first! If you have a gecko you want to give away, click "Start a giveaway" above.'
                  : 'Once giveaways end and winners are picked, they\u2019ll show up here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visible.map((g) => (
                <GiveawayCard
                  key={g.id}
                  giveaway={g}
                  user={user}
                  myEntries={myEntries}
                  onEntered={(id) => setMyEntries((prev) => new Set([...prev, id]))}
                  onPickWinner={loadGiveaways}
                  onRefresh={loadGiveaways}
                />
              ))}
            </div>
          )}
        </section>

        {/* Footer — only when unauth (auth layout provides its own) */}
        {!isAuthenticated && (
          <footer className="border-t border-slate-800/50 mt-8">
            <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
              <div className="flex items-center gap-3">
                <img src={LOGO_URL} alt="Geck Inspect" className="h-6 w-6 rounded" />
                <span>© {new Date().getFullYear()} Geck Inspect · geckOS</span>
              </div>
              <div className="flex items-center gap-5">
                <Link to="/" className="hover:text-slate-300">Home</Link>
                <Link to={createPageUrl('MorphGuide')} className="hover:text-slate-300">
                  Morph Guide
                </Link>
                <Link to={createPageUrl('AuthPortal')} className="hover:text-slate-300">
                  Sign in
                </Link>
              </div>
            </div>
          </footer>
        )}
      </div>

      {isAuthenticated && (
        <CreateGiveawayModal
          open={showCreate}
          onOpenChange={setShowCreate}
          user={user}
          onCreated={loadGiveaways}
        />
      )}
    </>
  );
}
