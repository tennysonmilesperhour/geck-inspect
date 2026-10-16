import { useState } from 'react';
import { format } from 'date-fns';
import { LineChart, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import WeightChart from '@/components/shared/WeightChart';
import WeighInReminderSwitch from '@/components/gecko/WeighInReminderSwitch';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import RecordCard from './RecordCard';

const day = (iso) => {
  const d = iso ? parseLocalDate(iso) : null;
  return d ? format(d, 'MMM d, yyyy') : 'No date';
};

/**
 * Weigh-ins: the growth chart (against the healthy range for the gecko's
 * age), the list, and for a keeper who may edit, a weigh-in form that is
 * always open, so logging takes one tap on the number and one on Save.
 *
 *   weights    weigh-ins, newest first
 *   latest     { grams, date } from latestWeighIn()
 *   canEdit    may add and delete weigh-ins
 *   reminder   { email } to show the owner's weigh-in reminder switch
 *   onAdd(grams, day)  resolves true when saved
 *   onDelete(id)       resolves when done
 */
export default function RecordWeights({ gecko, weights, latest, loading, canEdit, reminder = null, onAdd, onDelete, headingAs }) {
  const [grams, setGrams] = useState('');
  const [weighDay, setWeighDay] = useState(todayLocalISO);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  if (!canEdit && !loading && weights.length === 0) return null;

  const save = async (event) => {
    event?.preventDefault?.();
    const value = parseFloat(String(grams).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the weight in grams, for example 34.');
      return;
    }
    const today = todayLocalISO();
    // A date in the future is a typo; it is saved as today.
    const recordDay = weighDay && weighDay <= today ? weighDay : today;
    setError('');
    setSaving(true);
    const saved = await onAdd(value, recordDay);
    setSaving(false);
    // On failure the numbers stay in the form, so nothing typed is lost.
    if (saved) {
      setGrams('');
      setWeighDay(todayLocalISO());
    }
  };

  const deleting = weights.find((r) => r.id === toDelete) || null;

  return (
    <RecordCard
      id="weights"
      icon={LineChart}
      title="Weights"
      headingAs={headingAs}
      contentClassName="space-y-4"
      action={latest ? <span className="text-sm text-slate-300">Now {latest.grams} g</span> : null}
    >
      {loading ? (
        <div className="flex items-center justify-center h-40" role="status" aria-label="Loading weigh-ins">
          <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
        </div>
      ) : weights.length > 0 ? (
        <WeightChart records={weights} gecko={gecko} height={180} />
      ) : (
        <p className="text-slate-400 text-sm">No weigh-ins yet. A weigh-in every two to four weeks shows how {gecko.name || 'your gecko'} is growing.</p>
      )}

      {canEdit && (
        <form onSubmit={save} className="space-y-2" noValidate>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
            <div>
              <Label htmlFor="record-weight-grams" className="text-xs text-slate-400">Weight (g)</Label>
              <Input
                id="record-weight-grams"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="34"
                value={grams}
                onChange={(e) => { setGrams(e.target.value); if (error) setError(''); }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'record-weight-error' : undefined}
                className="bg-slate-800 text-sm w-full"
              />
            </div>
            <div>
              <Label htmlFor="record-weight-date" className="text-xs text-slate-400">Weighed on</Label>
              <Input
                id="record-weight-date"
                type="date"
                max={todayLocalISO()}
                value={weighDay}
                onChange={(e) => setWeighDay(e.target.value)}
                className="bg-slate-800 text-sm w-full"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Saving" /> : 'Save'}
            </Button>
          </div>
          {error && <p id="record-weight-error" className="text-xs text-amber-300">{error}</p>}
        </form>
      )}

      {weights.length > 0 && (
        <ul className="max-h-40 overflow-y-auto space-y-1.5" aria-label="Weigh-ins">
          {weights.map((record) => (
            <li key={record.id || `${record.record_date}-${record.weight_grams}`} className="flex justify-between items-center gap-2 bg-slate-800 px-3 py-1.5 rounded text-sm">
              <span className="text-slate-300">{day(record.record_date)}</span>
              <span className="font-semibold text-emerald-400 ml-auto">{record.weight_grams} g</span>
              {canEdit && record.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setToDelete(record.id)}
                  aria-label={`Delete the weigh-in from ${day(record.record_date)}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {reminder && (
        <WeighInReminderSwitch
          gecko={gecko}
          email={reminder.email}
          lastWeighDate={latest?.date || null}
        />
      )}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setToDelete(null); }}>
        <AlertDialogContent className="bg-slate-900 border-slate-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Delete this weigh-in?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {deleting ? `The ${deleting.weight_grams} g weigh-in from ${day(deleting.record_date)} will be removed for good.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-200 border-slate-600">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => { const id = toDelete; setToDelete(null); if (id) await onDelete(id); }}
              className="bg-red-700 hover:bg-red-800"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RecordCard>
  );
}
