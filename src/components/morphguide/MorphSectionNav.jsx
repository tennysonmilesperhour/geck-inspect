import { useEffect, useRef, useState } from 'react';
import { useInAppShell } from '@/lib/appShell';

/**
 * Sticky, horizontally scrollable pill bar that jumps to each section of
 * a morph page and highlights the one being read. Sections need an `id`
 * and a scroll margin (scroll-mt-*) so the heading is not hidden under
 * the bar after a jump.
 *
 * Inside the app, plain CSS sticky works because the app's content area
 * is the scrolling box. On the public site it does not: html and body both
 * set overflow (index.css), which turns body into a scroll container that
 * never scrolls, so sticky never engages. There the bar switches to fixed
 * positioning once a marker above it scrolls out of view, and a spacer of
 * the same height keeps the page from jumping.
 */
export default function MorphSectionNav({ sections, className = '' }) {
  const [active, setActive] = useState(sections[0]?.id || null);
  const barRef = useRef(null);
  const sentinelRef = useRef(null);
  const wrapRef = useRef(null);
  const inAppShell = useInAppShell();
  const [pinned, setPinned] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  const ids = sections.map((s) => s.id).join('|');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!els.length) return undefined;
    const visible = new Map();
    // A section counts as "being read" while it crosses a band just under
    // the bar, so the highlight follows the heading the reader is on.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const current = els.find((el) => visible.get(el.id));
        if (current) setActive(current.id);
      },
      { rootMargin: '-96px 0px -55% 0px' },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // `ids` captures the section list; the array itself is rebuilt each render.
  }, [ids]);

  useEffect(() => {
    if (inAppShell) return undefined;
    const sentinel = sentinelRef.current;
    const lastId = ids.split('|').pop();
    if (!sentinel) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Pinned once the bar's spot has scrolled off the top, and released
      // again once the last section has gone by, so it does not sit over
      // the closing sign-up panel and the site footer.
      const height = wrapRef.current?.offsetHeight || 0;
      const last = document.getElementById(lastId);
      const next =
        sentinel.getBoundingClientRect().top < 0 &&
        (!last || last.getBoundingClientRect().bottom > height);
      if (next && height) setBarHeight(height);
      setPinned(next);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [inAppShell, ids]);

  // Keep the active pill in view inside the bar without moving the page.
  useEffect(() => {
    const bar = barRef.current;
    const pill = bar?.querySelector(`[data-section="${active}"]`);
    if (!bar || !pill) return;
    const left = pill.offsetLeft - (bar.clientWidth - pill.clientWidth) / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }, [active]);

  if (sections.length < 2) return null;

  const jump = (e, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setActive(id);
    if (window.history?.replaceState) window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <>
    <div ref={sentinelRef} aria-hidden="true" className={className} />
    {pinned && <div aria-hidden="true" style={{ height: barHeight }} />}
    <div
      ref={wrapRef}
      className={`z-30 py-2 bg-slate-950/90 backdrop-blur-md border-b border-neutral-800/80 ${
        pinned
          ? 'fixed inset-x-0 top-0 px-4 sm:px-0'
          : 'sticky top-0 -mx-4 sm:-mx-6 px-4 sm:px-6'
      }`}
    >
      <nav
        ref={barRef}
        aria-label="On this page"
        className={`flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          pinned ? 'max-w-5xl mx-auto sm:px-6' : ''
        }`}
      >
        {sections.map(({ id, label }) => {
          const isActive = id === active;
          return (
            <a
              key={id}
              href={`#${id}`}
              data-section={id}
              onClick={(e) => jump(e, id)}
              aria-current={isActive ? 'true' : undefined}
              className={`shrink-0 inline-flex items-center min-h-9 touch:min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-neutral-800 bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              {label}
            </a>
          );
        })}
      </nav>
    </div>
    </>
  );
}
