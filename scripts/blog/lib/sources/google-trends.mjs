/**
 * Google Trends source. Fetches rising and top related queries for a seed
 * list of gecko terms via Google's undocumented Trends RPC.
 *
 * Two-step protocol:
 *   1. /trends/api/explore returns a bag of widget tokens for the keyword.
 *   2. /trends/api/widgetdata/relatedsearches takes one of those tokens and
 *      returns the related-queries table (top + rising).
 *
 * Both responses are prefixed with `)]}',\n` as XSSI protection and must be
 * stripped before JSON.parse.
 *
 * Anti-bot context: in early 2026 Google started rate-limiting cookie-less
 * explore calls aggressively (429 within the first request). The fix is to
 * warm up a session by hitting trends.google.com first so we collect the
 * NID / CONSENT / SOCS cookies the API actually checks, then reuse them on
 * every explore + widgetdata call. We do this once per process, not per
 * keyword, so the cost is a single extra round trip per pipeline run.
 *
 * If Google blocks the runner entirely, this returns an empty item set and
 * the research agent continues without trend signals.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ACCEPT_LANG = 'en-US,en;q=0.9';

const SEEDS = [
  'crested gecko',
  'crested gecko morph',
  'cappuccino gecko',
  'lilly white gecko',
];

let cachedCookieHeader = null;

function parseGoogleJson(text) {
  const stripped = text.replace(/^\)\]\}',?\n?/, '');
  try { return JSON.parse(stripped); } catch { return null; }
}

/**
 * Build a `Cookie:` header from a single Set-Cookie response. We only
 * keep cookie name=value pairs, dropping attributes (Domain, Path, etc.).
 * Multiple Set-Cookie headers join into one cookie string.
 */
function setCookieHeaderToCookieJar(setCookieHeader) {
  if (!setCookieHeader) return '';
  // node fetch concatenates multiple Set-Cookie with ", " which conflicts
  // with the expiry-comma in `Expires=Mon, 01 Jan 2026 ...`. We split
  // defensively on `, ` ONLY where the next token looks like an attribute
  // name followed by `=` (i.e. a new cookie), not a date.
  const parts = setCookieHeader.split(/,(?=\s*[A-Za-z0-9!#$%&'*+.^_`|~-]+=)/);
  const pairs = parts
    .map((p) => p.trim().split(';')[0])
    .filter(Boolean);
  return pairs.join('; ');
}

async function warmupCookies() {
  if (cachedCookieHeader !== null) return cachedCookieHeader;
  try {
    const res = await fetch('https://trends.google.com/trends/', {
      headers: { 'User-Agent': UA, 'Accept-Language': ACCEPT_LANG, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    });
    cachedCookieHeader = setCookieHeaderToCookieJar(res.headers.get('set-cookie'));
  } catch {
    cachedCookieHeader = '';
  }
  return cachedCookieHeader;
}

function buildHeaders() {
  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': ACCEPT_LANG,
    'Referer': 'https://trends.google.com/trends/explore',
  };
  if (cachedCookieHeader) headers.Cookie = cachedCookieHeader;
  return headers;
}

async function fetchWithBackoff(url, opts, label, maxAttempts = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429) {
        const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * attempt;
        await new Promise((r) => setTimeout(r, wait));
        lastErr = new Error(`${label}: 429`);
        continue;
      }
      if (!res.ok) throw new Error(`${label}: ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  throw lastErr || new Error(`${label}: unknown error`);
}

async function exploreWidget(query) {
  const req = {
    comparisonItem: [{ keyword: query, geo: 'US', time: 'today 3-m' }],
    category: 0,
    property: '',
  };
  const url = `https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(req))}`;
  const res = await fetchWithBackoff(url, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(15_000),
  }, 'explore');
  const text = await res.text();
  const json = parseGoogleJson(text);
  // The widget object carries both the token AND the canonical request
  // payload that widgetdata/relatedsearches expects. As of 2026 Google
  // returns 400 unless we echo this object back verbatim (the request
  // includes the resolved date range like "2026-02-15 2026-05-15", not
  // the original "today 3-m"). Don't try to rebuild this by hand.
  return json?.widgets?.find((w) => w.id === 'RELATED_QUERIES') || null;
}

async function relatedQueries(widget) {
  const url = `https://trends.google.com/trends/api/widgetdata/relatedsearches?hl=en-US&tz=0&req=${encodeURIComponent(JSON.stringify(widget.request))}&token=${encodeURIComponent(widget.token)}`;
  const res = await fetchWithBackoff(url, {
    headers: buildHeaders(),
    signal: AbortSignal.timeout(15_000),
  }, 'related');
  const text = await res.text();
  const json = parseGoogleJson(text);
  const rankedList = json?.default?.rankedList || [];
  const rising = [];
  const top = [];
  for (const bucket of rankedList) {
    const items = bucket?.rankedKeyword || [];
    for (const k of items) {
      const entry = {
        query: k.query,
        value: k.value,
        hasBreakout: k.value === 'Breakout',
        formattedValue: k.formattedValue,
        link: k.link ? `https://trends.google.com${k.link}` : null,
      };
      const isRising = typeof k.formattedValue === 'string' && (k.formattedValue.includes('+') || k.formattedValue.toLowerCase().includes('breakout'));
      (isRising ? rising : top).push(entry);
    }
  }
  return { rising, top };
}

export async function collectGoogleTrendsSignals() {
  await warmupCookies();
  const items = [];
  const errors = [];
  for (const seed of SEEDS) {
    try {
      const widget = await exploreWidget(seed);
      if (!widget?.token) {
        errors.push(`"${seed}": no RELATED_QUERIES widget token`);
        continue;
      }
      const { rising, top } = await relatedQueries(widget);
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
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      errors.push(`"${seed}": ${err.message}`);
    }
  }
  return { items, errors };
}
