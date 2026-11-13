# Étape 8 — la portée des tâches devient un droit

Statut : **implémenté le 2026-11-13, vérifié en staging**. Trois droits dans le
catalogue ; ceux du personnel appliqués en staging ; `authz:doctor` répond
**OK**.

## Le problème

Tout le domaine tâches décidait « qui peut toucher cette tâche » avec une seule
règle par rôle, `seesWholePortfolio(role)` (propriétaire, personnel interne,
gestionnaire de programme), et deux raccourcis `session.role !== "super_admin"`
pour la modération. Le rôle ne peut pas exprimer ces deux pouvoirs, qui sont
différents :

| Pouvoir | Qui l'a aujourd'hui | Droit |
|---|---|---|
| voir la liste de **tout le monde** (tâches, blockers) | propriétaire | `tasks.view_all` |
| travailler sur une tâche qu'on ne possède pas : commentaires, ressources, journal, discussion, report, réconciliation, champ superviseur | propriétaire + personnel interne + gestionnaire de programme | `tasks.act_any` |
| modérer la production d'autrui : modifier/supprimer son commentaire, lever/supprimer un blocker sur sa tâche | propriétaire | `tasks.moderate` |

`tasks.view_all` existait déjà (étape 7). Les deux autres sont ajoutés ici.

## Décision prise — et pourquoi elle est réversible

La modération (commentaires d'autrui, blockers) reçoit **un droit dédié,
`tasks.moderate`, porté par le propriétaire seul**. C'est exactement ce que le
rôle `super_admin` autorisait, donc rien ne change aujourd'hui. Le nom a été
choisi pour ne pas confondre trois pouvoirs distincts :

- `tasks.view_all` — voir,
- `tasks.act_any` — travailler avec les autres,
- `tasks.moderate` — réparer la production des autres.

Un administrateur peut désormais accorder ou retirer chacun d'eux. Si vous
préférez une autre frontière (par exemple fusionner `act_any` et `moderate`),
seule la donnée change : aucun code à réécrire.

## Ce qui change

### Une seule résolution, partout

`src/services/tasks/access.js` porte la règle et sa résolution :

```
ownsTask(task, cid)                    — propriétaire, assigné, superviseur
canAccessTask({ task, cid, canActAny }) — le droit OU la relation (pure)
resolveTaskActAny({ role, cid })        — demande `tasks.act_any` au moteur
resolveTaskModerate({ role, cid })      — demande `tasks.moderate` au moteur
canAccessTaskFor({ task, role, cid })   — la règle complète
```

Le contexte est mis en cache par identité (10 s) et partagé entre appelants :
ces services ne paient pas une lecture par question. Un échec de résolution est
une porte fermée.

### Les services convertis

`comments`, `resources`, `logs`, `duplicate`, `blockers` (discussion),
`carryover`, `reconcile`, `create` (champ superviseur) et `update` (champ
superviseur) ne comparent plus de rôle. `query` ne décide plus « côté personnel
» à partir du rôle, mais de `view_all` ou `act_any`.

`resolveListingScope` accepte un verdict `seesAll` : les services des tâches le
transmettent, et les projets continuent d'utiliser le repli par rôle en
attendant leur conversion.

### La modération

- `deleteTaskComment` / `editTaskComment` : auteur **ou** `tasks.moderate`.
- `createBlockerForTask` / `deleteBlockerRecord` : propriétaire/assigné/
  superviseur/créateur **ou** `tasks.moderate`.

## Vérification

- `authz:doctor` : **OK** (avant : `tasks.act_any` et `tasks.moderate`
  manquants).
- Données appliquées en staging : **3 lignes**
  (`super_admin_default.tasks.act_any`, `super_admin_default.tasks.moderate`,
  `staff_default.tasks.act_any`).
- Photographie de référence : **0 changement, 0 régression**.
- `npm run test:authz` : **25 suites / 281 tests**.
- Le ratchet de rôles a **perdu deux exceptions** (`tasks/blockers.js#M3`,
  `tasks/comments.js#M3`).
- ESLint : 0 erreur. `npm run build` : succès.

## Ce qui reste

- **Projets** : **converti à l'étape 9** (`projects.view_all`) — voir
  `ETAPE9-PROJECT-SCOPE-RIGHTS.md`.
- **Annuler l'invitation d'autrui** (`collaboration.js`) : pouvoir de support
  du propriétaire, encore keyé sur le rôle.
- **Création de tâche** : `create.js` garde deux décisions par rôle — qui peut
  créer une tâche pour quelqu'un d'autre (`["super_admin","staff",
  "program_manager","team"]`) et l'exemption du contrôle de groupe pour le
  propriétaire. Ce sont des règles d'écriture à trancher séparément.
- **Affectation** : `assignments.js` admet encore le propriétaire pour accepter
  ou refuser une affectation à la place d'autrui.
