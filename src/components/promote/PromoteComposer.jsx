import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sparkles, RefreshCw, Copy, Send, Check, Undo2,
  AlertCircle, Loader2, Image as ImageIcon, Calendar, ChevronDown, Lightbulb,
} from 'lucide-react';
import PromoteImageGallery from './PromoteImageGallery';
import { getTierLimits } from '@/lib/tierLimits';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import {
  VOICE_PRESETS, POST_TEMPLATES, PLATFORMS, PLATFORM_CHAR_LIMITS,
  HASHTAG_LIBRARY, normalizeHashtag, buildMorphMarketCsvRow,
  composePlatformText, platformDeepLink, platformLabel,
  pickPrimaryPlatform, isDirectPlatform, publishErrorMessage, generationErrorMessage,
} from '@/lib/socialMedia';
import { buildGeckoFacts, findAiTells, TWEAKS, MOMENT_PROMPTS } from '@/lib/postCraft';
import { supabase } from '@/lib/supabaseClient';
import { SocialPost, SocialPostVariant, UserBrandVoice, GeckoWaitlist } from '@/entities/all';
import { toast } from '@/components/ui/use-toast';

// See the schedule input below.
const SCHEDULING_ENABLED = false;

const DEFAULT_VOICE = 'casual';
const DEFAULT_TEMPLATE = 'meet';
const DEFAULT_PLATFORMS = ['bluesky'];
const DEFAULT_LENGTH = 'medium';
const ITERATION_CAP = 10;
const MAX_WRITER_PHOTOS = 2;

// Join a draft's parts the way the keeper will post it.
function draftText(v) {
  if (!v) return '';
  return [v.hook, v.body, v.cta].map((s) => (s || '').trim()).filter(Boolean).join('\n\n');
}

// The composer: tell it what's going on, get three different drafts,
// pick one, refine it in your own words, then copy or publish.
//
// Lifecycle:
//   Open with a gecko -> load its records into plain facts -> keeper
//   writes what's going on, picks photos -> Write drafts creates the
//   social_posts row and returns 3 drafts -> keeper picks one, edits,
//   uses one-tap tweaks -> Copy / Publish.
//
// Iteration cap: 10 generations per draft post (each tweak counts).
export default function PromoteComposer({
  open, onOpenChange, gecko, user, onPublished, onPaymentRequired,
}) {
  const [draft, setDraft] = useState(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [voicePreset, setVoicePreset] = useState(DEFAULT_VOICE);
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const [lengthPref, setLengthPref] = useState(DEFAULT_LENGTH);
  // The keeper's own words about why they're posting. The single most
  // useful input: it gives the post a reason to exist.
  const [moment, setMoment] = useState('');
  const [facts, setFacts] = useState({ profile: [], recent: [] });
  const [factsOpen, setFactsOpen] = useState(false);
  // Photos the writer looks at (URLs from gecko.image_urls).
  const [writerPhotos, setWriterPhotos] = useState([]);
  const [variants, setVariants] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [tweaking, setTweaking] = useState(null); // tweak key in flight
  const [publishing, setPublishing] = useState(false);
  const [iterations, setIterations] = useState(0);
  const [editedContent, setEditedContent] = useState('');
  const [undoContent, setUndoContent] = useState(null);
  const [editedHashtags, setEditedHashtags] = useState('');
  const [hashtagsOpen, setHashtagsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  // Saved writing samples (user_brand_voice). A selected one is sent as
  // voice_custom and beats the preset.
  const [customVoices, setCustomVoices] = useState([]);
  const [selectedCustomVoiceId, setSelectedCustomVoiceId] = useState(null);
  const [showNewVoiceForm, setShowNewVoiceForm] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceText, setNewVoiceText] = useState('');
  const [savingVoice, setSavingVoice] = useState(false);
  // Opening-line suggestions for the active draft.
  const [hookSuggestions, setHookSuggestions] = useState([]);
  const [rewritingHooks, setRewritingHooks] = useState(false);
  // Thread/carousel split state. When the body exceeds the active
  // platform's char limit we offer a client-side split into segments,
  // each within the limit, with "1/N" markers.
  const [threadSegments, setThreadSegments] = useState([]);
  // Promote image library + per-post picks. The gallery opens as a
  // sibling modal; selected rows become image_ids on the variant
  // when we publish or schedule.
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [pickedImages, setPickedImages] = useState([]); // [{id, public_url, ...}]
  // Scheduling: datetime-local string ("YYYY-MM-DDTHH:mm").
  const [scheduleAt, setScheduleAt] = useState('');
  const tierLimitsFn = useMemo(() => getTierLimits(user), [user]);

  const geckoPhotos = useMemo(
    () => (Array.isArray(gecko?.image_urls) ? gecko.image_urls.filter((u) => typeof u === 'string' && u) : []).slice(0, 8),
    [gecko?.image_urls],
  );

  // Reset on open / gecko change.
  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setVariants([]);
    setActiveIdx(0);
    setIterations(0);
    setEditedContent('');
    setUndoContent(null);
    setEditedHashtags('');
    setError(null);
    setMoment('');
    setFacts({ profile: [], recent: [] });
    setFactsOpen(false);
    setWriterPhotos(geckoPhotos.slice(0, 1));
    setPlatforms(DEFAULT_PLATFORMS);
    setHookSuggestions([]);
    setThreadSegments([]);
    setPickedImages([]);
    setScheduleAt('');
    // Default the post type from what the gecko is up to.
    const status = (gecko?.status || '').toLowerCase();
    if (/sale|available/.test(status)) setTemplate('available');
    else if (gecko?.hatch_date && Date.now() - new Date(gecko.hatch_date).getTime() < 60 * 86400000) setTemplate('hatchling');
    else setTemplate(DEFAULT_TEMPLATE);
  }, [open, gecko?.id]);

  // Load the gecko's records and turn them into facts the writer can
  // use. Failures just mean fewer facts; the composer still works.
  useEffect(() => {
    if (!open || !gecko?.id) return;
    let cancelled = false;
    (async () => {
      const safe = async (p) => {
        try {
          const { data } = await p;
          return data || [];
        } catch {
          return [];
        }
      };
      const parentIds = [gecko.sire_id, gecko.dam_id].filter(Boolean);
      const [weights, events, sheds, parents] = await Promise.all([
        safe(supabase.from('weight_records').select('weight_grams, record_date')
          .eq('gecko_id', gecko.id).order('record_date', { ascending: false }).limit(40)),
        safe(supabase.from('gecko_events').select('event_type, custom_event_name, event_date, notes')
          .eq('gecko_id', gecko.id).order('event_date', { ascending: false }).limit(40)),
        safe(supabase.from('shed_records').select('date, quality, notes')
          .eq('animal_id', gecko.id).order('date', { ascending: false }).limit(10)),
        parentIds.length
          ? safe(supabase.from('geckos').select('id, name, morphs_traits').in('id', parentIds))
          : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setFacts(buildGeckoFacts({
        gecko,
        weights,
        events,
        sheds,
        sire: parents.find((p) => p.id === gecko.sire_id) || null,
        dam: parents.find((p) => p.id === gecko.dam_id) || null,
      }));
    })();
    return () => { cancelled = true; };
  }, [open, gecko]);

  // Load the user's saved writing samples when the composer opens.
  useEffect(() => {
    if (!open || !user?.auth_user_id) return;
    (async () => {
      try {
        const rows = await UserBrandVoice.filter({ user_id: user.auth_user_id });
        setCustomVoices(rows || []);
        const def = (rows || []).find((r) => r.is_default);
        if (def) setSelectedCustomVoiceId(def.id);
      } catch (e) {
        console.warn('custom voices load failed', e);
      }
    })();
  }, [open, user?.auth_user_id]);

  const selectedCustomVoice = useMemo(
    () => customVoices.find((v) => v.id === selectedCustomVoiceId) || null,
    [customVoices, selectedCustomVoiceId],
  );

  const remainingIterations = ITERATION_CAP - iterations;
  const primaryPlatform = useMemo(() => pickPrimaryPlatform(platforms), [platforms]);
  const aiTells = useMemo(() => findAiTells(editedContent), [editedContent]);
  const activeVariant = variants[activeIdx] || null;

  const togglePlatform = (key) => {
    setPlatforms((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((p) => p !== key);
        return next.length === 0 ? prev : next; // never let it go empty
      }
      return [...prev, key];
    });
  };

  const toggleWriterPhoto = (url) => {
    setWriterPhotos((prev) => {
      if (prev.includes(url)) return prev.filter((u) => u !== url);
      return [...prev, url].slice(-MAX_WRITER_PHOTOS);
    });
  };

  // Load a draft into the editor.
  const pickVariant = (idx) => {
    const v = variants[idx];
    if (!v) return;
    setActiveIdx(idx);
    setEditedContent(draftText(v));
    setEditedHashtags((v.hashtags || []).join(' '));
    setUndoContent(null);
    setHookSuggestions([]);
    setThreadSegments([]);
  };

  // Set of currently-included hashtags (normalized, no # prefix) so the
  // chip buttons can render an active state.
  const activeHashtagSet = useMemo(() => {
    return new Set(
      editedHashtags
        .split(/\s+/)
        .map(normalizeHashtag)
        .filter(Boolean),
    );
  }, [editedHashtags]);

  const toggleHashtag = (tag) => {
    const norm = normalizeHashtag(tag);
    if (!norm) return;
    const tokens = editedHashtags.split(/\s+/).filter(Boolean);
    const has = tokens.some((t) => normalizeHashtag(t) === norm);
    const next = has
      ? tokens.filter((t) => normalizeHashtag(t) !== norm)
      : [...tokens, `#${norm}`];
    setEditedHashtags(next.join(' '));
  };

  // Everything the writer needs about this gecko, shared by every call.
  const writerPayload = () => ({
    voice_preset: voicePreset,
    voice_custom: selectedCustomVoice?.voice_text || null,
    platforms: [primaryPlatform, ...platforms.filter((p) => p !== primaryPlatform)],
    template,
    length_pref: lengthPref,
    moment: moment.trim() || null,
    facts,
    photo_urls: writerPhotos,
    gecko: {
      id: gecko.id,
      name: gecko.name || null,
      morph: gecko.morphs_traits || null,
      sex: gecko.sex || null,
      hatch_date: gecko.hatch_date || null,
      weight_g: gecko.weight_grams ?? null,
      sale_status: gecko.status || null,
      notes: gecko.notes || null,
      sire: gecko.sire_name ? { name: gecko.sire_name, morph: null } : null,
      dam: gecko.dam_name ? { name: gecko.dam_name, morph: null } : null,
      recent_changes: facts.recent,
    },
  });

  // Calls generate-social-post and returns its data, or null after
  // showing a readable error.
  const callWriter = async (extra) => {
    const { data, error: fnErr } = await supabase.functions.invoke('generate-social-post', {
      body: { ...writerPayload(), ...extra },
    });
    if (fnErr) {
      let code = null;
      try {
        const ctx = fnErr.context;
        if (ctx && typeof ctx.json === 'function') code = (await ctx.json())?.error;
      } catch { /* ignore */ }
      if (code === 'iteration_cap_reached') setIterations(ITERATION_CAP);
      setError(generationErrorMessage(code));
      return null;
    }
    if (data?.error) {
      if (data.error === 'iteration_cap_reached') setIterations(ITERATION_CAP);
      setError(generationErrorMessage(data.error));
      return null;
    }
    if (data?.iteration_count) setIterations(data.iteration_count);
    return data;
  };

  const handleGenerate = async (kind = 'generate') => {
    if (!gecko) return;
    if (remainingIterations <= 0) {
      setError(generationErrorMessage('iteration_cap_reached'));
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      let postId = draft?.id;
      if (!postId) {
        const created = await SocialPost.create({
          // auth_user_id is the real auth.users uuid; user.id is the
          // legacy profile id, which RLS will reject. See AuthContext.
          created_by_user_id: user.auth_user_id,
          created_by_email: user.email,
          gecko_id: gecko.id,
          template,
          voice_preset: voicePreset,
          length_pref: lengthPref,
          starting_point: moment.trim() || null,
          status: 'draft',
        });
        setDraft(created);
        postId = created.id;
      }
      const data = await callWriter({
        post_id: postId,
        kind,
        variant_count: 3,
        previous_variants: kind === 'generate' ? [] : variants.map((v) => ({ content: draftText(v) })),
      });
      if (!data) return;
      const next = data.variants || [];
      setVariants(next);
      setActiveIdx(0);
      setEditedContent(draftText(next[0]));
      setEditedHashtags((next[0]?.hashtags || []).join(' '));
      setUndoContent(null);
      setHookSuggestions([]);
      setThreadSegments([]);
    } catch (e) {
      console.warn('generate failed', e);
      setError(generationErrorMessage(null));
    } finally {
      setGenerating(false);
    }
  };

  // One-tap revision of whatever is in the editor right now, including
  // the keeper's own edits.
  const handleTweak = async (key) => {
    if (!draft || !editedContent.trim()) return;
    if (remainingIterations <= 0) {
      setError(generationErrorMessage('iteration_cap_reached'));
      return;
    }
    setTweaking(key);
    setError(null);
    try {
      const data = await callWriter({
        post_id: draft.id,
        kind: 'tweak',
        tweak: key,
        current_text: editedContent,
      });
      const v = data?.variants?.[0];
      if (!v) return;
      setUndoContent(editedContent);
      setEditedContent(draftText(v));
      if (v.hashtags?.length) setEditedHashtags(v.hashtags.join(' '));
    } catch (e) {
      console.warn('tweak failed', e);
      setError(generationErrorMessage(null));
    } finally {
      setTweaking(null);
    }
  };

  // Five alternative opening lines for the current draft. Picking one
  // swaps out the first paragraph.
  const handleRewriteHooks = async () => {
    if (!editedContent.trim() || !draft) return;
    if (remainingIterations <= 0) {
      setError(generationErrorMessage('iteration_cap_reached'));
      return;
    }
    setRewritingHooks(true);
    setError(null);
    try {
      const data = await callWriter({
        post_id: draft.id,
        kind: 'hook_rewrite',
        variant_count: 5,
        current_text: editedContent,
        previous_variants: [{ content: editedContent }],
      });
      if (!data) return;
      setHookSuggestions((data.variants || []).map((v) => v.hook).filter(Boolean));
    } catch (e) {
      console.warn('hook rewrite failed', e);
      setError(generationErrorMessage(null));
    } finally {
      setRewritingHooks(false);
    }
  };

  // Replace the opening paragraph with the chosen line. "Everything up
  // to the first blank line" counts as the current opening.
  const applyHook = (hook) => {
    if (!hook) return;
    const trimmed = editedContent.trim();
    const splitAt = trimmed.indexOf('\n\n');
    const body = splitAt === -1 ? '' : trimmed.slice(splitAt).trimStart();
    setUndoContent(editedContent);
    setEditedContent(body ? `${hook}\n\n${body}` : hook);
    setHookSuggestions([]);
  };

  // Save the keeper's writing samples to user_brand_voice.
  const handleSaveVoice = async () => {
    if (!newVoiceName.trim() || !newVoiceText.trim()) return;
    setSavingVoice(true);
    try {
      const created = await UserBrandVoice.create({
        user_id: user.auth_user_id,
        name: newVoiceName.trim(),
        voice_text: newVoiceText.trim(),
        is_default: customVoices.length === 0, // first one becomes default
      });
      setCustomVoices((prev) => [...prev, created]);
      setSelectedCustomVoiceId(created.id);
      setNewVoiceName('');
      setNewVoiceText('');
      setShowNewVoiceForm(false);
    } catch (e) {
      console.warn('save voice failed', e);
      setError('Could not save your writing sample. Try again.');
    } finally {
      setSavingVoice(false);
    }
  };

  const handleDeleteVoice = async (id) => {
    if (!confirm('Delete this writing sample?')) return;
    try {
      await UserBrandVoice.delete(id);
      setCustomVoices((prev) => prev.filter((v) => v.id !== id));
      if (selectedCustomVoiceId === id) setSelectedCustomVoiceId(null);
    } catch (e) {
      console.warn('delete voice failed', e);
      setError('Could not delete that writing sample. Try again.');
    }
  };

  // Client-side splitter. Walks the caption, packs sentences into
  // segments that fit `limit`, and adds "1/N" markers. Good enough for
  // Bluesky / X threading; the user can refine each segment before
  // publishing. Auto-walking the thread on publish is a follow-up.
  const splitIntoThread = (text, limit) => {
    if (!text || !limit) return [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    const segments = [];
    let current = '';
    const markerWidth = 6; // " 9/9" worst-case
    const usableLimit = Math.max(60, limit - markerWidth);
    for (const s of sentences) {
      const candidate = current ? `${current} ${s}` : s;
      if (candidate.length <= usableLimit) {
        current = candidate;
      } else {
        if (current) segments.push(current);
        // Sentence itself is too long; hard-split.
        if (s.length > usableLimit) {
          let rest = s;
          while (rest.length > usableLimit) {
            segments.push(rest.slice(0, usableLimit));
            rest = rest.slice(usableLimit);
          }
          current = rest;
        } else {
          current = s;
        }
      }
    }
    if (current) segments.push(current);
    const total = segments.length;
    return segments.map((seg, i) => `${seg} ${i + 1}/${total}`);
  };

  // Find the most restrictive selected platform's char limit so the
  // split is conservative; users posting to multiple thread-friendly
  // platforms get one set of segments that fits everywhere.
  const splitTarget = useMemo(() => {
    const limited = platforms
      .map((p) => ({ key: p, limit: PLATFORM_CHAR_LIMITS[p] }))
      .filter((x) => x.limit != null)
      .sort((a, b) => a.limit - b.limit);
    return limited[0] || null;
  }, [platforms]);

  const handleSplitThread = () => {
    if (!splitTarget) return;
    const segs = splitIntoThread(editedContent, splitTarget.limit);
    setThreadSegments(segs);
  };

  // Create a public waitlist for this gecko and inject its URL into
  // the caption. Slug is 8 url-safe chars; we retry a couple of times
  // on collision before giving up (uniqueness is enforced by the DB).
  const handleCreateWaitlist = async () => {
    if (!gecko) return;
    if (!canUseFeature(user, 'waitlists')) {
      toast({
        title: 'Waitlists are part of the Breeder plan',
        description: 'Upgrade on the Membership page to share waitlist links and track deposits.',
      });
      return;
    }
    const makeSlug = () => Math.random().toString(36).slice(2, 10);
    const title = gecko.name
      ? `Waitlist: ${gecko.name}`
      : `Waitlist: ${gecko.morphs_traits || 'crested gecko'}`;
    let row = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        row = await GeckoWaitlist.create({
          breeder_user_id: user.auth_user_id,
          gecko_id: gecko.id,
          slug: makeSlug(),
          title,
          description: editedContent || '',
          is_open: true,
        });
        break;
      } catch (e) {
        lastErr = e;
        if (!String(e?.message || '').toLowerCase().includes('duplicate')) break;
      }
    }
    if (!row) {
      setError(`Waitlist create failed: ${lastErr?.message || 'unknown'}`);
      return;
    }
    const url = `${window.location.origin}/waitlist/${row.slug}`;
    setEditedContent((prev) => `${prev.trim()}\n\nJoin the waitlist: ${url}`.trim());
    toast({
      title: 'Waitlist link created',
      description: 'Added to the caption. Signups show in Business Tools under Waitlists, and you get a notification for each.',
    });
  };

  // Generate a MorphMarket-formatted CSV row for this gecko + caption,
  // trigger a browser download, and open MorphMarket's bulk-import
  // page in a new tab so the user can drop the file in. MorphMarket
  // has no write API; this CSV/import flow is the closest thing they
  // expose (see the research notes from May 2026).
  const handleExportMorphMarketCsv = () => {
    if (!gecko) return;
    const tags = editedHashtags.split(/\s+/).map((t) => t.trim()).filter(Boolean);
    const csv = buildMorphMarketCsvRow({
      gecko,
      captionBody: editedContent,
      hashtags: tags,
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `morphmarket-${gecko.name || gecko.id}.csv`.replace(/\s+/g, '-').toLowerCase();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.open('https://www.morphmarket.com/us/c/all/animals?manage=1', '_blank', 'noopener,noreferrer');
    toast({
      title: 'MorphMarket CSV downloaded',
      description: 'Drop the file on the Bulk Import page (we just opened it). Re-importing the same Animal ID updates the listing.',
    });
  };

  // One composed string per selected platform, factoring user edits.
  // composePlatformText handles per-platform hashtag placement (Reddit
  // strips them; Instagram puts them in a trailing block; everywhere
  // else they land inline). The character counter uses the result of
  // that composition so the user sees the same string the API will get.
  const previewByPlatform = useMemo(() => {
    const tags = editedHashtags
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return platforms.map((p) => {
      const text = composePlatformText({
        content: editedContent,
        hashtags: tags,
        platform: p,
      });
      const limit = PLATFORM_CHAR_LIMITS[p] ?? null;
      return {
        platform: p,
        text,
        charCount: text.length,
        limit,
        exceeds: limit != null && text.length > limit,
      };
    });
  }, [editedContent, editedHashtags, platforms]);

  const handleCopy = async () => {
    // For multi-platform copy, join previews with a divider so the user
    // can paste each into the right composer. Most users copy from a
    // single platform's preview block instead, but this keeps the toolbar
    // button useful when only one is selected.
    const blob = previewByPlatform.length === 1
      ? previewByPlatform[0].text
      : previewByPlatform.map((p) => `--- ${platformLabel(p.platform)} ---\n${p.text}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(blob);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      // Deep-link only makes sense for a single platform.
      if (previewByPlatform.length === 1) {
        const { platform: p, text } = previewByPlatform[0];
        const url = platformDeepLink(p, text);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      toast({ title: 'Copy failed', description: 'Select the text manually and copy.' });
    }
  };

  // If the user picked a future date, save the post as 'scheduled'
  // instead of publishing now. The cron worker picks up due rows and
  // calls publish-social-post for each platform.
  const handleSchedule = async () => {
    if (!draft || !scheduleAt) return;
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when <= new Date()) {
      setError('Pick a future date and time.');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const tags = editedHashtags.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      const cta = variants[activeIdx]?.cta || null;
      const imageIds = pickedImages.map((p) => p.id);

      // Create one variant per selected platform up-front. The cron
      // worker will call publish-social-post against the first one;
      // we set primary_variant_id so it knows which to use.
      let primaryId = null;
      for (const p of platforms) {
        const v = await SocialPostVariant.create({
          post_id: draft.id,
          platform: p,
          content: editedContent,
          hashtags: tags,
          cta,
          image_ids: imageIds,
          status: 'draft',
        });
        if (!primaryId) primaryId = v.id;
      }

      await SocialPost.update(draft.id, {
        status: 'scheduled',
        scheduled_at: when.toISOString(),
        primary_variant_id: primaryId,
      });

      toast({
        title: 'Scheduled',
        description: `Will publish to ${platforms.length} platform${platforms.length === 1 ? '' : 's'} at ${when.toLocaleString()}.`,
      });
      onPublished?.();
      onOpenChange(false);
    } catch (e) {
      setError(`Schedule failed: ${e?.message || e}`);
    } finally {
      setPublishing(false);
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    if (scheduleAt) {
      return handleSchedule();
    }
    setPublishing(true);
    setError(null);

    try {
      const tags = editedHashtags.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      const cta = variants[activeIdx]?.cta || null;
      const imageIds = pickedImages.map((p) => p.id);

      // Create one variant per selected platform, then publish each.
      // Failures are collected per-platform so the user can see which
      // posts went out and which need attention.
      const results = [];
      for (const p of platforms) {
        let variantId = null;
        try {
          const variant = await SocialPostVariant.create({
            post_id: draft.id,
            platform: p,
            content: editedContent,
            hashtags: tags,
            cta,
            image_ids: imageIds,
            status: 'draft',
          });
          variantId = variant.id;

          const { data, error: fnErr } = await supabase.functions.invoke('publish-social-post', {
            body: { variant_id: variantId },
          });

          if (fnErr) {
            const ctx = fnErr.context;
            let parsed = null;
            try {
              if (ctx && typeof ctx.text === 'function') {
                const txt = await ctx.text();
                parsed = JSON.parse(txt);
              }
            } catch { /* ignore */ }
            if (parsed?.error === 'payment_method_required') {
              onPaymentRequired?.();
              setPublishing(false);
              return;
            }
            results.push({ platform: p, ok: false, error: publishErrorMessage(parsed?.error, parsed?.detail) });
            continue;
          }
          if (data?.error === 'payment_method_required') {
            onPaymentRequired?.();
            setPublishing(false);
            return;
          }
          if (data?.error) {
            results.push({ platform: p, ok: false, error: publishErrorMessage(data.error, data.detail) });
            continue;
          }

          results.push({
            platform: p,
            ok: true,
            status: data?.status,
            url: data?.platform_post_url || null,
            charged: data?.charged || null,
          });

          // For clipboard-mode platforms, deep-link the user into the
          // platform's compose page with their text on the clipboard.
          // Only viable for one platform per click; we open the LAST
          // clipboard-mode result so the user lands somewhere useful.
          if (data?.status === 'copied') {
            const preview = previewByPlatform.find((pv) => pv.platform === p);
            if (preview) {
              try { await navigator.clipboard.writeText(preview.text); } catch { /* ignore */ }
              const dl = platformDeepLink(p, preview.text);
              if (dl) window.open(dl, '_blank', 'noopener,noreferrer');
            }
          }
        } catch (e) {
          console.warn('publish failed', e);
          results.push({ platform: p, ok: false, error: publishErrorMessage(null, null) });
        }
      }

      const successes = results.filter((r) => r.ok);
      const failures = results.filter((r) => !r.ok);

      if (successes.length > 0) {
        const posted = successes.filter((r) => r.status === 'published');
        const copiedOut = successes.filter((r) => r.status !== 'published');
        const parts = [];
        if (posted.length > 0) {
          parts.push(`Posted to ${posted.map((r) => `${platformLabel(r.platform)}${r.url ? ` (${r.url})` : ''}`).join(', ')}.`);
        }
        if (copiedOut.length > 0) {
          parts.push(`Copied for ${copiedOut.map((r) => platformLabel(r.platform)).join(', ')}. Paste it in to post. Copies are free.`);
        }
        toast({
          title: failures.length === 0
            ? (posted.length > 0 ? 'Posted' : 'Copied')
            : `${successes.length} of ${results.length} done`,
          description: parts.join(' '),
        });
      }

      if (failures.length > 0) {
        setError(
          failures
            .map((r) => `${platformLabel(r.platform)}: ${r.error}`)
            .join('\n')
        );
      }

      if (failures.length === 0) {
        onPublished?.();
        onOpenChange(false);
      } else if (successes.length > 0) {
        // Partial success: refresh parent counters but keep modal open
        // so the user can retry the failed platforms.
        onPublished?.();
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setPublishing(false);
    }
  };

  const momentPlaceholder = MOMENT_PROMPTS[template] || MOMENT_PROMPTS.meet;
  const factCount = facts.profile.length + facts.recent.length;
  const geckoName = gecko?.name || 'this gecko';
  const sectionLabel = 'text-xs uppercase tracking-wider text-emerald-300 mb-1.5 block';
  const chip = (active) => `touch:min-h-11 text-xs px-2.5 py-1 rounded-full border transition-colors ${
    active
      ? 'bg-emerald-600/40 border-emerald-500/60 text-emerald-50'
      : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200/80 hover:bg-emerald-900/40 hover:text-emerald-100'
  }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[100vw] sm:w-auto max-h-[100vh] sm:max-h-[90vh] h-[100vh] sm:h-auto sm:rounded-lg rounded-none overflow-y-auto p-3 sm:p-6 pb-24 sm:pb-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Post about {gecko?.name || 'your gecko'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* 1. What kind of post */}
          <div>
            <Label className={sectionLabel}>What kind of post?</Label>
            <div className="flex flex-wrap gap-1.5">
              {POST_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplate(t.key)}
                  title={t.blurb}
                  className={chip(template === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. The keeper's own words. This is what keeps posts from
              sounding generic, so it gets the most room. */}
          <div>
            <Label htmlFor="promote-moment" className={sectionLabel}>
              What's going on with {geckoName}?
            </Label>
            <Textarea
              id="promote-moment"
              value={moment}
              onChange={(e) => setMoment(e.target.value)}
              placeholder={momentPlaceholder}
              rows={3}
              className="text-sm"
            />
            <p className="text-[11px] text-emerald-200/60 mt-1">
              A sentence or two in your own words is plenty. The drafts are built around it, and nothing gets made up to fill gaps.
            </p>

            {factCount > 0 && (
              <div className="mt-2 rounded-md border border-emerald-800/40 bg-emerald-950/30">
                <button
                  type="button"
                  onClick={() => setFactsOpen((o) => !o)}
                  className="touch:min-h-11 w-full flex items-center justify-between px-3 py-2 text-xs text-emerald-200/80 hover:text-emerald-100"
                >
                  <span>
                    Also using {factCount} detail{factCount === 1 ? '' : 's'} from {geckoName}'s records
                    {facts.recent.length > 0 && `, including ${facts.recent.length} recent`}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${factsOpen ? 'rotate-180' : ''}`} />
                </button>
                {factsOpen && (
                  <ul className="px-3 pb-2 space-y-0.5 text-[11px] text-emerald-100/80 list-disc list-inside">
                    {[...facts.recent, ...facts.profile].map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                    <li className="list-none text-emerald-300/60 pt-1">
                      Something wrong here? Fix it in My Geckos and it is fixed everywhere.
                    </li>
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* 3. Photos the writer looks at */}
          {geckoPhotos.length > 0 && (
            <div>
              <Label className={sectionLabel}>Photos to describe</Label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {geckoPhotos.map((url) => {
                  const on = writerPhotos.includes(url);
                  return (
                    <button
                      key={url}
                      type="button"
                      onClick={() => toggleWriterPhoto(url)}
                      aria-pressed={on}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                        on ? 'border-emerald-400' : 'border-transparent opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {on && (
                        <span className="absolute top-0.5 right-0.5 rounded-full bg-emerald-500 p-0.5">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-emerald-200/60 mt-1">
                Pick up to {MAX_WRITER_PHOTOS}. The writer looks at them so it can mention what is really in the shot, like fired up or a clean pinstripe.
              </p>
            </div>
          )}

          {/* 4. Where and how */}
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3 space-y-3">
            <div>
              <Label className={sectionLabel}>Where are you posting?</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {PLATFORMS.map((p) => {
                  const checked = platforms.includes(p.key);
                  return (
                    <label
                      key={p.key}
                      title={p.hint}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                        checked
                          ? 'bg-emerald-800/40 border border-emerald-600/50'
                          : 'border border-transparent hover:bg-emerald-900/30'
                      }`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => togglePlatform(p.key)} />
                      <span className="text-sm text-emerald-100 truncate">{p.label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-emerald-200/60 mt-1">
                {platforms.length > 1
                  ? `Written to fit ${platformLabel(primaryPlatform)}, the strictest one you picked, so it works everywhere. `
                  : ''}
                Bluesky can post for you. Everything else copies the text and opens the app, and copies are free.
              </p>
            </div>

            <div>
              <Label className={sectionLabel}>Voice</Label>
              <div className="flex flex-wrap gap-1.5">
                {VOICE_PRESETS.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setVoicePreset(v.key)}
                    title={v.blurb}
                    className={chip(voicePreset === v.key && !selectedCustomVoice)}
                  >
                    {v.label}
                  </button>
                ))}
                {customVoices.map((v) => {
                  const active = v.id === selectedCustomVoiceId;
                  return (
                    <span key={v.id} className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomVoiceId(active ? null : v.id)}
                        className={`${chip(active)} rounded-r-none`}
                        title="Your own writing. The drafts copy its rhythm."
                      >
                        {v.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVoice(v.id)}
                        aria-label={`Delete ${v.name}`}
                        className="touch:min-h-11 touch:min-w-11 text-xs px-1.5 py-1 rounded-r-full border border-l-0 border-emerald-800/50 bg-emerald-950/40 text-emerald-300/60 hover:text-red-300"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowNewVoiceForm((s) => !s)}
                  className="touch:min-h-11 text-xs px-2.5 py-1 rounded-full border border-dashed border-emerald-700/60 text-emerald-300/80 hover:text-emerald-100"
                >
                  {showNewVoiceForm ? 'Cancel' : '+ Sound like me'}
                </button>
              </div>
              <p className="text-[11px] text-emerald-200/60 mt-1">
                {selectedCustomVoice
                  ? `Copying the rhythm of "${selectedCustomVoice.name}". Tap it again to use a preset instead.`
                  : VOICE_PRESETS.find((v) => v.key === voicePreset)?.blurb}
              </p>

              {showNewVoiceForm && (
                <div className="mt-2 space-y-2 rounded-md bg-emerald-950/50 border border-emerald-800/40 p-2">
                  <Input
                    value={newVoiceName}
                    onChange={(e) => setNewVoiceName(e.target.value)}
                    placeholder="Name it (e.g. My Instagram)"
                    className="text-sm"
                  />
                  <Textarea
                    value={newVoiceText}
                    onChange={(e) => setNewVoiceText(e.target.value)}
                    placeholder="Paste 3 to 10 captions you wrote yourself, one after another. The drafts will copy how you write: sentence length, emoji habits, the words you use. Not what you said."
                    rows={6}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveVoice}
                    disabled={savingVoice || !newVoiceName.trim() || !newVoiceText.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    {savingVoice ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving…</> : 'Save'}
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label className={sectionLabel}>Length</Label>
              <div className="flex gap-1.5">
                {[['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setLengthPref(k)} className={chip(lengthPref === k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate / drafts */}
          {variants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Button
                onClick={() => handleGenerate('generate')}
                disabled={generating}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Writing…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Write 3 drafts</>
                )}
              </Button>
              <p className="text-xs text-emerald-200/60 mt-2 max-w-sm">
                {moment.trim()
                  ? 'Three different takes. Pick one and make it yours.'
                  : `Tip: a line about what's going on with ${geckoName} makes the drafts much better.`}
              </p>
            </div>
          ) : (
            <>
              {/* Drafts, each a different approach */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs uppercase tracking-wider text-emerald-300">Pick a draft</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-300/60">
                      {remainingIterations} {remainingIterations === 1 ? 'try' : 'tries'} left
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerate('regenerate')}
                      disabled={generating || remainingIterations <= 0}
                      className="text-xs"
                    >
                      {generating
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                      3 new drafts
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {variants.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pickVariant(i)}
                      className={`text-left rounded-lg border p-2.5 transition-colors ${
                        i === activeIdx
                          ? 'border-emerald-400 bg-emerald-900/40'
                          : 'border-emerald-800/40 bg-emerald-950/30 hover:border-emerald-600/60'
                      }`}
                    >
                      <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-1">
                        {v.approach || `Draft ${i + 1}`}
                      </div>
                      <div className="text-xs text-emerald-100 whitespace-pre-wrap line-clamp-6">
                        {draftText(v)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {activeVariant?.check_before_posting?.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-amber-700/40 bg-amber-950/20 p-2.5 text-xs text-amber-100">
                  <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-300" />
                  <div>
                    <div className="font-medium mb-0.5">Before you post</div>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-100/90">
                      {activeVariant.check_before_posting.map((c) => <li key={c}>{c}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              {/* Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="promote-caption" className="text-xs uppercase tracking-wider text-emerald-300">
                    Your post
                  </Label>
                  {undoContent != null && (
                    <button
                      type="button"
                      onClick={() => { setEditedContent(undoContent); setUndoContent(null); }}
                      className="touch:min-h-11 inline-flex items-center gap-1 text-[11px] text-emerald-300/80 hover:text-emerald-100"
                    >
                      <Undo2 className="w-3 h-3" /> Undo
                    </button>
                  )}
                </div>
                <Textarea
                  id="promote-caption"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={8}
                  className="text-sm leading-relaxed"
                />

                {aiTells.length > 0 && (
                  <div className="mt-2 rounded-md border border-amber-700/40 bg-amber-950/20 p-2.5">
                    <div className="text-[11px] font-medium text-amber-200 mb-1">
                      Might read as AI-written
                    </div>
                    <ul className="space-y-1">
                      {aiTells.map((t) => (
                        <li key={t.label} className="text-[11px] text-amber-100/90">
                          <span className="font-mono text-amber-200">"{t.match.slice(0, 40)}"</span>
                          {' '}{t.why}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* One-tap revisions */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TWEAKS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleTweak(t.key)}
                      disabled={!!tweaking || generating || remainingIterations <= 0 || !editedContent.trim()
                        || (t.key === 'more_me' && !selectedCustomVoice && !moment.trim())}
                      title={t.key === 'more_me' && !selectedCustomVoice && !moment.trim()
                        ? 'Add your own writing under Voice, or a line about what is going on, first'
                        : undefined}
                      className={`${chip(false)} disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      {tweaking === t.key && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}
                      {t.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleRewriteHooks}
                    disabled={rewritingHooks || !!tweaking || remainingIterations <= 0 || !editedContent.trim()}
                    className={`${chip(false)} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {rewritingHooks && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}
                    New opening line
                  </button>
                </div>

                {hookSuggestions.length > 0 && (
                  <div className="mt-2 rounded-lg border border-emerald-700/50 bg-emerald-900/30 p-2 space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300 flex items-center justify-between">
                      Pick an opening line
                      <button
                        type="button"
                        onClick={() => setHookSuggestions([])}
                        className="touch:min-h-11 text-emerald-400/70 hover:text-emerald-200 text-[10px]"
                      >
                        dismiss
                      </button>
                    </div>
                    {hookSuggestions.map((h, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applyHook(h)}
                        className="touch:min-h-11 block w-full text-left text-xs text-emerald-100 rounded bg-emerald-950/50 hover:bg-emerald-800/40 border border-emerald-800/40 hover:border-emerald-600/60 px-2 py-1.5 transition-colors"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                )}

                <Label htmlFor="promote-hashtags" className="text-xs uppercase tracking-wider text-emerald-300 mb-1 mt-4 block">
                  Hashtags
                </Label>
                <Input
                  id="promote-hashtags"
                  value={editedHashtags}
                  onChange={(e) => setEditedHashtags(e.target.value)}
                  placeholder="#crestedgecko #lillywhite"
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => setHashtagsOpen((o) => !o)}
                  className="touch:min-h-11 mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-300/80 hover:text-emerald-100"
                >
                  Browse crestie hashtags
                  <ChevronDown className={`w-3 h-3 transition-transform ${hashtagsOpen ? 'rotate-180' : ''}`} />
                </button>

                {hashtagsOpen && (
                  <div className="mt-2 space-y-2">
                    {HASHTAG_LIBRARY.map((group) => (
                      <div key={group.key}>
                        <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-1">
                          {group.label}
                          <span className="text-emerald-400/40 normal-case tracking-normal ml-2">
                            {group.blurb}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleHashtag(tag)}
                              className={chip(activeHashtagSet.has(normalizeHashtag(tag)))}
                            >
                              #{tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Per-platform previews, one card each. Same caption,
                  per-platform hashtag handling + char counter. */}
              <div className="space-y-2">
                {previewByPlatform.map((p) => (
                  <div
                    key={p.platform}
                    className="rounded-lg border border-emerald-800/30 bg-emerald-950/40 p-3"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-1">
                      Preview, {platformLabel(p.platform)}
                    </div>
                    <div className="text-sm text-emerald-100 whitespace-pre-wrap">
                      {p.text}
                    </div>
                    <div className="text-xs text-emerald-200/50 mt-2">
                      {p.charCount} characters
                      {p.limit != null && (
                        <span className={p.exceeds ? 'text-amber-300 ml-2' : 'ml-2'}>
                          {p.exceeds
                            ? `${platformLabel(p.platform)} limit is ${p.limit}; will be truncated on publish.`
                            : `(${platformLabel(p.platform)} limit ${p.limit})`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Split-into-thread tool. Available when any of the
                  selected platforms has a hard char limit (Bluesky 300,
                  X 280, Threads 500) and the current caption blows
                  past it. Output is a numbered list of segments the
                  user can copy/edit one at a time. Auto-walking the
                  thread on publish is a follow-up. */}
              {splitTarget && previewByPlatform.some((p) => p.exceeds) && (
                <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-amber-200">
                      Caption is over the {platformLabel(splitTarget.key)} {splitTarget.limit}-char limit. Want to split into a thread?
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSplitThread}
                      className="text-xs"
                    >
                      Split into thread
                    </Button>
                  </div>
                  {threadSegments.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {threadSegments.map((seg, i) => (
                        <div
                          key={i}
                          className="text-xs text-emerald-100 rounded bg-emerald-950/50 border border-emerald-800/40 p-2 whitespace-pre-wrap"
                        >
                          {seg}
                          <div className="text-[10px] text-emerald-300/60 mt-1">
                            {seg.length} chars
                          </div>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(threadSegments.join('\n\n---\n\n'));
                            toast({ title: `Copied ${threadSegments.length}-segment thread to clipboard.` });
                          } catch {
                            toast({ title: 'Copy failed' });
                          }
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy all segments
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Image picker row + schedule input. The picker opens
                  the PromoteImageGallery in 'picker' mode; the schedule
                  input flips Publish into Schedule when set. */}
              <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setGalleryOpen(true)}
                    type="button"
                  >
                    <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                    {pickedImages.length === 0
                      ? 'Pick images'
                      : `${pickedImages.length} image${pickedImages.length === 1 ? '' : 's'} selected`}
                  </Button>
                  {pickedImages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickedImages([])}
                      className="touch:min-h-11 text-[11px] text-emerald-300/60 hover:text-emerald-100"
                    >
                      Clear
                    </button>
                  )}
                  {/* Scheduling is hidden: the job that publishes scheduled posts
                      (promote_drain_scheduled) has been off since 9 Sep and
                      would post only one platform, so a scheduled post never
                      went out. Flip SCHEDULING_ENABLED once the job works. */}
                  {SCHEDULING_ENABLED && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Calendar className="w-3.5 h-3.5 text-emerald-300/70" />
                    <Input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                      className="text-xs h-8 w-auto"
                      title={`Schedule (up to ${tierLimitsFn.scheduledPostsMax} active)`}
                    />
                    {scheduleAt && (
                      <button
                        type="button"
                        onClick={() => setScheduleAt('')}
                        className="touch:min-h-11 text-[11px] text-emerald-300/60 hover:text-emerald-100"
                      >
                        clear
                      </button>
                    )}
                  </div>
                  )}
                </div>
                {pickedImages.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {pickedImages.map((img) => (
                      <div
                        key={img.id}
                        className="flex-shrink-0 w-12 h-12 rounded border border-emerald-800/40 overflow-hidden"
                      >
                        <img
                          src={img.public_url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons. On mobile, pin to the bottom of the
                  viewport so Publish is always reachable without
                  scrolling through hashtag chips + previews. */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-900/40 sm:static fixed bottom-0 inset-x-0 sm:bg-transparent bg-emerald-950/95 sm:backdrop-blur-none backdrop-blur-md sm:p-0 p-3 sm:border-t-emerald-900/40 border-t-emerald-700/60 z-10">
                <Button
                  variant="outline"
                  onClick={handleCopy}
                  className="flex-1 sm:flex-initial"
                >
                  {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                  Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCreateWaitlist}
                  className="hidden sm:inline-flex"
                  title={canUseFeature(user, 'waitlists')
                    ? 'Create a public waitlist link for this gecko and append it to the caption'
                    : 'Waitlists are part of the Breeder plan'}
                >
                  + Waitlist
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportMorphMarketCsv}
                  className="hidden sm:inline-flex"
                  title="Generate MorphMarket Bulk Import CSV and open their import page"
                >
                  MorphMarket CSV
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 ml-auto flex-1 sm:flex-initial"
                  onClick={handlePublish}
                  disabled={publishing || !editedContent.trim()}
                >
                  {publishing ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> {scheduleAt ? 'Scheduling…' : 'Publishing…'}</>
                  ) : scheduleAt ? (
                    <>
                      <Calendar className="w-4 h-4 mr-1.5" />
                      Schedule ×{platforms.length}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1.5" />
                      {platforms.length === 1
                        ? (isDirectPlatform(platforms[0])
                            ? `Publish to ${platformLabel(platforms[0])}`
                            : 'Copy + open compose')
                        : platforms.some(isDirectPlatform)
                          ? `Publish ×${platforms.length}`
                          : `Copy ×${platforms.length}`}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-900/30 border border-red-700/40 p-3 text-sm text-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{error}</span>
            </div>
          )}
        </div>

        <PromoteImageGallery
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          user={user}
          mode="picker"
          initialSelectedIds={pickedImages.map((p) => p.id)}
          onPicked={(rows) => setPickedImages(rows)}
        />
      </DialogContent>
    </Dialog>
  );
}
