/**
 * Reddit source. Reads crested-gecko-adjacent subreddits and a targeted
 * in-subreddit search. This is the richest non-vendor signal we have:
 * r/crestedgecko is where actual keepers post identification questions,
 * breeding-outcome disasters, and morph debates.
 *
 * IMPORTANT, why this needs OAuth now:
 *
 * Reddit stopped serving the public `.json` views to datacenter IPs. From a
 * GitHub Actions runner every `www.reddit.com/*.json` request comes back 403,
 * no matter how polite the User-Agent is. There is no header-only workaround.
 * The only path that works from CI is Reddit's OAuth API: exchange app
 * credentials for an application-only bearer token, then read from
 * `oauth.reddit.com`.
 *
 * To enable the source, create a "script" app at
 * https://www.reddit.com/prefs/apps and set two repo secrets:
 *
 *   REDDIT_CLIENT_ID       the app's client id (under the app name)
 *   REDDIT_CLIENT_SECRET   the app's secret
 *
 * Without both, we skip Reddit cleanly and let the other sources carry the
 * run, rather than spamming the weekly report with 403s. Bluesky was added as
 * the fail-soft substitute for exactly this reason.
 *
 * OAuth reference: https://github.com/reddit-archive/reddit/wiki/OAuth2
 * (application-only, grant_type=client_credentials).
 */

const UA = 'Mozilla/5.0 (compatible; geckinspect-blog-pipeline/1.0; +https://geckinspect.com)';

const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;
const OAUTH_ENABLED = Boolean(CLIENT_ID && CLIENT_SECRET);

// oauth.reddit.com serves the same listing/search paths as the public site,
// just gated behind a bearer token and without the `.json` suffix.
const API_BASE = 'https://oauth.reddit.com';

const SUBREDDIT_FEEDS = [
  { sub: 'crestedgecko', sort: 'new', limit: 30 },
  { sub: 'crestedgecko', sort: 'top', limit: 15, params: '&t=month' },
  { sub: 'morphmarket',  sort: 'new', limit: 15 },
];

const SEARCH_QUERIES = [
  'cappuccino',
  'lilly white',
  'axanthic',
  'soft scale',
  'frappuccino',
  'super dalmatian',
  'het ',
  'breeding fail',
];

let cachedToken = null;

/**
 * Application-only OAuth: Basic-auth the client id/secret against the token
 * endpoint and get a short-lived bearer token (valid ~1h, plenty for one run).
 * Cached per process so we mint it once, not once per request.
 */
async function getToken() {
  if (cachedToken) return cachedToken;
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (!json.access_token) throw new Error('token: no access_token in response');
  cachedToken = json.access_token;
  return cachedToken;
}

async function fetchJson(url, token, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': UA,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 429 && attempt < 3) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * attempt;
      await new Promise((r) => setTimeout(r, wait));
      return fetchJson(url, token, attempt + 1);
    }
    if (!res.ok) return { error: `${res.status} ${res.statusText}` };
    return { json: await res.json() };
  } catch (err) {
    return { error: err.message };
  }
}

function postToItem(post, queryContext) {
  const d = post?.data;
  if (!d) return null;
  // Skip pure image posts with no text body that aren't actively discussed.
  if (!d.title && !d.selftext) return null;
  const url = d.permalink ? `https://www.reddit.com${d.permalink}` : (d.url || null);
  const body = (d.selftext || '').slice(0, 600);
  return {
    source: 'reddit',
    url,
    title: d.title || '',
    snippet: `r/${d.subreddit}: "${d.title}"${body ? ', ' + body.replace(/\s+/g, ' ').trim() : ''}`,
    score: d.score || 0,
    numComments: d.num_comments || 0,
    upvoteRatio: d.upvote_ratio || 0,
    subreddit: d.subreddit,
    flair: d.link_flair_text || null,
    query: queryContext,
    observedAt: new Date().toISOString(),
    createdUtc: d.created_utc || null,
  };
}

async function collectFromFeeds(token) {
  const items = [];
  const errors = [];
  for (const feed of SUBREDDIT_FEEDS) {
    const extra = feed.params || '';
    const url = `${API_BASE}/r/${feed.sub}/${feed.sort}?limit=${feed.limit}${extra}&raw_json=1`;
    const r = await fetchJson(url, token);
    if (r.error) {
      errors.push(`r/${feed.sub} ${feed.sort}: ${r.error}`);
    } else {
      const children = r.json?.data?.children || [];
      for (const c of children) {
        const it = postToItem(c, `r/${feed.sub}/${feed.sort}`);
        if (it) items.push(it);
      }
    }
    await new Promise((res) => setTimeout(res, 1100));
  }
  return { items, errors };
}

async function collectFromSearch(token) {
  const items = [];
  const errors = [];
  for (const q of SEARCH_QUERIES) {
    const url = `${API_BASE}/r/crestedgecko/search?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&limit=10&raw_json=1`;
    const r = await fetchJson(url, token);
    if (r.error) {
      errors.push(`search "${q}": ${r.error}`);
    } else {
      const children = r.json?.data?.children || [];
      for (const c of children) {
        const it = postToItem(c, `search:${q}`);
        if (it) items.push(it);
      }
    }
    await new Promise((res) => setTimeout(res, 1100));
  }
  return { items, errors };
}

export async function collectRedditSignals() {
  if (!OAUTH_ENABLED) {
    // Fail-soft: not an error, just an un-configured optional source.
    return {
      items: [],
      errors: ['skipped: set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET to enable the Reddit source'],
    };
  }

  let token;
  try {
    token = await getToken();
  } catch (err) {
    return { items: [], errors: [`auth failed: ${err.message}`] };
  }

  const feedResult = await collectFromFeeds(token);
  const searchResult = await collectFromSearch(token);
  const all = [...feedResult.items, ...searchResult.items];

  const seen = new Set();
  const unique = all.filter((it) => {
    if (!it.url || seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });

  unique.sort((a, b) => (b.score + b.numComments * 3) - (a.score + a.numComments * 3));

  return {
    items: unique.slice(0, 80),
    errors: [...feedResult.errors, ...searchResult.errors],
  };
}
