/**
 * Guide 05 — Complete Breeding Guide
 *
 * The full arc from deciding if you should breed through hatchling
 * placement.
 *
 * Keep this file dependency-free (no JSX, no imports).
 */

export const BREEDING_GUIDE = {
  id: 'breeding',
  number: '05',
  title: 'Complete Breeding Guide',
  shortTitle: 'Breeding',
  description:
    "The full arc from deciding if you should breed through hatchling placement. Includes conditioning, pair selection, lay box setup, incubation, hatchling care, and the unexpected chapter: losses, burnout, legal/tax realities, and where babies actually go.",
  slides: [
    // 1 - Hero
    {
      layout: 'hero',
      kicker: "The Keeper's Guide Series",
      title: 'So you want to breed.',
      lead:
        "Everything from \"should I even do this\" through hatchling placement. The full arc - including the parts first-time breeders don't see coming until it's too late.",
      tags: ['Decide', 'Prep', 'Intro', 'Lay', 'Incubate', 'Hatch', 'Real'],
    },

    // 2 - Should you breed
    {
      kicker: 'Step Zero',
      title: 'Should you actually breed?',
      lead:
        'Before any of the rest matters, an honest gut check. Breeding cresties is rewarding - and also expensive, emotionally draining, and creates lives you\'re responsible for placing. Not everyone should do it.',
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'GOOD REASONS',
              tone: 'fern',
              items: [
                'You want to work toward a specific morph project',
                'You have dedicated homes lined up for offspring',
                "You've kept cresties 2+ years and understand them",
                'You have space for 20+ separate hatchling enclosures',
                'You can absorb losses (financial AND emotional)',
                "You're willing to do it for 5+ years to get good",
              ],
            },
            {
              heading: 'BAD REASONS',
              tone: 'ruby',
              items: [
                '"To make my money back on the gecko"',
                '"The kids want to see babies"',
                '"It seems easy / low-effort"',
                '"I\'ll sell everything on Craigslist"',
                "You have one pair and haven't done research",
                '"Just one clutch to see what happens"',
              ],
            },
          ],
        },
      ],
    },

    // 3 - Economics
    {
      kicker: 'The Economics',
      title: 'Honest math on breeding income.',
      lead:
        "Most keepers overestimate income and underestimate costs. Here's a realistic picture of a hobbyist's first-year breeding numbers with one pair.",
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'COSTS (FIRST YEAR)',
              tone: 'ruby',
              items: [
                'Incubator + thermostat · $100-$250',
                'Incubation medium + deli cups · $30-$60',
                '10+ hatchling enclosures + gear · $300-$600',
                'Extra CGD, calcium, pollen · $100-$200',
                'Vet visit (female health) · $75-$150',
                'Shipping supplies · $50-$100',
                'Losses (3-5 bad eggs + 1-2 fatalities) · real but not cash',
                'TOTAL · $655-$1,360',
              ],
            },
            {
              heading: 'REVENUE (FIRST YEAR)',
              tone: 'moss',
              items: [
                'Female lays ~6 clutches (2 eggs each) · 12 eggs',
                'Hatch rate (first year) · 60-75%',
                'Realistic hatchlings raised to sale · 6-8',
                'Typical mid-tier price per baby · $75-$200',
                'Gross revenue · $450-$1,600',
                'NET AFTER COSTS · −$200 to +$240',
              ],
            },
          ],
        },
      ],
    },

    // 4 - Pair selection
    {
      kicker: 'Pair Selection',
      title: 'The decision that determines everything else.',
      lead:
        'A good pair produces for years. A bad pair produces health problems, weak offspring, or no offspring at all. What to check before committing.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              tone: 'fern',
              title: 'FEMALE WEIGHT ≥ 40g',
              text:
                'Non-negotiable minimum. Below 40g and the female lacks reserves to produce eggs without depleting herself dangerously.',
            },
            {
              tone: 'fern',
              title: 'FEMALE AGE ≥ 18 MONTHS',
              text:
                'Even if she hits 40g faster, wait until 18 months. Her calcium system needs that time to mature. Best results at 2 years.',
            },
            {
              tone: 'fern',
              title: 'MALE WEIGHT ≥ 35g AND AGE ≥ 12 MONTHS',
              text:
                'Males mature faster but breeding too early produces infertile clutches. Wait.',
            },
            {
              tone: 'moss',
              title: 'BOTH PROVEN HEALTHY',
              text:
                'Recent fecal clean. No history of prolapse, MBD, respiratory issues. Both eating reliably.',
            },
            {
              tone: 'moss',
              title: 'UNRELATED BLOODLINES',
              text:
                'If sold as "unrelated," verify with the breeder. Inbreeding produces weak offspring fast. Ask for lineage paperwork.',
            },
            {
              tone: 'moss',
              title: 'COMPATIBLE MORPH GOALS',
              text:
                "Be clear on what offspring you're working toward. Pairing for no reason = random babies you can't market.",
            },
          ],
        },
      ],
    },

    // 5 - Conditioning
    {
      kicker: 'Conditioning',
      title: 'Pre-season prep: 6-8 weeks before introducing.',
      lead:
        'A breeding female will lose 10-15% of her body weight across the season. Start conditioning early so she enters with reserves to spare.',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Up the calcium',
              text:
                "High-calcium CGD daily. Add a calcium dish (plain calcium without D3, accessible anytime). She'll eat from it as needed.",
            },
            {
              title: 'Max her weight',
              text:
                'Goal: 45-55g entering season. Extra feeder insects if she accepts. Bee pollen added to CGD for extra nutrition.',
            },
            {
              title: 'Final health check',
              text:
                'Vet fecal float. Check her calcium sacs (back of mouth - should be plump and pink). Any concerns = skip this season.',
            },
            {
              title: 'Stabilize husbandry',
              text:
                "Lock in temps, humidity, photoperiod. Don't change the enclosure during breeding - familiar environment matters.",
            },
            {
              title: 'Prep your infrastructure',
              text:
                'Lay box ready. Incubator running and dialed for 2 weeks. Incubation medium tested. Hatchling enclosures sitting ready.',
            },
            {
              title: 'Choose your male',
              text:
                "If you've been keeping pairs separately, decide now which male pairs with which female. Males cycle in 2-3 week rotations across multiple females.",
            },
          ],
        },
      ],
    },

    // 6 - Introduction
    {
      kicker: 'The Introduction',
      title: 'Pairing the male and female.',
      lead:
        "You can pair for a season or year-round - both work. The year-round approach is simpler. Here's the protocol for introducing for the first time.",
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: "Put the male in the female's enclosure.",
              text:
                'Not hers into his. Her territory means less stress for her. Supervise the first 30 minutes actively.',
            },
            {
              title: 'Watch for vocalizations.',
              text:
                'Males often bark, chirp, or "chase" females briefly. Normal. If the female hides and stays hidden for days, extract and retry later.',
            },
            {
              title: 'Expect copulation within 24-72 hours.',
              text:
                'You may or may not see it. Cresties mate quickly and at night. Absence of evidence ≠ evidence of absence.',
            },
            {
              title: 'Monitor for bullying.',
              text:
                'Male should NOT be constantly pursuing. If female is visibly stressed or losing weight after 1 week, separate immediately.',
            },
            {
              title: 'Decide: leave together or separate.',
              text:
                'Year-round cohab simplifies things but can stress the female. Most breeders rotate - male with each female for 2-3 weeks.',
            },
          ],
        },
      ],
    },

    // 7 - Cooling debate
    {
      kicker: 'The Cooling Debate',
      title: 'Do you need a winter rest period?',
      lead: 'Not required - but a rest period helps.',
      blocks: [
        {
          type: 'compare',
          columns: [
            {
              heading: 'THE COMMERCIAL VIEW',
              tone: 'fern',
              items: [
                'Keep pairs together year-round.',
                'Major breeders (AC Reptiles, NEHERP) keep pairs together year-round at stable temps.',
                'They report excellent fertility and healthy females.',
                'Females self-regulate how many clutches they produce.',
              ],
            },
            {
              heading: 'THE HOBBYIST VIEW',
              tone: 'moss',
              items: [
                'Separate sexes Nov-Feb.',
                'For hobbyists with 1-2 pairs, a Nov-Feb separation gives the female time to rebuild calcium.',
                'Drop temps slightly (65-70°F).',
                'Smaller total egg yield per year but healthier females long-term.',
              ],
            },
          ],
        },
      ],
    },

    // 8 - Gravid female
    {
      kicker: 'Gravid Female',
      title: 'Reading the signs of an incoming clutch.',
      lead:
        "Cresties produce clutches of 2 eggs every 25-40 days during the active season. Here's how to know what stage she's in.",
      blocks: [
        {
          type: 'timeline',
          items: [
            {
              when: '0-10 days',
              label: 'Subtle weight gain',
              text:
                "She'll gain 4-6g. Not yet obviously gravid. Continue normal husbandry; monitor weight weekly.",
            },
            {
              when: '10-20 days',
              label: 'Visible eggs through belly',
              text:
                'Shine a flashlight against her side - two whitish ovals visible. Appetite still healthy.',
            },
            {
              when: '20-30 days',
              label: 'Restlessness + food refusal',
              text:
                "She'll pace, glass-surf, and explore the lay box. Eating may stop 2-5 days before laying. Normal.",
            },
            {
              when: '1-3 days pre-lay',
              label: 'Digging behavior in lay box',
              text:
                "She's testing the substrate. Should be digging in moist coco fiber, not glass. Check lay box conditions.",
            },
            {
              when: 'Laying',
              label: 'Usually overnight',
              text:
                "She'll lay 2 eggs and bury them. Usually completes overnight. Morning after - fresh eggs found.",
            },
          ],
        },
      ],
    },

    // 9 - Lay box
    {
      kicker: 'The Lay Box',
      title: 'Building a proper egg-laying container.',
      lead:
        "If you skip this, the female lays in random spots and you'll waste hours digging around. A proper lay box saves everyone's time.",
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              title: 'Container',
              text:
                'Shoebox-sized plastic tub (~6×4×4"). Cut 1-2 holes in lid big enough for her to enter.',
            },
            {
              title: 'Substrate',
              text:
                '50/50 moist coconut fiber + fir bark. 3-4 inches deep. Moist enough to hold shape when squeezed; no dripping water.',
            },
            {
              title: 'Placement',
              text:
                'On the warm side of the enclosure. Away from direct misting spray. Slightly covered with plants or foliage.',
            },
            {
              title: 'Maintenance',
              text:
                'Re-moisten every 3-4 days. Replace substrate after every laid clutch - prevents mold buildup.',
            },
            {
              title: 'Alternative: Repti Shelter',
              text:
                'Decorative hide with substrate inside. Works identically but blends into display enclosures.',
            },
            {
              title: 'Check daily during season',
              text:
                'Check for eggs EVERY morning during active season. Eggs left >48 hours may mold or desiccate depending on conditions.',
            },
          ],
        },
      ],
    },

    // 10 - Egg handling
    {
      kicker: 'Egg Handling',
      title: 'Moving fresh eggs to the incubator.',
      lead:
        'The single most common mistake: rotating eggs during transfer. Cresties are sensitive to orientation - a flipped egg can be a dead egg.',
      blocks: [
        {
          type: 'steps',
          items: [
            {
              title: 'Mark the top immediately',
              text:
                'Before moving: use a pencil (not pen) to put a small dot on the top surface as laid. This is your orientation reference forever.',
            },
            {
              title: 'Keep orientation constant',
              text:
                'Never rotate or flip. The embryo attaches to the top of the yolk; rotation can detach it and cause death within hours.',
            },
            {
              title: 'Move gently',
              text:
                'Cup them from below with your fingers. No tweezers, no pinching. Eggs are leathery, not shelled like bird eggs.',
            },
            {
              title: 'Candle if unsure',
              text:
                'Hold a phone flashlight under the egg. Fertile eggs show pink veins within 2 weeks. Infertile or dead = uniform yellow/white.',
            },
            {
              title: 'Bad eggs: when to toss',
              text:
                'Yellow, soft, mushy, or moldy = infertile or dead. Remove quickly - mold spreads to other eggs in the container.',
            },
            {
              title: 'Label everything',
              text:
                'Sharpie the deli cup with: lay date, parent IDs, expected hatch window. You WILL forget which is which after clutch 4.',
            },
          ],
        },
      ],
    },

    // 11 - Incubation
    {
      kicker: 'Incubation',
      title: 'Temperature, medium, and the low-and-slow principle.',
      lead:
        'Most incubation problems come from one of three mistakes: wrong temperature, wrong moisture, or too-frequent checking.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Temperature',
              title: '68-75°F',
              text:
                'Most reliable breeders keep it 70-72°F. Warmer = faster hatch but weaker babies. Cooler = longer wait, stronger babies.',
            },
            {
              meta: 'Medium',
              title: 'Repashy Superhatch',
              text:
                'Industry standard. Outperforms vermiculite and perlite. Pre-hydrated per package, no standing water. Half-fill deli cup.',
            },
            {
              meta: 'Humidity',
              title: '80-90%',
              text:
                'Medium should hold shape when squeezed, no dripping. Check every 2 weeks - re-mist if drying. Too wet drowns the egg.',
            },
            {
              meta: 'Hatch time',
              title: '60-120 days',
              text:
                'Wide range based on temperature. At 70°F expect ~90 days. At 75°F, ~70 days. At 68°F, 100+.',
            },
            {
              meta: 'Check frequency',
              title: 'Weekly max',
              text:
                "Open the container, look, close. Don't move eggs. Don't breathe heavily on them. Brief and gentle.",
            },
            {
              meta: 'TSD myth',
              title: 'Minimal effect',
              text:
                'Unlike leopards, crestie sex is NOT strongly temperature-dependent. Some research suggests minor skew; nothing you can reliably exploit.',
            },
          ],
        },
      ],
    },

    // 12 - Hatching
    {
      kicker: 'Hatching',
      title: 'The first 72 hours after emergence.',
      lead:
        "Hatchlings emerge unannounced, usually overnight. Here's what happens - and what NOT to do.",
      blocks: [
        {
          type: 'timeline',
          items: [
            {
              when: 'Hour 0',
              label: 'Pipping',
              text:
                'Hatchling slits the leathery shell with an egg tooth and pokes out its head. May sit this way for hours before emerging.',
            },
            {
              when: 'Hour 4-12',
              label: 'Emergence',
              text:
                'Fully out. Soft, wet, covered in shed skin. Do NOT remove from the incubation cup. Let them stay put.',
            },
            {
              when: 'Hour 24',
              label: 'First shed',
              text:
                'They shed within 24 hours of hatching and eat the shed. If the incubator is too dry, shed gets stuck. Mist the cup lightly.',
            },
            {
              when: 'Hour 48',
              label: 'Move to enclosure',
              text:
                "Transfer to a prepared hatchling tub (6qt, paper towel, fake leaves, humid hide, no food yet). They won't eat for 48-72 hours.",
            },
            {
              when: 'Hour 72',
              label: 'First meal',
              text:
                "First tiny dish of CGD. Don't expect much. They have residual yolk reserves lasting up to 5 days. Offer every night.",
            },
          ],
        },
      ],
    },

    // 13 - Hatchling care
    {
      kicker: 'Hatchling Care',
      title: 'Their first 3 months are a separate ecosystem.',
      lead:
        'Hatchlings are not "small adults." They\'re fragile, need tight environmental control, and require daily monitoring.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Enclosure',
              title: '6-10 qt tub',
              text:
                'Plastic tub with ventilation holes. Paper towel ONLY. Small fake plant, humid hide, shallow food/water dish. NO live plants or loose substrate.',
            },
            {
              meta: 'Environment',
              title: '72-76°F / 70-80%',
              text:
                'Mist twice daily - morning lighter, evening thorough. Let surfaces dry between.',
            },
            {
              meta: 'Food',
              title: 'Fresh CGD every night',
              text:
                'Thin consistency - more water than adult mix. Remove uneaten food within 24 hours. Skip feeder insects for first 4-6 weeks.',
            },
            {
              meta: 'Weigh weekly',
              title: 'Goal: 2-3g gain per month',
              text:
                "Under 1g/month = investigate. Hatchlings that don't gain in month 1 usually don't thrive.",
            },
            {
              meta: 'Watch for stuck shed',
              title: '#1 killer at this stage',
              text:
                'Hatchlings shed every 1-2 weeks. Stuck shed on toes is the #1 killer at this stage. Check feet every shed.',
            },
            {
              meta: 'Minimal handling',
              title: 'First 6 weeks - none',
              text:
                "After: 2-3 minutes max, once a week. They're fragile and jumpy at this age.",
            },
          ],
        },
      ],
    },

    // 14 - Unexpected medical
    {
      kicker: 'The Unexpected',
      title: 'Medical emergencies no one warns you about.',
      lead:
        'Every experienced breeder has a horror story. Knowing what to watch for turns emergencies into manageable situations.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: 'CRITICAL',
              tone: 'ruby',
              title: 'DYSTOCIA (egg binding)',
              text:
                'Female carries eggs past lay window. Firm distended belly, lethargy, refusing food 5+ days. Emergency vet - possible surgery. Calcium injection sometimes helps early.',
            },
            {
              meta: 'CRITICAL',
              tone: 'ruby',
              title: 'UTERINE PROLAPSE',
              text:
                'Tissue protrudes from vent after laying. Keep it moist with saline. Vet IMMEDIATELY - reduction within hours has much better outcomes.',
            },
            {
              meta: 'URGENT',
              tone: 'amber',
              title: 'CALCIUM CRASH',
              text:
                'Mid-season female suddenly weak, shaky, refusing food. Calcium sacs (back of mouth) visibly shrunken. Stop breeding, calcium supplementation, vet if severe.',
            },
            {
              meta: 'COMMON',
              tone: 'moss',
              title: 'INFERTILE FIRST CLUTCHES',
              text:
                "Totally normal for first-year females. 30-50% of first clutches are infertile. Don't assume the male is bad - just give it time.",
            },
            {
              meta: 'COMMON',
              tone: 'moss',
              title: 'FAIL-TO-THRIVE HATCHLINGS',
              text:
                "Seemingly healthy hatchling just... doesn't gain weight. Not always savable. Not always your fault. Track it, give it a month, make the hard call.",
            },
          ],
        },
      ],
    },

    // 15 - Unexpected emotional
    {
      kicker: 'The Unexpected',
      title: 'The emotional reality nobody writes about.',
      lead:
        'Breeding is a volume business. Losses happen. First-time breeders are rarely prepared for how this feels.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: 'DEAD EGGS IN THE INCUBATOR',
              text:
                "You'll find them. Moldy, yellow, mushy. Expect 20-40% loss especially first season. The science of \"normal\" doesn't make it easier to open the incubator.",
            },
            {
              title: 'HATCHLINGS THAT DIE IN EGG',
              text:
                "Fully developed, pipped, then died mid-emergence. Or emerged and didn't survive the first shed. Heartbreaking. Not preventable. Document and move on.",
            },
            {
              title: "THE ONE THAT DOESN'T THRIVE",
              text:
                "Starts strong, then stops growing. No matter what you offer. Most don't survive past 6 weeks. The ones who do have lifelong issues.",
            },
            {
              title: 'CULLING DECISIONS',
              text:
                "Animals with non-viable defects. Breeders who pretend this doesn't happen are lying. Talk to a mentor or vet about humane euthanasia if you need to.",
            },
            {
              title: 'THE PLACEMENT ANXIETY',
              text:
                'By month 4 you have 10 hatchlings to sell. Not all sell quickly. Feeding 10+ mouths while the market is slow is stressful in ways no care sheet covers.',
            },
          ],
        },
      ],
    },

    // 16 - Placement
    {
      kicker: 'Placement',
      title: 'Where the babies actually go.',
      lead:
        "Most first-year breeders massively overestimate how easy selling is. Here's where offspring realistically go.",
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: '1-3 months',
              title: 'MorphMarket',
              text:
                'The dominant online marketplace. Best for quality animals with good photos. Fee structure cuts into margins.',
            },
            {
              meta: 'Event-based',
              title: 'Local reptile expos',
              text:
                'Two tables a year, $80-$200 each. Good for moving multiple at once. Cash business, variable turnout.',
            },
            {
              meta: 'Variable',
              title: 'Your own website / social',
              text:
                'Highest margin. Requires audience-building. Slow start; compounds if you commit for 2+ years.',
            },
            {
              meta: '1-2 weeks',
              title: 'Local reptile shops (wholesale)',
              text:
                "50% of retail. Fast cash, low margin. Good for moving juveniles fast when you're overloaded.",
            },
            {
              meta: 'Varies',
              title: 'Friends of friends',
              text:
                'Emotional placements. Easy but sometimes uncertain long-term care. Vet buyers - keepers, not impulse-buyers.',
            },
            {
              meta: 'Case-by-case',
              title: 'Rescue / rehome (last resort)',
              text:
                'When nothing moves. Better than indefinite retention. Have relationships with local reptile rescues before you need them.',
            },
          ],
        },
      ],
    },

    // 17 - Legal / tax / year-two wall
    {
      kicker: 'The Long Game',
      title: 'Legal, tax, and the year-two wall.',
      blocks: [
        { type: 'heading', text: 'Legal - check your jurisdiction' },
        {
          type: 'callout',
          tone: 'info',
          text:
            'Cresties are legal in most US states but require business licenses for regular selling in some. Utah: no special reptile license required; standard business licensing applies if selling regularly.',
        },
        { type: 'heading', text: 'Sales & income tax' },
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              title: 'Sales tax',
              text:
                "If you sell >$X/year in most states, sales tax applies. MorphMarket handles this in some states; expos usually don't. Know your thresholds.",
            },
            {
              title: 'Income tax - hobby vs business',
              text:
                "The IRS distinguishes hobby (can't deduct losses) from business (can). If you're buying a $2,000 incubator, you probably want business classification. Consult a CPA.",
            },
          ],
        },
        { type: 'heading', text: 'The year-two wall' },
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'Year one',
              tone: 'fern',
              title: 'EXCITEMENT',
              text:
                "Everything is new. You post every hatchling. You learn incubation. You meet the community. You think you'll breed forever.",
            },
            {
              meta: 'Year two',
              tone: 'amber',
              title: 'THE WALL',
              text:
                'The novelty is gone. You have 15 animals, 5 clutches to process, and a slow sales month. This is when 70% of hobbyist breeders quit.',
            },
            {
              meta: 'Year three+',
              tone: 'moss',
              title: 'WHO STAYS',
              text:
                'The ones who narrowed to a specific project. Depth beats breadth. Pick one or two morphs to work and go deep.',
            },
          ],
        },
      ],
    },

    // 18 - Records
    {
      kicker: 'Records',
      title: 'The paperwork of a small breeding operation.',
      lead:
        'By year two, you will need records. By year three, you will regret not having started on day one.',
      blocks: [
        {
          type: 'checklist',
          items: [
            'Breeding log (pair, date, observed copulation)',
            'Lay log (date, eggs/clutch, lay box conditions)',
            'Incubation log (egg ID, lay date, temp, outcome)',
            'Hatchling log (hatch date, weight curve, shed cycle)',
            'Sale records (buyer contact, morph, price, date, shipping)',
            'Health log per animal (weights, sheds, vet visits)',
            'Expense log (for tax purposes, year-round)',
            'Photo archive (parents, hatchlings monthly, adults)',
          ],
        },
        {
          type: 'callout',
          tone: 'success',
          text:
            'Geck Inspect was built specifically for this. Designed by a breeder, for breeders. Tracks every field here and more.',
        },
      ],
    },

    // 19 - Failure modes (author contribution)
    {
      kicker: 'My Contribution',
      title: 'The three failure modes.',
      lead:
        'Most hobbyist breeding programs fail in year one or two. The failures cluster into three patterns. Recognize which one is happening to you - early - and you can save the program.',
      blocks: [
        {
          type: 'cards',
          cols: 3,
          items: [
            {
              meta: 'BIOLOGICAL',
              tone: 'ruby',
              title: 'THE BURNED-OUT FEMALE',
              text:
                "Sign: weight dropping 10g+ mid-season. Calcium sacs shrinking. Infertile clutches.\n\nFix: you pushed her too hard. Separate now. 3+ months recovery before considering again.",
            },
            {
              meta: 'LOGISTICAL',
              tone: 'amber',
              title: 'THE HATCHLING PILE-UP',
              text:
                "Sign: 30+ animals, can't sell fast enough, running out of enclosures and time.\n\nFix: stop pairing. Wholesale excess to a local shop. Revise expectations downward for next season.",
            },
            {
              meta: 'EMOTIONAL',
              tone: 'coral',
              title: 'THE LOSS FATIGUE',
              text:
                "Sign: dreading the incubator checks. Postponing sales. Lost the joy you started with.\n\nFix: take a full season off. Keep your breeders as pets for a year. The fire comes back OR you learn you're done.",
            },
          ],
        },
      ],
    },

    // 20 - Calendar
    {
      kicker: 'Calendar',
      title: 'A year in a hobbyist breeding program.',
      blocks: [
        {
          type: 'timeline',
          items: [
            {
              when: 'Jan-Feb',
              label: 'Rest',
              text: 'Separate pairs. Reduce feeding. Health checks. Plan pairings for the year.',
            },
            {
              when: 'Mar',
              label: 'Conditioning',
              text: 'Ramp up feeding. Weight targets. Lock husbandry. Sterilize incubation gear.',
            },
            {
              when: 'Apr',
              label: 'Introduce pairs',
              text: 'Begin season. Expect first clutches within 3-4 weeks.',
            },
            {
              when: 'May-Aug',
              label: 'Active season',
              text:
                'Clutches every 25-40 days. Daily lay box checks. Incubator cycling. Hatches begin.',
            },
            {
              when: 'Sep-Oct',
              label: 'Taper',
              text: 'Reduce pairings. Focus on hatchling care and sales. Final clutches of year.',
            },
            {
              when: 'Nov-Dec',
              label: 'Wind down',
              text:
                'Separate pairs. Last sales push. Records review. Plan adjustments for next year.',
            },
          ],
        },
      ],
    },

    // 21 - Full collection
    {
      kicker: "The Keeper's Guide Series",
      title: 'The full collection.',
      lead:
        'This guide is the culmination of the Keeper\'s Guide Series. For reference on the day-to-day, return to the earlier volumes.',
      blocks: [
        {
          type: 'cards',
          cols: 2,
          items: [
            {
              meta: '01',
              title: 'Feeding Troubleshooting',
              text: 'The diagnostic framework for any appetite issue.',
            },
            {
              meta: '02',
              title: 'Setup & First 30 Days',
              text: 'The playbook for bringing a new gecko home.',
            },
            {
              meta: '03',
              title: 'The Handbook',
              text: "Everything they don't tell you about day-to-day keeping.",
            },
            {
              meta: '04',
              title: 'Morph & Genetics',
              text: 'Understanding what you have and what comes from it.',
            },
            {
              meta: '05',
              title: 'Complete Breeding (this guide)',
              text: 'The full arc of breeding, start to honest finish.',
            },
          ],
        },
      ],
    },

    // 22 - Closing
    {
      layout: 'closing',
      kicker: 'The Principle',
      title: 'Breed less, better, longer.',
      lead:
        'Every new breeder thinks volume is the goal. The breeders who are still around in year five have almost always done the opposite - fewer pairs, more selective pairings, better record-keeping, patient placement. The hobby compounds.',
      blocks: [
        {
          type: 'callout',
          tone: 'success',
          text:
            "If you make it through your first full season with your animals healthy and your records intact, you're ahead of most people who ever tried this.",
        },
      ],
    },
  ],
};
