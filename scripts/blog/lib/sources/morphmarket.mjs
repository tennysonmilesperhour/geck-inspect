/**
 * MorphMarket source — reads the public new-listings page for crested geckos
 * and extracts which morphs/traits are showing up most frequently right now.
 *
 * This is intentionally lightweight: it doesn't scrape listing prices or
 * images, just the human-readable listing titles. Titles are the closest
 * thing to a ground-truth "what breeders are actually producing" signal.
 *
 * MorphMarket's robots.txt allows search engines to index the category
 * page; we're not crawling listing detail pages. Set a clear User-Agent
 * so site ops can contact us if there's a problem.
 *
 * Known limitations:
 *   - MorphMarket sometimes A/B tests DOM structure; we parse defensively
 *     and return an empty set (not an error) if we can't find anything.
 *   - We don't need precise counts — order-of-magnitude is enough to
 *     inform topic scoring.
 */
const UA = 'geckinspect-blog-pipeline/1.0 (+https://geckinspect.com)';

const LISTING_URL = 'https://www.morphmarket.com/us/c/reptiles/lizards/crested-geckos?state=for_sale&ordering=-posted_date';

/** Known tags we care about. Only count tags that appear in listing titles. */
const KNOWN_TRAITS = [
  'Lilly White', 'Super Lilly White',
  'Axanthic', 'Het Axanthic',
  'Cappuccino', 'Super Cappuccino', 'Frappuccino',
  'Moonglow', 'Soft Scale', 'Super Soft Scale',
  'White Wall', 'Empty Back',
  'Harlequin', 'Extreme Harlequin',
  'Pinstripe', 'Full Pinstripe', 'Partial Pinstripe', 'Phantom Pinstripe',
  'Tiger', 'Brindle', 'Extreme Brindle',
  'Dalmatian', 'Super Dalmatian', 'Red Dalmatian',
  'Flame', 'Chevron', 'Patternless', 'Bicolor', 'Tricolor',
  'Whiteout', 'Phantom',
  'Sable', 'Highway', 'Luwak',
];

/** Very lightweight regex over the HTML response. We do NOT try to be
 * a full HTML parser — just count trait mentions in whatever text comes
 * back. This is brittle by design: if MorphMarket switches to a fully
 * client-rendered listing page, this function will return zeros and the
 * research agent will just lean on the other sources. */
export async function collectMorphMarketSignals() {
  let html;
  try {
    const res = await fetch(LISTING_URL, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      // MorphMarket can be slow; set a generous but bounded timeout.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      return { items: [], counts: {}, error: `${res.status} ${res.statusText}` };
    }
    html = await res.text();
  } catch (err) {
    return { items: [], counts: {}, error: err.message };
  }

  // Strip script/style blocks so we don't count variables in JS globals.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const counts = {};
  for (const trait of KNOWN_TRAITS) {
    const pattern = new RegExp(
      `(?<![a-z])${trait.replace(/ /g, '\\s+')}(?![a-z])`,
      'gi'
    );
    const matches = cleaned.match(pattern);
    counts[trait] = matches ? matches.length : 0;
  }

  // Build "items" for the research agent — one entry per trait that
  // appeared at least twice, with a snippet the scorer can reason about.
  const items = Object.entries(counts)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([trait, n]) => ({
      source: 'morphmarket',
      url: LISTING_URL,
      title: `${trait} mentions in recent listings`,
      snippet: `"${trait}" appears in ~${n} recent for-sale listing titles on MorphMarket US.`,
      count: n,
      trait,
      observedAt: new Date().toISOString(),
    }));

  return { items, counts };
}
