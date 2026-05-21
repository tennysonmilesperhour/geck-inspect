import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw, RotateCw } from 'lucide-react';

/**
 * Crop + rotate dialog for a gecko photo.
 *
 * Click-and-drag on the preview to set the thumbnail focal point
 * (stored as { x, y } in percent of the container). Two rotate
 * buttons step the photo in 90° increments and persist as
 * `rotation` (0/90/180/270). Returns the full meta object to the
 * caller, which merges it back into image_crop_data[url].
 *
 * Rotation is applied via CSS transform when the image renders;
 * the underlying file is never modified, so it's reversible.
 */
export default function ImageCropDialog({ imageUrl, initialCrop, onSave, onClose }) {
  const initial = initialCrop || {};
  const [cropPosition, setCropPosition] = useState({
    x: typeof initial.x === 'number' ? initial.x : 50,
    y: typeof initial.y === 'number' ? initial.y : 50,
  });
  const [rotation, setRotation] = useState(initial.rotation || 0);
  const imageContainerRef = useRef(null);
  const isDragging = useRef(false);

  const updatePosition = (e) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setCropPosition({ x, y });
  };

  const handleInteractionStart = (e) => {
    e.preventDefault();
    isDragging.current = true;
    updatePosition(e);
  };

  const handleInteractionEnd = (e) => {
    e.preventDefault();
    isDragging.current = false;
  };

  const handleInteractionMove = (e) => {
    e.preventDefault();
    if (isDragging.current) updatePosition(e);
  };

  const rotateBy = (delta) => {
    setRotation((prev) => {
      const next = (prev + delta + 360) % 360;
      return next;
    });
  };

  const handleSave = () => onSave({ ...cropPosition, rotation });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle>Crop & Rotate</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Drag on the photo to set the thumbnail&rsquo;s focal point. Use the rotate buttons to spin the photo in 90&deg; steps.
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div
            ref={imageContainerRef}
            className="w-full h-64 rounded overflow-hidden border border-input relative cursor-move bg-slate-950"
            onMouseDown={handleInteractionStart}
            onMouseMove={handleInteractionMove}
            onMouseUp={handleInteractionEnd}
            onMouseLeave={handleInteractionEnd}
            onTouchStart={handleInteractionStart}
            onTouchMove={handleInteractionMove}
            onTouchEnd={handleInteractionEnd}
          >
            <img
              src={imageUrl}
              alt="Crop preview"
              className="w-full h-full object-cover pointer-events-none transition-transform"
              style={{
                objectPosition: `${cropPosition.x}% ${cropPosition.y}%`,
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
              }}
            />
            <div
              className="absolute w-4 h-4 bg-white/50 rounded-full border-2 border-white pointer-events-none"
              style={{
                left: `calc(${cropPosition.x}% - 8px)`,
                top: `calc(${cropPosition.y}% - 8px)`,
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => rotateBy(-90)} title="Rotate left 90°">
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => rotateBy(90)} title="Rotate right 90°">
                <RotateCw className="w-4 h-4" />
              </Button>
              <span className="text-xs text-slate-400 self-center">{rotation}&deg;</span>
            </div>
            {rotation !== 0 && (
              <Button type="button" variant="ghost" size="sm" className="text-slate-400" onClick={() => setRotation(0)}>
                Reset rotation
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">Save</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
