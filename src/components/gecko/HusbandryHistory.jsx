import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Utensils, Droplets, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { FeedingRecord, ShedRecord, FeedingGroup } from '@/entities/all';
import { parseLocalDate } from '@/lib/dateUtils';
import { predictNextShed, formatShedWindow } from '@/lib/shedPrediction';
import { shedQualityLabel, mergeLegacyEvents } from '@/lib/husbandryLog';

const fmtDay = (iso) => (iso ? format(parseLocalDate(iso), 'MMM d, yyyy') : '');

const CONFIDENCE_STYLES = {
  high: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/60',
  medium: 'bg-amber-900/60 text-amber-200 border-amber-700/60',
  low: 'bg-slate-800 text-slate-300 border-slate-600',
};

/**
 * Feeding history, shed history and the next shed window for one gecko.
 * Shown in the gecko record window (My Geckos) and on /GeckoDetail for
 * the owner. Reads the shared feeding and shed log (feeding_records and
 * shed_records), which every logging surface writes to: Field Mode,
 * Batch Husbandry, the Dashboard's Mark fed, Project Manager and the
 * record window's "+ Event".
 *
 * Props:
 *   gecko         the gecko row (id, hatch_date, feeding_group_id)
 *   weights       weight_records rows, for the growth adjustment in the forecast
 *   refreshKey    change it to reload after a new log
 *   legacyEvents  gecko_events rows; shed and feeding events logged before
 *                 the shared log existed are folded in (marked "older log")
 *   headingClassName, iconClassName  match the host page's headings
 */
export default function HusbandryHistory({
  gecko,
  weights = [],
  refreshKey = 0,
  legacyEvents = [],
  headingClassName = 'text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2',
  iconClassName = 'w-5 h-5',
}) {
  const [feedingRows, setFeedings] = useState([]);
  const [shedRows, setSheds] = useState([]);
  const [group, setGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const geckoId = gecko?.id;
  const groupId = gecko?.feeding_group_id || null;

  useEffect(() => {
    if (!geckoId) return undefined;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const [f, s, g] = await Promise.allSettled([
        FeedingRecord.filter({ animal_id: geckoId }, '-date', 60),
        ShedRecord.filter({ animal_id: geckoId }, '-date', 60),
        groupId ? FeedingGroup.filter({ id: groupId }).then((rows) => rows?.[0] || null) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setFeedings(f.status === 'fulfilled' ? f.value || [] : []);
      setSheds(s.status === 'fulfilled' ? s.value || [] : []);
      setGroup(g.status === 'fulfilled' ? g.value : null);
      setIsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [geckoId, groupId, refreshKey]);

  if (!gecko) return null;

  const merged = mergeLegacyEvents({ feedings: feedingRows, sheds: shedRows, events: legacyEvents });
  const { feedings, sheds } = merged;
  const prediction = predictNextShed({ sheds, weights, hatchDate: gecko.hatch_date });
  const lastAte = feedings.find((r) => r.accepted !== false);
  const recentFeedings = feedings.slice(0, 12);
  const refusedRecent = feedings.slice(0, 5).filter((r) => r.accepted === false).length;

  return (
    <div className="space-y-6">
      {/* Shed forecast and history */}
      <div>
        <h3 className={headingClassName}>
          <Droplets className={iconClassName} />
          Sheds
        </h3>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
        ) : (
          <div className="space-y-3">
            {prediction ? (
              <div className="bg-slate-800 p-3 rounded-lg">
                <p className="text-xs uppercase tracking-wider text-slate-400 mb-1">Next shed window</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-base font-semibold text-slate-100">{formatShedWindow(prediction)}</span>
                  <Badge variant="outline" className={`${CONFIDENCE_STYLES[prediction.confidence]} capitalize`}>
                    {prediction.confidence} confidence
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">{prediction.basis}</p>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">
                Log a shed (or add a hatch date) and the next shed window shows here.
              </p>
            )}
            {sheds.length > 0 ? (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {sheds.map((r) => (
                  <li key={r.id} className="flex justify-between items-center bg-slate-800/70 px-3 py-2 rounded text-sm">
                    <span className="text-slate-300">
                      {fmtDay(r.date)}
                      {r.legacy && <span className="text-slate-500 text-xs"> (older log)</span>}
                    </span>
                    <span className={r.quality === 'complete' ? 'text-emerald-300' : r.quality === 'unknown' || !r.quality ? 'text-slate-400' : 'text-amber-300'}>
                      {shedQualityLabel(r.quality)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-xs">No sheds logged yet. Use + Event, then Shed, or Field Mode.</p>
            )}
          </div>
        )}
      </div>

      {/* Feeding history */}
      <div>
        <h3 className={headingClassName}>
          <Utensils className={iconClassName} />
          Feeding
        </h3>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
        ) : (
          <div className="space-y-3">
            <div className="bg-slate-800 p-3 rounded-lg text-sm space-y-1">
              <p className="text-slate-300">
                Last ate: <span className="text-slate-100 font-medium">{lastAte ? fmtDay(lastAte.date) : 'not logged yet'}</span>
              </p>
              {group && (
                <p className="text-slate-400 text-xs">
                  Feeding group {group.name || group.label}, every {group.interval_days} day{Number(group.interval_days) === 1 ? '' : 's'}
                  {group.last_fed_date ? `, group last fed ${fmtDay(group.last_fed_date)}` : ''}
                </p>
              )}
              {refusedRecent >= 2 && (
                <p className="text-amber-300 text-xs">
                  Refused {refusedRecent} of the last {Math.min(5, feedings.length)} feedings. A refusal or two is normal; a streak is worth a closer look.
                </p>
              )}
            </div>
            {recentFeedings.length > 0 ? (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {recentFeedings.map((r) => (
                  <li key={r.id} className="flex justify-between items-center gap-2 bg-slate-800/70 px-3 py-2 rounded text-sm">
                    <span className="text-slate-300">
                      {fmtDay(r.date)}
                      {r.legacy && <span className="text-slate-500 text-xs"> (older log)</span>}
                    </span>
                    <span className="text-slate-400 truncate">{r.food_type || 'CGD'}</span>
                    <span className={r.accepted === false ? 'text-amber-300' : 'text-emerald-300'}>
                      {r.accepted === false ? 'Refused' : 'Ate'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-xs">
                No feedings logged yet. Mark fed on the Dashboard, Batch Husbandry, Field Mode or + Event all log here.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
