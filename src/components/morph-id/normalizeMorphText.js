import {
  PRIMARY_MORPHS,
  GENETIC_TRAITS,
  SECONDARY_TRAITS,
  BASE_COLORS,
  FIRED_STATES,
} from './morphTaxonomy';

// Maps free-text morph labels (MorphMarket listings, Instagram captions, etc.)
// into our canonical taxonomy ids. Conservative by design ,  if a token can't
// be confidently mapped, it's returned under `unmapped` so a human can review
// rather than silently dropped or guessed. Callers typically:
//   1. Run the raw listing text through `normalizeMorphText(text)`.
//   2. Prefill the contribution / scrape row with the matched ids.
//   3. Show `unmapped` terms to an operator to extend the aliases below.

const ALIASES = {
  // Primary morphs ,  synonyms, abbreviations, and marketing terms.
  extreme_harlequin: ['extreme harlequin', 'ext harle', 'ext harley', 'ehr', 'ehq', 'e-harle'],
  super_harlequin:   ['super harlequin', 'super harle', 'sh', 's-harle'],
  harlequin:         ['harlequin', 'harle', 'harley', 'harl', 'hq'],
  full_pinstripe:    ['full pinstripe', 'full pin', '100% pin', 'full pinstriped'],
  partial_pinstripe: ['partial pinstripe', 'partial pin', 'broken pin'],
  phantom_pinstripe: ['phantom pinstripe', 'phantom pin'],
  reverse_pinstripe: ['reverse pinstripe', 'reverse pin'],
  quad_stripe:       ['quad stripe', 'quadstripe', 'quad-stripe'],
  super_stripe:      ['super stripe', 'superstripe', 'super-stripe'],
  pinstripe:         ['pinstripe', 'pin', 'pinstriped'],
  chevron_flame:     ['chevron flame', 'chevron-flame'],
  flame:             ['flame', 'flamed'],
  super_tiger:       ['super tiger'],
  tiger:             ['tiger', 'tigered', 'striped tiger'],
  extreme_brindle:   ['extreme brindle', 'ext brindle'],
  brindle:           ['brindle', 'brindled'],
  super_dalmatian:   ['super dalmatian', 'super dally', 'super dal', 'super dalmation'],
  red_dalmatian:     ['red dalmatian', 'red dally', 'red dalmation'],
  dalmatian:         ['dalmatian', 'dally', 'dal', 'dalmation', 'spotted'],
  ink_spot:          ['ink spot', 'inkspot', 'ink-spot', 'ink spots'],
  patternless:       ['patternless', 'no pattern', 'solid'],
  tricolor:          ['tricolor', 'tri-color', 'tri color', 'tri'],
  bicolor:           ['bicolor', 'bi-color', 'bi color', 'two-tone', 'two tone', 'bi'],

  // Named genetic traits
  lily_white:    ['lily white', 'lilly white', 'lily-white', 'lilly-white', 'lily', 'lw'],
  axanthic_vca:  ['axanthic vca', 'vca axanthic', 'axanthic (vca)', 'vca line axanthic'],
  axanthic_tsm:  ['axanthic tsm', 'tsm axanthic', 'axanthic (tsm)'],
  cappuccino:    ['cappuccino', 'cappu', 'capp'],
  frappuccino:   ['frappuccino', 'frappu', 'frapp'],
  moonglow:      ['moonglow', 'moon glow'],
  soft_scale:    ['soft scale', 'softscale', 'soft-scale'],
  whiteout:      ['whiteout', 'white-out', 'white out'],
  empty_back:    ['empty back', 'emptyback', 'empty-back'],
  white_wall:    ['white wall', 'whitewall', 'white-wall'],
  hypo:          ['hypo', 'hypomelanistic'],
  melanistic:    ['melanistic', 'melano', 'dark phase'],

  // Secondary traits (most are single-word enough that the code below picks
  // them up via id-as-slug matching; aliases cover only the fuzzier ones).
  white_fringe:        ['white fringe', 'white fringing', 'fringe'],
  portholes:           ['portholes', 'porthole'],
  kneecaps:            ['kneecaps', 'knee caps', 'white kneecaps'],
  drippy_dorsal:       ['drippy dorsal', 'melted dorsal', 'melty dorsal'],
  white_tipped_crests: ['white tipped crests', 'white-tipped crests', 'white crest tips'],
  colored_crests:      ['colored crests', 'coloured crests', 'red crests', 'yellow crests'],
  high_contrast:       ['high contrast', 'hi-contrast', 'hi contrast'],
  high_white:          ['high white', 'hi white'],
  tailless:            ['tailless', 'frog butt', 'frogbutt', 'no tail'],

  // Fired state phrases
  fired_up:            ['fired up', 'fired-up', 'firedup'],
  fired_down:          ['fired down', 'fired-down', 'fireddown'],
};

const BASE_COLOR_ALIASES = {
  near_black:    ['near black', 'near-black', 'almost black'],
  dark_red:      ['dark red'],
  bright_yellow: ['bright yellow'],
  burnt_orange:  ['burnt orange'],
  dark_olive:    ['dark olive'],
  dark_brown:    ['dark brown'],
};

function buildLookups() {
  const lookup = new Map();
  const add = (id, phrase) => {
    const key = phrase.toLowerCase().trim();
    if (!key || lookup.has(key)) return;
    lookup.set(key, id);
  };

  // 1. Canonical id slugs and labels.
  const all = [
    ...PRIMARY_MORPHS, ...GENETIC_TRAITS, ...SECONDARY_TRAITS,
    ...BASE_COLORS, ...FIRED_STATES,
  ];
  for (const entry of all) {
    add(entry.id, entry.id);
    add(entry.id, entry.id.replace(/_/g, ' '));
    if (entry.label) add(entry.id, entry.label);
  }

  // 2. Hand-curated aliases (take precedence over label-only matches).
  for (const [id, phrases] of Object.entries(ALIASES)) {
    for (const p of phrases) add(id, p);
  }
  for (const [id, phrases] of Object.entries(BASE_COLOR_ALIASES)) {
    for (const p of phrases) add(id, p);
  }

  return lookup;
}

const LOOKUP = buildLookups();

// Sort phrases longest-first so "extreme harlequin" wins over "harlequin"
// during greedy scan.
const PHRASES = [...LOOKUP.keys()].sort((a, b) => b.length - a.length);

const PRIMARY_IDS = new Set(PRIMARY_MORPHS.map((m) => m.id));
const GENETIC_IDS = new Set(GENETIC_TRAITS.map((g) => g.id));
const SECONDARY_IDS = new Set(SECONDARY_TRAITS.map((t) => t.id));
const BASE_COLOR_IDS = new Set(BASE_COLORS.map((c) => c.id));
const FIRED_STATE_IDS = new Set(FIRED_STATES.map((f) => f.id));

function sexFrom(text) {
  if (/\bmale\b/i.test(text) && !/\bfemale\b/i.test(text)) return 'male';
  if (/\bfemale\b/i.test(text)) return 'female';
  if (/\bunsexed\b/i.test(text)) return 'unsexed';
  return null;
}

function ageStageFrom(text) {
  if (/\bhatchling\b/i.test(text)) return 'hatchling';
  if (/\bjuvenile|juvie\b/i.test(text)) return 'juvenile';
  if (/\bsub[\s-]?adult\b/i.test(text)) return 'subadult';
  if (/\badult\b/i.test(text)) return 'adult';
  return null;
}

function hetsFrom(text) {
  // "het axanthic", "het lily", "100% het cappuccino"
  const hets = new Set();
  const rx = /(?:\d{1,3}%\s*)?het(?:erozygous)?\s+([a-z][a-z0-9 _-]+?)(?=[.,;\n]|$)/gi;
  let m;
  while ((m = rx.exec(text)) != null) {
    const phrase = m[1].trim().toLowerCase();
    const id = LOOKUP.get(phrase);
    if (id && GENETIC_IDS.has(id)) hets.add(id);
  }
  return [...hets];
}

export function normalizeMorphText(input) {
  const text = String(input || '').toLowerCase();
  if (!text) {
    return {
      primary_morph: null,
      genetic_traits: [],
      secondary_traits: [],
      base_color: null,
      fired_state: null,
      sex: null,
      age_stage: null,
      known_hets: [],
      unmapped: [],
    };
  }

  // Mask out matched phrases so longer aliases don't let shorter ones
  // double-count (e.g. "extreme harlequin" should not also fire "harlequin").
  let remaining = ` ${text.replace(/[()]/g, ' ')} `;
  const hits = new Set();
  for (const phrase of PHRASES) {
    // Token-boundary match so "dal" doesn't fire inside "dalmatian".
    const needle = ` ${phrase} `;
    let idx = remaining.indexOf(needle);
    while (idx !== -1) {
      hits.add(LOOKUP.get(phrase));
      remaining = remaining.slice(0, idx) + ' '.repeat(needle.length) + remaining.slice(idx + needle.length);
      idx = remaining.indexOf(needle);
    }
  }

  let primary = null;
  const genetics = [];
  const secondary = [];
  let baseColor = null;
  let firedState = null;

  for (const id of hits) {
    if (!primary && PRIMARY_IDS.has(id)) primary = id;
    else if (GENETIC_IDS.has(id) && !genetics.includes(id)) genetics.push(id);
    else if (SECONDARY_IDS.has(id) && !secondary.includes(id)) secondary.push(id);
    else if (!baseColor && BASE_COLOR_IDS.has(id)) baseColor = id;
    else if (!firedState && FIRED_STATE_IDS.has(id)) firedState = id;
  }

  // Residual alphanumeric tokens that didn't match anything ,  the operator
  // can extend aliases based on what shows up here.
  const unmapped = remaining
    .split(/[^a-z0-9%-]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2 && !/^\d+%?$/.test(s));

  return {
    primary_morph: primary,
    genetic_traits: genetics,
    secondary_traits: secondary,
    base_color: baseColor,
    fired_state: firedState,
    sex: sexFrom(text),
    age_stage: ageStageFrom(text),
    known_hets: hetsFrom(text),
    unmapped: [...new Set(unmapped)].slice(0, 30),
  };
}
