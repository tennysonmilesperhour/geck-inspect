# Applied by hand, not in the migration history

These ran against production through the SQL editor or `execute_sql`, so
they changed data but left no row in `supabase_migrations.schema_migrations`.
They are kept out of `supabase/migrations/` so the CLI never tries to
replay them. Content-only changes; nothing here alters the schema.

This folder is a record of one-off data changes. It is not a way to
change the schema: schema changes always go through migrations, which
merging to `main` applies (`docs/MIGRATIONS.md`). The table lists every
file in the folder (checked 12 November 2026).

| File | What it did | When |
|---|---|---|
| 20260813000000_store_affiliate_catalog_expansion.sql | Seeded the affiliate supply catalog (76 affiliate products are live). The history records this work as store_daily_use_amazon_catalog, applied through the MCP with its own timestamp. | 13 Aug 2026 |
| 20260813002000_store_set_amazon_affiliate_tag.sql | Set the Amazon Associates tag on the vendor row (verified live). Recorded in the history as store_enable_amazon_affiliates_now. | 13 Aug 2026 |
| 20260905004000_store_copy_no_em_dashes.sql | Rewrote 23 live store product rows without em dashes. | 4 Sep 2026 |
| 20260909232400_purge_cron_run_details_backlog.sql | One-time cleanup of the scheduled job history (`cron.job_run_details`) after a disk alert: deleted 308,544 rows older than 7 days and reclaimed the space (57 MB to 3.4 MB). The daily `purge-cron-run-details` job keeps it small from then on. | 9 Sep 2026 |
| 20260927150000_focus_nav_and_weight_repair.sql | Hid "Train Model" from the sidebar (the address still worked), and set the weight on 18 gecko cards to each gecko's latest weigh-in after a bug had left them behind the chart. | 27 Sep 2026 |
| 20260928003000_repoint_dead_image_host.sql | Pointed 1,872 scraped listing photos in `gecko_images` at this project's `listing-images` bucket; they still named the old, deleted geck-data project, so every link was dead. Rows were changed only where the file exists here. | 28 Sep 2026 |
| 20260928200000_delete_seeded_price_entries.sql | Deleted the 24 seeded Market Pricing "sales" from `morph_price_entries` (Tennyson's OK), which the page had shown as recent sales. The file holds the insert that restores them exactly. | 28 Sep 2026 |
| 20260930060000_scrub_csp_report_query_strings.sql | Cleared the query strings and fragments from stored `csp-report` rows; 21 of 29 carried a member's email address in the address. The function has kept only the path since. | 30 Sep 2026 |
| 20261028034500_flag_internal_accounts.sql | Marked the TestFlight QA account and the three App Review accounts as internal (`app_metadata.internal`), so the Weekly scoreboard leaves them out. 4 accounts. | 28 Oct 2026 |
