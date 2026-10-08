import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { loadMemberWeighInEnabled, setMemberWeighInReminders } from '@/lib/careReminders';
import { syncNativeCareReminders } from '@/lib/nativeCareReminders';

/**
 * Settings, Notifications: the member-wide switch for personal weigh-in
 * reminders (every 14 days for a growing gecko, 30 for an adult, set per
 * gecko when it is added). Saves on its own, straight away, because it
 * lives in profiles.extra_data rather than the form's columns.
 */
export default function WeighInReminderSetting({ email }) {
  const [state, setState] = useState({ status: 'loading', on: true });

  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;
    loadMemberWeighInEnabled(email)
      .then((on) => { if (!cancelled) setState({ status: 'ready', on }); })
      .catch(() => { if (!cancelled) setState({ status: 'error', on: true }); });
    return () => { cancelled = true; };
  }, [email]);

  const change = async (on) => {
    const before = state;
    setState({ status: 'saving', on });
    try {
      await setMemberWeighInReminders(email, on);
      syncNativeCareReminders({ email }).catch(() => {});
      setState({ status: 'ready', on });
      toast({ title: on ? 'Weigh-in reminders on' : 'Weigh-in reminders off', description: on ? 'Each gecko gets a note when its weigh-in is due. Turn one off on its record.' : 'No weigh-in reminders for any gecko.' });
    } catch (err) {
      setState(before);
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 p-4 border border-slate-700 rounded-lg bg-slate-800/50">
      <div className="min-w-0">
        <Label htmlFor="weighin-reminders-enabled" className="font-medium text-slate-200">Weigh-in Reminders</Label>
        <p className="text-sm text-slate-400 mt-1">
          A note when a gecko is due to be weighed: every 14 days while it is growing, every 30 days for adults.
          New geckos get one by default; turn a single gecko off on its record.
        </p>
      </div>
      <Switch
        id="weighin-reminders-enabled"
        checked={state.on}
        disabled={state.status === 'loading' || state.status === 'saving'}
        onCheckedChange={change}
      />
    </div>
  );
}
