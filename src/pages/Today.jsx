import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  Egg,
  ListChecks,
  Plus,
  Scale,
  Stethoscope,
  Utensils,
  Wrench,
} from 'lucide-react';
import Seo from '@/components/seo/Seo';
import GeckoImage from '@/components/shared/GeckoImage';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { isGuestMode } from '@/lib/guestMode';
import { todayLocalISO } from '@/lib/dateUtils';
import { fieldModeQueryKey, loadWritableGeckos } from '@/lib/fieldModeData';
import { readQueue } from '@/lib/offlineQueue';
import { useOfflineQueue } from '@/lib/offlineSync';
import { captureEvent } from '@/lib/posthog';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import {
  isActiveGecko,
  isTodayUnavailable,
  loadDemoToday,
  loadMemberToday,
  pendingLogs,
  todayQueryKey,
  todayView,
} from '@/lib/today';

/**
 * Today (review item E3 25): the first tab on phones.
 *
 * What is due today or overdue for the member's geckos (feedings,
 * weigh-ins, eggs close to hatching, vet follow-ups, Season Planner tasks
 * and open pairing windows), each with one button, then the week ahead,
 * then the collection. "Log feeding" opens the one-tap log (/log) for
 * every gecko and group that is due, so a feeding is two taps from a cold
 * open: the Today tab is where the app opens on a phone, then "Log
 * feeding", then "Fed".
 *
 * The list for a signed-in member comes from the database
 * (public.my_care_today, the reminder jobs' own rules). Its last copy is
 * kept on the phone with the collection (src/lib/offlineCache.js), so the
 * screen opens with no signal, and a log saved on the phone but not yet
 * sent is shown as saved rather than asked for again.
 *
 * Guests in the demo, and signed-out visitors who open /Today, see the
 * demo collection's day, built by the same rules in src/lib/today.js.
 */

const ICONS = {
  feeding: Utensils,
  weigh_in: Scale,
  hatch: Egg,
  vet: Stethoscope,
  task: ListChecks,
  pairing_window: CalendarCheck,
};

// How many names a feeding or weigh-in card lists before "and N more".
const LINES_SHOWN = 5;
// How many geckos the collection strip shows before "See all".
const GECKOS_SHOWN = 12;

function DueCard({ card, demoSignedOut }) {
  const Icon = ICONS[card.kind] || CalendarCheck;
  const lines = card.lines || [];
  const extra = lines.length - LINES_SHOWN;
  return (
    <li className={`rounded-2xl border p-4 ${card.late ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-700 bg-slate-900'}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.late ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-100">{card.title}</h3>
          {card.detail && <p className="mt-0.5 text-sm text-slate-300">{card.detail}</p>}
          {lines.length > 0 && (
            <ul className="mt-2 space-y-1">
              {lines.slice(0, LINES_SHOWN).map((line) => (
                <li key={line.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-slate-200">{line.name}</span>
                  <span className={`shrink-0 ${line.late ? 'text-amber-300' : 'text-slate-400'}`}>{line.note}</span>
                </li>
              ))}
              {extra > 0 && <li className="text-sm text-slate-400">and {extra} more</li>}
            </ul>
          )}
        </div>
      </div>
      {card.action && !demoSignedOut && (
        <Button asChild className="mt-3 w-full min-h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-700">
          <Link to={card.action.to} onClick={() => captureEvent('today', { action: 'open', kind: card.kind })}>
            {card.action.label}
          </Link>
        </Button>
      )}
    </li>
  );
}

// Signed-out visitors cannot open a record, so the demo geckos are shown
// without links for them.
function GeckoTile({ gecko, linkable, children }) {
  if (!linkable) {
    return <div className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-center">{children}</div>;
  }
  return (
    <Link
      to={`/GeckoDetail?id=${encodeURIComponent(gecko.id)}`}
      className="block rounded-xl border border-slate-700 bg-slate-900 p-2 text-center hover:border-emerald-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
    >
      {children}
    </Link>
  );
}

function GeckoStrip({ geckos, total, demo, linkable }) {
  if (!geckos.length) return null;
  return (
    <section aria-labelledby="today-geckos" className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="today-geckos" className="text-lg font-semibold text-slate-100">Your geckos</h2>
        {linkable && (
          <Link to="/MyGeckos" className="inline-flex min-h-11 items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200">
            See all {total} <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {geckos.map((gecko) => (
          <li key={gecko.id}>
            <GeckoTile gecko={gecko} linkable={linkable}>
              <GeckoImage
                gecko={gecko}
                src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
                alt={demo ? `${gecko.name}, illustrative photo` : gecko.name}
                loading="lazy"
                width={240}
                className="aspect-square w-full rounded-lg object-cover"
              />
              <span className="mt-1.5 block truncate text-sm font-medium text-slate-100">{gecko.name}</span>
              <span className="block truncate text-xs text-slate-400">
                {gecko.weight_grams != null ? `${gecko.weight_grams} g` : gecko.morphs_traits || 'Crested gecko'}
              </span>
            </GeckoTile>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Today() {
  const { user, isGuest, enterGuestMode } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const guest = Boolean(isGuest) || isGuestMode();
  const signedIn = Boolean(user?.email) && !guest;
  // Signed out (the public /Today route) or in the demo: the demo day.
  const demo = !signedIn;
  const demoSignedOut = demo && !guest;
  const today = todayLocalISO();
  const { pending, online } = useOfflineQueue();

  const listQuery = useQuery({
    queryKey: todayQueryKey(demo ? 'demo' : user.email),
    queryFn: () => (demo ? loadDemoToday(today) : loadMemberToday(today)),
    // Always ask again when the screen opens (a log just made on /log
    // moves the list), but show the last copy while it loads.
    staleTime: 0,
    retry: (count, error) => !isTodayUnavailable(error) && count < 2,
  });

  // The collection: the same copy Field Mode and the one-tap log use, so
  // it is on the phone already and opens with no signal. Asked for again
  // every time the screen opens, like the list: a gecko added a moment ago
  // (or on another device) must show here, and the copy restored from the
  // phone's storage would otherwise count as fresh for two minutes.
  const geckoQuery = useQuery({
    queryKey: fieldModeQueryKey(user?.email),
    enabled: signedIn,
    staleTime: 0,
    queryFn: () => loadWritableGeckos(user),
  });

  // A log saved anywhere in the app moves what is due.
  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['today'] });
    window.addEventListener('geckos_changed', refresh);
    return () => window.removeEventListener('geckos_changed', refresh);
  }, [queryClient]);

  useEffect(() => {
    captureEvent('today', { action: 'viewed', demo });
  }, [demo]);

  // Logs kept on this phone and not yet sent. Read again whenever the
  // number waiting changes.
  const [queued, setQueued] = useState(() => (signedIn ? readQueue() : []));
  useEffect(() => {
    setQueued(signedIn ? readQueue() : []);
  }, [pending, signedIn]);

  const data = listQuery.data;
  const view = useMemo(
    () => (data ? todayView(data, { today, pending: signedIn ? pendingLogs(queued) : null }) : null),
    [data, today, queued, signedIn],
  );

  // Geckos marked Sold are left out, as they are from the list above and
  // the Log tab, so "See all" counts the same geckos.
  const allGeckos = ((demo ? data?.geckos : geckoQuery.data) || []).filter(isActiveGecko);
  const geckos = [...allGeckos]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, GECKOS_SHOWN);
  // While the collection is being asked for again with no gecko in the
  // copy (a first gecko just added), say nothing about it yet rather than
  // "Add your first gecko" or "Nothing due today". Not with no signal,
  // when that load cannot answer: in the app opened without a signal it
  // still retries for several seconds, because the query client counts
  // itself online until an 'offline' event, which then never fires.
  const geckosSettling = signedIn && online && geckoQuery.isFetching && allGeckos.length === 0;
  const noGeckos = signedIn && geckoQuery.isSuccess && !geckosSettling && (geckoQuery.data || []).length === 0;

  const unavailable = listQuery.isError && isTodayUnavailable(listQuery.error);
  const listFailed = listQuery.isError && !data;
  const offlineNoCopy = !data && (listQuery.fetchStatus === 'paused' || (signedIn && !online));
  const showingOldCopy = Boolean(data) && (listQuery.isError || !online) && data.today !== today;

  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const openDemo = () => {
    captureEvent('today', { action: 'open_demo' });
    enterGuestMode();
    navigate('/Today');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 md:p-8 text-slate-100">
      <Seo title="Today" description="What your crested geckos need today: feedings, weigh-ins, eggs and vet follow-ups." path="/Today" noIndex />

      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-slate-400">{dateLine}</p>
        </div>
        {signedIn && (
          <Button asChild variant="outline" className="min-h-11 border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800">
            <Link to="/FieldMode"><Wrench className="mr-2 h-4 w-4" aria-hidden="true" /> Field Mode</Link>
          </Button>
        )}
      </header>

      {demoSignedOut && (
        <div className="mb-5 rounded-2xl border border-emerald-700/50 bg-emerald-950/40 p-4">
          <p className="text-sm text-emerald-100">
            This is a sample day from the demo collection. With a free account, Today lists what your own crested geckos need, and one tap logs it.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="min-h-11 bg-emerald-600 hover:bg-emerald-700">
              <Link to="/AuthPortal?mode=signup">Create a free account</Link>
            </Button>
            <Button type="button" variant="outline" onClick={openDemo} className="min-h-11 border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800">
              Look around the demo
            </Button>
          </div>
          {/* An installed app opens here when the session has ended, so a
              member needs a way back in from this banner too. */}
          <p className="mt-3 text-sm text-slate-300">
            Already a member?{' '}
            <Link to="/AuthPortal" className="font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200">Sign in</Link>
          </p>
        </div>
      )}
      {guest && (
        <p className="mb-5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          Demo collection: look around, nothing you log here is saved.
        </p>
      )}

      {signedIn && (!online || pending > 0) && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {!online ? 'No signal. Logs are kept on this phone. ' : ''}
            {pending > 0 ? `${pending} waiting to sync.` : ''}
          </span>
        </div>
      )}
      {showingOldCopy && (
        <p className="mb-4 text-sm text-slate-400">Showing the list from your last visit with a signal.</p>
      )}

      {listQuery.isLoading && !data && !offlineNoCopy && (
        <ul className="space-y-3" aria-label="Loading">
          {[0, 1].map((i) => <li key={i} className="h-28 animate-pulse rounded-2xl bg-slate-900" />)}
        </ul>
      )}

      {(unavailable || (listFailed && !unavailable) || offlineNoCopy) && !data && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
          <p className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <span>
              {offlineNoCopy
                ? 'No signal, and this phone has no copy of today\'s list yet. Your geckos are below, and the Log button still works.'
                : unavailable
                  ? 'Today\'s list is being updated. Try again in a minute; the Log button works now.'
                  : 'Today\'s list did not load. Check your connection and try again.'}
            </span>
          </p>
          {!offlineNoCopy && (
            <Button type="button" variant="outline" onClick={() => listQuery.refetch()} className="mt-3 min-h-11 border-slate-600 bg-slate-900/60 text-slate-100 hover:bg-slate-800">
              Try again
            </Button>
          )}
        </div>
      )}

      {view && (
        <>
          <section aria-labelledby="today-due">
            <h2 id="today-due" className="sr-only">Due today</h2>
            {view.cards.length > 0 ? (
              <ul className="space-y-3">
                {view.cards.map((card) => <DueCard key={card.id} card={card} demoSignedOut={demoSignedOut} />)}
              </ul>
            ) : noGeckos || geckosSettling ? null : (
              <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4">
                <p className="flex items-center gap-2 text-base font-semibold text-emerald-100">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Nothing due today
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {data.feedingReminders === false || data.weighInReminders === false
                    ? 'Some reminders are switched off in Settings, so those are not listed here.'
                    : 'Every feeding and weigh-in with a reminder is up to date.'}
                </p>
              </div>
            )}
            {view.savedOnPhone.length > 0 && (
              <p className="mt-3 flex items-start gap-2 text-sm text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>Logged on this phone, waiting to sync: {view.savedOnPhone.join(', ')}.</span>
              </p>
            )}
          </section>

          {view.comingUp.length > 0 && (
            <section aria-labelledby="today-coming" className="mt-8">
              <h2 id="today-coming" className="mb-2 text-lg font-semibold text-slate-100">This week</h2>
              <ul className="divide-y divide-slate-800 rounded-2xl border border-slate-700 bg-slate-900">
                {view.comingUp.map((row) => (
                  <li key={row.key} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 text-slate-200">{row.text}</span>
                    <span className="shrink-0 text-slate-400">{row.when}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {noGeckos && (
        <div className="mt-2 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center">
          <p className="text-base font-semibold text-slate-100">Add your first gecko</p>
          <p className="mt-1 text-sm text-slate-400">Today fills in with its feedings and weigh-ins as soon as it is in.</p>
          <Button asChild className="mt-4 min-h-12 bg-emerald-600 hover:bg-emerald-700">
            <Link to="/MyGeckos?add=1"><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Add a gecko</Link>
          </Button>
        </div>
      )}

      <GeckoStrip geckos={geckos} total={allGeckos.length} demo={demo} linkable={!demoSignedOut} />
    </div>
  );
}
