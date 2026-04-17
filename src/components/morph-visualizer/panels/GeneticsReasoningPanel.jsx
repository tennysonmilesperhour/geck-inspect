/**
 * Genetics reasoning panel — explains, in plain English, WHY the preview
 * looks the way it does. Pulls directly from the phenotype.reasoning
 * trace plus the trait catalog.
 *
 * This is the teaching layer of the visualizer.
 */

import { TRAITS_BY_ID } from '../data/traits';
import { detectWarnings } from '../data/genetics';
import { BookOpen, AlertTriangle, Info, XOctagon } from 'lucide-react';

export default function GeneticsReasoningPanel({ phenotype, selections }) {
  const warnings = detectWarnings(selections);

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-emerald-400" />
        Why this gecko looks this way
      </h3>

      {/* Active morphs list — for each, show the trait explanation */}
      <div className="space-y-2">
        {phenotype.activeMorphs.length === 0 && (
          <div className="text-xs text-slate-500 italic">
            No morphs selected — this is a wild-type gecko showing its polygenic base color.
          </div>
        )}

        {phenotype.activeMorphs.map((m) => {
          const trait = TRAITS_BY_ID[m.id];
          if (!trait) return null;
          const summary = trait.genetics?.summary || trait.description;
          return (
            <div key={m.id + (m.zygosity || '') + (m.intensity || '')} className="bg-slate-900 border-l-2 border-emerald-500 rounded-r-md px-3 py-2">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <span className="text-sm text-slate-100 font-medium">{trait.name}</span>
                <span className="text-[10px] text-emerald-400 uppercase tracking-wide">
                  {trait.genetics?.type?.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">{summary}</p>
            </div>
          );
        })}
      </div>

      {/* Reasoning trace from the phenotype resolver */}
      {phenotype.reasoning.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            Interaction trace
          </h4>
          <ul className="space-y-1">
            {phenotype.reasoning.map((r, i) => (
              <li key={i} className="text-[11px] text-slate-400 bg-slate-900/50 border border-slate-800 rounded px-2 py-1">
                <span className="text-slate-300 font-medium">{TRAITS_BY_ID[r.trait]?.name || r.trait}:</span> {r.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings — lethals, incompatibilities */}
      {warnings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`flex gap-2 px-2.5 py-1.5 rounded text-[11px] border ${
                w.severity === 'lethal'
                  ? 'bg-red-950/50 border-red-800 text-red-200'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
              }`}
            >
              {w.severity === 'lethal' ? (
                <XOctagon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-semibold">{w.title}</div>
                <div className="opacity-90">{w.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
