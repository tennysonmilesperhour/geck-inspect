/**
 * SmartImage — drop-in replacement for <img> that enforces best practices.
 *
 * Features:
 *   - loading="lazy" + decoding="async" by default
 *   - Fixed aspect-ratio container prevents CLS
 *   - Shimmer placeholder while loading
 *   - Fallback on error (customizable)
 *   - Optional Supabase Storage transform via ?width= for responsive sizing
 *
 * Usage:
 *   <SmartImage src={gecko.image_url} alt={gecko.name} aspect="square" />
 *   <SmartImage src={url} alt="Gallery" aspect="4/3" width={400} />
 */
import { useState } from 'react';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

const ASPECT_PRESETS = {
  square: '1 / 1',
  '4/3': '4 / 3',
  '3/2': '3 / 2',
  '16/9': '16 / 9',
  '3/4': '3 / 4',
};

function transformUrl(src, width) {
  if (!src || !width) return src;
  // Supabase Storage supports on-the-fly transforms via render/image URL
  if (src.includes('.supabase.co/storage/')) {
    const sep = src.includes('?') ? '&' : '?';
    return `${src}${sep}width=${width}&quality=75`;
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
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const aspectRatio = ASPECT_PRESETS[aspect] || aspect;
  const resolvedSrc = failed ? fallback : (width ? transformUrl(src, width) : src) || fallback;

  return (
    <div
      className={`relative overflow-hidden bg-slate-800 ${containerClassName}`}
      style={{ aspectRatio }}
    >
      {/* Shimmer placeholder */}
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
          if (!failed) setFailed(true);
          setLoaded(true);
        }}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        {...rest}
      />
    </div>
  );
}
