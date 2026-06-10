/**
 * Collection Portfolio.
 *
 * Treats a breeder's collection as the asset it is: "your collection is
 * worth $X and here's the trend."
 *
 * Valuation model (heuristics v1)
 * -------------------------------
 * Per non-archived gecko, value = first available of:
 *   1. listing_price                       basis: 'listing'
 *   2. asking_price                        basis: 'asking'
 *   3. market_price_estimate.average       basis: 'ai_estimate'
 *   4. Morph comp: the highest community average price from
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
 *   5. Nothing matched: value 0.       basis: 'unpriced'
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
import { CollectionValuation, MorphPriceCache } from '@/api/supabaseEntities';
import { canonicalizeMorphTag } from '@/lib/genetics';
import { patternGradeForScore } from '@/lib/quality';
import { createPageUrl } from '@/utils';
import Seo from '@/components/seo/Seo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

function qualityTier(gecko) {
  if (gecko.pattern_grade && TIER_MULTIPLIERS[gecko.pattern_grade] != null) {
    return gecko.pattern_grade;
  }
  return patternGradeForScore(gecko.quality_score) || 'breeder';
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
function valueGecko(gecko, morphAverages) {
  const listing = toNumber(gecko.listing_price);
  if (listing) return { value: listing, basis: 'listing', drivingMorph: visualMorphs(gecko)[0] || null };

  const asking = toNumber(gecko.asking_price);
  if (asking) return { value: asking, basis: 'asking', drivingMorph: visualMorphs(gecko)[0] || null };

  const aiAvg = estimateAverage(gecko);
  if (aiAvg) return { value: aiAvg, basis: 'ai_estimate', drivingMorph: visualMorphs(gecko)[0] || null };

  // Morph comp: best matching community average among visual morphs.
  let best = null;
  for (const morph of visualMorphs(gecko)) {
    const hit = morphAverages.get(morph.toLowerCase());
    if (hit && (!best || hit.average > best.average)) best = hit;
  }
  if (best) {
    const tier = qualityTier(gecko);
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
  const title = valuation.basis === 'morph_comp'
    ? `${valuation.compMorph} community average ${formatCurrency(valuation.compAverage)} x ${valuation.multiplier} (${valuation.tier.replace('_', ' ')} tier)`
    : meta.label;
  return (
    <Badge variant="outline" className={`text-xs whitespace-nowrap ${meta.className}`} title={title}>
      {meta.label}
    </Badge>
  );
}

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-5">
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
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const snapshotAttempted = useRef(false);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user?.email) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [geckoRes, cacheRes, snapRes] = await Promise.allSettled([
        getVisibleGeckos(user, {}, '-created_date', 1000),
        MorphPriceCache.filter({}, '-created_date', 1000),
        CollectionValuation.filter({ created_by: user.email }, 'snapshot_date', 365),
      ]);
      if (cancelled) return;
      const all = geckoRes.status === 'fulfilled' ? geckoRes.value : [];
      setGeckos(all.filter((g) => !g.archived));
      setMorphAverages(buildMorphAverages(cacheRes.status === 'fulfilled' ? cacheRes.value : []));
      setSnapshots(snapRes.status === 'fulfilled' ? snapRes.value : []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user, isLoadingAuth]);

  const portfolio = useMemo(() => {
    const animals = geckos.map((g) => ({ gecko: g, valuation: valueGecko(g, morphAverages) }));
    animals.sort((a, b) => b.valuation.value - a.valuation.value);
    const total = animals.reduce((s, a) => s + a.valuation.value, 0);
    const pricedCount = animals.filter((a) => a.valuation.basis !== 'unpriced').length;
    return { animals, total, pricedCount, avg: animals.length > 0 ? total / animals.length : 0 };
  }, [geckos, morphAverages]);

  // Write today's snapshot once per visit if one doesn't already exist.
  // Silent on purpose: a failed snapshot should never break the page.
  useEffect(() => {
    if (loading || snapshotAttempted.current || !user?.email || geckos.length === 0) return;
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
  }, [loading, user, geckos, snapshots, portfolio]);

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

  if (loading || isLoadingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
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
      <div className="min-h-screen bg-slate-950 p-6">
        {seo}
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <Wallet className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Collection Portfolio</h1>
          <p className="text-slate-400">Sign in to see what your collection is worth and how it trends over time.</p>
        </div>
      </div>
    );
  }

  if (geckos.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        {seo}
        <div className="max-w-2xl mx-auto pt-20 text-center">
          <PiggyBank className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">No animals to value yet</h1>
          <p className="text-slate-400 mb-6">
            Add geckos to your collection and the portfolio will estimate what each one is worth.
            Premium morphs like Lilly White and Axanthic tend to drive most of a collection&apos;s value.
          </p>
          <Link
            to={createPageUrl('MyGeckos')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500"
          >
            <PlusCircle className="w-4 h-4" /> Add your first gecko
          </Link>
        </div>
      </div>
    );
  }

  const DeltaIcon = trend.delta
    ? (trend.delta.amount > 0 ? TrendingUp : trend.delta.amount < 0 ? TrendingDown : Minus)
    : null;

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {seo}
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Wallet className="w-7 h-7 text-emerald-400" /> Collection Portfolio
          </h1>
          <p className="text-sm text-slate-500 mt-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Values are estimates from market comps and your own listed prices, not formal appraisals.
          </p>
        </div>

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
        <Card className="bg-slate-900 border-slate-700">
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
        <Card className="bg-slate-900 border-slate-700">
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
                          {formatCurrency(row.total)} <span className="text-slate-600">({row.count} {row.count === 1 ? 'animal' : 'animals'})</span>
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
                No valued animals yet. Tag morphs like Lilly White or Axanthic on your geckos and the market comps will fill this in.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Per-animal table */}
        <Card className="bg-slate-900 border-slate-700">
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
                        <Link to={createPageUrl(`GeckoDetail?id=${gecko.id}`)} className="flex items-center gap-3 group">
                          {photo ? (
                            <img src={photo} alt={gecko.name || 'Gecko'} className="w-10 h-10 rounded-lg object-cover bg-slate-800" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-600 text-xs font-bold">
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
                        {valuation.value > 0 ? formatCurrency(valuation.value) : <span className="text-slate-600">$0</span>}
                      </td>
                      <td className="py-2.5 px-3"><BasisChip valuation={valuation} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs text-slate-600 mt-3">
              Morph comps use community average prices and a quality tier multiplier (investment 1.5x, high-end 1.25x, breeder 1.0x, pet 0.6x).
              Set a listing or asking price on a gecko to override the estimate.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
