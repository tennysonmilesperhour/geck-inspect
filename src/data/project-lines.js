/**
 * Crested Gecko Project Lines, authoritative local dataset.
 *
 * Project lines are NOT single-gene morphs. They are named bloodlines,
 * usually traced to a specific founder breeder, where a recognizable look
 * is maintained through repeated selective pairings rather than a Mendelian
 * locus. The hobby uses "line" loosely; many sellers attach a line name
 * to any animal that vaguely fits the look. This file's job is to document
 * what's actually verifiable, with honest framing about what isn't.
 *
 * Per-entry confidence labels:
 *   'verified'             Founder breeder is named, public, and the
 *                          line is well-documented (forum threads,
 *                          breeder website, established hobby record).
 *   'community-attributed' Line is recognized in the hobby but founder
 *                          is unclear or contested; visual identity is
 *                          consistent across multiple breeders.
 *   'disputed'             Term is in active use but documentation is
 *                          thin; included so buyers know what to ask.
 *
 * Several "lines" in this file are technically classified as morphs by
 * MorphMarket (Cho Cho, Halloween, Sable). They appear here because the
 * hobby still talks about them as bloodlines, and the founder/verification
 * story is identical to a line entry. The `relatedMorphs` field links
 * them back to the morph guide so the cross-reference is explicit.
 *
 * Reference images are intentionally left null. MorphMarket blocks
 * hotlinking, breeder photos are copyrighted, and the live MorphMarket
 * search link gives buyers what they actually need: current examples
 * with attribution and pricing. Admins can attach curated reference
 * shots through the existing morph_reference_images flow once they
 * have permission from the photographer.
 */

export const LINE_CONFIDENCE = {
  verified: {
    id: 'verified',
    label: 'Verified',
    short: 'Verified',
    color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    description: 'Founder breeder is publicly named and the line has documented hobby history.',
  },
  'community-attributed': {
    id: 'community-attributed',
    label: 'Community attributed',
    short: 'Community',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    description: 'Recognized in the hobby but founder is unclear or multiple breeders claim the name.',
  },
  disputed: {
    id: 'disputed',
    label: 'Disputed origin',
    short: 'Disputed',
    color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    description: 'Name is in active use but documentation is thin. Treat any claim as buyer-beware.',
  },
};

export const PROJECT_LINES = [
  {
    slug: 'rialto',
    name: 'Rialto Line',
    aliases: ['Rialto'],
    confidence: 'verified',
    founder: 'Cindy and Todd McDannell, Gecko Haven',
    founderUrl: 'https://geckohaven.com',
    origin: 'Gettysburg, Pennsylvania, USA',
    established: 'circa 2017',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$500-$1,500',
    summary:
      'Founding bloodline that produced the Sable trait. Pinch x Mokolii (two unrelated geckos from Gorgeous Gecko in Texas) hatched Rialto, the first known Sable.',
    description:
      'The Rialto line is the founding bloodline behind the Sable trait. Cindy McDannell at Gecko Haven paired two unrelated animals from Gorgeous Gecko (Texas) named Pinch (female) and Mokolii (male). One of the offspring, Rialto, displayed what was eventually proven out as the incomplete-dominant Sable gene. Sable reached mainstream community awareness in fall 2022, and any animal genuinely tracing to Rialto carries significant pedigree weight.',
    visualIdentity: [
      'Deep, smoky charcoal-to-near-black overall tone when fired up',
      'Pattern (when present) is reduced in contrast compared to a normal animal of the same morph combo',
      'Co-expresses cleanly with most pattern morphs (harlequin, pinstripe, dalmatian)',
      'In hets and visuals, fire-down state is still notably darker than non-Sable siblings',
    ],
    identificationTips: [
      'Compare fired-up photos to known Sable references; the saturation of the dark tone is the giveaway',
      'Ask whether the animal is a het Sable or a visual Sable; a het looks like a normal animal',
      'Check whether the line has been outcrossed; multi-gen Rialto descendants are tighter in expression than recent outcrosses',
    ],
    verificationAdvice: [
      'Ask for a sire/dam pedigree that traces back to Rialto, Pinch, or Mokolii',
      'Contact Gecko Haven directly for confirmation when buying at higher price points',
      'Sable proves out as incomplete-dominant; a true visual Sable bred to a normal should produce a known ratio of visual Sable offspring',
      'Be cautious of sellers labeling any dark-toned gecko as "Sable" without pedigree',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=sable',
    relatedMorphs: ['sable'],
    caveats: [
      'Sable is now classified as a morph on MorphMarket and Morphpedia rather than a line. The Rialto line is the founding source of that morph.',
    ],
  },
  {
    slug: 'cho-cho',
    name: 'Cho Cho',
    aliases: ['ChoCho', 'CC', 'Cho-Cho'],
    confidence: 'verified',
    founder: 'Korean breeder under the handle "sunjuviewonder"',
    founderUrl: null,
    origin: 'South Korea',
    established: 'first hatched circa 2018-2020',
    rarity: 'very_rare',
    priceTier: '$$$$',
    priceRange: '$1,500-$5,000+',
    summary:
      'Recessive trait discovered in Korea. Produces a distinct pink expression that the breeder describes as developing across three coloration steps, with no red ancestry in the proving pedigree.',
    description:
      'Cho Cho was identified by a Korean breeder using the handle "sunjuviewonder" who hatched what proved to be a new recessive trait. The breeder documented three coloration steps through development: the base and second step show redness, and the third step shifts toward pink. Notably, no animals in the known pedigree expressed red coloration before the original Cho Cho hatched. Early proving work showed Cho Cho is highly vulnerable to inbreeding; F2 pairings to normal or Lilly White produced healthy clutches at high hatch rates, while tight pairings within the line did not.',
    visualIdentity: [
      'Pink expression that develops across multiple coloration steps in juveniles through adults',
      'Distinct from generic "pink" hobby descriptors; the trait has a specific phenotype',
      'No red expressed in pedigree before the original hatch, so red ancestry is not the source',
    ],
    identificationTips: [
      'A true Cho Cho should have documented pedigree tracing back to the original Korean line',
      'Color development is staged; ask the seller which step the animal is currently at',
      'Compare to original sunjuviewonder photos in the IB Exotic forum thread',
    ],
    verificationAdvice: [
      'Genuine Cho Cho animals outside Korea are rare and should come with import documentation or a clear chain of custody',
      'Verify the seller is paired with the documented Korean source line, not claiming the name on a generic pink animal',
      'Cho Cho is recessive; ask for the parents\' genotype (visual x visual, visual x het, etc.)',
      'Outcross to non-related animals is necessary to avoid inbreeding issues; ask about the seller\'s outcross plan',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=cho+cho',
    relatedMorphs: [],
    caveats: [
      'Often classified as a morph rather than a line in modern hobby usage. Listed here because the founder/verification story matches the line format.',
    ],
  },
  {
    slug: 'mardi-gras',
    name: 'Mardi Gras Line',
    aliases: ['MardiGras'],
    confidence: 'community-attributed',
    founder: 'Multiple breeders, no single founder consistently credited',
    founderUrl: null,
    origin: 'United States',
    established: 'mid-2010s',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$200-$600',
    summary:
      'Confetti-style animals with black and red dalmatian spots, white snowflake spotting, and usually a hypo neon red base.',
    description:
      'Mardi Gras is a community-recognized line built on a specific visual recipe: a hypo neon red base, layered with two dalmatian spot colors (black and red), plus white snowflake spotting on top. The result reads as carnival-colored, hence the name. Multiple breeders independently work toward the look, so there is no single founder. Animals labeled Mardi Gras vary in how cleanly the recipe expresses.',
    visualIdentity: [
      'Hypo neon red base color (warm, saturated, with reduced melanin)',
      'Black dalmatian spots distributed across the body',
      'Red dalmatian spots (a separate spot color, not just darker base)',
      'White snowflake spotting layered on top of the pattern',
      'Pattern reads as multi-color confetti rather than two-tone',
    ],
    identificationTips: [
      'All four elements should be present: hypo red base, black dals, red dals, white snowflakes',
      'Animals with only black dals and red base are not Mardi Gras; they are dalmatian harlequins on red base',
      'White snowflake spotting is the trickiest element to produce and the best diagnostic',
    ],
    verificationAdvice: [
      'Ask the seller to point out each of the four trait elements in photos',
      'Request photos of both parents; the look is reinforced when both parents express',
      'No central registry exists; reputation of the breeder matters more than the line name itself',
      'Mardi Gras is a goal phenotype, not a single gene; younger animals may develop more spotting with age',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=mardi+gras',
    relatedMorphs: ['dalmatian', 'super-dalmatian', 'harlequin'],
    caveats: [],
  },
  {
    slug: 'frost',
    name: 'Frost Line',
    aliases: ['Frosty', 'Frost Line'],
    confidence: 'community-attributed',
    founder: 'Multiple breeders, no single founder consistently credited',
    founderUrl: null,
    origin: 'United States',
    established: 'mid-2010s onward',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$200-$700',
    summary:
      'Pale, frosted-looking animals frequently combined with Sable and Lilly White. Often used as a feeder line into broader white-wall projects.',
    description:
      'Frost (sometimes "Frosty") describes a pale, near-white expression that some breeders maintain as a line, often paired with Sable or Lilly White to produce frosted-looking Lilly Whites and Sables. Listings such as "Frost line Sable Lilly White" appear regularly on MorphMarket, signaling that the line is recognized as a distinct contributor to the overall look. Like most aesthetic lines, the boundary between Frost and adjacent pale-base projects (cream, moonglow, white wall) is fuzzy.',
    visualIdentity: [
      'Cool-toned, frosted off-white base color',
      'Pattern (when present) reads as muted rather than high-contrast',
      'Often combined with Sable to produce a darker animal with frosted highlights, or Lilly White for ultra-pale results',
    ],
    identificationTips: [
      'Compare to a Cream or Moonglow animal; Frost reads cooler and less yellow',
      'Best diagnostic is the appearance of offspring when bred to a known non-Frost line',
      'In Frost x Sable combos, the contrast between dark Sable saturation and frosted highlights is more dramatic',
    ],
    verificationAdvice: [
      'Ask what specific Frost stock the animal came from and which breeder produced the line',
      'Pale animals are easy to mis-label; request photos of fired-up and fired-down states',
      'If sold as a Sable Frost combo, both traits should be independently verifiable',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=frost+line',
    relatedMorphs: ['lilly-white', 'sable', 'cream', 'moonglow'],
    caveats: [
      'Boundary between Frost, Cream, Moonglow, and White Wall is contested. Different breeders use the terms differently.',
    ],
  },
  {
    slug: 'arctic-sunset',
    name: 'Arctic Sunset',
    aliases: ['Arctic Sunset Line'],
    confidence: 'community-attributed',
    founder: 'Unclear; line is widely produced',
    founderUrl: null,
    origin: 'United States and Europe',
    established: 'circa 2016-2018',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$200-$500',
    summary:
      'Pastel cream-to-peach animals with soft gradient patterning. The signature look is "sunset over snow", warm cream base bleeding into orange or coral pattern.',
    description:
      'Arctic Sunset describes a phenotype rather than a single-source line. The recipe is a pastel cream or near-white base color with soft, diffuse patterning in warm tones (peach, coral, soft orange) that blends into rather than contrasting with the base. Multiple breeders work toward the look independently, which is why founder attribution is loose. Fringemorphs and several other US-based breeders have produced widely-circulated examples.',
    visualIdentity: [
      'Pastel cream or pale base color (not stark white)',
      'Pattern is warm-toned: peach, coral, soft orange (not deep red)',
      'Pattern edges blend into the base rather than defining sharp lines',
      'Overall impression is gradient or ombre, not high-contrast saddle',
    ],
    identificationTips: [
      'High-contrast harlequins on cream base are not Arctic Sunset; the soft blend is the differentiator',
      'Look at fired-up and fired-down photos; the warm gradient should hold through both states',
      'Compare to known Arctic Sunset photos on Fringemorphs and similar established producers',
    ],
    verificationAdvice: [
      'Ask the breeder which lineage they sourced from; the line is loosely defined so breeder transparency matters more than the name',
      'Request photos of parents; consistent expression across a pairing reinforces the line',
      'Beware of "Arctic Sunset" being used as a premium tag for any pale cream harlequin',
      'No central registry; check the breeder\'s track record on MorphMarket and social channels',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=arctic+sunset',
    relatedMorphs: ['cream', 'harlequin'],
    caveats: [],
  },
  {
    slug: 'xxx',
    name: 'XXX Line',
    aliases: ['Triple-X', 'XXX', 'Triple X'],
    confidence: 'disputed',
    founder: 'No single founder; term is a hobby descriptor for extreme pattern intensity',
    founderUrl: null,
    origin: 'Hobby-wide',
    established: 'early 2010s usage',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$250-$800',
    summary:
      'Used by various breeders to describe the densest, most extreme pattern coverage in their stock. Not a true bloodline; verification is breeder-by-breeder.',
    description:
      'XXX (also written Triple-X) is a pattern-intensity descriptor more than a true line. Breeders apply it to their most heavily-patterned harlequin, dalmatian, or extreme-harlequin animals, typically those with 60%+ pattern coverage including the head, body, and tail. Because the term is informal, two animals labeled XXX from two different breeders can look quite different. The hobby has drifted toward using XXX as a premium marketing tag rather than a tightly-defined breeding goal.',
    visualIdentity: [
      'Extreme pattern coverage, often 60% or more of visible body surface',
      'Pattern extends onto the head, dorsum, flanks, and tail (not just the back)',
      'High contrast between pattern and base in most cases',
      'Pattern elements can be saddle-like (extreme harlequin) or spotted (super dalmatian)',
    ],
    identificationTips: [
      'Visual standard varies by breeder; compare to the specific breeder\'s prior XXX animals before assuming the look',
      'Pattern that covers the head and limbs distinguishes XXX from standard heavy harlequin',
      'Ask the breeder what their internal XXX threshold is (pattern percentage, contrast, head coverage)',
    ],
    verificationAdvice: [
      'XXX is not a registered designation; treat it as the breeder\'s opinion of pattern intensity',
      'Ask for sibling photos; consistent XXX expression across a clutch reinforces the breeder\'s line',
      'Watch for sellers applying XXX to mid-tier harlequins to justify a premium',
      'Pattern can shift with age; juvenile XXX may settle into a less extreme adult phenotype',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=XXX',
    relatedMorphs: ['extreme-harlequin', 'super-dalmatian', 'harlequin'],
    caveats: [
      'XXX is closer to a marketing convention than a true line. Buyers should evaluate the animal on its own merits rather than the label.',
    ],
  },
  {
    slug: 'halloween',
    name: 'Halloween',
    aliases: ['Halloween Crested', 'Halloween Line'],
    confidence: 'verified',
    founder: 'Recognized as a trait by MorphMarket Morphpedia; no single named founder for the trait',
    founderUrl: 'https://www.morphmarket.com/morphpedia/crested-geckos/halloween/',
    origin: 'United States',
    established: 'recognized in hobby through the 2010s',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$150-$450',
    summary:
      'Two-color, two-pattern animals: an orange or red base with dark (near-black) pattern. MorphMarket lists Halloween as a recognized trait. Several breeders maintain Halloween-focused project lines.',
    description:
      'Halloween is recognized by MorphMarket Morphpedia as a distinct trait: an animal with strong orange-and-black contrast, evoking the holiday palette. The classic recipe is a saturated orange or red base with very dark (near-black) harlequin or pinstripe patterning. Several breeders maintain Halloween-focused project lines, refining the contrast and saturation over multiple generations. As with all aesthetic lines, the look is reproducible but not a single gene.',
    visualIdentity: [
      'Saturated orange or red base color (not pale yellow or cream)',
      'Very dark pattern: near-black, dark brown, or deep charcoal',
      'High contrast between base and pattern (the defining trait)',
      'Pattern is usually harlequin or pinstripe; dalmatian Halloween animals exist but are less common',
    ],
    identificationTips: [
      'Both colors should be saturated; faded orange with brown pattern is not Halloween',
      'Look at fired-up photos; Halloween animals hold the contrast even when fired down',
      'Distinguish from generic "dark harlequin on orange base", true Halloween has near-black pattern',
    ],
    verificationAdvice: [
      'Ask the breeder how many generations they have been selecting for the look',
      'Request parent photos; both parents expressing strong Halloween coloration is a green flag',
      'Check the breeder\'s track record on MorphMarket; specialists in Halloween animals will have several past listings',
      'Halloween is recognized as a trait but not a single gene, so juveniles may settle into the adult phenotype with age',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=halloween',
    relatedMorphs: ['harlequin', 'pinstripe', 'red-base', 'orange-base'],
    caveats: [
      'MorphMarket classifies Halloween as a trait rather than a project line. Listed here because the hobby still references "Halloween lines" when discussing multi-generation breeder projects.',
    ],
  },
  {
    slug: 'lilly-white-acr',
    name: 'ACR Lilly White Line',
    aliases: ['Anthony Caponetto Lilly White', 'ACR LW'],
    confidence: 'verified',
    founder: 'Anthony Caponetto Reptiles (ACR)',
    founderUrl: 'https://acreptiles.com/new_store/index.php?dispatch=categories.view&category_id=44',
    origin: 'United States',
    established: 'circa 2010',
    rarity: 'uncommon',
    priceTier: '$$$',
    priceRange: '$300-$1,500+',
    summary:
      'Founding line for the Lilly White morph. ACR is widely cited as the source and primary historical producer of Lilly White animals.',
    description:
      'Anthony Caponetto Reptiles (ACR) is widely credited as the source line for the Lilly White morph, an incomplete-dominant trait that became one of the most influential crested gecko discoveries of the 2010s. The line still operates and continues to produce Lilly White and Super Lilly White animals. Many other breeders\' Lilly White stock traces back to ACR foundation animals, either directly or through a few intermediate generations.',
    visualIdentity: [
      'High white or cream coverage across the body, especially the belly and lateral surfaces',
      'White expansion progresses as the animal matures; juveniles may show less white than adults',
      'Super Lilly Whites (homozygous) carry significantly more white, often near-solid',
      'Co-expresses cleanly with most pattern and base color morphs',
    ],
    identificationTips: [
      'White should be present on the belly and laterals, not just dorsally',
      'A genuine Lilly White matures into more white over time; static juveniles are suspicious',
      'Super Lilly White has been historically associated with reduced viability; verify the animal is healthy and feeding',
    ],
    verificationAdvice: [
      'Ask for pedigree tracing to ACR foundation animals, or at minimum to a breeder who acquired from ACR',
      'Lilly White is incomplete-dominant; LW x normal produces 50% visual LW, LW x LW produces 25% Super LW',
      'Visual Lilly White is required for the trait to express; there are no het Lilly Whites',
      'ACR\'s historical animals are well-documented; ask for the named ancestor in the pedigree if buying at a premium',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=lilly+white',
    relatedMorphs: ['lilly-white', 'super-lilly-white'],
    caveats: [
      'Lilly White as a morph is widely produced; the ACR-specific line is the historical foundation but no longer the only credible source.',
    ],
  },
  {
    slug: 'altitude-alt',
    name: 'ALT Line',
    aliases: ['Altitude line', 'Altitude Exotics line'],
    confidence: 'community-attributed',
    founder: 'Altitude Exotics',
    founderUrl: null,
    origin: 'United States',
    established: 'circa 2014-2016',
    rarity: 'uncommon',
    priceTier: '$$',
    priceRange: '$200-$500',
    summary:
      'Breeder-philosophy line from Altitude Exotics, emphasizing vibrant warm colors, dense pattern, and robust body structure.',
    description:
      'ALT (sometimes Altitude line) is associated with Altitude Exotics. The line is less about a specific phenotype and more about a breeding philosophy: vibrant warm-tone colors (deep reds, saturated oranges), complex pattern combining harlequin with pinstripe or dalmatian elements, and emphasis on healthy, robust body structure. ALT-tagged animals appear on MorphMarket through both Altitude Exotics directly and affiliate breeders who worked from Altitude foundation stock.',
    visualIdentity: [
      'Saturated warm color tones (deep red, intense orange, warm yellow)',
      'Dense, complex pattern often layering multiple morph elements',
      'Solid body structure with good crest development',
      'Pattern reads as intentional and balanced, not extreme like XXX',
    ],
    identificationTips: [
      'Cross-reference candidate animals against Altitude Exotics social media or website photos',
      'ALT animals show consistent breeder style across multiple individuals, look for that consistency',
      'A vibrant red or orange harlequin alone is not enough; the body structure and pattern complexity also matter',
    ],
    verificationAdvice: [
      'Altitude Exotics is a named, identifiable breeder; ask sellers to confirm the line back to Altitude stock',
      'Cross-check the seller\'s MorphMarket and social media presence',
      'When buying ALT-labeled animals from third parties, ask which generation removed from Altitude foundation',
      'Altitude Exotics maintains a public social presence; reach out directly for high-value verification',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=altitude',
    relatedMorphs: ['harlequin', 'red-base', 'orange-base'],
    caveats: [
      'ALT is more of a breeder-philosophy line than a single phenotype. Verification depends on the seller\'s connection to Altitude Exotics.',
    ],
  },
  {
    slug: 'foundation-genetics',
    name: 'Foundation Genetics Lines',
    aliases: ['Lil Monsters Foundation', 'FG lines'],
    confidence: 'verified',
    founder: 'Lil Monsters Reptiles',
    founderUrl: 'https://lmreptiles.com/foundation-genetics/',
    origin: 'North America',
    established: 'ongoing project; documentation series began 2021',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$400-$1,500',
    summary:
      'Lil Monsters Reptiles maintains breeding lines drawn from wild-caught imports, original Repashy-era foundation stock, and proven designer morphs. The focus is structure, wide dorsals, crest size, nose, and jawline.',
    description:
      'Lil Monsters Reptiles\' Foundation Genetics project is a multi-part documentation series and an active breeding program working from wild-caught lines, originally-imported lines (the 1995-1998 Repashy/de Vosjoli/Fast era), and proven designer morphs from across North America including several Canadian sources. The breeding focus is structural: wide dorsals, large crest, defined nose, strong jawline. The Foundation Genetics articles are a leading hobby-side resource for understanding crested gecko genetics from first principles.',
    visualIdentity: [
      'Strong structural traits: wide dorsal stripe, well-developed crest, defined nose',
      'Diverse color palette since lines source from many regions and projects',
      'Robust body proportions',
      'Pedigree often traces directly back to original imports or named foundation breeders',
    ],
    identificationTips: [
      'Look at structure first: dorsal width, crest, jawline are the line\'s breeding focus',
      'Color and pattern vary widely; the line is not defined by a specific look',
      'Pedigree documentation is the surest identification path; FG-line animals typically come with named ancestors',
    ],
    verificationAdvice: [
      'Lil Monsters Reptiles is a named, documented breeder; verify via their website and Foundation Genetics article series',
      'Ask for the foundation stock the line traces to (named wild-caught import, named Repashy-era animal, etc.)',
      'Foundation Genetics is a long-form documented project, so seller transparency about lineage should be high',
      'Cross-reference against the Foundation Genetics article series for line-specific notes',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=foundation+genetics',
    relatedMorphs: [],
    caveats: [],
  },
  {
    slug: 'phantom-line',
    name: 'Phantom Line',
    aliases: ['Phantom Project'],
    confidence: 'disputed',
    founder: 'No single founder; term is used inconsistently in the hobby',
    founderUrl: null,
    origin: 'United States and Europe',
    established: 'mid-2010s usage',
    rarity: 'rare',
    priceTier: '$$$',
    priceRange: '$300-$900',
    summary:
      'NAMING COLLISION: Phantom is a recognized pattern descriptor (Phantom Pinstripe) and is also used loosely as a line name for animals with ghostly, reduced-contrast patterning. Always ask which the seller means.',
    description:
      'Phantom is one of the trickier terms in crested gecko vocabulary. Most commonly, "Phantom Pinstripe" refers to a pinstripe animal where the dorsal stripe is incomplete or broken, creating a ghostly look. Some breeders also use "Phantom line" to describe project animals with low-contrast, washed-out patterning in general. The term is not standardized, and buyers should always ask the seller for their specific definition before assuming.',
    visualIdentity: [
      'Reduced contrast between pattern and base (ghostly appearance)',
      'In Phantom Pinstripe: incomplete or broken dorsal pinstripe',
      'In broader Phantom usage: low-saturation overall expression',
    ],
    identificationTips: [
      'Always ask the seller: "Do you mean Phantom Pinstripe specifically, or a Phantom line phenotype more broadly?"',
      'Phantom Pinstripe is well-recognized; broader Phantom lines are not standardized',
      'Compare contrast levels between Phantom and standard animals from the same breeder',
    ],
    verificationAdvice: [
      'Get specific: is this Phantom Pinstripe (pattern descriptor) or a project line (selective breeding)?',
      'For project line claims, ask for multi-generation photos showing consistent low-contrast expression',
      'Phantom is sometimes used as a premium tag for animals that simply have weak pattern; buyer beware',
      'No central registry exists for Phantom lines; rely on breeder reputation',
    ],
    morphMarketSearchUrl: 'https://www.morphmarket.com/c/reptiles/lizards/crested-geckos/index?q=phantom',
    relatedMorphs: ['pinstripe'],
    caveats: [
      'Phantom Pinstripe is a well-defined pattern descriptor. "Phantom line" as a broader project is loosely defined and varies by breeder.',
    ],
  },
];

/**
 * Lookup helper for a project line by slug. Matches the getMorph() helper
 * in morph-guide.js so the same calling pattern works in both files.
 */
export function getProjectLine(slug) {
  if (!slug) return null;
  return PROJECT_LINES.find((l) => l.slug === slug) || null;
}
