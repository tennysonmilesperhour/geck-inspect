import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Crown, Loader2, Search, Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { User } from '@/entities/User';
import ListingCard from '@/components/market/ListingCard';
import { createPageUrl } from '@/utils';
import { findStores, formatUsd, loadSellerView, sexAgeLabel, shortDay, storeSlugFromUrl } from '@/lib/marketHabit';

function UpgradeCard() {
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3 flex-wrap">
      <Crown className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-[12rem]">
        <p className="text-sm font-semibold text-emerald-100">Your listings against the market is part of the Breeder plan</p>
        <p className="text-xs text-emerald-200/70 mt-1">
          See where each of your MorphMarket listings sits against similar crested geckos, how long each one has
          been up, and when another breeder lists a similar gecko for less.
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="bg-emerald-950/40 text-emerald-100 hover:bg-emerald-900/60 border-emerald-500/40">
        <Link to={createPageUrl('Membership')}>
          See Breeder <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Link>
      </Button>
    </div>
  );
}

function StoreLinkForm({ onSaved, onCancel }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const slugFromLink = storeSlugFromUrl(text);

  useEffect(() => {
    const q = text.trim();
    if (slugFromLink || q.length < 2) {
      setResults([]);
      return undefined;
    }
    let cancelled = false;
    const id = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await findStores(q);
        if (!cancelled) setResults(rows || []);
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) setSearching(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
  }, [text, slugFromLink]);

  const save = async (slug) => {
    setSaving(true);
    try {
      await User.updateMyUserData({ morphmarket_url: `https://www.morphmarket.com/stores/${slug}/` });
      onSaved();
    } catch (e) {
      toast({ title: 'Could not save your store', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Store className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-100">Link your MorphMarket store</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste your store link, or search for your store by name. It also becomes the MorphMarket link on your profile.
            </p>
          </div>
        </div>
        <div>
          <Label htmlFor="store-link" className="sr-only">Store link or name</Label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              id="store-link"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://www.morphmarket.com/stores/yourstore/"
              className="pl-9 bg-slate-800 border-slate-600"
            />
          </div>
        </div>
        {slugFromLink && (
          <Button onClick={() => save(slugFromLink)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Use store &ldquo;{slugFromLink}&rdquo;
          </Button>
        )}
        {searching && <p className="text-xs text-slate-500">Searching</p>}
        {results.length > 0 && (
          <div className="rounded-lg border border-slate-800">
            {results.map((r) => (
              <button
                key={r.seller_slug}
                type="button"
                disabled={saving}
                onClick={() => save(r.seller_slug)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-800 last:border-0 text-left hover:bg-slate-900"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-slate-100 truncate">{r.name || r.seller_slug}</span>
                  <span className="block text-[11px] text-slate-500 truncate">{[r.seller_slug, r.location].filter(Boolean).join(', ')}</span>
                </span>
                <span className="text-[11px] text-slate-400 shrink-0">{Number(r.for_sale) || 0} for sale</span>
              </button>
            ))}
          </div>
        )}
        {!searching && !slugFromLink && text.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs text-slate-500">No store by that name in the latest MorphMarket check. Try pasting the link.</p>
        )}
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        )}
      </CardContent>
    </Card>
  );
}

function RivalNote({ l }) {
  const since = Number(l.under_since_yesterday) || 0;
  const week = Number(l.under_7d) || 0;
  if (!week) return null;
  const kind = [sexAgeLabel(l.sex_class, l.age_class).toLowerCase(), l.compared_trait].filter(Boolean).join(' ');
  return (
    <div className="rounded-b-xl border border-t-0 border-slate-800 bg-slate-950/60 px-3 py-2 -mt-1">
      <p className="text-[11px] text-amber-200">
        {since > 0
          ? `${since} similar ${kind || 'gecko'} ${since === 1 ? 'listing' : 'listings'} for less since yesterday, ${week} this week.`
          : `${week} similar ${kind || 'gecko'} ${week === 1 ? 'listing' : 'listings'} for less this week.`}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {(l.cheapest_new || []).map((r) => (
          <a
            key={r.listing_id}
            href={r.listing_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-slate-400 hover:text-emerald-300 underline-offset-2 hover:underline"
          >
            {formatUsd(r.price)} {r.title ? `(${r.title.slice(0, 40)})` : ''}
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * The seller view: a Breeder plan member's own MorphMarket listings with
 * where each price sits among similar geckos, how long it has been up,
 * and cheaper similar listings from other breeders. The database checks
 * the plan; this panel only shows what it returns.
 */
export default function SellerPanel() {
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [changing, setChanging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setView(await loadSellerView());
    } catch (e) {
      setError(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your listings
      </div>
    );
  }
  if (error || !view) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
        Your listings could not load. Try again in a minute.
      </div>
    );
  }
  if (view.allowed === false) return <UpgradeCard />;
  if (!view.slug || changing) {
    return (
      <StoreLinkForm
        onSaved={() => { setChanging(false); load(); }}
        onCancel={view.slug ? () => setChanging(false) : null}
      />
    );
  }

  const store = view.store || {};
  const listings = view.listings || [];
  const high = listings.filter((l) => l.price_position === 'high').length;
  const undercut = listings.filter((l) => Number(l.under_since_yesterday) > 0).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-400" /> {store.name || view.slug}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {[store.location, `${listings.length} crested geckos for sale`, view.as_of ? `checked ${shortDay(view.as_of)}` : null]
                .filter(Boolean).join(', ')}
            </p>
            {listings.length > 0 && (
              <p className="text-sm text-slate-300 mt-2">
                {high} priced high for their kind.{' '}
                {undercut > 0
                  ? `${undercut} ${undercut === 1 ? 'has' : 'have'} a cheaper similar gecko listed since yesterday.`
                  : 'No cheaper similar geckos listed since yesterday.'}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setChanging(true)}>Change store</Button>
        </CardContent>
      </Card>

      {listings.length === 0 ? (
        <p className="text-sm text-slate-400">
          No crested gecko listings from {view.slug} in the latest MorphMarket check. If the store link is wrong, change it above.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {listings.map((l) => (
            <div key={l.listing_id}>
              <ListingCard
                listing={l}
                meta={Number.isFinite(Number(l.days_listed)) ? `Listed ${l.days_listed} ${Number(l.days_listed) === 1 ? 'day' : 'days'}` : null}
              />
              <RivalNote l={l} />
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        Compared with similar crested geckos for sale on MorphMarket (same main morph, age and sex where there are enough).
        Asking prices, not sale prices.
      </p>
    </div>
  );
}
