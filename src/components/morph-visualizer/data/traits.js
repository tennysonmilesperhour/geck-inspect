/**
 * Crested Gecko trait catalog ,  canonical data.
 *
 * The single source of truth for the Morph Visualizer. Every trait has:
 *   id         ,  stable machine key (used by engine + render layers)
 *   name       ,  human label
 *   category   ,  where it goes in the UI
 *   genetics   ,  how it is inherited and what zygosities are allowed
 *   epistasis  ,  what this trait hides/masks when expressed
 *   visual     ,  hints the renderer can use (palette swaps, layer flags)
 *   rarity     ,  1 (common) → 5 (ultra rare) baseline tier
 *   valueHint  ,  USD-ish floor suggestion for an adult at that trait alone
 *   description,  short plain-English summary
 *
 * The shape is deliberately portable ,  data here can power:
 *   - this visualizer (render hints)
 *   - breeding predictors (genetics block)
 *   - recognition / identification features (visual + description)
 *   - LLM prompt context (description + genetics.summary)
 */

export const GENETICS_TYPE = {
  RECESSIVE: 'recessive',
  INCOMPLETE_DOMINANT: 'incomplete_dominant',
  DOMINANT: 'dominant',
  POLYGENIC: 'polygenic',
  LINEBRED: 'linebred',
  STRUCTURAL: 'structural',
  ENVIRONMENTAL: 'environmental',
};

export const ZYGOSITY = {
  ABSENT: 'absent',      // no copies (N/N)
  HET: 'het',            // one copy (N/a) ,  invisible for recessive, visual for incomp-dom
  VISUAL: 'visual',      // visual expression (covers het-visual for incomp-dom, hom for recessive)
  SUPER: 'super',        // homozygous super form for incomp-dom
};

// Polygenic expression ladder ,  used by both UI sliders and renderer.
export const EXPRESSION = ['none', 'trace', 'partial', 'strong', 'extreme'];

// ---------- Base colors (polygenic, display only) ----------
// Hex values are the "fired-up" body tone; the renderer derives fired-down
// from these by lightening & desaturating.
export const BASE_COLORS = [
  { id: 'red',        name: 'Red',        hex: '#8a2b25', rarity: 3, valueHint: 300 },
  { id: 'dark_red',   name: 'Dark Red',   hex: '#5d1a18', rarity: 4, valueHint: 450 },
  { id: 'orange',     name: 'Orange',     hex: '#c46a20', rarity: 2, valueHint: 200 },
  { id: 'tangerine',  name: 'Tangerine',  hex: '#e07a18', rarity: 3, valueHint: 300 },
  { id: 'yellow',     name: 'Yellow',     hex: '#c7a033', rarity: 2, valueHint: 175 },
  { id: 'bright_yellow', name: 'Bright Yellow', hex: '#e4c132', rarity: 3, valueHint: 300 },
  { id: 'cream',      name: 'Cream',      hex: '#d9c79a', rarity: 2, valueHint: 175 },
  { id: 'buckskin',   name: 'Buckskin',   hex: '#a0845a', rarity: 1, valueHint: 100 },
  { id: 'tan',        name: 'Tan',        hex: '#b79467', rarity: 1, valueHint: 100 },
  { id: 'brown',      name: 'Brown',      hex: '#6b4a2e', rarity: 1, valueHint: 90  },
  { id: 'dark_brown', name: 'Dark Brown', hex: '#4a301c', rarity: 2, valueHint: 120 },
  { id: 'chocolate',  name: 'Chocolate',  hex: '#3c2412', rarity: 3, valueHint: 250 },
  { id: 'olive',      name: 'Olive',      hex: '#55562c', rarity: 2, valueHint: 150 },
  { id: 'dark_olive', name: 'Dark Olive', hex: '#3a3a1c', rarity: 3, valueHint: 250 },
  { id: 'lavender',   name: 'Lavender',   hex: '#877391', rarity: 4, valueHint: 400 },
  { id: 'near_black', name: 'Near Black', hex: '#1f1a1a', rarity: 4, valueHint: 450 },
];

// ---------- Proven Mendelian morphs ----------
// These use Punnett-square math and must carry a zygosity.
export const MENDELIAN_MORPHS = [
  {
    id: 'lilly_white',
    name: 'Lilly White',
    shortCode: 'LW',
    category: 'mendelian',
    genetics: {
      type: GENETICS_TYPE.INCOMPLETE_DOMINANT,
      superForm: 'Super Lilly White',
      superLethal: true, // homozygous = embryonic lethal
      summary:
        'Incomplete dominant. One copy = visual LW with bright white body highlights. Two copies = Super LW, which fails to hatch.',
    },
    epistasis: {
      lightens: true,        // adds white body wash
      suppressesWarmPigment: false,
    },
    visual: {
      layer: 'lillyWhite',
      floodColor: '#f4f2ec',
    },
    rarity: 3,
    valueHint: 350,
    description:
      'White body highlights with a clean break along the dorsum. Creates the most dramatic contrast on dark or saturated base colors.',
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    shortCode: 'Capp',
    category: 'mendelian',
    genetics: {
      type: GENETICS_TYPE.INCOMPLETE_DOMINANT,
      superForm: 'Frappuccino',
      superLethal: false,
      summary:
        'Incomplete dominant. One copy = visual Cappuccino with a connected dorsum and coffee-brown body. Two copies = Frappuccino with a fully patternless cream dorsum.',
    },
    epistasis: { darkensBase: true },
    visual: {
      layer: 'cappuccino',
      dorsumCreamHex: '#d7bc93',
      bodyDarkHex: '#3a2616',
    },
    rarity: 4,
    valueHint: 800,
    description:
      'Coffee-toned body with a continuous, paler "coffee-stain" dorsum. Often described as a walking chocolate-cream pattern.',
  },
  {
    id: 'axanthic',
    name: 'Axanthic',
    shortCode: 'Ax',
    category: 'mendelian',
    genetics: {
      type: GENETICS_TYPE.RECESSIVE,
      summary:
        'Simple recessive. Both parents must carry at least one copy. Visual animals express only in homozygous form ,  they lack red/yellow pigment.',
    },
    epistasis: {
      removeWarmPigment: true, // drops xanthophores ,  masks base color
    },
    visual: {
      layer: 'axanthic',
      lockedPalette: ['#e2e2e2', '#9a9a9a', '#4a4a4a', '#1e1e1e'],
    },
    rarity: 5,
    valueHint: 1500,
    description:
      'Lacks yellow and red pigment. Appears in greys, blacks and whites regardless of base color genes the animal carries.',
  },
  {
    id: 'soft_scale',
    name: 'Soft Scale',
    shortCode: 'SS',
    category: 'mendelian',
    genetics: {
      type: GENETICS_TYPE.INCOMPLETE_DOMINANT,
      superForm: 'Super Soft Scale',
      superLethal: false,
      summary:
        'Incomplete dominant. Smooth, soft scalation with velvet-like surface. Super form exists with reported fertility concerns.',
    },
    epistasis: {},
    visual: { layer: 'softScale', smoothing: 0.4 },
    rarity: 4,
    valueHint: 600,
    description:
      'Smaller, smoother scales that give the animal a velvety appearance. Structural ,  visible more than colored.',
  },
  {
    id: 'white_wall',
    name: 'White Wall',
    shortCode: 'WW',
    category: 'mendelian',
    genetics: {
      type: GENETICS_TYPE.INCOMPLETE_DOMINANT,
      superForm: 'Super White Wall',
      superLethal: false,
      summary:
        'Incomplete dominant. Creates a clean white lateral belly band that expands to the sides in the super form.',
    },
    epistasis: {},
    visual: { layer: 'whiteWall', bandHex: '#f1ede3' },
    rarity: 4,
    valueHint: 500,
    description:
      'Clean white belly-line running laterally along the body wall. Often stacked with Harlequin for dramatic contrast.',
  },
  {
    id: 'empty_back',
    name: 'Empty Back',
    shortCode: 'EB',
    category: 'mendelian',
    genetics: {
      type: GENETICS_TYPE.INCOMPLETE_DOMINANT,
      summary:
        'Incomplete dominant. Clears dorsal pattern, leaving the animal with a smooth, uninterrupted dorsum.',
    },
    epistasis: { suppressesDorsalPattern: true },
    visual: { layer: 'emptyBack' },
    rarity: 3,
    valueHint: 350,
    description:
      'A clean, patternless dorsum from head to tail base. Frequently used to stack with side-pattern traits.',
  },
];

// ---------- Polygenic pattern traits (no Punnett math) ----------
export const PATTERN_TRAITS = [
  {
    id: 'harlequin',
    name: 'Harlequin',
    category: 'pattern',
    genetics: {
      type: GENETICS_TYPE.POLYGENIC,
      summary:
        'Polygenic. High-contrast lateral markings rising from the belly up the flanks, sometimes onto the dorsum. Ladder: trace → partial → strong → extreme.',
    },
    epistasis: {},
    visual: { layer: 'harlequin', intensityDriven: true },
    rarity: 2,
    valueHint: 150,
    description:
      'Lateral cream or colored markings rising up the flanks. Extreme harlequin extends pattern onto the back.',
  },
  {
    id: 'flame',
    name: 'Flame',
    category: 'pattern',
    genetics: {
      type: GENETICS_TYPE.POLYGENIC,
      summary: 'Polygenic. Lateral "flame" markings shooting up the flanks like tongues of fire.',
    },
    epistasis: {},
    visual: { layer: 'flame', intensityDriven: true },
    rarity: 1,
    valueHint: 75,
    description:
      'Lighter lateral markings that stop short of full harlequin coverage. The historic baseline pattern type.',
  },
  {
    id: 'pinstripe',
    name: 'Pinstripe',
    category: 'pattern',
    genetics: {
      type: GENETICS_TYPE.POLYGENIC,
      summary:
        'Polygenic. Raised cream scales along the lateral edges of the dorsum. Percentage describes how much of the dorsal edge is covered (0 → 100%).',
    },
    epistasis: {},
    visual: { layer: 'pinstripe', intensityDriven: true },
    rarity: 2,
    valueHint: 150,
    description:
      'Raised cream scale rows framing the dorsum. "100% pinstripe" means both rails are complete head-to-tail-base.',
  },
  {
    id: 'dalmatian',
    name: 'Dalmatian',
    category: 'pattern',
    genetics: {
      type: GENETICS_TYPE.POLYGENIC,
      summary:
        'Polygenic. Dark, ink-like spots of irregular size. Can be red, black, or ink-spot depending on base genes.',
    },
    epistasis: {},
    visual: { layer: 'dalmatian', intensityDriven: true, spotHex: '#241a15' },
    rarity: 2,
    valueHint: 150,
    description:
      'Dark spots scattered across the body. Dense enough and it grades into "super dalmatian".',
  },
  {
    id: 'tiger',
    name: 'Tiger',
    category: 'pattern',
    genetics: {
      type: GENETICS_TYPE.POLYGENIC,
      summary:
        'Polygenic. Dark lateral banding running top-to-bottom across the ribs. Brindle is a broken-up variant.',
    },
    epistasis: {},
    visual: { layer: 'tiger', intensityDriven: true },
    rarity: 2,
    valueHint: 175,
    description:
      'Dark vertical bars across the ribs. Creates a striped, tiger-like appearance. Brindle is this pattern but fragmented.',
  },
  {
    id: 'brindle',
    name: 'Brindle',
    category: 'pattern',
    genetics: {
      type: GENETICS_TYPE.POLYGENIC,
      summary: 'Polygenic. Broken, feathered tiger-style banding ,  looks etched rather than painted.',
    },
    epistasis: {},
    visual: { layer: 'brindle', intensityDriven: true },
    rarity: 2,
    valueHint: 150,
    description:
      'Broken, feather-edged banding. Often stacked with harlequin for extra texture.',
  },
  {
    id: 'patternless',
    name: 'Patternless',
    category: 'pattern',
    genetics: {
      type: GENETICS_TYPE.POLYGENIC,
      summary: 'Polygenic (or induced by Empty Back / Frappuccino). A clean body with no lateral or dorsal pattern.',
    },
    epistasis: { suppressesLateralPattern: true, suppressesDorsalPattern: true },
    visual: { layer: 'patternless' },
    rarity: 2,
    valueHint: 100,
    description:
      'No lateral or dorsal markings. Shows the base color cleanly ,  common for solid-color projects.',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    category: 'pattern',
    genetics: {
      type: GENETICS_TYPE.LINEBRED,
      summary:
        'Linebred. Reduced warm pigment saturation ,  looks muted, ghostly, desaturated. Believed polygenic, not Mendelian.',
    },
    epistasis: { desaturate: 0.35 },
    visual: { layer: 'phantom' },
    rarity: 3,
    valueHint: 250,
    description:
      'A muted, low-saturation look. Common background for moonglow and dark-toned projects.',
  },
];

// ---------- Accent / secondary traits ----------
export const ACCENT_TRAITS = [
  {
    id: 'portholes',
    name: 'Portholes',
    category: 'accent',
    genetics: { type: GENETICS_TYPE.POLYGENIC, summary: 'Polygenic. Round white circles along the flanks.' },
    visual: { layer: 'portholes' },
    rarity: 2,
    valueHint: 75,
    description: 'Round, cream-to-white rings along the lateral body ,  like small windows on the flanks.',
  },
  {
    id: 'kneecaps',
    name: 'White Kneecaps',
    category: 'accent',
    genetics: { type: GENETICS_TYPE.POLYGENIC, summary: 'Polygenic. White patches over the knees.' },
    visual: { layer: 'kneecaps' },
    rarity: 1,
    valueHint: 50,
    description: 'Cream-white patches on the knees. Easiest on darker base colors.',
  },
  {
    id: 'white_fringe',
    name: 'White Fringe',
    category: 'accent',
    genetics: { type: GENETICS_TYPE.POLYGENIC, summary: 'Polygenic. White lateral edging along the lower body.' },
    visual: { layer: 'whiteFringe' },
    rarity: 2,
    valueHint: 100,
    description: 'White edging along the lowest edge of the body, framing the belly line.',
  },
  {
    id: 'drippy_dorsal',
    name: 'Drippy Dorsal',
    category: 'accent',
    genetics: { type: GENETICS_TYPE.POLYGENIC, summary: 'Polygenic. Dorsal pattern extends down the flanks like drips.' },
    visual: { layer: 'drippyDorsal' },
    rarity: 2,
    valueHint: 125,
    description: 'Dorsal pattern that bleeds down the sides in irregular teardrops.',
  },
  {
    id: 'white_tipped_crests',
    name: 'White Tipped Crests',
    category: 'accent',
    genetics: { type: GENETICS_TYPE.POLYGENIC, summary: 'Polygenic. Pale tips at the ends of each crest scale.' },
    visual: { layer: 'crestTips' },
    rarity: 2,
    valueHint: 100,
    description: 'Cream tips on each crest scale ,  subtle but striking in adults.',
  },
];

// ---------- Structural / physical traits ----------
export const STRUCTURAL_TRAITS = [
  {
    id: 'crest_size',
    name: 'Crest Prominence',
    category: 'structural',
    type: 'choice',
    genetics: { type: GENETICS_TYPE.STRUCTURAL, summary: 'Body structure ,  influenced by genetics and age.' },
    options: ['reduced', 'normal', 'heavy'],
    default: 'normal',
    visual: { layer: 'crestSize' },
    rarity: 1,
  },
  {
    id: 'crowned',
    name: 'Crowned',
    category: 'structural',
    type: 'toggle',
    genetics: { type: GENETICS_TYPE.LINEBRED, summary: 'Linebred. Wider-than-normal head with flared crests.' },
    visual: { layer: 'crowned' },
    rarity: 3,
    valueHint: 200,
    description: 'Wider head with flared, dramatic crest lines across the crown.',
  },
  {
    id: 'furred',
    name: 'Furred',
    category: 'structural',
    type: 'toggle',
    genetics: { type: GENETICS_TYPE.LINEBRED, summary: 'Linebred. Longer, filamentous scales creating a fuzzy silhouette.' },
    visual: { layer: 'furred' },
    rarity: 3,
    valueHint: 250,
    description: 'Longer, whiskery scales over the crests and sometimes the flanks.',
  },
  {
    id: 'tail',
    name: 'Tail',
    category: 'structural',
    type: 'choice',
    genetics: { type: GENETICS_TYPE.STRUCTURAL, summary: 'Crested geckos drop their tails readily; most adults are tailless.' },
    options: ['present', 'absent'],
    default: 'present',
    visual: { layer: 'tail' },
    rarity: 1,
  },
  {
    id: 'eye_color',
    name: 'Eye Color',
    category: 'structural',
    type: 'choice',
    genetics: { type: GENETICS_TYPE.STRUCTURAL, summary: 'Iris pigment variation ,  largely polygenic.' },
    options: ['gold', 'copper', 'silver', 'grey', 'red'],
    default: 'gold',
    visual: { layer: 'eye' },
    rarity: 1,
  },
];

// ---------- Environmental state (not inherited) ----------
export const ENVIRONMENTAL_TRAITS = [
  {
    id: 'fire_state',
    name: 'Fire State',
    category: 'environmental',
    type: 'choice',
    genetics: { type: GENETICS_TYPE.ENVIRONMENTAL, summary: 'Chromatophore state. Not inherited ,  changes minute-to-minute.' },
    options: ['fired_down', 'neutral', 'fired_up'],
    default: 'neutral',
    visual: { layer: 'fireState' },
    rarity: 1,
  },
  {
    id: 'age',
    name: 'Age',
    category: 'environmental',
    type: 'choice',
    genetics: { type: GENETICS_TYPE.ENVIRONMENTAL, summary: 'Juveniles express pattern differently than adults.' },
    options: ['juvenile', 'adult'],
    default: 'adult',
    visual: { layer: 'age' },
    rarity: 1,
  },
  {
    id: 'shed_state',
    name: 'Shed State',
    category: 'environmental',
    type: 'choice',
    genetics: { type: GENETICS_TYPE.ENVIRONMENTAL, summary: 'Animals in shed look dull and pale.' },
    options: ['normal', 'pre_shed'],
    default: 'normal',
    visual: { layer: 'shedState' },
    rarity: 1,
  },
];

// Convenience lookup maps
export const TRAITS_BY_ID = Object.fromEntries(
  [
    ...MENDELIAN_MORPHS,
    ...PATTERN_TRAITS,
    ...ACCENT_TRAITS,
    ...STRUCTURAL_TRAITS,
    ...ENVIRONMENTAL_TRAITS,
  ].map((t) => [t.id, t])
);

export const BASE_COLORS_BY_ID = Object.fromEntries(BASE_COLORS.map((c) => [c.id, c]));

export const ALL_CATEGORIES = [
  { id: 'mendelian',     label: 'Proven Morphs (Mendelian)',   traits: MENDELIAN_MORPHS },
  { id: 'pattern',       label: 'Pattern Traits (Polygenic)',  traits: PATTERN_TRAITS },
  { id: 'accent',        label: 'Accents & Secondary Markings',traits: ACCENT_TRAITS },
  { id: 'structural',    label: 'Structural & Physical',       traits: STRUCTURAL_TRAITS },
  { id: 'environmental', label: 'Environmental / State',       traits: ENVIRONMENTAL_TRAITS },
];
