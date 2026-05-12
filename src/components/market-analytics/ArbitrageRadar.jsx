/**
 * Arbitrage Radar
 *
 * Cross-region opportunities ranked by risk-adjusted edge. Answers
 * "where is this trait undervalued and where is it in demand?" in a
 * way no surface-level pricing tool does.
 *
 * Each row: buy-region price, sell-region price, estimated live-freight
 * cost, gross edge %, risk-adjusted edge % (discounted for import
 * friction), sample size, and confidence. Clickable to drill into the
 * underlying transactions on both sides.
 *
 * Research note: we follow Liv-ex / sneaker-arbitrage patterns ,  always
 * show gross vs risk-adjusted, always show sample size, and always let
 * the user see the trades that built the number.
 */

import { useEffect, useState } from 'react';
import { Radar, ArrowRight } from 'lucide-react';
import { queryArbitrage } from '@/lib/marketAnalytics/queries';
import {
  SectionHeader, ConfidenceChip, MethodologyPopover, TrendDelta,
} from './shared';

const MIN_SAMPLE_OPTIONS = [2, 4, 8, 15];

export default function ArbitrageRadar({ filters, onDrillDown }) {
  const [minSample, setMinSample] = useState(4);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let mounted = true;
    queryArbitrage({ timeframe: filters.timeframe, minSample }).then((r) => {
      if (!mounted) return;
      setRows(r);
    });
    return () => { mounted = false; };
  }, [filters.timeframe, minSample]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={Radar}
        title="Arbitrage radar ,  cross-region opportunities"
        subtitle="Combos priced meaningfully below their highest-paying market, after shipping & import friction"
        right={
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-500">Min sample</label>
            <select
              value={minSample}
              onChange={(e) => setMinSample(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1"
            >
              {MIN_SAMPLE_OPTIONS.map((n) => <option key={n} value={n}>{n}+</option>)}
            </select>
            <MethodologyPopover title="How arbitrage opportunities are scored">
              <p>For each combo we find the cheapest-median and most-expensive-median regions over the timeframe, require both sides to clear a minimum sample size, and compute:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-300">
                <li>Gross edge % = (sell − buy − shipping) / buy</li>
                <li>Risk-adjusted edge % = gross × (1 − 0.5 × combined import-friction)</li>
              </ul>
              <p>Shipping estimates use typical live-animal freight costs; import friction reflects CITES-adjacent paperwork, vet certs, and quarantine windows. Real pipeline will plug live freight quotes here.</p>
            </MethodologyPopover>
          </div>
        }
      />

      {rows.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500">
          No opportunities clear the minimum sample threshold. Lower the threshold or widen the timeframe.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="text-left px-2 py-2 font-medium">Combo</th>
                <th className="text-left px-2 py-2 font-medium">Buy</th>
                <th className="text-left px-2 py-2 font-medium">Sell</th>
                <th className="text-right px-2 py-2 font-medium">Buy $</th>
                <th className="text-right px-2 py-2 font-medium">Sell $</th>
                <th className="text-right px-2 py-2 font-medium">Ship</th>
                <th className="text-right px-2 py-2 font-medium">Gross</th>
                <th className="text-right px-2 py-2 font-medium">Risk-adj</th>
                <th className="text-right px-2 py-2 font-medium">Sample</th>
                <th className="text-right px-2 py-2 font-medium">Conf</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.combo_id}-${i}`}
                    onClick={() => onDrillDown?.({ combo_id: r.combo_id })}
                    className="border-b border-slate-800/50 cursor-pointer hover:bg-slate-800/40">
                  <td className="px-2 py-2 font-medium text-slate-100">{r.combo_name}</td>
                  <td className="px-2 py-2 text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <RegionPill code={r.buy_region} />
                      <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{r.buy_region_name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <RegionPill code={r.sell_region} />
                      <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{r.sell_region_name}</span>
                    </span>
                  </td>
                  <td className="text-right px-2 py-2 text-slate-300 tabular-nums">${r.buy_price.toLocaleString()}</td>
                  <td className="text-right px-2 py-2 text-emerald-300 tabular-nums font-semibold">${r.sell_price.toLocaleString()}</td>
                  <td className="text-right px-2 py-2 text-slate-500 tabular-nums">${r.shipping_estimate.toLocaleString()}</td>
                  <td className="text-right px-2 py-2"><TrendDelta value={r.gross_edge_pct} /></td>
                  <td className="text-right px-2 py-2"><TrendDelta value={r.risk_adjusted_edge_pct} /></td>
                  <td className="text-right px-2 py-2 text-slate-400 tabular-nums">n={r.sample_size}</td>
                  <td className="text-right px-2 py-2">
                    <ConfidenceChip confidence={r.confidence} sampleSize={r.sample_size} sources={[]} size="xs" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
        Shipping estimates are illustrative. Live freight varies by carrier, season, and animal weight.
        Import friction is a 0–1 score capturing CITES-adjacent friction; treat AU (0.95) and JP (0.8) opportunities as long-dated, not turnaround trades.
      </div>
    </div>
  );
}

function RegionPill({ code }) {
  return (
    <span className="inline-flex items-center justify-center rounded border border-slate-700 bg-slate-800 text-[10px] text-slate-200 px-1.5 py-0.5 font-semibold">
      {code}
    </span>
  );
}
