/**
 * Public page for a shared Morph ID result card.
 *
 * GET /morph-id/r/<share id>  (vercel.json rewrites it to /api/morph-share?id=<share id>)
 *
 * A member makes a card by tapping Share after an identification
 * (create_morph_id_share in supabase/migrations/20261015151300_morph_id_share_card.sql).
 * This edge function serves the whole page as server HTML, the way
 * api/share.js does for calculator pairings, so Facebook, Messenger,
 * iMessage and Discord read a real title, description and photo when the
 * link is pasted into a "what morph is this?" thread. People get the same
 * page: the photo, the likely and possible traits in plain words, the
 * confidence in words, "Visual traits, not proven genes", and an
 * invitation to try Morph ID that carries the card id to sign-up.
 *
 * A view is counted only for a person: crawlers, scripts and link-preview
 * fetchers read the card without counting it. The page is not cached at
 * the edge, so a card the owner deletes disappears at once.
 */
import { classifyAgent } from './_lib/bots.js';
import {
  isLinkPreviewFetcher,
  isShareId,
  shareCardMeta,
  shareImageUrl,
  shareInviteHref,
  shareUrl,
  SHARE_PATH_PREFIX,
} from '../src/lib/morphShareCard.js';

export const config = { runtime: 'edge' };

const SITE = 'https://geckinspect.com';
const DEFAULT_SUPABASE_URL = 'https://mmuglfphhwlaluyfyxsp.supabase.co';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** The card id from ?id= (after the rewrite) or from the original path. */
export function shareIdFromRequest(url) {
  const fromQuery = url.searchParams.get('id');
  if (isShareId(fromQuery)) return fromQuery;
  const idx = url.pathname.indexOf(SHARE_PATH_PREFIX);
  if (idx >= 0) {
    const rest = url.pathname.slice(idx + SHARE_PATH_PREFIX.length).replace(/\/$/, '');
    if (isShareId(rest)) return rest;
  }
  return null;
}

/** True when this request is a person opening the page, not a robot or a prefetch. */
export function countsAsView(req) {
  if (req.method !== 'GET') return false;
  const purpose = `${req.headers.get('purpose') || ''} ${req.headers.get('sec-purpose') || ''}`.toLowerCase();
  if (purpose.includes('prefetch') || purpose.includes('prerender')) return false;
  const ua = req.headers.get('user-agent') || '';
  return !classifyAgent(ua) && !isLinkPreviewFetcher(ua);
}

const STYLE = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#020617;color:#e2e8f0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:#6ee7b7}
.wrap{max-width:40rem;margin:0 auto;padding:1rem 1rem 3rem}
.top{display:flex;justify-content:space-between;align-items:center;padding:.25rem 0 1rem}
.brand{color:#e2e8f0;text-decoration:none;font-weight:700;letter-spacing:.01em}
.card{background:#0f172a;border:1px solid #1e293b;border-radius:1rem;overflow:hidden}
.photo{display:block;width:100%;max-height:28rem;object-fit:contain;background:#020617}
.body{padding:1.25rem}
.eyebrow{font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#6ee7b7;margin:0}
h1{font-size:1.6rem;line-height:1.2;margin:.35rem 0 .75rem}
.conf{display:inline-block;border-radius:999px;padding:.2rem .7rem;font-size:.85rem;font-weight:600}
.conf-high{background:#064e3b;color:#a7f3d0}
.conf-medium{background:#422006;color:#fde68a}
.conf-low{background:#1e293b;color:#cbd5e1}
.detail{color:#94a3b8;font-size:.9rem;margin:.5rem 0 1rem}
h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin:1rem 0 .4rem}
.chips{display:flex;flex-wrap:wrap;gap:.4rem;margin:0;padding:0;list-style:none}
.chips li{border:1px solid #334155;border-radius:.5rem;padding:.25rem .6rem;font-size:.95rem}
.chips.likely li{border-color:#047857;background:#022c22}
.note{margin-top:1.25rem;border-left:3px solid #f59e0b;background:#1c1917;padding:.75rem 1rem;border-radius:.25rem;font-size:.92rem}
.note strong{color:#fde68a}
.cta{margin-top:1.5rem;text-align:center}
.btn{display:inline-block;min-height:44px;padding:.7rem 1.2rem;border-radius:.6rem;background:#059669;color:#fff;text-decoration:none;font-weight:600}
.btn2{display:inline-block;min-height:44px;padding:.7rem 1rem;color:#6ee7b7}
.small{color:#94a3b8;font-size:.85rem}
footer{margin-top:2rem;text-align:center;font-size:.85rem;color:#64748b}
footer a{color:#94a3b8;margin:0 .5rem}
`;

function page({ title, description, image, imageAlt, canonical, body }) {
  const og = image
    ? `<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:image" content="${esc(image)}">`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex, follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Geck Inspect">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
${og}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" href="/favicon.ico">
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
<header class="top"><a class="brand" href="/">Geck Inspect</a><a href="/MorphGuide">Morph Guide</a></header>
${body}
<footer><a href="/Recognition">Morph ID</a><a href="/MorphGuide">Morph Guide</a><a href="/calculator">Genetics calculator</a><a href="/PrivacyPolicy">Privacy</a></footer>
</div>
</body>
</html>`;
}

const list = (items, cls) =>
  `<ul class="chips ${cls}">${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;

/** The page for one card. Exported for tests. */
export function renderSharePage({ id, share, supabaseUrl }) {
  const { title, description, view } = shareCardMeta(share.card || {});
  const image = shareImageUrl(supabaseUrl, share.image_path);
  const imageAlt = `Crested gecko photo shared from Geck Inspect Morph ID: ${view.headline}`;
  const tryHref = shareInviteHref(id, '/Recognition');
  const signupHref = shareInviteHref(id, '/AuthPortal', { mode: 'signup' });
  const body = `<main class="card">
${image ? `<img class="photo" src="${esc(image)}" alt="${esc(imageAlt)}">` : ''}
<div class="body">
<p class="eyebrow">Morph ID result</p>
<h1>${esc(view.headline)}</h1>
<span class="conf conf-${esc(view.confidence.level)}">${esc(view.confidence.word)}</span>
<p class="detail">${esc(view.confidence.detail)}</p>
${view.likely.length ? `<h2>Likely</h2>${list(view.likely, 'likely')}` : ''}
${view.possible.length ? `<h2>Possible</h2>${list(view.possible, 'possible')}` : ''}
<div class="note"><strong>${esc(view.disclaimer)}.</strong> Morph ID reads what the photos show. Lilly White, Axanthic or Cappuccino on a photo is a look, not a test result: only breeding records and pairings prove what a gecko carries.</div>
<div class="cta">
<p><a class="btn" href="${esc(tryHref)}">Try Morph ID on your crested gecko</a></p>
<p><a class="btn2" href="${esc(signupHref)}">Create a free account</a></p>
<p class="small">Free accounts get one identification a month. Add a top photo and a side photo and you get a shortlist with the evidence behind it.</p>
</div>
</div>
</main>`;
  return page({ title, description, image, imageAlt, canonical: shareUrl(id, SITE), body });
}

/**
 * The page for a card that does not exist or was deleted, or (with
 * unavailable) for a card that could not be loaded just now.
 */
export function renderGonePage({ unavailable = false } = {}) {
  const heading = unavailable ? 'This card could not load right now' : 'This card is no longer shared';
  const detail = unavailable
    ? 'Please try the link again in a minute. You can still run Morph ID on your own crested gecko.'
    : 'The person who shared it may have removed it. You can still run Morph ID on your own crested gecko.';
  const body = `<main class="card"><div class="body">
<p class="eyebrow">Morph ID</p>
<h1>${heading}</h1>
<p class="detail">${detail}</p>
<div class="cta"><p><a class="btn" href="/Recognition">Try Morph ID</a></p></div>
</div></main>`;
  return page({
    title: 'Morph ID card not found | Geck Inspect',
    description: 'This Morph ID card is no longer shared. Try Morph ID on your own crested gecko.',
    image: null,
    imageAlt: '',
    canonical: `${SITE}/Recognition`,
    body,
  });
}

function html(status, markup) {
  return new Response(markup, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // No edge cache: a deleted card must vanish now, and every person's
      // visit has to reach this function to be counted.
      'cache-control': 'private, no-store',
      'x-robots-tag': 'noindex, follow',
      'x-content-type-options': 'nosniff',
    },
  });
}

/**
 * Build the handler. Tests pass their own fetch and settings; production
 * reads the same public Supabase settings the middleware uses.
 */
export function createHandler({ fetchImpl, supabaseUrl, anonKey } = {}) {
  return async function handler(req) {
    const url = new URL(req.url);
    const id = shareIdFromRequest(url);
    if (!id) return html(404, renderGonePage());

    const base = supabaseUrl || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const key = anonKey || process.env.VITE_SUPABASE_ANON_KEY;
    const doFetch = fetchImpl || fetch;
    if (!key) return html(503, renderGonePage({ unavailable: true }));

    let share = null;
    try {
      const res = await doFetch(`${base}/rest/v1/rpc/get_morph_id_share`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_id: id, p_count_view: countsAsView(req) }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return html(503, renderGonePage({ unavailable: true }));
      share = await res.json();
    } catch {
      return html(503, renderGonePage({ unavailable: true }));
    }
    if (!share || typeof share !== 'object' || !share.card) return html(404, renderGonePage());
    return html(200, renderSharePage({ id, share, supabaseUrl: base }));
  };
}

export default createHandler();
