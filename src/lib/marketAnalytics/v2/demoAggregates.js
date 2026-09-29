/**
 * Market Analytics v2: aggregates contract and the demo's saved copy.
 *
 * The live tab gets one object from public.market_analytics_v2()
 * (supabase/migrations/20260929004422_market_analytics_v2.sql). The design
 * demo in demo/market-analytics renders demoSnapshot.json, a saved copy of
 * that function's output (29 Sep 2026), so both show the same numbers from
 * the same code. To refresh it, run `select public.market_analytics_v2()`
 * and paste the result over demoSnapshot.json.
 *
 * Shape:
 *   generated_at  ISO timestamp
 *   source        { id, label, collector }
 *   coverage      { first_seen, last_seen, sold_window: { from, to } | null,
 *                   excluded_outliers,
 *                   weeks: [{ week (Monday, YYYY-MM-DD), listings, median_ask, sold }] }
 *   periods       { earlier: { from, to }, recent: { from, to } }
 *                 recent = the 28 days before the newest listing
 *   kpis          { listings, sold, median_ask, sold_value, sell_through,
 *                   avg_days_to_sell, sellers }
 *   ages          [{ code: baby|juvenile|subadult|adult|unknown, n, median, sold, days }]
 *   traits        [{ name, n, sold, median, p25, p75, days, sell_through,
 *                    earlier: [n, median], recent: [n, median],
 *                    weekly: { 'YYYY-MM-DD': [n, median] },
 *                    by_age: { baby|juvenile|subadult|adult: [n, median] } | null }]
 *   sellers       { total, with_a_sale, unattributed_listings, attributed_sold_value,
 *                   top10_share, top50_share, hhi,
 *                   size_buckets: [{ label, sellers }],
 *                   top: [{ rank, listings, sold, sold_value, median }] }
 *
 * All prices are USD asking prices. Seller names are never included.
 */

import snapshot from './demoSnapshot.json';

export const DEMO_AGGREGATES = snapshot;

// Example clutches for the demo's "Your pipeline" card. The live tab reads
// the signed-in breeder's own incubating eggs instead (loadPipeline.js).
export const DEMO_PIPELINE = [
  { id: 'c1', pair: 'Juniper x Kodiak', traits: ['Lilly White', 'Harlequin'], eggs: 2, due: '2026-10-14' },
  { id: 'c2', pair: 'Saffron x Moth', traits: ['Cappuccino'], eggs: 2, due: '2026-10-29' },
  { id: 'c3', pair: 'Pixel x Rook', traits: ['Pinstripe', 'Tri-color'], eggs: 1, due: '2026-11-06' },
  { id: 'c4', pair: 'Olive x Ember', traits: ['Dalmatian'], eggs: 2, due: '2026-11-21' },
];
