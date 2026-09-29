/**
 * Market Analytics v2 for the Business Tools page: loads the market
 * aggregates and the breeder's own clutches, then renders the same
 * MarketAnalyticsV2 component the design demo renders.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MarketAnalyticsV2 from './MarketAnalyticsV2';
import { loadMarketAggregates } from '@/lib/marketAnalytics/v2/loadAggregates';
import { loadPipeline } from '@/lib/marketAnalytics/v2/loadPipeline';

export default function MarketAnalyticsLive({ user }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [pipeline, setPipeline] = useState({ status: 'loading', clutches: [] });

  const load = useCallback(async (force = false) => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    try {
      const data = await loadMarketAggregates({ force });
      setState({ status: 'ready', data, error: null });
    } catch (err) {
      console.warn('[marketAnalytics] aggregates failed:', err);
      setState({ status: 'error', data: null, error: err?.message || String(err) });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const aggregates = state.data;
  useEffect(() => {
    if (!aggregates || !user) return undefined;
    let live = true;
    setPipeline({ status: 'loading', clutches: [] });
    loadPipeline(user, aggregates)
      .then((clutches) => { if (live) setPipeline({ status: 'ready', clutches }); })
      .catch((err) => {
        console.warn('[marketAnalytics] pipeline failed:', err);
        if (live) setPipeline({ status: 'error', clutches: [] });
      });
    return () => { live = false; };
  }, [aggregates, user]);

  if (state.status === 'error') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400 leading-relaxed flex-1">
          <span className="text-red-300 font-semibold">Market data could not be loaded.</span>{' '}
          Nothing below is estimated in its place. Try again in a moment.
        </p>
        <Button size="sm" variant="outline" onClick={() => load(true)} className="shrink-0 border-red-500/40 text-red-200 hover:bg-red-500/10">
          Retry
        </Button>
      </div>
    );
  }

  if (!aggregates) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading market data">
        <div className="h-10 rounded-lg bg-slate-900/60 border border-slate-800 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />)}
        </div>
        <div className="h-64 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
      </div>
    );
  }

  return (
    <MarketAnalyticsV2
      aggregates={aggregates}
      pipeline={pipeline.clutches}
      pipelineStatus={pipeline.status}
    />
  );
}
