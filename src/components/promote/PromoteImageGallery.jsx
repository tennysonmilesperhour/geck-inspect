import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Trash2, Tag, Loader2, Check, Image as ImageIcon } from 'lucide-react';
import { PromoteImage } from '@/entities/all';
import { supabase } from '@/lib/supabaseClient';
import { toast } from '@/components/ui/use-toast';
import { getTierLimits, formatBytes, bytesUsedPercent } from '@/lib/tierLimits';

// Promote-only image gallery.
//
// Users upload photos here exclusively for social posts. Images carry
// free-form label_tags (e.g. "lilly-white", "for-sale", "hatchling")
// so the composer can filter the picker.
//
// Storage: each row points at a public object inside the
// `promote-images` bucket. We use public URLs because Meta Graph API
// (IG / Facebook) needs to fetch the photo from a public location,
// and signed URLs that expire mid-publish are a pain.
//
// Modes:
//   - "manage": full gallery, upload, delete, edit tags.
//   - "picker": same gallery, but rows are selectable and the parent
//                callback receives the picked image_ids on Done.
export default function PromoteImageGallery({
  open, onOpenChange, user,
  mode = 'manage',                  // 'manage' | 'picker'
  initialSelectedIds = [],
  onPicked,                          // (selectedRows: PromoteImage[]) => void
}) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [filterTag, setFilterTag] = useState('');
  const [editingTagsFor, setEditingTagsFor] = useState(null); // image id
  const [tagDraft, setTagDraft] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set(initialSelectedIds));
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const tierLimits = useMemo(() => getTierLimits(user), [user]);
  const storageLimit = tierLimits.promoteImageStorageBytes;
  const countLimit = tierLimits.promoteImageMaxCount;

  const bytesUsed = useMemo(
    () => images.reduce((sum, i) => sum + (i.bytes || 0), 0),
    [images],
  );
  const overStorage = storageLimit != null && bytesUsed >= storageLimit;
  const overCount = countLimit != null && images.length >= countLimit;

  // All distinct tags across the user's library, for the filter row.
  const allTags = useMemo(() => {
    const s = new Set();
    images.forEach((i) => (i.label_tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [images]);

  const visibleImages = useMemo(() => {
    if (!filterTag) return images;
    return images.filter((i) => (i.label_tags || []).includes(filterTag));
  }, [images, filterTag]);

  const load = useCallback(async () => {
    if (!user?.auth_user_id) return;
    setLoading(true);
    try {
      const rows = await PromoteImage.filter({ user_id: user.auth_user_id }, '-created_date');
      setImages(rows || []);
    } catch (e) {
      console.warn('promote image load failed', e);
    } finally {
      setLoading(false);
    }
  }, [user?.auth_user_id]);

  useEffect(() => {
    if (open) {
      load();
      setSelectedIds(new Set(initialSelectedIds));
    }
    // initialSelectedIds intentionally omitted from deps; we resync
    // only when the modal re-opens, not on every parent rerender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, load]);

  const handleFiles = async (fileList) => {
    if (!user?.auth_user_id) return;
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    // Pre-flight checks against the tier caps.
    const incomingBytes = files.reduce((s, f) => s + f.size, 0);
    if (storageLimit != null && bytesUsed + incomingBytes > storageLimit) {
      toast({
        title: 'Storage limit',
        description: `Adding these ${files.length} would exceed your ${formatBytes(storageLimit)} promote-image quota. Delete some first or upgrade.`,
      });
      return;
    }
    if (countLimit != null && images.length + files.length > countLimit) {
      toast({
        title: 'Image count limit',
        description: `Your tier allows ${countLimit} promote images; you have ${images.length}.`,
      });
      return;
    }

    setUploading(true);
    setProgress({ done: 0, total: files.length });

    const uploadedRows = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // Per-user folder so the storage RLS picks up the right
        // owner. Use a random suffix to avoid name collisions across
        // many uploads of the same filename (common on iPhone where
        // every photo is "IMG_1234.jpg").
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user.auth_user_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadErr } = await supabase
          .storage
          .from('promote-images')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadErr) throw uploadErr;

        const { data: publicUrlData } = supabase
          .storage
          .from('promote-images')
          .getPublicUrl(path);
        const publicUrl = publicUrlData?.publicUrl || '';

        const row = await PromoteImage.create({
          user_id: user.auth_user_id,
          storage_path: path,
          public_url: publicUrl,
          bytes: file.size,
          mime_type: file.type,
          label_tags: [],
        });
        uploadedRows.push(row);
      } catch (e) {
        console.warn('upload failed', file.name, e);
        toast({ title: `Upload failed: ${file.name}`, description: String(e?.message || e) });
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }

    setImages((prev) => [...uploadedRows, ...prev]);
    setUploading(false);
    toast({ title: `Uploaded ${uploadedRows.length} of ${files.length}` });
  };

  const handleDelete = async (img) => {
    if (!confirm('Delete this image? Posts that used it will lose the reference.')) return;
    try {
      // Best-effort remove from storage; the DB row deletion is what
      // actually frees the quota.
      try { await supabase.storage.from('promote-images').remove([img.storage_path]); } catch { /* ignore */ }
      await PromoteImage.delete(img.id);
      setImages((prev) => prev.filter((i) => i.id !== img.id));
    } catch (e) {
      toast({ title: 'Delete failed', description: String(e?.message || e) });
    }
  };

  const handleSaveTags = async (img) => {
    const tags = tagDraft.split(/[, ]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    try {
      const updated = await PromoteImage.update(img.id, { label_tags: tags });
      setImages((prev) => prev.map((i) => (i.id === img.id ? updated : i)));
      setEditingTagsFor(null);
      setTagDraft('');
    } catch (e) {
      toast({ title: 'Save tags failed', description: String(e?.message || e) });
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDonePicking = () => {
    const rows = images.filter((i) => selectedIds.has(i.id));
    onPicked?.(rows);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[100vw] sm:w-auto max-h-[100vh] sm:max-h-[90vh] h-[100vh] sm:h-auto sm:rounded-lg rounded-none overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-emerald-400" />
            {mode === 'picker' ? 'Pick images for this post' : 'Promote image library'}
          </DialogTitle>
          <DialogDescription>
            Photos here are only used for social posts. On phone, the upload picker pulls from iCloud Photos / Google Photos automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Usage meter */}
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-emerald-200/80">
                {formatBytes(bytesUsed)} of {formatBytes(storageLimit)} used
                {countLimit != null && (
                  <span className="text-emerald-300/60 ml-2">
                    · {images.length}/{countLimit} images
                  </span>
                )}
              </span>
              <span className="text-emerald-300/60">
                {tierLimits.label} tier
              </span>
            </div>
            <div className="h-1.5 bg-emerald-950/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${overStorage ? 'bg-red-500' : bytesUsedPercent(bytesUsed, storageLimit) > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${bytesUsedPercent(bytesUsed, storageLimit)}%` }}
              />
            </div>
          </div>

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              dragOver
                ? 'border-emerald-500 bg-emerald-900/30'
                : 'border-emerald-800/40 bg-emerald-950/20'
            } ${(overStorage || overCount) ? 'opacity-50' : ''}`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*"
              hidden
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Upload className="w-6 h-6 mx-auto text-emerald-300/70 mb-1" />
            <div className="text-sm text-emerald-100">
              Drop images here, or{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading || overStorage || overCount}
                className="underline text-emerald-300 hover:text-emerald-100 disabled:opacity-50"
              >
                browse
              </button>
              {uploading && (
                <span className="text-emerald-300/70 ml-2">
                  <Loader2 className="inline w-3 h-3 animate-spin mr-1" />
                  {progress.done}/{progress.total}
                </span>
              )}
            </div>
            {(overStorage || overCount) && (
              <div className="text-xs text-amber-300 mt-1">
                {overStorage ? 'Storage cap reached. ' : ''}
                {overCount ? 'Image-count cap reached. ' : ''}
                Delete some or upgrade.
              </div>
            )}
          </div>

          {/* Tag filter row */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center text-xs">
              <Tag className="w-3 h-3 text-emerald-300/70" />
              <button
                type="button"
                onClick={() => setFilterTag('')}
                className={`px-2 py-0.5 rounded-full border ${
                  filterTag === ''
                    ? 'bg-emerald-600/40 border-emerald-500/60 text-emerald-50'
                    : 'border-emerald-800/50 text-emerald-200/80 hover:bg-emerald-900/30'
                }`}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterTag(t)}
                  className={`px-2 py-0.5 rounded-full border ${
                    filterTag === t
                      ? 'bg-emerald-600/40 border-emerald-500/60 text-emerald-50'
                      : 'border-emerald-800/50 text-emerald-200/80 hover:bg-emerald-900/30'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="text-center py-8 text-emerald-300/70 text-sm">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" />
              Loading…
            </div>
          ) : visibleImages.length === 0 ? (
            <div className="text-center py-8 text-emerald-300/60 text-sm">
              {filterTag ? `No images tagged #${filterTag} yet.` : 'No images yet. Upload your first batch above.'}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {visibleImages.map((img) => {
                const selected = selectedIds.has(img.id);
                return (
                  <div
                    key={img.id}
                    className={`relative rounded-md overflow-hidden border transition-colors ${
                      selected
                        ? 'border-emerald-400 ring-2 ring-emerald-500/40'
                        : 'border-emerald-800/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => mode === 'picker' && toggleSelect(img.id)}
                      className="block w-full aspect-square bg-emerald-950/40"
                      disabled={mode !== 'picker'}
                    >
                      <img
                        src={img.public_url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </button>
                    {selected && (
                      <div className="absolute top-1 left-1 bg-emerald-500 rounded-full p-0.5">
                        <Check className="w-3 h-3 text-emerald-950" />
                      </div>
                    )}
                    {/* Tag editor */}
                    <div className="p-1.5 bg-emerald-950/70">
                      {editingTagsFor === img.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            placeholder="tag1, tag2"
                            className="text-[10px] h-6 px-1"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveTags(img)}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTags(img)}
                            className="text-emerald-300 hover:text-emerald-100"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTagsFor(img.id);
                            setTagDraft((img.label_tags || []).join(', '));
                          }}
                          className="w-full text-left text-[10px] text-emerald-200/80 hover:text-emerald-100 truncate"
                        >
                          {(img.label_tags || []).length === 0
                            ? '+ tag'
                            : (img.label_tags || []).map((t) => `#${t}`).join(' ')}
                        </button>
                      )}
                    </div>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(img)}
                      className="absolute top-1 right-1 bg-red-900/80 hover:bg-red-700 rounded p-0.5 text-red-100"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {mode === 'picker' && (
            <div className="sticky bottom-0 sm:static -mx-3 sm:mx-0 sm:p-0 px-3 py-2 bg-emerald-950/95 backdrop-blur-md sm:bg-transparent flex items-center justify-between gap-2 border-t border-emerald-900/40">
              <div className="text-xs text-emerald-200/70">
                {selectedIds.size} selected
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDonePicking}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  Use {selectedIds.size > 0 ? `${selectedIds.size} image${selectedIds.size === 1 ? '' : 's'}` : 'none'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
