import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import {
  Loader2, Plus, Edit, X, Save, Tag, FolderTree,
} from 'lucide-react';
import { BlogCategory, BlogTag } from '@/entities/all';
import { slugify } from '@/lib/blog-helpers';

/**
 * Two-column manager for blog categories and blog tags. Both lists share
 * the same shape (name + slug + description + is_active) so we can render
 * them through one TaxonomyList component.
 */
export default function BlogTaxonomy() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <TaxonomyList
        title="Categories"
        icon={FolderTree}
        Entity={BlogCategory}
        kind="category"
      />
      <TaxonomyList
        title="Tags"
        icon={Tag}
        Entity={BlogTag}
        kind="tag"
      />
    </div>
  );
}

function emptyForm() {
  return { id: null, name: '', slug: '', description: '', is_active: true };
}

function TaxonomyList({ title, icon: Icon, Entity, kind }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [autoSlug, setAutoSlug] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await Entity.list('-created_date');
      setItems(Array.isArray(all) ? all : []);
    } catch (err) {
      toast({ title: `Could not load ${kind}s`, description: err.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (item) => {
    setForm({
      id: item.id,
      name: item.name || '',
      slug: item.slug || '',
      description: item.description || '',
      is_active: item.is_active !== false,
    });
    setAutoSlug(false);
  };

  const reset = () => {
    setForm(emptyForm());
    setAutoSlug(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    const slug = slugify(form.slug || name);
    if (!slug) {
      toast({ title: 'Slug could not be derived', variant: 'destructive' });
      return;
    }
    // Check for slug conflict on this entity (other than the current id).
    const conflict = items.find((i) => i.slug === slug && i.id !== form.id);
    if (conflict) {
      toast({ title: 'Slug already exists', description: `Pick something other than "${slug}".`, variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name,
        slug,
        description: form.description.trim() || null,
        is_active: !!form.is_active,
      };
      if (form.id) {
        await Entity.update(form.id, payload);
      } else {
        await Entity.create(payload);
      }
      reset();
      await load();
      toast({ title: form.id ? 'Updated' : 'Created' });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  const toggleActive = async (item) => {
    try {
      await Entity.update(item.id, { is_active: !item.is_active });
      await load();
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
          <Icon className="w-4 h-4 text-emerald-400" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-2 space-y-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-300">
            {form.id ? `Edit ${kind}` : `Add ${kind}`}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
                    name,
                    slug: autoSlug ? slugify(name) : f.slug,
                  }));
                }}
                className="bg-slate-800 border-slate-700 text-slate-100 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-400 mb-1.5 block">Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setAutoSlug(false);
                  setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
                }}
                className="bg-slate-800 border-slate-700 text-slate-100 text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-400 mb-1.5 block">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="bg-slate-800 border-slate-700 text-slate-100 text-sm h-16"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <Switch
                checked={!!form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
              Active
            </label>
            <div className="flex gap-2">
              {form.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={reset}
                  disabled={busy}
                  className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
              )}
              <Button
                size="sm"
                onClick={save}
                disabled={busy}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {busy
                  ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  : form.id
                    ? <Save className="w-3.5 h-3.5 mr-1" />
                    : <Plus className="w-3.5 h-3.5 mr-1" />}
                {form.id ? 'Save' : 'Add'}
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-6">
            No {kind}s yet — add one above.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((item) => (
              <li key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${item.is_active ? 'text-slate-100' : 'text-slate-500 line-through'}`}>
                      {item.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">/{item.slug}</span>
                    {!item.is_active && (
                      <span className="text-[10px] uppercase tracking-wider text-amber-300">inactive</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive(item)}
                    className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs h-7"
                  >
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(item)}
                    className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs h-7"
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
