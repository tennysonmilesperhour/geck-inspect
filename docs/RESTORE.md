# Restore a database backup

The weekly workflow `.github/workflows/db-backup.yml` uploads one file,
`backup.dump.gpg`, as a GitHub Actions artifact. The name starts with
`db-backup-` and includes the UTC date. Artifacts are kept for 30 days.

The dump is a PostgreSQL custom-format archive of schema and data,
including the `geck_data` schema. `pg_dump` writes it to a pipe.
`gpg` encrypts that stream with AES-256. The plaintext dump is not
written to disk and is not uploaded.

This repository is public. Actions artifacts are visible to
collaborators, not to anonymous visitors. Encryption is what keeps a
downloaded artifact useless without the passphrase from the password
manager.

This file is a logical backup. It does not say whether Supabase
point-in-time recovery is turned on.

## Download

1. Open the Actions tab and choose "Weekly database backup".
2. Open a successful run and download the artifact.
3. Unzip it. You should have `backup.dump.gpg` only.

## Decrypt

`gpg` prompts for `BACKUP_PASSPHRASE`:

```bash
gpg --decrypt --output backup.dump backup.dump.gpg
```

`backup.dump` is the plaintext archive. Delete it when the restore is
finished. Do not commit it.

## Restore

Restore into a Supabase branch database or a local Postgres first.
Use a client at least as new as the server (PostgreSQL 17 is enough
for the current Supabase project). The connection string for the
target is not stored in this repo.

```bash
pg_restore --no-owner --no-privileges --dbname "$TARGET_DATABASE_URL" backup.dump
```

`--no-owner` and `--no-privileges` match the flags used at dump time,
so the restore does not try to recreate production roles. Warnings
about roles that do not exist on the target are expected.

The backup connection string has to be the direct database host or
the session pooler. The transaction pooler cannot run `pg_dump`.

## Quarterly restore drill

Do this once a quarter against a throwaway database (a Supabase branch
or a local Postgres). Do not treat production as the drill target.

- [ ] Download the newest artifact and decrypt it with `gpg --decrypt`.
- [ ] `pg_restore --no-owner --no-privileges` into an empty database.
- [ ] Confirm `pg_restore` finished without a fatal error.
- [ ] Compare row counts with production for tables that change often.
      `select count(*)` on `public.geckos`, `public.profiles`, and a
      `geck_data` listing table is enough. Restored counts should be
      close to production. Rows written after the backup explain a
      small gap.
- [ ] Read one known gecko and one recent market row and confirm the
      values look right.
- [ ] Delete the plaintext dump and the throwaway database.
- [ ] Write down the artifact date, the restore target, and the row
      counts somewhere outside the repo.
