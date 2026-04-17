#!/usr/bin/env bash
# Read-only health check for the /recognition + /training pipeline.
# Runs a dozen small probes against your Supabase project and prints
# PASS / FAIL for each. Designed to be safe to run any time — no writes.
#
# Usage:
#   SUPABASE_URL=https://<ref>.supabase.co \
#   SUPABASE_ANON_KEY=<anon key> \
#   SUPABASE_SERVICE_ROLE_KEY=<service key> \
#     scripts/check-morph-id.sh
#
# SUPABASE_SERVICE_ROLE_KEY is optional but lets the script verify
# schema bits that RLS otherwise hides.

set -uo pipefail

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; BLU=$'\033[34m'; DIM=$'\033[2m'; RST=$'\033[0m'
section() { printf '\n%s== %s ==%s\n' "$BLU" "$1" "$RST"; }
pass()    { printf '  %s✓%s %s\n' "$GRN" "$RST" "$1"; PASS=$((PASS+1)); }
fail()    { printf '  %s✗%s %s\n  %s  %s%s\n' "$RED" "$RST" "$1" "$DIM" "${2:-}" "$RST"; FAIL=$((FAIL+1)); }
skip()    { printf '  %s-%s %s\n' "$YEL" "$RST" "$1"; }

PASS=0; FAIL=0

: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

# Helpers. `probe` runs a curl and captures status+body.
probe() {
  local method="$1" url="$2" key="$3"; shift 3
  curl -sS -o /tmp/probe-body -w '%{http_code}' \
    -X "$method" "$url" \
    -H "apikey: $key" \
    -H "Authorization: Bearer $key" \
    "$@"
}

rpc() {
  local name="$1" body="$2" key="$3"
  probe POST "$SUPABASE_URL/rest/v1/rpc/$name" "$key" \
    -H 'Content-Type: application/json' -d "$body"
}

# ---- 1. Schema: columns on gecko_images ----------------------------------
section "Schema on public.gecko_images"
if [[ -n "$SERVICE_KEY" ]]; then
  cols_needed=(training_meta confidence_score pattern_intensity white_amount fired_state age_estimate image_embedding embedding_model embedding_date)
  status=$(probe GET "$SUPABASE_URL/rest/v1/gecko_images?limit=0" "$SERVICE_KEY")
  if [[ "$status" != "200" ]]; then
    fail "cannot read gecko_images" "$(cat /tmp/probe-body)"
  else
    # Use OPTIONS on PostgREST — returns an X-Accept-Profile row definition.
    status=$(probe GET "$SUPABASE_URL/rest/v1/gecko_images?select=$(IFS=,; echo "${cols_needed[*]}")&limit=0" "$SERVICE_KEY")
    if [[ "$status" == "200" ]]; then
      pass "all training columns present"
    else
      fail "one or more training columns missing" "$(cat /tmp/probe-body)"
    fi
  fi
else
  skip "skipping column check (SUPABASE_SERVICE_ROLE_KEY not set)"
fi

# ---- 2. RPCs -------------------------------------------------------------
section "SQL RPCs"

status=$(rpc gecko_image_stats '{}' "$SUPABASE_ANON_KEY")
if [[ "$status" == "200" ]]; then pass "gecko_image_stats()"
else fail "gecko_image_stats() not callable (status $status)" "$(cat /tmp/probe-body)"; fi

status=$(rpc is_expert_reviewer '{}' "$SUPABASE_ANON_KEY")
if [[ "$status" == "200" ]]; then pass "is_expert_reviewer()"
else fail "is_expert_reviewer() not callable (status $status)" "$(cat /tmp/probe-body)"; fi

# nearest_training_samples needs a 768-dim vector. Build one quickly.
zero_vec=$(python3 -c 'print("[" + ",".join(["0"]*768) + "]")')
status=$(rpc nearest_training_samples \
  "{\"query_embedding\":$zero_vec,\"match_count\":1,\"verified_only\":true}" \
  "$SUPABASE_ANON_KEY")
if [[ "$status" == "200" ]]; then pass "nearest_training_samples()"
else fail "nearest_training_samples() not callable (status $status)" "$(cat /tmp/probe-body)"; fi

# review_gecko_image — requires auth, so anon calls should fail gracefully.
# A 4xx proves the function exists and the auth check is working; 404 means
# the function wasn't deployed.
status=$(rpc review_gecko_image \
  '{"p_image_id":"00000000-0000-0000-0000-000000000000","p_verdict":"approve"}' \
  "$SUPABASE_ANON_KEY")
case "$status" in
  200|400|401|403) pass "review_gecko_image() reachable (rejected anon, status $status)" ;;
  404)             fail "review_gecko_image() missing" "$(cat /tmp/probe-body)" ;;
  *)               fail "review_gecko_image() unexpected status $status" "$(cat /tmp/probe-body)" ;;
esac

# ---- 3. Edge functions ---------------------------------------------------
section "Edge functions"

# recognize-gecko-morph — POST with no body should return a 400 JSON error
# ("imageUrl required"). A 404 means the function isn't deployed.
status=$(probe POST "$SUPABASE_URL/functions/v1/recognize-gecko-morph" "$SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' -d '{}')
case "$status" in
  400) pass "recognize-gecko-morph deployed (rejects empty body)" ;;
  500) warn_body=$(cat /tmp/probe-body)
       if echo "$warn_body" | grep -qi "REPLICATE_API_TOKEN"; then
         fail "recognize-gecko-morph missing REPLICATE_API_TOKEN secret" "$warn_body"
       else
         fail "recognize-gecko-morph 500" "$warn_body"
       fi ;;
  404) fail "recognize-gecko-morph not deployed" "$(cat /tmp/probe-body)" ;;
  *)   fail "recognize-gecko-morph unexpected status $status" "$(cat /tmp/probe-body)" ;;
esac

status=$(probe POST "$SUPABASE_URL/functions/v1/embed-gecko-image" "$SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' -d '{}')
case "$status" in
  400) pass "embed-gecko-image deployed (rejects empty body)" ;;
  500) fail "embed-gecko-image 500" "$(cat /tmp/probe-body)" ;;
  404) fail "embed-gecko-image not deployed" "$(cat /tmp/probe-body)" ;;
  *)   fail "embed-gecko-image unexpected status $status" "$(cat /tmp/probe-body)" ;;
esac

# export-training-corpus without a user JWT → 403.
status=$(probe GET "$SUPABASE_URL/functions/v1/export-training-corpus" "$SUPABASE_ANON_KEY")
case "$status" in
  403) pass "export-training-corpus deployed (correctly rejects anon)" ;;
  404) fail "export-training-corpus not deployed" "$(cat /tmp/probe-body)" ;;
  *)   fail "export-training-corpus unexpected status $status" "$(cat /tmp/probe-body)" ;;
esac

# ---- 4. Dataset sanity ---------------------------------------------------
section "Dataset sanity"
status=$(rpc gecko_image_stats '{}' "$SUPABASE_ANON_KEY")
if [[ "$status" == "200" ]]; then
  body=$(cat /tmp/probe-body)
  total=$(printf '%s' "$body" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("total","?"))' 2>/dev/null || echo "?")
  verified=$(printf '%s' "$body" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("verified","?"))' 2>/dev/null || echo "?")
  pass "corpus size — total=$total verified=$verified"
else
  skip "stats RPC already failed above"
fi

printf '\n%s%d passed, %d failed%s\n' "$BLU" "$PASS" "$FAIL" "$RST"
[[ "$FAIL" -eq 0 ]]
