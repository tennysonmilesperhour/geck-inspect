// Mirror of ids from src/components/morph-id/morphTaxonomy.js.
// Kept as a flat list here so the edge function prompt can constrain the
// model to return canonical ids. If you change the client taxonomy, update
// this file and bump TAXONOMY_VERSION below.
export const TAXONOMY_VERSION = "2026.09.06";

export const PRIMARY_MORPH_IDS = [
  "patternless", "flame", "chevron_flame", "harlequin", "extreme_harlequin",
  "super_harlequin", "pinstripe", "full_pinstripe", "partial_pinstripe",
  "phantom_pinstripe", "reverse_pinstripe", "quad_stripe", "super_stripe",
  "tiger", "super_tiger", "brindle", "extreme_brindle", "dalmatian",
  "super_dalmatian", "red_dalmatian", "ink_spot", "bicolor", "tricolor",
];

export const GENETIC_TRAIT_IDS = [
  "lily_white", "axanthic", "axanthic_vca", "axanthic_tsm", "cappuccino",
  "frappuccino", "phantom_expression", "cream_on_cream", "moonglow", "soft_scale",
  "whiteout", "empty_back", "white_wall", "hypo", "melanistic",
];

// Deliberately narrower than the human annotation taxonomy. These are the
// visible-expression labels the photo model may return without lineage data.
export const PHOTO_GENETIC_TRAIT_IDS = [
  "lily_white", "axanthic", "cappuccino", "frappuccino",
  "phantom_expression", "cream_on_cream", "soft_scale", "whiteout",
  "empty_back", "white_wall", "hypo",
];

export const SECONDARY_TRAIT_IDS = [
  "dashed_pinstripe", "broken_pinstripe", "tail_stripe",
  "banded", "broken_banding", "tiger_striping",
  "chevron_pattern", "diamond_pattern", "drippy_dorsal", "reticulated",
  "mottled", "speckled",
  "ink_spots", "oil_spots", "red_spots", "spots_on_head", "dalmatian_tail",
  "white_fringe", "white_belly", "white_tipped_crests", "portholes",
  "kneecaps", "side_stripe", "high_white",
  "high_contrast", "phantom", "colored_crests",
  "crowned", "furred", "tailless",
  "fired_up_look", "fired_down_look",
];

export const BASE_COLOR_IDS = [
  "black_base", "red", "dark_red", "crimson", "orange", "burnt_orange", "yellow",
  "bright_yellow", "buttery", "cream", "pink", "coral", "olive", "dark_olive",
  "green", "tan", "buckskin", "brown", "dark_brown", "chocolate", "mahogany",
  "lavender", "charcoal", "near_black",
];

export const PATTERN_INTENSITY_IDS = ["unknown", "none", "low", "medium", "high", "extreme"];
export const WHITE_AMOUNT_IDS = ["unknown", "none", "trace", "low", "medium", "high", "extreme"];
export const PATTERN_COLOR_IDS = ["unknown", "none", "cream_white", "orange_yellow", "red_pink", "mixed"];
export const FIRED_STATE_IDS = ["fired_up", "fired_down", "transitioning", "unknown"];
export const AGE_STAGE_IDS = ["hatchling", "juvenile", "subadult", "adult", "unknown"];

// Orthogonal visual axes. Unlike primary_morph, these fields are designed
// to co-exist, which matches how seller tags and visible traits actually
// describe crested geckos.
export const PATTERN_FAMILY_IDS = [
  "unknown", "patternless", "flame", "harlequin", "extreme_harlequin",
];
export const PINNING_IDS = [
  "unknown", "none", "partial", "full", "phantom", "reverse", "quad", "super_stripe",
];
export const BANDING_IDS = [
  "unknown", "none", "tiger", "super_tiger", "brindle", "extreme_brindle",
];
export const SPOTTING_IDS = [
  "unknown", "none", "dalmatian", "super_dalmatian", "red_dalmatian", "ink_spot",
];
export const WHITE_PLACEMENT_IDS = [
  "white_fringe", "white_belly", "white_tipped_crests", "portholes",
  "kneecaps", "side_stripe", "high_white", "white_wall", "empty_back",
];
