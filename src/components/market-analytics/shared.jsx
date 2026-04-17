/**
 * Market Analytics — Shared UI Primitives
 *
 * Small, self-contained visual components that every analytics view
 * reuses: source badges, confidence chips, freshness indicators,
 * sparklines, and a methodology popover.
 *
 * Keeping them in one file because they're individually tiny and
 * always used together. If one grows, split it out.
 */

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info, Cloud, Database, Calculator, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';
import { getSource, freshnessLabel, isInternal, SOURCE_KINDS } from '@/lib/marketAnalytics/sources';
import { confidenceTier } from '@/lib/marketAnalytics/confidence';

// ------------ SourceBadge --------------------------------------------
// A small pill that shows where a number came from, colored by kind.
// Clicking opens a popover with the full description.
export function SourceBadge({ sourceId, size = 'sm' }) {
  const src = getSource(sourceId);
  const colors = src.kind === SOURCE_KINDS.INTERNAL
    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
    : src.kind === SOURCE_KINDS.SCRAPED
    ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
    : 'bg-amber-500/10 text-amber-300 border-amber-500/30';
  const Icon = src.kind === SOURCE_KINDS.INTERNAL ? Database
    : src.kind === SOURCE_KINDS.SCRAPED ? Cloud
    : Calculator;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${colors} ${size === 'xs' ? 'text-[10px]' : 'text-[11px]'} leading-none`}>
          <Icon className="w-3 h-3" />{src.short}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="bg-slate-900 border-slate-700 text-slate-200 w-72 p-3 text-xs">
        <div className="font-semibold text-slate-100 mb-1">{src.label}</div>
        <div className="text-slate-400 mb-2">{src.description}</div>
        <div className="flex justify-between text-[10px] text-slate-500">
          <span>{src.kind === SOURCE_KINDS.INTERNAL ? 'First-party' : src.kind === SOURCE_KINDS.SCRAPED ? 'External' : 'Derived'}</span>
          <span>Refreshes every {freshnessLabel(src.refresh_minutes)}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ------------ SourceBadgeStack — show up to 3 contributing sources ----
export function SourceBadgeStack({ sourceIds = [] }) {
  if (!sourceIds?.length) return null;
  const internal = sourceIds.filter(isInternal);
  const external = sourceIds.filter((id) => !isInternal(id));
  const display = [...internal, ...external].slice(0, 3);
  const extra = sourceIds.length - display.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {display.map((id) => <SourceBadge key={id} sourceId={id} size="xs" />)}
      {extra > 0 && (
        <span className="text-[10px] text-slate-500 px-1">+{extra} more</span>
      )}
    </div>
  );
}

// ------------ ConfidenceChip -----------------------------------------
// A 0..1 score rendered as a colored chip with a tooltip on hover.
export function ConfidenceChip({ confidence, sampleSize, sources = [], methodology, size = 'sm' }) {
  const tier = confidenceTier(confidence);
  const palette = {
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    amber:   'bg-amber-500/15 text-amber-200 border-amber-500/40',
    orange:  'bg-orange-500/15 text-orange-200 border-orange-500/40',
    red:     'bg-red-500/15 text-red-300 border-red-500/40',
  }[tier.color];
  const Icon = confidence >= 0.65 ? ShieldCheck : ShieldAlert;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 ${palette} ${size === 'xs' ? 'text-[10px]' : 'text-[11px]'} leading-none`}>
          <Icon className="w-3 h-3" />{tier.label} · {Math.round(confidence * 100)}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="bg-slate-900 border-slate-700 text-slate-200 w-80 p-3 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-slate-100">Confidence: {tier.label}</span>
          <span className="ml-auto text-slate-500 text-[10px]">{Math.round(confidence * 100)}/100</span>
        </div>
        <div className="space-y-1.5 text-slate-400">
          <div className="flex justify-between"><span>Sample size</span><span className="text-slate-200">{sampleSize ?? 0}</span></div>
          <div className="flex justify-between"><span>Contributing sources</span><span className="text-slate-200">{sources?.length ?? 0}</span></div>
        </div>
        {methodology && (
          <div className="mt-2 pt-2 border-t border-slate-700/70 text-slate-400 leading-relaxed">
            {methodology}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ------------ FreshnessIndicator -------------------------------------
// Little clock chip next to a headline that indicates "freshness" — how
// recently the underlying sources were scraped/synced.
export function FreshnessIndicator({ sourceIds = [] }) {
  if (!sourceIds.length) return null;
  const maxMins = Math.max(...sourceIds.map((id) => getSource(id).refresh_minutes ?? 1440));
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
      <Clock className="w-3 h-3" />Freshness ≤ {freshnessLabel(maxMins)}
    </span>
  );
}

// ------------ MethodologyPopover -------------------------------------
// Generic "how was this calculated?" button. Serious users always ask.
export function MethodologyPopover({ title, children }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300">
          <Info className="w-3 h-3" />Methodology
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="bg-slate-900 border-slate-700 text-slate-200 w-96 p-3 text-xs">
        {title && <div className="font-semibold text-slate-100 mb-1.5">{title}</div>}
        <div className="text-slate-400 leading-relaxed space-y-1.5">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

// ------------ Sparkline ----------------------------------------------
// Tiny inline SVG sparkline. Null values are skipped (break the line).
export function Sparkline({ data = [], width = 100, height = 28, stroke = '#34d399', fill = 'rgba(52,211,153,0.12)' }) {
  const valid = data.filter((v) => v != null && Number.isFinite(v));
  if (valid.length < 2) return <div className="text-[10px] text-slate-600">—</div>;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => {
    if (v == null) return null;
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  // Build segments separated by nulls so we don't interpolate gaps.
  const segments = [];
  let current = [];
  points.forEach((p) => {
    if (p == null) { if (current.length > 1) segments.push(current); current = []; }
    else current.push(p);
  });
  if (current.length > 1) segments.push(current);
  return (
    <svg width={width} height={height} className="block">
      {segments.map((seg, i) => (
        <g key={i}>
          <polyline
            points={seg.join(' ')}
            fill="none"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon
            points={`${seg[0].split(',')[0]},${height} ${seg.join(' ')} ${seg[seg.length - 1].split(',')[0]},${height}`}
            fill={fill}
          />
        </g>
      ))}
    </svg>
  );
}

// ------------ TrendDelta ---------------------------------------------
// Signed percentage with arrow and color.
export function TrendDelta({ value, digits = 1 }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-slate-500">—</span>;
  const up = value >= 0;
  return (
    <span className={`tabular-nums font-semibold ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(digits)}%
    </span>
  );
}

// ------------ SectionHeader ------------------------------------------
export function SectionHeader({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-start gap-2.5">
        {Icon && (
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-emerald-300" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ------------ HeatmapCell --------------------------------------------
// Used by the regional heatmap. Color by value within a min/max range,
// opacity by confidence.
export function HeatmapCell({ value, min, max, confidence, onClick, label }) {
  const range = max - min || 1;
  const t = value ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  // Green-low to red-high palette (lower price = cheaper = green = good
  // for buyers; upper price = red). The UI lets the user flip this.
  const hue = 140 - t * 140;  // 140 (green) to 0 (red)
  const alpha = 0.15 + (confidence ?? 0.5) * 0.55;
  const bg = value ? `hsla(${hue}, 65%, 45%, ${alpha})` : 'rgba(30, 41, 59, 0.4)';
  return (
    <button
      onClick={onClick}
      className="relative rounded text-[10px] tabular-nums font-medium text-white w-full h-10 border border-slate-800 hover:border-emerald-500/60 transition-colors"
      style={{ background: bg }}
      title={label}
    >
      {value ? `$${value}` : '—'}
    </button>
  );
}
