/**
 * Preset gallery ,  one-click iconic morphs so users can seed the visualizer
 * with well-known crested gecko looks and see exactly what the genotype does.
 */

import { PRESETS } from '../data/presets';
import { Wand2 } from 'lucide-react';

export default function PresetGallery({ onApply, currentPresetId }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Wand2 className="w-4 h-4 text-emerald-400" />
        Iconic Presets
      </h3>

      <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
        {PRESETS.map((p) => {
          const active = currentPresetId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onApply(p.id)}
              className={`text-left rounded-md border p-2 transition ${
                active
                  ? 'bg-emerald-900/60 border-emerald-500 ring-2 ring-emerald-500/30'
                  : 'bg-slate-900 border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-semibold text-slate-100 truncate">{p.name}</span>
                <span className="text-[10px] text-amber-400 flex-shrink-0">
                  {'★'.repeat(p.rarityTier)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug line-clamp-3">
                {p.description}
              </p>
              <div className="text-[10px] text-emerald-400 mt-1 font-mono">≈ ${p.valueHint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
