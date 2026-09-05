# Pre-rebaseline migration history

These files are the original migration chain archived on 5 September 2026.
They are kept for review and `git log`, but Supabase CLI ignores this nested
directory.

The runnable chain in the parent directory starts with
`20260410025954_remote_schema.sql`, a direct schema-only dump of production
after migration `20260905061350`. Later changes remain as ordinary migrations.
No-op files in the parent directory preserve every other version already
recorded in the production migration history.

The schema dump recreates database objects, not production rows. Supabase's
schema-only baseline also does not recreate storage bucket rows, cron job rows,
or Vault secret values. Treat those as production configuration and verify them
separately when creating a new environment.
