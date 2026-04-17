/**
 * Rarity + value panel — shows a tier label, an estimated USD range,
 * and the breakdown of which traits are contributing.
 */

import { estimateRarityAndValue } from '../engine/rarity';
import { Star, DollarSign } from 'lucide-react';

const TIER_COLORS = {
  1: 'bg-slate-700 text-slate-200',
  2: 'bg-emerald-700 text-emerald-100',
  3: 'bg-amber-600 text-amber-50',
  4: 'bg-purple-700 text-purple-100',
  5: 'bg-rose-600 text-rose-50',
};

export default function RarityValuePanel({ phenotype, selections }) {
  const { tier, tierLabel, valueFloor, valueCeiling, contributions } = estimateRarityAndValue(phenotype, selections);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-400" />
        Rarity &amp; Estimated Value
      </h3>

      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Rarity tier</div>
            <div className="flex items-center gap-1 mt-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`w-4 h-4 ${n <= tier ? 'fill-amber-400 text-amber-400' : 'text-slate-700'}`}
                />
              ))}
              <span className={`ml-1.5 px-2 py-0.5 rounded text-[10px] font-medium ${TIER_COLORS[tier]}`}>
                {tierLabel}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Est. retail</div>
            <div className="flex items-center text-emerald-300 text-lg font-bold">
              <DollarSign className="w-4 h-4" />
              {valueFloor}
              <span className="text-slate-500 mx-1 text-sm">–</span>
              {valueCeiling}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-2">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Breakdown</div>
          <div className="space-y-0.5">
            {contributions.map((c, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span className="text-slate-300">{c.source}</span>
                <span className="text-emerald-400 font-mono">+${c.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[10px] text-slate-500 leading-snug pt-1 border-t border-slate-800">
          Illustrative retail range only. Actual market prices depend on expression quality,
          breeder reputation, proven genetics, and sex.
        </div>
      </div>
    </div>
  );
}
