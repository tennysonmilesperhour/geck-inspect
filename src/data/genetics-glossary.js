/**
 * Genetics Guide — glossary data.
 * Extracted from GeneticsGuide.jsx for maintainability.
 */

// instead of a flat alphabetical blob. Each entry has term + definition.
const GLOSSARY_GROUPS = [
  {
    category: 'Core Genetics',
    entries: [
      { term: 'DNA', def: 'The molecule that carries genetic instructions. Long chains of four chemical bases (A, T, C, G) wound into a double helix.' },
      { term: 'Gene', def: 'A stretch of DNA that codes for a specific trait or protein. Every gene sits at a specific location (locus) on a chromosome.' },
      { term: 'Locus', def: 'The specific physical address on a chromosome where a given gene lives. Paired chromosomes share matching loci.' },
      { term: 'Allele', def: 'A specific version of a gene. Every gecko has two alleles per gene — one from each parent.' },
      { term: 'Chromosome', def: 'A long strand of DNA wound around structural proteins. Crested geckos have 38 chromosomes arranged as 19 pairs.' },
      { term: 'Diploid', def: 'Having two copies of each chromosome — the normal state for most animals including crested geckos.' },
      { term: 'Gamete', def: 'A reproductive cell (sperm or egg) that carries ONE allele from each pair, produced by meiosis.' },
      { term: 'Meiosis', def: 'The cell-division process that produces gametes. Each gamete gets a random one of the two alleles at every gene.' },
      { term: 'Fertilization', def: 'The moment when sperm and egg combine, producing a diploid embryo with one allele from each parent at every gene.' },
      { term: 'Homozygous', def: 'Both alleles at a gene are identical (written AA or aa). The animal has two of the same thing.' },
      { term: 'Heterozygous (Het)', def: 'The two alleles at a gene are different (written Aa). Carries one copy of a recessive without showing it.' },
      { term: 'Genotype', def: 'The actual genetic code an animal carries (AA, Aa, aa). Invisible without lineage or progeny testing.' },
      { term: 'Phenotype', def: 'The visible appearance of an animal. Two geckos can share a phenotype with very different genotypes.' },
      { term: 'Wild type', def: 'The default, non-morph form of the species — what crested geckos look like in nature before selective breeding.' },
    ],
  },
  {
    category: 'Inheritance Patterns',
    entries: [
      { term: 'Dominant', def: 'A trait expresses with only one copy of the allele present. Rare in proven crested gecko morphs.' },
      { term: 'Recessive', def: 'A trait only expresses when two copies are present. Axanthic is the cleanest crested gecko example.' },
      { term: 'Incomplete Dominant', def: 'Single copy produces a visible form; two copies produce a distinct "super" form. Most proven crested gecko morphs work this way.' },
      { term: 'Codominant', def: 'Both alleles express simultaneously without blending. Used loosely in the hobby — most so-called codominant cresties are technically incomplete dominant.' },
      { term: 'Mendelian', def: 'Following the simple single-gene inheritance patterns first described by Gregor Mendel. Many proven crested gecko morphs are Mendelian; most trait expression is not.' },
      { term: 'Polygenic', def: 'A trait controlled by many genes with additive effects. Cannot be Punnett-squared. Base color, harlequin, flame, and dalmatian spotting are all polygenic.' },
      { term: 'Epistasis', def: 'One gene masks or modifies the expression of another. Axanthic masking red color is a crested gecko example.' },
      { term: 'Penetrance', def: 'The % of individuals with a given genotype that actually show the trait. High penetrance = almost always visible; low penetrance = often hidden.' },
      { term: 'Expressivity', def: 'The degree to which a trait shows up visually when it does show. A morph with variable expressivity looks dramatically different across individuals.' },
      { term: 'Autosomal', def: 'Located on a non-sex chromosome. All proven crested gecko morphs are autosomal — the animal\'s sex doesn\'t affect inheritance.' },
      { term: 'Sex-linked', def: 'A gene located on a sex chromosome. Common in some reptile lineages, but not documented in crested geckos.' },
    ],
  },
  {
    category: 'Carrier Status & Proof',
    entries: [
      { term: 'Visual', def: 'The animal displays the trait — homozygous for a recessive, or one/two copies of an incomplete dominant.' },
      { term: '100% Het', def: 'Parentage guarantees the animal carries one copy of the recessive. Example: offspring from visual × non-carrier.' },
      { term: '66% Possible Het', def: 'A normal-looking offspring from a het × het pairing. Statistically, 2 of 3 such offspring carry the gene, but there\'s no way to know which one.' },
      { term: '50% Possible Het', def: 'One parent is confirmed het; the other is unknown. The offspring has a 50/50 chance of carrying the gene.' },
      { term: 'Proven', def: 'An inheritance claim demonstrated through documented, controlled breeding results — not assumed from appearance.' },
      { term: 'Proven Producer', def: 'An animal whose offspring have been evaluated and confirm the breeding value claims made about it.' },
      { term: 'Progeny Testing', def: 'Pairing a suspected carrier with a known animal and examining offspring to confirm whether the suspected genetics are real.' },
      { term: 'Test Pair', def: 'A pairing specifically done to verify a genetic claim, rather than to produce animals for sale.' },
    ],
  },
  {
    category: 'Generations & Pairings',
    entries: [
      { term: 'P (Parental)', def: 'The original founder generation before any crosses for a project have been made.' },
      { term: 'F1 (Filial 1)', def: 'First-generation offspring from the original pairing. Example: visual axanthic × non-carrier → all F1 are 100% het.' },
      { term: 'F2 (Filial 2)', def: 'Second-generation offspring, typically from F1 × F1. The generation where recessive visuals usually first appear.' },
      { term: 'F3', def: 'Third generation. Serious recessive projects usually take this long to stabilize.' },
      { term: 'Outcross', def: 'Pairing with an unrelated animal (usually to bring in fresh blood or new traits).' },
      { term: 'Inbreeding', def: 'Pairing closely related animals (siblings, parent/offspring). Concentrates both desirable and undesirable recessives.' },
      { term: 'Linebreeding', def: 'Moderate inbreeding within a specific line to fix desired traits while maintaining some diversity.' },
      { term: 'Founder', def: 'An original, unrelated animal brought into a breeding project. The starting point of a new line.' },
      { term: 'Inbreeding Coefficient', def: 'A numeric measure of how inbred an animal is. Useful for comparing line health over generations.' },
    ],
  },
  {
    category: 'Pigment & Physiology',
    entries: [
      { term: 'Chromatophore', def: 'A specialized skin cell containing pigment or reflective crystals. Crested geckos have three types layered in the skin.' },
      { term: 'Melanophore', def: 'The deepest chromatophore layer. Contains dark melanin and spreads/clumps to shift fire state.' },
      { term: 'Xanthophore', def: 'The top chromatophore layer. Produces yellow and red pigments. Absent in axanthic geckos.' },
      { term: 'Iridophore', def: 'The middle chromatophore layer. Reflective crystal platelets produce brightness and shimmer.' },
      { term: 'Fired Up', def: 'The dark, saturated color state crested geckos enter at night or under stress — melanin granules spread through the skin.' },
      { term: 'Fired Down', def: 'The pale, washed-out color state during the day — melanin clumped, iridophore reflectivity dominant.' },
      { term: 'Base Color', def: 'The underlying polygenic color of a gecko — red, yellow, buckskin, olive, etc. Independent of pattern.' },
    ],
  },
  {
    category: 'Morphs & Traits',
    entries: [
      { term: 'Morph', def: 'A genetically distinct variant with a KNOWN, predictable inheritance pattern. Lilly White, Axanthic, and Cappuccino are morphs.' },
      { term: 'Trait', def: 'A phenotypic characteristic whose precise genetics isn\'t mapped — usually polygenic. Harlequin, pinstripe, flame, and dalmatian are traits.' },
      { term: 'Lilly White (LW)', def: 'Incomplete-dominant morph with high-contrast white body markings. Single copy = visual LW. Two copies = Super LW (embryonic-lethal).' },
      { term: 'Super Lilly White', def: 'The homozygous form of Lilly White. Confirmed embryonic-lethal — eggs develop partially then fail to hatch.' },
      { term: 'Axanthic', def: 'Recessive morph lacking yellow/red pigment. Appears gray/white/black regardless of base color genes. Two copies required.' },
      { term: 'Cappuccino', def: 'Incomplete-dominant morph with dark coffee-brown coloration and a connected dorsal pattern. Super form is Frappuccino.' },
      { term: 'Frappuccino', def: 'Homozygous (super) form of Cappuccino. More extreme expression; some breeders report viability concerns.' },
      { term: 'Soft Scale', def: 'Incomplete-dominant morph with smaller, softer scales. Super form exists with some reported fertility concerns.' },
      { term: 'White Wall', def: 'Incomplete-dominant morph producing a distinct white lateral stripe along the belly wall.' },
      { term: 'Harlequin', def: 'Polygenic pattern trait — high-contrast lateral markings extending up the body. Graded from partial to "extreme."' },
      { term: 'Pinstripe', def: 'Polygenic pattern trait — a raised cream dorsal stripe. Expressed partial to 100%.' },
      { term: 'Dalmatian', def: 'Polygenic pattern trait — dark spotting across the body, sparse to extreme.' },
      { term: 'Flame', def: 'Polygenic pattern trait — lateral "flame" markings rising from the belly up the sides.' },
      { term: 'Patternless', def: 'Polygenic pattern trait — solid base color with no dorsal or lateral pattern.' },
      { term: 'Tiger / Brindle', def: 'Polygenic pattern traits producing lateral banding or broken striping.' },
      { term: 'Super Dalmatian', def: 'A polygenic extreme of dalmatian spotting — NOT a proven Mendelian super form despite the "super" name.' },
      { term: 'Phantom Pinstripe', def: 'Polygenic pinstripe variant with partial, broken, or faint expression. NOT a proven recessive morph.' },
    ],
  },
  {
    category: 'Breeding Strategy',
    entries: [
      { term: 'Selective Breeding', def: 'Consistently pairing animals displaying desired traits across multiple generations to shift polygenic expression.' },
      { term: 'Breeding Value', def: 'Genetic potential an animal contributes to offspring beyond its own display. Revealed only through progeny testing.' },
      { term: 'Heritability (h²)', def: 'The proportion of variation in a trait that\'s actually due to genetics vs environment. Ranges from 0 (pure environment) to 1 (pure genetics).' },
      { term: 'Selection Differential', def: 'The gap between the average of your breeding animals and the average of your whole collection. Larger gap = stronger selection pressure.' },
      { term: 'Response to Selection', def: 'The actual shift in offspring phenotype vs parents. Equals heritability × selection differential.' },
      { term: 'Holdback', def: 'An offspring kept from the sale pool because the breeder wants to use it for future breeding or evaluation.' },
      { term: 'Culling', def: 'Removing an animal from the breeding program — via sale, pet-out, or (less commonly) euthanasia. A necessary part of directional selection.' },
      { term: 'Outbreeding Depression', def: 'Loss of adaptive traits when two very distinct lines are crossed. Rare in cresties but real for some reptile species.' },
      { term: 'Inbreeding Depression', def: 'Reduced fitness, fertility, or vigor from excessive inbreeding. Why thoughtful outcrosses matter.' },
    ],
  },
  {
    category: 'Tools & Terminology',
    entries: [
      { term: 'Punnett Square', def: 'A 2×2 grid tool for predicting offspring genetic probabilities from a Mendelian pairing. Does not apply to polygenic traits.' },
      { term: 'Lethal Allele', def: 'An allele whose homozygous form prevents normal development. Super Lilly White is the textbook crested gecko example.' },
      { term: 'Super Form', def: 'The homozygous expression of an incomplete dominant (Super LW, Frappuccino, Super Soft Scale). Sometimes more extreme, sometimes lethal.' },
      { term: 'Stacking Morphs', def: 'Combining multiple proven morphs into a single animal (e.g. Lilly White + Cappuccino + Axanthic het). The holy grail of most breeding projects.' },
      { term: 'Morph Combo', def: 'An animal carrying two or more proven morphs simultaneously.' },
      { term: 'Cresto (or Crestie)', def: 'Hobby nickname for a crested gecko (Correlophus ciliatus).' },
      { term: 'Correlophus ciliatus', def: 'The scientific name for the crested gecko. Previously classified as Rhacodactylus ciliatus until 2012.' },
    ],
  },
];

// Flat list used by the glossary search. Preserves category for display.
const GLOSSARY = GLOSSARY_GROUPS.flatMap((g) =>
  g.entries.map((e) => ({ ...e, category: g.category }))
);

export { GLOSSARY_GROUPS, GLOSSARY };
