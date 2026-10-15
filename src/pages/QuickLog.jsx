import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CloudOff, Loader2, LogIn, Scale, Sparkles, Undo2, Utensils } from 'lucide-react';
import Seo from '@/components/seo/Seo';
import GeckoImage from '@/components/shared/GeckoImage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/api/appClient';
import { FeedingGroup, Gecko, ShedRecord, WeightRecord } from '@/entities/all';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { todayLocalISO } from '@/lib/dateUtils';
import { fieldModeQueryKey, loadWritableGeckos } from '@/lib/fieldModeData';
import { isGuestMode } from '@/lib/guestMode';
import { isAuthFailure, markGroupFed, undoFeedings } from '@/lib/husbandryLog';
import { removeQueued } from '@/lib/offlineQueue';
import { saveFieldLog, useOfflineQueue } from '@/lib/offlineSync';
import { captureEvent } from '@/lib/posthog';
import {
  parseQuickLogParams,
  pickQuickLogGeckos,
  quickLogReturnTarget,
  quickLogTitle,
} from '@/lib/quickLog';

/**
 * The one-tap log a reminder opens (review item E2 15):
 *   /log?type=weight|feeding|shed&gecko=<ids>&group=<ids>&from=<path>
 *
 * It shows the geckos the reminder named, each with one button: "Fed",
 * "Shed today", or a weight box and "Save". Feedings and sheds need no
 * value, so they save in one tap; a weight needs the number. A feeding
 * group in the link lists its geckos with "Mark all fed".
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
export default function QuickLog() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = useMemo(() => parseQuickLogParams(location.search), [location.search]);
  const { pending, online } = useOfflineQueue();
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
    retry: (count, error) => !isAuthFailure(error) && count < 2,
    queryFn: () => loadWritableGeckos(user),
  });

  const picked = useMemo(
    () => pickQuickLogGeckos({ geckos: geckoQuery.data || [], geckoIds: params.geckoIds, groupIds: params.groupIds }),
    [geckoQuery.data, params.geckoIds, params.groupIds],
  );

  // Group names, and the group itself for "Mark the group fed" when no
  // gecko is in it. Needs a connection; offline the group is just
  // "Feeding group".
  const [groups, setGroups] = useState({});
  useEffect(() => {
    if (!user?.email || guest || params.type !== 'feeding' || params.groupIds.length === 0) return undefined;
    let cancelled = false;
    Promise.all(params.groupIds.map((id) => FeedingGroup.get(id).catch(() => null)))
      .then((rows) => {
        if (cancelled) return;
        const next = {};
        rows.filter(Boolean).forEach((g) => { next[g.id] = g; });
        setGroups(next);
      });
    return () => { cancelled = true; };
  }, [user?.email, guest, params.type, params.groupIds]);

  useEffect(() => {
    captureEvent('quick_log', { type: params.type, action: 'opened', geckos: params.geckoIds.length, groups: params.groupIds.length });
  }, [params.type, params.geckoIds.length, params.groupIds.length]);

  // Per gecko: { status: 'saving' | 'saved' | 'queued' | 'error', undo, label }
  const [logs, setLogs] = useState({});
  const [weights, setWeights] = useState({});
  const setLog = (id, value) => setLogs((prev) => ({ ...prev, [id]: value }));

  const refreshCollection = () => {
    queryClient.invalidateQueries({ queryKey: ['my-geckos'] });
    queryClient.invalidateQueries({ queryKey: ['field-mode'] });
    window.dispatchEvent(new Event('geckos_changed'));
  };

  const undoFor = (kind, result, gecko, prevWeight) => {
    if (kind === 'fed') return () => undoFeedings(result);
    if (kind === 'shed') return async () => { if (result?.id) await ShedRecord.delete(result.id); };
    return async () => {
      if (result?.id) await WeightRecord.delete(result.id);
      await Gecko.update(gecko.id, { weight_grams: prevWeight });
    };
  };

  const save = async (gecko, { accepted = true, grams = null } = {}) => {
    const kind = params.type === 'weight' ? 'weight' : params.type === 'shed' ? 'shed' : 'fed';
    const data = kind === 'weight'
      ? { kind, geckoId: gecko.id, grams, date: today, mirror: true }
      : kind === 'shed'
        ? { kind, geckoId: gecko.id, date: today, quality: 'unknown' }
        : { kind, geckoId: gecko.id, feedingGroupId: gecko.feeding_group_id || null, accepted, date: today };
    const label = kind === 'weight' ? `${grams} g` : kind === 'shed' ? 'Shed logged' : accepted ? 'Fed' : 'Refused';
    setLog(gecko.id, { status: 'saving' });
    try {
      const { result, queued } = await saveFieldLog(data);
      setLog(gecko.id, {
        status: queued ? 'queued' : 'saved',
        label,
        undo: queued ? async () => { removeQueued(queued.id); } : undoFor(kind, result, gecko, gecko.weight_grams ?? null),
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
        toast({ title: 'Not saved', description: error?.message || 'Please try again.', variant: 'destructive' });
      }
      return false;
    }
  };

  const undo = async (gecko) => {
    const entry = logs[gecko.id];
    if (!entry?.undo) return;
    try {
      await entry.undo();
      setLog(gecko.id, undefined);
      refreshCollection();
      captureEvent('quick_log', { type: params.type, action: 'undone' });
    } catch (error) {
      toast({ title: 'Undo failed', description: error?.message || 'Remove it from the gecko record instead.', variant: 'destructive' });
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

  const markAll = async (list) => {
    for (const gecko of list) {
      if (logs[gecko.id]?.status === 'saved' || logs[gecko.id]?.status === 'queued') continue;
      // One at a time, in order, so the group schedule moves once.
      if (!(await save(gecko))) break;
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
      toast({ title: 'Not saved', description: error?.message || 'Please try again.', variant: 'destructive' });
    }
    setGroupOnlySaving(null);
  };

  const finish = () => {
    const target = quickLogReturnTarget({ from: params.from, historyIndex: window.history.state?.idx ?? 0 });
    if (target === -1) navigate(-1);
    else navigate(target);
  };

  const allGeckos = [...picked.listed, ...picked.groups.flatMap((g) => g.geckos)];
  const doneCount = allGeckos.filter((g) => ['saved', 'queued'].includes(logs[g.id]?.status)).length;
  const allDone = allGeckos.length > 0 && doneCount === allGeckos.length;
  const hasList = Boolean(geckoQuery.data);
  const offlineNoCopy = Boolean(user) && !hasList && geckoQuery.fetchStatus === 'paused';
  const loading = !authChecked || (Boolean(user) && !guest && !hasList && !offlineNoCopy && !geckoQuery.isError && !sessionExpired);
  const Icon = params.type === 'weight' ? Scale : params.type === 'shed' ? Sparkles : Utensils;

  const card = (gecko) => {
    const entry = logs[gecko.id];
    const done = entry?.status === 'saved' || entry?.status === 'queued';
    const saving = entry?.status === 'saving';
    return (
      <li key={gecko.id} className="rounded-2xl border border-slate-700 bg-slate-900 p-3">
        <div className="flex items-center gap-3">
          <GeckoImage
            gecko={gecko}
            src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
            alt={gecko.name}
            loading="lazy"
            className="w-14 h-14 rounded-xl object-cover border border-slate-700 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-slate-100 truncate">{gecko.name}</p>
            <p className="text-sm text-slate-400 truncate">
              {gecko.weight_grams != null ? `Last weight ${gecko.weight_grams} g` : gecko.morphs_traits || gecko.gecko_id_code || 'Crested gecko'}
            </p>
          </div>
        </div>

        {done ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-emerald-950/50 border border-emerald-700/60 px-3 py-2">
            <span className="flex items-center gap-2 text-emerald-200 text-base">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              {entry.status === 'queued' ? `${entry.label}, kept on this phone` : `${entry.label}, saved`}
            </span>
            <Button type="button" variant="ghost" onClick={() => undo(gecko)} className="min-h-11 text-slate-200">
              <Undo2 className="w-4 h-4 mr-1" /> Undo
            </Button>
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
          <Link to={`/AuthPortal?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>
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
    const multiple = picked.listed.length > 1 && params.type !== 'weight';
    const pendingListed = picked.listed.filter((g) => !['saved', 'queued'].includes(logs[g.id]?.status));
    body = (
      <>
        {multiple && pendingListed.length > 1 && (
          <Button
            type="button"
            onClick={() => markAll(pendingListed)}
            className="w-full min-h-12 mb-3 text-lg font-semibold bg-emerald-700 hover:bg-emerald-800"
          >
            {params.type === 'shed' ? `Log a shed for all ${pendingListed.length}` : `Mark all ${pendingListed.length} fed`}
          </Button>
        )}
        {picked.listed.length > 0 && <ul className="space-y-3">{picked.listed.map(card)}</ul>}

        {params.type === 'feeding' && picked.groups.map((group) => {
          const info = groups[group.id];
          const name = info?.name || info?.label || 'Feeding group';
          const pendingInGroup = group.geckos.filter((g) => !['saved', 'queued'].includes(logs[g.id]?.status));
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
                  {pendingInGroup.length > 1 && (
                    <Button
                      type="button"
                      onClick={() => markAll(pendingInGroup)}
                      className="w-full min-h-12 mb-3 text-lg font-semibold bg-emerald-700 hover:bg-emerald-800"
                    >
                      Mark all {pendingInGroup.length} fed
                    </Button>
                  )}
                  <ul className="space-y-3">{group.geckos.map(card)}</ul>
                </>
              )}
            </section>
          );
        })}

        {picked.missing > 0 && (
          <p className="mt-4 text-sm text-slate-400">
            {picked.missing === 1 ? 'One gecko from this reminder is' : `${picked.missing} geckos from this reminder are`} no longer in your collection.
          </p>
        )}
        {allGeckos.length === 0 && picked.groups.length === 0 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-slate-300">
            <p className="mb-3">Nothing to log here. The gecko may have been archived, sold or moved.</p>
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
