/**
 * Price Map: trait x age heatmap.
 *
 * Replaces the v1 regional heatmap (the data is 98% US, so a region
 * grid would be one column). Age is where the price spread really is:
 * a Lilly White adult asks about 1.8x a baby, an Axanthic adult 2.5x.
 * Cell color = value, cell opacity = confidence, same as v1.
 */

import { useMemo, useState } from 'react';
import { Grid3x3 } from 'lucide-react';
import { SectionHeader, HeatmapCell, MethodologyPopover } from '../shared';
import { ageHeatmap, AGE_COLUMNS } from '@/lib/marketAnalytics/v2/model';

const METRICS = [
  { code: 'median', label: 'Median ask' },
  { code: 'volume', label: 'Listings (n)' },
];

export default function PriceMapSection({ agg, filters, onOpenTrait }) {
  const [metric, setMetric] = useState('median');
  const map = useMemo(() => ageHeatmap(agg, metric), [agg, metric]);
  const focus = filters.age;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
      <SectionHeader
        icon={Grid3x3}
        title="Price Map, trait x age"
        subtitle="What each trait asks at each stage. Use it to price a hatchling or decide when to list."
        right={
          <div className="flex items-center gap-2">
            <select
              id="ma-pricemap-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
              aria-label="Heatmap metric"
            >
              {METRICS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
            </select>
            <MethodologyPopover title="How this map is colored">
              <p>Each cell is the median asking price (or listing count) for that trait at that age. Color runs from green (low) to red (high) across the whole grid. The top tenth of prices all show as full red, so one very expensive cell does not flatten the rest.</p>
              <p>Faded cells rest on few listings. Ages come from the seller&apos;s maturity field; listings without one are left out of this view.</p>
            </MethodologyPopover>
          </div>
        }
      />

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full border-separate border-spacing-0.5 min-w-[520px]">
          <thead>
            <tr>
              <th className="text-left text-[10px] text-slate-500 font-medium uppercase tracking-wider py-1 min-w-[140px]">Trait</th>
              {AGE_COLUMNS.map((a) => (
                <th key={a.code} className={`text-center text-[10px] font-semibold py-1 ${focus === a.code ? 'text-emerald-300' : 'text-slate-400'}`}>{a.label}</th>
              ))}
              <th className="text-right text-[10px] text-slate-500 font-medium py-1 pl-2">Adult vs baby</th>
            </tr>
          </thead>
          <tbody>
            {map.rows.map((r) => {
              const baby = r.cells[0], adult = r.cells[3];
              const mult = metric === 'median' && baby.value ? adult.value / baby.value : null;
              return (
                <tr key={r.name}>
                  <td className="text-xs text-slate-300 py-0.5 pr-2 align-middle">
                    <button onClick={() => onOpenTrait?.(r.name)} className="touch:min-h-11 truncate max-w-[180px] hover:text-emerald-300 text-left">{r.name}</button>
                  </td>
                  {r.cells.map((c) => (
                    <td key={c.age} className={`p-0 align-middle ${focus !== 'all' && focus !== c.age ? 'opacity-40' : ''}`}>
                      {metric === 'median' ? (
                        <HeatmapCell
                          value={c.value}
                          min={map.min} max={map.max}
                          confidence={c.confidence}
                          onClick={() => onOpenTrait?.(r.name)}
                          label={`${r.name}, ${c.age}: $${c.value} (n=${c.n})`}
                        />
                      ) : (
                        <VolumeCell value={c.value} max={map.top} label={`${r.name}, ${c.age}: ${c.value} listings`} />
                      )}
                    </td>
                  ))}
                  <td className="text-right text-xs tabular-nums pl-2 align-middle">
                    {mult ? <span className={mult >= 2 ? 'text-emerald-300 font-semibold' : 'text-slate-300'}>{mult.toFixed(1)}x</span> : <span className="text-slate-600">-</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <span>Scale:</span>
          <Swatch hue={140} label="low" />
          <Swatch hue={70} label="mid" />
          <Swatch hue={0} label="high" />
          <span>· faded = few listings</span>
        </div>
        <div className="tabular-nums">{metric === 'median' ? `$${map.min} to $${map.top}, full red at $${map.max}+` : `${map.min} to ${map.top} listings`}</div>
      </div>
    </div>
  );
}

function Swatch({ hue, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-4 h-4 rounded" style={{ background: `hsla(${hue}, 65%, 45%, 0.6)` }} />
      {label}
    </span>
  );
}

function VolumeCell({ value, max, label }) {
  const t = max ? value / max : 0;
  return (
    <div
      className="rounded text-[10px] tabular-nums font-medium text-white w-full h-10 border border-slate-800 flex items-center justify-center"
      style={{ background: `rgba(56, 189, 248, ${0.08 + t * 0.6})` }}
      title={label}
    >
      {value || '-'}
    </div>
  );
}
