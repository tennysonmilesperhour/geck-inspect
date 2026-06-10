import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Mic,
  MicOff,
  Scale,
  Search,
  StickyNote,
  Undo2,
  Utensils,
  X,
} from 'lucide-react';
import { Gecko, WeightRecord, ShedRecord, FeedingRecord, GeckoEvent, CollectionMember } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import { getVisibleGeckos, canWriteGecko } from '@/lib/geckoAccess';
import { todayLocalISO } from '@/lib/dateUtils';
import { createPageUrl } from '@/utils';
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
  const [geckos, setGeckos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

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
    (async () => {
      try {
        const currentUser = await base44.auth.me();
        if (cancelled) return;
        setUser(currentUser);
        const [allGeckos, memberships] = await Promise.all([
          getVisibleGeckos(currentUser, {}, '-created_date', 500),
          CollectionMember.filter({ status: 'accepted' }).catch(() => []),
        ]);
        if (cancelled) return;
        const writable = (allGeckos || []).filter(
          (g) => !g.archived && canWriteGecko(g, currentUser, memberships)
        );
        setGeckos(writable);
      } catch (error) {
        console.error('Field mode load failed:', error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const logWeight = async (gecko, grams) => {
    setIsSaving(true);
    try {
      const prevWeight = gecko.weight_grams ?? null;
      const record = await WeightRecord.create({
        gecko_id: gecko.id,
        weight_grams: grams,
        record_date: todayLocalISO(),
      });
      await Gecko.update(gecko.id, { weight_grams: grams });
      setGeckos((prev) => prev.map((g) => (g.id === gecko.id ? { ...g, weight_grams: grams } : g)));
      setSelectedGecko((s) => (s && s.id === gecko.id ? { ...s, weight_grams: grams } : s));
      afterLog({
        kind: 'weight',
        message: `${grams} g for ${gecko.name}`,
        undo: async () => {
          await WeightRecord.delete(record.id);
          await Gecko.update(gecko.id, { weight_grams: prevWeight });
          setGeckos((prev) => prev.map((g) => (g.id === gecko.id ? { ...g, weight_grams: prevWeight } : g)));
          setSelectedGecko((s) => (s && s.id === gecko.id ? { ...s, weight_grams: prevWeight } : s));
        },
      });
      setWeightInput('');
      setActivePanel(null);
    } catch (error) {
      console.error('Weight log failed:', error);
      toast({ title: 'Save failed', description: error.message || 'Could not save the weight.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const logShed = async (gecko, quality = 'unknown') => {
    setIsSaving(true);
    try {
      const record = await ShedRecord.create({
        animal_id: gecko.id,
        date: todayLocalISO(),
        quality,
      });
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
      console.error('Shed log failed:', error);
      toast({ title: 'Save failed', description: error.message || 'Could not log the shed.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const logFed = async (gecko, accepted = true) => {
    setIsSaving(true);
    try {
      const record = await FeedingRecord.create({
        animal_id: gecko.id,
        date: todayLocalISO(),
        food_type: 'CGD',
        accepted,
      });
      afterLog({
        kind: 'fed',
        recordId: record.id,
        accepted,
        message: `Feeding for ${gecko.name}`,
        undo: async () => {
          await FeedingRecord.delete(record.id);
        },
      });
    } catch (error) {
      console.error('Feeding log failed:', error);
      toast({ title: 'Save failed', description: error.message || 'Could not log the feeding.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const logNote = async (gecko, text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const record = await GeckoEvent.create({
        gecko_id: gecko.id,
        event_type: 'custom',
        custom_event_name: 'Field note',
        event_date: new Date().toISOString(),
        notes: trimmed,
      });
      afterLog({
        kind: 'note',
        message: `Note for ${gecko.name}`,
        undo: async () => {
          await GeckoEvent.delete(record.id);
        },
      });
      setNoteInput('');
      setActivePanel(null);
    } catch (error) {
      console.error('Note save failed:', error);
      toast({ title: 'Save failed', description: error.message || 'Could not save the note.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Refine the record that is still inside its undo window (shed quality
  // chips, fed accepted/refused toggle).
  const refineShedQuality = async (quality) => {
    if (!undoEntry || undoEntry.kind !== 'shed') return;
    try {
      await ShedRecord.update(undoEntry.recordId, { quality });
      setUndoEntry((e) => (e && e.kind === 'shed' ? { ...e, quality } : e));
    } catch (error) {
      console.error('Shed quality update failed:', error);
      toast({ title: 'Update failed', description: 'Could not set shed quality.', variant: 'destructive' });
    }
  };

  const toggleFedAccepted = async () => {
    if (!undoEntry || undoEntry.kind !== 'fed') return;
    const next = !undoEntry.accepted;
    try {
      await FeedingRecord.update(undoEntry.recordId, { accepted: next });
      setUndoEntry((e) => (e && e.kind === 'fed' ? { ...e, accepted: next } : e));
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
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overscroll-none">
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
                <span className="text-lg font-semibold truncate">{undoEntry.message} saved</span>
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
      <div className="flex-1 overflow-y-auto pb-24">
        {loadError ? (
          <div className="p-6 text-center">
            <p className="text-xl text-slate-300 mt-16">Could not load your collection. Check your connection and reload.</p>
          </div>
        ) : !user ? (
          <div className="p-6 text-center">
            <p className="text-xl text-slate-300 mt-16">Sign in to use field mode.</p>
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
                    <img
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
              <img
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
                      Tap to log: {pendingVoice.action.label}
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
                  <span className="text-base text-sky-300">One tap logs today</span>
                </button>
                <button
                  type="button"
                  onClick={() => logFed(selectedGecko)}
                  disabled={isSaving}
                  className="min-h-36 rounded-3xl bg-amber-900/60 border-2 border-amber-600 flex flex-col items-center justify-center gap-2 active:bg-amber-800"
                >
                  <Utensils className="w-12 h-12 text-amber-300" />
                  <span className="text-2xl font-bold">Fed</span>
                  <span className="text-base text-amber-300">One tap logs today</span>
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
                  {weightInput || <span className="text-slate-600">0.0</span>}
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
