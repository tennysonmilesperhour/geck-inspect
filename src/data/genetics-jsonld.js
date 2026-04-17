/**
 * Genetics Guide — structured data (JSON-LD).
 * Extracted from GeneticsGuide.jsx for maintainability.
 */

const GENETICS_GUIDE_PUBLISHED = '2025-09-15T00:00:00Z';
const GENETICS_GUIDE_MODIFIED = '2026-04-17T00:00:00Z';

// Editorial author identity. Mirrors the shape in src/lib/editorial.js —
// kept inline here because this file is consumed both by JSX (for JSON-LD
// rendering) and by build-time tooling that must not import React.
const EDITORIAL = {
  '@type': 'Organization',
  '@id': 'https://geckinspect.com/#editorial',
  name: 'Geck Inspect Editorial',
  url: 'https://geckinspect.com/About',
  parentOrganization: { '@id': 'https://geckinspect.com/#organization' },
};

const GENETICS_GUIDE_JSON_LD = [
  {
    '@type': 'Article',
    '@id': 'https://geckinspect.com/GeneticsGuide#article',
    headline: 'Crested Gecko Genetics Guide — Morphs, Inheritance, and Selective Breeding',
    description:
      'Complete educational reference for crested gecko (Correlophus ciliatus) genetics: dominant, recessive, incomplete-dominant traits; polygenic morphs; inheritance patterns with Punnett squares; selective breeding strategies; lethal alleles; and proven morphs including Lilly White, Axanthic, Cappuccino, Soft Scale, and White Wall.',
    url: 'https://geckinspect.com/GeneticsGuide',
    datePublished: GENETICS_GUIDE_PUBLISHED,
    dateModified: GENETICS_GUIDE_MODIFIED,
    author: EDITORIAL,
    reviewedBy: EDITORIAL,
    inLanguage: 'en-US',
    about: [
      {
        '@type': 'Thing',
        name: 'Crested gecko',
        sameAs: 'https://en.wikipedia.org/wiki/Crested_gecko',
      },
      { '@type': 'Thing', name: 'Genetics' },
      { '@type': 'Thing', name: 'Selective breeding' },
      { '@type': 'Thing', name: 'Mendelian inheritance' },
    ],
    keywords:
      'crested gecko genetics, Correlophus ciliatus, Lilly White, axanthic, cappuccino, frappuccino, soft scale, white wall, harlequin, pinstripe, dalmatian, polygenic traits, incomplete dominant, recessive, Punnett square, selective breeding, lethal allele, proven hets, reptile breeding',
    publisher: {
      '@type': 'Organization',
      '@id': 'https://geckinspect.com/#organization',
      name: 'Geck Inspect',
      url: 'https://geckinspect.com/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://geckinspect.com/og-default.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://geckinspect.com/GeneticsGuide',
    },
  },
  {
    '@type': 'LearningResource',
    '@id': 'https://geckinspect.com/GeneticsGuide#learning',
    name: 'Crested Gecko Genetics Guide',
    description:
      'Interactive two-level educational resource (Beginner and Advanced) covering crested gecko genetic foundations, proven Mendelian morphs, polygenic traits, lethal alleles, and selective breeding.',
    url: 'https://geckinspect.com/GeneticsGuide',
    educationalLevel: ['Beginner', 'Advanced'],
    learningResourceType: [
      'Reference',
      'Guide',
      'Glossary',
      'Diagram',
      'Interactive resource',
    ],
    teaches: [
      'DNA, genes, and alleles',
      'Dominant, recessive, and incomplete-dominant inheritance',
      'How to read and use a Punnett square',
      'Polygenic traits and selective breeding strategy',
      'Proven crested gecko morphs and their inheritance patterns',
      'Lethal alleles and ethical breeding decisions',
      'Progeny testing and proving genetic claims',
    ],
    audience: {
      '@type': 'Audience',
      audienceType: 'Crested gecko keepers, hobbyist breeders, professional breeders',
    },
    inLanguage: 'en-US',
    isAccessibleForFree: true,
  },
  {
    '@type': 'DefinedTermSet',
    '@id': 'https://geckinspect.com/GeneticsGuide#termset',
    name: 'Crested Gecko Genetics Terminology',
    description:
      '80+ genetics terms grouped into core genetics, inheritance patterns, carrier status, generations, pigment biology, morphs and traits, breeding strategy, and tools.',
    hasDefinedTerm: [
      { '@type': 'DefinedTerm', name: 'Allele', description: 'One of two or more alternative forms of a gene.' },
      { '@type': 'DefinedTerm', name: 'Homozygous', description: 'Having two identical alleles for a given gene.' },
      { '@type': 'DefinedTerm', name: 'Heterozygous', description: 'Having two different alleles for a given gene.' },
      { '@type': 'DefinedTerm', name: 'Dominant', description: 'An allele whose trait shows up even when only one copy is present.' },
      { '@type': 'DefinedTerm', name: 'Recessive', description: 'An allele whose trait only shows up when both copies are present.' },
      { '@type': 'DefinedTerm', name: 'Incomplete Dominant', description: 'An allele that produces a visible trait in heterozygous form and a distinct, stronger "super" form when homozygous. Most proven crested gecko morphs follow this pattern.' },
      { '@type': 'DefinedTerm', name: 'Polygenic', description: 'A trait controlled by multiple genes acting together rather than a single Mendelian switch. Controls most crested gecko coloration and pattern.' },
      { '@type': 'DefinedTerm', name: 'Lilly White', description: 'An incomplete-dominant crested gecko morph producing high-contrast white body markings. Single copy is visible; the double-copy Super Lilly White is embryonic-lethal.' },
      { '@type': 'DefinedTerm', name: 'Axanthic', description: 'A recessive crested gecko morph lacking yellow and red xanthophore pigments. Visual animals appear black, white, and gray with no warm tones.' },
      { '@type': 'DefinedTerm', name: 'Cappuccino', description: 'An incomplete-dominant crested gecko morph producing dark coffee coloration with a connected dorsal pattern. The double-copy Super Cappuccino (Frappuccino) has enhanced expression.' },
      { '@type': 'DefinedTerm', name: 'Soft Scale', description: 'An incomplete-dominant crested gecko morph with smaller, softer scales. Super form has more dramatic expression and fertility concerns.' },
      { '@type': 'DefinedTerm', name: 'White Wall', description: 'An incomplete-dominant crested gecko morph producing a distinct white lateral stripe along the belly wall.' },
      { '@type': 'DefinedTerm', name: 'Super form', description: 'The homozygous expression of an incomplete-dominant morph. Sometimes more extreme, sometimes lethal.' },
      { '@type': 'DefinedTerm', name: 'Lethal Allele', description: 'An allele that prevents normal development in homozygous form. Super Lilly White is the textbook crested gecko example.' },
      { '@type': 'DefinedTerm', name: 'Punnett Square', description: 'A 2x2 grid tool for predicting offspring genetic probabilities from a Mendelian pairing.' },
      { '@type': 'DefinedTerm', name: 'Epistasis', description: 'One gene masks or modifies the expression of another gene.' },
      { '@type': 'DefinedTerm', name: 'Chromatophore', description: 'A specialized skin cell containing pigment or reflective crystals. Crested geckos have three layers: xanthophores, iridophores, and melanophores.' },
      { '@type': 'DefinedTerm', name: '100% Het', description: 'Parentage guarantees the animal carries one copy of the recessive.' },
      { '@type': 'DefinedTerm', name: '66% Possible Het', description: 'A normal-looking offspring from a het x het pairing. Statistically, 2 of 3 such offspring carry the gene.' },
      { '@type': 'DefinedTerm', name: 'Progeny Testing', description: 'Pairing a suspected carrier with a known animal and examining offspring to confirm the suspected genetics.' },
    ],
  },
  {
    '@type': 'FAQPage',
    '@id': 'https://geckinspect.com/GeneticsGuide#faq',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is Lilly White recessive or dominant in crested geckos?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Lilly White is incomplete dominant — a single copy produces the visible Lilly White morph, and two copies produce Super Lilly White, which is embryonic-lethal. Breeders pair Lilly White to non-LW animals to safely produce more Lilly Whites.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is an axanthic crested gecko?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Axanthic is a recessive crested gecko morph that lacks xanthophores — the pigment cells that produce yellow and red tones. Visual axanthics appear in shades of black, white, and gray regardless of their underlying color genetics, and two copies of the gene are required for visual expression.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the difference between a morph and a trait in crested gecko breeding?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A morph has a proven, predictable single-gene inheritance pattern — Lilly White, Axanthic, Cappuccino, Soft Scale, and White Wall qualify. A trait is a phenotypic characteristic like harlequin, pinstripe, flame, or dalmatian that is usually polygenic and does not follow a simple Mendelian inheritance pattern.',
        },
      },
      {
        '@type': 'Question',
        name: 'Why can\'t I predict base color in crested geckos with a Punnett square?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Base color is polygenic — it is controlled by many genes each contributing a small additive effect. Punnett squares only work for single-gene Mendelian traits. You can influence polygenic outcomes through consistent selective breeding over many generations, but you can\'t calculate exact ratios.',
        },
      },
      {
        '@type': 'Question',
        name: 'What does "66% possible het" mean?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'When two heterozygous (het) animals are bred together, the visually normal offspring are "66% possible het" because 2 out of 3 normal-looking siblings statistically carry one copy of the recessive gene. There is no visual way to tell which ones do.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is Super Cappuccino or Frappuccino?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Frappuccino is the homozygous (super) form of the incomplete-dominant Cappuccino morph. It has more extreme dark coloration and dorsal pattern, though some breeders report viability concerns when pairing two Cappuccinos together.',
        },
      },
    ],
  },
  {
    '@type': 'BreadcrumbList',
    '@id': 'https://geckinspect.com/GeneticsGuide#breadcrumbs',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Geck Inspect',
        item: 'https://geckinspect.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Genetics Guide',
        item: 'https://geckinspect.com/GeneticsGuide',
      },
    ],
  },
];

export { GENETICS_GUIDE_JSON_LD, GENETICS_GUIDE_PUBLISHED, GENETICS_GUIDE_MODIFIED };
