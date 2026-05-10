/**
 * Binary accent traits ,  portholes, kneecaps, drippy dorsal, etc.
 */

import { ACCENT_TRAITS } from '../data/traits';
import { Sparkles } from 'lucide-react';

export default function AccentTogglePanel({ accents, onToggle }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-emerald-400" />
        Accents &amp; Markings
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {ACCENT_TRAITS.map((a) => {
          const on = !!accents[a.id];
          return (
            <button
              key={a.id}
              onClick={() => onToggle(a.id)}
              className={`text-left px-2 py-1.5 rounded border text-xs transition ${
                on
                  ? 'bg-emerald-700 border-emerald-500 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
              title={a.description}
            >
              <div className="font-medium">{a.name}</div>
              <div className={`text-[10px] ${on ? 'text-emerald-100/80' : 'text-slate-500'}`}>
                {a.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
