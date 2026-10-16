import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { parseLocalDate } from '@/lib/dateUtils';
import { careLogErrorText } from '@/lib/husbandryLog';

/**
 * Logs made with no signal that the server then refused (the gecko was
 * deleted, or moved to another account, before the phone was back
 * online). The offline queue keeps a list of them (src/lib/offlineQueue.js,
 * readRefused) so Field Mode can say plainly which logs were not saved,
 * instead of the logs just quietly disappearing from "waiting to sync".
 */

const KIND_NAMES = { fed: 'Feeding', shed: 'Shed', weight: 'Weigh-in', note: 'Note' };
const ENTITY_NAMES = {
  FeedingRecord: 'Feeding',
  ShedRecord: 'Shed',
  WeightRecord: 'Weigh-in',
  GeckoEvent: 'Note',
  Gecko: 'Weight update',
};

const NOT_SAVED_REASON = 'The server would not save it, for example because the gecko was deleted or moved to another account.';

function dayLabel(date) {
  if (!date) return '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseLocalDate(date) : new Date(date);
  return Number.isNaN(day?.getTime?.()) ? '' : format(day, 'MMM d');
}

/** "Weigh-in (42 g) for Alder on Oct 14", from a refused-log record. */
export function refusedLogText(refusal, geckoName) {
  const what = KIND_NAMES[refusal?.kind] || ENTITY_NAMES[refusal?.entity] || 'Log';
  let detail = '';
  if (refusal?.grams) detail = ` (${refusal.grams} g)`;
  else if (refusal?.kind === 'fed' && refusal.accepted === false) detail = ' (food refused)';
  const who = geckoName ? ` for ${geckoName}` : '';
  const day = dayLabel(refusal?.date);
  return `${what}${detail}${who}${day ? ` on ${day}` : ''}`;
}

/** Why it was not saved, in plain words (never the database's own text). */
export function refusedLogReason(refusal) {
  return careLogErrorText(refusal?.error, NOT_SAVED_REASON);
}

/**
 * How many refused logs the notice names before it says "and N more".
 * A whole rack fed offline can be refused at once (up to 50 are kept), and
 * Field Mode is a full-screen phone layout: a notice that grew with the
 * list pushed its own "Got it" under the fixed footer and squeezed the
 * gecko list to nothing, so nobody could log until the refusals expired.
 */
export const MAX_REFUSED_SHOWN = 3;

export default function RefusedLogsNotice({ refused, geckos = [], onDismiss }) {
  const list = Array.isArray(refused) ? refused : [];
  if (list.length === 0) return null;
  const names = new Map((geckos || []).map((g) => [g.id, g.name]));
  const shown = list.slice(0, MAX_REFUSED_SHOWN);
  const more = list.length - shown.length;
  // A batch refused for one cause (the usual case) says the cause once
  // instead of repeating three lines of it under every gecko.
  const reasons = list.map(refusedLogReason);
  const sharedReason = reasons.every((r) => r === reasons[0]) ? reasons[0] : null;
  return (
    // flex-shrink-0 and max-h keep the notice from growing past 40% of the
    // screen; the list scrolls inside it, and the title row with "Got it"
    // sits outside that scroll so the button is always reachable.
    <div role="alert" className="mx-4 mt-3 flex max-h-[40vh] flex-shrink-0 flex-col rounded-xl border border-red-700/60 bg-red-950/50 px-4 py-3 text-base text-red-100">
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 font-semibold">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {list.length === 1 ? 'A log made offline was not saved' : `${list.length} logs made offline were not saved`}
        </p>
        <Button
          type="button"
          variant="ghost"
          onClick={() => onDismiss?.(list.map((r) => r.id))}
          className="-my-2 -mr-2 min-h-11 flex-shrink-0 text-red-100"
        >
          Got it
        </Button>
      </div>
      <div className="mt-1 min-h-0 overflow-y-auto text-sm">
        {sharedReason && <p>{sharedReason}</p>}
        <ul className="mt-1 space-y-1">
          {shown.map((r, i) => (
            <li key={r.id}>
              {refusedLogText(r, names.get(r.geckoId))}.{sharedReason ? '' : ` ${reasons[i]}`}
            </li>
          ))}
        </ul>
        {more > 0 && <p className="mt-1">and {more} more</p>}
      </div>
    </div>
  );
}
