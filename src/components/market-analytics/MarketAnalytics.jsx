/**
 * Market Analytics ,  Root Container
 *
 * Mounts the filter bar, sub-nav (Overview / Combos / Regional / Arbitrage
 * / Supply / Breeders), and the drill-down modal. Every sub-view is a
 * pure consumer of `filters` + `onDrillDown`; no sub-view fetches or
 * holds its own source of truth outside the queries facade.
 *
 * The enterprise gate is rendered here so every sub-view inside sees
 * the same "preview data" banner and the single "view plans" CTA.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  AlertCircle, LayoutDashboard, Layers, Map as MapIcon, Radar,
  Sprout, Users, Lock, ArrowRight, Settings2, X, Bookmark, Plus, Pin,
  CheckCircle2,
} from 'lucide-react';
import { ensureLoaded, getDataSource, getSnapshotGeneratedAt } from '@/lib/marketAnalytics/queries';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import useUserPreference from '@/hooks/useUserPreference';

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
  { key: 'pinned',     label: 'Pinned',      icon: Pin },
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
  age_class: [],                // empty = all; array for multi-select
  lineage_tier: [],             // empty = all; array for multi-select
  sources: [],                  // empty = all
};

export default function MarketAnalytics({ user }) {
  const tier = user?.membership_tier || 'free';
  const isAdmin = user?.role === 'admin';
  const hasAccess = tier === 'enterprise' || isAdmin;

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [drillCriteria, setDrillCriteria] = useState(null);

  // Saved filter presets. Signed-in users get cross-device sync via
  // auth.users.user_metadata; guests fall back to localStorage. Shape:
  //   { saved: { [name]: filters }, active: name | null }
  // `active` clears the moment the user mutates filters, so the label
  // only reflects an unmodified preset.
  const [presetState, setPresetState] = useUserPreference(
    user,
    'market_analytics_presets',
    { saved: {}, active: null }
  );

  // Pinned Overview cards. Stored separately from presets because they
  // track which KPIs the user wants to see at-a-glance, not filter state.
  const [pinState, setPinState] = useUserPreference(
    user,
    'market_analytics_pins',
    { ids: [] }
  );

  // Default to the Pinned tab if the user has any pins; otherwise the
  // Overview is the better first view. Resolved once at mount so the
  // section is stable as the user pins/unpins afterwards.
  const [section, setSection] = useState(
    () => (pinState.ids.length > 0 ? 'pinned' : 'overview')
  );
  const togglePin = (id) => {
    setPinState({
      ids: pinState.ids.includes(id)
        ? pinState.ids.filter((x) => x !== id)
        : [...pinState.ids, id],
    });
  };
  const reorderPins = (nextIds) => {
    setPinState({ ids: nextIds });
  };

  const applyFilters = (next, activeName = null) => {
    setFilters(next);
    setPresetState({ active: activeName });
  };
  const savePreset = (name) => {
    if (!name) return;
    setPresetState({
      saved: { ...presetState.saved, [name]: filters },
      active: name,
    });
  };
  const loadPreset = (name) => {
    const preset = presetState.saved[name];
    if (preset) applyFilters({ ...DEFAULT_FILTERS, ...preset }, name);
  };
  const deletePreset = (name) => {
    const { [name]: _removed, ...rest } = presetState.saved;
    setPresetState({
      saved: rest,
      active: presetState.active === name ? null : presetState.active,
    });
  };

  const openDrill = (criteria) => setDrillCriteria({ ...filters, ...criteria });
  const closeDrill = () => setDrillCriteria(null);

  return (
    <div className="space-y-5">
      {!hasAccess && <EnterpriseBanner />}
      <PreviewDataBanner />

      <FilterBar
        filters={filters}
        setFilters={(next) => applyFilters(
          typeof next === 'function' ? next(filters) : next
        )}
        presets={presetState.saved}
        activePreset={presetState.active}
        onLoadPreset={loadPreset}
        onSavePreset={savePreset}
        onDeletePreset={deletePreset}
      />

      <SubNav section={section} setSection={setSection} pinnedCount={pinState.ids.length} />

      <div>
        {section === 'pinned'    && (
          pinState.ids.length === 0 ? (
            <PinnedEmptyState onGoToOverview={() => setSection('overview')} />
          ) : (
            <OverviewDashboard
              filters={filters}
              onDrillDown={openDrill}
              pinnedCardIds={pinState.ids}
              onTogglePin={togglePin}
              filterCardIds={pinState.ids}
              onReorderCards={reorderPins}
            />
          )
        )}
        {section === 'overview'  && (
          <OverviewDashboard
            filters={filters}
            onDrillDown={openDrill}
            pinnedCardIds={pinState.ids}
            onTogglePin={togglePin}
          />
        )}
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
        <h3 className="text-sm font-bold text-white">Market Analytics ,  Enterprise preview</h3>
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
  // null = still loading; 'live' = remote snapshot loaded; 'preview' = fell back to mocks
  const [source, setSource] = useState(getDataSource());
  const [generatedAt, setGeneratedAt] = useState(getSnapshotGeneratedAt());

  useEffect(() => {
    let mounted = true;
    ensureLoaded().then(() => {
      if (!mounted) return;
      setSource(getDataSource());
      setGeneratedAt(getSnapshotGeneratedAt());
    });
    return () => { mounted = false; };
  }, []);

  if (source === 'live') {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <span className="text-emerald-300 font-semibold">Live data.</span>{' '}
          Pulled from the Market Intelligence snapshot
          {generatedAt ? ` · generated ${formatGeneratedAt(generatedAt)}` : ''}.
          Click any source badge to see where a specific figure came from.
        </p>
      </div>
    );
  }

  // Default banner ,  shown while loading AND when we fall back to mocks.
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-start gap-2">
      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-slate-400 leading-relaxed">
        <span className="text-amber-300 font-semibold">Preview data.</span>{' '}
        Every number is tagged with its source; click any badge to see where it came from. Fixtures are deterministic, so the same filter always returns the same numbers ,  when the Market Intelligence snapshot is available, values will update automatically and this banner turns green.
      </p>
    </div>
  );
}

function formatGeneratedAt(iso) {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours}h ago`;
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'recently';
  }
}

// ============ Filter Bar =============================================
function FilterBar({ filters, setFilters, presets, activePreset, onLoadPreset, onSavePreset, onDeletePreset }) {
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
  const anyFilter = filters.regions.length || filters.sources.length
    || (filters.age_class && filters.age_class.length)
    || (filters.lineage_tier && filters.lineage_tier.length)
    || filters.timeframe !== '12m';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 flex flex-wrap items-center gap-2">
      <FilterPresets
        presets={presets}
        activePreset={activePreset}
        onLoadPreset={onLoadPreset}
        onSavePreset={onSavePreset}
        onDeletePreset={onDeletePreset}
        canSave={!!anyFilter}
      />

      <FilterDivider />

      {/* Timeframe ,  always visible */}
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

      {/* Age class (multi-select) */}
      <MultiPillSelect
        label="Age"
        values={filters.age_class || []}
        options={AGE_CLASSES.map((a) => [a.code, a.label])}
        onChange={(next) => setFilters((f) => ({ ...f, age_class: next }))}
      />
      {/* Lineage tier (multi-select) */}
      <MultiPillSelect
        label="Lineage"
        values={filters.lineage_tier || []}
        options={LINEAGE_TIERS.map((t) => [t.code, t.label])}
        onChange={(next) => setFilters((f) => ({ ...f, lineage_tier: next }))}
      />

      {/* Sources ,  internal vs external toggle popover */}
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

function FilterPresets({ presets, activePreset, onLoadPreset, onSavePreset, onDeletePreset, canSave }) {
  const names = Object.keys(presets || {});
  const hasSaved = names.length > 0;
  const label = activePreset || (hasSaved ? 'Presets' : 'Save preset');

  const handleSave = () => {
    const name = (window.prompt('Name this preset:', activePreset || '') || '').trim();
    if (name) onSavePreset(name);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 text-xs rounded px-2 py-1 border transition-colors ${
            activePreset
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'text-slate-200 hover:bg-slate-800 border-slate-700'
          }`}
          aria-label="Filter presets"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span className="truncate max-w-[120px]">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="bg-slate-900 border-slate-700 text-slate-200 w-64 p-2 space-y-1">
        {hasSaved ? (
          <div className="space-y-0.5">
            {names.map((name) => {
              const isActive = name === activePreset;
              return (
                <div
                  key={name}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
                    isActive ? 'bg-emerald-500/15' : 'hover:bg-slate-800'
                  }`}
                >
                  <button
                    onClick={() => onLoadPreset(name)}
                    className={`flex-1 text-left text-xs truncate ${
                      isActive ? 'text-emerald-200' : 'text-slate-200'
                    }`}
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => onDeletePreset(name)}
                    className="text-slate-500 hover:text-red-300 shrink-0"
                    aria-label={`Delete preset ${name}`}
                    title="Delete preset"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
            <div className="h-px bg-slate-700/60 my-1" />
          </div>
        ) : (
          <div className="text-[10px] text-slate-500 px-1.5 pb-1">
            No saved presets yet. Set filters, then save.
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={!canSave && !activePreset}
          className="w-full inline-flex items-center gap-1.5 text-xs px-2 py-1.5 rounded text-emerald-200 hover:bg-emerald-500/10 disabled:text-slate-600 disabled:hover:bg-transparent disabled:cursor-not-allowed"
          title={!canSave && !activePreset ? 'Change a filter first to save a preset' : 'Save the current filter state as a preset'}
        >
          <Plus className="w-3.5 h-3.5" />
          {activePreset ? `Update "${activePreset}"` : 'Save current filters'}
        </button>
      </PopoverContent>
    </Popover>
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

function MultiPillSelect({ label, values, options, onChange }) {
  const safe = Array.isArray(values) ? values : [];
  const toggle = (code) => {
    onChange(safe.includes(code) ? safe.filter((c) => c !== code) : [...safe, code]);
  };
  const summary = safe.length === 0
    ? 'Any'
    : safe.length === 1
      ? (options.find(([c]) => c === safe[0])?.[1] || safe[0])
      : `${safe.length} selected`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 text-xs rounded px-2 py-1 border transition-colors ${
            safe.length > 0
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : 'text-slate-200 hover:bg-slate-800 border-slate-700'
          }`}
        >
          <span className="text-slate-500">{label}:</span>
          <span className="truncate max-w-[140px]">{summary}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="bg-slate-900 border-slate-700 text-slate-200 w-60 p-1 space-y-0.5">
        {options.map(([code, lbl]) => {
          const on = safe.includes(code);
          return (
            <button
              key={code}
              onClick={() => toggle(code)}
              className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-2 transition-colors ${
                on ? 'bg-emerald-500/15 text-emerald-200' : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded border ${
                on ? 'bg-emerald-500/30 border-emerald-400' : 'border-slate-600'
              }`}>
                {on && <span className="block w-1.5 h-1.5 bg-emerald-300 rounded-sm" />}
              </span>
              <span className="flex-1">{lbl}</span>
            </button>
          );
        })}
        {safe.length > 0 && (
          <>
            <div className="h-px bg-slate-700/60 my-1" />
            <button
              onClick={() => onChange([])}
              className="w-full text-left text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800"
            >
              Clear {label.toLowerCase()}
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
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
function SubNav({ section, setSection, pinnedCount = 0 }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
      {SUB_NAV.map((s) => {
        const Icon = s.icon;
        const on = section === s.key;
        const showCount = s.key === 'pinned' && pinnedCount > 0;
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
            {showCount && (
              <span className="ml-0.5 text-[10px] bg-emerald-500/20 text-emerald-200 rounded px-1 py-0.5 tabular-nums">
                {pinnedCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PinnedEmptyState({ onGoToOverview }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 p-8 text-center">
      <Pin className="w-6 h-6 text-slate-600 mx-auto mb-2" />
      <h3 className="text-sm font-semibold text-slate-200 mb-1">No pinned cards yet</h3>
      <p className="text-xs text-slate-500 max-w-md mx-auto mb-3">
        Pin cards from the Overview tab to build your own at-a-glance dashboard.
        Your pins are saved per browser and persist across sessions.
      </p>
      <Button
        size="sm"
        onClick={onGoToOverview}
        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
      >
        Go to Overview <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
      </Button>
    </div>
  );
}
