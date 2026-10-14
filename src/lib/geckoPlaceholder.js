import { DEFAULT_GECKO_CARD, DEFAULT_GECKO_IMAGE } from '@/lib/constants';

/** True for either bundled placeholder, so callers never treat one as a real photo. */
export function isGeckoPlaceholder(src) {
  return src === DEFAULT_GECKO_IMAGE || src === DEFAULT_GECKO_CARD;
}

/**
 * Keep the complete engraved frame and Add Photo label visible at every
 * slot size. Rotation from a real photo never applies to placeholders.
 */
export function geckoPlaceholderStyle(src, style) {
  if (src === DEFAULT_GECKO_CARD) {
    return { ...style, objectFit: 'contain', objectPosition: 'center', transform: 'none', padding: '4%', backgroundColor: '#0b1a14' };
  }
  return { ...style, objectFit: 'contain', objectPosition: 'center', transform: 'none', padding: 0, backgroundColor: '#0b1a14' };
}
