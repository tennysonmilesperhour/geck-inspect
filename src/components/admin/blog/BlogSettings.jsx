import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, Settings as SettingsIcon } from 'lucide-react';
import { BlogSettings as BlogSettingsEntity } from '@/entities/all';
import { logBlogEvent } from '@/lib/blog-api';
import { uploadFile } from '@/lib/uploadFile';

const DEFAULTS = {
  blog_enabled: true,
  blog_name: 'Geck Inspect Blog',
  blog_description: '',
  default_author_name: '',
  default_author_bio: '',
  default_author_avatar_url: '',
  default_blog_route: '/blog',
  posts_per_page: 12,
  show_author_box: true,
  show_related_posts: true,
  enable_ai_generation: true,
  enable_scheduled_publishing: true,
};

export default function BlogSettingsPanel() {
  const { toast } = useToast();
  const [settingsId, setSettingsId] = useState(null);
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rows = await BlogSettingsEntity.list();
        const row = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (row) {
          setSettingsId(row.id);
          setForm({
            ...DEFAULTS,
            ...row,
          });
        }
      } catch (err) {
        console.error('[BlogSettingsPanel] load failed:', err);
        toast({ title: 'Could not load settings', description: err.message, variant: 'destructive' });
      }
      setLoading(false);
    })();
  }, []);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const { file_url } = await uploadFile({ file, folder: 'blog-author-avatars' });
      setField('default_author_avatar_url', file_url);
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
    setAvatarUploading(false);
    e.target.value = '';
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = {
        blog_enabled: !!form.blog_enabled,
        blog_name: (form.blog_name || '').trim() || 'Geck Inspect Blog',
        blog_description: (form.blog_description || '').trim(),
        default_author_name: (form.default_author_name || '').trim() || null,
        default_author_bio: (form.default_author_bio || '').trim() || null,
        default_author_avatar_url: (form.default_author_avatar_url || '').trim() || null,
        default_blog_route: (form.default_blog_route || '').trim() || '/blog',
        posts_per_page: Math.max(1, Math.min(100, Number(form.posts_per_page) || 12)),
        show_author_box: !!form.show_author_box,
        show_related_posts: !!form.show_related_posts,
        enable_ai_generation: !!form.enable_ai_generation,
        enable_scheduled_publishing: !!form.enable_scheduled_publishing,
      };
      let saved;
      if (settingsId) {
        saved = await BlogSettingsEntity.update(settingsId, payload);
      } else {
        saved = await BlogSettingsEntity.create(payload);
        setSettingsId(saved.id);
      }
      await logBlogEvent('blog_settings_updated', {
        message: `Settings saved (blog ${saved.blog_enabled ? 'enabled' : 'disabled'})`,
      });
      toast({ title: 'Settings saved' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-emerald-400" /> Blog settings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-2 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleRow
              label="Blog enabled"
              hint="When off, public /blog routes return a not-found state."
              checked={!!form.blog_enabled}
              onChange={(v) => setField('blog_enabled', v)}
            />
            <ToggleRow
              label="Show author box"
              hint="Display the author byline on public posts."
              checked={!!form.show_author_box}
              onChange={(v) => setField('show_author_box', v)}
            />
            <ToggleRow
              label="Show related posts"
              hint="Bottom-of-page related-articles widget."
              checked={!!form.show_related_posts}
              onChange={(v) => setField('show_related_posts', v)}
            />
            <ToggleRow
              label="Enable AI blog generation"
              hint="Show the AI generator tab and let admins draft with Claude."
              checked={!!form.enable_ai_generation}
              onChange={(v) => setField('enable_ai_generation', v)}
            />
            <ToggleRow
              label="Enable scheduled publishing"
              hint="Allow scheduling drafts for future auto-publish."
              checked={!!form.enable_scheduled_publishing}
              onChange={(v) => setField('enable_scheduled_publishing', v)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Blog name</Label>
              <Input
                value={form.blog_name}
                onChange={(e) => setField('blog_name', e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Default blog route</Label>
              <Input
                value={form.default_blog_route}
                onChange={(e) => setField('default_blog_route', e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 font-mono text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-slate-400 mb-1.5 block">Blog description</Label>
            <Textarea
              value={form.blog_description}
              onChange={(e) => setField('blog_description', e.target.value)}
              placeholder="Short tagline shown on the blog index and used as the default OpenGraph description."
              className="bg-slate-800 border-slate-700 text-slate-100 h-20"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Default author name</Label>
              <Input
                value={form.default_author_name}
                onChange={(e) => setField('default_author_name', e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-slate-400 mb-1.5 block">Default author bio</Label>
              <Input
                value={form.default_author_bio}
                onChange={(e) => setField('default_author_bio', e.target.value)}
                placeholder="One-liner shown under the byline."
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Default author avatar URL</Label>
              <Input
                value={form.default_author_avatar_url}
                onChange={(e) => setField('default_author_avatar_url', e.target.value)}
                placeholder="https://…"
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
              <label className="inline-flex items-center text-xs px-3 py-1.5 mt-2 rounded-md border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer">
                {avatarUploading ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Uploading…</>
                ) : (
                  <>Upload avatar</>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onAvatarUpload}
                  className="hidden"
                  disabled={avatarUploading}
                />
              </label>
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Posts per page</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.posts_per_page}
                onChange={(e) => setField('posts_per_page', Number(e.target.value) || 12)}
                className="bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <Button
              onClick={onSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}
