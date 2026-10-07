import { config } from "zod";
import { TRAITS, getComboMorph, WILD_TYPE, tagToGenotype, predict, LOCI } from "crested-gecko-app";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const MORPH_CATEGORIES = [
  {
    id: "base",
    label: "Base color",
    blurb: "Ground color of the animal before pattern, structure, or modifiers."
  },
  {
    id: "color",
    label: "Color modifier",
    blurb: "Genes that modify or remove pigment: axanthic, hypo, etc."
  },
  {
    id: "pattern",
    label: "Pattern",
    blurb: "Markings layered on the base: harlequin, pinstripe, dalmatian, flame."
  },
  {
    id: "structure",
    label: "Structure",
    blurb: "Physical modifications to scales, crest, or tail."
  },
  {
    id: "combo",
    label: "Combination",
    blurb: "Named combinations of two or more morphs with distinct visual identity."
  }
];
const INHERITANCE = {
  recessive: {
    id: "recessive",
    label: "Recessive",
    short: "Rec",
    color: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    description: 'Two copies required for visual expression. A single copy produces a "het" (heterozygous) carrier that looks normal but can pass the gene to offspring.'
  },
  "co-dominant": {
    id: "co-dominant",
    label: "Co-dominant",
    short: "Co-dom",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    description: 'One copy is visible; two copies produce a distinct "super" form. Most hobby "codominant" morphs are technically incomplete dominant.'
  },
  "incomplete-dominant": {
    id: "incomplete-dominant",
    label: "Incomplete dominant",
    short: "Inc-dom",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    description: 'Single copy produces a visible form; two copies produce a distinct "super" form. The most common inheritance model in proven crested gecko morphs.'
  },
  dominant: {
    id: "dominant",
    label: "Dominant",
    short: "Dom",
    color: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    description: "A single copy is sufficient for full expression. Homozygous and heterozygous animals look identical."
  },
  polygenic: {
    id: "polygenic",
    label: "Polygenic",
    short: "Poly",
    color: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    description: "Trait controlled by many genes working additively. Cannot be Punnett-squared. Improved through selective breeding over generations."
  },
  "line-bred": {
    id: "line-bred",
    label: "Line-bred",
    short: "Line",
    color: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    description: 'Not a single gene, a "look" maintained by repeated pairings of animals that share the trait. Expresses on a gradient.'
  }
};
const RARITY = {
  common: {
    id: "common",
    label: "Common",
    color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    order: 1
  },
  uncommon: {
    id: "uncommon",
    label: "Uncommon",
    color: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    order: 2
  },
  rare: {
    id: "rare",
    label: "Rare",
    color: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    order: 3
  },
  very_rare: {
    id: "very_rare",
    label: "Very rare",
    color: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    order: 4
  }
};
const MORPHS$1 = [
  // ---------- PATTERN MORPHS ----------
  {
    slug: "harlequin",
    name: "Harlequin",
    definition: "A Harlequin crested gecko has conspicuous light pattern on the flanks and limbs as well as the back, with irregular patches separated by areas of base color.",
    lookalikes: [
      {
        "slug": "flame",
        "difference": "Flame emphasizes dorsal pattern with relatively little lateral and limb pattern; borderline examples exist."
      },
      {
        "slug": "extreme-harlequin",
        "difference": "Extreme describes more extensive lateral and limb pattern, without a universal percentage cutoff."
      },
      {
        "slug": "pinstripe",
        "difference": "Pinstripe concerns the raised edges of the back; an animal can be both harlequin and pinstripe."
      }
    ],
    aliases: ["Harley", "Harle"],
    category: "pattern",
    inheritance: "polygenic",
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics: "Traditional hobby guides describe variation in harlequin expression as polygenic. Foundation Genetics proposes an underlying pattern trait with incomplete dominant inheritance and modifying factors. These are different models; visible coverage alone does not demonstrate gene dosage.",
    rarity: "common",
    priceTier: "$$",
    priceRange: "$120 to $400",
    summary: "Light pattern on the flanks and limbs, with variable dorsal coverage.",
    description: "Look at the sides and legs, not just the back. Harlequin pattern can form irregular islands, branching edges and larger connected patches. Coverage varies, and one animal may also show pinstripe, banding or Dalmatian spots. A small amount of lateral pattern does not create a universally agreed boundary between flame and harlequin.",
    keyFeatures: [
      "Light pattern on the flanks and limbs",
      "Irregular patch boundaries and areas of visible base color",
      "Pinning, banding and spotting may coexist"
    ],
    visualIdentifiers: [
      "Compare both flanks and the legs with the dorsal pattern",
      "Use several specimens to learn the range of coverage",
      "Compare photographs in consistent lighting and firing states"
    ],
    history: "Emerged in the early 2000s as breeders selected for progressively more pattern coverage from flame-base stock.",
    combinesWith: ["dalmatian", "cream", "tricolor", "pinstripe", "lilly-white", "axanthic"],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
    sources: [
      "https://www.pangeareptile.com/collections/harlequin",
      "https://lmreptiles.com/fg-pt2-1/"
    ]
  },
  {
    slug: "extreme-harlequin",
    name: "Extreme Harlequin",
    definition: "An Extreme Harlequin crested gecko has extensive harlequin pattern on the flanks and limbs, often reaching above the middle of the sides; the label has no universal numerical cutoff.",
    lookalikes: [
      {
        "slug": "harlequin",
        "difference": "The distinction is the extent of lateral and limb pattern, with no universally accepted cutoff."
      },
      {
        "slug": "tricolor",
        "difference": "Tricolor describes distinguishable colors; it does not measure lateral coverage."
      }
    ],
    aliases: ["Extreme Harley", "EH", "Super Harley"],
    category: "pattern",
    inheritance: "polygenic",
    rarity: "uncommon",
    priceTier: "$$$",
    priceRange: "$350 to $900",
    summary: "Extensive lateral and limb pattern, with variable interruptions and contrast.",
    description: "Extreme is a coverage description used within harlequin variation. The light areas may join into broad patches or remain interrupted by dark pattern. They need not form solid rectangular panels. Assess the whole animal from both sides rather than estimating a precise percentage from one photograph.",
    keyFeatures: [
      "Extensive light pattern on the flanks and limbs",
      "Pattern often reaches above the middle of the flanks",
      "Base color can interrupt even very extensive light areas"
    ],
    visualIdentifiers: [
      "Check coverage on both sides and limbs",
      "Separate coverage from brightness, lighting and firing state"
    ],
    history: "Came from the tightening of harlequin selection in the mid-2000s, with Hatcher's Cresties and AC Reptiles among the early drivers.",
    combinesWith: ["cream", "tricolor", "dalmatian", "phantom-pinstripe", "axanthic"],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
    sources: [
      "https://www.pangeareptile.com/collections/harlequin",
      "https://lmreptiles.com/fg-pt2-1/"
    ]
  },
  {
    slug: "pinstripe",
    name: "Pinstripe",
    definition: "A Pinstripe crested gecko is a crested gecko whose raised scales along each side of the back are cream or yellow, forming two stripes that run from the neck toward the base of the tail.",
    lookalikes: [
      {
        "slug": "phantom-pinstripe",
        "difference": "The historical phantom-pinstripe label concerns reduced cream on the crest rows; it does not by itself prove genetic Phantom."
      },
      {
        "slug": "harlequin",
        "difference": "Harlequin describes flank and limb pattern and can coexist with pinstripe."
      }
    ],
    aliases: ["Pin"],
    category: "pattern",
    inheritance: "polygenic",
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics: "Pinstripe completeness responds to selective breeding. Foundation Genetics proposes a dominant underlying trait with variable expression. The illustration controls visible continuity and cannot identify a heterozygous or homozygous animal.",
    rarity: "common",
    priceTier: "$$",
    priceRange: "$120 to $350",
    summary: "Light coloration following the paired raised edges of the back.",
    description: "Pinstripe is light coloration along the paired raised scale rows bordering the dorsal field. Full pinstripe describes continuous lines; partial pinstripe has interruptions. Follow each row separately in an overhead or oblique photograph. Broad cream on the back is a different feature.",
    keyFeatures: [
      "Light scales follow the two raised crest rows",
      "Full and partial describe continuity, not body color",
      "Can coexist with harlequin pattern, banding and spots"
    ],
    visualIdentifiers: [
      "Use an overhead or oblique view to see both rows",
      "Distinguish the narrow crest rows from the broad dorsal field"
    ],
    history: "One of the first named polygenic traits in the hobby, recognized by the early 2000s.",
    combinesWith: ["harlequin", "cream", "phantom-pinstripe", "dalmatian", "lilly-white", "axanthic"],
    notes: "Sellers sometimes estimate pinning percentages, but viewing angle and scoring conventions vary. A dark line immediately below the raised row is commonly called reverse pinstripe; it is not synonymous with Phantom.",
    sources: [
      "https://www.pangeareptile.com/collections/pinstripe",
      "https://lmreptiles.com/fg-pt2-1/"
    ]
  },
  {
    slug: "phantom-pinstripe",
    name: "Phantom Pinstripe",
    definition: "Phantom Pinstripe is a historical visual label for pinstripe-like raised back rows with reduced cream coloration; the label alone does not establish the animal's genetics.",
    lookalikes: [
      {
        "slug": "pinstripe",
        "difference": "Visible pinstripe highlights the raised rows; cream continuity alone cannot establish Phantom status."
      }
    ],
    aliases: [
      "Phantom Pin"
    ],
    category: "pattern",
    inheritance: "polygenic",
    // Dual-model note (D13): the traditional label stays; the paragraph
    // below gives the Foundation Genetics reading.
    foundationGenetics: "Foundation Genetics and AC Reptiles describe recessive Phantom models. Do not infer a carrier or homozygous state from a dark crest row or from the older phantom-pinstripe sale label.",
    rarity: "rare",
    priceTier: "$$$",
    priceRange: "$500 to $1,500",
    summary: "A historical visual label that needs to be distinguished from genetic Phantom and reverse pinstripe.",
    description: "Usage has changed across breeders and over time. Genetic Phantom is associated with suppression of parts of the usual pattern, and should be discussed using the breeder's lineage and model. The absence of a cream pinstripe is not enough to identify it. Reverse pinstripe instead describes a dark line below the crest row; it may occur alongside a visible cream pinstripe.",
    keyFeatures: [
      "Reduced light coloration on raised dorsal rows in the historical usage",
      "Absence of cream alone is not diagnostic",
      "Reverse pinstripe is a separate visible feature"
    ],
    visualIdentifiers: [
      "Describe crest color, dorsal field and flank pattern separately",
      "Ask which definition and lineage support a Phantom label"
    ],
    history: "The older appearance-based term and more recent genetic usage are not interchangeable.",
    combinesWith: ["extreme-harlequin", "tricolor", "lilly-white", "axanthic", "cream"],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=54",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  {
    slug: "dalmatian",
    name: "Dalmatian",
    definition: "A Dalmatian crested gecko shows discrete pigmented spots, commonly black or red, which vary in size, shape and distribution and may overlap lighter pattern.",
    lookalikes: [
      {
        "slug": "super-dalmatian",
        "difference": "Super Dalmatian may describe heavy spotting or a breeder's genetic claim; there is no universal spot-count test."
      }
    ],
    aliases: ["Dal", "Dally"],
    category: "pattern",
    inheritance: "polygenic",
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics: "Some breeders model Dalmatian as a dominant or incomplete-dominant trait and use super for a homozygous animal. Other listings use super as a visual grade. A spot count alone does not distinguish these meanings.",
    rarity: "common",
    priceTier: "$$",
    priceRange: "$100 to $400",
    summary: "Discrete pigmented spots that can coexist with other patterns.",
    description: "Look for individual spots rather than treating every dark band or cream fleck as spotting. Spots can vary from small dots to larger irregular blotches, and may occur over both base color and light pattern. Their number, size and visibility can change with age and firing state. White portholes and other white markings are separate features.",
    keyFeatures: [
      "Individual pigmented spots with variable sizes and edges",
      "Black and red spots can occur on the same animal",
      "Spotting can coexist with cream pattern and pinstripe"
    ],
    visualIdentifiers: [
      "Inspect more than one side and more than one firing state",
      "Do not classify genotype from a spot count",
      "Distinguish pale portholes from pigmented spots"
    ],
    history: "Long-established trait, recognized since the earliest organized breeding in the late 1990s.",
    combinesWith: ["harlequin", "pinstripe", "cream", "lilly-white", "axanthic", "super-dalmatian"],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=67",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  {
    slug: "super-dalmatian",
    name: "Super Dalmatian",
    definition: "Super Dalmatian is used for heavily spotted crested geckos and, in some breeder models, for a homozygous Dalmatian; the meanings cannot be equated by counting spots.",
    lookalikes: [
      {
        "slug": "dalmatian",
        "difference": "The visual distinction is the degree of spotting; a single cutoff does not establish gene dosage."
      }
    ],
    aliases: ["Super Dal"],
    category: "pattern",
    inheritance: "polygenic",
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics: "Foundation Genetics models Dalmatian as a dominant trait with a homozygous Super Dalmatian form. In that model, inheritance predictions follow the documented genotype. They must not be applied automatically to every heavily spotted animal sold as super.",
    rarity: "uncommon",
    priceTier: "$$$",
    priceRange: "$300 to $800",
    summary: "Heavy spotting; ask whether super denotes appearance or a documented genetic claim.",
    description: "Describe the visible spot density, size and distribution first. Sellers use different standards for super Dalmatian, and a fixed threshold such as 100 spots is not a genetic test. Age, firing state, other traits and which parts of the animal are visible affect a count.",
    keyFeatures: [
      "Extensive or dense spotting in the visual usage",
      "Spot sizes and distribution remain variable",
      "A genetic super claim needs lineage or breeding evidence"
    ],
    visualIdentifiers: [
      "Compare multiple photographs rather than counting one side",
      "Ask how the breeder uses the term super"
    ],
    history: 'The "super" designation came with breeders tightening selection pressure on spot count through the 2010s.',
    combinesWith: ["harlequin", "extreme-harlequin", "pinstripe", "lilly-white", "axanthic"],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=67",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  {
    slug: "flame",
    name: "Flame",
    definition: "A Flame crested gecko has conspicuous lighter dorsal pattern with relatively little pattern on the flanks and limbs.",
    lookalikes: [
      {
        "slug": "harlequin",
        "difference": "Harlequin has more conspicuous lateral and limb pattern; the boundary is descriptive."
      },
      {
        "slug": "bicolor",
        "difference": "Bicolor describes a contrasting dorsal color field with little internal pattern; flame emphasizes dorsal markings."
      }
    ],
    aliases: [],
    category: "pattern",
    inheritance: "polygenic",
    rarity: "common",
    priceTier: "$",
    priceRange: "$60 to $180",
    summary: "Dorsal pattern dominates; flank and leg pattern is limited.",
    description: "Flame directs attention to the patterned dorsal field. Some examples have subtle lateral or limb markings, so perfectly blank sides are not a requirement. Compare the amount and organization of flank and limb pattern when discussing flame versus harlequin.",
    keyFeatures: [
      "Light pattern is most conspicuous on the back",
      "Relatively limited lateral and limb pattern",
      "Broad dorsal pattern is distinct from a narrow pinstripe"
    ],
    visualIdentifiers: [
      "Compare the dorsal field with the flanks and legs",
      "Recognize that borderline flame and harlequin labels vary"
    ],
    history: "Recognized since the earliest days of the hobby. Named for the flame-like markings running along the back.",
    combinesWith: ["dalmatian", "cream", "pinstripe", "lilly-white"],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/",
      "https://www.pangeareptile.com/collections/harlequin"
    ]
  },
  {
    slug: "tiger",
    name: "Tiger",
    definition: "A Tiger crested gecko shows dark transverse markings across the back that may continue down the flanks, with naturally variable spacing, width and continuity.",
    lookalikes: [
      {
        "slug": "brindle",
        "difference": "Brindle commonly describes more broken or reticulated transverse pattern; terminology overlaps."
      },
      {
        "slug": "tiger-brindle",
        "difference": "Tiger/brindle acknowledges overlapping banded and interrupted appearances."
      }
    ],
    aliases: [],
    category: "pattern",
    inheritance: "polygenic",
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics: "The traditional hobby reading treats Tiger as a polygenic pattern style. Foundation Genetics goes further: it models tiger as a fixed dominant trait present to some degree in every crested gecko, which cannot be bred out. Under that model, the ratio of tiger to other pattern traits decides whether an animal shows subtle freckling, classic vertical tigering, or heavy brindle. Both views agree that pairing strongly tigered animals intensifies the look.",
    rarity: "uncommon",
    priceTier: "$$",
    priceRange: "$150 to $400",
    summary: "Dark transverse banding with variable contrast and continuity.",
    description: "Follow the direction of the dark markings across the back. Real bands are not mechanically straight, identical or evenly spaced. More interrupted or reticulated patterns are often called brindle, and breeders may use tiger/brindle for overlapping appearances.",
    keyFeatures: [
      "Transverse orientation across the dorsal field",
      "Unequal band widths and irregular edges",
      "Contrast can change with firing state"
    ],
    visualIdentifiers: [
      "Use a top view for direction and a side view for continuation",
      "Do not require perfectly parallel stripes"
    ],
    history: "Long-established polygenic trait, recognized in breeding programs since the early 2000s.",
    combinesWith: ["brindle", "extreme-brindle", "red-base", "olive", "chocolate", "harlequin"],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  {
    slug: "brindle",
    name: "Brindle",
    definition: "A Brindle crested gecko has irregular, broken or reticulated dark transverse pattern, a descriptive appearance that overlaps with tiger.",
    lookalikes: [
      {
        "slug": "tiger",
        "difference": "Tiger usually emphasizes recognizable transverse bands; both can have irregular edges and flank markings."
      }
    ],
    aliases: [],
    category: "pattern",
    inheritance: "polygenic",
    rarity: "uncommon",
    priceTier: "$$",
    priceRange: "$180 to $450",
    summary: 'Heavier, more irregular banding than tiger, often described as "broken" or "marbled" tiger.',
    description: "Brindle commonly describes broken or interconnected dark banding. It is not defined only by stronger contrast or by whether markings reach the flanks. Observe direction, interruptions and branching together.",
    keyFeatures: [
      "Broken or interconnected dark markings",
      "Irregular band widths, spacing and continuity",
      "Terminology overlaps with tiger"
    ],
    visualIdentifiers: [
      "Follow branching and interruptions across the back and flanks"
    ],
    history: "Recognized alongside tiger as breeders noted both patterns appeared in the same lines at different expression levels.",
    combinesWith: ["tiger", "extreme-brindle", "red-base", "olive", "chocolate", "harlequin"],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  {
    slug: "extreme-brindle",
    name: "Extreme Brindle",
    definition: "An Extreme Brindle crested gecko is a crested gecko whose dark brindle pattern covers most of the back and spreads onto the flanks, so the back can look almost fully dark.",
    lookalikes: [
      { slug: "brindle", difference: "A Brindle still shows plenty of base color between its broken bands; an Extreme Brindle's dark pattern takes over most of the back." }
    ],
    aliases: [],
    category: "pattern",
    inheritance: "polygenic",
    rarity: "rare",
    priceTier: "$$$",
    priceRange: "$400 to $1,000",
    summary: "Dominant, coverage-heavy brindle with dark pattern consuming most of the dorsum and flanks.",
    description: "Extreme brindle describes an animal where the brindle pattern covers the majority of the dorsum and often the flanks, producing a dramatic high-coverage look. Rare compared to standard brindle, extreme brindle is selectively maintained and stacks powerfully with strong base colors.",
    keyFeatures: [
      "Dark pattern covers the dorsum and extends to the flanks",
      "Pattern may appear almost fully dark over the back",
      "Often paired with vibrant base colors to maintain contrast"
    ],
    combinesWith: ["red-base", "olive", "chocolate", "tiger-brindle", "harlequin", "dalmatian"]
  },
  {
    slug: "tiger-brindle",
    name: "Tiger / Brindle",
    definition: "A Tiger / Brindle crested gecko is a crested gecko whose dark banding sits between the two looks, mixing tiger-like parallel lines with brindle-like irregular patches.",
    lookalikes: [
      {
        "slug": "tiger",
        "difference": "Tiger emphasizes recognizable transverse bands."
      },
      {
        "slug": "brindle",
        "difference": "Brindle emphasizes broken or interconnected dark pattern."
      }
    ],
    aliases: ["T/B", "Tiger Brindle"],
    category: "pattern",
    inheritance: "polygenic",
    rarity: "uncommon",
    priceTier: "$$",
    priceRange: "$150 to $400",
    summary: 'Intermediate expression between tiger and brindle, sold as a single "T/B" category in much of the hobby.',
    description: "Many animals fall between pure tiger and full brindle. T/B (tiger/brindle) captures that intermediate expression. Widely used in sale listings when the pattern is banded but not purely regular.",
    keyFeatures: [
      "Banding visible but not perfectly regular",
      "Mix of tiger-like parallel lines and brindle-like irregular patches",
      "Common in most polygenic pattern lines"
    ],
    combinesWith: ["red-base", "olive", "chocolate", "harlequin", "dalmatian"]
  },
  // ---------- STRUCTURE MORPHS ----------
  {
    slug: "soft-scale",
    name: "Soft Scale",
    definition: "Soft Scale is an AC Reptiles trait associated with subtle differences in skin texture and appearance; it can be difficult to identify from photographs.",
    lookalikes: [
      {
        "slug": "super-soft-scale",
        "difference": "The super form is described as more pronounced, but visual assessment alone can be difficult."
      }
    ],
    aliases: ["SS"],
    category: "structure",
    inheritance: "incomplete-dominant",
    rarity: "uncommon",
    priceTier: "$$$",
    priceRange: "$400 to $1,000",
    summary: "Subtle scale and texture differences requiring close comparison and lineage.",
    description: "AC Reptiles describes differences in scale spacing, texture and coloration, with a more conspicuous Super Soft Scale form. Ordinary photographs, eye color or a smooth-looking drawing are insufficient to establish the trait.",
    keyFeatures: [
      "Subtle scale-spacing and texture differences",
      "Expression varies with the animal and other traits",
      "Use documented lineage and close comparative photographs"
    ],
    visualIdentifiers: [
      "Compare detailed photographs with documented examples",
      "Do not infer gene dosage from apparent smoothness alone"
    ],
    history: "Developed by Anthony Caponetto at AC Reptiles from animals held in the early 2000s.",
    combinesWith: ["super-soft-scale", "white-wall", "lilly-white", "cappuccino", "axanthic"],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=55"
    ]
  },
  {
    slug: "super-soft-scale",
    name: "Super Soft Scale",
    definition: "Super Soft Scale is the homozygous form described in the AC Reptiles Soft Scale project, with more pronounced texture and appearance differences.",
    lookalikes: [
      {
        "slug": "soft-scale",
        "difference": "Expression overlaps in photographs; do not establish dosage from apparent smoothness."
      }
    ],
    aliases: ["SSS", "Super SS"],
    category: "structure",
    inheritance: "incomplete-dominant",
    rarity: "rare",
    priceTier: "$$$$",
    priceRange: "$1,200 to $3,500",
    summary: "The more pronounced form in the Soft Scale breeding model.",
    description: "The super designation refers to the breeding model, not to a requirement for scaleless or leather-like skin. Retained scales and crest structure vary. Use documented project animals for comparison.",
    keyFeatures: [
      "More pronounced expression in the Soft Scale project",
      "Not a scaleless animal",
      "Lineage and breeding evidence support the genetic label"
    ],
    history: "Developed within the AC Reptiles Soft Scale project.",
    combinesWith: ["lilly-white", "axanthic", "cappuccino", "white-wall"],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=55"
    ]
  },
  {
    slug: "white-wall",
    name: "White Wall",
    definition: "White Wall commonly describes extensive pale lateral pattern; breeders may also use the term within specific Whiteout or white-pattern inheritance models.",
    lookalikes: [
      {
        "slug": "lilly-white",
        "difference": "Lateral white alone does not identify Lilly White."
      },
      {
        "slug": "white-wall-white-spot",
        "difference": "White-spot terminology concerns discrete pale lateral areas and varies by model."
      }
    ],
    aliases: ["WW"],
    category: "structure",
    inheritance: "incomplete-dominant",
    rarity: "rare",
    priceTier: "$$$$",
    priceRange: "$1,500 to $4,000",
    summary: "Extensive pale flank pattern; terminology depends on the breeder and line.",
    description: "Describe the location and extent of the lateral white first. A connected flank patch is not proof of Lilly White or a universal White Wall genotype. Whiteout, white wall and white-spot terminology differs between breeding models.",
    keyFeatures: [
      "Extensive lateral white or cream pattern",
      "The term may describe appearance or a breeder-specific genetic model"
    ],
    visualIdentifiers: [
      "Examine both flanks",
      "Ask which lineage and inheritance model support the label"
    ],
    history: "The terminology is used across breeder projects, including AC Reptiles Whiteout work.",
    combinesWith: ["lilly-white", "white-wall-white-spot", "soft-scale", "axanthic"],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=55",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  {
    slug: "white-wall-white-spot",
    name: "White Wall White Spot",
    definition: "White Wall White Spot is used for white-pattern traits involving pale lateral patches or spots; the exact meaning depends on the breeder's terminology and lineage.",
    lookalikes: [
      {
        "slug": "white-wall",
        "difference": "Connected versus separate pale areas can help describe appearance, but does not establish genotype."
      }
    ],
    aliases: ["WWWS", "White Spot"],
    category: "structure",
    inheritance: "incomplete-dominant",
    rarity: "rare",
    priceTier: "$$$$",
    priceRange: "$1,500 to $4,000",
    summary: "A white-pattern label whose meaning needs breeder context.",
    description: "Separate what is visible from a genetic claim. Record whether the pale lateral pattern forms isolated patches, connected walls or spreading markings. Similar appearances can be described differently between projects.",
    keyFeatures: [
      "Pale lateral patches or spots",
      "Label and inheritance need project-specific context"
    ],
    combinesWith: ["lilly-white", "white-wall", "soft-scale", "axanthic"],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  {
    slug: "cappuccino",
    name: "Cappuccino",
    definition: "A Cappuccino crested gecko carries the Cappuccino trait, which can alter pattern and pigmentation across a wide range of appearances; coffee-brown color or a saddle alone is not diagnostic.",
    lookalikes: [
      {
        "slug": "frappuccino",
        "difference": "Frappuccino combines Cappuccino with Lilly White; appearance is variable and requires supporting lineage."
      }
    ],
    aliases: ["Cap", "Cappy"],
    category: "structure",
    inheritance: "incomplete-dominant",
    rarity: "uncommon",
    priceTier: "$$$",
    priceRange: "$400 to $1,200",
    summary: "A genetic trait with variable appearance across ages and combinations.",
    description: "Cappuccino appearance varies with age, base color and other traits. Breeders often inspect the pale marking at the tail base in young animals together with the overall pattern and documented lineage. There is no universal coffee-brown body or clean-edged saddle that identifies every Cappuccino.",
    keyFeatures: [
      "Variable pigmentation and pattern",
      "A pale tail-base marking can be a clue in juveniles",
      "Confirmation depends on the breeder's documented line and evidence"
    ],
    visualIdentifiers: [
      "Compare age-matched documented examples",
      "Do not identify it from brown color alone"
    ],
    history: "The project was developed in South Korea and later investigated through breeder collaborations, including Pangea.",
    combinesWith: ["lilly-white", "soft-scale", "harlequin", "axanthic", "dalmatian"],
    sources: [
      "https://www.pangeareptile.com/blogs/blog/cappuccino-frappuccino-melanistic"
    ],
    notes: "Two Cappuccino copies produce the melanistic form associated with serious health concerns. Avoid Cappuccino-to-Cappuccino pairings."
  },
  {
    slug: "frappuccino",
    name: "Frappuccino",
    definition: "A Frappuccino crested gecko combines Cappuccino and Lilly White; its white coverage, pigmentation and pattern vary with age and other traits.",
    lookalikes: [
      {
        "slug": "lilly-white",
        "difference": "Extra white alone does not demonstrate Cappuccino; establish the combination through lineage."
      },
      {
        "slug": "cappuccino",
        "difference": "Frappuccino also carries Lilly White."
      }
    ],
    aliases: ["Frap"],
    category: "combo",
    inheritance: "incomplete-dominant",
    rarity: "rare",
    priceTier: "$$$$",
    priceRange: "$1,500 to $3,500",
    summary: "The combination of Cappuccino and Lilly White, with variable expression.",
    description: "Frappuccino names a combination of two traits, not a visual brightness grade or a single super form. Some examples develop conspicuous head markings or extensive white, but no one head-spot pattern or level of whiteness identifies every animal. Compare documented examples and lineage.",
    keyFeatures: [
      "Cappuccino plus Lilly White",
      "Variable white coverage and head markings",
      "Not simply an especially white Lilly White"
    ],
    combinesWith: ["soft-scale", "harlequin", "axanthic", "dalmatian"],
    sources: [
      "https://www.pangeareptile.com/blogs/blog/cappuccino-frappuccino-melanistic"
    ]
  },
  {
    slug: "lilly-white",
    name: "Lilly White",
    definition: "A Lilly White crested gecko carries an incomplete-dominant trait associated with distinctive white or cream coverage, which varies with age and other traits.",
    lookalikes: [
      {
        "slug": "white-wall",
        "difference": "White flank pattern alone does not establish Lilly White."
      },
      {
        "slug": "frappuccino",
        "difference": "Frappuccino also carries Cappuccino; greater whiteness is not proof."
      },
      {
        "slug": "cream",
        "difference": "Cream is a visible color description, not confirmation of Lilly White."
      }
    ],
    aliases: ["LW", "Lilly"],
    category: "structure",
    inheritance: "incomplete-dominant",
    rarity: "uncommon",
    priceTier: "$$$",
    priceRange: "$300 to $900",
    summary: "Proven incomplete-dominant trait producing bold white markings, the super form is lethal.",
    description: "Lilly White produces variable white or cream pattern that often becomes more extensive with age. Breeders assess multiple features, including tail, flank and ventral coloration, alongside lineage. High white coverage alone is insufficient: other traits may resemble it, and low-expression or Phantom combinations can look quite different.",
    keyFeatures: [
      "Variable white or cream coverage",
      "Tail, flank and ventral features help guide comparison",
      "Two copies are associated with a lethal super form; avoid Lilly White-to-Lilly White pairings"
    ],
    visualIdentifiers: [
      "Compare multiple regions with documented, age-matched examples",
      "Use lineage to support identification"
    ],
    history: "The founding project was established by Nick Lumb at Lilly Exotics in the United Kingdom, beginning with an unusual hatchling in late 2010.",
    combinesWith: ["white-wall", "soft-scale", "cappuccino", "axanthic", "harlequin", "extreme-harlequin", "dalmatian"],
    notes: "The homozygous super form has been reported to die before or shortly after hatching. A Lilly White-to-non-Lilly pairing avoids producing that genotype; it cannot guarantee general offspring health.",
    sources: [
      "https://www.corchgeckos.com/lillywhite.html"
    ]
  },
  // ---------- COLOR MODIFIERS ----------
  {
    slug: "axanthic",
    name: "Axanthic",
    definition: "An Axanthic crested gecko is a crested gecko with two copies of a recessive gene that removes yellow and red pigment, so it shows only black, gray and white.",
    lookalikes: [
      {
        "slug": "lavender",
        "difference": "A cool-looking base color does not by itself demonstrate axanthic genetics."
      },
      {
        "slug": "albino",
        "difference": "Albinism concerns melanin; axanthic animals retain dark pigment."
      }
    ],
    aliases: ["Axie", "Axan"],
    category: "color",
    inheritance: "recessive",
    rarity: "rare",
    priceTier: "$$$$",
    priceRange: "$1,500 to $4,000",
    summary: "Proven recessive trait that removes yellow and red pigment, animals appear black, gray, and white.",
    description: "Visual axanthic crested geckos are typically gray, charcoal and pale-toned rather than strongly warm-colored. Several breeder lines exist; compatibility and carrier claims require documentation. Lighting, firing state and image processing can make a non-axanthic animal appear gray, so one photograph is not a genetic test.",
    keyFeatures: [
      "A recessive trait documented in breeder lines",
      "Typically reduced warm coloration",
      "Carrier status cannot be established by appearance"
    ],
    visualIdentifiers: [
      "Compare unfiltered photographs in neutral light",
      "Confirm lineage and compatibility before interpreting inheritance"
    ],
    history: "Multiple axanthic breeding projects have been developed; confirm the specific line with the breeder.",
    combinesWith: ["lilly-white", "soft-scale", "white-wall", "dalmatian", "harlequin", "pinstripe", "cappuccino"],
    notes: "Recessive inheritance predictions apply when the parents carry the same compatible trait. A gray photograph is not proof of a visual axanthic or a carrier.",
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ]
  },
  {
    slug: "albino",
    name: "Albino",
    definition: "An Albino crested gecko is a crested gecko with no black or brown pigment (melanin), so it has red or pink eyes and shows only its yellow, orange, red and cream colors.",
    lookalikes: [
      { slug: "moonglow", difference: "A pale body alone does not establish albinism; eye pigmentation and documented lineage matter." },
      { slug: "lilly-white", difference: "A Lilly White has white markings but keeps dark eyes and dark pattern; an Albino has no dark pigment at all." },
      { slug: "axanthic", difference: "Opposite pigments: an Albino keeps yellow and red and loses black; an Axanthic keeps black and loses yellow and red." }
    ],
    aliases: ["Amelanistic", "Albino crested gecko"],
    category: "color",
    inheritance: "recessive",
    rarity: "very_rare",
    summary: "The newest crested gecko color gene: no black pigment and red eyes. The first healthy albino hatchlings were announced by Eureka Exotics in March 2026.",
    description: 'An albino crested gecko lacks melanin, the black and brown pigment, so the animal shows only its yellow, orange, red and cream pigments, and its eyes are red or pink instead of dark. For years albino crested geckos were treated as a myth: the albino-looking hatchlings reported before 2026 were weak, deformed or did not survive, and most "albino" sales were pale animals or edited photos. That changed on 5 March 2026, when Eureka Exotics (Nicole Cullen, Newberry, Florida) announced the hatching of what appear to be the first viable albino crested geckos: babies with no visible melanin, red pupils and normal, robust health. Albinism is recessive in essentially every reptile where it has been worked out, so the crested gecko version is expected to be recessive too, but that still has to be shown by breeding the first albinos and their siblings. Until then, treat any "het albino" offer with caution.',
    keyFeatures: [
      "No black or brown pigment (melanin)",
      "Red or pink eyes instead of dark eyes",
      "Yellow, orange, red and cream pigment still show, so albinos look warm and bright",
      "First healthy hatchlings announced 5 March 2026 by Eureka Exotics",
      "Expected recessive, like albinism in other reptiles, but not yet proven by test breeding"
    ],
    visualIdentifiers: [
      "Reduced eye pigment is a clue; flash, reflections and edited photographs can mimic red pupils",
      "No dark pattern, dark dorsal or dark spots, even when fired up",
      'A pale or "white" gecko with dark eyes is not albino (see Moonglow, Lilly White and Cream)'
    ],
    history: "Albino-like crested geckos were reported several times before 2026, but none were healthy enough to breed. On 5 March 2026 Eureka Exotics announced the first apparently viable albino hatchlings. As of October 2026 the trait is still being worked: the next milestone is producing albino offspring from those animals, which would confirm how it is inherited.",
    combinesWith: ["axanthic", "lilly-white", "moonglow", "harlequin", "pinstripe"],
    notes: "Albino plus Axanthic is the combination keepers have waited for. Albino removes black pigment and Axanthic removes yellow and red, so a gecko carrying both should have almost no pigment left: a true white animal, the long-theorized Moonglow. Nobody has produced one yet, but with albinos now hatching, it remains a hypothesis until actual offspring and inheritance are documented. Be wary of any seller offering albinos, het albinos or albino combos before the founding breeder has proven the gene."
  },
  {
    slug: "hypo",
    name: "Hypo (Hypomelanistic)",
    definition: "Hypo, or hypomelanistic, describes reduced dark pigment; breeders differ in how they apply it to crested gecko lines and inheritance models.",
    lookalikes: [
      { slug: "albino", difference: "Hypo only reduces black pigment and keeps dark eyes; an Albino has no black pigment at all and red or pink eyes." }
    ],
    aliases: ["Hypomelanistic", "Hypomelanism"],
    category: "color",
    inheritance: "line-bred",
    rarity: "rare",
    priceTier: "$$$",
    priceRange: "$500 to $1,500",
    summary: "Line-bred trait reducing black pigment, warmer, brighter animals with pale bellies and reduced dark markings.",
    description: "A lighter animal is not automatically a proven Hypo. Assess natural firing states, age and lineage, and ask which model the breeder uses. Reduced apparent dark pigment may be a useful observation without establishing a gene.",
    keyFeatures: [
      "Reduced apparent dark pigment",
      "Firing state and lineage matter",
      "Terminology and proposed inheritance vary"
    ],
    combinesWith: ["red-base", "orange-base", "yellow-base", "harlequin", "lilly-white", "dalmatian"],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  {
    slug: "patternless",
    name: "Patternless",
    definition: "A Patternless crested gecko is a crested gecko with one solid base color and no visible pattern, named after that color (for example red patternless or olive patternless).",
    lookalikes: [
      { slug: "bicolor", difference: "A Bicolor shows two distinct colors with a clear boundary; a Patternless is one solid color with no pattern." }
    ],
    aliases: ["Solid"],
    category: "color",
    inheritance: "line-bred",
    rarity: "common",
    priceTier: "$",
    priceRange: "$50 to $150",
    summary: "Line-bred trait for solid-colored animals with no discernible pattern, often the base for breeding projects.",
    description: "Patternless crested geckos lack visible markings and display a single solid base color. The trait is line-bred rather than a single gene, and patternless animals are often used as the base color foundation for high-contrast pattern projects. Common patternless bases include red, orange, olive, yellow, and chocolate.",
    keyFeatures: [
      "No visible pattern on the body, solid base color",
      "Base color determines the animal's name (red patternless, olive patternless, etc.)",
      "Line-bred trait, stacks with any color but cannot be Punnett-squared",
      "Foundation stock for many high-contrast pattern breeding projects"
    ],
    combinesWith: ["red-base", "orange-base", "yellow-base", "olive", "chocolate", "lilly-white", "axanthic"]
  },
  {
    slug: "moonglow",
    name: "Moonglow",
    definition: "Moonglow is a disputed name associated with the goal of a persistently white crested gecko, not a reliably identifiable visual morph or confirmed genotype.",
    lookalikes: [
      {
        "slug": "lilly-white",
        "difference": "Lilly White is an established trait with variable pale pattern; it is not defined as an all-white animal."
      },
      {
        "slug": "albino",
        "difference": "Albinism concerns melanin and eye pigmentation, not simply a pale body."
      }
    ],
    aliases: ["True Moonglow"],
    category: "color",
    inheritance: "line-bred",
    rarity: "very_rare",
    priceTier: "$$$",
    priceRange: "No reliable price standard for this disputed label",
    summary: "A disputed label and breeding goal, not a visual diagnosis.",
    description: "Very pale fired-down animals, lighting and image editing can create an apparently white gecko. A near-white photograph should not be presented as proof of a stable all-white morph. Proposed combinations intended to remove pigment are hypotheses until documented in actual animals.",
    keyFeatures: [
      "No reliable visual identification standard",
      "Firing state and lighting can strongly affect apparent whiteness",
      "Speculative combinations must be distinguished from observed animals"
    ],
    visualIdentifiers: [
      "Compare neutral-light photographs in different natural firing states",
      "Ask for documented evidence rather than an edited white image"
    ],
    history: "The name has long circulated around the idea of an all-white crested gecko.",
    combinesWith: ["albino", "axanthic", "cream", "white-wall", "lilly-white"],
    notes: "Do not assign Moonglow from a pale photograph or use the name as proof of genetics.",
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ]
  },
  {
    slug: "translucent",
    name: "Translucent",
    definition: "Translucent describes visible translucency of skin, which alone does not establish a distinct crested gecko morph or inheritance model.",
    aliases: ["Trans"],
    category: "color",
    inheritance: "line-bred",
    rarity: "rare",
    priceTier: "$$$",
    priceRange: "$400 to $1,200",
    summary: "An appearance description requiring context, not a diagnosis from a photograph.",
    description: "Thin juvenile skin and the ventral region can appear translucent. That observation should not be used by itself to identify a genetic trait. Compare age-matched animals and the breeder's supporting evidence.",
    keyFeatures: [
      "Visible translucency, often most evident ventrally",
      "Age and lighting affect the observation",
      "Inheritance cannot be inferred from translucency alone"
    ],
    combinesWith: ["axanthic", "lilly-white", "cream", "harlequin"],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently."
  },
  // ---------- BASE COLORS ----------
  {
    slug: "red-base",
    name: "Red Base",
    definition: "A Red Base crested gecko has red-dominant ground coloration, whose saturation varies with firing state, age and lighting.",
    lookalikes: [
      {
        "slug": "orange-base",
        "difference": "Red and orange descriptions overlap at intermediate hues; lighting and firing state matter."
      }
    ],
    aliases: ["Red"],
    category: "base",
    inheritance: "polygenic",
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics: "Base color is traditionally described as polygenic: reds deepen across generations of selective pairing. Foundation Genetics instead treats Red Base as a suspected recessive gene: two copies produce strong red tones, and single-copy carriers often show a pink cheek blush as a het marker. If the recessive model holds, two non-red animals with blushed cheeks can produce visual reds, which the purely polygenic model would not predict.",
    rarity: "uncommon",
    priceTier: "$$",
    priceRange: "$180 to $450",
    summary: "Polygenic base color showing true red tones, distinct from red dalmatian or rose-brown animals.",
    description: "Red, orange-red and rust tones form a visual range. Describe the base separately from cream pattern and red Dalmatian spots. Compare neutral-light images in more than one natural firing state.",
    keyFeatures: [
      "Red-dominant ground color",
      "Firing state affects saturation",
      "Separate base color from pattern color"
    ],
    combinesWith: ["harlequin", "extreme-harlequin", "dalmatian", "pinstripe", "tricolor"]
  },
  {
    slug: "orange-base",
    name: "Orange Base",
    definition: "An Orange Base crested gecko is a crested gecko whose ground color is a vivid, warm orange.",
    lookalikes: [
      {
        "slug": "red-base",
        "difference": "Red and orange form a range; compare neutral-light images rather than imposing a rigid color boundary."
      }
    ],
    aliases: ["Orange"],
    category: "base",
    inheritance: "polygenic",
    rarity: "uncommon",
    priceTier: "$$",
    priceRange: "$150 to $350",
    summary: "Polygenic base color in warm orange tones, common and widely produced.",
    description: "Orange base is a common polygenic base color selected for warm orange tones. Distinct from red base by hue; a good orange shows vivid citrus or pumpkin tones rather than rust or brick.",
    keyFeatures: [
      "Vivid warm orange base color",
      "One of the most widely produced base colors",
      "Strong canvas for harlequin, dalmatian, and pinstripe patterns"
    ],
    combinesWith: ["harlequin", "dalmatian", "pinstripe", "flame", "cream"]
  },
  {
    slug: "yellow-base",
    name: "Yellow Base",
    definition: "A Yellow Base crested gecko is a crested gecko whose ground color is a bright, saturated yellow.",
    aliases: ["Yellow"],
    category: "base",
    inheritance: "polygenic",
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics: "Traditionally lumped in with polygenic base color. Foundation Genetics models Yellow Base as a dominant, naturally hypo-melanistic base that serves as the substrate for combos like Cream and Buckskin. In practice both readings converge: yellow-based animals readily produce yellow-based offspring, and the depth of the yellow still responds to selective pairing.",
    rarity: "common",
    priceTier: "$",
    priceRange: "$80 to $200",
    summary: "Polygenic base color with bright yellow ground color, common and beginner-friendly.",
    description: "Yellow base describes animals whose ground color is solidly yellow. One of the most common base colors. Strong yellow base animals display saturated, pure yellow rather than a muted or olive tone.",
    keyFeatures: [
      "Bright, saturated yellow ground color",
      "Common and widely available",
      "Works as canvas for most pattern types"
    ],
    combinesWith: ["harlequin", "flame", "dalmatian", "pinstripe"]
  },
  {
    slug: "olive",
    name: "Olive",
    definition: "An Olive crested gecko is a crested gecko whose ground color is an olive-green or khaki tone that holds when fired up.",
    aliases: [],
    category: "base",
    inheritance: "polygenic",
    rarity: "uncommon",
    priceTier: "$$",
    priceRange: "$150 to $400",
    summary: "Polygenic base color producing a distinctive olive-green or khaki tone.",
    description: "Olive is a striking base color that produces a green-yellow or khaki tone. Selectively bred to hold that unique color across generations. Often combined with tiger or brindle for a bold, earthy look.",
    keyFeatures: [
      "Olive-green or khaki base color",
      "Unusual hue that holds when fired up",
      "Popular with keepers seeking less-common base colors"
    ],
    combinesWith: ["tiger", "brindle", "dalmatian", "harlequin", "pinstripe"]
  },
  {
    slug: "chocolate",
    name: "Chocolate",
    definition: "A Chocolate crested gecko has deep brown ground coloration, often most apparent when fired up.",
    lookalikes: [
      { slug: "buckskin", difference: "A Buckskin is a lighter warm tan or leather color; a Chocolate is a deep, rich brown." }
    ],
    aliases: [],
    category: "base",
    inheritance: "polygenic",
    rarity: "uncommon",
    priceTier: "$$",
    priceRange: "$150 to $400",
    summary: "Polygenic base color with rich deep-brown tones, like dark chocolate.",
    description: "Chocolate is a descriptive base-color term. An animal can become lighter when fired down; retaining a fixed deep brown is not a requirement.",
    keyFeatures: [
      "Deep brown base coloration",
      "Color can lighten in a fired-down state",
      "Can coexist with cream pattern and spotting"
    ],
    combinesWith: ["harlequin", "cream", "dalmatian", "tiger", "brindle"]
  },
  {
    slug: "lavender",
    name: "Lavender",
    definition: "A Lavender crested gecko is a crested gecko whose ground color is an unusual purple-gray, seen most clearly when it is fired down.",
    lookalikes: [
      { slug: "axanthic", difference: "An Axanthic has no yellow, red or cream at all; a Lavender's purple-gray base can still carry warm pattern." }
    ],
    aliases: [],
    category: "base",
    inheritance: "polygenic",
    rarity: "rare",
    priceTier: "$$$",
    priceRange: "$400 to $1,000",
    summary: "Polygenic base color showing an unusual purple-gray tone, rare and sought-after.",
    description: "Lavender is a sought-after polygenic base color showing a distinct purple-gray tone. Expression is strongest when fired down, fired-up lavenders often look more standard brown. Considered challenging to maintain across generations.",
    keyFeatures: [
      "Unusual purple-gray base color, most visible fired down",
      "Challenging to maintain across generations",
      "Often paired with extreme harlequin for high-end visual impact"
    ],
    combinesWith: ["harlequin", "extreme-harlequin", "cream", "dalmatian", "pinstripe"]
  },
  {
    slug: "buckskin",
    name: "Buckskin",
    definition: "A Buckskin crested gecko is a crested gecko whose ground color is a warm tan or leather brown.",
    lookalikes: [
      { slug: "chocolate", difference: "Chocolate describes a deeper brown base; both appearances can lighten when fired down." }
    ],
    aliases: [],
    category: "base",
    inheritance: "polygenic",
    rarity: "common",
    priceTier: "$",
    priceRange: "$60 to $180",
    summary: 'Warm tan or leather-colored base, a classic "starter" color with pleasant earthy tones.',
    description: "Buckskin describes a warm tan, leather-like base color. One of the more common base colors and often produced in pet-quality lines. Excellent canvas for moderate pattern and many find the warm tone visually appealing even without heavy pattern.",
    keyFeatures: [
      "Warm tan or leather base color",
      "Common and beginner-friendly",
      "Works well as a base for a variety of patterns"
    ],
    combinesWith: ["harlequin", "flame", "dalmatian", "pinstripe"]
  },
  // ---------- COMBINATION MORPHS ----------
  {
    slug: "cream",
    name: "Cream",
    definition: "A Cream crested gecko is a crested gecko whose pattern areas, usually harlequin or pinstripe, are cream or off-white instead of yellow or orange.",
    lookalikes: [
      { slug: "lilly-white", difference: "Cream is the color of a Harlequin or Pinstripe's pattern; a Lilly White's white markings are structural and stay white when fired down." }
    ],
    aliases: [],
    category: "combo",
    inheritance: "polygenic",
    rarity: "uncommon",
    priceTier: "$$",
    priceRange: "$150 to $450",
    summary: "Cream color applied to harlequin or pinstripe pattern, bright, clean, and highly sought after.",
    description: 'Cream describes animals whose pattern areas are cream-colored rather than yellow or orange. Usually applied as a descriptor stacked on harlequin or pinstripe (cream harlequin, cream pinstripe). Cream is the "vanilla" of pattern colors, bright, pure, and highly valued when it is clean and saturated.',
    keyFeatures: [
      "Pattern areas are cream/off-white instead of yellow or orange",
      "Usually combined with harlequin or pinstripe for maximum impact",
      "Quality judged by purity and consistency of the cream"
    ],
    combinesWith: ["harlequin", "extreme-harlequin", "pinstripe", "tricolor"]
  },
  {
    slug: "tricolor",
    name: "Tricolor",
    definition: "A Tricolor crested gecko shows three distinguishable colors, often a base color and two pattern colors; breeders vary in how much of each they require.",
    lookalikes: [
      { slug: "harlequin", difference: "Tricolor describes distinguishable colors and can coexist with harlequin pattern; equal thirds are not a universal requirement." },
      { slug: "bicolor", difference: "Bicolor emphasizes a contrasting dorsal region; tricolor describes three distinguishable colors." }
    ],
    aliases: ["Tri", "Tri-color"],
    category: "combo",
    inheritance: "polygenic",
    rarity: "uncommon",
    priceTier: "$$$",
    priceRange: "$300 to $800",
    summary: "Three distinguishable colors, often on a harlequin pattern; visual grading varies.",
    description: 'Tricolor is named for its colors. A tricolor shows three distinguishable colors: the base color plus two pattern colors. Common sets are red, orange or yellow, and cream or white, or a dark base (black, brown or lavender) with orange or yellow and cream or white. Most tricolors are Harlequins or Extreme Harlequins; some are Pinstripes, and breeders often list both, as in "Tricolor Harlequin". It is one of the most common morphs on the market and is sold as a morph in its own right. Some breeders prefer evenly balanced colors, but that is a grading preference rather than a universal biological threshold. It is polygenic, so there is no single gene to test for.',
    keyFeatures: [
      "Three distinguishable colors, without a universal equal-coverage rule",
      "Rides on a pattern, most often Harlequin, sometimes Pinstripe",
      "Most striking in fully fired-up state"
    ],
    combinesWith: ["harlequin", "extreme-harlequin", "lilly-white", "dalmatian", "pinstripe"]
  },
  {
    slug: "bicolor",
    name: "Bicolor",
    definition: "A Bicolor crested gecko is a crested gecko with two clearly contrasting colors, usually its base color on the flanks and belly and a brighter color on the back.",
    lookalikes: [
      { slug: "patternless", difference: "A Patternless is a single solid color; a Bicolor has a second, brighter color on the back." },
      { slug: "flame", difference: "A Flame has lighter pattern markings on the back; a Bicolor's back is a second solid color." }
    ],
    aliases: ["Bi-color"],
    category: "combo",
    inheritance: "polygenic",
    rarity: "common",
    priceTier: "$",
    priceRange: "$80 to $200",
    summary: "Animal with two clear contrasting colors, typically a base plus one pattern color.",
    description: "Bicolor describes animals with two clearly distinct colors, usually a solid base and a contrasting dorsal pattern color, without the third accent color required for tricolor. A clean line between the two colors along the lateral line is the hallmark.",
    keyFeatures: [
      "Two clearly distinct colors with a defined boundary",
      "Typically base color on flanks/belly and a brighter color on the dorsum",
      "Common and often marketed as a classic look"
    ],
    combinesWith: ["harlequin", "flame", "pinstripe", "dalmatian"]
  }
];
const MorphGuide = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  INHERITANCE,
  MORPHS: MORPHS$1,
  MORPH_CATEGORIES,
  RARITY
}, Symbol.toStringTag, { value: "Module" }));
const CARE_CATEGORIES = [
  {
    id: "overview",
    label: "Overview",
    icon: "info",
    tagline: "Species facts and what to expect before you buy",
    quickFacts: [
      { label: "Species", value: "Correlophus ciliatus" },
      { label: "Origin", value: "Southern New Caledonia" },
      { label: "Lifespan", value: "15–20 years" },
      { label: "Adult weight", value: "35–60 g" },
      { label: "Adult length", value: "7–10 in (SVL+tail)" },
      { label: "Activity", value: "Nocturnal, arboreal" },
      { label: "Difficulty", value: "Beginner-friendly" }
    ],
    sections: [
      {
        id: "species-background",
        title: "About the crested gecko",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Crested geckos (Correlophus ciliatus, formerly Rhacodactylus ciliatus) are a medium-sized arboreal gecko native to a small range of humid forests in southern New Caledonia. They were thought extinct for most of the 20th century until a 1994 rediscovery, and now form one of the most successful reptile hobbies in the world."
          },
          {
            type: "p",
            text: "They are beginner-friendly because they tolerate room temperatures, eat a shelf-stable powdered diet, do not require UVB for long-term survival, and breed reliably in captivity. Adults top out around 35–60 grams and live 15–20 years with good husbandry."
          },
          {
            type: "callout",
            tone: "info",
            title: "Why the crest?",
            items: [
              'The eyelash-like crest running from eye to tail-base is the species signature trait and the reason for both the common name and the species epithet "ciliatus" (Latin: "eyelashed").',
              "The structure of the crest is heritable and has been amplified through selective breeding, soft-scale, white-wall, and super-crest lines all modify it."
            ]
          }
        ]
      },
      {
        id: "before-you-buy",
        title: "Before you buy",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "A healthy crested gecko is a 15–20 year commitment. Before purchasing, confirm your setup works and that you can realistically provide daily misting, food replacement every 2–3 days, and travel coverage when you are away."
          },
          {
            type: "ul",
            items: [
              "Buy from a breeder who weighs and dates every animal. Hatchlings under 3 grams should generally stay with the breeder until they gain mass.",
              "Ask for the hatch date, current weight, last-fed date, last shed, and sire/dam morph details. Keep a copy with your records.",
              'Avoid "rescue" impulse buys unless you have an experienced reptile vet lined up, husbandry-damaged geckos are a hard first project.',
              "Expect 1 week of no handling after arrival. Acclimation is the single most common step new keepers skip."
            ]
          },
          {
            type: "callout",
            tone: "warn",
            title: "Red flags when buying",
            items: [
              "Sunken fat pads on the pelvis, visible hip bones, or a thin tail base, signs of underweight or illness.",
              "Kinked spine or tail, swollen jaw (possible MBD), stuck shed on toes or tail tip.",
              "A seller who cannot tell you the hatch date or current weight.",
              'Wild-caught imports, crested geckos are captive-bred only; any "wild-caught" claim is either false or illegal.'
            ]
          }
        ]
      },
      {
        id: "sexing",
        title: "Sexing a crested gecko",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: "Crested geckos can usually be sexed at 15–25 grams of healthy weight, well before breeding size. Males develop a visible hemipenal bulge at the vent and preanal pores; females do neither."
          },
          {
            type: "ul",
            items: [
              "Males: obvious bulge beneath the vent when viewed from below, plus a row of preanal pores that become visible as dots or specks forward of the vent.",
              "Females: smooth vent area, no pore row, narrower tail base.",
              "Sexing below 10 g is unreliable and should not drive a purchase decision. Ask the breeder to re-check if you buy young."
            ]
          },
          {
            type: "callout",
            tone: "info",
            items: [
              "Hobby tip: photograph the vent with a phone macro lens and zoom in rather than trying to eyeball it while the animal is squirming."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "housing",
    label: "Housing",
    icon: "home",
    tagline: "Enclosure size, substrate, plants, lighting, climate",
    quickFacts: [
      { label: "Adult enclosure", value: "18×18×24 in minimum (vertical)" },
      { label: "Temperature", value: "72–78°F (22–25°C)" },
      { label: "Night temp", value: "65–72°F (18–22°C)" },
      { label: "Humidity", value: "60–80% (spike to 100% at night)" },
      { label: "Lighting", value: "Low UVB optional, 12h photoperiod" },
      { label: "Ventilation", value: "Front + top cross-flow" }
    ],
    sections: [
      {
        id: "enclosure-size",
        title: "Enclosure size by life stage",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Crested geckos are arboreal, they use vertical height far more than floor space. Size the enclosure to the animal, not to a fixed minimum. Hatchlings in an oversized setup get lost, stop eating, and lose weight."
          },
          {
            type: "table",
            headers: ["Life stage", "Weight", "Enclosure", "Notes"],
            rows: [
              ["Hatchling", "0–8 g", "6-qt tub or small Kritter Keeper", "Deli cup of CGD + moss + small branches. Easy to monitor feeding."],
              ["Juvenile", "8–20 g", "12×12×18 in glass terrarium", "Introduce height. Fake or live plants for cover."],
              ["Sub-adult", "20–35 g", "18×18×18 in", "Optional intermediate step, or skip straight to adult sizing."],
              ["Adult", "35 g+", "18×18×24 in minimum", "Larger (24×18×36 in) is always better. Do not house adults together."]
            ]
          },
          {
            type: "callout",
            tone: "warn",
            title: "One gecko per enclosure",
            items: [
              "Do not cohabitate males, they will fight, sometimes to the death, once sexually mature.",
              "Do not house males and females together outside of a controlled breeding project. Females can be bred to exhaustion.",
              "Female-only pairs are possible but often still result in stress, tail drops, and uneven feeding. Most experienced keepers house solo."
            ]
          }
        ]
      },
      {
        id: "substrate",
        title: "Substrate and bioactive",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "The goal of substrate is humidity buffering plus safety. Two valid approaches: a simple cleanable setup with paper towel or tile, or a bioactive vivarium with drainage layer, ABG mix, leaf litter, and a springtail/isopod cleanup crew."
          },
          {
            type: "dl",
            items: [
              { term: "Paper towel", def: "Cheapest, cleanest, easiest to quarantine. Best choice for hatchlings and any sick or new animal." },
              { term: "Coco fiber / coco coir", def: "Holds humidity well. Safe if the animal does not eat large chunks. Avoid dust-fine peat." },
              { term: "ABG mix (bioactive)", def: "Atlanta Botanical Garden mix, bark, charcoal, peat, sphagnum. Long-term solution with live plants and a cleanup crew." },
              { term: "Tile or PVC sheet", def: "Used by high-volume breeders. Zero humidity buffer, requires daily misting." }
            ]
          },
          {
            type: "callout",
            tone: "danger",
            title: "Substrates to avoid",
            items: [
              "Sand, calcium sand, walnut shell, impaction risk, no humidity benefit, marketed dishonestly.",
              "Cedar or pine shavings, aromatic oils are toxic to reptiles.",
              "Reptile carpet, traps claws, harbors bacteria, frays into threads that wrap toes."
            ]
          }
        ]
      },
      {
        id: "temperature",
        title: "Temperature and heating",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Crested geckos thrive at room temperature. Ambient in the 72–78°F (22–25°C) range is ideal, with a slight nighttime drop to 65–72°F (18–22°C). Most homes never need supplemental heat; in fact, overheating is a far more common killer than cold."
          },
          {
            type: "ul",
            items: [
              "Above 82°F (28°C): acute stress. Appetite loss, lethargy, gaping. Sustained exposure is fatal.",
              "Below 65°F (18°C): slows digestion. Brief dips are fine and even healthy; sustained cold halts feeding.",
              "Use a low-wattage DHP (deep heat projector) on a thermostat if your home runs below 68°F. Never use an unregulated heat bulb or pad.",
              "Place a digital thermometer at the warmest and coolest points of the enclosure and verify with a temp gun weekly."
            ]
          },
          {
            type: "callout",
            tone: "warn",
            title: "The 82°F rule",
            items: [
              "Ambient temperatures above 82°F are one of the most common causes of keeper-inflicted death in this species.",
              "In summer, move the enclosure away from windows and use a fan on the room. A portable AC is cheaper than a replacement gecko."
            ]
          }
        ]
      },
      {
        id: "humidity",
        title: "Humidity and misting",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Crested geckos need a humidity cycle: high at night (80–100%) when they are active, dropping back to 50–70% during the day. A flatline at 90% breeds mold and respiratory infections; a flatline at 40% causes stuck sheds."
          },
          {
            type: "ol",
            items: [
              "Heavy mist 30 minutes before lights-out. The cage should be visibly wet and fogged.",
              "Allow humidity to drop back to 50–70% within a few hours. Cross-ventilation matters here.",
              "Light mist or none in the morning if the cage is still damp. Over-misting is a common mistake.",
              "Provide a shallow water dish, not because they drink from it often, but because it buffers humidity and some animals do use it."
            ]
          },
          {
            type: "dl",
            items: [
              { term: "Hand sprayer", def: "Works fine for 1–2 animals. Cheap, reliable, and forces daily eyes-on inspection." },
              { term: "Automatic mister (MistKing, Exo-Terra Monsoon)", def: "Best for collections of 3+ or for keepers who travel. Must be combined with a hygrometer and a dry-down period." },
              { term: "Cool-mist fogger", def: "Used supplementally in very dry climates. Do not replace misting, fog wets surfaces differently than droplets." }
            ]
          }
        ]
      },
      {
        id: "lighting",
        title: "Lighting and UVB",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: "Crested geckos do not strictly require UVB because commercial CGD contains vitamin D3. That said, current hobby consensus favors low-level UVB as enrichment and a backup, it costs little, supports natural behavior, and hedges against diet gaps."
          },
          {
            type: "ul",
            items: [
              "Photoperiod: 12 hours on, 12 hours off. A timer removes the daily chore.",
              "UVB: Arcadia ShadeDweller 7% or Zoo Med 5.0 T5, mounted above the mesh top, 10–14 inches from the highest basking spot the animal can reach.",
              "Replace UVB bulbs every 12 months, output drops long before the bulb visibly fails.",
              "Plant lights (LED full-spectrum) are great for live-plant vivariums but produce no useful UVB. Keep them separate from husbandry lighting."
            ]
          },
          {
            type: "callout",
            tone: "info",
            title: "UVB is optional, not pointless",
            items: [
              "Keepers who use UVB report better pigment saturation, firmer bones in breeder females, and fewer MBD cases over multi-year projects.",
              "If you do not use UVB, stay strict on CGD quality and rotate brands so no single deficiency compounds."
            ]
          }
        ]
      },
      {
        id: "decor",
        title: "Decor, plants, and climbing",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Enclosures should look vertical, busy, and layered. The gecko needs multiple climbing paths, broad leaves for perching, and dense cover at several heights so it can choose its own microclimate."
          },
          {
            type: "ul",
            items: [
              "Cork bark flats and tubes, grippable, humidity-tolerant, reusable for years.",
              "Live plants: pothos, bromeliads, ficus, schefflera. Avoid anything with sticky latex or toxic sap.",
              "Fake plants are fine, the gecko does not care. Use them if you are not ready for a bioactive setup.",
              "Branches cut to wedge corner-to-corner create secure perches. Avoid sharp cut ends near the animal.",
              "One or two hides at ground level for daytime retreat. Coco huts, cork tubes, or a half-buried flowerpot work."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "feeding",
    label: "Diet & Feeding",
    icon: "utensils",
    tagline: "CGD, insects, supplements, schedules",
    quickFacts: [
      { label: "Primary diet", value: "Commercial CGD (powdered)" },
      { label: "Mix ratio", value: "1 part powder : 2 parts water" },
      { label: "Adult schedule", value: "3×/week, replace every 24–36 h" },
      { label: "Juvenile schedule", value: "Fresh food daily" },
      { label: "Insects", value: "Optional, 1–2×/week, dusted" },
      { label: "Fresh fruit", value: "Rare treat only (sugar load)" }
    ],
    sections: [
      {
        id: "cgd-basics",
        title: "Commercial Crested Gecko Diet (CGD)",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "CGD is a nutritionally complete powdered diet designed to be the sole food source for crested geckos. It contains fruit, insect protein, vitamins, minerals, and calcium with D3. Mix 1 part powder to 2 parts water into a ketchup-like consistency, serve in a shallow dish, and discard after 24–36 hours."
          },
          {
            type: "ul",
            items: [
              "Always use dechlorinated or bottled water. Tap water is fine in most municipalities but avoid heavily chlorinated supplies.",
              "Mix fresh each feeding. Pre-mixed CGD kept in the fridge degrades within 48 hours and separates.",
              "Use a flat, shallow dish, magnetic ledge cups are popular because geckos forage upside-down.",
              "Replace the dish after 24–36 hours even if untouched. Old CGD breeds yeast and fruit flies.",
              "Rotate at least two brands over the animal's life. Each brand balances ingredients differently and rotation hedges against formulation changes."
            ]
          }
        ]
      },
      {
        id: "cgd-brands",
        title: "Brand comparison",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: 'There is no single "best" CGD. The major brands below are all nutritionally complete and widely used by top breeders. Variety is the point, rotate flavors and brands so the animal does not become food-fixated.'
          },
          {
            type: "table",
            headers: ["Brand", "Product", "Notes"],
            rows: [
              ["Pangea", "Fruit Mix (multiple flavors)", 'The most common gateway diet. "With Insects" variants are preferred for growing juveniles.'],
              ["Repashy", "Crested Gecko MRP (Classic, Grubs ‘N’ Fruit, Meal Replacement)", 'Oldest proven brand. "Grubs N Fruit" adds black soldier fly larvae for higher protein.'],
              ["Black Panther Zoological (BPZ)", "Complete Gecko Diet", "Smaller producer, fresh batches, fewer artificial ingredients. Rotates seasonal fruit."],
              ["Leapin' Leachie", "LLG Crested Gecko Diet", "Higher protein, popular with breeders producing clutches."],
              ["Zoo Med", "Crested Gecko Food", "Widely available at pet chains. Considered a secondary option, use it alongside a premium brand, not exclusively."]
            ]
          },
          {
            type: "callout",
            tone: "info",
            title: "Buying tip",
            items: [
              "Check the manufacture date on the pouch. CGD loses vitamin potency after roughly 12 months. Buy small pouches often rather than one giant bag.",
              "Freeze unopened pouches if you buy in bulk, sealed and frozen, shelf life extends to 18–24 months."
            ]
          }
        ]
      },
      {
        id: "feeding-schedules",
        title: "Feeding schedules by age",
        level: "beginner",
        body: [
          {
            type: "table",
            headers: ["Life stage", "CGD frequency", "Insect frequency", "Notes"],
            rows: [
              ["Hatchling (0–8 g)", "Fresh daily", "Optional, 1–2 pinheads 1×/week", "Target 0.2–0.5 g gain per week."],
              ["Juvenile (8–20 g)", "Fresh daily or every other day", "3–5 feeders 1–2×/week", "Growth phase, never ration CGD."],
              ["Sub-adult (20–35 g)", "3–4×/week", "4–6 feeders 1×/week", "Start tracking monthly weight trend."],
              ["Adult (35 g+)", "3×/week", "4–6 feeders 1×/2 weeks (optional)", "Overfeeding adults causes obesity and fatty liver."],
              ["Breeding female", "3–4×/week + extra calcium", "6–8 feeders 1–2×/week", "Protein and calcium demand spikes during laying season."]
            ]
          },
          {
            type: "callout",
            tone: "warn",
            items: [
              "Adults that gorge on CGD every night get fat, develop fatty liver disease, and fail to breed. Three to four feedings per week is enough for a non-breeder.",
              'Never fast a hatchling "to build appetite." Missed meals at this stage compound, a hatchling that skips 3 meals has lost a meaningful fraction of its body weight.'
            ]
          }
        ]
      },
      {
        id: "insects",
        title: "Feeder insects (optional)",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: "Insects are not required on a complete CGD diet, but they add enrichment, satisfy natural hunting instinct, and provide extra protein for growing juveniles and breeding females. Offer insects 1–2 times per week at most."
          },
          {
            type: "dl",
            items: [
              { term: "Dubia roaches", def: "Best all-around feeder. Low fat, high protein, cannot climb smooth glass, long-lived in a colony." },
              { term: "Black soldier fly larvae (BSFL / Phoenix worms)", def: "Self-contained calcium source. No dusting required. Soft-bodied and ideal for juveniles." },
              { term: "Crickets", def: "Traditional feeder. Noisy, smelly, bite, and can injure a gecko if left in the enclosure overnight. Remove uneaten crickets." },
              { term: "Discoid roaches", def: "Florida-legal alternative to dubia. Similar nutrition profile." },
              { term: "Hornworms", def: "Treat only. Very high moisture and low calcium. Great rehydration tool for a picky eater." },
              { term: "Mealworms / superworms", def: "Use sparingly. High fat, chitinous exoskeleton is harder to digest. Fine as an occasional treat; not a staple." }
            ]
          },
          {
            type: "ul",
            items: [
              "Dust every insect meal with calcium+D3 (Repashy Calcium Plus, Arcadia EarthPro-A, Miner-All). Miss no more than one dusting in four.",
              "Gutload feeders with leafy greens or a commercial gutload for 24–48 hours before feeding out. What your insects ate is what your gecko eats.",
              "Offer feeders in a smooth-sided dish or tong-feed. Loose crickets and large roaches can bite a sleeping gecko."
            ]
          }
        ]
      },
      {
        id: "fruit-and-treats",
        title: "Fresh fruit and treats",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Crested geckos love sugary fruit, but it is not a complete food. Treat fresh fruit the way you would treat candy, an occasional reward, not a staple. Overuse causes CGD refusal and diarrhea."
          },
          {
            type: "ul",
            items: [
              "Safe treats (rare): mashed ripe banana, mango, papaya, fig, passion fruit, peach.",
              "Avoid citrus, grapes, rhubarb, avocado, and anything acidic. Many of these contain oxalates that bind calcium.",
              "Baby food pouches (Gerber Stage 2, plain fruit only) work in a pinch but are not a substitute for CGD.",
              "Never feed insects caught from your yard, pesticide and parasite risk."
            ]
          }
        ]
      },
      {
        id: "picky-eaters",
        title: "Picky eaters and refusal",
        level: "advanced",
        body: [
          {
            type: "p",
            text: "Appetite refusal is the single most common stressor for new keepers. In most cases, the cause is environmental (new home, wrong temperature, dehydration) rather than the food itself. Work the checklist before you assume a health issue."
          },
          {
            type: "ol",
            items: [
              "Give a new arrival 7–10 days of no handling before evaluating appetite. It is normal to refuse CGD in the first week.",
              "Verify temperature is not above 80°F and not below 68°F. Misting schedule is regular.",
              'Rotate CGD flavor. A gecko refusing "watermelon mix" may eat "banana cream" from the same brand.',
              "Try insects. Even a non-insect eater will sometimes take a BSFL or hornworm when refusing CGD.",
              "Weigh weekly. A non-eater that holds weight is fine; one that drops more than 5% needs vet eyes.",
              "After 2–3 weeks of refusal + weight loss, schedule a reptile vet. Fecal float rules out parasites. Dehydration can be addressed with a diluted Pedialyte soak."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "handling",
    label: "Handling",
    icon: "hand",
    tagline: "Safe interaction, stress signals, firing up",
    quickFacts: [
      { label: "First handling", value: "After 2–3 weeks acclimation" },
      { label: "Session length", value: "5–15 min max" },
      { label: "Frequency", value: "2–4×/week at most" },
      { label: "Hatchlings", value: "Observe only, no handling" }
    ],
    sections: [
      {
        id: "acclimation",
        title: "Acclimation before handling",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "A new gecko in a new home is stressed. Handling during the acclimation window extends stress, triggers tail drops, and can cause food refusal that takes weeks to undo. Give it space first."
          },
          {
            type: "ol",
            items: [
              "Days 1–7: no handling. Do misting and food changes quickly and quietly. Observe only.",
              "Days 8–14: short in-cage interactions, change the water, adjust decor, let the gecko see your hand without grabbing.",
              "After day 14 and after the first confirmed meal: begin brief handling sessions as described below.",
              "For breeder stock, extend the window to 3–4 weeks and skip casual handling altogether."
            ]
          }
        ]
      },
      {
        id: "handling-technique",
        title: "Safe handling technique",
        level: "beginner",
        body: [
          {
            type: "ul",
            items: [
              '"Hand-walking": let the gecko walk from one palm to the other. Never grab, squeeze, or restrain.',
              "Keep sessions short, 5 to 15 minutes is plenty. Stop earlier if the gecko freezes, gapes, or sits and pants.",
              "Handle low over a soft surface (bed, couch) so a jump does not result in a fall from height.",
              "Never pick up by the tail. Crested gecko tails are autotomous and will drop at the lightest pull.",
              "Wash hands before and after. After insects or raw meat, always wash before reaching into the enclosure."
            ]
          },
          {
            type: "callout",
            tone: "warn",
            title: "Stress signals, put the gecko back",
            items: [
              "Mouth held open, slow deliberate panting, darkened colors that do not fade.",
              "Violent wriggling, leaping repeatedly, tail whipping side-to-side like a whip.",
              "Tail base lifted and waved slowly, a pre-drop warning, stop immediately."
            ]
          }
        ]
      },
      {
        id: "firing-up",
        title: "Firing up and color shifts",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: '"Firing up" is a temporary color change tied to humidity, activity, and mood. A fired-up gecko shows its fullest saturation; a fired-down one looks muted, often much lighter. Both are normal.'
          },
          {
            type: "ul",
            items: [
              "Geckos typically fire up at night and when the cage is freshly misted.",
              "They fire down during the day, when resting, or when stressed. A gecko that stays fired down 24/7 may be chronically stressed or cold.",
              "Morph identification should be done on a fired-up, well-hydrated animal. A fired-down photo misleads buyers and breeders alike."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "health",
    label: "Health",
    icon: "heart",
    tagline: "Shedding, tail loss, MBD, common issues, vet care",
    quickFacts: [
      { label: "Weigh", value: "Weekly (juveniles) · monthly (adults)" },
      { label: "Annual vet", value: "Fecal float + wellness exam" },
      { label: "Red flags", value: "Appetite loss, kink tail, lethargy" },
      { label: "Tail regrowth", value: "Never, dropped tails do not regrow" }
    ],
    sections: [
      {
        id: "weight-tracking",
        title: "Weight as a health metric",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Weight is the single most useful data point for monitoring crested gecko health. A downward trend is almost always the first sign of a problem, earlier than appetite changes, earlier than visible wasting, and sometimes weeks before a vet exam would catch it."
          },
          {
            type: "ul",
            items: [
              "Weigh with a 0.1 g kitchen scale. A deli cup with a lid makes weighing easy and calm.",
              "Juveniles: weekly weigh-ins. Expect steady gains (0.3–1.0 g/week depending on age).",
              "Adults: monthly weigh-ins. Healthy adults hold ±2 g month to month. Breeding females can swing 10–15 g pre- and post-lay.",
              "Flag any 5 %+ drop over a month for investigation. Consistent drops across two months warrants a vet visit."
            ]
          }
        ]
      },
      {
        id: "shedding",
        title: "Shedding",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Crested geckos shed every 1–4 weeks depending on age and growth rate. The shed itself takes about 10–20 minutes and usually happens overnight. You often will not see it, the animal eats its own shed immediately. The tell is a duller, chalkier-looking gecko one night, then a clean bright one the next morning."
          },
          {
            type: "ul",
            items: [
              "Stuck shed on toes, tail tip, and around eyes is the most common husbandry problem. Root cause is almost always low humidity.",
              "Fix: increase misting, raise ambient humidity to 80–100% for 2–3 nights, and provide a humid hide (plastic tub with damp moss).",
              "Stuck shed on a toe cuts off circulation. Remove within 48 hours or the toe can be lost. Soak the gecko on damp paper towel for 15 minutes and peel gently with a damp cotton swab.",
              "Never pull, if it does not come off easily, soak longer."
            ]
          }
        ]
      },
      {
        id: "tail-loss",
        title: "Tail loss (autotomy)",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Crested geckos drop their tails as a predator-escape response. Unlike leopard geckos and many other species, a lost tail does not regrow. The animal is otherwise fine, in the wild, most adult crested geckos are tailless."
          },
          {
            type: "ul",
            items: [
              "A dropped tail will bleed briefly, then clot on its own. No veterinary intervention is usually needed.",
              "Keep the enclosure clean for 3–5 days post-drop to avoid infection of the stump.",
              "Tail drops are triggered by stress: being grabbed, fighting another gecko, being startled, or sudden temperature change. Solo-house, handle gently, and minimize surprises.",
              'A tailless ("frogbutt") gecko is not worth less to a keeper, many hobbyists find them charming. Show breeders do pay a premium for intact tails.'
            ]
          },
          {
            type: "callout",
            tone: "info",
            items: [
              "Common myth: tail drop means the gecko is unhealthy. It does not. It means the gecko was scared. A healthy gecko can drop its tail exactly once in its life."
            ]
          }
        ]
      },
      {
        id: "common-issues",
        title: "Common health issues",
        level: "intermediate",
        body: [
          {
            type: "table",
            headers: ["Issue", "Signs", "Typical cause", "Action"],
            rows: [
              ["Metabolic Bone Disease (MBD)", "Kinked spine, wavy tail, soft jaw, hemipenile prolapse, leg tremors", "Chronic low calcium / D3, underfeeding", "Vet ASAP. Early MBD is reversible with calcium and UVB; advanced cases are not."],
              ["Floppy Tail Syndrome (FTS)", "Tail arches over the back when hanging upside-down, pelvic deformity in adults", "Prolonged upside-down perching on glass tops, lack of horizontal resting spots", "Provide broad leaf perches and cork bark at the top. Prevention only, established FTS is permanent."],
              ["Respiratory infection", "Open-mouth breathing, mucus bubbles, wheezing, lethargy", "Chronic humidity too high + poor ventilation, or cold draft", "Dry out the cage, fix ventilation, vet for antibiotics if it persists >48 h."],
              ["Impaction", "Not defecating for 7+ days, visible bulge, loss of appetite", "Substrate ingestion, dehydration, cold", "Warm soak (84°F water, 10–15 min). Persistent: vet."],
              ["Parasites (pinworms, coccidia, crypto)", "Watery or bloody stool, weight loss despite eating, lethargy", "Often present at import, spread via shared tools", "Fecal float at vet. Crypto is the serious one, ask the vet to test specifically if weight loss is persistent."],
              ["Mouth rot (stomatitis)", "Cheesy white or yellow material at the gum line, swollen jaw, food refusal", "Trauma + bacteria, low humidity, immune stress", "Vet. Topical antiseptics and sometimes antibiotics."],
              ["Dystocia (egg-binding)", "Swollen abdomen, straining without laying, lethargy in a gravid female", "Underweight female, calcium deficiency, no lay box, too-hot or too-cold cage", "Emergency vet. Provide a warm humid lay box with damp substrate at least a week before expected lay date."]
            ]
          },
          {
            type: "callout",
            tone: "warn",
            title: "Find a reptile-experienced vet before you need one",
            items: [
              'Most "exotic" vets see rabbits and birds, not reptiles. Call ahead and ask specifically about crested gecko cases per year.',
              "Keep an emergency kit: digital scale, small plastic tub, damp paper towel, a list of vet phone numbers, a transport carrier."
            ]
          }
        ]
      },
      {
        id: "quarantine",
        title: "Quarantine new arrivals",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: "If you have an existing collection, quarantine every new arrival for a minimum of 30 days, 90 days is better. Quarantine means a separate room if possible, different tools, and last-in-the-day husbandry order so you never carry pathogens back."
          },
          {
            type: "ul",
            items: [
              "Keep the quarantine enclosure on paper towel. Easier to spot parasite eggs and monitor stool.",
              "Run a fecal float at the beginning and the end of the quarantine period. Crypto shedding is intermittent, one clear test is not proof.",
              "Weigh weekly. A new arrival that drops more than 10% during quarantine should not be introduced to your collection even after the period ends.",
              "Wash hands, change shirts, and spray tools with a reptile-safe disinfectant (F10SC) between enclosures."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "life-stages",
    label: "Life Stages",
    icon: "scale",
    tagline: "Hatchling, juvenile, sub-adult, adult, senior",
    quickFacts: [
      { label: "Hatchling", value: "0–3 g · 0–3 months" },
      { label: "Juvenile", value: "3–15 g · 3–12 months" },
      { label: "Sub-adult", value: "15–35 g · 12–18 months" },
      { label: "Adult", value: "35 g+ · 18+ months" },
      { label: "Senior", value: "10 years+" }
    ],
    sections: [
      {
        id: "hatchling-care",
        title: "Hatchlings (0–3 g)",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Hatchlings are the most fragile life stage. They are small, easily lost in large enclosures, and prone to dehydration. Most keeper-inflicted losses happen in the first 6 weeks after hatch."
          },
          {
            type: "ul",
            items: [
              "Enclosure: 6-quart tub or small critter keeper with paper towel, a small branch, and a handful of fake leaves or sphagnum.",
              "First meal: offer CGD 24–48 hours after hatching. Some hatchlings do not eat for the first 3–5 days, that is normal if they are holding weight.",
              "Humidity: mist 1–2 times daily. Let the sides of the tub dry between mists.",
              "Do not handle. Observe only for the first month.",
              "Weigh every 4–7 days. A hatchling that drops below hatching weight for more than a week needs attention."
            ]
          }
        ]
      },
      {
        id: "juvenile-care",
        title: "Juveniles (3–15 g)",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "The juvenile phase is the fastest growth window. Feed consistently, monitor weight weekly, and move up an enclosure size when the animal reaches ~10 g."
          },
          {
            type: "ul",
            items: [
              "Feed fresh CGD daily or every other day. Never ration at this age.",
              "Insects (optional) 1–2 times per week, always dusted.",
              "Expect 0.5–1.5 g weight gain per week under good husbandry.",
              "Sexing becomes possible around 15–25 g. Do not stress-handle to check sex, a confirmed-male juvenile can still be housed safely solo."
            ]
          }
        ]
      },
      {
        id: "subadult-care",
        title: "Sub-adults (15–35 g)",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: "Growth slows in the sub-adult phase. This is also the age when morph identity locks in and the final enclosure upgrade happens."
          },
          {
            type: "ul",
            items: [
              "Feed CGD 3–4 times per week. Expect 1–3 g weight gain per month.",
              "Adult enclosure (18×18×24 in) is appropriate by ~25 g.",
              "This is a good time to socialize handling if you intend to, calm 10-minute sessions 1–2 times per week.",
              'Morph evaluation at 25–30 g is more accurate than at hatch. Pattern "fade" and base color clarify as the animal approaches adulthood.'
            ]
          }
        ]
      },
      {
        id: "adult-care",
        title: "Adults (35 g+)",
        level: "beginner",
        body: [
          {
            type: "p",
            text: "Adult crested geckos are low-maintenance. Most care time becomes routine, feed three times a week, mist nightly, weigh monthly, and watch for behavior changes."
          },
          {
            type: "ul",
            items: [
              "Do not overfeed. Three CGD feedings per week keeps a non-breeder at ideal weight.",
              "Monthly weigh-ins and a brief visual check replace weekly handling.",
              "Annual reptile-vet wellness visit + fecal float is a reasonable baseline for a single adult.",
              "Plan for a potential 15–20 year relationship. Designate an emergency caretaker in case you travel, move, or have an accident."
            ]
          }
        ]
      },
      {
        id: "senior-care",
        title: "Senior geckos (10 years+)",
        level: "advanced",
        body: [
          {
            type: "p",
            text: "Geckos past 10 years slow down. Breeders retire them. Weight can plateau and gradually drift down. Husbandry becomes gentler and more observational."
          },
          {
            type: "ul",
            items: [
              "Retire breeding females after 8 years of age, or sooner if clutch counts decline or body condition softens.",
              "Reduce climbing height if arthritis-like stiffness appears. Lower perches + easier access to food and water.",
              "Warm up the cool side of the cage slightly (76–78°F days) if the animal is clearly slower in cold weather.",
              "A senior gecko that sleeps more, eats less, and moves less is usually fine. One that loses more than 10% of its peak adult weight within a year is not, vet visit warranted."
            ]
          }
        ]
      }
    ]
  },
  {
    id: "breeding",
    label: "Breeding",
    icon: "users",
    tagline: "Readiness, pairing, egg care, incubation",
    quickFacts: [
      { label: "Female minimum", value: "40 g + 18 months old" },
      { label: "Male minimum", value: "25–30 g + 12 months" },
      { label: "Season", value: "March–October (hobby norm)" },
      { label: "Clutch size", value: "2 eggs · every 4–6 weeks" },
      { label: "Incubation", value: "60–90 days at 72–76°F" },
      { label: "Cooling period", value: "Nov–Feb rest required" }
    ],
    sections: [
      {
        id: "breeding-readiness",
        title: "Breeding readiness",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: "Breeding too soon is the most common mistake new breeders make. The cost is the life or long-term health of the female. Wait for the numbers, weight and age, not for the temptation."
          },
          {
            type: "table",
            headers: ["Sex", "Minimum weight", "Minimum age", "Ideal window"],
            rows: [
              ["Female", "40 g (strict)", "18 months", "45–55 g, 24+ months, proven feeder"],
              ["Male", "25–30 g", "12 months", "35 g+, 18+ months, handles calmly"]
            ]
          },
          {
            type: "callout",
            tone: "danger",
            title: "Do not breed underweight or underage females",
            items: [
              "Calcium depletion and egg-binding are the two most common causes of keeper-inflicted female mortality.",
              "A female bred at 35 g can produce for one season, then die from secondary MBD the next.",
              "Males can breed earlier safely, but the female is the limiting factor."
            ]
          }
        ]
      },
      {
        id: "cooling-period",
        title: "Cooling period (off-season)",
        level: "advanced",
        body: [
          {
            type: "p",
            text: "Breeding-age females need a genuine off-season to recover calcium and fat reserves. The hobby standard is a cooling/resting period from roughly November through February, during which males and females are housed separately and no breeding occurs."
          },
          {
            type: "ul",
            items: [
              "Drop ambient temperature to 68–72°F during the day and 62–66°F at night for 2–3 months.",
              "Reduce photoperiod to 10 hours.",
              "Continue feeding on a normal adult schedule (3×/week CGD). Reduce or stop insects.",
              "Separate males and females. Never leave a pair together year-round.",
              "Resume normal temperatures and pairings in late February or early March."
            ]
          }
        ]
      },
      {
        id: "pairing",
        title: "Pairing and cohabitation",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: "Introduce the male into the female's enclosure, not the reverse, females are more territorial and less likely to tolerate a new male in their own space. Supervise the first introduction."
          },
          {
            type: "ul",
            items: [
              "Pair for 1–4 weeks, then separate. Some breeders run 2–3 weeks on, 2 weeks off through the season.",
              "Watch for excessive neck bites on the female. Small bite marks are normal; open wounds mean separate immediately.",
              "Keep detailed records: pair-up date, separation date, morph of both parents, project goals. A breeding log is the backbone of any serious project.",
              "Never pair full siblings unless you understand the genetic risks and have a specific project justification."
            ]
          }
        ]
      },
      {
        id: "egg-laying",
        title: "Egg laying and lay box",
        level: "intermediate",
        body: [
          {
            type: "p",
            text: "A female produces a clutch of 2 eggs every 4–6 weeks during the breeding season. She needs a dedicated lay box, without one, she will lay in the substrate or hold the eggs, risking dystocia."
          },
          {
            type: "ul",
            items: [
              "Lay box: deli cup or Tupperware with a hole cut in the lid, filled with 3–4 inches of moist (not wet) coco fiber or sphagnum.",
              "Place in the enclosure at all times for breeding females, not just during lay periods.",
              "Collect eggs within 24 hours. Mark the top with a dot so orientation stays consistent, rotating a developing egg can kill the embryo.",
              "Expect a gravid female to lose 5–15 grams in a single lay. This is normal and why extra calcium/protein matters during the season."
            ]
          }
        ]
      },
      {
        id: "incubation",
        title: "Incubation",
        level: "advanced",
        body: [
          {
            type: "p",
            text: "Room-temperature incubation (72–76°F, 22–24°C) produces strong, slow-hatching clutches. Higher temperatures shorten incubation and can produce male-biased clutches but also raise deformity rates. Hobby standard has moved toward slightly cool, slow incubation."
          },
          {
            type: "table",
            headers: ["Temperature", "Incubation time", "Notes"],
            rows: [
              ["68–72°F (20–22°C)", "90–120 days", "Cool. Strong, vigorous hatchlings. Slight female bias."],
              ["72–76°F (22–24°C)", "60–90 days", "Hobby sweet spot. Balanced sex ratio and low deformity rate."],
              ["78–82°F (25–28°C)", "45–60 days", "Warm. Higher deformity risk and possible neurological issues."]
            ]
          },
          {
            type: "ul",
            items: [
              "Substrate: 1:1 (by weight) vermiculite and water, or perlite at the same ratio. Some breeders use SuperHatch (baked clay).",
              "Container: deli cup with a small cross-slit in the lid. No standing water, too wet is the most common killer.",
              "Open and check weekly. Spot-mist the container walls if the substrate dries. Do not mist the eggs directly.",
              "Turn nothing. Mark the top of each egg when collected and keep that orientation."
            ]
          }
        ]
      },
      {
        id: "hatching-and-record-keeping",
        title: "Hatching and record keeping",
        level: "advanced",
        body: [
          {
            type: "p",
            text: "Pipping (breaking the eggshell) takes hours to a full day. Leave the hatchling in the egg until it fully emerges, pulling it out early interferes with yolk absorption."
          },
          {
            type: "ul",
            items: [
              "Move the hatchling to its own 6-qt tub within 24 hours of emerging. Do not feed for 48 hours, it is still absorbing yolk.",
              "Log everything: hatch date, hatch weight, clutch number, parents, incubation temperature. Good records are the currency of serious breeding.",
              "Do not evaluate morph at hatch. Many traits (extreme harlequin, true pinstripe, etc.) do not express until the first major shed and some not until 3–6 months.",
              "Sell or trade only after the hatchling is 3+ grams, eating reliably, and has had a successful shed. Hobby ethics put this floor around 8–10 grams for most breeders."
            ]
          }
        ]
      }
    ]
  }
];
config({ jitless: true });
function displayText(text2) {
  if (typeof text2 !== "string") return text2;
  return text2.replace(/\s*\u2014\s*/g, ", ").replace(/\s*\u2013\s*/g, ", ");
}
function outcomeTraits(outcome) {
  const description2 = String(outcome?.phenotype_description || "Wild-type");
  return displayText(description2.replace(/\s*\[combos:[^\]]*\]\s*$/, "")) || "Wild-type";
}
function outcomeCombos(outcome) {
  return (outcome?.matching_combo_morphs || []).map((id) => getComboMorph(id)).filter((combo) => combo && !combo.is_marketing_term).map((combo) => combo.name);
}
(() => {
  const map = /* @__PURE__ */ new Map();
  for (const trait of TRAITS) {
    map.set(trait.name.toLowerCase(), trait.name);
    for (const alt of trait.alternate_names || []) {
      map.set(alt.toLowerCase(), trait.name);
    }
  }
  map.set("lillywhite", "Lilly White");
  map.set("lilly-white", "Lilly White");
  map.set("lily-white", "Lilly White");
  return map;
})();
const POSSIBLE_HET_CHANCE = 0.5;
const MENDELIAN = /* @__PURE__ */ new Set(["recessive", "dominant", "incomplete_dominant"]);
const TRAIT_BY_NAME = /* @__PURE__ */ new Map();
for (const trait of TRAITS) {
  TRAIT_BY_NAME.set(trait.name.toLowerCase(), trait);
  for (const alt of trait.alternate_names || []) TRAIT_BY_NAME.set(alt.toLowerCase(), trait);
}
const REASON = {
  pattern: "Pattern descriptor. It describes how the gecko looks, not a gene the odds can use.",
  tiger: "Foundation Genetics treats Tiger as present in every crested gecko, so it does not change the odds.",
  flame: "Flame is polygenic (many small genes), so no ratio can be calculated.",
  baseShade: "Base color shade. Only Red Base and Yellow Base are calculated.",
  phantomLook: "Can be how a visual Phantom looks. Add a Phantom tag if this gecko is a visual Phantom.",
  spots: "Spot descriptor. Add a Dalmatian tag if this gecko is a Dalmatian.",
  colorTrait: "Polygenic color descriptor, so no ratio can be calculated.",
  structure: "Line-bred structure, not a single gene.",
  marking: "Marking descriptor. It is polygenic, so no ratio can be calculated.",
  display: "Display or body state, not inherited.",
  unconfirmed: "Inheritance is unconfirmed (polygenic suspected), so no ratio can be calculated.",
  moonglow: "Moonglow is a line-bred look, not a proven gene. Tag the genes underneath it (Lilly White, for example).",
  hetOfNonGene: "A het can only be counted for a single proven gene.",
  unknown: "Not a gene the calculator knows."
};
const APP_TAGS = new Map(Object.entries({
  // Spelling differences (app display spelling vs engine name)
  "soft scale": { engine: ["Softscale"] },
  "super soft scale": { engine: ["Super Softscale"] },
  // D13: White Wall is the engine's Whiteout
  "white wall": { engine: ["Whiteout"] },
  "super white wall": { engine: ["Super Whiteout"] },
  // D13: a bare Phantom tag means a visual Phantom
  "phantom": { engine: ["Visual Phantom"] },
  "visual phantom": { engine: ["Visual Phantom"] },
  // Combo names
  "frappuccino": { engine: ["Cappuccino", "Lilly White"] },
  "cappuccino lilly white": { engine: ["Cappuccino", "Lilly White"] },
  "lilly white cappuccino": { engine: ["Cappuccino", "Lilly White"] },
  "axanthic lilly white": { engine: ["Axanthic", "Lilly White"] },
  "lucy": { engine: ["Axanthic", "Lilly White"] },
  "axanthic cappuccino": { engine: ["Axanthic", "Cappuccino"] },
  "soft scale lilly white": { engine: ["Softscale", "Lilly White"] },
  "soft scale cappuccino": { engine: ["Softscale", "Cappuccino"] },
  "moonglow lilly white": {
    engine: ["Lilly White"],
    note: "Moonglow Lilly White counted as Lilly White. Moonglow itself is a line-bred look, not a proven gene."
  },
  "phantom frappuccino": { engine: ["Cappuccino", "Lilly White", "Visual Phantom"] },
  "luwak": { engine: ["Cappuccino", "Sable"] },
  // Pattern variants of a modeled gene
  "full pinstripe": { engine: ["Pinstripe"] },
  "dashed pinstripe": { engine: ["Pinstripe"] },
  "reverse pinstripe": { engine: ["Pinstripe"] },
  "phantom pinstripe": {
    engine: ["Pinstripe"],
    note: "Phantom Pinstripe counted as Pinstripe only. Add a Phantom tag if this gecko is a visual Phantom."
  },
  "red harlequin": { engine: ["Harlequin"] },
  "yellow harlequin": { engine: ["Harlequin"] },
  "cream harlequin": { engine: ["Harlequin"] },
  "orange harlequin": { engine: ["Harlequin"] },
  "halloween harlequin": { engine: ["Harlequin"] },
  "extreme red harlequin": { engine: ["Extreme Harlequin"] },
  "dark red base": { engine: ["Red Base"] },
  "bright yellow base": { engine: ["Yellow Base"] },
  // Not used: pattern and marking descriptors
  "flame": { reason: REASON.flame },
  "chevron flame": { reason: REASON.flame },
  "tiger": { reason: REASON.tiger },
  "tiger striping": { reason: REASON.tiger },
  "brindle": { reason: REASON.tiger },
  "extreme brindle": { reason: REASON.tiger },
  "patternless": { reason: REASON.phantomLook },
  "bicolor": { reason: REASON.phantomLook },
  "quad stripe": { reason: REASON.pattern },
  "super stripe": { reason: REASON.pattern },
  // Not used: base color shades
  "orange base": { reason: REASON.baseShade },
  "cream base": { reason: `${REASON.baseShade} ${REASON.phantomLook}` },
  "pink base": { reason: REASON.baseShade },
  "olive base": { reason: REASON.baseShade },
  "dark olive base": { reason: REASON.baseShade },
  "green base": { reason: REASON.baseShade },
  "tan base": { reason: REASON.baseShade },
  "brown base": { reason: REASON.baseShade },
  "dark brown base": { reason: REASON.baseShade },
  "chocolate base": { reason: REASON.baseShade },
  "buckskin base": { reason: `${REASON.baseShade} ${REASON.phantomLook}` },
  "lavender base": { reason: REASON.baseShade },
  "near black base": { reason: REASON.baseShade },
  // Not used: color descriptors
  "translucent": { reason: REASON.colorTrait },
  "high white": { reason: REASON.colorTrait },
  "high contrast": { reason: REASON.colorTrait },
  // Not used: spot descriptors
  "ink spots": { reason: REASON.spots },
  "oil spots": { reason: REASON.spots },
  "red spots": { reason: REASON.spots },
  "confetti": { reason: REASON.spots },
  "spots on head": { reason: REASON.spots },
  "dalmatian tail": { reason: REASON.spots },
  // Not used: structure, markings, display state
  "crowned": { reason: REASON.structure },
  "white fringe": { reason: REASON.marking },
  "kneecaps": { reason: REASON.marking },
  "portholes": { reason: REASON.marking },
  "drippy dorsal": { reason: REASON.marking },
  "white tipped crests": { reason: REASON.marking },
  "colored crests": { reason: REASON.marking },
  "side stripe": { reason: REASON.marking },
  "banded": { reason: REASON.marking },
  "broken banding": { reason: REASON.marking },
  "chevron pattern": { reason: REASON.marking },
  "diamond pattern": { reason: REASON.marking },
  "reticulated": { reason: REASON.marking },
  "mottled": { reason: REASON.marking },
  "speckled": { reason: REASON.marking },
  "fired up": { reason: REASON.display },
  "fired down": { reason: REASON.display },
  "full tail": { reason: REASON.display },
  "tailless": { reason: REASON.display },
  // Not used: unproven looks
  "moonglow": { reason: REASON.moonglow },
  "furred": { reason: REASON.unconfirmed },
  "furry": { reason: REASON.unconfirmed },
  "harry": { reason: REASON.unconfirmed },
  "marbling": { reason: REASON.unconfirmed },
  "marble": { reason: REASON.unconfirmed },
  "snowflake": { reason: "Snowflake inheritance is unconfirmed and it depends on White Pattern, so no ratio can be calculated." }
}));
const PERCENT = /^(\d{1,3}(?:\.\d+)?)\s*%\s*/;
const POSSIBLE_PREFIX = /^(?:possible|poss\.?|pos\.?|probable|p\.?)\s*het\s+/i;
const HET_PREFIX = /^het\s+/i;
const HET_SUFFIX = /\s+het$/i;
function normalizeBody(text2) {
  return text2.trim().toLowerCase().replace(/[\s_]+/g, " ").replace(/-/g, " ");
}
function parseTag(raw) {
  let text2 = String(raw || "").trim().replace(/\s+/g, " ");
  let percent = null;
  const pm = text2.match(PERCENT);
  if (pm) {
    percent = Number(pm[1]);
    text2 = text2.slice(pm[0].length);
  }
  let kind = "visual";
  if (POSSIBLE_PREFIX.test(text2)) {
    kind = "possible";
    text2 = text2.replace(POSSIBLE_PREFIX, "");
  } else if (HET_PREFIX.test(text2)) {
    kind = "het";
    text2 = text2.replace(HET_PREFIX, "");
  } else if (HET_SUFFIX.test(text2)) {
    kind = "het";
    text2 = text2.replace(HET_SUFFIX, "");
  }
  let chance = 1;
  if (kind === "possible") chance = POSSIBLE_HET_CHANCE;
  if (kind !== "visual" && percent !== null && percent > 0 && percent <= 100) {
    chance = percent / 100;
    kind = chance >= 1 ? "het" : "possible";
  }
  return { kind, chance, body: normalizeBody(text2) };
}
const countCopies = (pair) => pair.filter((a) => a !== WILD_TYPE).length;
const pct = (p) => `${Math.round(p * 100)}%`;
function hetTraitFor(body) {
  const mapped = APP_TAGS.get(body);
  if (mapped?.engine?.length === 1) {
    const name2 = mapped.engine[0].toLowerCase().replace(/^visual\s+/, "");
    return TRAIT_BY_NAME.get(name2) || null;
  }
  if (mapped) return null;
  return TRAIT_BY_NAME.get(body) || null;
}
function mergeLocus(loci, locus, options) {
  const existing = loci[locus];
  if (!existing) {
    loci[locus] = options;
    return;
  }
  const existingDefinite = existing.length === 1;
  const newDefinite = options.length === 1;
  if (existingDefinite && !newDefinite) return;
  if (!existingDefinite && newDefinite) {
    loci[locus] = options;
    return;
  }
  if (!existingDefinite && !newDefinite) {
    const carrierWeight = (opts) => opts.filter((o) => countCopies(o.pair) > 0).reduce((s, o) => s + o.weight, 0);
    if (carrierWeight(options) > carrierWeight(existing)) loci[locus] = options;
    return;
  }
  const a = existing[0].pair;
  const b = options[0].pair;
  if (a[0] === b[0] && a[1] === b[1]) return;
  if (countCopies(a) === 1 && countCopies(b) === 1) {
    const alleleA = a.find((x) => x !== WILD_TYPE);
    const alleleB = b.find((x) => x !== WILD_TYPE);
    if (alleleA !== alleleB) {
      loci[locus] = [{ pair: [alleleA, alleleB], weight: 1 }];
    }
    return;
  }
  if (countCopies(b) > countCopies(a)) loci[locus] = options;
}
function translateMorphTags(tags) {
  const loci = {};
  const used = [];
  const notUsed = [];
  const notes = [];
  const seen = /* @__PURE__ */ new Set();
  for (const raw of tags || []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const tag = raw.trim();
    const dedupeKey = tag.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const { kind, chance, body } = parseTag(tag);
    if (kind !== "visual") {
      const trait = hetTraitFor(body);
      if (!trait || !MENDELIAN.has(trait.dominance)) {
        const mapped2 = APP_TAGS.get(body);
        notUsed.push({ tag, reason: mapped2?.reason || REASON.hetOfNonGene });
        continue;
      }
      const carrier = [trait.id, WILD_TYPE];
      const options = chance >= 1 ? [{ pair: carrier, weight: 1 }] : [
        { pair: carrier, weight: chance },
        { pair: [WILD_TYPE, WILD_TYPE], weight: 1 - chance }
      ];
      mergeLocus(loci, trait.locus, options);
      used.push({ tag, chance });
      if (chance < 1) {
        const appName = trait.name === "Softscale" ? "Soft Scale" : trait.name;
        let line = `${tag} counted as a ${pct(chance)} chance of carrying ${appName}.`;
        if (trait.dominance !== "recessive") {
          line += ` One copy of ${appName} normally shows, so check the gecko.`;
        }
        notes.push(line);
      }
      continue;
    }
    const mapped = APP_TAGS.get(body);
    if (mapped?.reason) {
      notUsed.push({ tag, reason: mapped.reason });
      continue;
    }
    const parts = (mapped?.engine || [body]).map((t) => tagToGenotype([t]));
    if (parts.every((r) => Object.keys(r.genotype || {}).length === 0)) {
      const known = parts.flatMap((r) => r.needs_review || []).find((n) => !/^Unknown tag/.test(n));
      notUsed.push({ tag, reason: known ? displayReason(known) : REASON.unknown });
      continue;
    }
    for (const result of parts) {
      for (const [locus, pair] of Object.entries(result.genotype || {})) {
        mergeLocus(loci, locus, [{ pair: [...pair], weight: 1 }]);
      }
    }
    used.push({ tag, chance: 1 });
    if (mapped?.note) notes.push(mapped.note);
  }
  return { spec: { loci }, used, notUsed, notes };
}
function displayReason(text2) {
  return String(text2).replace(/\s*[\u2014\u2013]\s*/g, ", ");
}
const COMPLEX_ID = "sable_complex";
const SIMPLE_TRAITS = [
  {
    id: "lilly_white",
    slug: "lilly-white",
    label: "Lilly White",
    locus: "L",
    dominance: "incomplete_dominant",
    confidence: "proven",
    super_label: "Super Lilly White",
    super_lethal: true,
    blurb: "Incomplete dominant, the first proven crested gecko gene (2012). One copy is the Lilly White look; the homozygous Super form is lethal in the egg."
  },
  {
    id: "axanthic",
    slug: "axanthic",
    label: "Axanthic",
    locus: "AX",
    dominance: "recessive",
    confidence: "proven",
    blurb: "Recessive. Het carriers look normal; the homozygous visual lacks red and yellow pigment for a black, white, and silver gecko."
  },
  {
    id: "phantom",
    slug: "phantom",
    label: "Phantom",
    locus: "PH",
    dominance: "recessive",
    confidence: "proven",
    blurb: "Recessive. Visual Phantoms mute pattern color; het Phantoms look normal, which is why Phantom explains so many surprise hatchlings."
  },
  {
    id: "empty_back",
    slug: "empty-back",
    label: "Empty Back",
    locus: "EB",
    dominance: "incomplete_dominant",
    confidence: "proven",
    super_label: "Super Empty Back",
    blurb: "Incomplete dominant. Reduces dorsal pattern; the Super form strips nearly all dorsal markings. Proven through AC Reptiles breeding trials."
  },
  {
    id: "softscale",
    slug: "soft-scale",
    label: "Soft Scale",
    locus: "SS",
    dominance: "incomplete_dominant",
    confidence: "emerging",
    super_label: "Super Soft Scale",
    blurb: "Incomplete dominant with documented 25/50/25 ratios. The Super form has visibly softened scalation and is healthy."
  },
  {
    id: "whiteout",
    slug: "whiteout",
    label: "Whiteout",
    locus: "WO",
    dominance: "incomplete_dominant",
    confidence: "emerging",
    super_label: "Super Whiteout",
    blurb: "Incomplete dominant per AC Reptiles, whose data is the main documentation. Much of the hobby still treats white wall as line-bred, so this is badged Emerging."
  },
  {
    id: "hypo",
    slug: "hypo",
    label: "Hypo",
    locus: "HYPO",
    dominance: "dominant",
    confidence: "emerging",
    blurb: 'Dominant in this model. Hypomelanism has been line-bred since the early 2000s and single-gene "Genetic Hypo" claims are still being proven out, so this is badged Emerging.'
  },
  {
    id: "chocho",
    slug: "chocho",
    label: "ChoCho",
    locus: "CHOCHO",
    dominance: "recessive",
    confidence: "emerging",
    blurb: "Recessive in this model. A newer project trait with limited independent documentation, so it is badged Emerging."
  }
];
const COMPLEX_OPTIONS = [
  { value: "none", label: "No (wild-type)", pair: [WILD_TYPE, WILD_TYPE] },
  { value: "cappuccino", label: "Cappuccino", pair: ["cappuccino", WILD_TYPE], confidence: "proven" },
  { value: "sable", label: "Sable", pair: ["sable", WILD_TYPE], confidence: "proven" },
  {
    value: "highway",
    label: "Highway (provisional allele)",
    pair: ["highway", WILD_TYPE],
    confidence: "emerging"
  },
  {
    value: "luwak",
    label: "Luwak (Cappuccino + Sable)",
    pair: ["cappuccino", "sable"],
    confidence: "proven"
  },
  {
    value: "capp_highway",
    label: "Cappuccino + Highway (compound)",
    pair: ["cappuccino", "highway"],
    confidence: "emerging"
  },
  {
    value: "sable_highway",
    label: "Sable + Highway (compound)",
    pair: ["sable", "highway"],
    confidence: "emerging"
  },
  {
    value: "super_cappuccino",
    label: "Super Cappuccino (severe health risk)",
    pair: ["cappuccino", "cappuccino"],
    confidence: "proven",
    caution: 'Super Cappuccino ("Melanistic") has documented severe health problems and cannot be sold on MorphMarket.'
  },
  {
    value: "super_sable",
    label: "Super Sable",
    pair: ["sable", "sable"],
    confidence: "proven",
    caution: "Super Sable appears viable; the community norm is to check nostril openings at hatch on any super in this complex."
  },
  {
    value: "super_highway",
    label: "Super Highway (health reports)",
    pair: ["highway", "highway"],
    confidence: "emerging",
    caution: "Super Highway hatchlings have reported nostril and health issues, which is itself the evidence that Highway sits in this complex."
  }
];
Object.fromEntries(
  COMPLEX_OPTIONS.map((o) => [o.value, o])
);
const TRAIT_PATCHES = /* @__PURE__ */ new Map();
const EXTRA_TRAITS = [];
function getSimpleTraits() {
  const patched = SIMPLE_TRAITS.map(
    (t) => TRAIT_PATCHES.has(t.id) ? { ...t, ...TRAIT_PATCHES.get(t.id) } : t
  );
  return [...patched, ...EXTRA_TRAITS];
}
const CALCULATOR_PAGES = [
  ...SIMPLE_TRAITS.map((t) => ({
    slug: t.slug,
    label: t.label,
    blurb: t.blurb,
    confidence: t.confidence,
    super_lethal: !!t.super_lethal,
    defaultState: {
      [t.id]: t.dominance === "dominant" ? "visual" : "het"
    }
  })),
  {
    slug: "cappuccino",
    label: "Cappuccino",
    blurb: 'Incomplete dominant, allelic with Sable. The homozygous Super Cappuccino ("Melanistic") has documented severe health problems; pairing Cappuccino to Sable makes Luwak and can never make a super.',
    confidence: "proven",
    super_lethal: false,
    super_warning: "Super Cappuccino has documented severe health concerns and cannot be sold on MorphMarket.",
    defaultState: { [COMPLEX_ID]: "cappuccino" }
  },
  {
    slug: "sable",
    label: "Sable",
    blurb: "Incomplete dominant, allelic with Cappuccino (the hobby’s first proven allelic complex). Sable x Cappuccino produces Luwak; Super Sable appears viable with a check-nostrils-at-hatch caution.",
    confidence: "proven",
    super_lethal: false,
    defaultState: { [COMPLEX_ID]: "sable" }
  },
  {
    slug: "highway",
    label: "Highway",
    blurb: "Provisionally a third allele in the Cappuccino complex: Super Highway health reports are the main evidence. Treated as allelic here, badged Emerging until the community settles it.",
    confidence: "emerging",
    super_lethal: false,
    super_warning: "Super Highway hatchlings have reported nostril and health issues.",
    defaultState: { [COMPLEX_ID]: "highway" }
  }
];
Object.fromEntries(
  CALCULATOR_PAGES.map((p) => [p.slug, p])
);
const PAIRING_PAGES = [
  {
    slug: "lilly-white-x-lilly-white",
    label: "Lilly White x Lilly White",
    sire: { lilly_white: "het" },
    dam: { lilly_white: "het" },
    blurb: "The most-warned-about pairing in the hobby: 25% of eggs are lethal Super Lilly Whites that die in the egg, for the same 50% Lilly White rate a Lilly White x normal pairing gives without the losses. The math below shows exactly why breeders discourage it."
  },
  {
    slug: "lilly-white-x-normal",
    label: "Lilly White x Normal",
    sire: { lilly_white: "het" },
    dam: {},
    blurb: "The standard Lilly White pairing: 50% Lilly White per egg with no lethal outcomes. This is the route experienced breeders recommend over Lilly x Lilly."
  },
  {
    slug: "cappuccino-x-sable",
    label: "Cappuccino x Sable",
    sire: { [COMPLEX_ID]: "cappuccino" },
    dam: { [COMPLEX_ID]: "sable" },
    blurb: "The safe way to work the Cappuccino complex: Cappuccino and Sable are different versions of the same gene, so this cross produces Luwak (25%) and can never produce a super."
  },
  {
    slug: "cappuccino-x-cappuccino",
    label: "Cappuccino x Cappuccino",
    sire: { [COMPLEX_ID]: "cappuccino" },
    dam: { [COMPLEX_ID]: "cappuccino" },
    blurb: "This cross risks 25% Super Cappuccino, a homozygote with documented health problems that cannot be sold on MorphMarket. Pairing Cappuccino to Sable instead produces Luwak with no super risk."
  },
  {
    slug: "axanthic-x-axanthic",
    label: "Axanthic x Axanthic",
    sire: { axanthic: "visual" },
    dam: { axanthic: "visual" },
    blurb: "Two visual Axanthics: every egg is a visual Axanthic, because both parents can only pass the Axanthic allele. Recessive genetics at its most satisfying."
  },
  {
    slug: "axanthic-x-het-axanthic",
    label: "Axanthic x Het Axanthic",
    sire: { axanthic: "visual" },
    dam: { axanthic: "het" },
    blurb: "A visual bred to a proven het: 50% visual Axanthic per egg, and every non-visual baby is a guaranteed 100% het."
  },
  {
    slug: "het-axanthic-x-het-axanthic",
    label: "Het Axanthic x Het Axanthic",
    sire: { axanthic: "het" },
    dam: { axanthic: "het" },
    blurb: "Two proven hets: 25% visual Axanthic per egg, and the normal-looking babies are 66% possible hets, which is where that number on sale listings comes from."
  },
  {
    slug: "lilly-white-x-axanthic",
    label: "Lilly White x Axanthic",
    sire: { lilly_white: "het" },
    dam: { axanthic: "visual" },
    blurb: "The first cross of an Axanthic Lilly White project: every baby is 100% het Axanthic and half are Lilly White. The visual Axanthic Lillies come in generation two."
  },
  {
    slug: "phantom-x-phantom",
    label: "Phantom x Phantom",
    sire: { phantom: "visual" },
    dam: { phantom: "visual" },
    blurb: "Two visual Phantoms: every egg is a visual Phantom. Phantom is recessive, so visuals always breed true to each other."
  },
  {
    slug: "frappuccino-x-normal",
    label: "Frappuccino x Normal",
    sire: { [COMPLEX_ID]: "cappuccino", lilly_white: "het" },
    dam: {},
    blurb: "A Frappuccino carries one Cappuccino and one Lilly White allele, so bred to a normal it throws 25% Frappuccino, 25% Cappuccino, 25% Lilly White, and 25% normal."
  }
];
Object.fromEntries(
  PAIRING_PAGES.map((p) => [p.slug, p])
);
const MAX_SCENARIOS = 256;
function splitExtraLoci(spec) {
  const engineLoci = {};
  const extraLoci = {};
  for (const [locus, options] of Object.entries(spec?.loci || {})) {
    if (LOCI[locus]) engineLoci[locus] = options;
    else extraLoci[locus] = options;
  }
  return { engineSpec: { loci: engineLoci }, extraLoci };
}
function extraTraitFor(locus) {
  return getSimpleTraits().find((t) => t.locus === locus) || null;
}
function extraPairLabel(trait, pair) {
  const copies = pair.filter((a) => a === trait.id).length;
  if (copies === 0) return "Wild-type";
  if (trait.dominance === "recessive") {
    return copies === 2 ? trait.label : `Het ${trait.label}`;
  }
  if (copies === 2) return trait.super_label || `Super ${trait.label}`;
  return trait.label;
}
function extraLocusOutcomes(trait, sireOptions, damOptions) {
  const dist = /* @__PURE__ */ new Map();
  for (const so of sireOptions) {
    for (const dop of damOptions) {
      for (const a of so.pair) {
        for (const b of dop.pair) {
          const pair = [a, b].sort();
          const key = pair.join("|");
          const p = 0.25 * so.weight * dop.weight;
          const entry = dist.get(key);
          if (entry) entry.probability += p;
          else dist.set(key, { genotype: pair, probability: p, phenotype_label: extraPairLabel(trait, pair) });
        }
      }
    }
  }
  return [...dist.values()].sort((a, b) => b.probability - a.probability);
}
function expandScenarios(spec) {
  let scenarios = [{ genotype: {}, weight: 1 }];
  for (const [locus, options] of Object.entries(spec?.loci || {})) {
    const next = [];
    for (const s of scenarios) {
      for (const opt of options) {
        next.push({
          genotype: { ...s.genotype, [locus]: [...opt.pair] },
          weight: s.weight * opt.weight
        });
      }
    }
    scenarios = next;
    if (scenarios.length > MAX_SCENARIOS) {
      throw new Error("Too many genotype scenarios to compute.");
    }
  }
  return scenarios;
}
function toAnimal(id, genotype) {
  return {
    id,
    species: "correlophus_ciliatus",
    genotype,
    status: "active",
    is_breeder: true,
    owner_id: id,
    created_at: "",
    updated_at: ""
  };
}
const pairKey = (pair) => `${pair[0]}|${pair[1]}`;
function predictWeighted(sireSpec, damSpec) {
  const { engineSpec: sireEngine, extraLoci: sireExtra } = splitExtraLoci(sireSpec);
  const { engineSpec: damEngine, extraLoci: damExtra } = splitExtraLoci(damSpec);
  const sireScenarios = expandScenarios(sireEngine);
  const damScenarios = expandScenarios(damEngine);
  if (sireScenarios.length * damScenarios.length > MAX_SCENARIOS) {
    throw new Error("Too many genotype scenarios to compute.");
  }
  const extraUncertain = [...Object.values(sireExtra), ...Object.values(damExtra)].some((options) => options.length > 1);
  const uncertain = sireScenarios.length > 1 || damScenarios.length > 1 || extraUncertain;
  const phenoMap = /* @__PURE__ */ new Map();
  const locusMap = /* @__PURE__ */ new Map();
  const warningMap = /* @__PURE__ */ new Map();
  let totalWeight = 0;
  for (const ss of sireScenarios) {
    for (const ds of damScenarios) {
      const w = ss.weight * ds.weight;
      if (w <= 0) continue;
      totalWeight += w;
      const prediction = predict(toAnimal("sire", ss.genotype), toAnimal("dam", ds.genotype));
      for (const op of prediction.offspring_phenotypes || []) {
        const key = op.phenotype_description;
        const entry = phenoMap.get(key);
        if (entry) {
          entry.probability += w * op.probability;
          if (w > entry._weight) {
            entry._weight = w;
            entry.genotype = op.genotype;
          }
        } else {
          phenoMap.set(key, {
            phenotype_description: op.phenotype_description,
            probability: w * op.probability,
            matching_combo_morphs: op.matching_combo_morphs || [],
            health_risk: op.health_risk,
            genotype: op.genotype,
            _weight: w
          });
        }
      }
      const seenLoci = /* @__PURE__ */ new Set();
      for (const lp of prediction.locus_predictions || []) {
        seenLoci.add(lp.locus);
        let bucket = locusMap.get(lp.locus);
        if (!bucket) {
          bucket = { locus: lp.locus, trait: lp.trait, outcomes: /* @__PURE__ */ new Map(), _seenWeight: 0 };
          locusMap.set(lp.locus, bucket);
        }
        bucket._seenWeight += w;
        for (const o of lp.outcomes) {
          const key = `${pairKey(o.genotype)}::${o.phenotype_label}`;
          const existing = bucket.outcomes.get(key);
          if (existing) existing.probability += w * o.probability;
          else bucket.outcomes.set(key, { genotype: [...o.genotype], phenotype_label: o.phenotype_label, probability: w * o.probability });
        }
      }
      for (const warning of prediction.warnings || []) {
        const existing = warningMap.get(warning.code);
        if (existing) existing._weight += w;
        else warningMap.set(warning.code, { ...warning, _weight: w });
      }
    }
  }
  const hasExtras = Object.keys(sireExtra).length > 0 || Object.keys(damExtra).length > 0;
  if (totalWeight <= 0 && !hasExtras) {
    return { offspring_phenotypes: [], locus_predictions: [], warnings: [], uncertain: false };
  }
  if (totalWeight <= 0) totalWeight = 1;
  for (const bucket of locusMap.values()) {
    const missing = totalWeight - bucket._seenWeight;
    if (missing > 1e-9) {
      const key = `${WILD_TYPE}|${WILD_TYPE}::Wild-type`;
      const existing = bucket.outcomes.get(key);
      if (existing) existing.probability += missing;
      else bucket.outcomes.set(key, { genotype: [WILD_TYPE, WILD_TYPE], phenotype_label: "Wild-type", probability: missing });
    }
  }
  let offspring_phenotypes = [...phenoMap.values()].map(({ _weight, ...rest }) => ({ ...rest, probability: rest.probability / totalWeight })).sort((a, b) => b.probability - a.probability);
  const locus_predictions = [...locusMap.values()].map((bucket) => ({
    locus: bucket.locus,
    trait: bucket.trait,
    outcomes: [...bucket.outcomes.values()].map((o) => ({ ...o, probability: o.probability / totalWeight })).filter((o) => o.probability > 1e-9).sort((a, b) => b.probability - a.probability)
  }));
  const warnings = [...warningMap.values()].map(({ _weight, ...w }) => ({
    ...w,
    // A warning that only fires in some scenarios depends on an
    // unproven het proving out; the UI notes that instead of stating
    // the hazard as certain.
    conditional: _weight < totalWeight - 1e-9
  }));
  if (hasExtras) {
    if (offspring_phenotypes.length === 0) {
      offspring_phenotypes = [{
        phenotype_description: "Wild-type",
        probability: 1,
        matching_combo_morphs: [],
        health_risk: void 0,
        genotype: {}
      }];
    }
    const allExtraLoci = /* @__PURE__ */ new Set([...Object.keys(sireExtra), ...Object.keys(damExtra)]);
    const wildOption = [{ pair: [WILD_TYPE, WILD_TYPE], weight: 1 }];
    for (const locus of allExtraLoci) {
      const trait = extraTraitFor(locus);
      if (!trait) continue;
      const outcomes = extraLocusOutcomes(
        trait,
        sireExtra[locus] || wildOption,
        damExtra[locus] || wildOption
      );
      locus_predictions.push({ locus, trait: trait.id, outcomes });
      const crossed = /* @__PURE__ */ new Map();
      for (const op of offspring_phenotypes) {
        for (const o of outcomes) {
          const isWild = o.phenotype_label === "Wild-type";
          const isLethal = trait.super_lethal && o.genotype[0] === trait.id && o.genotype[1] === trait.id;
          const description2 = isWild ? op.phenotype_description : op.phenotype_description === "Wild-type" ? o.phenotype_label : `${op.phenotype_description}, ${o.phenotype_label}`;
          const entry = crossed.get(description2);
          const probability = op.probability * o.probability;
          if (entry) entry.probability += probability;
          else {
            crossed.set(description2, {
              ...op,
              phenotype_description: description2,
              probability,
              health_risk: isLethal ? "lethal" : op.health_risk,
              genotype: { ...op.genotype, [locus]: [...o.genotype] }
            });
          }
        }
      }
      offspring_phenotypes = [...crossed.values()].sort((a, b) => b.probability - a.probability);
      if (trait.super_lethal) {
        const lethalP = outcomes.filter((o) => o.genotype[0] === trait.id && o.genotype[1] === trait.id).reduce((s, o) => s + o.probability, 0);
        if (lethalP > 0) {
          warnings.push({
            severity: "critical",
            code: `override_lethal_${trait.id}`,
            message: `${trait.super_label || `Super ${trait.label}`} is flagged lethal: ${Math.round(lethalP * 100)}% of eggs from this pairing are expected non-viable.`,
            conditional: false
          });
        }
      }
    }
  }
  return { offspring_phenotypes, locus_predictions, warnings, uncertain };
}
const latest = /* @__PURE__ */ JSON.parse('[{"p25":113,"p75":211,"trait":null,"market":"EU","median":135,"listings":183,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":761,"p75":1380,"trait":"Axanthic","market":"EU","median":1071,"listings":5,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":113,"p75":127,"trait":"Lilly White","market":"EU","median":113,"listings":11,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":114,"p75":237,"trait":null,"market":"JP","median":158,"listings":119,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":122,"p75":212,"trait":"Dalmatian","market":"JP","median":164,"listings":8,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":101,"p75":259,"trait":"Dark","market":"JP","median":171,"listings":6,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":114,"p75":158,"trait":"Extreme Harlequin","market":"JP","median":139,"listings":15,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":101,"p75":158,"trait":"Harlequin","market":"JP","median":120,"listings":15,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":237,"p75":493,"trait":"Lilly White","market":"JP","median":304,"listings":22,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":129,"p75":192,"trait":"Pinstripe","market":"JP","median":146,"listings":6,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":177,"p75":247,"trait":"Red","market":"JP","median":202,"listings":7,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":101,"p75":114,"trait":"Tiger","market":"JP","median":101,"listings":5,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":142,"p75":190,"trait":"Tri-color","market":"JP","median":164,"listings":11,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":149,"p75":896,"trait":null,"market":"KR","median":336,"listings":2957,"checked_on":"2026-10-06","price_cuts":15,"new_listings":33},{"p25":336,"p75":2166,"trait":"Axanthic","market":"KR","median":747,"listings":345,"checked_on":"2026-10-06","price_cuts":2,"new_listings":16},{"p25":112,"p75":598,"trait":"Cappuccino","market":"KR","median":243,"listings":140,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":112,"p75":299,"trait":"Cream","market":"KR","median":224,"listings":61,"checked_on":"2026-10-06","price_cuts":1,"new_listings":3},{"p25":90,"p75":224,"trait":"Dark","market":"KR","median":187,"listings":17,"checked_on":"2026-10-06","price_cuts":2,"new_listings":0},{"p25":224,"p75":1120,"trait":"Drippy","market":"KR","median":448,"listings":344,"checked_on":"2026-10-06","price_cuts":3,"new_listings":2},{"p25":224,"p75":1195,"trait":"Empty Back","market":"KR","median":373,"listings":53,"checked_on":"2026-10-06","price_cuts":1,"new_listings":2},{"p25":149,"p75":1120,"trait":"Extreme Harlequin","market":"KR","median":373,"listings":395,"checked_on":"2026-10-06","price_cuts":0,"new_listings":1},{"p25":149,"p75":448,"trait":"Frappuccino","market":"KR","median":224,"listings":59,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":187,"p75":1120,"trait":"Full Pinstripe","market":"KR","median":336,"listings":196,"checked_on":"2026-10-06","price_cuts":2,"new_listings":4},{"p25":159,"p75":289,"trait":"Harlequin","market":"KR","median":224,"listings":6,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":187,"p75":1120,"trait":"Het Axanthic","market":"KR","median":336,"listings":263,"checked_on":"2026-10-06","price_cuts":6,"new_listings":1},{"p25":373,"p75":1494,"trait":"Hypo","market":"KR","median":598,"listings":83,"checked_on":"2026-10-06","price_cuts":0,"new_listings":1},{"p25":149,"p75":672,"trait":"Lilly White","market":"KR","median":299,"listings":562,"checked_on":"2026-10-06","price_cuts":1,"new_listings":9},{"p25":168,"p75":598,"trait":"Phantom","market":"KR","median":486,"listings":38,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":224,"p75":1120,"trait":"Pinstripe","market":"KR","median":448,"listings":93,"checked_on":"2026-10-06","price_cuts":1,"new_listings":1},{"p25":149,"p75":1120,"trait":"Portholes","market":"KR","median":243,"listings":58,"checked_on":"2026-10-06","price_cuts":0,"new_listings":1},{"p25":187,"p75":1195,"trait":"Quad-stripe","market":"KR","median":373,"listings":197,"checked_on":"2026-10-06","price_cuts":2,"new_listings":2},{"p25":112,"p75":261,"trait":"Red","market":"KR","median":149,"listings":51,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":149,"p75":822,"trait":"Sable","market":"KR","median":299,"listings":386,"checked_on":"2026-10-06","price_cuts":0,"new_listings":2},{"p25":187,"p75":1083,"trait":"Super Dalmatian","market":"KR","median":429,"listings":38,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":149,"p75":747,"trait":"Tangerine","market":"KR","median":336,"listings":180,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":149,"p75":896,"trait":"Tri-color","market":"KR","median":355,"listings":850,"checked_on":"2026-10-06","price_cuts":2,"new_listings":4},{"p25":75,"p75":411,"trait":"Yellow","market":"KR","median":224,"listings":37,"checked_on":"2026-10-06","price_cuts":1,"new_listings":3},{"p25":150,"p75":450,"trait":null,"market":"US","median":250,"listings":6985,"checked_on":"2026-10-06","price_cuts":183,"new_listings":53},{"p25":600,"p75":1200,"trait":"Axanthic","market":"US","median":800,"listings":144,"checked_on":"2026-10-06","price_cuts":4,"new_listings":0},{"p25":100,"p75":300,"trait":"Brindle","market":"US","median":150,"listings":213,"checked_on":"2026-10-06","price_cuts":6,"new_listings":0},{"p25":100,"p75":200,"trait":"Buckskin","market":"US","median":150,"listings":15,"checked_on":"2026-10-06","price_cuts":0,"new_listings":0},{"p25":244,"p75":596,"trait":"Cappuccino","market":"US","median":350,"listings":384,"checked_on":"2026-10-06","price_cuts":8,"new_listings":4},{"p25":150,"p75":350,"trait":"Cream","market":"US","median":250,"listings":415,"checked_on":"2026-10-06","price_cuts":20,"new_listings":5},{"p25":100,"p75":300,"trait":"Dalmatian","market":"US","median":175,"listings":680,"checked_on":"2026-10-06","price_cuts":22,"new_listings":6},{"p25":150,"p75":450,"trait":"Dark","market":"US","median":262,"listings":794,"checked_on":"2026-10-06","price_cuts":35,"new_listings":7},{"p25":250,"p75":600,"trait":"Drippy","market":"US","median":400,"listings":462,"checked_on":"2026-10-06","price_cuts":16,"new_listings":3},{"p25":160,"p75":400,"trait":"Empty Back","market":"US","median":250,"listings":313,"checked_on":"2026-10-06","price_cuts":13,"new_listings":1},{"p25":200,"p75":434,"trait":"Extreme Harlequin","market":"US","median":300,"listings":1106,"checked_on":"2026-10-06","price_cuts":25,"new_listings":6},{"p25":110,"p75":280,"trait":"Harlequin","market":"US","median":175,"listings":1277,"checked_on":"2026-10-06","price_cuts":31,"new_listings":9},{"p25":250,"p75":600,"trait":"Het Axanthic","market":"US","median":450,"listings":135,"checked_on":"2026-10-06","price_cuts":2,"new_listings":0},{"p25":203,"p75":500,"trait":"Hypo","market":"US","median":315,"listings":122,"checked_on":"2026-10-06","price_cuts":4,"new_listings":1},{"p25":160,"p75":450,"trait":"Lavender","market":"US","median":300,"listings":243,"checked_on":"2026-10-06","price_cuts":6,"new_listings":1},{"p25":250,"p75":600,"trait":"Lilly White","market":"US","median":400,"listings":1191,"checked_on":"2026-10-06","price_cuts":29,"new_listings":13},{"p25":200,"p75":450,"trait":"Olive","market":"US","median":250,"listings":17,"checked_on":"2026-10-06","price_cuts":1,"new_listings":0},{"p25":175,"p75":425,"trait":"Orange","market":"US","median":285,"listings":322,"checked_on":"2026-10-06","price_cuts":7,"new_listings":1},{"p25":120,"p75":300,"trait":"Partial Pinstripe","market":"US","median":175,"listings":386,"checked_on":"2026-10-06","price_cuts":17,"new_listings":0},{"p25":125,"p75":275,"trait":"Patternless","market":"US","median":150,"listings":27,"checked_on":"2026-10-06","price_cuts":2,"new_listings":0},{"p25":150,"p75":400,"trait":"Phantom","market":"US","median":250,"listings":589,"checked_on":"2026-10-06","price_cuts":15,"new_listings":9},{"p25":150,"p75":350,"trait":"Pinstripe","market":"US","median":249,"listings":949,"checked_on":"2026-10-06","price_cuts":25,"new_listings":3},{"p25":125,"p75":350,"trait":"Portholes","market":"US","median":200,"listings":388,"checked_on":"2026-10-06","price_cuts":17,"new_listings":1},{"p25":175,"p75":400,"trait":"Quad-stripe","market":"US","median":280,"listings":179,"checked_on":"2026-10-06","price_cuts":8,"new_listings":0},{"p25":150,"p75":400,"trait":"Red","market":"US","median":250,"listings":509,"checked_on":"2026-10-06","price_cuts":17,"new_listings":3},{"p25":175,"p75":467,"trait":"Red Base","market":"US","median":300,"listings":403,"checked_on":"2026-10-06","price_cuts":12,"new_listings":4},{"p25":100,"p75":337,"trait":"Reverse Pinstripe","market":"US","median":150,"listings":50,"checked_on":"2026-10-06","price_cuts":2,"new_listings":0},{"p25":490,"p75":863,"trait":"Sable","market":"US","median":610,"listings":112,"checked_on":"2026-10-06","price_cuts":3,"new_listings":0},{"p25":219,"p75":500,"trait":"Soft Scale","market":"US","median":340,"listings":168,"checked_on":"2026-10-06","price_cuts":5,"new_listings":0},{"p25":200,"p75":500,"trait":"Super Dalmatian","market":"US","median":360,"listings":390,"checked_on":"2026-10-06","price_cuts":12,"new_listings":4},{"p25":200,"p75":400,"trait":"Tangerine","market":"US","median":300,"listings":262,"checked_on":"2026-10-06","price_cuts":6,"new_listings":1},{"p25":150,"p75":400,"trait":"Tiger","market":"US","median":275,"listings":232,"checked_on":"2026-10-06","price_cuts":4,"new_listings":0},{"p25":200,"p75":450,"trait":"Tri-color","market":"US","median":300,"listings":1348,"checked_on":"2026-10-06","price_cuts":40,"new_listings":10},{"p25":200,"p75":550,"trait":"White Wall","market":"US","median":349,"listings":501,"checked_on":"2026-10-06","price_cuts":9,"new_listings":4},{"p25":150,"p75":350,"trait":"Yellow","market":"US","median":200,"listings":410,"checked_on":"2026-10-06","price_cuts":18,"new_listings":2},{"p25":156,"p75":425,"trait":"Yellow Base","market":"US","median":292,"listings":182,"checked_on":"2026-10-06","price_cuts":9,"new_listings":2}]');
const monthly = /* @__PURE__ */ JSON.parse('[{"month":"2026-09","trait":null,"market":"EU","median":136,"full_checks":4,"avg_listings":184},{"month":"2026-09","trait":"Axanthic","market":"EU","median":1135,"full_checks":4,"avg_listings":5},{"month":"2026-09","trait":"Lilly White","market":"EU","median":114,"full_checks":4,"avg_listings":11},{"month":"2026-10","trait":null,"market":"EU","median":135,"full_checks":4,"avg_listings":184},{"month":"2026-10","trait":"Axanthic","market":"EU","median":1097,"full_checks":4,"avg_listings":5},{"month":"2026-10","trait":"Lilly White","market":"EU","median":113,"full_checks":4,"avg_listings":11},{"month":"2026-09","trait":null,"market":"JP","median":159,"full_checks":3,"avg_listings":119},{"month":"2026-09","trait":"Dalmatian","market":"JP","median":165,"full_checks":3,"avg_listings":8},{"month":"2026-09","trait":"Dark","market":"JP","median":172,"full_checks":3,"avg_listings":6},{"month":"2026-09","trait":"Extreme Harlequin","market":"JP","median":140,"full_checks":3,"avg_listings":15},{"month":"2026-09","trait":"Harlequin","market":"JP","median":121,"full_checks":3,"avg_listings":15},{"month":"2026-09","trait":"Lilly White","market":"JP","median":305,"full_checks":3,"avg_listings":22},{"month":"2026-09","trait":"Pinstripe","market":"JP","median":147,"full_checks":3,"avg_listings":6},{"month":"2026-09","trait":"Red","market":"JP","median":204,"full_checks":3,"avg_listings":7},{"month":"2026-09","trait":"Tiger","market":"JP","median":102,"full_checks":3,"avg_listings":5},{"month":"2026-09","trait":"Tri-color","market":"JP","median":165,"full_checks":3,"avg_listings":11},{"month":"2026-10","trait":null,"market":"JP","median":158,"full_checks":4,"avg_listings":119},{"month":"2026-10","trait":"Dalmatian","market":"JP","median":164,"full_checks":4,"avg_listings":8},{"month":"2026-10","trait":"Dark","market":"JP","median":171,"full_checks":4,"avg_listings":6},{"month":"2026-10","trait":"Extreme Harlequin","market":"JP","median":139,"full_checks":4,"avg_listings":15},{"month":"2026-10","trait":"Harlequin","market":"JP","median":120,"full_checks":4,"avg_listings":15},{"month":"2026-10","trait":"Lilly White","market":"JP","median":304,"full_checks":4,"avg_listings":22},{"month":"2026-10","trait":"Pinstripe","market":"JP","median":146,"full_checks":4,"avg_listings":6},{"month":"2026-10","trait":"Red","market":"JP","median":203,"full_checks":4,"avg_listings":7},{"month":"2026-10","trait":"Tiger","market":"JP","median":101,"full_checks":4,"avg_listings":5},{"month":"2026-10","trait":"Tri-color","market":"JP","median":165,"full_checks":4,"avg_listings":11},{"month":"2026-08","trait":null,"market":"KR","median":702,"full_checks":1,"avg_listings":38},{"month":"2026-08","trait":"Drippy","market":"KR","median":1330,"full_checks":1,"avg_listings":11},{"month":"2026-08","trait":"Empty Back","market":"KR","median":333,"full_checks":1,"avg_listings":5},{"month":"2026-08","trait":"Full Pinstripe","market":"KR","median":1108,"full_checks":1,"avg_listings":9},{"month":"2026-08","trait":"Het Axanthic","market":"KR","median":1330,"full_checks":1,"avg_listings":20},{"month":"2026-08","trait":"Quad-stripe","market":"KR","median":1108,"full_checks":1,"avg_listings":9},{"month":"2026-08","trait":"Tri-color","market":"KR","median":148,"full_checks":1,"avg_listings":7},{"month":"2026-09","trait":null,"market":"KR","median":351,"full_checks":6,"avg_listings":1817},{"month":"2026-09","trait":"Axanthic","market":"KR","median":887,"full_checks":4,"avg_listings":279},{"month":"2026-09","trait":"Buckskin","market":"KR","median":296,"full_checks":4,"avg_listings":6},{"month":"2026-09","trait":"Cappuccino","market":"KR","median":203,"full_checks":4,"avg_listings":138},{"month":"2026-09","trait":"Cream","market":"KR","median":185,"full_checks":4,"avg_listings":53},{"month":"2026-09","trait":"Dark","market":"KR","median":148,"full_checks":4,"avg_listings":19},{"month":"2026-09","trait":"Drippy","market":"KR","median":406,"full_checks":6,"avg_listings":239},{"month":"2026-09","trait":"Empty Back","market":"KR","median":369,"full_checks":4,"avg_listings":47},{"month":"2026-09","trait":"Extreme Harlequin","market":"KR","median":369,"full_checks":5,"avg_listings":310},{"month":"2026-09","trait":"Frappuccino","market":"KR","median":222,"full_checks":4,"avg_listings":64},{"month":"2026-09","trait":"Full Pinstripe","market":"KR","median":323,"full_checks":4,"avg_listings":199},{"month":"2026-09","trait":"Harlequin","market":"KR","median":185,"full_checks":4,"avg_listings":5},{"month":"2026-09","trait":"Het Axanthic","market":"KR","median":369,"full_checks":4,"avg_listings":257},{"month":"2026-09","trait":"Hypo","market":"KR","median":591,"full_checks":4,"avg_listings":56},{"month":"2026-09","trait":"Lilly White","market":"KR","median":277,"full_checks":4,"avg_listings":503},{"month":"2026-09","trait":"Phantom","market":"KR","median":517,"full_checks":4,"avg_listings":41},{"month":"2026-09","trait":"Pinstripe","market":"KR","median":443,"full_checks":4,"avg_listings":85},{"month":"2026-09","trait":"Portholes","market":"KR","median":296,"full_checks":4,"avg_listings":49},{"month":"2026-09","trait":"Quad-stripe","market":"KR","median":369,"full_checks":4,"avg_listings":188},{"month":"2026-09","trait":"Red","market":"KR","median":148,"full_checks":4,"avg_listings":49},{"month":"2026-09","trait":"Sable","market":"KR","median":333,"full_checks":5,"avg_listings":258},{"month":"2026-09","trait":"Super Dalmatian","market":"KR","median":406,"full_checks":4,"avg_listings":39},{"month":"2026-09","trait":"Tangerine","market":"KR","median":342,"full_checks":4,"avg_listings":158},{"month":"2026-09","trait":"Tiger","market":"KR","median":185,"full_checks":3,"avg_listings":5},{"month":"2026-09","trait":"Tri-color","market":"KR","median":351,"full_checks":6,"avg_listings":553},{"month":"2026-09","trait":"Yellow","market":"KR","median":185,"full_checks":4,"avg_listings":29},{"month":"2026-10","trait":null,"market":"KR","median":298,"full_checks":4,"avg_listings":2949},{"month":"2026-10","trait":"Axanthic","market":"KR","median":832,"full_checks":4,"avg_listings":323},{"month":"2026-10","trait":"Buckskin","market":"KR","median":296,"full_checks":2,"avg_listings":5},{"month":"2026-10","trait":"Cappuccino","market":"KR","median":223,"full_checks":4,"avg_listings":141},{"month":"2026-10","trait":"Cream","market":"KR","median":223,"full_checks":4,"avg_listings":56},{"month":"2026-10","trait":"Dark","market":"KR","median":186,"full_checks":4,"avg_listings":17},{"month":"2026-10","trait":"Drippy","market":"KR","median":390,"full_checks":4,"avg_listings":362},{"month":"2026-10","trait":"Empty Back","market":"KR","median":372,"full_checks":4,"avg_listings":51},{"month":"2026-10","trait":"Extreme Harlequin","market":"KR","median":372,"full_checks":4,"avg_listings":402},{"month":"2026-10","trait":"Frappuccino","market":"KR","median":223,"full_checks":4,"avg_listings":61},{"month":"2026-10","trait":"Full Pinstripe","market":"KR","median":335,"full_checks":4,"avg_listings":202},{"month":"2026-10","trait":"Harlequin","market":"KR","median":204,"full_checks":4,"avg_listings":6},{"month":"2026-10","trait":"Het Axanthic","market":"KR","median":352,"full_checks":4,"avg_listings":269},{"month":"2026-10","trait":"Hypo","market":"KR","median":594,"full_checks":4,"avg_listings":82},{"month":"2026-10","trait":"Lilly White","market":"KR","median":296,"full_checks":4,"avg_listings":551},{"month":"2026-10","trait":"Phantom","market":"KR","median":500,"full_checks":4,"avg_listings":38},{"month":"2026-10","trait":"Pinstripe","market":"KR","median":446,"full_checks":4,"avg_listings":92},{"month":"2026-10","trait":"Portholes","market":"KR","median":277,"full_checks":4,"avg_listings":57},{"month":"2026-10","trait":"Quad-stripe","market":"KR","median":372,"full_checks":4,"avg_listings":200},{"month":"2026-10","trait":"Red","market":"KR","median":149,"full_checks":4,"avg_listings":52},{"month":"2026-10","trait":"Sable","market":"KR","median":298,"full_checks":4,"avg_listings":380},{"month":"2026-10","trait":"Super Dalmatian","market":"KR","median":409,"full_checks":4,"avg_listings":40},{"month":"2026-10","trait":"Tangerine","market":"KR","median":343,"full_checks":4,"avg_listings":175},{"month":"2026-10","trait":"Tri-color","market":"KR","median":335,"full_checks":4,"avg_listings":860},{"month":"2026-10","trait":"Yellow","market":"KR","median":250,"full_checks":4,"avg_listings":33},{"month":"2026-05","trait":null,"market":"US","median":300,"full_checks":4,"avg_listings":6020},{"month":"2026-05","trait":"Axanthic","market":"US","median":1050,"full_checks":4,"avg_listings":39},{"month":"2026-05","trait":"Brindle","market":"US","median":163,"full_checks":4,"avg_listings":61},{"month":"2026-05","trait":"Cappuccino","market":"US","median":350,"full_checks":4,"avg_listings":161},{"month":"2026-05","trait":"Cream","market":"US","median":271,"full_checks":4,"avg_listings":77},{"month":"2026-05","trait":"Dalmatian","market":"US","median":175,"full_checks":4,"avg_listings":249},{"month":"2026-05","trait":"Dark","market":"US","median":250,"full_checks":4,"avg_listings":212},{"month":"2026-05","trait":"Drippy","market":"US","median":500,"full_checks":4,"avg_listings":121},{"month":"2026-05","trait":"Empty Back","market":"US","median":250,"full_checks":4,"avg_listings":116},{"month":"2026-05","trait":"Extreme Harlequin","market":"US","median":300,"full_checks":4,"avg_listings":360},{"month":"2026-05","trait":"Harlequin","market":"US","median":150,"full_checks":4,"avg_listings":451},{"month":"2026-05","trait":"Het Axanthic","market":"US","median":400,"full_checks":4,"avg_listings":56},{"month":"2026-05","trait":"Hypo","market":"US","median":300,"full_checks":4,"avg_listings":36},{"month":"2026-05","trait":"Lavender","market":"US","median":300,"full_checks":4,"avg_listings":98},{"month":"2026-05","trait":"Lilly White","market":"US","median":391,"full_checks":4,"avg_listings":385},{"month":"2026-05","trait":"Olive","market":"US","median":200,"full_checks":1,"avg_listings":5},{"month":"2026-05","trait":"Orange","market":"US","median":259,"full_checks":4,"avg_listings":89},{"month":"2026-05","trait":"Partial Pinstripe","market":"US","median":175,"full_checks":4,"avg_listings":102},{"month":"2026-05","trait":"Patternless","market":"US","median":150,"full_checks":2,"avg_listings":5},{"month":"2026-05","trait":"Phantom","market":"US","median":275,"full_checks":4,"avg_listings":163},{"month":"2026-05","trait":"Pinstripe","market":"US","median":200,"full_checks":4,"avg_listings":273},{"month":"2026-05","trait":"Portholes","market":"US","median":190,"full_checks":4,"avg_listings":125},{"month":"2026-05","trait":"Quad-stripe","market":"US","median":300,"full_checks":4,"avg_listings":81},{"month":"2026-05","trait":"Red","market":"US","median":275,"full_checks":4,"avg_listings":163},{"month":"2026-05","trait":"Red Base","market":"US","median":294,"full_checks":4,"avg_listings":116},{"month":"2026-05","trait":"Reverse Pinstripe","market":"US","median":170,"full_checks":4,"avg_listings":13},{"month":"2026-05","trait":"Sable","market":"US","median":925,"full_checks":4,"avg_listings":33},{"month":"2026-05","trait":"Soft Scale","market":"US","median":300,"full_checks":4,"avg_listings":88},{"month":"2026-05","trait":"Super Dalmatian","market":"US","median":380,"full_checks":4,"avg_listings":96},{"month":"2026-05","trait":"Tangerine","market":"US","median":300,"full_checks":4,"avg_listings":108},{"month":"2026-05","trait":"Tiger","market":"US","median":284,"full_checks":4,"avg_listings":73},{"month":"2026-05","trait":"Tri-color","market":"US","median":300,"full_checks":4,"avg_listings":418},{"month":"2026-05","trait":"White Wall","market":"US","median":350,"full_checks":4,"avg_listings":116},{"month":"2026-05","trait":"Yellow","market":"US","median":250,"full_checks":4,"avg_listings":125},{"month":"2026-05","trait":"Yellow Base","market":"US","median":325,"full_checks":4,"avg_listings":52},{"month":"2026-06","trait":null,"market":"US","median":300,"full_checks":1,"avg_listings":5994},{"month":"2026-06","trait":"Axanthic","market":"US","median":1100,"full_checks":1,"avg_listings":28},{"month":"2026-06","trait":"Brindle","market":"US","median":155,"full_checks":1,"avg_listings":54},{"month":"2026-06","trait":"Cappuccino","market":"US","median":375,"full_checks":1,"avg_listings":127},{"month":"2026-06","trait":"Cream","market":"US","median":300,"full_checks":1,"avg_listings":62},{"month":"2026-06","trait":"Dalmatian","market":"US","median":175,"full_checks":1,"avg_listings":208},{"month":"2026-06","trait":"Dark","market":"US","median":275,"full_checks":1,"avg_listings":173},{"month":"2026-06","trait":"Drippy","market":"US","median":500,"full_checks":1,"avg_listings":104},{"month":"2026-06","trait":"Empty Back","market":"US","median":300,"full_checks":1,"avg_listings":94},{"month":"2026-06","trait":"Extreme Harlequin","market":"US","median":300,"full_checks":1,"avg_listings":302},{"month":"2026-06","trait":"Harlequin","market":"US","median":160,"full_checks":1,"avg_listings":350},{"month":"2026-06","trait":"Het Axanthic","market":"US","median":450,"full_checks":1,"avg_listings":41},{"month":"2026-06","trait":"Hypo","market":"US","median":350,"full_checks":1,"avg_listings":30},{"month":"2026-06","trait":"Lavender","market":"US","median":300,"full_checks":1,"avg_listings":79},{"month":"2026-06","trait":"Lilly White","market":"US","median":400,"full_checks":1,"avg_listings":322},{"month":"2026-06","trait":"Orange","market":"US","median":290,"full_checks":1,"avg_listings":70},{"month":"2026-06","trait":"Partial Pinstripe","market":"US","median":175,"full_checks":1,"avg_listings":85},{"month":"2026-06","trait":"Phantom","market":"US","median":275,"full_checks":1,"avg_listings":136},{"month":"2026-06","trait":"Pinstripe","market":"US","median":200,"full_checks":1,"avg_listings":211},{"month":"2026-06","trait":"Portholes","market":"US","median":200,"full_checks":1,"avg_listings":95},{"month":"2026-06","trait":"Quad-stripe","market":"US","median":300,"full_checks":1,"avg_listings":67},{"month":"2026-06","trait":"Red","market":"US","median":300,"full_checks":1,"avg_listings":128},{"month":"2026-06","trait":"Red Base","market":"US","median":300,"full_checks":1,"avg_listings":96},{"month":"2026-06","trait":"Reverse Pinstripe","market":"US","median":170,"full_checks":1,"avg_listings":9},{"month":"2026-06","trait":"Sable","market":"US","median":1200,"full_checks":1,"avg_listings":27},{"month":"2026-06","trait":"Soft Scale","market":"US","median":325,"full_checks":1,"avg_listings":75},{"month":"2026-06","trait":"Super Dalmatian","market":"US","median":400,"full_checks":1,"avg_listings":70},{"month":"2026-06","trait":"Tangerine","market":"US","median":300,"full_checks":1,"avg_listings":93},{"month":"2026-06","trait":"Tiger","market":"US","median":300,"full_checks":1,"avg_listings":60},{"month":"2026-06","trait":"Tri-color","market":"US","median":300,"full_checks":1,"avg_listings":354},{"month":"2026-06","trait":"White Wall","market":"US","median":350,"full_checks":1,"avg_listings":90},{"month":"2026-06","trait":"Yellow","market":"US","median":250,"full_checks":1,"avg_listings":99},{"month":"2026-06","trait":"Yellow Base","market":"US","median":325,"full_checks":1,"avg_listings":40},{"month":"2026-09","trait":null,"market":"US","median":260,"full_checks":1,"avg_listings":2478},{"month":"2026-09","trait":"Axanthic","market":"US","median":695,"full_checks":1,"avg_listings":31},{"month":"2026-09","trait":"Brindle","market":"US","median":150,"full_checks":1,"avg_listings":91},{"month":"2026-09","trait":"Cappuccino","market":"US","median":361,"full_checks":1,"avg_listings":92},{"month":"2026-09","trait":"Cream","market":"US","median":287,"full_checks":1,"avg_listings":150},{"month":"2026-09","trait":"Dalmatian","market":"US","median":193,"full_checks":1,"avg_listings":274},{"month":"2026-09","trait":"Dark","market":"US","median":250,"full_checks":1,"avg_listings":309},{"month":"2026-09","trait":"Drippy","market":"US","median":375,"full_checks":1,"avg_listings":151},{"month":"2026-09","trait":"Empty Back","market":"US","median":250,"full_checks":1,"avg_listings":110},{"month":"2026-09","trait":"Extreme Harlequin","market":"US","median":300,"full_checks":1,"avg_listings":414},{"month":"2026-09","trait":"Harlequin","market":"US","median":175,"full_checks":1,"avg_listings":488},{"month":"2026-09","trait":"Het Axanthic","market":"US","median":425,"full_checks":1,"avg_listings":36},{"month":"2026-09","trait":"Hypo","market":"US","median":399,"full_checks":1,"avg_listings":43},{"month":"2026-09","trait":"Lavender","market":"US","median":300,"full_checks":1,"avg_listings":121},{"month":"2026-09","trait":"Lilly White","market":"US","median":400,"full_checks":1,"avg_listings":359},{"month":"2026-09","trait":"Orange","market":"US","median":250,"full_checks":1,"avg_listings":111},{"month":"2026-09","trait":"Partial Pinstripe","market":"US","median":180,"full_checks":1,"avg_listings":166},{"month":"2026-09","trait":"Patternless","market":"US","median":150,"full_checks":1,"avg_listings":10},{"month":"2026-09","trait":"Phantom","market":"US","median":253,"full_checks":1,"avg_listings":196},{"month":"2026-09","trait":"Pinstripe","market":"US","median":225,"full_checks":1,"avg_listings":315},{"month":"2026-09","trait":"Portholes","market":"US","median":199,"full_checks":1,"avg_listings":143},{"month":"2026-09","trait":"Quad-stripe","market":"US","median":275,"full_checks":1,"avg_listings":82},{"month":"2026-09","trait":"Red","market":"US","median":275,"full_checks":1,"avg_listings":188},{"month":"2026-09","trait":"Red Base","market":"US","median":300,"full_checks":1,"avg_listings":156},{"month":"2026-09","trait":"Reverse Pinstripe","market":"US","median":150,"full_checks":1,"avg_listings":19},{"month":"2026-09","trait":"Sable","market":"US","median":680,"full_checks":1,"avg_listings":31},{"month":"2026-09","trait":"Soft Scale","market":"US","median":300,"full_checks":1,"avg_listings":85},{"month":"2026-09","trait":"Super Dalmatian","market":"US","median":375,"full_checks":1,"avg_listings":127},{"month":"2026-09","trait":"Tangerine","market":"US","median":299,"full_checks":1,"avg_listings":110},{"month":"2026-09","trait":"Tiger","market":"US","median":250,"full_checks":1,"avg_listings":81},{"month":"2026-09","trait":"Tri-color","market":"US","median":300,"full_checks":1,"avg_listings":464},{"month":"2026-09","trait":"White Wall","market":"US","median":300,"full_checks":1,"avg_listings":160},{"month":"2026-09","trait":"Yellow","market":"US","median":250,"full_checks":1,"avg_listings":140},{"month":"2026-09","trait":"Yellow Base","market":"US","median":299,"full_checks":1,"avg_listings":71},{"month":"2026-10","trait":null,"market":"US","median":250,"full_checks":2,"avg_listings":6215},{"month":"2026-10","trait":"Axanthic","market":"US","median":775,"full_checks":2,"avg_listings":140},{"month":"2026-10","trait":"Brindle","market":"US","median":155,"full_checks":2,"avg_listings":188},{"month":"2026-10","trait":"Buckskin","market":"US","median":142,"full_checks":2,"avg_listings":14},{"month":"2026-10","trait":"Cappuccino","market":"US","median":350,"full_checks":2,"avg_listings":348},{"month":"2026-10","trait":"Cream","market":"US","median":250,"full_checks":2,"avg_listings":349},{"month":"2026-10","trait":"Dalmatian","market":"US","median":175,"full_checks":2,"avg_listings":606},{"month":"2026-10","trait":"Dark","market":"US","median":269,"full_checks":2,"avg_listings":690},{"month":"2026-10","trait":"Drippy","market":"US","median":400,"full_checks":2,"avg_listings":412},{"month":"2026-10","trait":"Empty Back","market":"US","median":250,"full_checks":2,"avg_listings":282},{"month":"2026-10","trait":"Extreme Harlequin","market":"US","median":300,"full_checks":2,"avg_listings":961},{"month":"2026-10","trait":"Harlequin","market":"US","median":168,"full_checks":2,"avg_listings":1127},{"month":"2026-10","trait":"Het Axanthic","market":"US","median":450,"full_checks":2,"avg_listings":121},{"month":"2026-10","trait":"Hypo","market":"US","median":308,"full_checks":2,"avg_listings":108},{"month":"2026-10","trait":"Lavender","market":"US","median":288,"full_checks":2,"avg_listings":206},{"month":"2026-10","trait":"Lilly White","market":"US","median":400,"full_checks":2,"avg_listings":1072},{"month":"2026-10","trait":"Olive","market":"US","median":250,"full_checks":2,"avg_listings":15},{"month":"2026-10","trait":"Orange","market":"US","median":280,"full_checks":2,"avg_listings":281},{"month":"2026-10","trait":"Partial Pinstripe","market":"US","median":175,"full_checks":2,"avg_listings":336},{"month":"2026-10","trait":"Patternless","market":"US","median":163,"full_checks":2,"avg_listings":23},{"month":"2026-10","trait":"Phantom","market":"US","median":250,"full_checks":2,"avg_listings":536},{"month":"2026-10","trait":"Pinstripe","market":"US","median":237,"full_checks":2,"avg_listings":845},{"month":"2026-10","trait":"Portholes","market":"US","median":200,"full_checks":2,"avg_listings":343},{"month":"2026-10","trait":"Quad-stripe","market":"US","median":290,"full_checks":2,"avg_listings":156},{"month":"2026-10","trait":"Red","market":"US","median":250,"full_checks":2,"avg_listings":449},{"month":"2026-10","trait":"Red Base","market":"US","median":294,"full_checks":2,"avg_listings":354},{"month":"2026-10","trait":"Reverse Pinstripe","market":"US","median":175,"full_checks":2,"avg_listings":41},{"month":"2026-10","trait":"Sable","market":"US","median":605,"full_checks":2,"avg_listings":106},{"month":"2026-10","trait":"Soft Scale","market":"US","median":345,"full_checks":2,"avg_listings":143},{"month":"2026-10","trait":"Super Dalmatian","market":"US","median":355,"full_checks":2,"avg_listings":355},{"month":"2026-10","trait":"Tangerine","market":"US","median":300,"full_checks":2,"avg_listings":231},{"month":"2026-10","trait":"Tiger","market":"US","median":288,"full_checks":2,"avg_listings":203},{"month":"2026-10","trait":"Tri-color","market":"US","median":298,"full_checks":2,"avg_listings":1184},{"month":"2026-10","trait":"White Wall","market":"US","median":337,"full_checks":2,"avg_listings":440},{"month":"2026-10","trait":"Yellow","market":"US","median":200,"full_checks":2,"avg_listings":354},{"month":"2026-10","trait":"Yellow Base","market":"US","median":296,"full_checks":2,"avg_listings":158}]');
const generated_at = "2026-10-07T06:00:32.202164+00:00";
const name = "Geck Inspect Price Index";
const description = "Asking prices for crested geckos (Correlophus ciliatus) by trait and market, compiled by Geck Inspect from public listings on the largest online reptile marketplaces in the United States, South Korea, Japan and Europe.";
const url = "https://geckinspect.com/data";
const license = "https://creativecommons.org/licenses/by/4.0/";
const creator = "Geck Inspect";
const attribution = "Geck Inspect Price Index, https://geckinspect.com/data";
const methodology = ["Asking prices on open listings, not sale prices.", "Prices outside the US are converted to USD at stored exchange rates; shipping and import costs are not included.", "Only full catalog checks count. A partial check or the catch-up after an outage is left out.", "A trait is shown only when at least 5 listings carry it. trait null means all crested geckos in that market.", "p25, median and p75 are the 25th, 50th and 75th percentile asking price. monthly.median is the median of that month's daily medians.", "Trait labels are the marketplace labels as listed by sellers; a label does not prove genotype."];
const bundledPriceIndex = {
  latest,
  monthly,
  generated_at,
  name,
  description,
  url,
  license,
  creator,
  attribution,
  methodology
};
const __dirname$1 = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(__dirname$1, "../..");
const SITE_URL = "https://geckinspect.com";
resolve(REPO_ROOT, "src/data/care-guide.js");
resolve(REPO_ROOT, "src/data/morph-guide.js");
resolve(REPO_ROOT, "src/data/blog-posts.js");
resolve(REPO_ROOT, "public/data/price-index.json");
function noDashes(text2) {
  if (typeof text2 !== "string") return text2;
  return text2.replace(/\s*\u2014\s*/g, ", ").replace(/\s*\u2013\s*/g, " to ");
}
let MORPH_LABELS = { inheritance: {}, rarity: {}, category: {} };
function setMorphLabels(mod) {
  MORPH_LABELS = {
    inheritance: Object.fromEntries(Object.values(mod.INHERITANCE || {}).map((i) => [i.id, i.label])),
    rarity: Object.fromEntries(Object.values(mod.RARITY || {}).map((r) => [r.id, r.label])),
    category: Object.fromEntries((mod.MORPH_CATEGORIES || []).map((c) => [c.id, c.label]))
  };
}
function normalizeMorph(m) {
  return {
    slug: m.slug,
    name: m.name || m.slug,
    aliases: m.aliases || [],
    definition: m.definition || null,
    summary: m.summary || null,
    description: m.description || null,
    history: m.history || null,
    notes: m.notes || null,
    foundationGenetics: m.foundationGenetics || null,
    inheritance: m.inheritance || null,
    rarity: m.rarity || null,
    category: m.category || null,
    priceTier: m.priceTier || null,
    priceRange: m.priceRange || null,
    keyFeatures: m.keyFeatures || [],
    visualIdentifiers: m.visualIdentifiers || [],
    lookalikes: m.lookalikes || [],
    combinesWith: m.combinesWith || [],
    sources: m.sources || []
  };
}
const MARKET_NAMES = { US: "United States", KR: "South Korea", JP: "Japan", EU: "Europe" };
const MARKET_ORDER = Object.keys(MARKET_NAMES);
const byMarketOrder = (a, b) => MARKET_ORDER.indexOf(a.market) - MARKET_ORDER.indexOf(b.market);
const MARKET_TRAIT_TO_SLUG = {
  "tri-color": "tricolor",
  phantom: "phantom-pinstripe"
};
function priceRowsForMorph(index, morph) {
  if (!index) return [];
  const names = new Set([morph.name, ...morph.aliases || []].map((n) => n.toLowerCase()));
  return index.latest.filter((row) => {
    if (!row.trait) return false;
    const t = row.trait.toLowerCase();
    return names.has(t) || MARKET_TRAIT_TO_SLUG[t] === morph.slug;
  }).sort(byMarketOrder);
}
const usd = (n) => n == null ? "n/a" : `$${Math.round(Number(n)).toLocaleString("en-US")}`;
function blockToMarkdown(block) {
  switch (block.type) {
    case "p":
      return block.text;
    case "ul":
      return block.items.map((i) => `- ${i}`).join("\n");
    case "ol":
      return block.items.map((i, idx) => `${idx + 1}. ${i}`).join("\n");
    case "callout": {
      const head = block.title ? `**${block.title}**

` : "";
      return `${head}${(block.items || []).map((i) => `- ${i}`).join("\n")}`;
    }
    case "table": {
      if (!block.headers || !block.rows) return "";
      const head = `| ${block.headers.join(" | ")} |`;
      const sep = `| ${block.headers.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
      const cap = block.caption ? `*${block.caption}*

` : "";
      return `${cap}${head}
${sep}
${rows}`;
    }
    case "dl":
      return (block.items || []).map((it) => `**${it.term}:** ${it.def}`).join("\n");
    case "kv":
      return (block.items || []).map((it) => `**${it.label}:** ${it.value}${it.note ? ` (${it.note})` : ""}`).join("\n");
    default:
      return "";
  }
}
function careSectionMarkdown(s, level = 3) {
  const out = [`${"#".repeat(level)} ${s.title}`, "", `_Permalink: ${SITE_URL}/CareGuide/${s.id}_`, ""];
  for (const block of s.blocks) {
    const md = blockToMarkdown(block);
    if (md) out.push(md, "");
  }
  return out.join("\n");
}
function morphMarkdown(m, { level = 3, full = false, priceIndex: priceIndex2 = null, nameOf: nameOf2 = (s) => s } = {}) {
  const h = "#".repeat(level);
  const out = [`${h} ${m.name}`, "", `_Permalink: ${SITE_URL}/MorphGuide/${m.slug}_`, ""];
  const facts = [];
  if (m.aliases?.length && full) facts.push(`**Also called:** ${m.aliases.join(", ")}`);
  if (m.rarity) facts.push(`**Rarity:** ${MORPH_LABELS.rarity[m.rarity] || m.rarity}`);
  if (m.inheritance) facts.push(`**Inheritance:** ${MORPH_LABELS.inheritance[m.inheritance] || m.inheritance}`);
  if (m.category) facts.push(`**Category:** ${MORPH_LABELS.category[m.category] || m.category}`);
  if (m.priceRange) facts.push(`**Typical adult price:** ${m.priceRange}`);
  if (facts.length) out.push(facts.join("  \n"), "");
  if (full && m.definition) out.push(`**Definition.** ${m.definition}`, "");
  if (m.summary) out.push(m.summary, "");
  if (m.description) out.push(m.description, "");
  if (full && m.foundationGenetics) out.push(`**Genetics models.** ${m.foundationGenetics}`, "");
  if (m.history) out.push(`**History.** ${m.history}`, "");
  if (m.keyFeatures?.length) {
    out.push("**Key features:**", m.keyFeatures.map((f) => `- ${f}`).join("\n"), "");
  }
  if (full && m.visualIdentifiers?.length) {
    out.push("**How to identify it:**", m.visualIdentifiers.map((f) => `- ${f}`).join("\n"), "");
  }
  if (full && m.lookalikes?.length) {
    out.push("**Lookalikes and how to tell them apart:**");
    out.push(
      m.lookalikes.filter((l) => l?.slug && l?.difference).map((l) => `- ${nameOf2(l.slug)} (${SITE_URL}/MorphGuide/${l.slug}): ${l.difference}`).join("\n"),
      ""
    );
  }
  if (full && m.combinesWith?.length) {
    out.push(`**Often combined with:** ${m.combinesWith.map(nameOf2).join(", ")}`, "");
  }
  if (full && priceIndex2) {
    const rows = priceRowsForMorph(priceIndex2, m);
    if (rows.length) {
      out.push(
        `**Current asking prices (Geck Inspect Price Index, ${rows[0].checked_on}).** Asking prices on public crested gecko listings, converted to USD, not sale prices. Full dataset: ${SITE_URL}/data/price-index.json`,
        "",
        "| Market | Listings | 25th percentile | Median | 75th percentile |",
        "| --- | --- | --- | --- | --- |",
        ...rows.map((r) => `| ${MARKET_NAMES[r.market] || r.market} | ${r.listings} | ${usd(r.p25)} | ${usd(r.median)} | ${usd(r.p75)} |`),
        ""
      );
    }
  }
  if (m.notes) out.push(`**Notes.** ${m.notes}`, "");
  if (full && m.sources?.length) {
    out.push("**Sources:**", m.sources.map((s) => `- ${s}`).join("\n"), "");
  }
  return out.join("\n");
}
setMorphLabels(MorphGuide);
const MORPHS = MORPHS$1.map(normalizeMorph);
const BY_SLUG = Object.fromEntries(MORPHS.map((m) => [m.slug, m]));
const nameOf = (slug) => BY_SLUG[slug]?.name || slug;
const CARE = CARE_CATEGORIES.flatMap(
  (cat) => (cat.sections || []).map((s) => ({ id: s.id, title: s.title, category: cat.id, blocks: s.body || [] }))
);
const SERVER_INFO = { name: "geck-inspect", title: "Geck Inspect crested gecko reference", version: "1.0.0" };
const INSTRUCTIONS = "Crested gecko (Correlophus ciliatus) reference data from Geck Inspect: morphs, care, genetics odds and asking prices. Cite the url in each answer. Prices are asking prices on public listings, not sale prices.";
let priceCache = { at: 0, data: bundledPriceIndex };
async function priceIndex() {
  if (Date.now() - priceCache.at < 60 * 60 * 1e3) return priceCache.data;
  try {
    const res = await fetch(`${SITE_URL}/data/price-index.json`, { signal: AbortSignal.timeout(4e3) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.latest)) priceCache = { at: Date.now(), data };
    }
  } catch {
    priceCache = { ...priceCache, at: Date.now() };
  }
  return priceCache.data;
}
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
function findMorph(input) {
  const q = norm(input);
  if (!q) return null;
  if (BY_SLUG[q]) return BY_SLUG[q];
  return MORPHS.find((m) => norm(m.name) === q || m.aliases.some((a) => norm(a) === q)) || MORPHS.find((m) => norm(m.name).includes(q)) || null;
}
function findCare(input) {
  const q = norm(input);
  if (!q) return null;
  return CARE.find((s) => s.id === q) || CARE.find((s) => norm(s.title) === q) || CARE.find((s) => norm(s.title).includes(q) || s.id.includes(q)) || null;
}
const text = (t, structured) => ({
  content: [{ type: "text", text: noDashes(t) }],
  ...structured ? { structuredContent: structured } : {}
});
const fail = (t) => ({ content: [{ type: "text", text: t }], isError: true });
const TOOLS = [
  {
    name: "search_morphs",
    title: "Search crested gecko morphs",
    description: "Search the Geck Inspect Morph Guide. Filter by free text (name, alias or feature), category (pattern, base, structure, ...) or inheritance (polygenic, incomplete-dominant, recessive, ...). Returns slugs to pass to get_morph.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: 'Free text, e.g. "white flank" or "Harley"' },
        category: { type: "string" },
        inheritance: { type: "string" }
      }
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "get_morph",
    title: "Get one crested gecko morph",
    description: "Full Morph Guide entry for one crested gecko morph: definition, identification, lookalikes and how to tell them apart, inheritance and competing genetics models, history, typical price and current asking prices by market, and sources.",
    inputSchema: {
      type: "object",
      properties: { morph: { type: "string", description: 'Slug, name or alias, e.g. "lilly-white", "Harlequin", "LW"' } },
      required: ["morph"]
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "list_care_topics",
    title: "List crested gecko care topics",
    description: "Every topic in the Geck Inspect Care Guide with its id, for get_care_topic.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "get_care_topic",
    title: "Get one crested gecko care topic",
    description: "One Care Guide topic in full (housing, temperature, humidity, diet, handling, health, breeding and more).",
    inputSchema: {
      type: "object",
      properties: { topic: { type: "string", description: 'Topic id or title, e.g. "enclosure-size" or "humidity"' } },
      required: ["topic"]
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "get_prices",
    title: "Crested gecko asking prices",
    description: "Geck Inspect Price Index: 25th percentile, median and 75th percentile asking price in USD by trait and market (US, KR, JP, EU) from the latest full check of public listings, plus monthly medians. Asking prices, not sale prices.",
    inputSchema: {
      type: "object",
      properties: {
        trait: { type: "string", description: 'Trait or morph, e.g. "Lilly White". Omit for the whole market.' },
        market: { type: "string", enum: ["US", "KR", "JP", "EU"] },
        include_monthly: { type: "boolean", description: "Add the monthly median history" }
      }
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "predict_pairing",
    title: "Predict offspring odds for a crested gecko pairing",
    description: 'Per-egg offspring odds for a sire and dam, from the same genetics engine as the Geck Inspect calculator. Pass each parent as a list of trait tags, e.g. ["Lilly White", "Het Axanthic"] or ["66% Possible Het Axanthic"]. Polygenic looks (Harlequin extent, Flame) are reported as not calculable. Includes health warnings such as the lethal Super Lilly White.',
    inputSchema: {
      type: "object",
      properties: {
        sire: { type: "array", items: { type: "string" }, description: "Male trait tags" },
        dam: { type: "array", items: { type: "string" }, description: "Female trait tags" }
      },
      required: ["sire", "dam"]
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }
];
const HANDLERS = {
  search_morphs({ query, category, inheritance } = {}) {
    const q = String(query || "").trim().toLowerCase();
    const hits = MORPHS.filter((m) => {
      if (category && norm(m.category) !== norm(category)) return false;
      if (inheritance && norm(m.inheritance) !== norm(inheritance)) return false;
      if (!q) return true;
      return [m.name, ...m.aliases, m.summary, m.description, ...m.keyFeatures].some((f) => String(f || "").toLowerCase().includes(q));
    });
    const rows = hits.map((m) => ({
      slug: m.slug,
      name: m.name,
      category: m.category,
      inheritance: m.inheritance,
      rarity: m.rarity,
      summary: m.summary,
      url: `${SITE_URL}/MorphGuide/${m.slug}`
    }));
    if (!rows.length) return text(`No morphs matched. Categories: ${[...new Set(MORPHS.map((m) => m.category))].join(", ")}. Inheritance: ${[...new Set(MORPHS.map((m) => m.inheritance))].join(", ")}.`, { morphs: [] });
    return text(rows.map((r) => `- ${r.name} (${r.slug}; ${r.inheritance}, ${r.rarity}): ${r.summary} ${r.url}`).join("\n"), { morphs: rows });
  },
  async get_morph({ morph } = {}) {
    const m = findMorph(morph);
    if (!m) return fail(`No morph called "${morph}". Use search_morphs to find the slug.`);
    const index = await priceIndex();
    return text(morphMarkdown(m, { level: 1, full: true, priceIndex: index, nameOf }), {
      ...m,
      url: `${SITE_URL}/MorphGuide/${m.slug}`,
      askingPrices: priceRowsForMorph(index, m)
    });
  },
  list_care_topics() {
    const rows = CARE.map((s) => ({ id: s.id, title: s.title, category: s.category, url: `${SITE_URL}/CareGuide/${s.id}` }));
    return text(rows.map((r) => `- ${r.id}: ${r.title} (${r.category})`).join("\n"), { topics: rows });
  },
  get_care_topic({ topic } = {}) {
    const s = findCare(topic);
    if (!s) return fail(`No care topic matched "${topic}". Use list_care_topics.`);
    return text(careSectionMarkdown(s, 1), { id: s.id, title: s.title, url: `${SITE_URL}/CareGuide/${s.id}` });
  },
  async get_prices({ trait, market, include_monthly } = {}) {
    const index = await priceIndex();
    const t = trait ? String(trait).trim().toLowerCase() : null;
    const m = market ? String(market).toUpperCase() : null;
    const matchTrait = (r) => t ? (r.trait || "").toLowerCase() === t || findMorph(t) && priceRowsForMorph(index, findMorph(t)).includes(r) : !r.trait;
    const latest2 = index.latest.filter((r) => (!m || r.market === m) && matchTrait(r));
    const monthly2 = include_monthly ? (index.monthly || []).filter((r) => (!m || r.market === m) && (t ? (r.trait || "").toLowerCase() === t : !r.trait)) : void 0;
    const traits = [...new Set(index.latest.map((r) => r.trait).filter(Boolean))].sort();
    if (!latest2.length) {
      return text(`No price rows for ${trait || "all geckos"}${m ? ` in ${m}` : ""} (a trait needs 5+ listings). Traits with data: ${traits.join(", ")}.`, { latest: [], traits });
    }
    const lines = latest2.map((r) => `- ${MARKET_NAMES[r.market] || r.market}, ${r.trait || "all crested geckos"} (${r.checked_on}, ${r.listings} listings): median $${r.median}, middle half $${r.p25} to $${r.p75}`);
    const note = `Asking prices on public listings, converted to USD, not sale prices. Source: Geck Inspect Price Index, ${SITE_URL}/data`;
    return text(`${lines.join("\n")}

${note}`, { latest: latest2, monthly: monthly2, note, generated_at: index.generated_at });
  },
  predict_pairing({ sire, dam } = {}) {
    if (!Array.isArray(sire) || !Array.isArray(dam)) return fail("Pass sire and dam as arrays of trait tags.");
    const s = translateMorphTags(sire.map(String).slice(0, 20));
    const d = translateMorphTags(dam.map(String).slice(0, 20));
    if (!Object.keys(s.spec.loci).length && !Object.keys(d.spec.loci).length) {
      const why = [...s.notUsed, ...d.notUsed].map((n) => `- ${n.tag}: ${n.reason}`).join("\n");
      return text(`Neither parent has a single-gene trait the calculator can use, so no odds can be given.
${why}`, { outcomes: [], notUsed: [...s.notUsed, ...d.notUsed] });
    }
    const result = predictWeighted(s.spec, d.spec);
    const merged = /* @__PURE__ */ new Map();
    for (const o of result.offspring_phenotypes || []) {
      const combos = outcomeCombos(o);
      const traits = outcomeTraits(o);
      const label = combos.length ? `${combos.join(" + ")} (${traits})` : traits;
      const prev = merged.get(label);
      if (prev) prev.probability += o.probability;
      else merged.set(label, { outcome: label, probability: o.probability, health_risk: o.health_risk || null });
    }
    const outcomes = [...merged.values()].sort((a, b) => b.probability - a.probability).map((o) => ({ ...o, probability: Math.round(o.probability * 1e4) / 1e4 }));
    const warnings = (result.warnings || []).map((w) => ({ severity: w.severity, message: noDashes(w.message) }));
    const notUsed = [...s.notUsed.map((n) => ({ parent: "sire", ...n })), ...d.notUsed.map((n) => ({ parent: "dam", ...n }))];
    const out = [
      "Per-egg odds:",
      ...outcomes.map((o) => `- ${o.outcome}: ${(o.probability * 100).toFixed(1)}%${o.health_risk && o.health_risk !== "none" ? ` (health risk: ${o.health_risk})` : ""}`),
      ...warnings.length ? ["", "Warnings:", ...warnings.map((w) => `- ${w.severity}: ${w.message}`)] : [],
      ...notUsed.length ? ["", "Tags not counted:", ...notUsed.map((n) => `- ${n.parent} "${n.tag}": ${n.reason}`)] : [],
      "",
      `Each egg is independent; a clutch can differ from these odds. Calculator: ${SITE_URL}/calculator`
    ];
    return text(out.join("\n"), { outcomes, warnings, notUsed, uncertain: Boolean(result.uncertain) });
  }
};
async function callTool(name2, args) {
  const handler = HANDLERS[name2];
  if (!handler) return null;
  try {
    return await handler(args || {});
  } catch (e) {
    return fail(`Tool error: ${e?.message || "unknown"}`);
  }
}
export {
  INSTRUCTIONS,
  SERVER_INFO,
  TOOLS,
  callTool
};
