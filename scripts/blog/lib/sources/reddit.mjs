/**
 * Reddit source. Hits the public `.json` views of crested-gecko-adjacent
 * subreddits and a targeted in-subreddit search. This replaces the Pangea
 * forum signal we lost when that site went read-only in 2024.
 *
 * Why Reddit is the strongest non-vendor signal: r/crestedgecko is where
 * actual keepers post identification questions, breeding-outcome disasters,
 * and morph debates. The /new feed surfaces unsolved confusion; targeted
 * search picks up established threads on specific morphs.
 *
 * Reddit blocks generic bots (default Mozilla UA returns 403) but accepts
 * a self-identifying UA that includes a contact URL. We respect their
 * recommended 60 req/min ceiling by spacing requests at ~1s.
 *
 * If Reddit ever tightens further (auth-only JSON), this source returns an
 * empty item set and the research agent continues without it.
 */

const UA = 'Mozilla/5.0 (compatible; geckinspect-blog-pipeline/1.0; +https://geckinspect.com)';

const SUBREDDIT_FEEDS = [
  { sub: 'crestedgecko', sort: 'new',      limit: 30 },
  { sub: 'crestedgecko', sort: 'top',      limit: 15, params: '&t=month' },
  { sub: 'morphmarket',  sort: 'new',      limit: 15 },
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

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 429 && attempt < 3) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * attempt;
      await new Promise((r) => setTimeout(r, wait));
      return fetchJson(url, attempt + 1);
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
    snippet: `r/${d.subreddit}: "${d.title}"${body ? ' ,  ' + body.replace(/\s+/g, ' ').trim() : ''}`,
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

async function collectFromFeeds() {
  const items = [];
  const errors = [];
  for (const feed of SUBREDDIT_FEEDS) {
    const extra = feed.params || '';
    const url = `https://www.reddit.com/r/${feed.sub}/${feed.sort}.json?limit=${feed.limit}${extra}`;
    const r = await fetchJson(url);
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

async function collectFromSearch() {
  const items = [];
  const errors = [];
  for (const q of SEARCH_QUERIES) {
    const url = `https://www.reddit.com/r/crestedgecko/search.json?q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&limit=10`;
    const r = await fetchJson(url);
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
  const [feedResult, searchResult] = [await collectFromFeeds(), await collectFromSearch()];
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
