/**
 * SmartImage ,  drop-in replacement for <img> that enforces best practices.
 *
 * Features:
 *   - loading="lazy" + decoding="async" by default
 *   - Fixed aspect-ratio container prevents CLS (pass aspect="auto" to opt out
 *     when the parent already sets a height)
 *   - Shimmer placeholder while loading
 *   - Supabase Storage transform: serves a width-sized variant from the
 *     /render/image/ endpoint when the user is on a Pro+ plan
 *   - Three-tier error fallback: transform fails → try original URL →
 *     show the customizable fallback placeholder
 *
 * Usage:
 *   <SmartImage src={gecko.image_url} alt={gecko.name} aspect="square" width={400} />
 *   <SmartImage src={url} alt="Gallery" aspect="auto" containerClassName="h-40" width={500} />
 */
import { useEffect, useState } from 'react';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

const ASPECT_PRESETS = {
  square: '1 / 1',
  '4/3': '4 / 3',
  '3/2': '3 / 2',
  '16/9': '16 / 9',
  '3/4': '3 / 4',
  auto: 'auto',
};

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

export default function SmartImage({
  src,
  alt,
  aspect = 'square',
  width,
  className = '',
  containerClassName = '',
  fallback = DEFAULT_GECKO_IMAGE,
  ...rest
}) {
  // failStage: 0 = trying transformed URL, 1 = trying original URL,
  // 2 = trying fallback placeholder. Each onError advances the stage.
  const [failStage, setFailStage] = useState(0);
  const [loaded, setLoaded] = useState(false);

  // Reset on src change so a new gecko's image actually rerenders.
  useEffect(() => {
    setFailStage(0);
    setLoaded(false);
  }, [src]);

  const aspectRatio = ASPECT_PRESETS[aspect] || aspect;

  let resolvedSrc;
  if (failStage === 0) {
    resolvedSrc = (width ? transformUrl(src, width) : src) || fallback;
  } else if (failStage === 1) {
    resolvedSrc = src || fallback;
  } else {
    resolvedSrc = fallback;
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-800 ${containerClassName}`}
      style={{ aspectRatio }}
    >
      {/* Shimmer placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800" />
      )}
      <img
        src={resolvedSrc}
        alt={alt || ''}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          // Step through: transform → original → fallback. Stop at 2 so we
          // don't loop on a broken fallback URL.
          setFailStage((stage) => (stage < 2 ? stage + 1 : stage));
          setLoaded(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        {...rest}
      />
    </div>
  );
}
