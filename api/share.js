/**
 * Crawler-friendly share page for calculator pairings.
 *
 * GET /api/share?sire=<state>&dam=<state>&s=<sire label>&d=<dam label>&o=<label~pct|...>
 *
 * The SPA's prerendered /calculator page cannot vary its Open Graph
 * meta by query string, so share links point here instead: this tiny
 * edge function serves HTML whose og:image is the dynamic
 * /api/og-pairing card for THIS pairing, then immediately forwards
 * humans to the real calculator with the same state. Crawlers read
 * the meta; people never notice the hop.
 *
 * All params are untrusted text and are HTML-escaped before
 * interpolation.
 */
export const config = { runtime: 'edge' };

const esc = (s) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const clip = (text, max) =>
  text && text.length > max ? `${text.slice(0, max - 3)}...` : text || '';

export default function handler(req) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const sireLabel = clip(p.get('s') || 'Wild-type', 80);
  const damLabel = clip(p.get('d') || 'Wild-type', 80);
  const outcomes = clip(p.get('o') || '', 400);
  const sireState = clip(p.get('sire') || '', 400);
  const damState = clip(p.get('dam') || '', 400);

  const calcQuery = new URLSearchParams();
  if (sireState) calcQuery.set('sire', sireState);
  if (damState) calcQuery.set('dam', damState);
  const calcPath = `/calculator${calcQuery.toString() ? `?${calcQuery.toString()}` : ''}`;
  const calcUrl = `${url.origin}${calcPath}`;

  const ogQuery = new URLSearchParams({ s: sireLabel, d: damLabel, o: outcomes });
  const ogImage = `${url.origin}/api/og-pairing?${ogQuery.toString()}`;

  const title = `${sireLabel} x ${damLabel}: Crested Gecko Odds`;
  const description =
    'Per-egg odds from exact Punnett math on the free Geck Inspect crested gecko genetics calculator. Tap to open this pairing and explore it.';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Geck Inspect">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(calcUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<link rel="canonical" href="${esc(calcUrl)}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${esc(calcPath)}">
<style>body{background:#0F172A;color:#E2E8F0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}</style>
</head>
<body>
<p>Opening this pairing in the <a style="color:#A78BFA" href="${esc(calcPath)}">Geck Inspect genetics calculator</a>...</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
