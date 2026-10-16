import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Loader2, Scale, Sparkles, Utensils, Wrench } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/AuthContext';
import { isGuestMode } from '@/lib/guestMode';
import { fieldModeQueryKey, loadWritableGeckos } from '@/lib/fieldModeData';
import { collectionLogLinks, todayQueryKey } from '@/lib/today';
import { captureEvent } from '@/lib/posthog';

// The longest a tap waits for the collection before the log opens with
// the copy the phone already has.
const LOG_SHEET_WAIT_MS = 6000;

// True when there is no signal. The query client's own check is not
// enough: it starts out online and only changes on an 'offline' event,
// which never fires when the app is opened with no signal (the installed
// app's shell still loads). The phone's own report covers that case.
const noSignal = () => !onlineManager.isOnline() || (typeof navigator !== 'undefined' && navigator.onLine === false);

/**
 * The phone's Log tab (review item E3 25): what to log, then the one-tap
 * log page (/log) for the collection, or Field Mode for everything else
 * (notes, another day, a different weight scale). The collection is the
 * copy Field Mode keeps on the phone, so this works with no signal.
 *
 * The links name the geckos, so they are only as good as that copy. When
 * the phone has no copy yet, or a gecko was added since it was made, a
 * tap waits (up to LOG_SHEET_WAIT_MS) for the collection to load before
 * the log opens, unless there is no signal, when it opens at once with
 * the copy the phone has. Until 16 Oct 2026 such a tap opened a log with
 * the new gecko missing, or an empty one that said the gecko may have
 * been sold.
 */
export default function LogSheet({ open, onOpenChange }) {
  const { user, isGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const guest = Boolean(isGuest) || isGuestMode();
  const email = guest ? null : user?.email;
  const queryKey = fieldModeQueryKey(email);
  const [waiting, setWaiting] = useState(null);
  // Whether the sheet is still open after a wait: closed meanwhile, the
  // member changed their mind, so the log does not open.
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  const geckoQuery = useQuery({
    queryKey,
    enabled: open && Boolean(email),
    // Asked for again each time the sheet opens; the kept copy still
    // answers at once, and on its own with no signal.
    staleTime: 0,
    queryFn: () => loadWritableGeckos(user),
  });
  const loadingList = Boolean(email) && geckoQuery.data === undefined && geckoQuery.fetchStatus === 'fetching' && !noSignal();

  // Come back to the page the tab was tapped on, except the log itself.
  const here = `${location.pathname}${location.search}`;
  const linksFor = (geckos) => collectionLogLinks({
    geckos: geckos || [],
    todayData: email ? queryClient.getQueryData(todayQueryKey(email)) : null,
    from: location.pathname === '/log' ? null : here,
  });

  // The links are built from the copy on the phone, unless there is none
  // yet or a gecko has been added or changed since it was made
  // ('geckos_changed' marks it out of date) and there is a signal to load
  // a new one. Then the tap waits for the load, which is usually under way
  // already, since the sheet asks for the collection as it opens.
  const copyOutdated = () => geckoQuery.data === undefined || Boolean(queryClient.getQueryState(queryKey)?.isInvalidated);
  const loadGeckos = async () => {
    let timer;
    const result = await Promise.race([
      geckoQuery.refetch({ cancelRefetch: false }).catch(() => null),
      new Promise((resolve) => { timer = setTimeout(resolve, LOG_SHEET_WAIT_MS, null); }),
    ]);
    clearTimeout(timer);
    return result?.data ?? queryClient.getQueryData(queryKey);
  };

  const go = async (kind, pick) => {
    if (waiting) return;
    captureEvent('log_tab', { action: 'choose', kind });
    let to = '/FieldMode';
    if (pick) {
      let geckos = geckoQuery.data;
      if (email && copyOutdated() && !noSignal()) {
        setWaiting(kind);
        try {
          geckos = await loadGeckos();
        } finally {
          setWaiting(null);
        }
        if (!openRef.current) return;
      }
      to = pick(linksFor(geckos));
    }
    onOpenChange(false);
    navigate(to);
  };

  const options = [
    { kind: 'feeding', label: 'Feeding', hint: 'Fed or refused, one tap each', Icon: Utensils, pick: (links) => links.feeding },
    { kind: 'weight', label: 'Weigh-in', hint: 'Type the grams and save', Icon: Scale, pick: (links) => links.weight },
    { kind: 'shed', label: 'Shed', hint: 'One tap for a shed today', Icon: Sparkles, pick: (links) => links.shed },
    { kind: 'field_mode', label: 'Field Mode', hint: 'Notes, another day, or one gecko at a time', Icon: Wrench, pick: null },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-slate-700 bg-slate-950 px-4 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] text-slate-100"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg text-slate-100">Log</SheetTitle>
          <SheetDescription className="text-slate-400">
            {guest ? 'This is the demo, so nothing is saved.' : 'Saved for today. Works with no signal.'}
          </SheetDescription>
        </SheetHeader>
        <ul className="mt-4 space-y-2">
          {options.map(({ kind, label, hint, Icon, pick }) => {
            const busy = waiting === kind || (Boolean(pick) && loadingList && !waiting);
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => go(kind, pick)}
                  disabled={Boolean(waiting)}
                  aria-busy={busy || undefined}
                  className="flex w-full min-h-14 items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left hover:border-emerald-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:opacity-70"
                >
                  <Icon className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{label}</span>
                    <span className="block text-sm text-slate-400">{busy ? 'Loading your geckos' : hint}</span>
                  </span>
                  {busy
                    ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden="true" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
