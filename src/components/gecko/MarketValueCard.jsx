import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createPageUrl } from '@/utils';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { valueFromTraitTable, qualityTierFor, isCrestedGecko } from '@/lib/traitValuation';
import { KEEPER_MODE_STORAGE_KEY } from '@/lib/navItems';
import { isGuestMode } from '@/lib/guestMode';

/**
 * "Estimated value" card for the gecko detail page.
 *
 * Cross-references the gecko's selected morph traits with the Geck Data
 * trait value table (asking prices on crested gecko listings, by age and
 * sex) and shows an estimate, the typical range, and where the owner's
 * asking price sits in it. Same model as the Collection Portfolio, see
 * src/lib/traitValuation.js.
 *
 * Owner-only by design: it is the keeper's private read on their own
 * animal, and a buyer seeing a lower estimate beside a seller's asking
 * price would undercut the seller. The RPC is also signed-in only.
 *
 * Props:
 *   gecko, the gecko row, with weight_grams set to the latest weight
 *
 * The Portfolio is a Breeder-mode page (breederOnly in navItems.js), so
 * the link to it is left out when the viewer has Keeper mode on.
 *
 * Renders nothing for other species or when the table fails to load.
 * With no matching traits it shows a prompt to add them instead.
 */

function formatCurrency(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString()}`;
}

const TIER_LABELS = {
  pet: 'Pet grade',
  breeder: 'Breeder grade',
  high_end: 'High-end grade',
  investment: 'Investment grade',
};

function isKeeperMode() {
  try { return localStorage.getItem(KEEPER_MODE_STORAGE_KEY) === '1'; }
  catch { return false; }
}

function askingNote(asking, band) {
  if (!asking) return null;
  const where = asking < band.p25
    ? 'below the typical range'
    : asking > band.p75 ? 'above the typical range' : 'within the typical range';
  return `Your asking price of ${formatCurrency(asking)} is ${where}.`;
}

export default function MarketValueCard({ gecko }) {
  const [state, setState] = useState({ status: 'loading', index: null });
  const crested = Boolean(gecko) && isCrestedGecko(gecko);

  // The index is session-cached and does not depend on the gecko, so load
  // it once rather than on every new gecko object the parent passes.
  useEffect(() => {
    if (!crested) return undefined;
    let cancelled = false;
    loadTraitValueIndex()
      .then((index) => { if (!cancelled) setState({ status: 'ready', index }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', index: null }); });
    return () => { cancelled = true; };
  }, [crested]);

  if (!crested || state.status === 'error') return null;

  const header = (
    <CardHeader className="pb-2 pt-4 px-4">
      <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-100">
        <Wallet className="w-4 h-4 text-emerald-400" /> Estimated Value
        <Badge variant="outline" className="ml-auto text-[10px] font-medium bg-teal-900/40 border-teal-700 text-teal-200">
          Geck Data
        </Badge>
      </CardTitle>
    </CardHeader>
  );

  if (state.status === 'loading') {
    return (
      <Card>
        {header}
        <CardContent className="px-4 pb-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking market listings...
        </CardContent>
      </Card>
    );
  }

  const tier = qualityTierFor(gecko);
  const estimate = valueFromTraitTable(gecko, state.index, tier);

  if (!estimate) {
    return (
      <Card>
        {header}
        <CardContent className="px-4 pb-4 space-y-3">
          <p className="text-sm text-slate-400">
            Add morph traits like Lilly White, Harlequin, or Axanthic to this gecko and Geck Inspect will estimate
            its value from real crested gecko listings.
          </p>
          <Link
            to={createPageUrl('MyGeckos')}
            className="touch:min-h-11 inline-flex text-sm font-medium text-emerald-400 hover:text-emerald-300"
          >
            Add traits in My Geckos
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { band } = estimate;
  const span = Math.max(1, band.p75 - band.p25);
  const pct = (v) => `${Math.min(100, Math.max(0, ((v - band.p25) / span) * 100))}%`;
  const asking = Number(gecko.asking_price) > 0 ? Number(gecko.asking_price) : null;
  const hasGrade = Boolean(gecko.pattern_grade) || Number(gecko.quality_score) > 0;
  const showPortfolioLink = !isKeeperMode();

  return (
    <Card>
      {header}
      <CardContent className="px-4 pb-4 space-y-3">
        <div>
          <p className="text-3xl font-bold text-slate-100">{formatCurrency(estimate.value)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {estimate.trait}, {estimate.levelLabel}: median {formatCurrency(band.p50)} across {band.n} listings.
            {' '}{TIER_LABELS[estimate.tier]} priced at {estimate.positionLabel}.
          </p>
        </div>

        {/* Typical range (p25 to p75) with the estimate and asking price marked. */}
        <div>
          <div className="relative h-2 rounded-full bg-gradient-to-r from-teal-900 via-teal-700 to-teal-900">
            <span
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900"
              style={{ left: pct(estimate.value) }}
              title={`Estimate ${formatCurrency(estimate.value)}`}
            />
            {asking && (
              <span
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-yellow-400 ring-2 ring-slate-900"
                style={{ left: pct(asking) }}
                title={`Asking ${formatCurrency(asking)}`}
              />
            )}
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-1.5">
            <span>{formatCurrency(band.p25)} typical low</span>
            <span>{formatCurrency(band.p75)} typical high</span>
          </div>
        </div>

        {asking && <p className="text-xs text-yellow-300/90">{askingNote(asking, band)}</p>}

        {estimate.matchedTraits.length > 1 && (
          <p className="text-xs text-slate-500">
            Matched traits: {estimate.matchedTraits.join(', ')}. The most valuable one sets the price.
          </p>
        )}

        {(!hasGrade || showPortfolioLink) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {!hasGrade && (
              <Link to={`/QualityScale?geckoId=${gecko.id}`} className="text-emerald-400 hover:text-emerald-300">
                Grade this gecko to refine the estimate
              </Link>
            )}
            {showPortfolioLink && (
              <Link to={createPageUrl('Portfolio')} className="text-emerald-400 hover:text-emerald-300">
                See your whole collection&apos;s value
              </Link>
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          Based on asking prices from crested gecko listings tracked by Geck Data. An estimate, not an appraisal.
          {isGuestMode() && ' Demo: prices from a snapshot taken 5 Oct 2026; members see them updated with each market check.'}
        </p>
      </CardContent>
    </Card>
  );
}
