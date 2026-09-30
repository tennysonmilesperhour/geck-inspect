import { useEffect, useMemo, useState } from 'react';
import { BellRing, Loader2, Pause, Play, Plus, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import ListingCard from '@/components/market/ListingCard';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import {
  formatUsd,
  loadWatchMatches,
  loadWatchlist,
  removeWatch,
  saveWatch,
  setWatchActive,
  timeAgo,
} from '@/lib/marketHabit';

function describeQuery(q = {}) {
  const parts = [];
  if (Array.isArray(q.trait_all) && q.trait_all.length) parts.push(q.trait_all.join(' + '));
  else parts.push('Any crested gecko');
  if (q.sex) parts.push(q.sex);
  if (q.min_price) parts.push(`from ${formatUsd(q.min_price)}`);
  if (q.max_price) parts.push(`under ${formatUsd(q.max_price)}`);
  if (q.must_be_drop) parts.push('price cuts only');
  if (Array.isArray(q.seller_ids) && q.seller_ids.length) parts.push(`from ${q.seller_ids.join(', ')}`);
  return parts.join(', ');
}

function WatchForm({ morphOptions, onSaved }) {
  const [traits, setTraits] = useState([]);
  const [pick, setPick] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [sex, setSex] = useState('any');
  const [cutsOnly, setCutsOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  const addTrait = (name) => {
    if (!name || traits.includes(name) || traits.length >= 6) return;
    setTraits([...traits, name]);
    setPick('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveWatch({
        traits,
        maxPrice: maxPrice ? Number(maxPrice) : null,
        minPrice: minPrice ? Number(minPrice) : null,
        sex: sex === 'any' ? null : sex,
        cutsOnly,
      });
      toast({ title: 'Watch saved', description: 'You will hear about matching listings after each market check.' });
      setTraits([]); setMaxPrice(''); setMinPrice(''); setSex('any'); setCutsOnly(false);
      onSaved();
    } catch (err) {
      toast({ title: 'Could not save the watch', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label className="text-slate-300">Morphs (all must match)</Label>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {traits.map((t) => (
            <Badge key={t} variant="outline" className="border-emerald-600 text-emerald-200 gap-1">
              {t}
              <button type="button" onClick={() => setTraits(traits.filter((x) => x !== t))} className="touch-hit" aria-label={`Remove ${t}`}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Select value={pick} onValueChange={addTrait}>
          <SelectTrigger className="mt-2 bg-slate-800 border-slate-600">
            <SelectValue placeholder={traits.length >= 6 ? 'Up to 6 morphs' : 'Add a morph, like Lilly White or Axanthic'} />
          </SelectTrigger>
          <SelectContent>
            {morphOptions.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <Label htmlFor="watch-max" className="text-slate-300">Max price (USD)</Label>
          <Input id="watch-max" type="number" min="1" inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="500" className="mt-1.5 bg-slate-800 border-slate-600" />
        </div>
        <div>
          <Label htmlFor="watch-min" className="text-slate-300">Min price (optional)</Label>
          <Input id="watch-min" type="number" min="0" inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" className="mt-1.5 bg-slate-800 border-slate-600" />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Label className="text-slate-300">Sex</Label>
          <Select value={sex} onValueChange={setSex}>
            <SelectTrigger className="mt-1.5 bg-slate-800 border-slate-600"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="unsexed">Unsexed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="watch-cuts" className="text-slate-300">Only price cuts</Label>
          <p className="text-xs text-slate-500">Tell me when a matching listing drops its price, not when one is listed.</p>
        </div>
        <Switch id="watch-cuts" checked={cutsOnly} onCheckedChange={setCutsOnly} />
      </div>
      <Button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        Save watch
      </Button>
    </form>
  );
}

/**
 * The member's market watches and what they caught. A watch fires after
 * each market check on new listings (or price cuts) that match, and
 * arrives in the bell, by email and by push, per the member's settings.
 */
export default function WatchlistPanel() {
  const [watches, setWatches] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [morphOptions, setMorphOptions] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [w, m] = await Promise.all([loadWatchlist(), loadWatchMatches(30)]);
      setWatches(w || []);
      setMatches(m || []);
      if (!(w || []).length) setShowForm(true);
    } catch (e) {
      toast({ title: 'Could not load your watchlist', description: e.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadTraitValueIndex()
      .then((index) => {
        const names = [...index.traits.values()]
          .sort((a, b) => (b.n || 0) - (a.n || 0))
          .map((t) => t.name);
        setMorphOptions(names);
      })
      .catch(() => setMorphOptions([]));
  }, []);

  const active = useMemo(() => watches.filter((w) => w.active).length, [watches]);

  const toggle = async (w) => {
    try {
      await setWatchActive(w.id, !w.active);
      setWatches((prev) => prev.map((x) => (x.id === w.id ? { ...x, active: !w.active } : x)));
    } catch (e) {
      toast({ title: 'Could not update the watch', description: e.message, variant: 'destructive' });
    }
  };

  const remove = async (w) => {
    try {
      await removeWatch(w.id);
      setWatches((prev) => prev.filter((x) => x.id !== w.id));
    } catch (e) {
      toast({ title: 'Could not remove the watch', description: e.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your watchlist
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <BellRing className="w-4 h-4 text-emerald-400" /> Your watches
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              {active} active. Matches arrive after each market check, in the bell and by email or push per your settings.
            </p>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white">
              <Plus className="w-4 h-4" /> New watch
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              <WatchForm morphOptions={morphOptions} onSaved={() => { setShowForm(false); load(); }} />
            </div>
          )}
          {watches.length === 0 && !showForm && (
            <p className="text-sm text-slate-400">No watches yet.</p>
          )}
          {watches.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${w.active ? 'text-slate-100' : 'text-slate-500'}`}>{describeQuery(w.query)}</p>
                <p className="text-[11px] text-slate-500">
                  {Number(w.matches_7d) > 0 ? `${w.matches_7d} matches this week` : 'No matches this week'}
                  {w.last_match_at ? `, last ${timeAgo(w.last_match_at)}` : ''}
                  {!w.active ? ', paused' : ''}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" className="h-8 touch:min-w-11" onClick={() => toggle(w)} aria-label={w.active ? 'Pause watch' : 'Resume watch'}>
                  {w.active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </Button>
                <Button size="sm" variant="outline" className="h-8 touch:min-w-11" onClick={() => remove(w)} aria-label="Remove watch">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section>
        <h3 className="text-sm font-semibold text-slate-200 mb-2">Recent matches</h3>
        {matches.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nothing yet. Matches show here after the next market check that finds a fit.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {matches.map((m) => (
              <ListingCard
                key={m.match_id}
                listing={m}
                meta={`${m.trigger === 'cut' ? 'Price cut' : 'New'}, ${timeAgo(m.matched_at)}${m.for_sale === false ? ', no longer listed' : ''}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
