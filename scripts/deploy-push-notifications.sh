#!/usr/bin/env bash
# Deploys the web-push notification stack:
#   1. Apply new migrations (push_subscriptions table + notify trigger).
#   2. Deploy the send-push edge function.
#   3. Print the two ALTER DATABASE commands you must run once.
#
# Idempotent — safe to re-run. Migrations already applied are no-ops;
# functions already deployed get overwritten with the current code.
#
# Usage:
#   scripts/deploy-push-notifications.sh
#   scripts/deploy-push-notifications.sh --dry-run
#
# Prereqs:
#   - supabase CLI installed and authenticated
#   - Repo linked to your project: `supabase link --project-ref <ref>`
#   - Secrets set:
#       supabase secrets set VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...  VAPID_SUBJECT=mailto:you@example.com

set -euo pipefail

cd "$(dirname "$0")/.."

RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; BLU=$'\033[34m'; DIM=$'\033[2m'; RST=$'\033[0m'
say()  { printf '%s%s%s\n' "$BLU" "→ $*" "$RST"; }
ok()   { printf '%s%s%s\n' "$GRN" "✓ $*" "$RST"; }
warn() { printf '%s%s%s\n' "$YEL" "! $*" "$RST"; }

DRY_RUN=0
if [[ "${1-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '%s  would run:%s %s\n' "$DIM" "$RST" "$*"
  else
    "$@"
  fi
}

say "Checking supabase CLI is on PATH…"
if ! command -v supabase >/dev/null 2>&1; then
  printf '%sMissing supabase CLI.%s Install: brew install supabase/tap/supabase\n' "$RED" "$RST"
  exit 1
fi
ok "supabase CLI present"

say "Applying migrations to linked project…"
run supabase db push --include-all

say "Deploying send-push edge function…"
run supabase functions deploy send-push --no-verify-jwt

ok "Deploy complete."
printf '\n'
warn "One-time setup required — run these SQL statements once against your production DB:"
cat <<'SQL'

  -- Replace <project-ref> with your Supabase project ref and <key> with
  -- the service_role key from Supabase dashboard → Settings → API.
  alter database postgres
    set "app.send_push_url"    = 'https://<project-ref>.supabase.co/functions/v1/send-push';
  alter database postgres
    set "app.service_role_key" = '<service_role_key>';
  select pg_reload_conf();

SQL
warn "Until both are set, the trigger silently skips push fanout (notifications still insert normally)."
