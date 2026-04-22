# Nightly error-triage agent

An autonomous agent that reviews production errors and opens draft PRs with
proposed fixes. Runs daily at **04:00 Arizona MST** (UTC-7, no DST).

## What it does

1. Reads the last 24h of unresolved `error_logs` rows (level=error) via the
   Supabase service-role key.
2. Groups rows by a signature derived from the message + first meaningful
   stack frame, then ranks groups by count-weighted recency.
3. Skips any signature currently in cooldown (see `docs/error-triage-state.json`).
4. Picks the top 3 candidates and, for each, hands them to Claude Sonnet
   with a tool-use loop (`search_code`, `read_file`, `list_directory`,
   `propose_fix`, `skip`).
5. For any proposed fix with medium/high confidence, applies the file
   changes, runs `pnpm lint` and `pnpm typecheck`, and — if both pass —
   opens a **draft PR** on a branch named `error-triage/<sig>-<date>`
   with the label `error-triage`.
6. Commits the updated state ledger back to `main` so the next run skips
   whatever already has an open PR.

Nothing ever merges automatically. All PRs are drafts.

## Required GitHub Actions secrets

| Secret                      | Purpose                                                  |
|-----------------------------|----------------------------------------------------------|
| `ANTHROPIC_API_KEY`         | Claude Sonnet 4.6 for the triage loop (already present). |
| `SUPABASE_URL`              | `https://<project>.supabase.co`                          |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key; bypasses RLS for `error_logs`.         |

If any are missing the workflow falls into **placeholder mode**: it logs a
message, updates `lastRun`, and exits without side effects. That's the
default state when you first land this code.

## State ledger

`docs/error-triage-state.json` tracks every signature the agent has seen.
Each entry looks like:

```json
{
  "status": "open_pr" | "skipped" | "fix_failed" | "patched",
  "reason": "optional context for skipped/fix_failed",
  "prUrl":  "https://github.com/.../pull/123",
  "branch": "error-triage/abc123-2026-04-22",
  "title":  "Guard undefined gecko.owner in DashboardCard",
  "lastMessage": "Cannot read properties of undefined...",
  "lastCount": 42,
  "updatedAt": "2026-04-22T11:00:02.112Z"
}
```

Cooldowns (from `scripts/error-triage/lib.mjs`):

| Status       | Skip window |
|--------------|-------------|
| `open_pr`    | indefinite  |
| `skipped`    | 3 days      |
| `fix_failed` | 2 days      |
| `patched`    | 14 days     |

The ledger is git-tracked — to force a signature back into the rotation,
delete its entry in a commit to `main`.

> **TODO:** `open_pr` entries currently stay forever until you clear them
> by hand. A future pass can teach the nightly job to check PR state and
> flip merged PRs to `patched` and closed-without-merge to `skipped`.

## Safety rails

- **Draft PRs only** (`gh pr create --draft`).
- **Max 3 PRs per run** (`MAX_FIXES_PER_RUN` in lib.mjs).
- **Lint + typecheck gate** — a fix that breaks either is discarded and
  recorded as `fix_failed`.
- **Confidence floor** — Claude is instructed to `skip` unless at least
  "medium" confident; the orchestrator also rejects "low" for belt-and-braces.
- **Path allowlist** via the system prompt — no config, CI, package.json,
  lockfiles, migrations, or content/.
- **No new files** — the agent may only edit files that already exist.
- **Cooldowns** prevent the same bad idea being re-tried every night.

## Manual runs

From the Actions tab: "error-triage" → Run workflow. Set `placeholder` to
`true` to exercise the scheduler without touching Anthropic / Supabase.

Locally:

```sh
export ANTHROPIC_API_KEY=...
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
node scripts/error-triage/triage.mjs
```

Local runs can open real PRs (same code path), so prefer running with
`ERROR_TRIAGE_PLACEHOLDER=1` unless you mean it.

## Cost

A typical triage turn burns 20-60k tokens (cached context + tool loop).
At Sonnet 4.6 rates ($3/M in, $15/M out) that's roughly $0.10-0.50 per
signature investigated, $0.30-1.50 per run if three are in the queue.
Empty/quiet days cost nothing.

## When to turn it off

- Disable the workflow (Actions tab → error-triage → "…" → Disable) if:
  - The same error is producing new draft PRs after every cooldown and
    the fixes keep being wrong.
  - You're in the middle of a large refactor where the agent's context
    of the codebase is stale.
- Clear `docs/error-triage-state.json` to re-open everything when you're
  ready to turn it back on.
