import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudOff, Loader2, LogIn, RotateCcw, Scale, Sparkles, Undo2, Utensils } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import GeckoImage from '@/components/shared/GeckoImage';
import { refusedLogReason } from '@/components/shared/RefusedLogsNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/api/appClient';
import { FeedingGroup, FeedingRecord, Gecko, ShedRecord, WeightRecord } from '@/entities/all';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { todayLocalISO } from '@/lib/dateUtils';
import { fieldModeQueryKey, loadWritableGeckos } from '@/lib/fieldModeData';
import { isGuestMode } from '@/lib/guestMode';
import { careLogErrorText, isAuthFailure, markGroupFed, undoFeedings } from '@/lib/husbandryLog';
import { readQueue } from '@/lib/offlineQueue';
import {
  dismissRefusedLogs,
  hasLeftQueue,
  saveFieldLog,
  takeBackQueued,
  UNDO_SENT_MESSAGE,
  UNDO_SYNCING_MESSAGE,
  useOfflineQueue,
} from '@/lib/offlineSync';
import { rememberPostAuthRedirect } from '@/lib/postAuthRedirect';
import { captureEvent } from '@/lib/posthog';
import {
  isBigWeightChange,
  latestWeights,
  parseGrams,
  pickQuickLogGeckos,
  quickLogReturnTarget,
  quickLogTitle,
  readQuickLog,
} from '@/lib/quickLog';
import { loadRecentWeights } from '@/lib/recentWeights';
import {
  addDays,
  collectionLogLists,
  dueLogLists,
  isTodayUnavailable,
  loadDemoToday,
  loadMemberToday,
  pendingLogs,
  shortDate,
  todayQueryKey,
} from '@/lib/today';
import { undoToast } from '@/lib/undoToast';

/**
 * The one log screen (experience review WP-4, 13 Nov 2026). Reminders,
 * Today's cards, the Log tab, My Geckos' Weigh-in button and the old
 * Batch Husbandry address all open it:
 *   /log?type=weight|feeding|shed&gecko=<ids>&group=<ids>&more=<n>&from=<path>
 *
 * Which geckos it lists (src/lib/quickLog.js, readQuickLog):
 *   * the ones named: in the router's state from a screen inside the app
 *     (any number), or in the address from a reminder (10 at most, with
 *     `more` saying how many were left out and one tap to list them here);
 *   * every active gecko when the address says all=1;
 *   * everything due of that type when nothing is named.
 *
 * Each gecko has one button: "Fed", "Shed today", or a weight box. A
 * list or a feeding group has "Mark all fed"; weights have "Save all",
 * which sends each weight on its own, so one failure leaves the others
 * saved and a second tap sends only what failed. Both end with an Undo
 * that takes back only what that tap saved, and every gecko keeps its own
 * Undo. The date chips at the top set the day for everything saved here.
 *
 * Saves go through the same path as Field Mode (saveFieldLog in
 * src/lib/offlineSync.js): with no signal the log is kept on the phone
 * and sent later, and each log carries a request id so a slow save is
 * never stored twice. The collection comes from the copy Field Mode keeps
 * in this browser, so the page also opens offline once the app has
 * loaded the collection with a signal.
 *
 * "Done" goes back where the member came from: the page named in `from`,
 * the previous page in the app, or the Dashboard when the link was opened
 * from an email or a phone notification.
 */

// An error whose message is written for members and can be shown as is.
function plainError(message) {
  return Object.assign(new Error(message), { plain: true });
}

// True when a gecko's own Undo can still take its log back: saved from
// this page, kept on the phone, or kept and since synced when the saved
// row can be found again by its request id.
function canUndo(entry) {
  if (!entry) return false;
  if (entry.status === 'queued') return true;
  if (entry.status !== 'saved') return false;
  if (!entry.synced) return true;
  // A synced feeding may have moved its group's schedule, and the phone
  // does not know where the schedule was before, so that one is left to
  // the gecko's record.
  return Boolean(entry.requestId) && !(entry.kind === 'fed' && entry.accepted && entry.groupId);
}

// A kept log that has left the queue was either saved or refused by the
// server. Returns the card's next state, or null while it still waits.
// Until 16 Oct 2026 a refused log was shown as saved.
function settledQueuedEntry(entry, refusedList) {
  if (entry?.status !== 'queued') return null;
  const refusal = refusedList.find((r) => r.id === entry.queuedId);
  if (refusal) return { ...entry, status: 'refused', reason: refusedLogReason(refusal) };
  if (hasLeftQueue(entry.queuedId)) return { ...entry, status: 'saved', synced: true };
  return null;
}

// A feeding saved on this page that counts as feeding its group (D21).
function isAcceptedFeeding(entry) {
  return entry?.status === 'saved' && entry.kind === 'fed' && entry.accepted === true;
}

const isDone = (entry) => entry?.status === 'saved' || entry?.status === 'queued';

async function deleteByRequestId(client, requestId) {
  const rows = requestId ? await client.filter({ client_request_id: requestId }) : [];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.id) return false;
  await client.delete(row.id);
  return true;
}

// What a batch Undo did, read when its toast is drawn, which is after the
// undo has run: the count is not known when the toast is set up.
function UndoOutcome({ outcome }) {
  return outcome.text || 'Undone';
}

// The lists for a link that names no geckos: every active gecko, or what
// is due now less the logs still waiting on this phone.
function everyGecko(collection, todayData, type) {
  return { ...collectionLogLists({ geckos: collection || [], todayData })[type], kind: 'all' };
}
function dueNow(todayData, today, type) {
  return { ...dueLogLists(todayData, { today, pending: pendingLogs(readQueue()) })[type], kind: 'due' };
}

let batchCount = 0;

export default function QuickLog() {
  // Each visit starts clean. Logs are kept per gecko, so without this the
  // "Fed, saved" marks of a feeding stayed on the weigh-in list when the
  // Log tab opened one from the other.
  const location = useLocation();
  return <QuickLogScreen key={location.key} />;
}

function QuickLogScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = useMemo(() => readQuickLog(location.search, location.state), [location.search, location.state]);
  const type = params.type;
  const { pending, online, refused } = useOfflineQueue();
  // Logs the server refused when the queue sent them. "No longer waiting"
  // alone is not "saved", so a kept log is checked against this first.
  const refusedList = useMemo(() => (Array.isArray(refused) ? refused : []), [refused]);
  const guest = isGuestMode();
  const today = todayLocalISO();
  // The day everything saved from this screen is for. Never a future day.
  const [logDate, setLogDate] = useState(today);
  const backdated = logDate !== today;

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.auth.me()
      .then((me) => { if (!cancelled) setUser(me); })
      .catch((error) => {
        if (cancelled) return;
        setUser(null);
        if (isAuthFailure(error)) setSessionExpired(true);
      })
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => { cancelled = true; };
  }, []);

  // Guests get the demo collection from the same loader, and cannot save.
  const geckoQuery = useQuery({
    queryKey: fieldModeQueryKey(user?.email),
    enabled: Boolean(user?.email),
    // Asked for again every time the page opens: the link can name a gecko
    // added a moment ago, which the copy kept on the phone does not have.
    // That copy still shows at once, and on its own with no signal.
    staleTime: 0,
    retry: (count, error) => !isAuthFailure(error) && count < 2,
    queryFn: () => loadWritableGeckos(user),
  });
  const collection = geckoQuery.data;
  const hasList = Boolean(collection);
  // The collection is being asked for again. Until it answers, a gecko the
  // link names but the kept copy lacks (added a moment ago) is shown as
  // loading, not as archived, sold or in another account. Not with no
  // signal: when the app is opened without one, the phone says so, but the
  // query client counts itself online until an 'offline' event (which then
  // never fires) and keeps retrying for several seconds.
  const checking = hasList && geckoQuery.isFetching && online;

  // ---- Which geckos ------------------------------------------------------

  // "Show them here" on a reminder link that left geckos out.
  const [restAsked, setRestAsked] = useState(false);
  // Today's list, the same copy the Today screen keeps on the phone. It is
  // asked for only when this page has to work out what is due; a copy
  // already there also puts the soonest due first in "every gecko".
  const dueQuery = useQuery({
    queryKey: todayQueryKey(guest ? 'demo' : user?.email),
    enabled: Boolean(user?.email) && type !== 'shed' && (params.scope === 'due' || restAsked),
    staleTime: 0,
    retry: (count, error) => !isTodayUnavailable(error) && !isAuthFailure(error) && count < 2,
    queryFn: () => (guest ? loadDemoToday(today) : loadMemberToday(today)),
  });
  const todayData = dueQuery.data || null;
  const dueLoading = dueQuery.isFetching && online;
  const dueReady = !dueLoading && Boolean(todayData);
  // No list to be had (no signal and no copy, or the list is unavailable):
  // the page falls back to every gecko rather than showing nothing.
  const dueFailed = !dueLoading && !todayData && (dueQuery.isError || dueQuery.fetchStatus === 'paused' || !online);

  // The list for a link that names no geckos, worked out once and then
  // kept, so a gecko does not leave the page (with its Undo) when its log
  // makes it no longer due. { geckoIds, groupIds, kind: 'due' | 'all' }.
  const [auto, setAuto] = useState(null);
  useEffect(() => {
    if (params.scope === 'named' || auto || !hasList) return;
    if (params.scope === 'all' || type === 'shed') {
      // Not before the collection has been asked for again, so a gecko
      // added a moment ago is on the list.
      if (!checking) setAuto(everyGecko(collection, todayData, type));
    } else if (dueReady) {
      setAuto(dueNow(todayData, today, type));
    } else if (dueFailed && !checking) {
      setAuto(everyGecko(collection, todayData, type));
    }
  }, [params.scope, type, today, auto, hasList, checking, dueReady, dueFailed, collection, todayData]);

  // The geckos a reminder link left out, added below the ones it named.
  const [rest, setRest] = useState(null);
  useEffect(() => {
    if (!restAsked || rest || !hasList) return;
    if (type !== 'shed' && dueReady) setRest(dueNow(todayData, today, type));
    else if ((type === 'shed' || dueFailed) && !checking) setRest(everyGecko(collection, todayData, type));
  }, [restAsked, rest, hasList, type, today, dueReady, dueFailed, checking, collection, todayData]);

  // "Every gecko" shows at once from the copy on the phone while the
  // collection is asked for again (a weak signal at the rack is common),
  // and is kept as it stands once that answer is in.
  const wholeCollection = params.scope === 'all' || (params.scope === 'due' && type === 'shed');
  const liveAll = useMemo(
    () => (wholeCollection && !auto && hasList ? everyGecko(collection, todayData, type) : null),
    [wholeCollection, auto, hasList, collection, todayData, type],
  );
  const autoList = auto || liveAll;
  const base = params.scope === 'named' ? params : autoList;
  const ids = useMemo(() => {
    const geckoIds = [...(base?.geckoIds || [])];
    const groupIds = [...(base?.groupIds || [])];
    for (const id of rest?.geckoIds || []) if (!geckoIds.includes(id)) geckoIds.push(id);
    for (const id of rest?.groupIds || []) if (!groupIds.includes(id)) groupIds.push(id);
    return { geckoIds, groupIds };
  }, [base, rest]);

  const picked = useMemo(
    () => pickQuickLogGeckos({ geckos: collection || [], geckoIds: ids.geckoIds, groupIds: ids.groupIds }),
    [collection, ids],
  );
  const allGeckos = [...picked.listed, ...picked.groups.flatMap((g) => g.geckos)];
  // For Undo buttons that are tapped seconds later, from a toast.
  const geckosRef = useRef(allGeckos);
  geckosRef.current = allGeckos;

  // Group names, and the group itself for "Mark the group fed" when no
  // gecko is in it. Needs a connection; offline the name comes from
  // Today's list when the phone has it, else it is just "Feeding group".
  const [groups, setGroups] = useState({});
  const groupKey = ids.groupIds.join(',');
  useEffect(() => {
    if (!user?.email || !groupKey) return undefined;
    let cancelled = false;
    Promise.all(groupKey.split(',').map((id) => FeedingGroup.get(id).catch(() => null)))
      .then((rows) => {
        if (cancelled) return;
        const next = {};
        rows.filter(Boolean).forEach((g) => { next[g.id] = g; });
        setGroups(next);
      });
    return () => { cancelled = true; };
  }, [user?.email, groupKey]);
  const dueGroupNames = useMemo(() => {
    const names = {};
    for (const item of todayData?.items || []) if (item.groupId && item.name) names[item.groupId] = item.name;
    return names;
  }, [todayData]);

  useEffect(() => {
    captureEvent('quick_log', { type, action: 'opened', scope: params.scope, geckos: params.geckoIds.length, groups: params.groupIds.length });
  }, [type, params.scope, params.geckoIds.length, params.groupIds.length]);

  // ---- Last weights --------------------------------------------------------

  // Each gecko's newest weigh-in, shown beside the weight box and used for
  // the big-change check. With no signal the gecko's own shown weight
  // stands in, without a date.
  const weightsQuery = useQuery({
    queryKey: ['quick-log-weights', user?.email || null],
    enabled: type === 'weight' && Boolean(user?.email) && !sessionExpired,
    staleTime: 60_000,
    retry: false,
    queryFn: () => loadRecentWeights(user.email, { perGecko: 1 }),
  });
  const lastWeights = useMemo(() => latestWeights(weightsQuery.data), [weightsQuery.data]);
  const lastWeightOf = (gecko) => lastWeights.get(String(gecko.id))
    || (gecko.weight_grams != null ? { grams: Number(gecko.weight_grams), date: null } : null);

  // ---- Logs ----------------------------------------------------------------

  // Per gecko: { status: 'saving' | 'saved' | 'queued' | 'error' | 'refused',
  // label, kind, accepted, groupId, result, queuedId, requestId, prevWeight,
  // mirrored, batch, synced }. logsRef holds the same without waiting for a
  // render, so a second tap (on Mark all, or on a gecko's own button while
  // Mark all runs) sees a save already under way and does not save twice,
  // and an Undo tapped later from a toast sees the page as it is then.
  const [logs, setLogs] = useState({});
  const logsRef = useRef({});
  const setLog = (id, value) => {
    const next = { ...logsRef.current };
    if (value === undefined) delete next[id];
    else next[id] = value;
    logsRef.current = next;
    setLogs(next);
  };
  const refusedRef = useRef(refusedList);
  refusedRef.current = refusedList;

  // What is typed in each weight box, the boxes that could not be read,
  // and the entries waiting for a second tap (see isBigWeightChange).
  const [weights, setWeights] = useState({});
  const [invalid, setInvalid] = useState({});
  const [confirms, setConfirms] = useState({});
  const dropKey = (setter, id) => setter((prev) => {
    if (!(id in prev)) return prev;
    const next = { ...prev };
    delete next[id];
    return next;
  });

  // A log kept on the phone stops saying so once the queue has sent it,
  // and says "not saved" when the server refused it.
  useEffect(() => {
    for (const [id, entry] of Object.entries(logs)) {
      const next = settledQueuedEntry(entry, refusedList);
      if (next) setLog(id, next);
    }
  }, [pending, logs, refusedList]);

  // "Log again" after a refusal: the refusal has been seen, and the gecko
  // gets its buttons back.
  const logAgain = (gecko) => {
    const entry = logsRef.current[gecko.id];
    if (entry?.queuedId) dismissRefusedLogs([entry.queuedId]);
    setLog(gecko.id, undefined);
  };

  // 'geckos_changed' also marks the collection copy this page shows out of
  // date (src/lib/query-client.js), so it is not marked here as well: that
  // read the whole collection twice for every save.
  const refreshCollection = () => {
    queryClient.invalidateQueries({ queryKey: ['my-geckos'] });
    window.dispatchEvent(new Event('geckos_changed'));
  };

  const demoNotice = () => toast({
    title: 'This is the demo',
    description: 'Nothing is saved here. Create a free account to log your own geckos.',
  });

  // Saves one log. Resolves to { ok, status, message }: status is 'saved',
  // 'queued' (kept on the phone), 'skipped' (already logged here),
  // 'failed', 'auth' (sign-in expired) or 'demo'. `batch` marks the logs
  // of one "Mark all" or "Save all", for its Undo; `quiet` leaves the
  // failure message to the batch's own summary.
  const save = async (gecko, { accepted = true, grams = null, batch = null, quiet = false } = {}) => {
    if (guest) {
      demoNotice();
      return { ok: false, status: 'demo' };
    }
    // Already saving, saved or kept for this gecko: never a second record.
    const prior = logsRef.current[gecko.id];
    if (['saving', 'saved', 'queued'].includes(prior?.status)) return { ok: true, status: 'skipped' };
    // Logging again after a refusal: the old refusal has been answered.
    if (prior?.status === 'refused' && prior.queuedId) dismissRefusedLogs([prior.queuedId]);
    const date = logDate > today ? today : logDate;
    const kind = type === 'weight' ? 'weight' : type === 'shed' ? 'shed' : 'fed';
    const prevWeight = gecko.weight_grams ?? null;
    // The gecko's shown weight follows today's weigh-in. A weigh-in for an
    // earlier day fills it only when the gecko has no weight yet (the same
    // rule as Field Mode).
    const mirror = date === today || prevWeight == null;
    const data = kind === 'weight'
      ? { kind, geckoId: gecko.id, grams, date, mirror }
      : kind === 'shed'
        ? { kind, geckoId: gecko.id, date, quality: 'unknown' }
        : { kind, geckoId: gecko.id, feedingGroupId: gecko.feeding_group_id || null, accepted, date };
    const what = kind === 'weight' ? `${grams} g` : kind === 'shed' ? 'Shed logged' : accepted ? 'Fed' : 'Refused';
    const label = date === today ? what : `${what} for ${shortDate(date)}`;
    setLog(gecko.id, { status: 'saving' });
    try {
      const { result, queued, data: sent } = await saveFieldLog(data);
      setLog(gecko.id, {
        status: queued ? 'queued' : 'saved',
        label,
        kind,
        accepted: kind === 'fed' ? accepted : undefined,
        groupId: kind === 'fed' ? gecko.feeding_group_id || null : null,
        result: queued ? null : result,
        queuedId: queued?.id || null,
        requestId: sent?.requestId || null,
        prevWeight,
        mirrored: kind === 'weight' ? mirror : undefined,
        batch,
      });
      if (kind === 'weight') {
        dropKey(setConfirms, gecko.id);
        dropKey(setInvalid, gecko.id);
      }
      if (!queued) refreshCollection();
      captureEvent('quick_log', { type, action: 'saved', queued: Boolean(queued), accepted: kind === 'fed' ? accepted : undefined, backdated: date !== today, batch: Boolean(batch) });
      return { ok: true, status: queued ? 'queued' : 'saved' };
    } catch (error) {
      setLog(gecko.id, { status: 'error' });
      if (isAuthFailure(error)) {
        setSessionExpired(true);
        toast({ title: 'Sign in again', description: 'Your sign-in expired, so that log was not saved.', variant: 'destructive' });
        return { ok: false, status: 'auth' };
      }
      console.warn('Quick log not saved:', error);
      // A database refusal carries a code, and its own text is not for
      // members. Errors without one are this app's own words, such as
      // "This browser would not keep the log" in a private window, where
      // "try again in a minute" would be the wrong advice.
      const message = error?.code ? careLogErrorText(error) : (error?.message || careLogErrorText(error));
      if (!quiet) toast({ title: 'Not saved', description: message, variant: 'destructive' });
      return { ok: false, status: 'failed', message };
    }
  };

  // ---- Undo ----------------------------------------------------------------

  // Take back a feeding saved from this page. The first gecko of a group
  // logged today is the one whose save moved the group's schedule. When
  // another gecko of that group on this page is still logged as fed, the
  // group stays fed (D21) and the job of moving it back passes to that
  // gecko's Undo, so only the last one undone moves the group back.
  const undoSavedFeeding = async (gecko, entry) => {
    const keep = [];
    const handOff = new Map();
    for (const plan of entry.result?.advanced || []) {
      const heir = geckosRef.current.find((g) => g.id !== gecko.id
        && (g.feeding_group_id || null) === plan.id
        && isAcceptedFeeding(logsRef.current[g.id]));
      if (!heir) keep.push(plan);
      // A synced feeding cannot be undone here, so the group just stays fed.
      else if (!logsRef.current[heir.id].synced) handOff.set(heir.id, [...(handOff.get(heir.id) || []), plan]);
    }
    await undoFeedings({ ...entry.result, advanced: keep });
    for (const [heirId, plans] of handOff) {
      const heir = logsRef.current[heirId];
      if (!heir?.result) continue;
      setLog(heirId, { ...heir, result: { ...heir.result, advanced: [...(heir.result.advanced || []), ...plans] } });
    }
  };

  // Take back a log the phone kept and has since sent, by finding its row
  // again by the request id it was saved with.
  const undoSynced = async (gecko, entry) => {
    if (entry.kind === 'fed' && entry.accepted && entry.groupId) throw plainError(UNDO_SENT_MESSAGE);
    const client = entry.kind === 'fed' ? FeedingRecord : entry.kind === 'shed' ? ShedRecord : WeightRecord;
    if (!(await deleteByRequestId(client, entry.requestId))) throw plainError(UNDO_SENT_MESSAGE);
    if (entry.kind === 'weight' && entry.mirrored !== false) await Gecko.update(gecko.id, { weight_grams: entry.prevWeight });
  };

  // Takes one log back, or throws. The caller clears the gecko's card.
  const takeBack = async (gecko, entry) => {
    if (entry.status === 'queued') {
      const outcome = takeBackQueued(entry.queuedId);
      if (outcome === 'syncing') throw plainError(UNDO_SYNCING_MESSAGE);
      // Refused by the server: nothing was saved, so nothing to undo.
      if (outcome === 'refused') dismissRefusedLogs([entry.queuedId]);
      // Sent while the card still said "kept on this phone": undo the
      // saved row instead, or say plainly that it stays.
      if (outcome === 'sent') await undoSynced(gecko, entry);
    } else if (entry.synced) {
      await undoSynced(gecko, entry);
    } else if (entry.kind === 'fed') {
      await undoSavedFeeding(gecko, entry);
    } else if (entry.kind === 'shed') {
      if (entry.result?.id) await ShedRecord.delete(entry.result.id);
    } else {
      if (entry.result?.id) await WeightRecord.delete(entry.result.id);
      if (entry.mirrored !== false) await Gecko.update(gecko.id, { weight_grams: entry.prevWeight });
    }
  };

  // One Undo at a time. Two feedings of the same group undone in quick
  // succession would each hand the group's schedule to the other, and the
  // group would stay marked fed with no feedings left on the page. While
  // an Undo runs, the other Undo buttons are disabled and a tap is ignored.
  const [undoing, setUndoing] = useState(false);
  const undoingRef = useRef(false);

  const undo = async (gecko) => {
    const entry = logsRef.current[gecko.id];
    if (!canUndo(entry) || undoingRef.current) return;
    undoingRef.current = true;
    setUndoing(true);
    try {
      await takeBack(gecko, entry);
      setLog(gecko.id, undefined);
      refreshCollection();
      captureEvent('quick_log', { type, action: 'undone' });
    } catch (error) {
      if (!error?.plain) console.warn('Quick log undo failed:', error);
      // It may have synced (or been refused) in the meantime; the card
      // says so from now on.
      const next = settledQueuedEntry(entry, refusedRef.current);
      if (next) setLog(gecko.id, next);
      toast({
        title: 'Undo failed',
        description: error?.plain ? error.message : "Remove it from the gecko's record instead.",
        variant: 'destructive',
      });
    } finally {
      undoingRef.current = false;
      setUndoing(false);
    }
  };

  // Undo for a whole "Mark all" or "Save all": only the logs that tap
  // made, and only the ones still on the page as it left them (a gecko
  // undone on its own card since, or logged again, is left alone). It is
  // tapped from a toast up to 8 seconds later, so it reads refs, not the
  // values of the render that made it.
  const undoBatch = async (batch, outcome, noun) => {
    if (undoingRef.current) throw new Error('Another undo is still running.');
    undoingRef.current = true;
    setUndoing(true);
    let undone = 0;
    let stuck = 0;
    try {
      for (const gecko of geckosRef.current) {
        const entry = logsRef.current[gecko.id];
        if (!entry || entry.batch !== batch) continue;
        if (!canUndo(entry)) {
          stuck += 1;
          continue;
        }
        try {
          await takeBack(gecko, entry);
          setLog(gecko.id, undefined);
          undone += 1;
        } catch (error) {
          if (!error?.plain) console.warn('Quick log undo failed:', error);
          const next = settledQueuedEntry(entry, refusedRef.current);
          if (next) setLog(gecko.id, next);
          stuck += 1;
        }
      }
    } finally {
      undoingRef.current = false;
      setUndoing(false);
    }
    if (undone > 0) {
      refreshCollection();
      captureEvent('quick_log', { type, action: 'batch_undone', count: undone });
    }
    // Nothing came back: the toast says so in its own words.
    if (undone === 0 && stuck > 0) throw new Error('None of the batch could be undone.');
    outcome.text = stuck > 0
      ? `${undone} removed, ${stuck} still saved`
      : `${undone} ${noun(undone)} removed`;
  };

  // After a batch: one toast with Undo for what it saved, and one line for
  // what it could not save.
  const announceBatch = ({ batch, failed = 0, message = null, retry }) => {
    const mine = Object.values(logsRef.current).filter((entry) => entry?.batch === batch && isDone(entry));
    const count = mine.length;
    const kept = mine.filter((entry) => entry.status === 'queued').length;
    if (count > 0) {
      const noun = type === 'weight'
        ? (n) => (n === 1 ? 'weight' : 'weights')
        : type === 'shed' ? (n) => (n === 1 ? 'shed' : 'sheds') : (n) => (n === 1 ? 'feeding' : 'feedings');
      const title = type === 'weight'
        ? `${count} ${noun(count)} saved`
        : type === 'shed' ? `${count} ${noun(count)} logged` : `${count} fed`;
      const notes = [
        backdated ? `For ${shortDate(logDate)}.` : null,
        kept > 0 ? `${kept === count ? 'Kept' : `${kept} kept`} on this phone until you have a signal.` : null,
      ].filter(Boolean).join(' ');
      const outcome = { text: '' };
      undoToast({
        title,
        description: notes || undefined,
        undo: () => undoBatch(batch, outcome, noun),
        undone: <UndoOutcome outcome={outcome} />,
      });
    }
    if (failed > 0) {
      toast({
        title: count > 0 ? `${failed} not saved` : 'Not saved',
        description: `${message || careLogErrorText(null)} ${retry}`,
        variant: 'destructive',
      });
    }
  };

  // ---- Batches ---------------------------------------------------------------

  // "Mark all" and "Save all" save one gecko at a time, in order, so a
  // group's schedule moves once. While one runs, the batch buttons show a
  // spinner and ignore taps, and save() skips any gecko already saving or
  // saved. A gecko that fails does not stop the rest (an expired sign-in
  // does); a second tap then sends only what is not saved yet.
  const [batchBusy, setBatchBusy] = useState(false);
  const batchRef = useRef(false);
  const runBatch = async (work) => {
    if (batchRef.current) return;
    batchRef.current = true;
    setBatchBusy(true);
    batchCount += 1;
    const batch = `b${batchCount}`;
    const tally = { batch, failed: 0, message: null };
    const sendOne = async (gecko, options) => {
      const outcome = await save(gecko, { ...options, batch, quiet: true });
      if (!outcome.ok && outcome.status === 'failed') {
        tally.failed += 1;
        tally.message = tally.message || outcome.message;
      }
      return outcome.status !== 'auth';
    };
    try {
      await work(sendOne);
    } finally {
      batchRef.current = false;
      setBatchBusy(false);
    }
    return tally;
  };

  const markAll = async (list) => {
    if (guest) {
      demoNotice();
      return;
    }
    const tally = await runBatch(async (sendOne) => {
      for (const gecko of list) {
        if (!(await sendOne(gecko))) break;
      }
    });
    if (tally) announceBatch({ ...tally, retry: 'Tap Mark all again to send only those.' });
  };

  // What is in a gecko's weight box: { grams } when it can be saved,
  // { big: lastGrams } as well when it is far from the last weight, or
  // { empty } or { unreadable }.
  const readWeight = (gecko) => {
    const raw = String(weights[gecko.id] ?? '').trim();
    if (!raw) return { empty: true };
    const grams = parseGrams(raw);
    if (grams == null) return { unreadable: true };
    const last = lastWeightOf(gecko);
    return { grams, big: last && isBigWeightChange(grams, last.grams) ? last.grams : null };
  };

  // One gecko's weight (the Enter key in its box, or "Save" on the
  // big-change question, which passes confirmed).
  const saveWeight = (gecko, { confirmed = false } = {}) => {
    const read = readWeight(gecko);
    if (read.empty || read.unreadable) {
      toast({ title: 'Check the weight', description: 'Enter grams as a number, for example 18.5.' });
      return;
    }
    if (read.big != null && !confirmed) {
      setConfirms((prev) => ({ ...prev, [gecko.id]: { grams: read.grams, last: read.big } }));
      return;
    }
    save(gecko, { grams: read.grams });
  };

  // Back to the box to correct a slip.
  const fixWeight = (gecko) => {
    dropKey(setConfirms, gecko.id);
    if (typeof document !== 'undefined') document.getElementById(`ql-w-${gecko.id}`)?.focus();
  };

  // Every filled-in weight, each on its own request. A box that cannot be
  // read, or an entry far from the last weight, is left for the member to
  // answer on its own row and is not sent.
  const saveAllWeights = async (rows) => {
    const send = [];
    const ask = {};
    const bad = {};
    for (const gecko of rows) {
      const read = readWeight(gecko);
      if (read.empty) continue;
      if (read.unreadable) bad[gecko.id] = true;
      else if (read.big != null) ask[gecko.id] = { grams: read.grams, last: read.big };
      else send.push([gecko, read.grams]);
    }
    const held = Object.keys(ask).length + Object.keys(bad).length;
    if (held > 0) {
      setConfirms((prev) => ({ ...prev, ...ask }));
      setInvalid((prev) => ({ ...prev, ...bad }));
    }
    if (send.length === 0) {
      if (held > 0) toast({ title: held === 1 ? 'One weight needs a look' : `${held} weights need a look`, description: held === 1 ? 'Answer the question on its row.' : 'Answer the question on each marked row.' });
      else toast({ title: 'Check the weight', description: 'Enter grams as a number, for example 18.5.' });
      return;
    }
    if (guest) {
      demoNotice();
      return;
    }
    const tally = await runBatch(async (sendOne) => {
      for (const [gecko, grams] of send) {
        if (!(await sendOne(gecko, { grams }))) break;
      }
    });
    if (!tally) return;
    announceBatch({ ...tally, retry: 'They are still filled in. Tap Save all again to send only those.' });
    if (held > 0) {
      toast({
        title: held === 1 ? 'One weight needs a look' : `${held} weights need a look`,
        description: held === 1 ? 'It was not saved. Answer the question on its row.' : 'They were not saved. Answer the question on each marked row.',
      });
    }
  };

  const [groupOnlySaving, setGroupOnlySaving] = useState(null);
  const [groupOnlyDone, setGroupOnlyDone] = useState({});
  const markEmptyGroupFed = async (groupId) => {
    const group = groups[groupId];
    if (!group) return;
    if (guest) {
      demoNotice();
      return;
    }
    setGroupOnlySaving(groupId);
    try {
      await markGroupFed({ group, geckos: [], date: logDate > today ? today : logDate });
      setGroupOnlyDone((prev) => ({ ...prev, [groupId]: true }));
      refreshCollection();
    } catch (error) {
      console.warn('Group feeding not saved:', error);
      toast({ title: 'Not saved', description: careLogErrorText(error), variant: 'destructive' });
    }
    setGroupOnlySaving(null);
  };

  // Signing in again after the sign-in expired. This tab can still hold
  // the old session, and the sign-in page sends anyone it thinks is signed
  // in straight back here, so the session is ended in this browser first
  // (other devices stay signed in). The link is remembered
  // (src/lib/postAuthRedirect.js), so signing in by password, email link
  // or Google ends back on this same log.
  const signInAgain = async (event) => {
    event?.preventDefault?.();
    const back = `${location.pathname}${location.search}`;
    rememberPostAuthRedirect(back);
    try {
      await api.auth.endLocalSession();
    } catch {
      // The sign-in page still opens.
    }
    window.location.assign(`/AuthPortal?redirect=${encodeURIComponent(back)}`);
  };

  const finish = () => {
    const target = quickLogReturnTarget({ from: params.from, historyIndex: window.history.state?.idx ?? 0 });
    if (target === -1) navigate(-1);
    else navigate(target);
  };

  // ---- What the page shows -----------------------------------------------------

  const doneCount = allGeckos.filter((g) => isDone(logs[g.id])).length;
  const allDone = allGeckos.length > 0 && doneCount === allGeckos.length;
  const checkingNote = (
    <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading your geckos
    </p>
  );
  const offlineNoCopy = Boolean(user) && !hasList && (geckoQuery.fetchStatus === 'paused' || !online);
  const loading = !authChecked || (Boolean(user) && !hasList && !offlineNoCopy && !geckoQuery.isError && !sessionExpired);
  const listShown = !loading && Boolean(user) && !sessionExpired && hasList;
  const Icon = type === 'weight' ? Scale : type === 'shed' ? Sparkles : Utensils;
  const yesterday = addDays(today, -1);
  // The weight rows that still have a box, and how many boxes are filled.
  const openWeightRows = type === 'weight'
    ? allGeckos.filter((g) => !isDone(logs[g.id]) && logs[g.id]?.status !== 'refused')
    : [];
  const filledWeights = openWeightRows.filter((g) => String(weights[g.id] ?? '').trim()).length;

  const card = (gecko) => {
    const entry = logs[gecko.id];
    const done = isDone(entry);
    const saving = entry?.status === 'saving';
    const notSaved = entry?.status === 'refused';
    const isWeight = type === 'weight';
    const last = isWeight ? lastWeightOf(gecko) : null;
    const ask = confirms[gecko.id];
    const who = (
      <>
        <GeckoImage
          gecko={gecko}
          src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
          alt={gecko.name}
          loading="lazy"
          width={128}
          className={`${isWeight ? 'w-12 h-12' : 'w-14 h-14'} rounded-xl object-cover border border-slate-700 flex-shrink-0`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-slate-100 truncate">{gecko.name}</p>
          <p className="text-sm text-slate-400 truncate">
            {isWeight
              ? (last ? `last: ${last.grams} g${last.date ? ` on ${shortDate(last.date)}` : ''}` : 'No weight yet')
              : gecko.weight_grams != null ? `Last weight ${gecko.weight_grams} g` : gecko.morphs_traits || gecko.gecko_id_code || 'Crested gecko'}
          </p>
        </div>
      </>
    );
    return (
      <li key={gecko.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
        {isWeight && !done && !notSaved ? (
          // The box sits on the gecko's own row, so a rack of weights is
          // typed down one column and sent with "Save all" below.
          <form
            className="flex items-center gap-3"
            onSubmit={(e) => { e.preventDefault(); saveWeight(gecko); }}
          >
            {who}
            <label htmlFor={`ql-w-${gecko.id}`} className="sr-only">Weight of {gecko.name} in grams</label>
            <div className="relative w-28 flex-shrink-0">
              <Input
                id={`ql-w-${gecko.id}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.0"
                disabled={saving}
                aria-invalid={invalid[gecko.id] ? 'true' : undefined}
                value={weights[gecko.id] ?? ''}
                onChange={(e) => {
                  const { value } = e.target;
                  setWeights((prev) => ({ ...prev, [gecko.id]: value }));
                  dropKey(setConfirms, gecko.id);
                  dropKey(setInvalid, gecko.id);
                }}
                className={`min-h-12 pr-8 text-right text-lg bg-slate-950 ${invalid[gecko.id] ? 'border-red-500' : 'border-slate-600'}`}
              />
              <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'g'}
              </span>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3">{who}</div>
        )}

        {notSaved ? (
          <div role="alert" className="mt-3 rounded-xl bg-red-950/50 border border-red-700/60 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-red-100 text-base">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                {`${entry.label}, not saved`}
              </span>
              <Button type="button" variant="ghost" disabled={batchBusy} onClick={() => logAgain(gecko)} className="min-h-11 text-slate-100">
                <RotateCcw className="w-4 h-4 mr-1" /> Log again
              </Button>
            </div>
            <p className="mt-1 text-sm text-red-100/90">{entry.reason}</p>
          </div>
        ) : done ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-950/50 border border-emerald-700/60 px-3 py-2">
            <span className="flex items-center gap-2 text-emerald-200 text-base">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              {entry.status === 'queued' ? `${entry.label}, kept on this phone` : `${entry.label}, saved`}
            </span>
            {canUndo(entry) && (
              <Button type="button" variant="ghost" disabled={batchBusy || undoing} onClick={() => undo(gecko)} className="min-h-11 text-slate-200">
                <Undo2 className="w-4 h-4 mr-1" /> Undo
              </Button>
            )}
          </div>
        ) : isWeight ? (
          <>
            {ask && (
              <div role="alert" className="mt-3 rounded-xl border border-amber-500/50 bg-amber-950/30 px-3 py-2">
                <p className="text-base text-amber-100">That is a big change from {ask.last} g. Save {ask.grams} g?</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => saveWeight(gecko, { confirmed: true })}
                    className="min-h-11 flex-1 font-semibold bg-emerald-600 hover:bg-emerald-700"
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fixWeight(gecko)}
                    className="min-h-11 flex-1 border-slate-600 text-slate-200"
                  >
                    Fix
                  </Button>
                </div>
              </div>
            )}
            {invalid[gecko.id] && (
              <p role="alert" className="mt-2 text-sm text-red-300">Enter grams as a number, for example 18.5.</p>
            )}
            {entry?.status === 'error' && !ask && (
              <p role="alert" className="mt-2 text-sm text-red-300">Not saved. It is still filled in, so Save all sends it again.</p>
            )}
          </>
        ) : type === 'shed' ? (
          <Button
            type="button"
            disabled={saving}
            onClick={() => save(gecko)}
            className="mt-3 w-full min-h-12 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Shed today'}
          </Button>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={saving}
              onClick={() => save(gecko, { accepted: true })}
              className="flex-1 min-h-12 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Fed'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => save(gecko, { accepted: false })}
              className="min-h-12 px-4 text-base border-slate-600 text-slate-200"
            >
              Refused
            </Button>
          </div>
        )}
      </li>
    );
  };

  let body;
  if (loading) {
    body = (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-label="Loading" />
      </div>
    );
  } else if (sessionExpired || !user) {
    body = (
      <div className="text-center py-10">
        <p className="text-lg text-slate-300 mb-5">
          {sessionExpired ? 'Your sign-in expired. Sign in again to log this.' : 'Sign in to log this.'}
        </p>
        {/* Come back to this same log after signing in: a reminder tapped
            with an expired session should still end on the form it opened. */}
        <Button asChild className="min-h-12 px-6 bg-emerald-600 hover:bg-emerald-700">
          <Link to={`/AuthPortal?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} onClick={signInAgain}>
            <LogIn className="w-5 h-5 mr-2" /> Sign in
          </Link>
        </Button>
      </div>
    );
  } else if (offlineNoCopy) {
    body = (
      <p className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-amber-100">
        No signal, and this phone has no saved copy of your collection yet. Open the app once with a signal, then this works offline.
      </p>
    );
  } else if (geckoQuery.isError && !hasList) {
    body = (
      <p className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-300">
        Your collection did not load. Check your connection and try again.
      </p>
    );
  } else {
    const canMarkAll = type !== 'weight';
    // What "Mark all" still has to log. A gecko whose kept log the server
    // refused is left out too: its card asks the keeper to "Log again" on
    // purpose, and a refusal (the gecko deleted, or moved to another
    // account) would usually come back.
    const notDone = (list) => list.filter((g) => !['saved', 'queued', 'refused'].includes(logs[g.id]?.status));
    const pendingListed = notDone(picked.listed);
    const markAllButton = (list) => (
      <Button
        type="button"
        disabled={batchBusy}
        onClick={() => markAll(list)}
        className="w-full min-h-12 mb-3 text-lg font-semibold bg-emerald-700 hover:bg-emerald-800"
      >
        {batchBusy
          ? <Loader2 className="w-5 h-5 animate-spin" aria-label="Saving" />
          : type === 'shed' ? `Log a shed for all ${list.length}` : `Mark all ${list.length} fed`}
      </Button>
    );
    // A weigh-in or shed link can name a feeding group too; its geckos
    // show as plain cards. Only a feeding can mark a group that has no
    // geckos.
    const shownGroups = picked.groups.filter((group) => type === 'feeding' || group.geckos.length > 0);
    const nothingHere = allGeckos.length === 0 && shownGroups.length === 0;
    // Still working out the list for a link that names no geckos.
    const working = params.scope !== 'named' && !autoList;
    const settling = checking || working || (restAsked && !rest);
    const fromReminder = !params.inApp;
    const restCount = rest ? rest.geckoIds.length + rest.groupIds.length : 0;
    const dueWord = type === 'weight' ? 'a weigh-in' : 'feeding';
    const groupTip = type === 'feeding' && autoList?.kind === 'all' && shownGroups.length === 0;
    // From inside the app a feeding lists the racks first, each with its
    // "Mark all fed", then the geckos in no group. A reminder link keeps
    // the geckos it named on top.
    const groupsFirst = params.inApp && shownGroups.length > 0;
    const listedBlock = picked.listed.length > 0 && (
      <section className={groupsFirst ? 'mt-6' : ''}>
        {groupsFirst && <h2 className="text-base font-semibold text-slate-200 mb-2">In no group</h2>}
        {canMarkAll && picked.listed.length > 1 && pendingListed.length > 1 && markAllButton(pendingListed)}
        <ul className="space-y-3">{picked.listed.map(card)}</ul>
      </section>
    );
    body = (
      <>
        {guest && (
          <p className="mb-4 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
            Demo collection: look around, nothing you log here is saved.{' '}
            <Link to="/AuthPortal?mode=signup" className="font-medium text-emerald-300 underline underline-offset-2">Create a free account</Link>
          </p>
        )}

        {!groupsFirst && listedBlock}

        {shownGroups.map((group, index) => {
          const info = groups[group.id];
          const name = info?.name || info?.label || dueGroupNames[group.id] || 'Feeding group';
          const pendingInGroup = notDone(group.geckos);
          return (
            <section key={group.id} className={groupsFirst && index === 0 ? '' : 'mt-6'}>
              <h2 className="text-base font-semibold text-slate-200 mb-2">{name}</h2>
              {group.geckos.length === 0 ? (
                groupOnlyDone[group.id] ? (
                  <p className="flex items-center gap-2 text-emerald-200"><CheckCircle2 className="w-5 h-5" /> {name} marked fed{backdated ? ` for ${shortDate(logDate)}` : ' today'}.</p>
                ) : info ? (
                  <Button
                    type="button"
                    disabled={groupOnlySaving === group.id}
                    onClick={() => markEmptyGroupFed(group.id)}
                    className="w-full min-h-12 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700"
                  >
                    {groupOnlySaving === group.id ? <Loader2 className="w-5 h-5 animate-spin" /> : `Mark ${name} fed`}
                  </Button>
                ) : (
                  <p className="text-sm text-slate-400">
                    {online
                      ? 'This group has no geckos in it and could not be opened. It may have been deleted.'
                      : 'This group has no geckos in it. Open this page again with a signal to mark it fed.'}
                  </p>
                )
              ) : (
                <>
                  {canMarkAll && pendingInGroup.length > 1 && markAllButton(pendingInGroup)}
                  <ul className="space-y-3">{group.geckos.map(card)}</ul>
                </>
              )}
            </section>
          );
        })}

        {groupsFirst && listedBlock}

        {/* Only a reminder link leaves geckos out (it holds 10 ids); one
            tap lists the rest here, on this same screen. */}
        {fromReminder && params.more > 0 && !rest && (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-slate-300">
            <p>{params.more === 1 ? '1 more gecko is' : `${params.more} more geckos are`} due but did not fit in the reminder link.</p>
            <Button
              type="button"
              variant="outline"
              disabled={restAsked}
              onClick={() => setRestAsked(true)}
              className="mt-2 min-h-11 border-slate-600 text-slate-100"
            >
              {restAsked && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Show them here
            </Button>
          </div>
        )}
        {rest && restCount === 0 && (
          <p className="mt-4 text-sm text-slate-400">Nothing else is due right now.</p>
        )}

        {settling && (picked.missing > 0 || nothingHere) && checkingNote}
        {fromReminder && picked.missing > 0 && !settling && (
          <p className="mt-4 text-sm text-slate-400">
            {picked.missing === 1 ? 'One gecko from this reminder is' : `${picked.missing} geckos from this reminder are`} not in this collection. It may have been archived or sold, or you may be signed in to a different account.
          </p>
        )}
        {nothingHere && !settling && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-300">
            {autoList?.kind === 'due' ? (
              <p className="mb-3">Nothing is due for {dueWord} right now.</p>
            ) : autoList ? (
              <p className="mb-3">No geckos to log for yet. Add a gecko in My Geckos, then log its care here.</p>
            ) : (
              <p className="mb-3">Nothing to log here. The gecko may have been archived, sold or moved, or you may be signed in to a different account.</p>
            )}
            {autoList?.kind !== 'due' && <Link to="/MyGeckos" className="underline">Open My Geckos</Link>}
          </div>
        )}
        {autoList?.kind === 'due' && !settling && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setAuto(everyGecko(collection, todayData, type))}
            className="mt-4 w-full min-h-11 border-slate-600 text-slate-200"
          >
            Show all my geckos
          </Button>
        )}
        {groupTip && !settling && (
          // Feeding groups are made in the Season Planner; Batch Husbandry,
          // which this screen replaced, pointed there too.
          <p className="mt-4 text-sm text-slate-400">
            Feeding a rack? Put its geckos in a feeding group and this screen marks the whole group fed in one tap.{' '}
            <Link to="/ProjectManager?tab=feeding" className="underline text-emerald-300">Set up feeding groups</Link>
          </p>
        )}
      </>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-28 text-slate-100">
      <Seo title={quickLogTitle(type)} noIndex />
      <div className="flex items-center gap-2 mb-3">
        <Button type="button" variant="ghost" onClick={finish} className="min-h-11 px-2 text-slate-300" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Icon className="w-5 h-5 text-emerald-400" aria-hidden="true" />
        <h1 className="text-xl font-bold">{quickLogTitle(type)}</h1>
      </div>

      {/* The day everything saved from this screen is for. */}
      {listShown && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Log date">
            {[{ label: 'Today', value: today }, { label: 'Yesterday', value: yesterday }].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setLogDate(chip.value)}
                aria-pressed={logDate === chip.value}
                className={`min-h-11 px-4 rounded-full text-sm font-semibold border ${
                  logDate === chip.value
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                {chip.label}
              </button>
            ))}
            <Input
              type="date"
              aria-label="Pick another date"
              value={logDate}
              max={today}
              onChange={(e) => {
                const { value } = e.target;
                if (value && value <= today) setLogDate(value);
              }}
              className="min-h-11 w-auto bg-slate-900 border-slate-700 text-slate-100"
            />
          </div>
          {backdated && (
            <p className="mb-3 text-sm text-amber-300">Logging for {shortDate(logDate)}, not today.</p>
          )}
        </>
      )}

      {(!online || pending > 0) && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          <CloudOff className="w-4 h-4 flex-shrink-0" />
          <span>
            {!online ? 'No signal. Logs are kept on this phone. ' : ''}
            {pending > 0 ? `${pending} waiting to sync.` : ''}
          </span>
        </div>
      )}

      {body}

      {/* Stays in reach at the foot of the screen while a rack of weights
          is typed (the app's scrolling area already ends above the phone's
          tab bar); with a short list it simply sits under the last row. */}
      {listShown && openWeightRows.length > 0 && (
        <div className="sticky bottom-2 z-10 -mx-4 mt-4 border-t border-slate-800 bg-slate-950/95 px-4 py-2">
          <Button
            type="button"
            disabled={batchBusy || filledWeights === 0}
            onClick={() => saveAllWeights(openWeightRows)}
            className="w-full min-h-12 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700"
          >
            {batchBusy
              ? <Loader2 className="w-5 h-5 animate-spin" aria-label="Saving" />
              : filledWeights === 0
                ? (openWeightRows.length === 1 ? 'Save' : 'Save all')
                : filledWeights === 1 ? 'Save 1 weight' : `Save all ${filledWeights} weights`}
          </Button>
        </div>
      )}

      {!loading && user && (
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            onClick={finish}
            variant={allDone ? 'default' : 'outline'}
            className={allDone ? 'min-h-12 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700' : 'min-h-12 border-slate-600 text-slate-200'}
          >
            {allDone ? 'Done' : 'Back'}
          </Button>
          <p className="text-center text-xs text-slate-500">
            For notes, or one gecko at a time in your hand, use <Link to="/FieldMode" className="underline">Field Mode</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
