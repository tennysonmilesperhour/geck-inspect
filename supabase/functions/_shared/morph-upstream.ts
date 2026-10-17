// How recognize-gecko-morph treats an Anthropic error. Kept apart from
// index.ts (which pulls Deno URL imports) so vitest can test it.

// Anthropic statuses worth one retry: rate limited, overloaded (529) and
// transient server errors.
export const RETRYABLE_UPSTREAM_STATUS = new Set([429, 500, 502, 503, 504, 529]);

// Shown to members when the analyzer itself is down (network, 5xx, a
// timeout, or the provider account being out of credit). The raw provider
// text stays in `error` for admins and the daily canary.
export const PROVIDER_UNAVAILABLE_MESSAGE =
  "Morph ID is temporarily unavailable, try again later";

// These codes mean the analyzer never returned an answer. Free and paid
// monthly scans are reserved before the call and must be handed back.
const TEMPORARY_UNAVAILABLE_CODES = new Set([
  "upstream_error",
  "upstream_timeout",
  "analyzer_unavailable",
]);

/**
 * True when the provider text is an account credit or billing problem
 * (Anthropic: "Your credit balance is too low ... Plans & Billing"),
 * not a bug in our request.
 */
export function isProviderBillingFailure(detail: string): boolean {
  const text = String(detail || "");
  if (/credit balance/i.test(text)) return true;
  return /billing/i.test(text) && /too low/i.test(text);
}

export type UpstreamFailureKind = "provider_billing" | "provider_unavailable" | "application";

/** Structured body for an analyzer failure. `error` stays diagnostic. */
export function upstreamFailureResponse(input: {
  code: string;
  diagnostic: string;
  creditRefunded: boolean;
}): {
  error: string;
  code: string;
  user_message?: string;
  credit_refunded: boolean;
  failure_kind: UpstreamFailureKind;
} {
  const billing = isProviderBillingFailure(input.diagnostic);
  const temporary = TEMPORARY_UNAVAILABLE_CODES.has(input.code) || billing;
  const failure_kind: UpstreamFailureKind = billing
    ? "provider_billing"
    : (temporary || input.code === "upstream_rate_limited" ? "provider_unavailable" : "application");
  return {
    error: input.diagnostic,
    code: input.code,
    ...(temporary ? { user_message: PROVIDER_UNAVAILABLE_MESSAGE } : {}),
    credit_refunded: input.creditRefunded,
    failure_kind,
  };
}

/** Map an Anthropic error to the code the page shows friendly copy for. */
export function upstreamErrorCode(status: number, detail: string): string {
  if (status === 429 || status === 529) return "upstream_rate_limited";
  // The Anthropic account is out of credit or its key is wrong. Nothing the
  // member does will help until the provider side is fixed.
  if (status === 401 || status === 403 || isProviderBillingFailure(detail)) {
    return "analyzer_unavailable";
  }
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

// The most an answer may run to on a model that is forced to call the tool.
// The model never sees this number and output is billed as used, so a
// higher ceiling costs nothing on a normal answer. 1536 once cut off
// five-photo answers; the largest answer since the ceiling went to 3000 was
// 2,087 tokens (production, October 2026), so 4096 leaves room.
export const FORCED_TOOL_MAX_TOKENS = 4096;

/**
 * Model-specific parts of the analyzer request. Older models are forced to
 * call the tool. Newer ones think before answering, so they also get room for
 * that thinking in max_tokens and a medium effort, which keeps a run inside
 * the 90 second budget.
 */
export function requestShape(model: string, toolName: string): RequestShape {
  if (!NO_FORCED_TOOL_MODELS.has(model)) {
    return { toolChoice: { type: "tool", name: toolName }, maxTokens: FORCED_TOOL_MAX_TOKENS, callInstruction: "" };
  }
  return {
    toolChoice: { type: "auto" },
    maxTokens: 12000,
    outputConfig: { effort: "medium" },
    callInstruction: ` Answer only by calling the ${toolName} tool, exactly once.`,
  };
}

export type RetryReason = "max_tokens" | "no_tool_call" | "status" | "network";

/**
 * The request shape for the one retry. An answer cut off at the ceiling
 * would be cut off again by the identical request (and cost another 30 to 40
 * seconds), so that retry gets twice the room. Any other retry (a busy
 * provider, a dropped connection, a missing tool call) resends the same
 * shape. Nothing the model reads changes.
 */
export function retryShape(shape: RequestShape, reason: RetryReason): RequestShape {
  return reason === "max_tokens" ? { ...shape, maxTokens: shape.maxTokens * 2 } : shape;
}
