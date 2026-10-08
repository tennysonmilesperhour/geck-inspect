import { useEffect, useRef, useState } from 'react';
import { UploadFile } from '@/integrations/Core';
import { useToast } from '@/components/ui/use-toast';
import { Upload, X, Loader2, Check } from 'lucide-react';
import { isNativePlatform } from '@/lib/revenuecat';
import { captureDevicePhoto } from '@/lib/devicePhoto';
import { MAX_EXTRA_VIEWS, REQUIRED_VIEWS, orderedViewUrls, viewsReady } from './photoViews';

// Morph ID photo slots (Tennyson, 29 Sep 2026): a top view and a side view
// are required, a third photo is encouraged, anything past two is optional.
// Pattern on the back (pinning, dorsal pattern) shows from above; flank
// pattern, lateral pinning and leg coverage (the Extreme Harlequin call)
// show from the side. The top view goes first because it is the photo the
// reference lookup compares.
//
// onChange({ urls, ready }) gets the uploaded urls in slot order and
// whether both required views are in.

function Slot({ label, hint, required, item, onPick, onRemove }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-200">
          {label}{' '}
          <span className={required ? 'text-amber-300 text-xs' : 'text-slate-500 text-xs'}>
            {required ? 'required' : 'optional'}
          </span>
        </p>
        {item?.status === 'ready' && <Check className="w-4 h-4 text-emerald-400" />}
      </div>
      {item ? (
        <div className={`relative rounded-lg overflow-hidden border ${item.status === 'failed' ? 'border-rose-500' : 'border-slate-700'}`}>
          <img src={item.previewUrl || item.url} alt={label} className="w-full aspect-square object-cover bg-slate-800" />
          {item.status === 'pending' && (
            <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-300" />
            </div>
          )}
          {item.status === 'failed' && (
            <div className="absolute inset-0 bg-rose-950/70 flex items-center justify-center text-rose-200 text-xs p-2 text-center">
              Upload failed. Remove it and try again.
            </div>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 p-2 bg-black/70 hover:bg-rose-600 rounded-full min-w-11 min-h-11 grid place-items-center"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onPick}
          className={`touch:min-h-11 w-full aspect-square flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-3 text-center transition-colors ${
            required
              ? 'border-amber-600/60 hover:border-emerald-500 text-slate-300'
              : 'border-slate-600 hover:border-emerald-500 text-slate-400'
          } hover:bg-slate-800/50 hover:text-emerald-300`}
        >
          <Upload className="w-6 h-6" />
          <span className="text-xs font-medium">Add {label.toLowerCase()}</span>
          <span className="text-[11px] text-slate-500 leading-snug">{hint}</span>
        </button>
      )}
    </div>
  );
}

export default function ViewPhotoUploader({ onChange, onBusyChange }) {
  const [slots, setSlots] = useState({ top: null, side: null, extras: [] });
  const inputRef = useRef(null);
  const targetRef = useRef(null); // 'top' | 'side' | 'extra'
  const { toast } = useToast();

  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  useEffect(() => () => {
    const all = [slotsRef.current.top, slotsRef.current.side, ...slotsRef.current.extras];
    for (const i of all) if (i?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(i.previewUrl);
  }, []);

  useEffect(() => {
    onChange?.({ urls: orderedViewUrls(slots), ready: viewsReady(slots) });
    const busy = [slots.top, slots.side, ...slots.extras].some((i) => i?.status === 'pending');
    onBusyChange?.(busy);
    // onChange and onBusyChange are parent callbacks; slots is the source of truth.
  }, [slots]);

  const update = (id, patch) => setSlots((prev) => ({
    top: prev.top?.id === id ? { ...prev.top, ...patch } : prev.top,
    side: prev.side?.id === id ? { ...prev.side, ...patch } : prev.side,
    extras: prev.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }));

  const pick = async (target) => {
    targetRef.current = target;
    if (isNativePlatform()) {
      try {
        const file = await captureDevicePhoto();
        if (file) await handleFiles([file]);
      } catch (err) {
        toast({ title: 'Could not open the camera', description: err.message || 'Try again.', variant: 'destructive' });
      }
      return;
    }
    inputRef.current?.click();
  };

  const handleFiles = async (fileList) => {
    const target = targetRef.current;
    let files = Array.from(fileList || []);
    if (!files.length || !target) return;
    if (target !== 'extra') files = files.slice(0, 1);
    else files = files.slice(0, MAX_EXTRA_VIEWS - slotsRef.current.extras.length);
    if (!files.length) return;

    const items = files.map((f) => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      file: f,
      previewUrl: URL.createObjectURL(f),
      url: null,
      status: 'pending',
    }));
    setSlots((prev) => (target === 'extra'
      ? { ...prev, extras: [...prev.extras, ...items] }
      : { ...prev, [target]: items[0] }));

    for (const item of items) {
      try {
        const { file_url } = await UploadFile({ file: item.file });
        if (item.previewUrl.startsWith('blob:')) URL.revokeObjectURL(item.previewUrl);
        update(item.id, { url: file_url, previewUrl: file_url, status: 'ready' });
      } catch (err) {
        update(item.id, { status: 'failed' });
        toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      }
    }
  };

  const remove = (id) => setSlots((prev) => {
    const gone = [prev.top, prev.side, ...prev.extras].find((i) => i?.id === id);
    if (gone?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(gone.previewUrl);
    return {
      top: prev.top?.id === id ? null : prev.top,
      side: prev.side?.id === id ? null : prev.side,
      extras: prev.extras.filter((e) => e.id !== id),
    };
  });

  const ready = viewsReady(slots);
  const extrasRoom = MAX_EXTRA_VIEWS - slots.extras.length;

  return (
    <div className="space-y-4 max-w-lg">
      <div className="grid grid-cols-2 gap-3">
        {REQUIRED_VIEWS.map((view) => (
          <Slot
            key={view.key}
            label={view.label}
            hint={view.hint}
            required
            item={slots[view.key]}
            onPick={() => pick(view.key)}
            onRemove={() => remove(slots[view.key].id)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-200">
          More photos <span className="text-slate-500 text-xs">optional, up to {MAX_EXTRA_VIEWS}</span>
        </p>
        <p className="text-xs text-slate-400">
          A third photo helps if you can: the other side, the gecko fired up or fired down, or a close-up of the pattern.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {slots.extras.map((item, i) => (
            <Slot
              key={item.id}
              label={`Photo ${i + 3}`}
              hint=""
              item={item}
              onRemove={() => remove(item.id)}
            />
          ))}
          {extrasRoom > 0 && (
            <button
              type="button"
              onClick={() => pick('extra')}
              className="touch:min-h-11 aspect-square self-end flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-600 hover:border-emerald-500 hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-emerald-300"
            >
              <Upload className="w-5 h-5 mb-1" />
              <span className="text-xs">Add photo</span>
            </button>
          )}
        </div>
      </div>

      {!ready && (
        <p className="text-xs text-amber-200/90">Add a top view and a side view to identify the morph.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
