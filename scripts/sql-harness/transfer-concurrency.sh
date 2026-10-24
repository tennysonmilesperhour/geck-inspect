#!/usr/bin/env bash
# Real concurrent PostgreSQL connections, fixture-only. Requires a template
# built by build.sh. This creates/drops only its own uniquely named database.
# Usage: bash scripts/sql-harness/transfer-concurrency.sh [geck_harness]
set -euo pipefail

case "${PGHOST:-}" in
  ''|localhost|127.0.0.1|::1|/*) ;;
  *) echo 'Refusing a non-local database host for transfer race tests.' >&2; exit 2 ;;
esac
TEMPLATE="${1:-geck_harness}"
[[ "$TEMPLATE" =~ ^[a-zA-Z0-9_]+$ ]] || exit 2
DB="geck_qr_race_$$"
LOG="${HARNESS_LOG_DIR:-.sql-harness-logs}/$DB"
mkdir -p "$LOG"
P=(psql -X -q -v ON_ERROR_STOP=1)
cleanup() { "${P[@]}" -d postgres -c "drop database if exists \"$DB\"" >/dev/null; }
trap cleanup EXIT
"${P[@]}" -d postgres -c "create database \"$DB\" template \"$TEMPLATE\""
"${P[@]}" -d "$DB" <<'SQL'
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data,
  raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'race-owner@example.com', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'race-one@example.com', now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'race-two@example.com', now(), '{}', '{}', now(), now(), '', '', '', '');
update public.profiles set membership_tier = 'breeder' where email like 'race-%@example.com';
insert into public.geckos (id, name, created_by, is_public)
values ('race-same', 'Same link fixture', 'race-owner@example.com', false),
       ('race-siblings', 'Sibling link fixture', 'race-owner@example.com', false),
       ('race-revoke', 'Revocation fixture', 'race-owner@example.com', false),
       ('race-expiry', 'Expiry fixture', 'race-owner@example.com', false);
-- Seed offers as the fixture database owner. Fixed tokens are test data only.
insert into public.transfer_requests (animal_id, from_user_id, created_by, to_email, token, claim_mode)
values ('race-same', '10000000-0000-0000-0000-000000000001', 'race-owner@example.com', '', 'fixture-same-token', 'link'),
       ('race-siblings', '10000000-0000-0000-0000-000000000001', 'race-owner@example.com', '', 'fixture-sibling-one', 'link'),
       ('race-siblings', '10000000-0000-0000-0000-000000000001', 'race-owner@example.com', '', 'fixture-sibling-two', 'link'),
       ('race-revoke', '10000000-0000-0000-0000-000000000001', 'race-owner@example.com', '', 'fixture-revoke-token', 'link'),
       ('race-expiry', '10000000-0000-0000-0000-000000000001', 'race-owner@example.com', '', 'fixture-expiry-token', 'link');
SQL

# Wait until the first transaction has actually acquired its locks. Checking
# pg_stat_activity is read-only and avoids relying on process scheduling.
wait_for_pause() {
  local task_app="$1" found
  for ((i=0; i<100; i++)); do
    found=$("${P[@]}" -At -d "$DB" -c "select count(*) from pg_stat_activity where application_name = '$task_app' and wait_event = 'PgSleep'")
    if [ "$found" = 1 ]; then return; fi
    sleep 0.05
  done
  echo "Timed out waiting for $task_app" >&2
  exit 1
}

claim() {
  local task_token="$1" task_actor="$2" task_pause="$3" task_app="$4"
  "${P[@]}" -d "$DB" -v token="$task_token" -v actor="$task_actor" -v pause="$task_pause" -v app="$task_app" <<'SQL'
begin;
set local statement_timeout = '8s';
select set_config('application_name', :'app', true);
select set_config('request.jwt.claims', json_build_object(
  'sub', case :'actor' when 'one' then '10000000-0000-0000-0000-000000000002' else '10000000-0000-0000-0000-000000000003' end,
  'email', 'race-' || :'actor' || '@example.com', 'role', 'authenticated')::text, true);
set local role authenticated;
select public.claim_transfer(:'token');
select pg_sleep(:'pause'::double precision);
commit;
SQL
}

claim fixture-same-token one 1 qr_race_same >"$LOG/same-first.log" 2>&1 &
FIRST=$!
wait_for_pause qr_race_same
if claim fixture-same-token two 0 qr_race_same_second >"$LOG/same-second.log" 2>&1; then
  echo 'FAIL: second account claimed the same token' >&2; exit 1
fi
wait "$FIRST"
grep -q 'already claimed' "$LOG/same-second.log"
echo 'PASS simultaneous claims of the same token: one winner'

claim fixture-sibling-one one 1 qr_race_sibling >"$LOG/sibling-first.log" 2>&1 &
FIRST=$!
wait_for_pause qr_race_sibling
if claim fixture-sibling-two two 0 qr_race_sibling_second >"$LOG/sibling-second.log" 2>&1; then
  echo 'FAIL: two different tokens moved the same gecko twice' >&2; exit 1
fi
wait "$FIRST"
grep -q 'transfer cancelled' "$LOG/sibling-second.log"
echo 'PASS simultaneous claims of sibling offers: one winner'

"${P[@]}" -d "$DB" >"$LOG/revoke-first.log" 2>&1 <<'SQL' &
begin;
select set_config('application_name', 'qr_race_revoke', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","email":"race-owner@example.com","role":"authenticated"}', true);
set local role authenticated;
select public.revoke_transfer(id) from public.transfer_requests where token = 'fixture-revoke-token';
select pg_sleep(1);
commit;
SQL
FIRST=$!
wait_for_pause qr_race_revoke
if claim fixture-revoke-token two 0 qr_race_revoke_second >"$LOG/revoke-second.log" 2>&1; then
  echo 'FAIL: a concurrent claim ignored committed revocation' >&2; exit 1
fi
wait "$FIRST"
grep -q 'transfer cancelled' "$LOG/revoke-second.log"
echo 'PASS revocation versus claim: committed revocation wins'

# Claim starts before expiry but waits for the animal lock past expiry.
"${P[@]}" -d "$DB" >"$LOG/expiry-first.log" 2>&1 <<'SQL' &
begin;
select set_config('application_name', 'qr_race_expiry', true);
select id from public.geckos where id = 'race-expiry' for update;
update public.transfer_requests set expires_at = clock_timestamp() + interval '300 milliseconds'
 where token = 'fixture-expiry-token';
select pg_sleep(1);
commit;
SQL
FIRST=$!
wait_for_pause qr_race_expiry
if claim fixture-expiry-token two 0 qr_race_expiry_second >"$LOG/expiry-second.log" 2>&1; then
  echo 'FAIL: a claim that waited past expiry was accepted' >&2; exit 1
fi
wait "$FIRST"
grep -q 'transfer expired' "$LOG/expiry-second.log"
echo 'PASS expiry is checked after waiting for locks'

"${P[@]}" -d "$DB" <<'SQL'
do $$ begin
  if (select count(*) from public.ownership_records where animal_id in ('race-same', 'race-siblings')) <> 2 then
    raise exception 'FAIL: duplicate or missing ownership history';
  end if;
  if (select count(*) from public.geckos where id in ('race-same', 'race-siblings') and created_by = 'race-one@example.com') <> 2 then
    raise exception 'FAIL: wrong concurrent winner';
  end if;
  if (select count(*) from public.geckos where id in ('race-revoke', 'race-expiry') and created_by = 'race-owner@example.com') <> 2 then
    raise exception 'FAIL: revoked or expired race changed owner';
  end if;
end $$;
SQL
echo "PASS all four race scenarios; logs in $LOG"
