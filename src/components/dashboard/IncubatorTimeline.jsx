import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Egg as EggIcon } from 'lucide-react';
import { addDays, differenceInCalendarDays, format, startOfMonth, addMonths } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/api/appClient';
import { supabase } from '@/lib/supabaseClient';
import { parseLocalDate } from '@/lib/dateUtils';
import { createPageUrl } from '@/utils';

/**
 * Dashboard card: every clutch this member has in the incubator, drawn as
 * a bar from lay date to expected hatch, with the due date and days left
 * on the right. Same idea as the Breeding Season page, narrowed to what
 * matters on the dashboard: what is warming up and when it lands.
 *
 * Renders nothing when there are no incubating eggs, so an empty
 * incubator does not add a card to the page.
 */

const INCUBATION_FALLBACK_DAYS = 75;

async function loadIncubator(email) {
  const eggs = await api.entities.Egg.filter({ created_by: email, status: 'Incubating' }, '-lay_date');
  const live = (eggs || []).filter((e) => e.lay_date && !e.archived);
  if (live.length === 0) return { clutches: [] };

  const planIds = [...new Set(live.map((e) => e.breeding_plan_id).filter(Boolean))];
  const { data: plans } = await supabase
    .from('breeding_plans')
    .select('id, sire_id, dam_id, breeding_id')
    .in('id', planIds);
  const geckoIds = [...new Set((plans || []).flatMap((p) => [p.sire_id, p.dam_id]).filter(Boolean))];
  const { data: geckos } = geckoIds.length
    ? await supabase.from('geckos').select('id, name').in('id', geckoIds)
    : { data: [] };
  const nameOf = Object.fromEntries((geckos || []).map((g) => [g.id, g.name]));
  const planById = Object.fromEntries((plans || []).map((p) => [p.id, p]));

  // One clutch per plan and lay date.
  const groups = new Map();
  for (const egg of live) {
    const key = `${egg.breeding_plan_id}|${egg.lay_date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(egg);
  }

  const clutches = [...groups.values()].map((clutchEggs) => {
    const first = clutchEggs[0];
    const plan = planById[first.breeding_plan_id];
    const lay = parseLocalDate(first.lay_date);
    let due = null;
    for (const egg of clutchEggs) {
      const d = egg.hatch_date_expected ? parseLocalDate(egg.hatch_date_expected) : addDays(lay, INCUBATION_FALLBACK_DAYS);
      if (d && (!due || d > due)) due = d;
    }
    const pair = plan
      ? `${nameOf[plan.sire_id] || 'Sire'} x ${nameOf[plan.dam_id] || 'Dam'}`
      : 'Unpaired clutch';
    return { key: `${first.breeding_plan_id}|${first.lay_date}`, pair, lay, due, count: clutchEggs.length };
  });

  clutches.sort((a, b) => a.due - b.due);
  return { clutches };
}

function buildWindow(clutches, today) {
  let start = today;
  let end = today;
  for (const c of clutches) {
    if (c.lay < start) start = c.lay;
    if (c.due > end) end = c.due;
  }
  start = startOfMonth(start);
  end = addDays(end, 7);
  const span = Math.max(differenceInCalendarDays(end, start), 30);
  const frac = (d) => Math.min(1, Math.max(0, differenceInCalendarDays(d, start) / span));
  const ticks = [];
  for (let m = startOfMonth(start); m <= end; m = addMonths(m, 1)) {
    ticks.push({ label: format(m, 'MMM'), frac: frac(m) });
  }
  return { frac, ticks };
}

function dueLabel(due, today) {
  const days = differenceInCalendarDays(due, today);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  if (days < 14) return `${days} days`;
  return `${Math.round(days / 7)} weeks`;
}

export default function IncubatorTimeline({ email }) {
  const today = useMemo(() => new Date(), []);
  const query = useQuery({
    queryKey: ['dashboard', 'incubator', email],
    queryFn: () => loadIncubator(email),
    enabled: Boolean(email),
    staleTime: 5 * 60 * 1000,
  });
  const clutches = query.data?.clutches ?? [];
  const win = useMemo(() => buildWindow(clutches, today), [clutches, today]);

  if (!email || clutches.length === 0) return null;

  const nextDue = clutches[0];

  return (
    <Card className="gecko-card">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-gecko-text">
            <EggIcon className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold">In the incubator</h3>
          </div>
          <Link to={createPageUrl('BreedingSeason')} className="text-xs text-emerald-400 hover:text-emerald-300">
            Season timeline
          </Link>
        </div>

        <p className="text-xs text-slate-400">
          {clutches.length === 1 ? '1 clutch' : `${clutches.length} clutches`} warming up. Next hatch:{' '}
          <span className="text-amber-300 font-semibold">{nextDue.pair}</span>, {dueLabel(nextDue.due, today)}.
        </p>

        {/* Month ticks */}
        <div className="relative h-4 text-[10px] uppercase tracking-wide text-slate-500">
          {win.ticks.map((t) => (
            <span key={t.label + t.frac} className="absolute -translate-x-1/2" style={{ left: `${t.frac * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>

        <div className="space-y-2">
          {clutches.map((c) => {
            const left = win.frac(c.lay) * 100;
            const width = Math.max(win.frac(c.due) * 100 - left, 3);
            return (
              <div key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {c.pair} <span className="text-slate-500 font-normal">· {c.count} {c.count === 1 ? 'egg' : 'eggs'}</span>
                  </div>
                  <div className="relative h-5 mt-1 rounded bg-slate-800/60 overflow-hidden">
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded bg-amber-500/25 border border-amber-400/70 text-amber-50 text-[10px] leading-none flex items-center px-1.5 whitespace-nowrap overflow-hidden"
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`Laid ${format(c.lay, 'MMM d')}, expected ${format(c.due, 'MMM d')}`}
                    >
                      laid {format(c.lay, 'MMM d')}
                    </div>
                    <div className="absolute top-0 bottom-0 w-px bg-emerald-400/80" style={{ left: `${win.frac(today) * 100}%` }} title="Today" />
                  </div>
                </div>
                <div className="text-right text-xs leading-tight">
                  <div className="font-semibold text-slate-100">{dueLabel(c.due, today)}</div>
                  <div className="text-slate-500">due {format(c.due, 'MMM d')}</div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
