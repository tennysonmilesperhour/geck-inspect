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
// - The analyzer (Claude) has never answered in under 26.9 s, so a call
//   with less than 27 s left is bound to time out. It is not started; the
//   member gets the usual "try again" failure with the scan handed back.
// - Replicate boots the photo-matching model in 35 to 75 s when nobody has
//   used it lately. Waiting past 75 s from arrival leaves Claude under 30 s,
//   so at that point the request stops waiting (the boot carries on, so a
//   retry finds the model warm). The reference-photo lookup that follows
//   the embedding gets 3 s.

export const REQUEST_BUDGET_MS = 105_000;
export const EMBED_DEADLINE_MS = 75_000;
export const NEIGHBOR_QUERY_MS = 3_000;
export const NEIGHBOR_DEADLINE_MS = EMBED_DEADLINE_MS + NEIGHBOR_QUERY_MS;
export const CLAUDE_MAX_MS = 90_000;
export const CLAUDE_MIN_MS = 27_000;

export type MorphDeadlines = {
  /** The embedding must be done by then (ms since the epoch). */
  embed: number;
  /** The reference-photo query must be done by then. */
  neighbors: number;
  /** Nothing in the request runs past this. */
  end: number;
};

export function morphDeadlines(arrivedAt: number): MorphDeadlines {
  return {
    embed: arrivedAt + EMBED_DEADLINE_MS,
    neighbors: arrivedAt + NEIGHBOR_DEADLINE_MS,
    end: arrivedAt + REQUEST_BUDGET_MS,
  };
}

/** How long the analyzer call may take if it starts now: min(90 s, time left). */
export function claudeTimeoutMs(arrivedAt: number, now: number): number {
  return Math.max(0, Math.min(CLAUDE_MAX_MS, arrivedAt + REQUEST_BUDGET_MS - now));
}

/** True when too little time is left for any analyzer call on record to finish. */
export function skipClaude(arrivedAt: number, now: number): boolean {
  return claudeTimeoutMs(arrivedAt, now) < CLAUDE_MIN_MS;
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
