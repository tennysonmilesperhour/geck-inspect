import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { productionValue } from '@/lib/breedingValue';
import { currentSeasonYear } from '@/lib/seasons';

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

/**
 * Two small numbers on the Breeding page: what everything you have bred
 * is worth at today's asking prices, and what this season has produced so
 * far (src/lib/breedingValue.js). The eye button hides them, and the
 * choice is remembered in the page settings.
 */
export default function BreedingValueStats({ plans, eggs, geckos, visible, onToggle }) {
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible || index) return undefined;
    let cancelled = false;
    loadTraitValueIndex()
      .then((idx) => { if (!cancelled) setIndex(idx); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [visible, index]);

  const value = useMemo(
    () => (visible && index ? productionValue({ plans, eggs, geckos, index }) : null),
    [visible, index, plans, eggs, geckos],
  );

  const toggle = (
    <button
      type="button"
      onClick={() => onToggle(!visible)}
      className="touch:min-h-11 touch:min-w-11 inline-flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800"
      aria-label={visible ? 'Hide production value' : 'Show production value'}
      title={visible ? 'Hide production value' : 'Show production value'}
    >
      {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  if (!visible) {
    return <div className="flex justify-end -mt-2 mb-2">{toggle}</div>;
  }

  const title = 'Asking-price value of every viable egg: hatched geckos valued from their traits, age and grade, eggs still incubating at their pairing’s expected value per egg.';

  return (
    <div className="flex items-center gap-4 mb-4 flex-wrap" title={title}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">Lifetime value</span>
        <span className="text-sm font-semibold text-emerald-300 tabular-nums">
          {value ? money(value.lifetime) : failed ? 'n/a' : '...'}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">{currentSeasonYear()} season so far</span>
        <span className="text-sm font-semibold text-emerald-300 tabular-nums">
          {value ? money(value.season) : failed ? 'n/a' : '...'}
        </span>
        {value && <span className="text-[11px] text-slate-500">({value.seasonEggs} {value.seasonEggs === 1 ? 'egg' : 'eggs'})</span>}
      </div>
      <div className="ml-auto">{toggle}</div>
    </div>
  );
}
