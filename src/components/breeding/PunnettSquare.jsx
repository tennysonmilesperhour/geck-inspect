import { Fragment, useState } from 'react';
import { getTrait } from '@/lib/genetics';
import { WILD_TYPE } from '@/lib/genetics';

/**
 * Interactive 2x2 Punnett square for one gene.
 *
 * The teaching move (borrowed from genetics-education research): hover
 * a cell and the two parent gametes that made it light up, so "each
 * parent passes exactly ONE of its two copies, at random" stops being
 * an abstraction. This targets the classic misconception of reading
 * the square as a rote grid detached from what actually happens.
 */

function alleleLabel(allele) {
  if (allele === WILD_TYPE) return 'wild-type';
  return getTrait(allele)?.name || allele;
}

function alleleShort(allele) {
  if (allele === WILD_TYPE) return 'wt';
  const name = getTrait(allele)?.name || allele;
  return name.length > 10 ? `${name.slice(0, 9)}.` : name;
}

export default function PunnettSquare({ sirePair, damPair, outcomes }) {
  const [hover, setHover] = useState(null); // {row, col}

  const phenotypeFor = (a, b) => {
    const want = [a, b].sort().join('|');
    const hit = (outcomes || []).find(
      (o) => [...o.genotype].sort().join('|') === want,
    );
    return hit?.phenotype_label || 'Wild-type';
  };

  const headCls = (active) =>
    `text-[11px] px-2 py-1.5 text-center font-mono rounded transition-colors ${
      active ? 'bg-purple-600/40 text-purple-100' : 'bg-slate-700/60 text-slate-300'
    }`;

  return (
    <div className="mt-3">
      <p className="text-xs text-slate-500 mb-2">
        Each parent passes one of its two copies, at random, to every egg. Hover a box to trace
        which copy came from which parent.
      </p>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: 'minmax(60px, auto) 1fr 1fr', maxWidth: '24rem' }}
        onMouseLeave={() => setHover(null)}
      >
        <div className="text-[10px] text-slate-500 flex items-end justify-center pb-1">
          <span>♀ \ ♂</span>
        </div>
        {sirePair.map((a, col) => (
          <div key={`c${col}`} className={headCls(hover && hover.col === col)} title={`Sire passes ${alleleLabel(a)}`}>
            ♂ {alleleShort(a)}
          </div>
        ))}
        {damPair.map((b, row) => (
          <Fragment key={`row${row}`}>
            <div className={headCls(hover && hover.row === row)} title={`Dam passes ${alleleLabel(b)}`}>
              ♀ {alleleShort(b)}
            </div>
            {sirePair.map((a, col) => {
              const label = phenotypeFor(a, b);
              const isSuper = label.toLowerCase().startsWith('super');
              const isWt = label === 'Wild-type';
              const active = hover && hover.row === row && hover.col === col;
              return (
                <button
                  key={`cell${row}${col}`}
                  type="button"
                  onMouseEnter={() => setHover({ row, col })}
                  onFocus={() => setHover({ row, col })}
                  onBlur={() => setHover(null)}
                  className={`rounded border px-2 py-2 text-left transition-colors cursor-default ${
                    active
                      ? 'border-purple-400 bg-purple-950/50'
                      : 'border-slate-700 bg-slate-900/50'
                  }`}
                >
                  <span
                    className={`block text-xs ${
                      isSuper ? 'text-yellow-300 font-semibold' : isWt ? 'text-slate-400' : 'text-emerald-300'
                    }`}
                  >
                    {label}
                  </span>
                  <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                    {alleleShort(a)} / {alleleShort(b)} · 25%
                  </span>
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
