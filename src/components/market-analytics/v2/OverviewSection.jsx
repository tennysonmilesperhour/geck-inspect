/**
 * Overview: what the crested gecko market is asking, and which traits
 * are moving. Cards are pinnable; `onlyCards` renders just those ids
 * (the Pinned tab).
 */

import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip as RechartsTooltip, ReferenceArea, ReferenceDot,
} from 'recharts';
import {
  Activity, TrendingUp, TrendingDown, Gauge, DatabaseZap, ArrowUpRight,
  Pin, PinOff, Tag, Receipt, Percent, Timer, Store,
} from 'lucide-react';
import {
  SectionHeader, TrendDelta, ConfidenceChip, MethodologyPopover,
} from '../shared';
import {
  askingPriceIndex, topMovers, marketTemperature, weekLabel, WEEK_AXIS, MIN_MOVER_N,
} from '@/lib/marketAnalytics/v2/model';

export const OVERVIEW_CARDS = ['market-index', 'top-movers', 'coverage', 'temperature'];

export function PinToggle({ id, pins, onTogglePin }) {
  if (!onTogglePin) return null;
  const on = pins?.includes(id);
  const Icon = on ? PinOff : Pin;
  return (
    <button
      type="button"
      onClick={() => onTogglePin(id)}
      className={`inline-flex items-center justify-center w-6 h-6 rounded transition-colors ${
        on ? 'text-emerald-300 hover:bg-emerald-500/10' : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
      }`}
      aria-label={on ? 'Unpin from dashboard' : 'Pin to dashboard'}
      title={on ? 'Unpin from Pinned dashboard' : 'Pin to Pinned dashboard'}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}

export default function OverviewSection({ agg, pins, onTogglePin, onOpenTrait, onlyCards }) {
  const index = useMemo(() => askingPriceIndex(agg), [agg]);
  const movers = useMemo(() => topMovers(agg), [agg]);
  const temps = useMemo(() => marketTemperature(agg), [agg]);
  const pinProps = { pins, onTogglePin };

  const card = (id) => {
    switch (id) {
      case 'market-index': return <IndexCard key={id} index={index} pinProps={pinProps} />;
      case 'top-movers':   return <MoversCard key={id} movers={movers} onOpenTrait={onOpenTrait} pinProps={pinProps} />;
      case 'coverage':     return <CoverageCard key={id} coverage={agg.coverage} pinProps={pinProps} />;
      case 'temperature':  return <TemperatureCard key={id} temps={temps} onOpenTrait={onOpenTrait} pinProps={pinProps} />;
      default: return null;
    }
  };

  if (onlyCards) {
    return <div className="space-y-5">{onlyCards.filter((id) => OVERVIEW_CARDS.includes(id)).map(card)}</div>;
  }

  return (
    <div className="space-y-5">
      <KpiStrip kpis={agg.kpis} />
      {card('market-index')}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0">{card('top-movers')}</div>
        <div className="min-w-0">{card('coverage')}</div>
      </div>
      {card('temperature')}
    </div>
  );
}

// =================== KPI strip =======================================
function KpiStrip({ kpis }) {
  const tiles = [
    { label: 'Median ask', value: `$${kpis.median_ask}`, sub: `${kpis.listings.toLocaleString()} listings`, Icon: Tag, color: 'text-emerald-300' },
    { label: 'Sales observed', value: kpis.sold.toLocaleString(), sub: `$${(kpis.sold_value / 1_000_000).toFixed(2)}M at last ask`, Icon: Receipt, color: 'text-sky-300' },
    { label: 'Sell-through', value: `${Math.round(kpis.sell_through * 100)}%`, sub: 'in the 4-week sales window', Icon: Percent, color: 'text-amber-300' },
    { label: 'Days to sell', value: `${kpis.avg_days_to_sell}`, sub: 'average, sold listings', Icon: Timer, color: 'text-violet-300' },
    { label: 'Sellers', value: kpis.sellers.toLocaleString(), sub: 'with a named storefront', Icon: Store, color: 'text-slate-200', span: 'col-span-2 sm:col-span-1' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {tiles.map(({ label, value, sub, Icon, color, span = '' }) => (
        <div key={label} className={`rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-3 min-w-0 ${span}`}>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Icon className="w-3.5 h-3.5" />{label}
          </div>
          <div className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{value}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</div>
        </div>
      ))}
    </div>
  );
}

// =================== Asking Price Index ==============================
function IndexCard({ index, pinProps }) {
  const gapStart = weekLabel('06-15');
  const gapEnd = weekLabel('08-10');
  const latest = index.series.find((s) => s.week === index.latest_week);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={Activity}
        title="Geck Inspect Asking Price Index"
        subtitle="Weekly median ask of newly listed crested geckos. 1,000 = the week of May 11."
        right={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-none bg-amber-500/15 text-amber-200 border-amber-500/40">Asking prices</span>
            <ConfidenceChip confidence={index.confidence} sampleSize={index.sample_size} sources={['external.morphmarket']} />
            <MethodologyPopover title="How this index is built">
              <p>Each week we take the median asking price of listings first seen that week and divide it by the May 11 median ($300). A reading of 850 means new listings are asking 15% less than in mid-May.</p>
              <p>The week of May 11 is the first full scrape, so it includes every listing that was already live. Later weeks are only new listings, which skew toward hatchlings in late summer.</p>
              <p>The shaded stretch is when the collector was offline. We leave it blank instead of drawing a line through it.</p>
            </MethodologyPopover>
            <PinToggle id="market-index" {...pinProps} />
          </div>
        }
      />
      <div className="flex flex-wrap items-end gap-4 mb-3">
        <div>
          <div className="text-3xl font-bold text-emerald-300 tabular-nums">{index.value.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <TrendDelta value={index.change_pct} />
            <span className="text-[10px] text-slate-500">since May 11</span>
          </div>
        </div>
        {latest && (
          <div className="text-[11px] text-slate-400 leading-snug">
            Week of {latest.label}: <span className="text-slate-200 font-semibold tabular-nums">${latest.median_ask}</span> median ask
            <div className="text-[10px] text-slate-500">{latest.listings} new listings</div>
          </div>
        )}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={index.series} margin={{ top: 8, right: 22, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="v2IndexGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <ReferenceArea
              x1={gapStart} x2={gapEnd}
              fill="#64748b" fillOpacity={0.08} stroke="#64748b" strokeOpacity={0.25} strokeDasharray="3 3"
              label={{ value: 'Collector offline', fill: '#64748b', fontSize: 10, position: 'center' }}
            />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} interval={2} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} width={36} domain={[700, 1050]} ticks={[700, 800, 900, 1000]} tickLine={false} axisLine={false} />
            <RechartsTooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#34d399' }}
              formatter={(v, _n, item) => (v == null ? ['No data', 'Index'] : [`${v} ($${item.payload.median_ask}, n=${item.payload.listings})`, 'Index'])}
            />
            <Area type="monotone" dataKey="index" stroke="#34d399" strokeWidth={2} fill="url(#v2IndexGrad)" connectNulls={false} dot={{ r: 2.5, fill: '#34d399', strokeWidth: 0 }} animationDuration={600} />
            {latest && <ReferenceDot x={latest.label} y={latest.index} r={4.5} fill="#34d399" stroke="#0f172a" strokeWidth={2} />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// =================== Top movers ======================================
function MoversCard({ movers, onOpenTrait, pinProps }) {
  const all = [...movers.up, ...movers.down];
  const prices = all.flatMap((r) => [r.spring[1], r.late[1]]);
  const scale = { min: Math.min(...prices), max: Math.max(...prices) };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 h-full">
      <SectionHeader
        icon={TrendingUp}
        title="Top Movers"
        subtitle="Median ask of new listings by trait. Hollow dot = spring, filled = late August."
        right={
          <div className="flex items-center gap-2">
            <MethodologyPopover title="How movers are picked">
              <p>For each trait we compare the median ask of listings first seen May 9 to June 30 with listings first seen August 17 to 29. A trait needs at least {MIN_MOVER_N} listings in both periods to appear.</p>
              <p>These are different animals in each period. If late-summer listings are mostly hatchlings, the median drops even when the market has not. The Price Map tab shows prices split by age.</p>
            </MethodologyPopover>
            <PinToggle id="top-movers" {...pinProps} />
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <MoverColumn title="Asking more" rows={movers.up} direction="up" scale={scale} onOpenTrait={onOpenTrait} />
        <MoverColumn title="Asking less" rows={movers.down} direction="down" scale={scale} onOpenTrait={onOpenTrait} />
      </div>
    </div>
  );
}

function MoverColumn({ title, rows, direction, scale, onOpenTrait }) {
  const Icon = direction === 'up' ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`w-3.5 h-3.5 ${direction === 'up' ? 'text-emerald-400' : 'text-red-400'}`} />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-1.5">
        {rows.length === 0 ? <div className="text-xs text-slate-500 py-4 text-center">No trait clears the sample floor</div> :
          rows.map((r) => (
            <button
              key={r.name}
              onClick={() => onOpenTrait?.(r.name)}
              className="w-full text-left bg-slate-800/40 hover:bg-slate-800 border border-slate-800/60 hover:border-emerald-500/40 rounded-lg px-3 py-2 flex items-center gap-3 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate">{r.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                  ${r.spring[1]} to ${r.late[1]} · n={r.late[0]}
                </div>
              </div>
              <Dumbbell from={r.spring[1]} to={r.late[1]} scale={scale} up={direction === 'up'} />
              <div className="w-14 text-right text-xs"><TrendDelta value={r.change_pct} digits={0} /></div>
            </button>
          ))}
      </div>
    </div>
  );
}

// Spring ask (hollow dot) to August ask (filled dot) on one price scale
// shared by every row in the card, so bar lengths compare across traits.
function Dumbbell({ from, to, scale, up, width = 72, height = 22 }) {
  const pad = 4;
  const span = scale.max - scale.min || 1;
  const x = (v) => pad + ((v - scale.min) / span) * (width - pad * 2);
  const color = up ? '#34d399' : '#f87171';
  const y = height / 2;
  return (
    <svg width={width} height={height} className="block shrink-0" aria-label={`$${from} to $${to}`}>
      <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="#1e293b" strokeWidth="2" strokeLinecap="round" />
      <line x1={x(from)} x2={x(to)} y1={y} y2={y} stroke={color} strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
      <circle cx={x(from)} cy={y} r="3" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx={x(to)} cy={y} r="3.5" fill={color} />
    </svg>
  );
}

// =================== Data coverage ===================================
function CoverageCard({ coverage, pinProps }) {
  const byWeek = Object.fromEntries(coverage.weeks.map((w) => [w.week, w]));
  const soldWeeks = new Set(['05-11', '05-18', '05-25', '06-01']);
  const CAP = 900;
  const weeks = ['05-04', ...WEEK_AXIS];
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 h-full">
      <SectionHeader
        icon={DatabaseZap}
        title="Data Coverage"
        subtitle="New listings collected each week"
        right={<PinToggle id="coverage" {...pinProps} />}
      />
      <div className="flex items-end gap-[3px] h-28 pt-4 relative" role="img" aria-label="Weekly listings collected, May to August">
        {weeks.map((key) => {
          const w = byWeek[key];
          const capped = w && w.listings > CAP;
          const h = w ? Math.max(4, (Math.min(w.listings, CAP) / CAP) * 100) : 100;
          const cls = !w
            ? 'bg-[repeating-linear-gradient(135deg,rgba(100,116,139,0.18)_0_3px,transparent_3px_6px)] border border-dashed border-slate-700/70'
            : soldWeeks.has(key) ? 'bg-emerald-500/70' : 'bg-slate-400/50';
          return (
            <div key={key} className="flex-1 h-full flex flex-col justify-end relative group" title={w ? `${weekLabel(key)}: ${w.listings.toLocaleString()} listings${w.note ? `. ${w.note}` : ''}` : `${weekLabel(key)}: not collected`}>
              {capped && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-emerald-300 tabular-nums whitespace-nowrap">{(w.listings / 1000).toFixed(1)}k</span>
              )}
              <div className={`w-full rounded-sm ${cls} ${capped ? 'rounded-t-none border-t-2 border-dashed border-emerald-200/60' : ''}`} style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1.5">
        <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-[10px] text-slate-400">
        <LegendRow swatch="bg-emerald-500/70" label="Listings and sales tracked" />
        <LegendRow swatch="bg-slate-400/50" label="Listings only" />
        <LegendRow swatch="bg-[repeating-linear-gradient(135deg,rgba(100,116,139,0.35)_0_3px,transparent_3px_6px)] border border-dashed border-slate-600" label="Not collected" />
      </div>
    </div>
  );
}

function LegendRow({ swatch, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-sm ${swatch}`} />
      <span>{label}</span>
    </div>
  );
}

// =================== Market temperature ==============================
function TemperatureCard({ temps, onOpenTrait, pinProps }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <SectionHeader
        icon={Gauge}
        title="Market Temperature, sell, hold or buy"
        subtitle="0 to 100 per trait. High = asks rising and selling fast. Low = soft, a buyer's market."
        right={
          <div className="flex items-center gap-2">
            <MethodologyPopover title="How the temperature is scored">
              <p>Four signals, each scaled from -1 to +1, then weighted:</p>
              <ul className="list-disc pl-5 space-y-0.5 text-slate-300">
                <li>Asking-price change, spring to late summer (45%)</li>
                <li>Sell-through compared with the whole market (25%)</li>
                <li>Change in the trait&apos;s share of new listings (20%)</li>
                <li>Days to sell compared with the whole market (10%)</li>
              </ul>
              <p>The weighted sum maps to 0 to 100, the same scale the preview used.</p>
            </MethodologyPopover>
            <PinToggle id="temperature" {...pinProps} />
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(temps.length <= 6 ? temps : [...temps.slice(0, 3), ...temps.slice(-3)]).map((t) => <TempCard key={t.name} t={t} onClick={() => onOpenTrait?.(t.name)} />)}
      </div>
    </div>
  );
}

const TEMP_COLORS = {
  red:     'bg-red-500/10 border-red-500/40 text-red-300',
  orange:  'bg-orange-500/10 border-orange-500/40 text-orange-300',
  amber:   'bg-amber-500/10 border-amber-500/40 text-amber-300',
  emerald: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
};

function TempCard({ t, onClick }) {
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } };
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={onKey} className={`text-left rounded-lg border p-3 cursor-pointer hover:brightness-110 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${TEMP_COLORS[t.label.color] || 'bg-slate-800/40 border-slate-700/60 text-slate-300'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider opacity-80">{t.label.label}</div>
          <div className="text-sm font-semibold text-slate-100 truncate">{t.name}</div>
        </div>
        <div className="text-2xl font-bold tabular-nums">{t.score}</div>
      </div>
      <div className="text-[10px] text-slate-400 mb-2">{t.label.action} · n={t.sample_size}</div>
      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 opacity-60" />
        <div className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]" style={{ left: `${t.score}%` }} />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <ConfidenceChip confidence={t.confidence} sampleSize={t.sample_size} sources={['external.morphmarket']} size="xs" />
        </span>
        <ArrowUpRight className="w-3 h-3 text-slate-500" />
      </div>
    </div>
  );
}
