#!/usr/bin/env bash
# majkev: sync branch Kev with dev, commit merge, push.
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

echo "Fetching origin/dev..."
git fetch origin dev

echo "Merging origin/dev into $BRANCH..."
git merge origin/dev -m "merge: sync $BRANCH with dev"

echo "Pushing origin/$BRANCH..."
git push origin "$BRANCH"

echo ""
echo "=== majkev done ==="
echo "Branch: $(git branch --show-current)"
git status --short || true
git log -1 --oneline
