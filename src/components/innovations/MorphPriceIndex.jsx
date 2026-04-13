/**
 * MorphPriceIndex — community price intelligence widget.
 *
 * Shows comparable sale prices for a given morph, and inline feedback
 * when a seller sets their price ("12% above average").
 *
 * Reads from MorphPriceCache entity. Falls back gracefully if no data.
 *
 * Usage:
 *   <MorphPriceIndex morph="Lilly White" sellerPrice={450} />
 */
import React, { useState, useEffect, useMemo } from 'react';
import { MorphPriceCache } from '@/api/supabaseEntities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, DollarSign, BarChart3 } from 'lucide-react';

function formatCurrency(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

export default function MorphPriceIndex({ morph, sellerPrice }) {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!morph) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const records = await MorphPriceCache.filter(
          { morph_name: morph },
          '-created_date',
          50
        );
        if (!cancelled) setPriceData(records);
      } catch (e) {
        console.warn('MorphPriceIndex fetch failed:', e);
        if (!cancelled) setPriceData([]);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [morph]);

  const stats = useMemo(() => {
    if (!priceData || priceData.length === 0) return null;

    const prices = priceData
      .map(r => r.price || r.average_price || r.min_price)
      .filter(p => p && p > 0);

    if (prices.length === 0) return null;

    const sorted = [...prices].sort((a, b) => a - b);
    const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    // Recent 90 day subset
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const recent = priceData.filter(r => new Date(r.created_date) > cutoff);
    const recentPrices = recent
      .map(r => r.price || r.average_price || r.min_price)
      .filter(p => p && p > 0);
    const recentAvg = recentPrices.length > 0
      ? recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length
      : avg;

    return { avg, min, max, median, recentAvg, count: prices.length, recentCount: recentPrices.length };
  }, [priceData]);

  if (!morph) return null;
  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-700 animate-pulse">
        <CardContent className="py-4 text-center text-slate-600 text-sm">
          Loading price data...
        </CardContent>
      </Card>
    );
  }
  if (!stats) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="py-4 text-center text-slate-600 text-sm">
          No price history available for {morph}.
        </CardContent>
      </Card>
    );
  }

  const deviation = sellerPrice
    ? Math.round(((sellerPrice - stats.recentAvg) / stats.recentAvg) * 100)
    : null;

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-slate-100">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          Price Intelligence: {morph}
          <Badge variant="outline" className="ml-auto text-xs text-slate-400 border-slate-600">
            {stats.count} data points
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Price range bar */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-slate-500">Low</p>
            <p className="text-lg font-bold text-slate-300">{formatCurrency(stats.min)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Average (90d)</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(stats.recentAvg)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">High</p>
            <p className="text-lg font-bold text-slate-300">{formatCurrency(stats.max)}</p>
          </div>
        </div>

        {/* Visual price bar */}
        <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
            style={{
              left: `${((stats.min / stats.max) * 100).toFixed(0)}%`,
              right: '0%',
            }}
          />
          {sellerPrice && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-emerald-400 shadow-lg"
              style={{ left: `${Math.min(100, (sellerPrice / stats.max) * 100).toFixed(0)}%` }}
              title={`Your price: ${formatCurrency(sellerPrice)}`}
            />
          )}
        </div>

        {/* Seller price feedback */}
        {deviation !== null && (
          <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            Math.abs(deviation) <= 10
              ? 'bg-emerald-900/30 border border-emerald-600/30 text-emerald-300'
              : deviation > 10
                ? 'bg-amber-900/30 border border-amber-600/30 text-amber-300'
                : 'bg-blue-900/30 border border-blue-600/30 text-blue-300'
          }`}>
            {deviation > 0 ? (
              <TrendingUp className="w-4 h-4 shrink-0" />
            ) : deviation < 0 ? (
              <TrendingDown className="w-4 h-4 shrink-0" />
            ) : (
              <Minus className="w-4 h-4 shrink-0" />
            )}
            <span>
              Your price is{' '}
              <strong>
                {Math.abs(deviation)}% {deviation > 0 ? 'above' : deviation < 0 ? 'below' : 'at'} average
              </strong>{' '}
              for a {morph} (based on {stats.recentCount} recent sales).
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
