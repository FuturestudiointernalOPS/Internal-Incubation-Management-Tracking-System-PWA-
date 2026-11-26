# Étape 7 — les gardes des écrans d'administration

Statut : **implémenté le 2026-11-13, vérifié en staging**. Deux droits ajoutés
au catalogue, appliqués en staging ; `authz:doctor` répond **OK**.

## Le problème

Trois écrans d'administration décidaient par **identité** alors que leur API
lisait un droit ou une règle de propriété :

| Écran | Décision en interface | Décision serveur |
|---|---|---|
| `/admin/blockers` | `isPlatformOwnerRole(role)` → voir tous les blockers/tâches | `session.role !== "super_admin"` |
| `/admin/work` | même test → bouton supprimer | `role !== "super_admin"` (suppression) |
| `/admin/investors` | même test → bouton « ajouter un investisseur » | `investor.create` **ou** `settings.edit` |

Les trois ont été alignés sur un **droit**.

## Les deux droits ajoutés

| Droit | Sens | Profil par défaut |
|---|---|---|
| `tasks.view_all` | voir les tâches et blockers de **toutes** les personnes, pas seulement les siens | propriétaire seul |
| `crm.next_action_any` | fixer l'action suivante d'un enregistrement CRM qu'on ne possède pas (support/réparation) | propriétaire seul |

Aucun autre profil ne les reçoit : le comportement actuel est donc conservé
(seul le propriétaire voyait tout, seul le propriétaire réparait un
enregistrement). Un administrateur peut désormais les accorder ou les retirer
depuis l'écran des permissions, sans changer de code.

## Ce qui change, écran par écran

### `/admin/blockers`
- Interface : `can("tasks", "view_all")` choisit l'adresse `/api/blockers`
  (toutes les personnes) ou `/api/blockers?user_id=<soi>`.
- Serveur : `listBlockers` reçoit un **verdict** `canSeeAll`, résolu par le
  routeur via `authorize(ctx, "tasks", "view_all")`. Le service ne lit plus de
  rôle.

### `/admin/work`
- Interface : `can("tasks", "delete")` alimente le bouton supprimer (propriété
  renommée `canDelete` dans les trois fichiers, pour que le nom dise la règle).
- Serveur : `deleteTaskRecord` reçoit `canDeleteAny`. La règle de propriété
  (propriétaire, assigné, superviseur) reste en place pour tout le monde.

### `/admin/investors`
- Interface : le lien « ajouter un investisseur » s'ouvre sur les **deux** droits
  que son API exige déjà : `investor.create` ou `settings.edit`. Aucun changement
  serveur n'était nécessaire — l'API était déjà correcte, l'écran ne l'était pas.

## La lecture des tâches suit la même règle

`GET /api/tasks` et `GET /api/blockers` résolvent `tasks.view_all` et le
transmettent aux services. `getTasksByFilters` (le modèle) prend désormais
`seesAll` au lieu de `isSuperAdmin` : le nom dit la décision, pas l'identité.
La protection « échouer fermé » est conservée — un scope inconnu sans le droit
reste `AND 1 = 0`.

## Vérification

- `authz:doctor` : **OK** (avant : `tasks.view_all` manquant).
- Données appliquées en staging : **2 lignes** sur cette étape
  (`super_admin_default.tasks.view_all` ; `super_admin_default.crm.next_action_any`
  à l'étape précédente).
- Photographie de référence : **0 changement, 0 régression**.
- `npm run test:authz` : **24 suites / 270 tests**.
- Le ratchet de rôles a **perdu deux exceptions** (`tasks/query.js`, `tasks/remove.js`).

## Ce qui reste (gardes de domaine)

- `src/services/tasks/blockers.js` : **converti** à l'étape 8 (levée et
  suppression d'un blocker sur la tâche d'autrui passent par
  `tasks.moderate`). Voir `ETAPE8-TASKS-SCOPE-RIGHTS.md`.
- `seesWholePortfolio(role)` ne sert plus qu'aux **projets** ; les tâches
  résolvent `tasks.act_any` et `tasks.view_all` (`ETAPE8`).
