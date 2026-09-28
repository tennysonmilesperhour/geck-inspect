import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { MarketplaceCost } from '@/entities/all';
import { pairingEggValue, viableEggCount } from '@/lib/pairingValue';
import { createPageUrl } from '@/utils';

const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-US')}`;

/**
 * Pairing value on a breeding plan: what one egg is worth on average
 * (genetics odds times hatchling asking prices), what the viable eggs so
 * far add up to, and the costs tied to this pairing in Business Tools.
 * Replaces the stand-alone Breeding ROI wizard, which asked for all of
 * this by hand.
 */
export default function PairingValuePanel({ plan, sire, dam, eggs = [] }) {
  const { user } = useAuth() || {};
  const isGuest = !!user?.is_guest;
  const [index, setIndex] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [costs, setCosts] = useState([]);

  useEffect(() => {
    if (isGuest) return undefined;
    let cancelled = false;
    loadTraitValueIndex()
      .then((idx) => { if (!cancelled) { setIndex(idx); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [isGuest]);

  useEffect(() => {
    if (isGuest || !plan?.id) return undefined;
    let cancelled = false;
    MarketplaceCost.filter({ breeding_plan_id: plan.id })
      .then((rows) => { if (!cancelled) setCosts(rows || []); })
      .catch(() => { if (!cancelled) setCosts([]); });
    return () => { cancelled = true; };
  }, [isGuest, plan?.id]);

  const value = useMemo(
    () => (index && sire && dam ? pairingEggValue(sire, dam, index) : null),
    [index, sire, dam],
  );

  if (isGuest || !sire || !dam) return null;

  const untagged = [sire, dam].filter((g) => !(g.morph_tags || []).length);
  const viable = viableEggCount(eggs);
  const costTotal = costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  let body;
  if (state === 'loading') {
    body = <p className="text-sm text-slate-400">Loading hatchling prices...</p>;
  } else if (state === 'error' || !value) {
    body = <p className="text-sm text-slate-400">Hatchling prices could not load right now.</p>;
  } else if (untagged.length === 2) {
    body = (
      <p className="text-sm text-slate-400">
        Add morph tags to {sire.name} and {dam.name} to estimate what their eggs are worth.
      </p>
    );
  } else {
    const eggsValue = value.perEgg * viable;
    const net = eggsValue - costTotal;
    body = (
      <div className="space-y-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold text-emerald-300 tabular-nums">{money(value.perEgg)}</span>
          <span className="text-sm text-slate-400">expected per egg</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-slate-900/70 border border-slate-700/60 p-2">
            <p className="text-[11px] text-slate-500">Viable eggs</p>
            <p className="text-sm font-semibold text-slate-100 tabular-nums">{viable} <span className="text-slate-400 font-normal">({money(eggsValue)})</span></p>
          </div>
          <div className="rounded-md bg-slate-900/70 border border-slate-700/60 p-2">
            <p className="text-[11px] text-slate-500">Tied costs</p>
            <p className="text-sm font-semibold text-orange-300 tabular-nums">{money(costTotal)}</p>
          </div>
          <div className="rounded-md bg-slate-900/70 border border-slate-700/60 p-2">
            <p className="text-[11px] text-slate-500">Expected net</p>
            <p className={`text-sm font-semibold tabular-nums ${net >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>{money(net)}</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 mb-1">Share of eggs by the trait that sets the price</p>
          <ul className="space-y-1">
            {value.groups.slice(0, 5).map((g) => (
              <li key={g.key} className="flex justify-between gap-2 text-xs">
                <span className={`truncate ${g.lethal ? 'text-red-300' : 'text-slate-300'}`}>
                  {Math.round(g.probability * 1000) / 10}% {g.label}
                </span>
                <span className="tabular-nums shrink-0 text-slate-400">{g.lethal ? '$0' : `${money(g.price)} each`}</span>
              </li>
            ))}
          </ul>
        </div>
        {value.lethalShare > 0 && (
          <p className="text-xs text-red-300">
            {Math.round(value.lethalShare * 100)}% of eggs are expected to carry a lethal combination and count as $0.
          </p>
        )}
        {untagged.length === 1 && (
          <p className="text-xs text-amber-300/80">
            {untagged[0].name} has no morph tags, so it counts as a plain gecko.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 mb-4 space-y-3">
      <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
        <DollarSign className="w-4 h-4 text-emerald-400" /> Pairing value
      </h4>
      {body}
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Median hatchling asking prices on MorphMarket for each outcome&apos;s traits. Babies often sell for less,
        and pattern quality moves the price most. Tie costs to this pairing and see real sales in{' '}
        <Link to={`${createPageUrl('MarketplaceSalesStats')}`} className="text-emerald-400 hover:text-emerald-300">Business Tools</Link>.
      </p>
    </div>
  );
}
