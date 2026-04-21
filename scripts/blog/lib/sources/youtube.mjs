/**
 * YouTube source — extracts recent + top video titles for gecko queries.
 *
 * Strategy: YouTube's official Data API requires an API key. To avoid
 * adding another secret, we scrape the public search results page with
 * a realistic browser User-Agent. YouTube embeds initial search results
 * in an `ytInitialData` JSON blob inside a <script> tag; we regex it out
 * and walk to `contents.twoColumnSearchResultsRenderer` → item list.
 *
 * This is brittle by design. If YouTube changes the blob key or
 * starts serving an empty shell to unauthenticated non-browsers, this
 * returns an empty set. Not worth a full headless-browser investment
 * for one signal.
 *
 * Value: YouTube title velocity is a leading indicator — a flurry of
 * "My First Cappuccino Hatched!" videos precedes a surge in
 * marketplace activity by 4-8 weeks.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const QUERIES = [
  'crested gecko morph',
  'cappuccino crested gecko',
  'lilly white crested gecko',
  'crested gecko breeding',
  'axanthic gecko',
];

async function searchYouTube(q) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAISAhAB`; // sp=CAISAhAB = upload date filter "this month"
  let html;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { items: [], error: `${res.status} ${res.statusText}` };
    html = await res.text();
  } catch (err) {
    return { items: [], error: err.message };
  }

  // Pull the ytInitialData blob.
  const match = html.match(/var ytInitialData\s*=\s*({[\s\S]*?});<\/script>/);
  if (!match) return { items: [], error: 'no ytInitialData blob' };
  let data;
  try { data = JSON.parse(match[1]); }
  catch { return { items: [], error: 'ytInitialData parse failure' }; }

  // Walk: contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[*].itemSectionRenderer.contents[*].videoRenderer
  const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const out = [];
  for (const s of sections) {
    const list = s?.itemSectionRenderer?.contents || [];
    for (const it of list) {
      const v = it?.videoRenderer;
      if (!v) continue;
      const title = v?.title?.runs?.[0]?.text || v?.title?.accessibility?.accessibilityData?.label || '';
      if (!title) continue;
      const videoId = v?.videoId;
      const channel = v?.longBylineText?.runs?.[0]?.text || v?.ownerText?.runs?.[0]?.text || '';
      const viewCountText = v?.viewCountText?.simpleText || v?.shortViewCountText?.simpleText || '';
      const publishedText = v?.publishedTimeText?.simpleText || '';
      out.push({
        source: 'youtube',
        url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
        title,
        snippet: `YouTube: "${title}" by ${channel} — ${viewCountText} (${publishedText})`,
        channel,
        viewCountText,
        publishedText,
        observedAt: new Date().toISOString(),
        query: q,
      });
      if (out.length >= 15) break; // cap per-query
    }
    if (out.length >= 15) break;
  }
  return { items: out };
}

export async function collectYouTubeSignals() {
  const items = [];
  const errors = [];
  for (const q of QUERIES) {
    const r = await searchYouTube(q);
    if (r.error) errors.push(`"${q}": ${r.error}`);
    items.push(...r.items);
    await new Promise((r) => setTimeout(r, 800));
  }

  // Dedupe by URL.
  const seen = new Set();
  const unique = items.filter((it) => {
    if (!it.url || seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
  return { items: unique, errors };
}
