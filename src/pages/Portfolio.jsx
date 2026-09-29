/**
 * Collection Portfolio.
 *
 * Treats a breeder's collection as the asset it is: "your collection is
 * worth $X and here's the trend."
 *
 * Valuation model
 * ---------------
 * Per non-archived gecko, value = first available of:
 *   1. listing_price                       basis: 'listing'
 *   2. asking_price                        basis: 'asking'
 *   3. market_price_estimate.average       basis: 'ai_estimate'
 *   4. Geck Data trait value table: the gecko's selected morph traits
 *      (morph_tags, or the free-text morphs_traits field) are matched
 *      against public.trait_value_table(), which holds asking-price
 *      bands per crested trait from Geck Data listings, split by age
 *      and sex. The most valuable matched trait sets the price, and the
 *      quality tier picks a point in its band (pet p25, breeder median,
 *      high-end halfway to p75, investment p75). See
 *      src/lib/traitValuation.js.           basis: 'geck_data'
 *   5. Morph comp (legacy fallback): the highest community average price from
 *      morph_price_cache among the gecko's canonicalized, visual
 *      (non-het) morph_tags. A Lilly White Dalmatian is priced off the
 *      Lilly White comp because the premium trait drives the sale price.
 *      The comp is then scaled by a quality tier multiplier:
 *        investment 1.5x, high_end 1.25x, breeder 1.0x, pet 0.6x
 *      Tier comes from pattern_grade, or is derived from quality_score
 *      via patternGradeForScore. These multipliers are heuristics v1,
 *      chosen to mirror how grade spreads show up in community sale
 *      data (an investment-grade Axanthic sells well above the morph
 *      average), not fitted constants. Revisit once morph_price_entries
 *      has enough per-grade volume.   basis: 'morph_comp'
 *   6. Nothing matched: value 0.       basis: 'unpriced'
 *
 * Every animal carries { value, basis } so the UI can say where each
 * number came from. Estimates are market comps, not appraisals.
 *
 * Snapshots: on load, if no collection_valuations row exists for today,
 * one is written silently (failure is caught and ignored) so the trend
 * chart accrues history just by the breeder visiting the page.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Wallet, TrendingUp, TrendingDown, Minus, PiggyBank, Hash, Scale, Info, PlusCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { getVisibleGeckos } from '@/lib/geckoAccess';
import { valueFromTraitTable, qualityTierFor } from '@/lib/traitValuation';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { CollectionValuation, MorphPriceCache } from '@/api/supabaseEntities';
import { canonicalizeMorphTag } from '@/lib/genetics';
import { createPageUrl } from '@/utils';
import Seo from '@/components/seo/Seo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import SignInRequired from '@/components/shared/SignInRequired';

// Heuristics v1: quality tier multipliers applied to the morph comp
// average. Documented in the file header; keep these in sync with it.
const TIER_MULTIPLIERS = {
  investment: 1.5,
  high_end: 1.25,
  breeder: 1.0,
  pet: 0.6,
};

const HET_PREFIX = /^(possible\s+het|pos\s+het|p\.?\s*het|het)\s+/i;

const BASIS_META = {
  listing: { label: 'Listing price', className: 'bg-emerald-900/40 border-emerald-700 text-emerald-200' },
  asking: { label: 'Asking price', className: 'bg-sky-900/40 border-sky-700 text-sky-200' },
  ai_estimate: { label: 'AI estimate', className: 'bg-amber-900/40 border-amber-700 text-amber-200' },
  geck_data: { label: 'Geck Data', className: 'bg-teal-900/40 border-teal-700 text-teal-200' },
  morph_comp: { label: 'Morph comp', className: 'bg-slate-800/60 border-slate-600 text-slate-200' },
  unpriced: { label: 'No data', className: 'bg-slate-900/60 border-slate-700 text-slate-500' },
};

function formatCurrency(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** market_price_estimate is jsonb {low, high, average}; tolerate strings. */
function estimateAverage(gecko) {
  let est = gecko.market_price_estimate;
  if (!est) return null;
  if (typeof est === 'string') {
    try { est = JSON.parse(est); } catch { return null; }
  }
  return toNumber(est.average);
}

/**
 * Build a lookup of canonical morph name (lowercase) to the community
 * average price from morph_price_cache rows.
 */
function buildMorphAverages(cacheRows) {
  const acc = new Map();
  for (const row of cacheRows || []) {
    const name = canonicalizeMorphTag(row.morph_name);
    const price = toNumber(row.price) || toNumber(row.average_price) || toNumber(row.min_price);
    if (!name || !price) continue;
    const key = name.toLowerCase();
    const cur = acc.get(key) || { sum: 0, count: 0, name };
    cur.sum += price;
    cur.count += 1;
    acc.set(key, cur);
  }
  const out = new Map();
  for (const [key, { sum, count, name }] of acc) {
    out.set(key, { average: sum / count, name });
  }
  return out;
}

/** Visual (non-het) canonical morph tags for a gecko. */
function visualMorphs(gecko) {
  const tags = Array.isArray(gecko.morph_tags) ? gecko.morph_tags : [];
  return tags
    .filter((t) => typeof t === 'string' && t.trim() && !HET_PREFIX.test(t.trim()))
    .map((t) => canonicalizeMorphTag(t))
    .filter(Boolean);
}

/** Value one gecko per the model documented at the top of this file. */
function valueGecko(gecko, morphAverages, traitIndex) {
  const listing = toNumber(gecko.listing_price);
  if (listing) return { value: listing, basis: 'listing', drivingMorph: visualMorphs(gecko)[0] || null };

  const asking = toNumber(gecko.asking_price);
  if (asking) return { value: asking, basis: 'asking', drivingMorph: visualMorphs(gecko)[0] || null };

  const aiAvg = estimateAverage(gecko);
  if (aiAvg) return { value: aiAvg, basis: 'ai_estimate', drivingMorph: visualMorphs(gecko)[0] || null };

  // Geck Data trait value table: cross-reference the selected traits.
  const fromTraits = valueFromTraitTable(gecko, traitIndex, qualityTierFor(gecko));
  if (fromTraits) {
    return { ...fromTraits, basis: 'geck_data', drivingMorph: fromTraits.trait };
  }

  // Morph comp: best matching community average among visual morphs.
  let best = null;
  for (const morph of visualMorphs(gecko)) {
    const hit = morphAverages.get(morph.toLowerCase());
    if (hit && (!best || hit.average > best.average)) best = hit;
  }
  if (best) {
    const tier = qualityTierFor(gecko);
    const multiplier = TIER_MULTIPLIERS[tier] ?? 1.0;
    return {
      value: best.average * multiplier,
      basis: 'morph_comp',
      drivingMorph: best.name,
      compMorph: best.name,
      compAverage: best.average,
      tier,
      multiplier,
    };
  }

  return { value: 0, basis: 'unpriced', drivingMorph: visualMorphs(gecko)[0] || null };
}

function BasisChip({ valuation }) {
  const meta = BASIS_META[valuation.basis] || BASIS_META.unpriced;
  let title = meta.label;
  if (valuation.basis === 'morph_comp') {
    title = `${valuation.compMorph} community average ${formatCurrency(valuation.compAverage)} x ${valuation.multiplier} (${valuation.tier.replace('_', ' ')} tier)`;
  } else if (valuation.basis === 'geck_data') {
    const { band } = valuation;
    title = `${valuation.trait}, ${valuation.levelLabel}: median ${formatCurrency(band.p50)}, typical ${formatCurrency(band.p25)} to ${formatCurrency(band.p75)} across ${band.n} Geck Data listings. `
      + `${valuation.tier.replace('_', ' ')} grade priced at ${valuation.positionLabel}.`;
    if (valuation.matchedTraits.length > 1) {
      title += ` Matched traits: ${valuation.matchedTraits.join(', ')}.`;
    }
  } else if (valuation.basis === 'unpriced') {
    title = 'None of this gecko\'s traits matched the Geck Data value table. Add traits like Lilly White or Harlequin to get an estimate.';
  }
  return (
    <Badge variant="outline" className={`text-xs whitespace-nowrap ${meta.className}`} title={title}>
      {meta.label}
    </Badge>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card>
      <CardContent className="p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-emerald-400" />
          <span className="text-xs uppercase tracking-wider text-slate-500">{label}</span>
        </div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Portfolio() {
  const { user, isLoadingAuth } = useAuth();
  const [geckos, setGeckos] = useState([]);
  const [morphAverages, setMorphAverages] = useState(new Map());
  const [traitIndex, setTraitIndex] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const snapshotAttempted = useRef(false);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user?.email) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [geckoRes, cacheRes, snapRes, traitRes] = await Promise.allSettled([
        getVisibleGeckos(user, {}, '-created_date', 1000),
        MorphPriceCache.filter({}, '-created_date', 1000),
        CollectionValuation.filter({ created_by: user.email }, 'snapshot_date', 365),
        loadTraitValueIndex(),
      ]);
      if (cancelled) return;
      const all = geckoRes.status === 'fulfilled' ? geckoRes.value : [];
      setGeckos(all.filter((g) => !g.archived));
      setMorphAverages(buildMorphAverages(cacheRes.status === 'fulfilled' ? cacheRes.value : []));
      // null marks a failed load so the snapshot below does not record a
      // collection value that is missing its market estimates.
      setTraitIndex(traitRes.status === 'fulfilled' ? traitRes.value : null);
      setSnapshots(snapRes.status === 'fulfilled' ? snapRes.value : []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, isLoadingAuth]);

  const portfolio = useMemo(() => {
    const animals = geckos.map((g) => ({ gecko: g, valuation: valueGecko(g, morphAverages, traitIndex) }));
    animals.sort((a, b) => b.valuation.value - a.valuation.value);
    const total = animals.reduce((s, a) => s + a.valuation.value, 0);
    const pricedCount = animals.filter((a) => a.valuation.basis !== 'unpriced').length;
    return { animals, total, pricedCount, avg: animals.length > 0 ? total / animals.length : 0 };
  }, [geckos, morphAverages, traitIndex]);

  // Write today's snapshot once per visit if one doesn't already exist.
  // Silent on purpose: a failed snapshot should never break the page.
  // Skipped when the trait table failed to load, so an outage does not
  // show up in the trend line as a crash in collection value.
  useEffect(() => {
    if (loading || snapshotAttempted.current || !user?.email || geckos.length === 0 || !traitIndex) return;
    snapshotAttempted.current = true;
    const today = format(new Date(), 'yyyy-MM-dd');
    const hasToday = snapshots.some((s) => (s.snapshot_date || '').slice(0, 10) === today);
    if (hasToday) return;
    (async () => {
      try {
        const created = await CollectionValuation.create({
          snapshot_date: today,
          total_value: Math.round(portfolio.total * 100) / 100,
          animal_valuations: portfolio.animals.map(({ gecko, valuation }) => ({
            gecko_id: gecko.id,
            name: gecko.name,
            value: Math.round(valuation.value * 100) / 100,
            basis: valuation.basis,
          })),
        });
        setSnapshots((prev) => [...prev, created]);
      } catch {
        // Ignore: snapshots are a nice-to-have, never a blocker.
      }
    })();
  }, [loading, user, geckos, snapshots, portfolio, traitIndex]);

  const trend = useMemo(() => {
    const byDate = new Map();
    for (const s of snapshots) {
      const date = (s.snapshot_date || '').slice(0, 10);
      if (date) byDate.set(date, toNumber(s.total_value) ?? 0);
    }
    const points = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
    let delta = null;
    if (points.length >= 2) {
      const prev = points[points.length - 2].value;
      const last = points[points.length - 1].value;
      delta = { amount: last - prev, pct: prev > 0 ? ((last - prev) / prev) * 100 : null };
    }
    return { points, delta };
  }, [snapshots]);

  const morphBreakdown = useMemo(() => {
    const groups = new Map();
    for (const { valuation } of portfolio.animals) {
      if (valuation.value <= 0) continue;
      const key = valuation.drivingMorph || 'Unspecified morph';
      const cur = groups.get(key) || { morph: key, total: 0, count: 0 };
      cur.total += valuation.value;
      cur.count += 1;
      groups.set(key, cur);
    }
    return [...groups.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [portfolio]);

  const seo = (
    <Seo
      title="Collection Portfolio"
      description="See what your crested gecko collection is worth, track the trend over time, and see which morphs drive the value."
      path="/Portfolio"
      noIndex
      keywords={['gecko collection value', 'crested gecko prices', 'collection portfolio']}
    />
  );

  const header = (
    <PageHeader
      icon={Wallet}
      title="Collection Portfolio"
      description={
        <>
          <Info className="inline-block w-3.5 h-3.5 mr-1.5 align-[-0.125em]" aria-hidden="true" />
          Values are estimates from Geck Data market listings and your own listed prices, not formal appraisals.
        </>
      }
    />
  );

  if (loading || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        {seo}
        <div className="max-w-6xl mx-auto space-y-4">
          {[90, 140, 320].map((h, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-slate-900" style={{ height: h }} />
          ))}
        </div>
      </div>
    );
  }

  if (!user?.email) {
    return (
      <>
        {seo}
        <SignInRequired
          icon={Wallet}
          title="Collection Portfolio"
          description="Sign in to see what your collection is worth and how it trends over time."
        />
      </>
    );
  }

  if (geckos.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        {seo}
        <div className="max-w-6xl mx-auto">
          {header}
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-16 text-center">
            <PiggyBank className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-100">No animals to value yet</h2>
            <p className="text-slate-400 mt-2 max-w-2xl mx-auto">
              Add geckos to your collection and the portfolio will estimate what each one is worth.
              Premium morphs like Lilly White and Axanthic tend to drive most of a collection&apos;s value.
            </p>
            <Button asChild className="mt-4">
              <Link to={createPageUrl('MyGeckos')}>
                <PlusCircle className="w-4 h-4" /> Add your first gecko
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const DeltaIcon = trend.delta
    ? (trend.delta.amount > 0 ? TrendingUp : trend.delta.amount < 0 ? TrendingDown : Minus)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      {seo}
      <div className="max-w-6xl mx-auto space-y-6">
        {header}

        {/* Hero stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={Wallet}
            label="Estimated value"
            value={formatCurrency(portfolio.total)}
            sub={trend.delta && DeltaIcon ? (
              <span className="inline-flex items-center gap-1">
                <DeltaIcon className={`w-3 h-3 ${trend.delta.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                {trend.delta.amount >= 0 ? '+' : ''}{formatCurrency(trend.delta.amount)}
                {trend.delta.pct != null ? ` (${trend.delta.pct >= 0 ? '+' : ''}${trend.delta.pct.toFixed(1)}%)` : ''} since last snapshot
              </span>
            ) : 'First snapshot recorded today'}
          />
          <StatCard
            icon={Hash}
            label="Animals"
            value={String(geckos.length)}
            sub={`${portfolio.pricedCount} with a value basis`}
          />
          <StatCard
            icon={Scale}
            label="Average per animal"
            value={formatCurrency(portfolio.avg)}
          />
        </div>

        {/* Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-100">Value over time</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.points.length >= 2 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend.points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="portfolioValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.5)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(d) => format(new Date(`${d}T00:00:00`), 'MMM d')}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                      labelStyle={{ color: '#cbd5e1' }}
                      labelFormatter={(d) => format(new Date(`${d}T00:00:00`), 'MMM d, yyyy')}
                      formatter={(v) => [formatCurrency(v), 'Collection value']}
                    />
                    <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#portfolioValue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-10 text-center">
                <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-300 font-medium">First snapshot recorded today</p>
                <p className="text-sm text-slate-500 mt-1">
                  Come back after your next visit and the trend line starts here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top value-driving morphs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-100">Top value-driving morphs</CardTitle>
          </CardHeader>
          <CardContent>
            {morphBreakdown.length > 0 ? (
              <div className="space-y-3">
                {morphBreakdown.map((row) => {
                  const max = morphBreakdown[0].total || 1;
                  return (
                    <div key={row.morph}>
                      <div className="flex items-baseline justify-between text-sm mb-1">
                        <span className="text-slate-200 font-medium">{row.morph}</span>
                        <span className="text-slate-400">
                          {formatCurrency(row.total)} <span className="text-slate-500">({row.count} {row.count === 1 ? 'animal' : 'animals'})</span>
                        </span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                          style={{ width: `${Math.max(4, (row.total / max) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">
                No valued animals yet. Add morph traits like Lilly White or Axanthic to your geckos and the Geck Data estimates will fill this in.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Per-animal table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-100">Per-animal valuation</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Animal', 'Morphs', 'Value', 'Basis'].map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs uppercase tracking-wider text-slate-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.animals.map(({ gecko, valuation }) => {
                  const photo = Array.isArray(gecko.image_urls) && gecko.image_urls.length > 0 ? gecko.image_urls[0] : null;
                  const morphs = visualMorphs(gecko);
                  return (
                    <tr key={gecko.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                      <td className="py-2.5 px-3">
                        <Link to={createPageUrl(`GeckoDetail?id=${gecko.id}`)} className="touch:min-h-11 flex items-center gap-3 group">
                          {photo ? (
                            <img src={photo} alt={gecko.name || 'Gecko'} className="w-10 h-10 shrink-0 rounded-lg object-cover bg-slate-800" />
                          ) : (
                            <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-800 flex items-center justify-center text-slate-600 text-xs font-bold">
                              {(gecko.name || '?').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-slate-100 font-medium group-hover:text-emerald-400">{gecko.name || 'Unnamed'}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {morphs.length > 0 ? morphs.slice(0, 3).join(', ') + (morphs.length > 3 ? ` +${morphs.length - 3}` : '') : (gecko.morphs_traits || 'Not tagged')}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-100">
                        {valuation.value > 0 ? formatCurrency(valuation.value) : <span className="text-slate-500">$0</span>}
                        {valuation.basis === 'geck_data' && (
                          <span className="block text-xs font-normal text-slate-500 whitespace-nowrap">
                            {valuation.trait}: {formatCurrency(valuation.band.p25)} to {formatCurrency(valuation.band.p75)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3"><BasisChip valuation={valuation} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-slate-500 mt-3">
              Geck Data estimates match each gecko&apos;s morph traits against asking prices on crested gecko listings,
              narrowed to the same age and sex when there are enough listings. The most valuable trait sets the price:
              pet grade at the low end of the typical range, breeder grade at the median, high-end and investment grade toward the top.
              Set a listing or asking price on a gecko to override the estimate.
            </p>
            {!traitIndex && (
              <p className="text-xs text-amber-400/80 mt-2">
                The Geck Data value table did not load, so trait-based estimates are missing. Refresh to try again.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
