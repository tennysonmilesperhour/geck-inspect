/**
 * Market Analytics v2, root container.
 *
 * Same look as v1 (dark cards, emerald accents, confidence chips,
 * methodology popovers, pinnable cards), with every tool re-aimed at the
 * data that actually exists: US MorphMarket listings, trait-level depth,
 * age splits and a four-week window of observed sales. The v1 tools that
 * need data we do not have (regions, expo calendar, supply forecasts from
 * other breeders) are replaced, not left empty:
 *
 *   Regional heatmap  ->  Price Map (trait x age)
 *   Arbitrage radar   ->  Grow-out radar (hold a hatchling or sell it?)
 *   Supply pipeline   ->  Supply shift + your own clutches, valued
 *   Market calendar   ->  Data coverage (what the numbers are built on)
 *
 * Every section reads one `aggregates` object (shape documented in
 * src/lib/marketAnalytics/v2/demoAggregates.js) through the pure
 * functions in src/lib/marketAnalytics/v2/model.js.
 */

import { useMemo, useState } from 'react';
import {
  AlertCircle, LayoutDashboard, Layers, Grid3x3, Hourglass, Sprout, Users, Pin,
  CalendarRange, Search, X,
} from 'lucide-react';
import { SourceBadge } from '../shared';
import OverviewSection from './OverviewSection';
import TraitsSection from './TraitsSection';
import PriceMapSection from './PriceMapSection';
import GrowOutSection from './GrowOutSection';
import SupplySection from './SupplySection';
import SellersSection from './SellersSection';
import { AGE_COLUMNS } from '@/lib/marketAnalytics/v2/model';

const SUB_NAV = [
  { key: 'pinned',   label: 'Pinned',    icon: Pin },
  { key: 'overview', label: 'Overview',  icon: LayoutDashboard },
  { key: 'traits',   label: 'Traits',    icon: Layers },
  { key: 'pricemap', label: 'Price Map', icon: Grid3x3 },
  { key: 'growout',  label: 'Grow-out',  icon: Hourglass },
  { key: 'supply',   label: 'Supply',    icon: Sprout },
  { key: 'sellers',  label: 'Sellers',   icon: Users },
];

const DEFAULT_FILTERS = { age: 'all', query: '' };

export default function MarketAnalyticsV2({ aggregates, pipeline = [], pipelineIsExample = false, pipelineStatus = 'ready', now = new Date() }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [pins, setPins] = useState(['market-index', 'top-movers']);
  const [section, setSection] = useState('overview');
  const [selectedTrait, setSelectedTrait] = useState(aggregates.traits[0]?.name ?? null);

  const togglePin = (id) => setPins((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  // Trait search narrows every trait list on every tab.
  const agg = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    if (!q) return aggregates;
    return { ...aggregates, traits: aggregates.traits.filter((t) => t.name.toLowerCase().includes(q)) };
  }, [aggregates, filters.query]);

  const openTrait = (name) => { setSelectedTrait(name); setSection('traits'); };
  const shared = { agg, filters, pins, onTogglePin: togglePin, onOpenTrait: openTrait };

  return (
    <div className="space-y-5">
      <FreshnessBanner coverage={aggregates.coverage} now={now} />
      <FilterBar filters={filters} setFilters={setFilters} coverage={aggregates.coverage} />
      <SubNav section={section} setSection={setSection} pinnedCount={pins.length} />

      <div>
        {section === 'pinned' && (
          pins.length === 0
            ? <PinnedEmptyState onGo={() => setSection('overview')} />
            : <OverviewSection {...shared} onlyCards={pins} />
        )}
        {section === 'overview' && <OverviewSection {...shared} />}
        {section === 'traits'   && <TraitsSection {...shared} selected={selectedTrait} onSelect={setSelectedTrait} />}
        {section === 'pricemap' && <PriceMapSection {...shared} />}
        {section === 'growout'  && <GrowOutSection {...shared} />}
        {section === 'supply'   && <SupplySection {...shared} pipeline={pipeline} pipelineIsExample={pipelineIsExample} pipelineStatus={pipelineStatus} />}
        {section === 'sellers'  && <SellersSection {...shared} />}
      </div>
    </div>
  );
}

// ============ Freshness banner ======================================
function FreshnessBanner({ coverage, now }) {
  const last = new Date(`${coverage.last_seen}T00:00:00Z`);
  const days = Math.max(0, Math.round((now - last) / 86_400_000));
  const stale = days > 7;
  const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <div className={`rounded-lg border p-2.5 flex items-start gap-2 ${stale ? 'border-amber-500/30 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
      <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${stale ? 'text-amber-400' : 'text-emerald-400'}`} />
      <p className="text-[11px] text-slate-400 leading-relaxed">
        <span className={`font-semibold ${stale ? 'text-amber-300' : 'text-emerald-300'}`}>
          {stale ? `Last collected ${fmt(coverage.last_seen)}, ${days} days ago.` : `Updated ${fmt(coverage.last_seen)}.`}
        </span>{' '}
        Prices are asking prices from US MorphMarket listings.{' '}
        {coverage.sold_window
          ? `Sales were observed from ${fmt(coverage.sold_window.from)} to ${fmt(coverage.sold_window.to)} only, so sell-through and days-to-sell describe that window.`
          : 'No sales have been observed yet, so sell-through and days-to-sell are blank.'}
        {coverage.excluded_outliers > 0 && ` ${coverage.excluded_outliers} placeholder asks under $20 or over $20,000 are left out.`}
      </p>
    </div>
  );
}

// ============ Filter bar ============================================
function FilterBar({ filters, setFilters, coverage }) {
  const fmt = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const any = filters.age !== 'all' || filters.query;
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 rounded px-2 py-1 border border-slate-700">
        <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
        {fmt(coverage.first_seen)} to {fmt(coverage.last_seen)}
      </span>

      <div className="h-5 w-px bg-slate-700/70" />

      <div className="inline-flex items-center rounded border border-slate-700 bg-slate-950 p-0.5" role="group" aria-label="Age">
        {[{ code: 'all', label: 'All ages' }, ...AGE_COLUMNS].map((a) => (
          <button
            key={a.code}
            onClick={() => setFilters((f) => ({ ...f, age: a.code }))}
            className={`text-[11px] px-2 py-1 rounded transition-colors ${
              filters.age === a.code ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <label className="relative inline-flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2 pointer-events-none" />
        <input
          id="ma-trait-search"
          value={filters.query}
          onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
          placeholder="Find a trait"
          className="bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 placeholder:text-slate-500 pl-7 pr-2 py-1 w-36 focus:outline-none focus:border-emerald-500/60"
        />
      </label>

      <SourceBadge sourceId="external.morphmarket" />

      {any && (
        <button
          onClick={() => setFilters(DEFAULT_FILTERS)}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
        >
          <X className="w-3 h-3" />Reset filters
        </button>
      )}
    </div>
  );
}

// ============ Sub-nav ===============================================
function SubNav({ section, setSection, pinnedCount }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
      {SUB_NAV.map((s) => {
        const Icon = s.icon;
        const on = section === s.key;
        return (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${
              on ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30'
                 : 'text-slate-300 hover:bg-slate-800 border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {s.label}
            {s.key === 'pinned' && pinnedCount > 0 && (
              <span className="ml-0.5 text-[10px] bg-emerald-500/20 text-emerald-200 rounded px-1 py-0.5 tabular-nums">{pinnedCount}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PinnedEmptyState({ onGo }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
      <Pin className="w-6 h-6 text-slate-600 mx-auto mb-2" />
      <h3 className="text-sm font-semibold text-slate-200 mb-1">No pinned cards yet</h3>
      <p className="text-xs text-slate-500 max-w-md mx-auto mb-3">Pin cards from the Overview to build your own at-a-glance dashboard.</p>
      <button onClick={onGo} className="text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5">Go to Overview</button>
    </div>
  );
}
