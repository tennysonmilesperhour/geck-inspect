import { useEffect, useRef, useState } from 'react';
import { UploadFile } from '@/integrations/Core';
import { useToast } from '@/components/ui/use-toast';
import { Upload, X, Loader2, Star, StarOff } from 'lucide-react';

export const MAX_PHOTOS = 5;

// Multi-file photo uploader for a single gecko submission.
//
// Lifts ALL state up through `onChange` so the parent has the single source
// of truth about urls (primary first). Each photo lives at one of three
// lifecycle points:
//   pending  - still uploading, no url yet
//   ready    - uploaded, url present
//   failed   - upload errored, can be retried/removed
//
// Parent gets just the ready urls in primary-first order via onChange.
export default function MultiPhotoUploader({
  value = [],
  onChange,
  max = MAX_PHOTOS,
  label = 'Photos',
}) {
  const [items, setItems] = useState(() =>
    value.map((url) => ({ id: url, url, status: 'ready', name: null, previewUrl: url })),
  );
  const inputRef = useRef(null);
  const { toast } = useToast();

  const emit = (next) => {
    const urls = next.filter((i) => i.status === 'ready').map((i) => i.url);
    onChange?.(urls);
  };

  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => {
    // On unmount free every blob URL we minted so long-running tabs don't leak.
    for (const i of itemsRef.current) {
      if (i.previewUrl && i.previewUrl.startsWith('blob:')) URL.revokeObjectURL(i.previewUrl);
    }
  }, []);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const room = max - items.length;
    if (room <= 0) {
      toast({
        title: 'Photo limit reached',
        description: `Up to ${max} photos per submission — remove one to add another.`,
        variant: 'destructive',
      });
      return;
    }
    const toUpload = files.slice(0, room);
    if (files.length > room) {
      toast({
        title: 'Some photos skipped',
        description: `Capped at ${max} per submission; kept the first ${room}.`,
      });
    }

    const newItems = toUpload.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: f,
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      url: null,
      status: 'pending',
    }));
    setItems((prev) => {
      const next = [...prev, ...newItems];
      emit(next);
      return next;
    });

    for (const it of newItems) {
      try {
        const { file_url } = await UploadFile({ file: it.file });
        setItems((prev) => {
          const next = prev.map((p) =>
            p.id === it.id ? { ...p, url: file_url, status: 'ready' } : p,
          );
          emit(next);
          return next;
        });
      } catch (err) {
        setItems((prev) => {
          const next = prev.map((p) =>
            p.id === it.id ? { ...p, status: 'failed', error: err.message } : p,
          );
          emit(next);
          return next;
        });
        toast({
          title: `Upload failed for ${it.name}`,
          description: err.message,
          variant: 'destructive',
        });
      }
    }
  };

  const remove = (id) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((p) => p.id !== id);
      emit(next);
      return next;
    });
  };

  const makePrimary = (id) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx <= 0) return prev;
      const next = [prev[idx], ...prev.slice(0, idx), ...prev.slice(idx + 1)];
      emit(next);
      return next;
    });
  };

  const hasRoom = items.length < max;
  const uploadingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">
          {label} <span className="text-slate-500">({items.length} / {max})</span>
        </p>
        {uploadingCount > 0 && (
          <span className="text-xs text-emerald-300 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> uploading {uploadingCount}…
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            className={`relative rounded-lg overflow-hidden border ${
              item.status === 'failed'
                ? 'border-rose-500'
                : i === 0
                  ? 'border-emerald-500'
                  : 'border-slate-700'
            }`}
          >
            <img
              src={item.previewUrl || item.url}
              alt={item.name || 'Gecko photo'}
              className="w-full aspect-square object-cover bg-slate-800"
            />
            {item.status === 'pending' && (
              <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
              </div>
            )}
            {item.status === 'failed' && (
              <div className="absolute inset-0 bg-rose-950/70 flex items-center justify-center text-rose-200 text-xs p-2 text-center">
                upload failed
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 rounded-full"
              aria-label="Remove photo"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
            {i === 0 ? (
              <span className="absolute bottom-1 left-1 text-[10px] uppercase tracking-wide bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                primary
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makePrimary(item.id)}
                disabled={item.status !== 'ready'}
                className="absolute bottom-1 left-1 p-1 bg-black/60 hover:bg-emerald-600 rounded-full disabled:opacity-40"
                aria-label="Make primary"
                title="Make this the primary / cover photo"
              >
                {item.status === 'ready'
                  ? <Star className="w-3 h-3 text-white" />
                  : <StarOff className="w-3 h-3 text-white" />}
              </button>
            )}
          </div>
        ))}

        {hasRoom && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-600 hover:border-emerald-500 hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-emerald-300"
          >
            <Upload className="w-6 h-6 mb-1" />
            <span className="text-xs">Add photo</span>
            <span className="text-[10px] text-slate-500">{max - items.length} remaining</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      <p className="text-xs text-slate-500">
        First photo is the cover / primary used for the AI analysis. Others
        add context — different angles, fired states, close-ups of the dorsum or face.
      </p>
    </div>
  );
}
