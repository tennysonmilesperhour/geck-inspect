import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getMorph, MORPH_CATEGORIES } from '@/data/morph-guide';
import { trackMorphCta } from './morphCta';

/**
 * "Often confused with": the morphs people mix this one up with, each
 * with the one sentence that tells them apart. Data comes from the
 * `lookalikes` field in src/data/morph-guide.js.
 */
export default function MorphLookalikes({ slug, name, lookalikes = [] }) {
  const items = lookalikes
    .map((l) => ({ ...l, morph: getMorph(l.slug) }))
    .filter((l) => l.morph);
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map(({ slug: other, difference, morph }) => {
        const category = MORPH_CATEGORIES.find((c) => c.id === morph.category);
        const to = `/MorphGuide/${other}`;
        return (
          <Link
            key={other}
            to={to}
            onClick={() => trackMorphCta(slug, to, 'lookalikes')}
            className="group flex flex-col rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 hover:border-emerald-500/40 hover:bg-neutral-900 transition-colors"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold text-white">
                {name} vs {morph.name}
              </span>
              {category && (
                <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400">
                  {category.label}
                </span>
              )}
            </span>
            <span className="mt-2 text-sm text-neutral-300 leading-relaxed">{difference}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-emerald-300 group-hover:text-emerald-200">
              Read the {morph.name} guide
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
