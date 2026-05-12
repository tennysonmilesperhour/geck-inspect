#!/bin/bash
# Weekly auto-pull for the local geck-inspect checkout.
#
# Scheduled by ~/Library/LaunchAgents/com.geckinspect.weekly-pull.plist
# (the source-of-truth copy lives at scripts/local/com.geckinspect.weekly-pull.plist
# in the repo).
#
# Uses `git pull --ff-only` so this can NEVER overwrite local work:
#   - uncommitted edits      -> pull aborts, edits stay
#   - unpushed local commits -> pull aborts (diverged), nothing touched
#   - clean & behind remote  -> fast-forwards
#
# Log lives at ~/Library/Logs/geck-inspect-pull.log. Tail it with:
#   tail -f ~/Library/Logs/geck-inspect-pull.log

set -u

REPO="/Users/tennyson/dev/geck-inspect"
LOG="$HOME/Library/Logs/geck-inspect-pull.log"
mkdir -p "$(dirname "$LOG")"

ts() { date "+%Y-%m-%d %H:%M:%S"; }

{
  echo ""
  echo "=== $(ts) weekly-pull starting ==="

  if [ ! -d "$REPO/.git" ]; then
    echo "ERROR: $REPO is not a git repo. Skipping."
    exit 1
  fi

  cd "$REPO" || { echo "ERROR: cd $REPO failed"; exit 1; }

  branch=$(git rev-parse --abbrev-ref HEAD)
  echo "current branch: $branch"

  if [ "$branch" != "main" ]; then
    echo "Not on main (on $branch). Fetching only, leaving working tree alone."
    git fetch origin main
    echo "=== done (fetched, not merged) ==="
    exit 0
  fi

  echo "fetching origin..."
  if ! git fetch origin main; then
    echo "ERROR: fetch failed"
    exit 1
  fi

  local_sha=$(git rev-parse HEAD)
  remote_sha=$(git rev-parse origin/main)
  if [ "$local_sha" = "$remote_sha" ]; then
    echo "already up to date ($local_sha)"
    echo "=== done ==="
    exit 0
  fi

  echo "attempting fast-forward pull..."
  if git pull --ff-only origin main; then
    echo "pulled cleanly. now at: $(git rev-parse HEAD)"
  else
    echo "fast-forward refused (uncommitted changes or diverged history)."
    echo "leaving working tree untouched. resolve manually when convenient."
    git status --short
  fi
  echo "=== done ==="
} >> "$LOG" 2>&1
