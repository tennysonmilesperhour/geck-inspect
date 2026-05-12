/**
 * Genetics Guide ,  section content data.
 * Each section has an id, title, level, icon reference, and JSX-renderable body.
 * Extracted from GeneticsGuide.jsx for maintainability.
 */
import React from "react";
import {
  PunnettSquare,
  AllelePair,
  OutcomeBar,
  PolygenicGradient,
  PigmentLayers,
  LethalAlleleDiagram,
  EpistasisDiagram,
  DoseResponse,
} from "@/components/genetics/GeneticsDiagrams";
import { Callout, Subsection, BulletList } from "@/components/genetics/GeneticsHelpers";
import { Dna, Grid2X2, Layers, TrendingUp, ShieldCheck, ArrowUp, AlertTriangle, Palette } from "lucide-react";

const SECTIONS = [
  {
    id: 'foundations',
    title: 'Foundations of Genetics',
    level: 'Beginner',
    icon: Dna,
    intro: 'Before diving into crested gecko morphs, you need the basic language of genetics. Every concept in this section applies to every living thing ,  including your geckos.',
    subsections: [
      {
        title: 'What is a Gene?',
        content: (
          <BulletList items={[
            'A gene is a segment of DNA that carries instructions for a trait ,  melanin production, scale shape, pattern layout, eye color, and so on.',
            'Each gecko inherits two copies of every gene, one from the sire and one from the dam. These two copies are called alleles.',
            'Most traits ,  especially coloration and pattern ,  are influenced by many genes working together, not a single switch. Those are "polygenic" and are covered in their own section.',
          ]} />
        )
      },
      {
        title: 'Alleles: The Two Copies',
        content: (
          <>
            <BulletList items={[
              'An allele is a specific version of a gene. Every gecko has two alleles per gene ,  one from each parent.',
              'Homozygous: the two alleles are identical (written AA or aa). The animal has two of the same thing.',
              'Heterozygous: the two alleles are different (written Aa). The animal is carrying two different versions of the same gene.',
              'Whether a trait shows up visually depends on which alleles the gecko carries AND how those alleles interact ,  dominant, recessive, or incomplete-dominant.',
              'Locus: the specific address on a chromosome where a given gene lives. Paired chromosomes share matching loci, so your gecko\'s two alleles at a given gene always sit across from each other.',
            ]} />
            <AllelePair left="A" right="a" caption="Heterozygous (Aa) ,  one copy from each parent at the same gene locus." />
          </>
        )
      },
      {
        title: 'DNA, Chromosomes, and Gametes',
        content: (
          <BulletList items={[
            'DNA is the molecule that carries the genetic instructions. A gene is a stretch of DNA that codes for a specific trait.',
            'Chromosomes are long strands of DNA wound around structural proteins. Crested geckos have 38 chromosomes arranged as 19 pairs.',
            'When a gecko produces a gamete (sperm or egg), each gamete carries ONE random allele from each pair ,  a process called meiosis. Which allele gets passed is a 50/50 coin flip per pair.',
            'At fertilization, the sperm\'s allele lines up with the egg\'s allele and the offspring inherits both. That\'s why every baby gecko is genetically a unique remix of its parents, never an exact copy.',
          ]} />
        )
      },
      {
        title: 'Dominant, Recessive, and Incomplete Dominant',
        content: (
          <>
            <BulletList items={[
              'Dominant: a single copy is enough to show the trait. The gecko looks the same whether it has one or two copies.',
              'Recessive: the trait only shows when both alleles are the recessive version. A single copy is "het" ,  invisible but still passable to offspring. Axanthic is the cleanest crested gecko example.',
              'Incomplete dominant: one copy produces the visual form, and two copies produce a more extreme "super" form. MOST proven crested gecko morphs work this way ,  Lilly White, Cappuccino, Soft Scale, and White Wall are all incomplete dominants.',
              'Codominant in the strict sense (both alleles expressing simultaneously without blending) is rare in crested geckos. The hobby uses "codominant" and "incomplete dominant" loosely.',
            ]} />
            <Callout items={[
              'Most proven crested gecko morphs are incomplete dominant, not recessive',
              'Visual assessment of het status is never valid for any recessive',
              'The "super" form of an incomplete dominant can be extreme ,  or lethal',
            ]} />
          </>
        )
      },
      {
        title: 'Genotype vs. Phenotype',
        content: (
          <BulletList items={[
            'Genotype: the genetic code ,  the actual alleles the animal carries (AA, Aa, aa).',
            'Phenotype: the visible appearance ,  what the animal actually looks like.',
            'Two geckos can share a phenotype but have different genotypes. A 100% het axanthic and a non-carrier look IDENTICAL, but only one of them can produce visual axanthic babies.',
            'This distinction is the single most important concept in serious breeding. "Looks like" is not "is".',
          ]} />
        )
      },
    ]
  },
  {
    id: 'punnett',
    title: 'Punnett Squares & Probability',
    level: 'Beginner',
    icon: Grid2X2,
    intro: 'A Punnett square predicts possible genetic outcomes of a pairing. It shows probabilities across many offspring ,  not guarantees for individual clutches.',
    subsections: [
      {
        title: 'How to Read a Punnett Square',
        content: (
          <>
            <BulletList items={[
              'A 2×2 grid ,  one parent\'s alleles across the top, the other\'s down the side.',
              'Each of the four inner cells represents one possible offspring combination, each with 25% probability.',
              'The same combination in multiple boxes increases probability: two boxes = 50%, three = 75%, four = 100%.',
              'Punnett squares show probability, not certainty. A 25% chance of a visual does NOT guarantee one per four eggs ,  you can get four visuals in a row, or none across twelve eggs. It all averages out over many clutches.',
            ]} />
            <PunnettSquare
              sireAlleles={['A', 'a']}
              damAlleles={['A', 'a']}
              caption="A generic Aa × Aa square. Top row = sire alleles, left column = dam alleles. Each cell is one 25% outcome."
            />
          </>
        )
      },
      {
        title: 'Het × Het (Aa × Aa)',
        content: (
          <>
            <BulletList items={[
              'When both parents carry one copy of a recessive but look normal (Aa × Aa):',
              '25% AA ,  does not carry the gene at all',
              '50% Aa ,  het, looks normal, carries the gene invisibly',
              '25% aa ,  visual (displays the trait)',
              'Of the visually normal offspring specifically (AA + Aa), 2 out of 3 statistically carry the gene ,  those are your "66% possible hets."',
            ]} />
            <PunnettSquare
              sireAlleles={['A', 'a']}
              damAlleles={['A', 'a']}
              highlight={(combo) => (combo === 'aa' ? 'visual' : combo === 'Aa' ? 'het' : 'normal')}
              caption="Het × Het. Purple cell = visual (aa), emerald = het carrier (Aa), slate = non-carrier (AA)."
            />
            <OutcomeBar
              caption="Expected offspring ratio from Aa × Aa."
              segments={[
                { label: 'Non-carrier', pct: 25, tint: '#475569' },
                { label: 'Het carrier', pct: 50, tint: '#10b981' },
                { label: 'Visual', pct: 25, tint: '#a855f7' },
              ]}
            />
            <Callout items={[
              'Aa × Aa = 25% visual, 50% het, 25% non-carrier',
              'This is the standard pairing to produce visual recessives',
              'Requires patience ,  multiple clutches needed for reliable results',
            ]} />
          </>
        )
      },
      {
        title: 'Het x Visual (Aa x aa)',
        content: (
          <BulletList items={[
            '50% Aa ,  het offspring, looks normal, carries the gene',
            '50% aa ,  visual offspring',
            'More efficient than het x het for producing visuals. The tradeoff is cost ,  visual animals from quality lines are more expensive.',
          ]} />
        )
      },
      {
        title: 'Visual x Non-Carrier (aa x AA)',
        content: (
          <BulletList items={[
            '100% of offspring are het (Aa) ,  none will be visual, but all carry the gene.',
            'This is how breeders introduce a recessive into a new bloodline without losing other desirable traits. Hets can be back-paired in the next generation.',
          ]} />
        )
      },
      {
        title: 'Multiple Traits',
        content: (
          <BulletList items={[
            'Tracking two independent recessives simultaneously: probability compounds multiplicatively.',
            'Double het × double het = 6.25% chance per offspring of being visual for both traits.',
            'Each additional recessive cuts the odds by ~75% again.',
            'Use the Genetic Calculator in this app for multi-trait calculations.',
          ]} />
        )
      },
      {
        title: 'Incomplete Dominant Dose-Response',
        content: (
          <>
            <BulletList items={[
              'For incomplete dominants (Lilly White, Cappuccino, Soft Scale, etc.) the math is different ,  "how many copies" matters visually:',
              '0 copies: normal appearance.',
              '1 copy: the visual morph (the form you see most often for sale).',
              '2 copies: the "super" form, which is usually more extreme ,  and sometimes lethal.',
              'Punnett squares still work, but instead of "visual vs het vs normal" think "super vs visual vs normal".',
            ]} />
            <DoseResponse
              traitName="Lilly White"
              superLabel="Super LW"
              caption="Incomplete-dominant dose-response. One copy gives the visible morph, two copies shift to a more extreme form."
            />
          </>
        )
      },
      {
        title: 'F1, F2, and Beyond ,  Generation Naming',
        content: (
          <BulletList items={[
            'F1 (filial 1): the first-generation offspring from your original pairing. If you bring in a visual axanthic and pair it with a non-carrier, every F1 baby is a 100% het.',
            'F2: the second generation ,  offspring of two F1 animals (or one F1 × something else). When you F1 × F1 a recessive project, the F2 generation is where you finally see visuals appear in 25% of the clutch.',
            'F3 and beyond: continuing the project. Most serious projects take at least an F2 or F3 before you have stable lines of proven visuals.',
            'P (parental): the original founder generation before F1. Useful shorthand when writing up breeding records.',
            'Naming conventions matter when documenting a project publicly ,  an "F2 visual cappuccino from proven hets" is meaningfully different from an "F1 het from a pet-store pairing."',
          ]} />
        )
      },
    ]
  },
  {
    id: 'proven-morphs',
    title: 'Proven Mendelian Morphs',
    level: 'Advanced',
    icon: Layers,
    intro: 'Only a handful of crested gecko traits have been proven as single-gene Mendelian morphs with predictable inheritance. Almost all of them are incomplete dominants ,  single copy looks one way, double copy is more extreme, and in several cases the double copy carries real risks.',
    subsections: [
      {
        title: 'Morph vs. Trait ,  Why It Matters',
        content: (
          <>
            <BulletList items={[
              'A MORPH is a genetically distinct variant with a known, predictable inheritance pattern that has been demonstrated through controlled breeding. Lilly White, Axanthic, and Cappuccino are morphs.',
              'A TRAIT (or "line") is a phenotypic characteristic whose precise genetics aren\'t fully mapped ,  usually polygenic. Harlequin, pinstripe, flame, and dalmatian are traits.',
              'Both are legitimate and both add value to breeding projects. The distinction matters for pricing, documentation, and what you can promise buyers.',
              'A useful test: "If I pair two visuals of this, can I predict the offspring ratios?" If yes, it\'s a proven morph. If the answer is "my best animals tend to come from my best animals," it\'s polygenic.',
            ]} />
          </>
        )
      },
      {
        title: 'Lilly White (LW)',
        content: (
          <>
            <BulletList items={[
              'Inheritance: INCOMPLETE DOMINANT. Single copy = visual Lilly White. Two copies = Super Lilly White, which is embryonic-lethal ,  fertilized eggs develop partially then fail to hatch. Never pair two Lilly Whites together.',
              'Visual expression: distinct areas of pure white or pale cream, usually on the lateral body walls, tail, and sometimes the head. Not to be confused with "whitewall" traits, fire-up pale markings, or cream harlequin extension.',
              'Discovered: in 2014 by Lilly Exotics. Named for the breeder, not the color.',
              'Pairing strategy: Lilly White × Normal produces ~50% visual Lilly White + ~50% normal. This is the ONLY safe way to produce more LW.',
              'Price: high-quality visual LW typically $500–$1500+ depending on base trait combinations and breeder reputation.',
            ]} />
            <Callout items={[
              'LW × Normal → 50% visual LW, 50% normal (SAFE)',
              'LW × LW → 25% lethal Super LW, 50% visual LW, 25% normal (AVOID)',
              'Visual LW assessment requires lineage ,  pale markings alone are not proof',
            ]} />
          </>
        )
      },
      {
        title: 'Axanthic',
        content: (
          <>
            <BulletList items={[
              'Inheritance: RECESSIVE. Two copies required for the visual form. Het axanthics look completely normal ,  no visual clue.',
              'Visual expression: the cleanest recessive in the hobby. Axanthic animals lack xanthophore cells (responsible for yellow and red pigments). They appear in shades of white, gray, and black regardless of their underlying "base color" genetics. No orange, red, or yellow tones ever show ,  even when fired up.',
              'Two proven lines exist: the "WC" (Whitewall Caliber) line and the "VIP" line. They are BELIEVED to be the same gene but this has not been fully confirmed in all crosses.',
              'Pairing strategies: Axanthic × Axanthic → 100% visual. Axanthic × Het → 50% visual, 50% het. Het × Het → 25% visual, 50% het, 25% non-carrier.',
              'Common pitfall: a "dark" or "muted" appearance is NOT evidence of axanthic het status. The only way to confirm a het is lineage or test-breeding to a visual.',
            ]} />
          </>
        )
      },
      {
        title: 'Cappuccino',
        content: (
          <>
            <BulletList items={[
              'Inheritance: INCOMPLETE DOMINANT. Single copy = Cappuccino (distinct dark "coffee" coloration with an extended, connected dorsal pattern). Two copies = Super Cappuccino, commonly called FRAPPUCCINO, with more extreme color and pattern.',
              'Visual expression: a signature connected dorsal pattern that runs from the nape down the spine, usually in warm chocolate tones. Body coloration tends toward rich browns. Eye rims and crest lines often darker than normal.',
              'Super form viability: Frappuccinos exist and are bred, but there is ongoing debate about sublethal effects ,  some breeders report reduced clutch sizes or health issues from Cappuccino × Cappuccino pairings. Proceed with caution and document outcomes.',
              'Pairing strategy: Cappuccino × Normal is the safest pairing. It produces ~50% Cappuccino, ~50% normal offspring.',
              'Price: visual Cappuccino commonly $400–$1200+. Frappuccino pricing varies widely with health reputation of the line.',
            ]} />
            <Callout items={[
              'Cappuccino × Normal → 50% visual Cappuccino, 50% normal (SAFEST)',
              'Cappuccino × Cappuccino → 25% Frappuccino, 50% Cappuccino, 25% normal (DOCUMENT OUTCOMES)',
              'Not every brown crested gecko with a dorsal pattern is Cappuccino ,  lineage confirms it',
            ]} />
          </>
        )
      },
      {
        title: 'Soft Scale (Soft-Scaled Crestie)',
        content: (
          <BulletList items={[
            'Inheritance: INCOMPLETE DOMINANT. Single copy = Soft Scale (smaller, softer, silkier scales). Two copies = Super Soft Scale, with more dramatic expression and ongoing concerns around fertility and viability.',
            'Visual expression: the skin texture is noticeably softer and the scales reduced in prominence. Often paired with distinctive coloration due to the altered skin structure interacting with pigment layers.',
            'Genetic status: proven incomplete dominant. Super form exists but breeders report some reproductive issues; many avoid Soft Scale × Soft Scale pairings.',
            'Pairing strategy: Soft Scale × Normal is the standard approach. Like Lilly White, the safest path to more soft-scaled offspring.',
          ]} />
        )
      },
      {
        title: 'White Wall',
        content: (
          <BulletList items={[
            'Inheritance: INCOMPLETE DOMINANT. Single copy = White Wall (a distinct white stripe along the lateral belly wall, below the lateral pattern zone). Two copies may produce a more pronounced "Super White Wall" with additional white extension.',
            'Visual expression: a clean white lateral band that sits below where the harlequin extension would normally appear. It\'s structural ,  comes from documented lineage, not random pale coloration.',
            'Pairing strategy: White Wall × Normal is the typical approach. The gene stacks well with harlequin, pinstripe, and cappuccino traits.',
            'Often confused with White-Spot or generic pale markings ,  require lineage to verify.',
          ]} />
        )
      },
      {
        title: 'Phantom Pinstripe ,  polygenic, not Mendelian',
        content: (
          <BulletList items={[
            'Despite the name, Phantom Pinstripe is NOT a proven recessive morph. It\'s a pattern-expression style within the pinstripe family ,  a pinstripe that is partial, broken, or nearly invisible.',
            'Some older guides list Phantom as a separate recessive. That has not been replicated in controlled breeding. Treat it as a polygenic pattern trait.',
            'If you\'re buying an animal marketed as "het phantom," ask for the pairing documentation and manage your expectations ,  the outcome is not predictable by Punnett square.',
          ]} />
        )
      },
    ]
  },
  {
    id: 'polygenic',
    title: 'Polygenic Traits ,  The Real Art',
    level: 'Beginner',
    icon: Palette,
    intro: 'Most of what makes a crested gecko visually stunning is NOT a single gene. Base color, harlequin extension, pinstripe fullness, dalmatian spotting, flame contrast ,  all polygenic. Understanding how to work with polygenic traits separates serious breeders from hobbyists.',
    subsections: [
      {
        title: 'What Makes a Trait Polygenic?',
        content: (
          <>
            <BulletList items={[
              'A polygenic trait is controlled by many genes, each contributing a small additive effect to the final phenotype.',
              'The result is a CONTINUOUS SPECTRUM of expression ,  not a clean on/off switch. That\'s why crested gecko coloration ranges smoothly from pale cream to vibrant red rather than jumping between two states.',
              'You CANNOT predict polygenic outcomes with a Punnett square. You can only INFLUENCE them through consistent selective breeding over multiple generations.',
              'Two stunning parents often produce offspring that span a wide quality range. Some will exceed both parents, some will fall short. This is normal and expected.',
              'Qualitative vs quantitative traits: a qualitative trait is discrete (has it / doesn\'t have it ,  like visual Lilly White). A quantitative trait sits on a scale (dalmatian spot count, red pigment saturation). Polygenics are almost all quantitative.',
            ]} />
            <PolygenicGradient caption="Polygenic traits form a continuous spectrum. A 'red' crested gecko isn't red or not-red ,  it sits somewhere on a gradient from muted to extreme, shaped by dozens of small-effect genes." />
          </>
        )
      },
      {
        title: 'Pigment Biology: Where Color Comes From',
        content: (
          <>
            <BulletList items={[
              'Crested gecko coloration comes from three layers of specialized skin cells called chromatophores, stacked like sheets:',
              'Xanthophores ,  the top layer. They produce yellow and red pigments (pteridines and carotenoids). Axanthic geckos have these cells genetically disabled.',
              'Iridophores ,  the middle layer. They contain reflective crystal platelets that bounce light back through the skin, producing brightness, shimmer, and the "fired up" visual effect.',
              'Melanophores ,  the deepest layer. They produce melanin (dark pigment) and are responsible for the dark base under everything else. These are what spread to create the "fired up" dark state.',
              'Most polygenic coloration in the hobby ,  red base, yellow base, olive, buckskin ,  is driven by differential expression in the xanthophore and iridophore layers.',
            ]} />
            <PigmentLayers />
          </>
        )
      },
      {
        title: 'Firing Up and Firing Down',
        content: (
          <BulletList items={[
            'Crested geckos can dramatically change color over 30–90 minutes depending on temperature, stress, humidity, and circadian cues. This is "firing up" (dark/saturated) or "firing down" (pale/washed out).',
            'The mechanism: melanophores contain granules of melanin that can spread out to darken the skin or clump up to lighten it. Iridophore reflectivity also shifts.',
            'This isn\'t genetics ,  it\'s physiology. Two animals with identical alleles can look dramatically different at different times of day.',
            'Photographing geckos for breeding records: fire them up consistently by misting and waiting 20 minutes in their usual enclosure. Fired-down photos make it very hard to compare animals across a collection.',
            'Axanthics still fire up ,  they get darker ,  but the warm tones (red, yellow) stay absent regardless of fire state, because those tones come from a different cell layer entirely.',
          ]} />
        )
      },
      {
        title: 'Base Colors (polygenic)',
        content: (
          <BulletList items={[
            'Buckskin ,  warm tan/brown, the "baseline" default for many lines',
            'Olive ,  muted green-brown, often with a subtle warmth',
            'Red ,  vibrant orange-red through deep crimson',
            'Yellow ,  lemon through golden',
            'Chocolate / Dark Brown ,  rich dark tones, often paired with cappuccino lines',
            'Cream / Blonde ,  pale warm tones',
            'Orange Base ,  pronounced orange without crossing into red territory',
            'Two vibrant red parents will statistically produce more red offspring ,  but individual results vary. Evaluate averages across clutches, not single animals.',
          ]} />
        )
      },
      {
        title: 'Pattern Types (polygenic)',
        content: (
          <BulletList items={[
            'Patternless ,  solid base color, no dorsal or lateral pattern',
            'Harlequin ,  high-contrast lateral pattern extending up the body',
            'Extreme Harlequin ,  near-full pattern coverage, can merge with flame patterns',
            'Pinstripe ,  raised cream dorsal stripe (partial to 100%)',
            'Flame ,  lateral "flame" markings rising from belly up the sides',
            'Tiger / Brindle ,  lateral banding or broken striping',
            'Dalmatian ,  sparse to extreme spotting across the body. "Super Dalmatian" is the polygenic extreme, not a proven Mendelian super form.',
            'Bicolor / Tricolor ,  two or three distinct color zones (usually head, body, tail)',
          ]} />
        )
      },
      {
        title: 'Crest & Structural Traits',
        content: (
          <BulletList items={[
            'Crest quality (size, symmetry, portholes, crown shape) is polygenic. Selective breeding for dramatic crests is one of the most rewarding long-term projects.',
            'Furred trait ,  elongated tubercles giving a fuzzy appearance. Not a proven Mendelian morph; emerges from selective breeding.',
            'Empty Back ,  absence of dorsal pattern. Widely held to be polygenic or at most a dominant expression; not confirmed as a single Mendelian gene.',
          ]} />
        )
      },
      {
        title: 'Breeding Value ,  Beyond Appearance',
        content: (
          <BulletList items={[
            'Two geckos can look identical but have very different breeding values. "Breeding value" is the genetic potential an animal contributes to offspring beyond what it displays itself.',
            'Assess breeding value by tracking offspring across multiple pairings with different partners. A stunning gecko that consistently produces stunning babies has high breeding value. One whose offspring never match the parent is a dead end for that trait.',
            '"Proven producers" command premium prices because their breeding value has been demonstrated through results, not assumed from appearance.',
            'Polygenic traits respond to the best parents only modestly in any single generation. Meaningful shift takes 5-10 generations of consistent selection pressure.',
          ]} />
        )
      },
      {
        title: 'Epistasis: Gene Interaction',
        content: (
          <>
            <BulletList items={[
              'Epistasis occurs when one gene masks or modifies the expression of another.',
              'Example: an axanthic gecko carries normal red/yellow color genes, but axanthic masks them by disabling the xanthophore pigment cells entirely. The red genes are there ,  they just can\'t be expressed.',
              'Breed that axanthic to a high-red gecko ,  the het offspring are NOT axanthic (only one copy), so their xanthophores develop normally and the red color genes finally get a chance to show up. Only homozygous axanthic offspring show gray again.',
              'Background genetics ,  all the polygenic "noise" genes interacting with your target trait ,  dramatically affect expression. The same proven morph can look completely different coming out of two different breeding programs.',
              'Takeaway: when buying into a new morph, buy from a line whose animals look like what you want. The background genetics matter as much as the named morph itself.',
            ]} />
            <EpistasisDiagram />
          </>
        )
      },
      {
        title: 'Heritability and Selection',
        content: (
          <BulletList items={[
            'Heritability is a technical term (h²) for the proportion of variation in a trait that\'s actually due to genetics vs environment. It ranges from 0 (pure environment) to 1 (pure genetics).',
            'For crested gecko color traits, realistic heritability sits around 0.3–0.6 ,  meaningful but not absolute. That\'s why selection works over generations but individual results vary.',
            'High-heritability traits respond quickly to selection. Low-heritability traits (things influenced heavily by incubation temperature, diet, stress) barely respond no matter how carefully you pair.',
            'Selection differential: the gap between the average of your breeders and the average of your whole collection. The larger the gap, the more "pressure" you\'re applying. You can\'t just pick one amazing pair and expect everything to shift ,  you need to be culling the bottom of your lines too.',
            'Response to selection = heritability × selection differential. This is the math behind why selective breeding is slow. A "one generation overnight transformation" is almost always polygenic luck, not a real shift.',
          ]} />
        )
      },
    ]
  },
  {
    id: 'lethal-alleles',
    title: 'Lethal Alleles & Ethical Breeding',
    level: 'Advanced',
    icon: AlertTriangle,
    intro: 'Some of the most exciting incomplete-dominant morphs carry a hidden cost ,  the homozygous "super" form can be lethal or health-compromised. Knowing which pairings to avoid is part of being a responsible breeder.',
    subsections: [
      {
        title: 'What is a Lethal Allele?',
        content: (
          <BulletList items={[
            'A lethal allele is an allele that prevents normal development when both copies are inherited. Heterozygous carriers are healthy; homozygous carriers don\'t survive (or have severely reduced fitness).',
            'In crested geckos, the textbook example is Super Lilly White: fertilized eggs develop partially, then fail to hatch. The breeder just lost eggs that looked viable at first.',
            'Lethal alleles are common in incomplete-dominant morphs across reptile hobbies ,  Super Cinnamon ball pythons, Super Mojave ball pythons, Spider Spider corn snakes, Super Cappuccino crested geckos.',
            'The ethical breeder\'s job is to KNOW which pairings produce lethal supers and AVOID them unless there\'s a compelling research reason.',
          ]} />
        )
      },
      {
        title: 'Super Lilly White ,  Confirmed Lethal',
        content: (
          <>
            <BulletList items={[
              'Pairing two visual Lilly Whites produces approximately 25% Super Lilly White embryos. None are expected to hatch ,  eggs stall mid-incubation.',
              'This is not a mild reduction in clutch size ,  it\'s a quarter of your fertilized eggs rendered non-viable by design.',
              'Correct pairing: always pair Lilly White × non-LW. You get ~50% visual LW, ~50% normal, and zero lethal supers.',
              'Some breeders test-pair two LWs for research documentation. That\'s a personal choice ,  but do it with eyes open and disclose it.',
            ]} />
            <LethalAlleleDiagram />
            <Callout items={[
              'LW × LW: AVOID ,  produces ~25% lethal Super LW',
              'LW × non-LW: SAFE ,  50% visual LW, 50% normal',
              'No visual test distinguishes "safe" from "risky" LW pairings ,  only lineage',
            ]} />
          </>
        )
      },
      {
        title: 'Super Cappuccino (Frappuccino) ,  Viability Debated',
        content: (
          <BulletList items={[
            'Frappuccinos do exist and are bred. That much is not in question.',
            'What IS debated: some breeders report reduced clutch sizes, higher egg-failure rates, or subtle developmental issues when producing Frappuccinos from Cappuccino × Cappuccino pairings.',
            'Conservative recommendation: breed Cappuccino × normal unless you\'re specifically investigating Frappuccino outcomes and prepared to document them.',
            'If you do breed for Frappuccino, be transparent about clutch outcomes ,  the community needs data to establish whether homozygous viability is a real concern.',
          ]} />
        )
      },
      {
        title: 'Super Soft Scale ,  Fertility Concerns',
        content: (
          <BulletList items={[
            'Super Soft Scales exist, but several breeders report reduced fertility when producing them.',
            'The conservative default: Soft Scale × normal. If you intentionally breed two Soft Scales, document the outcome for community knowledge.',
            'Incomplete-dominant supers are a gray area in crested gecko genetics. When in doubt, treat them as higher-risk and breed accordingly.',
          ]} />
        )
      },
      {
        title: 'Ethical Breeding Checklist',
        content: (
          <BulletList items={[
            'Know the inheritance pattern of every morph in your breeding plan before you pair animals.',
            'Avoid pairings whose homozygous outcome is confirmed-lethal (e.g. LW × LW).',
            'Document outcomes when pairing incomplete dominants where the super form has debated viability ,  your data helps the community.',
            'Disclose known risks to buyers. "This is het for a lethal allele ,  here\'s what that means for future breeding" is the mark of a professional.',
            'Don\'t produce super forms for the visual novelty if the health cost is unclear. The hobby has moved past "cool looking" as a sole justification.',
          ]} />
        )
      },
    ]
  },
  {
    id: 'proven',
    title: 'Proven vs. Unproven Genetics',
    level: 'Advanced',
    icon: ShieldCheck,
    intro: 'The word "proven" is one of the most important ,  and most abused ,  terms in reptile breeding. Understanding what it actually means protects your breeding program and your reputation.',
    subsections: [
      {
        title: 'What "Proven" Actually Means',
        content: (
          <BulletList items={[
            'A proven genetic claim means the inheritance pattern has been demonstrated through controlled, documented breeding outcomes ,  not assumed from appearance.',
            'To prove a recessive: a visual must be produced from two claimed hets, OR a visual must produce hets that then produce visuals when paired together.',
            'To prove an incomplete dominant: pair a visual with a non-carrier and show ~50% visual offspring across multiple clutches. Pair two visuals and show the predicted super-form ratio.',
            'One visual offspring from one pairing is suggestive. Multiple visuals across multiple pairings is proof.',
            'Appearance alone proves nothing. Visual assessment of het status is not valid for any recessive.',
          ]} />
        )
      },
      {
        title: 'Possible Het vs. 100% Het',
        content: (
          <>
            <BulletList items={[
              '100% het: parentage guarantees one copy. Example: offspring from visual × non-carrier.',
              '66% possible het: from het × het normal-looking offspring ,  2 of 3 possible non-visual outcomes statistically carry the gene.',
              '50% possible het: one parent confirmed het, other unknown.',
              'Possible hets have real value but must be honestly represented ,  never as guaranteed hets. The price difference matters.',
            ]} />
            <Callout items={[
              '100% het: parentage-documented, price accordingly',
              '66% pos het: from het × het normal-looking offspring',
              '50% pos het: one parent confirmed het only',
              'Visual assessment: NEVER valid for het determination',
            ]} />
          </>
        )
      },
      {
        title: 'Visual Confirmation Bias',
        content: (
          <BulletList items={[
            'The most common mistake: confirming genetic claims based on how an animal looks.',
            'Het status for recessives: a "normal" looking gecko cannot be visually assessed. Period.',
            'Lilly White: many geckos show pale markings superficially resembling LW ,  only lineage confirms it.',
            'Axanthic hets: gray coloring or faded appearance is not evidence of axanthic het status.',
            'Cappuccino: dark brown geckos with a dorsal pattern do NOT automatically carry the Cappuccino gene.',
            'Purchasing animals with unverified genetic claims and breeding them into your lines contaminates your own documentation downstream.',
          ]} />
        )
      },
      {
        title: 'Documentation Standards',
        content: (
          <BulletList items={[
            'Document for every breeding: sire and dam identity (name, ID code, photo), their known genetics with proven vs. possible het status, clutch dates and egg outcomes, offspring identity and photos.',
            'When selling: provide both parents\' genetics and an honest description of proven vs. possible het status.',
            'Breeders who maintain this standard build reputations that allow fair pricing with confidence.',
            'Geck Inspect is built to make this easy ,  the app tracks lineage, sire/dam, egg outcomes, and offspring photos automatically.',
          ]} />
        )
      },
      {
        title: 'When Genetics Are In Progress',
        content: (
          <BulletList items={[
            'Be transparent: "I believe this is heritable based on my observations, but it hasn\'t been proven" is an honest and respectable position.',
            'Don\'t overclaim pricing ,  unproven traits should not command the same price as established morphs.',
            'Contribute to the community by documenting and sharing findings openly.',
            'Support independent verification ,  the strongest proof comes when multiple unrelated breeders replicate results.',
          ]} />
        )
      },
      {
        title: 'Progeny Testing ,  How Proof Actually Happens',
        content: (
          <BulletList items={[
            'Progeny testing means: you believe an animal carries a gene, so you pair it with a known animal and examine the offspring to find out.',
            'Testing a suspected het recessive: pair it with a known visual. ~50% of offspring should be visual if the "het" is real. If you get a clutch of 6+ with zero visuals, the het claim is suspect.',
            'Testing a suspected incomplete dominant: pair it with a known non-carrier. ~50% of offspring should show the visual form. Most cases prove themselves in the first clutch.',
            'Sample sizes matter. "Zero out of 2 eggs" proves nothing ,  the math still allows a real het to produce two non-visuals in a row 25% of the time. You need at least 6–10 offspring before drawing conclusions.',
            'Write down the pairing, the parents\' documented genetics, the clutch dates, and every offspring phenotype. This becomes the evidence base if you want to prove or disprove a claim publicly.',
          ]} />
        )
      },
      {
        title: 'Disclosure Template for Selling',
        content: (
          <BulletList items={[
            'A good sales listing answers three questions: what is the animal\'s proven genetics, what is POSSIBLE het status, and what is SPECULATIVE?',
            'Example template: "Sire: Zeus (100% het axanthic, proven). Dam: Luna (visual cappuccino, proven). Offspring: visual cappuccino, 50% possible het axanthic. Sold as such."',
            'Never use "looks het" or "probably carries" as proof. If you can\'t trace the claim back to a documented pairing, call it speculative.',
            'If an animal was produced from a proven-het × non-carrier pairing, its offspring are "50% possible het" ,  half carry, half don\'t, and you can\'t tell which from looking.',
            'If an animal was produced from het × het and is visually normal, it\'s "66% possible het" ,  2 of 3 normal-looking siblings carry the gene.',
          ]} />
        )
      },
    ]
  },
];

export { SECTIONS };
