/**
 * Anthropic API client for the blog pipeline.
 *
 * Centralises:
 *   - Model selection (Sonnet 4.6 for drafting/review, Haiku 4.5 for research scoring)
 *   - Prompt caching via top-level cache_control (the research + draft passes reuse
 *     a ~15-30K token static preamble — style guide, voice examples, fact-check
 *     corpus — so cache hits pay for themselves within the first week)
 *   - Structured JSON outputs via forced tool use with strict schemas
 *   - Token accounting that feeds into the $10/week budget tracker
 *
 * Why tool use instead of client.messages.parse() + Zod: the pipeline doesn't
 * depend on Zod anywhere else, and tool schemas are plain JSON which is easier
 * for the publish pipeline to persist alongside draft metadata. If we pull Zod
 * in later for other reasons, we should migrate to parse().
 */
import Anthropic from '@anthropic-ai/sdk';
import { recordSpend, assertBudgetAvailable } from './budget.mjs';

/** Model IDs — see the claude-api skill output for the canonical table. */
export const MODELS = {
  DRAFT: 'claude-sonnet-4-6',    // drafting + self-review
  REVIEW: 'claude-sonnet-4-6',   // fact-check + reading-level pass
  RESEARCH: 'claude-haiku-4-5',  // topic scoring / forum summarisation
  WEEKLY_REPORT: 'claude-sonnet-4-6',
};

/** Per-model pricing in USD per 1M tokens. Kept in sync with platform.claude.com. */
const PRICING = {
  'claude-sonnet-4-6':  { input: 3.00, output: 15.00 },
  'claude-haiku-4-5':   { input: 1.00, output:  5.00 },
  'claude-opus-4-7':    { input: 5.00, output: 25.00 },
};

/** Cache write is 1.25× input; cache read is 0.1×. See shared/prompt-caching.md. */
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.10;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. The blog pipeline cannot call Anthropic ' +
      'without it. In CI, set it as a repo secret and reference via ${{ secrets.ANTHROPIC_API_KEY }}.'
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Compute the USD cost of a single response from its usage object.
 * Returns { totalUsd, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens }.
 */
export function computeCost(model, usage) {
  const p = PRICING[model];
  if (!p) throw new Error(`Unknown model for pricing: ${model}`);
  const input = usage.input_tokens || 0;
  const cacheWrite = usage.cache_creation_input_tokens || 0;
  const cacheRead = usage.cache_read_input_tokens || 0;
  const output = usage.output_tokens || 0;

  const inputCost = (input / 1e6) * p.input;
  const cacheWriteCost = (cacheWrite / 1e6) * p.input * CACHE_WRITE_MULTIPLIER;
  const cacheReadCost = (cacheRead / 1e6) * p.input * CACHE_READ_MULTIPLIER;
  const outputCost = (output / 1e6) * p.output;
  const totalUsd = inputCost + cacheWriteCost + cacheReadCost + outputCost;

  return {
    totalUsd,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    breakdown: { inputCost, cacheWriteCost, cacheReadCost, outputCost },
  };
}

/**
 * Call Claude with caching + budget enforcement.
 *
 * Params:
 *   model:    model id from MODELS
 *   system:   array of {text} blocks — the FIRST blocks should be the static
 *             style guide / voice / fact-check corpus (they get cached); the
 *             LAST block should be run-specific context.
 *   messages: standard Anthropic message array
 *   maxTokens: default 16000 (claude-api guidance)
 *   cacheStaticSystem: when true (default), adds cache_control to the last
 *             static system block so subsequent runs read from cache.
 *   stopLabel: string used for budget accounting ("research", "draft", etc.)
 *
 * Returns: { content, usage, cost, stopReason, raw }
 */
export async function callClaude({
  model,
  system,
  messages,
  maxTokens = 16000,
  cacheStaticSystem = true,
  stopLabel = 'unspecified',
  tools = undefined,
  toolChoice = undefined,
  thinking = undefined,
}) {
  assertBudgetAvailable(`callClaude(${stopLabel})`);
  const client = getClient();

  const sysBlocks = Array.isArray(system)
    ? system.map((b) => (typeof b === 'string' ? { type: 'text', text: b } : b))
    : (system ? [{ type: 'text', text: String(system) }] : []);

  // Mark the last static system block as a cache breakpoint. The caller
  // controls WHICH block is the last static one by the order they pass
  // blocks in — put volatile context LAST (and uncached) by appending it
  // to `messages` instead of `system`.
  if (cacheStaticSystem && sysBlocks.length > 0) {
    const last = sysBlocks[sysBlocks.length - 1];
    sysBlocks[sysBlocks.length - 1] = {
      ...last,
      cache_control: { type: 'ephemeral' },
    };
  }

  const params = {
    model,
    max_tokens: maxTokens,
    system: sysBlocks.length > 0 ? sysBlocks : undefined,
    messages,
  };
  if (tools) params.tools = tools;
  if (toolChoice) params.tool_choice = toolChoice;
  if (thinking) params.thinking = thinking;

  let response;
  try {
    response = await client.messages.create(params);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new Error(
        `Anthropic rate-limited (${stopLabel}). Retry later. ` +
        `retry-after: ${err.headers?.get?.('retry-after') || 'n/a'}`
      );
    }
    if (err instanceof Anthropic.APIError) {
      throw new Error(`Anthropic API error ${err.status} (${stopLabel}): ${err.message}`);
    }
    throw err;
  }

  const cost = computeCost(model, response.usage);
  await recordSpend({
    model,
    stopLabel,
    usage: response.usage,
    totalUsd: cost.totalUsd,
  });

  return {
    content: response.content,
    usage: response.usage,
    cost,
    stopReason: response.stop_reason,
    raw: response,
  };
}

/**
 * Force Claude to produce a JSON object matching the given schema by
 * defining a single strict tool and forcing its use.
 *
 * Returns the tool input object directly. Throws if Claude didn't call
 * the tool (shouldn't happen with forced tool_choice, but is surfaced
 * clearly for callers to notice).
 */
export async function callClaudeJson({
  model,
  system,
  messages,
  maxTokens = 16000,
  stopLabel,
  schemaName,
  schemaDescription,
  schema,
}) {
  // NOTE: we do NOT set `strict: true`. Strict-mode tool schemas reject
  // `minItems`, `maxItems`, `minLength`, `maxLength`, `pattern`, etc. —
  // constraints that are genuinely useful as model hints. Since we force
  // tool use via tool_choice below, Claude reliably calls the tool without
  // strict enforcement, and the constraints still bias generation.
  const tool = {
    name: schemaName,
    description: schemaDescription,
    input_schema: schema,
  };
  const result = await callClaude({
    model,
    system,
    messages,
    maxTokens,
    stopLabel,
    tools: [tool],
    toolChoice: { type: 'tool', name: schemaName },
  });

  const toolUse = result.content.find((b) => b.type === 'tool_use' && b.name === schemaName);
  if (!toolUse) {
    throw new Error(
      `callClaudeJson(${stopLabel}): model did not call the "${schemaName}" tool. ` +
      `stop_reason=${result.stopReason}`
    );
  }
  return { data: toolUse.input, cost: result.cost, usage: result.usage, stopReason: result.stopReason };
}

/**
 * Pull a concatenated text string out of a response content array. Useful
 * when we just want the free-form text (e.g. a draft body) and don't care
 * about structured tool output.
 */
export function extractText(content) {
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
