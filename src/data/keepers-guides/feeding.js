/**
 * Guide 01 ,  Feeding Troubleshooting
 *
 * The complete diagnostic framework for any crested gecko that has
 * stopped eating. Source-of-truth slide content, rendered by
 * src/components/careguide/GuideSlide.jsx.
 *
 * Keep this file dependency-free (no JSX, no imports).
 */

export const FEEDING_GUIDE = {
  id: 'feeding',
  number: '01',
  title: 'Feeding Troubleshooting',
  shortTitle: 'Feeding Troubleshooting',
  description:
    "The complete diagnostic framework for any crested gecko that's stopped eating. Works for hatchlings, juveniles, adults, seniors, gravid females, breeding males, and geckos going through shed cycles.",
  slides: [
    // 1 - Hero
    {
      layout: 'hero',
      kicker: 'The Definitive Guide',
      title: "My gecko isn't eating.",
      lead:
        'A complete troubleshooting framework for keepers of every level - from first-time owners to breeders managing full collections.',
      tags: ['Diagnose', 'Husbandry', 'Life stage', 'Reproduction', 'Red flags', 'Vet'],
    },

    // 2 - Step zero
    {
      kicker: 'Step Zero',
      title: "First - is your gecko actually not eating?",
      lead:
        'Cresties are crepuscular and lick - not gulp. Most "non-eaters" are eating. Before troubleshooting anything, rule out the illusion of food refusal.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              title: 'Look for lick marks',
              text:
                'Spread CGD in a THIN layer on a shallow silicone dish or bottle cap. A thick puddle will re-pool overnight and hide evidence. Lick marks = eating.',
            },
            {
              title: 'Switch to paper towel',
              text:
                'Bioactive is beautiful, but feces vanish in it. For any suspected non-eater: paper towel substrate for 3-7 days. If you see poop, your gecko is eating.',
            },
            {
              title: 'Weigh weekly',
              text:
                'Digital scale accurate to 0.1g. A stable weight over 1-2 weeks means intake is adequate, even if you never see food disappear.',
            },
          ],
        },
      ],
      footer: 'If your gecko is pooping, it is eating. Full stop.',
    },

    // 3 - 6-point check
    {
      kicker: 'Diagnostic',
      title: 'The 6-point rapid check',
      lead:
        'Before anything else - run this list. 9 out of 10 feeding issues resolve here.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: '01',
              title: 'Temperature',
              text: 'Ambient 72-78°F. Above 80°F or below 68°F kills appetite.',
            },
            {
              meta: '02',
              title: 'Humidity',
              text:
                '60-80% overnight spike, drop to 40-50% daytime. Constant wet = respiratory risk.',
            },
            {
              meta: '03',
              title: 'Enclosure size',
              text:
                "Too big for the size of gecko = can't find food. Too small = stress.",
            },
            {
              meta: '04',
              title: 'Food freshness',
              text: 'CGD goes bad in ~24-36 hours. Stale food is the #1 invisible refusal.',
            },
            {
              meta: '05',
              title: 'Dish type & placement',
              text:
                'Shallow, elevated, near a hide. Deep bowls block access; floor placement is ignored.',
            },
            {
              meta: '06',
              title: 'Stress events',
              text:
                'Move, rehome, new decor, loud room, other pets. Recent = expect 1-4 weeks off food.',
            },
          ],
        },
      ],
    },

    // 4 - Husbandry
    {
      kicker: 'Husbandry',
      title: 'The environment: where 80% of feeding problems live',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Temperature',
              title: 'Target: 72-78°F day / 65-72°F night',
              items: [
                'Above 85°F causes heat stress - potentially fatal.',
                'Below 65°F during the day triggers slowed metabolism and appetite collapse.',
                "Too-small tanks have no gradient; gecko can't self-regulate.",
                'Use a digital probe thermometer, not stick-ons.',
              ],
            },
            {
              meta: 'Humidity',
              title: 'Target: 80%+ post-mist → 40-50% daytime',
              items: [
                'Constant 80%+ is just as deadly as too dry - oversaturation kills.',
                'Let the enclosure dry out between mistings.',
                'Dry air all day = dehydration → no interest in solid food.',
                'Keep a digital hygrometer visible at all times.',
              ],
            },
            {
              meta: 'Enclosure',
              title: 'Size to the gecko, not the goal',
              items: [
                'Hatchlings <12g: small critter keeper or 6qt tub.',
                'Juveniles 12-25g: medium keeper or 12×12×18.',
                'Adults 25g+: 18×18×24 minimum; 20-gal tall works.',
                'Oversized enclosures stress small geckos and hide food.',
              ],
            },
          ],
        },
        {
          type: 'callout',
          tone: 'success',
          text:
            'Dial these in BEFORE you change food, brand, or handling routine. Always.',
        },
      ],
    },

    // 5 - The food itself
    {
      kicker: 'The Food Itself',
      title: 'Brand, texture, freshness, presentation',
      blocks: [
        { type: 'heading', text: 'What to adjust' },
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: 'Brand rotation',
              text:
                'Pangea, Repashy, Lugarti, Black Panther Zoological - rotate flavors every 1-2 feedings. Bored palates refuse food.',
            },
            {
              title: 'Consistency',
              text:
                "Most prefer thick smoothie; some want ketchup-thin. Try both before concluding 'won't eat.'",
            },
            {
              title: 'Freshness',
              text:
                'CGD degrades in ~24-36 hours even in a humid enclosure. Day-3 food is rancid to their senses.',
            },
            {
              title: 'Bee pollen dusting',
              text:
                'A pinch on top is a proven appetite stimulant, especially for hatchlings and post-shed adults.',
            },
            {
              title: 'Never start with bugs',
              text:
                'Bug-dependent geckos will hold out indefinitely. Establish CGD first, bugs 1-2× week as supplement only.',
            },
          ],
        },
        { type: 'heading', text: 'The dish matters' },
        {
          type: 'compare',
          columns: [
            {
              heading: 'DO',
              tone: 'fern',
              items: [
                'Shallow, silicone or bottle cap - they walk INTO it, not climb up',
                'Elevated on a feeding ledge near a hide',
                "Small portion, thin layer - don't waste CGD on day-old slop",
                'One ground-level dish + one elevated for insecure eaters',
              ],
            },
            {
              heading: 'AVOID',
              tone: 'ruby',
              items: [
                'Deep plastic cups with slick lips',
                'Floor-only placement in a tall enclosure',
                'Hand-feeding as a first resort - creates dependence',
                "Leaving old food to 'maybe get eaten eventually'",
              ],
            },
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text: 'More geckos refuse food over the dish than the food.',
        },
      ],
    },

    // 6 - Stress / acclimation
    {
      kicker: 'Stress',
      title: 'The acclimation window & what to do inside it',
      lead:
        'The rule most new keepers miss: 2-4 weeks of reduced eating after a move is normal. Any major change - new home, new enclosure, redecoration, new room, new people in the household, a visit to a petsitter - resets the clock.',
      blocks: [
        { type: 'heading', text: 'Do nothing except:' },
        {
          type: 'checklist',
          items: [
            'Offer fresh CGD every feeding night, remove by morning',
            'Mist normally - hydration matters more than food short-term',
            'No handling for 7-14 days minimum',
            'Keep lighting and traffic low - let them observe you from safety',
            'Weigh once a week (quick, <30 seconds)',
          ],
        },
        { type: 'heading', text: 'Acclimation timeline' },
        {
          type: 'timeline',
          items: [
            { when: 'Day 1-3', label: 'Hiding nearly constantly', text: 'Totally normal.' },
            { when: 'Day 4-10', label: 'Exploring at night', text: 'First lick marks possible.' },
            { when: 'Week 2', label: 'Feeding pattern emerging', text: 'Weight should stabilize.' },
            { when: 'Week 3-4', label: 'Eating reliably', text: 'Most geckos reliably eating. Expect poop.' },
            { when: 'Week 4+', label: 'Still nothing?', text: 'Begin deeper troubleshooting.' },
          ],
        },
      ],
    },

    // 7 - Hatchlings
    {
      kicker: 'Life Stage · 0-3 months',
      title: 'Hatchlings: the trickiest stage',
      blocks: [
        {
          type: 'stats',
          items: [
            { value: '2-4g', label: 'Typical hatchling weight' },
            { value: '~1g/mo', label: 'Growth', note: 'expected pace' },
            { value: '5/wk', label: 'CGD available', note: 'nights per week' },
            { value: '1-2 wk', label: 'Shedding cadence' },
          ],
        },
        { type: 'heading', text: "What's different about hatchlings" },
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: 'Downsize the enclosure',
              text:
                'Hatchlings genuinely get lost in 18×18×24s. A 6qt tub or medium critter keeper means food is always 2 inches away. Move up when they hit 8-10g.',
            },
            {
              title: "Expect 'invisible' eating for weeks",
              text:
                "Breeders report this constantly - the gecko looks like it's never eaten, then suddenly it's 6g. Trust poop and weight, not direct observation.",
            },
            {
              title: "A 'nose dab' of CGD is fair game",
              text:
                'Rubbing a tiny amount on the snout once every few days is acceptable for confirmed non-eaters under 2 weeks home. NOT a long-term strategy.',
            },
            {
              title: 'Bee pollen = hatchling secret weapon',
              text:
                "A pinch on top of CGD is the single most reliable appetite stimulant for babies that 'just won't start.'",
            },
            {
              title: 'Never insects-only for a hatchling',
              text:
                'Calcium and nutrient imbalance will catch up fast. CGD must be established first.',
            },
            {
              title: 'Weakest hatchling of a clutch often fails',
              tone: 'amber',
              text:
                'Sad but real - not every hatchling thrives, even in perfect conditions. Focus on supportive care; consult a vet if weight loss is rapid.',
            },
          ],
        },
      ],
    },

    // 8 - Juveniles
    {
      kicker: 'Life Stage · 3-12 months',
      title: 'Juveniles: growth phase + first appetite shift',
      lead:
        "Juveniles are hungry - usually. When they're not, it's almost always one of three things:",
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'The 6-to-8 month slowdown',
              text:
                'A natural appetite taper as they transition to adult metabolism. What was 5×/week becomes 3-4×/week. NOT a problem - adjust expectations and feeding frequency downward.',
            },
            {
              title: 'Outgrew the enclosure too fast',
              text:
                "Owners often upgrade to an adult tank at 15g 'because they're growing.' Too much space = lost food, stress, and weight stalls. Wait until 20g+ for full-size adult enclosures.",
            },
            {
              title: 'Shedding cycle dominates',
              text:
                "Juveniles shed every 2-3 weeks. Expect 1-2 days of reduced appetite before AND after each shed. Over a month, that's half their feedings. Track shed dates.",
            },
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text:
            'Expected adult weight by 12 months: 15-20g (sexual maturity). By 18 months: 25-40g. Track it.',
        },
      ],
    },

    // 9 - Adults
    {
      kicker: 'Life Stage · 1-5 years',
      title: 'Adults: when sudden loss of appetite means something',
      lead:
        'Healthy adults eat 2-3× per week. A sudden change from that baseline is the signal worth investigating.',
      blocks: [
        { type: 'heading', text: 'Usual suspects (in order)' },
        {
          type: 'steps',
          items: [
            {
              title: 'Environmental drift',
              text:
                'House temps shifted with the seasons. The tank that was 75°F in October is 66°F in January.',
            },
            {
              title: 'Stale or unchanged CGD brand',
              text: 'Geckos bore of a single flavor after months. Rotate.',
            },
            {
              title: 'Shedding (less obvious in adults)',
              text: 'Adults shed every 4-8 weeks - easy to miss if colors are dark.',
            },
            {
              title: 'Breeding season behavior (Mar-Oct)',
              text: 'Both sexes affected. See next slide.',
            },
            {
              title: 'Illness / parasites',
              text:
                'If none of the above, consult an exotic vet. Fecal test is step one.',
            },
          ],
        },
        { type: 'heading', text: 'Healthy adult baseline' },
        {
          type: 'kv',
          rows: [
            { label: 'Weight range', value: '30-55g (obese above ~65g)' },
            { label: 'Feeding frequency', value: 'CGD 2-3× per week' },
            { label: 'Insects', value: 'Optional, 1× per week if at all' },
            { label: 'Shed cycle', value: 'Every 4-8 weeks' },
            { label: 'Expected poop', value: 'Pellet + white urates, regular cadence' },
            { label: 'Weight fluctuation', value: '±2-3g is normal across a year' },
          ],
        },
      ],
    },

    // 10 - Seniors
    {
      kicker: 'Life Stage · 5+ years',
      title: 'Senior geckos: less appetite is the norm, not the alarm',
      lead:
        'Cresties live 15-20 years with good care. Appetite tapers naturally from age ~5 onward. The goal shifts from growth to maintenance.',
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'EXPECT',
              tone: 'fern',
              items: [
                'Feeding drops to 1-2× per week',
                'Slower growth, then zero growth',
                'Less climbing, more floor time',
                'Longer rest periods during the day',
                'Smaller portions per feeding',
              ],
            },
            {
              heading: 'INVESTIGATE',
              tone: 'amber',
              items: [
                'Weight drop of >10% from baseline',
                'Visible pelvic bones or hip points',
                'Sudden complete refusal (>2 weeks)',
                'Runny or missing stool',
                'Lethargy beyond the usual senior slowdown',
              ],
            },
            {
              heading: 'ACT',
              tone: 'coral',
              items: [
                'Vet visit with fecal screen',
                'Offer easier-to-consume CGD (thinner)',
                'Reduce enclosure complexity - fewer obstacles',
                'Hand-present food on a spoon if advised',
                'Consider heated hide during cold months',
              ],
            },
          ],
        },
      ],
    },

    // 11 - Females: gravid / lay / post-lay
    {
      kicker: 'Reproduction · Females',
      title: 'Gravid, laying, and post-lay appetite loss',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'Pre-lay (final days)',
              title: 'May reject food entirely 2-5 days before laying',
              text:
                "Eggs press on stomach; no room. Syringe-regurgitation is common - don't force-feed here. Offer water and a proper lay box.",
            },
            {
              meta: 'Post-lay recovery',
              title: 'Returns gradually over 3-10 days',
              text:
                "She'll be depleted of calcium and mass. Offer high-calcium CGD, bee pollen, and an occasional waxworm or dubia. Switch CGD flavor if she refuses the old one.",
            },
            {
              meta: 'Between clutches',
              title: 'Should be voracious',
              text:
                'A mature female lays every 25-40 days in season. Between clutches she must rebuild calcium. Check her calcium sacs (back of mouth) - pale or shrunken = rest her from breeding.',
            },
            {
              meta: 'Infertile clutches (solo females)',
              title: 'Same cycle - even without a male',
              text:
                'Females store sperm and can lay infertile eggs regardless. If your lone female stopped eating and gained weight? Could be gravid. Provide a lay box.',
            },
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: 'Dystocia (egg binding)',
          text:
            'Firm, distended abdomen + lethargy + refusing food for days = EMERGENCY VET VISIT.',
        },
      ],
    },

    // 12 - Males & breeding season
    {
      kicker: 'Reproduction · Males & Season',
      title: 'Males, breeding season, and cohab dynamics',
      lead:
        "Breeding season in the Northern Hemisphere runs late March to late October. Both sexes show appetite changes - here's how to read them.",
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'MALE BEHAVIOR',
              tone: 'fern',
              items: [
                'Early-season appetite drop: 1-2 weeks of reduced eating as hormones spike.',
                'Searching behavior: pacing, glass-running, scent marking - calories burned elsewhere.',
                'Returns to normal: usually self-resolves within a few weeks once paired or season settles.',
                'No intervention needed - unless weight drops >10% of baseline.',
              ],
            },
            {
              heading: 'FEMALE-IN-PAIR STRESS',
              tone: 'amber',
              items: [
                'Male harassment: persistent male can stress a female into stopping eating - even without obvious aggression.',
                'Signs: female hides constantly, avoids the ground, loses weight despite lay cycle being normal.',
                "Fix: separate. Full stop. No 'wait and see.' Females can die from chronic breeding stress.",
                'Rest rule: never more than 7-8 clutches per year - calcium reserves get depleted.',
              ],
            },
          ],
        },
      ],
    },

    // 13 - Shedding
    {
      kicker: 'Natural Cycles',
      title: 'Shedding: appetite loss is expected - track the dates',
      lead:
        "A healthy crestie can go off food for 2-3 days BEFORE and 1-2 days AFTER each shed. That's up to 5 days of 'not eating' per shed event - completely normal.",
      blocks: [
        {
          type: 'steps',
          items: [
            { number: '1', title: 'Day -3 to -1 · Dulling color', text: 'Skin darkens/grays; reduced eating begins' },
            { number: '2', title: 'Shed day · Active shed', text: 'Often overnight; gecko eats the skin (nutrients)' },
            { number: '3', title: 'Day +1 to +2 · Recovery', text: 'Bright new colors; may still skip 1-2 meals' },
            { number: '4', title: 'Day +3+ · Back to normal', text: 'Full appetite returns; any longer = check husbandry' },
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          text:
            'Stuck shed - especially on toes or tail tip - can cause appetite loss AND limb loss. Check every shed.',
        },
      ],
    },

    // 14 - Seasonal / brumation
    {
      kicker: 'Seasonal',
      title: 'Winter slowdown & partial brumation',
      lead:
        "Cresties don't 'brumate' like bearded dragons do - but they DO slow down in winter. Even in a temperature-controlled home, internal cues reduce appetite seasonally.",
      blocks: [
        { type: 'heading', text: "What's normal in winter" },
        {
          type: 'checklist',
          items: [
            'Appetite drops 30-50% from summer baseline',
            'Activity reduces; more time in hides',
            'Still drink water - hydration persists',
            'Weight should remain stable (within 5-10%)',
            'Returns to normal in spring with rising temps',
          ],
        },
        {
          type: 'callout',
          tone: 'warn',
          title: "When it's NOT seasonal",
          text:
            "If weight loss exceeds 10% of baseline - it's not brumation, it's illness. Seasonal slowdown does not produce visible weight loss.",
        },
        {
          type: 'callout',
          tone: 'info',
          title: 'For breeders',
          text:
            "Intentional cooling is controversial. Most modern breeders (ACR, NEHERP) keep stable temps year-round and report excellent fertility. Cooling isn't required to trigger breeding in this species. It CAN help females rest and rebuild calcium - but only healthy, mature adults should experience any cooling period, and drops should never go below 65°F.",
        },
      ],
    },

    // 15 - Red flags / weight loss ladder
    {
      kicker: 'Red Flags',
      title: 'Weight loss thresholds & symptoms that demand action',
      blocks: [
        { type: 'heading', text: 'The weight loss ladder' },
        {
          type: 'ladder',
          items: [
            { badge: '0-5%', tone: 'fern', title: 'Normal fluctuation', text: 'Shed cycles, seasonal, bathroom timing.' },
            { badge: '5-10%', tone: 'moss', title: 'Monitor closely', text: 'Weigh every 3-4 days. Review husbandry fully.' },
            { badge: '10-15%', tone: 'amber', title: 'Actively problematic', text: 'Schedule vet. Begin fecal screen. Review diet.' },
            { badge: '>15%', tone: 'ruby', title: 'Medical emergency', text: 'Visible bone prominence, weak grip, lethargy.' },
          ],
        },
        {
          type: 'callout',
          tone: 'danger',
          title: 'STOP TROUBLESHOOTING. GO TO A VET.',
          items: [
            "Visible pelvic bones + 'skinny tail'",
            'Wavy or kinked tail (possible MBD)',
            'Soft or puffy jawbone (MBD)',
            'Worms visible in feces',
            'Runny, bloody, or absent stool for >10 days',
            'Open-mouthed breathing',
            'Swollen limbs or eyes',
            'Unable to climb glass (with clean feet)',
            'Regurgitation after eating',
            'Sudden complete lethargy + cool body',
          ],
        },
      ],
    },

    // 16 - Vet
    {
      kicker: 'Veterinary',
      title: "When to see the vet - and what they'll actually do",
      lead:
        'An experienced reptile vet is not optional equipment for serious keepers. Find one BEFORE you need one.',
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'WHEN TO GO',
              tone: 'amber',
              items: [
                'No food for >2 weeks despite perfect husbandry',
                'Any weight loss >10% of baseline',
                'Any symptom on the red-flag list',
                'Egg-laying female lethargic + distended',
                'New gecko - routine fecal screen within first 60 days',
                'Every 12 months for routine wellness (adults)',
              ],
            },
            {
              heading: "WHAT THEY'LL DO",
              tone: 'fern',
              items: [
                'Fecal flotation + smear (pinworms, Entamoeba, crypto)',
                'Full physical exam + weight + hydration check',
                'Calcium sac evaluation (breeders: ask for this)',
                'X-ray if egg-binding or impaction suspected',
                'Panacur (fenbendazole) for most common parasites',
                'Fluid therapy for severe dehydration',
                'Husbandry review - bring photos of your setup',
              ],
            },
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text:
            'Bring a fresh fecal sample (<24hr old, sealed) + a list of husbandry parameters + weight history. Saves a week.',
        },
      ],
    },

    // 17 - Advanced / assist feeding
    {
      kicker: 'Advanced',
      title: 'Assist feeding: last resort, correctly done',
      lead:
        'Assist-feeding a gecko is NOT a first-line tool. It creates dependence, risks aspiration, and masks underlying illness. Only under these conditions:',
      blocks: [
        {
          type: 'callout',
          tone: 'warn',
          title: 'ASSIST-FEED ONLY IF:',
          items: [
            'Vet has instructed you to do so, OR',
            'Weight loss is >15% and getting worse',
            'Visible skinny tail / bone prominence',
            "Gecko is still alert (NOT comatose - that's vet only)",
            'You have proper materials on hand',
          ],
        },
        { type: 'heading', text: 'Correct method' },
        {
          type: 'steps',
          items: [
            { title: 'Thin the CGD', text: 'Mix extra-watery - pourable smoothie consistency.' },
            { title: 'Use a plastic syringe or spoon', text: '1-3cc plastic, no needle. Or small plastic spoon.' },
            {
              title: "Touch the snout - don't force",
              text: 'Place a drop on the nose. Let them lick it off. Repeat. Never pry open.',
            },
            { title: 'Stop at 0.2-0.5ml', text: 'Tiny amounts. Wait for swallowing. Never squirt in volume.' },
            { title: 'Once daily maximum', text: 'Overfeeding causes regurgitation, which dehydrates further.' },
            {
              title: 'Wean as soon as possible',
              text: 'Return to dish feeding the moment they show interest.',
            },
          ],
        },
      ],
    },

    // 18 - The Layered Diagnostic (author contribution)
    {
      kicker: 'My Contribution',
      title: 'The Layered Diagnostic',
      lead:
        'Most troubleshooting guides list 10-14 causes without ordering them. The cost of starting at the wrong layer is weeks of wasted time. Always diagnose in this order:',
      blocks: [
        {
          type: 'ladder',
          items: [
            {
              badge: 'L1',
              tone: 'fern',
              title: 'Illusion check  ·  1 day',
              text:
                'Paper towel + lick-mark test. Are they actually not eating, or do you just not see it?',
            },
            {
              badge: 'L2',
              tone: 'moss',
              title: 'Environment  ·  1-2 days',
              text:
                'Temperature, humidity, enclosure size. Dial these before ANY food changes.',
            },
            {
              badge: 'L3',
              tone: 'amber',
              title: 'Food mechanics  ·  3-5 days',
              text:
                'Freshness, brand, consistency, dish type, placement. Rotate flavors.',
            },
            {
              badge: 'L4',
              tone: 'coral',
              title: 'Stress & cycle  ·  1-4 weeks',
              text:
                'Acclimation, shedding, breeding season, winter slowdown. Often just: wait.',
            },
            {
              badge: 'L5',
              tone: 'ruby',
              title: 'Medical  ·  Immediate',
              text:
                'Weight loss >10%, red flags, prolonged refusal. Vet - not more troubleshooting.',
            },
          ],
        },
        {
          type: 'callout',
          tone: 'info',
          text:
            "Never skip a layer. A gecko held at 82°F won't eat no matter how many CGD flavors you try.",
        },
      ],
    },

    // 19 - Decision tree
    {
      kicker: 'Quick Reference',
      title: 'The decision tree - laminate this',
      blocks: [
        {
          type: 'tree',
          root: "Gecko 'not eating'?",
          branches: [
            {
              condition: 'Paper towel test → seeing poop?',
              tone: 'success',
              text: 'YES · Eating. Monitor weight weekly. Stand down.',
            },
            {
              condition: 'Paper towel test → no poop?',
              tone: 'neutral',
              text: 'Continue down →',
            },
            {
              condition: 'Temp 72-78°F? Humidity cycling? Dish OK?',
              tone: 'action',
              text: 'ANY NO · Fix husbandry first. Wait 7 days. Re-evaluate.',
            },
            {
              condition: 'ALL YES · Recent shed, move, gravid, season, age >5?',
              tone: 'waiting',
              text: 'YES TO ANY · Natural cycle. Weight stable? Just wait.',
            },
            {
              condition: 'NO TO ALL',
              tone: 'emergency',
              text: 'VET APPOINTMENT',
              detail: 'Bring fecal + husbandry log + weight history',
            },
          ],
        },
        { type: 'heading', text: 'How to use this' },
        {
          type: 'compare',
          columns: [
            {
              heading: 'Legend',
              tone: 'neutral',
              items: [
                'Green → already solved',
                'Amber → natural cycle, wait',
                'Coral → fix it yourself',
                'Red → medical, go now',
              ],
            },
            {
              heading: 'Method',
              tone: 'fern',
              items: [
                'Work top-to-bottom.',
                'At each decision, answer honestly.',
                'If the answer sends you sideways, take that action BEFORE descending further.',
                'Print. Laminate. Post near the enclosure.',
              ],
            },
          ],
        },
      ],
    },

    // 20 - Closing principle
    {
      layout: 'closing',
      kicker: 'Closing Principle',
      title: 'A healthy crested gecko will not starve itself.',
      lead:
        'If your husbandry is right, your gecko is past acclimation, and there are no red flags - patience is the answer 90% of the time. Weigh weekly. Trust the poop. Rotate flavors. Let them settle.',
      blocks: [
        {
          type: 'callout',
          tone: 'warn',
          text:
            'For the other 10% - move fast. Weight loss compounds. A gecko at 5% deficit today is at 10% in a week. Early vet visits save lives that late ones cannot.',
        },
      ],
    },
  ],
};
