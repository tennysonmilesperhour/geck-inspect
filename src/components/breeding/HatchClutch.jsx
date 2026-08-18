import { useMemo, useRef, useState } from 'react';
import { Egg, RotateCcw } from 'lucide-react';
import { EGGS_PER_CLUTCH } from '@/lib/genetics/clutchMath';

/**
 * Hatch-a-clutch: roll real dice, two eggs at a time.
 *
 * The point is experiential statistics. Percentages tell a breeder
 * what to expect; hatching simulated clutches teaches what variance
 * FEELS like: streaks of misses are normal, each egg is an
 * independent draw, and nothing is "due" (the gambler's fallacy is
 * the most common odds mistake in breeding forums). The running
 * tally against expectation makes that lesson concrete.
 */

function sampleOutcome(phenotypes) {
  const r = Math.random();
  let cumulative = 0;
  for (const p of phenotypes) {
    cumulative += p.probability;
    if (r <= cumulative) return p;
  }
  return phenotypes[phenotypes.length - 1];
}

function outcomeTone(outcome) {
  if (outcome.health_risk === 'lethal') return 'border-red-700 bg-red-950/50 text-red-300';
  const label = outcome.phenotype_description || '';
  if (label === 'Wild-type') return 'border-slate-600 bg-slate-800 text-slate-300';
  return 'border-emerald-700 bg-emerald-950/40 text-emerald-300';
}

export default function HatchClutch({ phenotypes, labelFor }) {
  const [hatched, setHatched] = useState([]); // all eggs, newest clutch last
  const [revealCount, setRevealCount] = useState(0);
  const timerRef = useRef(null);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

  const hatchClutch = () => {
    const clutch = Array.from({ length: EGGS_PER_CLUTCH }, () => sampleOutcome(phenotypes));
    const next = [...hatched, ...clutch];
    setHatched(next);
    if (reducedMotion) {
      setRevealCount(next.length);
      return;
    }
    // Reveal the new eggs one at a time.
    setRevealCount(next.length - EGGS_PER_CLUTCH);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRevealCount((c) => {
        if (c >= next.length) {
          clearInterval(timerRef.current);
          return c;
        }
        return c + 1;
      });
    }, 450);
  };

  const reset = () => {
    clearInterval(timerRef.current);
    setHatched([]);
    setRevealCount(0);
  };

  const tally = useMemo(() => {
    const counts = new Map();
    for (const o of hatched.slice(0, revealCount)) {
      const key = o.phenotype_description || 'Wild-type';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [hatched, revealCount]);

  const revealed = hatched.slice(0, revealCount);
  const lastClutch = hatched.slice(-EGGS_PER_CLUTCH);
  const eggsTotal = hatched.length;

  if (!phenotypes || phenotypes.length === 0) return null;

  return (
    <div className="border-t border-slate-700 pt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">Hatch a simulated clutch</h4>
          <p className="text-xs text-slate-500">
            Real dice, two eggs at a time. Every egg is an independent draw; streaks are normal
            and nothing is ever "due."
          </p>
        </div>
        <div className="flex items-center gap-2">
          {eggsTotal > 0 && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> reset
            </button>
          )}
          <button
            type="button"
            onClick={hatchClutch}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-purple-500/60 bg-purple-600/20 text-purple-200 hover:bg-purple-600/30 inline-flex items-center gap-1.5"
          >
            <Egg className="w-3.5 h-3.5" />
            Hatch a clutch
          </button>
        </div>
      </div>

      {lastClutch.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {lastClutch.map((o, i) => {
            const shown = revealCount >= eggsTotal - EGGS_PER_CLUTCH + i + 1;
            return (
              <div
                key={`${eggsTotal}-${i}`}
                className={`rounded-lg border px-3 py-2 text-sm transition-all duration-300 ${
                  shown ? outcomeTone(o) : 'border-slate-700 bg-slate-800 text-slate-500'
                }`}
                aria-live="polite"
              >
                {shown ? (
                  <>
                    {labelFor ? labelFor(o) : o.phenotype_description}
                    {o.health_risk === 'lethal' && (
                      <span className="block text-[10px] text-red-400">did not develop</span>
                    )}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Egg className="w-4 h-4 animate-pulse" /> hatching...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {revealed.length >= EGGS_PER_CLUTCH && (
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">
            {revealed.length} eggs hatched so far
          </p>
          {[...tally.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => {
              const expected = (phenotypes.find((p) => (p.phenotype_description || 'Wild-type') === label)?.probability || 0) * revealed.length;
              return (
                <p key={label} className="font-mono">
                  {count}x {label}
                  <span className="text-slate-600"> (expected {expected.toFixed(1)})</span>
                </p>
              );
            })}
        </div>
      )}
    </div>
  );
}
