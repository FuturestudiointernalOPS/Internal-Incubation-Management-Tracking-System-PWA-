# Étape 10 — les dernières gardes d'écriture passent au droit

Statut : **implémenté le 2026-11-13, vérifié en staging**. Un droit ajouté
(`projects.moderate`), un autre élargi dans son sens (`tasks.moderate`), et
`tasks.create` désormais utilisé. `authz:doctor` répond **OK**.

## Ce qui restait

Six gardes d'écriture décidaient encore par le nom du rôle. Elles se ramenaient à
deux pouvoirs, que le rôle ne pouvait pas distinguer :

| Garde | Comportement d'avant |
|---|---|
| `create.js` — créer une tâche pour quelqu'un d'autre | rôle dans `super_admin / staff / program_manager / team` |
| `create.js` — échapper au contrôle de groupe à l'affectation | propriétaire seul |
| `assignments.js` — réassigner l'affectation d'autrui | propriétaire seul |
| `assignments.js` — échapper au contrôle de groupe à la réassignation | propriétaire seul |
| `updateGuards.js` — modifier une tâche d'autrui, déplacer son statut | propriétaire seul |
| `updateFields/assignment.js` — changer l'assigné d'une tâche d'autrui | propriétaire seul |
| `updateEffects.js` — la règle « propriétaire strict » après écriture | propriétaire seul |
| `projects/collaboration.js` — annuler l'invitation d'autrui | propriétaire seul |

## Les décisions

### `tasks.create` — créer pour quelqu'un d'autre

Le droit existait dans le catalogue mais n'était utilisé nulle part. Il porte
maintenant cette règle, et il est accordé au profil **personnel interne** :
la cohorte qui pouvait déjà créer pour autrui le conserve.

Un compte **`team`** est une identité d'entité (pas une personne, pas de profil) :
il garde explicitement la capacité, comme dans `teamBoard.js`. C'est une
exception documentée, pas un droit.

### `tasks.moderate` — élargi, pas dupliqué

Plutôt que d'inventer un droit par action, le droit de modération créé à l'étape
8 couvre désormais toutes les dérogations « propriétaire » du domaine tâches :
modifier une tâche d'autrui, déplacer son statut, la réassigner, contourner le
contrôle de groupe, et toujours modérer commentaires et blockers.

Description mise à jour en conséquence. Il reste **porté par le propriétaire
seul** : comportement inchangé, et désormais accordable.

### `projects.moderate` — annuler l'invitation d'autrui

Nouveau droit, propriétaire seul. `projects.delete` aurait été trompeur
(supprimer un projet n'est pas annuler une invitation) et `projects.view_all`
est une lecture.

## ⚠️ Effet à connaître : la porte du compte s'applique enfin

`tasks.create` passe par le moteur, qui applique la **porte du compte**
(`contacts.status`). En staging, **5 comptes du personnel** gagnent le droit
(parité), et **1 compte** est refusé par le moteur avec
`account_not_active` : auparavant la liste de rôles le laissait créer pour
autrui sans consulter son statut.

C'est la règle voulue (spec §11 : un compte inactif est refusé **avant** le
droit), pas une perte d'accès légitime. Si ce compte doit pouvoir agir, la
correction est une donnée : réactiver le contact.

## Vérification

- `authz:doctor` : **OK**. Deux lignes appliquées
  (`super_admin_default.projects.moderate`, `staff_default.tasks.create`).
- Photographie de référence : **5 changements, 0 régression**, et les 5 sont le
  même : `tasks.create` accordé aux comptes du personnel (voir ci-dessus).
- `npm run test:authz` : **28 suites / 320 tests**.
- Le ratchet de rôles a **perdu cinq exceptions** (`projects/collaboration`,
  `tasks/assignments`, `tasks/create#M4`, `tasks/updateEffects`,
  `tasks/updateFields/assignment`, `tasks/updateGuards`).
- ESLint : 0 erreur. `npm run build` : succès.

## Ce qui reste lu par un rôle, volontairement

- `tasks/teamBoard.js` — `session.role === "team"` : une **identité d'entité**,
  pas un droit.
- `create.js` — le compte `team` garde la création pour autrui, pour la même
  raison.
