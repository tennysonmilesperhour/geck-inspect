// Written by scripts/write-calculator-links.mjs from
// src/lib/genetics/calculatorCatalog.js. Do not edit by hand: change the
// catalog and run node scripts/write-calculator-links.mjs.
// src/lib/__tests__/calculatorLinkData.test.js fails when this is out of date.

/** Every /calculator/<slug> page, with the badge its gene carries. */
export const CALCULATOR_PAGE_BADGES = {
  "lilly-white": "proven",
  "axanthic": "proven",
  "phantom": "proven",
  "empty-back": "emerging",
  "soft-scale": "emerging",
  "whiteout": "emerging",
  "hypo": "emerging",
  "chocho": "emerging",
  "cappuccino": "proven",
  "sable": "emerging",
  "highway": "emerging"
};

/** The Cappuccino group's combos and supers, by option value. */
export const COMPLEX_OPTION_BADGES = {
  "cappuccino": "proven",
  "sable": "emerging",
  "highway": "emerging",
  "luwak": "emerging",
  "capp_highway": "emerging",
  "sable_highway": "emerging",
  "super_cappuccino": "proven",
  "super_sable": "emerging",
  "super_highway": "emerging"
};

/** The supers of the other genes, by the slug of their super label. */
export const SUPER_LABEL_BADGES = {
  "super-lilly-white": "proven",
  "super-empty-back": "emerging",
  "super-soft-scale": "emerging",
  "super-whiteout": "emerging"
};
