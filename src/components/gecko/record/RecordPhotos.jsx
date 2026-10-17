import { useMemo, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Images, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_GECKO_CARD } from '@/lib/constants';
import GeckoImage from '@/components/shared/GeckoImage';
import SmartImage from '@/components/shared/SmartImage';
import FireStatePair from '@/components/shared/FireStatePair';
import { hasFireStatePhotos } from '@/lib/fireStatePhotos';
import useModalOverlay from '@/hooks/useModalOverlay';
import RecordCard from './RecordCard';

// Life stages a keeper can tag on a photo in the edit form, in growth order
// (the same ids as LIFE_STAGES in src/components/my-geckos/form).
const LIFE_STAGE_ORDER = ['hatchling', '3mo', '6mo', '1yr', '2yr', 'adult'];
const LIFE_STAGE_LABELS = {
  hatchling: 'Hatchling',
  '3mo': '3 months',
  '6mo': '6 months',
  '1yr': '1 year',
  '2yr': '2 years',
  adult: 'Adult',
};

const rotationStyle = (gecko, url) => {
  const rotation = url ? gecko?.image_crop_data?.[url]?.rotation : null;
  return rotation ? { transform: `rotate(${rotation}deg)` } : undefined;
};

/** Photos tagged with a life stage, oldest stage first. */
export function lifeStageSlides(gecko) {
  if (!gecko?.image_urls?.length) return [];
  const cropData = gecko.image_crop_data || {};
  return gecko.image_urls
    .map((url) => ({ url, stage: cropData[url]?.life_stage }))
    .filter((s) => s.stage && LIFE_STAGE_ORDER.includes(s.stage))
    .sort((a, b) => LIFE_STAGE_ORDER.indexOf(a.stage) - LIFE_STAGE_ORDER.indexOf(b.stage));
}

/** True when the record has more to show than the one photo in its header. */
export function hasMorePhotos(gecko) {
  const slideshow = Boolean(gecko?.growth_slideshow_enabled) && lifeStageSlides(gecko).length > 0;
  return (gecko?.image_urls?.length || 0) > 1 || hasFireStatePhotos(gecko) || slideshow;
}

/** The main photo, small on a phone so the parents and value stay in view. */
export function RecordPhoto({ gecko, onOpen }) {
  const url = gecko?.image_urls?.[0];
  const image = (
    <SmartImage
      gecko={gecko}
      src={url}
      alt={gecko?.name || 'Gecko'}
      width={480}
      aspect="square"
      containerClassName="w-24 h-24 sm:w-40 sm:h-40 rounded-xl"
      className="object-cover"
      style={rotationStyle(gecko, url)}
      fallback={DEFAULT_GECKO_CARD}
    />
  );
  if (!url || !onOpen) return <div className="shrink-0">{image}</div>;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
      aria-label={`Open ${gecko?.name || 'the gecko'}'s photos`}
    >
      {image}
    </button>
  );
}

/** Full-screen photo viewer with previous and next. */
export function PhotoLightbox({ gecko, index, onIndex, onClose }) {
  // Dialog role, Escape to close, and the data-state the floating-widget
  // hide rule needs (see useModalOverlay).
  const overlay = useModalOverlay(onClose);
  const urls = gecko?.image_urls || [];
  if (!urls.length) return null;
  const at = Math.min(Math.max(0, index), urls.length - 1);
  return (
    <div
      {...overlay}
      aria-label={`${gecko?.name || 'Gecko'} photos`}
      className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Button variant="secondary" size="icon" className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 z-10" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close photos">
        <X className="w-5 h-5" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
        disabled={at === 0}
        onClick={(e) => { e.stopPropagation(); onIndex(Math.max(0, at - 1)); }}
        aria-label="Previous photo"
      >
        <ChevronLeft className="w-5 h-5" />
      </Button>
      <GeckoImage
        gecko={gecko}
        src={urls[at]}
        alt={`${gecko?.name || 'Gecko'} ${at + 1}`}
        className="max-h-[85vh] max-w-full object-contain rounded-lg"
        style={rotationStyle(gecko, urls[at])}
        onClick={(e) => e.stopPropagation()}
      />
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
        disabled={at === urls.length - 1}
        onClick={(e) => { e.stopPropagation(); onIndex(Math.min(urls.length - 1, at + 1)); }}
        aria-label="Next photo"
      >
        <ChevronRight className="w-5 h-5" />
      </Button>
      <div className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] text-slate-300 text-sm">{at + 1} / {urls.length}</div>
    </div>
  );
}

/** Photos tagged by life stage, as a step-through slideshow. */
function GrowthSlideshow({ gecko, slides }) {
  const [index, setIndex] = useState(0);
  const at = Math.min(index, slides.length - 1);
  const slide = slides[at];
  if (!slide) return null;
  const label = LIFE_STAGE_LABELS[slide.stage] || slide.stage;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
        <Camera className="w-4 h-4 text-emerald-400" /> Growth slideshow
      </p>
      <div className="flex flex-wrap gap-1 touch:gap-2" role="group" aria-label="Life stage">
        {slides.map((s, i) => (
          <Button
            key={s.url}
            type="button"
            size="sm"
            variant={at === i ? 'default' : 'outline'}
            aria-pressed={at === i}
            onClick={() => setIndex(i)}
          >
            {LIFE_STAGE_LABELS[s.stage] || s.stage}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIndex(Math.max(0, at - 1))}
          disabled={at === 0}
          aria-label="Earlier stage"
          className="shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="relative flex-1 rounded-lg overflow-hidden bg-slate-800 min-h-[160px]">
          <SmartImage
            key={`slide-${slide.url}`}
            gecko={gecko}
            src={slide.url}
            alt={`${gecko?.name || 'Gecko'} at ${label}`}
            width={800}
            aspect="auto"
            containerClassName="w-full max-h-64"
            className="object-contain"
            style={rotationStyle(gecko, slide.url)}
            fallback={DEFAULT_GECKO_CARD}
          />
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {label} · {at + 1}/{slides.length}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setIndex(Math.min(slides.length - 1, at + 1))}
          disabled={at === slides.length - 1}
          aria-label="Later stage"
          className="shrink-0"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      <p className="text-xs text-slate-500">Tag more photos with a life stage in the edit form to add slides.</p>
    </div>
  );
}

/**
 * Every photo of the gecko: the grid (tap for full size), the fired-up and
 * fired-down pair, and the life-stage slideshow when the keeper turned it on.
 */
export function PhotosSection({ gecko, onOpen, headingAs = 'h3', className = '' }) {
  const slides = useMemo(() => lifeStageSlides(gecko), [gecko]);
  const urls = gecko?.image_urls || [];
  const slideshow = Boolean(gecko?.growth_slideshow_enabled) && slides.length > 0;
  return (
    <RecordCard id="photos" icon={Images} title="Photos" headingAs={headingAs} className={className} contentClassName="space-y-4">
        {urls.length > 1 && (
          <div className="grid grid-cols-4 gap-1.5">
            {urls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => onOpen(i)}
                className="rounded overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                aria-label={`Open photo ${i + 1} of ${urls.length}`}
              >
                <GeckoImage
                  gecko={gecko}
                  src={url}
                  alt=""
                  className="w-full aspect-square object-cover hover:opacity-80 transition-opacity"
                  style={rotationStyle(gecko, url)}
                  width={240}
                />
              </button>
            ))}
          </div>
        )}
        <FireStatePair gecko={gecko} onOpen={(url) => onOpen(Math.max(0, urls.indexOf(url)))} />
        {slideshow && <GrowthSlideshow gecko={gecko} slides={slides} />}
    </RecordCard>
  );
}
