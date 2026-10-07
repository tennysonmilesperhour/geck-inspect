/**
 * Custom pet sticker: option catalog, defaults, and validation.
 *
 * The customer builds an original collector-card sticker around a photo of
 * their own animal. The option set uses familiar game-card ideas, expressed
 * through crested gecko vocabulary and Geck Inspect's own visual system.
 *
 * The finished design is stored as the `customization` jsonb blob on the
 * cart line (store_cart_items.customization), snapshotted onto the order
 * line when checkout begins, and printed from there. Physical finish and
 * the combined sticker quantity determine the price in stickerPricing.js.
 */

import { themeFieldDefaults, THEME_FIELD_LIMITS, isCardTheme, stickerTheme } from '@/lib/store/stickerThemes';
import { CUSTOM_STICKER_SLUG, normalizeStickerFinish, stickerFinishLabel, isPricedSticker } from './stickerPricing';

export { CUSTOM_STICKER_SLUG, CUSTOM_STICKER_PRICE_CENTS } from './stickerPricing';
export const CUSTOM_STICKER_SHIPPING_CENTS = 500;
export const CUSTOM_STICKER_DESIGN_KIND = 'custom_sticker';
export const CUSTOM_STICKER_DESIGN_VERSION = 3;

/**
 * The eleven card types. `color` drives the card frame, `accent` the
 * energy pips, `glyph` the icon key resolved to a lucide component in
 * StickerCardPreview.
 */
export const CARD_TYPES = [
  { value: 'grass',     label: 'Canopy',  glyph: 'leaf',     color: '#7bbf5a', accent: '#4b7f36', text: '#14340d' },
  { value: 'fire',      label: 'Ember',   glyph: 'flame',    color: '#e2593c', accent: '#a5321c', text: '#3b0d05' },
  { value: 'water',     label: 'Mist',    glyph: 'droplet',  color: '#57a5d8', accent: '#2a6d9c', text: '#06243a' },
  { value: 'lightning', label: 'Storm',   glyph: 'zap',      color: '#e9c53f', accent: '#b08f11', text: '#3a2d02' },
  { value: 'psychic',   label: 'Moon',    glyph: 'eye',      color: '#b98ac6', accent: '#7d4f8c', text: '#2e1436' },
  { value: 'fighting',  label: 'Terra',   glyph: 'fist',     color: '#c98146', accent: '#8d5220', text: '#331904' },
  { value: 'darkness',  label: 'Night',   glyph: 'moon',     color: '#5b6b78', accent: '#2f3c47', text: '#0b1116' },
  { value: 'metal',     label: 'Silver',  glyph: 'cog',      color: '#9aa6ae', accent: '#5f6a72', text: '#141a1f' },
  { value: 'fairy',     label: 'Bloom',   glyph: 'sparkles', color: '#e79ec4', accent: '#b25b8c', text: '#3a0f27' },
  { value: 'dragon',    label: 'Crest',   glyph: 'gem',      color: '#c2a656', accent: '#8a7124', text: '#2f2506' },
  { value: 'colorless', label: 'Natural', glyph: 'star',     color: '#d9d4c9', accent: '#928c80', text: '#26231d' },
];

export const CARD_TYPE_MAP = Object.fromEntries(CARD_TYPES.map((t) => [t.value, t]));

export function cardType(value) {
  return CARD_TYPE_MAP[value] || CARD_TYPE_MAP.colorless;
}

export const CARD_STAGES = [
  { value: 'basic',   label: 'Hatchling', evolves: false },
  { value: 'stage_1', label: 'Juvenile',  evolves: true },
  { value: 'stage_2', label: 'Adult',     evolves: true },
];

export const CARD_LAYOUTS = [
  { value: 'classic', label: 'Classic collector', blurb: 'Golden frame, framed portrait, and the familiar original card proportions.' },
  { value: 'full_art', label: 'Modern full art', blurb: 'An edge-to-edge portrait, layered detail, and a crisp silver frame. Available in standard glossy or holographic.' },
];

export const BORDER_COLORS = [
  { value: 'yellow', label: 'Yellow', hex: '#f4d75e' },
  { value: 'silver', label: 'Silver', hex: '#c9ced3' },
  { value: 'gold',   label: 'Gold',   hex: '#d4a94a' },
  { value: 'black',  label: 'Black',  hex: '#1c2028' },
  { value: 'white',  label: 'White',  hex: '#f3f1ea' },
];

export const RARITIES = [
  { value: 'common',    label: 'Core',         symbol: '●' },
  { value: 'uncommon',  label: 'Select',       symbol: '◆' },
  { value: 'rare',      label: 'Featured',     symbol: '★' },
  { value: 'holo_rare', label: 'Special illustration', symbol: '✦' },
];

export const RARITY_MAP = Object.fromEntries(RARITIES.map((r) => [r.value, r]));

export const WEAKNESS_MULTIPLIERS = ['×2', '×3'];
export const RESISTANCE_AMOUNTS = ['-20', '-30'];

export const STICKER_SIZES = [
  { value: '2in', label: '2 inch', blurb: 'Laptop lid, water bottle, deli cup lid.' },
  { value: '3in', label: '3 inch', blurb: 'The usual pick. Reads clearly at arm’s length.' },
  { value: '4in', label: '4 inch', blurb: 'Rack panel, cooler, toolbox.' },
];

/** Crested-gecko-specific starter suggestions for the morph line. */
export const MORPH_LINE_SUGGESTIONS = [
  'Lilly White',
  'Extreme Harlequin',
  'Dark Base Harlequin',
  'Lavender Extreme Harlequin',
  'Tricolor Pinstripe',
  'Cappuccino Super Soft Scale',
  'Axanthic Phantom',
  'Sable Pinstripe',
  'Highway',
  'Dalmatian Cream',
];

export const MAX_ATTACKS = 2;

export const FIELD_LIMITS = {
  name: 24,
  evolves_from: 24,
  attack_name: 22,
  attack_damage: 6,
  attack_text: 90,
  illustrator: 24,
  set_code: 6,
  card_number: 4,
  set_total: 4,
  morph_line: 34,
  dex_number: 4,
  measurement: 6,
  hp_min: 10,
  hp_max: 340,
};

export const PLAQUE_STYLES = [
  { value: 'botanical', label: 'Botanical', color: '#183d32' },
  { value: 'ivory', label: 'Museum ivory', color: '#f3ead7' },
  { value: 'slate', label: 'Midnight slate', color: '#20303c' },
];

export function stickerDimensions(design) {
  const longest = { '2in': 2, '3in': 3, '4in': 4 }[design?.size] || 3;
  const [w, h] = stickerTheme(design?.theme).ratio.split('/').map(Number);
  const width = w >= h ? longest : longest * w / h;
  const height = h >= w ? longest : longest * h / w;
  return { width, height, label: `${Number(width.toFixed(2))} × ${Number(height.toFixed(2))} in` };
}

export function normalizePhotoCrop(crop) {
  const bound = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  };
  return { x: bound(crop?.x, 0, 100, 50), y: bound(crop?.y, 0, 100, 50), zoom: bound(crop?.zoom, 1, 3, 1) };
}

function emptyAttack() {
  return { name: '', cost: 1, cost_type: null, damage: '', text: '' };
}

/**
 * A fresh design. Sensible crested-gecko defaults so the live preview is
 * never an empty rectangle: the customer edits from something that
 * already looks like a card.
 */
export function createDefaultDesign() {
  return {
    kind: CUSTOM_STICKER_DESIGN_KIND,
    version: CUSTOM_STICKER_DESIGN_VERSION,
    photo_url: '',
    photo_path: '',
    photo_crop: { x: 50, y: 50, zoom: 1 },
    photo_treatment: 'original',
    layout: 'classic',
    border_color: 'yellow',
    stage: 'basic',
    evolves_from: '',
    name: '',
    hp: 100,
    type: 'grass',
    dex_number: '1',
    height: '',
    weight: '',
    attacks: [
      { name: 'Branch Grip', cost: 1, cost_type: null, damage: '20', text: 'Small toes. Unshakeable hold.' },
      { name: 'Night Pounce', cost: 2, cost_type: null, damage: '40', text: 'One perfect leap after lights out.' },
    ],
    weakness_type: 'fighting',
    weakness_multiplier: '×2',
    resistance_type: '',
    resistance_amount: '-30',
    retreat_cost: 2,
    illustrator: '',
    set_code: 'GI1',
    card_number: '1',
    set_total: '150',
    rarity: 'common',
    morph_line: '',
    size: '3in',
    finish: 'glossy',
    ...themeFieldDefaults(),
  };
}

export function addAttack(design) {
  if ((design.attacks || []).length >= MAX_ATTACKS) return design;
  return { ...design, attacks: [...(design.attacks || []), emptyAttack()] };
}

export function removeAttack(design, index) {
  const attacks = (design.attacks || []).filter((_, i) => i !== index);
  return { ...design, attacks: attacks.length ? attacks : [emptyAttack()] };
}

export function updateAttack(design, index, patch) {
  const attacks = (design.attacks || []).map((a, i) => (i === index ? { ...a, ...patch } : a));
  return { ...design, attacks };
}

/** Does this life stage show a lineage note? */
export function stageEvolves(stage) {
  return Boolean(CARD_STAGES.find((s) => s.value === stage)?.evolves);
}

/**
 * Everything that has to be true before a design can go in the cart.
 * Returns an array of human-readable problems; empty means good to go.
 */
export function validateDesign(design) {
  const problems = [];
  if (!design) return ['Start a design first.'];
  try { normalizeStickerFinish(design.finish); } catch { problems.push('Choose a standard glossy or holographic finish.'); }
  if (design.theme !== 'enclosure_plaque' && !design.photo_url) problems.push('Add a photo of your pet.');
  if (design.theme === 'enclosure_plaque') {
    if (!String(design.species_name || '').trim()) problems.push('Add the common species name.');
    if (!String(design.scientific_name || '').trim()) problems.push('Add the scientific name.');
    if (!String(design.native_range || '').trim()) problems.push('Add the species’ native range.');
  }
  if (!String(design.name || '').trim()) problems.push(isCardTheme(design.theme) ? 'Give the card a name.' : 'Give the sticker a name.');
  // Everything below is trading-card only. The other themes print the name,
  // the morph line, the photo and a few words; nothing else can be wrong.
  if (!isCardTheme(design.theme)) return problems;
  const hp = Number(design.hp);
  if (!Number.isFinite(hp) || hp < FIELD_LIMITS.hp_min || hp > FIELD_LIMITS.hp_max) {
    problems.push(`Power score has to be between ${FIELD_LIMITS.hp_min} and ${FIELD_LIMITS.hp_max}.`);
  }
  const named = (design.attacks || []).filter((a) => String(a.name || '').trim());
  if (named.length === 0) problems.push('Name at least one signature move.');
  return problems;
}

/** Strip the design down to what we persist on the cart line. */
export function serializeDesign(design) {
  const clean = (v, max) => String(v ?? '').trim().slice(0, max);
  return {
    kind: CUSTOM_STICKER_DESIGN_KIND,
    version: CUSTOM_STICKER_DESIGN_VERSION,
    photo_url: design.theme === 'enclosure_plaque' ? '' : design.photo_url || '',
    photo_path: design.theme === 'enclosure_plaque' ? '' : design.photo_path || '',
    photo_crop: normalizePhotoCrop(design.photo_crop),
    photo_treatment: design.photo_treatment === 'cutout' ? 'cutout' : 'original',
    plaque_style: PLAQUE_STYLES.some((s) => s.value === design.plaque_style) ? design.plaque_style : 'botanical',
    species_name: clean(design.species_name, THEME_FIELD_LIMITS.species_name),
    scientific_name: clean(design.scientific_name, THEME_FIELD_LIMITS.scientific_name),
    native_range: clean(design.native_range, THEME_FIELD_LIMITS.native_range),
    habitat: clean(design.habitat, THEME_FIELD_LIMITS.habitat),
    layout: CARD_LAYOUTS.some((l) => l.value === design.layout) ? design.layout : 'classic',
    border_color: design.border_color || 'yellow',
    stage: design.stage || 'basic',
    evolves_from: stageEvolves(design.stage) ? clean(design.evolves_from, FIELD_LIMITS.evolves_from) : '',
    name: clean(design.name, FIELD_LIMITS.name),
    hp: Number(design.hp) || FIELD_LIMITS.hp_min,
    type: design.type || 'colorless',
    dex_number: clean(design.dex_number, FIELD_LIMITS.dex_number),
    height: clean(design.height, FIELD_LIMITS.measurement),
    weight: clean(design.weight, FIELD_LIMITS.measurement),
    attacks: (design.attacks || [])
      .filter((a) => String(a.name || '').trim())
      .slice(0, MAX_ATTACKS)
      .map((a) => ({
        name: clean(a.name, FIELD_LIMITS.attack_name),
        cost: Math.max(0, Math.min(4, Number(a.cost) || 0)),
        cost_type: a.cost_type || null,
        damage: clean(a.damage, FIELD_LIMITS.attack_damage),
        text: clean(a.text, FIELD_LIMITS.attack_text),
      })),
    weakness_type: design.weakness_type || '',
    weakness_multiplier: design.weakness_multiplier || '×2',
    resistance_type: design.resistance_type || '',
    resistance_amount: design.resistance_amount || '-30',
    retreat_cost: Math.max(0, Math.min(4, Number(design.retreat_cost) || 0)),
    illustrator: clean(design.illustrator, FIELD_LIMITS.illustrator),
    set_code: clean(design.set_code, FIELD_LIMITS.set_code),
    card_number: clean(design.card_number, FIELD_LIMITS.card_number),
    set_total: clean(design.set_total, FIELD_LIMITS.set_total),
    rarity: design.rarity || 'common',
    morph_line: clean(design.morph_line, FIELD_LIMITS.morph_line),
    size: design.size || '3in',
    finish: normalizeStickerFinish(design.finish),
    theme: stickerTheme(design.theme).value,
    caption: clean(design.caption, THEME_FIELD_LIMITS.caption),
    hatch_label: clean(design.hatch_label, THEME_FIELD_LIMITS.hatch_label),
    badge_location: clean(design.badge_location, THEME_FIELD_LIMITS.badge_location),
    award_text: clean(design.award_text, THEME_FIELD_LIMITS.award_text),
    award_event: clean(design.award_event, THEME_FIELD_LIMITS.award_event),
  };
}

/** Is this cart or order line a custom sticker? */
export function isCustomStickerLine(line) {
  if (!line) return false;
  if (line.customization?.kind === CUSTOM_STICKER_DESIGN_KIND) return true;
  return line.product?.slug === CUSTOM_STICKER_SLUG;
}

/** One-line description for cart rows, order rows, and Stripe line items. */
export function designSummary(design) {
  if (!design) return '';
  const finish = stickerFinishLabel(design.finish);
  const size = STICKER_SIZES.find((s) => s.value === design.size)?.label || design.size;
  if (design.theme === 'enclosure_plaque') {
    return [design.name, 'Enclosure plaque sticker', design.species_name, stickerDimensions(design).label, finish].filter(Boolean).join(' · ');
  }
  if (!isCardTheme(design.theme)) {
    return [design.name, stickerTheme(design.theme).label, design.morph_line, size, finish].filter(Boolean).join(' · ');
  }
  const type = cardType(design.type).label;
  return [design.name, `${type} · ${design.hp} power`, size, finish]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Flat shipping for a cart. An order made up entirely of custom stickers
 * ships for a flat $5 no matter how many stickers are in it. Any other
 * mix falls back to the normal store shipping rules, and the stickers
 * ride along inside that shipment at no extra charge.
 */
export function stickerOnlyCart(items) {
  const list = items || [];
  return list.length > 0 && list.every(isPricedSticker);
}
