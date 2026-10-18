import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { User } from '@/entities/all';

/**
 * Settings, Email: the Weekly Gecko Notes switch (one short email a week
 * after the first two weeks, docs/planning/weekly-notes-2026-10.md).
 *
 * It saves on its own, straight away, through User.setWeeklyNotes, because
 * it is a column of its own (profiles.email_weekly_notes_enabled) and is
 * never part of the Settings form: the form's Save button cannot write it,
 * so an old Settings tab can never switch it back on. The page keeps the
 * value in its own state (`enabled` and `onChange`), so it survives the
 * email list closing and opening with the master switch. A failed save puts
 * the switch back.
 */
export default function WeeklyNotesSetting({ enabled, onChange }) {
  const [saving, setSaving] = useState(false);
  const on = enabled !== false;

  const change = async (next) => {
    const before = on;
    onChange?.(next);
    setSaving(true);
    try {
      await User.setWeeklyNotes(next);
      toast({
        title: next ? 'Weekly Gecko Notes on' : 'Weekly Gecko Notes off',
        description: next
          ? 'One short crested gecko tip a week, after your first two weeks.'
          : 'Your reminders and other emails still arrive.',
      });
    } catch (err) {
      onChange?.(before);
      toast(err?.code === 'PGRST204'
        ? { title: 'Not available yet', description: 'This switch is still being set up. Try again later.', variant: 'destructive' }
        : { title: 'Could not save', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-start justify-between p-3 border border-slate-700 rounded-lg bg-slate-800/50">
      <div className="min-w-0">
        <Label htmlFor="weekly-notes-enabled" className="font-medium text-slate-300">Weekly Gecko Notes</Label>
        <p className="text-sm text-slate-400 mt-1">
          One short crested gecko tip a week, starting after your first two weeks. Turning it off keeps your reminders and other emails.
        </p>
      </div>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        <Switch
          id="weekly-notes-enabled"
          checked={on}
          disabled={saving}
          onCheckedChange={change}
          className="data-[state=checked]:bg-emerald-500"
        />
        <Label htmlFor="weekly-notes-enabled" className={`font-semibold text-sm ${on ? 'text-emerald-400' : 'text-slate-500'}`}>
          {on ? 'On' : 'Off'}
        </Label>
      </div>
    </div>
  );
}
