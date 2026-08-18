import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, ImageDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PairingOutcomeLog } from '@/entities/all';
import { downloadSeasonCard } from '@/lib/genetics/clutchCard';
import { EGGS_PER_CLUTCH } from '@/lib/genetics/clutchMath';

/**
 * Predicted vs actual: the outcomes flywheel (plan item 3.1, with the
 * season scorecard covering 3.6's recap moment).
 *
 * Renders only for collection-mode pairings (real gecko ids). Each
 * hatched clutch is logged against a snapshot of the prediction, so
 * the pairing accumulates a "prediction vs reality" record, the season
 * accumulates a scorecard, and (with consent, later) the community
 * accumulates the observed-ratio dataset no competitor can copy.
 */

const NON_OUTCOMES = ['did not hatch', 'other / unsure'];

function tallyLogs(logs) {
  const observed = new Map();
  let eggs = 0;
  for (const log of logs) {
    for (const label of log.observed || []) {
      eggs += 1;
      observed.set(label, (observed.get(label) || 0) + 1);
    }
  }
  return { observed, eggs };
}

export default function OutcomeLogPanel({ sire, dam, outcomes }) {
  const pairingKey = `${sire.id}|${dam.id}`;
  const [logs, setLogs] = useState(null);
  const [saving, setSaving] = useState(false);
  const [egg1, setEgg1] = useState('');
  const [egg2, setEgg2] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLogs(null);
    PairingOutcomeLog.filter({ pairing_key: pairingKey })
      .then((rows) => { if (!cancelled) setLogs(rows || []); })
      .catch(() => { if (!cancelled) setLogs([]); });
    return () => { cancelled = true; };
  }, [pairingKey]);

  const labelOptions = useMemo(
    () => [
      ...outcomes.filter((o) => o.health_risk !== 'lethal').map((o) => o.label),
      ...NON_OUTCOMES,
    ],
    [outcomes],
  );

  const saveClutch = async () => {
    if (!egg1 && !egg2) return;
    setSaving(true);
    setError('');
    try {
      const observed = [egg1, egg2].filter(Boolean);
      const created = await PairingOutcomeLog.create({
        sire_id: sire.id,
        dam_id: dam.id,
        sire_label: (sire.morph_tags || []).join(', '),
        dam_label: (dam.morph_tags || []).join(', '),
        pairing_key: pairingKey,
        tag_key: [
          [...(sire.morph_tags || [])].sort().join('+').toLowerCase(),
          [...(dam.morph_tags || [])].sort().join('+').toLowerCase(),
        ].sort().join(' x '),
        predicted: outcomes.map((o) => ({ label: o.label, probability: o.probability })),
        observed,
        eggs: observed.length,
        hatched_on: new Date().toISOString().slice(0, 10),
      });
      setLogs((prev) => [created, ...(prev || [])]);
      setEgg1('');
      setEgg2('');
    } catch {
      setError('Could not save that clutch. Check your connection and try again.');
    }
    setSaving(false);
  };

  const { observed, eggs } = useMemo(() => tallyLogs(logs || []), [logs]);

  const comparison = useMemo(() => {
    if (eggs === 0) return [];
    const rows = outcomes
      .filter((o) => o.health_risk !== 'lethal')
      .map((o) => ({
        label: o.label,
        observed: observed.get(o.label) || 0,
        expected: o.probability * eggs,
      }))
      .filter((r) => r.observed > 0 || r.expected >= 0.25)
      .sort((a, b) => b.expected - a.expected);
    for (const [label, count] of observed.entries()) {
      if (!rows.some((r) => r.label === label)) {
        rows.push({ label, observed: count, expected: 0 });
      }
    }
    return rows;
  }, [outcomes, observed, eggs]);

  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
          <ClipboardCheck className="w-4 h-4 text-emerald-400" />
          Prediction vs reality
        </h4>
        {eggs >= EGGS_PER_CLUTCH && (
          <button
            type="button"
            onClick={() =>
              downloadSeasonCard({
                year: new Date().getFullYear(),
                eggs,
                clutches: (logs || []).length,
                rows: comparison,
              })
            }
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded px-2 py-1"
            title="Download your season scorecard as an image"
          >
            <ImageDown className="w-3.5 h-3.5" /> Season card
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Log real clutches from this pairing and watch how the season tracks the odds. Every log
        also sharpens what this calculator can teach the whole hobby about real-world ratios.
      </p>

      {/* Log a clutch */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        {[
          ['Egg 1', egg1, setEgg1],
          ['Egg 2', egg2, setEgg2],
        ].map(([label, value, setValue]) => (
          <div key={label} className="space-y-1">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger className="bg-slate-900 border-slate-600 text-slate-100 h-9 text-xs">
                <SelectValue placeholder="What hatched?" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600 text-slate-200">
                {labelOptions.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <Button
          size="sm"
          disabled={saving || (!egg1 && !egg2)}
          onClick={saveClutch}
          className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs h-9"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Log clutch'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}

      {/* Running comparison */}
      {logs === null ? (
        <p className="text-xs text-slate-500">Loading your logs...</p>
      ) : eggs === 0 ? (
        <p className="text-xs text-slate-600">No clutches logged for this pairing yet.</p>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-slate-400 font-semibold">
            {eggs} egg{eggs > 1 ? 's' : ''} across {(logs || []).length} clutch{(logs || []).length > 1 ? 'es' : ''}
          </p>
          {comparison.map((row) => {
            const delta = row.observed - row.expected;
            return (
              <p key={row.label} className="text-xs font-mono text-slate-300">
                {row.observed}x {row.label}
                <span className="text-slate-500"> · expected {row.expected.toFixed(1)}</span>
                {Math.abs(delta) >= 0.75 && (
                  <span className={delta > 0 ? 'text-emerald-400' : 'text-pink-300'}>
                    {' '}({delta > 0 ? 'running hot' : 'running cold'})
                  </span>
                )}
              </p>
            );
          })}
          <p className="text-[11px] text-slate-600">
            Small samples swing hard; the odds win over full seasons. Nothing here is ever "due."
          </p>
        </div>
      )}
    </div>
  );
}
