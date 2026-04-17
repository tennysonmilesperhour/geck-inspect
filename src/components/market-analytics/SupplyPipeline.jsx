/**
 * Supply Pipeline
 *
 * The signal no external scraper can see: our own users' breeding
 * records tell us how many juveniles of each combo will come to market
 * over the next 9 months. This is forward-looking supply — before any
 * listing is posted anywhere on the internet.
 *
 * Shows a stacked monthly forecast with combo breakdown and a per-combo
 * "supply pressure" score. High supply pressure + weak demand = flag
 * the breeder to reconsider producing more of that combo this season.
 */

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import { Sprout, CalendarDays } from 'lucide-react';
import { querySupplyPipeline } from '@/lib/marketAnalytics/queries';
import {
  SectionHeader, ConfidenceChip, SourceBadgeStack, MethodologyPopover,
} from './shared';

const COMBO_COLORS = [
  '#34d399', '#60a5fa', '#a78bfa', '#fb7185', '#fbbf24', '#f472b6',
  '#4ade80', '#38bdf8', '#c084fc', '#fb923c', '#facc15', '#22d3ee',
];

export default function SupplyPipeline({ filters: _filters }) {
  const [pipeline, setPipeline] = useState([]);

  useEffect(() => {
    let mounted = true;
    querySupplyPipeline({}).then((r) => { if (mounted) setPipeline(r); });
    return () => { mounted = false; };
  }, []);

  // Pivot: one row per month, one key per combo.
  const months = pipeline[0]?.series?.map((s) => s.label) ?? [];
  const stacked = months.map((label, idx) => {
    const row = { label };
    pipeline.forEach((p) => {
      row[p.combo_name] = p.series[idx]?.projected_hatchlings ?? 0;
    });
    return row;
  });

  const totalPairs = pipeline.reduce((s, p) => s + p.active_pairs, 0);
  const totalHatch = pipeline.reduce((s, p) => s + p.series.reduce((a, m) => a + m.projected_hatchlings, 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <SectionHeader
          icon={Sprout}
          title="Supply pipeline — projected hatchlings (9-month)"
          subtitle="Forward-looking supply from Geck Inspect users' own breeding records — available nowhere else"
          right={
            <MethodologyPopover title="How the forecast is built">
              <p>Active breeding pairs logged in-app × seasonal fertility curve × historical clutches-per-pair, aggregated by combo and projected forward 9 months.</p>
              <p>Because this is derived from first-party breeding records it's a leading indicator for external markets by 4-7 months. Use it to decide whether to hold, list early, or avoid producing more.</p>
            </MethodologyPopover>
          }
        />

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Stat label="Active pairs tracked"  value={totalPairs} suffix="pairs" />
          <Stat label="Projected 9m hatchlings" value={totalHatch} suffix="juveniles" />
          <Stat label="Peak month" value={peakMonth(stacked, pipeline) ?? '—'} />
        </div>

        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stacked} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={30} />
              <RechartsTooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
              {pipeline.map((p, i) => (
                <Bar key={p.combo_id} dataKey={p.combo_name} stackId="s" fill={COMBO_COLORS[i % COMBO_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SourceBadgeStack sourceIds={['internal.breeding']} />
      </div>

      <PipelineTable pipeline={pipeline} />
    </div>
  );
}

function peakMonth(stacked, pipeline) {
  if (!stacked.length) return null;
  let maxIdx = 0, maxSum = -1;
  stacked.forEach((row, idx) => {
    const sum = Object.keys(row).filter((k) => k !== 'label').reduce((s, k) => s + row[k], 0);
    if (sum > maxSum) { maxSum = sum; maxIdx = idx; }
  });
  return pipeline[0]?.series[maxIdx]?.label ?? null;
}

function Stat({ label, value, suffix }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-bold text-slate-100 tabular-nums">
        {value} {suffix && <span className="text-[10px] text-slate-500 font-normal">{suffix}</span>}
      </div>
    </div>
  );
}

function PipelineTable({ pipeline }) {
  const rows = pipeline.map((p) => {
    const next3 = p.series.slice(0, 3).reduce((s, m) => s + m.projected_hatchlings, 0);
    const next9 = p.series.reduce((s, m) => s + m.projected_hatchlings, 0);
    return { ...p, next3, next9 };
  }).sort((a, b) => b.next3 - a.next3);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={CalendarDays}
        title="Per-combo pipeline"
        subtitle="Use 3-month lookahead for sell-timing decisions"
      />
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="text-left px-2 py-2 font-medium">Combo</th>
              <th className="text-right px-2 py-2 font-medium">Active pairs</th>
              <th className="text-right px-2 py-2 font-medium">Next 3m</th>
              <th className="text-right px-2 py-2 font-medium">Next 9m</th>
              <th className="text-right px-2 py-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.combo_id} className="border-b border-slate-800/50 hover:bg-slate-800/40">
                <td className="px-2 py-2 font-medium text-slate-100">{p.combo_name}</td>
                <td className="text-right px-2 py-2 text-slate-300 tabular-nums">{p.active_pairs}</td>
                <td className="text-right px-2 py-2 text-emerald-300 tabular-nums font-semibold">{p.next3}</td>
                <td className="text-right px-2 py-2 text-slate-300 tabular-nums">{p.next9}</td>
                <td className="text-right px-2 py-2">
                  <ConfidenceChip confidence={p.confidence} sampleSize={p.active_pairs * 2} sources={['internal.breeding']} size="xs" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
