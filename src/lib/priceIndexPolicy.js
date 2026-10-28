/**
 * How many listings a Geck Inspect Price Index row needs before it is
 * published, and when a published row is marked as a thin sample.
 *
 * Why: the index published any trait with at least 5 listings. A median of
 * 5 asking prices moves by hundreds of dollars when one seller relists, and
 * small rows exposed label mix-ups (the South Korea row had Harlequin at 6
 * listings next to Extreme Harlequin at 395). The adversarial review asked
 * for at least 30 per row (section 11), which the comprehensive review
 * adopted (item 27).
 *
 *   under 30 listings   left out of every published copy
 *   30 to 99 listings   published and marked "thin sample"
 *   100 or more         published as is
 *
 * One module so the JSON and CSV files (scripts/build-agent-data.mjs), the
 * pages (PriceIndexTable, /data, /crested-gecko-price, their server HTML),
 * llms-full.txt and the MCP server all apply and state the same rule. The
 * database function open_price_index() applies the same minimum
 * (supabase/migrations/20261016090300_seo.sql); a test keeps them equal.
 *
 * Dependency-free so Node scripts can import it.
 */

export const PRICE_INDEX_MIN_LISTINGS = 30;
export const PRICE_INDEX_THIN_LISTINGS = 100;

/**
 * What the Price Index is and how others may use it, in the words every
 * copy uses (Tennyson's decision of 16 Oct 2026). The index is an
 * asking-price snapshot from public marketplace listings, not "original
 * data", and its numbers are free to cite with a link rather than CC BY
 * 4.0. The morph and genetics data stay CC BY 4.0. The source sites are
 * not named anywhere until counsel says otherwise. A test checks that the
 * dataset files, llms files, /data page and MCP server say this.
 */
export const PRICE_INDEX_WHAT = 'an asking-price snapshot from public marketplace listings';
export const PRICE_DATA_LICENSE = 'Free to cite with a link';
export const PRICE_DATA_TERMS =
  'Free to cite with a link: you may quote and cite these numbers, with a link to the page they came from.';
/** The same terms as a sentence about the index, for text that lists several datasets. */
export const PRICE_INDEX_TERMS_SENTENCE = `The Price Index is ${PRICE_DATA_TERMS.charAt(0).toLowerCase()}${PRICE_DATA_TERMS.slice(1)}`;

/** Plain-language rule, for page footnotes and the dataset methodology. */
export const PRICE_INDEX_SAMPLE_RULE =
  `A row needs at least ${PRICE_INDEX_MIN_LISTINGS} listings to be shown. ` +
  `Rows with fewer than ${PRICE_INDEX_THIN_LISTINGS} are marked as a thin sample, because a few relisted geckos can move their median.`;

/** True when a latest-check row has enough listings to publish. */
export function isPublishableRow(row) {
  return Number(row?.listings) >= PRICE_INDEX_MIN_LISTINGS;
}

/** True when a published row is a thin sample. */
export function isThinRow(row) {
  const n = Number(row?.listings);
  return n >= PRICE_INDEX_MIN_LISTINGS && n < PRICE_INDEX_THIN_LISTINGS;
}

// Marketplace trait labels that name a Morph Guide page by another name.
// "Reverse Pinstripe" has no page of its own; the Pinstripe page explains it.
// A test checks every target is a real morph slug, since a wrong one is a 404.
//
// "Phantom" links to the Phantom page (the recessive gene), not to Phantom
// Pinstripe. Sellers list it as a gene, with "Het Phantom" and "66% Het
// Phantom" beside it, and the Phantom Pinstripe page says that older
// appearance label does not prove the gene. Until 16 Oct 2026 there was no
// Phantom page, so the label pointed at Phantom Pinstripe. As with every
// trait here, the label is the seller's and does not prove genotype.
const TRAIT_SLUGS = {
  'Tri-color': 'tricolor',
  'Red Base': 'red-base',
  'Yellow Base': 'yellow-base',
  'Extreme Harlequin': 'extreme-harlequin',
  'Super Dalmatian': 'super-dalmatian',
  'Lilly White': 'lilly-white',
  'Soft Scale': 'soft-scale',
  'White Wall': 'white-wall',
  'Empty Back': 'empty-back',
  'Reverse Pinstripe': 'pinstripe',
};
const SAME_NAME_TRAITS = new Set([
  'Harlequin', 'Pinstripe', 'Dalmatian', 'Tiger', 'Brindle', 'Axanthic', 'Cappuccino', 'Sable',
  'Patternless', 'Lavender', 'Olive', 'Cream', 'Buckskin', 'Hypo', 'Phantom', 'Frappuccino',
]);

/** The Morph Guide slug a market trait label links to, or null. */
export function priceTraitMorphSlug(trait) {
  if (!trait) return null;
  if (Object.prototype.hasOwnProperty.call(TRAIT_SLUGS, trait)) return TRAIT_SLUGS[trait];
  return SAME_NAME_TRAITS.has(trait) ? trait.toLowerCase() : null;
}

/** Every slug priceTraitMorphSlug can return (for the test). */
export const PRICE_TRAIT_LINK_SLUGS = [...new Set([...Object.values(TRAIT_SLUGS), ...[...SAME_NAME_TRAITS].map((t) => t.toLowerCase())])];

/**
 * The index with only publishable rows, each latest row carrying
 * `thin: true|false`. Monthly rows are kept when their average daily
 * listing count meets the same minimum. That is a fallback for data from
 * the older open_price_index(): the current one already drops each day
 * under the minimum before taking a month's median, so its rows always
 * pass. Works on an index already filtered (idempotent) and returns null
 * for null.
 */
export function applyPricePolicy(index) {
  if (!index || !Array.isArray(index.latest)) return index ?? null;
  return {
    ...index,
    latest: index.latest.filter(isPublishableRow).map((row) => ({ ...row, thin: isThinRow(row) })),
    monthly: (index.monthly || []).filter((row) => Number(row?.avg_listings) >= PRICE_INDEX_MIN_LISTINGS),
  };
}

/**
 * A market whose newest full catalog check is older than this many days is
 * marked out of date wherever the index is shown. On 28 Oct 2026 the US
 * rows still dated from 6 Oct while Europe, Japan and South Korea were
 * checked daily, and every copy (the pages, llms files, MCP answers) showed
 * the US numbers as current.
 */
export const PRICE_INDEX_STALE_DAYS = 7;

const DAY_MS = 86400000;

/** "6 October 2026" for a YYYY-MM-DD day. */
export function priceCheckDay(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return String(isoDate || '');
  return `${d.getUTCDate()} ${d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`;
}

/**
 * Markets whose newest full check is more than PRICE_INDEX_STALE_DAYS old
 * at `now` (milliseconds, or anything Date.parse reads, such as the index's
 * own generated_at). Each entry: { market, checked_on, days }.
 */
export function staleMarkets(index, now = Date.now()) {
  const at = typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(at)) return [];
  const newest = new Map();
  for (const r of index?.latest || []) {
    if (!r?.market || !r.checked_on) continue;
    if (!newest.has(r.market) || r.checked_on > newest.get(r.market)) newest.set(r.market, r.checked_on);
  }
  const out = [];
  for (const [market, checked_on] of newest) {
    const days = Math.floor((at - Date.parse(`${checked_on}T00:00:00Z`)) / DAY_MS);
    if (days > PRICE_INDEX_STALE_DAYS) out.push({ market, checked_on, days });
  }
  return out;
}

/** The plain note for one stale market, given its display name. */
export function staleMarketNote(stale, name) {
  return `Out of date: the last full check of ${name || stale.market} listings was ${priceCheckDay(stale.checked_on)}, ${stale.days} days ago. These prices may have moved since.`;
}
