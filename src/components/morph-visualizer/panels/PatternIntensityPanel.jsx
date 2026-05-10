/**
 * Intensity slider for polygenic pattern traits ,  harlequin, flame,
 * pinstripe, dalmatian, tiger, brindle, patternless, phantom.
 *
 * Polygenic traits can't be Punnett-squared so we use a 0-4 ladder
 * instead of a zygosity picker.
 */

import { PATTERN_TRAITS } from '../data/traits';
import { Waves } from 'lucide-react';

const STEP_LABELS = ['None', 'Trace', 'Partial', 'Strong', 'Extreme'];

export default function PatternIntensityPanel({ patterns, onChange }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Waves className="w-4 h-4 text-emerald-400" />
        Pattern Traits
        <span className="text-xs font-normal text-slate-500 ml-1">(polygenic ,  dial 0→extreme)</span>
      </h3>

      <div className="space-y-2.5">
        {PATTERN_TRAITS.map((p) => {
          const value = patterns[p.id] || 0;
          return (
            <div key={p.id} className="bg-slate-900 border border-slate-700 rounded-md px-3 py-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-slate-100 font-medium">{p.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">{STEP_LABELS[value]}</span>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((step) => {
                  const active = step <= value && value > 0;
                  return (
                    <button
                      key={step}
                      onClick={() => onChange(p.id, step)}
                      className={`h-5 flex-1 rounded-sm transition-all ${
                        step === 0
                          ? value === 0
                            ? 'bg-slate-700 ring-1 ring-slate-500'
                            : 'bg-slate-800 hover:bg-slate-700'
                          : active
                          ? step === 4
                            ? 'bg-amber-500'
                            : step === 3
                            ? 'bg-emerald-500'
                            : step === 2
                            ? 'bg-emerald-600'
                            : 'bg-emerald-700'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                      aria-label={`${p.name} ${STEP_LABELS[step]}`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
