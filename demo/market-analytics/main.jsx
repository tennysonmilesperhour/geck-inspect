/**
 * Market Analytics design demo.
 *
 * Wraps the tab in the same Business Tools chrome it lives in, with a
 * switch between the proposed v2 tab (real numbers) and the current v1
 * tab (its sample fixtures), so the two can be compared side by side.
 */

import { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BarChart3, Globe, PieChart, DollarSign, Tag, Sparkles, FlaskConical } from 'lucide-react';
import '@/index.css';
import MarketAnalyticsV2 from '@/components/market-analytics/v2/MarketAnalyticsV2';
import MarketAnalytics from '@/components/market-analytics/MarketAnalytics';
import { DEMO_AGGREGATES, DEMO_PIPELINE } from '@/lib/marketAnalytics/v2/demoAggregates';

const MODES = [
  { code: 'v2', label: 'New', sub: 'real market data', icon: Sparkles },
  { code: 'v1', label: 'Old preview', sub: 'sample fixtures', icon: FlaskConical },
];

const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const K = DEMO_AGGREGATES.kpis;
const C = DEMO_AGGREGATES.coverage;

const CHANGES = [
  ['Market Index', 'Asking Price Index, weekly, gaps shown'],
  ['Top Movers (combos)', 'Top Movers (single traits)'],
  ['Peak Indicator', 'Market Temperature, same score and cards'],
  ['Market Calendar', 'Data Coverage'],
  ['Combos table', 'Traits table with age ladder'],
  ['Regional heatmap', 'Price Map, trait x age'],
  ['Arbitrage radar', 'Grow-out radar, hold or sell'],
  ['Supply forecast', 'Supply shift + your clutches'],
  ['Breeders', 'Sellers'],
];

function readMode() {
  try { return localStorage.getItem('ma-demo-mode') === 'v1' ? 'v1' : 'v2'; } catch { return 'v2'; }
}

function Demo() {
  const [mode, setModeState] = useState(readMode);
  const setMode = (m) => {
    setModeState(m);
    try { localStorage.setItem('ma-demo-mode', m); } catch { /* storage blocked */ }
  };

  return (
    <div className="min-h-screen bg-background text-foreground w-full">
      <div className="border-b border-slate-800 bg-slate-950/60">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-100 leading-tight">Business Tools</h1>
            <p className="text-xs text-slate-500">Market Analytics redesign, demo build</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-700 bg-slate-950 p-1 self-start" role="group" aria-label="Which version">
            {MODES.map((m) => {
              const Icon = m.icon;
              const on = mode === m.code;
              return (
                <button
                  key={m.code}
                  onClick={() => setMode(m.code)}
                  className={`text-left rounded-md px-3 py-1.5 transition-colors ${on ? 'bg-emerald-500/15 border border-emerald-500/30' : 'border border-transparent hover:bg-slate-800'}`}
                >
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${on ? 'text-emerald-200' : 'text-slate-300'}`}><Icon className="w-3.5 h-3.5" />{m.label}</span>
                  <span className="block text-[10px] text-slate-500">{m.sub}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed md:flex-1">
            {mode === 'v2'
              ? `The section as it ships, drawn by the same components from a saved copy of the live data: ${K.listings.toLocaleString()} US listings from ${fmt(C.first_seen)} to ${fmt(C.last_seen)} and ${K.sold.toLocaleString()} observed sales. Your pipeline shows example clutches.`
              : 'The old preview, running on its sample fixtures. With real data, its Regional, Arbitrage, Supply and Calendar views came up empty.'}
          </p>
        </div>

        {mode === 'v2' && (
          <details className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 group">
            <summary className="text-xs text-slate-300 cursor-pointer select-none">What changed from the old preview</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 pb-1">
              {CHANGES.map(([from, to]) => (
                <div key={from} className="text-[11px] flex gap-2 min-w-0">
                  <span className="text-slate-500 shrink-0">{from}</span>
                  <span className="text-slate-600">to</span>
                  <span className="text-slate-200 truncate">{to}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-xl p-4 md:p-6">
          <div className="grid grid-cols-3 w-full max-w-md mx-auto bg-slate-950 border border-slate-700 rounded-md p-1.5 gap-1 mb-6 text-sm">
            <span className="flex items-center justify-center rounded-sm px-3 py-1.5 text-slate-500"><PieChart className="w-3.5 h-3.5 mr-1" />Money</span>
            <span className="flex items-center justify-center rounded-sm px-3 py-1.5 text-slate-500"><DollarSign className="w-3.5 h-3.5 mr-1" />Sales</span>
            <span className="flex items-center justify-center rounded-sm px-3 py-1.5 bg-emerald-600 text-white font-medium"><Tag className="w-3.5 h-3.5 mr-1" />Pricing</span>
          </div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-1.5 mb-4">
            <Globe className="w-4 h-4 text-emerald-400" /> Market analytics
          </h3>

          {mode === 'v2'
            ? <MarketAnalyticsV2 aggregates={DEMO_AGGREGATES} pipeline={DEMO_PIPELINE} pipelineIsExample />
            : <MarketAnalytics user={null} />}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Demo />);
