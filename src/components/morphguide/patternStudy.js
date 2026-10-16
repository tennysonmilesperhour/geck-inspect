/** Curated reference records support visible-feature comparison, never genotype confirmation.
 * Production links to the source unless a record has documented reuse permission.
 * After recording permission from every relevant rights holder, set reuseApproved: true.
 * Local development may embed the source-hosted images for design review.
 */
export const SPECIMEN_SOURCE = 'https://lmreptiles.com/fg-pt2-1/';
const PHOTO_SIZE = { brindle: [1024,780], pin: [1024,1019], flank: [1024,576], harlequin: [1024,683], extreme: [672,770], bicolor: [678,810], dalmatian: [1024,685], dense: [1024,683] };
const photo = (id, title, filename, credit, points) => ({ id, title, src: `https://lmreptiles.com/wp-content/uploads/${filename}`, source: SPECIMEN_SOURCE, credit, points, width: PHOTO_SIZE[id][0], height: PHOTO_SIZE[id][1] });

const collectionPhoto = (id, title, src, width, height, points, plateMorph) => ({
  id,
  title,
  src,
  width,
  height,
  source: 'https://geckinspect.com/MorphGuide',
  credit: 'Tennyson · Geck Inspect collection',
  reuseApproved: true,
  plateMorph,
  points,
});

export const SPECIMENS = {
  brindle: {
    ...photo('brindle', 'Broken transverse banding', '2022/09/AR_Tiger-01-1024x780.jpg', 'Repashy · reproduced in LIL MONSTERS research', [{ x: 57, y: 39, label: 'Jagged bands cross the back and continue onto the sides.' }]),
    plateMorph: 'brindle',
  },
  pin: {
    ...photo('pin', 'Crest rows in an oblique view', '2022/05/EA20_0911_MB-16G-5-1024x1019.jpg', 'LIL MONSTERS Reptiles · EA20 0911', [{ x: 34, y: 43, label: 'Follow the raised edge of the back, separate from the wide dorsal field.' }, { x: 60, y: 71, label: 'Flank markings can coexist with pinstripe.' }]),
    plateMorph: 'pinstripe',
  },
  flank: {
    ...photo('flank', 'Lateral cream with dark interruptions', '2022/09/Red-3-1024x576.jpg', 'LIL MONSTERS Reptiles', [{ x: 42, y: 68, label: 'Irregular pale patches occupy the lower flank.' }, { x: 50, y: 37, label: 'A dark separation lies below the pale dorsal edge.' }]),
    plateMorph: 'harlequin',
  },
  flame: {
    id: 'flame', title: 'One flame specimen, three views', width: 2000, height: 2000,
    source: 'https://www.pangeareptile.com/products/male-flame-crested-gecko-cr-2323', credit: 'Pangea Reptile · Cr-2323',
    src: 'https://www.pangeareptile.com/cdn/shop/files/Cr-2323Left2_2000x.jpg?v=1775493894',
    plateMorph: 'flame',
    points: [{ x: 53, y: 45, label: 'Compare the narrow visible dorsal field with the mostly dark flank. Small pale flank markings also occur.' }],
    views: [
      { label: 'Left side', src: 'https://www.pangeareptile.com/cdn/shop/files/Cr-2323Left2_2000x.jpg?v=1775493894', points: [{ x: 53, y: 45, label: 'Compare the dorsal field with the mostly dark flank. Flame does not require completely blank sides.' }] },
      { label: 'Right side', src: 'https://www.pangeareptile.com/cdn/shop/files/Cr-2323Right2_2000x.jpg?v=1775493895', points: [{ x: 46, y: 52, label: 'The opposite flank has its own distribution of small pale markings. The two sides are not mirror images.' }] },
      { label: 'Above', width: 1200, height: 1200, src: 'https://www.pangeareptile.com/cdn/shop/files/Cr-2323Top2_1200x.jpg?v=1775493894', points: [{ x: 57, y: 46, label: 'From above, the broad dorsal pattern and its dark interruptions are much easier to see.' }] },
    ],
  },
  harlequin: {
    ...photo('harlequin', 'Harlequin with pinstripe', '2022/07/EA20_1106_FA-3-1024x683.jpg', 'LIL MONSTERS Reptiles · EA20 1106', [{ x: 56, y: 58, label: 'Separate flank patches and patterned legs.' }, { x: 59, y: 49, label: 'The narrow pin row follows the edge of the broader dorsal field.' }]),
    plateMorph: 'harlequin',
  },
  extreme: {
    ...photo('extreme', 'High lateral coverage', '2022/09/GL_Extreme-05.jpg', 'Geckological · LIL MONSTERS research library', [{ x: 29, y: 47, label: 'Extensive irregular lateral pattern; look at coverage across the whole flank.' }]),
    plateMorph: 'extreme-harlequin',
  },
  bicolor: {
    ...photo('bicolor', 'Contrasting dorsal and lateral color', '2022/09/GL_Neon.bicolor-02.jpg', 'Geckological · LIL MONSTERS research library', [{ x: 48, y: 32, label: 'Two broad color regions are different from scattered cream patches.' }]),
    plateMorph: 'bicolor',
  },
  dalmatian: {
    ...photo('dalmatian', 'Spots on a lightly patterned animal', '2022/08/F1-Dalmatian-1024x685.jpeg', 'Repashy · LIL MONSTERS research library', [{ x: 53, y: 48, label: 'Discrete dark spots vary in size and spacing.' }]),
    plateMorph: 'dalmatian',
  },
  dense: {
    ...photo('dense', 'Dense spotting over dorsal pattern', '2022/05/PGA18_0506_MX-33G-1-1024x683.jpg', 'LIL MONSTERS Reptiles · PGA18 0506', [{ x: 76, y: 24, label: 'Dark spots occur on pale pattern as well as the base color.' }]),
    plateMorph: 'super-dalmatian',
  },
  selva: collectionPhoto('selva', 'Selva: lateral & limb harlequin patches', '/demo-geckos/selva.webp', 841, 658, [
    { x: 45, y: 59, label: 'Pale and orange patches rise from the lower flank with dark ground channels between them.' },
    { x: 48, y: 74, label: 'The foreleg is patterned too. Read the flanks and limbs together when distinguishing Harlequin from Flame.' },
    { x: 36, y: 47, label: 'The patterned dorsal field above the crest is a separate anatomical region from the flank below.' },
  ], 'harlequin'),
  bliss: collectionPhoto('bliss', 'Bliss: high-contrast cream & orange flank coverage', '/demo-geckos/bliss.webp', 889, 1000, [
    { x: 32, y: 43, label: 'Cream and orange lobes interlock with the dark mahogany base up the mid and upper flank.' },
    { x: 49, y: 44, label: 'Bold limb bands wrap the legs alongside the narrow pale dorsolateral crest row.' },
  ], 'extreme-harlequin'),
  ponyBoy: collectionPhoto('ponyBoy', 'Pony Boy: oblique view of dorsal saddle vs. crest row', '/demo-geckos/pony-boy.webp', 750, 1000, [
    { x: 51, y: 48, label: 'Follow the narrow raised dorsolateral boundary rather than the wide cream saddle between the two ridges.' },
    { x: 37, y: 42, label: 'This broad pale saddle is dorsal pattern; its width does not measure pinstripe continuity.' },
  ], 'pinstripe'),
  raindrop: collectionPhoto('raindrop', 'Raindrop: raised pin row above lateral cream lobes', '/demo-geckos/raindrop.webp', 750, 1000, [
    { x: 71, y: 24, label: 'Trace the individual raised conical scales along the visible dorsal edge.' },
    { x: 66, y: 36, label: 'Larger cream patches below the crest ridge belong to the lateral flank pattern.' },
  ], 'pinstripe'),
  frito: collectionPhoto('frito', 'Frito: discrete Dalmatian spots across body and limbs', '/demo-geckos/frito.webp', 952, 1000, [
    { x: 40, y: 42, label: 'Discrete dark spots maintain individual outlines across the trunk and head.' },
    { x: 44, y: 56, label: 'Spotting continues onto the limbs; check legs and tail as well as the dorsum.' },
  ], 'dalmatian'),
  cheeto: collectionPhoto('cheeto', 'Cheeto: dark spots over a warm red-orange base', '/demo-geckos/cheeto.webp', 1000, 680, [
    { x: 58, y: 55, label: 'Distinct round dark spots stand out clearly against a fired red-orange ground color.' },
    { x: 37, y: 32, label: 'Individual spot outlines remain separate rather than merging into transverse tiger bars.' },
  ], 'super-dalmatian'),
  moonlight: collectionPhoto('moonlight', 'Moonlight: low-contrast pale flank pattern', '/demo-geckos/moonlight.webp', 750, 1000, [
    { x: 34, y: 61, label: 'Pale cream flank markings remain visible even when the ground color is fired down or low contrast.' },
  ], 'axanthic'),
};

/**
 * Pixel-registered Field Guide Progression Tracks.
 * Every plate in `/morph-guide/field-guide-v1/<slug>.webp` shares the exact
 * same 3/4 dorsal-lateral anatomy, enabling smooth cross-dissolve animation
 * across steps while keeping the animal's body and scale structure locked.
 */
export const MORPH_PROGRESSION_TRACKS = [
  {
    id: 'coverage',
    title: 'Dorsal & Lateral Coverage',
    subtitle: 'From Patternless to Extreme Harlequin & Lilly White',
    summary: 'Watch how pale cream and orange pigment first occupies the dorsal saddle between the crest rows, then climbs the lateral flanks and wraps the limbs.',
    steps: [
      {
        slug: 'patternless',
        label: 'Patternless',
        stage: 'Stage 1 · 0% pattern',
        traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 },
        tone: 'buckskin',
        note: 'Uniform ground color across the dorsal saddle, lateral flanks, and limbs with no contrasting dorsal flame or flank patches.',
        pins: [
          { x: 50, y: 30, title: 'Unpatterned Dorsal Saddle', detail: 'Ground color fills the entire field between the two dorsolateral crest rows.' },
          { x: 46, y: 48, title: 'Clean Lateral Flank', detail: 'No cream, yellow, or orange lobes rising from the ventral margin.' },
        ],
      },
      {
        slug: 'bicolor',
        label: 'Bicolor',
        stage: 'Stage 2 · Two-tone region split',
        traits: { dorsal: 0.78, lateral: 0, pinstripe: 0.1, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'Two broad, smoothly contrasting color zones: a lighter dorsal saddle over darker, unpatterned flanks and legs.',
        pins: [
          { x: 48, y: 29, title: 'lighter Dorsal Zone', detail: 'A smooth, continuous paler tone occupies the back without jagged flame lobes.' },
          { x: 45, y: 50, title: 'Solid Contrasting Flank', detail: 'Flanks and limbs stay in the darker ground tone with no harlequin patches.' },
        ],
      },
      {
        slug: 'flame',
        label: 'Flame',
        stage: 'Stage 3 · Patterned dorsum, quiet flanks',
        traits: { dorsal: 0.96, lateral: 0.08, pinstripe: 0.18, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'High-contrast cream and apricot flame lobes fill the dorsal field between the crest rows, while the flanks and limbs remain mostly dark ground color.',
        pins: [
          { x: 49, y: 28, title: 'Jagged Dorsal Flame', detail: 'Crisp cream and orange lobes with dark base islands inside the dorsal field.' },
          { x: 35, y: 66, title: 'Unbanded Forelimb', detail: 'Absence of bold limb pattern separates Flame from Harlequin.' },
        ],
      },
      {
        slug: 'harlequin',
        label: 'Harlequin',
        stage: 'Stage 4 · Flank & limb pattern',
        traits: { dorsal: 1, lateral: 0.58, pinstripe: 0.35, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'Irregular cream and warm orange patches rise roughly halfway up the lateral flanks, accompanied by distinct pattern bands wrapping the forelimbs and hindlimbs.',
        pins: [
          { x: 47, y: 46, title: 'Mid-Flank Harlequin Lobes', detail: 'Jagged cream and orange patches climb the lateral body wall with dark channels between them.' },
          { x: 34, y: 65, title: 'Patterned Limbs', detail: 'Cream and orange markings wrap across the forelegs and hindlegs.' },
        ],
      },
      {
        slug: 'extreme-harlequin',
        label: 'Extreme Harlequin',
        stage: 'Stage 5 · High-coverage flank & limbs',
        traits: { dorsal: 1, lateral: 0.96, pinstripe: 0.75, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'Interlocking cream and fiery orange markings blanket most of the lateral flanks and limbs, reaching up to touch the dorsolateral crest rows.',
        pins: [
          { x: 46, y: 42, title: 'Upper-Flank Convergence', detail: 'Lateral pattern rises from the belly margin all the way to the dorsolateral crest ridge.' },
          { x: 64, y: 58, title: 'Heavy Limb Coverage', detail: 'Extensive cream and orange wraps cover the hindlimb and tail base.' },
        ],
      },
      {
        slug: 'lilly-white',
        label: 'Lilly White',
        stage: 'Stage 6 · Dense white incomplete dominant',
        traits: { dorsal: 1, lateral: 1, pinstripe: 1, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'Dense chalk-white and ivory coverage coats the entire dorsal saddle, both crest rows, the tail through its tip, and high upward-sweeping lateral walls.',
        pins: [
          { x: 52, y: 26, title: 'Solid White Dorsal & Crests', detail: 'Dense white pigment blankets the entire back, crest scales, and tail base.' },
          { x: 48, y: 47, title: 'Sweeping White Lateral Wall', detail: 'Thick white lower-flank walls rise smoothly against the dark upper-flank channel.' },
        ],
      },
    ],
  },
  {
    id: 'pinning',
    title: 'Crest Pinning & Structural White',
    subtitle: 'From Buckskin to Full Pinstripe, Quad-Stripe & Phantom',
    summary: 'Follow the two raised dorsolateral scale rows from behind the supraocular head crests to the tail base, and see how lateral stripes or recessive Phantom modify them.',
    steps: [
      {
        slug: 'buckskin',
        label: 'Unpinned Base',
        stage: 'Stage 1 · 0% highlighted pin scales',
        traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 },
        tone: 'buckskin',
        note: 'The raised dorsolateral crest scales carry the same warm buckskin ground color as the surrounding back and flanks.',
        pins: [
          { x: 45, y: 39, title: 'Raised Crest Scales', detail: 'Conical scales are structurally present along both edges of the back but unhighlighted.' },
        ],
      },
      {
        slug: 'highway',
        label: 'Highway',
        stage: 'Stage 2 · Pale dorsal stripe between dark borders',
        traits: { dorsal: 0.72, lateral: 0.1, pinstripe: 0.55, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'A clean, continuous pale cream band runs down the dorsal midline, framed by dark ground borders and developing dorsolateral pin scales.',
        pins: [
          { x: 48, y: 28, title: 'Continuous Dorsal Highway', detail: 'Smooth longitudinal cream band running straight down the vertebral midline.' },
          { x: 46, y: 38, title: 'Framing Dorsolateral Ridges', detail: 'Raised crest rows frame the outer margins of the dorsal stripe.' },
        ],
      },
      {
        slug: 'pinstripe',
        label: 'Full Pinstripe',
        stage: 'Stage 3 · Continuous twin crest lines',
        traits: { dorsal: 0.3, lateral: 0.15, pinstripe: 1, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'Both left and right raised dorsolateral crest rows are continuously highlighted in bright ivory-cream from the head crown to the tail base.',
        pins: [
          { x: 46, y: 38, title: 'Near Dorsolateral Crest Row', detail: 'Unbroken ivory-cream line tracing every raised scale from neck to tail base.' },
          { x: 48, y: 27, title: 'Separate Dorsal Saddle', detail: 'The broad field between the two pin lines remains distinct from the narrow crest rails.' },
        ],
      },
      {
        slug: 'white-wall-white-spot',
        label: 'White Spot / Porthole',
        stage: 'Stage 4 · Lateral white portholes below pin row',
        traits: { dorsal: 0.35, lateral: 0.62, pinstripe: 0.9, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'Bright structural white portholes and lateral bars form along the mid-flank below the raised dorsolateral crest row.',
        pins: [
          { x: 46, y: 38, title: 'Upper Dorsolateral Pin Row', detail: 'Twin raised cream lines along the left and right edges of the back.' },
          { x: 47, y: 48, title: 'Lateral White Portholes & Bars', detail: 'Crisp structural white markings coalescing along the lateral flank.' },
        ],
      },
      {
        slug: 'white-wall',
        label: 'White Wall',
        stage: 'Stage 5 · Raised thick lateral wall',
        traits: { dorsal: 0.45, lateral: 0.88, pinstripe: 1, tiger: 0, spots: 0 },
        tone: 'mahogany',
        note: 'The lower lateral stripe expands into a solid, thick, continuous rectangular wall of bright white-cream plating the lower half of the flank.',
        pins: [
          { x: 47, y: 48, title: 'Solid Lateral White Wall', detail: 'Unbroken slab of dense cream-white covering the lower and mid flank from axilla to groin.' },
        ],
      },
      {
        slug: 'phantom-pinstripe',
        label: 'Phantom Pinstripe',
        stage: 'Stage 6 · Recessive melanin suppression of white',
        traits: { dorsal: 0.15, lateral: 0.05, pinstripe: 0.85, tiger: 0.25, spots: 0 },
        tone: 'olive',
        note: 'Structurally complete pinstripe rows where recessive Phantom suppresses bright white pigment, leaving muted taupe pins edged by a dark reverse-pin shadow.',
        pins: [
          { x: 46, y: 38, title: 'Muted Taupe Crest Scales', detail: 'Full structural pin scales lacking bright white or yellow xanthophore highlight.' },
          { x: 46, y: 42, title: 'Dark Reverse-Pin Shadow', detail: 'Continuous dark espresso line running immediately beneath the raised crest row.' },
        ],
      },
    ],
  },
  {
    id: 'banding',
    title: 'Transverse Banding & Brindle',
    subtitle: 'From Tiger Stripes to Marbled & Extreme Brindle',
    summary: 'Compare continuous vertical dark tiger bands crossing the back and sides against broken, branching brindle networks and dense extreme brindle.',
    steps: [
      {
        slug: 'patternless',
        label: 'Unbanded Base',
        stage: 'Stage 1 · Smooth ground color',
        traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 },
        tone: 'buckskin',
        note: 'Even buckskin-amber ground color without transverse dark bars or reticulated marbling.',
        pins: [
          { x: 48, y: 42, title: 'Uniform Dermal Ground', detail: 'No transverse dark pigment concentrations across the back or flanks.' },
        ],
      },
      {
        slug: 'tiger',
        label: 'Tiger',
        stage: 'Stage 2 · Continuous transverse bands',
        traits: { dorsal: 0.12, lateral: 0, pinstripe: 0, tiger: 0.68, spots: 0 },
        tone: 'orange',
        note: 'Recognizable dark chocolate-brown bars cross perpendicularly over the dorsal saddle and continue vertically down both lateral flanks.',
        pins: [
          { x: 49, y: 29, title: 'Dorsal Transverse Saddle Bars', detail: 'Dark bands bridge across the back between the two crest rows.' },
          { x: 46, y: 46, title: 'Vertical Flank Stripes', detail: 'Bands continue down the sides with natural organic edges.' },
        ],
      },
      {
        slug: 'tiger-brindle',
        label: 'Tiger Brindle',
        stage: 'Stage 3 · Forking & interrupted bands',
        traits: { dorsal: 0.18, lateral: 0.1, pinstripe: 0.15, tiger: 0.82, spots: 0 },
        tone: 'orange',
        note: 'Transverse dorsal bands begin to fork, split, and interconnect along the mid and lower flanks.',
        pins: [
          { x: 46, y: 45, title: 'Branching Lateral Bands', detail: 'Vertical stripes fork and weave into neighboring markings on the flank.' },
        ],
      },
      {
        slug: 'brindle',
        label: 'Brindle',
        stage: 'Stage 4 · Broken reticulated marbling',
        traits: { dorsal: 0.22, lateral: 0.18, pinstripe: 0.2, tiger: 0.92, spots: 0 },
        tone: 'buckskin',
        note: 'Irregular, broken, branching dark espresso markings weave across roughly half of the dorsal field, flanks, and limbs.',
        pins: [
          { x: 47, y: 44, title: 'Reticulated Brindle Network', detail: 'Broken, interconnected dark markings replace continuous vertical bars.' },
        ],
      },
      {
        slug: 'extreme-brindle',
        label: 'Extreme Brindle',
        stage: 'Stage 5 · High-density dark brindle',
        traits: { dorsal: 0.28, lateral: 0.25, pinstripe: 0.3, tiger: 1, spots: 0 },
        tone: 'mahogany',
        note: 'Dense dark espresso-black brindle marbling covers 80%+ of the back, flanks, and limbs, leaving narrow golden-amber fissures of ground color.',
        pins: [
          { x: 48, y: 43, title: 'Dense Dark Brindle Blanket', detail: 'Coalescing dark brindle network dominates the dorsum and flanks.' },
          { x: 44, y: 48, title: 'Amber Ground Fissures', detail: 'Warm golden-ochre base peeks through narrow channels in the dark marbling.' },
        ],
      },
    ],
  },
  {
    id: 'spotting',
    title: 'Dalmatian Spotting & Base Contrast',
    subtitle: 'From Clean Buckskin & Yellow Base to Dalmatian & Super Dalmatian',
    summary: 'Observe how discrete pigment spots vary in size, density, and color, and how they overlay clean buckskin, yellow, or patterned backgrounds.',
    steps: [
      {
        slug: 'buckskin',
        label: 'Buckskin Base',
        stage: 'Stage 1 · 0 discrete spots',
        traits: { dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 },
        tone: 'buckskin',
        note: 'Clean granular scales across the head, trunk, limbs, and tail with no discrete melanistic or erythristic spots.',
        pins: [
          { x: 46, y: 44, title: 'Unspotted Granular Skin', detail: 'Fine scale shading without isolated round or oval spot outlines.' },
        ],
      },
      {
        slug: 'yellow-base',
        label: 'Yellow Base',
        stage: 'Stage 2 · High-contrast xanthophore ground',
        traits: { dorsal: 0.35, lateral: 0.1, pinstripe: 0.1, tiger: 0, spots: 0 },
        tone: 'yellow',
        note: 'Warm golden-mustard and buttery yellow ground color provides the classic high-contrast canvas prized in Dalmatian breeding lines.',
        pins: [
          { x: 46, y: 44, title: 'Warm Xanthophore Canvas', detail: 'Rich golden-ochre dermal pigment before Dalmatian spotting is layered on top.' },
        ],
      },
      {
        slug: 'dalmatian',
        label: 'Dalmatian',
        stage: 'Stage 3 · Scattered discrete spots',
        traits: { dorsal: 0.1, lateral: 0, pinstripe: 0, tiger: 0, spots: 0.48 },
        tone: 'yellow',
        note: 'Around 25 to 50 sharply defined round and oval ink-black spots (plus occasional red or olive oil spots) scattered across the body and limbs.',
        pins: [
          { x: 45, y: 43, title: 'Discrete Black Spots', detail: 'Individual spots have crisp borders and ample clean base color between them.' },
          { x: 35, y: 62, title: 'Limb & Head Speckling', detail: 'Spots appear on the head crown, legs, and tail as well as the trunk.' },
        ],
      },
      {
        slug: 'super-dalmatian',
        label: 'Super Dalmatian',
        stage: 'Stage 4 · Heavy density & macro ink-blots',
        traits: { dorsal: 0.25, lateral: 0.1, pinstripe: 0.15, tiger: 0, spots: 1 },
        tone: 'yellow',
        note: 'Over 100+ dense, high-contrast spots including oversized ink-black macro-spots and ruby-red spots that cluster across both base color and pale dorsal pattern.',
        pins: [
          { x: 47, y: 41, title: 'Macro Ink-Blot Spots', detail: 'Large, irregular ink-black blotches alongside medium and ruby-red spots.' },
          { x: 52, y: 28, title: 'Spots Over Pale Dorsum', detail: 'Dalmatian spots overlay pale dorsal cream as well as the ground color.' },
        ],
      },
    ],
  },
  {
    id: 'pigment',
    title: 'Pigment & Melanin Modifiers',
    subtitle: 'Cappuccino, Sable, Axanthic, Hypo & Albino',
    summary: 'Compare how single-gene and line-bred pigment modifiers alter melanin density, yellow/red xanthophores, and ocular iris & pupil appearance.',
    steps: [
      {
        slug: 'cappuccino',
        label: 'Cappuccino',
        stage: 'Melanistic incomplete dominant',
        traits: { dorsal: 0.25, lateral: 0.1, pinstripe: 0.15, tiger: 0.35, spots: 0 },
        tone: 'mahogany',
        note: 'Deep espresso-brown velvety body with reduced pattern, dark obsidian eyes, a crisp white tail-base V mark, and a translucent white tail tip.',
        pins: [
          { x: 22, y: 46, title: 'Dark Obsidian Eye', detail: 'Heavy iris melanin gives Cappuccino and Sable geckos a deep espresso-black eye.' },
          { x: 64, y: 24, title: 'Sacral V & Tail Tip', detail: 'Concentrated white sacral marker and translucent-white tail tip.' },
        ],
      },
      {
        slug: 'frappuccino',
        label: 'Frappuccino',
        stage: 'Cappuccino + Lilly White combo',
        traits: { dorsal: 0.95, lateral: 0.88, pinstripe: 1, tiger: 0.2, spots: 0 },
        tone: 'mahogany',
        note: 'Combines Cappuccino espresso-taupe ground color and dark eyes with Lilly White creamy-latte dorsal saddle and sweeping white lateral walls.',
        pins: [
          { x: 50, y: 27, title: 'Latte-Cream Dorsal Saddle', detail: 'Lilly White structural white softened by Cappuccino melanin into warm latte-cream.' },
          { x: 46, y: 46, title: 'Frosted Lateral Walls', detail: 'High white lateral coverage contrasting against smoky mocha upper flanks.' },
        ],
      },
      {
        slug: 'hypo',
        label: 'Hypomelanistic',
        stage: 'Reduced dark melanin',
        traits: { dorsal: 0.75, lateral: 0.45, pinstripe: 0.35, tiger: 0.25, spots: 0 },
        tone: 'yellow',
        note: 'Suppressed black and dark brown melanin softens dark ground areas into dusty peach, pastel tangerine, and warm cinnamon-tan.',
        pins: [
          { x: 46, y: 43, title: 'Suppressed Dark Melanin', detail: 'Ground channels appear soft peach-tan or lavender-ash instead of dark chocolate.' },
        ],
      },
      {
        slug: 'axanthic',
        label: 'Axanthic',
        stage: 'Recessive xanthophore absence',
        traits: { dorsal: 0.9, lateral: 0.65, pinstripe: 0.55, tiger: 0.3, spots: 0 },
        tone: 'axanthic',
        note: 'Complete absence of yellow and red pigment leaves a crisp monochrome palette of charcoal-black, slate-gray, pewter, and pure chalk-white.',
        pins: [
          { x: 22, y: 46, title: 'Silver-Pewter Eye', detail: 'Lack of yellow pteridine pigment reveals a cool metallic silver-gray iris.' },
          { x: 47, y: 45, title: 'Monochrome Slate & White', detail: 'Zero yellow, orange, or red hues even when fully fired up.' },
        ],
      },
      {
        slug: 'albino',
        label: 'Albino',
        stage: 'Recessive TYR amelanistic',
        traits: { dorsal: 0.88, lateral: 0.55, pinstripe: 0.65, tiger: 0, spots: 0 },
        tone: 'albino',
        note: 'Complete absence of dark melanin produces a translucent buttery-cream and soft peach-pink body with a pale silvery-pearl iris and ruby-crimson vertical slit pupil.',
        pins: [
          { x: 22, y: 46, title: 'Pearl Iris & Ruby-Slit Pupil', detail: 'Pale translucent pinkish-pearl iris with a deep ruby-garnet vertical slit pupil.' },
          { x: 48, y: 42, title: 'Amelanistic Cream & Peach Skin', detail: 'Complete absence of black or brown melanin across all scales.' },
        ],
      },
    ],
  },
];

export const STUDY_LESSONS = [
  {
    id: 'flame',
    title: 'Dorsal pattern',
    subtitle: 'Flame & bicolor',
    region: 'dorsal',
    view: 'side',
    trackId: 'coverage',
    defaultStep: 2,
    examples: ['flame', 'bicolor', 'selva'],
    traits: { dorsal: 1 },
    look: 'Compare the back with the flanks and legs. Flame describes prominent dorsal pattern between the two crest rows with little lateral or limb pattern.',
    distinction: 'Bicolor describes contrasting broad color regions without jagged dorsal lobes. A few small side markings do not create a universal boundary between flame and harlequin.',
    guide: 'flame',
  },
  {
    id: 'harlequin',
    title: 'Lateral pattern',
    subtitle: 'Harlequin & extreme',
    region: 'lateral',
    view: 'side',
    trackId: 'coverage',
    defaultStep: 3,
    examples: ['selva', 'bliss', 'harlequin', 'flank', 'extreme'],
    traits: { dorsal: 1, lateral: 0.62 },
    look: 'Look for irregular markings rising up the lower flanks and wrapping across the limbs. Compare light, moderate, and heavy coverage across several animals.',
    distinction: '“Extreme” is a breeder descriptor for high lateral coverage, with no universal percentage cutoff. Pattern color can be cream, yellow, or orange.',
    guide: 'harlequin',
  },
  {
    id: 'pinstripe',
    title: 'Raised crest rows',
    subtitle: 'Partial, full & quad pinstripe',
    region: 'pinstripe',
    view: 'top',
    trackId: 'pinning',
    defaultStep: 2,
    examples: ['pin', 'ponyBoy', 'raindrop', 'harlequin'],
    traits: { pinstripe: 1 },
    look: 'Follow each raised dorsal edge from the neck toward the tail base. Check both left and right rows for interruptions before grading continuity.',
    distinction: 'Pinstripe is separate from the wide dorsal field between the ridges. A dark line beside a pale pin is called reverse pinning; it does not establish Phantom.',
    guide: 'pinstripe',
  },
  {
    id: 'tiger',
    title: 'Transverse markings',
    subtitle: 'Tiger & brindle',
    region: 'tiger',
    view: 'top',
    trackId: 'banding',
    defaultStep: 1,
    examples: ['brindle', 'flank', 'selva'],
    traits: { tiger: 1 },
    look: 'Follow dark markings across the dorsal saddle and down the sides. Compare continuous vertical tiger bars against broken, branching brindle networks.',
    distinction: 'Brindle describes more broken, forked, or reticulated dark banding. It is not simply a darker contrast setting on a tiger.',
    guide: 'tiger',
  },
  {
    id: 'dalmatian',
    title: 'Discrete spots',
    subtitle: 'Dalmatian & super Dalmatian',
    region: 'spots',
    view: 'side',
    trackId: 'spotting',
    defaultStep: 1,
    examples: ['frito', 'cheeto', 'dalmatian', 'dense'],
    traits: { spots: 0.65 },
    look: 'Separate individual spots from the surrounding pattern. Inspect their size, crispness, color (black, red, or olive oil spots), and distribution over pale markings.',
    distinction: '“Super Dalmatian” may describe heavy spotting with large ink-blot spots or a breeder’s line claim. A spot count alone does not establish a genotype.',
    guide: 'dalmatian',
  },
  {
    id: 'structural',
    title: 'Structural white & modifiers',
    subtitle: 'Lilly White, Axanthic & Albino',
    region: 'lateral',
    view: 'side',
    trackId: 'pigment',
    defaultStep: 3,
    examples: ['moonlight', 'bliss', 'extreme'],
    traits: { dorsal: 1, lateral: 0.92, pinstripe: 0.9 },
    look: 'Observe how single-gene traits transform whole-body pigment: Lilly White floods the dorsum, tail tip, and flanks with chalk-white; Axanthic removes yellow and red; Albino removes dark melanin.',
    distinction: 'A pale fired-down gecko can mimic hypomelanistic or axanthic tones in a single photo. Always check firing range, eye pigment, and documented lineage.',
    guide: 'lilly-white',
  },
];

export const STUDY_QUESTIONS = [
  { id: 'pin', specimen: 'pin', question: 'Which feature identifies the pinstripe here?', answers: ['The wide pale field on the back', 'Pale scales along the raised dorsal edges', 'The light patches on the legs'], correct: 1, explanation: 'Trace the narrow raised rows. The broad field between them is dorsal pattern, and the legs show a separate feature.' },
  { id: 'flank', specimen: 'harlequin', question: 'Which observation supports a harlequin description?', answers: ['The eye color', 'A continuous pinstripe alone', 'Pattern on the flanks and legs'], correct: 2, explanation: 'Lateral and limb pattern is the useful clue. Harlequin and pinstripe can describe the same animal.' },
  { id: 'spots', specimen: 'dense', question: 'Where can you see dark spots in this specimen?', answers: ['On pale pattern as well as base color', 'Only on the darker base', 'Only on the head'], correct: 0, explanation: 'The photograph shows spots over pale dorsal pattern. Base-only spotting would be an incorrect rule.' },
  { id: 'bands', specimen: 'brindle', question: 'What is the useful observation here?', answers: ['Perfectly evenly spaced lines', 'Broken markings crossing the body', 'A precisely measurable brindle percentage'], correct: 1, explanation: 'Describe direction and broken edges. The appearance is irregular; the label is not a numerical scale.' },
  { id: 'limits', specimen: 'extreme', question: 'What can this photograph establish by itself?', answers: ['Extensive visible flank pattern', 'A guaranteed inheritance ratio', 'The animal’s hidden genes'], correct: 0, explanation: 'Photographs support observations of appearance. Lineage and breeding evidence are separate questions.' },
  { id: 'oblique-pin', specimen: 'ponyBoy', question: 'In this oblique dorsal view of Pony Boy, how do you separate dorsal pattern from pinstripe?', answers: ['The entire cream back is the pinstripe', 'The narrow raised scale ridges form the pinstripe; the wide cream saddle between them is dorsal pattern', 'Only patternless geckos can have a pinstripe'], correct: 1, explanation: 'Pinstripe refers strictly to the raised dorsolateral scale rows along each edge of the back, whereas the wide cream area between them is the dorsal field.' },
  { id: 'red-base-spots', specimen: 'cheeto', question: 'What makes Cheeto’s dark markings Dalmatian spots rather than tiger bands?', answers: ['Spots only appear on yellow geckos', 'Each dark mark has a discrete, isolated round or oval outline scattered across the head, trunk, and limbs', 'They form continuous vertical stripes from back to belly'], correct: 1, explanation: 'Dalmatian spots are discrete pigment islands with individual outlines across the head, body, and legs, regardless of whether the base color is buckskin, yellow, or red-orange.' },
  { id: 'low-contrast', specimen: 'moonlight', question: 'Why can’t a single pale, low-contrast photograph by itself prove a gecko is genetically Axanthic?', answers: ['Because firing state and lighting can make non-axanthic geckos look pale gray-cream when fired down', 'Because Axanthic geckos never have flank pattern', 'Because Axanthic is only visible on the tail'], correct: 0, explanation: 'Crested geckos shift dramatically between fired-down and fired-up states. Confirming a recessive trait like Axanthic requires observing the full fired-up state and documented lineage.' },
];

export const EMPTY_TRAITS = Object.freeze({ dorsal: 0, lateral: 0, pinstripe: 0, tiger: 0, spots: 0 });
export const normalizedStudy = input => Object.fromEntries(Object.keys(EMPTY_TRAITS).map(k => [k, Math.max(0, Math.min(1, Number(input?.[k]) || 0))]));
export function traitDescription(key, value) {
  if (value <= 0) return 'Absent';
  if (key === 'pinstripe') return value >= .999 ? 'Continuous' : value > .8 ? 'Nearly continuous' : value > .35 ? 'Interrupted' : 'A few pin scales';
  if (key === 'spots') return value > .8 ? 'Dense' : value > .35 ? 'Scattered' : 'Sparse';
  if (key === 'tiger') return value > .7 ? 'Pronounced' : value > .3 ? 'Moderate' : 'Faint';
  return value > .8 ? 'Extensive' : value > .35 ? 'Moderate' : 'Limited';
}
