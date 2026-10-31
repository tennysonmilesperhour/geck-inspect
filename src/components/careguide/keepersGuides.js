import { useEffect, useState } from 'react';

/**
 * Which Keeper's Guide each Care Guide category shows, and loading them.
 *
 * Each care category gets at most one Keeper's Guide, based on which
 * guide actually covers that category's subject matter. Categories
 * without a clean mapping (Handling, Health, Life Stages) show none; the
 * long-form section cards cover them.
 *
 * The five guides are about 160 KB of text together, so none of them comes
 * with the page. The Care Guide opens on Overview, which shows the
 * Handbook: its download starts as soon as the page has drawn, so the
 * hero, topic list and quick facts appear without waiting for 34 KB of
 * slide text that sits below them (on a phone, below the first screen).
 * The other guides download when the browser is idle, or as soon as a
 * visitor reaches for the topic list. CareGuide.jsx waits up to
 * GUIDE_WAIT_MS for a topic's guide before switching to that topic, so the
 * two normally appear together. While a guide downloads, its box holds
 * the guide's space (GUIDE_SPACE) and the guide fills it when it arrives,
 * so nothing below it jumps. The Keeper's Guide Series page
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
// and wider screens (measured on 16 Oct 2026 at 375, 600 and 1280 px; the
// Handbook on 31 Oct 2026 at 375, 700 and 1280 px), held while it
// downloads. Measure again if a guide's first slide changes.
export const GUIDE_SPACE = {
  handbook: 'min-h-[1003px] sm:min-h-[642px] md:min-h-[788px]',
  setup: 'min-h-[965px] sm:min-h-[729px] md:min-h-[788px]',
  feeding: 'min-h-[883px] sm:min-h-[676px] md:min-h-[700px]',
  breeding: 'min-h-[960px] sm:min-h-[700px] md:min-h-[728px]',
};

const LOADERS = {
  handbook: () => import('@/data/keepers-guides/handbook').then((m) => m.HANDBOOK_GUIDE),
  setup: () => import('@/data/keepers-guides/setup').then((m) => m.SETUP_GUIDE),
  feeding: () => import('@/data/keepers-guides/feeding').then((m) => m.FEEDING_GUIDE),
  breeding: () => import('@/data/keepers-guides/breeding').then((m) => m.BREEDING_GUIDE),
};

const loaded = new Map();
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
