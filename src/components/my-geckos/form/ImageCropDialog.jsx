import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Click-and-drag image crop dialog.
 *
 * Used by GeckoForm to let the user pick the focus point for a gecko's
 * thumbnail (stored as { x, y } in percent of the image container).
 * Supports both mouse and touch. Self-contained — no external state.
 */
export default function ImageCropDialog({ imageUrl, initialCrop, onSave, onClose }) {
  const [cropPosition, setCropPosition] = useState(initialCrop || { x: 50, y: 50 });
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

  const handleSave = () => onSave(cropPosition);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle>Adjust Thumbnail Position</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Click and drag on the image to set the thumbnail&rsquo;s focus point.
          </p>
        </DialogHeader>
        <div className="space-y-4">
          <div
            ref={imageContainerRef}
            className="w-full h-64 rounded overflow-hidden border border-input relative cursor-move"
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
              className="w-full h-full object-cover pointer-events-none"
              style={{ objectPosition: `${cropPosition.x}% ${cropPosition.y}%` }}
            />
            <div
              className="absolute w-4 h-4 bg-white/50 rounded-full border-2 border-white pointer-events-none"
              style={{
                left: `calc(${cropPosition.x}% - 8px)`,
                top: `calc(${cropPosition.y}% - 8px)`,
              }}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">Save Position</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
