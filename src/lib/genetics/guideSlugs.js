/**
 * The links between the genetics calculator and the Morph Guide that are
 * written by hand. Kept apart from calculatorCatalog.js, which re-exports
 * both, so the Morph Guide's public pages (each with a size budget) can
 * read them without loading the whole catalog of trait definitions.
 */

// Whiteout to /MorphGuide/whiteout, Sable to /MorphGuide/sable. Until
// 16 Oct 2026 whiteout pointed at White Wall and sable had no entry, so
// those outcome links never reached the new pages.

export const MORPH_GUIDE_SLUGS = {
  lilly_white: 'lilly-white',
  cappuccino: 'cappuccino',
  sable: 'sable',
  axanthic: 'axanthic',
  hypo: 'hypo',
  softscale: 'soft-scale',
  whiteout: 'whiteout',
  phantom: 'phantom',
  empty_back: 'empty-back',
  highway: 'highway',
  harlequin: 'harlequin',
  pinstripe: 'pinstripe',
  dalmatian: 'dalmatian',
  tiger: 'tiger',
  flame: 'flame',
  // combos
  frappuccino: 'frappuccino',
  luwak: 'luwak',
  tricolor: 'tricolor',
  patternless: 'patternless',
};

// Morph Guide pages with no calculator page of their own whose look the
// calculator reads as another gene: a White Wall tag counts as Whiteout
// (decision D13), so the White Wall page keeps its /calculator/whiteout
// button. Phantom Pinstripe is left out: its page says the label does not
// prove the Phantom gene. Used by morphguide/morphCta.js and the server
// HTML (scripts/prerender.mjs).
export const GUIDE_CALCULATOR_ALIASES = {
  'white-wall': 'whiteout',
};
