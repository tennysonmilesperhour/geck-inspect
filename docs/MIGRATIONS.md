# Database migrations: how they really work here

Read this before running any `supabase db ...` command against production.

## The situation (as of 4 September 2026)

- Production (`mmuglfphhwlaluyfyxsp`) is the source of truth for the schema.
- Its migration history (`supabase_migrations.schema_migrations`) contains
  about 100 entries. Roughly a quarter were applied through the Supabase
  API (the MCP `apply_migration` tool) and carry names and timestamps that
  do not match the file names in `supabase/migrations/`.
- Several repo files use 8-digit prefixes (`20260507_store_schema.sql`),
  which the Supabase CLI treats as the version `20260507`. Ten files share
  that version. The CLI cannot reconcile them.
- Four repo files were never applied at all. They live in
  `supabase/migrations/_never_applied/` with the reason for each.

Because of this, `supabase db push` (and especially `--include-all`) would
try to replay files whose content is already live under another name. At
best it fails on "already exists"; at worst it overwrites newer objects
such as the vault-based notification dispatcher and silently stops email
and push. The two deploy scripts that used to do this no longer touch the
database.

## How to make a schema change today

1. Write the SQL as a new file `supabase/migrations/<YYYYMMDDHHMMSS>_<slug>.sql`
   with a full 14-digit timestamp. Make it idempotent (`create or replace`,
   `if not exists`, `drop policy if exists` before `create policy`).
2. Apply it to production with the Supabase MCP `apply_migration` tool (or
   the SQL editor), which records it in the migration history.
3. Commit the file in the same change so the repo keeps the full story.

## Baselining (do this in a quiet window, not during a launch)

1. Take a backup (Dashboard, Database, Backups) and note the time.
2. `supabase db pull` into a fresh `remote_schema` file to capture the
   real schema.
3. For each repo file that is already live under another name, mark it
   applied: `supabase migration repair --status applied <version>`. Files
   with 8-digit prefixes must first be renamed to unique 14-digit versions.
4. Move anything that should never run to `_never_applied/`.
5. Regenerate `supabase/SCHEMA_SNAPSHOT.md` and commit.

After that, plain `supabase db push` (without `--include-all`) becomes
safe again for new files.
