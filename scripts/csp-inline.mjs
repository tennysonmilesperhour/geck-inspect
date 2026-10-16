/**
 * Content Security Policy hashes for the inline JavaScript in a page.
 *
 * Why: the policy used to allow 'unsafe-inline' for scripts so the small
 * scripts in index.html (the theme picker that runs before the app, the
 * noindex tag for preview hosts) could run. That also let any script an
 * attacker managed to inject run, which is most of what a CSP is for.
 * Instead, scripts/build-vercel-json.mjs lists the SHA-256 hash of each
 * inline script, and the browser runs only scripts whose text matches.
 *
 * A hash covers the exact text between <script> and </script>, so editing
 * an inline script means running `node scripts/build-vercel-json.mjs`
 * (pnpm build does) and committing vercel.json.
 * src/lib/__tests__/cspHashes.test.js fails if they disagree, and
 * scripts/check-csp-hashes.mjs checks every built page in dist/.
 *
 * Inline event handlers (onload="...") need 'unsafe-hashes' as well as a
 * hash; they are reported separately so the policy only adds that keyword
 * when a page has one. A javascript: URL cannot be allowed by a hash at
 * all, so finding one is an error.
 */
import { createHash } from 'node:crypto';

// Script types the browser executes. Anything else (application/ld+json,
// application/json, text/template) is a data block that CSP never checks.
const EXECUTABLE_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'application/ecmascript',
  'text/ecmascript',
]);

export function cspHash(text) {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

function attr(attrs, name) {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? '';
}

function hasAttr(attrs, name) {
  return new RegExp(`(?:^|\\s)${name}(?:\\s*=|\\s|$)`, 'i').test(attrs);
}

const decodeEntities = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/**
 * The inline JavaScript in an HTML document.
 * Returns { scripts, handlers }: arrays of { hash, text } for each inline
 * executable <script> body and each inline event handler attribute.
 * Throws on a javascript: URL, which no hash can allow.
 */
export function inlineScripts(html) {
  const withoutComments = String(html).replace(/<!--[\s\S]*?-->/g, '');
  const scripts = [];
  const markupOnly = withoutComments.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_m, attrs, body) => {
    if (!hasAttr(attrs, 'src')) {
      const type = (attr(attrs, 'type') || '').trim().toLowerCase();
      if (EXECUTABLE_TYPES.has(type) && body.length > 0) {
        scripts.push({ hash: cspHash(body), text: body });
      }
    }
    return '';
  });
  const handlers = [];
  for (const tag of markupOnly.matchAll(/<[a-z][a-z0-9-]*\b[^>]*>/gi)) {
    for (const m of tag[0].matchAll(/\s(on[a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      const text = decodeEntities(m[2] ?? m[3] ?? '');
      handlers.push({ hash: cspHash(text), text, attribute: m[1].toLowerCase() });
    }
    if (/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i.test(tag[0])) {
      throw new Error(`A javascript: URL cannot be allowed by a CSP hash: ${tag[0].slice(0, 120)}`);
    }
  }
  return { scripts, handlers };
}

/** The script-src sources that allow exactly the inline JavaScript in `html`. */
export function inlineScriptSources(html) {
  const { scripts, handlers } = inlineScripts(html);
  const hashes = [...new Set(scripts.map((s) => s.hash))];
  const handlerHashes = [...new Set(handlers.map((h) => h.hash))].filter((h) => !hashes.includes(h));
  return handlers.length > 0 ? [...hashes, "'unsafe-hashes'", ...handlerHashes] : hashes;
}
