import { captureEvent } from '@/lib/posthog';
import { CALCULATOR_PAGES_BY_SLUG, MORPH_GUIDE_SLUGS } from '@/lib/genetics/calculatorCatalog';

/**
 * One event name for every call to action on a Morph Guide detail page,
 * so the funnel from "searched for a morph" to "used the app" can be read
 * in one PostHog insight. `target` is where the click goes, `placement`
 * is which part of the page it came from.
 */
export function trackMorphCta(slug, target, placement) {
  captureEvent('morph_guide_cta_clicked', { slug, target, placement });
}

/**
 * The calculator page for a morph when one exists (/calculator/lilly-white),
 * otherwise the general calculator. A few guide slugs differ from the
 * engine's (White Wall is "whiteout" in the calculator), so those are
 * looked up through MORPH_GUIDE_SLUGS.
 */
export function calculatorHref(slug) {
  if (CALCULATOR_PAGES_BY_SLUG[slug]) return `/calculator/${slug}`;
  for (const [engineId, guideSlug] of Object.entries(MORPH_GUIDE_SLUGS)) {
    if (guideSlug !== slug) continue;
    const calcSlug = engineId.replace(/_/g, '-');
    if (CALCULATOR_PAGES_BY_SLUG[calcSlug]) return `/calculator/${calcSlug}`;
  }
  return '/calculator';
}
