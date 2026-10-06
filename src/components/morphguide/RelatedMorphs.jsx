import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getMorph, morphsByCategory, MORPH_CATEGORIES, RARITY } from '@/data/morph-guide';
import { trackMorphCta } from './morphCta';

const MAX_CARDS = 8;

// A quiet color wash per category so a grid of text cards still reads
// as different kinds of morph at a glance.
const CATEGORY_TONE = {
  base: 'from-orange-500/10',
  color: 'from-violet-500/10',
  pattern: 'from-emerald-500/10',
  structure: 'from-sky-500/10',
  combo: 'from-amber-500/10',
};

/**
 * Morphs worth reading next, built from the local guide so it works even
 * when the database is unreachable: first the morphs this one commonly
 * combines with, then others from the same category.
 */
export function relatedMorphsFor(morph) {
  if (!morph) return [];
  const seen = new Set([morph.slug]);
  const out = [];
  for (const s of morph.combinesWith || []) {
    const m = getMorph(s);
    if (!m || seen.has(m.slug)) continue;
    seen.add(m.slug);
    out.push({ morph: m, reason: 'Pairs with' });
  }
  for (const m of morphsByCategory(morph.category)) {
    if (seen.has(m.slug)) continue;
    seen.add(m.slug);
    out.push({ morph: m, reason: 'Same category' });
  }
  return out.slice(0, MAX_CARDS);
}

export default function RelatedMorphs({ morph }) {
  const items = relatedMorphsFor(morph);
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map(({ morph: m, reason }) => {
        const to = `/MorphGuide/${m.slug}`;
        const rarity = RARITY[m.rarity];
        return (
          <Link
            key={m.slug}
            to={to}
            onClick={() => trackMorphCta(morph.slug, to, 'related')}
            className={`group flex flex-col rounded-xl border border-neutral-800 bg-gradient-to-br ${
              CATEGORY_TONE[m.category] || 'from-neutral-500/10'
            } to-neutral-900/60 p-4 hover:border-emerald-500/40 transition-colors`}
          >
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{reason}</span>
            <span className="mt-1 font-semibold text-white group-hover:text-emerald-200 transition-colors">
              {m.name}
            </span>
            {m.summary && (
              <span className="mt-1 text-sm text-neutral-400 leading-snug line-clamp-3">{m.summary}</span>
            )}
            {rarity && (
              <span className="mt-auto pt-3 text-xs text-neutral-500">{rarity.label}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Previous and next morph within the same category, in guide order,
 * wrapping around at the ends so there is always somewhere to go.
 */
export function MorphPrevNext({ morph }) {
  if (!morph) return null;
  const list = morphsByCategory(morph.category);
  const i = list.findIndex((m) => m.slug === morph.slug);
  if (i === -1 || list.length < 2) return null;
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  const category = MORPH_CATEGORIES.find((c) => c.id === morph.category);
  const label = category ? category.label.toLowerCase() : 'morph';
  const link = (m, dir) => {
    const to = `/MorphGuide/${m.slug}`;
    const Icon = dir === 'prev' ? ArrowLeft : ArrowRight;
    return (
      <Link
        to={to}
        onClick={() => trackMorphCta(morph.slug, to, `${dir}_in_category`)}
        className={`group flex flex-1 items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 hover:border-emerald-500/40 transition-colors ${
          dir === 'next' ? 'justify-end text-right' : ''
        }`}
      >
        {dir === 'prev' && <Icon className="h-5 w-5 shrink-0 text-neutral-500 group-hover:text-emerald-300" aria-hidden="true" />}
        <span className="min-w-0">
          <span className="block text-xs uppercase tracking-wide text-neutral-500">
            {dir === 'prev' ? 'Previous' : 'Next'} {label}
          </span>
          <span className="block font-semibold text-white truncate group-hover:text-emerald-200">{m.name}</span>
        </span>
        {dir === 'next' && <Icon className="h-5 w-5 shrink-0 text-neutral-500 group-hover:text-emerald-300" aria-hidden="true" />}
      </Link>
    );
  };
  return (
    <nav aria-label={`More ${label} morphs`} className="flex flex-col sm:flex-row gap-3">
      {link(prev, 'prev')}
      {prev.slug !== next.slug && link(next, 'next')}
    </nav>
  );
}
