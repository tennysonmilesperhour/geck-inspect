// Reference data for the daily health check (run-canary.mjs). Kept apart so
// the unit test in __tests__/references.test.js can check it without network.

export const CORE_TRAITS = [
  'Lilly White', 'Harlequin', 'Extreme Harlequin', 'Dalmatian',
  'Pinstripe', 'Cappuccino', 'Axanthic', 'Tri-color',
];

// Reference geckos and the band their estimate must land in. The bands are
// wide on purpose: they catch a broken pipeline ($0, $40,000, nothing), not
// ordinary market movement.
export const REFERENCE_GECKOS = [
  {
    label: 'Adult female Lilly White',
    gecko: { morph_tags: ['Lilly White'], sex: 'Female', weight_grams: 45 },
    min: 150, max: 3000,
  },
  {
    label: 'Unsexed Harlequin hatchling',
    gecko: { morph_tags: ['Harlequin'], sex: 'Unsexed', weight_grams: 5 },
    min: 30, max: 800,
  },
  {
    label: 'Adult male Axanthic',
    gecko: { morph_tags: ['Axanthic'], sex: 'Male', weight_grams: 42 },
    min: 250, max: 5000,
  },
  {
    label: 'Free-text Dalmatian juvenile',
    gecko: { morphs_traits: 'red dalmatian', sex: 'Female', weight_grams: 15 },
    min: 40, max: 1500,
  },
];
