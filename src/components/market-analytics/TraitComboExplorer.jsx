/**
 * Trait Combo Explorer
 *
 * Answers the buyer-side and breeder-side questions:
 *   - "What's the right ask for this combination in this region?"
 *   - "Which combos have the tightest sold-ask spread (meaning deals
 *     actually close near ask)?"
 *   - "Which combos are moving the fastest (lowest days-listed)?"
 *
 * Left pane: filter & sort controls + ranked combo table.
 * Right pane: detail panel for the selected combo — 12-month price
 * history (sold vs ask, internal vs external), price-band confidence
 * ribbon, and a drill-through to underlying transactions.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Area, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, Legend, ComposedChart,
} from 'recharts';
import { Filter, Layers, SortAsc, SortDesc } from 'lucide-react';
import {
  queryTraitCombos, queryPriceHistory, blendedHeadline,
} from '@/lib/marketAnalytics/queries';
import {
  SectionHeader, ConfidenceChip, SourceBadgeStack, MethodologyPopover,
} from './shared';

const SORT_OPTIONS = [
  { key: 'volume_sold',     label: 'Volume (sold)' },
  { key: 'median_sold',     label: 'Median sold price' },
  { key: 'spread_pct',      label: 'Ask–sold spread' },
  { key: 'avg_days_listed', label: 'Days listed' },
  { key: 'active_listings', label: 'Active listings' },
];

export default function TraitComboExplorer({ filters, onDrillDown }) {
  const [rows, setRows] = useState([]);
  const [sortKey, setSortKey] = useState('volume_sold');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [blend, setBlend] = useState(null);

  useEffect(() => {
    let mounted = true;
    queryTraitCombos({
      regions: filters.regions,
      timeframe: filters.timeframe,
      age_class: filters.age_class,
      lineage_tier: filters.lineage_tier,
      sources: filters.sources,
    }).then((r) => {
      if (!mounted) return;
      setRows(r);
      if (!selected && r.length) setSelected(r[0].combo_id);
    });
    return () => { mounted = false; };
  }, [filters.regions, filters.timeframe, filters.age_class, filters.lineage_tier, filters.sources]);

  useEffect(() => {
    if (!selected) return;
    let mounted = true;
    const region = filters.regions?.length === 1 ? filters.regions[0] : undefined;
    Promise.all([
      queryPriceHistory({
        combo_id: selected, region,
        sources: filters.sources, timeframe: filters.timeframe,
      }),
      blendedHeadline({ combo_id: selected, region: region ?? 'US' }),
    ]).then(([h, b]) => {
      if (!mounted) return;
      setHistory(h); setBlend(b);
    });
    return () => { mounted = false; };
  }, [selected, filters.regions, filters.sources, filters.timeframe]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <SectionHeader
            icon={Layers}
            title="Trait Combinations — ranked"
            subtitle="The market prices combinations, not single traits. Click a row to drill in."
            right={
              <div className="flex items-center gap-1.5">
                <SortControl sortKey={sortKey} setSortKey={setSortKey} sortDir={sortDir} setSortDir={setSortDir} />
                <MethodologyPopover title="How rankings are built">
                  <p>We compute each combo's median sold price (not mean — sold prices are long-tailed), median ask, the spread between them (a proxy for bargaining power), time-on-market in days (velocity), and raw volume.</p>
                  <p>The spread % = (median_ask − median_sold) / median_ask. Low-spread combos close near ask; high-spread combos are overpriced or illiquid.</p>
                </MethodologyPopover>
              </div>
            }
          />
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-left px-2 py-2 font-medium">Combo</th>
                  <th className="text-right px-2 py-2 font-medium">Median sold</th>
                  <th className="text-right px-2 py-2 font-medium">Ask</th>
                  <th className="text-right px-2 py-2 font-medium">Spread</th>
                  <th className="text-right px-2 py-2 font-medium">Days</th>
                  <th className="text-right px-2 py-2 font-medium">Vol</th>
                  <th className="text-right px-2 py-2 font-medium">Conf</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => (
                  <tr
                    key={r.combo_id}
                    onClick={() => setSelected(r.combo_id)}
                    className={`border-b border-slate-800/50 cursor-pointer transition-colors ${
                      r.combo_id === selected ? 'bg-emerald-950/40' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-100">{r.combo_name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {r.traits.join(' · ')}
                      </div>
                    </td>
                    <td className="text-right px-2 py-2 text-emerald-300 font-semibold tabular-nums">
                      ${r.median_sold.toLocaleString()}
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        ±${Math.round((r.band.high - r.band.low) / 2).toLocaleString()}
                      </div>
                    </td>
                    <td className="text-right px-2 py-2 text-slate-300 tabular-nums">${r.median_ask.toLocaleString()}</td>
                    <td className={`text-right px-2 py-2 tabular-nums font-semibold ${r.spread_pct > 15 ? 'text-red-400' : r.spread_pct > 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {r.spread_pct.toFixed(1)}%
                    </td>
                    <td className="text-right px-2 py-2 text-slate-300 tabular-nums">{r.avg_days_listed}d</td>
                    <td className="text-right px-2 py-2 text-slate-300 tabular-nums">{r.volume_sold}</td>
                    <td className="text-right px-2 py-2">
                      <ConfidenceChip confidence={r.confidence} sampleSize={r.volume_sold} sources={r.sources} size="xs" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <EmptyState />}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <ComboDetail
          combo={rows.find((r) => r.combo_id === selected)}
          history={history}
          blend={blend}
          onDrillDown={onDrillDown}
        />
      </div>
    </div>
  );
}

function SortControl({ sortKey, setSortKey, sortDir, setSortDir }) {
  return (
    <div className="flex items-center gap-1">
      <Filter className="w-3 h-3 text-slate-500" />
      <select
        value={sortKey}
        onChange={(e) => setSortKey(e.target.value)}
        className="bg-slate-900 border border-slate-700 text-slate-200 text-[11px] rounded px-1.5 py-0.5"
      >
        {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      <button
        onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
        className="p-1 rounded hover:bg-slate-800 text-slate-400"
        aria-label="toggle sort direction"
      >
        {sortDir === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function EmptyState() {
  return <div className="py-8 text-center text-xs text-slate-500">No combos match the current filters.</div>;
}

// ---------- Detail pane -----------------------------------------------
function ComboDetail({ combo, history, blend, onDrillDown }) {
  if (!combo) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-500">
        Select a combination to see its price history.
      </div>
    );
  }
  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-2">
          <div className="text-[10px] uppercase tracking-wider text-emerald-400/80">Headline</div>
          <div className="text-xl font-bold text-slate-100">{combo.combo_name}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-2xl text-emerald-300 font-bold tabular-nums">${combo.median_sold.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500">median sold</span>
            <span className="text-xs text-slate-400 tabular-nums">
              range ${combo.band.low.toLocaleString()}–${combo.band.high.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <ConfidenceChip
              confidence={combo.confidence}
              sampleSize={combo.volume_sold}
              sources={combo.sources}
              methodology="Confidence = f(source trust × sample-size saturation). Widening band reflects lower confidence."
            />
            <SourceBadgeStack sourceIds={combo.sources} />
          </div>
        </div>

        <div className="h-44 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={history?.series || []}>
              <defs>
                <linearGradient id="tcBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={44} tickFormatter={(v) => `$${v}`} />
              <RechartsTooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v, name) => [v ? `$${Number(v).toLocaleString()}` : '—', name]}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="high" stroke="none" fill="url(#tcBand)" name="Upper band" />
              <Line type="monotone" dataKey="median_sold" stroke="#34d399" strokeWidth={2} dot={false} name="Sold (median)" />
              <Line type="monotone" dataKey="median_ask"  stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Ask (median)" />
              <Line type="monotone" dataKey="internal_avg" stroke="#facc15" strokeWidth={1} dot={false} name="Internal avg" />
              <Line type="monotone" dataKey="external_avg" stroke="#38bdf8" strokeWidth={1} dot={false} name="External avg" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[10px] text-slate-500">
            {history?.sample_size ?? 0} observations over period
          </div>
          <button
            onClick={() => onDrillDown?.({ combo_id: combo.combo_id })}
            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
          >
            See underlying transactions →
          </button>
        </div>
      </div>

      <BlendedSourceCard blend={blend} />
      <KeyMetricsCard combo={combo} />
    </>
  );
}

function BlendedSourceCard({ blend }) {
  if (!blend?.contributions?.length) return null;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={Layers}
        title="Blended price — contribution by source"
        subtitle="How the headline is assembled from multiple feeds"
      />
      <div className="space-y-2">
        {blend.contributions
          .sort((a, b) => b.weight - a.weight)
          .map((c) => (
            <div key={c.sourceId}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5">
                  <SourceBadgeStack sourceIds={[c.sourceId]} />
                  <span className="text-slate-500 tabular-nums text-[10px]">n={c.sampleSize}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 tabular-nums">${Math.round(c.value).toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500 tabular-nums">{Math.round(c.weight * 100)}%</span>
                </div>
              </div>
              <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400/70" style={{ width: `${c.weight * 100}%` }} />
              </div>
            </div>
          ))}
      </div>
      <div className="text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-800/70">
        Blended confidence: {Math.round(blend.confidence * 100)}/100
      </div>
    </div>
  );
}

function KeyMetricsCard({ combo }) {
  const metrics = [
    { label: 'Median ask', value: `$${combo.median_ask.toLocaleString()}`, hint: 'asking price across listings' },
    { label: 'Ask→sold spread', value: `${combo.spread_pct.toFixed(1)}%`, hint: 'negative = sells above ask' },
    { label: 'Avg time on market', value: `${combo.avg_days_listed} days`, hint: 'lower = stronger demand' },
    { label: 'Active listings', value: combo.active_listings, hint: 'current supply' },
  ];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader title="Key metrics" />
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</div>
            <div className="text-sm font-semibold text-slate-100 tabular-nums mt-0.5">{m.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{m.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
