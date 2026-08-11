#!/usr/bin/env bash
# deliver.sh — workflow complet pour livrer le code de Kev → dev
# ============================================================================
# Étapes :
#   1. Build Kev
#   2. Graph Kev (rebuild + commit si changé)
#   3. Fetch + pull origin/dev (⚠️ conflits possibles)
#   4. Merge Kev → dev (⚠️ conflits possibles)
#   5. Build dev
#   6. Push origin/dev
#   7. Retour Kev → majkev → majkevgraph
#   8. Si graph changé par majkevgraph : commit + push Kev + remerge dev + push
# ============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "════════════════════════════════════════════════════════"
echo "  DELIVER WORKFLOW — Kev → dev"
echo "════════════════════════════════════════════════════════"

# ─── 1. Build Kev ───
echo ""
echo "[1/8] Build Kev..."
npm run build 2>&1 | tail -3
echo "✓ Build Kev OK"

# ─── 2. Graph Kev ───
echo ""
echo "[2/8] Rebuild graph Kev..."
python3 ./graphify_rebuild.py src
if ! git diff --quiet -- graphify-out/; then
  git add graphify-out/
  git commit -m "chore: rebuild graphify code graph for src/"
  echo "✓ Graph committed"
else
  echo "✓ Graph unchanged"
fi

# ─── 3. Fetch + pull dev ───
echo ""
echo "[3/8] Fetch + pull origin/dev..."
git fetch origin dev
git checkout dev
git pull origin dev --no-edit || {
  echo ""
  echo "⚠️  CONFLITS lors du pull dev ! Résous manuellement, puis :"
  echo "   git add . && git commit && ./deliver.sh --continue"
  exit 1
}
echo "✓ dev à jour"

# ─── 4. Merge Kev → dev ───
echo ""
echo "[4/8] Merge Kev → dev..."
if ! git merge Kev --no-edit; then
  echo ""
  echo "⚠️  CONFLITS lors du merge Kev → dev ! Résous manuellement, puis :"
  echo "   git add . && git commit && ./deliver.sh --continue"
  exit 1
fi
echo "✓ Merge OK"

# ─── 5. Build dev ───
echo ""
echo "[5/8] Build dev..."
npm run build 2>&1 | tail -3
echo "✓ Build dev OK"

# ─── 6. Push dev ───
echo ""
echo "[6/8] Push origin/dev..."
git push origin dev
echo "✓ Push dev OK"

# ─── 7. Retour Kev + sync ───
echo ""
echo "[7/8] Retour Kev + majkev + majkevgraph..."
git checkout Kev
bash ./majkev.sh
bash ./majkevgraph.sh

# ─── 8. Si graph changé : commit + push Kev + remerge dev + push dev ───
echo ""
echo "[8/8] Vérif graph post-sync..."
if ! git diff --quiet -- graphify-out/; then
  echo "Graph changé → commit + push Kev + remerge dev..."
  git add graphify-out/
  git commit -m "chore: rebuild graphify code graph for src/"
  git push origin Kev

  git checkout dev
  git merge Kev --no-edit
  npm run build 2>&1 | tail -3
  echo "✓ Build dev post-graph OK"
  git push origin dev

  git checkout Kev
  echo "✓ Graph livré sur dev"
else
  echo "✓ Graph inchangé"
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  DELIVER DONE ✓"
echo "════════════════════════════════════════════════════════"
