/**
 * Custom gecko tee: the data model behind the shirt builder.
 *
 * Same shape of idea as the custom sticker. The customer uploads a photo of
 * their own crested gecko, picks a shirt colour and size, chooses where the
 * print sits and what it says, and the finished design is stored as the
 * `customization` jsonb blob on the cart line. Production prints from the
 * stored photo URL and the words in the blob.
 *
 * Nothing here is priced from the client. The price lives on the
 * store_products row (slug custom-gecko-tee) and in app_settings, and the
 * checkout function re-reads both.
 */

import { isCustomStickerLine } from '@/lib/store/customSticker';

export const CUSTOM_SHIRT_SLUG = 'custom-gecko-tee';
export const CUSTOM_SHIRT_PRICE_CENTS = 2800;
export const CUSTOM_SHIRT_DESIGN_KIND = 'custom_shirt';
export const CUSTOM_SHIRT_DESIGN_VERSION = 1;

export const SHIRT_COLORS = [
  { value: 'black', label: 'Black', hex: '#161616', ink: '#f4f4f0' },
  { value: 'forest', label: 'Forest green', hex: '#1f3a2c', ink: '#f1ead3' },
  { value: 'sand', label: 'Sand', hex: '#d9c9a5', ink: '#2b241a' },
  { value: 'white', label: 'White', hex: '#f4f2ec', ink: '#1b1b1b' },
  { value: 'slate', label: 'Slate', hex: '#3b4757', ink: '#eef2f7' },
  { value: 'maroon', label: 'Maroon', hex: '#5c1f26', ink: '#f6e9e6' },
];
export const SHIRT_COLOR_MAP = Object.fromEntries(SHIRT_COLORS.map((c) => [c.value, c]));

export const SHIRT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'].map((s) => ({ value: s, label: s }));

export const SHIRT_FITS = [
  { value: 'unisex', label: 'Unisex', blurb: 'Classic straight cut.' },
  { value: 'fitted', label: 'Fitted', blurb: 'Tapered through the body.' },
  { value: 'youth', label: 'Youth', blurb: 'Sizes S to XL run as kids sizes.' },
];

export const PRINT_PLACEMENTS = [
  { value: 'front', label: 'Full front', blurb: 'Big print across the chest.' },
  { value: 'chest', label: 'Left chest', blurb: 'Small badge, like a logo.' },
  { value: 'back', label: 'Back', blurb: 'Full print between the shoulders.' },
];

export const PRINT_STYLES = [
  { value: 'circle', label: 'Photo in a circle', blurb: 'Round photo, name below.' },
  { value: 'square', label: 'Photo, squared off', blurb: 'Photo with a thin frame, name below.' },
  { value: 'poster', label: 'Poster', blurb: 'Photo up top, big name, morph and fine print stacked under it.' },
  { value: 'badge', label: 'Badge', blurb: 'Round patch with the name arcing over the photo.' },
];

export const SHIRT_FIELD_LIMITS = {
  headline: 24,
  subline: 34,
  fine_print: 40,
};

export function createDefaultShirtDesign() {
  return {
    kind: CUSTOM_SHIRT_DESIGN_KIND,
    version: CUSTOM_SHIRT_DESIGN_VERSION,
    photo_url: '',
    photo_path: '',
    color: 'black',
    size: 'L',
    fit: 'unisex',
    placement: 'front',
    style: 'circle',
    headline: '',
    subline: '',
    fine_print: 'Geck Inspect',
  };
}

export function validateShirtDesign(design) {
  const problems = [];
  if (!design) return ['Start a design first.'];
  if (!design.photo_url) problems.push('Upload a photo of your gecko.');
  if (!String(design.headline || '').trim()) problems.push('Give the print a name (your gecko is a good start).');
  if (!SHIRT_COLOR_MAP[design.color]) problems.push('Pick a shirt colour.');
  if (!SHIRT_SIZES.some((s) => s.value === design.size)) problems.push('Pick a size.');
  return problems;
}

export function serializeShirtDesign(design) {
  const clean = (v, max) => String(v ?? '').trim().slice(0, max);
  return {
    kind: CUSTOM_SHIRT_DESIGN_KIND,
    version: CUSTOM_SHIRT_DESIGN_VERSION,
    photo_url: design.photo_url || '',
    photo_path: design.photo_path || '',
    color: SHIRT_COLOR_MAP[design.color] ? design.color : 'black',
    size: SHIRT_SIZES.some((s) => s.value === design.size) ? design.size : 'L',
    fit: SHIRT_FITS.some((f) => f.value === design.fit) ? design.fit : 'unisex',
    placement: PRINT_PLACEMENTS.some((p) => p.value === design.placement) ? design.placement : 'front',
    style: PRINT_STYLES.some((p) => p.value === design.style) ? design.style : 'circle',
    headline: clean(design.headline, SHIRT_FIELD_LIMITS.headline),
    subline: clean(design.subline, SHIRT_FIELD_LIMITS.subline),
    fine_print: clean(design.fine_print, SHIRT_FIELD_LIMITS.fine_print),
  };
}

/** Is this cart or order line a custom tee? */
export function isCustomShirtLine(line) {
  if (!line) return false;
  if (line.customization?.kind === CUSTOM_SHIRT_DESIGN_KIND) return true;
  return line.product?.slug === CUSTOM_SHIRT_SLUG;
}

/** Any personalised line, sticker or tee. */
export function isCustomLine(line) {
  return isCustomStickerLine(line) || isCustomShirtLine(line);
}

/** One-line description for cart rows, order rows, and Stripe line items. */
export function shirtDesignSummary(design) {
  if (!design) return '';
  const color = SHIRT_COLOR_MAP[design.color]?.label || design.color;
  const fit = SHIRT_FITS.find((f) => f.value === design.fit)?.label;
  const placement = PRINT_PLACEMENTS.find((p) => p.value === design.placement)?.label;
  return [design.headline, `${color} ${fit ? fit.toLowerCase() : ''} ${design.size}`.replace(/\s+/g, ' ').trim(), placement]
    .filter(Boolean)
    .join(' · ');
}
