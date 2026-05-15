// Mirror of ids from src/components/morph-id/morphTaxonomy.js.
// Kept as a flat list here so the edge function prompt can constrain the
// model to return canonical ids. If you change the client taxonomy, update
// this file and bump TAXONOMY_VERSION below.
export const TAXONOMY_VERSION = "2026.04.17";

export const PRIMARY_MORPH_IDS = [
  "patternless", "flame", "chevron_flame", "harlequin", "extreme_harlequin",
  "super_harlequin", "pinstripe", "full_pinstripe", "partial_pinstripe",
  "phantom_pinstripe", "reverse_pinstripe", "quad_stripe", "super_stripe",
  "tiger", "super_tiger", "brindle", "extreme_brindle", "dalmatian",
  "super_dalmatian", "red_dalmatian", "ink_spot", "bicolor", "tricolor",
];

export const GENETIC_TRAIT_IDS = [
  "lily_white", "axanthic_vca", "axanthic_tsm", "cappuccino", "frappuccino",
  "moonglow", "soft_scale", "whiteout", "empty_back", "white_wall",
  "hypo", "melanistic",
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
  "red", "dark_red", "crimson", "orange", "burnt_orange", "yellow",
  "bright_yellow", "buttery", "cream", "pink", "coral", "olive", "dark_olive",
  "green", "tan", "buckskin", "brown", "dark_brown", "chocolate", "mahogany",
  "lavender", "charcoal", "near_black",
];

export const PATTERN_INTENSITY_IDS = ["none", "low", "medium", "high", "extreme"];
export const WHITE_AMOUNT_IDS = ["none", "trace", "low", "medium", "high", "extreme"];
export const FIRED_STATE_IDS = ["fired_up", "fired_down", "transitioning", "unknown"];
export const AGE_STAGE_IDS = ["hatchling", "juvenile", "subadult", "adult", "unknown"];
