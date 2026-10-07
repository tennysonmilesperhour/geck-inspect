import { useState } from 'react';
import { DEFAULT_GECKO_IMAGE } from '@/lib/constants';

/** Compact photo slots share the same fallback as SmartImage cards. */
export default function GeckoImage({ src, alt = '', className = '', style, onError, ...props }) {
  const [failedSource, setFailedSource] = useState(null);
  const hasSource = typeof src === 'string' && src.trim().length > 0;
  const placeholder = !hasSource || src === DEFAULT_GECKO_IMAGE || failedSource === src;
  return (
    <img
      {...props}
      src={placeholder ? DEFAULT_GECKO_IMAGE : src}
      alt={alt}
      loading={props.loading || 'lazy'}
      decoding="async"
      className={className}
      style={placeholder
        ? { ...style, objectFit: 'contain', objectPosition: 'center', transform: 'none', padding: '8%', backgroundColor: '#dce7df' }
        : style}
      onError={event => {
        if (placeholder) return;
        onError?.(event);
        setFailedSource(src);
      }}
    />
  );
}
