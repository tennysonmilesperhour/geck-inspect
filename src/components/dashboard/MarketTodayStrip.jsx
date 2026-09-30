import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ChevronRight, TrendingUp, Wallet } from 'lucide-react';
import { loadMarketToday, marketTodayLines } from '@/lib/marketHabit';
import { captureEvent } from '@/lib/posthog';

const ICONS = { value: Wallet, watch: BellRing, morph: TrendingUp };

/**
 * Market lines under the Today card: what the member's crested geckos are
 * worth, new watchlist matches, and news in the morphs they keep. Each
 * line opens the Market page. Renders nothing when there is nothing to
 * say or the market data could not load.
 */
export default function MarketTodayStrip() {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    let cancelled = false;
    loadMarketToday()
      .then((data) => { if (!cancelled) setLines(marketTodayLines(data)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!lines.length) return null;

  return (
    <div className="mt-4 pt-3 border-t border-slate-800">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Market</p>
      <div className="space-y-2">
        {lines.map((l) => {
          const Icon = ICONS[l.kind] || TrendingUp;
          return (
            <Link
              key={l.id}
              to={l.href}
              onClick={() => captureEvent('market_today_click', { line: l.id })}
              className="touch:min-h-11 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 hover:bg-slate-800 hover:border-emerald-500/40 px-3 py-2.5 transition-colors group"
            >
              <Icon className="w-4 h-4 shrink-0 text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{l.label}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {l.detail}{l.stale ? `. ${l.stale}` : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
