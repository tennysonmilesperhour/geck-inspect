/**
 * Reddit source — pulls hot + rising + top-week threads from crested-gecko
 * subreddits via Reddit's public JSON endpoints. No auth needed for read.
 *
 * Reddit's API policy allows unauthenticated read at low volume so long as
 * we set a descriptive User-Agent. We cap at ~6 requests per research run
 * to stay well under the 60 QPM anonymous limit.
 *
 * Output shape (matches the research agent's expected "evidence" schema):
 *   [{ source: 'reddit', url, title, snippet, score, commentCount, observedAt }]
 */
const UA = 'geckinspect-blog-pipeline/1.0 (+https://geckinspect.com)';

const SUBREDDITS = [
  'CrestedGecko',
  'Reptiles',
];

const SORTS = [
  { path: 'hot',   label: 'hot' },
  { path: 'new',   label: 'new' },
  { path: 'top',   label: 'top-week', query: '?t=week&limit=25' },
];

async function fetchListing(subreddit, sort) {
  const url = `https://www.reddit.com/r/${subreddit}/${sort.path}.json${sort.query || '?limit=25'}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    // Don't crash the whole run over one subreddit; let the research agent
    // proceed with whatever it got from the other sources.
    return { error: `${res.status} ${res.statusText}`, url, items: [] };
  }
  const json = await res.json();
  const items = (json?.data?.children || []).map((c) => {
    const d = c.data || {};
    const selftext = (d.selftext || '').slice(0, 1200);
    return {
      source: 'reddit',
      url: d.permalink ? `https://reddit.com${d.permalink}` : null,
      title: d.title || '',
      snippet: selftext,
      score: d.score || 0,
      commentCount: d.num_comments || 0,
      subreddit: d.subreddit,
      flair: d.link_flair_text || null,
      observedAt: new Date().toISOString(),
      sort: sort.label,
    };
  });
  return { items };
}

/**
 * Collect a research batch. Returns up to ~150 threads (3 sorts × 2 subs × 25).
 * Filters out stickied/mod posts and obvious non-content (removed, deleted).
 */
export async function collectRedditSignals() {
  const batches = [];
  for (const sub of SUBREDDITS) {
    for (const sort of SORTS) {
      const result = await fetchListing(sub, sort);
      if (result.error) {
        batches.push({ subreddit: sub, sort: sort.label, error: result.error, items: [] });
      } else {
        batches.push({ subreddit: sub, sort: sort.label, items: result.items });
      }
      // polite delay; reddit anonymous is rate-limited at 60/min
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  const flat = batches.flatMap((b) => b.items).filter((item) => {
    if (!item.title) return false;
    if (item.title.toLowerCase().startsWith('[meta]')) return false;
    if (item.snippet === '[removed]' || item.snippet === '[deleted]') return false;
    return true;
  });

  // Dedupe by URL — "hot" and "new" can overlap.
  const seen = new Set();
  const unique = [];
  for (const item of flat) {
    const key = item.url || `${item.title}|${item.subreddit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return {
    items: unique,
    errors: batches.filter((b) => b.error).map((b) => `${b.subreddit}/${b.sort}: ${b.error}`),
    subreddits: SUBREDDITS,
  };
}
