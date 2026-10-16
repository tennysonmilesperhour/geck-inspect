import { useEffect, useState } from 'react';
import { HANDBOOK_GUIDE } from '@/data/keepers-guides/handbook';

/**
 * Which Keeper's Guide each Care Guide category shows, and loading them.
 *
 * Each care category gets at most one Keeper's Guide, based on which
 * guide actually covers that category's subject matter. Categories
 * without a clean mapping (Handling, Health, Life Stages) show none; the
 * long-form section cards cover them.
 *
 * The five guides are about 160 KB of text together, and the Care Guide
 * opens on Overview, which shows only the Handbook. So the Handbook comes
 * with the page and the other guides download after it has drawn (when
 * the browser is idle, or as soon as a visitor reaches for the topic
 * list). CareGuide.jsx waits up to GUIDE_WAIT_MS for a topic's guide
 * before switching to that topic, so the two normally appear together.
 * On a slow connection the topic opens after that wait with the guide's
 * space held (GUIDE_SPACE), and the guide fills it when it arrives, so
 * nothing below it jumps. The Keeper's Guide Series page
 * (CareGuideSeries.jsx) still imports all five with the page.
 */
export const CATEGORY_TO_GUIDE = {
  overview: 'handbook',
  housing: 'setup',
  feeding: 'feeding',
  breeding: 'breeding',
};

/** How long a topic switch waits for its guide before opening without it. */
export const GUIDE_WAIT_MS = 1000;

// The height of each downloaded guide's box on a phone, a small tablet
// and wider screens (measured on 16 Oct 2026 at 375, 600 and 1280 px),
// held while it downloads. Measure again if a guide's first slide changes.
export const GUIDE_SPACE = {
  setup: 'min-h-[965px] sm:min-h-[729px] md:min-h-[788px]',
  feeding: 'min-h-[883px] sm:min-h-[676px] md:min-h-[700px]',
  breeding: 'min-h-[960px] sm:min-h-[700px] md:min-h-[728px]',
};

const LOADERS = {
  setup: () => import('@/data/keepers-guides/setup').then((m) => m.SETUP_GUIDE),
  feeding: () => import('@/data/keepers-guides/feeding').then((m) => m.FEEDING_GUIDE),
  breeding: () => import('@/data/keepers-guides/breeding').then((m) => m.BREEDING_GUIDE),
};

const loaded = new Map([['handbook', HANDBOOK_GUIDE]]);
const pending = new Map();

/** Whether a care category shows a Keeper's Guide at all. */
export function hasKeepersGuide(categoryId) {
  return Boolean(CATEGORY_TO_GUIDE[categoryId]);
}

/** The guide for a care category if it is here already, otherwise null. */
export function cachedGuideFor(categoryId) {
  return loaded.get(CATEGORY_TO_GUIDE[categoryId]) || null;
}

/**
 * Resolves with the category's guide, or null when the category has none
 * or the download failed (the topic then shows without it, and the next
 * call tries again).
 */
export function loadGuideFor(categoryId) {
  const guideId = CATEGORY_TO_GUIDE[categoryId];
  if (!guideId) return Promise.resolve(null);
  if (loaded.has(guideId)) return Promise.resolve(loaded.get(guideId));
  if (!pending.has(guideId)) {
    const load = LOADERS[guideId] || (() => Promise.resolve(null));
    pending.set(
      guideId,
      load().then(
        (guide) => {
          pending.delete(guideId);
          if (guide) loaded.set(guideId, guide);
          return guide || null;
        },
        () => {
          pending.delete(guideId);
          return null;
        },
      ),
    );
  }
  return pending.get(guideId);
}

/** Starts every guide's download; safe to call more than once. */
export function preloadKeepersGuides() {
  for (const categoryId of Object.keys(CATEGORY_TO_GUIDE)) loadGuideFor(categoryId);
}

/**
 * The category's guide, re-rendering once it arrives if it was not here
 * yet. `waiting` is true while a guide the category has is still on its
 * way; it turns false if the download fails, and the topic shows without
 * its guide.
 */
export function useKeepersGuide(categoryId) {
  const guide = cachedGuideFor(categoryId);
  const [, setArrived] = useState(0);
  const [failed, setFailed] = useState(null);
  useEffect(() => {
    if (guide || !CATEGORY_TO_GUIDE[categoryId]) return undefined;
    let cancelled = false;
    loadGuideFor(categoryId).then((g) => {
      if (cancelled) return;
      if (g) setArrived((n) => n + 1);
      else setFailed(categoryId);
    });
    return () => {
      cancelled = true;
    };
  }, [categoryId, guide]);
  return { guide, waiting: !guide && hasKeepersGuide(categoryId) && failed !== categoryId };
}
