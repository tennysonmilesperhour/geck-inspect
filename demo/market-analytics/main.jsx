/**
 * Market Analytics design demo.
 *
 * Wraps the tab in the same Business Tools chrome it lives in and renders
 * the shipping v2 components from a saved copy of the live data. The old
 * v1 preview and its sample fixtures were deleted on 2 Oct 2026.
 */

import ReactDOM from 'react-dom/client';
import { BarChart3, Globe, PieChart, DollarSign, Tag } from 'lucide-react';
import '@/index.css';
import MarketAnalyticsV2 from '@/components/market-analytics/v2/MarketAnalyticsV2';
import { DEMO_AGGREGATES, DEMO_PIPELINE } from '@/lib/marketAnalytics/v2/demoAggregates';

const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const K = DEMO_AGGREGATES.kpis;
const C = DEMO_AGGREGATES.coverage;

function Demo() {
  return (
    <div className="min-h-screen bg-background text-foreground w-full">
      <div className="border-b border-slate-800 bg-slate-950/60">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-100 leading-tight">Business Tools</h1>
            <p className="text-xs text-slate-500">Market Analytics, demo build</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <p className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400 leading-relaxed">
          {`The section as it ships, drawn by the same components from a saved copy of the live data: ${K.listings.toLocaleString()} US listings from ${fmt(C.first_seen)} to ${fmt(C.last_seen)} and ${K.sold.toLocaleString()} observed sales. Your pipeline shows example clutches.`}
        </p>

        <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-4 md:p-6">
          <div className="grid grid-cols-3 w-full max-w-md mx-auto bg-slate-950 border border-slate-700 rounded-md p-1.5 gap-1 mb-6 text-sm">
            <span className="flex items-center justify-center rounded-sm px-3 py-1.5 text-slate-500"><PieChart className="w-3.5 h-3.5 mr-1" />Money</span>
            <span className="flex items-center justify-center rounded-sm px-3 py-1.5 text-slate-500"><DollarSign className="w-3.5 h-3.5 mr-1" />Sales</span>
            <span className="flex items-center justify-center rounded-sm px-3 py-1.5 bg-emerald-600 text-white font-medium"><Tag className="w-3.5 h-3.5 mr-1" />Pricing</span>
          </div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-1.5 mb-4">
            <Globe className="w-4 h-4 text-emerald-400" /> Market analytics
          </h3>

          <MarketAnalyticsV2 aggregates={DEMO_AGGREGATES} pipeline={DEMO_PIPELINE} pipelineIsExample />
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Demo />);
