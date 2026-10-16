// What one Anthropic call cost, worked out from the usage block the API
// returns. Used by every function that logs a call to
// geck_data.model_invocations (Morph ID, the assistant, the health screen),
// so the cost numbers on the scoreboard come from one price list.
//
// Why this exists: Morph ID's old cost line counted only plain input and
// output tokens. A Morph ID call also writes its long instructions block to
// the prompt cache (billed at 1.25 times the input price) and later calls
// read it back (billed at a tenth of it), and neither was counted, so the
// logged cost ran about 15 percent low (75.84 cents logged against 89.53
// real over the 25 production calls to 14 Oct 2026). The Opus row was also
// three times the real price. Prices are US dollars per million tokens, taken from the
// claude-api skill on 16 October 2026. A model missing from the list costs
// 0 here rather than a guess, so add new models when they are adopted.

export type ModelUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  // Present when a request asked for a one-hour cache: the write tokens
  // split by how long they are kept. One-hour writes cost twice the input
  // price instead of 1.25 times.
  cache_creation?: {
    ephemeral_5m_input_tokens?: number | null;
    ephemeral_1h_input_tokens?: number | null;
  } | null;
};

type Rates = { input: number; output: number; cacheRead: number };

export const MODEL_PRICES_USD_PER_MTOK: Record<string, Rates & { longContext?: Rates }> = {
  // Claude Haiku 5.5 has a second, higher price for prompts over 100,000
  // tokens. None of this app's prompts come near that, but the cost line
  // should still be right if one ever does.
  "claude-haiku-5-5": {
    input: 0.1, output: 0.5, cacheRead: 0.01,
    longContext: { input: 0.5, output: 2.5, cacheRead: 0.05 },
  },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5 },
};

const LONG_CONTEXT_TOKENS = 100_000;
const CACHE_WRITE_5M = 1.25;
const CACHE_WRITE_1H = 2;

// "claude-haiku-4-5-20251001" is the same model as "claude-haiku-4-5".
export function priceKey(model: string): string {
  return String(model || "").replace(/-\d{8}$/, "");
}

const n = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

/**
 * Cost of one call in US cents, kept to four decimal places (the column is
 * numeric(12,4)), because a Claude Haiku 5.5 answer can cost a few
 * hundredths of a cent and two places would round it to nothing.
 */
export function costCentsFromUsage(model: string, usage: ModelUsage | null | undefined): number {
  const price = MODEL_PRICES_USD_PER_MTOK[priceKey(model)];
  if (!price || !usage) return 0;
  const input = n(usage.input_tokens);
  const output = n(usage.output_tokens);
  const cacheRead = n(usage.cache_read_input_tokens);
  const cacheWrite = n(usage.cache_creation_input_tokens);
  const write1h = Math.min(cacheWrite, n(usage.cache_creation?.ephemeral_1h_input_tokens));
  const write5m = cacheWrite - write1h;

  const promptTokens = input + cacheRead + cacheWrite;
  const rates = price.longContext && promptTokens > LONG_CONTEXT_TOKENS ? price.longContext : price;

  const dollars = (
    input * rates.input +
    write5m * rates.input * CACHE_WRITE_5M +
    write1h * rates.input * CACHE_WRITE_1H +
    cacheRead * rates.cacheRead +
    output * rates.output
  ) / 1_000_000;
  return Math.round(dollars * 1_000_000) / 10_000;
}
