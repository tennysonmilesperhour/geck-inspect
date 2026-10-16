/**
 * Decide whether a URL is a real Geck Inspect route.
 *
 * middleware.js uses this so an unknown address returns HTTP 404.
 * Known app routes, redirect sources, and static files still fall
 * through to Vercel (the SPA shell, a prerendered page, or a file).
 */
import { CANONICAL_PATH_PATTERNS, KNOWN_PATH_PATTERNS } from './known-path-patterns.js';

const STATIC_EXT = /\.(?:xml|txt|json|csv|md|webmanifest|js|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|pdf|html)$/i;

function compile(pattern) {
  const body = pattern.split('/').map((segment) => {
    if (segment === '') return '';
    if (segment === '*') return '.+';
    if (segment.startsWith(':')) return '[^/]+';
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  return new RegExp(`^${body}$`);
}

const COMPILED = KNOWN_PATH_PATTERNS.map(compile);

export function normalizePath(pathname) {
  let path = String(pathname || '/');
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (path.includes('\0') || path.includes('\\') || path.includes('..')) return null;
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/** True when the path should keep going (app route, redirect, or file). */
export function isKnownAppPath(pathname) {
  const path = normalizePath(pathname);
  if (!path) return false;
  const last = path.slice(path.lastIndexOf('/') + 1);
  if (STATIC_EXT.test(last)) return true;
  if (path === '/.well-known' || path.startsWith('/.well-known/')) return true;
  return COMPILED.some((re) => re.test(path));
}

// ---- wrong-case addresses -------------------------------------------------
//
// Links and AI assistants ask for /recognition, /market, /qualityscale or
// /Blog/<post>, which used to 404 because routes are case sensitive. An
// address that matches exactly one real page when case is ignored gets a
// 301 to that page's canonical spelling instead (comprehensive review,
// item 27; adversarial review section 11).

const isStaticPattern = (p) => !p.includes(':') && !p.includes('*');

// lowercase path -> the canonical static paths it could mean
const STATIC_BY_LOWER = new Map();
for (const p of CANONICAL_PATH_PATTERNS.filter(isStaticPattern)) {
  const key = p.toLowerCase();
  if (!STATIC_BY_LOWER.has(key)) STATIC_BY_LOWER.set(key, new Set());
  STATIC_BY_LOWER.get(key).add(p);
}

const PARAM_PATTERNS = CANONICAL_PATH_PATTERNS.filter((p) => !isStaticPattern(p)).map((p) => ({
  segments: p.split('/'),
  re: new RegExp(compile(p).source, 'i'),
}));

// The exact static segments every allowed pattern uses at each position.
// "Store" at position 1 belongs to the supplies store, so /Store/<x> is
// never folded onto a breeder storefront at /store/<x>.
const EXACT_SEGMENTS = new Map();
for (const p of KNOWN_PATH_PATTERNS) {
  p.split('/').forEach((seg, i) => {
    if (!seg || seg === '*' || seg.startsWith(':')) return;
    if (!EXACT_SEGMENTS.has(i)) EXACT_SEGMENTS.set(i, new Set());
    EXACT_SEGMENTS.get(i).add(seg);
  });
}

// The same, for canonical pages only, grouped by lowercase form. When two
// real sections spell one word in different case ("Store" for the supplies
// store, "store" for breeder storefronts), every other spelling, such as
// /STORE/<x>, is ambiguous too, so it gets a 404 rather than a guess.
// Redirect sources (/breeder/<x>) are left out: they lead to the same page.
const CANONICAL_SEGMENTS_BY_LOWER = new Map();
for (const p of CANONICAL_PATH_PATTERNS) {
  p.split('/').forEach((seg, i) => {
    if (!seg || seg === '*' || seg.startsWith(':')) return;
    if (!CANONICAL_SEGMENTS_BY_LOWER.has(i)) CANONICAL_SEGMENTS_BY_LOWER.set(i, new Map());
    const byLower = CANONICAL_SEGMENTS_BY_LOWER.get(i);
    const key = seg.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, new Set());
    byLower.get(key).add(seg);
  });
}

const spellingsAt = (i, segment) => CANONICAL_SEGMENTS_BY_LOWER.get(i)?.get(segment.toLowerCase())?.size || 0;

function rawSegments(pathname) {
  let raw = String(pathname || '/').replace(/\/{2,}/g, '/');
  if (raw.length > 1 && raw.endsWith('/')) raw = raw.slice(0, -1);
  return raw.split('/');
}

/** The pattern's spelling of the request, or null when folding is not safe. */
function foldOnto(pattern, requestSegments) {
  const out = [];
  for (let i = 0; i < requestSegments.length; i += 1) {
    const ps = pattern.segments[i];
    const rs = requestSegments[i];
    if (ps === '*') {
      out.push(...requestSegments.slice(i));
      return out.join('/');
    }
    if (ps === undefined) return null;
    if (ps.startsWith(':') || ps === '') {
      out.push(rs);
      continue;
    }
    if (rs !== ps && (EXACT_SEGMENTS.get(i)?.has(rs) || spellingsAt(i, rs) > 1)) return null;
    out.push(ps);
  }
  return out.length === pattern.segments.length ? out.join('/') : null;
}

/**
 * The canonical path for an address that is not a known route but matches
 * exactly one real page ignoring case, or null (the caller sends a 404).
 */
export function canonicalPathFor(pathname) {
  const path = normalizePath(pathname);
  if (!path || isKnownAppPath(pathname)) return null;
  // /Home is an old alias of the homepage, so /home or /HOME means "/",
  // not a second copy of it at /Home.
  if (path.toLowerCase() === '/home') return '/';
  const statics = STATIC_BY_LOWER.get(path.toLowerCase());
  if (statics) return statics.size === 1 ? [...statics][0] : null;
  const segments = rawSegments(pathname);
  if (segments.length !== path.split('/').length) return null;
  const targets = new Set();
  for (const pattern of PARAM_PATTERNS) {
    if (!pattern.re.test(path)) continue;
    const folded = foldOnto(pattern, segments);
    if (folded) targets.add(folded);
  }
  if (targets.size !== 1) return null;
  const [target] = targets;
  return isKnownAppPath(target) ? target : null;
}
