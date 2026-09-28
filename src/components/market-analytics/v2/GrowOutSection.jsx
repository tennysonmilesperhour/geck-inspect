/**
 * Grow-out radar: sell a hatchling now, or raise it and sell an adult?
 *
 * Replaces the v1 cross-region arbitrage table, which had no data (no
 * non-US listings). Same layout and idea, buy low and sell high, but
 * the spread is across time instead of across borders: the baby (or
 * juvenile) median ask against the adult median ask, less the cost of
 * feeding and housing the animal until it is grown.
 */

import { useMemo, useState } from 'react';
import { Hourglass, ArrowRight } from 'lucide-react';
import { SectionHeader, ConfidenceChip, MethodologyPopover, TrendDelta } from '../shared';
import { growOut, GROW_OUT_MONTHS } from '@/lib/marketAnalytics/v2/model';

const STARTS = [
  { code: 'baby', label: 'Baby' },
  { code: 'juvenile', label: 'Juvenile' },
  { code: 'subadult', label: 'Subadult' },
];

export default function GrowOutSection({ agg, onOpenTrait }) {
  const [from, setFrom] = useState('baby');
  const [monthly, setMonthly] = useState(8);
  const rows = useMemo(() => growOut(agg, { from, monthlyCost: Number(monthly) || 0 }), [agg, from, monthly]);
  const months = GROW_OUT_MONTHS[from];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={Hourglass}
        title="Grow-out radar, hold or sell?"
        subtitle="What a trait gains by raising it to adulthood, after upkeep. Ranked by return on the price you would have sold at."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded border border-slate-700 bg-slate-950 p-0.5" role="group" aria-label="Start age">
              {STARTS.map((s) => (
                <button
                  key={s.code}
                  onClick={() => setFrom(s.code)}
                  className={`text-[11px] px-2 py-1 rounded transition-colors ${from === s.code ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label className="inline-flex items-center gap-1.5 text-[10px] text-slate-500" htmlFor="ma-growout-cost">
              Upkeep $/mo
              <input
                id="ma-growout-cost"
                type="number"
                min="0"
                step="1"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                className="w-14 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 px-1.5 py-1 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </label>
            <MethodologyPopover title="How the edge is worked out">
              <ul className="list-disc pl-5 space-y-0.5 text-slate-300">
                <li>Sell now = median ask at the starting age</li>
                <li>Sell later = median ask for adults</li>
                <li>Upkeep = your monthly cost x months to adulthood ({months} from {from})</li>
                <li>Net edge = (later - now - upkeep) / now</li>
              </ul>
              <p>Months to adulthood are typical crested gecko growth to about 35 grams. A slow grower or a male that stays small eats into the edge. Asking prices, not sold prices.</p>
            </MethodologyPopover>
          </div>
        }
      />

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="text-left px-2 py-2 font-medium">Trait</th>
              <th className="text-right px-2 py-2 font-medium">Sell now</th>
              <th className="px-1 py-2" aria-hidden="true" />
              <th className="text-right px-2 py-2 font-medium">Sell as adult</th>
              <th className="text-right px-2 py-2 font-medium">Upkeep</th>
              <th className="text-right px-2 py-2 font-medium">Gross</th>
              <th className="text-right px-2 py-2 font-medium">Net edge</th>
              <th className="text-right px-2 py-2 font-medium">Per month</th>
              <th className="text-right px-2 py-2 font-medium">Conf</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} onClick={() => onOpenTrait?.(r.name)} className="border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/40">
                <td className="px-2 py-2 font-medium text-slate-100">{r.name}</td>
                <td className="text-right px-2 py-2 text-slate-300 tabular-nums">${r.buy.toLocaleString()}</td>
                <td className="px-1 py-2 text-slate-600"><ArrowRight className="w-3 h-3" /></td>
                <td className="text-right px-2 py-2 text-emerald-300 tabular-nums font-semibold">${r.sell.toLocaleString()}</td>
                <td className="text-right px-2 py-2 text-slate-500 tabular-nums">${r.upkeep}</td>
                <td className="text-right px-2 py-2"><TrendDelta value={r.gross_pct} digits={0} /></td>
                <td className="text-right px-2 py-2"><TrendDelta value={r.net_pct} digits={0} /></td>
                <td className={`text-right px-2 py-2 tabular-nums ${r.per_month >= 0 ? 'text-slate-300' : 'text-red-400'}`}>
                  {r.per_month >= 0 ? '+' : '-'}${Math.abs(Math.round(r.per_month))}
                </td>
                <td className="text-right px-2 py-2">
                  <span onClick={(e) => e.stopPropagation()}>
                    <ConfidenceChip confidence={r.confidence} sampleSize={Math.min(r.n_from, r.n_adult)} sources={['external.morphmarket']} size="xs" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
        Per month is the net gain divided by months held, a quick way to compare a fast Lilly White flip with a slow Axanthic hold.
        Upkeep covers diet, supplements and enclosure share, not your time.
      </div>
    </div>
  );
}
