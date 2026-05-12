import { useEffect, useState } from 'react';
import { Testimonial } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  PlusCircle,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  EyeOff,
  Eye,
} from 'lucide-react';

/**
 * Admin tab for landing-page testimonials.
 *
 * Curated CRUD only ,  no "users submit, admins approve" flow yet, to
 * avoid a spam vector. To add a quote: paste it here, fill in author
 * details, save, then flip Approved on. The public landing page only
 * renders rows where approved = true and shows nothing at all until
 * three approved entries exist.
 */

function emptyForm() {
  return {
    quote: '',
    author_name: '',
    author_role: '',
    author_handle: '',
    author_url: '',
    avatar_url: '',
    sort_order: 100,
    source_note: '',
    approved: false,
  };
}

export default function TestimonialsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const rows = await Testimonial.filter({}, 'sort_order');
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error('TestimonialsAdmin load failed', e);
      toast({
        title: 'Failed to load',
        description: e.message || 'Could not load testimonials.',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const beginEdit = (row) => {
    setEditingId(row.id);
    setForm({
      quote: row.quote || '',
      author_name: row.author_name || '',
      author_role: row.author_role || '',
      author_handle: row.author_handle || '',
      author_url: row.author_url || '',
      avatar_url: row.avatar_url || '',
      sort_order: row.sort_order ?? 100,
      source_note: row.source_note || '',
      approved: !!row.approved,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const save = async () => {
    if (!form.quote.trim() || !form.author_name.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Quote and author name are required.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        quote: form.quote.trim(),
        author_name: form.author_name.trim(),
        author_role: form.author_role.trim() || null,
        author_handle: form.author_handle.trim() || null,
        author_url: form.author_url.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        sort_order: Number(form.sort_order) || 100,
        source_note: form.source_note.trim() || null,
        approved: !!form.approved,
      };
      if (editingId) {
        await Testimonial.update(editingId, payload);
        toast({ title: 'Saved' });
      } else {
        await Testimonial.create(payload);
        toast({ title: 'Created' });
      }
      cancelEdit();
      await load();
    } catch (e) {
      console.error(e);
      toast({
        title: 'Save failed',
        description: e.message || 'Could not save testimonial.',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  const remove = async (row) => {
    if (!confirm(`Delete testimonial from ${row.author_name}?`)) return;
    try {
      await Testimonial.delete(row.id);
      toast({ title: 'Deleted' });
      await load();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e.message || 'Could not delete.',
        variant: 'destructive',
      });
    }
  };

  const toggleApproved = async (row) => {
    try {
      await Testimonial.update(row.id, { approved: !row.approved });
      await load();
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e.message || 'Could not toggle approval.',
        variant: 'destructive',
      });
    }
  };

  const approvedCount = items.filter((r) => r.approved).length;
  const showsOnLanding = approvedCount >= 3;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Testimonials</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Admin-curated quotes shown on the landing page. The public
            section is only rendered once at least three rows are approved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            className={
              showsOnLanding
                ? 'bg-emerald-700 text-emerald-100'
                : 'bg-slate-700 text-slate-300'
            }
          >
            {approvedCount} approved · {showsOnLanding ? 'Visible on /' : 'Hidden on /'}
          </Badge>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">
            {editingId ? 'Edit testimonial' : 'New testimonial'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-slate-300">Quote *</Label>
            <Textarea
              rows={3}
              value={form.quote}
              onChange={(e) => setForm({ ...form, quote: e.target.value })}
              className="bg-slate-800 border-slate-600 text-slate-100"
              placeholder="The exact quote, no surrounding quote marks needed."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-300">Author name *</Label>
              <Input
                value={form.author_name}
                onChange={(e) => setForm({ ...form, author_name: e.target.value })}
                className="bg-slate-800 border-slate-600 text-slate-100"
                placeholder="e.g. Sam Reyes"
              />
            </div>
            <div>
              <Label className="text-slate-300">Role / context</Label>
              <Input
                value={form.author_role}
                onChange={(e) => setForm({ ...form, author_role: e.target.value })}
                className="bg-slate-800 border-slate-600 text-slate-100"
                placeholder="e.g. Crested gecko breeder, 6 years"
              />
            </div>
            <div>
              <Label className="text-slate-300">Instagram handle</Label>
              <Input
                value={form.author_handle}
                onChange={(e) => setForm({ ...form, author_handle: e.target.value })}
                className="bg-slate-800 border-slate-600 text-slate-100"
                placeholder="@somehandle"
              />
            </div>
            <div>
              <Label className="text-slate-300">Profile URL (overrides handle link)</Label>
              <Input
                value={form.author_url}
                onChange={(e) => setForm({ ...form, author_url: e.target.value })}
                className="bg-slate-800 border-slate-600 text-slate-100"
                placeholder="https://..."
              />
            </div>
            <div>
              <Label className="text-slate-300">Avatar URL</Label>
              <Input
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                className="bg-slate-800 border-slate-600 text-slate-100"
                placeholder="https://..."
              />
            </div>
            <div>
              <Label className="text-slate-300">Sort order (lower = earlier)</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="bg-slate-800 border-slate-600 text-slate-100"
              />
            </div>
          </div>
          <div>
            <Label className="text-slate-300">Internal source note</Label>
            <Input
              value={form.source_note}
              onChange={(e) => setForm({ ...form, source_note: e.target.value })}
              className="bg-slate-800 border-slate-600 text-slate-100"
              placeholder="DM 2026-04-12, Discord, email ,  for our reference only"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="approved"
              checked={form.approved}
              onChange={(e) => setForm({ ...form, approved: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="approved" className="text-slate-300 cursor-pointer">
              Approved (visible on landing page)
            </Label>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={save}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : editingId ? (
                <Save className="w-4 h-4 mr-2" />
              ) : (
                <PlusCircle className="w-4 h-4 mr-2" />
              )}
              {editingId ? 'Save changes' : 'Add testimonial'}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={cancelEdit}
                className="border-slate-600 text-slate-300"
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-lg">All testimonials</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No testimonials yet. Add one above.
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-700 bg-slate-800/40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 line-clamp-2">
                      &ldquo;{row.quote}&rdquo;
                    </p>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-300">{row.author_name}</span>
                      {row.author_role && <span>· {row.author_role}</span>}
                      {row.author_handle && <span>· {row.author_handle}</span>}
                      <span>· sort {row.sort_order}</span>
                      <Badge
                        className={
                          row.approved
                            ? 'bg-emerald-700 text-emerald-100 text-[10px]'
                            : 'bg-slate-700 text-slate-300 text-[10px]'
                        }
                      >
                        {row.approved ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approved
                          </>
                        ) : (
                          'Pending'
                        )}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleApproved(row)}
                      className="h-8 w-8 text-slate-400 hover:text-emerald-300"
                      title={row.approved ? 'Unapprove' : 'Approve'}
                    >
                      {row.approved ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => beginEdit(row)}
                      className="h-8 w-8 text-slate-400 hover:text-blue-300"
                      title="Edit"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove(row)}
                      className="h-8 w-8 text-slate-400 hover:text-red-300"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
