/**
 * Overview Dashboard
 *
 * The "at a glance" view: answers the question "what's the market doing
 * right now?" in one screen. Shows:
 *   - Composite Market Index (like Liv-ex 100 for wine)
 *   - Peak Indicators for top combos (sell / hold / accumulate signals)
 *   - Top movers (fastest appreciating and depreciating combos)
 *   - Upcoming market events (expos, breeder releases) that move prices
 *
 * Every number is drilled into by clicking — via the `onDrillDown`
 * callback that opens the TransactionDrilldown modal in the container.
 */

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Activity, TrendingUp, TrendingDown, Gauge, CalendarDays, ArrowUpRight,
} from 'lucide-react';
import {
  queryMarketIndex, queryTopMovers, queryPeakIndicators, queryMarketEvents,
} from '@/lib/marketAnalytics/queries';
import {
  SectionHeader, Sparkline, TrendDelta, ConfidenceChip, SourceBadgeStack,
  FreshnessIndicator, MethodologyPopover,
} from './shared';
import { peakLabel } from '@/lib/marketAnalytics/confidence';

export default function OverviewDashboard({ filters, onDrillDown }) {
  const [index, setIndex] = useState(null);
  const [movers, setMovers] = useState({ up: [], down: [] });
  const [peaks, setPeaks] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      queryMarketIndex({ regions: filters.regions, timeframe: filters.timeframe }),
      queryTopMovers({ regions: filters.regions, timeframe: filters.timeframe, limit: 5 }),
      queryPeakIndicators({ regions: filters.regions }),
      queryMarketEvents(),
    ]).then(([i, m, p, e]) => {
      if (!mounted) return;
      setIndex(i); setMovers(m); setPeaks(p); setEvents(e);
    });
    return () => { mounted = false; };
  }, [filters.regions, filters.timeframe]);

  return (
    <div className="space-y-5">
      <MarketIndexCard index={index} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TopMoversCard movers={movers} onDrillDown={onDrillDown} />
        </div>
        <EventsCard events={events} />
      </div>
      <PeakIndicatorGrid peaks={peaks} onDrillDown={onDrillDown} />
    </div>
  );
}

// =================== Market Index ====================================
function MarketIndexCard({ index }) {
  if (!index) return <Skeleton h={180} />;
  const change = index.change_pct ?? 0;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={Activity}
        title="Geck Inspect Market Index"
        subtitle="Weighted basket of high-value trait combinations — 1,000 at period start"
        right={
          <div className="flex items-center gap-2">
            <ConfidenceChip
              confidence={index.confidence}
              sampleSize={index.sample_size}
              sources={index.sources}
              methodology="Index = median sold price per month across the high-value combo basket, normalized so the earliest month in the selected timeframe = 1,000."
            />
            <MethodologyPopover title="How this index is built">
              <p>The Market Index is a Laspeyres-style basket: we sum the median monthly sold price of each high-value combo, weight it by the combo's 12-month volume share, and normalize the earliest month in view to 1,000. It's designed so a reading of 1,200 means the basket is up 20% from period start.</p>
              <p>We publish confidence alongside the headline — anything below 65 should be read as directional, not a precise signal.</p>
            </MethodologyPopover>
          </div>
        }
      />
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <div>
          <div className="text-3xl font-bold text-emerald-300 tabular-nums">{index.value.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <TrendDelta value={change} />
            <span className="text-[10px] text-slate-500">over period</span>
          </div>
        </div>
        <div className="ml-auto"><SourceBadgeStack sourceIds={index.sources} /></div>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={index.series}>
            <defs>
              <linearGradient id="miGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} hide />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={40} />
            <RechartsTooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#34d399' }}
              formatter={(v) => [v, 'Index']}
            />
            <Area type="monotone" dataKey="index" stroke="#34d399" strokeWidth={2} fill="url(#miGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <FreshnessIndicator sourceIds={index.sources} />
    </div>
  );
}

// =================== Top Movers ======================================
function TopMoversCard({ movers, onDrillDown }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={TrendingUp}
        title="Top Movers"
        subtitle="Largest price swings in the selected timeframe"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <MoverColumn title="Appreciating" rows={movers.up} direction="up" onDrillDown={onDrillDown} />
        <MoverColumn title="Depreciating" rows={movers.down} direction="down" onDrillDown={onDrillDown} />
      </div>
    </div>
  );
}
function MoverColumn({ title, rows, direction, onDrillDown }) {
  const Icon = direction === 'up' ? TrendingUp : TrendingDown;
  const iconColor = direction === 'up' ? 'text-emerald-400' : 'text-red-400';
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-1.5">
        {rows.length === 0 ? <div className="text-xs text-slate-500 py-4 text-center">Not enough data</div> :
          rows.map((r) => (
            <button
              key={r.combo_id}
              onClick={() => onDrillDown?.({ combo_id: r.combo_id })}
              className="w-full text-left bg-slate-800/40 hover:bg-slate-800 border border-slate-800/60 hover:border-emerald-500/40 rounded-lg px-3 py-2 flex items-center gap-3 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate">{r.combo_name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  ${r.current_avg.toLocaleString()} avg · n={r.sample_size}
                </div>
              </div>
              <Sparkline
                data={r.sparkline}
                width={60} height={22}
                stroke={direction === 'up' ? '#34d399' : '#f87171'}
                fill={direction === 'up' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}
              />
              <div className="w-14 text-right"><TrendDelta value={r.change_pct} /></div>
            </button>
          ))
        }
      </div>
    </div>
  );
}

// =================== Events calendar =================================
function EventsCard({ events }) {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={CalendarDays}
        title="Market Calendar"
        subtitle="Upcoming expos & breeder releases"
      />
      <div className="space-y-1.5">
        {sorted.slice(0, 6).map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.impact === 'high' ? 'bg-red-400' : 'bg-amber-400'}`} />
            <span className="text-slate-300 flex-1 truncate">{e.name}</span>
            <span className="text-[10px] text-slate-500 flex-shrink-0">{e.region}</span>
            <span className="text-[10px] text-slate-500 flex-shrink-0">{formatEventDate(e.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function formatEventDate(iso) {
  const d = new Date(iso);
  const diff = Math.round((d - Date.now()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d ago`;
  if (diff === 0) return 'today';
  if (diff < 14) return `in ${diff}d`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// =================== Peak Indicators =================================
function PeakIndicatorGrid({ peaks, onDrillDown }) {
  const sorted = [...peaks].sort((a, b) => b.score - a.score).slice(0, 6);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={Gauge}
        title="Peak Indicator — Hold, Sell, or Accumulate"
        subtitle="Composite 0–100 score. Higher = market heat, lower = early / undervalued."
        right={
          <MethodologyPopover title="How the peak score is calculated">
            <p>Four components, each normalized to [-1, +1], then weighted:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-slate-300">
              <li>Price momentum (90d vs 91-365d) — weight 45%</li>
              <li>Volume momentum (sales acceleration) — weight 25%</li>
              <li>Supply pressure (3-month projected hatchlings) — weight 20%</li>
              <li>Breeder adoption breadth (distinct producers) — weight 10%</li>
            </ul>
            <p>Mapped from [-1, +1] to [0, 100]. This mirrors the "overheat" indicators on sneaker and watch indices — high scores are a sell signal, low scores accumulate.</p>
          </MethodologyPopover>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((p) => <PeakCard key={p.combo_id} p={p} onClick={() => onDrillDown?.({ combo_id: p.combo_id })} />)}
      </div>
    </div>
  );
}
function PeakCard({ p, onClick }) {
  const lbl = peakLabel(p.score);
  const colorClass = {
    red:     'bg-red-500/10 border-red-500/40 text-red-300',
    orange:  'bg-orange-500/10 border-orange-500/40 text-orange-300',
    amber:   'bg-amber-500/10 border-amber-500/40 text-amber-300',
    emerald: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
  }[lbl.color] || 'bg-slate-800/40 border-slate-700/60 text-slate-300';
  return (
    <button onClick={onClick} className={`text-left rounded-lg border p-3 hover:brightness-110 transition-all ${colorClass}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider opacity-80">{lbl.label}</div>
          <div className="text-sm font-semibold text-slate-100 truncate">{p.combo_name}</div>
        </div>
        <div className="text-2xl font-bold tabular-nums">{p.score}</div>
      </div>
      <div className="text-[10px] text-slate-400 mb-2">{lbl.action} · n={p.sample_size}</div>
      <ScoreBar score={p.score} />
      <div className="flex items-center justify-between mt-2">
        <ConfidenceChip confidence={p.confidence} sampleSize={p.sample_size} sources={p.sources} size="xs" />
        <ArrowUpRight className="w-3 h-3 text-slate-500" />
      </div>
    </button>
  );
}
function ScoreBar({ score }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
      <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 opacity-60" style={{ width: '100%' }} />
      <div className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]" style={{ left: `${score}%` }} />
    </div>
  );
}

// =================== Skeleton ========================================
function Skeleton({ h = 120 }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-900/40 animate-pulse" style={{ height: h }} />;
}
