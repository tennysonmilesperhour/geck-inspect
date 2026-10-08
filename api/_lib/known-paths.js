/**
 * Decide whether a URL is a real Geck Inspect route.
 *
 * middleware.js uses this so an unknown address returns HTTP 404.
 * Known app routes, redirect sources, and static files still fall
 * through to Vercel (the SPA shell, a prerendered page, or a file).
 */
import { KNOWN_PATH_PATTERNS } from './known-path-patterns.js';

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
