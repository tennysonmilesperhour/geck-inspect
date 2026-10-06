import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { normalizePhotoCrop } from '@/lib/store/customSticker';

export default function StickerPhotoEditor({ design, onChange, onSaveCutout, disabled }) {
  const crop = normalizePhotoCrop(design.photo_crop);
  const [open, setOpen] = useState(false);
  const [brush, setBrush] = useState(32);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);
  const originalRef = useRef(null);
  const drawingRef = useRef(false);
  const previousRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false); setDirty(false); setError('');
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      const context = canvas.getContext('2d');
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      try { originalRef.current = context.getImageData(0, 0, canvas.width, canvas.height); setReady(true); }
      catch { setError('This photo cannot be edited here. Upload a PNG cutout instead.'); }
    };
    img.onerror = () => { if (!cancelled) setError('This photo could not load. Try uploading it again.'); };
    img.src = design.photo_url;
    return () => { cancelled = true; };
  }, [open, design.photo_url]);

  function erase(event) {
    if (!drawingRef.current || !ready) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    const radius = brush * canvas.width / rect.width / 2;
    const context = canvas.getContext('2d');
    context.globalCompositeOperation = 'destination-out'; context.lineWidth = radius * 2;
    context.lineCap = 'round'; context.lineJoin = 'round';
    if (previousRef.current) { context.beginPath(); context.moveTo(previousRef.current.x, previousRef.current.y); context.lineTo(x, y); context.stroke(); }
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
    context.globalCompositeOperation = 'source-over'; previousRef.current = { x, y }; setDirty(true);
  }

  async function save() {
    setSaving(true); setError('');
    try {
      const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not save the cutout.');
      await onSaveCutout(new File([blob], 'gecko-cutout.png', { type: 'image/png' }));
      setOpen(false);
    } catch (e) { setError(e.message || 'The cutout could not be saved.'); }
    finally { setSaving(false); }
  }

  return <div className="mt-4 space-y-3">
    <p className="text-xs text-slate-400">Watch the preview while you position your gecko. Anything outside the photo window is trimmed.</p>
    {[
      ['x', 'Horizontal position', 0, 100, 1], ['y', 'Vertical position', 0, 100, 1], ['zoom', 'Zoom', 1, 3, 0.05],
    ].map(([key, label, min, max, step]) => <label key={key} className="flex items-center gap-3 text-xs text-slate-300">
      <span className="w-32 shrink-0">{label}</span><input type="range" min={min} max={max} step={step} value={crop[key]} aria-label={label} disabled={disabled} className="w-full accent-emerald-400" onChange={(e) => onChange({ photo_crop: { ...crop, [key]: Number(e.target.value) } })} />
    </label>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange({ photo_crop: { x: 50, y: 50, zoom: 1 } })}>Reset crop</Button>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>Make a clean cutout</Button>
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange({ photo_treatment: design.photo_treatment === 'cutout' ? 'original' : 'cutout' })}>{design.photo_treatment === 'cutout' ? 'Fill photo window' : 'Fit whole photo / cutout'}</Button>
    </div>
    <p className="text-[11px] text-slate-500">Already have a transparent PNG? Upload it and choose “Fit whole photo / cutout.”</p>
    <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
      <DialogContent className="bg-slate-950 border-slate-700 text-slate-100 max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Make a clean cutout</DialogTitle><DialogDescription>Brush over the background to erase it. The checkerboard is transparent. Keep the toes and tail, then save a new copy for your sticker.</DialogDescription></DialogHeader>
        <div className="rounded-lg overflow-hidden" style={{ background: 'repeating-conic-gradient(#d7d7d7 0% 25%, #f1f1f1 0% 50%) 0 0 / 20px 20px' }}>
          <canvas ref={canvasRef} role="img" aria-label="Photo background eraser" className="w-full block touch-none cursor-crosshair" onPointerDown={(e) => { if (!ready || saving) return; drawingRef.current = true; previousRef.current = null; e.currentTarget.setPointerCapture(e.pointerId); erase(e); }} onPointerMove={erase} onPointerUp={() => { drawingRef.current = false; previousRef.current = null; }} onPointerCancel={() => { drawingRef.current = false; previousRef.current = null; }} />
        </div>
        <label className="flex items-center gap-3 text-sm">Brush size<input type="range" min="8" max="100" value={brush} aria-label="Eraser brush size" className="flex-1 accent-emerald-400" onChange={(e) => setBrush(Number(e.target.value))} /></label>
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
        <div className="flex justify-between gap-2"><Button variant="outline" disabled={!ready || saving} onClick={() => { canvasRef.current.getContext('2d').putImageData(originalRef.current, 0, 0); setDirty(false); }}>Restore original</Button><Button disabled={!ready || !dirty || saving} onClick={save}>{saving ? 'Saving…' : 'Save cutout'}</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
