import { useMemo } from 'react';
import { linkifyMorphText } from '@/lib/morphLinkify';
import { MorphPreviewLink } from './MorphPreviewCard';

const LINK_CLASS =
  'font-medium text-emerald-300 underline decoration-emerald-500/40 decoration-dotted underline-offset-4 hover:text-emerald-200 hover:decoration-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 rounded-sm transition-colors';

/**
 * One paragraph (or bullet) of guide text with the other morphs it
 * mentions turned into preview links. `currentSlug` is the page's own
 * morph, which is never linked; `skip` leaves out others (for example the
 * lookalike a comparison is already about).
 */
export default function MorphText({ text, currentSlug, skip, from }) {
  const skipKey = (skip || []).join('|');
  const segments = useMemo(
    () => linkifyMorphText(text, { currentSlug, skip: skipKey ? skipKey.split('|') : [] }),
    [text, currentSlug, skipKey],
  );
  return segments.map((seg, i) =>
    seg.type === 'morph' ? (
      <MorphPreviewLink key={i} slug={seg.slug} from={from || currentSlug} className={LINK_CLASS}>
        {seg.text}
      </MorphPreviewLink>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  );
}
