#!/bin/bash
# Multi-repo weekly auto-sync.
#
# Reads a plain-text list of repo paths from ~/.config/repo-sync.conf
# (one absolute path per line, blank lines and # comments ignored) and
# runs `git pull --ff-only` against `main` in each.
#
# Same safety guarantees as weekly-pull.sh:
#   - uncommitted edits      -> pull aborts, edits stay
#   - unpushed local commits -> pull aborts (diverged), nothing touched
#   - clean & behind remote  -> fast-forwards
#
# Repos on a branch other than `main` are fetched only, never merged.
#
# Scheduled by ~/Library/LaunchAgents/com.localops.repo-sync.plist.
# Log: ~/Library/Logs/repo-sync.log (tail with `tail -f`).

set -u

CONFIG="$HOME/.config/repo-sync.conf"
LOG="$HOME/Library/Logs/repo-sync.log"
mkdir -p "$(dirname "$LOG")"

ts() { date "+%Y-%m-%d %H:%M:%S"; }

sync_one() {
  local repo="$1"
  echo "--- $repo"

  if [ ! -d "$repo/.git" ]; then
    echo "  SKIP: not a git repo"
    return
  fi

  cd "$repo" || { echo "  ERROR: cd failed"; return; }

  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  echo "  branch: $branch"

  if [ "$branch" != "main" ] && [ "$branch" != "master" ]; then
    echo "  not on main/master, fetching only"
    git fetch origin "$branch" 2>&1 | sed 's/^/  /'
    return
  fi

  if ! git fetch origin "$branch" 2>&1 | sed 's/^/  /'; then
    echo "  ERROR: fetch failed"
    return
  fi

  local local_sha remote_sha
  local_sha=$(git rev-parse HEAD)
  remote_sha=$(git rev-parse "origin/$branch")

  if [ "$local_sha" = "$remote_sha" ]; then
    echo "  up to date ($local_sha)"
    return
  fi

  if git pull --ff-only origin "$branch" 2>&1 | sed 's/^/  /'; then
    echo "  pulled. now at: $(git rev-parse HEAD)"
  else
    echo "  fast-forward refused (uncommitted or diverged). skipping."
    git status --short 2>&1 | sed 's/^/  /'
  fi
}

{
  echo ""
  echo "=== $(ts) repo-sync starting ==="

  if [ ! -f "$CONFIG" ]; then
    echo "ERROR: config file missing: $CONFIG"
    echo "Create it with one repo path per line. See repo-sync.conf.example."
    exit 1
  fi

  count=0
  # Strip comments and blank lines, then loop.
  while IFS= read -r line || [ -n "$line" ]; do
    # Trim leading/trailing whitespace.
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [ -z "$line" ] && continue
    case "$line" in \#*) continue ;; esac
    # Expand ~ to $HOME.
    line="${line/#\~/$HOME}"
    sync_one "$line"
    count=$((count + 1))
  done < "$CONFIG"

  echo "=== done ($count repos processed) ==="
} >> "$LOG" 2>&1
