/**
 * Structural / physical trait controls — crests, crowned, furred, tail,
 * eye color. These are static structural traits (not genetic) that change
 * the silhouette or hue without affecting pattern genetics.
 */

import { STRUCTURAL_TRAITS } from '../data/traits';
import { Shapes } from 'lucide-react';

export default function StructuralPanel({ structural, onChange }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Shapes className="w-4 h-4 text-emerald-400" />
        Structural &amp; Physical
      </h3>

      <div className="space-y-2">
        {STRUCTURAL_TRAITS.map((t) => {
          if (t.type === 'toggle') {
            const on = !!structural[t.id];
            return (
              <button
                key={t.id}
                onClick={() => onChange(t.id, !on)}
                className={`w-full text-left px-2.5 py-1.5 rounded border text-xs transition ${
                  on ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
                title={t.description}
              >
                <div className="font-medium">{t.name}</div>
                <div className={`text-[10px] ${on ? 'text-emerald-100/80' : 'text-slate-500'}`}>{t.description}</div>
              </button>
            );
          }
          // choice
          const current = structural[t.id] || t.default;
          return (
            <div key={t.id} className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-200 font-medium">{t.name}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {t.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onChange(t.id, opt)}
                    className={`px-2 py-0.5 text-[11px] rounded border transition capitalize ${
                      current === opt
                        ? 'bg-slate-700 border-slate-400 text-slate-100'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.replace('_', ' ')}
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
