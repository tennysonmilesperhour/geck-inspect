import { useEffect, useMemo, useState } from 'react';
import { MorphGuide } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Pencil, Trash2, Search, Sparkles } from 'lucide-react';

/**
 * Admin CRUD editor for the morph_guides Supabase table.
 *
 * After the morph terminology audit (we deleted Moonglow / Hypo / Lavender /
 * Translucent because they aren't real crested gecko morphs), the user needs
 * an in-app way to keep this table accurate. This component is the long-term
 * fix for "bad data ends up in the morph guide" ,  admins can edit, delete,
 * and add new morph_guides records without touching the database directly.
 *
 * Schema: id, morph_name, description, key_features (text[]), rarity,
 *         example_image_url, breeding_info, created_date, updated_date
 */

const RARITIES = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'very_rare', label: 'Very Rare' },
];

const RARITY_COLORS = {
  common: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  uncommon: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  rare: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  very_rare: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

const EMPTY_FORM = {
  morph_name: '',
  description: '',
  key_features: '',
  rarity: 'common',
  example_image_url: '',
  breeding_info: '',
};

function recordToForm(record) {
  if (!record) return { ...EMPTY_FORM };
  return {
    morph_name: record.morph_name || '',
    description: record.description || '',
    key_features: Array.isArray(record.key_features) ? record.key_features.join('\n') : '',
    rarity: record.rarity || 'common',
    example_image_url: record.example_image_url || '',
    breeding_info: record.breeding_info || '',
  };
}

function formToRecord(form) {
  return {
    morph_name: form.morph_name.trim(),
    description: form.description.trim(),
    key_features: form.key_features
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    rarity: form.rarity,
    example_image_url: form.example_image_url.trim() || null,
    breeding_info: form.breeding_info.trim(),
  };
}

export default function MorphGuideEditor() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // record being edited; null when modal closed
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const data = await MorphGuide.list('morph_name');
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load morph guides:', err);
      toast({ title: 'Error', description: 'Could not load morph guides.', variant: 'destructive' });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.morph_name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.rarity?.toLowerCase().includes(q)
    );
  }, [records, search]);

  const openCreate = () => {
    setEditing({ id: null });
    setForm(EMPTY_FORM);
  };

  const openEdit = (record) => {
    setEditing(record);
    setForm(recordToForm(record));
  };

  const closeEditor = () => {
    if (isSaving) return;
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.morph_name.trim()) {
      toast({ title: 'Missing name', description: 'Morph name is required.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = formToRecord(form);
      if (editing?.id) {
        await MorphGuide.update(editing.id, payload);
        toast({ title: 'Updated', description: `${payload.morph_name} saved.` });
      } else {
        await MorphGuide.create(payload);
        toast({ title: 'Created', description: `${payload.morph_name} added.` });
      }
      await loadRecords();
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error('Save failed:', err);
      toast({ title: 'Error', description: err.message || 'Save failed.', variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setIsDeleting(true);
    try {
      await MorphGuide.delete(deleteTarget.id);
      toast({ title: 'Deleted', description: `${deleteTarget.morph_name} removed.` });
      setDeleteTarget(null);
      await loadRecords();
    } catch (err) {
      console.error('Delete failed:', err);
      toast({ title: 'Error', description: err.message || 'Delete failed.', variant: 'destructive' });
    }
    setIsDeleting(false);
  };

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Morph Guide Editor
            </CardTitle>
            <p className="text-sm text-slate-400 mt-1">
              {records.length} records · canonical reference for /MorphGuide and AI crawlers
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" /> New morph
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search morphs by name, rarity, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-slate-950 border-slate-700 text-slate-200"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">No morphs match.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-4 rounded-lg border border-slate-800 bg-slate-800/40 p-3 hover:border-slate-700 transition-colors"
              >
                {r.example_image_url ? (
                  <img
                    src={r.example_image_url}
                    alt={r.morph_name}
                    className="w-14 h-14 rounded-md object-cover bg-slate-900 border border-slate-700 shrink-0"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-md bg-slate-900 border border-slate-700 shrink-0 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-slate-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-slate-100">{r.morph_name}</h4>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        RARITY_COLORS[r.rarity] || 'bg-slate-700/40 text-slate-300 border-slate-600'
                      }`}
                    >
                      {r.rarity || 'unknown'}
                    </span>
                    {Array.isArray(r.key_features) && r.key_features.length > 0 && (
                      <span className="text-[10px] text-slate-500">
                        {r.key_features.length} features
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                    {r.description || '(no description)'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(r)}
                    className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeleteTarget(r)}
                    className="border-rose-900/50 bg-rose-950/30 hover:bg-rose-950/50 text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Editor dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit morph' : 'New morph'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              Records here power /MorphGuide, /MorphGuide/:slug, and the JSON-LD structured data
              that AI crawlers index.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="morph_name" className="text-slate-300">
                Morph name
              </Label>
              <Input
                id="morph_name"
                value={form.morph_name}
                onChange={(e) => setForm({ ...form, morph_name: e.target.value })}
                placeholder="e.g. Harlequin"
                className="bg-slate-950 border-slate-700 text-slate-100 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="rarity" className="text-slate-300">
                Rarity
              </Label>
              <Select
                value={form.rarity}
                onValueChange={(v) => setForm({ ...form, rarity: v })}
              >
                <SelectTrigger
                  id="rarity"
                  className="bg-slate-950 border-slate-700 text-slate-100 mt-1"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                  {RARITIES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description" className="text-slate-300">
                Description
              </Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Several paragraphs are fine ,  split with blank lines."
                className="bg-slate-950 border-slate-700 text-slate-100 mt-1 min-h-32"
              />
            </div>
            <div>
              <Label htmlFor="key_features" className="text-slate-300">
                Key features (one per line)
              </Label>
              <Textarea
                id="key_features"
                value={form.key_features}
                onChange={(e) => setForm({ ...form, key_features: e.target.value })}
                placeholder={'High contrast pattern\nBreaks across the dorsal\nLateral patches'}
                className="bg-slate-950 border-slate-700 text-slate-100 mt-1 min-h-24 font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="breeding_info" className="text-slate-300">
                Breeding info
              </Label>
              <Textarea
                id="breeding_info"
                value={form.breeding_info}
                onChange={(e) => setForm({ ...form, breeding_info: e.target.value })}
                placeholder="Inheritance pattern, common pairings, expected outcomes..."
                className="bg-slate-950 border-slate-700 text-slate-100 mt-1 min-h-24"
              />
            </div>
            <div>
              <Label htmlFor="example_image_url" className="text-slate-300">
                Example image URL
              </Label>
              <Input
                id="example_image_url"
                value={form.example_image_url}
                onChange={(e) => setForm({ ...form, example_image_url: e.target.value })}
                placeholder="https://..."
                className="bg-slate-950 border-slate-700 text-slate-100 mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeEditor}
              disabled={isSaving}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {editing?.id ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete morph guide?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently remove <strong>{deleteTarget?.morph_name}</strong> from the
              morph guide. Pages and search results referencing this morph will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
