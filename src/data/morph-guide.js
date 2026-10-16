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
 *   doNotBreed: 'lethal',                 // optional, super forms breeders avoid making on
 *                                         // purpose: 'lethal' or 'health'. The page then shows
 *                                         // no breed, price or value prompts (src/lib/morphNotBred.js)
 *   safePairing: {                        // with doNotBreed: the pairing to use instead
 *     label: 'Lilly White x Normal',
 *     text: 'one sentence on why it is safe',
 *     pairing: 'lilly-white-x-normal',    // a /calculator/pairing page, or null
 *   },
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
      },
      {
        "slug": "phantom",
        "difference": "Phantom is the recessive gene; Phantom Pinstripe is an appearance label and does not prove the animal carries it."
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
      },
      {
        "slug": "whiteout",
        "difference": "Whiteout is the gene AC Reptiles reports behind this look; Geck Inspect reads a White Wall tag as Whiteout, but the look alone does not prove it."
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
      },
      {
        "slug": "sable",
        "difference": "Sable is a different version of the same gene; Cappuccino x Sable makes a Luwak, not a super."
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
      "Cappuccino appearance varies with age, base color and other traits. Breeders often inspect the pale marking at the tail base in young animals together with the overall pattern and documented lineage. There is no universal coffee-brown body or clean-edged saddle that identifies every Cappuccino. Two copies make a Super Cappuccino, which usually hatches but has documented health problems, including narrowed nostrils, so breeders pair a Cappuccino to a normal or a Sable instead of another Cappuccino.",
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
    combinesWith: ['lilly-white', 'sable', 'highway', 'soft-scale', 'harlequin', 'axanthic', 'dalmatian'],
    sources: [
      "https://www.pangeareptile.com/blogs/blog/cappuccino-frappuccino-melanistic"
    ],
    notes: "Two Cappuccino copies produce the melanistic form associated with serious health concerns. Avoid Cappuccino-to-Cappuccino pairings.",
  },
  {
    slug: 'sable',
    name: 'Sable',
    definition:
      "A Sable crested gecko carries one copy of an incomplete-dominant trait that gives darker, saturated chocolate tones with reduced pattern, and it sits on the same gene as Cappuccino.",
    lookalikes: [
      {
        "slug": "cappuccino",
        "difference": "Cappuccino and Sable are different versions of the same gene; a dark brown animal needs lineage to say which one it carries."
      },
      {
        "slug": "chocolate",
        "difference": "Chocolate is a base color description; Sable is a proven gene and stays notably dark even when fired down."
      }
    ],
    aliases: [],
    category: 'color',
    inheritance: 'incomplete-dominant',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$550 to $1,200',
    summary:
      "Incomplete-dominant trait with darker, saturated tones and reduced pattern. Same gene as Cappuccino.",
    description:
      "One copy makes a visual Sable and two copies make a Super Sable, so there is no hidden het. Sable sits on the same gene as Cappuccino and Highway. A Cappuccino x Sable pairing produces Luwak (one copy of each), which can never be a super. Lighting, fired state and image processing can make any gecko look dark, so photos alone do not prove Sable.",
    keyFeatures: [
      "Darker, saturated chocolate tones",
      "Reduced pattern compared with non-Sable siblings",
      "Stays notably dark even when fired down",
      "No hidden het: one copy is visible"
    ],
    visualIdentifiers: [
      "Compare fired-down photos with non-Sable siblings",
      "Confirm with documented lineage, since many dark geckos get labeled Sable"
    ],
    history:
      "Founded in the Rialto line at Gecko Haven: Pinch x Mokolii, two unrelated geckos from Gorgeous Gecko in Texas, hatched Rialto, the first known Sable.",
    combinesWith: ['cappuccino', 'highway', 'lilly-white', 'axanthic', 'extreme-harlequin'],
    sources: [
      "https://www.morphmarket.com/morphpedia/crested-geckos/sable/"
    ],
    notes: "Super Sable appears viable. Cappuccino x Sable (Luwak) is the safe way to combine the two, since it can never make a Super Cappuccino.",
  },
  {
    slug: 'highway',
    name: 'Highway',
    definition:
      "A Highway crested gecko carries one copy of an incomplete-dominant trait associated with a continuous, clean dorsal stripe, provisionally placed on the same gene as Cappuccino and Sable.",
    lookalikes: [
      {
        "slug": "cappuccino",
        "difference": "Cappuccino and Highway are thought to be versions of the same gene; a clean-backed animal needs lineage to say which one it carries."
      },
      {
        "slug": "patternless",
        "difference": "Line-bred patternless animals can show a clean back with no Highway gene at all."
      },
      {
        "slug": "phantom-pinstripe",
        "difference": "A Phantom Pinstripe also reads as a quiet, unbroken back; Phantom is recessive and only lineage separates the two."
      }
    ],
    aliases: [],
    category: 'pattern',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    summary:
      "Incomplete-dominant trait with a continuous, clean dorsal stripe. Provisionally the third version of the Cappuccino and Sable gene.",
    description:
      "One copy makes a visual Highway and two copies make a Super Highway. Highway is treated, provisionally, as the third version of the Cappuccino and Sable gene. That rests mainly on breeder reports of nostril and health problems in Super Highway hatchlings like Super Cappuccino's; those reports are not established, and the community has not settled the placement, so it is still badged Emerging. A gecko holds two versions of the gene at most, so it can be Cappuccino plus Highway or Sable plus Highway. A clean, unbroken back also comes from Empty Back, Phantom and line-bred patternless animals, so a photo alone does not prove Highway.",
    keyFeatures: [
      "Continuous, unbroken dorsal stripe",
      "Clean sides",
      "One copy is visible: no hidden het"
    ],
    visualIdentifiers: [
      "Look for an unbroken stripe from head to tail base",
      "Confirm with documented lineage, since several genes and line-bred looks give a clean back"
    ],
    combinesWith: ['cappuccino', 'sable', 'lilly-white', 'axanthic'],
    notes: "Avoid Highway x Highway: some breeders report nostril and health problems in Super Highway hatchlings. That is not established, but it is reason enough to pair Highway to a normal, or to a Cappuccino or Sable for a compound with no super.",
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
      "Lilly White produces variable white or cream pattern that often becomes more extensive with age. Breeders assess multiple features, including tail, flank and ventral coloration, alongside lineage. High white coverage alone is insufficient: other traits may resemble it, and low-expression or Phantom combinations can look quite different. Two copies make a Super Lilly White, which is lethal: embryos die in the egg or within days of hatching, so breeders pair a Lilly White to a gecko without Lilly White.",
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
      'An albino crested gecko lacks melanin, the black and brown pigment, so the animal shows only its yellow, orange, red and cream pigments, and its eyes are red or pink instead of dark. For years albino crested geckos were treated as a myth: the albino-looking hatchlings reported before 2026 were weak, deformed or did not survive, and most "albino" sales were pale animals or edited photos. That changed on 5 March 2026, when Eureka Exotics announced the hatching of what appear to be the first viable albino crested geckos: babies with no visible melanin, red pupils and normal, robust health. Albinism is recessive in essentially every reptile where it has been worked out, so the crested gecko version is expected to be recessive too, but that still has to be shown by breeding the first albinos and their siblings. Until then, treat any "het albino" offer with caution.',
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
    slug: 'pied',
    name: 'Pied',
    definition:
      'A Pied (Piebald) crested gecko shows sharply bordered patches of unpigmented white or pale pinkish-white scales interrupting normal body pigment and pattern.',
    lookalikes: [
      {
        slug: 'lilly-white',
        difference: 'Lilly White creates symmetrical white dorsal saddles, crest rows and lower flank walls, whereas Pied produces random, sharply bordered unpigmented patches that cut across normal pattern and toes.',
      },
      {
        slug: 'white-wall',
        difference: 'White Wall is a structured lateral cream-white bar along the lower flank, not an unpigmented piebald interruption.',
      },
      {
        slug: 'extreme-harlequin',
        difference: 'Extreme Harlequin covers the flanks and limbs in cream or orange pattern pigment rather than patches of unpigmented white skin.',
      },
    ],
    aliases: ['Piebald', 'Pied Crested Gecko', 'Pinktoe'],
    category: 'color',
    inheritance: 'recessive',
    rarity: 'very_rare',
    priceTier: '$$$$',
    priceRange: '$2,000 to $6,000',
    summary:
      'Rare piebald phenotype showing sharply demarcated patches of unpigmented white and translucent pinkish-ivory scales alongside normally pigmented areas.',
    description:
      'A Pied (or Piebald) crested gecko displays localized, sharply bordered areas where skin and scale pigment are completely absent, leaving pure chalk-white or translucent pale pinkish-ivory patches that abruptly cut across the animal\'s normal base color and pattern. Expression ranges from low-expression "pinktoe" or pied-toe animals (unpigmented white toes and distal feet) to high-expression specimens with bold piebald saddles, limb bands and tail rings alongside normal dark-veined eyes. While isolated piebald-like anomalies (such as Pangea Reptile\'s historical "Patient Zero") failed to reproduce predictably, dedicated multi-generation projects led by breeders such as Eureka Exotics have established heritable Pied and Pinktoe lines. Because minor random white toe tips can also appear as non-heritable developmental flukes, always verify documented multi-generation lineage before treating a specimen or "het Pied" claim as proven.',
    keyFeatures: [
      'Sharply demarcated patches of unpigmented pure white and translucent pinkish-ivory skin',
      'Abruptly interrupts normal dorsal, lateral, limb or tail pattern rather than following standard Harlequin or Lilly White zones',
      'Distal limb and toe depigmentation ("pied toes" or "pinktoe") is a frequent hallmark',
      'Normal dark-veined iris pigmentation, unlike amelanistic Albino eyes',
      'Lineage verification is essential to separate heritable Pied lines from isolated paradox or developmental white spots',
    ],
    visualIdentifiers: [
      'Look for razor-sharp borders where normal dark or warm pigment stops and unpigmented white or pinkish-white skin begins',
      'Inspect the toes, feet and tail for translucent pinkish-white depigmented segments',
      'Confirm documented parent-to-offspring lineage from an established Pied breeding line',
    ],
    history:
      'Early one-off piebald anomalies such as Pangea Reptile\'s "Patient Zero" drew intense hobby interest but did not establish a reproducible line. Subsequent multi-generation breeding by Eureka Exotics and collaborating keepers isolated reproducible Pied and Pinktoe lines.',
    combinesWith: ['lilly-white', 'axanthic', 'harlequin', 'pinstripe', 'phantom-pinstripe'],
    notes:
      'Distinguish true heritable Pied lines from isolated white toe scales or paradox blotches, which can occur sporadically without passing to offspring. Always request multi-generation pairing records when evaluating Pied or het Pied offerings.',
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

  // ---------- GENES AND SUPER FORMS (added October 2026) ----------
  // The calculator already modeled these, but the guide had no page for
  // them (comprehensive review, B7 finding 5). Each states how sure the
  // hobby is: proven, reported by one main source (badged Emerging in the
  // calculator), or reported but not established. Facts come from the
  // genetics engine's trait data and the sources listed; no breeder
  // history is added that a source does not give. Prices are left out:
  // there is no index data behind them, and the lethal and health-risk
  // supers should not carry a price at all.
  {
    slug: 'phantom',
    name: 'Phantom',
    definition:
      'A Phantom crested gecko has two copies of the recessive Phantom gene, which mutes pattern color and darkens the animal; a gecko with one copy (a het) looks normal.',
    lookalikes: [
      { slug: 'phantom-pinstripe', difference: 'Phantom Pinstripe is an older visual label for crest rows without cream; the label alone does not prove the Phantom gene.' },
      { slug: 'highway', difference: 'Highway also leaves a clean back, but one copy shows; Phantom needs two, so lineage separates them.' },
      { slug: 'patternless', difference: 'Line-bred patternless animals can look the same without carrying Phantom at all.' },
    ],
    aliases: ['Phantom gene', 'Visual Phantom'],
    category: 'color',
    inheritance: 'recessive',
    rarity: 'uncommon',
    summary:
      'Recessive gene that mutes pattern color and darkens the animal. Hets look normal. Treated as proven within documented lines.',
    description:
      'Phantom is recessive: a gecko needs two copies to show it, and a het Phantom looks like any other gecko. Foundation Genetics (LM Reptiles) and AC Reptiles both describe it as a simple recessive, and the Geck Inspect calculator treats it as proven. In the Foundation Genetics description it adds dark pigment and suppresses pattern, but its hold weakens near the tail base and on the sides, which is why pinstripes and lateral white can still show through. What a Phantom looks like depends on everything else it carries, so Phantoms can read as bicolor, patternless, buckskin, charcoal or cream animals. Because it hides in hets, Phantom explains many surprise quiet-backed hatchlings from two normal-looking parents.',
    keyFeatures: [
      'Recessive: two copies to show, and hets look normal',
      'Mutes pattern color and darkens the base',
      'Pinstripe and lateral white can still show near the tail base and on the sides',
    ],
    visualIdentifiers: [
      'Look for muted pattern with base color showing through on the head and neck',
      'Confirm with lineage: two visual Phantom parents, or parents proven het by earlier clutches',
      'Do not read het status from a darker back or a head pattern; both are unreliable',
    ],
    history:
      'The name began as part of the visual label Phantom Pinstripe. AC Reptiles and Foundation Genetics later described Phantom as a recessive gene, and the two uses are not interchangeable.',
    combinesWith: ['phantom-pinstripe', 'lilly-white', 'frappuccino', 'axanthic', 'harlequin'],
    notes:
      'Recessive math: Phantom x Phantom gives all Phantoms; Phantom x het gives 50% Phantom and 50% het; het x het gives 25% Phantom, 50% het and 25% normal, and a normal-looking baby from that pairing has a 66% chance of being het. In Geck Inspect a bare Phantom tag means a visual Phantom.',
    sources: [
      'https://lmreptiles.com/fg-findingphantom/',
      'https://lmreptiles.com/fg-pt2-1/',
      'https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=54',
    ],
  },
  {
    slug: 'empty-back',
    name: 'Empty Back',
    definition:
      'An Empty Back crested gecko has a clean, unpatterned back with its pattern on the sides; Foundation Genetics models Empty Back as an incomplete-dominant gene.',
    lookalikes: [
      { slug: 'highway', difference: 'Highway gives a continuous clean stripe and is provisionally a version of the Cappuccino gene; lineage separates the two.' },
      { slug: 'phantom', difference: 'Phantom is recessive and mutes pattern color all over; Empty Back clears the back and leaves the sides patterned.' },
      { slug: 'patternless', difference: 'Line-bred patternless animals can have a clean back with no Empty Back gene.' },
    ],
    aliases: [],
    category: 'pattern',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    summary:
      'Clean back, pattern kept on the sides. Reported as incomplete dominant by Foundation Genetics; not yet independently proven.',
    description:
      'Empty Back describes a gecko whose back is clear of pattern while the sides keep theirs, often with stronger contrast on the flanks. Foundation Genetics models it as an incomplete-dominant gene: one copy clears the back and two copies (Super Empty Back) clear it further, and the super form is described as healthy. That model is the main published source, and few breeders publish their own Empty Back breeding results, so Geck Inspect badges it Emerging: reported, not yet independently proven. A clean back also comes from Highway, Phantom and line-bred patternless animals, so a photo alone does not prove Empty Back.',
    keyFeatures: [
      'Clean, unpatterned back',
      'Pattern concentrated on the sides',
      'One copy is visible in the Foundation Genetics model, so there is no hidden het',
    ],
    visualIdentifiers: [
      'Compare the back with the sides: Empty Back clears the back, not the whole animal',
      'Confirm with lineage, since Highway, Phantom and line-bred animals can look the same',
    ],
    combinesWith: ['lilly-white', 'dalmatian', 'axanthic'],
    notes:
      'Foundation Genetics lists Harlequin as working against the clear back. In that model Empty Back x Empty Back gives about 25% Super Empty Back, 50% Empty Back and 25% normal.',
    sources: [
      'https://lmreptiles.com/fg-pt2-1/',
    ],
  },
  {
    slug: 'super-empty-back',
    name: 'Super Empty Back',
    definition:
      'Super Empty Back is the two-copy form of Empty Back in the Foundation Genetics model, with the back cleared further than in a single-copy Empty Back.',
    lookalikes: [
      { slug: 'empty-back', difference: 'A single copy also clears the back; telling one copy from two by eye is unreliable, so use the parents.' },
    ],
    aliases: [],
    category: 'pattern',
    inheritance: 'incomplete-dominant',
    rarity: 'very_rare',
    summary:
      'Two copies of Empty Back. Described as healthy in the Foundation Genetics model; thinly documented.',
    description:
      'In the Foundation Genetics model, two copies of Empty Back suppress the back pattern further and often sharpen the contrast on the sides. The model describes the super form as healthy and freely breedable, unlike Super Lilly White or Super Cappuccino. Published breeding records are still thin, so treat a Super Empty Back label as a lineage claim: it needs two Empty Back parents and, ideally, test breeding.',
    keyFeatures: [
      'Two copies of Empty Back',
      'Back cleared further, sides often higher contrast',
      'Described as healthy, with no reported super-form problems',
    ],
    visualIdentifiers: [
      'Needs two Empty Back parents',
      'Bred to a normal, every baby should be an Empty Back, which is the cleanest proof',
    ],
    combinesWith: ['lilly-white', 'dalmatian'],
    sources: [
      'https://lmreptiles.com/fg-pt2-1/',
    ],
  },
  {
    slug: 'whiteout',
    name: 'Whiteout',
    definition:
      'A Whiteout crested gecko carries the Whiteout trait documented by AC Reptiles, reported as incomplete dominant, which adds white along the sides and back.',
    lookalikes: [
      { slug: 'white-wall', difference: 'White Wall is the visual label for this kind of lateral white; Geck Inspect reads a White Wall tag as Whiteout, but a photo alone does not prove the gene.' },
      { slug: 'lilly-white', difference: 'Lilly White is a different gene with a lethal super form; white on the sides alone does not tell them apart.' },
    ],
    aliases: [],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    summary:
      'White gene reported as incomplete dominant by AC Reptiles, whose records are the main documentation. Not yet independently proven.',
    description:
      'Whiteout adds white expression along the flanks and back. AC Reptiles reports it as incomplete dominant, on a different gene from Lilly White, with a Super Whiteout that is healthy and freely breedable. That would make Whiteout a way to stack white without risking Lilly White\'s lethal two-copy form. AC Reptiles\' own breeding records are the main documentation, and much of the hobby still treats white walling as line-bred, so Geck Inspect badges Whiteout Emerging: reported, not independently proven. When the genetics calculator reads a collection, a White Wall tag counts as Whiteout.',
    keyFeatures: [
      'White expression on the sides and back',
      'Reported incomplete dominant, so one copy is visible',
      'A separate gene from Lilly White',
    ],
    visualIdentifiers: [
      'Check both flanks and the back',
      'Ask for the AC Reptiles lineage behind a Whiteout label; lateral white alone is not proof',
    ],
    history:
      'Documented by AC Reptiles (Anthony Caponetto), whose Whiteout page is the main source.',
    combinesWith: ['lilly-white', 'soft-scale', 'axanthic'],
    notes:
      'Whiteout x Lilly White cannot make a lethal super, because they are separate genes in this model. A Lilly White Whiteout still carries one Lilly White copy, so never pair it to another Lilly White.',
    sources: [
      'https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=44',
    ],
  },
  {
    slug: 'super-whiteout',
    name: 'Super Whiteout',
    definition:
      'Super Whiteout is the two-copy form of the Whiteout trait documented by AC Reptiles, described as healthy, with more white than a single-copy Whiteout.',
    lookalikes: [
      { slug: 'whiteout', difference: 'One copy also shows white; telling one copy from two by eye is unreliable.' },
      { slug: 'super-lilly-white', difference: 'Super Lilly White is lethal and never reaches adulthood; Super Whiteout is described as healthy and is a different gene.' },
    ],
    aliases: ['Super White Wall'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'very_rare',
    summary:
      'Two copies of Whiteout. AC Reptiles describes it as healthy and breedable; independent records are thin.',
    description:
      'Two copies of Whiteout give a Super Whiteout. AC Reptiles describes the super form as healthy and freely breedable, unlike Super Lilly White, which is why breeders use Whiteout to stack white. That rests on AC Reptiles\' own records, so treat a Super Whiteout label as a lineage claim that needs two Whiteout parents.',
    keyFeatures: [
      'Two copies of Whiteout',
      'Described as healthy and breedable',
      'More white than a single-copy Whiteout in AC Reptiles\' description',
    ],
    visualIdentifiers: [
      'Needs two Whiteout parents',
      'Bred to a normal, every baby should be a Whiteout',
    ],
    combinesWith: ['lilly-white', 'soft-scale'],
    sources: [
      'https://acreptiles.com/new_store/index.php?dispatch=pages.view&page_id=44',
    ],
  },
  {
    slug: 'luwak',
    name: 'Luwak',
    definition:
      'A Luwak crested gecko carries one Cappuccino copy and one Sable copy, which sit on the same gene in the widely reported model, so a Luwak is never a super.',
    lookalikes: [
      { slug: 'cappuccino', difference: 'A Cappuccino has one Cappuccino copy and no Sable; dark color alone cannot tell them apart.' },
      { slug: 'sable', difference: 'A Sable has one Sable copy and no Cappuccino; the parents say which.' },
    ],
    aliases: [],
    category: 'combo',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    summary:
      'Cappuccino plus Sable on the same gene. Widely reported, not settled; never a super itself.',
    description:
      'Luwak is the name for a gecko with one Cappuccino copy and one Sable copy. Under the widely reported one-gene model, Cappuccino and Sable are two versions of the same gene, so a gecko holds at most two copies between them: a Luwak has one of each and is never a Super Cappuccino or a Super Sable. Cappuccino x Sable gives about 25% Luwak and can never make a super, which is why it is the safer way to combine the two. Luwak x Luwak is different: about 25% Super Cappuccino, 25% Super Sable and 50% Luwak. MorphMarket\'s Morphpedia still lists Sable\'s place on the Cappuccino gene as suspected, so Geck Inspect badges Luwak Emerging. Looks vary, and dark color alone does not identify one; the parents do.',
    keyFeatures: [
      'One Cappuccino copy plus one Sable copy',
      'Never a super itself',
      'Appearance varies, so lineage identifies it',
    ],
    visualIdentifiers: [
      'Needs one Cappuccino-carrying parent and one Sable-carrying parent',
      'Dark or coffee tones alone do not prove it',
    ],
    combinesWith: ['lilly-white', 'axanthic'],
    notes:
      'Do not pair a Luwak to another Luwak or to a Cappuccino: both can make Super Cappuccinos. A Luwak bred to a normal gives Cappuccinos and Sables, about half each, under the one-gene model.',
    sources: [
      'https://www.morphmarket.com/morphpedia/crested-geckos/sable/',
      'https://reptidex.com/genetics/crested-gecko',
    ],
  },
  {
    slug: 'super-lilly-white',
    name: 'Super Lilly White',
    definition:
      'Super Lilly White is the two-copy form of Lilly White, and it is lethal: embryos die in the egg or within days of hatching.',
    lookalikes: [
      { slug: 'lilly-white', difference: 'A Lilly White has one copy and is healthy; two copies are lethal, so no living adult is a Super Lilly White.' },
      { slug: 'super-whiteout', difference: 'Super Whiteout is a different gene and is described as healthy.' },
    ],
    aliases: ['Super LW'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'very_rare',
    summary:
      'The two-copy form of Lilly White. Lethal, so never pair Lilly White to Lilly White.',
    description:
      'Pairing two Lilly Whites gives about 25% Super Lilly White eggs. Those embryos die in the egg or within days of hatching, which is why Lilly White cannot be bred true and why Lilly White x Lilly White is the pairing every breeder warns against. The same applies to any two geckos that each carry Lilly White, including Frappuccinos. The Lilly White trait itself traces to Lilly Exotics (Nick Lumb) in the United Kingdom, starting with an unusual hatchling in late 2010. A seller offering a living Super Lilly White is mislabeling the animal.',
    keyFeatures: [
      'Two copies of Lilly White',
      'Lethal: dies in the egg or within days of hatching',
      'About 25% of eggs from Lilly White x Lilly White',
    ],
    visualIdentifiers: [
      'There is no living adult to identify',
      'A pale, high-white adult is a Lilly White, a Whiteout or line-bred white, never a Super Lilly White',
    ],
    notes:
      'Lilly White to a gecko without Lilly White gives about 50% Lilly White and never a Super Lilly White.',
    doNotBreed: 'lethal',
    safePairing: {
      label: 'Lilly White x Normal',
      text: 'Pair a Lilly White to a gecko without Lilly White instead. About half the babies are Lilly Whites, the same share Lilly White x Lilly White gives, and no egg is lost to the lethal super.',
      pairing: 'lilly-white-x-normal',
    },
    sources: [
      'https://www.corchgeckos.com/lillywhite.html',
      'https://www.morphmarket.com/morphpedia/crested-geckos/lilly-white/',
    ],
  },
  {
    slug: 'super-cappuccino',
    name: 'Super Cappuccino',
    definition:
      'Super Cappuccino, also called Melanistic, is the two-copy form of Cappuccino; it hatches but has documented health problems, including narrowed nostrils and breathing difficulty.',
    lookalikes: [
      { slug: 'cappuccino', difference: 'A Cappuccino has one copy and none of the super form\'s documented health problems.' },
      { slug: 'luwak', difference: 'A Luwak has one Cappuccino copy and one Sable copy, so it is never a Super Cappuccino.' },
    ],
    aliases: ['Melanistic', 'Super Capp'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    summary:
      'Two copies of Cappuccino. Hatches, but has documented health problems; breeders advise against producing it.',
    description:
      'Pairing two Cappuccinos gives about 25% Super Cappuccino. Unlike Super Lilly White, Super Cappuccinos usually hatch, but breeders document serious health problems: narrowed (stenosed) nostrils, breathing difficulty and poor thriving. Some breeders report that cooler incubation reduces the structural problems without removing them. For these reasons most breeders avoid Cappuccino x Cappuccino and the other pairings that can make one: Luwak x Luwak, Luwak x Cappuccino and Frappuccino x Cappuccino. Cappuccino to a normal, or to a Sable, never makes a Super Cappuccino.',
    keyFeatures: [
      'Two copies of Cappuccino',
      'Documented narrowed nostrils and breathing difficulty',
      'Usually hatches, unlike Super Lilly White',
    ],
    visualIdentifiers: [
      'Check nostril openings at hatch on any baby from a pairing that can make one',
      'Lineage tells you whether both parents carried Cappuccino',
    ],
    notes:
      'Cappuccino x Cappuccino gives about 25% Super Cappuccino, 50% Cappuccino and 25% normal.',
    doNotBreed: 'health',
    safePairing: {
      label: 'Cappuccino x Sable',
      text: 'Pair a Cappuccino to a normal (about half Cappuccino) or to a Sable (about a quarter Luwak) instead. Neither pairing can make a Super Cappuccino.',
      pairing: 'cappuccino-x-sable',
    },
    sources: [
      'https://www.pangeareptile.com/blogs/blog/cappuccino-frappuccino-melanistic',
      'https://lmreptiles.com/fg-pt2-capps/',
    ],
  },
  {
    slug: 'super-sable',
    name: 'Super Sable',
    definition:
      'Super Sable is the two-copy form of Sable; it appears viable but is thinly documented, so breeders check nostril openings at hatch.',
    lookalikes: [
      { slug: 'sable', difference: 'One copy also gives dark, reduced-pattern tones; one copy versus two is hard to see, so use the parents.' },
      { slug: 'luwak', difference: 'A Luwak has one Sable copy and one Cappuccino copy.' },
    ],
    aliases: [],
    category: 'color',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    summary:
      'Two copies of Sable. Appears viable but thinly documented.',
    description:
      'Pairing two Sables gives about 25% Super Sable, and so does Luwak x Luwak. Super Sables appear viable, unlike Super Lilly White, and no pattern of health problems has been documented, but published records are few. Because Sable is widely reported to share a gene with Cappuccino, whose super form has serious nostril problems, the community norm is to check nostril openings at hatch on any super in this group. A Super Sable bred to a normal gives only Sable babies, which is how a breeder can prove one.',
    keyFeatures: [
      'Two copies of Sable',
      'Appears viable, but thinly documented',
      'Bred to a normal, every baby is a Sable',
    ],
    visualIdentifiers: [
      'Needs two Sable-carrying parents (Sable or Luwak)',
      'Dark color alone does not prove it',
    ],
    notes:
      'Super Sable x Cappuccino gives Luwaks and Sables, about half each, and never a super, under the one-gene model.',
    sources: [
      'https://www.morphmarket.com/morphpedia/crested-geckos/sable/',
    ],
  },
  {
    slug: 'super-highway',
    name: 'Super Highway',
    definition:
      'Super Highway is the two-copy form of Highway; some breeders report nostril and health problems in these hatchlings, but that is not established.',
    lookalikes: [
      { slug: 'highway', difference: 'One copy also gives a clean stripe; telling one copy from two by eye is unreliable.' },
      { slug: 'super-cappuccino', difference: 'Super Cappuccino\'s health problems are documented; Super Highway\'s are only reported.' },
    ],
    aliases: [],
    category: 'pattern',
    inheritance: 'incomplete-dominant',
    rarity: 'very_rare',
    summary:
      'Two copies of Highway. Health problems reported, not established; avoid Highway x Highway.',
    description:
      'Pairing two Highways gives about 25% Super Highway. Some breeders report nostril and health problems in Super Highway hatchlings similar to Super Cappuccino\'s, and those reports are the main reason Highway is placed, provisionally, on the Cappuccino and Sable gene. Neither the health problems nor the placement is established in published breeding records, so Geck Inspect badges it Emerging and advises against Highway x Highway until more is known.',
    keyFeatures: [
      'Two copies of Highway',
      'Health problems reported, not established',
      'About 25% of babies from Highway x Highway',
    ],
    visualIdentifiers: [
      'Needs two Highway parents',
      'Check nostril openings at hatch',
    ],
    notes:
      'Pair Highway to a normal (about 50% Highway), or to a Cappuccino or Sable for a compound with no super.',
    doNotBreed: 'health',
    safePairing: {
      label: 'Highway x Normal',
      text: 'Pair a Highway to a gecko without Highway instead. About half the babies are Highways and none is a Super Highway.',
      pairing: null,
    },
    sources: [
      'https://reptidex.com/genetics/crested-gecko',
    ],
  },
];

/* ---------- helpers ---------- */

/**
 * What a morph table's price cell says when this guide gives no typical
 * price (the Morph Guide's compare table and the server HTML of its hubs).
 * A missing priceRange is a gap in this guide, not proof that nobody
 * sells the morph: the Price Index has hundreds of Phantom and Empty Back
 * listings. So it never says "no market". A super that breeders avoid
 * making is not priced at all.
 */
export function noGuidePriceLabel(morph) {
  return morph?.doNotBreed ? 'Not bred on purpose' : 'No guide price yet';
}

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
