import { useState } from 'react';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';
import { geckoPlaceholderStyle, isGeckoPlaceholder } from '@/lib/geckoPlaceholder';
import GeckoPlaceholder from './GeckoPlaceholder';

/** Compact photo slots share the same placeholder art as SmartImage cards. */
export default function GeckoImage({ src, gecko, alt = '', className = '', style, onError, fallback = DEFAULT_GECKO_IMAGE, ...props }) {
  const [failedSource, setFailedSource] = useState(null);
  const hasSource = typeof src === 'string' && src.trim().length > 0;
  const placeholder = !hasSource || isGeckoPlaceholder(src) || failedSource === src;
  const shown = placeholder ? (isGeckoPlaceholder(src) ? src : fallback) : src;
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
        onError?.(event);
        setFailedSource(src);
      }}
    />
  );
}
