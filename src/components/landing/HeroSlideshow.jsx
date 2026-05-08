import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ArrowRight, Play } from 'lucide-react';

/**
 * Hero slideshow for the public landing page.
 *
 * This is a PLACEHOLDER for the eventual hero product video described
 * in DECISIONS.md #6 (a 6-10 second looping product preview). Until
 * we have that asset, we show real animals from the founder's actual
 * collection, captioned with the platform feature each one is
 * demonstrating. The honesty is the point: every face on screen is a
 * real Geck Inspect record, not stock photography.
 *
 * Data source: the geckos table is anon-readable (see RLS policy
 * geckos_read_all). We pull a small set keyed off the founder's
 * email and `gallery_display = true` so Tennyson controls which
 * animals show up by toggling the gallery flag in the app.
 *
 * Captions are rotated client-side; they don't come from the database.
 * Each photo gets a deterministic feature caption based on its index
 * so the slideshow always tells the same "tour" story even as the
 * underlying gallery changes.
 */

// Tennyson's account email. The slideshow pulls his curated gallery
// from Supabase. If the email ever changes, update here. Hardcoded
// rather than fetched so the unauthenticated public page doesn't
// have to resolve the founder identity.
const FOUNDER_EMAIL = 'tennysontaggart@gmail.com';

// Captions narrate the "platform tour." Each slide's caption maps to
// one of the headline product capabilities so the visitor scrubs
// through the value prop while seeing real animals.
const FEATURE_CAPTIONS = [
  'Every gecko, fully documented',
  'Multi-generation lineage on every animal',
  'Photo timeline from hatchling to adult',
  'Morph and trait tracking, structured',
  'Weight history, breeding readiness, all in one place',
  'Public passport buyers can verify',
];

const ADVANCE_MS = 4500;

function pickCaption(index) {
  return FEATURE_CAPTIONS[index % FEATURE_CAPTIONS.length];
}

function firstImageUrl(image_urls) {
  if (!image_urls) return null;
  if (Array.isArray(image_urls)) return image_urls[0] || null;
  if (typeof image_urls === 'string') {
    try {
      const parsed = JSON.parse(image_urls);
      if (Array.isArray(parsed)) return parsed[0] || null;
    } catch {
      return image_urls;
    }
  }
  return null;
}

function morphLine(g) {
  if (g.morphs_traits && g.morphs_traits.trim()) return g.morphs_traits.trim();
  if (Array.isArray(g.morph_tags) && g.morph_tags.length > 0) {
    return g.morph_tags.join(', ');
  }
  return null;
}

export default function HeroSlideshow() {
  const [slides, setSlides] = useState(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('geckos')
      .select('id, name, sex, hatch_date, morph_tags, morphs_traits, image_urls, sire_name, dam_name')
      .eq('created_by', FOUNDER_EMAIL)
      .eq('gallery_display', true)
      .eq('is_public', true)
      .limit(8)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setSlides([]);
          return;
        }
        const filtered = data
          .map((g) => ({ ...g, _img: firstImageUrl(g.image_urls) }))
          .filter((g) => !!g._img)
          .slice(0, 6);
        setSlides(filtered);
      })
      .catch(() => {
        if (cancelled) return;
        setSlides([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!slides || slides.length < 2 || paused) return undefined;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, ADVANCE_MS);
    return () => clearInterval(id);
  }, [slides, paused]);

  if (!slides || slides.length === 0) return null;

  const current = slides[active];
  const morph = morphLine(current);
  const caption = pickCaption(active);

  return (
    <section className="relative z-10 max-w-3xl mx-auto px-6 pb-16">
      <div
        className="relative rounded-2xl overflow-hidden border border-emerald-500/25 bg-slate-950/60 shadow-2xl"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Photo frame, 4:3 aspect to suit horizontal hatchling shots */}
        <div className="relative aspect-[4/3] bg-slate-900">
          {slides.map((g, i) => (
            <img
              key={g.id}
              src={g._img}
              alt={g.name || 'A crested gecko in the Geck Inspect platform'}
              loading={i === 0 ? 'eager' : 'lazy'}
              className={
                'absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ' +
                (i === active ? 'opacity-100' : 'opacity-0')
              }
            />
          ))}

          {/* Dark gradient at bottom to anchor the caption text */}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

          {/* Top-left feature caption */}
          <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-black/50 backdrop-blur px-3 py-1 text-xs font-semibold text-emerald-200">
            <Play className="w-3 h-3" />
            {caption}
          </div>

          {/* Bottom-left animal info */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="text-white text-lg md:text-xl font-bold leading-tight drop-shadow">
              {current.name || 'Crested gecko'}
            </div>
            <div className="text-emerald-200/90 text-sm mt-0.5 drop-shadow">
              {[current.sex, morph].filter(Boolean).join(' · ')}
            </div>
            {(current.sire_name || current.dam_name) && (
              <div className="text-slate-300/90 text-xs mt-1 drop-shadow">
                {[current.sire_name, current.dam_name].filter(Boolean).join(' x ')}
              </div>
            )}
          </div>
        </div>

        {/* Footer note + dots, kept calm so the photo dominates */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950/70 border-t border-slate-800/60">
          <div className="text-[11px] text-slate-400">
            Real animals from the founder's collection, tracked in Geck Inspect.
          </div>
          <div className="flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={'Show slide ' + (i + 1)}
                onClick={() => setActive(i)}
                className={
                  'h-1.5 rounded-full transition-all ' +
                  (i === active
                    ? 'w-6 bg-emerald-400'
                    : 'w-1.5 bg-slate-600 hover:bg-slate-500')
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="text-center mt-3 text-xs text-slate-500">
        Hover to pause. <span className="text-slate-400">Slideshow placeholder</span>; a looping product video is coming.
        <ArrowRight className="w-3 h-3 inline ml-1 opacity-60" />
      </div>
    </section>
  );
}
