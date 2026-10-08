/**
 * Vercel Routing Middleware.
 *
 * 1. Logs visits from AI crawlers, AI assistants, search engines and
 *    tools to public.agent_hits, so the weekly agent review can see
 *    which bots read which pages. People's browsers are not logged.
 *    The log write runs after the response through waitUntil.
 * 2. Unknown paths return HTTP 404 here. Known app routes, redirect
 *    sources, and static files return nothing, so Vercel still serves
 *    the SPA shell, a prerendered page, or a file. A public/404.html
 *    cannot do this: Vercel would serve that file before the rewrite
 *    and break refresh on /MyGeckos and /Dashboard.
 */
import { classifyAgent, logAgentHit } from './api/_lib/bots.js';
import { isKnownAppPath } from './api/_lib/known-paths.js';
import {
  FOUNDER_NAME,
  FOUNDER_URL,
  GECK_INTELLECT_LABEL,
  GECK_INTELLECT_URL,
} from './src/data/public-links.js';

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Page not found | Geck Inspect</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020617;color:#e2e8f0;font:16px/1.5 system-ui,sans-serif}
  main{max-width:28rem;padding:2rem;text-align:center}
  h1{font-size:4rem;font-weight:300;color:#334155;margin:0}
  p{color:#94a3b8}
  a{color:#6ee7b7}
  footer{margin-top:2rem;font-size:0.8125rem}
  footer a{color:#94a3b8;margin:0 0.5rem}
</style>
</head>
<body>
<main>
  <h1>404</h1>
  <h2>Page not found</h2>
  <p>That address is not a page on Geck Inspect.</p>
  <p><a href="/">Back to the homepage</a></p>
  <footer>
    <a href="${GECK_INTELLECT_URL}">${GECK_INTELLECT_LABEL}</a>
    <a href="${FOUNDER_URL}">by ${FOUNDER_NAME}</a>
  </footer>
</main>
</body>
</html>`;

export const config = {
  // Pages and agent files only: skip build assets, images, fonts and the
  // API (api/mcp.js logs its own calls).
  matcher: [
    '/((?!assets/|api/|mcp$|hero/|screenshots/|downloads/|morph-guide/|.*\\.(?:js|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|pdf|webmanifest)$).*)',
  ],
};

export default function middleware(request, context) {
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';
  const hit = classifyAgent(ua);
  if (hit) {
    context?.waitUntil?.(logAgentHit({ ...hit, path: url.pathname, ua }));
  }
  if (!isKnownAppPath(url.pathname)) {
    return new Response(NOT_FOUND_HTML, {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
        'x-content-type-options': 'nosniff',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }
  return undefined;
}
