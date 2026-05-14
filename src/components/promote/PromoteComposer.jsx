import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sparkles, RefreshCw, ChevronLeft, ChevronRight, Copy, Send, Check,
  AlertCircle, Loader2,
} from 'lucide-react';
import {
  VOICE_PRESETS, POST_TEMPLATES, PLATFORMS, PLATFORM_CHAR_LIMITS,
  HASHTAG_LIBRARY, normalizeHashtag, buildMorphMarketCsvRow,
  composePlatformText, platformDeepLink, platformLabel, voiceLabel,
  pickPrimaryPlatform,
} from '@/lib/socialMedia';
import { supabase } from '@/lib/supabaseClient';
import { SocialPost, SocialPostVariant, UserBrandVoice, GeckoWaitlist } from '@/entities/all';
import { toast } from '@/components/ui/use-toast';

const DEFAULT_VOICE = 'pro_breeder';
const DEFAULT_TEMPLATE = 'meet';
const DEFAULT_PLATFORMS = ['bluesky'];
const DEFAULT_LENGTH = 'medium';
const ITERATION_CAP = 10;

// The composer ,  generation, edit, voice cycling, copy, publish.
//
// Lifecycle:
//   Open with a gecko -> create draft social_posts row -> user picks
//   template/voice/platform -> Generate -> 3 variants returned -> user
//   picks one -> can Regenerate / cycle voice / edit body / Copy / Publish.
//
// Iteration cap: hard-stops at 10 generations per draft. The button shows
// remaining count and disables at 0.
export default function PromoteComposer({
  open, onOpenChange, gecko, user, onPublished, onPaymentRequired,
}) {
  const [draft, setDraft] = useState(null);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [voicePreset, setVoicePreset] = useState(DEFAULT_VOICE);
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const [lengthPref, setLengthPref] = useState(DEFAULT_LENGTH);
  const [startingPoint, setStartingPoint] = useState('');
  const [variants, setVariants] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [iterations, setIterations] = useState(0);
  const [editedContent, setEditedContent] = useState('');
  const [editedHashtags, setEditedHashtags] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  // Custom voices (user_brand_voice). Loaded on open. A selected custom
  // voice overrides the preset for the next generation by sending its
  // voice_text as the `voice_custom` system-prompt addition.
  const [customVoices, setCustomVoices] = useState([]);
  const [selectedCustomVoiceId, setSelectedCustomVoiceId] = useState(null);
  const [showNewVoiceForm, setShowNewVoiceForm] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [newVoiceText, setNewVoiceText] = useState('');
  const [savingVoice, setSavingVoice] = useState(false);
  // Hook rewriter state: 5 alternative opening lines for the active
  // variant. Picking one rewrites just the first paragraph of the
  // edited content.
  const [hookSuggestions, setHookSuggestions] = useState([]);
  const [rewritingHooks, setRewritingHooks] = useState(false);
  // Inspiration library state. We pull the user's recent published
  // social_post_variants so they can click a past post as a style
  // anchor for the next generation. The selected anchor seeds the
  // `starting_point` prompt slot.
  const [inspirationPosts, setInspirationPosts] = useState([]);
  // Thread/carousel split state. When the body exceeds the active
  // platform's char limit we offer a client-side split into segments,
  // each ≤ the limit, with "1/N" markers. Server-free for now.
  const [threadSegments, setThreadSegments] = useState([]);

  // Reset on open / gecko change.
  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setVariants([]);
    setActiveIdx(0);
    setIterations(0);
    setEditedContent('');
    setEditedHashtags('');
    setError(null);
    setStartingPoint('');
    setPlatforms(DEFAULT_PLATFORMS);
    setHookSuggestions([]);
  }, [open, gecko?.id]);

  // Load the user's saved custom voices when the composer opens.
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

  // Load the user's most recent published variants as inspiration. We
  // pull from social_post_variants (status = 'published') and
  // dedupe-by-post so the picker shows distinct posts, not every
  // platform fan-out of the same draft.
  useEffect(() => {
    if (!open || !user?.auth_user_id) return;
    (async () => {
      try {
        const { data: postRows } = await supabase
          .from('social_posts')
          .select('id, template, primary_variant_id, published_at, gecko_id')
          .eq('created_by_user_id', user.auth_user_id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(5);
        if (!postRows || postRows.length === 0) {
          setInspirationPosts([]);
          return;
        }
        const variantIds = postRows.map((p) => p.primary_variant_id).filter(Boolean);
        if (variantIds.length === 0) {
          setInspirationPosts([]);
          return;
        }
        const { data: variantRows } = await supabase
          .from('social_post_variants')
          .select('id, post_id, platform, content')
          .in('id', variantIds);
        const variantById = new Map((variantRows || []).map((v) => [v.id, v]));
        setInspirationPosts(
          postRows
            .map((p) => ({
              post_id: p.id,
              template: p.template,
              published_at: p.published_at,
              variant: variantById.get(p.primary_variant_id),
            }))
            .filter((r) => r.variant),
        );
      } catch (e) {
        console.warn('inspiration load failed', e);
      }
    })();
  }, [open, user?.auth_user_id]);

  const selectedCustomVoice = useMemo(
    () => customVoices.find((v) => v.id === selectedCustomVoiceId) || null,
    [customVoices, selectedCustomVoiceId],
  );

  const remainingIterations = ITERATION_CAP - iterations;
  const primaryPlatform = useMemo(() => pickPrimaryPlatform(platforms), [platforms]);

  const togglePlatform = (key) => {
    setPlatforms((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((p) => p !== key);
        return next.length === 0 ? prev : next; // never let it go empty
      }
      return [...prev, key];
    });
  };

  // Update edit fields when active variant changes.
  useEffect(() => {
    const v = variants[activeIdx];
    if (!v) return;
    setEditedContent(`${v.hook ? v.hook + '\n\n' : ''}${v.body}${v.cta ? '\n\n' + v.cta : ''}`.trim());
    setEditedHashtags((v.hashtags || []).join(' '));
  }, [activeIdx, variants]);

  // Set of currently-included hashtags (normalized, no # prefix) so the
  // chip buttons can render an active state and the toggle helper can
  // be idempotent.
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
    let next;
    if (has) {
      next = tokens.filter((t) => normalizeHashtag(t) !== norm);
    } else {
      next = [...tokens, `#${norm}`];
    }
    setEditedHashtags(next.join(' '));
  };

  const handleGenerate = async (kind = 'generate') => {
    if (!gecko) return;
    if (remainingIterations <= 0) {
      setError('You have reached the 10 generation cap for this post. Publish, copy, or discard it to start a new one.');
      return;
    }
    setGenerating(true);
    setError(null);

    try {
      // Create draft on first generation.
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
          starting_point: startingPoint || null,
          status: 'draft',
        });
        setDraft(created);
        postId = created.id;
      }

      const previousVariants = kind !== 'generate'
        ? variants.map((v) => ({ content: `${v.hook} ${v.body}` }))
        : [];

      const { data, error: fnErr } = await supabase.functions.invoke('generate-social-post', {
        body: {
          post_id: postId,
          // When the user has a custom voice selected we forward its
          // voice_text as voice_custom; the server appends it to the
          // system prompt so it stacks on top of the preset.
          voice_custom: selectedCustomVoice?.voice_text || null,
          gecko: {
            id: gecko.id,
            name: gecko.name || null,
            morph: gecko.morph || gecko.morph_description || null,
            sex: gecko.sex || null,
            hatch_date: gecko.hatch_date || null,
            weight_g: gecko.weight_g ?? null,
            sale_status: gecko.sale_status || null,
            notes: gecko.notes || null,
            sire: gecko.sire ? { name: gecko.sire.name, morph: gecko.sire.morph } : null,
            dam: gecko.dam ? { name: gecko.dam.name, morph: gecko.dam.morph } : null,
            recent_changes: [],
          },
          platforms: [primaryPlatform, ...platforms.filter((p) => p !== primaryPlatform)],
          template,
          voice_preset: voicePreset,
          length_pref: lengthPref,
          starting_point: startingPoint || undefined,
          variant_count: 3,
          kind,
          previous_variants: previousVariants,
        },
      });

      if (fnErr) {
        setError(fnErr.message || 'Generation failed.');
        return;
      }
      if (data?.error) {
        if (data.error === 'iteration_cap_reached') {
          setIterations(ITERATION_CAP);
          setError('Iteration cap reached.');
        } else {
          setError(`Error: ${data.error}`);
        }
        return;
      }

      setVariants(data.variants || []);
      setActiveIdx(0);
      setIterations(data.iteration_count || iterations + 1);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const handleCycleVoice = async () => {
    const idx = VOICE_PRESETS.findIndex((v) => v.key === voicePreset);
    const next = VOICE_PRESETS[(idx + 1) % VOICE_PRESETS.length].key;
    setVoicePreset(next);
    if (variants.length > 0) {
      // Regenerate with the new voice
      await handleGenerate('voice_cycle');
    }
  };

  // Hook rewriter: ask the model for 5 alternative opening lines for
  // the current draft. Body and hashtags stay; the user picks one to
  // swap in. Burns an iteration just like a regenerate.
  const handleRewriteHooks = async () => {
    if (!editedContent.trim() || !draft) return;
    if (remainingIterations <= 0) {
      setError('You have reached the 10 generation cap for this post.');
      return;
    }
    setRewritingHooks(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-social-post', {
        body: {
          post_id: draft.id,
          kind: 'hook_rewrite',
          variant_count: 5,
          voice_preset: voicePreset,
          voice_custom: selectedCustomVoice?.voice_text || null,
          platforms,
          template,
          length_pref: lengthPref,
          gecko: {
            id: gecko.id,
            name: gecko.name || null,
            morph: gecko.morph || gecko.morph_description || null,
            sex: gecko.sex || null,
          },
          previous_variants: [{ content: editedContent }],
        },
      });
      if (fnErr) {
        setError(fnErr.message || 'Hook rewrite failed.');
        return;
      }
      if (data?.error) {
        setError(`Error: ${data.error}`);
        return;
      }
      setHookSuggestions((data.variants || []).map((v) => v.hook).filter(Boolean));
      setIterations(data.iteration_count || iterations + 1);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setRewritingHooks(false);
    }
  };

  // Replace the opening paragraph of the edited content with the
  // chosen hook. We treat "everything up to the first blank line" as
  // the existing hook so users can paste-in new openings without
  // losing the body.
  const applyHook = (hook) => {
    if (!hook) return;
    const trimmed = editedContent.trim();
    const splitAt = trimmed.indexOf('\n\n');
    const body = splitAt === -1 ? '' : trimmed.slice(splitAt).trimStart();
    setEditedContent(body ? `${hook}\n\n${body}` : hook);
    setHookSuggestions([]);
  };

  // Save a new custom voice to user_brand_voice.
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
      setError(`Save voice failed: ${e?.message || e}`);
    } finally {
      setSavingVoice(false);
    }
  };

  const handleDeleteVoice = async (id) => {
    if (!confirm('Delete this saved voice?')) return;
    try {
      await UserBrandVoice.delete(id);
      setCustomVoices((prev) => prev.filter((v) => v.id !== id));
      if (selectedCustomVoiceId === id) setSelectedCustomVoiceId(null);
    } catch (e) {
      setError(`Delete failed: ${e?.message || e}`);
    }
  };

  // Seed an inspiration post into the starting-point field so the next
  // generation can use it as a style anchor. We don't paste the full
  // text into editedContent because that would clobber the working
  // draft; using starting_point lets the model riff on the angle.
  const useInspiration = (post) => {
    if (!post?.variant) return;
    const excerpt = post.variant.content.slice(0, 300);
    setStartingPoint(`Match the angle and rhythm of this past post: ${excerpt}`);
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
    const makeSlug = () => Math.random().toString(36).slice(2, 10);
    const title = gecko.name
      ? `Waitlist: ${gecko.name}`
      : `Waitlist: ${gecko.morph_description || gecko.morph || 'crested gecko'}`;
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
      description: 'Added to the caption. Share the post; signups appear in your inbox.',
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

  const handlePublish = async () => {
    if (!draft) return;
    setPublishing(true);
    setError(null);

    try {
      const tags = editedHashtags.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      const cta = variants[activeIdx]?.cta || null;

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
            image_ids: [],
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
            results.push({ platform: p, ok: false, error: parsed?.error || fnErr.message || 'Publish failed.' });
            continue;
          }
          if (data?.error === 'payment_method_required') {
            onPaymentRequired?.();
            setPublishing(false);
            return;
          }
          if (data?.error) {
            results.push({ platform: p, ok: false, error: data.error });
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
          results.push({ platform: p, ok: false, error: String(e?.message || e) });
        }
      }

      const successes = results.filter((r) => r.ok);
      const failures = results.filter((r) => !r.ok);

      if (successes.length > 0) {
        toast({
          title: failures.length === 0
            ? `Published to ${successes.length} platform${successes.length === 1 ? '' : 's'}`
            : `Published ${successes.length}/${results.length}`,
          description: successes
            .map((r) => `${platformLabel(r.platform)}${r.url ? `: ${r.url}` : ''}`)
            .join(' · '),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[100vw] sm:w-auto max-h-[100vh] sm:max-h-[90vh] h-[100vh] sm:h-auto sm:rounded-lg rounded-none overflow-y-auto p-3 sm:p-6 pb-24 sm:pb-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Compose post about {gecko?.name || gecko?.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Inspiration: the user's last 5 published posts. Click one
              to seed it as a style anchor (writes into the
              starting-point field — keeps the working draft intact). */}
          {inspirationPosts.length > 0 && (
            <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-2">
                Inspired by your past posts
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {inspirationPosts.map((p) => (
                  <button
                    key={p.post_id}
                    type="button"
                    onClick={() => useInspiration(p)}
                    className="flex-shrink-0 w-40 text-left rounded-md border border-emerald-800/40 bg-emerald-950/50 hover:border-emerald-500/60 hover:bg-emerald-900/40 transition-colors p-2"
                    title="Use this as a style anchor for the next generation"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-emerald-300/70">
                      {p.template} · {platformLabel(p.variant.platform)}
                    </div>
                    <div className="text-[11px] text-emerald-100 line-clamp-3 mt-1">
                      {p.variant.content}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Template + Length pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-emerald-300 mb-1 block">
                Template
              </Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POST_TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-emerald-300 mb-1 block">
                Length
              </Label>
              <Select value={lengthPref} onValueChange={setLengthPref}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Platforms ,  multi-select. Generation targets the most
              restrictive selected platform so the post fits everywhere
              it's sent; per-platform formatting (hashtag placement,
              truncation) happens at publish time. */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-emerald-300 mb-1 block">
              Platforms (post to all selected)
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3">
              {PLATFORMS.map((p) => {
                const checked = platforms.includes(p.key);
                return (
                  <label
                    key={p.key}
                    className={`flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                      checked
                        ? 'bg-emerald-800/40 border border-emerald-600/50'
                        : 'border border-transparent hover:bg-emerald-900/30'
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => togglePlatform(p.key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-emerald-100 truncate">
                        {p.label}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-emerald-200/60 mt-1">
              Generation tailors the post for {platformLabel(primaryPlatform)} (the strictest selected). Other platforms reuse the same draft with their own hashtag formatting.
            </p>
          </div>

          {/* Voice cycling + custom voice picker */}
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-emerald-300">
                Voice: {voiceLabel(voicePreset)}
                {selectedCustomVoice && (
                  <span className="ml-2 normal-case tracking-normal text-emerald-200/70">
                    + {selectedCustomVoice.name}
                  </span>
                )}
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCycleVoice}
                disabled={generating || remainingIterations <= 0}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Try another voice
              </Button>
            </div>
            <p className="text-xs text-emerald-200/70">
              {VOICE_PRESETS.find((v) => v.key === voicePreset)?.blurb}
            </p>

            {/* Saved custom voices ,  click a chip to stack a custom voice
                on top of the preset. Saving captures the user's own
                writing for the model to mimic. */}
            <div className="pt-2 border-t border-emerald-900/40">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-1.5">
                Your saved voices
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                {customVoices.map((v) => {
                  const active = v.id === selectedCustomVoiceId;
                  return (
                    <span key={v.id} className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedCustomVoiceId(active ? null : v.id)}
                        className={`text-[11px] px-2 py-0.5 rounded-l border transition-colors ${
                          active
                            ? 'bg-emerald-600/40 border-emerald-500/60 text-emerald-50'
                            : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200/80 hover:bg-emerald-900/40'
                        }`}
                      >
                        {v.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteVoice(v.id)}
                        title="Delete voice"
                        className="text-[11px] px-1 py-0.5 rounded-r border border-l-0 border-emerald-800/50 bg-emerald-950/40 text-emerald-300/60 hover:text-red-300 hover:bg-red-900/30"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowNewVoiceForm((s) => !s)}
                  className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-emerald-700/60 text-emerald-300/80 hover:text-emerald-100 hover:bg-emerald-900/40"
                >
                  {showNewVoiceForm ? 'Cancel' : '+ Train a voice'}
                </button>
              </div>

              {showNewVoiceForm && (
                <div className="mt-2 space-y-2 rounded-md bg-emerald-950/50 border border-emerald-800/40 p-2">
                  <Input
                    value={newVoiceName}
                    onChange={(e) => setNewVoiceName(e.target.value)}
                    placeholder="Voice name (e.g. My breeder voice)"
                    className="text-xs"
                  />
                  <Textarea
                    value={newVoiceText}
                    onChange={(e) => setNewVoiceText(e.target.value)}
                    placeholder="Paste 5-10 of your past captions, or describe the voice in your own words. The model will mimic phrasing, rhythm, and tics."
                    rows={5}
                    className="text-xs font-mono"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveVoice}
                    disabled={savingVoice || !newVoiceName.trim() || !newVoiceText.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500"
                  >
                    {savingVoice ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving…</> : 'Save voice'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Optional starting-point text */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-emerald-300 mb-1 block">
              Starting point (optional)
            </Label>
            <Input
              value={startingPoint}
              onChange={(e) => setStartingPoint(e.target.value)}
              placeholder="e.g. focus on her line, mention dam was a Lilly White Phantom"
              className="text-sm"
            />
          </div>

          {/* Generate / Variants */}
          {variants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Button
                onClick={() => handleGenerate('generate')}
                disabled={generating}
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate 3 variants</>
                )}
              </Button>
              <p className="text-xs text-emerald-200/60 mt-2">
                Uses Sonnet 4.6 for the first generation, Haiku 4.5 for tweaks.
              </p>
            </div>
          ) : (
            <>
              {/* Variant tabs */}
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                  disabled={activeIdx === 0}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center text-xs text-emerald-200/70">
                  Variant {activeIdx + 1} of {variants.length}
                  {' '}
                  <span className="text-emerald-300/50">
                    · {remainingIterations} regeneration{remainingIterations === 1 ? '' : 's'} left
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => setActiveIdx((i) => Math.min(variants.length - 1, i + 1))}
                  disabled={activeIdx === variants.length - 1}
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerate('regenerate')}
                  disabled={generating || remainingIterations <= 0}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRewriteHooks}
                  disabled={rewritingHooks || remainingIterations <= 0 || !editedContent.trim()}
                  title="Generate 5 alternative opening lines"
                >
                  {rewritingHooks
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Hooks…</>
                    : <>5 hooks</>}
                </Button>
              </div>

              {hookSuggestions.length > 0 && (
                <div className="rounded-lg border border-emerald-700/50 bg-emerald-900/30 p-2 space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 flex items-center justify-between">
                    Pick a new opening
                    <button
                      type="button"
                      onClick={() => setHookSuggestions([])}
                      className="text-emerald-400/70 hover:text-emerald-200 text-[10px]"
                    >
                      dismiss
                    </button>
                  </div>
                  {hookSuggestions.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyHook(h)}
                      className="block w-full text-left text-xs text-emerald-100 rounded bg-emerald-950/50 hover:bg-emerald-800/40 border border-emerald-800/40 hover:border-emerald-600/60 px-2 py-1.5 transition-colors"
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}

              {/* Edit area */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-emerald-300 mb-1 block">
                  Caption (edit before publishing)
                </Label>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={8}
                  className="text-sm font-mono"
                />
                <Label className="text-xs uppercase tracking-wider text-emerald-300 mb-1 mt-3 block">
                  Hashtags
                </Label>
                <Input
                  value={editedHashtags}
                  onChange={(e) => setEditedHashtags(e.target.value)}
                  placeholder="#crestedgecko #lillywhite ..."
                  className="text-sm font-mono"
                />

                {/* Hashtag chip picker, grouped by category. Click a chip
                    to add or remove that tag from the post. Selected
                    chips render in the active style; the chip set stays
                    in sync with whatever the user typed into the input
                    above via the normalized hashtag set. */}
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
                        {group.tags.map((tag) => {
                          const isActive = activeHashtagSet.has(normalizeHashtag(tag));
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => toggleHashtag(tag)}
                              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                                isActive
                                  ? 'bg-emerald-600/40 border-emerald-500/60 text-emerald-50'
                                  : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200/80 hover:bg-emerald-900/40 hover:text-emerald-100'
                              }`}
                            >
                              #{tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
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
                      Preview ,  {platformLabel(p.platform)}
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
                  title="Create a public waitlist link for this gecko and append it to the caption"
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
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Publishing…</>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1.5" />
                      {platforms.length === 1
                        ? (PLATFORMS.find((p) => p.key === platforms[0])?.mode === 'direct'
                            ? `Publish to ${platformLabel(platforms[0])}`
                            : 'Copy + open compose')
                        : `Publish ×${platforms.length}`}
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
      </DialogContent>
    </Dialog>
  );
}
