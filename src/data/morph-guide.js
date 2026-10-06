/**
 * Crested Gecko Morph Guide, local reference dataset.
 *
 * Source-of-truth morph data, structured for both UI rendering and
 * LLM consumption. Every morph entry follows a consistent shape so
 * this file can be consumed by a chatbot, recommendation engine, or
 * the Geck Inspect recognition pipeline.
 *
 * Keep this file dependency-free. The UI layer is in MorphGuide.jsx
 * and MorphDetail.jsx; entries are merged with the `morph_guides`
 * Supabase table at render time so community contributions show up
 * alongside the canonical data.
 *
 * Entry shape:
 * {
 *   slug: 'harlequin',                    // canonical URL slug
 *   name: 'Harlequin',                    // display name
 *   definition: 'A Harlequin crested gecko is a crested gecko whose ...',
 *                                         // one complete, quotable sentence. It opens the
 *                                         // detail page and the meta description (via
 *                                         // src/lib/morphMeta.js), so keep it factual and
 *                                         // built only from the facts in this entry.
 *   lookalikes: [                         // optional: morphs people mix this one up with
 *     { slug: 'flame', difference: 'one sentence on how to tell them apart' },
 *   ],                                    // slug must be another entry in MORPHS
 *   aliases: [],                          // alternate names / misspellings
 *   category: 'pattern',                  // base | color | pattern | structure | combo
 *   inheritance: 'polygenic',             // recessive | co-dominant | incomplete-dominant | dominant | polygenic | line-bred
 *   foundationGenetics: 'optional paragraph explaining the Foundation Genetics single-locus model when it differs from the traditional label',
 *   rarity: 'common',                     // common | uncommon | rare | very_rare
 *   priceTier: '$',                       // $ | $$ | $$$ | $$$$  (see PRICE_TIERS)
 *   priceRange: '$80 to $250',               // USD estimate for a typical adult
 *   summary: 'short one-liner',
 *   description: 'long paragraph(s)',
 *   keyFeatures: ['bullet points'],
 *   visualIdentifiers: ['how to tell it apart'],
 *   history: 'discovery / proven-by line',
 *   combinesWith: ['cream','dalmatian'],  // slugs of morphs it commonly combines with
 *   notes: 'extra caveats / judging notes',
 * }
 */

export const MORPH_CATEGORIES = [
  {
    id: 'base',
    label: 'Base color',
    blurb: 'Ground color of the animal before pattern, structure, or modifiers.',
  },
  {
    id: 'color',
    label: 'Color modifier',
    blurb: 'Genes that modify or remove pigment: axanthic, hypo, etc.',
  },
  {
    id: 'pattern',
    label: 'Pattern',
    blurb: 'Markings layered on the base: harlequin, pinstripe, dalmatian, flame.',
  },
  {
    id: 'structure',
    label: 'Structure',
    blurb: 'Physical modifications to scales, crest, or tail.',
  },
  {
    id: 'combo',
    label: 'Combination',
    blurb: 'Named combinations of two or more morphs with distinct visual identity.',
  },
];

export const INHERITANCE = {
  recessive: {
    id: 'recessive',
    label: 'Recessive',
    short: 'Rec',
    color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    description:
      'Two copies required for visual expression. A single copy produces a "het" (heterozygous) carrier that looks normal but can pass the gene to offspring.',
  },
  'co-dominant': {
    id: 'co-dominant',
    label: 'Co-dominant',
    short: 'Co-dom',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    description:
      'One copy is visible; two copies produce a distinct "super" form. Most hobby "codominant" morphs are technically incomplete dominant.',
  },
  'incomplete-dominant': {
    id: 'incomplete-dominant',
    label: 'Incomplete dominant',
    short: 'Inc-dom',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    description:
      'Single copy produces a visible form; two copies produce a distinct "super" form. The most common inheritance model in proven crested gecko morphs.',
  },
  dominant: {
    id: 'dominant',
    label: 'Dominant',
    short: 'Dom',
    color: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    description:
      'A single copy is sufficient for full expression. Homozygous and heterozygous animals look identical.',
  },
  polygenic: {
    id: 'polygenic',
    label: 'Polygenic',
    short: 'Poly',
    color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    description:
      'Trait controlled by many genes working additively. Cannot be Punnett-squared. Improved through selective breeding over generations.',
  },
  'line-bred': {
    id: 'line-bred',
    label: 'Line-bred',
    short: 'Line',
    color: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    description:
      'Not a single gene, a "look" maintained by repeated pairings of animals that share the trait. Expresses on a gradient.',
  },
};

export const RARITY = {
  common: {
    id: 'common',
    label: 'Common',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    order: 1,
  },
  uncommon: {
    id: 'uncommon',
    label: 'Uncommon',
    color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    order: 2,
  },
  rare: {
    id: 'rare',
    label: 'Rare',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    order: 3,
  },
  very_rare: {
    id: 'very_rare',
    label: 'Very rare',
    color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    order: 4,
  },
};

export const PRICE_TIERS = {
  $: { label: 'Entry ($50 to $150)', description: 'Affordable morphs great for first animals.' },
  $$: { label: 'Mid ($150 to $400)', description: 'Established morphs with solid market demand.' },
  $$$: { label: 'High ($400 to $1,000)', description: 'Sought-after morphs and strong combos.' },
  $$$$: { label: 'Premium ($1,000+)', description: 'Top-tier breeders, rare combos, and proven project animals.' },
};

// The full catalog. Each morph is its own object so the list is
// easy to sort, filter, and search. Add new entries at the end of
// the array, don't re-order; the UI sorts dynamically.
export const MORPHS = [
  // ---------- PATTERN MORPHS ----------
  {
    slug: 'harlequin',
    name: 'Harlequin',
    definition:
      "A Harlequin crested gecko has conspicuous light pattern on the flanks and limbs as well as the back, with irregular patches separated by areas of base color.",
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
    aliases: ['Harley', 'Harle'],
    category: 'pattern',
    inheritance: 'polygenic',
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics:
      "Traditional hobby guides describe variation in harlequin expression as polygenic. Foundation Genetics proposes an underlying pattern trait with incomplete dominant inheritance and modifying factors. These are different models; visible coverage alone does not demonstrate gene dosage.",
    rarity: 'common',
    priceTier: '$$',
    priceRange: '$120 to $400',
    summary:
      "Light pattern on the flanks and limbs, with variable dorsal coverage.",
    description:
      "Look at the sides and legs, not just the back. Harlequin pattern can form irregular islands, branching edges and larger connected patches. Coverage varies, and one animal may also show pinstripe, banding or Dalmatian spots. A small amount of lateral pattern does not create a universally agreed boundary between flame and harlequin.",
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
    history:
      'Emerged in the early 2000s as breeders selected for progressively more pattern coverage from flame-base stock.',
    combinesWith: ['dalmatian', 'cream', 'tricolor', 'pinstripe', 'lilly-white', 'axanthic'],
    notes:
      "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
    sources: [
      "https://www.pangeareptile.com/collections/harlequin",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
  },
  {
    slug: 'extreme-harlequin',
    name: 'Extreme Harlequin',
    definition:
      "An Extreme Harlequin crested gecko has extensive harlequin pattern on the flanks and limbs, often reaching above the middle of the sides; the label has no universal numerical cutoff.",
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
    aliases: ['Extreme Harley', 'EH', 'Super Harley'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$350 to $900',
    summary:
      "Extensive lateral and limb pattern, with variable interruptions and contrast.",
    description:
      "Extreme is a coverage description used within harlequin variation. The light areas may join into broad patches or remain interrupted by dark pattern. They need not form solid rectangular panels. Assess the whole animal from both sides rather than estimating a precise percentage from one photograph.",
    keyFeatures: [
      "Extensive light pattern on the flanks and limbs",
      "Pattern often reaches above the middle of the flanks",
      "Base color can interrupt even very extensive light areas"
    ],
    visualIdentifiers: [
      "Check coverage on both sides and limbs",
      "Separate coverage from brightness, lighting and firing state"
    ],
    history:
      'Came from the tightening of harlequin selection in the mid-2000s, with Hatcher\'s Cresties and AC Reptiles among the early drivers.',
    combinesWith: ['cream', 'tricolor', 'dalmatian', 'phantom-pinstripe', 'axanthic'],
    notes:
      "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
    sources: [
      "https://www.pangeareptile.com/collections/harlequin",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
  },
  {
    slug: 'pinstripe',
    name: 'Pinstripe',
    definition:
      'A Pinstripe crested gecko is a crested gecko whose raised scales along each side of the back are cream or yellow, forming two stripes that run from the neck toward the base of the tail.',
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
    aliases: ['Pin'],
    category: 'pattern',
    inheritance: 'polygenic',
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics:
      "Pinstripe completeness responds to selective breeding. Foundation Genetics proposes a dominant underlying trait with variable expression. The illustration controls visible continuity and cannot identify a heterozygous or homozygous animal.",
    rarity: 'common',
    priceTier: '$$',
    priceRange: '$120 to $350',
    summary:
      "Light coloration following the paired raised edges of the back.",
    description:
      "Pinstripe is light coloration along the paired raised scale rows bordering the dorsal field. Full pinstripe describes continuous lines; partial pinstripe has interruptions. Follow each row separately in an overhead or oblique photograph. Broad cream on the back is a different feature.",
    keyFeatures: [
      "Light scales follow the two raised crest rows",
      "Full and partial describe continuity, not body color",
      "Can coexist with harlequin pattern, banding and spots"
    ],
    visualIdentifiers: [
      "Use an overhead or oblique view to see both rows",
      "Distinguish the narrow crest rows from the broad dorsal field"
    ],
    history:
      'One of the first named polygenic traits in the hobby, recognized by the early 2000s.',
    combinesWith: ['harlequin', 'cream', 'phantom-pinstripe', 'dalmatian', 'lilly-white', 'axanthic'],
    notes:
      "Sellers sometimes estimate pinning percentages, but viewing angle and scoring conventions vary. A dark line immediately below the raised row is commonly called reverse pinstripe; it is not synonymous with Phantom.",
    sources: [
      "https://www.pangeareptile.com/collections/pinstripe",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
  },
  {
    slug: 'phantom-pinstripe',
    name: 'Phantom Pinstripe',
    definition:
      "Phantom Pinstripe is a historical visual label for pinstripe-like raised back rows with reduced cream coloration; the label alone does not establish the animal's genetics.",
    lookalikes: [
      {
        "slug": "pinstripe",
        "difference": "Visible pinstripe highlights the raised rows; cream continuity alone cannot establish Phantom status."
      }
    ],
    aliases: [
      "Phantom Pin"
    ],
    category: 'pattern',
    inheritance: 'polygenic',
    // Dual-model note (D13): the traditional label stays; the paragraph
    // below gives the Foundation Genetics reading.
    foundationGenetics:
      "Foundation Genetics and AC Reptiles describe recessive Phantom models. Do not infer a carrier or homozygous state from a dark crest row or from the older phantom-pinstripe sale label.",
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$500 to $1,500',
    summary:
      "A historical visual label that needs to be distinguished from genetic Phantom and reverse pinstripe.",
    description:
      "Usage has changed across breeders and over time. Genetic Phantom is associated with suppression of parts of the usual pattern, and should be discussed using the breeder's lineage and model. The absence of a cream pinstripe is not enough to identify it. Reverse pinstripe instead describes a dark line below the crest row; it may occur alongside a visible cream pinstripe.",
    keyFeatures: [
      "Reduced light coloration on raised dorsal rows in the historical usage",
      "Absence of cream alone is not diagnostic",
      "Reverse pinstripe is a separate visible feature"
    ],
    visualIdentifiers: [
      "Describe crest color, dorsal field and flank pattern separately",
      "Ask which definition and lineage support a Phantom label"
    ],
    history:
      "The older appearance-based term and more recent genetic usage are not interchangeable.",
    combinesWith: ['extreme-harlequin', 'tricolor', 'lilly-white', 'axanthic', 'cream'],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=54",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },
  {
    slug: 'dalmatian',
    name: 'Dalmatian',
    definition:
      "A Dalmatian crested gecko shows discrete pigmented spots, commonly black or red, which vary in size, shape and distribution and may overlap lighter pattern.",
    lookalikes: [
      {
        "slug": "super-dalmatian",
        "difference": "Super Dalmatian may describe heavy spotting or a breeder's genetic claim; there is no universal spot-count test."
      }
    ],
    aliases: ['Dal', 'Dally'],
    category: 'pattern',
    inheritance: 'polygenic',
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics:
      "Some breeders model Dalmatian as a dominant or incomplete-dominant trait and use super for a homozygous animal. Other listings use super as a visual grade. A spot count alone does not distinguish these meanings.",
    rarity: 'common',
    priceTier: '$$',
    priceRange: '$100 to $400',
    summary:
      "Discrete pigmented spots that can coexist with other patterns.",
    description:
      "Look for individual spots rather than treating every dark band or cream fleck as spotting. Spots can vary from small dots to larger irregular blotches, and may occur over both base color and light pattern. Their number, size and visibility can change with age and firing state. White portholes and other white markings are separate features.",
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
    history:
      'Long-established trait, recognized since the earliest organized breeding in the late 1990s.',
    combinesWith: ['harlequin', 'pinstripe', 'cream', 'lilly-white', 'axanthic', 'super-dalmatian'],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=67",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },
  {
    slug: 'super-dalmatian',
    name: 'Super Dalmatian',
    definition:
      "Super Dalmatian is used for heavily spotted crested geckos and, in some breeder models, for a homozygous Dalmatian; the meanings cannot be equated by counting spots.",
    lookalikes: [
      {
        "slug": "dalmatian",
        "difference": "The visual distinction is the degree of spotting; a single cutoff does not establish gene dosage."
      }
    ],
    aliases: ['Super Dal'],
    category: 'pattern',
    inheritance: 'polygenic',
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics:
      "Foundation Genetics models Dalmatian as a dominant trait with a homozygous Super Dalmatian form. In that model, inheritance predictions follow the documented genotype. They must not be applied automatically to every heavily spotted animal sold as super.",
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$300 to $800',
    summary:
      "Heavy spotting; ask whether super denotes appearance or a documented genetic claim.",
    description:
      "Describe the visible spot density, size and distribution first. Sellers use different standards for super Dalmatian, and a fixed threshold such as 100 spots is not a genetic test. Age, firing state, other traits and which parts of the animal are visible affect a count.",
    keyFeatures: [
      "Extensive or dense spotting in the visual usage",
      "Spot sizes and distribution remain variable",
      "A genetic super claim needs lineage or breeding evidence"
    ],
    visualIdentifiers: [
      "Compare multiple photographs rather than counting one side",
      "Ask how the breeder uses the term super"
    ],
    history:
      'The "super" designation came with breeders tightening selection pressure on spot count through the 2010s.',
    combinesWith: ['harlequin', 'extreme-harlequin', 'pinstripe', 'lilly-white', 'axanthic'],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=67",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },
  {
    slug: 'flame',
    name: 'Flame',
    definition:
      "A Flame crested gecko has conspicuous lighter dorsal pattern with relatively little pattern on the flanks and limbs.",
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
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$60 to $180',
    summary:
      "Dorsal pattern dominates; flank and leg pattern is limited.",
    description:
      "Flame directs attention to the patterned dorsal field. Some examples have subtle lateral or limb markings, so perfectly blank sides are not a requirement. Compare the amount and organization of flank and limb pattern when discussing flame versus harlequin.",
    keyFeatures: [
      "Light pattern is most conspicuous on the back",
      "Relatively limited lateral and limb pattern",
      "Broad dorsal pattern is distinct from a narrow pinstripe"
    ],
    visualIdentifiers: [
      "Compare the dorsal field with the flanks and legs",
      "Recognize that borderline flame and harlequin labels vary"
    ],
    history:
      'Recognized since the earliest days of the hobby. Named for the flame-like markings running along the back.',
    combinesWith: ['dalmatian', 'cream', 'pinstripe', 'lilly-white'],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/",
      "https://www.pangeareptile.com/collections/harlequin"
    ],
  },
  {
    slug: 'tiger',
    name: 'Tiger',
    definition:
      "A Tiger crested gecko shows dark transverse markings across the back that may continue down the flanks, with naturally variable spacing, width and continuity.",
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
    category: 'pattern',
    inheritance: 'polygenic',
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics:
      'The traditional hobby reading treats Tiger as a polygenic pattern style. Foundation Genetics goes further: it models tiger as a fixed dominant trait present to some degree in every crested gecko, which cannot be bred out. Under that model, the ratio of tiger to other pattern traits decides whether an animal shows subtle freckling, classic vertical tigering, or heavy brindle. Both views agree that pairing strongly tigered animals intensifies the look.',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150 to $400',
    summary:
      "Dark transverse banding with variable contrast and continuity.",
    description:
      "Follow the direction of the dark markings across the back. Real bands are not mechanically straight, identical or evenly spaced. More interrupted or reticulated patterns are often called brindle, and breeders may use tiger/brindle for overlapping appearances.",
    keyFeatures: [
      "Transverse orientation across the dorsal field",
      "Unequal band widths and irregular edges",
      "Contrast can change with firing state"
    ],
    visualIdentifiers: [
      "Use a top view for direction and a side view for continuation",
      "Do not require perfectly parallel stripes"
    ],
    history:
      'Long-established polygenic trait, recognized in breeding programs since the early 2000s.',
    combinesWith: ['brindle', 'extreme-brindle', 'red-base', 'olive', 'chocolate', 'harlequin'],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },
  {
    slug: 'brindle',
    name: 'Brindle',
    definition:
      "A Brindle crested gecko has irregular, broken or reticulated dark transverse pattern, a descriptive appearance that overlaps with tiger.",
    lookalikes: [
      {
        "slug": "tiger",
        "difference": "Tiger usually emphasizes recognizable transverse bands; both can have irregular edges and flank markings."
      }
    ],
    aliases: [],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$180 to $450',
    summary:
      'Heavier, more irregular banding than tiger, often described as "broken" or "marbled" tiger.',
    description:
      "Brindle commonly describes broken or interconnected dark banding. It is not defined only by stronger contrast or by whether markings reach the flanks. Observe direction, interruptions and branching together.",
    keyFeatures: [
      "Broken or interconnected dark markings",
      "Irregular band widths, spacing and continuity",
      "Terminology overlaps with tiger"
    ],
    visualIdentifiers: [
      "Follow branching and interruptions across the back and flanks"
    ],
    history:
      'Recognized alongside tiger as breeders noted both patterns appeared in the same lines at different expression levels.',
    combinesWith: ['tiger', 'extreme-brindle', 'red-base', 'olive', 'chocolate', 'harlequin'],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },
  {
    slug: 'extreme-brindle',
    name: 'Extreme Brindle',
    definition:
      'An Extreme Brindle crested gecko is a crested gecko whose dark brindle pattern covers most of the back and spreads onto the flanks, so the back can look almost fully dark.',
    lookalikes: [
      { slug: 'brindle', difference: 'A Brindle still shows plenty of base color between its broken bands; an Extreme Brindle\'s dark pattern takes over most of the back.' },
    ],
    aliases: [],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$400 to $1,000',
    summary:
      'Dominant, coverage-heavy brindle with dark pattern consuming most of the dorsum and flanks.',
    description:
      'Extreme brindle describes an animal where the brindle pattern covers the majority of the dorsum and often the flanks, producing a dramatic high-coverage look. Rare compared to standard brindle, extreme brindle is selectively maintained and stacks powerfully with strong base colors.',
    keyFeatures: [
      'Dark pattern covers the dorsum and extends to the flanks',
      'Pattern may appear almost fully dark over the back',
      'Often paired with vibrant base colors to maintain contrast',
    ],
    combinesWith: ['red-base', 'olive', 'chocolate', 'tiger-brindle', 'harlequin', 'dalmatian'],
  },
  {
    slug: 'tiger-brindle',
    name: 'Tiger / Brindle',
    definition:
      'A Tiger / Brindle crested gecko is a crested gecko whose dark banding sits between the two looks, mixing tiger-like parallel lines with brindle-like irregular patches.',
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
    aliases: ['T/B', 'Tiger Brindle'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150 to $400',
    summary:
      'Intermediate expression between tiger and brindle, sold as a single "T/B" category in much of the hobby.',
    description:
      'Many animals fall between pure tiger and full brindle. T/B (tiger/brindle) captures that intermediate expression. Widely used in sale listings when the pattern is banded but not purely regular.',
    keyFeatures: [
      'Banding visible but not perfectly regular',
      'Mix of tiger-like parallel lines and brindle-like irregular patches',
      'Common in most polygenic pattern lines',
    ],
    combinesWith: ['red-base', 'olive', 'chocolate', 'harlequin', 'dalmatian'],
  },

  // ---------- STRUCTURE MORPHS ----------
  {
    slug: 'soft-scale',
    name: 'Soft Scale',
    definition:
      "Soft Scale is an AC Reptiles trait associated with subtle differences in skin texture and appearance; it can be difficult to identify from photographs.",
    lookalikes: [
      {
        "slug": "super-soft-scale",
        "difference": "The super form is described as more pronounced, but visual assessment alone can be difficult."
      }
    ],
    aliases: ['SS'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$400 to $1,000',
    summary:
      "Subtle scale and texture differences requiring close comparison and lineage.",
    description:
      "AC Reptiles describes differences in scale spacing, texture and coloration, with a more conspicuous Super Soft Scale form. Ordinary photographs, eye color or a smooth-looking drawing are insufficient to establish the trait.",
    keyFeatures: [
      "Subtle scale-spacing and texture differences",
      "Expression varies with the animal and other traits",
      "Use documented lineage and close comparative photographs"
    ],
    visualIdentifiers: [
      "Compare detailed photographs with documented examples",
      "Do not infer gene dosage from apparent smoothness alone"
    ],
    history:
      "Developed by Anthony Caponetto at AC Reptiles from animals held in the early 2000s.",
    combinesWith: ['super-soft-scale', 'white-wall', 'lilly-white', 'cappuccino', 'axanthic'],
    notes:
      "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=55"
    ],
  },
  {
    slug: 'super-soft-scale',
    name: 'Super Soft Scale',
    definition:
      "Super Soft Scale is the homozygous form described in the AC Reptiles Soft Scale project, with more pronounced texture and appearance differences.",
    lookalikes: [
      {
        "slug": "soft-scale",
        "difference": "Expression overlaps in photographs; do not establish dosage from apparent smoothness."
      }
    ],
    aliases: ['SSS', 'Super SS'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,200 to $3,500',
    summary:
      "The more pronounced form in the Soft Scale breeding model.",
    description:
      "The super designation refers to the breeding model, not to a requirement for scaleless or leather-like skin. Retained scales and crest structure vary. Use documented project animals for comparison.",
    keyFeatures: [
      "More pronounced expression in the Soft Scale project",
      "Not a scaleless animal",
      "Lineage and breeding evidence support the genetic label"
    ],
    history:
      "Developed within the AC Reptiles Soft Scale project.",
    combinesWith: ['lilly-white', 'axanthic', 'cappuccino', 'white-wall'],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=55"
    ],
  },
  {
    slug: 'white-wall',
    name: 'White Wall',
    definition:
      "White Wall commonly describes extensive pale lateral pattern; breeders may also use the term within specific Whiteout or white-pattern inheritance models.",
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
    aliases: ['WW'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,500 to $4,000',
    summary:
      "Extensive pale flank pattern; terminology depends on the breeder and line.",
    description:
      "Describe the location and extent of the lateral white first. A connected flank patch is not proof of Lilly White or a universal White Wall genotype. Whiteout, white wall and white-spot terminology differs between breeding models.",
    keyFeatures: [
      "Extensive lateral white or cream pattern",
      "The term may describe appearance or a breeder-specific genetic model"
    ],
    visualIdentifiers: [
      "Examine both flanks",
      "Ask which lineage and inheritance model support the label"
    ],
    history:
      "The terminology is used across breeder projects, including AC Reptiles Whiteout work.",
    combinesWith: ['lilly-white', 'white-wall-white-spot', 'soft-scale', 'axanthic'],
    sources: [
      "https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=55",
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },
  {
    slug: 'white-wall-white-spot',
    name: 'White Wall White Spot',
    definition:
      "White Wall White Spot is used for white-pattern traits involving pale lateral patches or spots; the exact meaning depends on the breeder's terminology and lineage.",
    lookalikes: [
      {
        "slug": "white-wall",
        "difference": "Connected versus separate pale areas can help describe appearance, but does not establish genotype."
      }
    ],
    aliases: ['WWWS', 'White Spot'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,500 to $4,000',
    summary:
      "A white-pattern label whose meaning needs breeder context.",
    description:
      "Separate what is visible from a genetic claim. Record whether the pale lateral pattern forms isolated patches, connected walls or spreading markings. Similar appearances can be described differently between projects.",
    keyFeatures: [
      "Pale lateral patches or spots",
      "Label and inheritance need project-specific context"
    ],
    combinesWith: ['lilly-white', 'white-wall', 'soft-scale', 'axanthic'],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },
  {
    slug: 'cappuccino',
    name: 'Cappuccino',
    definition:
      "A Cappuccino crested gecko carries the Cappuccino trait, which can alter pattern and pigmentation across a wide range of appearances; coffee-brown color or a saddle alone is not diagnostic.",
    lookalikes: [
      {
        "slug": "frappuccino",
        "difference": "Frappuccino combines Cappuccino with Lilly White; appearance is variable and requires supporting lineage."
      }
    ],
    aliases: ['Cap', 'Cappy'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$400 to $1,200',
    summary:
      "A genetic trait with variable appearance across ages and combinations.",
    description:
      "Cappuccino appearance varies with age, base color and other traits. Breeders often inspect the pale marking at the tail base in young animals together with the overall pattern and documented lineage. There is no universal coffee-brown body or clean-edged saddle that identifies every Cappuccino.",
    keyFeatures: [
      "Variable pigmentation and pattern",
      "A pale tail-base marking can be a clue in juveniles",
      "Confirmation depends on the breeder's documented line and evidence"
    ],
    visualIdentifiers: [
      "Compare age-matched documented examples",
      "Do not identify it from brown color alone"
    ],
    history:
      "The project was developed in South Korea and later investigated through breeder collaborations, including Pangea.",
    combinesWith: ['lilly-white', 'soft-scale', 'harlequin', 'axanthic', 'dalmatian'],
    sources: [
      "https://www.pangeareptile.com/blogs/blog/cappuccino-frappuccino-melanistic"
    ],
    notes: "Two Cappuccino copies produce the melanistic form associated with serious health concerns. Avoid Cappuccino-to-Cappuccino pairings.",
  },
  {
    slug: 'frappuccino',
    name: 'Frappuccino',
    definition:
      "A Frappuccino crested gecko combines Cappuccino and Lilly White; its white coverage, pigmentation and pattern vary with age and other traits.",
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
    aliases: ['Frap'],
    category: 'combo',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,500 to $3,500',
    summary:
      "The combination of Cappuccino and Lilly White, with variable expression.",
    description:
      "Frappuccino names a combination of two traits, not a visual brightness grade or a single super form. Some examples develop conspicuous head markings or extensive white, but no one head-spot pattern or level of whiteness identifies every animal. Compare documented examples and lineage.",
    keyFeatures: [
      "Cappuccino plus Lilly White",
      "Variable white coverage and head markings",
      "Not simply an especially white Lilly White"
    ],
    combinesWith: ['soft-scale', 'harlequin', 'axanthic', 'dalmatian'],
    sources: [
      "https://www.pangeareptile.com/blogs/blog/cappuccino-frappuccino-melanistic"
    ],
  },
  {
    slug: 'lilly-white',
    name: 'Lilly White',
    definition:
      "A Lilly White crested gecko carries an incomplete-dominant trait associated with distinctive white or cream coverage, which varies with age and other traits.",
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
    aliases: ['LW', 'Lilly'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$300 to $900',
    summary:
      'Proven incomplete-dominant trait producing bold white markings, the super form is lethal.',
    description:
      "Lilly White produces variable white or cream pattern that often becomes more extensive with age. Breeders assess multiple features, including tail, flank and ventral coloration, alongside lineage. High white coverage alone is insufficient: other traits may resemble it, and low-expression or Phantom combinations can look quite different.",
    keyFeatures: [
      "Variable white or cream coverage",
      "Tail, flank and ventral features help guide comparison",
      "Two copies are associated with a lethal super form; avoid Lilly White-to-Lilly White pairings"
    ],
    visualIdentifiers: [
      "Compare multiple regions with documented, age-matched examples",
      "Use lineage to support identification"
    ],
    history:
      "The founding project was established by Nick Lumb at Lilly Exotics in the United Kingdom, beginning with an unusual hatchling in late 2010.",
    combinesWith: ['white-wall', 'soft-scale', 'cappuccino', 'axanthic', 'harlequin', 'extreme-harlequin', 'dalmatian'],
    notes:
      "The homozygous super form has been reported to die before or shortly after hatching. A Lilly White-to-non-Lilly pairing avoids producing that genotype; it cannot guarantee general offspring health.",
    sources: [
      "https://www.corchgeckos.com/lillywhite.html"
    ],
  },
  // ---------- COLOR MODIFIERS ----------
  {
    slug: 'axanthic',
    name: 'Axanthic',
    definition:
      'An Axanthic crested gecko is a crested gecko with two copies of a recessive gene that removes yellow and red pigment, so it shows only black, gray and white.',
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
    aliases: ['Axie', 'Axan'],
    category: 'color',
    inheritance: 'recessive',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,500 to $4,000',
    summary:
      'Proven recessive trait that removes yellow and red pigment, animals appear black, gray, and white.',
    description:
      "Visual axanthic crested geckos are typically gray, charcoal and pale-toned rather than strongly warm-colored. Several breeder lines exist; compatibility and carrier claims require documentation. Lighting, firing state and image processing can make a non-axanthic animal appear gray, so one photograph is not a genetic test.",
    keyFeatures: [
      "A recessive trait documented in breeder lines",
      "Typically reduced warm coloration",
      "Carrier status cannot be established by appearance"
    ],
    visualIdentifiers: [
      "Compare unfiltered photographs in neutral light",
      "Confirm lineage and compatibility before interpreting inheritance"
    ],
    history:
      "Multiple axanthic breeding projects have been developed; confirm the specific line with the breeder.",
    combinesWith: ['lilly-white', 'soft-scale', 'white-wall', 'dalmatian', 'harlequin', 'pinstripe', 'cappuccino'],
    notes:
      "Recessive inheritance predictions apply when the parents carry the same compatible trait. A gray photograph is not proof of a visual axanthic or a carrier.",
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
  },
  {
    slug: 'albino',
    name: 'Albino',
    definition:
      'An Albino crested gecko is a crested gecko with no black or brown pigment (melanin), so it has red or pink eyes and shows only its yellow, orange, red and cream colors.',
    lookalikes: [
      { slug: 'moonglow', difference: 'A pale body alone does not establish albinism; eye pigmentation and documented lineage matter.' },
      { slug: 'lilly-white', difference: 'A Lilly White has white markings but keeps dark eyes and dark pattern; an Albino has no dark pigment at all.' },
      { slug: 'axanthic', difference: 'Opposite pigments: an Albino keeps yellow and red and loses black; an Axanthic keeps black and loses yellow and red.' },
    ],
    aliases: ['Amelanistic', 'Albino crested gecko'],
    category: 'color',
    inheritance: 'recessive',
    rarity: 'very_rare',
    summary:
      'The newest crested gecko color gene: no black pigment and red eyes. The first healthy albino hatchlings were announced by Eureka Exotics in March 2026.',
    description:
      'An albino crested gecko lacks melanin, the black and brown pigment, so the animal shows only its yellow, orange, red and cream pigments, and its eyes are red or pink instead of dark. For years albino crested geckos were treated as a myth: the albino-looking hatchlings reported before 2026 were weak, deformed or did not survive, and most "albino" sales were pale animals or edited photos. That changed on 5 March 2026, when Eureka Exotics (Nicole Cullen, Newberry, Florida) announced the hatching of what appear to be the first viable albino crested geckos: babies with no visible melanin, red pupils and normal, robust health. Albinism is recessive in essentially every reptile where it has been worked out, so the crested gecko version is expected to be recessive too, but that still has to be shown by breeding the first albinos and their siblings. Until then, treat any "het albino" offer with caution.',
    keyFeatures: [
      'No black or brown pigment (melanin)',
      'Red or pink eyes instead of dark eyes',
      'Yellow, orange, red and cream pigment still show, so albinos look warm and bright',
      'First healthy hatchlings announced 5 March 2026 by Eureka Exotics',
      'Expected recessive, like albinism in other reptiles, but not yet proven by test breeding',
    ],
    visualIdentifiers: [
      'Reduced eye pigment is a clue; flash, reflections and edited photographs can mimic red pupils',
      'No dark pattern, dark dorsal or dark spots, even when fired up',
      'A pale or "white" gecko with dark eyes is not albino (see Moonglow, Lilly White and Cream)',
    ],
    history:
      'Albino-like crested geckos were reported several times before 2026, but none were healthy enough to breed. On 5 March 2026 Eureka Exotics announced the first apparently viable albino hatchlings. As of October 2026 the trait is still being worked: the next milestone is producing albino offspring from those animals, which would confirm how it is inherited.',
    combinesWith: ['axanthic', 'lilly-white', 'moonglow', 'harlequin', 'pinstripe'],
    notes:
      'Albino plus Axanthic is the combination keepers have waited for. Albino removes black pigment and Axanthic removes yellow and red, so a gecko carrying both should have almost no pigment left: a true white animal, the long-theorized Moonglow. Nobody has produced one yet, but with albinos now hatching, it remains a hypothesis until actual offspring and inheritance are documented. Be wary of any seller offering albinos, het albinos or albino combos before the founding breeder has proven the gene.',
  },
  {
    slug: 'hypo',
    name: 'Hypo (Hypomelanistic)',
    definition:
      "Hypo, or hypomelanistic, describes reduced dark pigment; breeders differ in how they apply it to crested gecko lines and inheritance models.",
    lookalikes: [
      { slug: 'albino', difference: 'Hypo only reduces black pigment and keeps dark eyes; an Albino has no black pigment at all and red or pink eyes.' },
    ],
    aliases: ['Hypomelanistic', 'Hypomelanism'],
    category: 'color',
    inheritance: 'line-bred',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$500 to $1,500',
    summary:
      'Line-bred trait reducing black pigment, warmer, brighter animals with pale bellies and reduced dark markings.',
    description:
      "A lighter animal is not automatically a proven Hypo. Assess natural firing states, age and lineage, and ask which model the breeder uses. Reduced apparent dark pigment may be a useful observation without establishing a gene.",
    keyFeatures: [
      "Reduced apparent dark pigment",
      "Firing state and lineage matter",
      "Terminology and proposed inheritance vary"
    ],
    combinesWith: ['red-base', 'orange-base', 'yellow-base', 'harlequin', 'lilly-white', 'dalmatian'],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },
  {
    slug: 'patternless',
    name: 'Patternless',
    definition:
      'A Patternless crested gecko is a crested gecko with one solid base color and no visible pattern, named after that color (for example red patternless or olive patternless).',
    lookalikes: [
      { slug: 'bicolor', difference: 'A Bicolor shows two distinct colors with a clear boundary; a Patternless is one solid color with no pattern.' },
    ],
    aliases: ['Solid'],
    category: 'color',
    inheritance: 'line-bred',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$50 to $150',
    summary:
      'Line-bred trait for solid-colored animals with no discernible pattern, often the base for breeding projects.',
    description:
      'Patternless crested geckos lack visible markings and display a single solid base color. The trait is line-bred rather than a single gene, and patternless animals are often used as the base color foundation for high-contrast pattern projects. Common patternless bases include red, orange, olive, yellow, and chocolate.',
    keyFeatures: [
      'No visible pattern on the body, solid base color',
      'Base color determines the animal\'s name (red patternless, olive patternless, etc.)',
      'Line-bred trait, stacks with any color but cannot be Punnett-squared',
      'Foundation stock for many high-contrast pattern breeding projects',
    ],
    combinesWith: ['red-base', 'orange-base', 'yellow-base', 'olive', 'chocolate', 'lilly-white', 'axanthic'],
  },
  {
    slug: 'moonglow',
    name: 'Moonglow',
    definition:
      "Moonglow is a disputed name associated with the goal of a persistently white crested gecko, not a reliably identifiable visual morph or confirmed genotype.",
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
    aliases: ['True Moonglow'],
    category: 'color',
    inheritance: 'line-bred',
    rarity: 'very_rare',
    priceTier: '$$$',
    priceRange: "No reliable price standard for this disputed label",
    summary:
      "A disputed label and breeding goal, not a visual diagnosis.",
    description:
      "Very pale fired-down animals, lighting and image editing can create an apparently white gecko. A near-white photograph should not be presented as proof of a stable all-white morph. Proposed combinations intended to remove pigment are hypotheses until documented in actual animals.",
    keyFeatures: [
      "No reliable visual identification standard",
      "Firing state and lighting can strongly affect apparent whiteness",
      "Speculative combinations must be distinguished from observed animals"
    ],
    visualIdentifiers: [
      "Compare neutral-light photographs in different natural firing states",
      "Ask for documented evidence rather than an edited white image"
    ],
    history:
      "The name has long circulated around the idea of an all-white crested gecko.",
    combinesWith: ['albino', 'axanthic', 'cream', 'white-wall', 'lilly-white'],
    notes:
      "Do not assign Moonglow from a pale photograph or use the name as proof of genetics.",
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
  },
  {
    slug: 'translucent',
    name: 'Translucent',
    definition:
      "Translucent describes visible translucency of skin, which alone does not establish a distinct crested gecko morph or inheritance model.",
    aliases: ['Trans'],
    category: 'color',
    inheritance: 'line-bred',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$400 to $1,200',
    summary:
      "An appearance description requiring context, not a diagnosis from a photograph.",
    description:
      "Thin juvenile skin and the ventral region can appear translucent. That observation should not be used by itself to identify a genetic trait. Compare age-matched animals and the breeder's supporting evidence.",
    keyFeatures: [
      "Visible translucency, often most evident ventrally",
      "Age and lighting affect the observation",
      "Inheritance cannot be inferred from translucency alone"
    ],
    combinesWith: ['axanthic', 'lilly-white', 'cream', 'harlequin'],
    sources: [
      "https://lmreptiles.com/fg-pt2-1/"
    ],
    notes: "This is a visible-feature description. A sale label or photograph alone does not establish genotype. Breeders use some names and inheritance models differently.",
  },

  // ---------- BASE COLORS ----------
  {
    slug: 'red-base',
    name: 'Red Base',
    definition:
      "A Red Base crested gecko has red-dominant ground coloration, whose saturation varies with firing state, age and lighting.",
    lookalikes: [
      {
        "slug": "orange-base",
        "difference": "Red and orange descriptions overlap at intermediate hues; lighting and firing state matter."
      }
    ],
    aliases: ['Red'],
    category: 'base',
    inheritance: 'polygenic',
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics:
      'Base color is traditionally described as polygenic: reds deepen across generations of selective pairing. Foundation Genetics instead treats Red Base as a suspected recessive gene: two copies produce strong red tones, and single-copy carriers often show a pink cheek blush as a het marker. If the recessive model holds, two non-red animals with blushed cheeks can produce visual reds, which the purely polygenic model would not predict.',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$180 to $450',
    summary:
      'Polygenic base color showing true red tones, distinct from red dalmatian or rose-brown animals.',
    description:
      "Red, orange-red and rust tones form a visual range. Describe the base separately from cream pattern and red Dalmatian spots. Compare neutral-light images in more than one natural firing state.",
    keyFeatures: [
      "Red-dominant ground color",
      "Firing state affects saturation",
      "Separate base color from pattern color"
    ],
    combinesWith: ['harlequin', 'extreme-harlequin', 'dalmatian', 'pinstripe', 'tricolor'],
  },
  {
    slug: 'orange-base',
    name: 'Orange Base',
    definition:
      'An Orange Base crested gecko is a crested gecko whose ground color is a vivid, warm orange.',
    lookalikes: [
      {
        "slug": "red-base",
        "difference": "Red and orange form a range; compare neutral-light images rather than imposing a rigid color boundary."
      }
    ],
    aliases: ['Orange'],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150 to $350',
    summary:
      'Polygenic base color in warm orange tones, common and widely produced.',
    description:
      'Orange base is a common polygenic base color selected for warm orange tones. Distinct from red base by hue; a good orange shows vivid citrus or pumpkin tones rather than rust or brick.',
    keyFeatures: [
      'Vivid warm orange base color',
      'One of the most widely produced base colors',
      'Strong canvas for harlequin, dalmatian, and pinstripe patterns',
    ],
    combinesWith: ['harlequin', 'dalmatian', 'pinstripe', 'flame', 'cream'],
  },
  {
    slug: 'yellow-base',
    name: 'Yellow Base',
    definition:
      'A Yellow Base crested gecko is a crested gecko whose ground color is a bright, saturated yellow.',
    aliases: ['Yellow'],
    category: 'base',
    inheritance: 'polygenic',
    // Dual-model note: the 'inheritance' field keeps the traditional
    // hobby label (and the hub URL grouping); foundationGenetics explains
    // the Foundation Genetics single-locus model alongside it.
    foundationGenetics:
      'Traditionally lumped in with polygenic base color. Foundation Genetics models Yellow Base as a dominant, naturally hypo-melanistic base that serves as the substrate for combos like Cream and Buckskin. In practice both readings converge: yellow-based animals readily produce yellow-based offspring, and the depth of the yellow still responds to selective pairing.',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$80 to $200',
    summary:
      'Polygenic base color with bright yellow ground color, common and beginner-friendly.',
    description:
      'Yellow base describes animals whose ground color is solidly yellow. One of the most common base colors. Strong yellow base animals display saturated, pure yellow rather than a muted or olive tone.',
    keyFeatures: [
      'Bright, saturated yellow ground color',
      'Common and widely available',
      'Works as canvas for most pattern types',
    ],
    combinesWith: ['harlequin', 'flame', 'dalmatian', 'pinstripe'],
  },
  {
    slug: 'olive',
    name: 'Olive',
    definition:
      'An Olive crested gecko is a crested gecko whose ground color is an olive-green or khaki tone that holds when fired up.',
    aliases: [],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150 to $400',
    summary:
      'Polygenic base color producing a distinctive olive-green or khaki tone.',
    description:
      'Olive is a striking base color that produces a green-yellow or khaki tone. Selectively bred to hold that unique color across generations. Often combined with tiger or brindle for a bold, earthy look.',
    keyFeatures: [
      'Olive-green or khaki base color',
      'Unusual hue that holds when fired up',
      'Popular with keepers seeking less-common base colors',
    ],
    combinesWith: ['tiger', 'brindle', 'dalmatian', 'harlequin', 'pinstripe'],
  },
  {
    slug: 'chocolate',
    name: 'Chocolate',
    definition:
      "A Chocolate crested gecko has deep brown ground coloration, often most apparent when fired up.",
    lookalikes: [
      { slug: 'buckskin', difference: 'A Buckskin is a lighter warm tan or leather color; a Chocolate is a deep, rich brown.' },
    ],
    aliases: [],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150 to $400',
    summary:
      'Polygenic base color with rich deep-brown tones, like dark chocolate.',
    description:
      "Chocolate is a descriptive base-color term. An animal can become lighter when fired down; retaining a fixed deep brown is not a requirement.",
    keyFeatures: [
      "Deep brown base coloration",
      "Color can lighten in a fired-down state",
      "Can coexist with cream pattern and spotting"
    ],
    combinesWith: ['harlequin', 'cream', 'dalmatian', 'tiger', 'brindle'],
  },
  {
    slug: 'lavender',
    name: 'Lavender',
    definition:
      'A Lavender crested gecko is a crested gecko whose ground color is an unusual purple-gray, seen most clearly when it is fired down.',
    lookalikes: [
      { slug: 'axanthic', difference: 'An Axanthic has no yellow, red or cream at all; a Lavender\'s purple-gray base can still carry warm pattern.' },
    ],
    aliases: [],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$400 to $1,000',
    summary:
      'Polygenic base color showing an unusual purple-gray tone, rare and sought-after.',
    description:
      'Lavender is a sought-after polygenic base color showing a distinct purple-gray tone. Expression is strongest when fired down, fired-up lavenders often look more standard brown. Considered challenging to maintain across generations.',
    keyFeatures: [
      'Unusual purple-gray base color, most visible fired down',
      'Challenging to maintain across generations',
      'Often paired with extreme harlequin for high-end visual impact',
    ],
    combinesWith: ['harlequin', 'extreme-harlequin', 'cream', 'dalmatian', 'pinstripe'],
  },
  {
    slug: 'buckskin',
    name: 'Buckskin',
    definition:
      'A Buckskin crested gecko is a crested gecko whose ground color is a warm tan or leather brown.',
    lookalikes: [
      { slug: 'chocolate', difference: 'Chocolate describes a deeper brown base; both appearances can lighten when fired down.' },
    ],
    aliases: [],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$60 to $180',
    summary:
      'Warm tan or leather-colored base, a classic "starter" color with pleasant earthy tones.',
    description:
      'Buckskin describes a warm tan, leather-like base color. One of the more common base colors and often produced in pet-quality lines. Excellent canvas for moderate pattern and many find the warm tone visually appealing even without heavy pattern.',
    keyFeatures: [
      'Warm tan or leather base color',
      'Common and beginner-friendly',
      'Works well as a base for a variety of patterns',
    ],
    combinesWith: ['harlequin', 'flame', 'dalmatian', 'pinstripe'],
  },

  // ---------- COMBINATION MORPHS ----------
  {
    slug: 'cream',
    name: 'Cream',
    definition:
      'A Cream crested gecko is a crested gecko whose pattern areas, usually harlequin or pinstripe, are cream or off-white instead of yellow or orange.',
    lookalikes: [
      { slug: 'lilly-white', difference: 'Cream is the color of a Harlequin or Pinstripe\'s pattern; a Lilly White\'s white markings are structural and stay white when fired down.' },
    ],
    aliases: [],
    category: 'combo',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150 to $450',
    summary:
      'Cream color applied to harlequin or pinstripe pattern, bright, clean, and highly sought after.',
    description:
      'Cream describes animals whose pattern areas are cream-colored rather than yellow or orange. Usually applied as a descriptor stacked on harlequin or pinstripe (cream harlequin, cream pinstripe). Cream is the "vanilla" of pattern colors, bright, pure, and highly valued when it is clean and saturated.',
    keyFeatures: [
      'Pattern areas are cream/off-white instead of yellow or orange',
      'Usually combined with harlequin or pinstripe for maximum impact',
      'Quality judged by purity and consistency of the cream',
    ],
    combinesWith: ['harlequin', 'extreme-harlequin', 'pinstripe', 'tricolor'],
  },
  {
    slug: 'tricolor',
    name: 'Tricolor',
    definition:
      'A Tricolor crested gecko shows three distinguishable colors, often a base color and two pattern colors; breeders vary in how much of each they require.',
    lookalikes: [
      { slug: 'harlequin', difference: 'Tricolor describes distinguishable colors and can coexist with harlequin pattern; equal thirds are not a universal requirement.' },
      { slug: 'bicolor', difference: 'Bicolor emphasizes a contrasting dorsal region; tricolor describes three distinguishable colors.' },
    ],
    aliases: ['Tri', 'Tri-color'],
    category: 'combo',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$300 to $800',
    summary:
      'Three distinguishable colors, often on a harlequin pattern; visual grading varies.',
    description:
      'Tricolor is named for its colors. A tricolor shows three distinguishable colors: the base color plus two pattern colors. Common sets are red, orange or yellow, and cream or white, or a dark base (black, brown or lavender) with orange or yellow and cream or white. Most tricolors are Harlequins or Extreme Harlequins; some are Pinstripes, and breeders often list both, as in "Tricolor Harlequin". It is one of the most common morphs on the market and is sold as a morph in its own right. Some breeders prefer evenly balanced colors, but that is a grading preference rather than a universal biological threshold. It is polygenic, so there is no single gene to test for.',
    keyFeatures: [
      'Three distinguishable colors, without a universal equal-coverage rule',
      'Rides on a pattern, most often Harlequin, sometimes Pinstripe',
      'Most striking in fully fired-up state',
    ],
    combinesWith: ['harlequin', 'extreme-harlequin', 'lilly-white', 'dalmatian', 'pinstripe'],
  },
  {
    slug: 'bicolor',
    name: 'Bicolor',
    definition:
      'A Bicolor crested gecko is a crested gecko with two clearly contrasting colors, usually its base color on the flanks and belly and a brighter color on the back.',
    lookalikes: [
      { slug: 'patternless', difference: 'A Patternless is a single solid color; a Bicolor has a second, brighter color on the back.' },
      { slug: 'flame', difference: 'A Flame has lighter pattern markings on the back; a Bicolor\'s back is a second solid color.' },
    ],
    aliases: ['Bi-color'],
    category: 'combo',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$80 to $200',
    summary:
      'Animal with two clear contrasting colors, typically a base plus one pattern color.',
    description:
      'Bicolor describes animals with two clearly distinct colors, usually a solid base and a contrasting dorsal pattern color, without the third accent color required for tricolor. A clean line between the two colors along the lateral line is the hallmark.',
    keyFeatures: [
      'Two clearly distinct colors with a defined boundary',
      'Typically base color on flanks/belly and a brighter color on the dorsum',
      'Common and often marketed as a classic look',
    ],
    combinesWith: ['harlequin', 'flame', 'pinstripe', 'dalmatian'],
  },
];

/* ---------- helpers ---------- */

export function getMorph(slug) {
  return MORPHS.find((m) => m.slug === slug) || null;
}

export function morphsByCategory(categoryId) {
  return MORPHS.filter((m) => m.category === categoryId);
}

export function morphsByInheritance(inheritanceId) {
  return MORPHS.filter((m) => m.inheritance === inheritanceId);
}

export function searchMorphs(query) {
  const q = query.trim().toLowerCase();
  if (!q) return MORPHS;
  return MORPHS.filter((m) => {
    if (m.name.toLowerCase().includes(q)) return true;
    if (m.aliases?.some((a) => a.toLowerCase().includes(q))) return true;
    if (m.summary?.toLowerCase().includes(q)) return true;
    if (m.description?.toLowerCase().includes(q)) return true;
    if (m.keyFeatures?.some((f) => f.toLowerCase().includes(q))) return true;
    return false;
  });
}
