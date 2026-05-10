/**
 * Google autocomplete source ,  hits the public suggest API for seed queries
 * and returns the full long-tail tree.
 *
 * Endpoint: http://suggestqueries.google.com/complete/search?client=firefox&q=<query>
 * Response: ["seed", ["suggestion 1", "suggestion 2", ...]]
 *
 * Why this matters: Google autocomplete is the cleanest signal of what
 * real people type into search boxes. "cappuccino crested gecko" returning
 * "cappuccino crested gecko lethal" tells us the audience is worried about
 * the super form ,  that's a topic with clear reader stakes.
 *
 * We seed with short heads ("crested gecko", "cappuccino crested gecko",
 * etc.) and walk one level of children per seed. That's ~20 queries total
 * per research run, well under any rate limits.
 */

const UA = 'Mozilla/5.0 (compatible; geckinspect-blog-pipeline/1.0)';

const SEEDS = [
  'crested gecko',
  'crested gecko morph',
  'crested gecko breeding',
  'cappuccino crested gecko',
  'lilly white crested gecko',
  'axanthic crested gecko',
  'soft scale crested gecko',
  'frappuccino gecko',
  'crested gecko het',
  'why is my crested gecko',
];

async function suggest(query) {
  const url = `http://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  } catch {
    return [];
  }
}

/**
 * Returns { items: [...], suggestions: { seed: [...] } }.
 * Items are suitable for the research agent evidence list.
 */
export async function collectGoogleAutocomplete() {
  const suggestions = {};
  const items = [];
  for (const seed of SEEDS) {
    const subs = await suggest(seed);
    suggestions[seed] = subs;
    for (const s of subs) {
      items.push({
        source: 'google-ac',
        url: null,
        title: s,
        snippet: `Google autocomplete for "${seed}" suggests "${s}"`,
        seed,
        observedAt: new Date().toISOString(),
      });
    }
    // polite delay
    await new Promise((r) => setTimeout(r, 350));
  }

  // Dedupe: the same phrase can appear under multiple seeds.
  const seen = new Set();
  const unique = items.filter((it) => {
    const key = it.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { items: unique, suggestions };
}
