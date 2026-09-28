/**
 * Market Analytics v2: demo aggregates.
 *
 * Real numbers, queried from the geck_data schema on 28 Sep 2026
 * (geck_data.listings, prices between $20 and $20,000). They feed the
 * design demo in demo/market-analytics so the preview shows what the
 * live tab can actually show, not invented fixtures.
 *
 * The shape here is the contract the v2 components read. When the tab
 * goes live, an aggregator builds this same shape from the snapshot, so
 * the demo and the shipped tab render from identical inputs.
 *
 * Weekly keys are the Monday of each week (MM-DD, 2026). Tuples are
 * [listings first seen that week, median ask in USD].
 */

export const DEMO_AGGREGATES = {
  generated_at: '2026-09-28T00:00:00Z',
  source: {
    id: 'external.morphmarket',
    label: 'MorphMarket listings, United States',
    collector: 'Geck Data',
  },

  coverage: {
    first_seen: '2026-05-09',
    last_seen: '2026-08-29',
    // Sales are inferred when a listing flips to sold between scrapes.
    // That only ran while the hourly collector was up.
    sold_window: { from: '2026-05-11', to: '2026-06-07' },
    gaps: [{ from: '2026-06-09', to: '2026-08-16', label: 'Collector offline' }],
    // Listings over $20,000 are placeholder asks (one is $1,000,000).
    excluded_outliers: 21,
    weeks: [
      { week: '05-04', listings: 398,  median_ask: 200, sold_later: 157,  note: 'Tracking started May 9' },
      { week: '05-11', listings: 6772, median_ask: 300, sold_later: 2052, note: 'First full scrape, includes every listing already live' },
      { week: '05-18', listings: 656,  median_ask: 250, sold_later: 289 },
      { week: '05-25', listings: 797,  median_ask: 250, sold_later: 278 },
      { week: '06-01', listings: 606,  median_ask: 275, sold_later: 54 },
      { week: '06-08', listings: 102,  median_ask: 262, sold_later: 0 },
      { week: '08-17', listings: 156,  median_ask: 225, sold_later: 0 },
      { week: '08-24', listings: 408,  median_ask: 255, sold_later: 0 },
    ],
  },

  kpis: {
    listings: 9895,
    sold: 2830,
    median_ask: 280,
    sold_value: 1069371,
    // Share of listings seen before the sold window closed that sold inside it.
    sell_through: 0.30,
    avg_days_to_sell: 16,
    sellers: 1008,
  },

  ages: [
    { code: 'baby',     label: 'Baby',     n: 1602, median: 175, sold: 468, days: 15 },
    { code: 'juvenile', label: 'Juvenile', n: 1634, median: 232, sold: 431, days: 17 },
    { code: 'subadult', label: 'Subadult', n: 1033, median: 300, sold: 274, days: 17 },
    { code: 'adult',    label: 'Adult',    n: 2431, median: 350, sold: 600, days: 16 },
    { code: 'unknown',  label: 'Not stated', n: 3181, median: 280, sold: 1053, days: 10 },
  ],

  // spring = listings first seen May 9 to Jun 30; late = Aug 17 to Aug 29.
  traits: [
    { name: 'Harlequin', n: 776, sold: 233, median: 175, p25: 100, p75: 300, days: 17, sell_through: 0.355,
      spring: [656, 175], late: [119, 200],
      weekly: { '05-11': [571, 175], '05-18': [9, 125], '05-25': [9, 195], '06-01': [14, 130], '08-17': [22, 150], '08-24': [97, 200] },
      by_age: { baby: [240, 125], juvenile: [233, 175], subadult: [108, 250], adult: [194, 250] } },
    { name: 'Lilly White', n: 615, sold: 160, median: 375, p25: 250, p75: 600, days: 15, sell_through: 0.324,
      spring: [494, 375], late: [121, 350],
      weekly: { '05-11': [419, 375], '05-18': [22, 350], '05-25': [16, 400], '06-01': [4, 350], '08-17': [35, 350], '08-24': [86, 375] },
      by_age: { baby: [184, 278], juvenile: [192, 350], subadult: [104, 400], adult: [134, 500] } },
    { name: 'Tri-color', n: 599, sold: 139, median: 300, p25: 200, p75: 450, days: 16, sell_through: 0.274,
      spring: [508, 300], late: [90, 280],
      weekly: { '05-11': [438, 300], '05-18': [5, 200], '05-25': [4, 262], '06-01': [8, 165], '08-17': [13, 225], '08-24': [77, 300] },
      by_age: { baby: [151, 250], juvenile: [200, 250], subadult: [98, 350], adult: [150, 375] } },
    { name: 'Extreme Harlequin', n: 495, sold: 120, median: 300, p25: 200, p75: 450, days: 15, sell_through: 0.28,
      spring: [428, 300], late: [66, 295],
      weekly: { '05-11': [386, 300], '05-18': [5, 125], '05-25': [4, 272], '06-01': [2, 612], '08-17': [11, 225], '08-24': [55, 300] },
      by_age: { baby: [101, 200], juvenile: [125, 225], subadult: [93, 375], adult: [176, 375] } },
    { name: 'Dalmatian', n: 439, sold: 124, median: 199, p25: 100, p75: 325, days: 17, sell_through: 0.328,
      spring: [378, 200], late: [60, 158],
      weekly: { '05-11': [324, 200], '05-18': [10, 100], '05-25': [15, 150], '06-01': [3, 225], '08-17': [10, 135], '08-24': [50, 175] },
      by_age: { baby: [126, 100], juvenile: [130, 175], subadult: [73, 250], adult: [110, 263] } },
    { name: 'Pinstripe', n: 437, sold: 127, median: 200, p25: 125, p75: 350, days: 17, sell_through: 0.344,
      spring: [369, 200], late: [68, 250],
      weekly: { '05-11': [323, 200], '05-18': [4, 90], '05-25': [3, 120], '06-01': [5, 400], '08-17': [15, 225], '08-24': [53, 250] },
      by_age: { baby: [147, 150], juvenile: [132, 200], subadult: [54, 275], adult: [104, 250] } },
    { name: 'Red', n: 320, sold: 94, median: 300, p25: 150, p75: 450, days: 15, sell_through: 0.347,
      spring: [271, 300], late: [48, 290],
      weekly: { '05-11': [226, 300], '05-18': [9, 250], '05-25': [5, 350], '06-01': [2, 300], '08-17': [4, 324], '08-24': [44, 265] },
      by_age: { baby: [86, 200], juvenile: [93, 215], subadult: [50, 350], adult: [91, 350] } },
    { name: 'Dark', n: 318, sold: 81, median: 275, p25: 151, p75: 400, days: 17, sell_through: 0.309,
      spring: [262, 250], late: [55, 349],
      weekly: { '05-11': [238, 250], '05-18': [5, 300], '05-25': [2, 325], '06-01': [3, 300], '08-17': [13, 300], '08-24': [42, 375] },
      by_age: null },
    { name: 'Cappuccino', n: 283, sold: 80, median: 350, p25: 200, p75: 500, days: 15, sell_through: 0.376,
      spring: [213, 350], late: [70, 285],
      weekly: { '05-11': [183, 375], '05-18': [15, 350], '05-25': [4, 175], '06-01': [2, 188], '08-17': [41, 180], '08-24': [29, 400] },
      by_age: { baby: [79, 250], juvenile: [103, 300], subadult: [46, 400], adult: [55, 500] } },
    { name: 'Phantom', n: 259, sold: 68, median: 275, p25: 150, p75: 400, days: 17, sell_through: 0.319,
      spring: [213, 300], late: [46, 213],
      weekly: { '05-11': [178, 300], '05-18': [5, 300], '05-25': [7, 400], '06-01': [6, 300], '08-17': [9, 275], '08-24': [37, 200] },
      by_age: { baby: [61, 200], juvenile: [70, 250], subadult: [63, 300], adult: [63, 295] } },
    { name: 'Super Dalmatian', n: 171, sold: 57, median: 375, p25: 223, p75: 600, days: 15, sell_through: 0.432,
      spring: [132, 375], late: [39, 400],
      weekly: { '05-11': [115, 375], '05-18': [1, 225], '05-25': [4, 425], '06-01': [4, 388], '08-17': [5, 100], '08-24': [34, 525] },
      by_age: { baby: [31, 175], juvenile: [54, 290], subadult: [48, 450], adult: [38, 500] } },
    { name: 'White Wall', n: 179, sold: 49, median: 350, p25: 200, p75: 500, days: 15, sell_through: 0.333,
      spring: [147, 350], late: [32, 288],
      weekly: { '05-11': [129, 350], '05-18': [1, 150], '08-17': [6, 600], '08-24': [26, 268] },
      by_age: { baby: [29, 180], juvenile: [58, 300], subadult: [34, 363], adult: [58, 363] } },
    { name: 'Empty Back', n: 190, sold: 60, median: 250, p25: 150, p75: 400, days: 16, sell_through: 0.353,
      spring: [170, 250], late: [20, 200],
      weekly: { '05-11': [133, 250], '05-18': [4, 350], '05-25': [7, 300], '06-01': [3, 400], '08-24': [20, 200] },
      by_age: { baby: [40, 150], juvenile: [44, 220], subadult: [61, 325], adult: [44, 300] } },
    { name: 'Drippy', n: 168, sold: 41, median: 500, p25: 300, p75: 700, days: 14, sell_through: 0.273,
      spring: [150, 500], late: [18, 413],
      weekly: { '05-11': [130, 500], '05-18': [4, 312], '08-17': [6, 475], '08-24': [12, 400] },
      by_age: { baby: [37, 400], juvenile: [45, 400], subadult: [21, 400], adult: [65, 600] } },
    { name: 'Axanthic', n: 103, sold: 25, median: 650, p25: 420, p75: 1000, days: 15, sell_through: 0.455,
      spring: [55, 900], late: [48, 420],
      weekly: { '05-11': [48, 1000], '08-17': [28, 320], '08-24': [20, 700] },
      by_age: { baby: [64, 600], juvenile: [23, 649], subadult: [7, 800], adult: [9, 1500] } },
    { name: 'Het Axanthic', n: 123, sold: 30, median: 350, p25: 200, p75: 463, days: 16, sell_through: 0.405,
      spring: [74, 400], late: [49, 195],
      weekly: { '05-11': [67, 400], '08-17': [30, 145], '08-24': [19, 395] },
      by_age: null },
    { name: 'Quad-stripe', n: 166, sold: 47, median: 250, p25: 150, p75: 400, days: 16, sell_through: 0.313,
      spring: [150, 250], late: [16, 313],
      weekly: { '05-11': [133, 260], '08-17': [2, 262], '08-24': [14, 312] },
      by_age: null },
    { name: 'White Patterning', n: 104, sold: 31, median: 400, p25: 229, p75: 600, days: 13, sell_through: 0.348,
      spring: [89, 375], late: [15, 475],
      weekly: { '05-11': [76, 375], '08-17': [4, 1275], '08-24': [11, 400] },
      by_age: null },
    { name: 'Ink Spot', n: 106, sold: 35, median: 300, p25: 165, p75: 550, days: 17, sell_through: 0.402,
      spring: [87, 350], late: [19, 165],
      weekly: { '05-11': [82, 312], '08-17': [2, 100], '08-24': [17, 180] },
      by_age: null },
    { name: 'Orange', n: 129, sold: 36, median: 225, p25: 150, p75: 400, days: 17, sell_through: 0.33,
      spring: [109, 250], late: [20, 150],
      weekly: { '05-11': [91, 250], '05-18': [3, 275], '08-17': [2, 135], '08-24': [18, 162] },
      by_age: null },
    { name: 'Portholes', n: 179, sold: 54, median: 175, p25: 100, p75: 300, days: 17, sell_through: 0.355,
      spring: [152, 180], late: [27, 125],
      weekly: { '05-11': [132, 200], '08-17': [3, 140], '08-24': [24, 125] },
      by_age: null },
    { name: 'Tangerine', n: 161, sold: 43, median: 300, p25: 200, p75: 450, days: 16, sell_through: 0.314,
      spring: [137, 300], late: [24, 225],
      weekly: { '05-11': [116, 300], '05-18': [3, 200], '05-25': [4, 325], '08-17': [7, 225], '08-24': [17, 225] },
      by_age: null },
    { name: 'Yellow', n: 201, sold: 59, median: 250, p25: 150, p75: 399, days: 17, sell_through: 0.341,
      spring: [173, 250], late: [28, 250],
      weekly: { '05-11': [150, 250], '06-01': [4, 350], '08-17': [3, 300], '08-24': [25, 225] },
      by_age: null },
    { name: 'Lavender', n: 135, sold: 38, median: 300, p25: 197, p75: 425, days: 17, sell_through: 0.309,
      spring: [123, 300], late: [12, 213],
      weekly: { '05-11': [110, 300], '08-17': [2, 212], '08-24': [10, 212] },
      by_age: null },
  ],

  sellers: {
    total: 1008,
    with_a_sale: 540,
    // Listings with no seller name on the scrape (their sales still count above).
    unattributed_listings: 3182,
    attributed_sold_value: 622120,
    top10_share: 0.213,
    top50_share: 0.464,
    hhi: 88,
    size_buckets: [
      { label: '1 listing', sellers: 341 },
      { label: '2 to 5', sellers: 347 },
      { label: '6 to 20', sellers: 263 },
      { label: '21 or more', sellers: 57 },
    ],
    // Names are withheld in the demo. The live tab shows public storefront names.
    top: [
      { rank: 1,  listings: 681, sold: 71, sold_value: 32907, median: 469 },
      { rank: 2,  listings: 35,  sold: 7,  sold_value: 21053, median: 2999 },
      { rank: 3,  listings: 75,  sold: 26, sold_value: 12456, median: 401 },
      { rank: 4,  listings: 106, sold: 35, sold_value: 12100, median: 400 },
      { rank: 5,  listings: 14,  sold: 6,  sold_value: 10350, median: 1350 },
      { rank: 6,  listings: 19,  sold: 15, sold_value: 9875,  median: 450 },
      { rank: 7,  listings: 29,  sold: 28, sold_value: 9350,  median: 300 },
      { rank: 8,  listings: 9,   sold: 9,  sold_value: 8125,  median: 900 },
      { rank: 9,  listings: 1,   sold: 1,  sold_value: 8000,  median: 8000 },
      { rank: 10, listings: 6,   sold: 6,  sold_value: 7997,  median: 1250 },
    ],
  },
};

// Example clutches for the "Your pipeline" card. The live tab reads the
// signed-in breeder's own eggs and breeding plans instead.
export const DEMO_PIPELINE = [
  { id: 'c1', pair: 'Juniper x Kodiak', traits: ['Lilly White', 'Harlequin'], eggs: 2, due: '2026-10-14' },
  { id: 'c2', pair: 'Saffron x Moth', traits: ['Cappuccino'], eggs: 2, due: '2026-10-29' },
  { id: 'c3', pair: 'Pixel x Rook', traits: ['Pinstripe', 'Tri-color'], eggs: 1, due: '2026-11-06' },
  { id: 'c4', pair: 'Olive x Ember', traits: ['Dalmatian'], eggs: 2, due: '2026-11-21' },
];
