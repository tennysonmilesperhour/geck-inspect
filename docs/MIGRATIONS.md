# Database migrations: how they really work here

Read this before running any `supabase db ...` command against production.

## The situation (as of 5 September 2026)

- Production (`mmuglfphhwlaluyfyxsp`) is the source of truth for the schema.
- The runnable chain starts with
  `20260410025954_remote_schema.sql`, a direct schema-only dump of the live
  `public` and `geck_data` schemas through migration `20260905061350`.
- The original 125-file chain is preserved under
  `_pre_rebaseline_history/` for review. Root-level no-op files retain the
  applied version numbers without replaying the obsolete SQL.
- Changes made after the dump remain as ordinary migrations, including the
  geck-data RLS cleanup, weekly digest, notification-title work, and dead
  referral-function removal.
- `supabase migration list` shows matching local and remote versions for
  all 131 rows. `supabase db push --dry-run` reports that production is up
  to date.
- The baseline was replayed through every migration in an isolated local
  checkout. All migration SQL applied; Docker then failed while starting
  the remaining local services because its local metadata database became
  unavailable. Re-run `supabase db reset` after Docker Desktop is repaired
  as an environment-level confirmation.

## How to make a schema change today

1. Generate the next file with `supabase migration new <slug>`, then write the
   SQL into that file with its full 14-digit timestamp. Make it idempotent (`create or replace`,
   `if not exists`, `drop policy if exists` before `create policy`).
2. Apply it to production with the Supabase MCP `apply_migration` tool (or
   the SQL editor), which records it in the migration history.
3. Verify the recorded version, align the new filename if the apply tool chose
   a different timestamp, and commit the file in the same change. Do not rename
   previously committed applied history.

## Baseline layout

| Path | Purpose |
|---|---|
| `20260410025954_remote_schema.sql` | Runnable schema baseline from production |
| Root-level two-line SQL files | Applied-version markers; their original effects are already in the baseline |
| Root-level SQL after `20260905061350` | Real changes made after the baseline dump |
| `_pre_rebaseline_history/` | Original SQL for audit and archaeology; ignored by the CLI |
| `_applied_by_hand/` | Data changes that were run outside migration history |
| `_never_applied/` | Historical proposals that never reached production |

The dump is intentionally schema-only. It does not recreate production data,
Storage bucket rows, `cron.job` rows, or Vault secret values. When making a new
environment, configure those operational resources separately and never copy
production secret values into git.

### Verification

After pulling changes that touch migrations:

1. Run `supabase migration list`. Every row must have both a local and remote
   version.
2. Run `supabase db push --dry-run`. It must say the remote database is up to
   date.
3. With a healthy Docker Desktop, run `supabase db reset` to verify clean replay.
4. Never use `--include-all` to paper over a mismatch. Fix the filename or SQL.

### What not to do

- Do not move files out of `_pre_rebaseline_history/` into the runnable chain.
- Do not replace a version marker with its archived original SQL; that would
  replay obsolete operations after the complete schema baseline.
- Do not "fix" the drift by editing `supabase_migrations.schema_migrations`
  by hand. The repair command exists for that and records what it did.
