import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft, Loader2, Save, Send, CalendarClock, Eye,
  CheckCircle2, AlertCircle, ImageIcon, Sparkles,
} from 'lucide-react';
import {
  BlogCategory, BlogTag, BlogSettings,
} from '@/entities/all';
import {
  createBlogPost, updateBlogPost, publishBlogPostNow,
  scheduleBlogPost, cancelScheduledBlogPost,
} from '@/lib/blog-api';
import {
  slugify, countWords, readingTimeMinutes, buildSeoChecklist, canPublish,
  BLOG_POST_STATUSES,
} from '@/lib/blog-helpers';
import { uploadFile } from '@/lib/uploadFile';
import { StatusBadge } from './BlogDashboard';

const EMPTY = {
  id:                  null,
  title:               '',
  slug:                '',
  excerpt:             '',
  content_markdown:    '',
  status:              'draft',
  target_keyword:      '',
  category_id:         '',
  tag_ids:             [],
  author_name:         '',
  author_bio:          '',
  author_avatar_url:   '',
  featured_image_url:  '',
  featured_image_alt:  '',
  meta_title:          '',
  meta_description:    '',
  canonical_url:       '',
  scheduled_at:        '',
};

function recordToForm(post, settings) {
  if (!post) {
    return {
      ...EMPTY,
      author_name:       settings?.default_author_name || '',
      author_bio:        settings?.default_author_bio || '',
      author_avatar_url: settings?.default_author_avatar_url || '',
    };
  }
  return {
    ...EMPTY,
    ...post,
    tag_ids: Array.isArray(post.tag_ids) ? [...post.tag_ids] : [],
    scheduled_at: post.scheduled_at
      ? new Date(post.scheduled_at).toISOString().slice(0, 16) // input[type=datetime-local]
      : '',
  };
}

/**
 * The blog editor itself. Manages a single in-memory form, saves to
 * Supabase via blog-api wrappers, surfaces the SEO checklist, and lets
 * the admin save-as-draft, publish-now, schedule, or preview.
 */
export default function BlogEditor({ postId, initialPost, onBack, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [originalSlug, setOriginalSlug] = useState('');
  const [originalStatus, setOriginalStatus] = useState('draft');
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [autoSlug, setAutoSlug] = useState(!initialPost?.slug);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [cats, tgs, settings] = await Promise.all([
          BlogCategory.list().catch(() => []),
          BlogTag.list().catch(() => []),
          BlogSettings.list().catch(() => []),
        ]);
        if (cancelled) return;
        setCategories(cats || []);
        setTags(tgs || []);
        const seed = initialPost || null;
        const formed = recordToForm(seed, (settings && settings[0]) || null);
        setForm(formed);
        setOriginalSlug(seed?.slug || '');
        setOriginalStatus(seed?.status || 'draft');
        setAutoSlug(!seed?.slug);
      } catch (err) {
        toast({ title: 'Could not load editor', description: err.message, variant: 'destructive' });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [postId, initialPost?.id]);

  const wordCount = useMemo(() => countWords(form.content_markdown), [form.content_markdown]);
  const readingTime = useMemo(() => readingTimeMinutes(form.content_markdown), [form.content_markdown]);
  const checklist = useMemo(() => buildSeoChecklist(form), [form]);
  const canPublishNow = useMemo(() => canPublish(form), [form]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleTitleChange = (val) => {
    setForm((f) => {
      const next = { ...f, title: val };
      if (autoSlug) next.slug = slugify(val);
      return next;
    });
  };

  const handleSlugChange = (val) => {
    setAutoSlug(false);
    setField('slug', slugify(val));
  };

  const toggleTag = (tagId) => {
    setForm((f) => {
      const set = new Set(f.tag_ids || []);
      if (set.has(tagId)) set.delete(tagId); else set.add(tagId);
      return { ...f, tag_ids: Array.from(set) };
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const { file_url } = await uploadFile({ file, folder: 'blog-featured' });
      setField('featured_image_url', file_url);
      toast({ title: 'Image uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
    setImageUploading(false);
    e.target.value = '';
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    slug:  form.slug.trim() || slugify(form.title) || 'untitled-post',
    excerpt: form.excerpt.trim() || null,
    content_markdown: form.content_markdown,
    status: form.status,
    target_keyword: form.target_keyword.trim() || null,
    category_id: form.category_id || null,
    tag_ids: form.tag_ids || [],
    author_name: form.author_name.trim() || null,
    author_bio: form.author_bio.trim() || null,
    author_avatar_url: form.author_avatar_url.trim() || null,
    featured_image_url: form.featured_image_url.trim() || null,
    featured_image_alt: form.featured_image_alt.trim() || null,
    meta_title: form.meta_title.trim() || null,
    meta_description: form.meta_description.trim() || null,
    canonical_url: form.canonical_url.trim() || null,
    scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
  });

  const persist = async (overrides = {}) => {
    const payload = { ...buildPayload(), ...overrides };
    if (form.id) {
      // If only the slug didn't actually change, omit it so we don't burn
      // a cycle through ensureUniqueSlug.
      if (payload.slug === originalSlug) delete payload.slug;
      const updated = await updateBlogPost(form.id, payload);
      return updated;
    }
    const created = await createBlogPost(payload);
    return created;
  };

  const saveDraft = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const saved = await persist({ status: 'draft' });
      toast({ title: 'Draft saved' });
      setForm((f) => ({ ...f, id: saved.id }));
      setOriginalSlug(saved.slug || '');
      setOriginalStatus(saved.status);
      onSaved?.(saved);
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const publishNow = async () => {
    if (!canPublishNow) {
      toast({
        title: 'Cannot publish',
        description: 'Title, slug, and content are required to publish.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const saved = await persist({ status: form.id ? form.status : 'draft' });
      const published = await publishBlogPostNow(saved.id);
      toast({ title: 'Published', description: published.title });
      setForm(recordToForm(published, null));
      setOriginalSlug(published.slug || '');
      setOriginalStatus(published.status);
      onSaved?.(published);
    } catch (err) {
      toast({ title: 'Publish failed', description: err.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const schedulePublish = async () => {
    if (!form.scheduled_at) {
      toast({ title: 'Pick a date and time first', variant: 'destructive' });
      return;
    }
    if (!canPublishNow) {
      toast({
        title: 'Cannot schedule',
        description: 'Title, slug, and content are required to schedule.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const saved = await persist({ status: 'draft' });
      const scheduled = await scheduleBlogPost(saved.id, form.scheduled_at);
      toast({
        title: 'Scheduled',
        description: `Will publish at ${new Date(scheduled.scheduled_at).toLocaleString()}`,
      });
      setForm(recordToForm(scheduled, null));
      setOriginalSlug(scheduled.slug || '');
      setOriginalStatus(scheduled.status);
      onSaved?.(scheduled);
    } catch (err) {
      toast({ title: 'Schedule failed', description: err.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const cancelSchedule = async () => {
    if (!form.id) return;
    setBusy(true);
    try {
      const updated = await cancelScheduledBlogPost(form.id);
      toast({ title: 'Schedule cancelled' });
      setForm(recordToForm(updated, null));
      setOriginalStatus(updated.status);
      onSaved?.(updated);
    } catch (err) {
      toast({ title: 'Cancel failed', description: err.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  const previewBase = form.slug ? `/blog/${form.slug}` : '';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to posts
        </Button>
        <div className="flex items-center gap-2">
          <StatusBadge status={form.status} />
          <span className="text-xs text-slate-400">
            {wordCount} words · {readingTime} min read
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="A clear, click-worthy title"
                  className="bg-slate-800 border-slate-700 text-slate-100 text-base"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">
                  Slug <span className="text-slate-500">(/blog/<span className="text-emerald-400">{form.slug || '…'}</span>)</span>
                </Label>
                <Input
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="kebab-case-slug"
                  className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Excerpt</Label>
                <Textarea
                  value={form.excerpt}
                  onChange={(e) => setField('excerpt', e.target.value)}
                  placeholder="One-paragraph summary for the index, share cards, and SEO."
                  className="bg-slate-800 border-slate-700 text-slate-100 h-20"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">
                  Content (markdown — supports # headings, **bold**, *italic*, [links](url), - bullets)
                </Label>
                <Textarea
                  value={form.content_markdown}
                  onChange={(e) => setField('content_markdown', e.target.value)}
                  placeholder="## Introduction\n\nWrite your post here…"
                  className="bg-slate-800 border-slate-700 text-slate-100 h-96 font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-100">Author override</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-3">
              <p className="text-xs text-slate-500">
                Defaults to the values from Blog Settings. Override here for a guest-author byline.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-slate-400 mb-1.5 block">Author name</Label>
                  <Input
                    value={form.author_name}
                    onChange={(e) => setField('author_name', e.target.value)}
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400 mb-1.5 block">Avatar URL</Label>
                  <Input
                    value={form.author_avatar_url}
                    onChange={(e) => setField('author_avatar_url', e.target.value)}
                    placeholder="https://…"
                    className="bg-slate-800 border-slate-700 text-slate-100"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Author bio</Label>
                <Textarea
                  value={form.author_bio}
                  onChange={(e) => setField('author_bio', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 h-16"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-100">Publish</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={saveDraft}
                  disabled={busy}
                  className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  Save draft
                </Button>
                <Button
                  size="sm"
                  onClick={publishNow}
                  disabled={busy || !canPublishNow}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                  Publish now
                </Button>
                {previewBase && (
                  <a
                    href={previewBase}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs px-2.5 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                  </a>
                )}
              </div>
              <div className="pt-2 border-t border-slate-800">
                <Label className="text-xs text-slate-400 mb-1.5 block">Schedule for</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setField('scheduled_at', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={schedulePublish}
                    disabled={busy || !form.scheduled_at}
                    className="border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                  >
                    <CalendarClock className="w-3.5 h-3.5 mr-1.5" /> Schedule
                  </Button>
                  {originalStatus === 'scheduled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={cancelSchedule}
                      disabled={busy}
                      className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Cancel schedule
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-100">Taxonomy</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-3">
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Category</Label>
                <Select
                  value={form.category_id || 'none'}
                  onValueChange={(v) => setField('category_id', v === 'none' ? '' : v)}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue placeholder="Uncategorized" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {categories.filter((c) => c.is_active).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.filter((t) => t.is_active).length === 0 && (
                    <p className="text-xs text-slate-500">No active tags yet — create some in Categories &amp; Tags.</p>
                  )}
                  {tags.filter((t) => t.is_active).map((t) => {
                    const active = (form.tag_ids || []).includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={`text-xs px-2 py-1 rounded-md border transition-colors ${
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
                <Label className="text-xs text-slate-400 mb-1.5 block">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField('status', v)}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOG_POST_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Featured image
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-3">
              {form.featured_image_url ? (
                <img
                  src={form.featured_image_url}
                  alt={form.featured_image_alt}
                  className="rounded-lg w-full max-h-48 object-cover border border-slate-700"
                />
              ) : (
                <div className="rounded-lg bg-slate-800/60 border border-dashed border-slate-700 h-32 flex items-center justify-center text-xs text-slate-500">
                  No image yet
                </div>
              )}
              <Input
                value={form.featured_image_url}
                onChange={(e) => setField('featured_image_url', e.target.value)}
                placeholder="https://…"
                className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
              />
              <label className="inline-flex items-center text-xs px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">
                {imageUploading ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Uploading…</>
                ) : (
                  <>Upload image</>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={imageUploading}
                />
              </label>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Alt text</Label>
                <Input
                  value={form.featured_image_alt}
                  onChange={(e) => setField('featured_image_alt', e.target.value)}
                  placeholder="Describe the image for screen readers."
                  className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-100">SEO</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-3">
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Target keyword</Label>
                <Input
                  value={form.target_keyword}
                  onChange={(e) => setField('target_keyword', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Meta title</Label>
                <Input
                  value={form.meta_title}
                  onChange={(e) => setField('meta_title', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
                  maxLength={120}
                />
                <p className="text-[10px] text-slate-500 mt-1">{form.meta_title.length}/60 chars recommended</p>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Meta description</Label>
                <Textarea
                  value={form.meta_description}
                  onChange={(e) => setField('meta_description', e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-100 text-sm h-20"
                  maxLength={400}
                />
                <p className="text-[10px] text-slate-500 mt-1">{form.meta_description.length}/160 chars recommended</p>
              </div>
              <div>
                <Label className="text-xs text-slate-400 mb-1.5 block">Canonical URL</Label>
                <Input
                  value={form.canonical_url}
                  onChange={(e) => setField('canonical_url', e.target.value)}
                  placeholder="https://…"
                  className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
                />
              </div>
              <div className="pt-3 border-t border-slate-800">
                <p className="text-xs font-semibold text-slate-300 mb-2">SEO checklist</p>
                <ul className="space-y-1.5">
                  {checklist.map((c) => (
                    <li key={c.id} className="flex items-start gap-2 text-xs">
                      {c.ok ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      )}
                      <span className={c.ok ? 'text-slate-300' : 'text-slate-400'}>{c.label}</span>
                    </li>
                  ))}
                </ul>
                {!canPublishNow && (
                  <p className="mt-2 text-[11px] text-amber-300">
                    Title, slug, and content are required to publish.
                  </p>
                )}
              </div>
              <div className="pt-3 border-t border-slate-800">
                <p className="text-xs font-semibold text-slate-300 mb-2">Search preview</p>
                <div className="rounded-md bg-slate-950/60 border border-slate-800 p-3">
                  <p className="text-emerald-300 text-sm leading-tight truncate">
                    {form.meta_title || form.title || 'Your title here'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    geckinspect.com/blog/{form.slug || 'your-slug'}
                  </p>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">
                    {form.meta_description || form.excerpt || 'Your meta description will appear here.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {form.id && (
            <p className="text-[11px] text-slate-600 text-center">
              <Sparkles className="inline w-3 h-3 mr-0.5" /> id {form.id}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
