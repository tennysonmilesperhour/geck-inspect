#!/usr/bin/env bash
# Runs the SQL regression files in supabase/tests, each on its own fresh
# copy of a template built by build.sh, and drops the copy afterwards.
#
# Usage: scripts/sql-harness/run-tests.sh [template] [test files...]
#   template    default geck_harness
#   test files  default every supabase/tests/*.sql
#
# A file passes when psql runs it to the end with ON_ERROR_STOP on: the
# regression files raise an exception ("FAIL: ...") when a rule is
# broken. Connection comes from PGHOST, PGPORT, PGUSER, PGPASSWORD.
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
TEMPLATE="${1:-geck_harness}"
shift || true
LOG="${HARNESS_LOG_DIR:-$ROOT/.sql-harness-logs}/tests-$TEMPLATE"
rm -rf "$LOG"
mkdir -p "$LOG"

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  FILES=("$ROOT"/supabase/tests/*.sql)
fi

P=(psql -X -q -v ON_ERROR_STOP=1)
# Quiet the "does not exist, skipping" notices from the copy housekeeping.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
passed=0
failed=()
for f in "${FILES[@]}"; do
  name="$(basename "$f" .sql)"
  copy="${TEMPLATE}_t_$$"
  "${P[@]}" -d postgres -c "drop database if exists \"$copy\"" >/dev/null
  "${P[@]}" -d postgres -c "create database \"$copy\" template \"$TEMPLATE\"" >/dev/null
  if "${P[@]}" -d "$copy" -f "$f" >"$LOG/$name.log" 2>&1; then
    passed=$((passed + 1))
    echo "PASS $name"
  else
    failed+=("$name")
    echo "FAIL $name"
    grep -E 'ERROR|FAIL' "$LOG/$name.log" | head -5 | sed 's/^/    /'
  fi
  "${P[@]}" -d postgres -c "drop database if exists \"$copy\"" >/dev/null
done

echo "$passed passed, ${#failed[@]} failed (logs in $LOG)"
[ "${#failed[@]}" -eq 0 ]
