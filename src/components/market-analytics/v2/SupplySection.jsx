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
import { supplyShift, valuePipeline, periodLabels } from '@/lib/marketAnalytics/v2/model';

export default function SupplySection({ agg, pipeline, pipelineIsExample, pipelineStatus = 'ready' }) {
  const shift = useMemo(() => supplyShift(agg).slice(0, 12), [agg]);
  const periods = useMemo(() => periodLabels(agg), [agg]);
  const clutches = useMemo(() => valuePipeline(agg, pipeline || []), [agg, pipeline]);
  const max = Math.max(...shift.flatMap((r) => [r.earlier_share, r.recent_share]), 1);
  const total = clutches.reduce((s, c) => ({ low: s.low + c.total.low, mid: s.mid + c.total.mid, high: s.high + c.total.high }), { low: 0, mid: 0, high: 0 });
  const eggs = clutches.reduce((s, c) => s + c.eggs, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <SectionHeader
          icon={Sprout}
          title="Supply shift, share of new listings"
          subtitle={`Each trait's slice of new listings, ${periods.earlierShort} vs ${periods.recentShort}. A growing slice means more competition when you list.`}
          right={
            <MethodologyPopover title="How shares are counted">
              <p>A listing with three traits counts once for each trait, so shares add up to more than 100%. We compare shares, not raw counts, because the two periods collected very different numbers of listings.</p>
              <p>Earlier is {periods.earlier}. Recent is {periods.recent}.</p>
            </MethodologyPopover>
          }
        />
        <div className="space-y-2.5">
          {shift.map((r) => (
            <div key={r.name} className="grid grid-cols-[110px_1fr_56px] sm:grid-cols-[140px_1fr_64px] items-center gap-3">
              <div className="text-xs text-slate-200 truncate">{r.name}</div>
              <div className="space-y-1">
                <Bar pct={(r.earlier_share / max) * 100} cls="bg-slate-500/50" label={`${periods.earlierShort} ${r.earlier_share.toFixed(1)}%`} />
                <Bar pct={(r.recent_share / max) * 100} cls={r.delta >= 0 ? 'bg-amber-400/70' : 'bg-emerald-400/70'} label={`${periods.recentShort} ${r.recent_share.toFixed(1)}%`} />
              </div>
              <div className={`text-right text-xs tabular-nums font-semibold ${Math.abs(r.delta) < 0.05 ? 'text-slate-400' : r.delta > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {Math.abs(r.delta) < 0.05 ? '0.0' : `${r.delta > 0 ? '+' : '-'}${Math.abs(r.delta).toFixed(1)}`} pt
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-slate-500/50" />{periods.earlierShort}</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-amber-400/70" />{periods.recentShort}, more crowded</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-400/70" />{periods.recentShort}, less crowded</span>
        </div>
      </div>

      <div className="lg:col-span-2 min-w-0 rounded-xl border border-slate-700 bg-slate-900 p-4">
        <SectionHeader
          icon={Egg}
          title="Your pipeline"
          subtitle="Incubating clutches, valued at today's hatchling asks"
          right={pipelineIsExample && (
            <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] leading-none bg-sky-500/10 text-sky-300 border-sky-500/30">Example clutches</span>
          )}
        />
        {pipelineStatus === 'loading' ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-800/40 animate-pulse" />)}
          </div>
        ) : pipelineStatus === 'error' ? (
          <p className="text-xs text-slate-400 py-4">Your eggs could not be loaded. Reload the page to try again.</p>
        ) : clutches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-center">
            <Egg className="w-5 h-5 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-300">No eggs incubating right now.</p>
            <p className="text-[11px] text-slate-500 mt-1">Log a clutch under Breeding and it shows up here, valued at current hatchling asking prices.</p>
          </div>
        ) : (
          <>
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2.5 mb-3">
              <div className="text-[10px] text-slate-400">{eggs} egg{eggs === 1 ? '' : 's'} incubating across {clutches.length} clutch{clutches.length === 1 ? '' : 'es'}</div>
              <div className="text-2xl font-bold text-emerald-300 tabular-nums">${total.mid.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 tabular-nums">likely range ${total.low.toLocaleString()} to ${total.high.toLocaleString()} as hatchlings</div>
            </div>
            <div className="space-y-2">
              {clutches.map((c) => (
                <div key={c.id} className="rounded-lg bg-slate-800/40 border border-slate-800/60 px-3 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-100 truncate">{c.pair}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {c.traits.length ? c.traits.join(', ') : 'No traits recognized'} · {c.eggs} egg{c.eggs > 1 ? 's' : ''}{c.due ? ` · due ${fmtDate(c.due)}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    {c.priced ? (
                      <>
                        <div className="text-sm font-semibold text-slate-100 tabular-nums">${c.total.mid.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500 tabular-nums">${c.each.low} to ${c.each.high} each</div>
                      </>
                    ) : (
                      <div className="text-[10px] text-slate-500 max-w-[90px]">Add parent traits to price it</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-3">Priced from the highest-value trait in each pairing at baby age. Outcomes vary by clutch; the Pairing Planner gives per-egg odds.</p>
          </>
        )}
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
  return new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
