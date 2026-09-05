-- Security: profiles is publicly readable (profiles_read_all USING true)
-- and carried two third-party API key columns from the Base44 era.
-- No code reads or writes them and every value is NULL in production
-- (verified 2026-06-10: 93 rows, 0 keys in either column). Drop them so
-- a secret can never be stored on a publicly readable row. If
-- third-party credentials are ever needed, they belong in an owner-only
-- table or in edge function secrets, never on profiles.
--
-- Applied to production 2026-06-10 via MCP (apply_migration
-- drop_public_api_key_columns); committed here so the repo history
-- matches the live schema.
alter table public.profiles drop column if exists morphmarket_api_key;
alter table public.profiles drop column if exists palm_street_api_key;
