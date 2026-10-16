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
  parseQuickLogParams,
  pickQuickLogGeckos,
  quickLogReturnTarget,
  quickLogTitle,
} from '@/lib/quickLog';

/**
 * The one-tap log a reminder opens (review item E2 15):
 *   /log?type=weight|feeding|shed&gecko=<ids>&group=<ids>&more=<n>&from=<path>
 *
 * It shows the geckos the reminder named, each with one button: "Fed",
 * "Shed today", or a weight box and "Save". Feedings and sheds need no
 * value, so they save in one tap; a weight needs the number. A feeding
 * group in the link lists its geckos with "Mark all fed". When the
 * reminder covered more geckos than fit in the link, `more` says how many
 * and the page points to Field Mode for the rest.
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

async function deleteByRequestId(client, requestId) {
  const rows = requestId ? await client.filter({ client_request_id: requestId }) : [];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.id) return false;
  await client.delete(row.id);
  return true;
}

export default function QuickLog() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = useMemo(() => parseQuickLogParams(location.search), [location.search]);
  const { pending, online, refused } = useOfflineQueue();
  // Logs the server refused when the queue sent them. "No longer waiting"
  // alone is not "saved", so a kept log is checked against this first.
  const refusedList = useMemo(() => (Array.isArray(refused) ? refused : []), [refused]);
  const guest = isGuestMode();
  const today = todayLocalISO();

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

  const geckoQuery = useQuery({
    queryKey: fieldModeQueryKey(user?.email),
    enabled: Boolean(user?.email) && !guest,
    // Asked for again every time the page opens: the link can name a gecko
    // added a moment ago, which the copy kept on the phone does not have.
    // That copy still shows at once, and on its own with no signal.
    staleTime: 0,
    retry: (count, error) => !isAuthFailure(error) && count < 2,
    queryFn: () => loadWritableGeckos(user),
  });

  const picked = useMemo(
    () => pickQuickLogGeckos({ geckos: geckoQuery.data || [], geckoIds: params.geckoIds, groupIds: params.groupIds }),
    [geckoQuery.data, params.geckoIds, params.groupIds],
  );
  const allGeckos = [...picked.listed, ...picked.groups.flatMap((g) => g.geckos)];

  // Group names, and the group itself for "Mark the group fed" when no
  // gecko is in it. Needs a connection; offline the group is just
  // "Feeding group".
  const [groups, setGroups] = useState({});
  useEffect(() => {
    if (!user?.email || guest || params.groupIds.length === 0) return undefined;
    let cancelled = false;
    Promise.all(params.groupIds.map((id) => FeedingGroup.get(id).catch(() => null)))
      .then((rows) => {
        if (cancelled) return;
        const next = {};
        rows.filter(Boolean).forEach((g) => { next[g.id] = g; });
        setGroups(next);
      });
    return () => { cancelled = true; };
  }, [user?.email, guest, params.groupIds]);

  useEffect(() => {
    captureEvent('quick_log', { type: params.type, action: 'opened', geckos: params.geckoIds.length, groups: params.groupIds.length });
  }, [params.type, params.geckoIds.length, params.groupIds.length]);

  // Per gecko: { status: 'saving' | 'saved' | 'queued' | 'error', label,
  // kind, accepted, groupId, result, queuedId, requestId, prevWeight,
  // synced }. statusRef holds the same statuses without waiting for a
  // render, so a second tap (on Mark all, or on a gecko's own button while
  // Mark all runs) sees a save already under way and does not save twice.
  const [logs, setLogs] = useState({});
  const statusRef = useRef({});
  const [weights, setWeights] = useState({});
  const setLog = (id, value) => {
    statusRef.current = { ...statusRef.current, [id]: value?.status };
    setLogs((prev) => ({ ...prev, [id]: value }));
  };

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
    const entry = logs[gecko.id];
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

  const save = async (gecko, { accepted = true, grams = null } = {}) => {
    // Already saving, saved or kept for this gecko: never a second record.
    if (['saving', 'saved', 'queued'].includes(statusRef.current[gecko.id])) return true;
    // Logging again after a refusal: the old refusal has been answered.
    const prior = logs[gecko.id];
    if (prior?.status === 'refused' && prior.queuedId) dismissRefusedLogs([prior.queuedId]);
    const kind = params.type === 'weight' ? 'weight' : params.type === 'shed' ? 'shed' : 'fed';
    const data = kind === 'weight'
      ? { kind, geckoId: gecko.id, grams, date: today, mirror: true }
      : kind === 'shed'
        ? { kind, geckoId: gecko.id, date: today, quality: 'unknown' }
        : { kind, geckoId: gecko.id, feedingGroupId: gecko.feeding_group_id || null, accepted, date: today };
    const label = kind === 'weight' ? `${grams} g` : kind === 'shed' ? 'Shed logged' : accepted ? 'Fed' : 'Refused';
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
        prevWeight: gecko.weight_grams ?? null,
      });
      if (!queued) refreshCollection();
      captureEvent('quick_log', { type: params.type, action: 'saved', queued: Boolean(queued), accepted: kind === 'fed' ? accepted : undefined });
      return true;
    } catch (error) {
      setLog(gecko.id, { status: 'error' });
      if (isAuthFailure(error)) {
        setSessionExpired(true);
        toast({ title: 'Sign in again', description: 'Your sign-in expired, so that log was not saved.', variant: 'destructive' });
      } else {
        console.warn('Quick log not saved:', error);
        // A database refusal carries a code, and its own text is not for
        // members. Errors without one are this app's own words, such as
        // "This browser would not keep the log" in a private window, where
        // "try again in a minute" would be the wrong advice.
        toast({
          title: 'Not saved',
          description: error?.code ? careLogErrorText(error) : (error?.message || careLogErrorText(error)),
          variant: 'destructive',
        });
      }
      return false;
    }
  };

  // Take back a feeding saved from this page. The first gecko of a group
  // logged today is the one whose save moved the group's schedule. When
  // another gecko of that group on this page is still logged as fed, the
  // group stays fed (D21) and the job of moving it back passes to that
  // gecko's Undo, so only the last one undone moves the group back.
  const undoSavedFeeding = async (gecko, entry) => {
    const keep = [];
    const handOff = new Map();
    for (const plan of entry.result?.advanced || []) {
      const heir = allGeckos.find((g) => g.id !== gecko.id
        && (g.feeding_group_id || null) === plan.id
        && isAcceptedFeeding(logs[g.id]));
      if (!heir) keep.push(plan);
      // A synced feeding cannot be undone here, so the group just stays fed.
      else if (!logs[heir.id].synced) handOff.set(heir.id, [...(handOff.get(heir.id) || []), plan]);
    }
    await undoFeedings({ ...entry.result, advanced: keep });
    for (const [heirId, plans] of handOff) {
      setLogs((prev) => {
        const heir = prev[heirId];
        if (!heir?.result) return prev;
        return { ...prev, [heirId]: { ...heir, result: { ...heir.result, advanced: [...(heir.result.advanced || []), ...plans] } } };
      });
    }
  };

  // Take back a log the phone kept and has since sent, by finding its row
  // again by the request id it was saved with.
  const undoSynced = async (gecko, entry) => {
    if (entry.kind === 'fed' && entry.accepted && entry.groupId) throw plainError(UNDO_SENT_MESSAGE);
    const client = entry.kind === 'fed' ? FeedingRecord : entry.kind === 'shed' ? ShedRecord : WeightRecord;
    if (!(await deleteByRequestId(client, entry.requestId))) throw plainError(UNDO_SENT_MESSAGE);
    if (entry.kind === 'weight') await Gecko.update(gecko.id, { weight_grams: entry.prevWeight });
  };

  // One Undo at a time. Two feedings of the same group undone in quick
  // succession would each hand the group's schedule to the other, and the
  // group would stay marked fed with no feedings left on the page. While
  // an Undo runs, the other Undo buttons are disabled and a tap is ignored.
  const [undoing, setUndoing] = useState(false);
  const undoingRef = useRef(false);

  const undo = async (gecko) => {
    const entry = logs[gecko.id];
    if (!canUndo(entry) || undoingRef.current) return;
    undoingRef.current = true;
    setUndoing(true);
    try {
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
        await Gecko.update(gecko.id, { weight_grams: entry.prevWeight });
      }
      setLog(gecko.id, undefined);
      refreshCollection();
      captureEvent('quick_log', { type: params.type, action: 'undone' });
    } catch (error) {
      if (!error?.plain) console.warn('Quick log undo failed:', error);
      // It may have synced (or been refused) in the meantime; the card
      // says so from now on.
      const next = settledQueuedEntry(entry, refusedList);
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

  const saveWeight = (gecko) => {
    const raw = String(weights[gecko.id] ?? '').replace(',', '.').trim();
    const grams = Math.round(Number(raw) * 10) / 10;
    if (!raw || !Number.isFinite(grams) || grams <= 0 || grams >= 500) {
      toast({ title: 'Check the weight', description: 'Enter grams as a number, for example 18.5.' });
      return;
    }
    save(gecko, { grams });
  };

  // "Mark all" saves one gecko at a time, in order, so the group schedule
  // moves once. While it runs, both Mark all buttons show a spinner and
  // ignore taps, and save() skips any gecko already saving or saved.
  const [markingAll, setMarkingAll] = useState(false);
  const markingAllRef = useRef(false);
  const markAll = async (list) => {
    if (markingAllRef.current) return;
    markingAllRef.current = true;
    setMarkingAll(true);
    try {
      for (const gecko of list) {
        if (!(await save(gecko))) break;
      }
    } finally {
      markingAllRef.current = false;
      setMarkingAll(false);
    }
  };

  const [groupOnlySaving, setGroupOnlySaving] = useState(null);
  const [groupOnlyDone, setGroupOnlyDone] = useState({});
  const markEmptyGroupFed = async (groupId) => {
    const group = groups[groupId];
    if (!group) return;
    setGroupOnlySaving(groupId);
    try {
      await markGroupFed({ group, geckos: [], date: today });
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

  const doneCount = allGeckos.filter((g) => ['saved', 'queued'].includes(logs[g.id]?.status)).length;
  const allDone = allGeckos.length > 0 && doneCount === allGeckos.length;
  const hasList = Boolean(geckoQuery.data);
  // The collection is being asked for again. Until it answers, a gecko the
  // link names but the kept copy lacks (added a moment ago) is shown as
  // loading, not as archived, sold or in another account. Not with no
  // signal: when the app is opened without one, the phone says so, but the
  // query client counts itself online until an 'offline' event (which then
  // never fires) and keeps retrying for several seconds.
  const checking = hasList && geckoQuery.isFetching && online;
  const checkingNote = (
    <p className="mt-4 flex items-center gap-2 text-sm text-slate-400">
      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading your geckos
    </p>
  );
  const offlineNoCopy = Boolean(user) && !hasList && (geckoQuery.fetchStatus === 'paused' || !online);
  const loading = !authChecked || (Boolean(user) && !guest && !hasList && !offlineNoCopy && !geckoQuery.isError && !sessionExpired);
  const Icon = params.type === 'weight' ? Scale : params.type === 'shed' ? Sparkles : Utensils;

  const card = (gecko) => {
    const entry = logs[gecko.id];
    const done = entry?.status === 'saved' || entry?.status === 'queued';
    const saving = entry?.status === 'saving';
    const notSaved = entry?.status === 'refused';
    return (
      <li key={gecko.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
        <div className="flex items-center gap-3">
          <GeckoImage
            gecko={gecko}
            src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
            alt={gecko.name}
            loading="lazy"
            width={128}
            className="w-14 h-14 rounded-xl object-cover border border-slate-700 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-slate-100 truncate">{gecko.name}</p>
            <p className="text-sm text-slate-400 truncate">
              {gecko.weight_grams != null ? `Last weight ${gecko.weight_grams} g` : gecko.morphs_traits || gecko.gecko_id_code || 'Crested gecko'}
            </p>
          </div>
        </div>

        {notSaved ? (
          <div role="alert" className="mt-3 rounded-xl bg-red-950/50 border border-red-700/60 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-red-100 text-base">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                {`${entry.label}, not saved`}
              </span>
              <Button type="button" variant="ghost" disabled={markingAll} onClick={() => logAgain(gecko)} className="min-h-11 text-slate-100">
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
              <Button type="button" variant="ghost" disabled={markingAll || undoing} onClick={() => undo(gecko)} className="min-h-11 text-slate-200">
                <Undo2 className="w-4 h-4 mr-1" /> Undo
              </Button>
            )}
          </div>
        ) : params.type === 'weight' ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); saveWeight(gecko); }}
          >
            <label htmlFor={`ql-w-${gecko.id}`} className="sr-only">Weight of {gecko.name} in grams</label>
            <Input
              id={`ql-w-${gecko.id}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Grams"
              value={weights[gecko.id] ?? ''}
              onChange={(e) => setWeights((prev) => ({ ...prev, [gecko.id]: e.target.value }))}
              className="min-h-12 text-lg bg-slate-950 border-slate-600"
            />
            <Button type="submit" disabled={saving} className="min-h-12 px-6 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save'}
            </Button>
          </form>
        ) : params.type === 'shed' ? (
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
  } else if (guest) {
    body = (
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-300">
        <p className="mb-4">This is the demo, so nothing is saved. With a free account, reminders open this screen and one tap logs the feeding, shed or weigh-in.</p>
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link to="/AuthPortal?mode=signup">Create a free account</Link>
        </Button>
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
    const canMarkAll = params.type !== 'weight';
    // What "Mark all" still has to log. A gecko whose kept log the server
    // refused is left out too: its card asks the keeper to "Log again" on
    // purpose, and a refusal (the gecko deleted, or moved to another
    // account) would usually come back and stop Mark all at that gecko.
    const notDone = (list) => list.filter((g) => !['saved', 'queued', 'refused'].includes(logs[g.id]?.status));
    const pendingListed = notDone(picked.listed);
    const markAllButton = (list) => (
      <Button
        type="button"
        disabled={markingAll}
        onClick={() => markAll(list)}
        className="w-full min-h-12 mb-3 text-lg font-semibold bg-emerald-700 hover:bg-emerald-800"
      >
        {markingAll
          ? <Loader2 className="w-5 h-5 animate-spin" aria-label="Saving" />
          : params.type === 'shed' ? `Log a shed for all ${list.length}` : `Mark all ${list.length} fed`}
      </Button>
    );
    // A weigh-in or shed link can name a feeding group too (quickLogPath
    // allows it); its geckos show as plain cards. Only a feeding can mark
    // a group that has no geckos.
    const shownGroups = picked.groups.filter((group) => params.type === 'feeding' || group.geckos.length > 0);
    const nothingHere = allGeckos.length === 0 && shownGroups.length === 0;
    body = (
      <>
        {canMarkAll && picked.listed.length > 1 && pendingListed.length > 1 && markAllButton(pendingListed)}
        {picked.listed.length > 0 && <ul className="space-y-3">{picked.listed.map(card)}</ul>}

        {shownGroups.map((group) => {
          const info = groups[group.id];
          const name = info?.name || info?.label || 'Feeding group';
          const pendingInGroup = notDone(group.geckos);
          return (
            <section key={group.id} className="mt-6">
              <h2 className="text-base font-semibold text-slate-200 mb-2">{name}</h2>
              {group.geckos.length === 0 ? (
                groupOnlyDone[group.id] ? (
                  <p className="flex items-center gap-2 text-emerald-200"><CheckCircle2 className="w-5 h-5" /> {name} marked fed today.</p>
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
                    Open <Link className="underline" to="/BatchHusbandry">Batch Husbandry</Link> to mark this group fed{online ? '' : ' once you have a signal'}.
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

        {params.more > 0 && (
          <p className="mt-4 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
            {params.more === 1 ? '1 more gecko is' : `${params.more} more geckos are`} due but did not fit on this page.{' '}
            <Link to="/FieldMode" className="underline text-emerald-300">Log the rest in Field Mode</Link>.
          </p>
        )}
        {checking && (picked.missing > 0 || nothingHere) && checkingNote}
        {picked.missing > 0 && !checking && (
          <p className="mt-4 text-sm text-slate-400">
            {picked.missing === 1 ? 'One gecko from this reminder is' : `${picked.missing} geckos from this reminder are`} not in this collection. It may have been archived or sold, or you may be signed in to a different account.
          </p>
        )}
        {nothingHere && !checking && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-300">
            <p className="mb-3">Nothing to log here. The gecko may have been archived, sold or moved, or you may be signed in to a different account.</p>
            <Link to="/MyGeckos" className="underline">Open My Geckos</Link>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 pb-28 text-slate-100">
      <Seo title={quickLogTitle(params.type)} noIndex />
      <div className="flex items-center gap-2 mb-4">
        <Button type="button" variant="ghost" onClick={finish} className="min-h-11 px-2 text-slate-300" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Icon className="w-5 h-5 text-emerald-400" aria-hidden="true" />
        <h1 className="text-xl font-bold">{quickLogTitle(params.type)}</h1>
        <span className="ml-auto text-sm text-slate-400">Today</span>
      </div>

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

      {!loading && user && !guest && (
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
            Logged for today. To log another day, use <Link to="/FieldMode" className="underline">Field Mode</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
