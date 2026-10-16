import { useMemo } from 'react';
import { AlertTriangle, ArrowDown, Dna } from 'lucide-react';
import { pct } from '@/lib/genetics/clutchMath';
import { summariseParents } from '@/lib/genetics/resultSummary';

const MAX_SHOWN = 4;

/**
 * The calculator's answer right under "Fill parents", where the member is
 * looking. The page makes it sticky while the gene pickers scroll past, so
 * changing a gene further down still shows the new answer; it stops
 * sticking when the full results reach the screen. "See the full odds"
 * jumps to them.
 *
 * Props: sire, dam (the same objects the full results use), resultsId
 * (the id of the full results block), className.
 */
export default function CalculatorResultSummary({ sire, dam, resultsId, className = '' }) {
  const summary = useMemo(() => summariseParents(sire, dam), [sire, dam]);
  if (!summary || summary.items.length === 0) return null;

  const shown = summary.items.slice(0, MAX_SHOWN);
  const more = summary.items.length - shown.length;
  const showAll = () => {
    document.getElementById(resultsId)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      aria-label="Result summary"
      className={`rounded-xl border border-slate-600 bg-slate-900/95 backdrop-blur px-3.5 py-2.5 shadow-lg shadow-black/40 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300 flex items-center gap-1.5">
          <Dna className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          Each egg{summary.uncertain ? ', allowing for possible hets' : ''}
        </p>
        <button
          type="button"
          onClick={showAll}
          className="shrink-0 inline-flex items-center gap-1 min-h-9 touch:min-h-11 rounded-md border border-slate-500 px-2.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
        >
          See the full odds
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
      <div role="status" aria-live="polite">
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-slate-100">
          {shown.map((item) => (
            <li key={item.label} className={item.lethal ? 'text-red-200' : undefined}>
              <span className="font-semibold">{pct(item.probability)}</span> {item.label}
              {item.lethal ? ' (dies in the egg)' : ''}
            </li>
          ))}
          {more > 0 && <li className="text-slate-300">and {more} more</li>}
        </ul>
        {summary.lethal.length > 0 && !shown.some((i) => i.lethal) && (
          <p className="mt-1 text-xs text-red-200 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            {pct(summary.lethal.reduce((s, l) => s + l.probability, 0))} of eggs carry a lethal combination. See the full odds.
          </p>
        )}
      </div>
    </section>
  );
}
