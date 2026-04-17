/**
 * Notable morph presets — one-click examples of iconic crested gecko looks.
 * Values intentionally map directly to the selection state shape used by the
 * visualizer so they can be loaded with a simple state replace.
 */

import { ZYGOSITY as Z } from './traits';

export const PRESETS = [
  {
    id: 'wild_type',
    name: 'Wild Type (Buckskin)',
    description: 'The non-morph baseline. Polygenic brown base with a hint of flame — what crested geckos look like before humans got involved.',
    rarityTier: 1,
    valueHint: 40,
    selections: {
      baseColor: 'buckskin',
      mendelian: {},
      patterns: { flame: 2 },
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'gold' },
      environmental: { fire_state: 'neutral', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'red_harlequin',
    name: 'Red Harlequin',
    description: 'A classic showcase morph. Saturated red base with strong cream lateral pattern.',
    rarityTier: 3,
    valueHint: 400,
    selections: {
      baseColor: 'red',
      mendelian: {},
      patterns: { harlequin: 3 },
      accents: { portholes: true },
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'copper' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'extreme_harlequin',
    name: 'Extreme Harlequin',
    description: 'Harlequin pattern extending over the back — lateral cream climbs onto the dorsum.',
    rarityTier: 3,
    valueHint: 500,
    selections: {
      baseColor: 'dark_red',
      mendelian: {},
      patterns: { harlequin: 4 },
      accents: { white_fringe: true, kneecaps: true },
      structural: { crest_size: 'heavy', tail: 'present', eye_color: 'copper' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'pinstripe_harlequin',
    name: 'Pinstripe Harlequin',
    description: '100% pinstripe stacked with strong harlequin lateral markings — a show-line staple.',
    rarityTier: 3,
    valueHint: 450,
    selections: {
      baseColor: 'orange',
      mendelian: {},
      patterns: { harlequin: 3, pinstripe: 4 },
      accents: { kneecaps: true, portholes: true },
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'copper' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'lilly_white',
    name: 'Lilly White',
    description: 'Incomplete-dominant morph — single-copy white body highlights with clean lateral contrast.',
    rarityTier: 3,
    valueHint: 500,
    selections: {
      baseColor: 'chocolate',
      mendelian: { lilly_white: Z.VISUAL },
      patterns: { harlequin: 2 },
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'copper' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'cappuccino_lw',
    name: 'Cappuccino Lilly White',
    description: 'Two proven morphs stacked — coffee-brown body with connected dorsum and white body highlights.',
    rarityTier: 4,
    valueHint: 1200,
    selections: {
      baseColor: 'chocolate',
      mendelian: { cappuccino: Z.VISUAL, lilly_white: Z.VISUAL },
      patterns: { harlequin: 1 },
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'copper' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'frappuccino',
    name: 'Frappuccino',
    description: 'Super (homozygous) Cappuccino — fully patternless cream dorsum over a dark coffee body.',
    rarityTier: 5,
    valueHint: 2500,
    selections: {
      baseColor: 'chocolate',
      mendelian: { cappuccino: Z.SUPER },
      patterns: {},
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'copper' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'axanthic',
    name: 'Axanthic',
    description: 'Recessive morph lacking warm pigment. Grayscale regardless of base color carried.',
    rarityTier: 5,
    valueHint: 1500,
    selections: {
      baseColor: 'near_black',
      mendelian: { axanthic: Z.VISUAL },
      patterns: { harlequin: 3 },
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'silver' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'moonglow_style',
    name: 'Moonglow-style',
    description: 'Hypothetical moonglow aesthetic — near-white body on a pale phantom base with LW highlights.',
    rarityTier: 5,
    valueHint: 2000,
    selections: {
      baseColor: 'cream',
      mendelian: { lilly_white: Z.VISUAL },
      patterns: { phantom: 3, patternless: 3 },
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'silver' },
      environmental: { fire_state: 'fired_down', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'super_dalmatian',
    name: 'Super Dalmatian',
    description: 'Polygenic dalmatian dense enough to blanket the body with ink spots.',
    rarityTier: 3,
    valueHint: 400,
    selections: {
      baseColor: 'cream',
      mendelian: {},
      patterns: { dalmatian: 4 },
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'gold' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'tiger',
    name: 'Tiger',
    description: 'Dark vertical banding across the ribs — polygenic and strikingly linear.',
    rarityTier: 2,
    valueHint: 200,
    selections: {
      baseColor: 'orange',
      mendelian: {},
      patterns: { tiger: 3 },
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'copper' },
      environmental: { fire_state: 'fired_up', age: 'adult', shed_state: 'normal' },
    },
  },
  {
    id: 'phantom_pinstripe',
    name: 'Phantom Pinstripe',
    description: 'Desaturated, ghostly base color with full pinstripe rails — muted contrast.',
    rarityTier: 3,
    valueHint: 300,
    selections: {
      baseColor: 'olive',
      mendelian: {},
      patterns: { phantom: 3, pinstripe: 4 },
      accents: {},
      structural: { crest_size: 'normal', tail: 'present', eye_color: 'gold' },
      environmental: { fire_state: 'neutral', age: 'adult', shed_state: 'normal' },
    },
  },
];

export const PRESETS_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

/** Default selection state — a wild-type starting point. */
export const DEFAULT_SELECTIONS = PRESETS[0].selections;
