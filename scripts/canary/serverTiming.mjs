// Reads the Server-Timing header recognize-gecko-morph sends (since 17 Oct
// 2026; supabase/functions/_shared/morph-timing.ts) so the daily canary can
// say where a slow identification spent its time, not only the total.
//
// Header: "auth;dur=120, db;dur=900, embed;dur=1500, claude;dur=30500, total;dur=33800"

// An embedding this slow means Replicate was booting the photo-matching
// model (a warm embedding takes 1 to 4 s; a boot 35 to 75 s).
export const COLD_START_EMBED_MS = 30_000;

/** { auth: 120, embed: 1500, ... } in ms, or {} when the header is missing. */
export function parseServerTiming(header) {
  const out = {};
  if (typeof header !== 'string' || !header.trim()) return out;
  for (const part of header.split(',')) {
    const [name, ...params] = part.trim().split(';');
    if (!name) continue;
    const dur = params.map((p) => p.trim()).find((p) => p.startsWith('dur='));
    const ms = dur ? Number(dur.slice(4)) : NaN;
    if (Number.isFinite(ms)) out[name.trim()] = ms;
  }
  return out;
}

/** True when the embedding step took long enough to be a Replicate cold start. */
export function isColdStart(timing) {
  return Number(timing?.embed) > COLD_START_EMBED_MS;
}

/**
 * One short line for the canary table, for example
 * "embed 1.5s, Claude 30.5s" or "embed 62.0s (Replicate cold start), Claude 31.0s".
 * Empty when the function sent no timing.
 */
export function describeTiming(timing) {
  const parts = [];
  if (Number.isFinite(timing?.embed)) {
    parts.push(`embed ${(timing.embed / 1000).toFixed(1)}s${isColdStart(timing) ? ' (Replicate cold start)' : ''}`);
  }
  if (Number.isFinite(timing?.claude)) parts.push(`Claude ${(timing.claude / 1000).toFixed(1)}s`);
  return parts.join(', ');
}
