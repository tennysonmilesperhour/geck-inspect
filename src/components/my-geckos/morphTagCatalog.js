/**
 * Curated morph/trait tag catalog for crested geckos: the tags users can
 * attach to a gecko via MorphIDSelector, grouped for the picker UI.
 *
 * Plain JS (no JSX) so both the React components and the Node drift
 * check (scripts/check-genetics-consistency.mjs) can import it. Genetic
 * FACTS (inheritance, spellings, lethality) are owned by the Foundation
 * Genetics engine via src/lib/genetics; this file owns the UI grouping
 * and the polygenic/cosmetic tags the engine does not model.
 *
 * Inheritance classifications follow the Foundation Genetics consensus.
 * Trait list sourced from MorphMarket Morphpedia, Lil Monsters
 * Foundation Genetics, Fringemorphs, and community glossaries.
 *
 * Notes on intentional omissions:
 *   - Super Lilly White is embryonic-lethal (Lilly x Lilly loses ~25% of
 *     eggs). No animal walks around as one, so it isn't a taggable state.
 *   - Albino is not a proven crested gecko trait. Leucistic / axanthic
 *     animals get mislabeled as albino; keep the axanthic tag instead.
 */

export const MORPH_CATEGORIES = {
  "Proven Genetics (Incomplete Dominant)": {
    color: "bg-purple-900/50 border-purple-700",
    badge: "bg-purple-700",
    morphs: [
      "Lilly White",
      "Cappuccino", "Super Cappuccino",
      "Soft Scale", "Super Soft Scale",
      "Moonglow",
      "Empty Back", "Super Empty Back",
      "White Wall",
    ],
  },
  "Proven Genetics (Recessive)": {
    color: "bg-rose-900/50 border-rose-700",
    badge: "bg-rose-700",
    morphs: [
      "Axanthic",
    ],
  },
  "Combo Morphs": {
    color: "bg-fuchsia-900/50 border-fuchsia-700",
    badge: "bg-fuchsia-700",
    morphs: [
      "Frappuccino",
      "Cappuccino Lilly White",
      "Axanthic Lilly White",
      "Axanthic Cappuccino",
      "Soft Scale Lilly White",
      "Soft Scale Cappuccino",
      "Moonglow Lilly White",
    ],
  },
  "Het Status": {
    color: "bg-indigo-900/50 border-indigo-700",
    badge: "bg-indigo-700",
    morphs: [
      "Het Lilly White", "Possible Het Lilly White",
      "Het Axanthic", "Possible Het Axanthic",
      "Het Cappuccino", "Possible Het Cappuccino",
      "Het Soft Scale", "Possible Het Soft Scale",
      "Het Moonglow", "Possible Het Moonglow",
      "Het Empty Back", "Possible Het Empty Back",
    ],
  },
  "Base Patterns": {
    color: "bg-emerald-900/50 border-emerald-700",
    badge: "bg-emerald-700",
    morphs: [
      "Flame", "Chevron Flame",
      "Harlequin", "Extreme Harlequin",
      "Pinstripe", "Full Pinstripe", "Phantom Pinstripe",
      "Tiger",
      "Brindle", "Extreme Brindle",
      "Patternless",
      "Bicolor",
      "Tricolor",
      "Phantom",
      "Whiteout",
    ],
  },
  "Harlequin Variants": {
    color: "bg-pink-900/50 border-pink-700",
    badge: "bg-pink-700",
    morphs: [
      "Red Harlequin", "Extreme Red Harlequin",
      "Yellow Harlequin",
      "Cream Harlequin",
      "Orange Harlequin",
      "Halloween Harlequin",
    ],
  },
  "Pinstripe Variants": {
    color: "bg-cyan-900/50 border-cyan-700",
    badge: "bg-cyan-700",
    morphs: [
      "Partial Pinstripe",
      "Dashed Pinstripe",
      "Reverse Pinstripe",
      "Quad Stripe",
      "Super Stripe",
    ],
  },
  "Base Colors": {
    color: "bg-yellow-900/50 border-yellow-700",
    badge: "bg-yellow-700",
    morphs: [
      "Red Base", "Dark Red Base",
      "Orange Base",
      "Yellow Base", "Bright Yellow Base",
      "Cream Base",
      "Pink Base",
      "Olive Base", "Dark Olive Base",
      "Green Base",
      "Tan Base",
      "Brown Base", "Dark Brown Base",
      "Chocolate Base",
      "Buckskin Base",
      "Lavender Base",
      "Near Black Base",
    ],
  },
  "Color Traits": {
    color: "bg-amber-900/50 border-amber-700",
    badge: "bg-amber-700",
    morphs: [
      "Hypo",
      "Translucent",
      "High White",
      "High Contrast",
    ],
  },
  "Dalmatian & Spots": {
    color: "bg-blue-900/50 border-blue-700",
    badge: "bg-blue-700",
    morphs: [
      "Dalmatian", "Super Dalmatian",
      "Ink Spots", "Oil Spots",
      "Red Spots",
      "Confetti",
      "Spots on Head",
      "Dalmatian Tail",
    ],
  },
  "Structure & Texture": {
    color: "bg-violet-900/50 border-violet-700",
    badge: "bg-violet-700",
    morphs: [
      "Furred",
      "Crowned",
    ],
  },
  "Body Markings": {
    color: "bg-teal-900/50 border-teal-700",
    badge: "bg-teal-700",
    morphs: [
      "White Fringe",
      "Kneecaps",
      "Portholes",
      "Drippy Dorsal",
      "White Tipped Crests",
      "Colored Crests",
      "Side Stripe",
      "Tiger Striping",
      "Banded",
      "Broken Banding",
      "Chevron Pattern",
      "Diamond Pattern",
      "Reticulated",
      "Mottled",
      "Speckled",
    ],
  },
  "Display State": {
    color: "bg-slate-700/50 border-slate-600",
    badge: "bg-slate-600",
    morphs: [
      "Fired Up",
      "Fired Down",
      "Full Tail",
      "Tailless",
    ],
  },
};

// Flat set of every tag, used for dedup validation and search.
export const ALL_MORPHS = new Set(
  Object.values(MORPH_CATEGORIES).flatMap(c => c.morphs)
);
