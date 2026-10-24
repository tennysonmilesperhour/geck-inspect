# SQL harness: the migration chain and the SQL regression files on plain Postgres

This folder builds a copy of the Geck Inspect database schema on any
Postgres 16 server, from nothing but the files in `supabase/migrations`,
and runs the regression files in `supabase/tests` against it. CI does
both on every pull request (`.github/workflows/integration.yml`, job
`database`).

Why it exists: merging to `main` makes the Supabase GitHub integration
apply new migration files to production within about a minute. Before
this harness, nothing checked that a new migration applies on top of the
others, and the regression files in `supabase/tests` were run by hand, so
they were documentation more than coverage (comprehensive review, C8).
Now a migration that fails, or a change that reopens a fixed hole, fails
the pull request first.

No production data is involved. The template holds schema only: tables,
policies, functions, triggers and grants. Each regression file makes its
own members inside a transaction and rolls everything back.

## What you need

- Postgres 16 with the `vector` extension (pgvector). Plain Postgres does
  not ship it; the Debian package is `postgresql-16-pgvector`, and the
  `pgvector/pgvector:pg16` Docker image has it built in.
- `psql` on your PATH.
- A superuser connection, given the usual way: `PGHOST`, `PGPORT`,
  `PGUSER`, `PGPASSWORD`.

For example, with Docker:

```sh
docker run -d --name geck-sql -e POSTGRES_PASSWORD=postgres -p 54329:5432 pgvector/pgvector:pg16
export PGHOST=localhost PGPORT=54329 PGUSER=postgres PGPASSWORD=postgres
```

## Run it

```sh
bash scripts/sql-harness/build.sh            # build the template geck_harness (about 20 s)
bash scripts/sql-harness/run-tests.sh        # every supabase/tests/*.sql (about 10 s)
bash scripts/sql-harness/run-tests.sh geck_harness supabase/tests/ownership_regressions.sql
bash scripts/sql-harness/transfer-concurrency.sh geck_harness
```

`transfer-concurrency.sh` checks real simultaneous database connections for
QR ownership claims: one shared token, sibling offers for the same animal,
revocation while a claim waits, and expiry while a claim waits. It creates
its own fixture copy and drops that copy on exit. It refuses a non-local
`PGHOST`. CI runs these checks after the SQL regression files.

`build.sh` applies every migration in filename order and fails if any file
has an error other than the three expected ones (below). `run-tests.sh`
copies the template for each regression file, runs the file with
`ON_ERROR_STOP` on, and drops the copy; a file passes when it runs to the
end. Logs go to `.sql-harness-logs/` (ignored by git).

Test a new migration before merging it: add the file, run `build.sh`
(it replays the whole chain, yours last), then the regression files. To
check that the migration is safe to run twice, apply it once more to a
copy:

```sh
psql -d postgres -c 'create database my_check template geck_harness'
psql -X -v ON_ERROR_STOP=1 -d my_check -f supabase/migrations/<your file>.sql
psql -d postgres -c 'drop database my_check'
```

## Writing a regression file

Plain SQL, run as a superuser, everything inside `begin; ... rollback;`.
Make your own members by inserting into `auth.users` (the
`on_auth_user_created` trigger adds the profile), act as them the way the
API does, and raise an exception that starts with `FAIL:` when a rule is
broken. A file must not depend on accounts that only exist in production:
the template has none. See `supabase/tests/ownership_regressions.sql` for
the pattern.

`impersonate.sql` has helpers for interactive checks (install it into a
copy, never into the template or production):

```sql
begin;
select test_helpers.create_user('a@example.com', 'Member A');  -- auth.users row and profile
select test_helpers.act_as('a@example.com');                   -- signed-in member, under RLS
select test_helpers.act_as_anon();                             -- signed-out visitor
select test_helpers.act_as_service();                          -- server, bypasses RLS
select test_helpers.act_as_postgres();                         -- back to the superuser
rollback;
```

Supabase's API does the same thing: it copies the token's claims into the
setting `request.jwt.claims` and switches to the token's role, and
`auth.uid()`, `auth.email()` and `auth.jwt()` read that setting.

## What is real and what is a stand-in

Real: every `public` and `geck_data` table, view, policy, function,
trigger and grant that the migration chain creates. A local copy built
this way was compared with production in October 2026 using read-only
catalog queries (`sql/fingerprint.sql`): tables, columns, policies and
triggers matched.

Stand-ins, in `sql/`:

- `00_roles.sql`: the Supabase roles (`anon`, `authenticated`,
  `service_role`, `authenticator` and the platform admins) and the grants
  between them.
- `01_supabase_stubs.sql`: the parts of Supabase that are not in the
  migrations. `auth.users` and the `auth.uid()` family; `storage` tables;
  and three extensions plain Postgres does not have, replaced by tables
  and functions with the same shape: `pg_cron` (jobs are recorded, never
  run), `pg_net` (requests are queued, never sent) and `supabase_vault`
  (secrets stored in clear, locally only). Because those three are
  missing, the baseline migration's three `create extension` lines fail;
  those are the only errors `build.sh` accepts.
- `02_geck_data_gap.sql`: market-data functions and tables production has
  but no migration creates (they were made by the scraper project or by
  hand). Applied right after the baseline, so the migrations that depend
  on them replay as they did in production.
- `99_post.sql`: the trigger on `auth.users`, the storage buckets and
  their policies, and four function grants where production differs from
  what the chain leaves (production wins, so tests see what the live API
  roles see).

## Files

- `build.sh`: build the template from the migrations.
- `run-tests.sh`: run regression files, each on a fresh copy.
- `impersonate.sql`: helpers for acting as each kind of caller.
- `sql/`: the stand-ins above, and `fingerprint.sql`, a catalog query for
  comparing a copy with production.
