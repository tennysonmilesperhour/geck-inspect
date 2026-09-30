import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Globe2, Lightbulb, Loader2, Sparkles, Sunrise, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { User } from '@/entities/User';
import ListingCard from '@/components/market/ListingCard';
import {
  MARKET_NAMES,
  describeDayWord,
  describeFact,
  describeValue,
  formatUsd,
  loadMarketBrief,
  pctChange,
  shortDay,
  staleNote,
} from '@/lib/marketHabit';

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-100 mt-1">{value ?? 'n/a'}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function MorphRow({ m }) {
  const change = pctChange(m.p50, m.p50_before);
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-100">{m.trait}</p>
        <p className="text-[11px] text-slate-500">
          {m.for_sale ? `${m.for_sale} for sale at the ${shortDay(m.day)} check` : 'No full check yet'}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm text-slate-100">{m.p50 ? `Middle ${formatUsd(m.p50)}` : ''}</p>
        <p className="text-[11px] text-slate-500">
          {Number(m.new_listings) > 0 ? `${m.new_listings} new` : 'None new'}
          {change !== null && change !== 0 ? `, ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% in 3 to 6 weeks` : ''}
        </p>
      </div>
    </div>
  );
}

export default function MarketBriefPanel({ user }) {
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [briefOn, setBriefOn] = useState(user?.market_brief_enabled === true);
  const [savingSwitch, setSavingSwitch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await loadMarketBrief();
        if (!cancelled) setBrief(data);
      } catch (e) {
        if (!cancelled) setError(e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleBrief = async (checked) => {
    setSavingSwitch(true);
    setBriefOn(checked);
    try {
      await User.updateMyUserData({ market_brief_enabled: checked });
      toast({
        title: checked ? 'Morning brief on' : 'Morning brief off',
        description: checked
          ? 'You will get it on mornings with fresh news, by email and push if those are on in Settings.'
          : 'No more morning briefs. This page still updates every day.',
      });
    } catch (e) {
      setBriefOn(!checked);
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    }
    setSavingSwitch(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading today's market
      </div>
    );
  }
  if (error || !brief) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-200">
        The market brief could not load. Nothing is estimated in its place. Try again in a minute.
      </div>
    );
  }

  const us = brief.us || {};
  const stale = staleNote(us.day);
  const dayWord = describeDayWord(us);
  const value = describeValue(brief.value);
  const fact = describeFact(brief.fact);
  const newForYou = brief.new_for_you || [];
  const rare = brief.rare || [];
  const morphs = (brief.morphs || []).filter((m) => m.p50 || Number(m.new_listings) > 0);

  return (
    <div className="space-y-5">
      {stale && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-100">
            {stale} The US numbers below are from that check. Korea, Japan and Europe are checked daily.
          </p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-base flex items-center gap-2">
            <Sunrise className="w-4 h-4 text-amber-300" />
            {us.day ? `MorphMarket, ${shortDay(us.day)} check` : 'MorphMarket'}
          </CardTitle>
          {dayWord && <p className="text-sm text-slate-400">{dayWord}.</p>}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="New listings" value={us.new_listings} sub={us.new_low ? `${us.new_low} priced low for their kind` : null} />
            <Stat label="Price cuts" value={us.cuts} sub={us.cuts == null ? 'Counted on full checks' : (us.median_cut_pct ? `Typical cut ${Math.round(us.median_cut_pct * 100)}%` : null)} />
            <Stat label="Came down" value={us.came_down} sub={us.came_down == null ? 'Counted on full checks' : 'Sold or removed'} />
            <Stat label="For sale" value={us.for_sale ? us.for_sale.toLocaleString('en-US') : null} sub={us.p50 ? `Middle ask ${formatUsd(us.p50)}, ${shortDay(us.last_full_day)}` : null} />
          </div>
          <p className="text-[11px] text-slate-500 mt-3">
            Asking prices on listings, not sale prices. "Came down" means a listing disappeared: most sold, some were removed.
          </p>
        </CardContent>
      </Card>

      {value && (
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Wallet className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">{value.headline}</p>
              <p className="text-sm text-slate-400">{value.detail}</p>
              <p className="text-[11px] text-slate-500 mt-1">{value.note} From similar listings at each gecko's quality grade; your own asking prices are left out.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link to="/Portfolio">Portfolio</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {morphs.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-slate-100 text-base">Your morphs</CardTitle>
            <p className="text-xs text-slate-500">From the traits on your geckos and your watchlist.</p>
          </CardHeader>
          <CardContent>{morphs.map((m) => <MorphRow key={m.trait} m={m} />)}</CardContent>
        </Card>
      )}

      {newForYou.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-200 mb-2">New in your morphs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {newForYou.map((l) => <ListingCard key={l.listing_id} listing={l} />)}
          </div>
        </section>
      )}

      {rare.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-300" /> Rare sightings
          </h3>
          <p className="text-xs text-slate-500 mb-2">New listings with a morph that makes up under 2% of the market, or a Luwak (Cappuccino with Sable).</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {rare.map((l) => <ListingCard key={l.listing_id} listing={l} showBand={false} meta={l.combo || (l.rare_morphs || []).join(', ')} />)}
          </div>
        </section>
      )}

      {fact && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-sky-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs uppercase tracking-wider text-sky-300/80">Worth knowing</p>
            <p className="text-sm text-slate-100 mt-1">{fact}</p>
          </div>
        </div>
      )}

      {(brief.intl || []).length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-slate-100 text-base flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-400" /> Around the world
            </CardTitle>
            <p className="text-xs text-slate-500">Prices converted to US dollars. Shipping and import costs are not included.</p>
          </CardHeader>
          <CardContent>
            {(brief.intl || []).map((m) => (
              <div key={m.market} className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-100">{MARKET_NAMES[m.market] || m.market}</p>
                  <p className="text-[11px] text-slate-500">Checked {shortDay(m.day)}{m.for_sale ? `, ${m.for_sale.toLocaleString('en-US')} for sale` : ''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-100">{m.p50 ? `Middle ${formatUsd(m.p50)}` : ''}</p>
                  <p className="text-[11px] text-slate-500">
                    {[m.new_listings != null ? `${m.new_listings} new` : null,
                      m.cuts != null ? `${m.cuts} cuts` : null,
                      m.came_down != null ? `${m.came_down} came down` : null].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Label htmlFor="market-brief-switch" className="text-sm font-semibold text-slate-100">Send me this each morning</Label>
          <p className="text-xs text-slate-500 mt-0.5">Only on mornings with news for you: new listings in your morphs, rare sightings, watchlist matches or a real move in your geckos' value.</p>
        </div>
        <Switch id="market-brief-switch" checked={briefOn} disabled={savingSwitch} onCheckedChange={toggleBrief} />
      </div>
    </div>
  );
}
