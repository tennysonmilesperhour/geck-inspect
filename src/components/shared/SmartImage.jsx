/**
 * SmartImage, drop-in replacement for <img> that enforces best practices.
 *
 * Features:
 *   - loading="lazy" + decoding="async" by default
 *   - Fixed aspect-ratio container prevents CLS (pass aspect="auto" to opt out
 *     when the parent already sets a height)
 *   - Shimmer placeholder while loading
 *   - Small slots load the photo's stored thumbnail (src/lib/photoThumbnails.js)
 *     when `width` is at most the thumbnail size, 480
 *   - Staged fallback: thumbnail (or the paid Supabase transform, when it is
 *     switched on) → the original photo → the customizable placeholder
 *
 * `width` is how many image pixels the slot needs across, about twice its
 * CSS width. Leave it out (or pass more than 480) wherever the full photo
 * must show: lightboxes, record heroes, anything printed or downloaded.
 *
 * Usage:
 *   <SmartImage src={gecko.image_url} alt={gecko.name} aspect="square" width={400} />
 *   <SmartImage src={url} alt="Gallery" aspect="auto" containerClassName="h-40" width={800} />
 */
import { useState } from 'react';
import { DEFAULT_GECKO_CARD, DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { geckoPlaceholderStyle, isGeckoPlaceholder } from '@/lib/geckoPlaceholder';
import { thumbnailFirst } from '@/lib/photoThumbnails';
import GeckoPlaceholder from './GeckoPlaceholder';

const ASPECT_PRESETS = {
  square: '1 / 1',
  '4/3': '4 / 3',
  '3/2': '3 / 2',
  '16/9': '16 / 9',
  '3/4': '3 / 4',
  auto: 'auto',
};

// Supabase image transformations are a paid add-on that this project does
// not have (Tennyson chose stored thumbnails instead in October 2026). With
// the flag off, small slots try the stored thumbnail and everything else
// loads the original directly, instead of first requesting /render/image/,
// getting a 403, and falling back (two requests and a delayed paint per
// photo).
const IMAGE_TRANSFORMS_ENABLED = import.meta.env.VITE_IMAGE_TRANSFORMS === '1';

function transformUrl(src, width) {
  if (!src || !width) return src;
  // Supabase Storage image transformations require the /render/image/ path,
  // not /object/. Rewrite if needed so a regular public-object URL also
  // benefits from on-the-fly resizing.
  //
  // From:  https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
  // To:    https://<proj>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=W&quality=75
  if (src.includes('.supabase.co/storage/v1/')) {
    let url = src;
    if (url.includes('/storage/v1/object/')) {
      url = url.replace('/storage/v1/object/', '/storage/v1/render/image/');
    }
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}width=${width}&quality=75`;
  }
  return src;
}

/**
 * The addresses SmartImage tries for a photo, in order, before its
 * placeholder. Exported for tests.
 */
export function smartImageSources(src, width, { transforms = IMAGE_TRANSFORMS_ENABLED } = {}) {
  if (typeof src !== 'string' || !src.trim()) return [];
  if (transforms && width) {
    const transformed = transformUrl(src, width);
    return transformed && transformed !== src ? [transformed, src] : [src];
  }
  return thumbnailFirst(src, width);
}

export default function SmartImage({
  src,
  alt,
  gecko,
  aspect = 'square',
  width,
  className = '',
  containerClassName = '',
  fallback = DEFAULT_GECKO_IMAGE,
  style,
  onLoad,
  onError,
  ...rest
}) {
  const sources = smartImageSources(src, width);
  // How many of this photo's sources have failed. Keyed by src, so a new
  // photo starts again at its first source on the very first render
  // (no stale request for the old stage).
  const [failures, setFailures] = useState({ src, count: 0 });
  const failed = failures.src === src ? failures.count : 0;
  // The address that last finished (loaded, or failed for good), so the
  // shimmer stays up while a fallback source is still loading.
  const [settled, setSettled] = useState(null);

  const resolvedSrc = failed < sources.length ? sources[failed] : fallback;
  const loaded = settled === resolvedSrc;
  const aspectRatio = ASPECT_PRESETS[aspect] || aspect;

  const isPlaceholder = isGeckoPlaceholder(resolvedSrc);
  const personalized = isPlaceholder && gecko;
  // Give auto-height detail views a definite box before their max-height
  // is applied, so the full frame fits instead of overflowing the wrapper.
  const containerAspect = isPlaceholder && aspect === 'auto'
    ? (!personalized && resolvedSrc === DEFAULT_GECKO_CARD ? '2 / 3' : '1 / 1')
    : aspectRatio;

  return (
    <div
      className={`relative overflow-hidden bg-slate-800 ${containerClassName}`}
      style={{ aspectRatio: containerAspect }}
    >
      {/* Shimmer placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" />
      )}
      {personalized ? <GeckoPlaceholder
        {...rest}
        gecko={gecko}
        alt={alt}
        width={width}
        className={`w-full h-full ${className}`}
        style={style}
        onLoad={(event) => { setSettled(resolvedSrc); onLoad?.(event); }}
        onError={onError}
      /> : <img
        src={resolvedSrc}
        alt={alt || ''}
        loading="lazy"
        decoding="async"
        onLoad={(event) => { setSettled(resolvedSrc); onLoad?.(event); }}
        onError={(event) => {
          // Step through the sources, then the placeholder. Stop there so a
          // broken placeholder never loops.
          const stage = failed;
          if (stage < sources.length) {
            setFailures({ src, count: stage + 1 });
            if (stage + 1 >= sources.length) setSettled(fallback);
          } else {
            setSettled(resolvedSrc);
          }
          // A missing thumbnail is expected (older photos, an upload from a
          // browser that could not make one), so callers hear only about the
          // photo itself failing.
          const missedThumbnail = stage < sources.length - 1 && !IMAGE_TRANSFORMS_ENABLED;
          if (!missedThumbnail) onError?.(event);
        }}
        style={isPlaceholder ? geckoPlaceholderStyle(resolvedSrc, style) : style}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        {...rest}
      />}
    </div>
  );
}
