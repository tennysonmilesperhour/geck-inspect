import { useState } from 'react';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { geckoPlaceholderStyle, isGeckoPlaceholder } from '@/lib/geckoPlaceholder';
import { thumbnailFirst } from '@/lib/photoThumbnails';
import GeckoPlaceholder from './GeckoPlaceholder';

/**
 * Compact photo slots share the same placeholder art as SmartImage cards.
 *
 * Pass `width` (image pixels the slot needs across, about twice its CSS
 * width, at most 480) and the slot loads the photo's stored thumbnail
 * first, then the photo itself if the thumbnail is missing, then the
 * placeholder. Without `width` it loads the photo, as before; leave it
 * out wherever the full photo must show. Like SmartImage's, `width` is a
 * hint for choosing the file and is not set on the <img> element, so it
 * never changes the layout.
 */
export default function GeckoImage({ src, gecko, alt = '', className = '', style, onError, fallback = DEFAULT_GECKO_IMAGE, width, ...props }) {
  // How many of this photo's sources have failed, keyed by src so a new
  // photo starts again at its first source.
  const [failures, setFailures] = useState({ src: null, count: 0 });
  const hasSource = typeof src === 'string' && src.trim().length > 0;
  const sources = hasSource && !isGeckoPlaceholder(src) ? thumbnailFirst(src, width) : [];
  const failed = failures.src === src ? failures.count : 0;
  const placeholder = failed >= sources.length;
  const shown = placeholder ? (isGeckoPlaceholder(src) ? src : fallback) : sources[failed];
  if (gecko && placeholder && isGeckoPlaceholder(shown)) {
    return <GeckoPlaceholder {...props} gecko={gecko} alt={alt} className={className} style={style} onError={onError} />;
  }
  return (
    <img
      {...props}
      src={shown}
      alt={alt}
      loading={props.loading || 'lazy'}
      decoding="async"
      className={className}
      style={placeholder ? geckoPlaceholderStyle(shown, style) : style}
      onError={event => {
        if (placeholder) return;
        // A missing thumbnail is expected; callers hear only about the
        // photo itself failing.
        if (failed === sources.length - 1) onError?.(event);
        setFailures({ src, count: failed + 1 });
      }}
    />
  );
}
