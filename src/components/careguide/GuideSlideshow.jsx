import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import GuideSlide from './GuideSlide';

export default function GuideSlideshow({ guide }) {
  const [index, setIndex] = useState(0);
  const containerRef = useRef(null);
  const slides = guide?.slides || [];
  const total = slides.length;

  useEffect(() => {
    setIndex(0);
  }, [guide?.id]);

  const goto = useCallback(
    (next) => {
      if (total === 0) return;
      const clamped = Math.max(0, Math.min(total - 1, next));
      setIndex(clamped);
    },
    [total],
  );

  const prev = useCallback(() => goto(index - 1), [goto, index]);
  const next = useCallback(() => goto(index + 1), [goto, index]);

  useEffect(() => {
    const onKey = (e) => {
      if (!containerRef.current) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  if (!guide || total === 0) return null;

  const slide = slides[index];

  return (
    <div ref={containerRef} className="space-y-4">
      {/* Guide meta + progress */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/80 font-bold">
            Keeper's Guide {guide.number}
          </div>
          <div className="font-serif text-lg md:text-xl font-bold text-slate-100 truncate">
            {guide.title}
          </div>
        </div>
        <div className="flex-shrink-0 text-sm text-slate-400 tabular-nums">
          {index + 1} / {total}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500 transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      {/* Slide */}
      <GuideSlide slide={slide} number={index + 1} total={total} />

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={prev}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:border-emerald-500/50 hover:text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-1 overflow-x-auto max-w-[45%] md:max-w-[55%]">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goto(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`flex-shrink-0 h-2 rounded-full transition-all ${
                i === index
                  ? 'w-6 bg-emerald-400'
                  : 'w-2 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={index === total - 1}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/20 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-600/30 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
