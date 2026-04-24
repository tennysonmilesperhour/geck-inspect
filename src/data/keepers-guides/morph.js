/**
 * Guide 04 — Morph & Genetics Guide
 *
 * Understanding crested gecko morphs, vocabulary, major lines, and the
 * genetics behind them.
 *
 * Keep this file dependency-free (no JSX, no imports).
 */

export const MORPH_GUIDE = {
  id: 'morph',
  number: '04',
  title: 'Morph & Genetics Guide',
  shortTitle: 'Morph & Genetics',
  description:
    'Understanding crested gecko morphs, vocabulary, major lines, and the genetics behind them. Punnett square math, lethal combinations to avoid, pairing for outcomes, and the market angle.',
  slides: [
    // 1 - Hero
    {
      layout: 'hero',
      kicker: "The Keeper's Guide Series",
      title: 'Morphs, genetics, and what it all means.',
      lead:
        'Understand what you have, read a listing like a breeder, and predict outcomes from any pairing. The vocabulary, the rules, and the genuine unknowns of crestie genetics.',
      tags: ['Vocab', 'Morphs', 'Genetics', 'Pairing', 'Lethal', 'Market'],
    },

    // 2 - Why this matters
    {
      kicker: 'Why This Matters',
      title: "Morphs aren't decoration - they're shorthand.",
      lead:
        'Every crestie listing uses morph terminology. If you don\'t know what "66% het axanthic cappuccino pinstripe" means, you\'re buying blind. This guide fixes that.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: 'TO IDENTIFY',
              text:
                'What you already have. Most pet-store geckos are sold with zero morph info. You can often identify traits yourself with the vocabulary.',
            },
            {
              title: 'TO BUY WELL',
              text:
                'Morph claims affect price 10x or more. Knowing what\'s legitimate vs. optimistic marketing saves real money.',
            },
            {
              title: 'TO PAIR',
              text:
                "If you'll ever breed - even accidentally - understanding inheritance prevents disaster pairings (lethal combos) and sets realistic expectations.",
            },
            {
              title: 'TO INVEST',
              text:
                "Some morphs appreciate. Most don't. Knowing the difference matters if you're buying with resale in mind.",
            },
          ],
        },
      ],
    },

    // 3 - The basics / vocabulary
    {
      kicker: 'The Basics',
      title: 'Vocabulary every keeper should know.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              title: 'Morph',
              text:
                'A visually distinct type. A combination of traits that passes to offspring. Not just color - includes pattern and structure.',
            },
            {
              title: 'Trait',
              text: 'A single visual feature. Pinstripe, harlequin, red. Morphs are stacks of traits.',
            },
            {
              title: 'Base color',
              text:
                'The dominant ground color. Usually gray, brown, cream, orange, red, or olive. First thing to identify.',
            },
            {
              title: 'Pattern',
              text: 'The markings over the base. Pinstripe, flame, brindle, dalmatian spots.',
            },
            {
              title: 'Structure',
              text: 'Physical features. Crest size (crown), lateral scales, pinning, crown shape.',
            },
            {
              title: 'Fire-up / fire-down',
              text:
                'Cresties shift colors by mood and temperature. Always evaluate morphs when fired up.',
            },
          ],
        },
      ],
    },

    // 4 - Pattern morphs
    {
      kicker: 'Pattern Morphs',
      title: 'What those listing words actually describe.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'Polygenic',
              title: 'Harlequin',
              text:
                'Strong contrasting pattern running up legs and sides. More pattern = more valued. The workhorse pattern morph.',
            },
            {
              meta: 'Polygenic',
              title: 'Pinstripe',
              text:
                'Cream/white dots along the dorsal ridge (top of spine). "Full pin" = complete line from head to tail base. Highly stackable.',
            },
            {
              meta: 'Polygenic',
              title: 'Flame',
              text:
                'Dorsal stripe plus basic side markings. More subtle than harlequin. Entry-level pattern.',
            },
            {
              meta: 'Polygenic',
              title: 'Dalmatian',
              text:
                'Black spots over the body. "Super dalmatian" = heavy spotting. Can combine with any base color.',
            },
            {
              meta: 'Polygenic',
              title: 'Brindle',
              text: 'Fine streaking or marbling. Usually combined with other patterns. Adds visual complexity.',
            },
            {
              meta: 'Polygenic',
              title: 'Tiger',
              text: 'Strong horizontal banding. Rarely pure - usually combined with harlequin/flame.',
            },
            {
              meta: 'Polygenic',
              title: 'Phantom',
              text: 'Reduced or absent pattern, muted colors. Can be striking in combination with structural traits.',
            },
            {
              meta: 'Polygenic',
              title: 'Extreme Harlequin',
              text:
                'Harlequin with pattern extending over the dorsal surface. One of the most valued pattern expressions.',
            },
          ],
        },
      ],
    },

    // 5 - Genetic morphs
    {
      kicker: 'Genetic Morphs',
      title: 'The four confirmed genetic traits.',
      lead:
        'Unlike patterns, these behave predictably in breeding because we know the inheritance mode. These are the foundation of any serious breeding program.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'INCOMPLETE DOMINANT',
              tone: 'fern',
              title: 'Lilly White',
              text:
                'White pigment expression on dorsal and sides. Discovered 2010 by Lilly Exotics. ⚠ Breeding two visual Lilly Whites = 25% lethal "super" offspring.',
            },
            {
              meta: 'RECESSIVE',
              tone: 'moss',
              title: 'Axanthic',
              text:
                'Removes yellow pigment. Black/white/gray base. Visual animal needs TWO copies; 50% offspring from het × het are visual. Still rare in the hobby.',
            },
            {
              meta: 'INCOMPLETE DOMINANT',
              tone: 'fern',
              title: 'Cappuccino',
              text:
                'Brown/tan base with reduction of orange/yellow. Discovered by Reptile City Korea. Super cappuccino exists and is viable (unlike super Lilly White).',
            },
            {
              meta: 'RECESSIVE',
              tone: 'moss',
              title: 'Sable',
              text:
                'Dark, muted expression with reduced red/orange pigmentation. Newer trait, still being proven out. Pairs beautifully with Cappuccino and Lilly White lines.',
            },
          ],
        },
      ],
    },

    // 6 - Inheritance modes
    {
      kicker: 'Genetics 101',
      title: 'The four inheritance modes, plain English.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: 'DOMINANT',
              text:
                'One copy = visible. Two copies = same look. One parent can pass the trait to 50% of offspring. Not the primary mode for crestie traits.',
            },
            {
              title: 'RECESSIVE',
              text:
                'Needs TWO copies to show. Hidden carriers ("hets") look normal. Axanthic and Sable work this way. A het × het pairing = 25% visual, 50% het, 25% normal.',
            },
            {
              title: 'INCOMPLETE DOMINANT',
              text:
                'One copy shows a visible partial expression. Two copies = "super" form, sometimes lethal. Lilly White and Cappuccino work this way.',
            },
            {
              title: 'POLYGENIC',
              text:
                'Multiple genes contribute. No simple inheritance math. Most patterns (harlequin, pinstripe, flame) - good parents produce better-than-average offspring but nothing is guaranteed.',
            },
          ],
        },
      ],
    },

    // 7 - Het math
    {
      kicker: 'Het Math',
      title: 'Decoding "66% het axanthic" and similar claims.',
      lead:
        "A \"het\" gecko carries one copy of a recessive gene but doesn't show it. Percentages reflect the probability that this particular animal inherited it from its parents.",
      blocks: [
        {
          type: 'ladder',
          items: [
            {
              badge: '100% het',
              tone: 'fern',
              title: 'Confirmed carrier',
              text:
                'Produced from a visual × normal pairing. Mathematically guaranteed to carry one copy. Trustworthy.',
            },
            {
              badge: '66% het',
              tone: 'moss',
              title: 'Probable carrier (from het × het)',
              text:
                'From two hets, normal-looking offspring have 2/3 chance of being het (the remaining 1/3 are pure normals).',
            },
            {
              badge: '50% het',
              tone: 'amber',
              title: 'Coin flip (visual × het)',
              text:
                "Some of the offspring got the recessive, some didn't. Can't tell without test breeding.",
            },
            {
              badge: 'Pos het',
              tone: 'coral',
              title: 'Educated guess',
              text:
                '"Possible het" - usually unproven. Priced lower. Often a marketing stretch. Treat with skepticism.',
            },
            {
              badge: 'Proven',
              tone: 'fern',
              title: '100% het by test breeding',
              text:
                'Breeder has paired this animal and gotten visual offspring. The strongest claim possible short of visual.',
            },
          ],
        },
      ],
    },

    // 8 - Punnett squares
    {
      kicker: 'The Punnett Square',
      title: 'The only genetics math you need.',
      lead:
        'Example: Axanthic × Axanthic (both visual). Each parent has two copies of the gene (AA). All offspring inherit one copy from each parent.',
      blocks: [
        {
          type: 'punnett',
          title: 'HET AXANTHIC × HET AXANTHIC',
          parents: [
            ['A', 'a'],
            ['A', 'a'],
          ],
          cells: [
            [
              { text: 'AA', kind: 'normal' },
              { text: 'Aa', kind: 'het' },
            ],
            [
              { text: 'Aa', kind: 'het' },
              { text: 'aa', kind: 'visual' },
            ],
          ],
          outcome:
            '25% normal (AA) · 50% het (Aa) · 25% visual axanthic (aa). Of the visible normals, 2 out of 3 will be hets.',
        },
        {
          type: 'punnett',
          title: 'LILLY WHITE × NORMAL',
          parents: [
            ['L', 'l'],
            ['l', 'l'],
          ],
          cells: [
            [
              { text: 'Ll', kind: 'lw', sub: 'LW' },
              { text: 'Ll', kind: 'lw', sub: 'LW' },
            ],
            [
              { text: 'll', kind: 'normal' },
              { text: 'll', kind: 'normal' },
            ],
          ],
          outcome: '50% visual Lilly White (Ll) · 50% normal (ll). Incomplete dominant - one copy shows.',
        },
      ],
    },

    // 9 - The Lilly White rule
    {
      kicker: '⚠  The Rule Every Breeder Knows',
      title: 'Never pair two Lilly Whites.',
      lead:
        'Lilly White is an incomplete dominant gene with a lethal super form. Two visual Lilly Whites bred together produce 25% offspring that carry two copies - and none survive.',
      blocks: [
        {
          type: 'punnett',
          title: 'LILLY WHITE × LILLY WHITE',
          parents: [
            ['L', 'l'],
            ['L', 'l'],
          ],
          cells: [
            [
              { text: 'LL', kind: 'super', sub: 'Super' },
              { text: 'Ll', kind: 'lw', sub: 'LW' },
            ],
            [
              { text: 'Ll', kind: 'lw', sub: 'LW' },
              { text: 'll', kind: 'normal' },
            ],
          ],
          outcome: '25% super (LL - lethal) · 50% LW · 25% normal',
        },
        {
          type: 'callout',
          tone: 'danger',
          title: 'What happens',
          text:
            '25% of eggs from this pairing hatch as "super Lilly Whites." Most die in the egg. Some hatch, take a few breaths, then die. None survive past hatching. Decades of attempts - zero viable supers.',
        },
        {
          type: 'callout',
          tone: 'warn',
          text:
            'The rule: one Lilly White per pairing, always. Lilly × non-Lilly = 50% visual LW, zero lethals.',
        },
      ],
    },

    // 10 - Stacking
    {
      kicker: 'Stacking',
      title: 'How morphs combine into the geckos you see for sale.',
      lead:
        'A single gecko usually carries 3-5 traits simultaneously. A listing like "Lilly White Axanthic Harlequin Pinstripe" means four traits stacked on one animal.',
      blocks: [
        { type: 'heading', text: 'Example listing' },
        {
          type: 'callout',
          tone: 'info',
          text: '"Red Lilly White Extreme Harlequin Pinstripe, 66% het Axanthic"',
        },
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'Base color',
              title: 'Red',
              text: 'The ground color. Polygenic, not guaranteed to pass.',
            },
            {
              meta: 'Genetic trait (inc. dom.)',
              title: 'Lilly White',
              text: '50% chance of passing to offspring with one LW parent.',
            },
            {
              meta: 'Pattern (polygenic)',
              title: 'Extreme Harlequin',
              text: 'Strong pattern extending onto the dorsal. Likely to pass partially.',
            },
            {
              meta: 'Pattern (polygenic)',
              title: 'Pinstripe',
              text: 'Dotted dorsal line. Also polygenic.',
            },
            {
              meta: 'Recessive carrier',
              title: '66% het Axanthic',
              text:
                'Probable carrier. Pair with another het or visual to potentially produce visual axanthics.',
            },
          ],
        },
      ],
    },

    // 11 - Pairing strategy
    {
      kicker: 'Pairing Strategy',
      title: 'If you have X and want Y: a pairing cheat sheet.',
      blocks: [
        {
          type: 'ladder',
          items: [
            {
              badge: 'Random',
              tone: 'neutral',
              title: 'Normal × Normal',
              text: 'Unpredictable. Fine for pet offspring; not for morph projects.',
            },
            {
              badge: '50% visual',
              tone: 'moss',
              title: 'Visual × Normal (incomp. dom.)',
              text: 'Standard Lilly White or Cappuccino pairing. Half the clutch visual.',
            },
            {
              badge: '25% visual',
              tone: 'moss',
              title: 'Het × Het (recessive)',
              text: 'Axanthic or Sable. Lots of siblings to sort through.',
            },
            {
              badge: '50/50',
              tone: 'fern',
              title: 'Visual × Het (recessive)',
              text: 'The fastest route to more visual axanthics once you have a proven pair.',
            },
            {
              badge: '100% visual',
              tone: 'fern',
              title: 'Visual × Visual (recessive)',
              text: 'All offspring visual. The holy grail pairing for established recessive projects.',
            },
            {
              badge: '25% LETHAL',
              tone: 'ruby',
              title: 'Lilly White × Lilly White',
              text: "⚠ NEVER. The super form doesn't survive. Always pair LW with non-LW.",
            },
          ],
        },
      ],
    },

    // 12 - Color development
    {
      kicker: 'Color Development',
      title: 'Why hatchlings look different from their parents.',
      lead:
        "Hatchlings don't show their final morph. Many traits take up to 8 months to fully express. Trust the parents, not the first photo.",
      blocks: [
        {
          type: 'timeline',
          items: [
            {
              when: 'Day 0',
              label: 'Uncertain',
              text:
                'Base patterning visible; colors muted. Cappuccino and Lilly White are usually identifiable. Red, orange, and yellow saturation not yet developed.',
            },
            {
              when: '1-3 months',
              label: 'Emerging',
              text:
                'Colors start deepening. Pattern contrast increases. Dalmatian spots may not appear yet. Structural traits visible.',
            },
            {
              when: '3-6 months',
              label: 'Coloring up',
              text:
                'Most color development happens here. Reds and oranges saturate. Pattern stabilizes. Can start to predict adult appearance.',
            },
            {
              when: '6-12 months',
              label: 'Near-final',
              text: "What you see is close to what you'll get. Last adjustments to contrast and saturation.",
            },
            {
              when: '12+ months',
              label: 'Adult',
              text:
                'Fully colored-up. What\'s there is there. Future changes are only due to season and fire-up state.',
            },
          ],
        },
      ],
    },

    // 13 - Records
    {
      kicker: 'Records',
      title: 'If you have more than one gecko, record-keeping is not optional.',
      lead:
        'Without records, every new gecko becomes a mystery by year two. What to track, and why each field matters.',
      blocks: [
        {
          type: 'steps',
          items: [
            { title: 'ID / name', text: 'Unique identifier. Critical when you have 5+ geckos.' },
            { title: 'Hatch date', text: 'Determines breeding age eligibility and senior status.' },
            { title: 'Parents (dam & sire)', text: 'Prevents accidental inbreeding across generations.' },
            { title: 'Morph description', text: 'Best guess in plain language; update as they color up.' },
            {
              title: 'Genetic carriers (hets)',
              text: "You won't remember which animals carry which recessives in 3 years.",
            },
            {
              title: 'Weight history',
              text: 'Early indicator of health issues AND breeding readiness.',
            },
            { title: 'Shed / feeding log', text: "Baseline for what's normal - spot abnormalities fast." },
            { title: 'Breeder / source', text: 'Where to route follow-up questions, original pedigree info.' },
          ],
        },
        {
          type: 'callout',
          tone: 'success',
          text:
            "We built Geck Inspect for exactly this - purpose-built record-keeping for breeders. Spreadsheets work too, until they don't.",
        },
      ],
    },

    // 14 - Listing fluency
    {
      kicker: 'Listing Fluency',
      title: 'What to look for when shopping.',
      lead:
        "Beyond the morph description, serious buyers check these specifics. Anyone who can't answer them isn't a serious seller.",
      blocks: [
        {
          type: 'table',
          headers: ['What to ask', 'Green flag', 'Red flag'],
          rows: [
            ['Hatch date', 'Specific date given', 'Vague or refused'],
            ['Current weight in grams', 'Regularly tracked', '"I don\'t know" - skip'],
            [
              'Photo of both parents',
              'Provided freely',
              '"Parents sold" - okay; "Trade secret" - not okay',
            ],
            [
              'Multiple recent photos (fired up AND down)',
              'Gladly',
              'One photo only = hiding something',
            ],
            ['Current enclosure and feeding schedule', 'Details given', 'Vague or dismissive'],
            [
              'Whether any siblings hatched with issues',
              'Honest disclosure',
              '"Never happens" is a lie',
            ],
          ],
        },
      ],
    },

    // 15 - Pitfalls
    {
      kicker: 'Pitfalls',
      title: 'Morph claims that deserve skepticism.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              tone: 'amber',
              title: '"Pos het [anything rare]"',
              text:
                'Unproven heterozygous status. Often an educated guess. Worth less than a regular normal unless priced accordingly.',
            },
            {
              tone: 'ruby',
              title: '"Blue crested gecko"',
              text:
                'No such thing. Cresties cannot be blue genetically. Usually just lighting or an axanthic photographed under cool light.',
            },
            {
              tone: 'ruby',
              title: '"Albino crested gecko"',
              text:
                'No confirmed albino morph exists in crested geckos as of now. Any seller claiming this is mistaken or dishonest.',
            },
            {
              tone: 'amber',
              title: '"Super [rare morph] available"',
              text:
                "Only some morphs have viable supers (Cappuccino, Dalmatian). Super Lilly White doesn't exist viably. Research before buying.",
            },
            {
              tone: 'amber',
              title: 'Hatch photos only',
              text:
                'Hatchlings often look VERY different from adults. Demand adult parent photos and updated hatchling photos monthly until sale.',
            },
          ],
        },
      ],
    },

    // 16 - The market angle
    {
      kicker: 'The Market Angle',
      title: 'For those with an interest in value.',
      lead:
        'A section for readers who want to understand pricing dynamics. This is secondary to keeping well - but if you\'re spending real money, understanding the market prevents bad decisions.',
      blocks: [
        {
          type: 'ladder',
          items: [
            {
              badge: '$50-250',
              tone: 'neutral',
              title: 'ENTRY TIER',
              text:
                'Normal morphs, flames, basic harlequins, pet-store animals. The vast majority of cresties. Will not appreciate.',
            },
            {
              badge: '$120-450',
              tone: 'moss',
              title: 'MID TIER',
              text:
                'Strong pattern harlequins, pinstripes, 66% hets of rare recessives, entry-level Cappuccino. Stable pricing.',
            },
            {
              badge: '$400-800',
              tone: 'fern',
              title: 'HIGH TIER',
              text:
                'Visual recessives (axanthic), clean Lilly Whites, cappuccino expressions, proven adult breeders.',
            },
            {
              badge: '$800-2500+',
              tone: 'amber',
              title: 'PREMIUM TIER',
              text:
                'Axanthic Lilly White combos, exceptional expressions, proven producers of high-value offspring. Niche market.',
            },
          ],
        },
      ],
    },

    // 17 - Appreciation
    {
      kicker: 'Appreciation',
      title: "What holds or gains value - and what doesn't.",
      lead:
        "Most crested geckos are not investments. They're pets. But if you're buying with resale in mind, here's the honest picture.",
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'GENERALLY HOLDS / APPRECIATES',
              tone: 'fern',
              items: [
                'Proven adult breeders (40g+ females especially)',
                'Rare recessives with small gene pool',
                'New morphs during early-adopter phase',
                'Exceptional individual expressions of existing morphs',
                'Well-documented pedigree from reputable breeders',
                'Animals with multiple proven/visual genetic traits',
              ],
            },
            {
              heading: 'GENERALLY LOSES VALUE',
              tone: 'ruby',
              items: [
                'Juveniles bought at peak (color development risk)',
                'Morphs that have saturated the market',
                'Common harlequins and flames',
                'Pet-store animals (no pedigree)',
                'Older males (less breeding demand past ~7 years)',
                '"Pos het" unproven animals',
                'Any gecko with health issues or tail loss',
              ],
            },
          ],
        },
      ],
    },

    // 18 - My Contribution: Morphs vs Individuals
    {
      kicker: 'My Contribution',
      title: 'Morphs vs. individuals.',
      lead:
        "The hobby's biggest categorical mistake: treating morph names as product SKUs. The morph tells you the genetic lottery ticket. The individual tells you what actually showed up.",
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: "What you're told",
              tone: 'moss',
              title: 'THE MORPH',
              text:
                'A label - "Lilly White Extreme Harlequin Pinstripe." Useful for genetics predictions and market positioning. Not sufficient for judging the animal itself.',
            },
            {
              meta: 'What you see',
              tone: 'fern',
              title: 'THE INDIVIDUAL',
              text:
                'How those traits actually expressed on this specific gecko. How clean the pattern is, how the colors stack, how the structure turned out. Varies wildly within the same morph.',
            },
            {
              meta: 'What most people miss',
              tone: 'amber',
              title: 'THE DIFFERENCE',
              text:
                "Two geckos with identical morph descriptions can differ by 5x in price based on expression quality. Learn to judge individuals - not labels - and you'll outperform the market.",
            },
          ],
        },
      ],
    },

    // 19 - Next in series
    {
      kicker: 'Next in the Series',
      title: 'Where to go from here.',
      lead:
        "Genetics is the gateway. If you've made it this far, two other guides become relevant.",
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: "If you're ready to pair",
              title: 'The Complete Breeding Guide',
              text:
                "Taking what you learned here and turning it into eggs. Pair selection, lay box setup, incubation, hatchling care, and the parts nobody warns you about.",
            },
            {
              meta: "If you're evaluating adult welfare",
              title: "The Handbook: Everything They Don't Tell You",
              text:
                'Reading geckos, handling, cohabitation, and the decisions that matter more than morph selection.',
            },
            {
              meta: 'If something seems off',
              title: 'Feeding Troubleshooting Guide',
              text: 'The diagnostic framework when something changes. Bookmark before you need it.',
            },
          ],
        },
      ],
    },

    // 20 - Closing principle
    {
      layout: 'closing',
      kicker: 'The Principle',
      title: 'Genetics is probability, not prophecy.',
      lead:
        "Even with all the math right, hatchlings don't read the textbook. Polygenic traits roll dice. Visual expression varies. The best breeders in the world have clutches that look nothing like the pairing suggested.",
      blocks: [
        {
          type: 'callout',
          tone: 'info',
          text:
            'Learn the rules - but respect the variance. That humility is what separates keepers from collectors, and collectors from breeders.',
        },
      ],
    },
  ],
};
