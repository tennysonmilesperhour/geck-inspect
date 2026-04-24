/**
 * Guide 03 — The Handbook: Everything They Don't Tell You
 *
 * Evergreen reference settling the debates: UVB, cohabitation,
 * handling, bioactive vs paper towel, sexing, behavior decoding, and
 * what pet stores get wrong.
 *
 * Keep this file dependency-free (no JSX, no imports).
 */

export const HANDBOOK_GUIDE = {
  id: 'handbook',
  number: '03',
  title: "The Handbook: Everything They Don't Tell You",
  shortTitle: 'The Handbook',
  description:
    'The evergreen reference guide that settles the debates: UVB, cohabitation, handling, bioactive vs paper towel, sexing, behavior decoding, and what pet stores get wrong. The FAQ killer.',
  slides: [
    // 1 - Hero
    {
      layout: 'hero',
      kicker: "The Keeper's Guide Series",
      title: "Everything they don't tell you.",
      lead:
        "The handbook every crested gecko keeper needs - answering the debates, decoding the behaviors, and settling the questions that live rent-free in forums and Facebook groups.",
      tags: ['Behavior', 'Handling', 'UVB', 'Cohab', 'Sex', 'Setup'],
    },

    // 2 - Body language 1
    {
      kicker: 'Reading Your Gecko',
      title: 'Body language dictionary (1 of 2).',
      lead:
        "Most keepers misread what their gecko is telling them. Here's what these common behaviors actually mean.",
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Warning - back off',
              tone: 'ruby',
              title: 'Tail wag',
              text:
                'Slow, deliberate side-to-side. They are annoyed, about to bite or bolt. NOT a friendly greeting.',
            },
            {
              meta: 'Stress or threat',
              tone: 'amber',
              title: 'Mouth gape',
              text:
                'Wide open mouth, sometimes with a bark. Distance yourself. Persistent gaping = check respiratory.',
            },
            {
              meta: 'Normal maintenance',
              tone: 'fern',
              title: 'Eye licking',
              text:
                'They have no eyelids - tongue is their windshield wiper. Often mistaken for gaping.',
            },
            {
              meta: 'Active / alert / stressed',
              tone: 'amber',
              title: 'Fire-up',
              text:
                'Brighter, more vivid colors. Happens when warm, active, or threatened. Not always bad.',
            },
            {
              meta: 'Calm / resting',
              tone: 'fern',
              title: 'Fire-down',
              text: 'Muted, washed-out colors. Default daytime state. Not illness.',
            },
            {
              meta: 'Exploring OR stressed',
              tone: 'amber',
              title: 'Glass surfing',
              text:
                'Running up the walls at night = exploration. During the day = enclosure is wrong.',
            },
          ],
        },
      ],
    },

    // 3 - Body language 2
    {
      kicker: 'Reading Your Gecko',
      title: 'Body language dictionary (2 of 2).',
      lead:
        'The subtler signals. These take longer to recognize but reveal much more about what your gecko is actually experiencing.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Startled or annoyed',
              tone: 'amber',
              title: 'Barking / chirping',
              text:
                "Brief squeak or bark. They're surprised or protesting. Most common in juveniles. Usually passes in seconds.",
            },
            {
              meta: 'Alert / assessing',
              tone: 'moss',
              title: 'Tail curl',
              text: "Tip of tail curled tightly. They're focused or feeling uncertain. Watch for escalation.",
            },
            {
              meta: 'Smelling / exploring',
              tone: 'moss',
              title: 'Licking you',
              text:
                'Tongue is their nose. They lick to identify scents. Not affection, but also not stress.',
            },
            {
              meta: 'Fear response',
              tone: 'amber',
              title: 'Freezing in place',
              text:
                "Completely still, sometimes with one foot raised. Predator instinct - they think they're hidden. Stop what you're doing.",
            },
            {
              meta: 'Enclosure problem',
              tone: 'coral',
              title: 'Sleeping upside-down on glass',
              text:
                'Long-term = floppy tail syndrome risk. Not enough horizontal cover. Add more branches and leaves.',
            },
            {
              meta: 'Completely normal',
              tone: 'fern',
              title: 'Eating the shed',
              text:
                'They recover nutrients and remove scent trails (anti-predator). Why you rarely see full sheds.',
            },
          ],
        },
      ],
    },

    // 4 - Handling
    {
      kicker: 'Handling',
      title: 'Most handling advice is half-right.',
      lead:
        'The "never pull by the tail" rule is correct but incomplete. Here\'s the fuller picture of how to handle without stress, injury, or tail loss.',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Come from below, palm up.',
              text:
                'Predators strike from above. A hand descending is a threat. Approach from beneath and let them step up on their own.',
            },
            {
              title: 'Never restrain them.',
              text:
                'If they try to move, let them. Restraint triggers tail drop. The hand-walking method (one hand, then the other) lets them move freely without going anywhere.',
            },
            {
              title: 'Handle in the evening.',
              text:
                "They're naturally active at dusk. Daytime handling wakes them up - double the stress. Post-dinner is prime time.",
            },
            {
              title: 'Keep low to soft surfaces.',
              text:
                "Over a bed, couch, or table with towel. They leap - they don't fall accidentally. A leap from 5 feet onto tile can crack a jaw.",
            },
            {
              title: '10-15 minutes is the ceiling.',
              text:
                "Even acclimated cresties find handling stressful. More time doesn't build more trust - it just drains them.",
            },
            {
              title: 'Skip handling during shedding and after feeding.',
              text:
                "Shedding is uncomfortable; they're itchy and irritable. Post-feeding handling causes regurgitation.",
            },
          ],
        },
      ],
    },

    // 5 - UVB question
    {
      kicker: 'The UVB Question',
      title: 'The most debated topic in the hobby, settled.',
      lead: 'Not required. Strongly recommended.',
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'THE OLD VIEW (STILL TRUE)',
              tone: 'moss',
              items: [
                'Cresties SURVIVE fine without UVB.',
                'Decades of captive breeding have been successful with no UVB at all.',
                'Calcium dusting on feeders + diet-sourced D3 in CGD provides adequate metabolism for MOST geckos.',
                'This is why you\'ll see old-school breeders say "not needed."',
              ],
            },
            {
              heading: 'THE EVOLVED VIEW (ALSO TRUE)',
              tone: 'fern',
              items: [
                'Surviving ≠ thriving.',
                'Wild cresties encounter filtered UVB through forest canopy.',
                'Recent research shows low-level UVB improves immune function, color expression, and calcium metabolism.',
                'Breeding females and MBD recovery benefit dramatically.',
                'For long-term health: add it.',
              ],
            },
          ],
        },
      ],
    },

    // 6 - UVB specifics
    {
      kicker: 'UVB Specifics',
      title: "If you're going to do it, do it right.",
      lead:
        'A badly implemented UVB setup is worse than none at all. Here are the specifics most care sheets skip.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Bulb type',
              title: 'Linear T5/T8, NOT compact coil',
              text: 'Coil bulbs concentrate UV in a narrow beam and can damage eyes.',
            },
            {
              meta: 'Strength',
              title: '2.0 or Arcadia Shade Dweller',
              text:
                'Cresties are forest-floor animals. 5.0 and above is too strong for this species.',
            },
            {
              meta: 'Distance',
              title: '8-12 inches from highest perch',
              text: 'The gecko needs to be able to get close OR retreat to full shade.',
            },
            {
              meta: 'Photoperiod',
              title: '6-8 hours per day, timer-controlled',
              text: 'NOT 12. Excessive exposure stresses nocturnal eyes over time.',
            },
            {
              meta: 'Replacement',
              title: 'Every 6-12 months (per manufacturer)',
              text: 'UV output decays before the visible light dims. Mark your calendar.',
            },
            {
              meta: 'Shade',
              title: 'Heavy foliage across 60%+ of enclosure',
              text: 'The gecko must always be able to escape UV. Zero exceptions.',
            },
          ],
        },
      ],
    },

    // 7 - Cohabitation
    {
      kicker: 'Cohabitation',
      title: 'The single biggest misconception in the hobby.',
      lead: 'Crested geckos are solitary. Full stop.',
      blocks: [
        {
          type: 'callout',
          tone: 'warn',
          text:
            'The pet-store myth that "two is better" has caused more dead geckos than almost any other piece of bad advice. Here\'s the truth.',
        },
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'NEVER',
              tone: 'ruby',
              title: 'Male + Male',
              text: 'They will fight to the death. Not "sometimes fight." Always fight.',
            },
            {
              meta: 'NO',
              tone: 'ruby',
              title: 'Male + Female (not breeding)',
              text:
                "Constant harassment; female stops eating and dies over months. The male doesn't know breeding season is over.",
            },
            {
              meta: 'RISKY',
              tone: 'amber',
              title: 'Female + Female',
              text:
                'Occasionally works in large enclosures with same-size females. One usually bullies. No benefit to the gecko - just stress.',
            },
            {
              meta: 'NO',
              tone: 'ruby',
              title: 'Hatchlings together',
              text:
                'Tail-biting, competition for food, failure to thrive. Separate immediately once sexing is possible.',
            },
          ],
        },
      ],
    },

    // 8 - Sexing
    {
      kicker: 'Sexing',
      title: 'Boy or girl: when and how you can tell.',
      lead:
        "You can't reliably sex a hatchling. Anyone who claims to is guessing. Here's the actual timeline and methodology.",
      blocks: [
        {
          type: 'ladder',
          items: [
            { badge: '0-3 mo', tone: 'ruby', title: 'NO', text: 'Physically impossible to sex. Ignore anyone who claims to know.' },
            { badge: '3-5 mo', tone: 'coral', title: 'NO', text: 'Pre-pores may start forming on males, but not reliably visible.' },
            { badge: '5-8 mo', tone: 'amber', title: 'MAYBE', text: 'With a 10x+ jeweler\'s loupe, pre-pores visible on males. Still unreliable.' },
            { badge: '8-12 mo', tone: 'moss', title: 'USUALLY', text: 'Hemipenal bulge becomes visible in males. Females stay flat. ~85% accuracy.' },
            { badge: '12+ mo', tone: 'fern', title: 'YES', text: 'Clear bulge on males; clear lack on females. Nearly 100% accurate.' },
          ],
        },
      ],
    },

    // 9 - Bioactive vs paper towel
    {
      kicker: 'Bioactive',
      title: 'Paper towel vs. bioactive: which is actually better?',
      lead:
        "Bioactive enclosures look incredible and require less cleaning - but they're NOT better for every gecko or every keeper. Here's when each makes sense.",
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'CHOOSE PAPER TOWEL IF...',
              tone: 'fern',
              items: [
                'Your gecko is a hatchling or juvenile under 15g',
                'Gecko is a new arrival (quarantine period)',
                'Currently troubleshooting feeding or health',
                'You want to observe every poop and shed',
                "You're new to the hobby - start here",
                'The gecko came from an unknown source',
              ],
            },
            {
              heading: 'CHOOSE BIOACTIVE IF...',
              tone: 'moss',
              items: [
                'Adult gecko, fully settled, proven healthy',
                'You have 3+ months keeping experience',
                'You want a display-grade enclosure',
                "You're committed to plant care and misting",
                'Budget for CUC (isopods + springtails)',
                "You're okay with harder poop monitoring",
              ],
            },
          ],
        },
      ],
    },

    // 10 - Bioactive build layers
    {
      kicker: 'Bioactive Build',
      title: 'The layers of a working bioactive enclosure.',
      lead:
        "From the bottom up, here's what each layer does. Skip or substitute any of these and the system breaks down.",
      blocks: [
        {
          type: 'ladder',
          items: [
            {
              badge: '1.5-2"',
              tone: 'neutral',
              title: 'Drainage layer',
              text:
                'Hydroballs, LECA, or lava rock. Excess water drains here, prevents root rot and anaerobic bacteria.',
            },
            {
              badge: '1 sheet',
              tone: 'neutral',
              title: 'Substrate barrier',
              text: 'Mesh screen. Keeps soil from washing into the drainage layer. Cut to fit exactly.',
            },
            {
              badge: '3-4"',
              tone: 'moss',
              title: 'Live soil',
              text:
                'ABG mix or organic topsoil + coco fiber. Hosts microfauna and plant roots. NO fertilizers, NO perlite.',
            },
            {
              badge: 'Thin',
              tone: 'moss',
              title: 'Leaf litter + moss',
              text:
                'Magnolia or oak leaves + sphagnum/sheet moss. Holds humidity; feeds isopods; hides CUC.',
            },
            {
              badge: 'Living',
              tone: 'fern',
              title: 'Plants + CUC',
              text:
                'Pothos, bromeliads, ferns. Springtails (mold control) + dwarf white isopods (waste decomp). Seed 2 weeks before gecko.',
            },
          ],
        },
      ],
    },

    // 11 - Plant selection
    {
      kicker: 'Plant Selection',
      title: 'What to put in - and what never to.',
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'GECKO-SAFE',
              tone: 'fern',
              items: [
                'Pothos (Epipremnum) - the default. Hardy, low-light, climbs.',
                'Bromeliads (Neoregelia) - water-holding cups. Native-mimic aesthetic.',
                'Snake plant (Sansevieria) - dry-tolerant, strong vertical lines.',
                'Ficus pumila (creeping fig) - covers walls and backgrounds beautifully.',
                'Maranta (prayer plant) - broad leaves, daily movement.',
                'Orchids (jewel / phalaenopsis) - advanced, but stunning visual payoff.',
                'Peperomia varieties - compact, easy, huge range of textures.',
                "Ferns (Boston, bird's nest) - humidity-loving, fills dense canopy.",
              ],
            },
            {
              heading: 'NEVER USE',
              tone: 'ruby',
              items: [
                'Dieffenbachia - contains calcium oxalates; severe toxicity if chewed.',
                'Philodendron (most) - similar toxicity profile to dieffenbachia.',
                'Oleander, azalea, lily - fatal to almost all animals. Never.',
                'Spiky / thorny plants - cactus, agave; risk of eye or foot injury.',
                'Plants treated with pesticides - big-box nursery plants are usually treated. Rinse thoroughly OR buy from a reptile-safe nursery.',
                'Fertilized potting soil - systemic chemicals persist in soil for months.',
                'Pothos marble/NEON variegated - higher oxalate concentration than green. Use green pothos.',
                'Anything with milky sap - default rule when unsure; if it bleeds white, skip it.',
              ],
            },
          ],
        },
      ],
    },

    // 12 - Upgrade path
    {
      kicker: 'Upgrade Path',
      title: 'When to size up (and when to resist).',
      lead:
        'The rookie mistake: buying an adult-size enclosure for a hatchling "so they can grow into it." Geckos don\'t grow into enclosures. They get lost in them.',
      blocks: [
        {
          type: 'ladder',
          items: [
            {
              badge: '6qt tub',
              tone: 'neutral',
              title: '1-8g · Hatchling',
              text: 'Paper towel, fake leaves, food within inches. Monitor eating and pooping closely.',
            },
            {
              badge: 'Med KK',
              tone: 'moss',
              title: '5-15g · Young juvenile',
              text: 'Slightly more space, same simplicity. Still paper towel substrate.',
            },
            {
              badge: '12×12×18',
              tone: 'moss',
              title: '12-25g · Juvenile',
              text: 'First "real" enclosure. Can introduce live plants if they\'re confident eaters.',
            },
            {
              badge: '18×18×24',
              tone: 'fern',
              title: '25g+ · Sub-adult to adult',
              text: 'The long-term home. Bioactive viable here. Height matters more than width.',
            },
            {
              badge: '24×18×24+',
              tone: 'fern',
              title: '35g+ · Premium adult',
              text: 'Overkill for ONE gecko, but beautiful display. Some geckos prefer smaller; watch behavior.',
            },
          ],
        },
      ],
    },

    // 13 - Bad advice
    {
      kicker: 'Bad Advice',
      title: 'Common pet-store misinformation, ranked.',
      lead:
        'Not all pet-store staff are wrong, but the chain-store default advice is consistently bad. Here are the five pieces of advice to ignore immediately.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'HIGH',
              tone: 'amber',
              title: '"A 10-gallon tank is fine for life."',
              text: 'Adults need 18×18×24 minimum. 10 gallons is for tiny hatchlings only.',
            },
            {
              meta: 'HIGH',
              tone: 'amber',
              title: '"You can keep two together for company."',
              text:
                'Cresties are solitary. Almost every cohab attempt ends in injury, stress, or death.',
            },
            {
              meta: 'HIGH',
              tone: 'amber',
              title: '"Mealworms are a great staple."',
              text:
                'Mealworms have hard chitin that can cause impaction. CGD is the staple; insects are a sometimes-treat.',
            },
            {
              meta: 'CRITICAL',
              tone: 'ruby',
              title: '"They need heat lamps to survive."',
              text:
                'Room temp (72-78°F) is ideal. Heat lamps often push enclosures past the fatal 82°F threshold.',
            },
            {
              meta: 'CRITICAL',
              tone: 'ruby',
              title: '"Sand or wood chips are good substrate."',
              text:
                'Both cause impaction. Sand is literally deadly. Use paper towel or bioactive soil only.',
            },
          ],
        },
      ],
    },

    // 14 - Healthy baseline
    {
      kicker: 'Healthy Baseline',
      title: 'What a healthy gecko actually looks like.',
      lead:
        "Knowing what NORMAL looks like is the foundation for spotting what's not. If you can't answer these, you can't detect health issues early.",
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              title: 'Eyes',
              text: 'Clear, equal size, bright. No discharge, no crust. They blink (via licking) frequently.',
            },
            {
              title: 'Poop',
              text: 'Brown pellet + white urates. Consistent shape. No blood, no mucus, no runny.',
            },
            {
              title: 'Tail',
              text: 'Straight when resting. No wavy kinks. Fat base (stored fat reserve).',
            },
            {
              title: 'Body',
              text:
                'Solid, stocky build. No visible pelvic bones or rib outline. Slightly pudgy in adults.',
            },
            {
              title: 'Skin',
              text: 'Smooth, no patches of stuck shed, no mites, no open wounds or sores.',
            },
            {
              title: 'Behavior',
              text:
                'Alert when disturbed. Sticks firmly to surfaces. Responds to movement with head tracking.',
            },
          ],
        },
      ],
    },

    // 15 - Color changes
    {
      kicker: 'Color Changes',
      title: 'Fire-up and fire-down, decoded.',
      lead:
        "The same gecko can look completely different morning to night. This isn't disease, mood, or magic - it's biology. Here's how it works and what it means.",
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'FIRED UP · Vivid, saturated, bright',
              tone: 'coral',
              items: [
                'Active period (dusk, early night)',
                'Warm ambient temperatures',
                'Alarm or excitement',
                'Post-feeding',
                'Handling stress',
              ],
            },
            {
              heading: 'FIRED DOWN · Muted, washed-out, pale',
              tone: 'moss',
              items: [
                'Daytime rest period',
                'Cooler temperatures',
                'Calm, safe, hidden',
                'Sleep mode',
                'Post-stress recovery',
              ],
            },
          ],
        },
      ],
    },

    // 16 - Weird behaviors
    {
      kicker: 'Weird Behaviors',
      title: "Things that look wrong but usually aren't.",
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: '"It sits in the same spot for 12 hours."',
              text:
                "Daytime sleep. Cresties lock onto a safe perch and stay there. They're not dead - touch a branch to check.",
            },
            {
              title: '"It stares at me from across the room."',
              text: 'Motion detection. They track anything moving. Not affection, but not threat either.',
            },
            {
              title: '"It leapt from my hand across the room!"',
              text:
                'Leap-of-faith instinct. Cresties are arboreal and use skin flaps to glide. They can land accurately 6+ feet.',
            },
            {
              title: '"It\'s been in the water dish for 10 minutes."',
              text:
                'Hydration or pre-shed soak. Rare but not abnormal. If constant, check humidity levels.',
            },
            {
              title: '"It chirped at me!"',
              text:
                "Startle vocalization. Common in juveniles. Harmless - they'll grow out of it.",
            },
            {
              title: '"It closed its eyes while I held it."',
              text:
                'Stress sign, NOT comfort. They close eyes to block sensory input when overwhelmed. Put them back.',
            },
          ],
        },
      ],
    },

    // 17 - Shedding
    {
      kicker: 'Shedding',
      title: 'What actually happens, and why you rarely see it.',
      lead:
        'Cresties eat their own shed - a nutrient recovery strategy and an anti-predator scent cleanup. This is why 90% of sheds happen without you noticing.',
      blocks: [
        { type: 'heading', text: 'How often' },
        {
          type: 'kv',
          rows: [
            { label: 'Hatchlings', value: 'Every 7-14 days' },
            { label: 'Juveniles (3-12 mo)', value: 'Every 2-3 weeks' },
            { label: 'Young adults (1-2 yr)', value: 'Every 3-4 weeks' },
            { label: 'Adults (2+ yr)', value: 'Every 4-8 weeks' },
            { label: 'Seniors (5+ yr)', value: 'Every 6-10 weeks' },
          ],
        },
        { type: 'heading', text: 'Stuck shed - watch for' },
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              tone: 'ruby',
              title: 'TOES - most critical',
              text: 'Retained shed constricts blood flow. Can cost them toes or a foot. Check every shed cycle.',
            },
            {
              tone: 'amber',
              title: 'Tail tip',
              text: 'Common in low humidity. Similar constriction risk.',
            },
            {
              tone: 'amber',
              title: 'Around eyes',
              text: 'Rare but serious - can impair vision.',
            },
            {
              tone: 'fern',
              title: 'To remove',
              text: "15-min warm water soak, then gentle q-tip roll. Never pull hard. Vet if it won't budge.",
            },
          ],
        },
      ],
    },

    // 18 - Real life (moves, 15-year commitment)
    {
      kicker: 'Real Life',
      title: 'Moving, vacations, and the 15-year commitment.',
      lead:
        "Cresties outlast most relationships, apartments, and jobs. Planning for the long haul isn't optional.",
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: 'Moving house',
              text:
                'Short moves: bring the enclosure intact, gecko inside, in the car. Long moves: transport gecko in a secure deli cup with paper towel; set up enclosure first at destination.',
            },
            {
              title: 'Vacations 1-2 weeks',
              text:
                "Mostly fine. Sitter visits every 2-3 days for mist + fresh food. Not many pets are this travel-friendly.",
            },
            {
              title: 'The 15-year timeline',
              text:
                'Your gecko will outlive several phones, probably a car, maybe a relationship. Plan for temperature-controlled housing for 2 decades.',
            },
            {
              title: 'Rehoming ethically',
              text:
                "If life changes and you need to rehome: reach out to the original breeder first, then local reptile rescues, then morph-matching forums. NEVER release - they're non-native everywhere.",
            },
          ],
        },
      ],
    },

    // 19 - Myth busting
    {
      kicker: 'Myth Busting',
      title: "Quick-hit: what's actually true.",
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'FALSE',
              tone: 'ruby',
              title: 'They need heat lamps.',
              text: 'Room temp is perfect. Heat kills more than cold in this species.',
            },
            {
              meta: 'KIND OF',
              tone: 'amber',
              title: "They'll bond with you.",
              text: "They recognize your scent and stop fleeing. That's the extent of it.",
            },
            {
              meta: 'FALSE',
              tone: 'ruby',
              title: 'Pet store pairs are bonded.',
              text: "They're stressed, not bonded. Separate immediately.",
            },
            {
              meta: 'FALSE',
              tone: 'ruby',
              title: 'They hibernate in winter.',
              text: 'They slow down slightly. True brumation is uncommon in captivity.',
            },
            {
              meta: 'N/A',
              tone: 'neutral',
              title: 'Regrown tails look the same.',
              text: 'Cresties don\'t regrow tails. "Frog butts" are permanent.',
            },
            {
              meta: 'FALSE',
              tone: 'ruby',
              title: 'Two females = no eggs.',
              text: 'Females lay infertile eggs regardless of partner. Genetic, not triggered.',
            },
            {
              meta: 'FALSE',
              tone: 'ruby',
              title: 'All bites break skin.',
              text: "Crestie bites feel like a pinch. They can't really hurt you.",
            },
            {
              meta: 'PARTIAL',
              tone: 'amber',
              title: 'UVB burns their eyes.',
              text: 'Wrong strength/distance can. Correct 2.0 setup is fine.',
            },
          ],
        },
      ],
    },

    // 20 - Three tiers (author contribution)
    {
      kicker: 'My Contribution',
      title: 'The three tiers of keeping.',
      lead:
        "Most care debates come from conflating these. What's right for a tier-1 keeper is overkill for tier-3 and underperformance for tier-2.",
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'TIER 1',
              tone: 'moss',
              title: 'The Survivor',
              text:
                'Paper towel, room temp, CGD, no UVB. Gecko will live its full lifespan. No frills.',
              footer: 'When · New keepers, troubleshooting, quarantine, budget constraints',
            },
            {
              meta: 'TIER 2',
              tone: 'fern',
              title: 'The Comfortable',
              text:
                'Bioactive or naturalistic, low-level UVB, multi-flavor CGD rotation, weight logging. Gecko thrives.',
              footer: 'When · Most established keepers. The sweet spot.',
            },
            {
              meta: 'TIER 3',
              tone: 'amber',
              title: 'The Optimized',
              text:
                'Custom build, programmed misting, species-specific UVB, gutloaded dubias, vet relationship, weight tracking.',
              footer: 'When · Breeders, collectors, perfectionist hobbyists.',
            },
          ],
        },
      ],
    },

    // 21 - Series links
    {
      kicker: 'The Series',
      title: "Where to go next in the Keeper's Guide.",
      lead:
        'This handbook answers the everyday questions. For specific situations - trouble, new hobby directions, or going pro - the other guides go deep.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'New gecko arriving',
              title: 'Setup & First 30 Days',
              text:
                'The companion to this handbook. Pre-arrival prep, day-one protocol, and the 30-day checkpoint.',
            },
            {
              meta: 'Appetite problems',
              title: 'Feeding Troubleshooting',
              text:
                'The panic guide. Diagnostic framework, life-stage nuances, red flags, vet triage, and assist-feeding.',
            },
            {
              meta: 'Looking at new geckos or morphs',
              title: 'Morph & Genetics Guide',
              text:
                'Understanding what you have, reading listings, predicting offspring, and the genetics behind the hype.',
            },
            {
              meta: 'Ready to breed',
              title: 'Complete Breeding Guide',
              text:
                "Pair selection through hatchling placement. Including the parts first-time breeders don't see coming.",
            },
          ],
        },
      ],
    },

    // 22 - Closing
    {
      layout: 'closing',
      kicker: 'The Principle',
      title: 'Observe more than you interact.',
      lead:
        "The keepers who raise the healthiest geckos are the ones who watch carefully and intervene rarely. Almost everything a crested gecko does has a reason - most of them don't require you to do anything about it.",
      blocks: [
        {
          type: 'callout',
          tone: 'info',
          text:
            "When in doubt: mist, wait, and watch. You'll learn more from a week of observation than from a month of online advice.",
        },
      ],
    },
  ],
};
