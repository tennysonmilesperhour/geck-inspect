import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import {
  DEFAULT_REMINDER_TIME_ZONE, detectTimeZone, saveTimeZone, timeZoneLabel, timeZoneOptions,
} from '@/lib/memberTimeZone';

/**
 * Settings, Feeding Alerts: the time zone reminders follow. Feeding,
 * weigh-in, hatch, vet and task reminders arrive at about 7 am in it
 * (src/lib/memberTimeZone.js).
 *
 * It saves on its own the moment the member picks a zone, like the Weekly
 * Gecko Notes switch, so the Settings form's Save button never writes it.
 * Renders nothing until the profile has the column (`profile` is the
 * loaded profile row), so a site deployed before the migration shows no
 * control that cannot save.
 */
export default function TimeZoneSetting({ profile, email }) {
  const hasColumn = !!profile && Object.prototype.hasOwnProperty.call(profile, 'time_zone');
  const [zone, setZone] = useState(profile?.time_zone || null);
  const [saving, setSaving] = useState(false);
  const detected = useMemo(() => detectTimeZone(), []);
  const options = useMemo(
    () => timeZoneOptions([zone, detected].filter(Boolean)),
    [zone, detected],
  );

  if (!hasColumn) return null;

  const change = async (next) => {
    const before = zone;
    setZone(next);
    setSaving(true);
    try {
      await saveTimeZone(email, next);
      toast({ title: 'Time zone saved', description: `Reminders now arrive at about 7 am, ${timeZoneLabel(next)} time.` });
    } catch (err) {
      setZone(before);
      toast(err?.code === 'PGRST204'
        ? { title: 'Not available yet', description: 'This setting is still being set up. Try again later.', variant: 'destructive' }
        : { title: 'Could not save', description: err?.code === '22023' ? 'That time zone is not recognized. Choose another one from the list.' : (err?.message || 'Please try again.'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="reminder-time-zone" className="font-medium text-slate-300">Reminder time zone</Label>
      <Select value={zone || ''} onValueChange={change} disabled={saving}>
        <SelectTrigger id="reminder-time-zone" className="bg-slate-800 border-slate-600 w-full sm:max-w-sm">
          <SelectValue placeholder={`Not set (${timeZoneLabel(DEFAULT_REMINDER_TIME_ZONE)})`} />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-600 text-slate-200 max-h-72">
          {options.map((z) => (
            <SelectItem key={z} value={z}>{timeZoneLabel(z)}{z === detected ? ' (this device)' : ''}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-sm text-slate-400">
        Feeding, weigh-in, hatch, vet follow-up and task reminders arrive at about 7 am in this time zone.
        {!zone && ' Until you choose one, they arrive at about 7 am Pacific.'}
      </p>
    </div>
  );
}
