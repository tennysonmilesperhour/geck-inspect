// Crested gecko (Correlophus ciliatus) morph taxonomy.
// Structured for ML training: every label has a canonical id, category, display
// name, and notes an annotator or model can anchor to. Categories separate
// visual pattern/morph labels from genetically proven/named traits and from
// descriptive modifiers that combine orthogonally.
//
// Inheritance classifications follow the Foundation Genetics consensus
// (Lil Monsters Reptiles + Geckological, 2020–2026). Canonical vocabulary
// comes from `crested-gecko-app`:
//   - "incomplete dominant" (NOT "codominant") for Lilly White, Cappuccino,
//     Sable, Whiteout, Empty Back, Softscale, Fire.
//   - "unconfirmed" for traits whose inheritance has not been breeding-proven
//     (Marbling, Furry, Moonglow).
// If you touch a classification here, mirror the change in
// `crested-gecko-app/reference/ai-training-context.md` if relevant.
//
// Editing guidance: keep ids snake_case, keep lists sorted within a category,
// and prefer adding new entries over mutating existing ids (ids are persisted
// in the `gecko_images` table and used for label stability across versions).

export const TAXONOMY_VERSION = '2026.04.18';

/**
 * Primary morph = the dominant visual pattern class.
 * "inheritance" follows the Foundation Genetics consensus.
 *   fixed_dominant      = present in every animal (e.g. Tiger); cannot be bred out
 *   dominant            = one copy or two copies present the same phenotype
 *   incomplete_dominant = one copy visible, two copies is a distinct super form
 *   recessive           = only visible in homozygous animals
 *   polygenic           = selectively bred, not a single allele
 *   unconfirmed         = inheritance not breeding-proven yet
 */
export const PRIMARY_MORPHS = [
  { id: 'patternless',        label: 'Patternless',            inheritance: 'polygenic',   notes: 'Solid dorsal, no flame/pinstripe/harlequin. Can still have fringe / crests.' },
  { id: 'flame',              label: 'Flame',                  inheritance: 'polygenic',   notes: 'Dorsal pattern contrasts with flank base color. No pattern extending down legs.' },
  { id: 'chevron_flame',      label: 'Chevron Flame',          inheritance: 'polygenic',   notes: 'Flame with chevron-shaped dorsal markings.' },
  { id: 'harlequin',          label: 'Harlequin',              inheritance: 'polygenic',   notes: 'Pattern extends from dorsum onto legs/flanks.' },
  { id: 'extreme_harlequin',  label: 'Extreme Harlequin',      inheritance: 'polygenic',   notes: '60%+ pattern coverage on legs and body, high contrast.' },
  { id: 'super_harlequin',    label: 'Super Harlequin',        inheritance: 'polygenic',   notes: 'Pattern extends onto the belly and face, not just legs.' },
  { id: 'pinstripe',          label: 'Pinstripe',              inheritance: 'polygenic',   notes: 'Raised cream scales along dorsolateral ridges.' },
  { id: 'full_pinstripe',     label: 'Full Pinstripe (100%)',  inheritance: 'polygenic',   notes: 'Continuous pinstripe from shoulders to tail base, unbroken.' },
  { id: 'partial_pinstripe',  label: 'Partial Pinstripe',      inheritance: 'polygenic',   notes: 'Broken / interrupted pinstripe less than ~80% coverage.' },
  { id: 'phantom_pinstripe',  label: 'Phantom Pinstripe',      inheritance: 'polygenic',   notes: 'Raised scales along ridge without contrasting color.' },
  { id: 'reverse_pinstripe',  label: 'Reverse Pinstripe',      inheritance: 'polygenic',   notes: 'Dark pinstripe on lighter dorsum ,  inverse of typical.' },
  { id: 'quad_stripe',        label: 'Quad Stripe',            inheritance: 'polygenic',   notes: 'Pinstripe + lateral stripe on both flanks.' },
  { id: 'super_stripe',       label: 'Super Stripe',           inheritance: 'polygenic',   notes: 'Full pinstripe + quad stripe, often with tail stripe.' },
  { id: 'tiger',              label: 'Tiger',                  inheritance: 'polygenic',   notes: 'Vertical bands / stripes across flanks.' },
  { id: 'super_tiger',        label: 'Super Tiger',            inheritance: 'polygenic',   notes: 'Dense, high-contrast tiger banding.' },
  { id: 'brindle',            label: 'Brindle',                inheritance: 'polygenic',   notes: 'Irregular vertical barring; less organized than tiger.' },
  { id: 'extreme_brindle',    label: 'Extreme Brindle',        inheritance: 'polygenic',   notes: 'Heavy, high-contrast brindling across body.' },
  { id: 'dalmatian',          label: 'Dalmatian',              inheritance: 'polygenic',   notes: 'Discrete black/dark spots, any amount.' },
  { id: 'super_dalmatian',    label: 'Super Dalmatian',        inheritance: 'polygenic',   notes: '100+ spots, heavy coverage.' },
  { id: 'red_dalmatian',      label: 'Red Dalmatian',          inheritance: 'polygenic',   notes: 'Red-colored spots instead of black.' },
  { id: 'ink_spot',           label: 'Ink Spot',               inheritance: 'polygenic',   notes: 'Saturated black dalmatian-like spots with ink-dropped look.' },
  { id: 'bicolor',            label: 'Bicolor',                inheritance: 'polygenic',   notes: 'Dorsum one color, flanks a distinct second color; minimal pattern.' },
  { id: 'tricolor',           label: 'Tricolor',               inheritance: 'polygenic',   notes: 'Three-plus colors including cream/white, usually on harlequin base.' },
];

/**
 * Named genetic traits ,  heritable, proven or unconfirmed, travel orthogonal to
 * the primary-morph pattern. Keep ids stable; they become training labels.
 *
 * `canonical_trait_id` points at the matching trait in `crested-gecko-app`
 * (Foundation Genetics canonical form). Use that when you need inheritance,
 * source citations, or Punnett math ,  this file is for UI labels only.
 */
export const GENETIC_TRAITS = [
  { id: 'lily_white',       label: 'Lily White',        inheritance: 'incomplete_dominant',  canonical_trait_id: 'lilly_white',
    notes: 'Foundation Genetics: incomplete dominant. Originated by Lilly Exotics (UK). Super Lilly White is LETHAL ,  never pair Lilly × Lilly. Canonical spelling is "Lilly White" (two Ls).' },
  { id: 'axanthic_vca',     label: 'Axanthic (VCA)',    inheritance: 'recessive',            canonical_trait_id: 'axanthic',
    notes: 'Simple recessive. Removes yellow/red pigment, retains melanin (not albinism). Proven by Altitude Exotics.' },
  { id: 'axanthic_tsm',     label: 'Axanthic (TSM)',    inheritance: 'recessive',            canonical_trait_id: 'axanthic',
    notes: 'Different axanthic line; cross-line compatibility unconfirmed in some tests.' },
  { id: 'cappuccino',       label: 'Cappuccino',        inheritance: 'incomplete_dominant',  canonical_trait_id: 'cappuccino',
    notes: 'Foundation Genetics: incomplete dominant (NOT codominant). Discovered by Reptile City Korea (Donald Hendrickson, ~2020). Super form = Super Cappuccino / Melanistic, with documented health concerns (reduced nostril size, breathing difficulty). Allelic with Sable and Highway.' },
  { id: 'frappuccino',      label: 'Frappuccino',       inheritance: 'combo phenotype',
    notes: 'Combo morph: Cappuccino + Lilly White. Not a single gene.' },
  { id: 'moonglow',         label: 'Moonglow',          inheritance: 'unconfirmed',
    notes: 'Informal / marketing term. Not a Foundation Genetics-proven trait. Use with caution and prefer listing proven traits (Lilly White, Hypo, Yellow Base, etc.) when present.' },
  { id: 'soft_scale',       label: 'Soft Scale',        inheritance: 'incomplete_dominant',  canonical_trait_id: 'softscale',
    notes: 'Foundation Genetics: incomplete dominant producing a matte finish and smoother scale texture. Super form is healthy with enhanced matte effect.' },
  { id: 'whiteout',         label: 'Whiteout',          inheritance: 'incomplete_dominant',  canonical_trait_id: 'whiteout',
    notes: 'Incomplete dominant, originated by AC Reptiles (Anthony Caponetto). Distinct locus from Lilly White. Super Whiteout is HEALTHY and freely breedable ,  strategic advantage over Lilly White for stacking white.' },
  { id: 'empty_back',       label: 'Empty Back',        inheritance: 'incomplete_dominant',  canonical_trait_id: 'empty_back',
    notes: 'Foundation Genetics: incomplete dominant. Clears dorsal pattern. Super form is healthy and further suppresses dorsal pattern.' },
  { id: 'white_wall',       label: 'White Wall',        inheritance: 'phenotype',
    notes: 'Solid white flank expression, commonly seen on Lilly White combos. Not an independent gene.' },
  { id: 'hypo',             label: 'Hypo',              inheritance: 'dominant',             canonical_trait_id: 'hypo',
    notes: 'Dominant trait that reduces melanin. Combines with Black Base → Lavender, Red Base → Pink, Yellow Base → Cream/C2.' },
  { id: 'melanistic',       label: 'Melanistic',        inheritance: 'combo phenotype',      canonical_trait_id: 'cappuccino',
    notes: 'Synonymous with Super Cappuccino ,  the homozygous form of Cappuccino. Has documented health concerns; breeding specifically for supers is not recommended.' },
];

/**
 * Descriptive traits ,  modifiers that can co-occur with any primary morph.
 * Grouped by subcategory to make UI picking less overwhelming.
 */
export const SECONDARY_TRAITS = [
  // Pinstripe-family modifiers
  { id: 'dashed_pinstripe',       label: 'Dashed pinstripe',       group: 'pinstripe' },
  { id: 'broken_pinstripe',       label: 'Broken pinstripe',       group: 'pinstripe' },
  { id: 'tail_stripe',            label: 'Tail stripe',            group: 'pinstripe' },

  // Banding / bar patterns
  { id: 'banded',                 label: 'Banded',                 group: 'banding' },
  { id: 'broken_banding',         label: 'Broken banding',         group: 'banding' },
  { id: 'tiger_striping',         label: 'Tiger striping (mild)',  group: 'banding' },

  // Geometric dorsal patterns
  { id: 'chevron_pattern',        label: 'Chevron pattern',        group: 'dorsal' },
  { id: 'diamond_pattern',        label: 'Diamond pattern',        group: 'dorsal' },
  { id: 'drippy_dorsal',          label: 'Drippy dorsal',          group: 'dorsal' },
  { id: 'reticulated',            label: 'Reticulated',            group: 'dorsal' },
  { id: 'mottled',                label: 'Mottled',                group: 'dorsal' },
  { id: 'speckled',               label: 'Speckled / confetti',    group: 'dorsal' },

  // Spot patterns
  { id: 'ink_spots',              label: 'Ink spots',              group: 'spots' },
  { id: 'oil_spots',              label: 'Oil spots',              group: 'spots' },
  { id: 'red_spots',              label: 'Red spots',              group: 'spots' },
  { id: 'spots_on_head',          label: 'Spots on head',          group: 'spots' },
  { id: 'dalmatian_tail',         label: 'Dalmatian tail',         group: 'spots' },

  // White placement
  { id: 'white_fringe',           label: 'White fringe',           group: 'white' },
  { id: 'white_belly',            label: 'White belly',            group: 'white' },
  { id: 'white_tipped_crests',    label: 'White-tipped crests',    group: 'white' },
  { id: 'portholes',              label: 'Portholes',              group: 'white' },
  { id: 'kneecaps',               label: 'White kneecaps',         group: 'white' },
  { id: 'side_stripe',            label: 'Lateral / side stripe',  group: 'white' },
  { id: 'high_white',             label: 'High white',             group: 'white' },

  // Color / contrast level
  { id: 'high_contrast',          label: 'High contrast',          group: 'contrast' },
  { id: 'phantom',                label: 'Phantom (no warm tones)',group: 'contrast' },
  { id: 'colored_crests',         label: 'Colored crests',         group: 'contrast' },

  // Structural / cosmetic
  { id: 'crowned',                label: 'Crowned head',           group: 'structure' },
  { id: 'furred',                 label: 'Furred',                 group: 'structure' },
  { id: 'tailless',               label: 'Tailless / frog-butt',   group: 'structure' },

  // Fire state descriptors (redundant with fired_state field; OK as modifier)
  { id: 'fired_up_look',          label: 'Captured fired up',      group: 'state' },
  { id: 'fired_down_look',        label: 'Captured fired down',    group: 'state' },
];

export const SECONDARY_TRAIT_GROUPS = [
  { id: 'pinstripe', label: 'Pinstripe' },
  { id: 'banding',   label: 'Banding' },
  { id: 'dorsal',    label: 'Dorsal pattern' },
  { id: 'spots',     label: 'Spots' },
  { id: 'white',     label: 'White placement' },
  { id: 'contrast',  label: 'Color / contrast' },
  { id: 'structure', label: 'Structure' },
  { id: 'state',     label: 'Capture state' },
];

export const BASE_COLORS = [
  { id: 'red',          label: 'Red' },
  { id: 'dark_red',     label: 'Dark red' },
  { id: 'crimson',      label: 'Crimson' },
  { id: 'orange',       label: 'Orange' },
  { id: 'burnt_orange', label: 'Burnt orange' },
  { id: 'yellow',       label: 'Yellow' },
  { id: 'bright_yellow',label: 'Bright yellow' },
  { id: 'buttery',      label: 'Buttery' },
  { id: 'cream',        label: 'Cream' },
  { id: 'pink',         label: 'Pink' },
  { id: 'coral',        label: 'Coral' },
  { id: 'olive',        label: 'Olive' },
  { id: 'dark_olive',   label: 'Dark olive' },
  { id: 'green',        label: 'Green' },
  { id: 'tan',          label: 'Tan' },
  { id: 'buckskin',     label: 'Buckskin' },
  { id: 'brown',        label: 'Brown' },
  { id: 'dark_brown',   label: 'Dark brown' },
  { id: 'chocolate',    label: 'Chocolate' },
  { id: 'mahogany',     label: 'Mahogany' },
  { id: 'lavender',     label: 'Lavender' },
  { id: 'charcoal',     label: 'Charcoal' },
  { id: 'near_black',   label: 'Near black' },
];

export const PATTERN_INTENSITIES = [
  { id: 'none',     label: 'None (patternless)' },
  { id: 'low',      label: 'Low' },
  { id: 'medium',   label: 'Medium' },
  { id: 'high',     label: 'High' },
  { id: 'extreme',  label: 'Extreme' },
];

export const WHITE_AMOUNTS = [
  { id: 'none',     label: 'None' },
  { id: 'trace',    label: 'Trace' },
  { id: 'low',      label: 'Low' },
  { id: 'medium',   label: 'Medium' },
  { id: 'high',     label: 'High' },
  { id: 'extreme',  label: 'Extreme (whiteout-ish)' },
];

export const FIRED_STATES = [
  { id: 'fired_up',      label: 'Fired up',       notes: 'High contrast / saturated ,  animal warm or stressed.' },
  { id: 'fired_down',    label: 'Fired down',     notes: 'Washed out / low contrast ,  animal cool and relaxed.' },
  { id: 'transitioning', label: 'Transitioning',  notes: 'Mid-change between states.' },
  { id: 'unknown',       label: 'Unknown' },
];

export const AGE_STAGES = [
  { id: 'hatchling', label: 'Hatchling (<3mo)' },
  { id: 'juvenile',  label: 'Juvenile (3–12mo)' },
  { id: 'subadult',  label: 'Subadult (12–18mo)' },
  { id: 'adult',     label: 'Adult (18mo+)' },
  { id: 'unknown',   label: 'Unknown' },
];

export const SEX_OPTIONS = [
  { id: 'male',     label: 'Male' },
  { id: 'female',   label: 'Female' },
  { id: 'unsexed',  label: 'Unsexed / too young' },
  { id: 'unknown',  label: 'Unknown' },
];

export const PHOTO_ANGLES = [
  { id: 'top_down',     label: 'Top-down' },
  { id: 'side_profile', label: 'Side profile' },
  { id: 'three_quarter',label: 'Three-quarter' },
  { id: 'front_face',   label: 'Front / face' },
  { id: 'underside',    label: 'Underside / belly' },
  { id: 'tail_only',    label: 'Tail only' },
  { id: 'crests_only',  label: 'Head / crests close-up' },
];

export const LIGHTING_OPTIONS = [
  { id: 'natural_daylight',  label: 'Natural daylight' },
  { id: 'warm_artificial',   label: 'Warm artificial (incandescent)' },
  { id: 'cool_artificial',   label: 'Cool artificial (LED / fluorescent)' },
  { id: 'flash',             label: 'Camera flash' },
  { id: 'uv_basking',        label: 'UV / basking light' },
  { id: 'mixed',             label: 'Mixed' },
];

export const IMAGE_QUALITY_FLAGS = [
  { id: 'sharp',              label: 'Sharp focus',         positive: true },
  { id: 'slightly_blurry',    label: 'Slightly blurry' },
  { id: 'blurry',             label: 'Blurry' },
  { id: 'well_exposed',       label: 'Well exposed',        positive: true },
  { id: 'over_exposed',       label: 'Over-exposed' },
  { id: 'under_exposed',      label: 'Under-exposed' },
  { id: 'color_cast',         label: 'Strong color cast' },
  { id: 'reflection_glare',   label: 'Glass / reflection' },
  { id: 'partial_occlusion',  label: 'Partial occlusion (hand, plant)' },
  { id: 'cluttered_bg',       label: 'Cluttered background' },
  { id: 'plain_bg',           label: 'Plain background',    positive: true },
  { id: 'multiple_geckos',    label: 'Multiple geckos visible' },
];

/** Confidence preset labels to keep annotator grading consistent. */
export const CONFIDENCE_PRESETS = [
  { value: 100, label: 'Certain ,  I bred / own this animal' },
  { value: 90,  label: 'Very confident (clear traits, good photo)' },
  { value: 75,  label: 'Confident' },
  { value: 55,  label: 'Leaning' },
  { value: 35,  label: 'Guess' },
  { value: 15,  label: 'Unsure ,  reviewer input wanted' },
];

/** Provenance categories ,  drives how ML weights the label. */
export const PROVENANCE = [
  { id: 'expert_owner',      label: 'Expert: I bred or own this gecko',                weight: 1.0 },
  { id: 'expert_reviewed',   label: 'Expert: reviewed photo, confident identification', weight: 0.85 },
  { id: 'community',         label: 'Community: best-effort identification',            weight: 0.55 },
  { id: 'ai_then_expert',    label: 'AI guess, corrected by expert',                    weight: 0.80 },
  { id: 'web_crawl',         label: 'Web crawl ,  labels from listing',                  weight: 0.40 },
];

export const COMMONLY_CONFUSED = {
  harlequin: ['extreme_harlequin', 'super_harlequin', 'tricolor'],
  extreme_harlequin: ['super_harlequin', 'harlequin'],
  pinstripe: ['partial_pinstripe', 'phantom_pinstripe', 'full_pinstripe'],
  tiger: ['brindle', 'super_tiger'],
  brindle: ['tiger', 'extreme_brindle'],
  dalmatian: ['super_dalmatian', 'ink_spot'],
  flame: ['chevron_flame', 'harlequin'],
  bicolor: ['patternless', 'flame'],
  patternless: ['bicolor'],
};

// ---------------------------------------------------------------------------
// Lookup helpers ,  used by both /recognition and /training flows.

export const MORPH_BY_ID = Object.fromEntries(
  [...PRIMARY_MORPHS, ...GENETIC_TRAITS].map((m) => [m.id, m]),
);

export const TRAIT_BY_ID = Object.fromEntries(
  SECONDARY_TRAITS.map((t) => [t.id, t]),
);

export const TRAITS_BY_GROUP = SECONDARY_TRAIT_GROUPS.map((g) => ({
  ...g,
  traits: SECONDARY_TRAITS.filter((t) => t.group === g.id),
}));

export function labelFor(id, fallback = '') {
  if (!id) return fallback;
  return (
    MORPH_BY_ID[id]?.label ||
    TRAIT_BY_ID[id]?.label ||
    id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function confusedWith(morphId) {
  return COMMONLY_CONFUSED[morphId] || [];
}
