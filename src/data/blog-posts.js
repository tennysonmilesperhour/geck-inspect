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
  {
    id: 'care',
    label: 'Care & Husbandry',
    description:
      'Practical guides for crested gecko diet, enclosure setup, temperature, humidity, weight tracking, and day-to-day husbandry for hatchlings through adults.',
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
      { label: 'Genetic Calculator Tool', path: '/calculator' },
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
          href: '/calculator',
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
    },

  // ─── Crested Gecko Diet Guide ──────────────────────────────
  {
    slug: 'crested-gecko-diet-guide',
    title: 'Crested Gecko Diet Guide: CGD, Insects, and Fruit',
    description:
      'Complete crested gecko diet guide covering CGD brands (Pangea vs Repashy), insect feeding, fruit treats, and feeding schedules for hatchlings through adults.',
    keyphrase: 'crested gecko diet',
    category: 'care',
    tags: ['crested gecko diet', 'crested gecko food', 'pangea', 'repashy', 'CGD', 'feeding schedule', 'insects', 'fruit'],
    datePublished: '2026-05-05',
    dateModified: '2026-05-05',
    heroEyebrow: 'Care essentials',
    tldr: [
      'A commercial crested gecko diet (CGD) should be the foundation of every crestie\'s nutrition. Pangea and Repashy are the two dominant brands, and both produce healthy geckos.',
      'Insects are a supplement, not the main course. Offer appropriately sized crickets or dubia roaches 1-2 times per week for adults, dusted with calcium + D3.',
      'Fruit is a treat, not a meal. Mashed banana, papaya, or mango can be offered occasionally but should never replace CGD.',
      'Hatchlings eat the same CGD as adults but need food swapped every 24 hours and should not be offered insects until they weigh at least 5 grams.',
      'Picky eaters are common. Rotate CGD flavors, try a different brand, and ensure humidity and temperature are correct before assuming the gecko has a feeding problem.',
    ],
    body: [
      {
        type: 'p',
        text: 'Crested geckos are omnivores in the wild, eating a mix of overripe fruit, nectar, pollen, and small invertebrates found on the forest floors and canopies of New Caledonia. In captivity, their diet has been simplified by the development of commercial crested gecko diets (CGDs), which are powdered meal replacements that provide balanced nutrition when mixed with water. This guide covers everything you need to know about feeding your crested gecko, from choosing the right CGD brand to supplementing with insects and fruit.',
      },
      {
        type: 'p',
        text: 'If you are new to crested gecko keeping, the single most important takeaway is this: a quality CGD mixed fresh every 24-48 hours is the foundation of a healthy diet. Everything else, including insects, fruit, and supplements, is a bonus on top of that foundation.',
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'CGD basics',
        items: [
          'CGD stands for crested gecko diet, a powdered meal replacement mixed with water to form a paste or smoothie consistency.',
          'The two dominant brands are Pangea and Repashy. Both have been feeding healthy crested geckos for over a decade.',
          'Mix fresh CGD every 24-48 hours. Remove uneaten food before it dries out or molds.',
          'Offer CGD in a shallow dish or feeding ledge mounted at the top third of the enclosure, where cresties naturally forage.',
        ],
      },
      {
        type: 'p',
        text: 'The Pangea vs Repashy debate is one of the longest-running conversations in the hobby, and the honest answer is that both brands produce thriving geckos. The real differences come down to protein content, ingredient sourcing, and which flavors your individual gecko prefers.',
      },
      {
        type: 'table',
        caption: 'Pangea vs Repashy CGD comparison',
        headers: ['Feature', 'Pangea', 'Repashy'],
        rows: [
          ['Protein content', '20-21% (Classic, Pineapple Express)', '20% (Classic), 24% (Grubs & Fruit)'],
          ['Fruit base', 'Banana, papaya, apricot depending on flavor', 'Banana, date, fig depending on formula'],
          ['Insect protein source', 'Black soldier fly larvae in some formulas', 'Black soldier fly larvae in Grubs & Fruit'],
          ['Texture', 'Smoother, more liquid consistency', 'Thicker, paste-like consistency'],
          ['Flavor variety', '8+ flavors including seasonal releases', '4-5 core formulas'],
          ['Popularity in hobby', 'Slightly more popular among US breeders', 'Long-established, strong international following'],
          ['Price (8oz)', '$15-18', '$14-17'],
        ],
      },
      {
        type: 'p',
        text: 'Many experienced breeders rotate between Pangea and Repashy to give their geckos nutritional variety. This is a good practice. Each brand has slightly different vitamin and mineral profiles, and rotating ensures no single micronutrient gap persists over time. If your gecko is a picky eater, try a different flavor or brand before assuming it has a feeding problem.',
      },
      {
        type: 'p',
        text: 'Insects are a valuable protein supplement but should not be the primary food source. In the wild, crested geckos eat insects opportunistically. In captivity, offer appropriately sized crickets, dubia roaches, or black soldier fly larvae 1-2 times per week. Always dust insects with a calcium + vitamin D3 supplement before feeding. Insects that are too large can cause choking or impaction: the general rule is that the insect should be no wider than the space between the gecko\'s eyes.',
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Insect feeding safety',
        items: [
          'Never feed wild-caught insects. They may carry parasites or pesticide residue.',
          'Always dust feeder insects with calcium + D3 powder. Crested geckos in screen-top enclosures with no UVB are entirely dependent on dietary D3.',
          'Remove uneaten insects after 15-20 minutes. Live crickets left overnight can stress or bite your gecko.',
          'Do not offer mealworms as a primary feeder. Their chitin-to-nutrition ratio is poor compared to crickets or dubia.',
        ],
      },
      {
        type: 'p',
        text: 'Fruit is a treat, not a meal. Crested geckos love mashed banana, papaya, mango, and fig, but these fruits lack the protein, calcium, and complete vitamin profile that CGD provides. Offer a small amount of mashed fruit once a week at most, and never as a replacement for CGD. Some keepers mix a small amount of fruit into CGD to entice picky eaters.',
      },
      {
        type: 'table',
        caption: 'Feeding schedule by age',
        headers: ['Age', 'CGD frequency', 'Insect frequency', 'Notes'],
        rows: [
          ['Hatchling (0-3 months)', 'Fresh CGD every 24 hours', 'None until 5+ grams', 'Tiny portions in a bottle cap or small dish. Keep humidity up.'],
          ['Juvenile (3-12 months)', 'Fresh CGD every 24-48 hours', '2-3 small crickets, 1-2x/week', 'Growth period. May eat more. Dust all insects.'],
          ['Sub-adult (12-18 months)', 'Fresh CGD every 48 hours', '3-5 medium crickets, 1-2x/week', 'Appetite may stabilize. Monitor weight monthly.'],
          ['Adult (18+ months)', 'Fresh CGD every 48 hours', '3-5 crickets or dubia, 1x/week', 'Breeding females need more calcium. Adjust portions by weight.'],
        ],
      },
      {
        type: 'p',
        text: 'Track your gecko\'s weight monthly to make sure your feeding approach is working. A healthy juvenile should gain 2-4 grams per month. An adult female in breeding season will eat significantly more than an adult male. If your gecko is losing weight or refusing food for more than two weeks, check enclosure temperature (should be 72-78F), humidity (50-70%, spiking to 80%+ after misting), and stress factors before adjusting the diet.',
      },
    ],
    faq: [
      {
        question: 'What do crested geckos eat?',
        answer:
          'Crested geckos eat a commercial powdered diet (CGD) as their primary food, supplemented with live insects (crickets, dubia roaches) 1-2 times per week and occasional fruit treats. Pangea and Repashy are the two most popular CGD brands.',
      },
      {
        question: 'Is Pangea or Repashy better for crested geckos?',
        answer:
          'Both produce healthy geckos. Pangea tends to have more flavor variety and a smoother consistency, while Repashy Grubs & Fruit has higher protein content (24% vs 20-21%). Many breeders rotate between both brands for nutritional variety.',
      },
      {
        question: 'How often should I feed my crested gecko?',
        answer:
          'Offer fresh CGD every 24 hours for hatchlings, every 24-48 hours for juveniles, and every 48 hours for adults. Supplement with live insects 1-2 times per week for juveniles and adults. Remove uneaten CGD before it dries out.',
      },
      {
        question: 'Can crested geckos eat fruit?',
        answer:
          'Yes, crested geckos can eat small amounts of mashed banana, papaya, mango, and fig as occasional treats. Fruit should never replace CGD as the primary diet because it lacks adequate protein, calcium, and complete vitamins.',
      },
      {
        question: 'Do crested geckos need insects?',
        answer:
          'Insects are beneficial but not strictly required if you are feeding a high-quality CGD. However, most keepers and breeders recommend offering crickets or dubia roaches 1-2 times weekly for additional protein and enrichment.',
      },
      {
        question: 'What insects can crested geckos eat?',
        answer:
          'Crickets and dubia roaches are the most common feeders. Black soldier fly larvae are also excellent. Avoid mealworms as a primary feeder due to their high chitin content. Always dust insects with calcium + D3 before feeding.',
      },
    ],
    internalLinks: [
      { label: 'Complete Crested Gecko Care Guide', path: '/CareGuide' },
      { label: 'Feeding section in the Care Guide', path: '/CareGuide#feeding' },
      { label: 'Crested Gecko Morph Guide', path: '/MorphGuide' },
      { label: 'Weight tracking in Geck Inspect', path: '/MyGeckos' },
    ],
    externalCitations: [
      {
        label: 'Pangea Reptile -- CGD formulas',
        url: 'https://www.pangeareptile.com/',
      },
      {
        label: 'Repashy Superfoods -- CGD product line',
        url: 'https://www.repashy.com/',
      },
      {
        label: 'ReptiFiles -- Crested Gecko Diet Guide',
        url: 'https://reptifiles.com/crested-gecko-care/crested-gecko-diet/',
      },
    ],
  },

  // ─── Crested Gecko Enclosure Setup Guide ───────────────────
  {
    slug: 'crested-gecko-enclosure-setup-guide',
    title: 'Crested Gecko Enclosure Setup: The Complete Guide',
    description:
      'How to set up a crested gecko enclosure from scratch. Covers tank size, substrate, temperature, humidity, lighting, plants, and bioactive vs simple setups.',
    keyphrase: 'crested gecko enclosure',
    category: 'care',
    tags: ['crested gecko enclosure', 'crested gecko setup', 'crested gecko tank', 'bioactive', 'temperature', 'humidity'],
    datePublished: '2026-05-05',
    dateModified: '2026-05-05',
    heroEyebrow: 'Setup guide',
    tldr: [
      'Minimum enclosure size for one adult crested gecko: 18x18x24 inches (45x45x60 cm). Bigger is better, especially vertical space.',
      'Temperature: 72-78F (22-25C) during the day, down to 65-72F (18-22C) at night. Never exceed 82F (28C) or heat stroke is a real risk.',
      'Humidity: 50-70% during the day, spike to 80-100% after evening misting. Let it dry out between mistings to prevent respiratory infections.',
      'Bioactive setups (live plants, cleanup crew) are better long-term but cost more upfront. Paper towel substrate works for quarantine and hatchlings.',
      'Crested geckos are arboreal. Vertical climbing space, branches, and elevated feeding ledges matter more than floor space.',
    ],
    body: [
      {
        type: 'p',
        text: 'Setting up a crested gecko enclosure correctly from day one prevents most of the common health issues new keepers encounter: dehydration, stuck shed, respiratory infection, heat stress, and failure to thrive. Crested geckos are arboreal (tree-dwelling) geckos from the humid forests of New Caledonia, and their enclosure needs to replicate a warm, humid, vertically oriented environment with plenty of climbing opportunities and hiding spots.',
      },
      {
        type: 'p',
        text: 'This guide walks through every component of a proper crested gecko enclosure, from choosing the right tank size to deciding between a simple paper towel setup and a full bioactive vivarium.',
      },
      {
        type: 'p',
        text: 'The most common enclosure for adult crested geckos is a front-opening glass terrarium. Exo Terra and Zoo Med are the two dominant brands. The minimum size for a single adult is 18x18x24 inches (45x45x60 cm). A 24x18x36 inch enclosure is better if you have the space and budget. Height matters more than floor space for an arboreal species. Screen-top aquariums can work but make it harder to maintain humidity in dry climates.',
      },
      {
        type: 'table',
        caption: 'Enclosure size recommendations',
        headers: ['Gecko age/count', 'Minimum size', 'Recommended size'],
        rows: [
          ['Hatchling (0-3 months)', '6x6x12 or small Kritter Keeper', '12x12x12 for visibility'],
          ['Juvenile (3-12 months)', '12x12x18', '18x18x24 for less frequent upgrades'],
          ['Single adult', '18x18x24', '24x18x36'],
          ['Pair (breeding)', '24x18x36', '36x18x36 or custom build'],
        ],
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'Temperature is the #1 killer',
        items: [
          'Crested geckos cannot tolerate temperatures above 82F (28C) for extended periods. Heat stroke is real and can be fatal.',
          'If your room regularly exceeds 80F, you need air conditioning, not a heat lamp.',
          'Nighttime temperature drops to 65-72F are natural and healthy. Do not heat the enclosure 24/7.',
          'A simple digital thermometer/hygrometer placed at mid-height in the enclosure is essential. Analog gauges are unreliable.',
        ],
      },
      {
        type: 'p',
        text: 'Substrate serves two purposes: maintaining humidity and providing a natural floor. For hatchlings and quarantine situations, paper towels are ideal because they are easy to replace and let you monitor droppings for health issues. For permanent adult enclosures, the options split into two camps: simple and bioactive.',
      },
      {
        type: 'p',
        text: 'A simple substrate setup uses coconut fiber (eco earth), sphagnum moss, or a mix of the two. It holds humidity well, looks natural, and is cheap to replace every 4-6 weeks. The downside is that it requires regular full substrate changes to prevent mold and bacterial growth.',
      },
      {
        type: 'p',
        text: 'A bioactive substrate setup uses a layered approach: a drainage layer (LECA or hydro balls) at the bottom, a mesh screen separator, then a soil mix (ABG mix, tropical bio-mix, or DIY blend of organic topsoil + coconut fiber + orchid bark + sphagnum moss). Add springtails and isopods as a cleanup crew. They eat mold, gecko waste, and decaying plant matter, creating a self-sustaining micro-ecosystem that rarely needs substrate changes.',
      },
      {
        type: 'table',
        caption: 'Simple vs bioactive substrate comparison',
        headers: ['Factor', 'Simple (coconut fiber)', 'Bioactive'],
        rows: [
          ['Upfront cost', '$10-20', '$50-100+'],
          ['Maintenance', 'Full change every 4-6 weeks', 'Spot-clean only, rarely needs replacing'],
          ['Humidity control', 'Good', 'Excellent (drainage layer prevents waterlogging)'],
          ['Mold risk', 'Moderate (need regular changes)', 'Low (cleanup crew handles it)'],
          ['Visual appeal', 'Basic but clean', 'Natural forest floor look'],
          ['Learning curve', 'None', 'Moderate (need to understand drainage, soil, CUC)'],
          ['Best for', 'Hatchlings, quarantine, minimalists', 'Permanent adult enclosures, display vivariums'],
        ],
      },
      {
        type: 'p',
        text: 'Crested geckos need vertical climbing structures more than anything else. Cork bark tubes, bamboo poles, grapevine branches, and magnetic feeding ledges should fill the upper two-thirds of the enclosure. Live plants (pothos, bromeliads, ficus, dracaena) add humidity and climbing surfaces while making the enclosure look stunning. Fake plants work too if you do not want to maintain live ones.',
      },
      {
        type: 'p',
        text: 'Lighting is often misunderstood for crested geckos. They are crepuscular (most active at dawn and dusk), not strictly nocturnal. While they do not require UVB lighting the way bearded dragons do, low-level UVB (2-5% UVB bulb like Arcadia ShadeDweller) provides documented health benefits including better calcium metabolism and more natural behavior. A standard LED light on a 12-hour day/night cycle is the minimum for establishing a circadian rhythm and supporting live plant growth.',
      },
      {
        type: 'p',
        text: 'Misting is how you manage humidity. Most keepers mist the enclosure once or twice daily: a heavy misting in the evening (when the gecko becomes active) and optionally a lighter morning misting. The enclosure should spike to 80-100% humidity after misting, then gradually dry out to 50-70% during the day. This wet-dry cycle is important. Constant high humidity without drying out promotes respiratory infections and scale rot.',
      },
      {
        type: 'callout',
        tone: 'success',
        title: 'Quick setup checklist',
        items: [
          'Front-opening glass terrarium, 18x18x24 minimum for adults',
          'Digital thermometer/hygrometer at mid-height',
          'Substrate: paper towels (hatchlings) or coconut fiber / bioactive mix (adults)',
          'Cork bark, branches, and plants filling upper two-thirds of enclosure',
          'Magnetic feeding ledge at top third with CGD dish',
          'Water dish on the floor (some geckos drink from it, others prefer licking mist droplets)',
          'LED light on 12-hour timer; optional low-level UVB',
          'Misting bottle or automatic mister',
        ],
      },
    ],
    faq: [
      {
        question: 'What size tank does a crested gecko need?',
        answer:
          'An adult crested gecko needs a minimum of 18x18x24 inches (45x45x60 cm). A 24x18x36 tank is better if you have the space. Height matters more than floor space because crested geckos are arboreal and spend most of their time climbing.',
      },
      {
        question: 'Do crested geckos need a heat lamp?',
        answer:
          'Most crested geckos do not need a heat lamp if your room stays between 72-78F (22-25C) during the day. They cannot tolerate temperatures above 82F. If your room is below 68F, a low-wattage ceramic heat emitter or heat mat controlled by a thermostat is safer than a heat lamp.',
      },
      {
        question: 'What is a bioactive crested gecko enclosure?',
        answer:
          'A bioactive enclosure uses live plants, a layered substrate with drainage, and a cleanup crew of springtails and isopods to create a self-maintaining ecosystem. The cleanup crew eats mold and waste so you rarely need to change the substrate.',
      },
      {
        question: 'How often should I mist my crested gecko enclosure?',
        answer:
          'Mist once or twice daily. A heavy misting in the evening spikes humidity to 80-100%. Let the enclosure dry out to 50-70% during the day. This wet-dry cycle is important for preventing respiratory infections.',
      },
      {
        question: 'Do crested geckos need UVB lighting?',
        answer:
          'Crested geckos can survive without UVB if their diet includes vitamin D3, but low-level UVB (2-5%) provides documented health benefits including better calcium metabolism and more natural behavior. A 12-hour LED light cycle is the minimum.',
      },
      {
        question: 'Can I use a screen-top aquarium for a crested gecko?',
        answer:
          'You can, but front-opening glass terrariums are much better. Screen tops make it harder to maintain humidity in dry climates, and crested geckos can hang from the screen and injure their toes. If you use a screen top, cover part of it with plastic wrap or acrylic to retain humidity.',
      },
    ],
    internalLinks: [
      { label: 'Full Crested Gecko Care Guide', path: '/CareGuide' },
      { label: 'Housing section in Care Guide', path: '/CareGuide#housing' },
      { label: 'Temperature and Humidity guide', path: '/CareGuide#temperature' },
      { label: 'Track your collection on Geck Inspect', path: '/MyGeckos' },
    ],
    externalCitations: [
      {
        label: 'ReptiFiles -- Crested Gecko Terrarium Setup',
        url: 'https://reptifiles.com/crested-gecko-care/crested-gecko-terrarium/',
      },
      {
        label: 'Exo Terra -- Crested Gecko Habitat Guide',
        url: 'https://www.exo-terra.com/',
      },
    ],
  },

  // ─── Crested Gecko vs Leopard Gecko ────────────────────────
  {
    slug: 'crested-gecko-vs-leopard-gecko',
    title: 'Crested Gecko vs Leopard Gecko: The Full Comparison',
    description:
      'Crested gecko vs leopard gecko compared across care difficulty, cost, handling, lifespan, morphs, and personality. Which gecko is the best fit for you?',
    keyphrase: 'crested gecko vs leopard gecko',
    category: 'care',
    tags: ['crested gecko vs leopard gecko', 'best beginner gecko', 'leopard gecko', 'comparison', 'first reptile'],
    datePublished: '2026-05-05',
    dateModified: '2026-05-05',
    heroEyebrow: 'Species comparison',
    tldr: [
      'Crested geckos are lower-maintenance overall: no live insects required, no special heating in most homes, and simpler humidity needs than many keepers expect.',
      'Leopard geckos are hardier in hot climates (they tolerate higher temps) and eat a primarily insect-based diet that some keepers enjoy more.',
      'Both are excellent beginner reptiles. Crested geckos are better for keepers in cooler climates who want a display vivarium. Leopard geckos suit warmer climates and keepers who enjoy insect feeding.',
      'Crested gecko morph diversity is exploding, with 30+ documented morphs. Leopard geckos have a more established morph market.',
      'Lifespan: crested geckos live 15-20 years; leopard geckos can exceed 20-30 years with proper care.',
    ],
    body: [
      {
        type: 'p',
        text: 'The crested gecko vs leopard gecko debate is the first decision most new reptile keepers face. Both species are docile, handleable, available in dozens of color morphs, and manageable in a modest living space. But they are fundamentally different animals with different care requirements, temperaments, and long-term commitments. This comparison breaks down every factor that matters so you can make the right choice for your situation.',
      },
      {
        type: 'table',
        caption: 'Quick comparison: crested gecko vs leopard gecko',
        headers: ['Factor', 'Crested Gecko', 'Leopard Gecko'],
        rows: [
          ['Scientific name', 'Correlophus ciliatus', 'Eublepharis macularius'],
          ['Origin', 'New Caledonia (tropical island)', 'Afghanistan, Pakistan, India (arid desert)'],
          ['Adult size', '7-9 inches, 35-55 grams', '8-11 inches, 45-80 grams'],
          ['Lifespan', '15-20 years', '20-30+ years'],
          ['Enclosure type', 'Vertical (arboreal)', 'Horizontal (terrestrial)'],
          ['Min enclosure', '18x18x24 inches', '36x18x12 inches (long, low)'],
          ['Temperature', '72-78F, never above 82F', '75-80F cool side, 88-92F hot spot'],
          ['Humidity', '50-80% (misting required)', '30-40% (dry, with a moist hide)'],
          ['Diet', 'CGD (powder + water) + occasional insects', 'Live insects only (crickets, dubia, mealworms)'],
          ['Handling', 'Jumpy but docile, can drop tail', 'Calm, less jumpy, can drop tail (regrows with bump)'],
          ['Nocturnal?', 'Crepuscular (dawn/dusk)', 'Nocturnal (night active)'],
          ['UVB needed?', 'Beneficial but not required', 'Beneficial but not required'],
          ['Morph variety', '30+ morphs, market still growing', '100+ morphs, well-established market'],
          ['Avg price (normal)', '$40-80', '$30-60'],
          ['Avg price (morph)', '$100-2,000+', '$50-500+'],
        ],
      },
      {
        type: 'p',
        text: 'The single biggest practical difference is diet. Crested geckos can thrive on a commercial powdered diet (CGD) with no live insects at all. Leopard geckos are obligate insectivores and require live feeder insects at every meal. If the idea of keeping crickets or dubia roaches alive in your house is a dealbreaker, that alone settles the debate in favor of crested geckos.',
      },
      {
        type: 'p',
        text: 'The second major difference is temperature tolerance. Crested geckos cannot survive sustained temperatures above 82F (28C), which means keepers in hot climates without air conditioning face a serious challenge. Leopard geckos, coming from arid desert environments, actively need a hot basking spot around 90F and tolerate higher ambient temperatures without issue. If your house regularly gets warm in summer, leopard geckos are the safer choice.',
      },
      {
        type: 'p',
        text: 'When it comes to handling, both species tolerate it well once acclimated, but their styles are very different. Leopard geckos tend to sit calmly in your hand and walk slowly between your fingers. Crested geckos are jumpers. They will leap from hand to hand and climb up your arm. Many keepers love this active handling experience, but it means crested geckos are slightly riskier for very young children who might not be ready for a sudden leap.',
      },
      {
        type: 'p',
        text: 'Both species can drop their tails as a defense mechanism. Leopard gecko tails grow back, though the regenerated tail looks different (smoother, fatter). Crested gecko tails do not grow back at all. A tailless crested gecko (called a "frogbutt" in the hobby) is perfectly healthy and can live a full life, but it is permanent. Handle gently and never grab or restrain by the tail.',
      },
      {
        type: 'p',
        text: 'For morph enthusiasts, crested geckos are the more exciting market right now. The crested gecko morph scene is younger and evolving fast, with new traits like Cappuccino, Soft Scale, and Axanthic shaking up breeding projects every year. Leopard geckos have a more mature morph market with over 100 documented morphs, but fewer breakthrough discoveries in recent years. If you want to breed for genetics, both species offer deep complexity.',
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Choose a crested gecko if...',
        items: [
          'You live in a cooler climate (or have AC in summer)',
          'You do not want to deal with live insects as the primary diet',
          'You want a beautiful vertical display vivarium',
          'You are interested in a rapidly evolving morph market',
          'You want a slightly smaller enclosure footprint (vertical vs horizontal)',
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Choose a leopard gecko if...',
        items: [
          'You live in a warmer climate or cannot keep your room below 80F',
          'You enjoy feeding live insects and watching hunting behavior',
          'You prefer a calm, sit-in-your-hand handling style',
          'You want a longer-lived pet (potential 30+ year commitment)',
          'You want a well-established morph market with proven genetics',
        ],
      },
      {
        type: 'p',
        text: 'Both species are excellent for beginners. The "best" gecko is the one that fits your climate, lifestyle, and preferences. Many keepers end up owning both, because the care requirements are different enough that keeping one of each feels like two distinct hobbies.',
      },
    ],
    faq: [
      {
        question: 'Which is easier to care for, a crested gecko or a leopard gecko?',
        answer:
          'Crested geckos are slightly easier overall because they do not require live insects or special heating in most homes. However, leopard geckos are easier in hot climates because they tolerate higher temperatures. Both are beginner-friendly reptiles.',
      },
      {
        question: 'Can crested geckos and leopard geckos live together?',
        answer:
          'No. They have completely different habitat requirements (tropical humid vs arid desert) and should never be housed together. Cohabitation between different gecko species causes stress and potential injury.',
      },
      {
        question: 'Which gecko is better for kids?',
        answer:
          'Leopard geckos are slightly better for young children because they are calmer handlers and less likely to jump. Crested geckos are good for older children (8+) who can handle a jumpy gecko gently without squeezing.',
      },
      {
        question: 'Do leopard geckos or crested geckos live longer?',
        answer:
          'Leopard geckos generally live longer, with many reaching 20-30 years in captivity. Crested geckos live 15-20 years. Both are long-term commitments that should be planned for.',
      },
      {
        question: 'Which gecko has more morphs?',
        answer:
          'Leopard geckos have more documented morphs (100+) due to a longer breeding history. However, crested geckos have a faster-evolving morph market with exciting new traits emerging regularly, including Cappuccino, Soft Scale, and Axanthic.',
      },
      {
        question: 'Are crested geckos or leopard geckos more expensive?',
        answer:
          'Normal-colored animals cost about the same ($30-80). High-end crested gecko morphs tend to command higher prices ($500-2,000+) than most leopard gecko morphs because the crested gecko morph market is newer and certain traits are rarer.',
      },
    ],
    internalLinks: [
      { label: 'Crested Gecko Care Guide', path: '/CareGuide' },
      { label: 'All 30+ Crested Gecko Morphs', path: '/MorphGuide' },
      { label: 'Crested Gecko Genetics Guide', path: '/GeneticsGuide' },
      { label: 'AI Morph Identification Tool', path: '/Recognition' },
    ],
    externalCitations: [
      {
        label: 'ReptiFiles -- Crested Gecko Care',
        url: 'https://reptifiles.com/crested-gecko-care/',
      },
      {
        label: 'ReptiFiles -- Leopard Gecko Care',
        url: 'https://reptifiles.com/leopard-gecko-care/',
      },
    ],
  },

  // ─── Crested Gecko Weight Chart ────────────────────────────
  {
    slug: 'crested-gecko-weight-chart-by-age',
    title: 'Crested Gecko Weight Chart by Age: Growth Milestones',
    description:
      'Crested gecko weight chart from hatchling to adult. Track growth milestones month by month and learn when slow growth signals a problem.',
    keyphrase: 'crested gecko weight chart',
    category: 'care',
    tags: ['crested gecko weight chart', 'crested gecko growth rate', 'crested gecko weight by age', 'growth milestones'],
    datePublished: '2026-05-05',
    dateModified: '2026-05-05',
    heroEyebrow: 'Growth reference',
    tldr: [
      'A healthy crested gecko hatchling weighs 1.5-2 grams. Adults reach 35-55 grams at 18-24 months.',
      'Juveniles (3-12 months) grow fastest, gaining 2-4 grams per month with proper diet and husbandry.',
      'Males tend to max out around 35-45 grams. Females, especially breeding females, often reach 45-55 grams.',
      'Weigh monthly on a digital kitchen scale (0.1g precision). Consistent weight loss over 2+ weigh-ins is a red flag.',
      'Slow growth usually comes from low temperatures, inadequate diet, or stress, not genetics. Fix husbandry before assuming a gecko is "just small."',
    ],
    body: [
      {
        type: 'p',
        text: 'Tracking your crested gecko\'s weight is the single most reliable way to monitor overall health. Unlike visible symptoms like lethargy or appetite changes, which can be subjective, weight is a number you can track over time. A gecko that gains steadily is thriving. A gecko that stalls or loses weight has a problem that needs investigation.',
      },
      {
        type: 'p',
        text: 'This chart shows the typical weight range for crested geckos at each age. Individual geckos vary based on genetics, sex, diet, and husbandry, but this range represents what a healthy, well-fed gecko should weigh. If your gecko falls below the low end of the range consistently, check temperature, diet, and stress factors.',
      },
      {
        type: 'table',
        caption: 'Crested gecko weight chart by age',
        headers: ['Age', 'Weight range', 'Life stage', 'Notes'],
        rows: [
          ['Hatchling', '1.5-2g', 'Baby', 'Do not handle for first 2 weeks. First meal after first shed.'],
          ['1 month', '2-3g', 'Baby', 'Should be eating CGD consistently. Tiny portions, changed daily.'],
          ['2 months', '3-4g', 'Baby', 'Starting to explore enclosure actively at dusk.'],
          ['3 months', '4-6g', 'Juvenile', 'Growth accelerating. Can start offering tiny insects.'],
          ['4 months', '5-8g', 'Juvenile', 'Should be visibly larger than hatchling. Eating well.'],
          ['5 months', '7-10g', 'Juvenile', 'Can begin gentle, brief handling sessions.'],
          ['6 months', '9-13g', 'Juvenile', 'Peak growth rate period begins.'],
          ['8 months', '13-19g', 'Juvenile', 'Sexual characteristics may start becoming visible.'],
          ['10 months', '18-25g', 'Juvenile', 'Growth rate may slow slightly.'],
          ['12 months', '22-32g', 'Sub-adult', 'Many geckos are sexually mature but should not breed yet.'],
          ['15 months', '28-38g', 'Sub-adult', 'Growth continues but slowing.'],
          ['18 months', '32-45g', 'Adult', 'Males may plateau here. Females continue growing.'],
          ['24 months', '35-55g', 'Adult', 'Full adult size. Breeding weight for females: 40g minimum.'],
        ],
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'How to weigh your crested gecko',
        items: [
          'Use a digital kitchen scale with 0.1 gram precision. They cost $10-15 and are essential.',
          'Weigh at the same time of day each month (before feeding is ideal).',
          'Place a small container or deli cup on the scale, tare it to zero, then gently place the gecko inside.',
          'Record the weight in a log. Geck Inspect has built-in weight tracking that generates growth charts automatically.',
          'Weigh monthly for routine tracking. Weigh weekly if you suspect a problem.',
        ],
      },
      {
        type: 'p',
        text: 'The most common cause of slow growth in crested geckos is temperature. A gecko kept at 68F will grow significantly slower than one at 75F because metabolic rate is directly tied to temperature in ectotherms. If your gecko is underweight, check your thermometer before changing the diet. The second most common cause is diet quality. Cheap, off-brand CGDs or diets that rely too heavily on fruit and not enough on CGD will result in slower growth. Pangea and Repashy are the standard for a reason.',
      },
      {
        type: 'p',
        text: 'Stress is the third factor. A gecko in an enclosure that is too large, too sparse, or in a high-traffic area of your home may hide constantly and eat less. Crested geckos are prey animals. They need dense cover, multiple hiding spots, and a quiet environment to feel secure enough to eat, explore, and grow normally.',
      },
      {
        type: 'callout',
        tone: 'warn',
        title: 'When to worry about weight',
        items: [
          'Weight loss over two consecutive monthly weigh-ins in a juvenile is always a concern.',
          'An adult that drops more than 3 grams without obvious cause (egg-laying, seasonal appetite dip) needs a vet check.',
          'A hatchling that has not gained any weight in 4 weeks may not be eating. Check for uneaten CGD and try a different flavor.',
          'Rapid weight gain in a juvenile (5+ grams in a month) can happen during growth spurts and is usually normal.',
        ],
      },
      {
        type: 'p',
        text: 'Female crested geckos tend to weigh more than males at adult size. A healthy adult male typically plateaus between 35-45 grams. An adult female, especially one in a breeding program, often reaches 45-55 grams. Do not breed females under 40 grams, as egg production is energetically expensive and smaller females face higher risks of egg-binding and calcium depletion.',
      },
      {
        type: 'p',
        text: 'Use Geck Inspect\'s built-in weight tracking to log every weigh-in and automatically generate growth curves for each gecko in your collection. The visual chart makes it immediately obvious when a gecko\'s growth stalls or when a female is losing weight during breeding season.',
      },
    ],
    faq: [
      {
        question: 'How much should my crested gecko weigh?',
        answer:
          'A healthy adult crested gecko weighs 35-55 grams at 18-24 months old. Males typically max out at 35-45 grams, while females often reach 45-55 grams. Hatchlings start at 1.5-2 grams.',
      },
      {
        question: 'How fast do crested geckos grow?',
        answer:
          'Crested geckos grow fastest as juveniles (3-12 months), gaining 2-4 grams per month with proper husbandry. Growth slows after 12 months and most geckos reach full adult size by 18-24 months.',
      },
      {
        question: 'Why is my crested gecko not growing?',
        answer:
          'The three most common causes of slow growth are: low enclosure temperature (below 72F), inadequate diet (not enough CGD or low-quality food), and stress (enclosure too sparse, too much handling, or high-traffic location). Check all three before assuming genetics.',
      },
      {
        question: 'How often should I weigh my crested gecko?',
        answer:
          'Monthly weigh-ins are ideal for routine health tracking. Use a digital scale with 0.1g precision. Weigh weekly if you suspect a health problem or during breeding season for females.',
      },
      {
        question: 'When can I breed my crested gecko?',
        answer:
          'Males are physically capable of breeding around 9-12 months but should wait until they are 35+ grams and 12+ months old. Females should not be bred until they weigh at least 40 grams and are 18+ months old to avoid egg-binding and calcium depletion.',
      },
      {
        question: 'Do crested geckos lose weight in winter?',
        answer:
          'Some adult crested geckos experience a mild seasonal appetite decrease in winter, especially if room temperatures drop. A 1-2 gram fluctuation is normal. Significant weight loss (3+ grams) in winter should prompt a husbandry check.',
      },
    ],
    internalLinks: [
      { label: 'Weight Tracking in Geck Inspect', path: '/MyGeckos' },
      { label: 'Crested Gecko Care Guide', path: '/CareGuide' },
      { label: 'Feeding Guide in Care Guide', path: '/CareGuide#feeding' },
      { label: 'Breeding Planning Tool', path: '/Breeding' },
    ],
    externalCitations: [
      {
        label: 'The Pet Enthusiast -- Crested Gecko Growth Chart',
        url: 'https://thepetenthusiast.com/crested-gecko-growth-chart/',
      },
      {
        label: 'ReptiFiles -- Crested Gecko Health',
        url: 'https://reptifiles.com/crested-gecko-care/crested-gecko-health/',
      },
    ],
  },

  // ─── How to Identify Crested Gecko Morphs ──────────────────
  {
    slug: 'how-to-identify-crested-gecko-morphs',
    title: 'How to Identify Crested Gecko Morphs: Visual Guide',
    description:
      'Learn to identify crested gecko morphs by sight. Covers Harlequin, Dalmatian, Flame, Pinstripe, Lilly White, Cappuccino, and 25+ more with visual ID tips.',
    keyphrase: 'identify crested gecko morphs',
    category: 'identification',
    tags: ['crested gecko morph identification', 'identify crested gecko', 'morph guide', 'visual ID', 'AI morph identification'],
    datePublished: '2026-05-05',
    dateModified: '2026-05-05',
    heroEyebrow: 'Visual ID reference',
    tldr: [
      'Crested gecko morphs describe pattern, color, and structural traits. Most geckos express multiple traits at once (e.g., Harlequin Dalmatian Pinstripe).',
      'Pattern morphs (Harlequin, Flame, Tiger, Dalmatian) describe how the color is distributed across the body.',
      'Color traits (Red, Orange, Yellow, Olive, Lavender, Cream) describe the base and pattern colors.',
      'Structural/genetic traits (Lilly White, Cappuccino, Soft Scale, Axanthic) are proven heritable mutations that alter appearance at a genetic level.',
      'Geck Inspect\'s AI morph identification tool can analyze a photo and classify primary morph, secondary traits, and base color in seconds.',
    ],
    body: [
      {
        type: 'p',
        text: 'Identifying crested gecko morphs is one of the most satisfying skills in the hobby, and one of the most confusing for newcomers. Unlike leopard geckos, where morphs are typically single-gene traits with clean names, crested gecko morphs layer on top of each other. A single gecko can be a "Red Harlequin Dalmatian Pinstripe with Cream Laterals" and that is a perfectly normal description. Each word describes a different aspect of the animal\'s appearance.',
      },
      {
        type: 'p',
        text: 'This guide breaks down the morph identification system into three categories: pattern morphs (how color is arranged), color traits (what colors are present), and structural/genetic mutations (proven heritable traits that modify appearance). Understanding these three layers is the key to accurately identifying any crested gecko.',
      },
      {
        type: 'p',
        text: 'Pattern morphs describe the distribution of color on the gecko\'s body. These are the most visually obvious traits and the starting point for identification.',
      },
      {
        type: 'dl',
        items: [
          {
            term: 'Flame',
            def: 'A cream or light-colored dorsal stripe (down the back) with minimal pattern on the sides (laterals). The dorsal pattern "flames" upward from the spine. Flames have clean, relatively pattern-free sides.',
          },
          {
            term: 'Harlequin',
            def: 'Like a Flame, but with significant cream or light pattern extending down the sides (laterals) and onto the limbs. The more lateral coverage, the higher quality the Harlequin. When lateral coverage reaches approximately 80%+, it becomes an Extreme Harlequin.',
          },
          {
            term: 'Extreme Harlequin',
            def: 'A Harlequin with 80%+ lateral pattern coverage. The cream or contrasting color covers most of the sides, often connecting the dorsal pattern to the belly. Extreme Harlequins are among the most valued pattern morphs.',
          },
          {
            term: 'Tiger',
            def: 'Dark banding or striping that wraps horizontally around the body, crossing the dorsal. Named for the visual similarity to tiger stripes. Can combine with other patterns.',
          },
          {
            term: 'Brindle',
            def: 'A busy, chaotic pattern with irregular dark and light markings that do not follow the clean lines of Tiger or Harlequin. Think of it as a "messy" pattern variant.',
          },
          {
            term: 'Dalmatian',
            def: 'Scattered spots on the body, similar to a Dalmatian dog. Spots can be black, red, green, or lavender. A Super Dalmatian has 100+ spots covering much of the body.',
          },
          {
            term: 'Pinstripe',
            def: 'Raised, cream-colored scales running along the outer edges of the dorsal crest, creating two distinct "pinstripes" down the back. This is both a visual and a tactile trait.',
          },
        ],
      },
      {
        type: 'p',
        text: 'Color traits describe the actual colors present on the gecko. A gecko\'s base color is the primary color of its body, and its pattern color is the cream, white, or contrasting color in the dorsal and lateral markings.',
      },
      {
        type: 'dl',
        items: [
          {
            term: 'Red Base',
            def: 'A deep, saturated red body color most visible when the gecko is fired up. Red base is one of the most sought-after color traits.',
          },
          {
            term: 'Orange Base',
            def: 'A warm orange body color ranging from pale tangerine to deep burnt orange. Very common and widely available.',
          },
          {
            term: 'Yellow Base',
            def: 'A bright yellow body color, sometimes called "blonde." Less common than orange and more valued in breeding projects.',
          },
          {
            term: 'Olive',
            def: 'A green-tinted body color, ranging from subtle olive to distinctly green. Popular for natural-looking display enclosures.',
          },
          {
            term: 'Lavender',
            def: 'A cool purple-grey body color visible in both fired and unfired states. Uncommon and highly valued.',
          },
          {
            term: 'Cream',
            def: 'A pale, warm white used to describe both base color and pattern color. The most common pattern color in Harlequins and Flames.',
          },
        ],
      },
      {
        type: 'p',
        text: 'Structural and genetic traits are proven heritable mutations that have been test-bred and documented. These traits are the most exciting developments in the hobby because they follow predictable inheritance patterns.',
      },
      {
        type: 'dl',
        items: [
          {
            term: 'Lilly White',
            def: 'An incomplete dominant mutation producing dramatic white patterning. Heterozygous Lilly Whites are visual. Homozygous (Super Lilly White) is embryonic-lethal. Never breed Lilly White to Lilly White.',
          },
          {
            term: 'Cappuccino',
            def: 'An incomplete dominant mutation producing warm brown coloring with a connected dorsal and distinctive Y-shape at the tail base. Super Cappuccino (Melanistic) has documented health concerns.',
          },
          {
            term: 'Soft Scale',
            def: 'An incomplete dominant mutation that reduces scale texture, giving a smoother, almost velvety appearance. Super Soft Scale intensifies this effect.',
          },
          {
            term: 'Axanthic',
            def: 'A mutation that reduces or eliminates yellow and red pigments, producing a gecko that appears grey, black, and white. Multiple axanthic lines exist.',
          },
        ],
      },
      {
        type: 'callout',
        tone: 'success',
        title: 'Use AI to identify your gecko\'s morph',
        items: [
          'Geck Inspect\'s AI morph identification tool analyzes a photo and classifies primary morph, secondary traits, and base color.',
          'Upload a clear, well-lit photo showing the gecko from above (dorsal view) for the best results.',
          'The AI cross-references against the full morph database for a detailed breakdown.',
          'Try it now at geckinspect.com/Recognition.',
        ],
      },
      {
        type: 'p',
        text: 'Remember that most crested geckos express multiple traits simultaneously. When you identify a gecko, start with the pattern (Flame, Harlequin, Tiger, etc.), then add the color (Red, Orange, Cream, etc.), then note any structural/genetic traits (Pinstripe, Dalmatian, Lilly White, Cappuccino, etc.). A full identification might read: "Red Extreme Harlequin Dalmatian Pinstripe."',
      },
      {
        type: 'p',
        text: 'Also note that crested geckos "fire up" and "fire down," meaning they change color throughout the day. A fired-up gecko (typically at night) shows its darkest, most saturated colors. A fired-down gecko (daytime) appears much lighter and more washed out. Always evaluate morph traits when the gecko is fired up for the most accurate identification.',
      },
    ],
    faq: [
      {
        question: 'How do I identify my crested gecko\'s morph?',
        answer:
          'Start with the pattern (Flame, Harlequin, Tiger, Dalmatian, Pinstripe), then identify the colors (Red, Orange, Yellow, Cream, Lavender), then check for genetic traits (Lilly White, Cappuccino, Soft Scale, Axanthic). Most geckos express multiple traits. You can also use Geck Inspect\'s AI morph identification tool at geckinspect.com/Recognition.',
      },
      {
        question: 'What is the difference between Harlequin and Extreme Harlequin?',
        answer:
          'Harlequin crested geckos have cream or light pattern on the sides and limbs. When lateral pattern coverage reaches approximately 80%+ of the body, the gecko is classified as Extreme Harlequin. It is a matter of degree, not a separate genetic trait.',
      },
      {
        question: 'What is a fired-up crested gecko?',
        answer:
          'Firing up is when a crested gecko displays its darkest, most saturated colors, typically at night or when active. Firing down is the lighter state during the day. Always evaluate morph traits when the gecko is fired up for accurate identification.',
      },
      {
        question: 'Can AI identify crested gecko morphs?',
        answer:
          'Yes. Geck Inspect offers a free AI morph identification tool that analyzes a photo and classifies primary morph, secondary traits, and base color. Upload a clear dorsal view photo for the best results at geckinspect.com/Recognition.',
      },
      {
        question: 'What is the most expensive crested gecko morph?',
        answer:
          'Lilly White and Cappuccino-based morphs (especially Frappuccino) command the highest prices at $500-$3,000+. Extreme Harlequins with rare color combinations (Lavender, true Red) are also premium.',
      },
      {
        question: 'Are crested gecko morphs genetic?',
        answer:
          'Some traits are proven genetic mutations with documented inheritance (Lilly White, Cappuccino, Soft Scale, Axanthic). Others like Harlequin, Flame, and color traits are polygenic (multiple genes) and less predictable in breeding. The Morph Guide on Geck Inspect documents which traits have proven genetics.',
      },
    ],
    internalLinks: [
      { label: 'Full Crested Gecko Morph Guide (30+ morphs)', path: '/MorphGuide' },
      { label: 'AI Morph Identification Tool', path: '/Recognition' },
      { label: 'Crested Gecko Genetics Guide', path: '/GeneticsGuide' },
      { label: 'Genetic Calculator Tool', path: '/calculator' },
      { label: 'Cappuccino morph deep-dive', path: '/blog/cappuccino-crested-gecko-genetics' },
      { label: 'Harlequin morph reference', path: '/MorphGuide/harlequin' },
    ],
    externalCitations: [
      {
        label: 'MorphMarket Community -- Crested Gecko Morph/Trait Guide',
        url: 'https://community.morphmarket.com/t/crested-gecko-morph-trait-guide/19766',
      },
      {
        label: 'Lil Monsters Reptiles -- Foundation Genetics Project',
        url: 'https://lmreptiles.com/fg-overview/',
      },
    ],
  },
  {
    slug: "super-cappuccino-breeding-risks",
    title: "Why Super Cappuccino Breeding Is Riskier Than You Think",
    description: "Pairing two Cappuccinos to produce Frappuccinos sounds like good math. Here's why experienced breeders are cautious—and what the incomplete-dominant inheritance actually tells you.",
    keyphrase: "super cappuccino breeding risks",
    category: "breeding",
    tags: [
      "breeding",
      "cappuccino",
      "lilly-white",
      "soft-scale",
      "frappuccino",
      "super-cappuccino",
      "super-lilly-white",
    ],
    datePublished: "2026-05-10",
    dateModified: "2026-05-10",
    heroEyebrow: "Genetics × Breeding Ethics",
    tldr: [
      "Cappuccino is incomplete-dominant — two copies produce the super form (Frappuccino), not a lethal outcome, but viability concerns exist.",
      "Cap × Cap pairings produce 25% Frappuccino, 50% visual Cappuccino, 25% normal — the math is sound but the biology may not be.",
      "Some breeders report reduced clutch sizes and developmental issues from Cap × Cap pairings; the community data is incomplete.",
      "The safest strategy is Cappuccino × normal: 50% visual Cappuccino offspring with zero super-form risk.",
      "Buy Frappuccinos only from breeders who document clutch outcomes — lineage transparency is the only quality signal that matters here.",
    ],
    body: [
      {
        type: "p",
        text: "A Frappuccino crested gecko listed at a 2024 expo had a sign beside it: *\"Super Cappuccino — rarest morph at the show, $2,200.\"* Two tables over, a breeder was quietly telling anyone who'd listen that she'd lost three clutches trying to produce one. The math on Cap × Cap looks straightforward. The biology, apparently, is less cooperative.",
      },
      {
        type: "p",
        text: "So why does almost every guide skip past that part and go straight to the Punnett square?",
      },
      {
        type: "p",
        text: "This post is for breeders who are either sitting on a pair of visual Cappuccinos or thinking about buying into the morph specifically to produce Frappuccinos. Understanding the difference between what the genetics *predict* and what breeders actually *report* is the difference between a productive project and a frustrating, expensive one.",
      },
      {
        type: "callout",
        tone: "info",
        title: "What Cappuccino inheritance actually says",
      },
      {
        type: "p",
        text: "Cappuccino is a proven incomplete-dominant morph. That's not a community guess — it's been demonstrated through controlled breeding, and the morph-guide.js canonical data lists it explicitly as `incomplete-dominant`.",
      },
      {
        type: "p",
        text: "Here's what that means in practice:",
      },
      {
        type: "ul",
        items: [
          "**0 copies:** normal-looking gecko, no carrier status visible",
          "**1 copy:** visual Cappuccino — the classic coffee-brown saddle pattern with warm body tones",
          "**2 copies:** Frappuccino (Super Cappuccino) — amplified saddle, paler and more neutral body color, cleaner pattern boundaries",
        ],
      },
      {
        type: "p",
        text: "Pair two visual Cappuccinos and the Punnett square gives you 25% Frappuccino, 50% visual Cappuccino, 25% normal. On paper, that's a productive pairing — one in four animals hits the high-value outcome.",
      },
      {
        type: "p",
        text: "The problem isn't the math. The problem is that the genetics tell you about genotype ratios. They say nothing about whether those embryos develop, whether the eggs hatch, or whether the animals that do hatch are healthy enough to go into a breeding program.",
      },
      {
        type: "callout",
        tone: "info",
        title: "The incomplete-dominant super-form pattern — and why Frappuccino is different from Lilly White",
      },
      {
        type: "p",
        text: "It helps to understand how Frappuccino sits relative to the other super forms in the hobby.",
      },
      {
        type: "p",
        text: "Lilly White is the textbook comparison. Single copy: striking white markings, totally viable animal. Two copies: Super Lilly White, confirmed embryonic-lethal. Eggs develop partially and stall. The genetics-sections data is clear: \"fertilized eggs develop partially then fail to hatch.\" Breeders avoid LW × LW for that reason, full stop.",
      },
      {
        type: "p",
        text: "Frappuccino is not that clean. The super form *does* hatch. It *does* exist. Breeders produce them. That's enough to separate it from Super Lilly White categorically — there's no confirmed embryonic lethality.",
      },
      {
        type: "p",
        text: "But the genetics-sections data includes a specific caveat that many guides omit: *\"there is ongoing debate about sublethal effects — some breeders report reduced clutch sizes or health issues from Cappuccino × Cappuccino pairings.\"* That word, sublethal, is doing a lot of work. It means the animals survive, but perhaps not robustly. It means clutch outcomes may be worse than the 75% hatch rate a clean incomplete-dominant pairing should theoretically produce.",
      },
      {
        type: "p",
        text: "Soft Scale has a similar profile. The genetics-sections data notes that *\"several breeders report reduced fertility when producing [Super Soft Scales]\"* from Soft Scale × Soft Scale pairings. The pattern is worth noticing: in both Cappuccino and Soft Scale, the incomplete-dominant super form has a cloud of reported — but not systematically documented — health and fertility concerns hovering over it.",
      },
      {
        type: "p",
        text: "The community is still collecting data. That uncertainty is the actual risk.",
      },
      {
        type: "callout",
        tone: "info",
        title: "What breeders have reported — and why it matters",
      },
      {
        type: "p",
        text: "The TikisGeckos YouTube video asking \"Should We Breed Super Cappuccino Crested Geckos?\" (7,653 views, three years ago) captures the moment the community was actively working through this question. The Homestead Reptiles video titled \"Don't buy super cappuccino crested gecko it's a scam and waste of money\" is blunter — and while the framing is sensational, the underlying concern is real: buyers who don't know what they're getting into may be purchasing animals with undisclosed health question marks.",
      },
      {
        type: "p",
        text: "The honest picture, assembled from breeder accounts and the Geck Inspect genetics corpus:",
      },
      {
        type: "ol",
        items: [
          "**Frappuccinos hatch.** This isn't Super LW. Animals reach adulthood.",
          "**Some Cap × Cap clutches show higher-than-expected failure rates.** Breeders have reported this, but sample sizes at any individual operation are small. Without systematic data collection across multiple breeders and seasons, it's impossible to put a reliable number on the risk.",
          "**Some Frappuccinos show subtle development differences** — scale texture, growth rate, reproductive output — that are consistent with sublethal genetic effects. Again: reported, not systematically confirmed.",
          "**The premium pricing for Frappuccinos doesn't come with a health warranty.** A $2,000+ animal that came from a Cap × Cap pairing where the breeder didn't track clutch outcomes is a financial and ethical liability.",
        ],
      },
      {
        type: "p",
        text: "The genetics-sections data puts the appropriate recommendation directly: *\"Conservative recommendation: breed Cappuccino × normal unless you're specifically investigating Frappuccino outcomes and prepared to document them.\"*",
      },
      {
        type: "p",
        text: "That's not an argument against producing Frappuccinos. It's an argument for doing it carefully and honestly.",
      },
      {
        type: "callout",
        tone: "info",
        title: "The safer pairing — and what you actually get",
      },
      {
        type: "p",
        text: "The standard approach to building a Cappuccino line is Cappuccino × normal. The outcomes:",
      },
      {
        type: "ul",
        items: [
          "**50% visual Cappuccino**",
          "**50% normal (non-carriers)**",
        ],
      },
      {
        type: "p",
        text: "No Frappuccinos. No super-form risk. You're producing half-and-half, and the Cappuccinos you hatch are clean single-copy animals you can sell or hold back confidently.",
      },
      {
        type: "p",
        text: "If you want to produce Frappuccinos specifically, you're choosing to accept the Cap × Cap profile: 25% Frappuccino, 50% visual Cap, 25% normal, plus the unquantified overhead of possible reduced hatch rates and potential developmental concerns.",
      },
      {
        type: "p",
        text: "That 25% Frappuccino rate *sounds* good until you run the math on a typical crested gecko season. A pair producing two eggs per clutch, three clutches per season, gets you six eggs. Expected Frappuccinos from six eggs at 25%: 1.5. Expected actual hatchlings: probably fewer, if the sublethal effect reports are real. You might get one Frappuccino per season if everything goes well. You might get zero.",
      },
      {
        type: "p",
        text: "The $2,200 price tag on that expo animal starts making more sense when you think about what it took to produce it.",
      },
      {
        type: "callout",
        tone: "info",
        title: "My take on the \"it's a scam\" narrative",
      },
      {
        type: "p",
        text: "Calling Super Cappuccino breeding a scam is too strong. What it actually is: a high-variance project that is frequently sold with incomplete disclosure.",
      },
      {
        type: "p",
        text: "The scam-adjacent behavior isn't in the genetics. It's in the market. Someone sells a Frappuccino at a $2,000+ premium without mentioning they lost two clutches of eggs getting there, or that their animal has shown slower-than-normal growth. Someone sells visual Cappuccinos as \"potential Frappuccino project animals\" without disclosing that Cap × Cap pairings carry a health risk question mark that makes them unsuitable for pairing without documentation.",
      },
      {
        type: "p",
        text: "I've watched this exact dynamic play out with other incomplete-dominant morphs in other species. The animal itself is real. The trait is proven. The super form exists. But the gap between \"this exists\" and \"this is straightforward to produce reliably and the offspring are fully healthy\" is where buyers get burned.",
      },
      {
        type: "p",
        text: "The honest position: Frappuccinos are legitimate, interesting animals with an unusual look that you can't get any other way. Producing them responsibly requires going in with eyes open, tracking your outcomes, and being transparent with buyers about what you know and what you don't.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Practical takeaways for Monday",
      },
      {
        type: "p",
        text: "If you're building a Cappuccino project:",
      },
      {
        type: "p",
        text: "**Use Cappuccino × normal as your default pairing.** 50% visual Cappuccino offspring, zero super-form risk, fully clean documentation. This is how you build a healthy line.",
      },
      {
        type: "p",
        text: "**Only run Cap × Cap if you're specifically targeting Frappuccino and prepared to document every outcome.** That means recording every egg laid, every egg that fails, every hatchling phenotype, and growth/health observations at 6 and 12 months. You're not just breeding — you're adding to the community's data on whether the sublethal risk is real.",
      },
      {
        type: "p",
        text: "**When buying a Frappuccino, ask for the clutch record.** How many eggs were laid in the clutch that produced this animal? How many hatched? What phenotypes? A breeder who can answer those questions confidently is a breeder worth buying from.",
      },
      {
        type: "p",
        text: "**Don't assume \"Frappuccino looks healthy at 6 months\" means \"Frappuccino has no issues.\"** Sublethal effects in incomplete-dominant supers can show up in reduced reproductive output or fertility — things you won't know until the animal is adult and breeding age.",
      },
      {
        type: "p",
        text: "**Price Frappuccinos accordingly on both ends of the transaction.** If you're selling one, be honest about what it took to produce it. If you're buying one, price in the uncertainty about long-term breeding value.",
      },
      {
        type: "p",
        text: "Back to that expo Frappuccino with the $2,200 sign: the price wasn't outrageous for a legitimately rare animal from a careful breeder. But the sign said nothing about where it came from, how many eggs preceded it, or whether the line had any health documentation. That's the gap this post is trying to close. The genetics of Cappuccino are sound. The breeding decision to produce Frappuccinos is yours to make. Just make it with the full picture in front of you — not just the Punnett square.",
      },
    ],
    faq: [
      {
        question: "Is Super Cappuccino (Frappuccino) lethal like Super Lilly White?",
        answer: "No. Frappuccino is not confirmed embryonic-lethal the way Super Lilly White is. Frappuccinos hatch and reach adulthood. However, some breeders report reduced clutch sizes and possible developmental concerns from Cappuccino × Cappuccino pairings. The distinction matters: it's not a confirmed lethal allele, but it carries documented uncertainty.",
      },
      {
        question: "What are the odds of getting a Frappuccino from a Cappuccino × Cappuccino pairing?",
        answer: "25%, according to standard incomplete-dominant inheritance. A Cap × Cap pairing produces 25% Frappuccino, 50% visual Cappuccino, and 25% normal offspring. In practice, reduced hatch rates reported by some breeders may lower the effective yield. Don't expect one Frappuccino per four eggs reliably.",
      },
      {
        question: "What is the safest way to breed Cappuccino crested geckos?",
        answer: "Cappuccino × normal is the safest pairing. It produces 50% visual Cappuccino and 50% normal offspring with no super-form risk. This is the recommended approach unless you are specifically researching Frappuccino production and prepared to document every clutch outcome.",
      },
      {
        question: "What does a Frappuccino (Super Cappuccino) look like compared to a visual Cappuccino?",
        answer: "Frappuccinos show an amplified version of the Cappuccino saddle pattern with cleaner boundaries, and typically a paler, more neutral body color than single-copy Cappuccino animals. The pattern is more pronounced and the warm coffee tones of a standard Cappuccino are often muted.",
      },
      {
        question: "How is Cappuccino inheritance different from Lilly White?",
        answer: "Both are incomplete-dominant. The key difference is the super form: Super Lilly White is confirmed embryonic-lethal — homozygous eggs don't hatch. Frappuccino (Super Cappuccino) does hatch but carries reported viability concerns. Lilly White × Lilly White pairings should always be avoided; Cap × Cap requires caution and documentation.",
      },
      {
        question: "Are Frappuccino crested geckos worth buying?",
        answer: "They can be, if the seller can provide clutch documentation. Ask how many eggs were in the clutch, how many hatched, and what health observations they have at 6+ months. A Frappuccino without that paper trail carries unknown breeding risk — which matters if you plan to use it as a project animal.",
      },
      {
        question: "Can you tell a Cappuccino het by looking at it?",
        answer: "No. Cappuccino is incomplete-dominant — the normal-looking offspring from a Cap × normal pairing are non-carriers. There are no hets to identify visually. Either an animal shows the Cappuccino phenotype (one or two copies) or it doesn't carry the gene at all.",
      },
      {
        question: "What does 'sublethal' mean in the context of Frappuccino breeding?",
        answer: "Sublethal means the animals survive but may have reduced fitness — slower growth, smaller clutches, fertility issues, or subtle developmental differences. Unlike a confirmed lethal allele where embryos die, sublethal effects only become visible over time, which is why long-term documentation from breeders matters.",
      },
    ],
    internalLinks: [
      {
        href: "/MorphGuide/cappuccino",
        label: "Cappuccino morph profile",
      },
      {
        href: "/MorphGuide/frappuccino",
        label: "Frappuccino (Super Cappuccino) morph profile",
      },
      {
        href: "/MorphGuide/lilly-white",
        label: "Lilly White — the confirmed lethal super form",
      },
      {
        href: "/GeneticsGuide",
        label: "Crested gecko genetics guide",
      },
      {
        href: "/GeneticCalculatorTool",
        label: "Punnett square calculator for Cappuccino pairings",
      },
      {
        href: "/MorphGuide/soft-scale",
        label: "Soft Scale — another incomplete-dominant with super-form concerns",
      },
    ],
    externalCitations: [
      {
        url: "https://www.youtube.com/watch?v=JLXYdEo7mhk",
        label: "TikisGeckos — Should We Breed Super Cappuccino Crested Geckos?",
      },
      {
        url: "https://www.youtube.com/watch?v=5O_obmlNu9I",
        label: "Homestead Reptiles — Don't Buy Super Cappuccino Crested Gecko",
      },
    ],
  },
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
