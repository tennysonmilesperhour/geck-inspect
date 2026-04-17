/**
 * Base color picker — grid of swatches with rarity indicators.
 */

import { BASE_COLORS } from '../data/traits';
import { Palette } from 'lucide-react';

function RarityDots({ tier }) {
  return (
    <span className="flex gap-[2px]">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`w-1 h-1 rounded-full ${n <= tier ? 'bg-amber-400' : 'bg-slate-700'}`}
        />
      ))}
    </span>
  );
}

export default function BaseColorPicker({ selected, onSelect }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Palette className="w-4 h-4 text-emerald-400" />
        Base Color
        <span className="text-xs font-normal text-slate-500 ml-1">(polygenic)</span>
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {BASE_COLORS.map((c) => {
          const isSelected = selected === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`group relative rounded-md border-2 transition-all overflow-hidden ${
                isSelected ? 'border-emerald-400 scale-[1.03] shadow-lg shadow-emerald-500/30' : 'border-slate-700 hover:border-slate-500'
              }`}
              title={c.name}
            >
              <div className="h-10" style={{ background: c.hex }} />
              <div className="px-1.5 py-1 bg-slate-900">
                <div className="text-[10px] text-slate-200 font-medium truncate text-left">{c.name}</div>
                <RarityDots tier={c.rarity} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
