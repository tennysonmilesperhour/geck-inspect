/**
 * Bluesky source — queries the public `searchPosts` XRPC endpoint for
 * gecko-relevant terms.
 *
 * Endpoint:  https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts
 * Auth:      none required for public read
 * Docs:      https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
 *
 * Why this is useful: Bluesky's reptile community has grown since 2024
 * as hobbyists migrated off Twitter. Posts skew toward breeder
 * announcements and real-time debate — signal that's harder to find on
 * Reddit (which leans pet-keeper questions) or Pangea (which leans
 * long-running project threads).
 *
 * Rate limits: Bluesky applies per-IP limits (~3000/5min unauthenticated)
 * which we're nowhere near.
 */

const UA = 'Mozilla/5.0 (compatible; geckinspect-blog-pipeline/1.0; +https://geckinspect.com)';

// Targeted queries. Bluesky's search is post-content substring; we bias
// toward terms that are unique to the hobby (not "gecko" which gets
// leopard + day gecko noise).
const QUERIES = [
  'crested gecko',
  'correlophus ciliatus',
  'cappuccino gecko',
  'lilly white gecko',
  'axanthic gecko',
  'gargoyle gecko',
  'crested gecko morph',
];

const ENDPOINT = 'https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts';

async function search(q, limit = 25) {
  const url = `${ENDPOINT}?q=${encodeURIComponent(q)}&limit=${limit}&sort=latest`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { items: [], error: `${res.status} ${res.statusText}` };
    const json = await res.json();
    const posts = Array.isArray(json?.posts) ? json.posts : [];
    const items = posts.map((p) => {
      const text = p?.record?.text || '';
      const handle = p?.author?.handle || '';
      // bsky URLs use the rkey, not the full URI
      const rkey = (p?.uri || '').split('/').pop();
      const url = handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : null;
      return {
        source: 'bluesky',
        url,
        title: text.slice(0, 100),
        snippet: text.slice(0, 600),
        likeCount: p?.likeCount || 0,
        replyCount: p?.replyCount || 0,
        repostCount: p?.repostCount || 0,
        authorHandle: handle,
        observedAt: new Date().toISOString(),
        query: q,
      };
    });
    return { items };
  } catch (err) {
    return { items: [], error: err.message };
  }
}

export async function collectBlueskySignals() {
  const items = [];
  const errors = [];
  for (const q of QUERIES) {
    const r = await search(q);
    if (r.error) errors.push(`"${q}": ${r.error}`);
    items.push(...r.items);
    await new Promise((r) => setTimeout(r, 250));
  }

  // Dedupe by URL (a post can match multiple queries).
  const seen = new Set();
  const unique = items.filter((it) => {
    if (!it.url || seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });

  // Sort by engagement and cap to ~80 so we don't drown the scorer in noise.
  unique.sort((a, b) => (b.likeCount + b.replyCount * 2) - (a.likeCount + a.replyCount * 2));
  return { items: unique.slice(0, 80), errors };
}
