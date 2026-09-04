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

## Baselining: the concrete plan (proposed 4 Sep 2026, not yet executed)

The live history has 105 entries. Matching every repo file against it by
name (the timestamp prefix stripped) gives four groups. The full mapping
was produced with a script on 4 Sep 2026 and is reproducible from
`supabase migration list` plus `ls supabase/migrations`.

| Group | Count | What it means |
|---|---|---|
| Exact match (version and name) | 22 | The eight remote_snapshot placeholders, the 17 April series, one August store file, the three geck_data files. Nothing to do. |
| Same name, different version | 57 | The file was applied through the MCP `apply_migration` tool, which stamps its own timestamp. The content is live; only the number differs. Includes every file with an 8-digit prefix. |
| No live entry with that name | 8 | Five are near-matches whose live entry has a longer name (page_config_section = add_section_column_to_page_config, community_feed_adds_hatched = community_feed_adds_hatched_events, community_feed_excludes_scraped = community_feed_excludes_scraped_uploads, app_settings = app_settings_extend, store_activate_amazon_affiliates = store_enable_amazon_affiliates_now). store_affiliate_catalog_expansion and store_set_amazon_affiliate_tag were folded into store_daily_use_amazon_catalog live. store_copy_no_em_dashes was applied through execute_sql, so it left no history entry. |
| Live entry with no repo file | 26 | Applied straight from the MCP on the day (collections_email_keyed, notification_dispatch_via_vault, landing_stats_function, gecko_waitlists, promote_images, social_post_schedule, add_tail_status_to_geckos, claim_transfer_moves_collection, store_custom_stickers_storage_policy, and so on). The SQL exists only in production. |

### Steps, in order

Everything except step 1 and step 6 is a git change with no effect on
production, so it can be reviewed as a normal diff before anything runs.

1. **Backup.** Dashboard, Database, Backups. Note the time.
2. **Rename the 57 "same name, different version" files to their live
   version number** (`git mv 20260507_store_schema.sql
   20260507211059_store_schema.sql`, and so on). This also retires every
   8-digit prefix, which the CLI cannot order. Content does not change, so
   `git log --follow` keeps the history.
3. **Rename the five near-matches** to the live version and name, so the
   file says what the history says. Move `store_affiliate_catalog_expansion`
   and `store_set_amazon_affiliate_tag` to `_never_applied/` with a note
   that `store_daily_use_amazon_catalog` superseded them, and move
   `store_copy_no_em_dashes` to a new `_applied_by_hand/` folder (it ran,
   it is just not in the history).
4. **Write a placeholder file for each of the 26 live-only entries**,
   named exactly `<version>_<name>.sql`, containing a comment that says it
   was applied through the MCP on that date and that the objects it
   created are described in SCHEMA_SNAPSHOT.md. Where the SQL can be
   recovered from the function bodies in production (`pg_get_functiondef`)
   put it in the file; where it cannot, the placeholder is enough for the
   CLI to consider the version present.
5. **Check `supabase migration list`** (needs a linked project and the
   database password). Every row should show both a local and a remote
   version. Any row that does not is a mistake in steps 2 to 4; fix the
   file rather than repairing the history.
6. **Only if a row is still unmatched**, use `supabase migration repair
   --status applied <version>` for it. Expect zero of these.
7. **Run `supabase db pull`** into `supabase/migrations/<now>_remote_schema.sql`
   and commit it as the runnable baseline this repo has never had.
8. Regenerate `supabase/SCHEMA_SNAPSHOT.md` and commit.

After step 5 passes, plain `supabase db push` (without `--include-all`)
is safe again for new files, and the by-hand workflow above becomes
optional rather than mandatory.

### What not to do

- Do not run `supabase db push --include-all`. It would replay the 57
  renamed-in-history files and the 8 unmatched ones.
- Do not delete the eight empty `remote_snapshot` files. The history
  expects those versions.
- Do not "fix" the drift by editing `supabase_migrations.schema_migrations`
  by hand. The repair command exists for that and records what it did.
