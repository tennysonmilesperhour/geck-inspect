import { useMemo } from 'react';
import { History } from 'lucide-react';
import {
  summarizeBreedingHistory,
  breedingHistoryTotals,
} from '@/lib/breedingHistoryUtils';

function formatPct(value) {
  if (value == null) return '-';
  return `${Math.round(value * 100)}%`;
}

function formatWeight(min, max) {
  if (min == null || max == null) return '—';
  if (min === max) return `${min}g`;
  return `${min}–${max}g`;
}

/**
 * Per-season breeding summary for a female gecko: eggs laid, infertile/failed,
 * hatched, her age that season, and the weight range she held during the
 * laying window. Renders a friendly empty state when there's nothing yet.
 */
export default function BreedingHistory({
  eggs = [],
  breedingPlans = [],
  weightRecords = [],
  hatchDate = null,
}) {
  const rows = useMemo(
    () =>
      summarizeBreedingHistory({
        eggs,
        breedingPlans,
        weightRecords,
        hatchDate,
      }),
    [eggs, breedingPlans, weightRecords, hatchDate]
  );
  const totals = useMemo(() => breedingHistoryTotals(rows), [rows]);

  if (rows.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Breeding History
        </h3>
        <p className="text-slate-400 text-center py-4 text-sm">
          No breeding history yet — once she lays her first clutch, each season will show up here.
        </p>
      </div>
    );
  }

  // Render newest season first.
  const display = [...rows].reverse();

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <History className="w-5 h-5" />
        Breeding History
      </h3>

      {/* Lifetime totals */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-center">
        <div className="bg-slate-800 rounded-lg p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Seasons</p>
          <p className="text-slate-100 font-semibold">{totals.seasons}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Laid</p>
          <p className="text-slate-100 font-semibold">{totals.eggsLaid}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Hatched</p>
          <p className="text-emerald-400 font-semibold">{totals.hatched}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Hatch Rate</p>
          <p className="text-emerald-400 font-semibold">{formatPct(totals.hatchRate)}</p>
        </div>
      </div>

      {/* Season rows */}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {display.map((row) => {
          const pending = row.incubating + row.unknown;
          return (
            <div key={row.seasonLabel} className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-slate-100 font-semibold text-sm">
                    {row.seasonLabel}
                    <span className="text-slate-500 font-normal text-xs ml-2">
                      Season #{row.seasonNumber}
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {row.ageYears != null ? `Age ${row.ageYears}y` : 'Age unknown'}
                    <span className="mx-1">·</span>
                    Weight {formatWeight(row.weightMin, row.weightMax)}
                  </p>
                </div>
                <p className="text-xs text-emerald-400 font-semibold">
                  {formatPct(row.hatchRate)}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-1 text-center text-xs">
                <div className="bg-slate-900/60 rounded px-1 py-1">
                  <p className="text-[10px] text-slate-500">Laid</p>
                  <p className="text-slate-200 font-semibold">{row.eggsLaid}</p>
                </div>
                <div className="bg-slate-900/60 rounded px-1 py-1">
                  <p className="text-[10px] text-slate-500">Hatched</p>
                  <p className="text-emerald-400 font-semibold">{row.hatched}</p>
                </div>
                <div className="bg-slate-900/60 rounded px-1 py-1" title={`Infertile: ${row.infertile} · Slug/Stillborn: ${row.failed}`}>
                  <p className="text-[10px] text-slate-500">Inf/Fail</p>
                  <p className="text-red-400 font-semibold">{row.failedOrInfertile}</p>
                </div>
                <div className="bg-slate-900/60 rounded px-1 py-1">
                  <p className="text-[10px] text-slate-500">Pending</p>
                  <p className="text-amber-400 font-semibold">{pending}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
