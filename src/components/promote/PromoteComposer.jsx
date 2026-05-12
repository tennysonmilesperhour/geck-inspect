import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, RefreshCw, ChevronLeft, ChevronRight, Copy, Send, Check,
  AlertCircle, Loader2,
} from 'lucide-react';
import {
  VOICE_PRESETS, POST_TEMPLATES, PLATFORMS,
  composePlatformText, platformDeepLink, platformLabel, voiceLabel,
} from '@/lib/socialMedia';
import { supabase } from '@/lib/supabaseClient';
import { SocialPost, SocialPostVariant } from '@/entities/all';
import { toast } from '@/components/ui/use-toast';

const DEFAULT_VOICE = 'pro_breeder';
const DEFAULT_TEMPLATE = 'meet';
const DEFAULT_PLATFORM = 'bluesky';
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
  const [platform, setPlatform] = useState(DEFAULT_PLATFORM);
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
  }, [open, gecko?.id]);

  const remainingIterations = ITERATION_CAP - iterations;

  // Update edit fields when active variant changes.
  useEffect(() => {
    const v = variants[activeIdx];
    if (!v) return;
    setEditedContent(`${v.hook ? v.hook + '\n\n' : ''}${v.body}${v.cta ? '\n\n' + v.cta : ''}`.trim());
    setEditedHashtags((v.hashtags || []).join(' '));
  }, [activeIdx, variants]);

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
          created_by_user_id: user.id,
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
          platforms: [platform],
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

  // Compute what would actually post, factoring in user edits.
  const composedText = useMemo(() => {
    const tags = editedHashtags
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    return composePlatformText({
      content: editedContent,
      hashtags: tags,
      platform,
    });
  }, [editedContent, editedHashtags, platform]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(composedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      // Also open the platform deep link so the user lands in the
      // composer with their text already on the clipboard.
      const url = platformDeepLink(platform, composedText);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ title: 'Copy failed', description: 'Select the text manually and copy.' });
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    setPublishing(true);
    setError(null);

    try {
      // Persist the variant first so publish-social-post has a row to flip.
      const tags = editedHashtags.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      const variant = await SocialPostVariant.create({
        post_id: draft.id,
        platform,
        content: editedContent,
        hashtags: tags,
        cta: variants[activeIdx]?.cta || null,
        image_ids: [],
        status: 'draft',
      });

      const { data, error: fnErr } = await supabase.functions.invoke('publish-social-post', {
        body: { variant_id: variant.id },
      });

      if (fnErr) {
        // Supabase wraps non-2xx as an error. Try to read the body.
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
          return;
        }
        setError(parsed?.error || fnErr.message || 'Publish failed.');
        return;
      }
      if (data?.error === 'payment_method_required') {
        onPaymentRequired?.();
        return;
      }
      if (data?.error) {
        setError(`Error: ${data.error}${data.detail ? ` ,  ${data.detail}` : ''}`);
        return;
      }

      const url = data?.platform_post_url;
      const summary = data?.charged?.charged_credit
        ? 'Used 1 free credit.'
        : data?.charged?.charged_overage
          ? 'Charged $0.50 overage.'
          : 'Counted toward your monthly included posts.';
      toast({
        title: data?.status === 'published' ? 'Published!' : 'Copied to clipboard',
        description: url ? `${summary} ${url}` : summary,
      });

      // Auto-copy if the platform mode is clipboard (deep-link too).
      if (data?.status === 'copied') {
        try { await navigator.clipboard.writeText(composedText); } catch { /* ignore */ }
        const dl = platformDeepLink(platform, composedText);
        if (dl) window.open(dl, '_blank', 'noopener,noreferrer');
      }

      onPublished?.();
      onOpenChange(false);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Compose post about {gecko?.name || gecko?.id}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Template + Platform + Length pickers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                Platform
              </Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label} {p.mode === 'direct' && '✓'}
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

          {/* Voice cycling */}
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3">
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs uppercase tracking-wider text-emerald-300">
                Voice: {voiceLabel(voicePreset)}
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
              </div>

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
              </div>

              {/* Preview of the actually-posted text */}
              <div className="rounded-lg border border-emerald-800/30 bg-emerald-950/40 p-3">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-1">
                  Preview as it'll post on {platformLabel(platform)}
                </div>
                <div className="text-sm text-emerald-100 whitespace-pre-wrap">
                  {composedText}
                </div>
                <div className="text-xs text-emerald-200/50 mt-2">
                  {composedText.length} characters
                  {platform === 'bluesky' && composedText.length > 300 && (
                    <span className="text-amber-300 ml-2">
                      Bluesky limit is 300; will be truncated on publish.
                    </span>
                  )}
                  {platform === 'x' && composedText.length > 280 && (
                    <span className="text-amber-300 ml-2">
                      X limit is 280; trim before posting.
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-emerald-900/40">
                <Button
                  variant="outline"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                  Copy
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 ml-auto"
                  onClick={handlePublish}
                  disabled={publishing || !editedContent.trim()}
                >
                  {publishing ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Publishing…</>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1.5" />
                      {PLATFORMS.find((p) => p.key === platform)?.mode === 'direct'
                        ? `Publish to ${platformLabel(platform)}`
                        : 'Copy + open compose'}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-900/30 border border-red-700/40 p-3 text-sm text-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
