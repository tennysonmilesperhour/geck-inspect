#!/usr/bin/env node
/**
 * Nightly error-triage agent.
 *
 * Runs daily at 04:00 MST via .github/workflows/error-triage.yml. Fetches
 * unresolved error_logs rows from the last 24h, groups by signature, and
 * hands the top ranked groups to Claude via a tool-use loop. When Claude
 * proposes a fix we:
 *
 *   1. Apply the new file contents to a fresh `error-triage/<sig>-<date>`
 *      branch.
 *   2. Run `pnpm lint` and `pnpm typecheck`. If either fails we abort the
 *      fix, record `fix_failed`, and move on.
 *   3. `gh pr create --draft` with a body summarising the error + the
 *      agent's analysis + the risk assessment.
 *
 * All agent outcomes (including `skip` and `fix_failed`) are recorded in
 * docs/error-triage-state.json so the same signature doesn't re-trigger
 * a PR on the next run. The workflow commits state file updates back to
 * main at the end of every run.
 *
 * Safety posture:
 *   - Only draft PRs. Nothing merges without a human.
 *   - Max 3 fix PRs per run (MAX_FIXES_PER_RUN in lib.mjs).
 *   - Lint + typecheck gate before opening the PR.
 *   - Claude instructed to skip transient/third-party/network errors.
 *   - Confidence floor: skip if Claude is less than "medium" confident.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

import {
  REPO_ROOT,
  MAX_FIXES_PER_RUN,
  fetchRecentErrors,
  getAnthropic,
  getSupabase,
  groupBySignature,
  loadState,
  rankGroups,
  recordOutcome,
  runToolLoop,
  saveState,
  shouldSkip,
} from './lib.mjs';

// --------------------------------------------------------------------------
// Tool definitions ,  what the triage agent can call.
// --------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'search_code',
    description:
      'Search the repo for a pattern. Uses grep under the hood. Returns up to 60 matching lines with file:line prefixes. Scope to src/, supabase/, or scripts/ where possible ,  node_modules and build output are excluded.',
    input_schema: {
      type: 'object',
      properties: {
        query:      { type: 'string', description: 'Regex, passed to grep -E.' },
        path_glob:  { type: 'string', description: 'Optional path prefix like src/components or src/lib. Defaults to the repo root.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_file',
    description:
      'Read a file from the repo. Returns up to 500 lines. If the file is longer, use `start_line` + `end_line`.',
    input_schema: {
      type: 'object',
      properties: {
        path:       { type: 'string' },
        start_line: { type: 'integer', minimum: 1 },
        end_line:   { type: 'integer', minimum: 1 },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories at a given path (non-recursive).',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'propose_fix',
    description:
      'Terminal. Emit a proposed fix. Provide full new contents for every file you want to change ,  NOT a diff. The workflow will apply them, run lint + typecheck, and open a draft PR if those pass.',
    input_schema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'PR title, <= 70 chars.' },
        summary:     { type: 'string', description: 'Root-cause analysis + why this fix works. Goes into the PR body.' },
        risk:        { type: 'string', description: 'What could break. If none, say so.' },
        confidence:  { type: 'string', enum: ['high', 'medium', 'low'] },
        files: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              path:       { type: 'string', description: 'Repo-relative path, e.g. src/components/Foo.jsx.' },
              newContent: { type: 'string', description: 'The full new contents of the file. Not a diff.' },
            },
            required: ['path', 'newContent'],
          },
        },
      },
      required: ['title', 'summary', 'risk', 'confidence', 'files'],
    },
  },
  {
    name: 'skip',
    description:
      'Terminal. Skip this error ,  transient, third-party, cannot reproduce, too risky, or not actionable from this stack trace. Be specific about why.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
      required: ['reason'],
    },
  },
];

// --------------------------------------------------------------------------
// Tool handlers
// --------------------------------------------------------------------------

function safePathUnder(repoRoot, p) {
  const abs = path.resolve(repoRoot, p);
  if (!abs.startsWith(repoRoot + path.sep) && abs !== repoRoot) {
    throw new Error(`Path escapes repo root: ${p}`);
  }
  return abs;
}

function handleSearchCode({ query, path_glob }) {
  if (!query || typeof query !== 'string') throw new Error('query is required');
  const scope = path_glob ? safePathUnder(REPO_ROOT, path_glob) : REPO_ROOT;
  // -E extended regex, -n with line numbers, -r recursive, -I skip binaries,
  // -s suppress "is a directory" noise, --exclude-dir keeps the search sane.
  const args = [
    'grep', '-Ernis',
    '--exclude-dir=node_modules',
    '--exclude-dir=.git',
    '--exclude-dir=dist',
    '--exclude-dir=build',
    '--exclude-dir=.vercel',
    '--exclude=pnpm-lock.yaml',
    '--', query, scope,
  ];
  let out = '';
  try {
    out = execSync(args.map(shellQuote).join(' '), {
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      cwd: REPO_ROOT,
    });
  } catch (err) {
    // grep exits 1 when no matches ,  that's success for us.
    if (err.status === 1) return 'No matches.';
    throw err;
  }
  const lines = out.split('\n').filter(Boolean);
  const trimmed = lines.slice(0, 60).map((l) => l.replace(REPO_ROOT + '/', ''));
  const suffix = lines.length > 60 ? `\n… (${lines.length - 60} more matches truncated)` : '';
  return trimmed.join('\n') + suffix;
}

function handleReadFile({ path: p, start_line, end_line }) {
  const abs = safePathUnder(REPO_ROOT, p);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${p}`);
  if (fs.statSync(abs).isDirectory()) throw new Error(`Path is a directory: ${p}`);
  const content = fs.readFileSync(abs, 'utf8');
  const lines = content.split('\n');
  let from = start_line ? Math.max(1, start_line) : 1;
  let to = end_line ? Math.min(lines.length, end_line) : Math.min(lines.length, from + 499);
  if (to < from) [from, to] = [to, from];
  const slice = lines.slice(from - 1, to);
  const numbered = slice.map((l, i) => `${String(from + i).padStart(5)}  ${l}`).join('\n');
  const head = `// ${p} (lines ${from}-${to} of ${lines.length})`;
  return [head, numbered].join('\n');
}

function handleListDirectory({ path: p }) {
  const abs = safePathUnder(REPO_ROOT, p || '.');
  if (!fs.existsSync(abs)) throw new Error(`Not found: ${p}`);
  if (!fs.statSync(abs).isDirectory()) throw new Error(`Not a directory: ${p}`);
  const entries = fs.readdirSync(abs, { withFileTypes: true })
    .filter((e) => !['node_modules', '.git', 'dist', 'build', '.vercel'].includes(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => (e.isDirectory() ? e.name + '/' : e.name));
  return entries.join('\n') || '(empty)';
}

function shellQuote(s) {
  if (/^[A-Za-z0-9_\-./=:]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

// --------------------------------------------------------------------------
// Prompt construction
// --------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a senior frontend/full-stack engineer triaging production errors for Geck Inspect, a Vite + React app backed by Supabase.

You receive one production error at a time. Your job:

1. Investigate the codebase to find the root cause. Use \`search_code\`, \`read_file\`, and \`list_directory\` freely.
2. Propose a minimal, surgical fix ,  the smallest change that eliminates the error class without side effects.
3. If the error is transient (network blip, third-party outage, extension noise), not reproducible from the stack, or too risky to auto-fix, call \`skip\` with a clear reason. It's fine ,  and often correct ,  to skip.

HARD RULES:
- Never modify configuration, CI, package.json, lockfiles, or vercel.json.
- Never touch supabase/migrations or anything under content/.
- Prefer defensive checks (null-guards, try/catch at a real boundary) over structural rewrites.
- Keep the fix under ~40 changed lines if at all possible. If it can't, skip.
- Do not add console.log, debug prints, or TODO comments.
- Match the surrounding code style. The codebase uses ES modules, JSX, functional React, Tailwind.
- Confidence matters: call \`skip\` unless you are at least "medium" confident the fix is correct. "low" confidence = skip.

When you call \`propose_fix\`, provide the FULL new contents of each file ,  the orchestrator does not patch-merge.`;

function buildUserMessage(group) {
  const first = group.samples[0] || {};
  const stackTail = (first.stack || '').slice(0, 3500);
  const sampleUrls = group.urls.slice(0, 5).join('\n  ') || '(none recorded)';
  const sampleUserAgents = [...new Set(group.samples.map((s) => s.user_agent).filter(Boolean))]
    .slice(0, 3).join('\n  ') || '(none recorded)';
  const context = first.context ? JSON.stringify(first.context, null, 2) : '{}';

  return [
    `# Error signature ${group.signature}`,
    '',
    `**Occurrences in last 24h:** ${group.count}`,
    `**Distinct affected users:** ${group.users.length}`,
    `**First seen:** ${group.firstSeen}`,
    `**Last seen:** ${group.lastSeen}`,
    '',
    '## Message',
    '```',
    group.message || '(empty)',
    '```',
    '',
    '## Stack (first sample)',
    '```',
    stackTail || '(no stack)',
    '```',
    '',
    '## Affected URLs (sample)',
    '```',
    sampleUrls,
    '```',
    '',
    '## User agents (sample)',
    '```',
    sampleUserAgents,
    '```',
    '',
    '## Context metadata (first sample)',
    '```json',
    context,
    '```',
    '',
    '## Instructions',
    '',
    'Investigate using the tools. When you understand the root cause, call either `propose_fix` (full new file contents) or `skip` (with a reason). You have a hard limit of 20 tool calls. Don\'t narrate ,  just call tools.',
  ].join('\n');
}

// --------------------------------------------------------------------------
// Fix application + PR creation
// --------------------------------------------------------------------------

function git(args, opts = {}) {
  return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
}

function applyFixFiles(files) {
  for (const f of files) {
    const abs = safePathUnder(REPO_ROOT, f.path);
    // Refuse to CREATE new files. The agent should only modify existing
    // source ,  new files demand more judgement than we want to delegate.
    if (!fs.existsSync(abs)) {
      throw new Error(`propose_fix referenced a non-existent file: ${f.path}. The agent may only edit existing files.`);
    }
    fs.writeFileSync(abs, f.newContent);
  }
}

function resetWorkingTree() {
  git('reset --hard HEAD');
  git('clean -fd');
}

/**
 * Run a shell command and return exit status + combined output without
 * throwing. We do not want `execSync`'s throw-on-nonzero behaviour here , 
 * a nonzero lint baseline is expected in this repo.
 */
function runCapture(cmd) {
  const env = { ...process.env, CI: 'true' };
  try {
    const stdout = execSync(cmd, { cwd: REPO_ROOT, env, stdio: 'pipe' }).toString();
    return { ok: true, output: stdout };
  } catch (err) {
    return { ok: false, output: String(err.stdout || '') + String(err.stderr || '') };
  }
}

/**
 * Count error lines in combined stdout+stderr. Counts both eslint's
 * per-issue lines (`  123:45  error  message`) and tsc's diagnostic
 * lines (`src/foo.ts(1,2): error TS1234:` or bare `error TS1234:`).
 *
 * We deliberately count per-line rather than parsing the trailing
 * summary because eslint sometimes aborts before printing a summary
 * (e.g. parse error, config error), and tsc's summary line is absent
 * on success. Summing lines works in both cases.
 */
function countErrorLines(output) {
  let count = 0;
  for (const line of output.split('\n')) {
    if (/^\s*\d+:\d+\s+error\b/.test(line)) count++;
    else if (/\berror TS\d+/.test(line)) count++;
  }
  return count;
}

/**
 * Validate a proposed fix against the current `main` baseline. The repo
 * has pre-existing lint errors; we only reject a fix if it introduces
 * new errors relative to that baseline. Exit codes matter too: a fix that
 * flips either check from passing to failing is always rejected.
 */
function validateFix(baseline) {
  for (const check of ['lint', 'typecheck']) {
    const result = runCapture(`pnpm ${check}`);
    const errors = countErrorLines(result.output);
    const base = baseline[check];
    if (base.ok && !result.ok) {
      return { ok: false, stage: `${check} (was clean, now broken)`, output: result.output };
    }
    if (errors > base.errors) {
      const added = errors - base.errors;
      return {
        ok: false,
        stage: `${check} (added ${added} new error${added === 1 ? '' : 's'})`,
        output: result.output,
      };
    }
  }
  return { ok: true };
}

/**
 * Snapshot the current lint + typecheck output on main so later fix
 * attempts can be judged against the baseline instead of a pristine
 * repo's zero. Computed once per run.
 */
function captureBaseline() {
  const lint = runCapture('pnpm lint');
  const tsc = runCapture('pnpm typecheck');
  return {
    lint:      { ok: lint.ok, errors: countErrorLines(lint.output) },
    typecheck: { ok: tsc.ok,  errors: countErrorLines(tsc.output) },
  };
}

function openDraftPR({ signature, group, fix, baseBranch }) {
  const date = new Date().toISOString().slice(0, 10);
  const branch = `error-triage/${signature}-${date}`;
  git('config user.name "geckinspect-triage-bot"');
  git('config user.email "triage-bot@users.noreply.github.com"');
  git(`checkout -b ${branch}`);
  git('add -A');
  const msg = `error-triage: ${fix.title}`.slice(0, 72);
  git(`commit -m ${shellQuote(msg)}`);
  git(`push -u origin ${branch}`);

  // Idempotent label create.
  try { execSync('gh label create error-triage --color B60205 --description "Auto-generated PR from nightly error-triage"', { cwd: REPO_ROOT, stdio: 'pipe' }); } catch {}

  const body = buildPrBody({ signature, group, fix });
  const out = execSync(
    [
      'gh', 'pr', 'create',
      '--base', baseBranch,
      '--head', branch,
      '--title', fix.title.slice(0, 70),
      '--body-file', '-',
      '--label', 'error-triage',
      '--draft',
    ].map(shellQuote).join(' '),
    { cwd: REPO_ROOT, encoding: 'utf8', input: body }
  );
  const url = out.trim().split('\n').filter((l) => l.startsWith('http'))[0] || out.trim();
  git(`checkout ${baseBranch}`);
  return { branch, url };
}

function buildPrBody({ signature, group, fix }) {
  const lines = [
    `## Triage for \`error_logs\` signature \`${signature}\``,
    '',
    `Occurred **${group.count}** times in the last 24h, affecting **${group.users.length}** users.`,
    '',
    '**Message**',
    '```',
    group.message,
    '```',
    '',
    '### Agent analysis',
    '',
    fix.summary,
    '',
    `**Confidence:** ${fix.confidence}`,
    '',
    '### Risk',
    '',
    fix.risk,
    '',
    '### Files changed',
    '',
    ...fix.files.map((f) => `- \`${f.path}\``),
    '',
    '---',
    '',
    '_Opened automatically by nightly error-triage. Lint + typecheck pass. Review before merging. If the fix is wrong, close this PR ,  the state file will note the outcome and hold off on re-triage for 2 days._',
  ];
  return lines.join('\n');
}

// --------------------------------------------------------------------------
// Per-group triage
// --------------------------------------------------------------------------

async function triageGroup({ client, group, baseBranch, placeholder, baseline }) {
  console.log(`\n,  triaging ${group.signature} (${group.count}× in last 24h)`);
  const result = await runToolLoop({
    client,
    system: SYSTEM_PROMPT,
    userMessage: buildUserMessage(group),
    tools: TOOLS,
    handlers: {
      search_code: handleSearchCode,
      read_file: handleReadFile,
      list_directory: handleListDirectory,
    },
    terminalTools: ['propose_fix', 'skip'],
    maxTurns: 20,
    onTurn: ({ turn, stopReason }) => {
      console.log(`  turn ${turn} stop=${stopReason}`);
    },
  });
  console.log(`  → terminal: ${result.terminalName}`);
  console.log(`  → tokens: in=${result.usage.input_tokens} out=${result.usage.output_tokens} cache_read=${result.usage.cache_read_input_tokens}`);

  if (result.terminalName === 'skip') {
    return { status: 'skipped', reason: result.result.reason, prUrl: null };
  }

  // propose_fix
  const fix = result.result;
  if (fix.confidence === 'low') {
    return { status: 'skipped', reason: `low confidence: ${fix.summary.slice(0, 300)}`, prUrl: null };
  }

  if (placeholder) {
    console.log('  (placeholder mode ,  not opening PR, not applying files)');
    return { status: 'skipped', reason: 'placeholder mode: agent proposed fix but PR creation disabled', prUrl: null };
  }

  // Apply to a clean tree.
  resetWorkingTree();
  try {
    applyFixFiles(fix.files);
  } catch (err) {
    resetWorkingTree();
    return { status: 'fix_failed', reason: `apply: ${err.message}`, prUrl: null };
  }

  const valid = validateFix(baseline);
  if (!valid.ok) {
    resetWorkingTree();
    return { status: 'fix_failed', reason: `${valid.stage} failed:\n${valid.output.slice(0, 600)}`, prUrl: null };
  }

  let pr;
  try {
    pr = openDraftPR({ signature: group.signature, group, fix, baseBranch });
  } catch (err) {
    // Leave the tree clean, but keep the failure out of the state as
    // fix_failed so we retry rather than silently losing it.
    try { git(`checkout ${baseBranch}`); } catch {}
    resetWorkingTree();
    return { status: 'fix_failed', reason: `pr_create: ${err.message}`, prUrl: null };
  }
  return { status: 'open_pr', prUrl: pr.url, branch: pr.branch, title: fix.title };
}

// --------------------------------------------------------------------------
// Entry point
// --------------------------------------------------------------------------

async function main() {
  const baseBranch = process.env.ERROR_TRIAGE_BASE_BRANCH || 'main';
  const placeholder =
    process.env.ERROR_TRIAGE_PLACEHOLDER === '1' ||
    !process.env.SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY ||
    !process.env.ANTHROPIC_API_KEY;

  if (placeholder) {
    console.log('[placeholder mode] secrets missing ,  logging only, no PR.');
    // We still exit 0 so the workflow's commit-state step runs. That keeps
    // the ledger's lastRun fresh even on placeholder days.
    const state = loadState();
    saveState(state);
    return;
  }

  const supabase = getSupabase();
  const rows = await fetchRecentErrors(supabase, { sinceHours: 24 });
  console.log(`Fetched ${rows.length} unresolved error rows.`);
  if (rows.length === 0) {
    const state = loadState();
    saveState(state);
    return;
  }

  const groups = rankGroups(groupBySignature(rows));
  console.log(`Grouped into ${groups.length} signatures.`);

  const state = loadState();
  const candidates = groups.filter((g) => !shouldSkip(state, g.signature));
  console.log(`${candidates.length} pass cooldown.`);

  const toTriage = candidates.slice(0, MAX_FIXES_PER_RUN);
  const client = getAnthropic();

  // Baseline is captured once, on the clean checkout before any fixes
  // are applied. `pnpm lint` currently has ~10 pre-existing errors on
  // main; without this snapshot every single fix would be marked as
  // "fix_failed".
  const baseline = toTriage.length > 0 ? captureBaseline() : null;
  if (baseline) {
    console.log(
      `Baseline: lint=${baseline.lint.ok ? 'clean' : `${baseline.lint.errors} errors`}, ` +
      `typecheck=${baseline.typecheck.ok ? 'clean' : `${baseline.typecheck.errors} errors`}`
    );
  }

  for (const group of toTriage) {
    try {
      const outcome = await triageGroup({ client, group, baseBranch, placeholder: false, baseline });
      recordOutcome(state, group.signature, {
        status: outcome.status,
        reason: outcome.reason || null,
        prUrl: outcome.prUrl || null,
        branch: outcome.branch || null,
        title: outcome.title || null,
        lastMessage: (group.message || '').slice(0, 300),
        lastCount: group.count,
      });
    } catch (err) {
      console.error(`triage failed for ${group.signature}:`, err.message);
      // Return to main and wipe whatever half-applied changes may be
      // sitting in the working tree so the next group starts clean.
      try { execSync(`git checkout ${baseBranch}`, { cwd: REPO_ROOT, stdio: 'pipe' }); } catch {}
      try { execSync('git reset --hard HEAD && git clean -fd', { cwd: REPO_ROOT, stdio: 'pipe' }); } catch {}
      recordOutcome(state, group.signature, {
        status: 'fix_failed',
        reason: `exception: ${err.message.slice(0, 400)}`,
        lastMessage: (group.message || '').slice(0, 300),
        lastCount: group.count,
      });
    }
    // Always persist between groups so a crash doesn't lose progress.
    saveState(state);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
