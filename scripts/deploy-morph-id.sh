#!/usr/bin/env bash
# Deploys the /recognition + /training pipeline in the right order:
#   1. Apply the auto-applied SQL migrations.
#   2. Deploy the four edge functions.
#   3. Optionally backfill embeddings for verified rows missing one.
#
# Idempotent — every step is safe to re-run. The manual RLS step is NOT
# done here on purpose (see scripts/README.md).
#
# Usage:
#   scripts/deploy-morph-id.sh            # full deploy, no backfill
#   scripts/deploy-morph-id.sh --backfill # also embed rows missing vectors
#   scripts/deploy-morph-id.sh --dry-run  # print what would run
#
# Prereqs (check these yourself once; the script will complain if not):
#   - supabase CLI installed and authenticated
#   - Repo linked to your project: `supabase link --project-ref <ref>`
#   - Secrets set:
#       supabase secrets set REPLICATE_API_TOKEN=...
#       supabase secrets set SIGLIP_MODEL=owner/siglip-model
#   - `vector` extension available in prod (Supabase dashboard → Database → Extensions)

set -euo pipefail

cd "$(dirname "$0")/.."

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; BLU=$'\033[34m'; DIM=$'\033[2m'; RST=$'\033[0m'
say()  { printf '%s%s%s\n' "$BLU" "→ $*" "$RST"; }
ok()   { printf '%s%s%s\n' "$GRN" "✓ $*" "$RST"; }
warn() { printf '%s%s%s\n' "$YEL" "! $*" "$RST"; }
die()  { printf '%s%s%s\n' "$RED" "✗ $*" "$RST" >&2; exit 1; }

DRY=false
BACKFILL=false
for arg in "$@"; do
  case "$arg" in
    --dry-run)  DRY=true ;;
    --backfill) BACKFILL=true ;;
    -h|--help)  sed -n '3,20p' "$0"; exit 0 ;;
    *)          die "unknown arg: $arg" ;;
  esac
done

run() {
  if $DRY; then
    printf '%s  $ %s%s\n' "$DIM" "$*" "$RST"
  else
    "$@"
  fi
}

command -v supabase >/dev/null || die "supabase CLI not found. Install: https://supabase.com/docs/guides/cli"

# ---- 1. Auto-applied migrations -------------------------------------------
# --include-all lets the CLI apply local migrations whose timestamps are
# before the last remote-applied one. Without it, any backfill added to
# the repo after an ad-hoc prod change refuses to deploy.
say "Applying SQL migrations (supabase db push --include-all)"
run supabase db push --include-all
ok  "migrations applied"

# ---- 2. Edge functions ----------------------------------------------------
FUNCTIONS=(
  "recognize-gecko-morph --no-verify-jwt"
  "embed-gecko-image     --no-verify-jwt"
  "export-training-corpus"
)
for spec in "${FUNCTIONS[@]}"; do
  # shellcheck disable=SC2086
  set -- $spec
  name="$1"; shift
  say "Deploying edge function: $name $*"
  # shellcheck disable=SC2068
  run supabase functions deploy "$name" $@
  ok  "$name deployed"
done

# ---- 3. Reminders that require hands-on-keyboard --------------------------
cat <<EOF

${YEL}-- Hands-on-keyboard steps (not automated on purpose):${RST}
  1. Apply the RLS + role setup by copy-pasting
     ${DIM}supabase/migrations/README_training_rls_prod.md${RST}
     into the Supabase SQL editor (prod project).
  2. Promote whoever you trust:
       ${DIM}UPDATE profiles SET role = 'expert_reviewer' WHERE email = 'you@example.com';${RST}
  3. Confirm these secrets exist:
       ${DIM}supabase secrets list${RST}
     You need REPLICATE_API_TOKEN and SIGLIP_MODEL set.

EOF

# ---- 4. Optional backfill -------------------------------------------------
if $BACKFILL; then
  say "Backfilling embeddings for verified rows without one"
  : "${SUPABASE_URL:?SUPABASE_URL must be set to run backfill (e.g. https://<ref>.supabase.co)}"
  : "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY must be set to run backfill}"

  # Pull candidate rows as JSONL via PostgREST, then POST each to the embed fn.
  resp=$(curl -sS \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    "$SUPABASE_URL/rest/v1/gecko_images?image_embedding=is.null&select=id,image_url&limit=500")

  count=$(printf '%s' "$resp" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))' 2>/dev/null || echo 0)
  say "Found $count rows missing embeddings (capping this run at 500)"

  printf '%s' "$resp" \
    | python3 -c 'import sys,json
for r in json.load(sys.stdin):
  print(json.dumps({"geckoImageId": r["id"], "imageUrl": r["image_url"]}))' \
    | while IFS= read -r body; do
        if $DRY; then
          printf '%s  $ POST /embed-gecko-image %s%s\n' "$DIM" "$body" "$RST"
        else
          curl -sS -X POST "$SUPABASE_URL/functions/v1/embed-gecko-image" \
            -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
            -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
            -H 'Content-Type: application/json' \
            -d "$body" > /dev/null \
            || warn "embed call failed for $(printf '%s' "$body" | head -c 80)"
        fi
      done
  ok "backfill run complete (re-run if count > 500)"
fi

ok "All done. Verify with: scripts/check-morph-id.sh"
