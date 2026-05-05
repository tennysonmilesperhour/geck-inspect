/**
 * Geck Inspect blog — authoritative long-form content.
 *
 * Each entry is a self-contained blog post that compounds with the
 * existing /MorphGuide and /CareGuide pages: posts are "spokes" that
 * link to those "hubs" (and to each other), forming a topic cluster
 * the search engines can crawl as a single connected graph.
 *
 * Why this lives in a JS data file
 * --------------------------------
 * The same convention as care-guide.js and morph-guide.js — keep
 * content in plain JavaScript objects, no JSX, no imports. The build
 * pipeline (sitemap, prerender, llms-full, vercel.json) parses this
 * file with regex so adding a post needs no schema change anywhere.
 *
 * To add a post (one PR-sized commit):
 *   1. Append a new object to BLOG_POSTS below with all required
 *      fields (slug, title, description, keyphrase, datePublished,
 *      category, body, faq, internalLinks, externalCitations).
 *   2. Bump dateModified for follow-up edits.
 *   3. `pnpm build` updates the sitemap, prerendered HTML, llms-full,
 *      and vercel.json automatically. No other file needs changes.
 *
 * Block discriminator (matches src/data/care-guide.js so the existing
 * <ContentBlock> renderer works unchanged):
 *   { type: 'p', text }
 *   { type: 'ul', items: [string] }
 *   { type: 'ol', items: [string] }
 *   { type: 'dl', items: [{ term, def }] }
 *   { type: 'callout', tone: 'info'|'warn'|'success'|'danger', title?, items: [string] }
 *   { type: 'table', headers: [string], rows: [[string]], caption? }
 *   { type: 'kv', items: [{ label, value, note? }] }
 *
 * SEO checklist for every post (the recurring template):
 *   ✓ Title ≤ 60 chars, contains keyphrase
 *   ✓ Description 140–160 chars, contains keyphrase
 *   ✓ TL;DR callout near top (LLMs cite these heavily)
 *   ✓ ≥ 3 body sections (heading → paragraphs/lists/tables)
 *   ✓ ≥ 4 FAQ pairs (becomes FAQPage schema → "People Also Ask")
 *   ✓ ≥ 3 internal links to existing /MorphGuide, /CareGuide, /GeneticsGuide
 *   ✓ ≥ 2 external citations to authority domains (LM Reptiles,
 *     AC Reptiles, Pangea, Altitude Exotics, Morph Market, ReptiDex)
 */

export const BLOG_CATEGORIES = [
  {
    id: 'genetics',
    label: 'Genetics & Inheritance',
    description:
      'Trait deep-dives explaining the Foundation Genetics consensus on individual crested gecko alleles — what each trait does, how it passes to offspring, and what the breeding pairs produce.',
  },
  {
    id: 'breeding',
    label: 'Breeding & Pairings',
    description:
      'Practical pairing math for breeders: which crosses are safe, which are lethal, and what to expect from common stacked-trait projects.',
  },
  {
    id: 'mythbusters',
    label: 'Mythbusters & FAQ',
    description:
      'Common hobby misconceptions corrected with sourced citations. Albino crested geckos, "het" misuse, polymorphism vs. genetic chaos, and similar.',
  },
  {
    id: 'identification',
    label: 'Identification & Visual ID',
    description:
      'How to tell one trait from another at a glance — including hatchling vs. adult expression and traits that look similar but behave differently in breeding.',
  },
];

export const BLOG_POSTS = [
  {
    slug: 'cappuccino-crested-gecko-genetics',
    title: 'Cappuccino Crested Gecko: Why Super Cappuccinos Are Risky',
    description:
      'Cappuccino is incomplete dominant, not codominant. Super Cappuccinos (CAPP/CAPP) have documented breathing issues — here is what every breeder needs to know before pairing.',
    keyphrase: 'cappuccino crested gecko',
    category: 'genetics',
    tags: ['cappuccino', 'incomplete-dominant', 'super-cappuccino', 'melanistic', 'sable', 'foundation-genetics'],
    datePublished: '2026-04-18',
    dateModified: '2026-04-18',
    heroEyebrow: 'Genetics deep-dive',
    tldr: [
      'Cappuccino is incomplete dominant — one copy gives the visible trait, two copies produce the Super Cappuccino (Melanistic).',
      'Super Cappuccinos have documented health issues including reduced nostril size and breathing difficulty. Breeding for supers is not recommended.',
      'Cappuccino is allelic with Sable and Highway — they share the same gene location but produce distinct compound heterozygotes (Luwak, etc.) instead of supers.',
      'Hobby sources commonly call Cappuccino "codominant." This is incorrect — true codominance is extremely rare in any animal species.',
    ],
    body: [
      {
        type: 'p',
        text: 'The Cappuccino crested gecko is one of the most popular incomplete dominant traits introduced to the hobby in the last decade. It was discovered and proven by Reptile City Korea in 2020–2021 and has since become a staple of high-end Correlophus ciliatus breeding projects worldwide. But the trait carries health risks in homozygous form that newer breeders often miss because the hobby still calls it "codominant" — a term that is almost always wrong when applied to crested geckos.',
      },
      {
        type: 'p',
        text: 'This guide covers what Cappuccino actually is genetically, how to identify a heterozygous Cappuccino at a glance, why Super Cappuccinos should not be the goal of a pairing, and how the trait interacts with its allelic partners Sable and Highway.',
      },
      {
        type: 'callout',
        tone: 'danger',
        title: 'Critical breeding warning',
        items: [
          'Super Cappuccinos (homozygous CAPP/CAPP, also called Melanistic) have documented health concerns including reduced nostril size, breathing difficulty, and poor thriving.',
          'Breeding specifically to produce Super Cappuccinos is not recommended. Pair Cappuccino × non-Cappuccino instead — you still produce ~50% Cappuccino offspring without risking the lethal homozygous expression.',
        ],
      },
      {
        type: 'p',
        text: 'Cappuccino is incomplete dominant, NOT codominant. The distinction matters because incomplete dominant traits produce a distinct intermediate "super" form when homozygous, while codominant traits express both alleles independently and visibly. Most crested gecko traits historically labeled codominant in hobby literature are actually incomplete dominant, and the Foundation Genetics project led by Lil Monsters Reptiles has reclassified them as such.',
      },
      {
        type: 'p',
        text: 'A heterozygous Cappuccino has four reliable visual identifiers that distinguish it from Harlequin, Pinstripe, or other white-pattern morphs:',
      },
      {
        type: 'ol',
        items: [
          'A distinctive Y-shape at the base of the tail where the dorsal pattern splits.',
          'White flecks or splotching along the lower spine and tail base.',
          'Reduced or absent lateral pattern — the sides of the body are typically clean.',
          'Bright sharp white on the tail base in hatchlings, with a darker tail tip that contrasts strongly.',
        ],
      },
      {
        type: 'p',
        text: 'When two Cappuccinos are paired, the expected outcomes per Punnett square are 25% non-Cappuccino, 50% heterozygous Cappuccino, and 25% Super Cappuccino (homozygous). The Super Cappuccino is also called Melanistic in newer hobby literature because the homozygous form expresses dramatically increased melanin concentration. Survivors that reach adult size often have visibly stenosed (narrowed) nostrils, which is the underlying anatomical cause of the breathing difficulty.',
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Recommended pairing',
        items: [
          'Cappuccino × non-Cappuccino → ~50% heterozygous Cappuccino, ~50% non-Cappuccino. No Supers produced. This is the standard responsible pairing.',
          'Cappuccino × Sable → Luwak (compound heterozygote at the same locus, NOT a Super). Visually distinct phenotype, no documented health issues from this pairing.',
          'Cappuccino × Highway → Compound heterozygote at the same locus. Phenotype distinct from both Cappuccino and Sable.',
        ],
      },
      {
        type: 'p',
        text: 'The fact that Cappuccino × Sable produces a Luwak (and NOT a Super Cappuccino) is the key evidence that proves Cappuccino, Sable, and Highway are three distinct alleles at the same gene locus rather than three separate genes. If they were on different loci, the Cappuccino × Sable cross would produce some offspring carrying one copy each of Cappuccino and Sable on independent chromosomes, expressing both traits weakly — instead, what you actually see is a single distinct intermediate phenotype, which is the textbook signature of two alleles competing for the same gene slot.',
      },
      {
        type: 'table',
        caption: 'Cappuccino × Cappuccino expected outcomes',
        headers: ['Genotype', 'Frequency', 'Phenotype', 'Notes'],
        rows: [
          ['+/+', '25%', 'Non-Cappuccino', 'Healthy, no Cappuccino expression.'],
          ['+/CAPP', '50%', 'Heterozygous Cappuccino', 'Healthy, full Cappuccino phenotype.'],
          ['CAPP/CAPP', '25%', 'Super Cappuccino (Melanistic)', '⚠️ Reduced nostril size, breathing difficulty, poor thriving documented.'],
        ],
      },
    ],
    faq: [
      {
        question: 'Is Cappuccino codominant or incomplete dominant?',
        answer:
          'Cappuccino is incomplete dominant, not codominant — a common hobby error corrected by the Foundation Genetics project. Two copies produce the Super Cappuccino (Melanistic) form, which is the diagnostic signature of incomplete dominance.',
      },
      {
        question: 'Can I safely breed Super Cappuccinos?',
        answer:
          'Super Cappuccinos (homozygous CAPP/CAPP) have documented health concerns including reduced nostril size and breathing difficulties. Breeding specifically for Supers is not recommended. Pair Cappuccino × non-Cappuccino instead, which produces approximately 50% Cappuccino offspring without producing Supers.',
      },
      {
        question: 'What is the difference between Cappuccino and Sable?',
        answer:
          'Cappuccino and Sable are both incomplete dominant traits that sit at the same gene locus (allelic), but they are distinct alleles. Cappuccino × Sable produces a compound heterozygote called Luwak, NOT a Super Cappuccino — which is the key evidence proving they share a locus.',
      },
      {
        question: 'How do I identify a heterozygous Cappuccino?',
        answer:
          'Look for a Y-shape at the base of the tail, white flecks or splotching along the lower spine, reduced lateral pattern, and bright sharp white on the tail base in hatchlings with a darker tail tip.',
      },
      {
        question: 'What is a Frappuccino crested gecko?',
        answer:
          'A Frappuccino is a Cappuccino combined with the Lilly White trait (Cappuccino + Lilly White). Frappuccinos hatch with brighter, whiter coloration than a standard Lilly White and develop dramatic white spotting on the head as they mature.',
      },
      {
        question: 'When was Cappuccino discovered?',
        answer:
          'Cappuccino was discovered and proven by Reptile City Korea in 2020–2021. The trait has since been adopted by major US, EU, and Asian breeders and is now one of the most widely worked incomplete dominant traits in the hobby.',
      },
    ],
    internalLinks: [
      { label: 'Cappuccino in the Morph Guide', path: '/MorphGuide/cappuccino' },
      { label: 'Lilly White morph reference', path: '/MorphGuide/lilly-white' },
      { label: 'Crested Gecko Genetics Guide', path: '/GeneticsGuide' },
      { label: 'Genetic Calculator Tool', path: '/GeneticCalculatorTool' },
      { label: 'Incomplete-dominant morph hub', path: '/MorphGuide/inheritance/incomplete-dominant' },
    ],
    externalCitations: [
      {
        label: 'Lil Monsters Reptiles — Cappuccino White Paper',
        url: 'https://lmreptiles.com/fg-pt2-capps/',
      },
      {
        label: 'LM Reptiles — Foundation Genetics Overview',
        url: 'https://lmreptiles.com/fg-overview/',
      },
      {
        label: 'ReptiDex Genetics Library — Crested Gecko',
        url: 'https://reptidex.com/genetics/crested-gecko',
      },
    ],
  },
  {
      slug: 'super-cappuccino-viability-debate',
      title: 'Super Cappuccino: Scam, or Just Misunderstood?',
      description: 'Super Cappuccino (Frappuccino) crested geckos are genetically legitimate—but breeders call them a scam. Here\'s the real debate about viability, ethics, and breeding risk.',
      keyphrase: 'super cappuccino crested gecko',
      category: 'breeding',
      tags: [
        'super cappuccino viability debate',
      ],
      datePublished: '2026-05-05',
      dateModified: '2026-05-05',
      heroEyebrow: 'Breeding Ethics',
      tldr: [
        'Frappuccino (Super Cappuccino) is the homozygous form of the incomplete-dominant Cappuccino morph—genetically real, not a scam.',
        'Cappuccino × Cappuccino pairings produce ~25% Frappuccinos, ~50% Cappuccinos, and ~25% normals, per standard incomplete-dominant math.',
        'Community concern centers on reported clutch failures and health issues in Cappuccino × Cappuccino pairings—not on whether the morph exists.',
        'The safest breeding approach remains Cappuccino × non-carrier: 50% Cappuccino offspring, zero lethal-super risk.',
        'Calling Frappuccino \'a scam\' conflates the genetics with the ethics of chasing homozygous animals when viability data is still thin.',
      ],
      body: [
        {
          type: 'p',
          text: 'A visual Cappuccino crested gecko will run you $400–$1,200 depending on the line. Pair it to another Cappuccino and the math says one in four babies is a Frappuccino—a Super Cappuccino, the homozygous form—worth multiples of that. On paper, it sounds like the easiest money in the hobby. In practice, a corner of the breeding community has decided the whole thing is a scam. Both sides are wrong in useful ways, and sorting out which parts are wrong matters for your breeding decisions and your animals\' welfare.',
        },
        {
          type: 'p',
          text: 'So is the Super Cappuccino a legitimate morph or an elaborate bit of wishful genetics?',
        },
        {
          type: 'p',
          text: 'The answer is neither clean nor comfortable: the Frappuccino is genetically real, predicted by the same incomplete-dominant math that governs Lilly White and Soft Scale. The controversy isn\'t about whether the gene exists. It\'s about what happens when you breed for the homozygous form before you have enough data to know whether two copies of this gene are safe. That\'s a different question—and a harder one.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'What the genetics actually say',
        },
        {
          type: 'p',
          text: 'Cappuccino is a proven incomplete-dominant morph. Single copy produces the visual form: a characteristic warm brown animal with a connected dorsal pattern and distinctive eye-rim markings. Two copies produce the super form, which the hobby calls Frappuccino. This is standard incomplete-dominant behavior—the same pattern as Lilly White (one copy = visual morph, two copies = super form) and Soft Scale (same structure).',
        },
        {
          type: 'p',
          text: 'Per the genetics corpus underlying this site, the expected offspring ratios from a Cappuccino × Cappuccino pairing are:',
        },
        {
          type: 'ul',
          items: [
            '**25% Frappuccino** (homozygous, two copies)',
            '**50% Cappuccino** (heterozygous, one copy, visual)',
            '**25% normal** (no copies)',
          ],
        },
        {
          type: 'p',
          text: 'That is not speculation. That is incomplete-dominant inheritance mechanics. A Punnett square with two heterozygous Cappuccino parents produces those ratios with the same certainty as any other proven incomplete dominant in the species.',
        },
        {
          type: 'p',
          text: 'What the Punnett square cannot tell you is whether two copies of the Cappuccino gene produces a healthy, fertile, long-lived animal. That\'s where the community\'s concern is actually grounded—and where the word "scam" goes off the rails.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'The Frappuccino exists. The debate is about what it costs.',
        },
        {
          type: 'p',
          text: 'Frappuccinos exist. That is settled. Multiple breeders have produced them, photographed them, kept them alive. They show amplified dorsal patterning, paler and more neutral body color, and cleaner pattern boundaries than single-copy animals. They are recognizable as a distinct phenotype.',
        },
        {
          type: 'p',
          text: 'The problem is what some breeders report happens along the way. Several community voices—including the YouTube discussions that sparked this post—describe reduced clutch viability when pairing Cappuccino to Cappuccino. Not dramatically failed eggs (that\'s what a confirmed lethal allele looks like, as with Super Lilly White), but quieter problems: lower hatch rates, smaller clutch sizes, animals that seem less robust out of the egg.',
        },
        {
          type: 'p',
          text: 'This is meaningfully different from the Lilly White situation. When you pair two Lilly Whites, the ~25% of embryos that inherit two LW alleles simply don\'t hatch. The Frappuccino situation appears to be murkier—some Cap × Cap clutches produce Frappuccinos that seem perfectly healthy; others underperform. The honest description from the morph-guide corpus is: "some breeders report reduced clutch sizes or health issues from Cappuccino × Cappuccino pairings. Proceed with caution and document outcomes."',
        },
        {
          type: 'p',
          text: 'That\'s not a verdict. It\'s a flag.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Why calling it a scam misses the point',
        },
        {
          type: 'p',
          text: 'The YouTube title "Don\'t buy super cappuccino crested gecko it\'s a scam and waste of money" is doing two different things at once, and only one of them holds up under scrutiny.',
        },
        {
          type: 'p',
          text: 'The first argument—that the Frappuccino *morph* is a genetic fiction—is false. The incomplete-dominant math is solid. Frappuccinos are real phenotypic animals with a predictable genetic basis. Calling the morph itself a scam conflates bad breeding documentation with flawed genetics.',
        },
        {
          type: 'p',
          text: 'The second argument—that *buying* a Frappuccino from an undocumented or high-risk line and expecting a healthy breeding animal is a bad investment—has more merit. If a breeder produced Frappuccinos from a Cap × Cap pairing but cannot tell you clutch viability data, how many siblings made it to adulthood, and whether the Frappuccino parents they used have a demonstrated health track record, you\'re buying into an unknown. The morph is real; the specific animal\'s long-term viability is uncertain.',
        },
        {
          type: 'p',
          text: 'The distinction matters. One is a genetics claim (false). The other is a risk assessment (reasonable).',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'What the Lilly White comparison actually teaches us',
        },
        {
          type: 'p',
          text: 'Lilly White is the cleanest case study for incomplete-dominant ethics in this hobby, and it\'s worth leaning on. Two copies of the LW gene is embryonic-lethal—eggs develop partially and fail to hatch. The community converged on an ethic: never pair two visual Lilly Whites. You get 50% visual LW offspring, 50% normals, and zero lethal supers by breeding LW × non-carrier. That pairing is universal best practice and widely enforced.',
        },
        {
          type: 'p',
          text: 'The Cappuccino situation is not that clean. Super Lilly White never survives to hatch. Frappuccinos do survive—the question is whether they thrive consistently. That ambiguity is both the reason the debate persists and the reason the "just avoid it like you avoid Super LW" argument doesn\'t quite land. You can\'t compare a confirmed hard lethal to a possible soft effect and draw the same policy conclusion.',
        },
        {
          type: 'p',
          text: 'What the LW comparison *does* teach us: when the super form of an incomplete dominant has any credible health concerns, the burden of proof is on the breeder pursuing it to document outcomes rigorously. The community converged on LW ethics once the data was unambiguous. The Frappuccino community is still in the data-gathering phase—which means irresponsible production now shapes what the data will look like.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'My actual position on this',
        },
        {
          type: 'p',
          text: 'I think the framing of "scam or morph" is the wrong question, and it is burning productive debate. Here\'s the question that matters: *do we have enough documented Frappuccino health data to breed for them at scale?*',
        },
        {
          type: 'p',
          text: 'I don\'t think we do. Not because the morph is fake, but because the community data is thin and unevenly reported. Most of what circulates is anecdote—breeders who report clutch problems often aren\'t logging complete data, and breeders who report healthy Frappuccinos have an obvious incentive to emphasize the positive. Neither camp is running controlled experiments.',
        },
        {
          type: 'p',
          text: 'That leaves responsible breeders in an uncomfortable middle: the genetics work, the animals exist, but the risk profile is genuinely unclear. Breeding Cappuccino × Cappuccino for Frappuccinos is not the same category of error as pairing two Lilly Whites. But it\'s not the same category as pairing two Harlequins either.',
        },
        {
          type: 'p',
          text: 'My default is the conservative one: **Cappuccino × non-carrier**. You get 50% Cappuccino offspring every clutch, no Frappuccino risk, and you\'re still building a line that can produce Frappuccinos in future generations if you ever decide the data is good enough. That\'s not squeamishness. It\'s not treating the morph as a scam. It\'s acknowledging that "genetically possible" and "demonstrated safe to produce at scale" are different standards, and our hobby is still closing that gap on this particular gene.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Practical takeaways for your breeding program',
        },
        {
          type: 'p',
          text: '**If you own a Cappuccino and want to breed it**, pair it to a non-carrier. You\'ll produce roughly half Cappuccino offspring. Your buyers get clean, proven visual animals with no ambiguous viability history attached. Your own documentation stays uncomplicated.',
        },
        {
          type: 'p',
          text: '**If you want to work toward Frappuccinos**, plan it across multiple generations. Produce strong Cappuccino × non-carrier clutches, evaluate the offspring, identify the animals with the best expression and the most robust health, and pair selectively from there. Don\'t rush to a Cap × Cap pairing just because you have two visual animals available.',
        },
        {
          type: 'p',
          text: '**If you\'re considering buying a Frappuccino**, ask hard questions. How many clutches has this breeder produced from Cap × Cap pairings? What are the hatch rates? Are the Frappuccino\'s siblings still alive and thriving? What\'s the health history of the specific Frappuccino you\'re looking at? A legitimate breeder who has done this right will have these answers. A breeder who sells you "the genetics work, so it\'s fine" without documentation is the real scam—not the morph.',
        },
        {
          type: 'p',
          text: '**If you\'re evaluating animals marketed as possible Frappuccinos**, remember that deeper body color, amplified dorsal saddle, and paler neutral tone are the visual indicators—but those features alone don\'t prove two-copy status. Lineage documentation is the only confirmation that works. A "looks like a Frappuccino" animal from unknown parents is just a dark Cappuccino.',
        },
        {
          type: 'p',
          text: '**Document every Cap × Cap clutch you produce.** The community needs this data. Egg count, fertility rate, hatch rate, offspring health at 30/60/90 days. If Frappuccinos are genuinely healthy at population scale, the data will show it over time. If there\'s a real viability concern, the data will show that too. Anecdote is not data. Be the breeder who generates actual signal.',
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'Back to the pair at the beginning',
        },
        {
          type: 'p',
          text: 'So: two visual Cappuccinos, a Punnett square that says one in four babies should be a Frappuccino, and a community calling it a scam.',
        },
        {
          type: 'p',
          text: 'The scam isn\'t the morph. The scam is pretending the ethics are simple in either direction—either "the math works so breed away" or "it\'s all fake, don\'t touch it." The real situation is that an incomplete-dominant gene with an incompletely characterized super form is sitting in the hands of a hobby that hasn\'t yet generated the rigorous data to set clear norms.',
        },
        {
          type: 'p',
          text: 'Breed Cappuccino × non-carrier. Keep meticulous records if you do otherwise. Buy from breeders who can show you their work. And stop calling the whole morph a scam—it\'s muddying the conversation that actually needs to happen.',
        },
      ],
      faq: [
        {
          question: 'Is the Super Cappuccino (Frappuccino) crested gecko a real morph?',
          answer: 'Yes. Frappuccino is the homozygous (super) form of the incomplete-dominant Cappuccino morph—the same relationship Lilly White has to Super Lilly White. It is genetically real and multiple breeders have produced them. The debate is about the health and viability of the super form, not whether the gene exists.',
        },
        {
          question: 'What are the odds of producing a Frappuccino from Cappuccino × Cappuccino?',
          answer: 'Standard incomplete-dominant math: 25% Frappuccino, 50% Cappuccino, 25% normal offspring. These are probabilities across many clutches, not guarantees per egg. A single clutch can produce zero or all Frappuccinos by chance alone.',
        },
        {
          question: 'Is it safe to breed two Cappuccino crested geckos together?',
          answer: 'It\'s not confirmed lethal the way Lilly White × Lilly White is, but some breeders report reduced hatch rates and health concerns from Cap × Cap pairings. The safer default is Cappuccino × non-carrier, which produces 50% Cappuccino offspring and eliminates any Frappuccino viability risk entirely.',
        },
        {
          question: 'What does a Frappuccino crested gecko look like?',
          answer: 'Frappuccinos show a more amplified dorsal saddle than single-copy Cappuccinos, a paler and more neutral body color, and cleaner pattern boundaries. The expression is generally more extreme than a visual Cappuccino but varies with background genetics.',
        },
        {
          question: 'Why do people call Super Cappuccino geckos a scam?',
          answer: 'The \'scam\' label usually refers to sellers marketing Frappuccinos without disclosing potential viability concerns, or to buyers overpaying based on incomplete genetics claims. The morph itself is genetically legitimate. The risk is in buying from a line without documented health and clutch data.',
        },
        {
          question: 'How is Frappuccino different from Super Lilly White?',
          answer: 'Super Lilly White is confirmed embryonic-lethal—two copies of the LW gene means eggs fail to hatch. Frappuccinos do survive and can be healthy animals. The concern is that some Cap × Cap pairings show reduced viability or clutch problems, but this is a debated soft effect, not a confirmed hard lethal.',
        },
        {
          question: 'What questions should I ask before buying a Frappuccino crested gecko?',
          answer: 'Ask for the clutch hatch rate, how many siblings from the same Cap × Cap pairing are alive and healthy, the Frappuccino\'s age and weight trajectory, and the health history of both parents. A reputable breeder will have documentation. Reluctance to share this data is a red flag.',
        },
        {
          question: 'Can I produce Frappuccinos without a Cappuccino × Cappuccino pairing?',
          answer: 'No. Two copies of the Cappuccino gene are required. The only path to a Frappuccino is pairing two animals that each carry at least one Cappuccino allele—i.e., two visual Cappuccinos. You cannot produce the super form from a Cappuccino × non-carrier pairing.',
        },
      ],
      internalLinks: [
        {
          href: '/MorphGuide/cappuccino',
          label: 'Cappuccino morph guide',
        },
        {
          href: '/MorphGuide/frappuccino',
          label: 'Frappuccino (Super Cappuccino) morph guide',
        },
        {
          href: '/MorphGuide/lilly-white',
          label: 'Lilly White morph — lethal allele reference',
        },
        {
          href: '/GeneticsGuide',
          label: 'Crested gecko genetics guide: incomplete dominant inheritance',
        },
        {
          href: '/GeneticCalculatorTool',
          label: 'Genetic calculator — model your Cappuccino pairings',
        },
        {
          href: '/MorphGuide/inheritance/incomplete-dominant',
          label: 'All incomplete-dominant crested gecko morphs',
        },
      ],
      externalCitations: [
        {
          url: 'https://www.youtube.com/watch?v=JLXYdEo7mhk',
          label: 'TikisGeckos — Should We Breed Super Cappuccino Crested Geckos? (YouTube)',
        },
        {
          url: 'https://www.youtube.com/watch?v=5O_obmlNu9I',
          label: 'Don\'t Buy Super Cappuccino Crested Gecko — It\'s a Scam (YouTube)',
        },
      ],
    }
];

/**
 * Look up a blog post by slug. Returns null if not found.
 */
export function getBlogPost(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null;
}

/**
 * Get the BLOG_CATEGORIES entry for a category id, or null.
 */
export function getBlogCategory(id) {
  return BLOG_CATEGORIES.find((c) => c.id === id) || null;
}

/**
 * Posts grouped by category id, in BLOG_CATEGORIES display order. Used by
 * the blog index page to render category-grouped lists.
 */
export function postsByCategory() {
  const out = BLOG_CATEGORIES.map((c) => ({
    category: c,
    posts: BLOG_POSTS.filter((p) => p.category === c.id),
  }));
  return out.filter((g) => g.posts.length > 0);
}

/**
 * Recent posts, newest first by datePublished. Used by the blog index
 * hero section and by per-post "Related reading" footers.
 */
export function recentPosts(limit = 6) {
  return [...BLOG_POSTS]
    .sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1))
    .slice(0, limit);
}
