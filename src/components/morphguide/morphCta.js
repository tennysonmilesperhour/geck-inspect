import { captureEvent } from '@/lib/posthog';
// Small tables, not the whole calculator catalog: the Morph Guide's pages
// have a size budget (scripts/write-calculator-links.mjs, guideSlugs.js).
import { CALCULATOR_PAGE_BADGES } from '@/lib/genetics/calculatorLinkData';
import { GUIDE_CALCULATOR_ALIASES, MORPH_GUIDE_SLUGS } from '@/lib/genetics/guideSlugs';

const hasCalculatorPage = (slug) => Object.hasOwn(CALCULATOR_PAGE_BADGES, String(slug));

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
 * engine's (Soft Scale is "softscale" in the engine), so those are looked
 * up through MORPH_GUIDE_SLUGS, and a White Wall page goes to the Whiteout
 * calculator (GUIDE_CALCULATOR_ALIASES).
 */
export function calculatorHref(slug) {
  if (hasCalculatorPage(slug)) return `/calculator/${slug}`;
  const alias = Object.hasOwn(GUIDE_CALCULATOR_ALIASES, String(slug)) ? GUIDE_CALCULATOR_ALIASES[slug] : null;
  if (alias && hasCalculatorPage(alias)) return `/calculator/${alias}`;
  for (const [engineId, guideSlug] of Object.entries(MORPH_GUIDE_SLUGS)) {
    if (guideSlug !== slug) continue;
    const calcSlug = engineId.replace(/_/g, '-');
    if (hasCalculatorPage(calcSlug)) return `/calculator/${calcSlug}`;
  }
  return '/calculator';
}
