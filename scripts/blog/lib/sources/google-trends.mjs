/**
 * Google Trends source ,  fetches rising-related-queries for a seed list
 * of gecko terms via Google's public Trends API.
 *
 * We don't use the `google-trends-api` npm package to avoid adding a
 * dependency (the pipeline otherwise only needs @anthropic-ai/sdk).
 * Instead we call the two Trends RPC endpoints directly:
 *
 *   1. /trends/api/explore ,  returns a bag of widget tokens for a query
 *   2. /trends/api/widgetdata/relatedsearches ,  returns the related
 *      queries table (top + rising) for one of those widgets
 *
 * Google prefixes both responses with `)]}',\n` as XSSI protection; we
 * strip that before parsing.
 *
 * If Google changes the undocumented response shape or blocks the
 * runner IP, this returns an empty item set and the research agent
 * continues with the other sources.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const SEEDS = [
  'crested gecko',
  'crested gecko morph',
  'cappuccino gecko',
  'lilly white gecko',
];

function parseGoogleJson(text) {
  // Google XSSI prefix
  const stripped = text.replace(/^\)\]\}',?\n?/, '');
  try { return JSON.parse(stripped); } catch { return null; }
}

async function exploreTokens(query) {
  const req = {
    comparisonItem: [{ keyword: query, geo: 'US', time: 'today 3-m' }],
    category: 0,
    property: '',
  };
  const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`explore: ${res.status}`);
  const text = await res.text();
  const json = parseGoogleJson(text);
  // Find the RELATED_QUERIES widget's token.
  const widget = json?.widgets?.find((w) => w.id === 'RELATED_QUERIES');
  return widget?.token || null;
}

async function relatedQueries(query, token) {
  const req = {
    restriction: {
      geo: { country: 'US' },
      time: 'today 3-m',
      originalTimeRangeForExploreUrl: 'today 3-m',
      complexKeywordsRestriction: { keyword: [{ type: 'BROAD', value: query }] },
    },
    keywordType: 'QUERY',
    metric: ['TOP', 'RISING'],
    trendinessSettings: { compareTime: '' },
    requestOptions: { property: '', backend: 'IZG', category: 0 },
    language: 'en',
    userCountryCode: 'US',
  };
  const url = `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}&token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`related: ${res.status}`);
  const text = await res.text();
  const json = parseGoogleJson(text);
  const rankedList = json?.default?.rankedList || [];
  // rankedList[0] is TOP, rankedList[1] is RISING (sometimes swapped)
  const rising = [];
  const top = [];
  for (const bucket of rankedList) {
    const items = bucket?.rankedKeyword || [];
    for (const k of items) {
      const entry = {
        query: k.query,
        value: k.value, // number for top, "Breakout" or growth % for rising
        hasBreakout: k.value === 'Breakout',
        formattedValue: k.formattedValue,
        link: k.link ? `https://trends.google.com${k.link}` : null,
      };
      // Heuristic to classify: rising items have string formattedValue with "+" or "Breakout"
      const isRising = typeof k.formattedValue === 'string' && (k.formattedValue.includes('+') || k.formattedValue.toLowerCase().includes('breakout'));
      (isRising ? rising : top).push(entry);
    }
  }
  return { rising, top };
}

export async function collectGoogleTrendsSignals() {
  const items = [];
  const errors = [];
  for (const seed of SEEDS) {
    try {
      const token = await exploreTokens(seed);
      if (!token) {
        errors.push(`"${seed}": no RELATED_QUERIES widget token`);
        continue;
      }
      const { rising, top } = await relatedQueries(seed, token);
      for (const r of rising.slice(0, 10)) {
        items.push({
          source: 'google-trends',
          url: r.link,
          title: r.query,
          snippet: `Google Trends rising query (related to "${seed}", last 90 days US): "${r.query}" ${r.formattedValue}`,
          seed,
          kind: 'rising',
          observedAt: new Date().toISOString(),
        });
      }
      for (const t of top.slice(0, 5)) {
        items.push({
          source: 'google-trends',
          url: t.link,
          title: t.query,
          snippet: `Google Trends top related (to "${seed}", last 90 days US): "${t.query}" score ${t.value}`,
          seed,
          kind: 'top',
          observedAt: new Date().toISOString(),
        });
      }
      // polite delay
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      errors.push(`"${seed}": ${err.message}`);
    }
  }
  return { items, errors };
}
