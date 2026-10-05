// How recognize-gecko-morph treats an Anthropic error. Kept apart from
// index.ts (which pulls Deno URL imports) so vitest can test it.

// Anthropic statuses worth one retry: rate limited, overloaded (529) and
// transient server errors.
export const RETRYABLE_UPSTREAM_STATUS = new Set([429, 500, 502, 503, 504, 529]);

/** Map an Anthropic error to the code the page shows friendly copy for. */
export function upstreamErrorCode(status: number, detail: string): string {
  if (status === 429 || status === 529) return "upstream_rate_limited";
  // A photo the analyzer cannot decode (unsupported format, too large) is a
  // 400 that no retry will fix, so say so instead of "try again later".
  if (status === 400 && /image|media[_ ]type|base64|too large|exceeds/i.test(detail)) {
    return "image_unreadable";
  }
  return "upstream_error";
}
