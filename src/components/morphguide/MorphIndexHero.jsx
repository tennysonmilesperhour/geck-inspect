import { Link } from 'react-router-dom';
import { BookOpen, Camera, Dna, Search, X } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';
import RotatingMorphImage from '@/components/morphguide/RotatingMorphImage';
import { MorphIndexArt, morphImages } from '@/components/morphguide/MorphIndexCard';

// The morphs a visitor is most likely to recognize by name, in mosaic order.
// The first one gets the large tile on desktop.
const MOSAIC_SLUGS = ['harlequin', 'lilly-white', 'axanthic', 'pinstripe', 'dalmatian', 'cappuccino'];

function MosaicTile({ morph, large = false, index }) {
  const images = morphImages(morph);
  return (
    <Link
      to={`/MorphGuide/${morph.slug}`}
      onClick={() => captureEvent('morph_guide_cta_clicked', { target: morph.slug, placement: 'hero_mosaic' })}
      className={`group relative block overflow-hidden rounded-xl border border-white/10 bg-slate-800 ${
        large ? 'lg:col-span-2 lg:row-span-2' : ''
      } ${index >= 3 ? 'hidden lg:block' : ''}`}
    >
      <MorphIndexArt morph={morph} />
      {images.length > 0 && (
        <RotatingMorphImage
          images={images}
          alt={`${morph.name} crested gecko`}
          eager={index < 3}
          interval={large ? 4500 : 5500}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent pointer-events-none" />
      <span
        className={`absolute left-2 right-2 bottom-1.5 truncate font-semibold text-white drop-shadow ${
          large ? 'text-xs sm:text-base lg:left-3 lg:bottom-3' : 'text-xs sm:text-sm'
        }`}
      >
        {morph.name}
      </span>
    </Link>
  );
}

export default function MorphIndexHero({
  morphs,
  total,
  searchTerm,
  onSearchChange,
  matchCount,
  onJumpToResults,
}) {
  const bySlug = new Map(morphs.map((m) => [m.slug, m]));
  const mosaic = MOSAIC_SLUGS.map((s) => bySlug.get(s)).filter(Boolean);

  return (
    <section className="relative border-b border-slate-800/60 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 right-0 w-[28rem] h-[28rem] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 pt-6 pb-8 md:py-14 grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            Morph guide
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-[1.08] mb-3 bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent">
            Crested Gecko Morphs: The Complete Guide
          </h1>
          <p className="text-base md:text-lg text-slate-300 leading-relaxed max-w-2xl">
            A crested gecko morph is a named look set by base color, pattern, scale
            structure or a proven gene. This guide covers all {total} morphs
            recognized in the hobby, from Harlequin and Pinstripe to Lilly White,
            Axanthic and the first albinos.
          </p>

          <form
            role="search"
            className="mt-5 max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              onJumpToResults?.();
            }}
          >
            <label htmlFor="morph-hero-search" className="sr-only">
              Search crested gecko morphs
            </label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="morph-hero-search"
                type="search"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search morphs, like Lilly White"
                autoComplete="off"
                className="w-full h-12 rounded-xl border border-slate-600 bg-slate-950/80 pl-11 pr-10 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/60 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={onJumpToResults}
                className="mt-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
              >
                {matchCount === 0
                  ? 'No morphs match yet. Try another name.'
                  : `See ${matchCount} matching ${matchCount === 1 ? 'morph' : 'morphs'}`}
              </button>
            )}
          </form>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <Link
              to="/Recognition"
              onClick={() => captureEvent('morph_guide_cta_clicked', { target: 'morph_id', placement: 'hero' })}
              className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Identify my gecko from a photo
            </Link>
            <Link
              to="/calculator"
              onClick={() => captureEvent('morph_guide_cta_clicked', { target: 'calculator', placement: 'hero' })}
              className="inline-flex items-center justify-center gap-2 min-h-11 rounded-xl border border-slate-600 bg-slate-900/60 hover:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-100 transition-colors"
            >
              <Dna className="w-4 h-4 text-emerald-300" />
              Breeding calculator
            </Link>
          </div>
        </div>

        {mosaic.length > 0 && (
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-3 lg:grid-rows-3 lg:gap-3 lg:aspect-square [&>a]:aspect-square lg:[&>a]:aspect-auto">
            {mosaic.map((m, i) => (
              <MosaicTile key={m.slug} morph={m} index={i} large={i === 0} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
