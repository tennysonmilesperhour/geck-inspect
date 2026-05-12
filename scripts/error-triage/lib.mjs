/**
 * Shared helpers for the nightly error-triage agent.
 *
 * Responsibilities:
 *   - Talk to Supabase via the service-role key (bypasses RLS).
 *   - Hash raw error rows into stable "signatures" so the same bug doesn't
 *     re-trigger a PR every night.
 *   - Read/write docs/error-triage-state.json, the git-tracked dedupe ledger.
 *   - Wrap @anthropic-ai/sdk with tool-use support for the triage loop.
 *
 * Everything here is plain Node + ESM ,  no Vite aliases, no Supabase client
 * imports from src/. This file runs in CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const STATE_PATH = path.join(REPO_ROOT, 'docs', 'error-triage-state.json');

export const MODEL = 'claude-sonnet-4-6';

/**
 * Dedupe windows ,  once a signature is in one of these states, skip it until
 * the window elapses. `open_pr` is indefinite because the PR itself blocks
 * re-triage (we check PR state on the next run and clear if merged/closed).
 */
export const COOLDOWN_DAYS = {
  skipped: 3,
  patched: 14,  // already shipped a fix; give it time to confirm before trying again
  fix_failed: 2,
};

// Keep per-run cost bounded. Each error we fully triage burns ~20-60k tokens
// between context + tool loop; 3 is a deliberate ceiling, not a throughput goal.
export const MAX_FIXES_PER_RUN = 3;

// --------------------------------------------------------------------------
// Supabase
// --------------------------------------------------------------------------

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. In CI these ' +
      'come from repo secrets; locally, export them before running triage.'
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Fetch unresolved error_logs rows in the given window. We only look at
 * `level='error'` ,  warnings/info are useful for the admin dashboard but
 * not worth burning an agent run on.
 */
export async function fetchRecentErrors(supabase, { sinceHours = 24 } = {}) {
  const cutoff = new Date(Date.now() - sinceHours * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from('error_logs')
    .select('id, level, message, stack, url, user_email, user_agent, context, created_date')
    .eq('resolved', false)
    .eq('level', 'error')
    .gte('created_date', cutoff)
    .order('created_date', { ascending: false })
    .limit(2000);
  if (error) throw new Error(`Supabase error_logs fetch failed: ${error.message}`);
  return data || [];
}

// --------------------------------------------------------------------------
// Signatures
// --------------------------------------------------------------------------

/**
 * Derive a signature that's stable across builds. We combine the message
 * (normalised to strip hashes/timestamps/line numbers) with the first
 * non-node stack frame's function name, if we can find one.
 */
export function signatureFor(row) {
  const msg = normaliseMessage(row.message || '');
  const frame = firstMeaningfulFrame(row.stack || '');
  const raw = `${msg}\n${frame}`;
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12);
}

function normaliseMessage(s) {
  return s
    // Numeric ids, hashes, ports
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hash>')
    .replace(/\b\d{4,}\b/g, '<num>')
    // URLs (often embed build hashes)
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

function firstMeaningfulFrame(stack) {
  if (!stack) return '';
  const lines = stack.split('\n');
  for (const line of lines) {
    // "at handleClick (...)" or "at Object.foo (...)" ,  grab the symbol.
    const m = line.match(/\bat\s+([A-Za-z_$][\w$.<>]*)\b/);
    if (!m) continue;
    const name = m[1];
    // Skip stdlib / framework frames that don't help identify the bug.
    if (/^(Object|Function|Module|eval|Promise|Array)\.?/i.test(name)) continue;
    return name;
  }
  return '';
}

/**
 * Group raw rows by signature, summarising count / first seen / latest /
 * affected users / sample URLs. The agent gets one summary per group plus
 * up to `sampleSize` raw examples for context.
 */
export function groupBySignature(rows, { sampleSize = 3 } = {}) {
  const groups = new Map();
  for (const row of rows) {
    const sig = signatureFor(row);
    let g = groups.get(sig);
    if (!g) {
      g = {
        signature: sig,
        message: row.message,
        count: 0,
        firstSeen: row.created_date,
        lastSeen: row.created_date,
        users: new Set(),
        urls: new Set(),
        levels: new Set(),
        samples: [],
      };
      groups.set(sig, g);
    }
    g.count += 1;
    if (row.created_date < g.firstSeen) g.firstSeen = row.created_date;
    if (row.created_date > g.lastSeen) g.lastSeen = row.created_date;
    if (row.user_email) g.users.add(row.user_email);
    if (row.url) g.urls.add(row.url);
    g.levels.add(row.level);
    if (g.samples.length < sampleSize) g.samples.push(row);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    users: [...g.users],
    urls: [...g.urls],
    levels: [...g.levels],
  }));
}

/**
 * Rank by a simple count-weighted recency score. Severe yet transient noise
 * still surfaces, but fresher + higher-volume errors sort first.
 */
export function rankGroups(groups) {
  const now = Date.now();
  return [...groups].sort((a, b) => score(b) - score(a));
  function score(g) {
    const ageHours = Math.max(1, (now - new Date(g.lastSeen).getTime()) / 3600e3);
    return g.count / Math.log2(1 + ageHours);
  }
}

// --------------------------------------------------------------------------
// State file
// --------------------------------------------------------------------------

export function loadState() {
  if (!fs.existsSync(STATE_PATH)) {
    return { lastRun: null, signatures: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch (err) {
    // A corrupt state file would silently suppress the agent forever. Fail
    // loudly instead so a human repairs it.
    throw new Error(`Could not parse ${STATE_PATH}: ${err.message}`);
  }
}

export function saveState(state) {
  state.lastRun = new Date().toISOString();
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

export function shouldSkip(state, signature, now = Date.now()) {
  const entry = state.signatures[signature];
  if (!entry) return false;
  if (entry.status === 'open_pr') return true;
  const cooldownDays = COOLDOWN_DAYS[entry.status];
  if (!cooldownDays) return false;
  const ageMs = now - new Date(entry.updatedAt).getTime();
  return ageMs < cooldownDays * 24 * 3600 * 1000;
}

export function recordOutcome(state, signature, outcome) {
  state.signatures[signature] = {
    ...(state.signatures[signature] || {}),
    ...outcome,
    updatedAt: new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------
// Anthropic client + tool-use loop
// --------------------------------------------------------------------------

export function getAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set.');
  return new Anthropic({ apiKey: key });
}

/**
 * Run a tool-use loop until Claude emits a `terminal` tool call (one of the
 * names in `terminalTools`) or we hit `maxTurns`. Returns the terminal tool's
 * input plus cumulative usage.
 *
 * `handlers` maps tool name → async (input) => string. Strings are fed back
 * as tool_result. Errors are caught and fed back as error results so the
 * model can recover or skip.
 */
export async function runToolLoop({
  client,
  system,
  userMessage,
  tools,
  handlers,
  terminalTools,
  maxTurns = 20,
  maxTokens = 8000,
  onTurn = () => {},
}) {
  const messages = [{ role: 'user', content: userMessage }];
  let totalUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      tools,
      messages,
    });
    accumulate(totalUsage, response.usage);
    onTurn({ turn, stopReason: response.stop_reason, usage: response.usage });

    // Text blocks are discarded ,  we only act on tool_use.
    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) {
      // Claude answered in prose instead of calling a tool. Nudge once; if
      // that still doesn't work we surface the text so the run log is useful.
      if (response.stop_reason === 'end_turn') {
        const text = response.content
          .filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
        throw new Error(
          `Agent stopped without calling a terminal tool. stop_reason=end_turn. ` +
          `Text: ${text.slice(0, 400)}`
        );
      }
      throw new Error(`Unexpected stop_reason: ${response.stop_reason}`);
    }

    // Check for a terminal tool first. If Claude called one alongside
    // non-terminal tools in the same turn (it can happen), we honour the
    // terminal and drop the rest.
    const terminal = toolUses.find((t) => terminalTools.includes(t.name));
    if (terminal) {
      return { result: terminal.input, terminalName: terminal.name, usage: totalUsage, turns: turn + 1 };
    }

    // Run non-terminal tools and push results back.
    messages.push({ role: 'assistant', content: response.content });
    const results = [];
    for (const use of toolUses) {
      const handler = handlers[use.name];
      let content, isError = false;
      if (!handler) {
        content = `Unknown tool: ${use.name}`;
        isError = true;
      } else {
        try {
          content = await handler(use.input);
        } catch (err) {
          content = `Tool error: ${err.message}`;
          isError = true;
        }
      }
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: typeof content === 'string' ? content : JSON.stringify(content),
        ...(isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: 'user', content: results });
  }

  throw new Error(`runToolLoop exceeded maxTurns=${maxTurns}.`);
}

function accumulate(total, u) {
  total.input_tokens += u.input_tokens || 0;
  total.output_tokens += u.output_tokens || 0;
  total.cache_read_input_tokens += u.cache_read_input_tokens || 0;
  total.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
}
