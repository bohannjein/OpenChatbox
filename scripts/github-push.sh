#!/usr/bin/env bash
# Initialise the local repo cleanly and push OpenChatbox to GitHub.
#
#   bash scripts/github-push.sh
#
# SAFE BY DESIGN: build artefacts, /data (your admin account) and .env
# (secrets) are already excluded via .gitignore, so the push is clean WITHOUT
# deleting anything local. This script never runs a destructive `git clean`.
set -euo pipefail

REMOTE_URL="https://github.com/bohannjein/OpenChatbox.git"
BRANCH="main"

cd "$(dirname "$0")/.."

# 1) Ensure a git repo exists.
if [ ! -d .git ]; then
  echo "→ git init"
  git init
fi

# 2) Be on the target branch.
git checkout -B "$BRANCH"

# 3) Show what stays local (excluded by .gitignore) — nothing is deleted.
echo "→ These paths are intentionally NOT pushed (local-only):"
git status --ignored --short | grep '^!!' || echo "   (none)"
echo "→ Untracked build junk that would be cleaned by 'git clean -ndx' (dry-run):"
git clean -ndx -e '/data' -e '.env' -e '.env*.local' || true

# 4) Point origin at the OpenChatbox repo (idempotent).
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi
echo "→ origin = $(git remote get-url origin)"

# 5) Stage + commit (no-op if nothing changed).
git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: deployment setup (docker, scripts, footer, branding)"
else
  echo "→ nothing to commit"
fi

# 6) Push. First push sets upstream.
echo "→ pushing to $REMOTE_URL ($BRANCH) ..."
git push -u origin "$BRANCH"
echo "✓ done"
