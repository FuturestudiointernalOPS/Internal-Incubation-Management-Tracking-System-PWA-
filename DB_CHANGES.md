# Corrections Base de Données — Sprint 01

> Toutes les corrections ont été exécutées ✅

---

## 1. Ajouter `user_name` à `error_logs`

**Exécuté le :** 2026-07-01 ✅

```sql
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
```

**Contexte :** Le code de `src/app/api/errors/route.js` insère et met à jour la colonne `user_name` dans `error_logs`, mais elle n'avait jamais été créée. Cause du Bug #1 (subtask bloquée + déconnexion).

**Statut :** ✅ Exécuté

---

## 2. Migration V3 — Track 3 : Participants, Deliverables & Coaching

**Exécuté le :** 2026-07-09 ✅

```sql
-- Voir src/migrations/010_track3_participants_deliverables_coaching.sql
```

### Changements

#### v2_submissions (Versioning + Evaluation + Review Actions)

| Colonne | Type | Description |
|---|---|---|
| `version_number` | INTEGER DEFAULT 1 | Version auto-incrémentée par participant+deliverable |
| `supporting_url` | TEXT | URL secondaire pour la soumission |
| `review_action` | TEXT | Action du instructeur : approved, revision_requested, rejected, followup_scheduled |
| `rejection_reason` | TEXT | Motif obligatoire pour rejection |
| `evaluation_score` | DECIMAL | Score numérique (académique 0-100) |
| `evaluation_data` | JSONB | Données d'évaluation (incubation multidimensionnelle) |
| `updated_at` | TIMESTAMPTZ | Dernière mise à jour |

Nouveaux statuts : `revision_requested`, `pending_followup`

#### v2_programs (Evaluation Models)

| Colonne | Type | Description |
|---|---|---|
| `grading_mode` | TEXT | Étendu : graded, review, followup, academic, incubation |
| `evaluation_config` | JSONB | Configuration d'évaluation (seuils, dimensions) |

#### v2_followups (Full Meetings)

| Colonne | Type | Description |
|---|---|---|
| `participant_id` | UUID REFERENCES v2_participants | Participant lié |
| `submission_id` | UUID REFERENCES v2_submissions | Soumission liée |
| `scheduled_at` | TIMESTAMPTZ | Date et heure planifiée |
| `duration_minutes` | INTEGER DEFAULT 30 | Durée en minutes |
| `meeting_link` | TEXT | Lien de réunion (Google Meet, etc.) |
| `status` | TEXT | scheduled, completed, cancelled |
| `notes` | TEXT | Notes de la réunion |

#### v2_attendance (KPI Linkage)

| Colonne | Type | Description |
|---|---|---|
| `kpi_id` | INTEGER REFERENCES v2_kpis | KPI lié à la présence |

### Nouveaux Indexes

- `idx_v2_submissions_participant_deliverable`
- `idx_v2_submissions_version`
- `idx_v2_followups_participant`
- `idx_v2_followups_submission`

### Fichier de migration

`src/migrations/010_track3_participants_deliverables_coaching.sql`

**Statut :** ✅ Exécuté
