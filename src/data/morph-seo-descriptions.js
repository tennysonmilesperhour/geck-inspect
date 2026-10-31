/**
 * Hand-written search snippets (meta descriptions) for the morph pages
 * that search engines show most often.
 *
 * Why: the generated snippet was the page's definition sentence clipped
 * at 158 characters ("A Cappuccino crested gecko carries the Cappuccino
 * trait, which can alter..."), which told a searcher nothing they could
 * act on. Search Console in the weekly growth reports (docs/growth-reports/,
 * April to October 2026) showed these pages with the most impressions and
 * close to zero clicks: Extreme Harlequin (up to 254 impressions in 28
 * days), Chocolate (223), Red Base (213), Yellow Base (176), Harlequin
 * (147, 0.68% click-through), Cappuccino (113, 0 clicks), Pinstripe
 * (page two for "pinstripe crested gecko"), then Axanthic, Lilly White
 * and Lavender, the morph pages with the most search visits.
 *
 * Each snippet says what the morph looks like, how it is inherited, the
 * one confusion people search about, and the guide's price range. Prices
 * come from the morph's own entry in morph-guide.js, so a price change
 * there updates the snippet too. Polygenic looks are never described with
 * Punnett odds. Keep each one between 120 and 158 characters, with no
 * dashes as punctuation; src/lib/__tests__/morphSeoDescriptions.test.js
 * checks both.
 *
 * Dependency-free: scripts/prerender.mjs imports it through morphMeta.js.
 */

/** @type {Record<string, (morph: { priceRange?: string }) => string>} */
export const MORPH_META_DESCRIPTIONS = {
  // Added 28 Oct 2026; read its Search Console window from about 25 Nov.
  tiger: (m) =>
    `Tiger crested geckos have dark bands across the back. How Tiger differs from Brindle, how the look is bred, and typical prices (${m.priceRange}).`,
  'extreme-harlequin': (m) =>
    `Extreme Harlequin crested geckos have extensive light pattern on the sides and legs. How to tell one from a Harlequin, and typical prices (${m.priceRange}).`,
  chocolate: (m) =>
    `Chocolate crested geckos have a deep brown base color, richest when fired up. How to tell Chocolate from Buckskin, and typical prices (${m.priceRange}).`,
  'red-base': (m) =>
    `Red base crested geckos have a true red ground color that deepens when fired up. Red vs orange in photos, how red is inherited, and prices (${m.priceRange}).`,
  'yellow-base': (m) =>
    `Yellow base crested geckos have a bright, saturated yellow ground color. How a strong yellow differs from olive or a muted tone, and prices (${m.priceRange}).`,
  harlequin: (m) =>
    `Harlequin crested geckos have light pattern on the sides and legs, not just the back. How to tell one from a Flame or Extreme, and prices (${m.priceRange}).`,
  cappuccino: (m) =>
    `Cappuccino is an incomplete dominant gene, not just a brown color. How to identify one, why Cappuccino x Cappuccino is risky, and prices (${m.priceRange}).`,
  pinstripe: (m) =>
    `A Pinstripe crested gecko has cream scales along both raised ridges of its back. Full vs partial pinstripe, Phantom lookalikes, and prices (${m.priceRange}).`,
  axanthic: (m) =>
    `Axanthic crested geckos have no yellow or red pigment, only black, gray and white. It is recessive: how hets work, lookalikes, and prices (${m.priceRange}).`,
  'lilly-white': (m) =>
    `Lilly White is an incomplete dominant gene for bold white markings. Why two Lilly Whites should never be paired, how to spot one, and prices (${m.priceRange}).`,
  lavender: (m) =>
    `Lavender crested geckos have a purple gray base color, clearest when fired down. Why a gray gecko is not always Axanthic, and prices (${m.priceRange}).`,
};

/** The hand-written snippet for a morph, or null when it has none. */
export function morphMetaDescription(morph) {
  const write = morph?.slug ? MORPH_META_DESCRIPTIONS[morph.slug] : null;
  if (!write || !morph.priceRange) return null;
  return write(morph);
}
