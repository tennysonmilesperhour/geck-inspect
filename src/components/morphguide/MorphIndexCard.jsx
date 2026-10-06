import { Link } from 'react-router-dom';
import { INHERITANCE, RARITY } from '@/data/morph-guide';
import RotatingMorphImage from '@/components/morphguide/RotatingMorphImage';
import IllustratedGecko, { hasIllustration } from '@/components/morphguide/IllustratedGecko';

/**
 * Photo card for one morph, shared by the Morph Guide index and the
 * category and inheritance hubs. Two columns on a phone, so it stays short:
 * photo, name, then small rarity and genetics badges. The one-line summary
 * only shows from the `sm` breakpoint up.
 */

// Tinted backdrop drawn under every photo. It is what the visitor sees
// while photos load, when a morph has no photo yet, or when a photo fails.
const CATEGORY_ART = {
  pattern: 'from-amber-600/45 via-orange-900/40 to-slate-900',
  base: 'from-rose-600/40 via-red-950/50 to-slate-900',
  color: 'from-indigo-500/35 via-slate-800 to-slate-900',
  structure: 'from-emerald-600/40 via-teal-950/50 to-slate-900',
  combo: 'from-fuchsia-600/35 via-purple-950/50 to-slate-900',
};

const SLUG_ART = {
  albino: 'from-rose-200/50 via-amber-200/20 to-slate-900',
  moonglow: 'from-slate-100/45 via-slate-400/20 to-slate-900',
  'lilly-white': 'from-slate-100/40 via-amber-100/15 to-slate-900',
  axanthic: 'from-slate-300/35 via-slate-600/30 to-slate-900',
  lavender: 'from-violet-400/40 via-slate-700/40 to-slate-900',
  olive: 'from-lime-700/45 via-stone-800/50 to-slate-900',
  chocolate: 'from-amber-900/60 via-stone-900/60 to-slate-900',
  cream: 'from-amber-100/35 via-stone-600/30 to-slate-900',
  'yellow-base': 'from-yellow-400/40 via-amber-900/40 to-slate-900',
};

/** Slugs flagged as new in the hobby, shown with a "New" badge. */
export const NEW_MORPH_SLUGS = new Set(['albino']);

export function morphArtClass(morph) {
  return SLUG_ART[morph?.slug] || CATEGORY_ART[morph?.category] || CATEGORY_ART.combo;
}

function initials(name) {
  const words = String(name || '').replace(/\([^)]*\)/g, ' ').split(/\s+/).filter((w) => /^[a-z]/i.test(w));
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/** Fallback art: category tint plus the morph's initials, watermark style. */
export function MorphIndexArt({ morph, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 bg-gradient-to-br ${morphArtClass(morph)} flex items-center justify-center ${className}`}
    >
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
      {hasIllustration(morph?.slug) ? (
        <IllustratedGecko morph={morph.slug} decorative className="relative w-[94%] h-auto max-h-[88%]" />
      ) : (
        <span className="relative font-black tracking-tight text-white/15 text-5xl sm:text-6xl select-none">
          {initials(morph?.name)}
        </span>
      )}
    </div>
  );
}

export function morphImages(morph) {
  if (Array.isArray(morph?.heroImages) && morph.heroImages.length > 0) return morph.heroImages;
  return morph?.heroImage ? [morph.heroImage] : [];
}

export default function MorphIndexCard({ morph, onClick }) {
  const rarity = RARITY[morph.rarity] || RARITY.common;
  const inh = INHERITANCE[morph.inheritance];
  const images = morphImages(morph);
  const isNew = NEW_MORPH_SLUGS.has(morph.slug);
  return (
    <Link
      to={`/MorphGuide/${morph.slug}`}
      onClick={onClick}
      className="group rounded-xl overflow-hidden border border-slate-800 bg-slate-900/70 hover:border-emerald-500/50 hover:bg-slate-900 transition-colors duration-200 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <div className="aspect-[4/3] relative overflow-hidden bg-slate-800">
        <MorphIndexArt morph={morph} />
        {images.length > 0 && (
          <RotatingMorphImage
            images={images}
            alt={`${morph.name} crested gecko`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold backdrop-blur-sm ${rarity.color}`}
          >
            {rarity.label}
          </span>
          {isNew ? (
            <span className="inline-flex items-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white shadow">
              New
            </span>
          ) : morph.isHeroAnchor ? (
            <span
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-950/80 backdrop-blur-sm px-2 py-0.5 text-xs font-semibold text-emerald-200"
              title={morph.heroAward || 'Competition-winning reference photo'}
            >
              <span aria-hidden>★</span>
              Show winner
            </span>
          ) : null}
        </div>
        {(morph.heroPhotoCredit || morph.heroGeckoName) && (
          <div className="hidden sm:block absolute inset-x-0 bottom-0 px-2 py-1.5 text-xs leading-tight text-white/90">
            <div className="rounded-md bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-0.5 truncate">
              {morph.heroGeckoName && <span className="font-medium">&ldquo;{morph.heroGeckoName}&rdquo;</span>}
              {morph.heroGeckoName && morph.heroPhotoCredit && <span className="text-white/50"> · </span>}
              {morph.heroPhotoCredit && <span className="text-white/80">{morph.heroPhotoCredit}</span>}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 p-3 sm:p-4 flex flex-col">
        <h3 className="text-sm sm:text-base font-bold text-white leading-snug group-hover:text-emerald-300 transition-colors">
          {morph.name}
        </h3>
        {/* line-clamp needs display -webkit-box, so the breakpoint
            visibility lives on a wrapper rather than on the paragraph. */}
        <div className="hidden sm:block mt-1">
          <p className="text-sm text-slate-400 leading-snug line-clamp-2">
            {morph.summary || morph.description || 'Crested gecko morph reference.'}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {inh && (
            <span
              className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-semibold ${inh.color}`}
              title={inh.label}
            >
              {inh.short}
            </span>
          )}
          {morph.priceTier && (
            <span className="inline-flex items-center rounded-md border border-slate-700 bg-slate-950/60 px-1.5 py-0.5 text-xs font-semibold text-slate-300">
              {morph.priceTier}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
