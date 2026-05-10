import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Auto-advancing image carousel. `urls` is an array of image URLs; the
// primary (first) one is considered the cover. Hovering pauses. Single-
// image callers get a plain <img> ,  no carousel chrome.
export default function PhotoSlideshow({
  urls = [],
  alt = 'Gecko',
  intervalMs = 3500,
  className = '',
  maxHeightClass = 'max-h-[500px]',
}) {
  const normalized = useMemo(
    () => (Array.isArray(urls) ? urls.filter(Boolean) : []),
    [urls],
  );
  const [idx, setIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => { setIdx(0); }, [normalized.length]);

  useEffect(() => {
    if (normalized.length < 2 || isPaused) return undefined;
    const t = setInterval(
      () => setIdx((i) => (i + 1) % normalized.length),
      intervalMs,
    );
    return () => clearInterval(t);
  }, [normalized.length, isPaused, intervalMs]);

  if (normalized.length === 0) return null;
  if (normalized.length === 1) {
    return (
      <img
        src={normalized[0]}
        alt={alt}
        className={`w-full ${maxHeightClass} object-contain rounded-lg border border-slate-700 bg-slate-800 ${className}`}
      />
    );
  }

  const step = (delta) =>
    setIdx((i) => (i + delta + normalized.length) % normalized.length);

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <img
        src={normalized[idx]}
        alt={`${alt} ${idx + 1} of ${normalized.length}`}
        className={`w-full ${maxHeightClass} object-contain rounded-lg border border-slate-700 bg-slate-800`}
      />
      <Button
        variant="secondary"
        size="icon"
        onClick={() => step(-1)}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={() => step(1)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
        <span>{idx + 1} / {normalized.length}</span>
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          className="hover:text-emerald-300"
          aria-label={isPaused ? 'Play slideshow' : 'Pause slideshow'}
        >
          {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
        </button>
      </div>
      <div className="absolute bottom-2 right-2 flex gap-1">
        {normalized.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === idx ? 'bg-emerald-400' : 'bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Show photo ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
