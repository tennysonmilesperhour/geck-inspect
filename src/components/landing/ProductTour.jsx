import { useEffect, useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { PRODUCT_TOUR_SLIDES, SCREENSHOTS_BASE } from '@/data/product-tour';

/**
 * Product tour slideshow on the public landing page.
 *
 * Replaces the previous HeroSlideshow (gecko photos) with feature
 * screenshots so cold visitors get a visual sense of what the app
 * actually looks like. Slides are driven by src/data/product-tour.js;
 * the underlying images live as static assets in /public/screenshots/.
 *
 * Self-pruning behavior: any slide whose image fails to load (404,
 * not-yet-captured, etc) is silently dropped. When you drop a real
 * screenshot into /public/screenshots/<file>, that slide starts
 * appearing on the next page load. The whole component renders nothing
 * if zero slides have valid images yet.
 *
 * Auto-advances every 4.5s. Hovering pauses. Dots let the visitor
 * jump to a specific slide. The frame is 16:10 to match a typical
 * laptop screen capture without too much horizontal stretching.
 */

const ADVANCE_MS = 4500;

// Only slides whose file is committed (shipped: true in
// src/data/product-tour.js) are requested. Probing every candidate cost
// each landing visit nine extra requests: production rewrites a missing
// /screenshots/*.png to the app HTML, so each probe downloaded a page
// before failing (October 2026 first-impression review).
const SHIPPED_SLIDES = PRODUCT_TOUR_SLIDES.filter((s) => s.shipped);
const HAS_PHONE_SHOTS = SHIPPED_SLIDES.every((s) => s.mobileFile);

export default function ProductTour() {
  if (SHIPPED_SLIDES.length === 0) return null;
  return <ProductTourSlides />;
}

function ProductTourSlides() {
  // Track which slides have valid images. Start with all candidates;
  // mark each as { ok: null } and the <img onError> drops it.
  const [statuses, setStatuses] = useState(() =>
    SHIPPED_SLIDES.map((s) => ({ ...s, ok: null }))
  );
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const visible = statuses.filter((s) => s.ok !== false);
  const current = visible[active] || visible[0];

  useEffect(() => {
    if (visible.length < 2 || paused) return undefined;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % visible.length);
    }, ADVANCE_MS);
    return () => clearInterval(id);
  }, [visible.length, paused]);

  // Keep `active` in range as slides drop out from failed loads.
  useEffect(() => {
    if (active >= visible.length && visible.length > 0) {
      setActive(0);
    }
  }, [visible.length, active]);

  // While images are still loading we render the candidates invisibly
  // off-screen so the browser actually fetches them and triggers
  // onLoad/onError. As soon as at least one resolves we show the tour.
  const anyResolved = statuses.some((s) => s.ok !== null);
  const noneValid =
    anyResolved && statuses.every((s) => s.ok === false);

  // Hidden when no screenshots exist yet, this is the natural state
  // before any images get committed to /public/screenshots/.
  if (noneValid) {
    return (
      <>
        {/* Preload probes, these never become visible but trigger
            the onError handlers above so the empty state stays correct
            after any later screenshot lands. */}
        {statuses.map((s) => (
          <img
            key={s.id}
            src={SCREENSHOTS_BASE + s.file}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}
            onLoad={() =>
              setStatuses((cur) =>
                cur.map((c) => (c.id === s.id ? { ...c, ok: true } : c))
              )
            }
            onError={() =>
              setStatuses((cur) =>
                cur.map((c) => (c.id === s.id ? { ...c, ok: false } : c))
              )
            }
          />
        ))}
      </>
    );
  }

  return (
    <section className="relative z-10 max-w-4xl mx-auto px-6 pb-16">
      <div
        className="home-glass-panel p-1.5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* 16:10 frame on laptops; on phones a 4:5 frame showing the phone
            capture (mobileFile), so the text in the screenshot stays
            readable instead of shrinking a laptop screen to 390 px. */}
        <div className={'relative overflow-hidden rounded-[14px] bg-slate-900 ' + (HAS_PHONE_SHOTS ? 'aspect-[4/5] sm:aspect-[16/10]' : 'aspect-[16/10]')}>
          {statuses.map((s, i) => {
            const visibleIndex = visible.findIndex((v) => v.id === s.id);
            const isActive = visibleIndex === active && s.ok !== false;
            return (
              <picture key={s.id}>
                {s.mobileFile && (
                  <source media="(max-width: 639px)" srcSet={SCREENSHOTS_BASE + s.mobileFile} />
                )}
              <img
                src={SCREENSHOTS_BASE + s.file}
                alt={`Geck Inspect: ${s.title}`}
                width="1600"
                height="1000"
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                onLoad={() =>
                  setStatuses((cur) =>
                    cur.map((c) => (c.id === s.id ? { ...c, ok: true } : c))
                  )
                }
                onError={() =>
                  setStatuses((cur) =>
                    cur.map((c) => (c.id === s.id ? { ...c, ok: false } : c))
                  )
                }
                className={
                  'absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-700 ' +
                  (isActive ? 'opacity-100' : 'opacity-0 pointer-events-none')
                }
              />
              </picture>
            );
          })}

          {/* Bottom gradient anchors the title text */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

          {/* Top-left feature badge */}
          {current && (
            <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-black/55 backdrop-blur px-3 py-1 text-xs font-semibold text-emerald-200">
              <Play className="w-3 h-3" />
              {current.title}
            </div>
          )}

          {/* Bottom caption */}
          {current && (
            <div className="absolute bottom-4 left-4 right-4">
              <div className="text-white text-base md:text-lg font-semibold leading-snug drop-shadow max-w-2xl">
                {current.caption}
              </div>
            </div>
          )}
        </div>

        {/* Footer dots */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="text-[11px] text-slate-400">
            The demo collection: sample geckos, value estimates from real listings.
          </div>
          {/* The 6 px dots are too dense to tap, so on touch screens they
              only show the position and the slides advance on their own. */}
          <div className="flex touch:pointer-events-none items-center gap-1.5">
            {visible.map((_, i) => (
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
      <div className="hidden md:block text-center mt-3 text-xs text-slate-500">
        Hover to pause.
        <ArrowRight className="w-3 h-3 inline ml-1 opacity-60" />
      </div>
    </section>
  );
}
