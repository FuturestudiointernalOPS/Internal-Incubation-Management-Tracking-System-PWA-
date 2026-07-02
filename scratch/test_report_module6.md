# Module 6 — Blockers — Test Report

> Sprint 01 · Phase 2 (Functional Testing) · Pillar 1

---

## ✅ Tests réussis

| # | Test | Résultat |
|---|---|---|
| 1 | Création blocker via Shield dans TaskManager | ✅ |
| 2 | Notification Super Admin (cloche) | ✅ |
| 3 | Visibilité projet → onglet Blockers (tâches liées) | ✅ |
| 4 | Résolution réservée au créateur (Staff Two → 403) | ✅ |
| 5 | Résolution par créateur (Staff One → OK) | ✅ |
| 6 | Tâche repasse en `in_progress` après résolution | ✅ |
| 7 | Compteur Shield ne montre que les actifs | ✅ |

---

## 🐛 Bugs trouvés et corrigés

| # | Bug | Cause | Correction |
|---|---|---|---|
| 1 | Pas d'UI blocker dans TaskManager (projet / staff) | Bouton absent, seulement dans op-report | Ajout Shield + modal dans TaskManager |
| 2 | Pas de notification SA à la création | Code absent | Insert direct dans `v2_notifications` avec `recipient_id = "sa"` |
| 3 | Notification non visible dans la cloche | `recipient_id` mismatch (SA cid vs "sa") | Changé en `"sa"` + migration des existantes |
| 4 | Compteur Shield incluait les blockers résolus | Filtre manquant | Filtre `status === 'active'` uniquement |

---

## 🔧 Modifications code

| Fichier | Changement |
|---|---|
| `TaskManager.js` | + Shield button, + blocker modal (créer/lister/résoudre) |
| `api/blockers/route.js` | + Notification SA à la création (direct DB) |

---

## 📊 Statut Module 6

**✅ READY** — Tous les workflows testés, toutes les business rules respectées.
