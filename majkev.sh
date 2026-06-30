#!/usr/bin/env bash
# majkev: sync branch Kev with main. No push.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BRANCH="Kev"
CURRENT="$(git branch --show-current)"

if [ "$CURRENT" != "$BRANCH" ]; then
  echo "Switching from '$CURRENT' to '$BRANCH'..."
  git checkout "$BRANCH"
fi

echo "Pulling origin/$BRANCH..."
git pull origin "$BRANCH"

echo "Fetching origin/main..."
git fetch origin main

echo "Merging origin/main into $BRANCH..."
git merge origin/main -m "merge: sync $BRANCH with main"

echo ""
echo "=== majkev done ==="
echo "Branch: $(git branch --show-current)"
git status --short || true
git log -1 --oneline
