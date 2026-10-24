// MorphMarket store verification rules, shared by the verify-morphmarket-store
// function and the app (src/lib/morphmarketStore.js re-exports this file),
// so both read a store link and a code the same way.

// Letters a member might misread (0/O, 1/I/L) are left out of codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * The store's handle from what a member pastes: a full store link
 * ("https://www.morphmarket.com/stores/thecrestedcove/"), one without
 * https, or the bare handle. Lower case. Null when it is not one.
 */
export function parseStoreSlug(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  let slug = text;
  if (/morphmarket\.com/i.test(text) || text.includes('/')) {
    const match = /morphmarket\.com\/(?:[a-z]{2}\/)?stores\/([^/?#\s]+)/i.exec(text);
    if (!match) return null;
    slug = match[1];
  }
  slug = slug.toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(slug) ? slug : null;
}

/** The public page of a MorphMarket store. */
export function storeUrl(slug) {
  return `https://www.morphmarket.com/stores/${slug}/`;
}

/** A new code such as "GI-7K3P9Q". `randomBytes` is for tests. */
export function newVerifyCode(randomBytes) {
  const bytes = randomBytes || crypto.getRandomValues(new Uint8Array(6));
  let out = '';
  for (let i = 0; i < 6; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `GI-${out}`;
}

/**
 * True when the code is on the page. Case and spacing around the dash are
 * ignored, since members retype it; HTML entities for the dash count too.
 */
export function pageHasCode(html, code) {
  const tail = String(code || '').toUpperCase().replace(/^GI-/, '');
  if (!/^[A-Z0-9]{6}$/.test(tail)) return false;
  const text = String(html || '')
    .replace(/&#0*45;|&#x0*2d;|&hyphen;|&minus;|&ndash;|&#8211;|\u2010|\u2011|\u2013|\u2212/gi, '-')
    .toUpperCase();
  return new RegExp(`\\bGI\\s*-\\s*${tail}\\b`).test(text);
}

/**
 * True when MorphMarket answered with a bot check or a rate limit instead
 * of the store, so the result says nothing about the code.
 */
export function looksBlocked(status, html) {
  if (status === 403 || status === 429 || status === 503) return true;
  const text = String(html || '').slice(0, 20000);
  return /cf-chl|challenge-platform|just a moment\.\.\.|attention required|captcha/i.test(text);
}
