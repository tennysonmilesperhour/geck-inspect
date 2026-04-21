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
