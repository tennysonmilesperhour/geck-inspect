import { useEffect, useState } from 'react';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { valueFromTraitTable, qualityTierFor, isCrestedGecko } from '@/lib/traitValuation';

/**
 * One line on the first gecko payoff screen: "Mango is worth about $400".
 *
 * Why: the full value card sits below the fold on a phone, so most new
 * members never see the estimate (docs/planning/activation-2026-10.md,
 * known limit 7). This puts the number inside the family card, at the
 * top of the screen. It uses the same session-cached trait value table
 * and the same model as the value card (src/lib/traitValuation.js), so
 * the two always agree.
 *
 * It renders nothing while the table loads, when it fails, or when the
 * gecko has no morph the table knows; the value card below handles
 * those cases and says why.
 */

export function valueLineText(name, value) {
  const amount = Math.round(Number(value) || 0);
  if (!name || amount <= 0) return null;
  return `${name} is worth about $${amount.toLocaleString('en-US')}`;
}

export default function ValueEstimateLine({ gecko, name }) {
  const [index, setIndex] = useState(null);
  const crested = Boolean(gecko) && isCrestedGecko(gecko);

  useEffect(() => {
    if (!crested) return undefined;
    let cancelled = false;
    loadTraitValueIndex()
      .then((loaded) => { if (!cancelled) setIndex(loaded); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [crested]);

  if (!crested || !index) return null;
  const estimate = valueFromTraitTable(gecko, index, qualityTierFor(gecko));
  const text = estimate ? valueLineText(name, estimate.value) : null;
  if (!text) return null;

  return (
    <p className="mt-1 text-xs font-medium text-emerald-300" data-testid="first-gecko-value-line">
      {text}
      <span className="font-normal text-slate-400"> (from {estimate.trait} asking prices)</span>
    </p>
  );
}
