/**
 * Market Analytics — Root Container
 *
 * Mounts the filter bar, sub-nav (Overview / Combos / Regional / Arbitrage
 * / Supply / Breeders), and the drill-down modal. Every sub-view is a
 * pure consumer of `filters` + `onDrillDown`; no sub-view fetches or
 * holds its own source of truth outside the queries facade.
 *
 * The enterprise gate is rendered here so every sub-view inside sees
 * the same "preview data" banner and the single "view plans" CTA.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  AlertCircle, LayoutDashboard, Layers, Map as MapIcon, Radar,
  Sprout, Users, Lock, ArrowRight, Settings2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

import OverviewDashboard from './OverviewDashboard';
import TraitComboExplorer from './TraitComboExplorer';
import RegionalHeatmap from './RegionalHeatmap';
import ArbitrageRadar from './ArbitrageRadar';
import SupplyPipeline from './SupplyPipeline';
import BreederMarketShare from './BreederMarketShare';
import TransactionDrilldown from './TransactionDrilldown';

import {
  REGIONS, AGE_CLASSES, LINEAGE_TIERS, TIMEFRAMES,
} from '@/lib/marketAnalytics/taxonomy';
import { DATA_SOURCES, SOURCE_KINDS } from '@/lib/marketAnalytics/sources';

const SUB_NAV = [
  { key: 'overview',   label: 'Overview',    icon: LayoutDashboard },
  { key: 'combos',     label: 'Combos',      icon: Layers },
  { key: 'regional',   label: 'Regional',    icon: MapIcon },
  { key: 'arbitrage',  label: 'Arbitrage',   icon: Radar },
  { key: 'supply',     label: 'Supply',      icon: Sprout },
  { key: 'breeders',   label: 'Breeders',    icon: Users },
];

const DEFAULT_FILTERS = {
  regions: [],                  // empty = all
  timeframe: '12m',
  age_class: undefined,
  lineage_tier: undefined,
  sources: [],                  // empty = all
};

export default function MarketAnalytics({ user }) {
  const tier = user?.membership_tier || 'free';
  const isAdmin = user?.role === 'admin';
  const hasAccess = tier === 'enterprise' || isAdmin;

  const [section, setSection] = useState('overview');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [drillCriteria, setDrillCriteria] = useState(null);

  const openDrill = (criteria) => setDrillCriteria({ ...filters, ...criteria });
  const closeDrill = () => setDrillCriteria(null);

  return (
    <div className="space-y-5">
      {!hasAccess && <EnterpriseBanner />}
      <PreviewDataBanner />

      <FilterBar filters={filters} setFilters={setFilters} />

      <SubNav section={section} setSection={setSection} />

      <div>
        {section === 'overview'  && <OverviewDashboard filters={filters}    onDrillDown={openDrill} />}
        {section === 'combos'    && <TraitComboExplorer filters={filters}   onDrillDown={openDrill} />}
        {section === 'regional'  && <RegionalHeatmap filters={filters}      onDrillDown={openDrill} />}
        {section === 'arbitrage' && <ArbitrageRadar filters={filters}       onDrillDown={openDrill} />}
        {section === 'supply'    && <SupplyPipeline filters={filters} />}
        {section === 'breeders'  && <BreederMarketShare filters={filters} />}
      </div>

      <TransactionDrilldown
        open={!!drillCriteria}
        onClose={closeDrill}
        criteria={drillCriteria}
      />
    </div>
  );
}

// ============ Banners ================================================
function EnterpriseBanner() {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
        <Lock className="w-5 h-5 text-emerald-400" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-white">Market Analytics — Enterprise preview</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Viewing with preview data. Live internal sales, scraped external feeds, and forward-looking breeding signals activate with an Enterprise subscription.
        </p>
      </div>
      <Link to={createPageUrl('Membership')}>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shrink-0">
          View plans <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </Link>
    </div>
  );
}
function PreviewDataBanner() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-slate-400 leading-relaxed">
        <span className="text-amber-300 font-semibold">Preview data.</span>{' '}
        Every number is tagged with its source; click any badge to see where it came from. Fixtures are deterministic, so the same filter always returns the same numbers — when real pipelines connect, values will update and confidence will rise.
      </p>
    </div>
  );
}

// ============ Filter Bar =============================================
function FilterBar({ filters, setFilters }) {
  const toggleRegion = (code) => {
    setFilters((f) => ({
      ...f,
      regions: f.regions.includes(code)
        ? f.regions.filter((r) => r !== code)
        : [...f.regions, code],
    }));
  };
  const toggleSource = (id) => {
    setFilters((f) => ({
      ...f,
      sources: f.sources.includes(id)
        ? f.sources.filter((s) => s !== id)
        : [...f.sources, id],
    }));
  };
  const anyFilter = filters.regions.length || filters.sources.length || filters.age_class || filters.lineage_tier || filters.timeframe !== '12m';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 flex flex-wrap items-center gap-2">
      {/* Timeframe — always visible */}
      <TimeframeSelector value={filters.timeframe} onChange={(v) => setFilters((f) => ({ ...f, timeframe: v }))} />

      <FilterDivider />

      {/* Regions */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded px-2 py-1 border border-slate-700">
            <MapIcon className="w-3.5 h-3.5 text-slate-400" />
            {filters.regions.length === 0 ? 'All regions' : `${filters.regions.length} region${filters.regions.length > 1 ? 's' : ''}`}
          </button>
        </PopoverTrigger>
        <PopoverContent className="bg-slate-900 border-slate-700 text-slate-200 w-72 p-2">
          <div className="grid grid-cols-2 gap-1">
            {REGIONS.map((r) => {
              const on = filters.regions.includes(r.code);
              return (
                <button
                  key={r.code}
                  onClick={() => toggleRegion(r.code)}
                  className={`text-left text-xs px-2 py-1 rounded border transition-colors ${
                    on ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-200'
                       : 'bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="font-semibold">{r.code}</span>
                  <span className="ml-1 text-slate-500 text-[10px]">{r.name}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Age class */}
      <PillSelect
        label="Age"
        value={filters.age_class}
        options={AGE_CLASSES.map((a) => [a.code, a.label])}
        onChange={(v) => setFilters((f) => ({ ...f, age_class: v }))}
      />
      {/* Lineage tier */}
      <PillSelect
        label="Lineage"
        value={filters.lineage_tier}
        options={LINEAGE_TIERS.map((t) => [t.code, t.label])}
        onChange={(v) => setFilters((f) => ({ ...f, lineage_tier: v }))}
      />

      {/* Sources — internal vs external toggle popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded px-2 py-1 border border-slate-700">
            <Settings2 className="w-3.5 h-3.5 text-slate-400" />
            {filters.sources.length === 0 ? 'All sources' : `${filters.sources.length} source${filters.sources.length > 1 ? 's' : ''}`}
          </button>
        </PopoverTrigger>
        <PopoverContent className="bg-slate-900 border-slate-700 text-slate-200 w-80 p-2 space-y-1 max-h-[60vh] overflow-auto">
          <SourceGroup title="First-party (Geck Inspect)" kind={SOURCE_KINDS.INTERNAL} selected={filters.sources} toggle={toggleSource} />
          <SourceGroup title="External (scraped)"          kind={SOURCE_KINDS.SCRAPED}  selected={filters.sources} toggle={toggleSource} />
          <SourceGroup title="Derived / modeled"           kind={SOURCE_KINDS.ESTIMATED} selected={filters.sources} toggle={toggleSource} />
        </PopoverContent>
      </Popover>

      {anyFilter && (
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

function TimeframeSelector({ value, onChange }) {
  return (
    <div className="inline-flex items-center rounded border border-slate-700 bg-slate-950 p-0.5">
      {TIMEFRAMES.map((t) => (
        <button
          key={t.code}
          onClick={() => onChange(t.code)}
          className={`text-[11px] px-2 py-1 rounded transition-colors ${
            value === t.code ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function PillSelect({ label, value, options, onChange }) {
  const current = options.find(([c]) => c === value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded px-2 py-1 border border-slate-700">
          <span className="text-slate-500">{label}:</span>
          <span className="truncate max-w-[120px]">{current ? current[1] : 'Any'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="bg-slate-900 border-slate-700 text-slate-200 w-60 p-1">
        <button
          onClick={() => onChange(undefined)}
          className={`w-full text-left text-xs px-2 py-1 rounded ${!value ? 'bg-emerald-500/15 text-emerald-200' : 'hover:bg-slate-800'}`}
        >
          Any
        </button>
        {options.map(([code, lbl]) => (
          <button
            key={code}
            onClick={() => onChange(code)}
            className={`w-full text-left text-xs px-2 py-1 rounded ${value === code ? 'bg-emerald-500/15 text-emerald-200' : 'hover:bg-slate-800'}`}
          >
            {lbl}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function SourceGroup({ title, kind, selected, toggle }) {
  const items = DATA_SOURCES.filter((s) => s.kind === kind);
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 pt-1 pb-0.5">{title}</div>
      <div className="space-y-0.5">
        {items.map((s) => {
          const on = selected.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`w-full text-left text-xs px-2 py-1 rounded border transition-colors ${
                on ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                   : 'bg-transparent border-transparent text-slate-300 hover:bg-slate-800'
              }`}
            >
              <div className="font-medium">{s.label}</div>
              <div className="text-[10px] text-slate-500 leading-tight">{s.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterDivider() {
  return <div className="h-5 w-px bg-slate-700/70" />;
}

// ============ Sub-nav ================================================
function SubNav({ section, setSection }) {
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
            <Icon className="w-3.5 h-3.5" />{s.label}
          </button>
        );
      })}
    </div>
  );
}
