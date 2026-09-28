/**
 * List-price helper for the Sell page: where a seller's asking price sits
 * in the asking-price range for geckos like theirs (same leading trait, age
 * and sex) on MorphMarket listings.
 *
 * Uses the Geck Data trait value table, like the Portfolio and the gecko
 * value estimate, so all three agree. Until 28 Sep 2026 this read a price
 * cache holding one row (Tiger, $420) and called it "recent sales".
 *
 * Usage:
 *   <MorphPriceIndex gecko={gecko} sellerPrice={450} />
 */
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { valueFromTraitTable } from '@/lib/traitValuation';
import { useAuth } from '@/lib/AuthContext';

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export default function MorphPriceIndex({ gecko, sellerPrice }) {
  const { user } = useAuth() || {};
  // The trait value table needs a real account; guest demo mode skips it.
  const isGuest = !!user?.is_guest;
  const [index, setIndex] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error

  useEffect(() => {
    if (isGuest) return undefined;
    let cancelled = false;
    loadTraitValueIndex()
      .then((idx) => { if (!cancelled) { setIndex(idx); setState('ready'); } })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [isGuest]);

  const priced = useMemo(
    () => (index && gecko ? valueFromTraitTable(gecko, index, 'breeder') : null),
    [index, gecko],
  );

  if (!gecko || isGuest) return null;
  if (state === 'loading') {
    return (
      <Card className="bg-slate-900 border-slate-700 animate-pulse">
        <CardContent className="py-4 text-center text-slate-500 text-sm">Loading listing prices...</CardContent>
      </Card>
    );
  }
  if (!priced) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="py-4 text-center text-slate-500 text-sm">
          {state === 'error'
            ? 'Listing prices could not load right now.'
            : 'No listing prices match this gecko’s traits yet. Add its traits to compare.'}
        </CardContent>
      </Card>
    );
  }

  const { band } = priced;
  const price = Number(sellerPrice) > 0 ? Number(sellerPrice) : null;
  const deviation = price ? Math.round(((price - band.p50) / band.p50) * 100) : null;
  const where = price == null ? null
    : price < band.p25 ? 'below the typical range'
      : price > band.p75 ? 'above the typical range' : 'within the typical range';
  const scaleMax = Math.max(band.p75 * 1.25, price || 0);
  const pct = (v) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100)).toFixed(0)}%`;

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-slate-100">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          Asking prices for {priced.trait}
          <Badge variant="outline" className="ml-auto text-xs text-slate-400 border-slate-600">
            {band.n} listings
          </Badge>
        </CardTitle>
        <p className="text-xs text-slate-500">MorphMarket listings, {priced.levelLabel}. Animals often sell for less than they are listed for.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-slate-500">Low</p>
            <p className="text-lg font-bold text-slate-300">{money(band.p25)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Median</p>
            <p className="text-lg font-bold text-emerald-400">{money(band.p50)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">High</p>
            <p className="text-lg font-bold text-slate-300">{money(band.p75)}</p>
          </div>
        </div>

        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-emerald-700 to-emerald-400 rounded-full"
            style={{ left: pct(band.p25), width: `calc(${pct(band.p75)} - ${pct(band.p25)})` }}
          />
          {price && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-emerald-400 shadow-lg"
              style={{ left: pct(price) }}
              title={`Your price: ${money(price)}`}
            />
          )}
        </div>

        {deviation !== null && (
          <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            where === 'within the typical range'
              ? 'bg-emerald-900/30 border border-emerald-600/30 text-emerald-300'
              : where === 'above the typical range'
                ? 'bg-amber-900/30 border border-amber-600/30 text-amber-300'
                : 'bg-blue-900/30 border border-blue-600/30 text-blue-300'
          }`}>
            {deviation > 0 ? <TrendingUp className="w-4 h-4 shrink-0" />
              : deviation < 0 ? <TrendingDown className="w-4 h-4 shrink-0" />
                : <Minus className="w-4 h-4 shrink-0" />}
            <span>
              {money(price)} is{' '}
              <strong>{Math.abs(deviation)}% {deviation > 0 ? 'above' : deviation < 0 ? 'below' : 'at'} the median</strong>{' '}
              asking price, {where}.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
