import { useEffect, useState } from 'react';
import { Bell, Utensils } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import {
  CARE_DEFAULTS_FROM,
  effectiveGeckoFeeding,
  effectiveWeighIn,
  loadCareDefaultsFrom,
  loadCareReminderSettings,
  setGeckoFeedingReminder,
  setGeckoWeighInReminder,
} from '@/lib/careReminders';
import { addDaysISO, friendlyDay } from '@/lib/firstGeckoFlow';
import { weighInCadenceLabel } from '@/lib/lifeStage';
import { todayLocalISO } from '@/lib/dateUtils';

// "Follow its life stage" is the default; the others fix the cadence.
const WEIGH_CHOICES = [
  { value: 'auto', label: 'Follow its age and weight' },
  { value: '14', label: 'Every 2 weeks' },
  { value: '21', label: 'Every 3 weeks' },
  { value: '30', label: 'Once a month' },
];
const FEED_CHOICES = [2, 3, 4, 5, 7];

const selectClass = 'mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200';

/**
 * The gecko record's care reminders: the weigh-in reminder, and the
 * feeding reminder for a gecko that is not in a feeding group.
 *
 * A gecko added on or after the day the defaults start (the October 2026
 * release, review item E2 15) has both on without the member opening
 * Settings: weigh-ins every 2, 3 or 4 weeks by its life stage, feeding
 * every 3 days. That day comes from the same setting the reminder jobs
 * read (loadCareDefaultsFrom), so these switches show what the server
 * sends. Each can be switched off here, or given a fixed schedule. Older
 * geckos start off and can be switched on. The account switches in
 * Settings override these (shown as a note).
 *
 * Props: gecko, email (the owner), lastWeighDate (YYYY-MM-DD or null).
 */
export default function WeighInReminderSwitch({ gecko, email, lastWeighDate = null }) {
  const [state, setState] = useState({ status: 'loading', extra: {}, defaultsFrom: CARE_DEFAULTS_FROM });

  useEffect(() => {
    if (!email || !gecko?.id) return undefined;
    let cancelled = false;
    Promise.all([loadCareReminderSettings(email), loadCareDefaultsFrom()])
      .then(([extra, defaultsFrom]) => { if (!cancelled) setState({ status: 'ready', extra, defaultsFrom }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', extra: {}, defaultsFrom: CARE_DEFAULTS_FROM }); });
    return () => { cancelled = true; };
  }, [email, gecko?.id]);

  if (state.status === 'error' || !gecko?.id) return null;

  const { defaultsFrom } = state;
  const weigh = effectiveWeighIn(state.extra, gecko, { defaultsFrom });
  const feed = effectiveGeckoFeeding(state.extra, gecko, { defaultsFrom });
  const busy = state.status !== 'ready';

  const update = async (write) => {
    const before = state;
    setState({ ...state, status: 'saving' });
    try {
      const extra = await write();
      setState({ status: 'ready', extra: extra || before.extra, defaultsFrom: before.defaultsFrom });
    } catch (err) {
      setState(before);
      toast({ title: 'Could not change the reminder', description: err.message, variant: 'destructive' });
    }
  };

  const changeWeigh = (on, choice = weigh.fixed ? String(weigh.everyDays) : 'auto') => update(() => setGeckoWeighInReminder(email, gecko.id, {
    on,
    everyDays: choice === 'auto' ? weigh.everyDays : Number(choice),
    fixed: choice !== 'auto',
    since: lastWeighDate || todayLocalISO(),
  }));
  const changeFeed = (on, everyDays = feed.everyDays) => update(() => setGeckoFeedingReminder(email, gecko.id, { on, everyDays }));

  const due = lastWeighDate ? addDaysISO(lastWeighDate, weigh.everyDays) : todayLocalISO();
  const cadence = weigh.fixed ? `every ${weigh.everyDays} days` : weighInCadenceLabel(weigh.everyDays);
  const weighDetail = !weigh.memberEnabled
    ? 'Weigh-in reminders are off for your account (Settings, Notifications).'
    : weigh.chosenOn
      ? `${cadence[0].toUpperCase()}${cadence.slice(1)}. Next due ${friendlyDay(due)}.`
      : `Turn on for a note ${cadence}, even with the app closed.`;

  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor={`weigh-remind-${gecko.id}`} className="text-sm text-slate-100 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-sky-400" /> Weigh-in reminder
            </Label>
            <p className="text-[11px] text-slate-400 mt-0.5">{weighDetail}</p>
          </div>
          <Switch
            id={`weigh-remind-${gecko.id}`}
            checked={weigh.chosenOn && weigh.memberEnabled}
            disabled={busy || !weigh.memberEnabled}
            onCheckedChange={(on) => changeWeigh(on)}
          />
        </div>
        {weigh.chosenOn && weigh.memberEnabled && (
          <>
            <label htmlFor={`weigh-cadence-${gecko.id}`} className="sr-only">How often to weigh {gecko.name}</label>
            <select
              id={`weigh-cadence-${gecko.id}`}
              className={selectClass}
              disabled={busy}
              value={weigh.fixed ? String(weigh.everyDays) : 'auto'}
              onChange={(e) => changeWeigh(true, e.target.value)}
            >
              {WEIGH_CHOICES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </>
        )}
      </div>

      {feed.source !== 'group' && (
        <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor={`feed-remind-${gecko.id}`} className="text-sm text-slate-100 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-emerald-400" /> Feeding reminder
              </Label>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {feed.on
                  ? `Every ${feed.everyDays} days from its last feeding. Feeding alerts in Settings turn all of them off.`
                  : 'Turn on for a note on feeding days. A gecko in a feeding group follows the group instead.'}
              </p>
            </div>
            <Switch
              id={`feed-remind-${gecko.id}`}
              checked={feed.on}
              disabled={busy}
              onCheckedChange={(on) => changeFeed(on)}
            />
          </div>
          {feed.on && (
            <>
              <label htmlFor={`feed-days-${gecko.id}`} className="sr-only">Days between feedings for {gecko.name}</label>
              <select
                id={`feed-days-${gecko.id}`}
                className={selectClass}
                disabled={busy}
                value={String(feed.everyDays)}
                onChange={(e) => changeFeed(true, Number(e.target.value))}
              >
                {[...new Set([...FEED_CHOICES, feed.everyDays])].sort((a, b) => a - b).map((d) => (
                  <option key={d} value={String(d)}>Every {d} days</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}
    </div>
  );
}
