/**
 * Breeder-blog RSS source — pulls recent posts from established breeder
 * blogs. These carry heavier weight than forum chatter because they
 * represent what working breeders are actively producing and writing
 * about.
 *
 * We look at three feeds: LM Reptiles (Lil Monsters), AC Reptiles, and
 * the Pangea Reptile blog (distinct from the forum). All three publish
 * Atom/RSS feeds as a standard WordPress/Shopify artifact. If a site
 * moves platforms and the feed URL changes, we drop that source rather
 * than crash the run.
 *
 * Parse strategy: defensive regex over `<item>…</item>` (RSS 2.0) or
 * `<entry>…</entry>` (Atom). We extract title, link, and a short
 * summary from the first of <description>/<content:encoded>/<summary>.
 * Zero XML parsing dependencies.
 */

const UA = 'Mozilla/5.0 (compatible; geckinspect-blog-pipeline/1.0; +https://geckinspect.com)';

const FEEDS = [
  { name: 'Lil Monsters Reptiles',   url: 'https://www.lmreptiles.com/blogs/news.atom' },
  { name: 'AC Reptiles',             url: 'https://www.acreptiles.com/blogs/news.atom' },
  { name: 'Pangea Reptile blog',     url: 'https://www.pangeareptile.com/blogs/news.atom' },
];

function stripHtml(s) {
  if (!s) return '';
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
}

function firstMatch(re, text) {
  const m = text.match(re);
  return m ? m[1] : '';
}

function parseFeed(name, url, xml) {
  // Atom first (both LM Reptiles + Pangea Shopify stores ship Atom).
  if (xml.includes('<entry')) {
    const entries = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/g)].map((m) => m[0]);
    return entries.slice(0, 15).map((e) => {
      const title = stripHtml(firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/, e));
      const link  = firstMatch(/<link[^>]*href="([^"]+)"/, e) || firstMatch(/<link[^>]*>([^<]+)</, e);
      const summary = stripHtml(firstMatch(/<summary[^>]*>([\s\S]*?)<\/summary>/, e) || firstMatch(/<content[^>]*>([\s\S]*?)<\/content>/, e));
      return {
        source: 'breeder-blog',
        url: link || url,
        title,
        snippet: `${name}: "${title}"${summary ? ' — ' + summary.slice(0, 400) : ''}`,
        publisher: name,
        observedAt: new Date().toISOString(),
      };
    });
  }

  // RSS 2.0 fallback.
  if (xml.includes('<item')) {
    const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/g)].map((m) => m[0]);
    return items.slice(0, 15).map((it) => {
      const title = stripHtml(firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/, it));
      const link  = firstMatch(/<link[^>]*>([\s\S]*?)<\/link>/, it);
      const desc  = stripHtml(firstMatch(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/, it) || firstMatch(/<description[^>]*>([\s\S]*?)<\/description>/, it));
      return {
        source: 'breeder-blog',
        url: link || url,
        title,
        snippet: `${name}: "${title}"${desc ? ' — ' + desc.slice(0, 400) : ''}`,
        publisher: name,
        observedAt: new Date().toISOString(),
      };
    });
  }

  return [];
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': UA, 'Accept': 'application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { items: [], error: `${feed.name}: ${res.status} ${res.statusText}` };
    const xml = await res.text();
    return { items: parseFeed(feed.name, feed.url, xml) };
  } catch (err) {
    return { items: [], error: `${feed.name}: ${err.message}` };
  }
}

export async function collectBreederBlogSignals() {
  const items = [];
  const errors = [];
  for (const feed of FEEDS) {
    const r = await fetchFeed(feed);
    items.push(...r.items);
    if (r.error) errors.push(r.error);
  }
  // Filter: some blogs post product updates, not morph content. Require
  // at least one gecko-related keyword in the title or snippet.
  const gecko = /crest(ed)?|gargoyle|correlophus|morph|lilly|cappuccino|axanthic|soft ?scale|harlequin|dalmatian|hatchling|breeding/i;
  const filtered = items.filter((x) => gecko.test(x.title) || gecko.test(x.snippet));
  return { items: filtered, errors };
}
