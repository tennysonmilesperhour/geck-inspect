import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { morphsByCategory } from '@/data/morph-guide';
import { trackMorphCta } from './morphCta';

const HINT_KEY = 'morphGuide:swipeHintSeen';
const MIN_DISTANCE = 80;
const MAX_TIME = 700;
const EDGE_IGNORE = 24;

/**
 * Previous and next morph in the same category, in guide order, wrapping
 * at the ends. Same order as MorphPrevNext in RelatedMorphs.jsx.
 */
export function morphNeighbors(morph) {
  if (!morph) return null;
  const list = morphsByCategory(morph.category);
  const i = list.findIndex((m) => m.slug === morph.slug);
  if (i === -1 || list.length < 2) return null;
  return {
    prev: list[(i - 1 + list.length) % list.length],
    next: list[(i + 1) % list.length],
  };
}

// True when the touch began inside something that scrolls sideways (the
// section bar, a photo strip) or a form field, where a swipe means
// "scroll this" rather than "next morph".
function startsInSideScroller(target, root) {
  let el = target instanceof Element ? target : null;
  while (el && el !== root) {
    if (el.matches?.('input, textarea, select, [data-no-swipe]')) return true;
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = window.getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

function readSeen() {
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, '1');
  } catch {
    /* private mode: the hint just shows again next time */
  }
}

/**
 * Swipe left or right on a morph page (on a phone) to go to the next or
 * previous morph in the same category. While a finger drags sideways a
 * small pill at that edge shows where it will go, and on a first visit
 * both pills show briefly as a hint.
 */
export default function MorphSwipeNav({ morph, targetRef }) {
  const navigate = useNavigate();
  const neighbors = morphNeighbors(morph);
  const [drag, setDrag] = useState(0); // -1..1, negative = towards next
  const [hint, setHint] = useState(false);
  const start = useRef(null);
  const slug = morph?.slug;

  // First-visit hint, touch screens only.
  useEffect(() => {
    if (!neighbors || typeof window === 'undefined') return undefined;
    if (!window.matchMedia?.('(pointer: coarse)').matches || readSeen()) return undefined;
    const showTimer = window.setTimeout(() => {
      setHint(true);
      markSeen();
    }, 1200);
    const hideTimer = window.setTimeout(() => setHint(false), 4600);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [slug]);

  useEffect(() => {
    const root = targetRef.current;
    if (!root || !neighbors) return undefined;
    const go = (dir) => {
      const m = dir === 'next' ? neighbors.next : neighbors.prev;
      const to = `/MorphGuide/${m.slug}`;
      trackMorphCta(slug, to, `swipe_${dir}`);
      navigate(to);
    };
    const onStart = (e) => {
      if (e.touches.length !== 1) {
        start.current = null;
        return;
      }
      const t = e.touches[0];
      if (t.clientX < EDGE_IGNORE || t.clientX > window.innerWidth - EDGE_IGNORE) return;
      if (startsInSideScroller(e.target, root)) return;
      start.current = { x: t.clientX, y: t.clientY, at: Date.now() };
    };
    const onMove = (e) => {
      const s = start.current;
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dy) > Math.abs(dx)) {
        setDrag(0);
        return;
      }
      setDrag(Math.max(-1, Math.min(1, dx / (MIN_DISTANCE * 1.5))));
    };
    const onEnd = (e) => {
      const s = start.current;
      start.current = null;
      setDrag(0);
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Date.now() - s.at > MAX_TIME) return;
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 2) return;
      // Selecting text with a drag is not a swipe.
      if (String(window.getSelection?.() || '').length > 0) return;
      go(dx < 0 ? 'next' : 'prev');
    };
    const onCancel = () => {
      start.current = null;
      setDrag(0);
    };
    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd);
    root.addEventListener('touchcancel', onCancel);
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onCancel);
    };
  }, [slug, targetRef, navigate]);

  if (!neighbors) return null;

  const pill = (dir) => {
    const m = dir === 'next' ? neighbors.next : neighbors.prev;
    const amount = dir === 'next' ? Math.max(0, -drag) : Math.max(0, drag);
    const visible = hint || amount > 0.05;
    const Icon = dir === 'next' ? ChevronRight : ChevronLeft;
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed top-[72%] z-40 flex max-w-[45vw] items-center gap-1 rounded-full border border-emerald-500/30 bg-neutral-950/90 py-1.5 text-xs font-medium text-emerald-100 shadow-lg backdrop-blur ${
          dir === 'next' ? 'right-0 rounded-r-none pl-3 pr-1.5' : 'left-0 rounded-l-none pl-1.5 pr-3'
        }`}
        style={{
          opacity: hint ? 1 : Math.min(1, amount * 1.4),
          transform: `translateY(-50%) translateX(${
            visible ? 0 : dir === 'next' ? 100 : -100
          }%) scale(${amount >= 0.99 ? 1.06 : 1})`,
          transition: drag === 0 ? 'opacity 300ms ease, transform 300ms ease' : 'none',
        }}
      >
        {dir === 'prev' && <Icon className="h-4 w-4 shrink-0" />}
        <span className="truncate">{m.name}</span>
        {dir === 'next' && <Icon className="h-4 w-4 shrink-0" />}
      </div>
    );
  };

  return (
    <>
      {pill('prev')}
      {neighbors.prev.slug !== neighbors.next.slug && pill('next')}
    </>
  );
}
