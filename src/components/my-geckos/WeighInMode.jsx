import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Scale, X, CheckCircle2 } from 'lucide-react';
import { WeightRecord, Gecko } from '@/entities/all';
import { useToast } from '@/components/ui/use-toast';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import { format } from 'date-fns';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

/**
 * Weigh-in mode ,  one-row-per-gecko batch weight entry.
 *
 * Breeders typically weigh on a fixed cadence (Sunday mornings is common)
 * and opening each gecko's detail modal one at a time is tedious. This
 * modal renders every active, writable gecko in a compact list and lets
 * the user type-tab-type-tab through them, then saves all the new
 * WeightRecord rows + mirrors weight_grams onto the gecko in one
 * Promise.all. Rows with empty inputs are skipped.
 *
 * Props:
 *   geckos          ,  list of geckos to weigh (caller filters by writable
 *                     + archived state).
 *   weightRecords   ,  current records, used to display "last weight" so
 *                     the user has a reference value as they type.
 *   onClose         ,  close the modal.
 *   onSaved         ,  called after saves succeed so the parent can
 *                     refresh its data.
 */
export default function WeighInMode({ geckos = [], weightRecords = [], onClose, onSaved }) {
  const { toast } = useToast();
  const [inputs, setInputs] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [recordDate, setRecordDate] = useState(todayLocalISO());

  // Sort geckos: largest by latest weight first as a stable, helpful order
  // (heaviest first lines up with typical adult-first weigh order). Fall
  // back to alphabetical when no weight is on record.
  const lastWeightById = useMemo(() => {
    const map = new Map();
    for (const w of weightRecords) {
      const prev = map.get(w.gecko_id);
      if (!prev || new Date(w.record_date) > new Date(prev.record_date)) {
        map.set(w.gecko_id, w);
      }
    }
    return map;
  }, [weightRecords]);

  const sortedGeckos = useMemo(() => {
    return [...geckos].sort((a, b) => {
      const aw = lastWeightById.get(a.id)?.weight_grams ?? a.weight_grams ?? -1;
      const bw = lastWeightById.get(b.id)?.weight_grams ?? b.weight_grams ?? -1;
      if (aw !== bw) return bw - aw;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [geckos, lastWeightById]);

  // Reset input state whenever the gecko list changes (e.g. on remount).
  useEffect(() => {
    setInputs({});
  }, [geckos.length]);

  const filledCount = Object.values(inputs).filter((v) => v !== '' && v != null && !isNaN(parseFloat(v))).length;

  const handleInputChange = (id, value) => {
    // Accept only digits and a single decimal point.
    const cleaned = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setInputs((prev) => ({ ...prev, [id]: cleaned }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(inputs)
      .map(([geckoId, raw]) => {
        const value = parseFloat(raw);
        if (isNaN(value) || value <= 0) return null;
        return { geckoId, value };
      })
      .filter(Boolean);

    if (entries.length === 0) {
      toast({ title: 'Nothing to save', description: 'Enter at least one weight first.' });
      return;
    }

    setIsSaving(true);
    try {
      // Create all WeightRecord rows in parallel, then mirror the value
      // onto the gecko row so cards/passport refresh immediately.
      await Promise.all(
        entries.map(({ geckoId, value }) =>
          WeightRecord.create({
            gecko_id: geckoId,
            weight_grams: value,
            record_date: recordDate,
          }).then(() => Gecko.update(geckoId, { weight_grams: value }))
        )
      );

      toast({
        title: 'Weigh-in saved',
        description: `${entries.length} ${entries.length === 1 ? 'weight' : 'weights'} recorded for ${format(parseLocalDate(recordDate), 'MMM d, yyyy')}.`,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (error) {
      console.error('Weigh-in save failed:', error);
      toast({
        title: 'Save failed',
        description: error.message || 'Could not save weights. Try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose}></div>
      <Card className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-2xl h-[90vh] z-50 bg-slate-900 border-slate-700 flex flex-col">
        <CardHeader className="flex-shrink-0 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-slate-100 flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" /> Weigh-in
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">
                Enter today's weights. Skip any row by leaving it blank.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <label className="text-xs uppercase tracking-wider text-slate-500">Record date</label>
            <Input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="h-8 w-44 bg-slate-800 border-slate-600 text-slate-100 text-sm"
            />
          </div>
        </CardHeader>

        <div className="flex-grow overflow-y-auto p-3">
          {sortedGeckos.length === 0 ? (
            <p className="text-center text-slate-400 py-12 text-sm">
              No active geckos to weigh. Add a gecko first.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {sortedGeckos.map((gecko) => {
                const last = lastWeightById.get(gecko.id) || (gecko.weight_grams != null ? { weight_grams: gecko.weight_grams, record_date: null } : null);
                const value = inputs[gecko.id] ?? '';
                const hasValue = value !== '' && !isNaN(parseFloat(value));
                return (
                  <li key={gecko.id} className="flex items-center gap-3 py-2.5">
                    <img
                      src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
                      alt={gecko.name}
                      className="w-10 h-10 rounded object-cover flex-shrink-0 border border-slate-700"
                      loading="lazy"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{gecko.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {gecko.gecko_id_code || '—'}
                        {last?.weight_grams != null && (
                          <span className="ml-2 text-slate-400">
                            last: <span className="text-slate-300">{last.weight_grams}g</span>
                            {last.record_date && (
                              <span className="text-slate-500"> · {format(parseLocalDate(last.record_date), 'MMM d')}</span>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="relative flex-shrink-0">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={value}
                        onChange={(e) => handleInputChange(gecko.id, e.target.value)}
                        placeholder="g"
                        className={`h-9 w-20 text-right pr-7 bg-slate-800 border-slate-600 text-slate-100 ${hasValue ? 'border-emerald-600' : ''}`}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">g</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <CardFooter className="flex-shrink-0 border-t border-slate-700 p-3 flex items-center justify-between gap-3 bg-slate-900">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            {filledCount > 0 && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {filledCount} {filledCount === 1 ? 'weight' : 'weights'} ready
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={isSaving || filledCount === 0}
              className="h-9 bg-emerald-600 hover:bg-emerald-700"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save {filledCount > 0 ? `(${filledCount})` : ''}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
