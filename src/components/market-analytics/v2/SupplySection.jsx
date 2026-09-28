/**
 * Supply: which traits are flooding the market, and what your own
 * incubating clutches should be worth when they hatch.
 *
 * Replaces the v1 nine-month pipeline built from other breeders'
 * records: across all of Geck Inspect only a handful of eggs are
 * logged, too few to forecast a market and too few to keep anyone
 * anonymous. Your own clutches are the useful half of that idea.
 */

import { useMemo } from 'react';
import { Sprout, Egg } from 'lucide-react';
import { SectionHeader, MethodologyPopover } from '../shared';
import { supplyShift, valuePipeline } from '@/lib/marketAnalytics/v2/model';

export default function SupplySection({ agg, pipeline, pipelineIsExample }) {
  const shift = useMemo(() => supplyShift(agg).slice(0, 12), [agg]);
  const clutches = useMemo(() => valuePipeline(agg, pipeline), [agg, pipeline]);
  const max = Math.max(...shift.flatMap((r) => [r.spring_share, r.late_share]), 1);
  const total = clutches.reduce((s, c) => ({ low: s.low + c.total.low, mid: s.mid + c.total.mid, high: s.high + c.total.high }), { low: 0, mid: 0, high: 0 });
  const eggs = clutches.reduce((s, c) => s + c.eggs, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <SectionHeader
          icon={Sprout}
          title="Supply shift, share of new listings"
          subtitle="Each trait's slice of new listings in spring vs late August. A growing slice means more competition when you list."
          right={
            <MethodologyPopover title="How shares are counted">
              <p>A listing with three traits counts once for each trait, so shares add up to more than 100%. We compare shares, not raw counts, because far fewer listings were collected in August.</p>
            </MethodologyPopover>
          }
        />
        <div className="space-y-2.5">
          {shift.map((r) => (
            <div key={r.name} className="grid grid-cols-[110px_1fr_56px] sm:grid-cols-[140px_1fr_64px] items-center gap-3">
              <div className="text-xs text-slate-200 truncate">{r.name}</div>
              <div className="space-y-1">
                <Bar pct={(r.spring_share / max) * 100} cls="bg-slate-500/50" label={`Spring ${r.spring_share.toFixed(1)}%`} />
                <Bar pct={(r.late_share / max) * 100} cls={r.delta >= 0 ? 'bg-amber-400/70' : 'bg-emerald-400/70'} label={`August ${r.late_share.toFixed(1)}%`} />
              </div>
              <div className={`text-right text-xs tabular-nums font-semibold ${r.delta >= 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {r.delta >= 0 ? '+' : ''}{r.delta.toFixed(1)} pt
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-slate-500/50" />Spring</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-amber-400/70" />August, more crowded</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-400/70" />August, less crowded</span>
        </div>
      </div>

      <div className="lg:col-span-2 min-w-0 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <SectionHeader
          icon={Egg}
          title="Your pipeline"
          subtitle="Incubating clutches, valued at today's hatchling asks"
          right={pipelineIsExample && (
            <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-none bg-sky-500/10 text-sky-300 border-sky-500/30">Example clutches</span>
          )}
        />
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2.5 mb-3">
          <div className="text-[10px] text-slate-400">{eggs} eggs incubating across {clutches.length} clutches</div>
          <div className="text-2xl font-bold text-emerald-300 tabular-nums">${total.mid.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 tabular-nums">likely range ${total.low.toLocaleString()} to ${total.high.toLocaleString()} as hatchlings</div>
        </div>
        <div className="space-y-2">
          {clutches.map((c) => (
            <div key={c.id} className="rounded-lg bg-slate-800/40 border border-slate-800/60 px-3 py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate">{c.pair}</div>
                <div className="text-[10px] text-slate-500 truncate">{c.traits.join(', ')} · {c.eggs} egg{c.eggs > 1 ? 's' : ''} · due {fmtDate(c.due)}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-100 tabular-nums">${c.total.mid.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 tabular-nums">${c.each.low} to ${c.each.high} each</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-3">Priced from the highest-value trait in each pairing at baby age. Outcomes vary by clutch; the Pairing Planner gives per-egg odds.</p>
      </div>
    </div>
  );
}

function Bar({ pct, cls, label }) {
  return (
    <div className="h-2.5 rounded-sm bg-slate-800/60 overflow-hidden" title={label}>
      <div className={`h-full rounded-sm ${cls}`} style={{ width: `${Math.max(1.5, pct)}%` }} />
    </div>
  );
}

function fmtDate(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
