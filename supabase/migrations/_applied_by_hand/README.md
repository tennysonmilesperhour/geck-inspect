# Applied by hand, not in the migration history

These ran against production through the SQL editor or `execute_sql`, so
they changed data but left no row in `supabase_migrations.schema_migrations`.
They are kept out of `supabase/migrations/` so the CLI never tries to
replay them. Content-only changes; nothing here alters the schema.

| File | What it did | When |
|---|---|---|
| 20260813000000_store_affiliate_catalog_expansion.sql | Seeded the affiliate supply catalog (76 affiliate products are live). The history records this work as store_daily_use_amazon_catalog, applied through the MCP with its own timestamp. | 13 Aug 2026 |
| 20260813002000_store_set_amazon_affiliate_tag.sql | Set the Amazon Associates tag on the vendor row (verified live). Recorded in the history as store_enable_amazon_affiliates_now. | 13 Aug 2026 |
| 20260905004000_store_copy_no_em_dashes.sql | Rewrote 23 live store product rows without em dashes. | 4 Sep 2026 |
