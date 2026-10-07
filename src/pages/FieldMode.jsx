import GeckoImage from '@/components/shared/GeckoImage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import Seo from '@/components/seo/Seo';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  CheckCircle2,
  Delete,
  Layers,
  Loader2,
  LogIn,
  Mic,
  MicOff,
  Scale,
  Search,
  StickyNote,
  Undo2,
  Utensils,
  X,
  CloudOff,
} from 'lucide-react';
import { Gecko, WeightRecord, ShedRecord, FeedingRecord, GeckoEvent, CollectionMember } from '@/entities/all';
import { api } from '@/api/appClient';
import { getVisibleGeckos, canWriteGecko } from '@/lib/geckoAccess';
import { todayLocalISO, parseLocalDate } from '@/lib/dateUtils';
import { format, subDays } from 'date-fns';
import {
  logFeedings,
  undoFeedings,
  advanceGroupsForFeedings,
  revertGroupAdvances,
  logShed as writeShed,
  isAuthFailure,
} from '@/lib/husbandryLog';
import { createPageUrl } from '@/utils';
import { queueFieldLog, isDeviceOffline, useOfflineQueue } from '@/lib/offlineSync';
import { enqueue, removeQueued, updateQueued, isNetworkError } from '@/lib/offlineQueue';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

/**
 * Field Mode, a one-thumb logging screen for when you literally have a
 * gecko in one hand. Pick an animal, then log a weight, shed, feeding,
 * or quick note with giant touch targets. Every log shows a transient
 * checkmark with a 10 second undo window. Voice input is a progressive
 * enhancement on top (Web Speech API, on-device, free), and voice never
 * auto-commits: the parsed interpretation is shown as a chip the user
 * taps to confirm.
 *
 * Entity shapes (verified against AnimalPassport reads + migrations):
 *   WeightRecord  { gecko_id, weight_grams, record_date }  (+ mirror to gecko.weight_grams)
 *   ShedRecord    { animal_id, date, quality }   quality CHECK: complete | partial | retained_toes | retained_eye_caps | unknown
 *   FeedingRecord { animal_id, date, food_type, accepted }
 *   GeckoEvent    { gecko_id, event_type, event_date, notes, custom_event_name }  (notes go here, not gecko.notes)
 *
 * Feedings and sheds go through src/lib/husbandryLog.js, the one log every
 * surface shares, so a "Fed" here also moves the gecko's feeding group
 * schedule (D21). Every log can be backdated with the date chips above
 * the buttons; the date resets to today when Field Mode opens.
 *
 * Offline: the collection comes from the copy kept in this browser
 * (src/lib/offlineCache.js, query key 'field-mode'). A log made with no
 * signal (or whose request never reached the server) is kept on the phone
 * as a whole log and replayed through the same husbandryLog functions when
 * the connection returns (src/lib/offlineSync.js), with its backdated day
 * and the group schedule move. An expired sign-in still shows "Sign in".
 */

const RECENT_KEY = 'geckinspect_field_mode_recent';
const RECENT_MAX = 24;
const UNDO_WINDOW_MS = 10000;

// UI label -> shed_records.quality value (DB CHECK constraint).
// "Stuck" maps to retained_toes, the most common stuck-shed spot on cresties.
const SHED_QUALITIES = [
  { label: 'Clean', value: 'complete' },
  { label: 'Partial', value: 'partial' },
  { label: 'Stuck', value: 'retained_toes' },
];

const shedQualityLabel = (value) =>
  SHED_QUALITIES.find((q) => q.value === value)?.label || 'Not noted';

// ---------------------------------------------------------------------------
// Recent-handled list (localStorage)
// ---------------------------------------------------------------------------

function getRecentIds() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushRecentId(id) {
  try {
    const next = [id, ...getRecentIds().filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [id];
  }
}

// ---------------------------------------------------------------------------
// Voice utterance parser
// ---------------------------------------------------------------------------

const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
  six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15',
  sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
};

/**
 * Turn number words into digits so the regex below can find them.
 * "fourteen point five grams" -> "14 . 5 grams" -> "14.5 grams".
 */
function normalizeNumbers(text) {
  let out = text
    .split(/\s+/)
    .map((word) => {
      const clean = word.replace(/[^a-z0-9.]/g, '');
      if (clean === 'point') return '.';
      return NUMBER_WORDS[clean] ?? word;
    })
    .join(' ');
  // Stitch "14 . 5" back into "14.5".
  out = out.replace(/(\d+)\s*\.\s*(\d+)/g, '$1.$2');
  return out;
}

/**
 * Parse a spoken phrase into one of the four field actions, or null.
 * Coverage: "fourteen point five grams", "12 grams", "clean shed",
 * "shed, stuck", "fed", "fed, refused", "she ate", "note ..." falls
 * through to null (notes are typed, dictation of long notes is left to
 * the OS keyboard mic).
 */
export function parseFieldUtterance(raw) {
  if (!raw) return null;
  const text = normalizeNumbers(raw.toLowerCase().trim());

  if (/\bshed(ding)?\b/.test(text)) {
    let quality = 'unknown';
    if (/\b(clean|complete|full|perfect|good)\b/.test(text)) quality = 'complete';
    else if (/\bpartial\b/.test(text)) quality = 'partial';
    else if (/\b(stuck|retained|bad)\b/.test(text)) quality = 'retained_toes';
    return {
      type: 'shed',
      quality,
      label: `Log shed today (${quality === 'unknown' ? 'quality not noted' : shedQualityLabel(quality)})`,
    };
  }

  if (/\b(fed|feed|feeding|ate|eat|eaten)\b/.test(text)) {
    const refused = /\b(refused?|reject(ed)?|skipped|untouched|would not|won'?t|didn'?t|not)\b/.test(text);
    return {
      type: 'fed',
      accepted: !refused,
      label: refused ? 'Log feeding today (refused)' : 'Log feeding today (accepted)',
    };
  }

  // Weight: a number, with or without a grams keyword. Prefer the number
  // right before "gram(s)" or "g" when the phrase has several numbers.
  const withUnit = text.match(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/);
  const bare = text.match(/(\d+(?:\.\d+)?)/);
  const numStr = withUnit?.[1] ?? bare?.[1];
  if (numStr) {
    const grams = Math.round(parseFloat(numStr) * 10) / 10;
    if (!isNaN(grams) && grams > 0 && grams < 500) {
      return { type: 'weight', grams, label: `Log weight ${grams} g` };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FieldModePage() {
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [geckos, setGeckos] = useState([]);
  const { pending: pendingSync, online } = useOfflineQueue();
  // An expired sign-in shows "Sign in", not a connection error.
  const [sessionExpired, setSessionExpired] = useState(false);
  // The day the next log is for. Today unless the keeper backdates it.
  const [logDate, setLogDate] = useState(todayLocalISO);

  const [recentIds, setRecentIds] = useState(getRecentIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGecko, setSelectedGecko] = useState(null);
  const [activePanel, setActivePanel] = useState(null); // 'weight' | 'note' | null
  const [isSaving, setIsSaving] = useState(false);

  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  const [sessionCount, setSessionCount] = useState(0);
  const [showCheck, setShowCheck] = useState(false);
  const [undoEntry, setUndoEntry] = useState(null);
  const undoTimerRef = useRef(null);
  const checkTimerRef = useRef(null);

  // Voice
  const SpeechRecognitionCtor =
    typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const voiceSupported = Boolean(SpeechRecognitionCtor);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [pendingVoice, setPendingVoice] = useState(null); // { transcript, action }

  // ----- data load -----------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    api.auth.me()
      .then((currentUser) => { if (!cancelled) setUser(currentUser); })
      .catch((error) => {
        if (cancelled) return;
        // No stored session at all: the "Sign in" screen. (Offline with a
        // stored session, api.auth.me uses it instead of failing.)
        setUser(null);
        if (isAuthFailure(error)) setSessionExpired(true);
      })
      .finally(() => { if (!cancelled) setAuthChecked(true); });
    return () => {
      cancelled = true;
    };
  }, []);

  // react-query, so the last loaded list is kept in this browser and Field
  // Mode opens with no signal (src/lib/offlineCache.js persists this key).
  const geckoQuery = useQuery({
    queryKey: ['field-mode', user?.email || null],
    enabled: Boolean(user?.email),
    retry: (count, error) => !isAuthFailure(error) && count < 2,
    queryFn: async () => {
      const [allGeckos, memberships] = await Promise.all([
        getVisibleGeckos(user, {}, '-created_date', 500),
        CollectionMember.filter({ status: 'accepted' }).catch(() => []),
      ]);
      return (allGeckos || []).filter((g) => !g.archived && canWriteGecko(g, user, memberships));
    },
  });

  useEffect(() => {
    if (geckoQuery.data) setGeckos(geckoQuery.data);
  }, [geckoQuery.data]);

  useEffect(() => {
    if (geckoQuery.isError && isAuthFailure(geckoQuery.error)) setSessionExpired(true);
  }, [geckoQuery.isError, geckoQuery.error]);

  const hasList = Boolean(geckoQuery.data);
  // Offline with no saved copy: react-query pauses the fetch instead of
  // failing, so say why the list is empty rather than spinning forever.
  const offlineNoCopy = Boolean(user) && !hasList && geckoQuery.fetchStatus === 'paused';
  const loadError = Boolean(user) && !hasList && geckoQuery.isError && !isAuthFailure(geckoQuery.error);
  const isLoading = !authChecked
    || (Boolean(user) && !hasList && !offlineNoCopy && !loadError && !sessionExpired);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // already stopped
        }
      }
    };
  }, []);

  // ----- picker ordering -----------------------------------------------

  const orderedGeckos = useMemo(() => {
    const rank = new Map(recentIds.map((id, i) => [id, i]));
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? geckos.filter(
          (g) =>
            (g.name || '').toLowerCase().includes(term) ||
            (g.gecko_id_code || '').toLowerCase().includes(term)
        )
      : geckos;
    return [...filtered].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id) : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id) : Infinity;
      if (ra !== rb) return ra - rb;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [geckos, recentIds, searchTerm]);

  const selectGecko = (gecko) => {
    setSelectedGecko(gecko);
    setActivePanel(null);
    setPendingVoice(null);
    setRecentIds(pushRecentId(gecko.id));
  };

  const backToPicker = () => {
    stopListening();
    setSelectedGecko(null);
    setActivePanel(null);
    setPendingVoice(null);
    setWeightInput('');
    setNoteInput('');
  };

  // ----- success + undo plumbing ----------------------------------------

  const flashCheck = () => {
    setShowCheck(true);
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    checkTimerRef.current = setTimeout(() => setShowCheck(false), 1200);
  };

  const registerUndo = useCallback((entry) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoEntry(entry);
    undoTimerRef.current = setTimeout(() => setUndoEntry(null), UNDO_WINDOW_MS);
  }, []);

  const handleUndo = async () => {
    if (!undoEntry) return;
    const entry = undoEntry;
    setUndoEntry(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    try {
      await entry.undo();
      setSessionCount((c) => Math.max(0, c - 1));
      toast({ title: 'Undone', description: entry.message });
    } catch (error) {
      console.error('Undo failed:', error);
      toast({ title: 'Undo failed', description: error.message || 'Try again from the gecko page.', variant: 'destructive' });
    }
  };

  const afterLog = (entry) => {
    setSessionCount((c) => c + 1);
    flashCheck();
    registerUndo(entry);
  };

  // ----- log actions -----------------------------------------------------

  const today = todayLocalISO();
  const isBackdated = logDate !== today;
  const logDayLabel = isBackdated ? format(parseLocalDate(logDate), 'EEE MMM d') : 'today';

  // A failed save because the sign-in expired gets a "Sign in" prompt
  // instead of a raw error.
  const reportSaveError = (error, fallback) => {
    if (isAuthFailure(error)) {
      setSessionExpired(true);
      toast({ title: 'Sign in again', description: 'Your sign-in expired, so that log was not saved.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Save failed', description: error?.message || fallback, variant: 'destructive' });
  };

  // Offline: a log that cannot reach the server is kept on the phone and
  // sent later. An auth error is not a network error, so an expired
  // sign-in still gets "Sign in" above instead of being queued.
  const shouldQueue = (error) => isDeviceOffline() || (error && isNetworkError(error) && !isAuthFailure(error));
  const savedLabel = (queued, text) => (queued ? `${text} kept on this phone` : `${text} saved`);

  const logWeight = async (gecko, grams, date = logDate) => {
    setIsSaving(true);
    const prevWeight = gecko.weight_grams ?? null;
    // The gecko's current weight follows today's weigh-in. A backdated
    // weigh-in only fills it when the gecko has no weight yet.
    const mirror = date === todayLocalISO() || prevWeight == null;
    const showWeight = (value) => {
      setGeckos((prev) => prev.map((g) => (g.id === gecko.id ? { ...g, weight_grams: value } : g)));
      setSelectedGecko((s) => (s && s.id === gecko.id ? { ...s, weight_grams: value } : s));
    };
    const finish = (entry) => {
      if (mirror) showWeight(grams);
      afterLog({
        kind: 'weight',
        queued: Boolean(entry.queued),
        message: savedLabel(Boolean(entry.queued), `${grams} g for ${gecko.name}`),
        undo: async () => {
          await entry.undo();
          if (mirror) showWeight(prevWeight);
        },
      });
      setWeightInput('');
      setActivePanel(null);
    };
    const queueWhole = () => {
      const item = queueFieldLog({ kind: 'weight', geckoId: gecko.id, grams, date, mirror });
      finish({ queued: item, undo: async () => { removeQueued(item.id); } });
    };
    try {
      if (isDeviceOffline()) {
        queueWhole();
        return;
      }
      let record;
      try {
        record = await WeightRecord.create({ gecko_id: gecko.id, weight_grams: grams, record_date: date });
      } catch (error) {
        if (!shouldQueue(error)) throw error;
        queueWhole();
        return;
      }
      // The weigh-in saved; if only the shown-weight update cannot reach
      // the server, keep just that part for later.
      let mirrorItem = null;
      if (mirror) {
        try {
          await Gecko.update(gecko.id, { weight_grams: grams });
        } catch (error) {
          if (!shouldQueue(error)) throw error;
          mirrorItem = enqueue({ entity: 'Gecko', op: 'update', recordId: gecko.id, data: { weight_grams: grams } });
        }
      }
      finish({
        queued: null,
        undo: async () => {
          await WeightRecord.delete(record.id);
          if (!mirror) return;
          if (mirrorItem) removeQueued(mirrorItem.id);
          else await Gecko.update(gecko.id, { weight_grams: prevWeight });
        },
      });
    } catch (error) {
      console.error('Weight log failed:', error);
      reportSaveError(error, 'Could not save the weight.');
    } finally {
      setIsSaving(false);
    }
  };

  const logShed = async (gecko, quality = 'unknown', date = logDate) => {
    setIsSaving(true);
    const queueShed = () => {
      const item = queueFieldLog({ kind: 'shed', geckoId: gecko.id, date, quality });
      afterLog({
        kind: 'shed',
        queueId: item.id,
        quality,
        queued: true,
        message: savedLabel(true, `Shed for ${gecko.name}`),
        undo: async () => { removeQueued(item.id); },
      });
    };
    try {
      if (isDeviceOffline()) {
        queueShed();
        return;
      }
      const record = await writeShed({ gecko, date, quality });
      afterLog({
        kind: 'shed',
        recordId: record.id,
        quality,
        message: `Shed for ${gecko.name}`,
        undo: async () => {
          await ShedRecord.delete(record.id);
        },
      });
    } catch (error) {
      if (shouldQueue(error)) {
        queueShed();
        return;
      }
      console.error('Shed log failed:', error);
      reportSaveError(error, 'Could not log the shed.');
    } finally {
      setIsSaving(false);
    }
  };

  const logFed = async (gecko, accepted = true, date = logDate) => {
    setIsSaving(true);
    // Kept offline as a whole log; it replays through logFeedings, which
    // also moves the group schedule then (never back in time).
    const queueFed = () => {
      const item = queueFieldLog({
        kind: 'fed',
        geckoId: gecko.id,
        feedingGroupId: gecko.feeding_group_id || null,
        accepted,
        date,
      });
      afterLog({
        kind: 'fed',
        queueId: item.id,
        gecko,
        date,
        accepted,
        queued: true,
        message: savedLabel(true, `Feeding for ${gecko.name}`),
        undo: async () => { removeQueued(item.id); },
      });
    };
    try {
      if (isDeviceOffline()) {
        queueFed();
        return;
      }
      // Writes the feeding row and moves the gecko's group schedule when
      // it ate (D21), so Dashboard and reminders stop calling it due.
      const result = await logFeedings({ entries: [{ gecko, accepted }], date });
      afterLog({
        kind: 'fed',
        recordId: result.records[0]?.id,
        gecko,
        date,
        accepted,
        result,
        message: `Feeding for ${gecko.name}`,
        undo: async () => {
          await undoFeedings(result);
        },
      });
    } catch (error) {
      if (shouldQueue(error)) {
        queueFed();
        return;
      }
      console.error('Feeding log failed:', error);
      reportSaveError(error, 'Could not log the feeding.');
    } finally {
      setIsSaving(false);
    }
  };

  // Deep link from the owner's quick log on the passport (the QR on the tub
  // label): /FieldMode?gecko=<id>&log=fed|shed|weight opens that gecko.
  // Fed and shed are logged on arrival (with the usual undo); weight opens
  // the weight entry. The link is cleared right away so a refresh cannot
  // log twice.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current || isLoading) return;
    deepLinkDone.current = true;
    const wanted = searchParams.get('gecko');
    const log = searchParams.get('log');
    if (wanted) setSearchParams({}, { replace: true });
    const match = wanted ? geckos.find((g) => g.id === wanted) : null;
    if (!match) return;
    setSelectedGecko(match);
    setRecentIds(pushRecentId(match.id));
    if (log === 'weight') setActivePanel('weight');
    else if (log === 'fed') logFed(match, true, todayLocalISO());
    else if (log === 'shed') logShed(match, 'unknown', todayLocalISO());
    // logFed and logShed are stable in behavior; this runs once per visit.
  }, [isLoading, geckos, searchParams]);


  const logNote = async (gecko, text, date = logDate) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setIsSaving(true);
    // A backdated note lands at noon on that day.
    const when = date === todayLocalISO() ? new Date() : new Date(`${date}T12:00:00`);
    const done = (entry) => {
      afterLog({ kind: 'note', ...entry });
      setNoteInput('');
      setActivePanel(null);
    };
    const queueNote = () => {
      const item = queueFieldLog({ kind: 'note', geckoId: gecko.id, eventDate: when.toISOString(), notes: trimmed });
      done({ queued: true, message: savedLabel(true, `Note for ${gecko.name}`), undo: async () => { removeQueued(item.id); } });
    };
    try {
      if (isDeviceOffline()) {
        queueNote();
        return;
      }
      const record = await GeckoEvent.create({
        gecko_id: gecko.id,
        event_type: 'custom',
        custom_event_name: 'Field note',
        event_date: when.toISOString(),
        notes: trimmed,
      });
      done({
        message: `Note for ${gecko.name}`,
        undo: async () => {
          await GeckoEvent.delete(record.id);
        },
      });
    } catch (error) {
      if (shouldQueue(error)) {
        queueNote();
        return;
      }
      console.error('Note save failed:', error);
      reportSaveError(error, 'Could not save the note.');
    } finally {
      setIsSaving(false);
    }
  };

  // Refine the record that is still inside its undo window (shed quality
  // chips, fed accepted/refused toggle).
  const refineShedQuality = async (quality) => {
    if (!undoEntry || undoEntry.kind !== 'shed') return;
    try {
      // A shed still waiting to sync is changed in the queue.
      if (undoEntry.queueId) updateQueued(undoEntry.queueId, { quality });
      else await ShedRecord.update(undoEntry.recordId, { quality });
      setUndoEntry((e) => (e && e.kind === 'shed' ? { ...e, quality } : e));
    } catch (error) {
      console.error('Shed quality update failed:', error);
      toast({ title: 'Update failed', description: 'Could not set shed quality.', variant: 'destructive' });
    }
  };

  const toggleFedAccepted = async () => {
    if (!undoEntry || undoEntry.kind !== 'fed') return;
    const entry = undoEntry;
    const next = !entry.accepted;
    // A feeding still waiting to sync: change it in the queue. The group
    // schedule moves (or not) when it replays.
    if (entry.queueId) {
      updateQueued(entry.queueId, { accepted: next });
      setUndoEntry((e) => (e && e.kind === 'fed' ? { ...e, accepted: next } : e));
      return;
    }
    try {
      await FeedingRecord.update(entry.recordId, { accepted: next });
      // A refusal does not count as feeding the group (D21), so the group
      // schedule follows the toggle.
      let advanced = entry.result?.advanced || [];
      if (!next) {
        await revertGroupAdvances(advanced);
        advanced = [];
      } else {
        ({ advanced } = await advanceGroupsForFeedings([{ gecko: entry.gecko, accepted: true }], { date: entry.date }));
      }
      const result = { ...entry.result, advanced };
      setUndoEntry((e) => (e && e.kind === 'fed' ? {
        ...e,
        accepted: next,
        result,
        undo: async () => { await undoFeedings(result); },
      } : e));
    } catch (error) {
      console.error('Feeding update failed:', error);
      toast({ title: 'Update failed', description: 'Could not update the feeding.', variant: 'destructive' });
    }
  };

  // ----- numeric pad -----------------------------------------------------

  const pressPadKey = (key) => {
    setWeightInput((prev) => {
      if (key === 'del') return prev.slice(0, -1);
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : prev + '.';
      }
      // Digits: cap at one decimal place and a sane integer length.
      const next = prev + key;
      if (/^\d{0,3}(\.\d?)?$/.test(next)) return next;
      return prev;
    });
  };

  const weightValue = parseFloat(weightInput);
  const weightValid = !isNaN(weightValue) && weightValue > 0;

  // ----- voice -----------------------------------------------------------

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // already stopped
      }
    }
    setIsListening(false);
  };

  const startListening = () => {
    if (!voiceSupported || isListening) return;
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      const action = parseFieldUtterance(transcript);
      if (action) {
        setPendingVoice({ transcript, action });
      } else {
        toast({
          title: 'Did not catch that',
          description: 'Try "fourteen point five grams", "clean shed", or "fed, refused".',
        });
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    try {
      recognition.start();
      setIsListening(true);
      setPendingVoice(null);
    } catch (error) {
      console.error('Speech recognition failed to start:', error);
      setIsListening(false);
    }
  };

  const commitPendingVoice = async () => {
    if (!pendingVoice || !selectedGecko || isSaving) return;
    const { action } = pendingVoice;
    setPendingVoice(null);
    if (action.type === 'weight') await logWeight(selectedGecko, action.grams);
    else if (action.type === 'shed') await logShed(selectedGecko, action.quality);
    else if (action.type === 'fed') await logFed(selectedGecko, action.accepted);
  };

  // ----- render ----------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div data-field-mode className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overscroll-none">
      <Seo title="Field Mode" noIndex />

      {/* Big transient checkmark */}
      <AnimatePresence>
        {showCheck && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none"
          >
            <CheckCircle2 className="w-40 h-40 text-emerald-400 drop-shadow-[0_0_30px_rgba(52,211,153,0.6)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undo banner */}
      <AnimatePresence>
        {undoEntry && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-3 left-3 right-3 z-[65] rounded-2xl bg-emerald-900/95 border border-emerald-600 p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-300 flex-shrink-0" />
                <span className="text-lg font-semibold truncate">{/(saved|kept on this phone)$/.test(undoEntry.message) ? undoEntry.message : `${undoEntry.message} saved`}</span>
              </div>
              <Button
                onClick={handleUndo}
                className="min-h-14 px-6 text-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 flex-shrink-0"
              >
                <Undo2 className="w-5 h-5 mr-2" /> Undo
              </Button>
            </div>
            {undoEntry.kind === 'shed' && (
              <div className="flex gap-2 mt-3">
                {SHED_QUALITIES.map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => refineShedQuality(q.value)}
                    className={`min-h-14 flex-1 rounded-xl text-lg font-semibold border transition-colors ${
                      undoEntry.quality === q.value
                        ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                        : 'bg-slate-800 border-slate-600 text-slate-200'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
            {undoEntry.kind === 'fed' && (
              <button
                type="button"
                onClick={toggleFedAccepted}
                className="mt-3 w-full min-h-14 rounded-xl text-lg font-semibold border bg-slate-800 border-slate-600"
              >
                {undoEntry.accepted ? 'Accepted. Tap if refused' : 'Refused. Tap if accepted'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main scroll area */}
      {/* Offline and waiting-to-sync notice */}
      {(!online || pendingSync > 0) && (
        <div role="status" className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-base text-amber-100">
          <CloudOff className="w-5 h-5 flex-shrink-0" />
          <span>
            {!online ? 'No signal. Logs are kept on this phone. ' : ''}
            {pendingSync > 0
              ? `${pendingSync} log${pendingSync === 1 ? '' : 's'} waiting to sync${online ? ', sending now.' : '. They send when you are back online.'}`
              : ''}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-24">
        {sessionExpired || (!user && !loadError) ? (
          <div className="p-6 text-center">
            <p className="text-xl text-slate-300 mt-16 mb-6">
              {sessionExpired && user
                ? 'Your sign-in expired. Sign in again to keep logging.'
                : 'Sign in to use field mode.'}
            </p>
            <Button
              onClick={() => api.auth.redirectToLogin()}
              className="min-h-14 px-8 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 rounded-2xl"
            >
              <LogIn className="w-6 h-6 mr-2" /> Sign in
            </Button>
          </div>
        ) : offlineNoCopy ? (
          <div className="p-6 text-center">
            <p className="text-xl text-slate-300 mt-16">You are offline and this phone has no saved copy of your collection yet. Open Field Mode once with signal, then it works offline.</p>
          </div>
        ) : loadError ? (
          <div className="p-6 text-center">
            <p className="text-xl text-slate-300 mt-16">Could not load your collection. Check your connection and reload.</p>
          </div>
        ) : !selectedGecko ? (
          /* ------------------------------ Animal picker ------------------------------ */
          <div className="p-4">
            <h1 className="text-2xl font-bold mb-1">Field Mode</h1>
            <p className="text-lg text-slate-400 mb-4">Pick the gecko in your hand.</p>
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500" />
              <Input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name or ID"
                className="min-h-14 h-14 pl-12 text-lg bg-slate-900 border-slate-700 text-slate-100 rounded-2xl"
              />
            </div>
            {orderedGeckos.length === 0 ? (
              <p className="text-lg text-slate-400 text-center py-16">
                {geckos.length === 0
                  ? 'No geckos yet. Add your first crestie (your Lilly White, your Harlequin, whoever is up front in the rack) from My Geckos, then come back.'
                  : 'No match. Try a shorter search, like "Lilly" or the ID code.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {orderedGeckos.map((gecko) => (
                  <button
                    key={gecko.id}
                    type="button"
                    onClick={() => selectGecko(gecko)}
                    className="flex items-center gap-4 p-3 rounded-2xl bg-slate-900 border border-slate-700 active:bg-slate-800 text-left min-h-14"
                  >
                    <GeckoImage
                      src={gecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
                      alt={gecko.name}
                      loading="lazy"
                      className="w-16 h-16 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xl font-bold truncate">{gecko.name}</p>
                      <p className="text-base text-slate-400 truncate">{gecko.gecko_id_code || 'No ID code'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ------------------------------ Action screen ------------------------------ */
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <button
                type="button"
                onClick={backToPicker}
                className="min-h-14 min-w-14 flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-700"
                aria-label="Back to gecko list"
              >
                <ArrowLeft className="w-7 h-7" />
              </button>
              <GeckoImage
                src={selectedGecko.image_urls?.[0] || DEFAULT_GECKO_IMAGE}
                alt={selectedGecko.name}
                className="w-14 h-14 rounded-xl object-cover border border-slate-700"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold truncate">{selectedGecko.name}</p>
                <p className="text-base text-slate-400 truncate">
                  {selectedGecko.gecko_id_code || 'No ID code'}
                  {selectedGecko.weight_grams != null && ` · last ${selectedGecko.weight_grams} g`}
                </p>
              </div>
              {voiceSupported && (
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={`min-h-14 min-w-14 flex items-center justify-center rounded-2xl border ${
                    isListening
                      ? 'bg-red-600 border-red-400 animate-pulse'
                      : 'bg-slate-900 border-slate-700'
                  }`}
                  aria-label={isListening ? 'Stop listening' : 'Speak a log, like "fourteen point five grams"'}
                >
                  {isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                </button>
              )}
            </div>

            {/* Voice confirmation chip, tap to commit, never auto-commits */}
            <AnimatePresence>
              {pendingVoice && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="mb-4 rounded-2xl bg-indigo-950 border border-indigo-500 p-4"
                >
                  <p className="text-base text-indigo-300 mb-2">Heard: &ldquo;{pendingVoice.transcript}&rdquo;</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={commitPendingVoice}
                      disabled={isSaving}
                      className="flex-1 min-h-14 rounded-xl bg-indigo-500 text-slate-950 text-lg font-bold active:bg-indigo-400"
                    >
                      Tap to log: {pendingVoice.action.label.replace('today', logDayLabel)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingVoice(null)}
                      className="min-h-14 min-w-14 rounded-xl bg-slate-800 border border-slate-600 flex items-center justify-center"
                      aria-label="Dismiss voice input"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Which day this log is for. Backdating covers the feeding you
                forgot to log last night. */}
            <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Log date">
              {[
                { label: 'Today', value: today },
                { label: 'Yesterday', value: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setLogDate(chip.value)}
                  aria-pressed={logDate === chip.value}
                  className={`min-h-14 px-5 rounded-2xl text-lg font-semibold border ${
                    logDate === chip.value
                      ? 'bg-emerald-500 border-emerald-300 text-slate-950'
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
                  const v = e.target.value;
                  if (v && v <= today) setLogDate(v);
                }}
                className="min-h-14 h-14 text-lg bg-slate-900 border-slate-700 text-slate-100 rounded-2xl w-auto"
              />
            </div>
            {isBackdated && (
              <p className="mb-4 text-lg text-amber-300">Logging for {logDayLabel}, not today.</p>
            )}

            {activePanel === null && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActivePanel('weight')}
                  disabled={isSaving}
                  className="min-h-36 rounded-3xl bg-emerald-900/60 border-2 border-emerald-600 flex flex-col items-center justify-center gap-2 active:bg-emerald-800"
                >
                  <Scale className="w-12 h-12 text-emerald-300" />
                  <span className="text-2xl font-bold">Weight</span>
                </button>
                <button
                  type="button"
                  onClick={() => logShed(selectedGecko)}
                  disabled={isSaving}
                  className="min-h-36 rounded-3xl bg-sky-900/60 border-2 border-sky-600 flex flex-col items-center justify-center gap-2 active:bg-sky-800"
                >
                  <Layers className="w-12 h-12 text-sky-300" />
                  <span className="text-2xl font-bold">Shed</span>
                  <span className="text-base text-sky-300">One tap logs {logDayLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => logFed(selectedGecko)}
                  disabled={isSaving}
                  className="min-h-36 rounded-3xl bg-amber-900/60 border-2 border-amber-600 flex flex-col items-center justify-center gap-2 active:bg-amber-800"
                >
                  <Utensils className="w-12 h-12 text-amber-300" />
                  <span className="text-2xl font-bold">Fed</span>
                  <span className="text-base text-amber-300">One tap logs {logDayLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActivePanel('note')}
                  disabled={isSaving}
                  className="min-h-36 rounded-3xl bg-purple-900/60 border-2 border-purple-600 flex flex-col items-center justify-center gap-2 active:bg-purple-800"
                >
                  <StickyNote className="w-12 h-12 text-purple-300" />
                  <span className="text-2xl font-bold">Note</span>
                </button>
              </div>
            )}

            {/* Weight numeric pad */}
            {activePanel === 'weight' && (
              <div className="rounded-3xl bg-slate-900 border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg text-slate-400">Weight in grams</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePanel(null);
                      setWeightInput('');
                    }}
                    className="min-h-14 min-w-14 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-600"
                    aria-label="Cancel weight entry"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="text-center text-5xl font-bold mb-4 min-h-16">
                  {weightInput || <span className="text-slate-500">0.0</span>}
                  <span className="text-2xl text-slate-500 ml-1">g</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pressPadKey(key)}
                      className="min-h-16 rounded-2xl bg-slate-800 border border-slate-600 text-2xl font-bold active:bg-slate-700 flex items-center justify-center"
                      aria-label={key === 'del' ? 'Delete last digit' : key}
                    >
                      {key === 'del' ? <Delete className="w-7 h-7" /> : key}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => logWeight(selectedGecko, Math.round(weightValue * 10) / 10)}
                  disabled={!weightValid || isSaving}
                  className="w-full min-h-16 text-xl font-bold bg-emerald-600 hover:bg-emerald-700 rounded-2xl"
                >
                  {isSaving && <Loader2 className="w-6 h-6 mr-2 animate-spin" />}
                  Save weight
                </Button>
              </div>
            )}

            {/* Note */}
            {activePanel === 'note' && (
              <div className="rounded-3xl bg-slate-900 border border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg text-slate-400">Quick note</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePanel(null);
                      setNoteInput('');
                    }}
                    className="min-h-14 min-w-14 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-600"
                    aria-label="Cancel note"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <Textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder="Fired up tonight, ate off the tongs. Tail kink looks unchanged."
                  rows={4}
                  className="bg-slate-800 border-slate-600 text-lg text-slate-100 mb-3"
                />
                <Button
                  onClick={() => logNote(selectedGecko, noteInput)}
                  disabled={!noteInput.trim() || isSaving}
                  className="w-full min-h-16 text-xl font-bold bg-purple-600 hover:bg-purple-700 rounded-2xl"
                >
                  {isSaving && <Loader2 className="w-6 h-6 mr-2 animate-spin" />}
                  Save note
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-slate-900 border-t border-slate-700 px-4 py-3 flex items-center justify-between">
        <span className="text-lg text-slate-300">
          {sessionCount === 0
            ? 'No logs yet this session'
            : `${sessionCount} ${sessionCount === 1 ? 'log' : 'logs'} this session`}
        </span>
        <Link
          to={createPageUrl('MyGeckos')}
          className="min-h-14 px-5 flex items-center rounded-2xl bg-slate-800 border border-slate-600 text-lg font-semibold text-slate-100"
        >
          Exit field mode
        </Link>
      </div>
    </div>
  );
}
