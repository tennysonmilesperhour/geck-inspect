/**
 * Pangea forum source — reads the public recent-topics feed for Pangea Reptile's
 * crested gecko forum and surfaces thread titles + opening post previews.
 *
 * The forum is public-read without login. We hit the RSS-style recent topics
 * page, parse thread titles, and return them as research signals. We do NOT
 * crawl individual thread pages; signal value is in the thread titles.
 *
 * If Pangea changes their forum structure or goes offline, this module
 * returns an empty set and the research agent continues without it.
 */
const UA = 'geckinspect-blog-pipeline/1.0 (+https://geckinspect.com)';

// Pangea's crested gecko sub-forum index — title + teaser per thread.
const FORUM_URL = 'https://www.pangeareptile.com/forums/forums/crested-geckos.4/';

function extractThreadTitles(html) {
  // defensive regex: Pangea uses XenForo; thread titles sit inside
  // `<a … class="…thread-title…">Title</a>` but the markup drifts over time.
  // Cast a wide net, then filter for reasonable-looking titles.
  const out = [];
  const anchorRe = /<a[^>]+href="([^"]*threads\/[^"]+)"[^>]*>([^<]{5,160})<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(html)) !== null) {
    const href = match[1];
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (!title) continue;
    // Skip XenForo nav links like "Go to first unread post"
    if (/first unread|latest post|quick reply/i.test(title)) continue;
    const url = href.startsWith('http') ? href : `https://www.pangeareptile.com${href.startsWith('/') ? '' : '/'}${href}`;
    out.push({ title, url });
    if (out.length >= 40) break;
  }
  // Dedupe by title.
  const seen = new Set();
  return out.filter((t) => {
    if (seen.has(t.title)) return false;
    seen.add(t.title);
    return true;
  });
}

export async function collectPangeaSignals() {
  let html;
  try {
    const res = await fetch(FORUM_URL, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { items: [], error: `${res.status} ${res.statusText}` };
    }
    html = await res.text();
  } catch (err) {
    return { items: [], error: err.message };
  }

  const threads = extractThreadTitles(html);
  const items = threads.map((t) => ({
    source: 'pangea',
    url: t.url,
    title: t.title,
    snippet: `Pangea crested-gecko forum thread: "${t.title}"`,
    observedAt: new Date().toISOString(),
  }));

  return { items };
}
