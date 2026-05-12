import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Sparkles, ArrowRight, Wand2 } from 'lucide-react';
import { BlogCategory, BlogTag, BlogSettings } from '@/entities/all';
import {
  generateBlogPost, AI_LENGTH_OPTIONS, AI_TONE_OPTIONS, AI_INTENT_OPTIONS,
} from '@/lib/blog-api';

const EMPTY_INPUT = {
  topic:               '',
  target_keyword:      '',
  secondary_keywords:  '',
  search_intent:       'informational',
  target_audience:     '',
  tone:                'helpful',
  length:              'medium',
  category_id:         '',
  tag_ids:             [],
  call_to_action:      '',
  custom_instructions: '',
};

export default function BlogAIGenerator({ onDraftCreated }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [input, setInput] = useState(EMPTY_INPUT);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [cats, tgs, settings] = await Promise.all([
          BlogCategory.list().catch(() => []),
          BlogTag.list().catch(() => []),
          BlogSettings.list().catch(() => []),
        ]);
        setCategories(cats || []);
        setTags(tgs || []);
        const s = (settings && settings[0]) || null;
        if (s && s.enable_ai_generation === false) setEnabled(false);
      } catch (err) {
        console.error('[BlogAIGenerator] load failed:', err);
      }
    })();
  }, []);

  const setField = (k, v) => setInput((f) => ({ ...f, [k]: v }));

  const toggleTag = (id) => {
    setInput((f) => {
      const set = new Set(f.tag_ids);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...f, tag_ids: Array.from(set) };
    });
  };

  const onGenerate = async () => {
    if (!input.topic.trim()) {
      toast({ title: 'Topic is required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const payload = {
        ...input,
        secondary_keywords: input.secondary_keywords
          .split(/[,\n]/g).map((s) => s.trim()).filter(Boolean),
        category_id: input.category_id || null,
      };
      const out = await generateBlogPost(payload);
      setResult(out);
      toast({
        title: 'Draft created',
        description: `"${out.post.title}" is saved as a draft.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Generation failed',
        description: err.message || 'Unknown error',
        variant: 'destructive',
      });
    }
    setBusy(false);
  };

  if (!enabled) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-8 text-center text-slate-400">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-amber-400" />
          AI generation is disabled in Blog Settings. Turn on
          <span className="text-slate-200 font-semibold"> Enable AI blog generation </span>
          to use this tool.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-emerald-400" />
            AI blog generator
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-2 space-y-4">
          <p className="text-sm text-slate-400">
            Describe the post you want, and Claude will draft a complete article and save
            it as a draft you can review, edit, and publish.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Topic *</Label>
              <Input
                value={input.topic}
                onChange={(e) => setField('topic', e.target.value)}
                placeholder="e.g. How to set up a bioactive crested gecko enclosure"
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Target keyword</Label>
              <Input
                value={input.target_keyword}
                onChange={(e) => setField('target_keyword', e.target.value)}
                placeholder="e.g. bioactive crested gecko enclosure"
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-400 mb-1.5 block">
              Secondary keywords (comma- or newline-separated)
            </Label>
            <Textarea
              value={input.secondary_keywords}
              onChange={(e) => setField('secondary_keywords', e.target.value)}
              placeholder="bioactive substrate, isopods, springtails, crested gecko humidity"
              className="bg-slate-800 border-slate-700 text-slate-100 h-16"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Search intent</Label>
              <Select value={input.search_intent} onValueChange={(v) => setField('search_intent', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_INTENT_OPTIONS.map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Tone</Label>
              <Select value={input.tone} onValueChange={(v) => setField('tone', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AI_TONE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Length</Label>
              <Select value={input.length} onValueChange={(v) => setField('length', v)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AI_LENGTH_OPTIONS).map(([id, { label }]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Target audience</Label>
              <Input
                value={input.target_audience}
                onChange={(e) => setField('target_audience', e.target.value)}
                placeholder="e.g. first-time crested gecko keepers"
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Category</Label>
              <Select
                value={input.category_id || 'none'}
                onValueChange={(v) => setField('category_id', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="Let the AI decide" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Let the AI decide</SelectItem>
                  {categories.filter((c) => c.is_active).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-400 mb-1.5 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.filter((t) => t.is_active).length === 0 && (
                <p className="text-xs text-slate-500">No active tags yet.</p>
              )}
              {tags.filter((t) => t.is_active).map((t) => {
                const active = input.tag_ids.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={`text-xs px-2 py-1 rounded-md border ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-400 mb-1.5 block">Call to action</Label>
            <Input
              value={input.call_to_action}
              onChange={(e) => setField('call_to_action', e.target.value)}
              placeholder="e.g. Sign up for free to track your crested gecko collection on Geck Inspect."
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400 mb-1.5 block">Custom instructions</Label>
            <Textarea
              value={input.custom_instructions}
              onChange={(e) => setField('custom_instructions', e.target.value)}
              placeholder="Anything else the writer should know ,  links to include, sections to emphasize, things to avoid…"
              className="bg-slate-800 border-slate-700 text-slate-100 h-20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              onClick={() => setInput(EMPTY_INPUT)}
              disabled={busy}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              Reset
            </Button>
            <Button
              onClick={onGenerate}
              disabled={busy || !input.topic.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {busy ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-1.5" /> Generate draft</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="bg-slate-900 border-emerald-500/30">
          <CardContent className="p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-emerald-300">
                <Sparkles className="inline w-4 h-4 mr-1" />
                Draft created ,  "{result.post.title}"
              </h3>
              <Button
                onClick={() => onDraftCreated?.(result.post)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Open in editor <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>

            {Array.isArray(result.ai?.title_options) && result.ai.title_options.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-1.5">Title options</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.ai.title_options.map((t, i) => (
                    <Badge key={i} className="bg-slate-800 text-slate-200 border border-slate-700">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.ai?.excerpt && (
              <p className="text-sm text-slate-300 italic border-l-2 border-emerald-500/40 pl-3">
                {result.ai.excerpt}
              </p>
            )}

            {Array.isArray(result.ai?.outline) && result.ai.outline.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-300 mb-1.5">Outline</p>
                <ul className="text-sm text-slate-300 list-disc list-inside space-y-0.5">
                  {result.ai.outline.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800">
              <div>
                <span className="text-slate-500">Meta title: </span>
                <span className="text-slate-200">{result.ai?.meta_title || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Suggested category: </span>
                <span className="text-slate-200">{result.ai?.suggested_category || '—'}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500">Suggested tags: </span>
                <span className="text-slate-200">
                  {(result.ai?.suggested_tags || []).join(', ') || '—'}
                </span>
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500">Image prompt: </span>
                <span className="text-slate-300">{result.ai?.featured_image_prompt || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
