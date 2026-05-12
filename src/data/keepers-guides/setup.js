/**
 * Guide 02 ,  Setup & First 30 Days
 *
 * The complete playbook for bringing home a new crested gecko. From
 * pre-arrival setup through the 30-day checkpoint.
 *
 * Keep this file dependency-free (no JSX, no imports).
 */

export const SETUP_GUIDE = {
  id: 'setup',
  number: '02',
  title: 'Setup & First 30 Days',
  shortTitle: 'Setup & First 30 Days',
  description:
    "The complete playbook for bringing home a new crested gecko. Covers pre-arrival setup, where to buy, the first 24 hours, week-by-week rhythms, the first weigh-in, handling introduction, and the 30-day checkpoint.",
  slides: [
    // 1 - Hero
    {
      layout: 'hero',
      kicker: "The Keeper's Guide Series",
      title: 'You just got a crested gecko.',
      lead:
        'The first 30 days determine the next 15 years. A complete playbook for setup, acclimation, and the decisions you will face before you know you are facing them.',
      tags: ['Prep', 'Day one', 'Week one', 'Month one', 'Panic', 'Long game'],
    },

    // 2 - Pre-arrival setup
    {
      kicker: 'Step Zero',
      title: 'Set up the enclosure a week before the gecko arrives.',
      lead:
        "The single most-skipped step. A dialed-in habitat takes 5-7 days to stabilize temp and humidity. If you're adjusting both AND adapting a new animal, you'll fail at both.",
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              title: 'Build it',
              items: [
                'Enclosure assembled & in final location',
                'Substrate laid, plants in (if bioactive)',
                'All branches and hides positioned',
                'Food and water dishes placed',
              ],
            },
            {
              title: 'Dial it in',
              items: [
                'Digital thermometer + hygrometer installed',
                'Monitor temp & humidity for 5+ days',
                'Verify gradient (warm side / cool side)',
                'Test misting routine - AM & PM cycle',
              ],
            },
            {
              title: 'Stock it',
              items: [
                'CGD (Pangea/Repashy) - 2+ flavors',
                'Spray bottle or misting system',
                'Paper towels (always)',
                'Digital scale (0.1g precision)',
              ],
            },
          ],
        },
      ],
    },

    // 3 - Source
    {
      kicker: 'The Source',
      title: 'Where you get your gecko matters more than anything else.',
      lead:
        'A gecko from a reputable breeder will usually outlive, outperform, and cost less total than a Petco rescue. This decision shapes everything that follows.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Best',
              tone: 'fern',
              title: 'Breeder',
              items: [
                'Known genetics and lineage',
                'Health guarantee standard',
                'Proven eating before sale',
                'Support after purchase',
                'Ethical husbandry',
                'Higher upfront ($75-$300+)',
                'Wait list for popular morphs',
                'Shipping cost + logistics',
              ],
            },
            {
              meta: 'Good',
              tone: 'moss',
              title: 'Reptile expo',
              items: [
                'Meet the breeder in person',
                'See the animal before buying',
                'Competitive pricing',
                'Access to multiple morphs',
                'Stressed animals, bad lighting',
                'Hard to verify husbandry history',
                'Impulse-buy risk',
                'No post-sale support from some vendors',
              ],
            },
            {
              meta: 'Avoid',
              tone: 'ruby',
              title: 'Chain pet store',
              items: [
                'Convenient',
                'Immediate availability',
                'Often sick or parasitized',
                'No genetic information',
                'Wrong care advice bundled',
                'No health guarantee',
                'Staff rarely trained on reptiles',
                'Often misgendered',
              ],
            },
          ],
        },
      ],
    },

    // 4 - Due diligence / breeder vetting
    {
      kicker: 'Due Diligence',
      title: 'How to vet a breeder in 10 minutes.',
      lead:
        'Ask these questions before sending money. A good breeder will answer all of them cheerfully. A bad one will dodge, deflect, or go quiet.',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'When was this gecko last fed, and on what brand?',
              text: "A breeder who doesn't know = red flag.",
            },
            {
              title: 'Is the gecko reliably eating CGD from a dish?',
              text: 'Hatchlings should be proven eaters before sale.',
            },
            {
              title: 'Can I see a photo of the parents?',
              text: 'Confirms morph claims; lets you estimate adult coloration.',
            },
            {
              title: "What's the hatch date and current weight?",
              text: 'Establishes age-appropriate size. Undersized = trouble.',
            },
            {
              title: 'Do you guarantee live arrival and health?',
              text: 'Industry standard is 24-48hr live arrival + 7-day health.',
            },
            {
              title: 'Has this gecko had a fecal done?',
              text: "Top breeders parasite-screen. Many don't - ask anyway.",
            },
          ],
        },
      ],
    },

    // 5 - Day 1
    {
      kicker: 'Day 1',
      title: 'The first 24 hours: the critical window.',
      lead:
        'Your gecko just survived a stressful trip. What you do in the first 24 hours sets the acclimation clock. The goal is zero stress - not photography, not handling, not introductions.',
      blocks: [
        {
          type: 'timeline',
          items: [
            {
              when: '0:00',
              label: 'Arrival',
              text:
                'Open the package in a quiet, enclosed room. Cool environment preferred. Never outdoors in winter; never in direct sun.',
            },
            {
              when: '0:05',
              label: 'Transfer',
              text:
                "Gently transfer to the pre-dialed enclosure. No handling - tip the deli cup at the substrate. If they run, let them. Cresties are fast. Close the lid.",
            },
            {
              when: '0:15',
              label: 'Mist',
              text:
                'Lightly mist the enclosure to spike humidity. Place a small dish of CGD. The gecko will NOT eat tonight. Offer anyway.',
            },
            {
              when: '0:30',
              label: 'Walk away',
              text:
                'Lights off, door closed, walk away. Resist every urge to check. They need to hide. Let them. For hours.',
            },
            {
              when: '12:00',
              label: 'Next day',
              text:
                'Mist again, check food dish, check for poop. Nothing else. Do NOT lift decor to find them. Do NOT handle.',
            },
          ],
        },
      ],
    },

    // 6 - Week 1
    {
      kicker: 'Week 1',
      title: "Days 2-7: observe, don't interact.",
      lead:
        "Week 1 is not for bonding. It's for stabilizing. Keep a log - this becomes invaluable if problems emerge later.",
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'DAILY CHECKLIST (WEEK 1)',
              tone: 'fern',
              items: [
                'Morning: check temp + humidity readings',
                'Morning: quick scan for gecko location (no touching)',
                'Morning: light mist if humidity dropped below 40%',
                'Evening: fresh CGD in dish',
                'Evening: heavy mist for overnight humidity',
                'Evening: look for lick marks / poop',
                'Log observations in a note or spreadsheet',
              ],
            },
            {
              heading: "WHAT'S NORMAL THIS WEEK",
              tone: 'moss',
              items: [
                "Hiding constantly - expected. They're crepuscular and scared.",
                "Not eating - first 1-2 weeks is normal. Don't panic.",
                'Glass surfing at night - exploring. Checking boundaries.',
                'Dark / muted colors - fire-down mode = calm or stressed.',
                'Staying in one spot all day - normal daytime behavior.',
              ],
            },
          ],
        },
      ],
    },

    // 7 - Red herrings
    {
      kicker: 'Red Herrings',
      title: "Week 1 panics that aren't actually panics.",
      lead:
        'Every first-time owner messages a breeder in week 1. These are the top five "emergencies" that are usually nothing.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: '"It hasn\'t eaten in 5 days."',
              text:
                "Normal for week 1. Weigh at end of week 2 - if stable, they're fine. See Feeding Guide.",
            },
            {
              title: '"I haven\'t seen it in 2 days."',
              text: 'Normal. They hide deeply when stressed. Resist the urge to search.',
            },
            {
              title: '"Its tail fell off!"',
              text:
                "Usually from mishandling or a fright. It won't regrow. Not a medical emergency - they live fine without it.",
            },
            {
              title: '"It\'s running at the glass all night!"',
              text:
                'Glass surfing is exploration behavior. Usually normal. Persistent after week 3 = check enclosure stress.',
            },
            {
              title: '"It opened its mouth at me!"',
              text:
                "Check if it's licking its eyes (normal) or truly gaping (stress signal - back off).",
            },
          ],
        },
      ],
    },

    // 8 - Week 2 weigh-in
    {
      kicker: 'Week 2',
      title: 'The first weigh-in: your most important data point.',
      lead:
        'By end of week 2, your gecko should have acclimated enough for one quick weigh-in. This becomes your baseline for the next 15 years.',
      blocks: [
        { type: 'heading', text: 'How to weigh' },
        {
          type: 'steps',
          items: [
            { title: 'Use a digital scale accurate to 0.1g', text: 'Kitchen or jewelry scale works.' },
            { title: 'Place a small container on the scale; tare to zero' },
            { title: 'Gently scoop or coax gecko into the container' },
            { title: 'Hold for 10 seconds for stable reading' },
            { title: 'Return to enclosure immediately' },
            { title: 'Log weight with date', text: 'This is your baseline.' },
          ],
        },
        { type: 'heading', text: 'Healthy weight benchmarks' },
        {
          type: 'kv',
          rows: [
            { label: 'At hatch', value: '1.5-3g' },
            { label: '3 months', value: '4-8g' },
            { label: '6 months', value: '10-16g' },
            { label: '12 months', value: '18-30g' },
            { label: '18 months', value: '25-40g' },
            { label: 'Full adult (2+ yrs)', value: '30-55g' },
          ],
        },
      ],
    },

    // 9 - Handling introduction
    {
      kicker: 'Week 2-3',
      title: 'Introducing handling, the right way.',
      lead:
        'The one rule that prevents tail loss: let them come to you. Never grab, never pull, never hover from above.',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Hand-in-tank conditioning',
              text:
                'Rest your open hand in the enclosure for 2-3 minutes, no movement. Do this daily for 3-5 days before attempting pickup. They learn your scent.',
            },
            {
              title: 'Let them climb on',
              text:
                "Slide your hand under, palm up. Let the gecko step ONTO you. If they don't, try tomorrow. Never scoop from above - that's what predators do.",
            },
            {
              title: 'The hand-walking method',
              text:
                "Once on your hand, they'll walk. Place your other hand in front - they walk onto it. Repeat. This tires them out safely and keeps them low.",
            },
            {
              title: 'Session length',
              text:
                'Start with 3-5 minutes. Over weeks, build to 10-15 max. Always over a soft, low surface - a bed, couch, or table with towel.',
            },
          ],
        },
      ],
    },

    // 10 - Tail drop
    {
      kicker: 'The Big Fear',
      title: 'Tail drop: how it actually happens, and what to do.',
      blocks: [
        {
          type: 'callout',
          tone: 'info',
          title: 'The myth',
          text: '"If I touch the tail, it falls off."',
        },
        {
          type: 'callout',
          tone: 'warn',
          title: 'The reality',
          text:
            'Tail drop requires either force OR extreme stress. A gentle touch doesn\'t trigger it. What triggers it:',
          items: [
            'Grabbing or squeezing the tail directly',
            'Catching it in an enclosure door or screen',
            'Sudden extreme fright (dropping, loud noise)',
            'Cage mate aggression / bullying',
            'Being pinned or restrained against struggle',
          ],
        },
        { type: 'heading', text: 'If it happens anyway' },
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: "It's not a medical emergency.",
              text: 'Cresties live normal lives without tails.',
            },
            {
              title: "The tail won't grow back.",
              text:
                'Cresties are the exception among geckos. You now have a "frog butt." They live fine without it.',
            },
            {
              title: 'Bleeding stops fast.',
              text:
                'Blood vessels at the base constrict reflexively. Minor blood is expected, serious bleeding is rare.',
            },
            {
              title: 'The tail twitches.',
              text:
                'For up to 30 minutes. This is normal - it evolved to distract predators. Remove it when still.',
            },
            {
              title: 'Keep the stump clean.',
              text:
                'Paper towel substrate for 7-10 days. Mist lightly. Skip live plants until healed.',
            },
            {
              title: 'Resume normal feeding.',
              text: 'No appetite change expected. Tail base will scar and smooth over.',
            },
          ],
        },
      ],
    },

    // 11 - Week 3-4 rhythms
    {
      kicker: 'Week 3-4',
      title: 'Establishing rhythms.',
      lead:
        'By week 3, a healthy gecko should be eating reliably, pooping regularly, and tolerating brief handling. This is when you lock in the routines that will carry through the next 15 years.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Feeding',
              title: '3x/week schedule',
              text:
                'Feed MWF or similar 3x/week schedule. Fresh CGD at dusk, remove 24hr later. Rotate 2-3 flavors over a week.',
            },
            {
              meta: 'Misting',
              title: 'Once per day after dusk',
              text:
                'Heavy enough to spike humidity to 80%+ and provide drinking droplets. Skip if substrate still damp from yesterday.',
            },
            {
              meta: 'Weighing',
              title: 'Weekly for the first year',
              text: 'Same day, same time. Log it. This is your health dashboard.',
            },
            {
              meta: 'Handling',
              title: '3x/week max, 5-10 min max',
              text: 'Same time of day if possible. Stop the moment stress signs appear.',
            },
            {
              meta: 'Observation',
              title: '2-minute daily check from outside the glass',
              text: 'Location, color, alertness, any visible waste or shed.',
            },
            {
              meta: 'Logging',
              title: 'Simple note per day',
              text:
                'Date, weight, what they ate, shed dates, anything unusual. Future-you will thank past-you.',
            },
          ],
        },
      ],
    },

    // 12 - Vet intro
    {
      kicker: 'Vet Intro',
      title: 'Should you take a new gecko to the vet?',
      lead:
        "The 30-day check-up is debated in the hobby. Here's the honest answer: it depends on where your gecko came from.",
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              tone: 'fern',
              meta: 'From a reputable breeder',
              title: 'Probably not needed',
              text:
                'A good breeder has already done parasite screening and quarantine. A 30-day visit is optional. Save the money for an annual wellness check at year one.',
            },
            {
              tone: 'amber',
              meta: 'From a pet store / expo / unknown',
              title: 'Yes - within 30 days',
              text:
                'These geckos arrive with unknown parasite load and husbandry history. A fecal float and basic exam catches issues before they cascade. Non-negotiable.',
            },
            {
              tone: 'ruby',
              meta: 'Any gecko showing symptoms',
              title: 'Immediately',
              text:
                "Lethargy, weight loss, sunken eyes, stuck shed that won't resolve, abnormal stool, open-mouthed breathing. Don't wait for week 4. Go now.",
            },
          ],
        },
      ],
    },

    // 13 - Money
    {
      kicker: 'The Money',
      title: 'What this actually costs.',
      lead:
        "Most first-time owners budget $200 and spend $800. Here's a realistic breakdown so you don't get surprised.",
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'STARTUP COSTS (YEAR 1)',
              tone: 'fern',
              items: [
                'Gecko (breeder) · $75-$300',
                'Enclosure (18×18×24) · $120-$200',
                'Substrate, plants, decor · $40-$100',
                'Digital thermo + hygrometer · $20-$40',
                'CGD (multiple flavors) · $30-$50',
                'Scale, dishes, misting bottle · $25-$50',
                'First-year vet fund · $100-$200',
                'TOTAL · $410-$940',
              ],
            },
            {
              heading: 'ONGOING (PER YEAR)',
              tone: 'moss',
              items: [
                'CGD (~4 bags/year) · $60-$100',
                'Feeder insects (optional) · $50-$120',
                'Replacement supplies · $30-$60',
                'Electricity (lights, heat) · $20-$40',
                'Annual vet visit · $75-$150',
                'Emergency vet fund · $100-$300',
                'TOTAL · $335-$770',
              ],
            },
          ],
        },
      ],
    },

    // 14 - 8 mistakes
    {
      kicker: 'Avoid These',
      title: 'The 8 most common first-month mistakes.',
      blocks: [
        {
          type: 'checklist',
          variant: 'x',
          items: [
            'Handling in the first 2 weeks',
            'Setting up the tank the same day the gecko arrives',
            "Using a heat lamp (they don't need it at room temp)",
            'Buying a 12×12×18 for a hatchling (too big - they get lost)',
            'Skipping the thermometer and hygrometer',
            'Using loose substrate for a hatchling (impaction risk)',
            'Feeding insects before establishing CGD',
            'Trusting pet-store care advice over breeder advice',
          ],
        },
      ],
    },

    // 15 - Household
    {
      kicker: 'Household',
      title: 'Sharing a gecko with kids, partners, and other pets.',
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'WITH KIDS',
              tone: 'fern',
              items: [
                'Age 8+ for independent handling. Younger kids can assist with misting and feeding, supervised.',
                'Always over a low, soft surface. Bed, couch, or floor. Never standing up over tile or concrete.',
                'One person handles at a time. Passing hand-to-hand invites drops. Finish one session before the next.',
                'No squeezing, ever. Cresties are fragile. Kids instinctively grip when startled - coach them through it.',
                'Wash hands before AND after. Protects the gecko from soap residue; protects the kid from salmonella.',
              ],
            },
            {
              heading: 'WITH OTHER PETS',
              tone: 'amber',
              items: [
                'Cats are the real threat. Even a securely-lidded enclosure can be stressful if a cat stares all day. Keep them out of the gecko room or place the enclosure high.',
                'Dogs are less dangerous but louder. Barking and sudden movement stress nocturnal animals. Ambient noise matters.',
                'Never cohabitate with other reptile species. Different husbandry needs, disease risk, and predator/prey dynamics.',
                'Quarantine new cresties 60+ days. Even before bringing a new gecko into the same room as an existing one.',
              ],
            },
          ],
        },
      ],
    },

    // 16 - Life happens
    {
      kicker: 'Life Happens',
      title: 'Weekends, vacations, and emergencies.',
      lead:
        "Cresties are actually one of the easiest reptiles to leave for short periods. Here's how long is safe, and how to prep.",
      blocks: [
        {
          type: 'timeline',
          items: [
            {
              when: '1-3 days',
              label: 'No-prep safe',
              text:
                "Heavy mist before leaving. Leave a full dish of CGD. They'll be fine. Don't overthink it.",
            },
            {
              when: '4-7 days',
              label: 'Minimal prep',
              text:
                'Have someone stop in once every 2-3 days to mist and swap CGD. No handling - just observation and fresh food.',
            },
            {
              when: '1-2 weeks',
              label: 'Sitter required',
              text:
                'Daily visits. Detailed written instructions. Temperature check, humidity mist, CGD swap, visual confirmation of gecko alive.',
            },
            {
              when: '2+ weeks',
              label: 'Serious prep',
              text:
                'In-person daily sitter OR bring gecko to an experienced friend. Automatic mister recommended. Expect acclimation disruption on return.',
            },
          ],
        },
      ],
    },

    // 17 - Honest talk
    {
      kicker: 'Honest Talk',
      title: 'What owning a crested gecko actually feels like.',
      lead:
        'Pet store marketing sells a cuddly pocket-lizard. The reality is more nuanced - and mostly better, if you know what to expect.',
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: "WHAT THEY'RE NOT",
              tone: 'ruby',
              items: [
                'Cuddly. They tolerate handling; they rarely enjoy it.',
                'Affectionate in a mammalian sense.',
                'Interactive during the day (they sleep).',
                'Low-commitment (they live 15-20 years).',
                "Trainable. They don't come when called.",
                'Ideal for kids under 8 as their pet.',
              ],
            },
            {
              heading: 'WHAT THEY ARE',
              tone: 'fern',
              items: [
                'Low-maintenance compared to almost any other pet.',
                'Genuinely interesting to watch at dusk.',
                'Individually distinct - they have personalities.',
                'A 15-year commitment in a 4-inch body.',
                'Incredible display animals in a planted enclosure.',
                'Beginner-friendly IF you respect their needs.',
              ],
            },
          ],
        },
      ],
    },

    // 18 - The 30-day milestone
    {
      kicker: 'The Milestone',
      title: 'Day 30: the checkpoint.',
      lead:
        'If you can answer YES to all six of these, your gecko has acclimated. The next 15 years are about maintenance, not crisis.',
      blocks: [
        {
          type: 'checklist',
          items: [
            'Eating CGD reliably 2-3 times per week',
            'Pooping regularly (pellet + white urates)',
            'Weight stable or gaining week-over-week',
            'Tolerates brief handling without tail threat',
            'Completed at least one full clean shed',
            'You know your husbandry numbers by heart',
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text:
            "Failed one? That's fine. Identify which, address it, reset the clock. The goal is honest - not fast.",
        },
      ],
    },

    // 19 - Next in series
    {
      kicker: 'The Next 15 Years',
      title: 'Where to go from here.',
      lead:
        "You're not done learning - but you're past the hardest part. Here's the rest of the Keeper's Guide series, organized by when you'll actually need each one.",
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'When something goes wrong',
              title: 'The Feeding Troubleshooting Guide',
              text:
                "If they stop eating, lose weight, or you're unsure what's normal. Bookmark it before you need it.",
            },
            {
              meta: "For every question you'll ever have",
              title: "The Handbook: Everything They Don't Tell You",
              text:
                'Handling, UVB, cohabitation, behavior decoded, bioactive setups, pet store misinformation - the FAQ killer.',
            },
            {
              meta: 'When you start looking at new geckos',
              title: 'The Morph & Genetics Guide',
              text:
                "Understand what you have, what you're looking at, and how to pair for specific outcomes.",
            },
            {
              meta: "When you're ready to produce",
              title: 'The Complete Breeding Guide',
              text:
                'Year 2+ territory. From pair selection through hatchling placement - including what first-time breeders never see coming.',
            },
          ],
        },
      ],
    },

    // 20 - Closing
    {
      layout: 'closing',
      kicker: 'The Principle',
      title: 'Boring is the goal.',
      lead:
        "A well-acclimated crested gecko is, frankly, not very exciting day-to-day. They eat when you're asleep. They hide when you want to see them. They go weeks without anything interesting happening. That's success.",
      blocks: [
        {
          type: 'callout',
          tone: 'success',
          text: 'If your gecko has become boring by day 30 - you did it right.',
        },
      ],
    },
  ],
};
