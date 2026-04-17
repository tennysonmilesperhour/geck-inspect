/**
 * Environmental state controls — fire state, age, shed state.
 * Not inherited, but dramatically change how a gecko looks.
 */

import { ENVIRONMENTAL_TRAITS } from '../data/traits';
import { Thermometer } from 'lucide-react';

const LABELS = {
  fired_up: 'Fired Up',
  fired_down: 'Fired Down',
  neutral: 'Neutral',
  juvenile: 'Juvenile',
  adult: 'Adult',
  normal: 'Normal',
  pre_shed: 'Pre-shed',
};

export default function EnvironmentalPanel({ environmental, onChange }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Thermometer className="w-4 h-4 text-emerald-400" />
        Environmental State
        <span className="text-xs font-normal text-slate-500 ml-1">(not inherited)</span>
      </h3>

      <div className="space-y-2">
        {ENVIRONMENTAL_TRAITS.map((t) => {
          const current = environmental[t.id] || t.default;
          return (
            <div key={t.id} className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5">
              <span className="text-xs text-slate-200 font-medium block mb-1">{t.name}</span>
              <div className="flex gap-1 flex-wrap">
                {t.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onChange(t.id, opt)}
                    className={`px-2 py-0.5 text-[11px] rounded border transition ${
                      current === opt
                        ? 'bg-slate-700 border-slate-400 text-slate-100'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {LABELS[opt] || opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
