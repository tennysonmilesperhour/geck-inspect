import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, HeartHandshake } from 'lucide-react';
import { STALE_WEIGHT_DAYS } from '@/lib/breedingReadiness';

const TONE = {
  ideal: 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60',
  ready: 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/60',
  nearly: 'bg-amber-900/60 text-amber-200 border border-amber-700/60',
  not_yet: 'bg-slate-800 text-slate-300 border border-slate-600',
  unknown: 'bg-slate-800 text-slate-400 border border-slate-600',
};

export function ReadinessBadge({ readiness, className = '' }) {
  if (!readiness) return null;
  return (
    <Badge
      className={`text-[10px] h-5 px-1.5 py-0 font-medium ${TONE[readiness.level]} ${className}`}
      title={readiness.reason}
    >
      {readiness.label}
    </Badge>
  );
}

function staleNote(readiness) {
  if (!readiness.stale || readiness.weightGrams == null) return null;
  return readiness.daysSinceWeighed == null
    ? 'That weight has no weigh-in date. Weigh her before pairing.'
    : `Last weighed ${readiness.daysSinceWeighed} days ago (over ${STALE_WEIGHT_DAYS}). Weigh her before pairing.`;
}

/** The verdict with its reason, for the gecko page and the pairing dialog. */
export function ReadinessNote({ gecko, readiness, name }) {
  if (!readiness) return null;
  const who = name || gecko?.name || 'She';
  const warn = readiness.level === 'not_yet' || readiness.level === 'nearly';
  const statusConflict = warn && gecko?.status === 'Ready to Breed';
  const stale = staleNote(readiness);
  return (
    <div
      className={`rounded-lg border p-3 text-sm ${warn ? 'border-amber-700/60 bg-amber-950/30' : 'border-slate-700 bg-slate-800/40'}`}
      role={warn ? 'alert' : undefined}
    >
      <div className="flex items-center gap-2">
        {warn && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
        <ReadinessBadge readiness={readiness} />
      </div>
      <p className="text-slate-300 mt-2">{readiness.reason}</p>
      {warn && (
        <p className="text-amber-200/90 text-xs mt-2">
          Pairing {who} before she is ready risks egg-binding and calcium loss.{' '}
          <Link to="/CareGuide/breeding-readiness" className="underline hover:text-amber-100">Why</Link>
        </p>
      )}
      {statusConflict && (
        <p className="text-amber-200/90 text-xs mt-1">Her status says Ready to Breed; the numbers do not agree yet.</p>
      )}
      {stale && <p className="text-slate-400 text-xs mt-1">{stale}</p>}
    </div>
  );
}

/** Owner-only card on the gecko page. */
export function ReadinessCard({ gecko, readiness }) {
  if (!readiness) return null;
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-slate-100">
          <HeartHandshake className="w-4 h-4 text-emerald-400" /> Breeding readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ReadinessNote gecko={gecko} readiness={readiness} />
        <Link to="/CareGuide/breeding-readiness" className="text-xs text-emerald-400 hover:text-emerald-300 mt-2 inline-flex items-center touch:min-h-11">
          Care guide: breeding readiness
        </Link>
      </CardContent>
    </Card>
  );
}
