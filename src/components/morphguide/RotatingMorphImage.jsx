import { useEffect, useRef, useState } from 'react';

const ROTATE_INTERVAL_MS = 3000;

/**
 * Crossfades/slides through a list of morph reference images.
 * - Single image or empty: renders static img, no animation.
 * - Multiple images: advances every ROTATE_INTERVAL_MS, sliding the
 *   outgoing image to the left and the incoming image in from the right.
 * - Start offset is staggered per instance so a grid of cards doesn't
 *   flip in unison.
 */
export default function RotatingMorphImage({
  images = [],
  alt = '',
  className = '',
}) {
  // Filter out empty/duplicate URLs while keeping order.
  const uniqueImages = Array.from(
    new Set((images || []).filter(Boolean)),
  );

  const [index, setIndex] = useState(0);
  const [prevSrc, setPrevSrc] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (uniqueImages.length <= 1) return undefined;
    // Per-card jitter so neighboring cards don't flip at the same moment.
    const initialDelay = Math.floor(Math.random() * ROTATE_INTERVAL_MS);
    let currentIndex = 0;
    timerRef.current = setTimeout(function tick() {
      setPrevSrc(uniqueImages[currentIndex]);
      currentIndex = (currentIndex + 1) % uniqueImages.length;
      setIndex(currentIndex);
      timerRef.current = setTimeout(tick, ROTATE_INTERVAL_MS);
    }, ROTATE_INTERVAL_MS + initialDelay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [uniqueImages.length]);

  // Clear the outgoing image once its slide-out finishes, so only the
  // current image keeps rendering between rotations.
  useEffect(() => {
    if (!prevSrc) return undefined;
    const t = setTimeout(() => setPrevSrc(null), 750);
    return () => clearTimeout(t);
  }, [prevSrc]);

  if (uniqueImages.length === 0) {
    return null;
  }

  if (uniqueImages.length === 1) {
    return (
      <img
        src={uniqueImages[0]}
        alt={alt}
        className={className}
        loading="lazy"
      />
    );
  }

  const currentSrc = uniqueImages[index];

  return (
    <div className="absolute inset-0 overflow-hidden">
      {prevSrc && prevSrc !== currentSrc && (
        <img
          key={`out-${prevSrc}`}
          src={prevSrc}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 animate-morph-slide-out-left ${className}`}
          loading="lazy"
        />
      )}
      <img
        key={`in-${currentSrc}-${index}`}
        src={currentSrc}
        alt={alt}
        className={`absolute inset-0 animate-morph-slide-in-right ${className}`}
        loading="lazy"
      />
    </div>
  );
}
