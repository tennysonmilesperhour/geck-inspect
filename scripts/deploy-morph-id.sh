#!/usr/bin/env bash
# Deploys the Morph ID edge functions by hand:
#   1. Migrations are skipped (merging to main applies them).
#   2. Deploy three edge functions: recognize-gecko-morph,
#      embed-gecko-image and export-training-corpus.
#   3. Optionally backfill embeddings for verified rows missing one.
#
# DO NOT RUN WITHOUT TENNYSON'S SAY. Two of the three functions are kept
# hand-deployed on purpose because the copies in this repository are
# newer than what production runs; this script deploys the repository
# copies and so changes production. See scripts/README.md and
# docs/INFRASTRUCTURE.md, section 2.
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
# Schema changes are applied deliberately (docs/MIGRATIONS.md). This script
# used to run `supabase db push --include-all`, which would replay every repo
# migration that production's history does not list by name, including
# superseded ones that would overwrite the vault-based notification
# dispatcher. Never do that here.
say "Skipping database migrations: merging to main applies them (docs/MIGRATIONS.md)"

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
  : "${MORPH_EMBED_BACKFILL_KEY:?MORPH_EMBED_BACKFILL_KEY must be set to run backfill}"
  if $DRY; then
    run pnpm backfill:morph-embeddings -- --limit 500 --concurrency 1 --dry-run
  else
    pnpm backfill:morph-embeddings -- --limit 500 --concurrency 1
  fi
  ok "backfill run complete (re-run until the queue is empty)"
fi

ok "All done. Verify with: scripts/check-morph-id.sh"
