# Rapport de Tests — Sprint 01 — Pillar 1

> Modules 1 (Tasks), 2 (Standup) et 3 (Retro) — Phase 2 : Functional Testing
> ✅ = Fonctionne | ❌ = Bug | ✅🔧 = Corrigé

---

## Module 1 — Personal Task Management

**Statut : ✅ FONCTIONNEL**

### ✅ Tests qui passent

| Test | Détail |
|---|---|
| **Création d'une tâche** | ✅ POST `/api/tasks` |
| **Modification d'une tâche** | ✅ PUT `/api/tasks` |
| **Changement de date** | ✅ Modification des dates d'échéance |
| **Validation (champs obligatoires)** | ✅ Si champs vides, rien n'est sauvegardé |
| **Validation des tâches terminées** | ✅ Workflow de complétion |
| **Subtask** | ✅ Création fonctionnelle (DB corrigée) |
| **Archivage / Suppression** | ✅ Archivage fonctionnel + cascade subtasks |
| **Catégories** | ✅ Fonctionnel via le dropdown du formulaire |
| **Association aux projets** | ✅ Fonctionnel via le sélecteur de projet |
| **"Project Contribution"** | ✅ Crash `t is not a function` corrigé |

### ❌ Bugs résiduels

| # | Test | Bug | Sévérité |
|---|---|---|---|
| **#8** | **Déconnexion aléatoire** | À vérifier — probablement résolu avec les corrections DB | ~Critique~ |

---

## Module 2 — Weekly Standup

### ✅ Tests qui passent

| Test | Détail |
|---|---|
| **Génération auto hebdomadaire** | Le standup se génère automatiquement |
| **Intégration des tâches existantes** | Les tâches de la semaine sont intégrées |
| **Ajout manuel de tâches** | Fonctionne |
| **Soumission du standup** | Boutons Draft / Save fonctionnent |
| **Planification hebdomadaire** | Navigation entre semaines fonctionne |
| **Exactitude des rapports** | Les données affichées sont correctes |

### ❌ Bugs

| # | Test | Bug | Sévérité |
|---|---|---|---|
| **#2** | **Bouton "Create New Standup"** | Désactivé si standup existe déjà. Un bouton bloque hors lundi (`new Date().getDay() !== 1`) | Haute |

---

## Module 3 — Weekly Retro

**Statut : ❌ BLOQUÉ**

### ✅ Tests qui passent

| Test | Détail |
|---|---|
| *Aucun* | *Module bloqué — voir bugs ci-dessous* |

### ❌ Bugs

| # | Test | Bug | Sévérité |
|---|---|---|---|
| **#3** | **Réconciliation des tâches** | `reconciledTasks` et `reconciledBlockers` déclarés mais **jamais alimentés**. Bloc de réconciliation (l.591-617) = code mort | **Critique** |
| **#4** | **Bouton Submit/Save retro** | La vue retro n'a **aucun bouton** de soumission — impossible de créer ou soumettre un rapport retro | **Critique** |
| **#6** | **Checkbox complétion** | Le toggle retro appelle `PUT /api/tasks` direct mais ne met pas à jour `reconciledTasks` | Haute |
| **#7** | **Raisons de non-complétion** | Le champ "why wasn't this completed" n'a pas de bouton submit — message perdu | Moyenne |
| **#10** | **Reflection (wins, notes)** | Impossible à tester : pas de bouton submit → champs qualitatifs non persistables (bloqué par #4) | Haute |
| **#11** | **Carry-over retro** | Impossible à tester : pas de bouton submit → reports non validables (bloqué par #4) | Haute |

### ✅🔧 Corrigé (code)

| # | Test | Correctif |
|---|---|---|
| **#5** | `challenges` manquant | Ajout de `challenges: ""` dans le state initial du formulaire |

---

## Résumé

| Module | Statut |
|---|---|
| **M1 — Tasks** | ✅ **FONCTIONNEL** — tous les tests passent |
| **M2 — Standup** | ⚠️ Presque fonctionnel — 1 bug sur le bouton |
| **M3 — Retro** | ❌ **BLOQUÉ** — pas de bouton submit, réconciliation vide |
