/**
 * Mock data for guest-mode demos.
 *
 * Intercepts read operations on the Supabase entity layer so a visitor
 * in guest mode sees a populated, interactive app shell rather than a
 * sea of empty states.
 *
 * Design notes:
 * - Every mock record uses `created_by: GUEST_EMAIL` so pages that
 *   filter "mine" by email match cleanly.
 * - Images come from Picsum (https://picsum.photos/seed/<seed>/...).
 *   Picsum is a free service that returns stable Unsplash photos keyed
 *   by a seed string. They are used here for UI demonstration only —
 *   the photos don't necessarily depict crested geckos, let alone the
 *   specific traits each mock record claims to have. The guest-mode
 *   disclaimer toast makes this explicit to the visitor.
 * - Writes are still blocked by `blockIfGuest()` in the entity layer;
 *   this module only powers reads.
 */

export const GUEST_EMAIL = 'guest@local';

// Fair-use crested gecko photos from Wikimedia Commons, served via the
// stable Special:FilePath redirect. Every file below is licensed under
// CC-BY-SA or equivalent and hotlinkable for demonstration. Because the
// demo assigns these images to mock records by index — not by actual
// morph — the guest disclaimer toast explicitly notes the photo may
// not depict the traits the record claims.
const GECKO_PHOTOS = [
  'https://commons.wikimedia.org/wiki/Special:FilePath/Crested_gecko_2.JPG?width=640',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Crested_gecko_-_1.jpg?width=640',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Correlophus_ciliatus_-_Crested_gecko_02.jpg?width=640',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Rhacodactylus_ciliatus_-_Tiergarten_Sch%C3%B6nbrunn_2.jpg?width=640',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Kronengecko_Correlophus_ciliatus.jpg?width=640',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Correlophus_ciliatus_lateral.jpg?width=640',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Rhacodactylus_ciliatus.jpg?width=640',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Correlophus_ciliatus_Wilhelma.jpg?width=640',
];

// Inline SVG fallback (emerald card with the morph name) served as a
// data URI so broken Wikimedia URLs never surface as a broken-image
// icon in the demo. Consumers can set this as `onError` via the
// exported fallbackForMorph() helper where it's reachable.
export function fallbackForMorph(label = 'Crested Gecko') {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0' stop-color='#0d1f17'/>
        <stop offset='1' stop-color='#1a3a2d'/>
      </linearGradient>
    </defs>
    <rect width='600' height='600' fill='url(#g)'/>
    <text x='300' y='300' text-anchor='middle' dominant-baseline='middle'
      fill='#86efac' font-family='Inter, sans-serif' font-size='32' font-weight='700'>
      ${String(label).replace(/[<>&]/g, '').slice(0, 24)}
    </text>
    <text x='300' y='350' text-anchor='middle' fill='#4ade80aa'
      font-family='Inter, sans-serif' font-size='16'>
      demo image
    </text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Deterministic photo pick so the same gecko always shows the same
// photo across refreshes and navigations.
const IMG = (seed) => {
  let h = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % GECKO_PHOTOS.length;
  return GECKO_PHOTOS[idx];
};

const nowMs = Date.now();
const daysAgo = (n) => new Date(nowMs - n * 86400000).toISOString();
const monthsAgo = (n) => daysAgo(n * 30);

// ---------------------------------------------------------------------------
// Geckos
//
// Lineage map (demoes the 3-generation pedigree tree):
//
//   Gen 1 (founders, archived):
//     Diamond ♂  Ruby ♀       Thor ♂  Sunny ♀
//          \    /                 \    /
//   Gen 2:  Harley ♀  ✕  Spud ♂
//                 |
//   Gen 3:  Nimbus ♂ · Pebble ♀ · Jasper ♂
//
// Harley and Spud carry sire_id/dam_id pointing at the founders; the
// Gen 3 hatchlings carry sire_id/dam_id pointing at Harley and Spud.
// ---------------------------------------------------------------------------
const GECKOS = [
  // ---- Gen 1 — founders (archived, retained for pedigree display) ----
  {
    id: 'mock-gecko-gp1-diamond',
    name: 'Diamond',
    sex: 'Male',
    status: 'Proven',
    hatch_date: '2018-06-11',
    weight_grams: 54,
    primary_morph: 'Harlequin',
    morphs_traits: 'Harlequin, High-Contrast',
    morph_tags: ['Harlequin', 'High-Contrast'],
    image_urls: [IMG('diamond-01')],
    gecko_id_code: 'GI-F01',
    species: 'Crested Gecko',
    generation: 1,
    archived: true,
    archive_reason: 'retired',
    archived_date: daysAgo(250),
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(2100),
  },
  {
    id: 'mock-gecko-gp2-ruby',
    name: 'Ruby',
    sex: 'Female',
    status: 'Proven',
    hatch_date: '2018-04-02',
    weight_grams: 50,
    primary_morph: 'Cream',
    morphs_traits: 'Cream, Partial Pin',
    morph_tags: ['Cream', 'Pinstripe'],
    image_urls: [IMG('ruby-01')],
    gecko_id_code: 'GI-F02',
    species: 'Crested Gecko',
    generation: 1,
    archived: true,
    archive_reason: 'retired',
    archived_date: daysAgo(230),
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(2200),
  },
  {
    id: 'mock-gecko-gp3-thor',
    name: 'Thor',
    sex: 'Male',
    status: 'Proven',
    hatch_date: '2017-08-25',
    weight_grams: 58,
    primary_morph: 'Pinstripe',
    morphs_traits: 'Pinstripe, Full',
    morph_tags: ['Pinstripe'],
    image_urls: [IMG('thor-01')],
    gecko_id_code: 'GI-F03',
    species: 'Crested Gecko',
    generation: 1,
    archived: true,
    archive_reason: 'death',
    archived_date: daysAgo(180),
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(2400),
  },
  {
    id: 'mock-gecko-gp4-sunny',
    name: 'Sunny',
    sex: 'Female',
    status: 'Proven',
    hatch_date: '2017-11-03',
    weight_grams: 49,
    primary_morph: 'Yellow',
    morphs_traits: 'Yellow, Partial Pin',
    morph_tags: ['Yellow', 'Pinstripe'],
    image_urls: [IMG('sunny-01')],
    gecko_id_code: 'GI-F04',
    species: 'Crested Gecko',
    generation: 1,
    archived: true,
    archive_reason: 'sold',
    archived_date: daysAgo(320),
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(2300),
  },

  // ---- Gen 2 — active parents ----
  {
    id: 'mock-gecko-1',
    name: 'Harley',
    sex: 'Female',
    status: 'Proven',
    hatch_date: '2022-08-14',
    weight_grams: 52,
    primary_morph: 'Harlequin',
    morphs_traits: 'Harlequin, Cream, High-Contrast',
    morph_tags: ['Harlequin', 'Cream', 'High-Contrast'],
    image_urls: [IMG('harley-01'), IMG('harley-02')],
    gecko_id_code: 'GI-001',
    species: 'Crested Gecko',
    generation: 2,
    sire_id: 'mock-gecko-gp1-diamond',
    dam_id: 'mock-gecko-gp2-ruby',
    sire_name: 'Diamond',
    dam_name: 'Ruby',
    is_gravid: true,
    asking_price: null,
    archived: false,
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(420),
  },
  {
    id: 'mock-gecko-2',
    name: 'Spud',
    sex: 'Male',
    status: 'Proven',
    hatch_date: '2021-05-02',
    weight_grams: 48,
    primary_morph: 'Pinstripe',
    morphs_traits: 'Pinstripe, Yellow, Partial',
    morph_tags: ['Pinstripe', 'Yellow'],
    image_urls: [IMG('spud-01')],
    gecko_id_code: 'GI-002',
    species: 'Crested Gecko',
    generation: 2,
    sire_id: 'mock-gecko-gp3-thor',
    dam_id: 'mock-gecko-gp4-sunny',
    sire_name: 'Thor',
    dam_name: 'Sunny',
    archived: false,
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(600),
  },
  {
    id: 'mock-gecko-3',
    name: 'Moss',
    sex: 'Female',
    status: 'Ready to Breed',
    hatch_date: '2023-02-19',
    weight_grams: 41,
    primary_morph: 'Dalmatian',
    morphs_traits: 'Dalmatian, Red Base, Black Spots',
    morph_tags: ['Dalmatian', 'Red'],
    image_urls: [IMG('moss-01'), IMG('moss-02')],
    gecko_id_code: 'GI-003',
    species: 'Crested Gecko',
    sire_name: null,
    dam_name: null,
    archived: false,
    feeding_group_id: 'mock-feed-2',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(260),
  },
  {
    id: 'mock-gecko-4',
    name: 'Nimbus',
    sex: 'Male',
    status: 'Holdback',
    hatch_date: '2024-06-30',
    weight_grams: 22,
    primary_morph: 'Lilly White',
    morphs_traits: 'Lilly White, Harlequin',
    morph_tags: ['Lilly White', 'Harlequin'],
    image_urls: [IMG('nimbus-01')],
    gecko_id_code: 'GI-004',
    species: 'Crested Gecko',
    generation: 3,
    sire_id: 'mock-gecko-2',
    dam_id: 'mock-gecko-1',
    sire_name: 'Spud',
    dam_name: 'Harley',
    clutch_id: 'mock-clutch-2025-harley-spud',
    archived: false,
    feeding_group_id: 'mock-feed-3',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(90),
  },
  // Siblings of Nimbus — same clutch, Harley × Spud 2025
  {
    id: 'mock-gecko-off-pebble',
    name: 'Pebble',
    sex: 'Female',
    status: 'Holdback',
    hatch_date: '2024-07-02',
    weight_grams: 21,
    primary_morph: 'Harlequin',
    morphs_traits: 'Harlequin Pinstripe, Cream Base',
    morph_tags: ['Harlequin', 'Pinstripe', 'Cream'],
    image_urls: [IMG('pebble-01')],
    gecko_id_code: 'GI-013',
    species: 'Crested Gecko',
    generation: 3,
    sire_id: 'mock-gecko-2',
    dam_id: 'mock-gecko-1',
    sire_name: 'Spud',
    dam_name: 'Harley',
    clutch_id: 'mock-clutch-2025-harley-spud',
    archived: false,
    feeding_group_id: 'mock-feed-3',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(88),
  },
  {
    id: 'mock-gecko-off-jasper',
    name: 'Jasper',
    sex: 'Male',
    status: 'For Sale',
    hatch_date: '2024-09-14',
    weight_grams: 16,
    primary_morph: 'Pinstripe',
    morphs_traits: 'Pinstripe, Cream Dorsal',
    morph_tags: ['Pinstripe', 'Cream'],
    image_urls: [IMG('jasper-01'), IMG('jasper-02')],
    gecko_id_code: 'GI-014',
    species: 'Crested Gecko',
    generation: 3,
    sire_id: 'mock-gecko-2',
    dam_id: 'mock-gecko-1',
    sire_name: 'Spud',
    dam_name: 'Harley',
    clutch_id: 'mock-clutch-2025b-harley-spud',
    asking_price: 225,
    archived: false,
    feeding_group_id: 'mock-feed-3',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(15),
  },
  {
    id: 'mock-gecko-off-fern',
    name: 'Fern',
    sex: 'Unsexed',
    status: 'Future Breeder',
    hatch_date: '2024-10-03',
    weight_grams: 12,
    primary_morph: 'Harlequin',
    morphs_traits: 'Harlequin, Yellow Base',
    morph_tags: ['Harlequin', 'Yellow'],
    image_urls: [IMG('fern-01')],
    gecko_id_code: 'GI-015',
    species: 'Crested Gecko',
    generation: 3,
    sire_id: 'mock-gecko-8',
    dam_id: 'mock-gecko-10',
    sire_name: 'Onyx',
    dam_name: 'Aria',
    clutch_id: 'mock-clutch-2025-aria-onyx',
    archived: false,
    feeding_group_id: 'mock-feed-3',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(5),
  },
  {
    id: 'mock-gecko-5',
    name: 'Cappy',
    sex: 'Male',
    status: 'Future Breeder',
    hatch_date: '2023-09-12',
    weight_grams: 34,
    primary_morph: 'Cappuccino',
    morphs_traits: 'Cappuccino, Dark Base',
    morph_tags: ['Cappuccino'],
    image_urls: [IMG('cappy-01')],
    gecko_id_code: 'GI-005',
    species: 'Crested Gecko',
    archived: false,
    feeding_group_id: 'mock-feed-2',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(180),
  },
  {
    id: 'mock-gecko-6',
    name: 'Ember',
    sex: 'Female',
    status: 'For Sale',
    hatch_date: '2023-04-03',
    weight_grams: 44,
    primary_morph: 'Flame',
    morphs_traits: 'Flame, Red, Full Stripe',
    morph_tags: ['Flame', 'Red'],
    image_urls: [IMG('ember-01'), IMG('ember-02')],
    gecko_id_code: 'GI-006',
    species: 'Crested Gecko',
    asking_price: 350,
    archived: false,
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(230),
  },
  {
    id: 'mock-gecko-7',
    name: 'Pixel',
    sex: 'Unsexed',
    status: 'Pet',
    hatch_date: '2024-11-07',
    weight_grams: 9,
    primary_morph: 'Brindle',
    morphs_traits: 'Brindle, Chocolate',
    morph_tags: ['Brindle'],
    image_urls: [IMG('pixel-01')],
    gecko_id_code: 'GI-007',
    species: 'Crested Gecko',
    archived: false,
    feeding_group_id: 'mock-feed-3',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(45),
  },
  {
    id: 'mock-gecko-8',
    name: 'Onyx',
    sex: 'Male',
    status: 'Proven',
    hatch_date: '2020-10-21',
    weight_grams: 56,
    primary_morph: 'Axanthic',
    morphs_traits: 'Axanthic, Reverse Pin',
    morph_tags: ['Axanthic', 'Pinstripe'],
    image_urls: [IMG('onyx-01'), IMG('onyx-02')],
    gecko_id_code: 'GI-008',
    species: 'Crested Gecko',
    archived: false,
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(780),
  },
  {
    id: 'mock-gecko-9',
    name: 'Tiger',
    sex: 'Female',
    status: 'Proven',
    hatch_date: '2022-03-18',
    weight_grams: 47,
    primary_morph: 'Tiger',
    morphs_traits: 'Tiger, Orange Base',
    morph_tags: ['Tiger'],
    image_urls: [IMG('tiger-01')],
    gecko_id_code: 'GI-009',
    species: 'Crested Gecko',
    archived: false,
    feeding_group_id: 'mock-feed-2',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(540),
  },
  {
    id: 'mock-gecko-10',
    name: 'Aria',
    sex: 'Female',
    status: 'Ready to Breed',
    hatch_date: '2022-12-01',
    weight_grams: 43,
    primary_morph: 'Harlequin',
    morphs_traits: 'Harlequin, Tricolor',
    morph_tags: ['Harlequin', 'Tricolor'],
    image_urls: [IMG('aria-01'), IMG('aria-02')],
    gecko_id_code: 'GI-010',
    species: 'Crested Gecko',
    archived: false,
    feeding_group_id: 'mock-feed-1',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(460),
  },
  {
    id: 'mock-gecko-11',
    name: 'Bramble',
    sex: 'Male',
    status: 'Future Breeder',
    hatch_date: '2024-02-22',
    weight_grams: 28,
    primary_morph: 'Pinstripe',
    morphs_traits: 'Pinstripe, Dalmatian',
    morph_tags: ['Pinstripe', 'Dalmatian'],
    image_urls: [IMG('bramble-01')],
    gecko_id_code: 'GI-011',
    species: 'Crested Gecko',
    archived: false,
    feeding_group_id: 'mock-feed-3',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(150),
  },
  {
    id: 'mock-gecko-12',
    name: 'Willow',
    sex: 'Female',
    status: 'Proven',
    hatch_date: '2021-09-09',
    weight_grams: 50,
    primary_morph: 'Cream',
    morphs_traits: 'Cream, Partial Pin',
    morph_tags: ['Cream', 'Pinstripe'],
    image_urls: [IMG('willow-01')],
    gecko_id_code: 'GI-012',
    species: 'Crested Gecko',
    archived: false,
    feeding_group_id: 'mock-feed-2',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(680),
  },
];

// ---------------------------------------------------------------------------
// Gecko images (Gallery feed)
// ---------------------------------------------------------------------------
const GECKO_IMAGES = GECKOS.flatMap((g, i) =>
  (g.image_urls || []).map((url, j) => ({
    id: `mock-img-${i + 1}-${j + 1}`,
    image_url: url,
    gecko_id: g.id,
    primary_morph: g.primary_morph,
    secondary_traits: g.morph_tags,
    caption: `${g.name} — ${g.primary_morph}`,
    verified: j === 0,
    likes_count: 5 + ((i * 3 + j) % 40),
    created_by: GUEST_EMAIL,
    created_date: daysAgo(i * 7 + j),
  }))
);

// ---------------------------------------------------------------------------
// Weight records — simple growth curve per gecko
// ---------------------------------------------------------------------------
const WEIGHT_RECORDS = GECKOS.flatMap((g, gi) => {
  const target = g.weight_grams;
  const points = 6;
  return Array.from({ length: points }, (_, i) => {
    const progress = (i + 1) / points;
    const jitter = ((gi + i) % 3) - 1;
    return {
      id: `mock-wr-${g.id}-${i}`,
      gecko_id: g.id,
      weight_grams: Math.max(3, Math.round(target * progress + jitter)),
      record_date: daysAgo((points - i) * 45),
      created_by: GUEST_EMAIL,
      created_date: daysAgo((points - i) * 45),
    };
  });
});

// ---------------------------------------------------------------------------
// Breeding plans + eggs
// ---------------------------------------------------------------------------
const BREEDING_PLANS = [
  {
    id: 'mock-bp-1',
    breeding_id: 'Harley × Spud 2026',
    sire_id: 'mock-gecko-2',
    dam_id: 'mock-gecko-1',
    pairing_date: daysAgo(90),
    breeding_season: '2026 Spring',
    status: 'Active',
    laying_active: true,
    archived: false,
    notes: 'Strong pattern expressed on both sides. Hoping for harley pins.',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(90),
  },
  {
    id: 'mock-bp-2',
    breeding_id: 'Aria × Onyx 2026',
    sire_id: 'mock-gecko-8',
    dam_id: 'mock-gecko-10',
    pairing_date: daysAgo(60),
    breeding_season: '2026 Spring',
    status: 'Active',
    laying_active: true,
    archived: false,
    notes: 'Targeting axanthic tricolor hatchlings.',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(60),
  },
  {
    id: 'mock-bp-3',
    breeding_id: 'Moss × Cappy 2026',
    sire_id: 'mock-gecko-5',
    dam_id: 'mock-gecko-3',
    pairing_date: daysAgo(20),
    breeding_season: '2026 Spring',
    status: 'Planned',
    laying_active: false,
    archived: false,
    notes: 'Introducing after Moss hits weight.',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(20),
  },
  {
    id: 'mock-bp-4',
    breeding_id: 'Willow × Spud 2025',
    sire_id: 'mock-gecko-2',
    dam_id: 'mock-gecko-12',
    pairing_date: daysAgo(400),
    breeding_season: '2025 Spring',
    status: 'Successful',
    laying_active: false,
    archived: true,
    archived_date: daysAgo(120),
    notes: '6 eggs, 5 hatched. Strong pinstripe expression.',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(400),
  },
];

// Hatchery — eggs laid, pipping soon, hatched, failed, and historical.
// Incubation days are shown as (lay_date → hatch_date_expected) with
// status advancing as the expected date approaches. Hatched eggs link
// to their resulting gecko via `gecko_id` so the UI can pivot from
// a clutch entry directly into the hatchling record.
const EGGS = [
  // --- Harley × Spud 2026 (current clutches) ---
  {
    id: 'mock-egg-hs-1',
    breeding_plan_id: 'mock-bp-1',
    clutch_id: 'mock-clutch-2026a-harley-spud',
    lay_date: daysAgo(55),
    hatch_date_expected: daysAgo(-10),
    status: 'Incubating',
    grade: 'A',
    incubation_temp_f: 72,
    notes: 'Eye spots visible on candling. Strong veining.',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(55),
  },
  {
    id: 'mock-egg-hs-2',
    breeding_plan_id: 'mock-bp-1',
    clutch_id: 'mock-clutch-2026a-harley-spud',
    lay_date: daysAgo(54),
    hatch_date_expected: daysAgo(-11),
    status: 'Pipping',
    grade: 'A+',
    incubation_temp_f: 72,
    notes: 'Pip hole at 10pm last night. Hatch imminent.',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(54),
  },
  {
    id: 'mock-egg-hs-3',
    breeding_plan_id: 'mock-bp-1',
    clutch_id: 'mock-clutch-2026b-harley-spud',
    lay_date: daysAgo(18),
    hatch_date_expected: daysAgo(-47),
    status: 'Incubating',
    grade: 'A',
    incubation_temp_f: 72,
    created_by: GUEST_EMAIL,
    created_date: daysAgo(18),
  },
  {
    id: 'mock-egg-hs-4',
    breeding_plan_id: 'mock-bp-1',
    clutch_id: 'mock-clutch-2026b-harley-spud',
    lay_date: daysAgo(18),
    hatch_date_expected: daysAgo(-47),
    status: 'Failed',
    grade: 'D',
    failure_reason: 'Dented, infertile',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(18),
  },

  // --- Aria × Onyx 2026 ---
  {
    id: 'mock-egg-ao-1',
    breeding_plan_id: 'mock-bp-2',
    clutch_id: 'mock-clutch-2026-aria-onyx',
    lay_date: daysAgo(40),
    hatch_date_expected: daysAgo(-25),
    status: 'Incubating',
    grade: 'A',
    incubation_temp_f: 73,
    created_by: GUEST_EMAIL,
    created_date: daysAgo(40),
  },
  {
    id: 'mock-egg-ao-2',
    breeding_plan_id: 'mock-bp-2',
    clutch_id: 'mock-clutch-2026-aria-onyx',
    lay_date: daysAgo(39),
    hatch_date_expected: daysAgo(-26),
    status: 'Incubating',
    grade: 'B',
    incubation_temp_f: 73,
    notes: 'Slight dimple on long edge, watching closely.',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(39),
  },

  // --- Harley × Spud 2025 (archived; produced Nimbus, Pebble, Jasper, ...) ---
  {
    id: 'mock-egg-hs-2025-1',
    breeding_plan_id: 'mock-bp-4',
    clutch_id: 'mock-clutch-2025-harley-spud',
    lay_date: daysAgo(170),
    hatch_date_expected: daysAgo(100),
    hatch_date_actual: daysAgo(95),
    status: 'Hatched',
    gecko_id: 'mock-gecko-4',
    grade: 'A',
    incubation_temp_f: 72,
    created_by: GUEST_EMAIL,
    created_date: daysAgo(170),
  },
  {
    id: 'mock-egg-hs-2025-2',
    breeding_plan_id: 'mock-bp-4',
    clutch_id: 'mock-clutch-2025-harley-spud',
    lay_date: daysAgo(170),
    hatch_date_expected: daysAgo(100),
    hatch_date_actual: daysAgo(93),
    status: 'Hatched',
    gecko_id: 'mock-gecko-off-pebble',
    grade: 'A+',
    incubation_temp_f: 72,
    created_by: GUEST_EMAIL,
    created_date: daysAgo(170),
  },
  {
    id: 'mock-egg-hs-2025b-1',
    breeding_plan_id: 'mock-bp-4',
    clutch_id: 'mock-clutch-2025b-harley-spud',
    lay_date: daysAgo(95),
    hatch_date_expected: daysAgo(25),
    hatch_date_actual: daysAgo(20),
    status: 'Hatched',
    gecko_id: 'mock-gecko-off-jasper',
    grade: 'A',
    incubation_temp_f: 72,
    created_by: GUEST_EMAIL,
    created_date: daysAgo(95),
  },
  {
    id: 'mock-egg-hs-2025b-2',
    breeding_plan_id: 'mock-bp-4',
    clutch_id: 'mock-clutch-2025b-harley-spud',
    lay_date: daysAgo(95),
    hatch_date_expected: daysAgo(25),
    status: 'Failed',
    grade: 'C',
    failure_reason: 'Stopped developing ~day 45',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(95),
  },

  // --- Aria × Onyx 2025 (archived; produced Fern) ---
  {
    id: 'mock-egg-ao-2025-1',
    breeding_plan_id: 'mock-bp-2',
    clutch_id: 'mock-clutch-2025-aria-onyx',
    lay_date: daysAgo(80),
    hatch_date_expected: daysAgo(10),
    hatch_date_actual: daysAgo(8),
    status: 'Hatched',
    gecko_id: 'mock-gecko-off-fern',
    grade: 'A',
    incubation_temp_f: 73,
    created_by: GUEST_EMAIL,
    created_date: daysAgo(80),
  },
];

// Hatchery events — what shows up on the hatchery dashboard widget.
const HATCHERY_EVENTS = [
  {
    id: 'mock-hatch-evt-1',
    type: 'pip',
    egg_id: 'mock-egg-hs-2',
    breeding_plan_id: 'mock-bp-1',
    message: 'Harley × Spud clutch A, egg #2 has pipped — hatch expected in 24-48h.',
    created_by: 'system@geckinspect',
    created_date: daysAgo(0),
  },
  {
    id: 'mock-hatch-evt-2',
    type: 'hatch',
    egg_id: 'mock-egg-ao-2025-1',
    gecko_id: 'mock-gecko-off-fern',
    breeding_plan_id: 'mock-bp-2',
    message: 'Fern hatched from Aria × Onyx 2025 — strong harlequin, yellow base.',
    created_by: 'system@geckinspect',
    created_date: daysAgo(8),
  },
  {
    id: 'mock-hatch-evt-3',
    type: 'lay',
    breeding_plan_id: 'mock-bp-1',
    message: 'Harley laid clutch B (2 eggs) — incubation started.',
    created_by: 'system@geckinspect',
    created_date: daysAgo(18),
  },
  {
    id: 'mock-hatch-evt-4',
    type: 'failure',
    egg_id: 'mock-egg-hs-2025b-2',
    breeding_plan_id: 'mock-bp-4',
    message: 'Egg from Harley × Spud 2025B stopped developing — discarded at ~day 45.',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(50),
  },
];

// Clutch summaries — grouping eggs by clutch for the pedigree / lineage
// views. Populated from EGGS above so numbers stay in sync.
const CLUTCHES = [
  {
    id: 'mock-clutch-2026a-harley-spud',
    breeding_plan_id: 'mock-bp-1',
    pair_name: 'Harley × Spud',
    season: '2026 Spring',
    lay_date: daysAgo(55),
    egg_count: 2,
    hatched_count: 0,
    status: 'Incubating',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(55),
  },
  {
    id: 'mock-clutch-2026b-harley-spud',
    breeding_plan_id: 'mock-bp-1',
    pair_name: 'Harley × Spud',
    season: '2026 Spring',
    lay_date: daysAgo(18),
    egg_count: 2,
    hatched_count: 0,
    status: 'Incubating',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(18),
  },
  {
    id: 'mock-clutch-2026-aria-onyx',
    breeding_plan_id: 'mock-bp-2',
    pair_name: 'Aria × Onyx',
    season: '2026 Spring',
    lay_date: daysAgo(40),
    egg_count: 2,
    hatched_count: 0,
    status: 'Incubating',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(40),
  },
  {
    id: 'mock-clutch-2025-harley-spud',
    breeding_plan_id: 'mock-bp-4',
    pair_name: 'Harley × Spud',
    season: '2025 Spring',
    lay_date: daysAgo(170),
    egg_count: 2,
    hatched_count: 2,
    status: 'Complete',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(170),
  },
  {
    id: 'mock-clutch-2025b-harley-spud',
    breeding_plan_id: 'mock-bp-4',
    pair_name: 'Harley × Spud',
    season: '2025 Summer',
    lay_date: daysAgo(95),
    egg_count: 2,
    hatched_count: 1,
    status: 'Complete',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(95),
  },
  {
    id: 'mock-clutch-2025-aria-onyx',
    breeding_plan_id: 'mock-bp-2',
    pair_name: 'Aria × Onyx',
    season: '2025 Summer',
    lay_date: daysAgo(80),
    egg_count: 1,
    hatched_count: 1,
    status: 'Complete',
    created_by: GUEST_EMAIL,
    created_date: daysAgo(80),
  },
];

// ---------------------------------------------------------------------------
// Forum posts
// ---------------------------------------------------------------------------
const FORUM_POSTS = [
  {
    id: 'mock-post-1',
    title: 'How do you tell a high-end Harlequin from a Tricolor?',
    content:
      'I picked up a hatchling last month labeled Harlequin but it\'s showing a third color band on the dorsal. Is that just partial pin or heading into tricolor territory?',
    category_id: 'mock-cat-morphs',
    author_name: 'LumenReptiles',
    created_by: 'lumen@example.com',
    created_date: daysAgo(2),
    view_count: 184,
    is_pinned: false,
  },
  {
    id: 'mock-post-2',
    title: 'PSA: clean your CGD cups BEFORE feeding, not after',
    content:
      'Spent a full year scrubbing crusted cups every morning. Swapped the order and my feeding time dropped by half.',
    category_id: 'mock-cat-husbandry',
    author_name: 'NightCrest',
    created_by: 'night@example.com',
    created_date: daysAgo(5),
    view_count: 903,
    is_pinned: true,
  },
  {
    id: 'mock-post-3',
    title: 'Breeding loan checklist — what to include in the contract',
    content:
      'Putting together a loan checklist. What clauses are non-negotiable for you?',
    category_id: 'mock-cat-breeding',
    author_name: 'DeltaGeckos',
    created_by: 'delta@example.com',
    created_date: daysAgo(9),
    view_count: 412,
    is_pinned: false,
  },
  {
    id: 'mock-post-4',
    title: 'Cappuccino × Lilly White — anyone run this project?',
    content:
      'Curious if the combo has been proven out. Looking at phenotype variation across clutches.',
    category_id: 'mock-cat-breeding',
    author_name: 'MossyFootReptiles',
    created_by: 'mossy@example.com',
    created_date: daysAgo(14),
    view_count: 267,
    is_pinned: false,
  },
  {
    id: 'mock-post-5',
    title: 'First hatchling of the season!',
    content:
      'Out after 67 days. Strong dorsal stripe, pinning on sides. So stoked.',
    category_id: 'mock-cat-general',
    author_name: 'CedarAcres',
    created_by: 'cedar@example.com',
    created_date: daysAgo(18),
    view_count: 89,
    is_pinned: false,
  },
];

const FORUM_CATEGORIES = [
  { id: 'mock-cat-general', name: 'General', slug: 'general', description: 'Everything else.', position: 1 },
  { id: 'mock-cat-morphs', name: 'Morph ID', slug: 'morph-id', description: 'Help identifying and discussing morphs.', position: 2 },
  { id: 'mock-cat-breeding', name: 'Breeding', slug: 'breeding', description: 'Pairings, projects, lineage.', position: 3 },
  { id: 'mock-cat-husbandry', name: 'Husbandry', slug: 'husbandry', description: 'Food, enclosures, health.', position: 4 },
];

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
const NOTIFICATIONS = [
  {
    id: 'mock-notif-1',
    recipient_email: GUEST_EMAIL,
    title: 'Egg due to hatch soon',
    body: 'Harley × Spud clutch #1 — expected hatch in 10 days.',
    link: '/BreedingPairs',
    type: 'breeding',
    is_read: false,
    created_date: daysAgo(1),
    created_by: 'system@geckinspect',
  },
  {
    id: 'mock-notif-2',
    recipient_email: GUEST_EMAIL,
    title: 'Ember liked your listing',
    body: 'A keeper saved your For Sale listing for Ember.',
    link: '/MyListings',
    type: 'marketplace',
    is_read: false,
    created_date: daysAgo(2),
    created_by: 'system@geckinspect',
  },
  {
    id: 'mock-notif-3',
    recipient_email: GUEST_EMAIL,
    title: 'New reply in "Breeding loan checklist"',
    body: 'DeltaGeckos posted a reply in a thread you follow.',
    link: '/Forum',
    type: 'forum',
    is_read: true,
    created_date: daysAgo(4),
    created_by: 'system@geckinspect',
  },
];

// ---------------------------------------------------------------------------
// Direct messages
// ---------------------------------------------------------------------------
const DIRECT_MESSAGES = [
  {
    id: 'mock-dm-1',
    sender_email: 'lumen@example.com',
    recipient_email: GUEST_EMAIL,
    content: 'Hey — are any of your Harley pins still available for pickup at the expo?',
    is_read: false,
    message_type: 'user',
    created_date: daysAgo(1),
    created_by: 'lumen@example.com',
  },
  {
    id: 'mock-dm-2',
    sender_email: GUEST_EMAIL,
    recipient_email: 'lumen@example.com',
    content: 'Yes — Ember and one sibling. Sending photos tonight.',
    is_read: true,
    message_type: 'user',
    created_date: daysAgo(1),
    created_by: GUEST_EMAIL,
  },
  {
    id: 'mock-dm-3',
    sender_email: 'system@geckinspect',
    recipient_email: GUEST_EMAIL,
    content: 'Welcome to Geck Inspect! This is your inbox.',
    is_read: true,
    message_type: 'system',
    created_date: daysAgo(30),
    created_by: 'system@geckinspect',
  },
];

// ---------------------------------------------------------------------------
// Feeding groups (referenced by gecko.feeding_group_id)
// ---------------------------------------------------------------------------
const FEEDING_GROUPS = [
  { id: 'mock-feed-1', name: 'Adults A', feed_days: ['Monday', 'Thursday'], created_by: GUEST_EMAIL, created_date: daysAgo(500) },
  { id: 'mock-feed-2', name: 'Subadults', feed_days: ['Tuesday', 'Friday'], created_by: GUEST_EMAIL, created_date: daysAgo(400) },
  { id: 'mock-feed-3', name: 'Hatchlings', feed_days: ['Monday', 'Wednesday', 'Friday'], created_by: GUEST_EMAIL, created_date: daysAgo(300) },
];

// ---------------------------------------------------------------------------
// Gecko of the day — points at a mock image
// ---------------------------------------------------------------------------
const GECKO_OF_THE_DAY = [
  {
    id: 'mock-gotd-1',
    date: new Date().toISOString().split('T')[0],
    gecko_image_id: GECKO_IMAGES[0]?.id,
    uploader_email: GUEST_EMAIL,
    appreciative_message:
      'Look at that pattern! Harley is crushing it in her third season.',
    created_by: 'system@geckinspect',
    created_date: daysAgo(0),
  },
];

// ---------------------------------------------------------------------------
// Store map — keyed by the Supabase entity name used in supabaseEntities.js
// ---------------------------------------------------------------------------
const STORE = {
  Gecko: GECKOS,
  GeckoImage: GECKO_IMAGES,
  WeightRecord: WEIGHT_RECORDS,
  BreedingPlan: BREEDING_PLANS,
  Egg: EGGS,
  Clutch: CLUTCHES,
  ForumPost: FORUM_POSTS,
  ForumCategory: FORUM_CATEGORIES,
  Notification: NOTIFICATIONS,
  DirectMessage: DIRECT_MESSAGES,
  FeedingGroup: FEEDING_GROUPS,
  GeckoOfTheDay: GECKO_OF_THE_DAY,
};

// Surface hatchery events for any consumer that wants them; not keyed
// by a Supabase entity, so it's intentionally not wired into STORE.
export const MOCK_HATCHERY_EVENTS = HATCHERY_EVENTS;

// ---------------------------------------------------------------------------
// Query helpers — minimal re-implementation of the subset of the Supabase
// entity API that pages actually exercise. Anything unsupported falls
// back to returning the full collection (pages apply their own filters
// client-side for the non-indexed fields they care about).
// ---------------------------------------------------------------------------
function matchesFilter(item, filter) {
  if (!filter || typeof filter !== 'object') return true;
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or' && Array.isArray(value)) {
      const anyMatch = value.some((clause) => matchesFilter(item, clause));
      if (!anyMatch) return false;
      continue;
    }
    if (value === null || value === undefined) {
      if (item[key] !== null && item[key] !== undefined) return false;
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      for (const [op, opVal] of Object.entries(value)) {
        if (op === '$gt' && !(item[key] > opVal)) return false;
        else if (op === '$gte' && !(item[key] >= opVal)) return false;
        else if (op === '$lt' && !(item[key] < opVal)) return false;
        else if (op === '$lte' && !(item[key] <= opVal)) return false;
        else if (op === '$ne' && item[key] === opVal) return false;
        else if (op === '$in' && !opVal.includes(item[key])) return false;
      }
      continue;
    }
    if (item[key] !== value) return false;
  }
  return true;
}

function applySort(list, sort) {
  if (!sort) return list;
  const directives = sort.split(',').map((s) => {
    const trimmed = s.trim();
    return trimmed.startsWith('-')
      ? { column: trimmed.slice(1), ascending: false }
      : { column: trimmed, ascending: true };
  });
  return [...list].sort((a, b) => {
    for (const { column, ascending } of directives) {
      const av = a[column];
      const bv = b[column];
      if (av === bv) continue;
      if (av === undefined || av === null) return ascending ? 1 : -1;
      if (bv === undefined || bv === null) return ascending ? -1 : 1;
      if (av < bv) return ascending ? -1 : 1;
      return ascending ? 1 : -1;
    }
    return 0;
  });
}

export function isMockedEntity(entityName) {
  return Object.prototype.hasOwnProperty.call(STORE, entityName);
}

export async function guestMockFilter(entityName, filter, sort, limit, skip) {
  const data = STORE[entityName] || [];
  let out = data.filter((item) => matchesFilter(item, filter));
  out = applySort(out, sort || '-created_date');
  if (skip) out = out.slice(skip);
  if (limit) out = out.slice(0, limit);
  return out.map((r) => ({ ...r }));
}

export async function guestMockGet(entityName, id) {
  const data = STORE[entityName] || [];
  const found = data.find((item) => item.id === id);
  return found ? { ...found } : null;
}

export async function guestMockList(entityName, sort) {
  return guestMockFilter(entityName, {}, sort);
}
