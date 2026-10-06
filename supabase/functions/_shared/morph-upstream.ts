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

// Models that reject a forced tool_choice ("tool" or "any") with a 400. They
// get tool_choice "auto" plus an instruction to call the tool, and a missing
// tool call is retried like any other bad answer.
const NO_FORCED_TOOL_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"]);

export type RequestShape = {
  toolChoice: { type: "tool"; name: string } | { type: "auto" };
  maxTokens: number;
  outputConfig?: { effort: "low" | "medium" | "high" };
  // Extra instruction appended to the per-call text.
  callInstruction: string;
};

/**
 * Model-specific parts of the analyzer request. Older models are forced to
 * call the tool. Newer ones think before answering, so they also get room for
 * that thinking in max_tokens and a medium effort, which keeps a run inside
 * the 90 second budget.
 */
export function requestShape(model: string, toolName: string): RequestShape {
  if (!NO_FORCED_TOOL_MODELS.has(model)) {
    return { toolChoice: { type: "tool", name: toolName }, maxTokens: 3000, callInstruction: "" };
  }
  return {
    toolChoice: { type: "auto" },
    maxTokens: 12000,
    outputConfig: { effort: "medium" },
    callInstruction: ` Answer only by calling the ${toolName} tool, exactly once.`,
  };
}
