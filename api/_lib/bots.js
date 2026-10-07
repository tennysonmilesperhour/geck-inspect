/**
 * Known AI crawlers, AI assistants, search engines and tools, by user
 * agent. Used by middleware.js (which logs their visits) and api/mcp.js.
 *
 * kind:
 *   training   collects pages to train models (GPTBot, ClaudeBot, CCBot)
 *   search     builds an AI or web search index (OAI-SearchBot, Googlebot)
 *   assistant  fetches a page live because a person asked an assistant
 *   seo        SEO and audit tools
 *   tool       scripts and HTTP libraries (curl, python-requests)
 *
 * Order matters: the first match wins, so more specific names come first.
 * Add new bots here when the weekly agent review finds an unknown one.
 */
const BOTS = [
  ['OAI-SearchBot', 'search'],
  ['ChatGPT-User', 'assistant'],
  ['GPTBot', 'training'],
  ['Claude-SearchBot', 'search'],
  ['Claude-User', 'assistant'],
  ['Claude-Web', 'assistant'],
  ['ClaudeBot', 'training'],
  ['anthropic-ai', 'training'],
  ['Perplexity-User', 'assistant'],
  ['PerplexityBot', 'search'],
  ['Google-CloudVertexBot', 'assistant'],
  ['Googlebot', 'search'],
  ['GoogleOther', 'training'],
  ['bingbot', 'search'],
  ['Applebot', 'search'],
  ['DuckAssistBot', 'assistant'],
  ['meta-externalfetcher', 'assistant'],
  ['meta-externalagent', 'training'],
  ['FacebookBot', 'training'],
  ['MistralAI-User', 'assistant'],
  ['cohere-ai', 'training'],
  ['Amazonbot', 'search'],
  ['Bytespider', 'training'],
  ['CCBot', 'training'],
  ['YouBot', 'search'],
  ['PhindBot', 'search'],
  ['Diffbot', 'training'],
  ['AI2Bot', 'training'],
  ['Timpibot', 'training'],
  ['YandexBot', 'search'],
  ['Baiduspider', 'search'],
  ['DuckDuckBot', 'search'],
  ['AhrefsBot', 'seo'],
  ['SemrushBot', 'seo'],
  ['MJ12bot', 'seo'],
  ['DotBot', 'seo'],
  ['Screaming Frog', 'seo'],
  ['Chrome-Lighthouse', 'seo'],
  ['curl/', 'tool'],
  ['Wget', 'tool'],
  ['python-requests', 'tool'],
  ['python-httpx', 'tool'],
  ['aiohttp', 'tool'],
  ['axios/', 'tool'],
  ['node-fetch', 'tool'],
  ['undici', 'tool'],
  ['Go-http-client', 'tool'],
  ['okhttp', 'tool'],
];

const LOWER = BOTS.map(([name, kind]) => [name.toLowerCase(), name, kind]);

/** { agent, kind } for a known bot or tool, otherwise null (a person's browser). */
export function classifyAgent(userAgent) {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return { agent: 'empty-ua', kind: 'tool' };
  for (const [needle, name, kind] of LOWER) {
    if (ua.includes(needle)) return { agent: name, kind };
  }
  // Generic self-described bots we have not named yet; the weekly review
  // reads their user agent and adds the real ones to the list above.
  if (/bot|crawler|spider|scraper|fetcher|agent/.test(ua) && !/mozilla\/5\.0 \((windows|macintosh|iphone|ipad|linux; android)/.test(ua)) {
    return { agent: 'other-bot', kind: 'unknown' };
  }
  return null;
}

const SUPABASE_URL = 'https://mmuglfphhwlaluyfyxsp.supabase.co';

/** Record one hit in public.agent_hits. Never throws. */
export async function logAgentHit({ agent, kind, path, ua }) {
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!key) return;
  const url = process.env.VITE_SUPABASE_URL || SUPABASE_URL;
  try {
    await fetch(`${url}/rest/v1/rpc/log_agent_hit`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_agent: agent, p_kind: kind, p_path: path, p_ua: ua || null }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Logging must never break a page.
  }
}
