/**
 * Traits: every trait with enough listings, ranked, plus a detail panel
 * for the selected one (asking range, age ladder, weekly trend).
 *
 * Replaces the v1 combo table. Exact multi-trait combos are too thin to
 * price (28 have 5+ sales); single traits have hundreds of listings.
 */

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, Cell, LabelList,
} from 'recharts';
import { Layers, SortAsc, SortDesc, Ruler } from 'lucide-react';
import {
  SectionHeader, ConfidenceChip, MethodologyPopover, TrendDelta,
} from '../shared';
import { traitRows, AGE_COLUMNS, weekLabel, weekAxis, periodLabels } from '@/lib/marketAnalytics/v2/model';

const SORTS = [
  { key: 'n', label: 'Listings' },
  { key: 'median', label: 'Median ask' },
  { key: 'sell_through', label: 'Sell-through' },
  { key: 'days', label: 'Days to sell' },
  { key: 'change_pct', label: 'Change' },
];

export default function TraitsSection({ agg, filters, selected, onSelect }) {
  const [sortKey, setSortKey] = useState('n');
  const [dir, setDir] = useState('desc');
  const age = filters.age;

  const rows = useMemo(() => {
    const base = traitRows(agg).map((r) => {
      if (age === 'all') return r;
      const cell = r.by_age?.[age];
      return { ...r, median: cell ? cell[1] : null, age_n: cell ? cell[0] : 0 };
    });
    return base.sort((a, b) => {
      const av = a[sortKey] ?? -1, bv = b[sortKey] ?? -1;
      return dir === 'asc' ? av - bv : bv - av;
    });
  }, [agg, age, sortKey, dir]);

  const maxP75 = Math.max(...rows.map((r) => r.p75), 1);
  const periods = useMemo(() => periodLabels(agg), [agg]);
  const axis = useMemo(() => weekAxis(agg).axis, [agg]);
  const current = rows.find((r) => r.name === selected) || rows[0];
  const ageLabel = AGE_COLUMNS.find((a) => a.code === age)?.label;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <SectionHeader
          icon={Layers}
          title="Traits, ranked"
          subtitle={age === 'all' ? 'Click a trait to see its age ladder and weekly trend' : `Median ask for ${ageLabel?.toLowerCase()}s only. Dashes mean no age split yet.`}
          right={
            <div className="flex items-center gap-1.5">
              <select
                id="ma-trait-sort"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
                aria-label="Sort traits by"
              >
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button
                onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex items-center justify-center w-7 h-7 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
                aria-label="Flip sort direction"
              >
                {dir === 'asc' ? <SortAsc className="w-3.5 h-3.5" /> : <SortDesc className="w-3.5 h-3.5" />}
              </button>
              <MethodologyPopover title="What each column means">
                <p><strong className="text-slate-200">Range</strong> is the middle half of asking prices (25th to 75th percentile). The tick is the median.</p>
                <p><strong className="text-slate-200">Sell-through</strong> is the share of listings seen before sales tracking stopped that flipped to sold while it was running.</p>
                <p><strong className="text-slate-200">Change</strong> compares new listings from {periods.recent} with {periods.earlier}.</p>
              </MethodologyPopover>
            </div>
          }
        />
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-left px-2 py-2 font-medium">Trait</th>
                <th className="text-right px-2 py-2 font-medium">Median</th>
                <th className="text-left px-2 py-2 font-medium w-[24%]">Range</th>
                <th className="text-right px-2 py-2 font-medium">Sell-thru</th>
                <th className="text-right px-2 py-2 font-medium">Change</th>
                <th className="text-right px-2 py-2 font-medium">n</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const on = r.name === current?.name;
                return (
                  <tr
                    key={r.name}
                    onClick={() => onSelect(r.name)}
                    className={`border-b border-slate-800/50 cursor-pointer transition-colors ${on ? 'bg-emerald-500/10' : 'hover:bg-slate-800/40'}`}
                  >
                    <td className={`px-2 py-2 font-medium ${on ? 'text-emerald-200' : 'text-slate-100'}`}>{r.name}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-200">{r.median != null ? `$${r.median}` : <span className="text-slate-600">-</span>}</td>
                    <td className="px-2 py-2"><RangeBar p25={r.p25} p75={r.p75} median={r.median} max={maxP75} /></td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-300">{r.sell_through != null ? `${Math.round(r.sell_through * 100)}%` : '-'}</td>
                    <td className="px-2 py-2 text-right">{r.mover_eligible ? <TrendDelta value={r.change_pct} digits={0} /> : <span className="text-slate-600" title="Too few recent listings to compare">-</span>}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{age === 'all' ? r.n : r.age_n || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:col-span-2 min-w-0">
        {current ? <TraitDetail t={current} axis={axis} periods={periods} /> : (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">No trait matches that search.</div>
        )}
      </div>
    </div>
  );
}

function RangeBar({ p25, p75, median, max }) {
  const left = (p25 / max) * 100;
  const width = Math.max(2, ((p75 - p25) / max) * 100);
  const mid = median != null ? (median / max) * 100 : null;
  return (
    <div className="relative h-4" title={`$${p25} to $${p75}`}>
      <div className="absolute inset-x-0 top-1/2 h-px bg-slate-800" />
      <div className="absolute top-1 h-2 rounded-full bg-emerald-500/25 border border-emerald-500/40" style={{ left: `${left}%`, width: `${width}%` }} />
      {mid != null && <div className="absolute top-0.5 h-3 w-0.5 bg-emerald-300 rounded" style={{ left: `${mid}%` }} />}
    </div>
  );
}

function TraitDetail({ t, axis, periods }) {
  const ladder = t.by_age
    ? AGE_COLUMNS.map((a) => ({ age: a.label, median: t.by_age[a.code]?.[1] ?? 0, n: t.by_age[a.code]?.[0] ?? 0 }))
    : null;
  const multiple = t.by_age ? (t.by_age.adult[1] / t.by_age.baby[1]) : null;
  const weekly = axis.map((k) => t.weekly?.[k]).filter(Boolean);
  const trend = axis.map((k, i) => ({ label: weekLabel(k), median: t.sparkline[i] }));
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Trait</div>
          <h3 className="text-lg font-semibold text-slate-100 truncate">{t.name}</h3>
        </div>
        <ConfidenceChip
          confidence={t.confidence}
          sampleSize={t.n}
          sources={['external.morphmarket']}
          methodology="Built on asking prices, so confidence tops out at Medium until sold prices are collected again."
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Median ask" value={`$${t.median}`} />
        <Stat label="Middle half" value={`$${t.p25} to $${t.p75}`} small />
        <Stat label="Sold in window" value={`${t.sold}`} sub={t.sell_through != null ? `${Math.round(t.sell_through * 100)}%, ${t.days} days avg` : 'no sales tracked'} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Ruler className="w-3.5 h-3.5 text-emerald-300" />Age ladder</div>
          {multiple && <span className="text-[10px] text-slate-400">Adults ask <span className="text-emerald-300 font-semibold tabular-nums">{multiple.toFixed(1)}x</span> a baby</span>}
        </div>
        {ladder ? (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ladder} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="age" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={40} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(52,211,153,0.06)' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v, _n, item) => [`$${v} (n=${item.payload.n})`, 'Median ask']}
                />
                <Bar dataKey="median" radius={[4, 4, 0, 0]} animationDuration={600}>
                  {ladder.map((d, i) => <Cell key={d.age} fill="#34d399" fillOpacity={0.35 + i * 0.18} />)}
                  <LabelList dataKey="median" position="top" formatter={(v) => `$${v}`} style={{ fill: '#cbd5e1', fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 py-3">Not enough listings state an age for {t.name} yet.</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-slate-300">Weekly median ask</span>
          {t.mover_eligible && <span className="text-[10px] text-slate-400">{periods.earlierShort} to {periods.recentShort} <TrendDelta value={t.change_pct} digits={0} /></span>}
        </div>
        <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-2 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} interval={3} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={40} tickFormatter={(v) => `$${v}`} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <RechartsTooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(v) => (v == null ? ['Not collected', 'Median ask'] : [`$${v}`, 'Median ask'])}
              />
              <Line type="linear" dataKey="median" stroke="#34d399" strokeWidth={2} connectNulls={false} dot={{ r: 2.5, fill: '#34d399', strokeWidth: 0 }} animationDuration={600} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-500 mt-1.5">{weekly.length} weeks with listings. Weeks with fewer than 5 new listings are left off, and the gap is when the collector was offline.</p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, small }) {
  return (
    <div className="rounded-lg bg-slate-950/50 border border-slate-800 px-2.5 py-2 min-w-0">
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className={`font-bold tabular-nums text-slate-100 ${small ? 'text-xs mt-1' : 'text-base'}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
    </div>
  );
}
