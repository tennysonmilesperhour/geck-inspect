// Time limits for one Morph ID request (recognize-gecko-morph), all counted
// from the moment the request arrives. Kept apart from index.ts, which pulls
// Deno URL imports, so vitest can test them (src/lib/__tests__/morphBudget.test.js).
//
// Why these numbers (October 2026 production logs):
// - The browser gives up after 120 s (src/lib/supabaseClient.js) and the
//   daily canary after 125 s. The whole request gets 105 s, which leaves 15 s
//   of margin under the browser. The old 100 s budget started after the
//   sign-in lookup (0.2 to 3 s), so no request that could finish before
//   loses time.
// - The analyzer (Claude) takes 27 to 41 s (p50 about 30 s), and longer
//   with more photos: five-photo answers run up to 41 s. A call is started
//   only with at least claudeMinMs left: 32 s for one or two photos, 3.5 s
//   more for each photo past two, so 42.5 s for five. With less, the answer
//   would probably not arrive before 105 s, so the call is not started and
//   the member gets the usual "try again" failure with the scan handed back.
//   The 32 s is an estimate just above the median: the times have not been
//   split by photo count yet. geck_data.model_invocations (photo_count,
//   duration_ms) and the morph_id_timing log lines (photos, claude) hold
//   that split; move these numbers to the slowest answers seen for each
//   photo count.
// - Replicate boots the photo-matching model in 35 to 75 s when nobody has
//   used it lately. The embedding gets until the point that still leaves
//   the reference-photo query its 3 s, half a second to start the call, and
//   Claude its minimum: 69.5 s from arrival for one or two photos, 59 s for
//   five. Past that the request stops waiting and fails at once instead of
//   at 105 s (the boot carries on, so a retry finds the model warm). The
//   limits come from the same numbers, so a request that gets past the
//   reference query, even one cut off at its deadline, always has Claude's
//   minimum left.

export const REQUEST_BUDGET_MS = 105_000;
export const NEIGHBOR_QUERY_MS = 3_000;
/** From the reference query's deadline to the analyzer call (building the request). */
export const CLAUDE_START_MARGIN_MS = 500;
export const CLAUDE_MAX_MS = 90_000;
/** The least time an analyzer call starts with, for one or two photos. */
export const CLAUDE_MIN_BASE_MS = 32_000;
/** Added to that minimum for each photo past two (up to five). */
export const CLAUDE_MIN_PER_EXTRA_PHOTO_MS = 3_500;
const MAX_PHOTOS = 5;

export type MorphDeadlines = {
  /** The embedding must be done by then (ms since the epoch). */
  embed: number;
  /** The reference-photo query must be done by then. */
  neighbors: number;
  /** Nothing in the request runs past this. */
  end: number;
};

/** The least time left at which an analyzer call with this many photos starts. */
export function claudeMinMs(photoCount: number): number {
  const photos = Math.min(MAX_PHOTOS, Math.max(1, Math.floor(photoCount) || 1));
  return CLAUDE_MIN_BASE_MS + Math.max(0, photos - 2) * CLAUDE_MIN_PER_EXTRA_PHOTO_MS;
}

/**
 * The deadlines for a request with this many photos (the photos Claude
 * reads). The reference-photo query ends half a second before Claude's
 * minimum begins, and the embedding ends the query's 3 s before that.
 */
export function morphDeadlines(arrivedAt: number, photoCount: number): MorphDeadlines {
  const end = arrivedAt + REQUEST_BUDGET_MS;
  const neighbors = end - claudeMinMs(photoCount) - CLAUDE_START_MARGIN_MS;
  return { embed: neighbors - NEIGHBOR_QUERY_MS, neighbors, end };
}

/** How long the analyzer call may take if it starts now: min(90 s, time left). */
export function claudeTimeoutMs(arrivedAt: number, now: number): number {
  return Math.max(0, Math.min(CLAUDE_MAX_MS, arrivedAt + REQUEST_BUDGET_MS - now));
}

/** True when too little time is left for an analyzer call with this many photos. */
export function skipClaude(arrivedAt: number, now: number, photoCount: number): boolean {
  return claudeTimeoutMs(arrivedAt, now) < claudeMinMs(photoCount);
}

/**
 * A signal that aborts at `deadline` (ms since the epoch) or when `parent`
 * aborts, whichever comes first. Call clear() when the work is done.
 */
export function deadlineSignal(
  deadline: number,
  parent?: AbortSignal,
  now = Date.now(),
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now));
  const stop = () => controller.abort();
  if (parent?.aborted) controller.abort();
  parent?.addEventListener("abort", stop);
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", stop);
    },
  };
}
