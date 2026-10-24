# Database migrations: how they really work here

Read this before writing a migration, changing an edge function, or running any `supabase db ...` command against production.

## How a change reaches production

The Supabase GitHub integration watches `main`. When a commit lands there (a direct push or a merged pull request) it:

1. **Applies every new migration file.** Each root-level file in `supabase/migrations/` that production's history does not have yet runs, in filename order, and is recorded under the file's own version. Round 1 of the review fixes went out this way on 15 October: production's history shows `20261015120000_ownership_checks`, `20261015130000_comms_and_exposure` and the rest, exactly as the files are named.
2. **Deploys the edge functions declared in `supabase/config.toml`.** A function with a `[functions.<name>]` block there is deployed from `main` with that block's `verify_jwt` setting. A function that is not declared is never touched by a merge; it stays whatever was last deployed by hand. `docs/INFRASTRUCTURE.md`, section 2, lists every production function, whether `config.toml` declares it, and why the undeclared ones are not.

Vercel deploys the site from the same commit at the same time. Nothing guarantees which of the three finishes first.

## What that means when you write a migration

- **Merging is applying.** There is no separate apply step and no staging database. Test the file on a local copy of the schema first, together with the regression files in `supabase/tests/`. SQL that is written but must not run yet goes in `supabase/pending/` (see its README), never in `supabase/migrations/`.
- **It must be safe for the app that is already open.** Members keep the app open for hours, and the site can deploy before or after the migration. Add, do not take away: a column, function, argument or return shape that the live app calls stays until the app that stopped calling it has been live for days. New app code must cope with a function or column that does not exist yet (say "not applied yet", or fall back to the old behaviour).
- **Never date it in the future, and never before production's newest.** The 14-digit version is the time you write it, in UTC (`supabase migration new <slug>` does this). A file dated tomorrow sorts after one written today; once the future-dated file is applied, today's file sorts before something already applied, and the Supabase tools refuse to apply it. The same happens to work written earlier and merged later: if another migration (a hotfix, say) reached production in the meantime with a later version, rename the waiting files to a time after it before merging, keeping their order. Round 3 did this on 16 October: its files were first dated 15 October 23:10 to 23:32, the signup hotfix `20261015233100_guard_switches` went live in between, and they were renamed to `20261016090000` onward. On 18 October six Weekly Gecko Notes files went live dated ahead of their time (`20261018120000` to `20261018150400`, written between 03:00 and 16:00 UTC). The last of them sorts before another session's `20261018152154_public_content_approval.sql`, which went live first; the integration still applied it, about half an hour after the merge and with the function deploys held back until then, so a file that lands out of order can look skipped for a while. Do not rename a file to fix that: once production has recorded a version, renaming the file leaves production with a version the repository no longer has (a rename was pushed and reverted the same afternoon). Before pushing a migration, check production's newest version (`select max(version) from supabase_migrations.schema_migrations;`) and date the file after it and after the current time.
- **Test it on a fresh database.** `scripts/sql-harness/build.sh` replays every migration on a plain Postgres 16 and `run-tests.sh` runs every file in `supabase/tests/`; the `integration` workflow does both on every pull request. A regression file must create its own members, since the template has no accounts.
- **Make it idempotent.** The same file can run twice (a retried deploy, or a file someone also ran by hand). Use `create or replace`, `if not exists`, `drop policy if exists` before `create policy`, `on conflict do nothing`, constraints added only after checking `pg_constraint` by name, and `cron.schedule` with a fixed job name (which replaces the schedule).
- **Changing a function production already has: write its full current body.** `create or replace function` replaces the whole function. Start from the newest definition (the latest migration that defines it, or `pg_get_functiondef` read-only on production) and change only the lines you mean to, and say in the file's header which version it starts from. An older or partial body silently undoes every fix made since. `20261015151600_erase_email_logs.sql` is an example: it is the 15 October body of `admin_erase_account` with three additions. A file that waits in a pull request goes stale the same way: on 24 October the sixth Weekly Gecko Notes fix (written 18 October) was re-dated `20261024182000` and its `weekly_notes_candidates` rebuilt on the body from `20261020230000`, which had added the relevance gate in the meantime. Before merging a waiting file, list the migrations that reached main after it was written and check none of them defines a function it rewrites.
- **Do not apply it by hand before merging.** The MCP `apply_migration` tool records its own new timestamp, and the SQL Editor records nothing, so the integration still sees the file as new and runs it again on merge. If an emergency means something must run by hand first, it must be idempotent, and the running copy should then be recorded under the file's version with `supabase migration repair --status applied <version>`.

### Grants on new functions

Since `20261015130000_comms_and_exposure.sql`, a new function gets no
EXECUTE for `anon`, `authenticated` or `PUBLIC` unless the migration grants
it. Every migration that adds a function must end with an explicit
`revoke ... from public` and `grant execute ... to <roles>` for it,
including helpers that policies or SECURITY INVOKER triggers call as the
member. `create or replace` keeps existing grants; a DROP followed by a
CREATE (for a new return type or arguments) does not, so re-grant in the
same file. See `supabase/SCHEMA_CONVENTIONS.md` section 4a.

### Edge functions

- A declared function's repo copy is what production runs after the next merge, so keep it deployable at all times.
- A new function needs its own block in `supabase/config.toml` with the right `verify_jwt` (and a comment saying who calls it), or the integration will not deploy it. `resend-webhook` (round 2) is the example.
- Before declaring a function that is still hand-deployed, compare the live code with the repo copy (`supabase functions download <name>` fetches the deployed source). Declaring it deploys the repo copy on the next merge, whatever production had.
- Import `createClient` from `supabase/functions/_shared/supabase.ts` (one pinned supabase-js version), and use `_shared/http.ts` and `_shared/caller.ts` for JSON, CORS and the caller check.

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

Backups: the Supabase backup tier and whether point-in-time recovery is on are not confirmed yet (`docs/OPERATIONS.md`, section 3).

### Verification

After pulling changes that touch migrations:

1. Run `supabase migration list`. Every merged file must have both a local and a remote version; only files not yet merged may be local only.
2. Run `supabase db push --dry-run`. It must list nothing, or only the files you are about to merge. Never run `supabase db push` without `--dry-run` against production: merging is the apply step.
3. With a healthy Docker Desktop, run `supabase db reset` to verify clean replay.
4. Never use `--include-all` to paper over a mismatch. Fix the filename or SQL.

### What not to do

- Do not move files out of `_pre_rebaseline_history/` into the runnable chain.
- Do not replace a version marker with its archived original SQL; that would
  replay obsolete operations after the complete schema baseline.
- Do not "fix" the drift by editing `supabase_migrations.schema_migrations`
  by hand. The repair command exists for that and records what it did.
- Do not rename a migration file after it has been applied. Production's history keys on the version.

## History: the September rebaseline

As of 5 September 2026:

- Production (`mmuglfphhwlaluyfyxsp`) was the source of truth for the schema.
- The runnable chain starts with
  `20260410025954_remote_schema.sql`, a direct schema-only dump of the live
  `public` and `geck_data` schemas through migration `20260905061350`.
- The original 125-file chain is preserved under
  `_pre_rebaseline_history/` for review. Root-level no-op files retain the
  applied version numbers without replaying the obsolete SQL.
- Changes made after the dump remain as ordinary migrations, including the
  geck-data RLS cleanup, weekly digest, notification-title work, and dead
  referral-function removal.
- `supabase migration list` showed matching local and remote versions for
  all 131 rows at the time, and `supabase db push --dry-run` reported that
  production was up to date.
- The baseline was replayed through every migration in an isolated local
  checkout. All migration SQL applied; Docker then failed while starting
  the remaining local services because its local metadata database became
  unavailable. Re-run `supabase db reset` after Docker Desktop is repaired
  as an environment-level confirmation.

Between September and 15 October, most migrations were applied by hand, mostly with the Supabase MCP `apply_migration` tool, which records the time it ran as the version and the person who ran it as the author; the repo files were renamed afterwards to match (PR 107 did this for the 8 October files). That is why many versions in the history are not the times the files were first written. The integration was already applying merged files then: a few are recorded under their own file versions with no author, such as `20261008215000_morph_id_bonus_credits` and `20261014180000_skip_lifetime_in_referral_lapse`. Round 1 of the review fixes (15 October) ran nothing by hand, and that is the rule now.
