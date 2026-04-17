/**
 * Crested Gecko Morph Guide — authoritative local dataset.
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
 *   aliases: [],                          // alternate names / misspellings
 *   category: 'pattern',                  // base | color | pattern | structure | combo
 *   inheritance: 'polygenic',             // recessive | co-dominant | incomplete-dominant | dominant | polygenic | line-bred
 *   rarity: 'common',                     // common | uncommon | rare | very_rare
 *   priceTier: '$',                       // $ | $$ | $$$ | $$$$  (see PRICE_TIERS)
 *   priceRange: '$80–$250',               // USD estimate for a typical adult
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
    blurb: 'Genes that modify or remove pigment — axanthic, hypo, etc.',
  },
  {
    id: 'pattern',
    label: 'Pattern',
    blurb: 'Markings layered on the base — harlequin, pinstripe, dalmatian, flame.',
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
      'Not a single gene — a "look" maintained by repeated pairings of animals that share the trait. Expresses on a gradient.',
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
  $: { label: 'Entry ($50–$150)', description: 'Affordable morphs great for first animals.' },
  $$: { label: 'Mid ($150–$400)', description: 'Established morphs with solid market demand.' },
  $$$: { label: 'High ($400–$1,000)', description: 'Sought-after morphs and strong combos.' },
  $$$$: { label: 'Premium ($1,000+)', description: 'Top-tier breeders, rare combos, and proven project animals.' },
};

// The full catalog. Each morph is its own object so the list is
// easy to sort, filter, and search. Add new entries at the end of
// the array — don't re-order; the UI sorts dynamically.
export const MORPHS = [
  // ---------- PATTERN MORPHS ----------
  {
    slug: 'harlequin',
    name: 'Harlequin',
    aliases: ['Harley', 'Harle'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$$',
    priceRange: '$120–$400',
    summary:
      'High-contrast pattern morph with bold markings covering the legs and climbing high up the dorsum.',
    description:
      'Harlequin is a polygenic pattern morph characterized by bright, high-contrast markings that extend from the belly up onto the legs and sides. It is the baseline quality for most serious hobby projects and one of the two most-produced pattern types alongside pinstripe. Harlequin quality ranges dramatically — from "near-flame" animals with minimal leg coverage to "extreme harlequin" with near-solid cream flanks.',
    keyFeatures: [
      'High-contrast cream or yellow markings that climb the flanks and legs',
      'Pattern typically extends above the lateral line onto the dorsum',
      'Selectively bred for saturation and coverage — better pattern each generation',
      'Stacks with virtually every other trait: cream harlequin, tricolor harlequin, dalmatian harlequin, etc.',
    ],
    visualIdentifiers: [
      'Look at the flanks and legs: harlequin must show bright pattern that climbs up the sides, not just along the belly line',
      'A flame-quality animal with minor pattern extending onto legs is not yet a harlequin',
      'Color saturation should hold when the animal fires up',
    ],
    history:
      'Emerged in the early 2000s as breeders selected for progressively more pattern coverage from flame-base stock.',
    combinesWith: ['dalmatian', 'cream', 'tricolor', 'pinstripe', 'lilly-white', 'axanthic'],
    notes:
      'Because the trait is polygenic, pairing two harlequins does not guarantee harlequin offspring — it just improves the odds and average quality.',
  },
  {
    slug: 'extreme-harlequin',
    name: 'Extreme Harlequin',
    aliases: ['Extreme Harley', 'EH', 'Super Harley'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$350–$900',
    summary:
      'The top tier of harlequin pattern — high-coverage, high-contrast, often with solid cream flanks and legs.',
    description:
      'Extreme harlequin is the highest expression of the harlequin polygenic trait: pattern that nearly consumes the base color on the legs, flanks, and sometimes the dorsum. Top extreme harlequin animals can appear nearly cream-and-dark-red all over. The line between harlequin and extreme harlequin is a judgment call rather than a bright line, but experienced keepers use coverage (≥60–70% of flanks) as a rough threshold.',
    keyFeatures: [
      'Extensive pattern coverage on flanks and legs — often approaching 70%+ of the lateral surface',
      'Pattern frequently continues across the shoulders and neck',
      'Most saturated when fired up; dull animals should still show dramatic contrast',
      'Foundation of many high-end projects: tricolor, phantom pinstripe combos, "crown" pattern animals',
    ],
    visualIdentifiers: [
      'Nearly solid cream or yellow panels on the flanks rather than scattered markings',
      'Pattern visible even in fired-down state',
      'Often paired with bold leg pattern and white lips',
    ],
    history:
      'Came from the tightening of harlequin selection in the mid-2000s, with Hatcher\'s Cresties and AC Reptiles among the early drivers.',
    combinesWith: ['cream', 'tricolor', 'dalmatian', 'phantom-pinstripe', 'axanthic'],
    notes:
      'Buyers should ask for photos of both fired and unfired states — some animals look far less extreme when not fully fired.',
  },
  {
    slug: 'pinstripe',
    name: 'Pinstripe',
    aliases: ['Pin'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$$',
    priceRange: '$120–$350',
    summary:
      'Raised cream scales running along the dorsal ridge from neck to tail base.',
    description:
      'Pinstripe is a polygenic pattern trait where the raised scales along the dorsal ridge become cream or yellow, forming a bright parallel line down the back. Pinstripe quality is judged by percentage — "full pinstripe" describes 100% coverage from the back of the neck to the base of the tail. Partial pinstripe (50–90%) is far more common than full.',
    keyFeatures: [
      'Two parallel cream/yellow stripes along the raised dorsal scales',
      'Percentage graded: 100% = "full pinstripe", 75% = "75% pin", etc.',
      'Stacks with harlequin, dalmatian, base color modifiers, and structural traits',
      'Base for further trait combinations — phantom pinstripe, dashed pin, reverse pin',
    ],
    visualIdentifiers: [
      'Look at the raised scales along the spine — they should be a different color than the surrounding base',
      'Pinstripe is not a "white stripe" on flat skin; it must follow the raised scales',
      'Percentage measured from the neck crest to the tail base',
    ],
    history:
      'One of the first named polygenic traits in the hobby, recognized by the early 2000s.',
    combinesWith: ['harlequin', 'cream', 'phantom-pinstripe', 'dalmatian', 'lilly-white', 'axanthic'],
    notes:
      'A "partial pinstripe" (under 75%) is often not worth a premium — most buyers pay up only for 90%+ coverage.',
  },
  {
    slug: 'phantom-pinstripe',
    name: 'Phantom Pinstripe',
    aliases: ['Phantom', 'Reverse Pin'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$500–$1,500',
    summary:
      'Raised dorsal scales that remain dark (unpigmented cream) while the flanks carry bright pattern — a reversed look.',
    description:
      'Phantom pinstripe (sometimes called "reverse pin") is a pattern where the dorsal raised scales stay the base color — not cream — while the surrounding pattern is extremely bright. This produces a striking "phantom" appearance where the dorsal line disappears into the body while the rest of the pattern pops. Often confused with a low-quality pinstripe; true phantom is a distinct, selectively maintained look.',
    keyFeatures: [
      'Dorsal raised scales are the same color as the base — no cream stripe',
      'Flanks and legs show bright, harlequin-like pattern',
      'Often paired with extreme harlequin and tricolor for maximum visual impact',
      'Selection depends on keepers recognizing the trait and preserving it — easy to lose in a large breeding program',
    ],
    visualIdentifiers: [
      'Dorsal scales blend into the body rather than forming a bright line',
      'Contrast is on the flanks, not the back',
      'Requires comparison photos to a traditional pinstripe to appreciate',
    ],
    history:
      'Formally recognized in the late 2000s. Named by hobbyists who noticed that the "reverse" look held up across generations.',
    combinesWith: ['extreme-harlequin', 'tricolor', 'lilly-white', 'axanthic', 'cream'],
  },
  {
    slug: 'dalmatian',
    name: 'Dalmatian',
    aliases: ['Dal', 'Dally'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$$',
    priceRange: '$100–$400',
    summary:
      'Discrete dark spots scattered across the body — black is most common, red and occasionally white also occur.',
    description:
      'Dalmatian is a polygenic trait producing discrete, round dark spots across the gecko\'s body. Spot count ranges from a few dozen on a "light dalmatian" to hundreds on a "super dalmatian." Spots typically develop with age — a hatchling may show a handful, while the same animal at 18 months may be peppered head to tail. Red dalmatian spots are rarer and often co-occur with a red base.',
    keyFeatures: [
      'Discrete round dark spots, not pattern smudging or flecking',
      'Spots darken and increase in count as the gecko ages, peaking around 12–18 months',
      'Quality graded by spot count, contrast, and distribution',
      'Stacks with virtually every other trait — dalmatian harlequin, dalmatian pinstripe, super dalmatian combo animals are common',
    ],
    visualIdentifiers: [
      'Sharp-edged round spots distinguishable from random dark flecking',
      'Spots appear on the base color, not on pattern areas',
      'Count should increase from hatchling to adult — an "already heavy" hatchling usually develops into a super dalmatian',
    ],
    history:
      'Long-established trait, recognized since the earliest organized breeding in the late 1990s.',
    combinesWith: ['harlequin', 'pinstripe', 'cream', 'lilly-white', 'axanthic', 'super-dalmatian'],
  },
  {
    slug: 'super-dalmatian',
    name: 'Super Dalmatian',
    aliases: ['Super Dal'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$300–$800',
    summary:
      'Extreme dalmatian with 100+ well-defined spots covering nearly the entire body.',
    description:
      'Super dalmatian is the high-count end of the dalmatian gradient. Conventionally, 100+ well-defined spots covering the head, dorsum, flanks, legs, and tail. Because dalmatian counts increase with age, a super dalmatian designation is typically made at ~12+ months after spots have stabilized.',
    keyFeatures: [
      '100+ discrete spots across the body at adult age',
      'Spots extend onto the head, legs, and tail — not just the dorsum',
      'Often produced by stacking two high-dalmatian parents across multiple generations',
    ],
    visualIdentifiers: [
      'Too many spots to count quickly',
      'Spots remain well-defined rather than smudging together',
      'Head and tail are fully covered, not just the body',
    ],
    history:
      'The "super" designation came with breeders tightening selection pressure on spot count through the 2010s.',
    combinesWith: ['harlequin', 'extreme-harlequin', 'pinstripe', 'lilly-white', 'axanthic'],
  },
  {
    slug: 'flame',
    name: 'Flame',
    aliases: [],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$60–$180',
    summary:
      'A pattern type with color restricted to the dorsum — flanks stay a solid base color.',
    description:
      'Flame is the "entry-level" pattern in the hobby. A flame crested gecko has bright dorsal markings but minimal or no pattern on the flanks and legs. It is the baseline from which most harlequin projects start — breeders call it "flame" to contrast with "harlequin" (pattern climbing the flanks). Flames can still be beautiful with strong base color, and quality flame pairs remain the foundation of many breeding programs.',
    keyFeatures: [
      'Pattern concentrated along the dorsum, not climbing onto flanks or legs',
      'Typically the least expensive pattern morph at hatch',
      'Strong flames form the base of harlequin projects',
      'Pair flame × harlequin often produces a mix of both',
    ],
    visualIdentifiers: [
      'Clean, solid flanks and legs',
      'Dorsal pattern can still be very bright — the distinction is coverage, not saturation',
      'Often mistaken for a poor harlequin; flame is a named category in its own right',
    ],
    history:
      'Recognized since the earliest days of the hobby. Named for the flame-like markings running along the back.',
    combinesWith: ['dalmatian', 'cream', 'pinstripe', 'lilly-white'],
  },
  {
    slug: 'tiger',
    name: 'Tiger',
    aliases: [],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150–$400',
    summary:
      'Horizontal dark banding across the dorsum, running perpendicular to the spine.',
    description:
      'Tiger pattern consists of distinct dark horizontal bands running across the back of the gecko, perpendicular to the spine. The bands can be subtle or bold, and are most visible when the animal is fired up. Selective breeding has pushed the contrast and number of bands higher, producing the extreme form known as brindle.',
    keyFeatures: [
      'Horizontal bands crossing the dorsum perpendicular to the spine',
      'Bands are darkest when fired up and can fade significantly when fired down',
      'Quality judged by band number, sharpness, and contrast',
      'Stacks with base color traits — red tiger, olive tiger, chocolate tiger',
    ],
    visualIdentifiers: [
      'Sharp, parallel horizontal lines across the back',
      'Distinguished from "dashed" or irregular markings by parallel regularity',
      'Fires up dramatically at night',
    ],
    history:
      'Long-established polygenic trait, recognized in breeding programs since the early 2000s.',
    combinesWith: ['brindle', 'extreme-brindle', 'red-base', 'olive', 'chocolate', 'harlequin'],
  },
  {
    slug: 'brindle',
    name: 'Brindle',
    aliases: [],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$180–$450',
    summary:
      'Heavier, more irregular banding than tiger — often described as "broken" or "marbled" tiger.',
    description:
      'Brindle is the heavier, more chaotic cousin of tiger. Where tiger shows clean parallel bands, brindle shows broken, irregular, overlapping dark markings across the dorsum. The two traits are on a gradient — many breeders refer to "tiger/brindle" as a combined category. Extreme brindle is the upper tier where the dark pattern dominates the dorsum.',
    keyFeatures: [
      'Irregular, broken, or marbled dark bands across the dorsum',
      'More pattern coverage than tiger, less regular',
      'Often combined with strong base color (red, olive) for dramatic effect',
      'Pairs well with dalmatian for a busy, high-interest animal',
    ],
    visualIdentifiers: [
      'Horizontal pattern that appears smudged or broken, rather than clean bands',
      'Pattern can wrap around onto the flanks, distinguishing from tiger',
    ],
    history:
      'Recognized alongside tiger as breeders noted both patterns appeared in the same lines at different expression levels.',
    combinesWith: ['tiger', 'extreme-brindle', 'red-base', 'olive', 'chocolate', 'harlequin'],
  },
  {
    slug: 'extreme-brindle',
    name: 'Extreme Brindle',
    aliases: [],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$400–$1,000',
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
    aliases: ['T/B', 'Tiger Brindle'],
    category: 'pattern',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150–$400',
    summary:
      'Intermediate expression between tiger and brindle — sold as a single "T/B" category in much of the hobby.',
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
    aliases: ['SS'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$400–$1,000',
    summary:
      'Incomplete-dominant trait that reduces scale size and texture — the animal looks smoother and more velvety.',
    description:
      'Soft scale is a proven incomplete-dominant trait that modifies the structure of the gecko\'s scales, producing a noticeably smoother and finer-grained skin texture. The super form, super soft scale, takes this further — scales are dramatically reduced and the animal looks almost leather-like. First formally identified and proven by North of the Border (NOTB) in the early 2020s.',
    keyFeatures: [
      'Visibly smaller, finer scales compared to a wild-type animal',
      'Skin appears smoother and more matte',
      'Single copy is visible (het form); two copies produce the super form',
      'Proven inheritance — works in Punnett squares',
    ],
    visualIdentifiers: [
      'Close-up photo of the dorsum shows reduced scale prominence',
      'Skin texture feels noticeably softer to the touch',
      'In direct side-by-side comparison with a standard animal, the difference is obvious',
    ],
    history:
      'Proven by North of the Border Reptiles (Frank Payne) in the early 2020s. Verified through controlled test breedings.',
    combinesWith: ['super-soft-scale', 'white-wall', 'lilly-white', 'cappuccino', 'axanthic'],
    notes:
      'Super soft scale can be difficult to distinguish from the single-copy form in photos — request multiple angles when buying.',
  },
  {
    slug: 'super-soft-scale',
    name: 'Super Soft Scale',
    aliases: ['SSS', 'Super SS'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,200–$3,500',
    summary:
      'Homozygous form of soft scale — dramatically reduced scales and a near-leather appearance.',
    description:
      'Super soft scale is the homozygous expression of the soft scale gene. Two copies reduce scales far more dramatically than a single copy, producing a nearly smooth, leather-textured animal. Considered visually stunning and still quite rare in the hobby.',
    keyFeatures: [
      'Dramatically reduced scale texture across the entire body',
      'Skin appears near-leather or matte in quality',
      'Two copies required — produced by pairing two visual soft scale animals',
      'High value because of the small pool of proven super animals',
    ],
    history:
      'First confirmed around 2022–2023 as early soft scale projects matured to the F2 generation.',
    combinesWith: ['lilly-white', 'axanthic', 'cappuccino', 'white-wall'],
  },
  {
    slug: 'white-wall',
    name: 'White Wall',
    aliases: ['WW'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,500–$4,000',
    summary:
      'Structural trait producing a bright white flank that does not fire down — hence "wall of white."',
    description:
      'White wall is a proven incomplete-dominant trait that produces a striking white patch along the flanks and sometimes the dorsum. The white is structural — it does not fire down with the rest of the animal, giving the impression of a persistent "wall" of white even when the gecko is otherwise fired down. The super form, super white wall, pushes this further toward a near-patternless white animal.',
    keyFeatures: [
      'Bright white patch on the flanks that persists in fired-down state',
      'Often combined with lilly white for the white-wall white-spot look',
      'Proven inheritance with a known super form',
      'Distinguishes itself from harlequin cream by holding when the animal is fired down',
    ],
    visualIdentifiers: [
      'White patches remain bright even when the rest of the animal darkens at rest',
      'Position typically along the lateral line and flanks',
    ],
    history:
      'Proven by AC Reptiles and collaborating breeders in the early 2020s after years of line development.',
    combinesWith: ['lilly-white', 'white-wall-white-spot', 'soft-scale', 'axanthic'],
  },
  {
    slug: 'white-wall-white-spot',
    name: 'White Wall White Spot',
    aliases: ['WWWS', 'White Spot'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,500–$4,000',
    summary:
      'Variant of white wall characterized by isolated bright white spots rather than a solid wall.',
    description:
      'White wall white spot expresses as discrete white patches or spots across the body, rather than the continuous white flank typical of standard white wall. Often considered a variant of the same underlying gene complex, and frequently co-produced with white wall animals in the same lines.',
    keyFeatures: [
      'Discrete, defined white spots on the flanks and sometimes dorsum',
      'Spots hold in fired-down state (structural, not pigmentary)',
      'Commonly paired with lilly white for further dramatic contrast',
    ],
    combinesWith: ['lilly-white', 'white-wall', 'soft-scale', 'axanthic'],
  },
  {
    slug: 'cappuccino',
    name: 'Cappuccino',
    aliases: ['Cap', 'Cappy'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$400–$1,200',
    summary:
      'Structural pattern trait creating a distinctive "saddle" mark on the back with a clean dorsal contrast.',
    description:
      'Cappuccino is a proven incomplete-dominant trait that produces a characteristic "saddle" — a distinct, rounded dorsal marking with clean boundaries. The body often shows a warm brown (coffee) tone, hence the name. Combines powerfully with harlequin to produce "mocha" animals, and when paired homozygous produces the super form called frappuccino.',
    keyFeatures: [
      'Defined dorsal "saddle" with clean edges, not a gradient pattern',
      'Warm brown/mocha undertone on body',
      'Proven incomplete-dominant inheritance',
      'Homozygous form is frappuccino (super cappuccino)',
    ],
    visualIdentifiers: [
      'Saddle-shaped dorsal marking that stands out from the surrounding pattern',
      'Warm coffee-colored base rather than cool tones',
      'Often shows a clean ring pattern around the eyes',
    ],
    history:
      'Proven in the 2010s. One of the first widely-accepted proven non-recessive morphs in the species.',
    combinesWith: ['frappuccino', 'lilly-white', 'soft-scale', 'harlequin', 'axanthic', 'dalmatian'],
  },
  {
    slug: 'frappuccino',
    name: 'Frappuccino',
    aliases: ['Frap', 'Super Cappuccino'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,500–$3,500',
    summary:
      'Homozygous form of cappuccino — exaggerated saddle, muted pattern, and a distinctive pale body tone.',
    description:
      'Frappuccino is the super (homozygous) form of cappuccino. The saddle expression is amplified, body color is paler and more neutral, and the pattern is often more subdued with cleaner boundaries. Rare and sought-after as a breeding animal because pairing a frappuccino to any non-carrier produces 100% het cappuccino offspring.',
    keyFeatures: [
      'Amplified saddle with very clean edges',
      'Paler, more neutral body color than single-copy cappuccino',
      '100% of offspring with a non-carrier will be het cappuccino',
    ],
    combinesWith: ['lilly-white', 'soft-scale', 'harlequin', 'axanthic'],
  },
  {
    slug: 'lilly-white',
    name: 'Lilly White',
    aliases: ['LW', 'Lilly'],
    category: 'structure',
    inheritance: 'incomplete-dominant',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$300–$900',
    summary:
      'Proven incomplete-dominant trait producing bold white markings — the super form is lethal.',
    description:
      'Lilly white is the most famous incomplete-dominant morph in crested geckos. A single copy produces bright, well-defined white markings on the dorsum, flanks, and legs. The super form (two copies) is a lethal allele — homozygous embryos do not survive to hatch. This is the cleanest confirmed example of a lethal gene in the species and is why visual lilly × visual lilly pairings yield only 2/3 surviving offspring as lilly white and 1/3 as non-lilly siblings.',
    keyFeatures: [
      'Bright, well-defined white markings on a single copy',
      'Super form (super lilly / LWxLW homozygous) is lethal — embryos do not hatch',
      'Pair visual lilly × non-carrier to produce 50% lilly offspring with zero lethal risk',
      'Stacks with nearly every other trait — axanthic lilly, harlequin lilly, tricolor lilly',
    ],
    visualIdentifiers: [
      'White markings appear on both the dorsum and flanks simultaneously',
      'Often includes bright leg pattern',
      'The white is structural — it persists in fired-down state',
    ],
    history:
      'Discovered by Anthony Caponetto at ACR in 2011 and proven through controlled breeding. Named after his daughter Lilly.',
    combinesWith: ['white-wall', 'soft-scale', 'cappuccino', 'axanthic', 'harlequin', 'extreme-harlequin', 'dalmatian'],
    notes:
      'Never pair two visual lilly whites unless you accept that roughly 1/4 of eggs will fail to develop — this is the homozygous lethal phenotype.',
  },
  // ---------- COLOR MODIFIERS ----------
  {
    slug: 'axanthic',
    name: 'Axanthic',
    aliases: ['Axie', 'Axan'],
    category: 'color',
    inheritance: 'recessive',
    rarity: 'rare',
    priceTier: '$$$$',
    priceRange: '$1,500–$4,000',
    summary:
      'Proven recessive trait that removes yellow and red pigment — animals appear black, gray, and white.',
    description:
      'Axanthic is the only fully-proven recessive morph in crested geckos. It removes yellow (xanthophores) and red (erythrophores) pigment, leaving only melanin (black) and white. Visual axanthics appear in shades of charcoal, silver, and white with no warm tones at all. A heterozygous (het) axanthic looks identical to a normal animal, which is why het purchases require documented lineage. First proven by Cabernet Dragons (Matt Parks) around 2018.',
    keyFeatures: [
      'Proven autosomal recessive — two copies required for visual expression',
      'Complete absence of yellow and red pigment — only black, gray, and white',
      'Het axanthics are invisible; buy from documented lineage only',
      'Stacks with every other trait to produce a "cool-toned" version of that morph',
    ],
    visualIdentifiers: [
      'Zero warm tones — no yellow, no red, no cream',
      'Base color appears charcoal to silver',
      'Pattern areas that would be cream in a normal animal appear pure white',
    ],
    history:
      'Proven by Cabernet Dragons (Matt Parks) around 2018 after multiple generations of selective breeding and test pairings.',
    combinesWith: ['lilly-white', 'soft-scale', 'white-wall', 'dalmatian', 'harlequin', 'pinstripe', 'cappuccino'],
    notes:
      'Because it is a clean recessive, Punnett squares work: visual × visual → 100% visual; visual × het → 50% visual, 50% het; het × het → 25% visual, 50% het, 25% non-carrier.',
  },
  {
    slug: 'hypo',
    name: 'Hypo (Hypomelanistic)',
    aliases: ['Hypomelanistic', 'Hypomelanism'],
    category: 'color',
    inheritance: 'line-bred',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$500–$1,500',
    summary:
      'Line-bred trait reducing black pigment — warmer, brighter animals with pale bellies and reduced dark markings.',
    description:
      'Hypomelanism in crested geckos is a line-bred rather than a single-gene trait. It describes animals with reduced black pigment, creating a warmer, brighter overall appearance. Hypo can occur on any base — the name describes the reduction in melanin, not a specific morph. The trait is maintained by pairing hypo to hypo across multiple generations.',
    keyFeatures: [
      'Reduced dark (melanin) pigment throughout the body',
      'Warmer overall tone with paler belly and reduced dark dorsal markings',
      'Line-bred rather than single-gene — inheritance is probabilistic',
      'Stacks with any other color or pattern trait',
    ],
    combinesWith: ['red-base', 'orange-base', 'yellow-base', 'harlequin', 'lilly-white', 'dalmatian'],
  },
  {
    slug: 'patternless',
    name: 'Patternless',
    aliases: ['Solid'],
    category: 'color',
    inheritance: 'line-bred',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$50–$150',
    summary:
      'Line-bred trait for solid-colored animals with no discernible pattern — often the base for breeding projects.',
    description:
      'Patternless crested geckos lack visible markings and display a single solid base color. The trait is line-bred rather than a single gene, and patternless animals are often used as the base color foundation for high-contrast pattern projects. Common patternless bases include red, orange, olive, yellow, and chocolate.',
    keyFeatures: [
      'No visible pattern on the body — solid base color',
      'Base color determines the animal\'s name (red patternless, olive patternless, etc.)',
      'Line-bred trait — stacks with any color but cannot be Punnett-squared',
      'Foundation stock for many high-contrast pattern breeding projects',
    ],
    combinesWith: ['red-base', 'orange-base', 'yellow-base', 'olive', 'chocolate', 'lilly-white', 'axanthic'],
  },
  {
    slug: 'moonglow',
    name: 'Moonglow',
    aliases: [],
    category: 'color',
    inheritance: 'line-bred',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$500–$1,500',
    summary:
      'Line-bred ultra-pale, near-white patternless animal — essentially a "super-cream" patternless with no visible markings.',
    description:
      'Moonglow is a line-bred trait for near-white patternless animals. These geckos display an almost solid cream or white body with no discernible pattern. Maintained through tight selection over generations. Not related to axanthic — moonglow animals can still show warm cream tones.',
    keyFeatures: [
      'Nearly solid cream/white body with no visible pattern',
      'Line-bred — inheritance is probabilistic',
      'Often used as a breeding base for extreme cream or white-wall projects',
    ],
    combinesWith: ['cream', 'white-wall', 'lilly-white', 'axanthic'],
  },
  {
    slug: 'translucent',
    name: 'Translucent',
    aliases: ['Trans'],
    category: 'color',
    inheritance: 'line-bred',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$400–$1,200',
    summary:
      'Line-bred trait producing a degree of skin translucency — organs and bone structure faintly visible.',
    description:
      'Translucent crested geckos show a degree of skin translucency, most evident in hatchlings and juveniles where the belly, internal organs, or bone structure is faintly visible through the skin. The trait often becomes less obvious as the animal ages. Still considered line-bred and the inheritance model is not fully proven.',
    keyFeatures: [
      'Visible translucency in skin, especially on the belly',
      'Most visible in juveniles — can fade with age',
      'Frequently combined with other color modifiers like axanthic',
    ],
    combinesWith: ['axanthic', 'lilly-white', 'cream', 'harlequin'],
  },

  // ---------- BASE COLORS ----------
  {
    slug: 'red-base',
    name: 'Red Base',
    aliases: ['Red'],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$180–$450',
    summary:
      'Polygenic base color showing true red tones — distinct from red dalmatian or rose-brown animals.',
    description:
      'Red base describes animals whose base color is true red. Quality is measured by saturation and consistency when fired up. Entry-level red bases are often more of a rust or orange-red; top-quality red bases hold deep saturation even in the fired-down state.',
    keyFeatures: [
      'True red base color (not orange, not rust)',
      'Saturation holds when fired up',
      'Line-bred over multiple generations',
      'Pairs well with harlequin for dramatic cream-on-red contrast',
    ],
    combinesWith: ['harlequin', 'extreme-harlequin', 'dalmatian', 'pinstripe', 'tricolor'],
  },
  {
    slug: 'orange-base',
    name: 'Orange Base',
    aliases: ['Orange'],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150–$350',
    summary:
      'Polygenic base color in warm orange tones — common and widely produced.',
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
    aliases: ['Yellow'],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$80–$200',
    summary:
      'Polygenic base color with bright yellow ground color — common and beginner-friendly.',
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
    aliases: [],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150–$400',
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
    aliases: [],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150–$400',
    summary:
      'Polygenic base color with rich deep-brown tones — like dark chocolate.',
    description:
      'Chocolate base describes animals with a deep, rich brown base color. Strong chocolate animals hold dark saturation even when fired down. Pairs beautifully with cream or harlequin patterns for strong contrast.',
    keyFeatures: [
      'Deep rich brown base color',
      'Saturation holds into fired-down state',
      'Dramatic canvas for cream or harlequin patterns',
    ],
    combinesWith: ['harlequin', 'cream', 'dalmatian', 'tiger', 'brindle'],
  },
  {
    slug: 'lavender',
    name: 'Lavender',
    aliases: [],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$400–$1,000',
    summary:
      'Polygenic base color showing an unusual purple-gray tone — rare and sought-after.',
    description:
      'Lavender is a sought-after polygenic base color showing a distinct purple-gray tone. Expression is strongest when fired down — fired-up lavenders often look more standard brown. Considered challenging to maintain across generations.',
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
    aliases: [],
    category: 'base',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$60–$180',
    summary:
      'Warm tan or leather-colored base — a classic "starter" color with pleasant earthy tones.',
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
    aliases: [],
    category: 'combo',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150–$450',
    summary:
      'Cream color applied to harlequin or pinstripe pattern — bright, clean, and highly sought after.',
    description:
      'Cream describes animals whose pattern areas are cream-colored rather than yellow or orange. Usually applied as a descriptor stacked on harlequin or pinstripe (cream harlequin, cream pinstripe). Cream is the "vanilla" of pattern colors — bright, pure, and highly valued when it is clean and saturated.',
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
    aliases: ['Tri', 'Tri-color'],
    category: 'combo',
    inheritance: 'polygenic',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$300–$800',
    summary:
      'Three-color combination: dark base + cream pattern + a third distinct color (usually red or orange).',
    description:
      'Tricolor is a combination look: a dark base, bright cream harlequin or pinstripe pattern, and a third contrasting color (typically red, orange, or pink) concentrated in the dorsal pattern. The three-color contrast is what distinguishes a tricolor from a high-quality cream harlequin. When all three colors are saturated and cleanly separated, the animal is spectacular and valued accordingly.',
    keyFeatures: [
      'Three distinct color zones: dark base, bright cream pattern, and a third accent color',
      'Third color (red, orange, pink) concentrated in the dorsal pattern area',
      'Most striking in fully fired-up state',
    ],
    combinesWith: ['harlequin', 'extreme-harlequin', 'lilly-white', 'dalmatian', 'pinstripe'],
  },
  {
    slug: 'bicolor',
    name: 'Bicolor',
    aliases: ['Bi-color'],
    category: 'combo',
    inheritance: 'polygenic',
    rarity: 'common',
    priceTier: '$',
    priceRange: '$80–$200',
    summary:
      'Animal with two clear contrasting colors — typically a base plus one pattern color.',
    description:
      'Bicolor describes animals with two clearly distinct colors — usually a solid base and a contrasting dorsal pattern color — without the third accent color required for tricolor. A clean line between the two colors along the lateral line is the hallmark.',
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
