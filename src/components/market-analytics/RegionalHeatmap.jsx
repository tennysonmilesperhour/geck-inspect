/**
 * Regional Heatmap
 *
 * Matrix of combo × region. The single most important screen for
 * answering "where should I list this animal?" ,  a glance reveals which
 * combos command premiums in which markets, and where supply is thin.
 *
 * Cell color encodes value; cell opacity encodes confidence. A faded
 * cell means we don't have enough data to trust the number, and the
 * user sees that visually without reading confidence chips.
 *
 * Three metrics are swappable: median sold price, avg days on market
 * (velocity), and raw volume.
 */

import { useEffect, useMemo, useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { queryRegionalHeatmap } from '@/lib/marketAnalytics/queries';
import { REGIONS, HIGH_VALUE_COMBOS } from '@/lib/marketAnalytics/taxonomy';
import {
  SectionHeader, HeatmapCell, MethodologyPopover,
} from './shared';

const METRICS = [
  { code: 'median_sold', label: 'Median sold', format: (v) => `$${(v || 0).toLocaleString()}` },
  { code: 'days_listed', label: 'Avg days listed', format: (v) => `${v}d` },
  { code: 'volume',      label: 'Volume (n)', format: (v) => `${v}` },
];

export default function RegionalHeatmap({ filters, onDrillDown }) {
  const [metric, setMetric] = useState('median_sold');
  const [cells, setCells] = useState([]);

  useEffect(() => {
    let mounted = true;
    queryRegionalHeatmap({ timeframe: filters.timeframe, metric }).then((r) => {
      if (!mounted) return;
      setCells(r);
    });
    return () => { mounted = false; };
  }, [filters.timeframe, metric]);

  const { min, max, grid } = useMemo(() => {
    const values = cells.map((c) => c.value).filter((v) => v > 0);
    const mn = values.length ? Math.min(...values) : 0;
    const mx = values.length ? Math.max(...values) : 1;
    const g = {};
    cells.forEach((c) => {
      g[c.combo_id] = g[c.combo_id] || {};
      g[c.combo_id][c.region] = c;
    });
    return { min: mn, max: mx, grid: g };
  }, [cells]);

  const fmt = METRICS.find((m) => m.code === metric)?.format ?? ((v) => v);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={MapIcon}
        title="Regional heatmap ,  combo × market"
        subtitle="Where each combination commands premiums and where supply is thin"
        right={
          <div className="flex items-center gap-2">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
            >
              {METRICS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
            <MethodologyPopover title="How this heatmap is colored">
              <p>Each cell is the combo's median metric in the region for the selected timeframe. Color ramps from green (low) to red (high) across the <em>visible</em> min/max, so you can compare within the grid directly.</p>
              <p>Cell opacity = confidence. Faded cells have small sample sizes ,  don't act on them without drilling in.</p>
            </MethodologyPopover>
          </div>
        }
      />

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider py-1 min-w-[160px]">Combo</th>
              {REGIONS.map((r) => (
                <th key={r.code} className="text-center text-[10px] text-slate-400 font-semibold py-1">
                  {r.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HIGH_VALUE_COMBOS.map((c) => (
              <tr key={c.id}>
                <td className="text-xs text-slate-300 py-0.5 pr-2 align-middle">
                  <div className="truncate max-w-[200px]">{c.name}</div>
                </td>
                {REGIONS.map((r) => {
                  const cell = grid[c.id]?.[r.code];
                  return (
                    <td key={r.code} className="p-0 align-middle">
                      <HeatmapCell
                        value={cell?.value}
                        min={min} max={max}
                        confidence={cell?.confidence ?? 0}
                        onClick={() => onDrillDown?.({ combo_id: c.id, region: r.code })}
                        label={cell ? `${c.name} ,  ${r.name}: ${fmt(cell.value)} (n=${cell.sample_size})` : '—'}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <span>Scale:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: 'hsla(140, 65%, 45%, 0.6)' }} />
            <span>low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: 'hsla(70, 65%, 45%, 0.6)' }} />
            <span>mid</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: 'hsla(0, 65%, 45%, 0.6)' }} />
            <span>high</span>
          </div>
          <span className="text-slate-600">· opacity ∝ confidence</span>
        </div>
        <div>{metric === 'median_sold' ? `range ${fmt(min)}–${fmt(max)}` : `range ${min}–${max}`}</div>
      </div>
    </div>
  );
}
