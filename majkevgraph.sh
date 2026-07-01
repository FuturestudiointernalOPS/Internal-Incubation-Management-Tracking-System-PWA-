#!/usr/bin/env bash
# majkevgraph: majkev + rebuild graphify graph (AST-only) + commit. No push.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

bash ./majkev.sh

echo ""
echo "Rebuilding graphify graph (src/)..."
python3 ./graphify_rebuild.py src

git add graphify-out/

if git diff --cached --quiet; then
  echo "No graph changes to commit."
else
  git commit -m "chore: rebuild graphify code graph for src/"
fi

echo ""
echo "=== majkevgraph done ==="
git status --short || true
git log -1 --oneline
