import { formatUsd } from '@/lib/marketHabit';

/**
 * Where a price sits among similar geckos: the typical range (middle half
 * of similar listings, p25 to p75) as a band, the middle price as a tick,
 * and the listing's price (and optionally a guess) as markers. The scale
 * runs from half the low end to one and a half times the high end, so a
 * price well outside the range still shows at the edge.
 */
export default function PriceBandBar({ price, p25, p50, p75, guess = null, compact = false }) {
  const lo = Number(p25);
  const hi = Number(p75);
  if (!(lo > 0) || !(hi > 0)) return null;
  const min = lo * 0.5;
  const max = hi * 1.5;
  const at = (v) => `${Math.min(100, Math.max(0, ((Number(v) - min) / (max - min)) * 100))}%`;

  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'}>
      <div className="relative h-2 rounded-full bg-slate-800" aria-hidden="true">
        <div
          className="absolute top-0 h-2 rounded-full bg-emerald-700/50"
          style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }}
        />
        {Number(p50) > 0 && (
          <div className="absolute -top-0.5 h-3 w-px bg-emerald-300/80" style={{ left: at(p50) }} />
        )}
        {Number(guess) > 0 && (
          <div
            className="absolute -top-1 h-4 w-1 -ml-0.5 rounded-full bg-sky-400"
            style={{ left: at(guess) }}
            title={`Your guess ${formatUsd(guess)}`}
          />
        )}
        {Number(price) > 0 && (
          <div
            className="absolute -top-1 h-4 w-1 -ml-0.5 rounded-full bg-amber-300"
            style={{ left: at(price) }}
            title={`Asking ${formatUsd(price)}`}
          />
        )}
      </div>
      {!compact && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Similar geckos usually ask {formatUsd(lo)} to {formatUsd(hi)}, middle {formatUsd(p50)}.
        </p>
      )}
    </div>
  );
}
