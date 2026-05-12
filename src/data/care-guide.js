/**
 * Crested Gecko Care Guide ,  authoritative local content.
 *
 * Source-of-truth husbandry data, structured for both UI rendering
 * and LLM consumption. Each `body` block is a plain object with a
 * `type` discriminator so a renderer (or an LLM pipeline) can walk
 * the tree without touching React.
 *
 * Keep this file dependency-free (no JSX, no imports). The UI layer
 * is in src/pages/CareGuide.jsx and src/components/careguide/*.
 *
 * Content contributions welcome ,  see CONTRIBUTING notes in the repo
 * README. Facts should be sourced from reputable keepers, published
 * husbandry references, and peer-reviewed herpetology literature.
 * Note uncertain claims as "hobby consensus" rather than stating
 * them as fact.
 */

// Block types used throughout `body` arrays:
//   { type: 'p', text }
//   { type: 'ul', items: [string] }
//   { type: 'ol', items: [string] }
//   { type: 'dl', items: [{ term, def }] }
//   { type: 'callout', tone: 'info'|'warn'|'success'|'danger', title?, items: [string] }
//   { type: 'table', headers: [string], rows: [[string]], caption? }
//   { type: 'kv', items: [{ label, value, note? }] }

export const CARE_CATEGORIES = [
  {
    id: 'overview',
    label: 'Overview',
    icon: 'info',
    tagline: 'Species facts and what to expect before you buy',
    quickFacts: [
      { label: 'Species', value: 'Correlophus ciliatus' },
      { label: 'Origin', value: 'Southern New Caledonia' },
      { label: 'Lifespan', value: '15–20 years' },
      { label: 'Adult weight', value: '35–60 g' },
      { label: 'Adult length', value: '7–10 in (SVL+tail)' },
      { label: 'Activity', value: 'Nocturnal, arboreal' },
      { label: 'Difficulty', value: 'Beginner-friendly' },
    ],
    sections: [
      {
        id: 'species-background',
        title: 'About the crested gecko',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Crested geckos (Correlophus ciliatus, formerly Rhacodactylus ciliatus) are a medium-sized arboreal gecko native to a small range of humid forests in southern New Caledonia. They were thought extinct for most of the 20th century until a 1994 rediscovery, and now form one of the most successful reptile hobbies in the world.',
          },
          {
            type: 'p',
            text: 'They are beginner-friendly because they tolerate room temperatures, eat a shelf-stable powdered diet, do not require UVB for long-term survival, and breed reliably in captivity. Adults top out around 35–60 grams and live 15–20 years with good husbandry.',
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Why the crest?',
            items: [
              'The eyelash-like crest running from eye to tail-base is the species signature trait and the reason for both the common name and the species epithet "ciliatus" (Latin: "eyelashed").',
              'The structure of the crest is heritable and has been amplified through selective breeding ,  soft-scale, white-wall, and super-crest lines all modify it.',
            ],
          },
        ],
      },
      {
        id: 'before-you-buy',
        title: 'Before you buy',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'A healthy crested gecko is a 15–20 year commitment. Before purchasing, confirm your setup works and that you can realistically provide daily misting, food replacement every 2–3 days, and travel coverage when you are away.',
          },
          {
            type: 'ul',
            items: [
              'Buy from a breeder who weighs and dates every animal. Hatchlings under 3 grams should generally stay with the breeder until they gain mass.',
              'Ask for the hatch date, current weight, last-fed date, last shed, and sire/dam morph details. Keep a copy with your records.',
              'Avoid "rescue" impulse buys unless you have an experienced reptile vet lined up ,  husbandry-damaged geckos are a hard first project.',
              'Expect 1 week of no handling after arrival. Acclimation is the single most common step new keepers skip.',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Red flags when buying',
            items: [
              'Sunken fat pads on the pelvis, visible hip bones, or a thin tail base ,  signs of underweight or illness.',
              'Kinked spine or tail, swollen jaw (possible MBD), stuck shed on toes or tail tip.',
              'A seller who cannot tell you the hatch date or current weight.',
              'Wild-caught imports ,  crested geckos are captive-bred only; any "wild-caught" claim is either false or illegal.',
            ],
          },
        ],
      },
      {
        id: 'sexing',
        title: 'Sexing a crested gecko',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'Crested geckos can usually be sexed at 15–25 grams of healthy weight, well before breeding size. Males develop a visible hemipenal bulge at the vent and preanal pores; females do neither.',
          },
          {
            type: 'ul',
            items: [
              'Males: obvious bulge beneath the vent when viewed from below, plus a row of preanal pores that become visible as dots or specks forward of the vent.',
              'Females: smooth vent area, no pore row, narrower tail base.',
              'Sexing below 10 g is unreliable and should not drive a purchase decision. Ask the breeder to re-check if you buy young.',
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            items: [
              'Hobby tip: photograph the vent with a phone macro lens and zoom in rather than trying to eyeball it while the animal is squirming.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'housing',
    label: 'Housing',
    icon: 'home',
    tagline: 'Enclosure size, substrate, plants, lighting, climate',
    quickFacts: [
      { label: 'Adult enclosure', value: '18×18×24 in minimum (vertical)' },
      { label: 'Temperature', value: '72–78°F (22–25°C)' },
      { label: 'Night temp', value: '65–72°F (18–22°C)' },
      { label: 'Humidity', value: '60–80% (spike to 100% at night)' },
      { label: 'Lighting', value: 'Low UVB optional, 12h photoperiod' },
      { label: 'Ventilation', value: 'Front + top cross-flow' },
    ],
    sections: [
      {
        id: 'enclosure-size',
        title: 'Enclosure size by life stage',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Crested geckos are arboreal ,  they use vertical height far more than floor space. Size the enclosure to the animal, not to a fixed minimum. Hatchlings in an oversized setup get lost, stop eating, and lose weight.',
          },
          {
            type: 'table',
            headers: ['Life stage', 'Weight', 'Enclosure', 'Notes'],
            rows: [
              ['Hatchling', '0–8 g', '6-qt tub or small Kritter Keeper', 'Deli cup of CGD + moss + small branches. Easy to monitor feeding.'],
              ['Juvenile', '8–20 g', '12×12×18 in glass terrarium', 'Introduce height. Fake or live plants for cover.'],
              ['Sub-adult', '20–35 g', '18×18×18 in', 'Optional intermediate step ,  or skip straight to adult sizing.'],
              ['Adult', '35 g+', '18×18×24 in minimum', 'Larger (24×18×36 in) is always better. Do not house adults together.'],
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'One gecko per enclosure',
            items: [
              'Do not cohabitate males ,  they will fight, sometimes to the death, once sexually mature.',
              'Do not house males and females together outside of a controlled breeding project. Females can be bred to exhaustion.',
              'Female-only pairs are possible but often still result in stress, tail drops, and uneven feeding. Most experienced keepers house solo.',
            ],
          },
        ],
      },
      {
        id: 'substrate',
        title: 'Substrate and bioactive',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'The goal of substrate is humidity buffering plus safety. Two valid approaches: a simple cleanable setup with paper towel or tile, or a bioactive vivarium with drainage layer, ABG mix, leaf litter, and a springtail/isopod cleanup crew.',
          },
          {
            type: 'dl',
            items: [
              { term: 'Paper towel', def: 'Cheapest, cleanest, easiest to quarantine. Best choice for hatchlings and any sick or new animal.' },
              { term: 'Coco fiber / coco coir', def: 'Holds humidity well. Safe if the animal does not eat large chunks. Avoid dust-fine peat.' },
              { term: 'ABG mix (bioactive)', def: 'Atlanta Botanical Garden mix ,  bark, charcoal, peat, sphagnum. Long-term solution with live plants and a cleanup crew.' },
              { term: 'Tile or PVC sheet', def: 'Used by high-volume breeders. Zero humidity buffer, requires daily misting.' },
            ],
          },
          {
            type: 'callout',
            tone: 'danger',
            title: 'Substrates to avoid',
            items: [
              'Sand, calcium sand, walnut shell ,  impaction risk, no humidity benefit, marketed dishonestly.',
              'Cedar or pine shavings ,  aromatic oils are toxic to reptiles.',
              'Reptile carpet ,  traps claws, harbors bacteria, frays into threads that wrap toes.',
            ],
          },
        ],
      },
      {
        id: 'temperature',
        title: 'Temperature and heating',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Crested geckos thrive at room temperature. Ambient in the 72–78°F (22–25°C) range is ideal, with a slight nighttime drop to 65–72°F (18–22°C). Most homes never need supplemental heat; in fact, overheating is a far more common killer than cold.',
          },
          {
            type: 'ul',
            items: [
              'Above 82°F (28°C): acute stress. Appetite loss, lethargy, gaping. Sustained exposure is fatal.',
              'Below 65°F (18°C): slows digestion. Brief dips are fine and even healthy; sustained cold halts feeding.',
              'Use a low-wattage DHP (deep heat projector) on a thermostat if your home runs below 68°F. Never use an unregulated heat bulb or pad.',
              'Place a digital thermometer at the warmest and coolest points of the enclosure and verify with a temp gun weekly.',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'The 82°F rule',
            items: [
              'Ambient temperatures above 82°F are one of the most common causes of keeper-inflicted death in this species.',
              'In summer, move the enclosure away from windows and use a fan on the room. A portable AC is cheaper than a replacement gecko.',
            ],
          },
        ],
      },
      {
        id: 'humidity',
        title: 'Humidity and misting',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Crested geckos need a humidity cycle: high at night (80–100%) when they are active, dropping back to 50–70% during the day. A flatline at 90% breeds mold and respiratory infections; a flatline at 40% causes stuck sheds.',
          },
          {
            type: 'ol',
            items: [
              'Heavy mist 30 minutes before lights-out. The cage should be visibly wet and fogged.',
              'Allow humidity to drop back to 50–70% within a few hours. Cross-ventilation matters here.',
              'Light mist or none in the morning if the cage is still damp. Over-misting is a common mistake.',
              'Provide a shallow water dish ,  not because they drink from it often, but because it buffers humidity and some animals do use it.',
            ],
          },
          {
            type: 'dl',
            items: [
              { term: 'Hand sprayer', def: 'Works fine for 1–2 animals. Cheap, reliable, and forces daily eyes-on inspection.' },
              { term: 'Automatic mister (MistKing, Exo-Terra Monsoon)', def: 'Best for collections of 3+ or for keepers who travel. Must be combined with a hygrometer and a dry-down period.' },
              { term: 'Cool-mist fogger', def: 'Used supplementally in very dry climates. Do not replace misting ,  fog wets surfaces differently than droplets.' },
            ],
          },
        ],
      },
      {
        id: 'lighting',
        title: 'Lighting and UVB',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'Crested geckos do not strictly require UVB because commercial CGD contains vitamin D3. That said, current hobby consensus favors low-level UVB as enrichment and a backup ,  it costs little, supports natural behavior, and hedges against diet gaps.',
          },
          {
            type: 'ul',
            items: [
              'Photoperiod: 12 hours on, 12 hours off. A timer removes the daily chore.',
              'UVB: Arcadia ShadeDweller 7% or Zoo Med 5.0 T5, mounted above the mesh top, 10–14 inches from the highest basking spot the animal can reach.',
              'Replace UVB bulbs every 12 months ,  output drops long before the bulb visibly fails.',
              'Plant lights (LED full-spectrum) are great for live-plant vivariums but produce no useful UVB. Keep them separate from husbandry lighting.',
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'UVB is optional, not pointless',
            items: [
              'Keepers who use UVB report better pigment saturation, firmer bones in breeder females, and fewer MBD cases over multi-year projects.',
              'If you do not use UVB, stay strict on CGD quality and rotate brands so no single deficiency compounds.',
            ],
          },
        ],
      },
      {
        id: 'decor',
        title: 'Decor, plants, and climbing',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Enclosures should look vertical, busy, and layered. The gecko needs multiple climbing paths, broad leaves for perching, and dense cover at several heights so it can choose its own microclimate.',
          },
          {
            type: 'ul',
            items: [
              'Cork bark flats and tubes ,  grippable, humidity-tolerant, reusable for years.',
              'Live plants: pothos, bromeliads, ficus, schefflera. Avoid anything with sticky latex or toxic sap.',
              'Fake plants are fine ,  the gecko does not care. Use them if you are not ready for a bioactive setup.',
              'Branches cut to wedge corner-to-corner create secure perches. Avoid sharp cut ends near the animal.',
              'One or two hides at ground level for daytime retreat. Coco huts, cork tubes, or a half-buried flowerpot work.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'feeding',
    label: 'Diet & Feeding',
    icon: 'utensils',
    tagline: 'CGD, insects, supplements, schedules',
    quickFacts: [
      { label: 'Primary diet', value: 'Commercial CGD (powdered)' },
      { label: 'Mix ratio', value: '1 part powder : 2 parts water' },
      { label: 'Adult schedule', value: '3×/week, replace every 24–36 h' },
      { label: 'Juvenile schedule', value: 'Fresh food daily' },
      { label: 'Insects', value: 'Optional, 1–2×/week, dusted' },
      { label: 'Fresh fruit', value: 'Rare treat only (sugar load)' },
    ],
    sections: [
      {
        id: 'cgd-basics',
        title: 'Commercial Crested Gecko Diet (CGD)',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'CGD is a nutritionally complete powdered diet designed to be the sole food source for crested geckos. It contains fruit, insect protein, vitamins, minerals, and calcium with D3. Mix 1 part powder to 2 parts water into a ketchup-like consistency, serve in a shallow dish, and discard after 24–36 hours.',
          },
          {
            type: 'ul',
            items: [
              'Always use dechlorinated or bottled water. Tap water is fine in most municipalities but avoid heavily chlorinated supplies.',
              'Mix fresh each feeding. Pre-mixed CGD kept in the fridge degrades within 48 hours and separates.',
              'Use a flat, shallow dish ,  magnetic ledge cups are popular because geckos forage upside-down.',
              'Replace the dish after 24–36 hours even if untouched. Old CGD breeds yeast and fruit flies.',
              'Rotate at least two brands over the animal\'s life. Each brand balances ingredients differently and rotation hedges against formulation changes.',
            ],
          },
        ],
      },
      {
        id: 'cgd-brands',
        title: 'Brand comparison',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'There is no single "best" CGD. The major brands below are all nutritionally complete and widely used by top breeders. Variety is the point ,  rotate flavors and brands so the animal does not become food-fixated.',
          },
          {
            type: 'table',
            headers: ['Brand', 'Product', 'Notes'],
            rows: [
              ['Pangea', 'Fruit Mix (multiple flavors)', 'The most common gateway diet. "With Insects" variants are preferred for growing juveniles.'],
              ['Repashy', 'Crested Gecko MRP (Classic, Grubs ‘N’ Fruit, Meal Replacement)', 'Oldest proven brand. "Grubs N Fruit" adds black soldier fly larvae for higher protein.'],
              ['Black Panther Zoological (BPZ)', 'Complete Gecko Diet', 'Smaller producer, fresh batches, fewer artificial ingredients. Rotates seasonal fruit.'],
              ['Leapin\' Leachie', 'LLG Crested Gecko Diet', 'Higher protein, popular with breeders producing clutches.'],
              ['Zoo Med', 'Crested Gecko Food', 'Widely available at pet chains. Considered a secondary option ,  use it alongside a premium brand, not exclusively.'],
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Buying tip',
            items: [
              'Check the manufacture date on the pouch. CGD loses vitamin potency after roughly 12 months. Buy small pouches often rather than one giant bag.',
              'Freeze unopened pouches if you buy in bulk ,  sealed and frozen, shelf life extends to 18–24 months.',
            ],
          },
        ],
      },
      {
        id: 'feeding-schedules',
        title: 'Feeding schedules by age',
        level: 'beginner',
        body: [
          {
            type: 'table',
            headers: ['Life stage', 'CGD frequency', 'Insect frequency', 'Notes'],
            rows: [
              ['Hatchling (0–8 g)', 'Fresh daily', 'Optional, 1–2 pinheads 1×/week', 'Target 0.2–0.5 g gain per week.'],
              ['Juvenile (8–20 g)', 'Fresh daily or every other day', '3–5 feeders 1–2×/week', 'Growth phase ,  never ration CGD.'],
              ['Sub-adult (20–35 g)', '3–4×/week', '4–6 feeders 1×/week', 'Start tracking monthly weight trend.'],
              ['Adult (35 g+)', '3×/week', '4–6 feeders 1×/2 weeks (optional)', 'Overfeeding adults causes obesity and fatty liver.'],
              ['Breeding female', '3–4×/week + extra calcium', '6–8 feeders 1–2×/week', 'Protein and calcium demand spikes during laying season.'],
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            items: [
              'Adults that gorge on CGD every night get fat, develop fatty liver disease, and fail to breed. Three to four feedings per week is enough for a non-breeder.',
              'Never fast a hatchling "to build appetite." Missed meals at this stage compound ,  a hatchling that skips 3 meals has lost a meaningful fraction of its body weight.',
            ],
          },
        ],
      },
      {
        id: 'insects',
        title: 'Feeder insects (optional)',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'Insects are not required on a complete CGD diet, but they add enrichment, satisfy natural hunting instinct, and provide extra protein for growing juveniles and breeding females. Offer insects 1–2 times per week at most.',
          },
          {
            type: 'dl',
            items: [
              { term: 'Dubia roaches', def: 'Best all-around feeder. Low fat, high protein, cannot climb smooth glass, long-lived in a colony.' },
              { term: 'Black soldier fly larvae (BSFL / Phoenix worms)', def: 'Self-contained calcium source. No dusting required. Soft-bodied and ideal for juveniles.' },
              { term: 'Crickets', def: 'Traditional feeder. Noisy, smelly, bite, and can injure a gecko if left in the enclosure overnight. Remove uneaten crickets.' },
              { term: 'Discoid roaches', def: 'Florida-legal alternative to dubia. Similar nutrition profile.' },
              { term: 'Hornworms', def: 'Treat only. Very high moisture and low calcium. Great rehydration tool for a picky eater.' },
              { term: 'Mealworms / superworms', def: 'Use sparingly. High fat, chitinous exoskeleton is harder to digest. Fine as an occasional treat; not a staple.' },
            ],
          },
          {
            type: 'ul',
            items: [
              'Dust every insect meal with calcium+D3 (Repashy Calcium Plus, Arcadia EarthPro-A, Miner-All). Miss no more than one dusting in four.',
              'Gutload feeders with leafy greens or a commercial gutload for 24–48 hours before feeding out. What your insects ate is what your gecko eats.',
              'Offer feeders in a smooth-sided dish or tong-feed. Loose crickets and large roaches can bite a sleeping gecko.',
            ],
          },
        ],
      },
      {
        id: 'fruit-and-treats',
        title: 'Fresh fruit and treats',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Crested geckos love sugary fruit, but it is not a complete food. Treat fresh fruit the way you would treat candy ,  an occasional reward, not a staple. Overuse causes CGD refusal and diarrhea.',
          },
          {
            type: 'ul',
            items: [
              'Safe treats (rare): mashed ripe banana, mango, papaya, fig, passion fruit, peach.',
              'Avoid citrus, grapes, rhubarb, avocado, and anything acidic. Many of these contain oxalates that bind calcium.',
              'Baby food pouches (Gerber Stage 2, plain fruit only) work in a pinch but are not a substitute for CGD.',
              'Never feed insects caught from your yard ,  pesticide and parasite risk.',
            ],
          },
        ],
      },
      {
        id: 'picky-eaters',
        title: 'Picky eaters and refusal',
        level: 'advanced',
        body: [
          {
            type: 'p',
            text: 'Appetite refusal is the single most common stressor for new keepers. In most cases, the cause is environmental (new home, wrong temperature, dehydration) rather than the food itself. Work the checklist before you assume a health issue.',
          },
          {
            type: 'ol',
            items: [
              'Give a new arrival 7–10 days of no handling before evaluating appetite. It is normal to refuse CGD in the first week.',
              'Verify temperature is not above 80°F and not below 68°F. Misting schedule is regular.',
              'Rotate CGD flavor. A gecko refusing "watermelon mix" may eat "banana cream" from the same brand.',
              'Try insects. Even a non-insect eater will sometimes take a BSFL or hornworm when refusing CGD.',
              'Weigh weekly. A non-eater that holds weight is fine; one that drops more than 5% needs vet eyes.',
              'After 2–3 weeks of refusal + weight loss, schedule a reptile vet. Fecal float rules out parasites. Dehydration can be addressed with a diluted Pedialyte soak.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'handling',
    label: 'Handling',
    icon: 'hand',
    tagline: 'Safe interaction, stress signals, firing up',
    quickFacts: [
      { label: 'First handling', value: 'After 2–3 weeks acclimation' },
      { label: 'Session length', value: '5–15 min max' },
      { label: 'Frequency', value: '2–4×/week at most' },
      { label: 'Hatchlings', value: 'Observe only ,  no handling' },
    ],
    sections: [
      {
        id: 'acclimation',
        title: 'Acclimation before handling',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'A new gecko in a new home is stressed. Handling during the acclimation window extends stress, triggers tail drops, and can cause food refusal that takes weeks to undo. Give it space first.',
          },
          {
            type: 'ol',
            items: [
              'Days 1–7: no handling. Do misting and food changes quickly and quietly. Observe only.',
              'Days 8–14: short in-cage interactions ,  change the water, adjust decor, let the gecko see your hand without grabbing.',
              'After day 14 and after the first confirmed meal: begin brief handling sessions as described below.',
              'For breeder stock, extend the window to 3–4 weeks and skip casual handling altogether.',
            ],
          },
        ],
      },
      {
        id: 'handling-technique',
        title: 'Safe handling technique',
        level: 'beginner',
        body: [
          {
            type: 'ul',
            items: [
              '"Hand-walking": let the gecko walk from one palm to the other. Never grab, squeeze, or restrain.',
              'Keep sessions short ,  5 to 15 minutes is plenty. Stop earlier if the gecko freezes, gapes, or sits and pants.',
              'Handle low over a soft surface (bed, couch) so a jump does not result in a fall from height.',
              'Never pick up by the tail. Crested gecko tails are autotomous and will drop at the lightest pull.',
              'Wash hands before and after. After insects or raw meat, always wash before reaching into the enclosure.',
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Stress signals ,  put the gecko back',
            items: [
              'Mouth held open, slow deliberate panting, darkened colors that do not fade.',
              'Violent wriggling, leaping repeatedly, tail whipping side-to-side like a whip.',
              'Tail base lifted and waved slowly ,  a pre-drop warning, stop immediately.',
            ],
          },
        ],
      },
      {
        id: 'firing-up',
        title: 'Firing up and color shifts',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: '"Firing up" is a temporary color change tied to humidity, activity, and mood. A fired-up gecko shows its fullest saturation; a fired-down one looks muted, often much lighter. Both are normal.',
          },
          {
            type: 'ul',
            items: [
              'Geckos typically fire up at night and when the cage is freshly misted.',
              'They fire down during the day, when resting, or when stressed. A gecko that stays fired down 24/7 may be chronically stressed or cold.',
              'Morph identification should be done on a fired-up, well-hydrated animal. A fired-down photo misleads buyers and breeders alike.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'health',
    label: 'Health',
    icon: 'heart',
    tagline: 'Shedding, tail loss, MBD, common issues, vet care',
    quickFacts: [
      { label: 'Weigh', value: 'Weekly (juveniles) · monthly (adults)' },
      { label: 'Annual vet', value: 'Fecal float + wellness exam' },
      { label: 'Red flags', value: 'Appetite loss, kink tail, lethargy' },
      { label: 'Tail regrowth', value: 'Never ,  dropped tails do not regrow' },
    ],
    sections: [
      {
        id: 'weight-tracking',
        title: 'Weight as a health metric',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Weight is the single most useful data point for monitoring crested gecko health. A downward trend is almost always the first sign of a problem ,  earlier than appetite changes, earlier than visible wasting, and sometimes weeks before a vet exam would catch it.',
          },
          {
            type: 'ul',
            items: [
              'Weigh with a 0.1 g kitchen scale. A deli cup with a lid makes weighing easy and calm.',
              'Juveniles: weekly weigh-ins. Expect steady gains (0.3–1.0 g/week depending on age).',
              'Adults: monthly weigh-ins. Healthy adults hold ±2 g month to month. Breeding females can swing 10–15 g pre- and post-lay.',
              'Flag any 5 %+ drop over a month for investigation. Consistent drops across two months warrants a vet visit.',
            ],
          },
        ],
      },
      {
        id: 'shedding',
        title: 'Shedding',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Crested geckos shed every 1–4 weeks depending on age and growth rate. The shed itself takes about 10–20 minutes and usually happens overnight. You often will not see it ,  the animal eats its own shed immediately. The tell is a duller, chalkier-looking gecko one night, then a clean bright one the next morning.',
          },
          {
            type: 'ul',
            items: [
              'Stuck shed on toes, tail tip, and around eyes is the most common husbandry problem. Root cause is almost always low humidity.',
              'Fix: increase misting, raise ambient humidity to 80–100% for 2–3 nights, and provide a humid hide (plastic tub with damp moss).',
              'Stuck shed on a toe cuts off circulation. Remove within 48 hours or the toe can be lost. Soak the gecko on damp paper towel for 15 minutes and peel gently with a damp cotton swab.',
              'Never pull ,  if it does not come off easily, soak longer.',
            ],
          },
        ],
      },
      {
        id: 'tail-loss',
        title: 'Tail loss (autotomy)',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Crested geckos drop their tails as a predator-escape response. Unlike leopard geckos and many other species, a lost tail does not regrow. The animal is otherwise fine ,  in the wild, most adult crested geckos are tailless.',
          },
          {
            type: 'ul',
            items: [
              'A dropped tail will bleed briefly, then clot on its own. No veterinary intervention is usually needed.',
              'Keep the enclosure clean for 3–5 days post-drop to avoid infection of the stump.',
              'Tail drops are triggered by stress: being grabbed, fighting another gecko, being startled, or sudden temperature change. Solo-house, handle gently, and minimize surprises.',
              'A tailless ("frogbutt") gecko is not worth less to a keeper ,  many hobbyists find them charming. Show breeders do pay a premium for intact tails.',
            ],
          },
          {
            type: 'callout',
            tone: 'info',
            items: [
              'Common myth: tail drop means the gecko is unhealthy. It does not. It means the gecko was scared. A healthy gecko can drop its tail exactly once in its life.',
            ],
          },
        ],
      },
      {
        id: 'common-issues',
        title: 'Common health issues',
        level: 'intermediate',
        body: [
          {
            type: 'table',
            headers: ['Issue', 'Signs', 'Typical cause', 'Action'],
            rows: [
              ['Metabolic Bone Disease (MBD)', 'Kinked spine, wavy tail, soft jaw, hemipenile prolapse, leg tremors', 'Chronic low calcium / D3, underfeeding', 'Vet ASAP. Early MBD is reversible with calcium and UVB; advanced cases are not.'],
              ['Floppy Tail Syndrome (FTS)', 'Tail arches over the back when hanging upside-down, pelvic deformity in adults', 'Prolonged upside-down perching on glass tops, lack of horizontal resting spots', 'Provide broad leaf perches and cork bark at the top. Prevention only ,  established FTS is permanent.'],
              ['Respiratory infection', 'Open-mouth breathing, mucus bubbles, wheezing, lethargy', 'Chronic humidity too high + poor ventilation, or cold draft', 'Dry out the cage, fix ventilation, vet for antibiotics if it persists >48 h.'],
              ['Impaction', 'Not defecating for 7+ days, visible bulge, loss of appetite', 'Substrate ingestion, dehydration, cold', 'Warm soak (84°F water, 10–15 min). Persistent: vet.'],
              ['Parasites (pinworms, coccidia, crypto)', 'Watery or bloody stool, weight loss despite eating, lethargy', 'Often present at import, spread via shared tools', 'Fecal float at vet. Crypto is the serious one ,  ask the vet to test specifically if weight loss is persistent.'],
              ['Mouth rot (stomatitis)', 'Cheesy white or yellow material at the gum line, swollen jaw, food refusal', 'Trauma + bacteria, low humidity, immune stress', 'Vet. Topical antiseptics and sometimes antibiotics.'],
              ['Dystocia (egg-binding)', 'Swollen abdomen, straining without laying, lethargy in a gravid female', 'Underweight female, calcium deficiency, no lay box, too-hot or too-cold cage', 'Emergency vet. Provide a warm humid lay box with damp substrate at least a week before expected lay date.'],
            ],
          },
          {
            type: 'callout',
            tone: 'warn',
            title: 'Find a reptile-experienced vet before you need one',
            items: [
              'Most "exotic" vets see rabbits and birds ,  not reptiles. Call ahead and ask specifically about crested gecko cases per year.',
              'Keep an emergency kit: digital scale, small plastic tub, damp paper towel, a list of vet phone numbers, a transport carrier.',
            ],
          },
        ],
      },
      {
        id: 'quarantine',
        title: 'Quarantine new arrivals',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'If you have an existing collection, quarantine every new arrival for a minimum of 30 days ,  90 days is better. Quarantine means a separate room if possible, different tools, and last-in-the-day husbandry order so you never carry pathogens back.',
          },
          {
            type: 'ul',
            items: [
              'Keep the quarantine enclosure on paper towel. Easier to spot parasite eggs and monitor stool.',
              'Run a fecal float at the beginning and the end of the quarantine period. Crypto shedding is intermittent ,  one clear test is not proof.',
              'Weigh weekly. A new arrival that drops more than 10% during quarantine should not be introduced to your collection even after the period ends.',
              'Wash hands, change shirts, and spray tools with a reptile-safe disinfectant (F10SC) between enclosures.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'life-stages',
    label: 'Life Stages',
    icon: 'scale',
    tagline: 'Hatchling, juvenile, sub-adult, adult, senior',
    quickFacts: [
      { label: 'Hatchling', value: '0–3 g · 0–3 months' },
      { label: 'Juvenile', value: '3–15 g · 3–12 months' },
      { label: 'Sub-adult', value: '15–35 g · 12–18 months' },
      { label: 'Adult', value: '35 g+ · 18+ months' },
      { label: 'Senior', value: '10 years+' },
    ],
    sections: [
      {
        id: 'hatchling-care',
        title: 'Hatchlings (0–3 g)',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Hatchlings are the most fragile life stage. They are small, easily lost in large enclosures, and prone to dehydration. Most keeper-inflicted losses happen in the first 6 weeks after hatch.',
          },
          {
            type: 'ul',
            items: [
              'Enclosure: 6-quart tub or small critter keeper with paper towel, a small branch, and a handful of fake leaves or sphagnum.',
              'First meal: offer CGD 24–48 hours after hatching. Some hatchlings do not eat for the first 3–5 days ,  that is normal if they are holding weight.',
              'Humidity: mist 1–2 times daily. Let the sides of the tub dry between mists.',
              'Do not handle. Observe only for the first month.',
              'Weigh every 4–7 days. A hatchling that drops below hatching weight for more than a week needs attention.',
            ],
          },
        ],
      },
      {
        id: 'juvenile-care',
        title: 'Juveniles (3–15 g)',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'The juvenile phase is the fastest growth window. Feed consistently, monitor weight weekly, and move up an enclosure size when the animal reaches ~10 g.',
          },
          {
            type: 'ul',
            items: [
              'Feed fresh CGD daily or every other day. Never ration at this age.',
              'Insects (optional) 1–2 times per week, always dusted.',
              'Expect 0.5–1.5 g weight gain per week under good husbandry.',
              'Sexing becomes possible around 15–25 g. Do not stress-handle to check sex ,  a confirmed-male juvenile can still be housed safely solo.',
            ],
          },
        ],
      },
      {
        id: 'subadult-care',
        title: 'Sub-adults (15–35 g)',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'Growth slows in the sub-adult phase. This is also the age when morph identity locks in and the final enclosure upgrade happens.',
          },
          {
            type: 'ul',
            items: [
              'Feed CGD 3–4 times per week. Expect 1–3 g weight gain per month.',
              'Adult enclosure (18×18×24 in) is appropriate by ~25 g.',
              'This is a good time to socialize handling if you intend to ,  calm 10-minute sessions 1–2 times per week.',
              'Morph evaluation at 25–30 g is more accurate than at hatch. Pattern "fade" and base color clarify as the animal approaches adulthood.',
            ],
          },
        ],
      },
      {
        id: 'adult-care',
        title: 'Adults (35 g+)',
        level: 'beginner',
        body: [
          {
            type: 'p',
            text: 'Adult crested geckos are low-maintenance. Most care time becomes routine ,  feed three times a week, mist nightly, weigh monthly, and watch for behavior changes.',
          },
          {
            type: 'ul',
            items: [
              'Do not overfeed. Three CGD feedings per week keeps a non-breeder at ideal weight.',
              'Monthly weigh-ins and a brief visual check replace weekly handling.',
              'Annual reptile-vet wellness visit + fecal float is a reasonable baseline for a single adult.',
              'Plan for a potential 15–20 year relationship. Designate an emergency caretaker in case you travel, move, or have an accident.',
            ],
          },
        ],
      },
      {
        id: 'senior-care',
        title: 'Senior geckos (10 years+)',
        level: 'advanced',
        body: [
          {
            type: 'p',
            text: 'Geckos past 10 years slow down. Breeders retire them. Weight can plateau and gradually drift down. Husbandry becomes gentler and more observational.',
          },
          {
            type: 'ul',
            items: [
              'Retire breeding females after 8 years of age, or sooner if clutch counts decline or body condition softens.',
              'Reduce climbing height if arthritis-like stiffness appears. Lower perches + easier access to food and water.',
              'Warm up the cool side of the cage slightly (76–78°F days) if the animal is clearly slower in cold weather.',
              'A senior gecko that sleeps more, eats less, and moves less is usually fine. One that loses more than 10% of its peak adult weight within a year is not ,  vet visit warranted.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'breeding',
    label: 'Breeding',
    icon: 'users',
    tagline: 'Readiness, pairing, egg care, incubation',
    quickFacts: [
      { label: 'Female minimum', value: '40 g + 18 months old' },
      { label: 'Male minimum', value: '25–30 g + 12 months' },
      { label: 'Season', value: 'March–October (hobby norm)' },
      { label: 'Clutch size', value: '2 eggs · every 4–6 weeks' },
      { label: 'Incubation', value: '60–90 days at 72–76°F' },
      { label: 'Cooling period', value: 'Nov–Feb rest required' },
    ],
    sections: [
      {
        id: 'breeding-readiness',
        title: 'Breeding readiness',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'Breeding too soon is the most common mistake new breeders make. The cost is the life or long-term health of the female. Wait for the numbers ,  weight and age ,  not for the temptation.',
          },
          {
            type: 'table',
            headers: ['Sex', 'Minimum weight', 'Minimum age', 'Ideal window'],
            rows: [
              ['Female', '40 g (strict)', '18 months', '45–55 g, 24+ months, proven feeder'],
              ['Male', '25–30 g', '12 months', '35 g+, 18+ months, handles calmly'],
            ],
          },
          {
            type: 'callout',
            tone: 'danger',
            title: 'Do not breed underweight or underage females',
            items: [
              'Calcium depletion and egg-binding are the two most common causes of keeper-inflicted female mortality.',
              'A female bred at 35 g can produce for one season, then die from secondary MBD the next.',
              'Males can breed earlier safely, but the female is the limiting factor.',
            ],
          },
        ],
      },
      {
        id: 'cooling-period',
        title: 'Cooling period (off-season)',
        level: 'advanced',
        body: [
          {
            type: 'p',
            text: 'Breeding-age females need a genuine off-season to recover calcium and fat reserves. The hobby standard is a cooling/resting period from roughly November through February, during which males and females are housed separately and no breeding occurs.',
          },
          {
            type: 'ul',
            items: [
              'Drop ambient temperature to 68–72°F during the day and 62–66°F at night for 2–3 months.',
              'Reduce photoperiod to 10 hours.',
              'Continue feeding on a normal adult schedule (3×/week CGD). Reduce or stop insects.',
              'Separate males and females. Never leave a pair together year-round.',
              'Resume normal temperatures and pairings in late February or early March.',
            ],
          },
        ],
      },
      {
        id: 'pairing',
        title: 'Pairing and cohabitation',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'Introduce the male into the female\'s enclosure, not the reverse ,  females are more territorial and less likely to tolerate a new male in their own space. Supervise the first introduction.',
          },
          {
            type: 'ul',
            items: [
              'Pair for 1–4 weeks, then separate. Some breeders run 2–3 weeks on, 2 weeks off through the season.',
              'Watch for excessive neck bites on the female. Small bite marks are normal; open wounds mean separate immediately.',
              'Keep detailed records: pair-up date, separation date, morph of both parents, project goals. A breeding log is the backbone of any serious project.',
              'Never pair full siblings unless you understand the genetic risks and have a specific project justification.',
            ],
          },
        ],
      },
      {
        id: 'egg-laying',
        title: 'Egg laying and lay box',
        level: 'intermediate',
        body: [
          {
            type: 'p',
            text: 'A female produces a clutch of 2 eggs every 4–6 weeks during the breeding season. She needs a dedicated lay box ,  without one, she will lay in the substrate or hold the eggs, risking dystocia.',
          },
          {
            type: 'ul',
            items: [
              'Lay box: deli cup or Tupperware with a hole cut in the lid, filled with 3–4 inches of moist (not wet) coco fiber or sphagnum.',
              'Place in the enclosure at all times for breeding females, not just during lay periods.',
              'Collect eggs within 24 hours. Mark the top with a dot so orientation stays consistent ,  rotating a developing egg can kill the embryo.',
              'Expect a gravid female to lose 5–15 grams in a single lay. This is normal and why extra calcium/protein matters during the season.',
            ],
          },
        ],
      },
      {
        id: 'incubation',
        title: 'Incubation',
        level: 'advanced',
        body: [
          {
            type: 'p',
            text: 'Room-temperature incubation (72–76°F, 22–24°C) produces strong, slow-hatching clutches. Higher temperatures shorten incubation and can produce male-biased clutches but also raise deformity rates. Hobby standard has moved toward slightly cool, slow incubation.',
          },
          {
            type: 'table',
            headers: ['Temperature', 'Incubation time', 'Notes'],
            rows: [
              ['68–72°F (20–22°C)', '90–120 days', 'Cool. Strong, vigorous hatchlings. Slight female bias.'],
              ['72–76°F (22–24°C)', '60–90 days', 'Hobby sweet spot. Balanced sex ratio and low deformity rate.'],
              ['78–82°F (25–28°C)', '45–60 days', 'Warm. Higher deformity risk and possible neurological issues.'],
            ],
          },
          {
            type: 'ul',
            items: [
              'Substrate: 1:1 (by weight) vermiculite and water, or perlite at the same ratio. Some breeders use SuperHatch (baked clay).',
              'Container: deli cup with a small cross-slit in the lid. No standing water ,  too wet is the most common killer.',
              'Open and check weekly. Spot-mist the container walls if the substrate dries. Do not mist the eggs directly.',
              'Turn nothing. Mark the top of each egg when collected and keep that orientation.',
            ],
          },
        ],
      },
      {
        id: 'hatching-and-record-keeping',
        title: 'Hatching and record keeping',
        level: 'advanced',
        body: [
          {
            type: 'p',
            text: 'Pipping (breaking the eggshell) takes hours to a full day. Leave the hatchling in the egg until it fully emerges ,  pulling it out early interferes with yolk absorption.',
          },
          {
            type: 'ul',
            items: [
              'Move the hatchling to its own 6-qt tub within 24 hours of emerging. Do not feed for 48 hours ,  it is still absorbing yolk.',
              'Log everything: hatch date, hatch weight, clutch number, parents, incubation temperature. Good records are the currency of serious breeding.',
              'Do not evaluate morph at hatch. Many traits (extreme harlequin, true pinstripe, etc.) do not express until the first major shed and some not until 3–6 months.',
              'Sell or trade only after the hatchling is 3+ grams, eating reliably, and has had a successful shed. Hobby ethics put this floor around 8–10 grams for most breeders.',
            ],
          },
        ],
      },
    ],
  },
];

export const CGD_BRANDS = [];
export const COMMON_HEALTH_ISSUES = [];
export const LIFE_STAGES = [];

// Finds a category by id
export function getCategory(id) {
  return CARE_CATEGORIES.find((c) => c.id === id) || null;
}

// Finds a section by category id + section id
export function getSection(catId, sectionId) {
  const cat = getCategory(catId);
  if (!cat) return null;
  return cat.sections.find((s) => s.id === sectionId) || null;
}
