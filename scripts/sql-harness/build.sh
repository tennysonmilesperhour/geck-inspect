#!/usr/bin/env bash
# Builds a template database from the repo's migration chain, the way a
# fresh Supabase project would see it: cluster roles, stubs for the
# Supabase platform schemas (auth, storage, cron, net, vault), every file
# in supabase/migrations in filename order, then the objects production
# has outside that chain. See README.md in this folder.
#
# Usage: scripts/sql-harness/build.sh [template name]   (default geck_harness)
#
# Connection comes from the usual libpq variables: PGHOST, PGPORT, PGUSER,
# PGPASSWORD. It needs a superuser (it creates roles and schemas).
#
# Exit status is 1 when any migration file has an error other than the
# three Supabase-only extensions that plain Postgres does not ship
# (pg_cron, pg_net, supabase_vault; stubbed in sql/01_supabase_stubs.sql).
# So a migration that cannot apply to a fresh database fails CI here,
# before the Supabase GitHub integration tries it on production.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
MIGRATIONS="${MIGRATIONS_DIR:-$ROOT/supabase/migrations}"
DB="${1:-geck_harness}"
LOG="${HARNESS_LOG_DIR:-$ROOT/.sql-harness-logs}/build-$DB"

# The long-lived local mirror is never rebuilt by this script.
if [ "$DB" = "geck_base" ]; then
  echo "Refusing to rebuild geck_base; pass another name." >&2
  exit 2
fi

P=(psql -X -q -v ON_ERROR_STOP=1)
# Quiet the "does not exist, skipping" notices; errors still print.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
rm -rf "$LOG"
mkdir -p "$LOG"

echo "Building template $DB from $(ls "$MIGRATIONS"/*.sql | wc -l | tr -d ' ') migrations"
"${P[@]}" -d postgres -c "update pg_database set datistemplate = false where datname = '$DB'" >/dev/null
"${P[@]}" -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB'" >/dev/null
"${P[@]}" -d postgres -c "drop database if exists \"$DB\"" >/dev/null
# UTF8 with the C.UTF-8 locale, like the local mirror of production.
# Spelled out because a cluster made with a bare initdb defaults to
# SQL_ASCII, where the regression files' non-ASCII text (curly quotes,
# accented names) cannot be stored.
"${P[@]}" -d postgres -c "create database \"$DB\" template template0 encoding 'UTF8' lc_collate 'C.UTF-8' lc_ctype 'C.UTF-8'" >/dev/null

"${P[@]}" -d postgres -f "$HERE/sql/00_roles.sql" >"$LOG/00_roles.log" 2>&1 \
  || { echo "roles failed:"; cat "$LOG/00_roles.log"; exit 1; }
"${P[@]}" -d "$DB" -f "$HERE/sql/01_supabase_stubs.sql" >"$LOG/01_stubs.log" 2>&1 \
  || { echo "stubs failed:"; cat "$LOG/01_stubs.log"; exit 1; }

# Errors that are expected on plain Postgres: the baseline dump runs
# CREATE EXTENSION for three Supabase-only extensions.
EXPECTED='extension "(pg_cron|pg_net|supabase_vault)" is not available|could not open extension control file ".*/(pg_cron|pg_net|supabase_vault)\.control"'

unexpected=0
for f in $(ls "$MIGRATIONS"/*.sql | sort); do
  b="$(basename "$f" .sql)"
  # Function bodies may name objects a later migration creates, as they
  # did in production; one failed statement must not hide the rest.
  PGOPTIONS="-c check_function_bodies=off" psql -X -q -v ON_ERROR_STOP=0 -d "$DB" -f "$f" >"$LOG/$b.log" 2>&1
  errors="$(grep 'ERROR:' "$LOG/$b.log" | grep -Ev "$EXPECTED" || true)"
  if [ -n "$errors" ]; then
    unexpected=$((unexpected + 1))
    echo "FAIL $b"
    echo "$errors" | head -5 | sed 's/^/    /'
  fi
  # Objects production has outside the chain go in right after the baseline.
  if [ "$b" = "20260410025954_remote_schema" ]; then
    psql -X -q -v ON_ERROR_STOP=0 -d "$DB" -f "$HERE/sql/02_geck_data_gap.sql" >"$LOG/02_gap.log" 2>&1
    if grep -q 'ERROR:' "$LOG/02_gap.log"; then
      unexpected=$((unexpected + 1))
      echo "FAIL 02_geck_data_gap"
      grep 'ERROR:' "$LOG/02_gap.log" | head -5 | sed 's/^/    /'
    fi
  fi
done

"${P[@]}" -d "$DB" -f "$HERE/sql/99_post.sql" >"$LOG/99_post.log" 2>&1 \
  || { echo "post failed:"; cat "$LOG/99_post.log"; exit 1; }
"${P[@]}" -d "$DB" -c "vacuum analyze" >/dev/null 2>&1 || true
"${P[@]}" -d postgres -c "update pg_database set datistemplate = true where datname = '$DB'" >/dev/null

if [ "$unexpected" -gt 0 ]; then
  echo "$unexpected file(s) did not apply cleanly; logs in $LOG"
  exit 1
fi
echo "Template $DB built; every migration applied (logs in $LOG)"
