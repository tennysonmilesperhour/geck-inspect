/**
 * Link previews for the pages breeders share: a passport, a breeder page,
 * a breeder's store and a waitlist.
 *
 * Why: Facebook, iMessage, Discord, Slack and the other link-preview
 * fetchers do not run JavaScript, so they read the app shell and showed
 * the homepage card ("Crested Gecko Breeding App...") for every shared
 * passport or breeder link. That broke the breeder loop at the moment of
 * sharing (comprehensive review item 27; adversarial review section 11).
 * middleware.js now answers those fetchers, and only those, with a small
 * page whose title, description and image describe the gecko or breeder.
 * People's browsers get the normal app, unchanged.
 *
 * Data comes from the public Supabase REST API with the anon key, so row
 * security decides what a preview may show: a private gecko, an
 * unpublished store or a hidden (moderated) row returns nothing, and the
 * fetcher gets the ordinary app shell as before. Only fields the public
 * page already shows are used, never an email or a price paid.
 */

export const SITE = 'https://geckinspect.com';
export const DEFAULT_IMAGE = `${SITE}/og-image.png`;
const DEFAULT_SUPABASE_URL = 'https://mmuglfphhwlaluyfyxsp.supabase.co';

// User agents of link-preview fetchers. iMessage sends
// "facebookexternalhit/1.1 Facebot Twitterbot/1.0", Signal sends
// "WhatsApp", Bluesky sends "Cardyb". Search crawlers (Googlebot, Bingbot,
// Applebot) are deliberately not here: they render the real page.
// Only fetcher tokens, never an app name: the Tumblr and Viber apps put
// their name in their in-app browser's user agent too, so matching
// "tumblr" or "viber" would hand a person the card page instead of the app.
const PREVIEW_FETCHERS = [
  'facebookexternalhit', 'facebot', 'twitterbot', 'discordbot', 'slackbot',
  'whatsapp', 'telegrambot', 'linkedinbot', 'pinterestbot', 'redditbot',
  'skypeuripreview', 'embedly', 'iframely', 'vkshare', 'mastodon', 'cardyb',
  'google-pagerenderer', 'snap url preview', 'quora link preview', 'bitlybot',
  'line-poker', 'kakaotalk-scrap',
];

/** True for a link-preview fetcher (never for a person's browser). */
export function isLinkPreviewBot(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return false;
  return PREVIEW_FETCHERS.some((needle) => ua.includes(needle));
}

const KEY = /^[A-Za-z0-9_-]{1,80}$/;

/** { kind, key } for a shareable page, or null. Only canonical spellings. */
export function shareTargetFor(pathname) {
  const m = String(pathname || '').replace(/\/+$/, '').match(/^\/(passport|Breeder|store|waitlist)\/([^/]+)$/);
  if (!m) return null;
  let key;
  try {
    key = decodeURIComponent(m[2]);
  } catch {
    return null;
  }
  if (!KEY.test(key)) return null;
  const kind = { passport: 'passport', Breeder: 'breeder', store: 'store', waitlist: 'waitlist' }[m[1]];
  // The breeder page lowercases its slug before looking it up (Breeder.jsx),
  // so /Breeder/Sunny-Geckos is the same page as /Breeder/sunny-geckos.
  if (kind === 'breeder') key = key.toLowerCase();
  return { kind, key, path: `/${m[1]}/${encodeURIComponent(key)}` };
}

const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

/** Cut at a word boundary with an ellipsis, never mid-word. */
export function clip(text, max) {
  const t = oneLine(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const atSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, atSpace > max * 0.5 ? atSpace : cut.length).replace(/[,;:.\s]+$/, '')}…`;
}

/** The first https image in a list or a single value, or null. */
export function httpsImage(value) {
  const list = Array.isArray(value) ? value : [value];
  for (const item of list) {
    const url = typeof item === 'string' ? item : item?.url;
    if (typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(url)) return url;
  }
  return null;
}

function hatchYear(row) {
  if (row.hatch_date && /^\d{4}/.test(String(row.hatch_date))) return String(row.hatch_date).slice(0, 4);
  if (row.estimated_hatch_year) return String(row.estimated_hatch_year);
  return null;
}

function morphText(row) {
  const morph = oneLine(row.morphs_traits);
  if (morph) return morph;
  const tags = Array.isArray(row.morph_tags) ? row.morph_tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  return tags.length ? tags.slice(0, 4).join(', ') : '';
}

// ---- one builder per page kind ---------------------------------------------
// Each takes the database rows and returns { title, description, image,
// imageAlt } or null when there is nothing public to show.

export function passportCard(row) {
  if (!row?.name) return null;
  const name = clip(row.name, 60);
  const morph = morphText(row);
  const sex = /^(male|female)$/i.test(row.sex || '') ? row.sex.toLowerCase() : null;
  const year = hatchYear(row);
  const facts = [morph ? `${morph} crested gecko` : 'Crested gecko', sex, year ? `hatched ${year}` : null].filter(Boolean).join(', ');
  return {
    title: `${name}: Crested Gecko Passport`,
    description: clip(`${facts}. Lineage, weights and ownership history on its Geck Inspect passport.`, 200),
    image: httpsImage(row.image_urls),
    imageAlt: `${name}, ${morph || 'a crested gecko'}`,
    type: 'article',
  };
}

export function breederCard(row) {
  if (!row?.display_name) return null;
  const name = clip(row.display_name, 60);
  const where = oneLine(row.location);
  const specialty = Array.isArray(row.specialty_morphs) ? row.specialty_morphs.filter(Boolean).slice(0, 3) : [];
  const fallback = `Crested geckos from ${name}${where ? ` in ${where}` : ''}${specialty.length ? `, working with ${specialty.join(', ')}` : ''}. Pedigrees, photos and available geckos on Geck Inspect.`;
  return {
    title: `${name}: Crested Gecko Breeder`,
    description: clip(oneLine(row.bio) || fallback, 200),
    image: httpsImage(row.banner_photo) || httpsImage(row.profile_photo),
    imageAlt: `${name}, crested gecko breeder`,
    type: 'profile',
  };
}

export function storeCard(row) {
  if (!row?.title) return null;
  const name = clip(row.title, 70);
  return {
    title: name,
    description: clip(oneLine(row.tagline) || oneLine(row.description) || `Crested geckos from ${name} on Geck Inspect.`, 200),
    image: httpsImage(row.header_image_url),
    imageAlt: name,
    type: 'website',
  };
}

export function waitlistCard(row, gecko, now = new Date()) {
  if (!row?.title) return null;
  const name = clip(row.title, 70);
  const closed = row.is_open === false || (row.closes_at && new Date(row.closes_at) < now);
  const lead = closed ? 'This waitlist is closed.' : 'Join the waitlist.';
  const about = oneLine(row.description) || (gecko?.name ? `A crested gecko waitlist for ${oneLine(gecko.name)}.` : 'A crested gecko waitlist on Geck Inspect.');
  return {
    title: `${name}: Waitlist`,
    description: clip(`${lead} ${about}`, 200),
    image: httpsImage(gecko?.image_urls),
    imageAlt: gecko?.name ? `${oneLine(gecko.name)}, crested gecko` : name,
    type: 'website',
  };
}

// ---- data ------------------------------------------------------------------

const QUERIES = {
  passport: (k) => `geckos?select=name,morphs_traits,morph_tags,sex,hatch_date,estimated_hatch_year,image_urls&passport_code=eq.${k}&is_public=eq.true&limit=1`,
  breeder: (k) => `breeder_profiles?select=display_name,bio,location,specialty_morphs,profile_photo,banner_photo&custom_slug=eq.${k}&limit=1`,
  store: (k) => `breeder_store_pages?select=title,tagline,description,header_image_url&slug=eq.${k}&is_published=eq.true&limit=1`,
  waitlist: (k) => `gecko_waitlists?select=title,description,is_open,closes_at,gecko_id&slug=eq.${k}&limit=1`,
};

/**
 * Load the card for a share target. Never throws: any error, timeout or
 * missing row returns null and the fetcher gets the normal app shell.
 * Options are injectable for tests.
 */
export async function loadShareCard(target, { fetchImpl = fetch, supabaseUrl, anonKey, timeoutMs = 2500 } = {}) {
  const key = anonKey ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!target || !key) return null;
  const base = supabaseUrl || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  try {
    // Inside the try, so a runtime without AbortSignal.timeout falls
    // through to the app shell instead of failing the request.
    const signal = AbortSignal.timeout(timeoutMs);
    const get = async (path) => {
      const res = await fetchImpl(`${base}/rest/v1/${path}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal,
      });
      if (!res.ok) return null;
      const rows = await res.json();
      return Array.isArray(rows) ? rows[0] || null : null;
    };
    const k = encodeURIComponent(target.key);
    const row = await get(QUERIES[target.kind](k));
    if (!row) return null;
    let card = null;
    if (target.kind === 'passport') card = passportCard(row);
    else if (target.kind === 'breeder') card = breederCard(row);
    else if (target.kind === 'store') card = storeCard(row);
    else if (target.kind === 'waitlist') {
      const geckoId = typeof row.gecko_id === 'string' && /^[0-9a-f-]{36}$/i.test(row.gecko_id) ? row.gecko_id : null;
      const gecko = geckoId ? await get(`geckos?select=name,image_urls&id=eq.${geckoId}&is_public=eq.true&limit=1`) : null;
      card = waitlistCard(row, gecko);
    }
    return card ? { ...card, url: `${SITE}${target.path}` } : null;
  } catch {
    return null;
  }
}

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** The preview page: Open Graph and Twitter tags plus a readable body. */
export function renderShareCard(card) {
  const image = card.image || DEFAULT_IMAGE;
  const fullTitle = `${card.title} | Geck Inspect`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(card.description)}">
<link rel="canonical" href="${esc(card.url)}">
<meta property="og:type" content="${esc(card.type || 'website')}">
<meta property="og:site_name" content="Geck Inspect">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(card.description)}">
<meta property="og:url" content="${esc(card.url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:alt" content="${esc(card.image ? card.imageAlt : 'Geck Inspect, the crested gecko platform')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(card.description)}">
<meta name="twitter:image" content="${esc(image)}">
<style>body{margin:0;background:#020617;color:#e2e8f0;font:16px/1.5 system-ui,sans-serif}main{max-width:36rem;margin:0 auto;padding:1.5rem 1rem}img{max-width:100%;border-radius:.75rem}a{color:#6ee7b7}</style>
</head>
<body>
<main>
<h1>${esc(card.title)}</h1>
${card.image ? `<img src="${esc(card.image)}" alt="${esc(card.imageAlt)}">` : ''}
<p>${esc(card.description)}</p>
<p><a href="${esc(card.url)}">Open on Geck Inspect</a></p>
</main>
</body>
</html>`;
}
