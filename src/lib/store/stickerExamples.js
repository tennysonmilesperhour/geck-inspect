/**
 * The two reference stickers shown on the custom sticker page.
 *
 * Each entry carries both a printed image and the design spec behind it.
 * If the printed image is missing (it lives in public/store/custom-stickers/
 * and is not in version control until the photo is dropped in), the gallery
 * falls back to rendering the spec through StickerCardPreview, so the page
 * is never broken and always shows what the options do.
 */

export const STICKER_EXAMPLES = [
  {
    id: 'moonlight',
    image: '/store/custom-stickers/moonlight.png',
    caption: 'Classic frame, Psychic, two attacks.',
    note: 'Stage 1 with an evolves-from line, HT/WT bar under the photo, weakness and retreat along the bottom.',
    design: {
      kind: 'custom_sticker',
      version: 1,
      photo_url: '',
      layout: 'classic',
      border_color: 'yellow',
      stage: 'stage_1',
      evolves_from: 'starlight',
      name: 'Moonlight',
      hp: 100,
      type: 'psychic',
      dex_number: '1',
      height: '12',
      weight: '12',
      attacks: [
        { name: 'Bark', cost: 3, cost_type: 'psychic', damage: '0', text: 'Super cute, not very effective.' },
        { name: 'Scramble', cost: 2, cost_type: 'psychic', damage: '10-', text: 'Confuses the enemy. Small chance of losing her tail.' },
      ],
      weakness_type: 'fighting',
      weakness_multiplier: '×2',
      resistance_type: '',
      resistance_amount: '-30',
      retreat_cost: 3,
      illustrator: 'tennyson',
      set_code: 'SV1',
      card_number: '2',
      set_total: '150',
      rarity: 'common',
      morph_line: 'Lavender Extreme Harlequin',
      size: '3in',
      finish: 'glossy',
    },
  },
  {
    id: 'bat-geck',
    image: '/store/custom-stickers/bat-geck.png',
    caption: 'Full art, silver border, no attack block.',
    note: 'The photo runs edge to edge. Name, HP, and type sit on top; weakness, retreat, and the morph line sit along the bottom.',
    design: {
      kind: 'custom_sticker',
      version: 1,
      photo_url: '',
      layout: 'full_art',
      border_color: 'silver',
      stage: 'stage_1',
      evolves_from: 'geck geck',
      name: 'Bat Geck',
      hp: 100,
      type: 'psychic',
      dex_number: '',
      height: '',
      weight: '',
      attacks: [],
      weakness_type: 'lightning',
      weakness_multiplier: '×2',
      resistance_type: '',
      resistance_amount: '-30',
      retreat_cost: 3,
      illustrator: '',
      set_code: 'SV1',
      card_number: '1',
      set_total: '150',
      rarity: 'common',
      morph_line: 'Dark Base Harlequin',
      size: '3in',
      finish: 'holographic',
    },
  },
];

/** Load one example into the builder as a starting point. */
export function exampleAsStartingDesign(example) {
  return { ...example.design, photo_url: '', photo_path: '', name: '', morph_line: example.design.morph_line };
}
