# Module 5 — Categories — Test Report

> Sprint 01 · Phase 2 (Functional Testing) · Pillar 1

---

## ✅ Tests réussis

| # | Test | Résultat |
|---|---|---|
| 1 | API GET `/api/categories` retourne les catégories | ✅ |
| 2 | Dropdown catégories dans TaskManager (choix sans projet) | ✅ |
| 3 | Création tâche avec catégorie (sans projet) | ✅ |
| 4 | Filtrage par catégorie | ✅ |

---

## 🐛 Bugs trouvés et corrigés

| # | Bug | Cause | Correction |
|---|---|---|---|
| 1 | `GET /api/categories` erreur `column "sort_order" does not exist` | Colonnes `is_active` et `sort_order` absentes du schéma staging | `ALTER TABLE work_categories ADD COLUMN` |
| 2 | Aucune catégorie disponible (0 rows) | Table vide | Seeded 5 catégories par défaut |
| 3 | `POST /api/categories` non implémenté | Code commenté uniquement | Noté (non bloquant, utilisable via DB directe) |

---

## 🔧 Migrations DB appliquées

| Table | Changement |
|---|---|
| `work_categories` | `+ is_active BOOLEAN DEFAULT true`, `+ sort_order INTEGER DEFAULT 0` |
| `work_categories` | Seed : Administrative, Support, R&D, Training, Uncategorized |

---

## ⚠️ À faire

| # | Tâche | Priorité |
|---|---|---|
| 1 | Implémenter `POST /api/categories` pour CRUD admin | Low (seed manuel suffit pour l'instant) |
| 2 | Ajouter UI admin pour gérer les catégories (activer/désactiver, renommer) | Low |

---

## 📊 Statut Module 5

**✅ READY** — Catégories fonctionnelles, seedées, utilisables dans TaskManager.
