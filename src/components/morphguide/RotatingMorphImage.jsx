import { useEffect, useMemo, useRef, useState } from 'react';

const ROTATE_INTERVAL_MS = 3500;
const FADE_MS = 700;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Cycles through a list of morph reference photos with a crossfade.
 *
 * - Fills its nearest positioned parent (absolute inset-0), so the parent
 *   needs `relative` and a size (for example an aspect ratio box).
 * - One photo: a static image. Several: the next one fades in every few
 *   seconds, with a random start offset so a grid of cards does not flip
 *   in unison.
 * - Rotation only runs while the image is on screen, and never for
 *   visitors who ask their device for reduced motion.
 * - Photos load lazily unless `eager` is set (for images above the fold).
 * - A photo that fails to load is dropped. When none load, nothing is
 *   rendered, so whatever the parent draws underneath (a fallback) shows.
 */
export default function RotatingMorphImage({
  images = [],
  alt = '',
  className = '',
  eager = false,
  interval = ROTATE_INTERVAL_MS,
}) {
  const [failed, setFailed] = useState(() => new Set());
  const list = useMemo(
    () => Array.from(new Set((images || []).filter(Boolean))).filter((u) => !failed.has(u)),
    [images, failed],
  );

  const [index, setIndex] = useState(0);
  const [prevSrc, setPrevSrc] = useState(null);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const wrapRef = useRef(null);
  const jitterRef = useRef(Math.floor(Math.random() * interval));
  const rotates = list.length > 1;

  // Follow the reduced-motion setting if it changes while the page is open.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // Only watch visibility when there is something to rotate.
  useEffect(() => {
    if (!rotates || !wrapRef.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '0px', threshold: 0.25 },
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, [rotates]);

  const safeIndex = list.length ? index % list.length : 0;
  const currentSrc = list[safeIndex];

  useEffect(() => {
    if (!rotates || !visible || reduced) return undefined;
    const delay = interval + jitterRef.current;
    jitterRef.current = 0;
    const t = setTimeout(() => {
      setPrevSrc(currentSrc);
      setIndex((i) => (i + 1) % list.length);
    }, delay);
    return () => clearTimeout(t);
  }, [rotates, visible, reduced, safeIndex, currentSrc, list.length, interval]);

  // Drop the outgoing photo once the incoming one has faded in.
  useEffect(() => {
    if (!prevSrc) return undefined;
    const t = setTimeout(() => setPrevSrc(null), FADE_MS + 50);
    return () => clearTimeout(t);
  }, [prevSrc]);

  if (!currentSrc) return null;

  const markFailed = (src) =>
    setFailed((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });

  return (
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      {prevSrc && prevSrc !== currentSrc && (
        <img
          key={`out-${prevSrc}`}
          src={prevSrc}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 ${className}`}
        />
      )}
      <img
        key={`in-${currentSrc}`}
        src={currentSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => markFailed(currentSrc)}
        className={`absolute inset-0 ${className} ${
          prevSrc ? 'animate-in fade-in duration-700 motion-reduce:animate-none' : ''
        }`}
      />
    </div>
  );
}
