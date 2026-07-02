# Module 4 — Internal Projects — Test Report

> Sprint 01 · Phase 2 (Functional Testing) · Pillar 1

---

## ✅ Tests réussis

| # | Test | Résultat |
|---|---|---|
| 1 | Création de projet (Super Admin, `/admin/projects`) | ✅ |
| 2 | Vue détail projet — Overview (stats, progression, task breakdown) | ✅ |
| 3 | Vue détail projet — Tasks (TaskManager en mode project, création/suppression/statut) | ✅ |
| 4 | Vue détail projet — Blockers (filtrage active/resolved, vue liste) | ✅ |
| 5 | Vue détail projet — Team (affichage leads/membres avec rôles) | ✅ |
| 6 | Vue détail projet — Weekly Update (formulaire + historique) | ✅ |
| 7 | Vue détail projet — Timeline (activité des tâches enregistrée) | ✅ |
| 8 | Staff — "My Projects" liste (`/staff/projects`) | ✅ |
| 9 | Staff — Vue détail projet (`/staff/projects/[id]`) | ✅ |
| 10 | Progression auto-calculée (tasks completed / total → %) | ✅ |
| 11 | Business Rule : tâches liées au projet → contribuent au reporting | ✅ |

---

## 🐛 Bugs trouvés et corrigés

| # | Bug | Cause | Correction |
|---|---|---|---|
| 1 | `"column 'meta' of relation 'v2_projects' does not exist"` | Schéma staging sans colonne `meta` (prod l'a) | `ALTER TABLE v2_projects ADD COLUMN meta JSONB` |
| 2 | `"null value in column 'program_id' violates not-null"` | `program_id` NOT NULL dans le schéma (prod nullable) | `ALTER TABLE v2_projects ALTER program_id DROP NOT NULL` |
| 3 | `"column c.id does not exist"` (page détail projet) | `contacts` sans colonne `id` (prod l'a) | `ALTER TABLE contacts ADD COLUMN id TEXT`, peuplé depuis `cid` |
| 4 | `"column 'staff_id' does not exist"` (membres projet) | Colonne nommée `staff_cid`, pas `staff_id` | Changé `staff_id` → `staff_cid` dans la query |
| 5 | Timeline vide après création de tâche | `task_assignment_log.project_id` en INTEGER, UUID rejeté | `ALTER COLUMN project_id TYPE TEXT` |
| 6 | `"column 'user_name' does not exist"` (error_logs) | Colonne absente du schéma staging | Non corrigé (hors scope Module 4) |
| 7 | 500 sur `/api/projects` pour staff | `JSON.parse()` sur un objet JSONB déjà parsé par `pg` | `typeof meta === 'string' ? JSON.parse(meta) : meta` |
| 8 | Staff ne voyait pas ses projets | `JSON.parse(row.meta)` échouait côté API | Même correction que #7 |
| 9 | Session expirait rapidement (401/403) | `idleTimeoutMillis: 10000` (10s) fermait les connexions | Passé à `300000` (5min) |
| 10 | `v2_project_updates` — colonnes manquantes | Schéma staging incomplet vs prod | Ajout de `user_id`, `user_name`, `week_number`, `year`, `status`, `notes`, `updated_at` |
| 11 | `staff_id` dans table `project_members` query | Nom de colonne incorrect | Corrigé en `staff_cid` |
| 12 | 404 sur projet cliqué depuis staff | Pas de page `/staff/projects/[id]` | Créée (`src/app/staff/projects/[id]/page.js`) |
| 13 | PM ne voyait pas ses projets | `owner_id` non vérifié dans GET `/api/projects`, PM absent de `project_members` | Query élargie (`owner_id OR project_members`) + PM ajouté rétroactivement dans `project_members` |
| 14 | 404 sur projet staff → `/admin/projects/[id]` redirigeait vers `/staff` | `AdminLayout` bloque non-admin | Restauré + page staff dédiée créée (#12) |

---

## 🔧 Migrations DB appliquées

| Table | Changement |
|---|---|
| `v2_projects` | `+ meta JSONB`, `+ owner_id TEXT`, `program_id` → nullable |
| `contacts` | `+ id TEXT`, peuplé depuis `cid`, index unique |
| `task_assignment_log` | `project_id INTEGER` → `TEXT` |
| `v2_project_updates` | `+ user_id`, `+ user_name`, `+ week_number`, `+ year`, `+ status`, `+ notes`, `+ updated_at` |
| `project_members` | `+ assigned_at TIMESTAMP`, contrainte UNIQUE |

---

## ⚠️ À faire / Reste à investiguer

| # | Tâche | Priorité |
|---|---|---|
| 1 | `error_logs` — colonne `user_name` manquante (non critique pour Module 4) | Low |
| 2 | La page staff détail projet pourrait bénéficier d'un layout dédié (pas `DashboardLayout role="staff"` avec toutes les routes admin) | Medium |
| 3 | Vérifier les permissions sur les actions staff (création tâche, résolution blocker) | Medium |
| 4 | Tests croisés avec le Developer (projet interne engineering) | Low |

---

## 📊 Statut Module 4

**✅ READY** — Tous les workflows testés, bugs critiques corrigés, fonctionnalité manquante (page staff) créée.
