import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { loadWeighInReminder, setGeckoWeighInReminder } from '@/lib/careReminders';
import { addDaysISO, friendlyDay, weighInIntervalDays } from '@/lib/firstGeckoFlow';
import { todayLocalISO } from '@/lib/dateUtils';

/**
 * The gecko record's weigh-in reminder: on or off for this gecko, with the
 * next due date. New geckos from the guided first gecko start with it on;
 * any other gecko can be switched on here. The member-wide switch in
 * Settings overrides it (shown as a note when it is off).
 *
 * Props: gecko, email (the owner), lastWeighDate (YYYY-MM-DD or null).
 */
export default function WeighInReminderSwitch({ gecko, email, lastWeighDate = null }) {
  const [state, setState] = useState({ status: 'loading', on: false, memberEnabled: true });
  const everyDays = weighInIntervalDays(gecko);

  useEffect(() => {
    if (!email || !gecko?.id) return undefined;
    let cancelled = false;
    loadWeighInReminder(email, gecko.id)
      .then((r) => { if (!cancelled) setState({ status: 'ready', on: Boolean(r.gecko?.on), memberEnabled: r.memberEnabled }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', on: false, memberEnabled: true }); });
    return () => { cancelled = true; };
  }, [email, gecko?.id]);

  if (state.status === 'error') return null;

  const change = async (on) => {
    const before = state;
    setState({ ...state, status: 'saving', on });
    try {
      await setGeckoWeighInReminder(email, gecko.id, { on, everyDays, since: lastWeighDate || todayLocalISO() });
      setState({ ...before, status: 'ready', on });
    } catch (err) {
      setState(before);
      toast({ title: 'Could not change the reminder', description: err.message, variant: 'destructive' });
    }
  };

  const due = lastWeighDate ? addDaysISO(lastWeighDate, everyDays) : todayLocalISO();
  const detail = !state.memberEnabled
    ? 'Weigh-in reminders are off for your account (Settings, Notifications).'
    : state.on
      ? `Every ${everyDays} days. Next due ${friendlyDay(due)}.`
      : `Turn on for a note every ${everyDays} days, even with the app closed.`;

  return (
    <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
      <div className="min-w-0">
        <Label htmlFor={`weigh-remind-${gecko.id}`} className="text-sm text-slate-100 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-sky-400" /> Weigh-in reminder
        </Label>
        <p className="text-[11px] text-slate-400 mt-0.5">{detail}</p>
      </div>
      <Switch
        id={`weigh-remind-${gecko.id}`}
        checked={state.on && state.memberEnabled}
        disabled={state.status !== 'ready' || !state.memberEnabled}
        onCheckedChange={change}
      />
    </div>
  );
}
