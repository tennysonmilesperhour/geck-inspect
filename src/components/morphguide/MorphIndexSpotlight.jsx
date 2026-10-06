import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { captureEvent } from '@/lib/posthog';
import RotatingMorphImage from '@/components/morphguide/RotatingMorphImage';
import { MorphIndexArt, morphImages } from '@/components/morphguide/MorphIndexCard';

/**
 * "New in 2026" banner above the morph grid: Albino (the newest entry in the
 * guide, first healthy hatchlings announced March 2026) and Moonglow, the
 * all-white goal that Albino makes reachable.
 */
const SPOTLIGHT = [
  {
    slug: 'albino',
    badge: 'New',
    title: 'Albino crested geckos are here',
    body: 'Eureka Exotics announced the first healthy albinos on 5 March 2026: red eyes and no black pigment. How the trait is inherited is not proven yet.',
  },
  {
    slug: 'moonglow',
    badge: 'Updated',
    title: 'Moonglow, the all-white goal',
    body: 'Line-bred near-white geckos are sold as Moonglow today. Albino plus Axanthic could make a true white gecko for the first time.',
  },
];

export default function MorphIndexSpotlight({ morphs }) {
  const bySlug = new Map(morphs.map((m) => [m.slug, m]));
  const items = SPOTLIGHT.map((s) => ({ ...s, morph: bySlug.get(s.slug) })).filter((s) => s.morph);
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="morph-spotlight-heading"
      className="rounded-2xl border border-rose-400/25 bg-gradient-to-r from-rose-950/40 via-slate-900/80 to-slate-900/60 p-3 sm:p-4"
    >
      <h2
        id="morph-spotlight-heading"
        className="flex items-center gap-2 px-1 mb-3 text-xs font-semibold uppercase tracking-wider text-rose-200"
      >
        <Sparkles className="w-3.5 h-3.5" />
        New in the guide, 2026
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ slug, badge, title, body, morph }) => {
          const images = morphImages(morph);
          return (
            <Link
              key={slug}
              to={`/MorphGuide/${slug}`}
              onClick={() => captureEvent('morph_guide_cta_clicked', { target: slug, placement: 'spotlight' })}
              className="group flex gap-3 rounded-xl border border-slate-700/80 bg-slate-950/50 hover:border-rose-300/50 hover:bg-slate-950/80 p-2.5 transition-colors"
            >
              <div className="relative w-16 h-16 sm:w-24 sm:h-24 shrink-0 overflow-hidden rounded-lg">
                <MorphIndexArt morph={morph} />
                {images.length > 0 && (
                  <RotatingMorphImage
                    images={images}
                    alt={`${morph.name} crested gecko`}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                      badge === 'New' ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-100'
                    }`}
                  >
                    {badge}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">{morph.name}</span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-white leading-snug group-hover:text-rose-200 transition-colors">
                  {title}
                </h3>
                <div className="hidden sm:block mt-1">
                  <p className="text-sm text-slate-400 leading-snug line-clamp-3">{body}</p>
                </div>
                <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-rose-200">
                  Read the {morph.name} guide
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
