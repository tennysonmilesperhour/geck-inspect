import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dna, Grid2X2, Layers, TrendingUp, ShieldCheck, ArrowUp, Search, AlertTriangle, Palette } from 'lucide-react';
import Seo from '@/components/seo/Seo';

const GENETICS_GUIDE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      '@id': 'https://geckinspect.com/GeneticsGuide#article',
      headline: 'Crested Gecko Genetics Guide — Morphs, Inheritance, and Selective Breeding',
      description:
        'Complete educational reference for crested gecko (Correlophus ciliatus) genetics: dominant, recessive, and co-dominant traits; polygenic morphs; inheritance patterns; selective breeding strategies; and notable genetic morphs like Lilly White, Axanthic, and Cappuccino.',
      url: 'https://geckinspect.com/GeneticsGuide',
      about: {
        '@type': 'Thing',
        name: 'Crested gecko genetics',
        sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Geck Inspect',
        url: 'https://geckinspect.com/',
      },
    },
    {
      '@type': 'DefinedTermSet',
      '@id': 'https://geckinspect.com/GeneticsGuide#termset',
      name: 'Crested Gecko Genetics Terminology',
      hasDefinedTerm: [
        { '@type': 'DefinedTerm', name: 'Allele', description: 'One of two or more alternative forms of a gene.' },
        { '@type': 'DefinedTerm', name: 'Homozygous', description: 'Having two identical alleles for a given gene.' },
        { '@type': 'DefinedTerm', name: 'Heterozygous', description: 'Having two different alleles for a given gene.' },
        { '@type': 'DefinedTerm', name: 'Dominant', description: 'An allele whose trait shows up even when only one copy is present.' },
        { '@type': 'DefinedTerm', name: 'Recessive', description: 'An allele whose trait only shows up when both copies are present.' },
        { '@type': 'DefinedTerm', name: 'Incomplete Dominant', description: 'An allele that produces a visible trait in heterozygous form and a distinct, stronger "super" form when homozygous. Most proven crested gecko morphs follow this pattern.' },
        { '@type': 'DefinedTerm', name: 'Polygenic', description: 'A trait controlled by multiple genes acting together rather than a single Mendelian switch. Controls most crested gecko coloration and pattern.' },
        { '@type': 'DefinedTerm', name: 'Lilly White', description: 'An incomplete-dominant crested gecko morph producing high-contrast white body markings. Single copy is visible; the double-copy "Super Lilly White" is embryonic-lethal.' },
        { '@type': 'DefinedTerm', name: 'Axanthic', description: 'A recessive crested gecko morph lacking yellow and red xanthophore pigments. Visual animals appear black, white, and gray with no warm tones.' },
        { '@type': 'DefinedTerm', name: 'Cappuccino', description: 'An incomplete-dominant crested gecko morph producing dark "coffee" coloration with a connected dorsal pattern. The double-copy Super Cappuccino (Frappuccino) has enhanced expression and contested viability.' },
        { '@type': 'DefinedTerm', name: 'Soft Scale', description: 'An incomplete-dominant crested gecko morph with smaller, softer scales. The double-copy Super Soft Scale has more dramatic expression and fertility concerns.' },
        { '@type': 'DefinedTerm', name: 'White Wall', description: 'An incomplete-dominant crested gecko morph producing a distinct white lateral stripe along the belly wall.' },
        { '@type': 'DefinedTerm', name: 'Super form', description: 'The homozygous expression of an incomplete-dominant morph (e.g. Super Lilly White, Super Dalmatian, Frappuccino). Usually more extreme than the heterozygous form.' },
        { '@type': 'DefinedTerm', name: 'Lethal Allele', description: 'An allele that prevents normal development in homozygous form. Super Lilly White is the textbook example in crested geckos.' },
      ],
    },
  ],
};

// ── Callout box ──────────────────────────────────────────────────────────────
function Callout({ items }) {
  return (
    <div className="bg-emerald-900/40 border border-emerald-600 rounded-lg p-4 my-4 space-y-1">
      {items.map((item, i) => (
        <p key={i} className="text-emerald-400 text-sm font-medium">→ {item}</p>
      ))}
    </div>
  );
}

// ── Subsection (always-visible block) ────────────────────────────────────────
//
// Old version was a Collapsible that hid content behind a click, which
// made the guide feel like a shallow slideshow. Always-visible blocks
// read better and make the DNA-strand flow obvious.
function Subsection({ title, children }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-emerald-300 font-semibold text-base flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {title}
        </h3>
      </div>
      <div className="px-4 py-3 space-y-2">
        {children}
      </div>
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-slate-300 text-sm leading-relaxed">
          <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Content data ──────────────────────────────────────────────────────────────
//
// Content organized by experience level — only TWO levels now:
//
//   Beginner: Foundations + Punnett squares + Morphs-vs-Polygenic basics
//   Advanced: Proven Mendelian morphs, lethal alleles, proving genetics
//
// Each level is shown as a tab on the page. Within a level, sections are
// laid out as a vertical "DNA strand" — numbered nodes on the left rail
// linked by a gradient backbone, with content cards on the right. There's
// no level filter, no prev/next slideshow buttons, and nothing is hidden
// behind collapsibles that chop off the flow.

const SECTIONS = [
  {
    id: 'foundations',
    title: 'Foundations of Genetics',
    level: 'Beginner',
    icon: Dna,
    intro: 'Before diving into crested gecko morphs, you need the basic language of genetics. Every concept in this section applies to every living thing — including your geckos.',
    subsections: [
      {
        title: 'What is a Gene?',
        content: (
          <BulletList items={[
            'A gene is a segment of DNA that carries instructions for a trait — melanin production, scale shape, pattern layout, eye color, and so on.',
            'Each gecko inherits two copies of every gene, one from the sire and one from the dam. These two copies are called alleles.',
            'Most traits — especially coloration and pattern — are influenced by many genes working together, not a single switch. Those are "polygenic" and are covered in their own section.',
          ]} />
        )
      },
      {
        title: 'Alleles: The Two Copies',
        content: (
          <BulletList items={[
            'An allele is a specific version of a gene. Every gecko has two alleles per gene.',
            'Homozygous: the two alleles are identical (written AA or aa).',
            'Heterozygous: the two alleles are different (written Aa).',
            'Whether a trait shows up visually depends on which alleles the gecko carries and how they interact — dominant, recessive, or incomplete-dominant.',
          ]} />
        )
      },
      {
        title: 'Dominant, Recessive, and Incomplete Dominant',
        content: (
          <>
            <BulletList items={[
              'Dominant: a single copy is enough to show the trait. The gecko looks the same whether it has one or two copies.',
              'Recessive: the trait only shows when both alleles are the recessive version. A single copy is "het" — invisible but still passable to offspring. Axanthic is the cleanest crested gecko example.',
              'Incomplete dominant: one copy produces the visual form, and two copies produce a more extreme "super" form. MOST proven crested gecko morphs work this way — Lilly White, Cappuccino, Soft Scale, and White Wall are all incomplete dominants.',
              'Codominant in the strict sense (both alleles expressing simultaneously without blending) is rare in crested geckos. The hobby uses "codominant" and "incomplete dominant" loosely.',
            ]} />
            <Callout items={[
              'Most proven crested gecko morphs are incomplete dominant, not recessive',
              'Visual assessment of het status is never valid for any recessive',
              'The "super" form of an incomplete dominant can be extreme — or lethal',
            ]} />
          </>
        )
      },
      {
        title: 'Genotype vs. Phenotype',
        content: (
          <BulletList items={[
            'Genotype: the genetic code — the actual alleles the animal carries (AA, Aa, aa).',
            'Phenotype: the visible appearance — what the animal actually looks like.',
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
    intro: 'A Punnett square predicts possible genetic outcomes of a pairing. It shows probabilities across many offspring — not guarantees for individual clutches.',
    subsections: [
      {
        title: 'How to Read a Punnett Square',
        content: (
          <BulletList items={[
            'A 2x2 grid — one parent\'s alleles across the top, the other\'s down the side.',
            'Each of the four boxes represents a possible offspring combination at 25% probability.',
            'The same combination in multiple boxes increases probability: two boxes = 50%, three = 75%.',
            'Punnett squares show probability, not certainty. 25% chance of a visual does not guarantee one per 4 eggs.',
          ]} />
        )
      },
      {
        title: 'Het x Het (Aa x Aa)',
        content: (
          <>
            <BulletList items={[
              'When both parents carry one copy of a recessive but look normal (Aa x Aa):',
              '25% AA — does not carry the gene at all',
              '50% Aa — het, looks normal, carries the gene invisibly',
              '25% aa — visual (displays the trait)',
              'Of visually normal offspring: 2 out of 3 statistically carry the gene.',
            ]} />
            <Callout items={[
              'Aa x Aa = 25% visual, 50% het, 25% non-carrier',
              'This is the standard pairing to produce visual recessives',
              'Requires patience — multiple clutches needed for reliable results',
            ]} />
          </>
        )
      },
      {
        title: 'Het x Visual (Aa x aa)',
        content: (
          <BulletList items={[
            '50% Aa — het offspring, looks normal, carries the gene',
            '50% aa — visual offspring',
            'More efficient than het x het for producing visuals. The tradeoff is cost — visual animals from quality lines are more expensive.',
          ]} />
        )
      },
      {
        title: 'Visual x Non-Carrier (aa x AA)',
        content: (
          <BulletList items={[
            '100% of offspring are het (Aa) — none will be visual, but all carry the gene.',
            'This is how breeders introduce a recessive into a new bloodline without losing other desirable traits. Hets can be back-paired in the next generation.',
          ]} />
        )
      },
      {
        title: 'Multiple Traits',
        content: (
          <BulletList items={[
            'Tracking two independent recessives simultaneously: probability compounds multiplicatively.',
            'Double het x double het = 6.25% chance per offspring of being visual for both traits.',
            'Each additional recessive cuts the odds by ~75% again.',
            'Use the Genetic Calculator in this app for multi-trait calculations.',
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
    intro: 'Only a handful of crested gecko traits have been proven as single-gene Mendelian morphs with predictable inheritance. Almost all of them are incomplete dominants — single copy looks one way, double copy is more extreme, and in several cases the double copy carries real risks.',
    subsections: [
      {
        title: 'Morph vs. Trait — Why It Matters',
        content: (
          <>
            <BulletList items={[
              'A MORPH is a genetically distinct variant with a known, predictable inheritance pattern that has been demonstrated through controlled breeding. Lilly White, Axanthic, and Cappuccino are morphs.',
              'A TRAIT (or "line") is a phenotypic characteristic whose precise genetics aren\'t fully mapped — usually polygenic. Harlequin, pinstripe, flame, and dalmatian are traits.',
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
              'Inheritance: INCOMPLETE DOMINANT. Single copy = visual Lilly White. Two copies = Super Lilly White, which is embryonic-lethal — fertilized eggs develop partially then fail to hatch. Never pair two Lilly Whites together.',
              'Visual expression: distinct areas of pure white or pale cream, usually on the lateral body walls, tail, and sometimes the head. Not to be confused with "whitewall" traits, fire-up pale markings, or cream harlequin extension.',
              'Discovered: in 2014 by Lilly Exotics. Named for the breeder, not the color.',
              'Pairing strategy: Lilly White × Normal produces ~50% visual Lilly White + ~50% normal. This is the ONLY safe way to produce more LW.',
              'Price: high-quality visual LW typically $500–$1500+ depending on base trait combinations and breeder reputation.',
            ]} />
            <Callout items={[
              'LW × Normal → 50% visual LW, 50% normal (SAFE)',
              'LW × LW → 25% lethal Super LW, 50% visual LW, 25% normal (AVOID)',
              'Visual LW assessment requires lineage — pale markings alone are not proof',
            ]} />
          </>
        )
      },
      {
        title: 'Axanthic',
        content: (
          <>
            <BulletList items={[
              'Inheritance: RECESSIVE. Two copies required for the visual form. Het axanthics look completely normal — no visual clue.',
              'Visual expression: the cleanest recessive in the hobby. Axanthic animals lack xanthophore cells (responsible for yellow and red pigments). They appear in shades of white, gray, and black regardless of their underlying "base color" genetics. No orange, red, or yellow tones ever show — even when fired up.',
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
              'Super form viability: Frappuccinos exist and are bred, but there is ongoing debate about sublethal effects — some breeders report reduced clutch sizes or health issues from Cappuccino × Cappuccino pairings. Proceed with caution and document outcomes.',
              'Pairing strategy: Cappuccino × Normal is the safest pairing. It produces ~50% Cappuccino, ~50% normal offspring.',
              'Price: visual Cappuccino commonly $400–$1200+. Frappuccino pricing varies widely with health reputation of the line.',
            ]} />
            <Callout items={[
              'Cappuccino × Normal → 50% visual Cappuccino, 50% normal (SAFEST)',
              'Cappuccino × Cappuccino → 25% Frappuccino, 50% Cappuccino, 25% normal (DOCUMENT OUTCOMES)',
              'Not every brown crested gecko with a dorsal pattern is Cappuccino — lineage confirms it',
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
            'Visual expression: a clean white lateral band that sits below where the harlequin extension would normally appear. It\'s structural — comes from documented lineage, not random pale coloration.',
            'Pairing strategy: White Wall × Normal is the typical approach. The gene stacks well with harlequin, pinstripe, and cappuccino traits.',
            'Often confused with White-Spot or generic pale markings — require lineage to verify.',
          ]} />
        )
      },
      {
        title: 'Phantom Pinstripe — polygenic, not Mendelian',
        content: (
          <BulletList items={[
            'Despite the name, Phantom Pinstripe is NOT a proven recessive morph. It\'s a pattern-expression style within the pinstripe family — a pinstripe that is partial, broken, or nearly invisible.',
            'Some older guides list Phantom as a separate recessive. That has not been replicated in controlled breeding. Treat it as a polygenic pattern trait.',
            'If you\'re buying an animal marketed as "het phantom," ask for the pairing documentation and manage your expectations — the outcome is not predictable by Punnett square.',
          ]} />
        )
      },
    ]
  },
  {
    id: 'polygenic',
    title: 'Polygenic Traits — The Real Art',
    level: 'Beginner',
    icon: Palette,
    intro: 'Most of what makes a crested gecko visually stunning is NOT a single gene. Base color, harlequin extension, pinstripe fullness, dalmatian spotting, flame contrast — all polygenic. Understanding how to work with polygenic traits separates serious breeders from hobbyists.',
    subsections: [
      {
        title: 'What Makes a Trait Polygenic?',
        content: (
          <BulletList items={[
            'A polygenic trait is controlled by many genes, each contributing a small additive effect to the final phenotype.',
            'The result is a CONTINUOUS SPECTRUM of expression — not a clean on/off switch. Why crested gecko coloration ranges smoothly from pale cream to vibrant red rather than jumping between two states.',
            'You CANNOT predict polygenic outcomes with a Punnett square. You can only INFLUENCE them through consistent selective breeding over multiple generations.',
            'Two stunning parents often produce offspring that span a wide quality range. Some will exceed both parents, some will fall short. This is normal and expected.',
          ]} />
        )
      },
      {
        title: 'Base Colors (polygenic)',
        content: (
          <BulletList items={[
            'Buckskin — warm tan/brown, the "baseline" default for many lines',
            'Olive — muted green-brown, often with a subtle warmth',
            'Red — vibrant orange-red through deep crimson',
            'Yellow — lemon through golden',
            'Chocolate / Dark Brown — rich dark tones, often paired with cappuccino lines',
            'Cream / Blonde — pale warm tones',
            'Orange Base — pronounced orange without crossing into red territory',
            'Two vibrant red parents will statistically produce more red offspring — but individual results vary. Evaluate averages across clutches, not single animals.',
          ]} />
        )
      },
      {
        title: 'Pattern Types (polygenic)',
        content: (
          <BulletList items={[
            'Patternless — solid base color, no dorsal or lateral pattern',
            'Harlequin — high-contrast lateral pattern extending up the body',
            'Extreme Harlequin — near-full pattern coverage, can merge with flame patterns',
            'Pinstripe — raised cream dorsal stripe (partial to 100%)',
            'Flame — lateral "flame" markings rising from belly up the sides',
            'Tiger / Brindle — lateral banding or broken striping',
            'Dalmatian — sparse to extreme spotting across the body. "Super Dalmatian" is the polygenic extreme, not a proven Mendelian super form.',
            'Bicolor / Tricolor — two or three distinct color zones (usually head, body, tail)',
          ]} />
        )
      },
      {
        title: 'Crest & Structural Traits',
        content: (
          <BulletList items={[
            'Crest quality (size, symmetry, portholes, crown shape) is polygenic. Selective breeding for dramatic crests is one of the most rewarding long-term projects.',
            'Furred trait — elongated tubercles giving a fuzzy appearance. Not a proven Mendelian morph; emerges from selective breeding.',
            'Empty Back — absence of dorsal pattern. Widely held to be polygenic or at most a dominant expression; not confirmed as a single Mendelian gene.',
          ]} />
        )
      },
      {
        title: 'Breeding Value — Beyond Appearance',
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
          <BulletList items={[
            'Epistasis occurs when one gene masks or modifies the expression of another.',
            'Example: an axanthic gecko carries normal red/yellow color genes, but axanthic masks them. Breed that axanthic to a high-red gecko — the het offspring show normal, potentially vibrant coloration because color genes are expressed in heterozygotes. Only homozygous axanthic offspring show gray again.',
            'Background genetics — all the polygenic "noise" genes interacting with your target trait — dramatically affect expression. The same proven morph can look dramatically different coming out of two different breeding programs.',
            'Takeaway: when buying into a new morph, buy from a line whose animals look like what you want. The background genetics matter as much as the named morph.',
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
    intro: 'Some of the most exciting incomplete-dominant morphs carry a hidden cost — the homozygous "super" form can be lethal or health-compromised. Knowing which pairings to avoid is part of being a responsible breeder.',
    subsections: [
      {
        title: 'What is a Lethal Allele?',
        content: (
          <BulletList items={[
            'A lethal allele is an allele that prevents normal development when both copies are inherited. Heterozygous carriers are healthy; homozygous carriers don\'t survive (or have severely reduced fitness).',
            'In crested geckos, the textbook example is Super Lilly White: fertilized eggs develop partially, then fail to hatch. The breeder just lost eggs that looked viable at first.',
            'Lethal alleles are common in incomplete-dominant morphs across reptile hobbies — Super Cinnamon ball pythons, Super Mojave ball pythons, Spider Spider corn snakes, Super Cappuccino crested geckos.',
            'The ethical breeder\'s job is to KNOW which pairings produce lethal supers and AVOID them unless there\'s a compelling research reason.',
          ]} />
        )
      },
      {
        title: 'Super Lilly White — Confirmed Lethal',
        content: (
          <>
            <BulletList items={[
              'Pairing two visual Lilly Whites produces approximately 25% Super Lilly White embryos. None are expected to hatch — eggs stall mid-incubation.',
              'This is not a mild reduction in clutch size — it\'s a quarter of your fertilized eggs rendered non-viable by design.',
              'Correct pairing: always pair Lilly White × non-LW. You get ~50% visual LW, ~50% normal, and zero lethal supers.',
              'Some breeders test-pair two LWs for research documentation. That\'s a personal choice — but do it with eyes open and disclose it.',
            ]} />
            <Callout items={[
              'LW × LW: AVOID — produces ~25% lethal Super LW',
              'LW × non-LW: SAFE — 50% visual LW, 50% normal',
              'No visual test distinguishes "safe" from "risky" LW pairings — only lineage',
            ]} />
          </>
        )
      },
      {
        title: 'Super Cappuccino (Frappuccino) — Viability Debated',
        content: (
          <BulletList items={[
            'Frappuccinos do exist and are bred. That much is not in question.',
            'What IS debated: some breeders report reduced clutch sizes, higher egg-failure rates, or subtle developmental issues when producing Frappuccinos from Cappuccino × Cappuccino pairings.',
            'Conservative recommendation: breed Cappuccino × normal unless you\'re specifically investigating Frappuccino outcomes and prepared to document them.',
            'If you do breed for Frappuccino, be transparent about clutch outcomes — the community needs data to establish whether homozygous viability is a real concern.',
          ]} />
        )
      },
      {
        title: 'Super Soft Scale — Fertility Concerns',
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
            'Document outcomes when pairing incomplete dominants where the super form has debated viability — your data helps the community.',
            'Disclose known risks to buyers. "This is het for a lethal allele — here\'s what that means for future breeding" is the mark of a professional.',
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
    intro: 'The word "proven" is one of the most important — and most abused — terms in reptile breeding. Understanding what it actually means protects your breeding program and your reputation.',
    subsections: [
      {
        title: 'What "Proven" Actually Means',
        content: (
          <BulletList items={[
            'A proven genetic claim means the inheritance pattern has been demonstrated through controlled, documented breeding outcomes — not assumed from appearance.',
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
              '66% possible het: from het × het normal-looking offspring — 2 of 3 possible non-visual outcomes statistically carry the gene.',
              '50% possible het: one parent confirmed het, other unknown.',
              'Possible hets have real value but must be honestly represented — never as guaranteed hets. The price difference matters.',
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
            'Lilly White: many geckos show pale markings superficially resembling LW — only lineage confirms it.',
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
            'Geck Inspect is built to make this easy — the app tracks lineage, sire/dam, egg outcomes, and offspring photos automatically.',
          ]} />
        )
      },
      {
        title: 'When Genetics Are In Progress',
        content: (
          <BulletList items={[
            'Be transparent: "I believe this is heritable based on my observations, but it hasn\'t been proven" is an honest and respectable position.',
            'Don\'t overclaim pricing — unproven traits should not command the same price as established morphs.',
            'Contribute to the community by documenting and sharing findings openly.',
            'Support independent verification — the strongest proof comes when multiple unrelated breeders replicate results.',
          ]} />
        )
      },
    ]
  },
];

const GLOSSARY = [
  { term: 'Allele', def: 'A specific version of a gene. Every gecko has two alleles per gene — one from each parent.' },
  { term: 'Homozygous', def: 'Both alleles are identical (AA or aa).' },
  { term: 'Heterozygous (Het)', def: 'Alleles are different (Aa). Carries one copy of a recessive gene without showing it.' },
  { term: 'Dominant', def: 'Trait expresses with only one copy of the allele present.' },
  { term: 'Recessive', def: 'Trait only expresses when two copies are present (one from each parent). Axanthic is the cleanest crested gecko example.' },
  { term: 'Incomplete Dominant', def: 'Single copy produces the visible form; two copies produce a "super" form that is more extreme. Describes most proven crested gecko morphs.' },
  { term: 'Codominant', def: 'Both alleles express simultaneously without blending. Used loosely in the hobby; most "codominant" cresties are technically incomplete dominant.' },
  { term: '100% Het', def: 'Parentage guarantees the animal carries one copy of the recessive.' },
  { term: 'Possible Het (Pos Het)', def: 'May carry the gene — probability stated as 50% or 66% based on parentage.' },
  { term: 'Visual', def: 'The animal displays the trait — homozygous for a recessive, or one/two copies of an incomplete dominant.' },
  { term: 'Super Form', def: 'The homozygous expression of an incomplete dominant (e.g. Super Lilly White, Frappuccino, Super Dalmatian). Sometimes more extreme, sometimes lethal.' },
  { term: 'Lethal Allele', def: 'An allele whose homozygous form prevents normal development. Super Lilly White is the textbook crested gecko example.' },
  { term: 'Polygenic', def: 'Trait controlled by many genes with additive effects. Cannot be Punnett-squared. Base color, harlequin, flame, and dalmatian spotting are all polygenic.' },
  { term: 'Epistasis', def: 'One gene masks or modifies the expression of another gene.' },
  { term: 'Proven', def: 'Inheritance pattern demonstrated through documented, controlled breeding results.' },
  { term: 'Breeding Value', def: 'Genetic potential an animal contributes to offspring beyond its own display. Revealed only through progeny testing.' },
  { term: 'Genotype', def: 'The actual genetic code the animal carries (AA, Aa, aa).' },
  { term: 'Phenotype', def: 'What the animal actually looks like. Two geckos can share a phenotype with different genotypes.' },
  { term: 'Lilly White (LW)', def: 'Incomplete-dominant morph with high-contrast white body markings. Single copy = visual LW. Two copies = Super LW (embryonic-lethal).' },
  { term: 'Axanthic', def: 'Recessive morph lacking yellow/red pigment. Appears gray/white/black. Two copies required to show.' },
  { term: 'Cappuccino', def: 'Incomplete-dominant morph with dark coffee-brown coloration and a connected dorsal pattern. Super form is Frappuccino.' },
  { term: 'Frappuccino', def: 'Homozygous (super) form of Cappuccino. More extreme expression; some breeders report viability concerns.' },
  { term: 'Soft Scale', def: 'Incomplete-dominant morph with smaller, softer scales. Super form exists with some reported fertility concerns.' },
  { term: 'White Wall', def: 'Incomplete-dominant morph producing a distinct white lateral stripe along the belly wall.' },
  { term: 'Super Dalmatian', def: 'A polygenic extreme of Dalmatian spotting — NOT a proven Mendelian super form, despite the "Super" name.' },
  { term: 'Phantom Pinstripe', def: 'Polygenic pinstripe variant with partial, broken, or faint expression. NOT a proven recessive morph despite old claims.' },
  { term: 'Punnett Square', def: 'A 2×2 grid tool for predicting offspring genetic probabilities from a Mendelian pairing. Does not apply to polygenic traits.' },
  { term: 'Selective Breeding', def: 'Consistently pairing animals displaying desired traits across multiple generations to shift polygenic expression.' },
];

const LEVEL_META = {
  Beginner: {
    label: 'Beginner',
    subtitle: 'Start here — what genes, alleles, and inheritance actually are.',
    accent: 'from-emerald-500 to-teal-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    nodeClass: 'bg-emerald-500 text-white ring-emerald-400/30',
  },
  Advanced: {
    label: 'Advanced',
    subtitle: 'Proven morphs, lethal alleles, and the ethics of serious breeding.',
    accent: 'from-purple-500 to-fuchsia-400',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    nodeClass: 'bg-purple-500 text-white ring-purple-400/30',
  },
};

// Decorative DNA helix illustration for the page header. Pure SVG,
// animated rungs, zero images.
function DnaHelix() {
  return (
    <svg
      viewBox="0 0 300 80"
      className="w-full h-20 opacity-80"
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="helix-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      {/* Two sinusoidal strands */}
      <path
        d="M0,40 Q37.5,5 75,40 T150,40 T225,40 T300,40"
        stroke="url(#helix-grad)"
        strokeWidth="2.5"
        fill="none"
      />
      <path
        d="M0,40 Q37.5,75 75,40 T150,40 T225,40 T300,40"
        stroke="url(#helix-grad)"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Base-pair rungs */}
      {[15, 45, 75, 105, 135, 165, 195, 225, 255, 285].map((x, i) => {
        // Compute y offset along the sine wave at this x for the rung start/end
        const freq = Math.PI / 37.5;
        const top = 40 + Math.sin((x - 0) * freq) * 20;
        const bot = 40 - Math.sin((x - 0) * freq) * 20;
        return (
          <line
            key={x}
            x1={x}
            y1={top}
            x2={x}
            y2={bot}
            stroke={i % 2 === 0 ? '#34d399' : '#a78bfa'}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.7"
          />
        );
      })}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GeneticsGuide() {
  const [activeLevel, setActiveLevel] = useState('Beginner');
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [glossarySearch, setGlossarySearch] = useState('');
  const sectionRefs = useRef({});

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToSection = (id) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const levelSections = (level) => SECTIONS.filter((s) => s.level === level);

  const filteredGlossary = GLOSSARY.filter(
    (g) =>
      g.term.toLowerCase().includes(glossarySearch.toLowerCase()) ||
      g.def.toLowerCase().includes(glossarySearch.toLowerCase())
  );

  return (
    <>
      <Seo
        title="Crested Gecko Genetics Guide"
        description="Complete reference for crested gecko genetics: dominant, recessive, and co-dominant inheritance; polygenic traits; Lilly White, Axanthic, Cappuccino, and other notable morphs; selective breeding strategies."
        path="/GeneticsGuide"
        jsonLd={GENETICS_GUIDE_JSON_LD}
      />
      <div className="min-h-screen bg-slate-950">
        {/* Hero with DNA helix */}
        <div className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-br from-slate-950 via-emerald-950/30 to-purple-950/20">
          <div className="absolute inset-0 gecko-scale-pattern opacity-[0.04] pointer-events-none" />
          <div className="relative max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Dna className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-b from-white to-emerald-200 bg-clip-text text-transparent tracking-tight">
                  Crested Gecko Genetics Guide
                </h1>
                <p className="text-sm md:text-base text-slate-400 mt-1">
                  An interactive educational reference for understanding crested gecko
                  genetics, morphs, and selective breeding.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <DnaHelix />
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
          <Tabs defaultValue="guide">
            <TabsList className="bg-slate-900 border border-slate-800 mb-6">
              <TabsTrigger
                value="guide"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                Guide
              </TabsTrigger>
              <TabsTrigger
                value="glossary"
                className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
              >
                Glossary
              </TabsTrigger>
            </TabsList>

            {/* Guide Tab */}
            <TabsContent value="guide">
              {/* Level toggles */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div className="flex items-center gap-2 p-1 rounded-xl border border-slate-800 bg-slate-900 self-start">
                  {Object.keys(LEVEL_META).map((level) => {
                    const meta = LEVEL_META[level];
                    const isActive = activeLevel === level;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => {
                          setActiveLevel(level);
                          window.scrollTo({ top: 280, behavior: 'smooth' });
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          isActive
                            ? `bg-gradient-to-r ${meta.accent} text-white shadow-md`
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm text-slate-400 max-w-md md:text-right">
                  {LEVEL_META[activeLevel].subtitle}
                </p>
              </div>

              {/* Section quick-jump chips */}
              {(() => {
                const sections = levelSections(activeLevel);
                if (sections.length <= 1) return null;
                return (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {sections.map((section, i) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => scrollToSection(section.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/80 hover:bg-slate-800 hover:border-emerald-500/40 px-3 py-1 text-xs text-slate-300 transition-colors"
                      >
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 text-[10px] font-bold text-emerald-400">
                          {i + 1}
                        </span>
                        {section.title}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* DNA-strand section layout */}
              <div className="relative">
                {/* Vertical DNA backbone — decorative gradient line on the left
                    rail, connecting every section's numbered node. */}
                <div className="absolute left-[19px] md:left-[23px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-500/60 via-teal-400/40 to-purple-500/60 pointer-events-none" />

                <div className="space-y-8">
                  {levelSections(activeLevel).map((section, sectionIdx) => {
                    const Icon = section.icon;
                    const meta = LEVEL_META[section.level];
                    return (
                      <div
                        key={section.id}
                        ref={(el) => (sectionRefs.current[section.id] = el)}
                        className="relative pl-12 md:pl-14"
                      >
                        {/* Node on the strand */}
                        <div className="absolute left-0 top-5">
                          <div
                            className={`relative w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ring-4 ${meta.nodeClass}`}
                          >
                            {sectionIdx + 1}
                            <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-emerald-400" />
                          </div>
                        </div>

                        {/* Section card */}
                        <Card className="bg-slate-900/70 border-slate-800">
                          <CardHeader className="pb-3">
                            <div className="flex items-start gap-3 flex-wrap">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Icon className="w-5 h-5 text-emerald-400 shrink-0" />
                                <h2 className="text-xl md:text-2xl font-bold text-slate-100 truncate">
                                  {section.title}
                                </h2>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase tracking-wider border ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </Badge>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed mt-2">
                              {section.intro}
                            </p>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {section.subsections.map((sub) => (
                              <Subsection key={sub.title} title={sub.title}>
                                {sub.content}
                              </Subsection>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Glossary Tab */}
            <TabsContent value="glossary">
              <div className="max-w-3xl">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search glossary..."
                    value={glossarySearch}
                    onChange={(e) => setGlossarySearch(e.target.value)}
                    className="pl-9 bg-slate-900 border-slate-700 text-slate-100"
                  />
                </div>
                <div className="rounded-lg overflow-hidden border border-slate-800">
                  <div className="grid grid-cols-[200px_1fr] bg-emerald-900/40 px-4 py-2">
                    <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider">
                      Term
                    </span>
                    <span className="text-emerald-300 text-xs font-bold uppercase tracking-wider">
                      Definition
                    </span>
                  </div>
                  {filteredGlossary.map((row, i) => (
                    <div
                      key={row.term}
                      className={`grid grid-cols-[200px_1fr] px-4 py-3 gap-4 border-t border-slate-800 ${i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/40'}`}
                    >
                      <span className="text-emerald-300 font-semibold text-sm">
                        {row.term}
                      </span>
                      <span className="text-slate-300 text-sm leading-relaxed">
                        {row.def}
                      </span>
                    </div>
                  ))}
                  {filteredGlossary.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-slate-500 bg-slate-900">
                      No glossary entries match that search.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full p-3 shadow-lg transition-all"
            aria-label="Back to top"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>
    </>
  );
}