import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Loader2, Sunrise, UserPlus, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gecko } from '@/entities/all';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { qualityTierFor, valueFromTraitTable } from '@/lib/traitValuation';
import { DEMO_TRAIT_ROWS, DEMO_TRAIT_VALUES_AS_OF } from '@/data/demoTraitValues';
import { captureEvent } from '@/lib/posthog';
import { friendlyDay } from '@/lib/firstGeckoFlow';

const usd = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

// Morphs a newcomer has heard of, in the order the brief lists them.
const SHOWN_MORPHS = ['Sable', 'Axanthic', 'Lilly White', 'Cappuccino', 'Extreme Harlequin', 'Phantom', 'Dalmatian', 'Harlequin', 'Pinstripe'];

/**
 * The Market page in the guest demo. The live brief is members-only (it
 * reads today's listings and the member's own geckos), so the demo shows
 * the part the landing page promises, "see what every gecko is worth":
 * each sample gecko priced from a dated snapshot of the Geck Data trait
 * table, plus the middle asking price by morph. Everything is labelled as
 * a sample; nothing here pretends to be today's market.
 */
export default function DemoMarketBrief() {
  const [state, setState] = useState({ status: 'loading', rows: [] });

  useEffect(() => {
    let cancelled = false;
    captureEvent('market_view', { surface: 'demo' });
    (async () => {
      try {
        const [index, geckos] = await Promise.all([loadTraitValueIndex(), Gecko.list()]);
        const rows = (geckos || [])
          .filter((g) => !g.archived)
          .map((g) => ({ gecko: g, estimate: valueFromTraitTable(g, index, qualityTierFor(g)) }))
          .filter((r) => r.estimate)
          .sort((a, b) => b.estimate.value - a.estimate.value);
        if (!cancelled) setState({ status: 'ready', rows, total: (geckos || []).filter((g) => !g.archived).length });
      } catch {
        if (!cancelled) setState({ status: 'error', rows: [] });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const morphs = SHOWN_MORPHS
    .map((name) => DEMO_TRAIT_ROWS.find(([trait, age]) => trait === name && age === 'any'))
    .filter(Boolean);
  const low = state.rows.reduce((s, r) => s + r.estimate.band.p25, 0);
  const high = state.rows.reduce((s, r) => s + r.estimate.band.p75, 0);
  const asOf = friendlyDay(DEMO_TRAIT_VALUES_AS_OF);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-yellow-300/40 bg-yellow-400/10 p-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-yellow-200 shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-50/90">
          Sample brief for the demo collection, priced from real listing data as of {asOf}. Members get the live version
          every morning: new listings and price cuts in their morphs, rare sightings, watchlists and Guess the Price.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-slate-100 text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" /> What every demo gecko is worth
          </CardTitle>
          {state.status === 'ready' && state.rows.length > 0 && (
            <p className="text-sm text-slate-300">
              The collection: <span className="font-semibold text-white">{usd(low)} to {usd(high)}</span>
              {' '}({state.rows.length} of {state.total} priced from similar listings).
            </p>
          )}
        </CardHeader>
        <CardContent>
          {state.status === 'loading' && (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Pricing the demo collection</p>
          )}
          {state.status === 'error' && <p className="text-sm text-slate-400">The sample prices could not load.</p>}
          {state.status === 'ready' && (
            <ul className="divide-y divide-slate-800">
              {state.rows.slice(0, 8).map(({ gecko, estimate }) => (
                <li key={gecko.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{gecko.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{estimate.trait}, {estimate.levelLabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-100">{usd(estimate.value)}</p>
                    <p className="text-[11px] text-slate-500">typical {usd(estimate.band.p25)} to {usd(estimate.band.p75)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-500 mt-3">Asking prices on listings, not sale prices. An estimate, not an appraisal.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-slate-100 text-base flex items-center gap-2">
            <Sunrise className="w-4 h-4 text-amber-300" /> Middle asking price by morph
          </CardTitle>
          <p className="text-xs text-slate-500">All ages and sexes, crested gecko listings tracked by Geck Data, {asOf}.</p>
        </CardHeader>
        <CardContent>
          {morphs.map(([trait, , n, p25, p50, p75]) => (
            <div key={trait} className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-100">{trait}</p>
                <p className="text-[11px] text-slate-500">{n.toLocaleString('en-US')} listings</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm text-slate-100">Middle {usd(p50)}</p>
                <p className="text-[11px] text-slate-500">{usd(p25)} to {usd(p75)}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100">See what your own gecko is worth</p>
          <p className="text-xs text-slate-400 mt-0.5">Create a free account, add your gecko with its morph, and the estimate shows on its record.</p>
        </div>
        <Link
          to={`/AuthPortal?mode=signup&redirect=${encodeURIComponent('/MyGeckos?add=1')}`}
          onClick={() => captureEvent('landing_cta_clicked', { target: 'demo_market_signup' })}
          className="inline-flex items-center justify-center gap-1.5 min-h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 text-sm font-semibold text-white shrink-0"
        >
          <UserPlus className="w-4 h-4" /> Create free account
        </Link>
      </div>
    </div>
  );
}
