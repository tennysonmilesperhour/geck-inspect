/**
 * Sticker themes.
 *
 * The custom sticker started life as one look, the collector card. These are
 * the other five, none of them a nod to any card game: a museum field-guide
 * plate, a passport photo page, a national-park style badge, an instant
 * photo, and a show rosette. Every theme uses the same photo upload and the
 * same die-cut vinyl; what changes is the frame around the gecko and the
 * handful of words printed on it.
 *
 * Each theme lists the design fields it prints so the builder only asks
 * for what the sticker will show. `name`, `morph_line` and the photo are
 * shared by all six.
 */

export const STICKER_THEMES = [
  {
    value: 'trading_card',
    label: 'Collector card',
    blurb: 'Power, signature moves, affinity, and edition details.',
    ratio: '2.5 / 3.5',
    fields: [],
  },
  {
    value: 'field_guide',
    label: 'Field guide plate',
    blurb: 'A museum plate on cream paper with the Latin name.',
    ratio: '3 / 4',
    fields: ['dex_number', 'height', 'weight', 'illustrator', 'caption'],
  },
  {
    value: 'passport',
    label: 'Gecko passport',
    blurb: 'Photo page with hatch year, ID and a verified stamp.',
    ratio: '3.5 / 2.5',
    fields: ['hatch_label', 'card_number', 'badge_location'],
  },
  {
    value: 'park_badge',
    label: 'Park badge',
    blurb: 'Round patch, name across the top, place along the bottom.',
    ratio: '1 / 1',
    fields: ['badge_location', 'hatch_label'],
  },
  {
    value: 'polaroid',
    label: 'Instant photo',
    blurb: 'White frame, handwritten caption.',
    ratio: '3.5 / 4.2',
    fields: ['caption', 'hatch_label'],
  },
  {
    value: 'show_rosette',
    label: 'Show rosette',
    blurb: 'Ribbon award with your gecko in the centre.',
    ratio: '1 / 1.45',
    fields: ['award_text', 'award_event'],
  },
];

export const THEME_MAP = Object.fromEntries(STICKER_THEMES.map((t) => [t.value, t]));

export function stickerTheme(value) {
  return THEME_MAP[value] || STICKER_THEMES[0];
}

export function isCardTheme(value) {
  return !value || value === 'trading_card';
}

/** Labels, hints and placeholders for the theme-only fields. */
export const THEME_FIELD_META = {
  dex_number: { label: 'Plate number', placeholder: '12', hint: 'Printed as "Plate 12" in the corner.' },
  height: { label: 'Length', placeholder: '8.5 in', hint: 'Snout to tail, or leave blank.' },
  weight: { label: 'Weight', placeholder: '42 g', hint: 'Blank hides the line.' },
  illustrator: { label: 'Collected by', placeholder: 'your name', hint: 'The small credit line.' },
  caption: { label: 'Caption', placeholder: 'Moonlight, summer 2026', hint: 'Handwritten under the photo. Blank uses the name and morph.' },
  hatch_label: { label: 'Hatched', placeholder: '2024', hint: 'A year or a date, printed as given.' },
  card_number: { label: 'ID code', placeholder: 'GI-0042', hint: 'Your own ID, or the passport code from the gecko profile.' },
  badge_location: { label: 'Place', placeholder: 'New Caledonia', hint: 'Along the bottom of the badge or the passport page.' },
  award_text: { label: 'Award', placeholder: 'Best in Show', hint: 'The words on the ribbon.' },
  award_event: { label: 'Event', placeholder: 'Geck Inspect Open 2026', hint: 'Show or occasion, printed under the award.' },
};

export const THEME_FIELD_LIMITS = {
  caption: 60,
  hatch_label: 14,
  badge_location: 26,
  award_text: 22,
  award_event: 34,
};

/** Defaults for the theme-only fields, merged into every new design. */
export function themeFieldDefaults() {
  return {
    theme: 'trading_card',
    caption: '',
    hatch_label: '',
    badge_location: 'New Caledonia',
    award_text: 'Best in Show',
    award_event: '',
  };
}
