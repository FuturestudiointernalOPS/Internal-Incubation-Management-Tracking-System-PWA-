# Rapport de Tests — Sprint 01 — Pillar 1

> Modules 1 (Tasks), 2 (Standup) et 3 (Retro) — Phase 2 : Functional Testing
> ✅ = Fonctionne | ❌ = Bug | ✅🔧 = Corrigé

---

## Module 1 — Personal Task Management

### ✅ Tests qui passent

| Test | Détail |
|---|---|
| **Création d'une tâche** | POST `/api/tasks` — la tâche est créée avec succès |
| **Validation des tâches terminées** | Le workflow de complétion fonctionne |
| **Modification d'une tâche** | PUT `/api/tasks` — l'édition fonctionne |
| **Changement de date** | La modification des dates d'échéance fonctionne |

### ❌ Bugs

| # | Test | Bug | Sévérité |
|---|---|---|---|
| **#8** | **Déconnexion aléatoire** | À vérifier — probablement résolu avec la correction DB (user_name ajouté à error_logs) | **Critique** |
| **#12** | **Archivage d'une tâche** | ✅🔧 **Corrigé** — colonnes `user_id`, `field_name`, `metadata` manquantes dans `task_audit_logs`. Ajoutées en DB. | ~~Haute~~ ✅ |
| **#9** | **"Project Contribution" → crash** | ✅🔧 **Corrigé** — paramètre `t` dans `.map((t) =>` shadowait la fonction de traduction → `"t is not a function"`. Renommé en `projTask` | ~~Haute~~ ✅ |

### ✅🔧 Corrigé (DB)

| # | Test | Correctif |
|---|---|---|
| **#1** | **Création d'une subtask** | ✅🔧 Colonne `user_name` ajoutée à `error_logs` → subtask et déconnexion résolus |

### ⚠️ Tests restants

- Catégories (filtres, affichage)
- Association aux projets
- Carry-over (report de tâche)
- Validation (champs obligatoires, contraintes)

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

| Module | ✅ Passent | ❌ Bugs | ✅🔧 Corrigés |
|---|---|---|---|
| **M1 — Tasks** | 4 | 1 (critique, à vérifier) | 2 (#1 DB, #9 code) |
| **M2 — Standup** | 6 | 1 (haute) | 0 |
| **M3 — Retro** | 0 | 6 (2 critiques, 3 hautes, 1 moyenne) | 1 (#5 code) |
| **Total** | **10** | **8** | **3** |
