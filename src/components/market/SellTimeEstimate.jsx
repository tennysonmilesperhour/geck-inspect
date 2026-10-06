import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Timer } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { estimateSellTime, formatSellDays, loadSellTimeModel } from '@/lib/sellTime';
import { upgradePromptClicked } from '@/lib/activation';
import { createPageUrl } from '@/utils';

const pct = (p) => `${Math.round(p * 100)}%`;
const shortDate = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * "Time to sell" block for the gecko value card and the Sell page price
 * helper: how long geckos with these traits, this age, sex and price
 * usually take to sell (src/lib/sellTime.js). Enterprise sees the
 * estimate; other plans see one locked line pointing at Enterprise.
 */
export default function SellTimeEstimate({ gecko, traitIndex, price = null, median = null, surface }) {
  const { user, isGuest } = useAuth() || {};
  const allowed = !isGuest && canUseFeature(user, 'market_intelligence');
  const [state, setState] = useState({ status: 'loading', model: null });

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    loadSellTimeModel()
      .then((model) => { if (!cancelled) setState({ status: 'ready', model }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', model: null }); });
    return () => { cancelled = true; };
  }, [allowed]);

  const title = (
    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
      <Timer className="w-3.5 h-3.5 text-violet-300" /> Time to sell
    </p>
  );

  if (!allowed) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
        {title}
        <p className="text-xs text-slate-400 flex items-start gap-1.5">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            How long geckos like this take to sell, from real MorphMarket sales, is part of Enterprise.{' '}
            <Link
              to={createPageUrl('Membership')}
              onClick={() => upgradePromptClicked('market_intelligence', surface || 'sell_time')}
              className="text-amber-300 hover:text-amber-200 font-medium"
            >
              See Enterprise
            </Link>
          </span>
        </p>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2" aria-busy="true">
        {title}
        <div className="h-4 w-2/3 rounded bg-slate-800 animate-pulse" />
      </div>
    );
  }

  const est = state.status === 'ready' ? estimateSellTime(gecko, state.model, traitIndex, { price, median }) : null;
  if (!est) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1">
        {title}
        <p className="text-xs text-slate-500">The time to sell estimate could not load right now.</p>
      </div>
    );
  }

  const model = state.model;
  const reasons = [
    ...est.faster.slice(0, 3).map((r) => ({ ...r, faster: true })),
    ...est.slower.slice(0, 3).map((r) => ({ ...r, faster: false })),
  ];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-2">
      {title}
      <p className="text-sm text-slate-200">
        Half of geckos like this sell within <strong className="text-violet-200">{formatSellDays(est.medianDays)}</strong>
        <span className="text-slate-500"> (whole market: {formatSellDays(est.marketMedianDays)})</span>.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md bg-slate-950/60 px-2.5 py-1.5">
          <p className="text-[11px] text-slate-500">Sold within 2 weeks</p>
          <p className="text-base font-semibold text-slate-100">{pct(est.within14)}</p>
        </div>
        <div className="rounded-md bg-slate-950/60 px-2.5 py-1.5">
          <p className="text-[11px] text-slate-500">Sold within a month</p>
          <p className="text-base font-semibold text-slate-100">{pct(est.within30)}</p>
        </div>
      </div>
      {reasons.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {reasons.map((r) => (
            <li
              key={`${r.dim}:${r.key}`}
              className={`text-[11px] rounded-full px-2 py-0.5 border ${r.faster
                ? 'border-emerald-700/60 bg-emerald-900/30 text-emerald-200'
                : 'border-amber-700/60 bg-amber-900/30 text-amber-200'}`}
              title={`Sells ${Math.round(Math.abs(r.factor - 1) * 100)}% ${r.factor > 1 ? 'faster' : 'slower'} than the market`}
            >
              {r.faster ? 'Faster: ' : 'Slower: '}{r.label}
            </li>
          ))}
        </ul>
      )}
      {!price && (
        <p className="text-[11px] text-slate-500">Set an asking price to see how your price changes this.</p>
      )}
      <p className="text-[11px] text-slate-500 leading-relaxed">
        From {Number(model.listings).toLocaleString()} crested gecko listings on MorphMarket whose sales were
        tracked {shortDate(model.window.from)} to {shortDate(model.window.to)} ({Number(model.sold).toLocaleString()} sold).
        Times past a month are projected from that pace. An estimate, not a promise.
      </p>
    </div>
  );
}
