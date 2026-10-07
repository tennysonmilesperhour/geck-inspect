/**
 * Vercel Routing Middleware: logs visits from AI crawlers, AI assistants,
 * search engines and tools to public.agent_hits, so the weekly agent
 * review can see which bots read which pages (Vercel keeps request logs
 * for too short a time to answer that).
 *
 * People's browsers are not logged. The response is never changed: the
 * middleware returns nothing, so the request continues as normal, and
 * the log write runs after the response through waitUntil.
 */
import { classifyAgent, logAgentHit } from './api/_lib/bots.js';

export const config = {
  // Pages and agent files only: skip build assets, images, fonts and the
  // API (api/mcp.js logs its own calls).
  matcher: [
    '/((?!assets/|api/|mcp$|hero/|screenshots/|downloads/|morph-guide/|.*\\.(?:js|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|pdf|webmanifest)$).*)',
  ],
};

export default function middleware(request, context) {
  const ua = request.headers.get('user-agent') || '';
  const hit = classifyAgent(ua);
  if (!hit) return undefined;
  const { pathname } = new URL(request.url);
  context?.waitUntil?.(logAgentHit({ ...hit, path: pathname, ua }));
  return undefined;
}
