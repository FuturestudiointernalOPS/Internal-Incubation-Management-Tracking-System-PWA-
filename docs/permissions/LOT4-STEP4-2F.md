# Lot 4 — étape 4.2, lot 6/7 : tâches et blockers

> Date : 2026-10-20. Seize routes « operations » quittent la dette : treize
> déclarent la décision **déléguée** qui existait déjà dans le service, trois
> passent à une capacité. Une route sans aucune décision est corrigée.

---

## 1. Les actions déclarées

| Action | Décision déclarée |
|---|---|
| `GET/POST/PUT/DELETE/PATCH /api/tasks` | `tasks/query.js` — liste bornée à la personne, champs de gestion selon le rôle |
| `POST /api/tasks/assignment-action` | `tasks/assignmentAction.js` — seul l'assigné agit |
| `GET/POST /api/tasks/assignments` | `tasks/assignments.js` — propre assignation, réassignation selon la relation |
| `GET/POST /api/tasks/carryover` | `tasks/carryover.js` — porteur seulement |
| `GET/POST/PUT/DELETE /api/tasks/comments` | `tasks/comments.js` — accès à la tâche + auteur seul |
| `POST /api/tasks/duplicate` | `tasks/duplicate.js` — même accès que la lecture |
| `GET /api/tasks/logs` | `tasks/logs.js` — journal de la tâche |
| `POST /api/tasks/reconcile` | `tasks/reconcile.js` — personne concernée, états autorisés |
| `POST/DELETE /api/tasks/resources` | `tasks/resources.js` — accès à la tâche |
| `GET/POST/PUT/DELETE /api/blockers` | `tasks/blockers.js` — blockers des tâches accessibles |
| `GET/POST /api/blockers/discuss` | `tasks/blockers.js` — **voir §2** |
| `GET /api/standups/current` | `tasks/weeklyReports.js` — soi-même, superviseur, propriétaire |
| `GET /api/retros/current` | `tasks/weeklyReports.js` — idem |

Ces routes ne reçoivent pas de capacité inventée : la question posée est « est-ce
**votre** tâche ? », qui dépend du propriétaire, de l'assigné et du superviseur
de la cible. La règle vit déjà dans `@/services/tasks/*` ; le registre la nomme.

### Capacités explicites

| Action | Avant | Après |
|---|---|---|
| `POST /api/tasks/approve` | `requireAuth(["super_admin"])` | `tasks.edit` |
| `GET /api/admin/tasks` | `createHandler({ roles: ["super_admin"] })` | `tasks.view` |
| `GET /api/admin/blockers` | idem | `tasks.view` |

Aucun profil standard ne porte `tasks.*` : le propriétaire de la plateforme reste
seul à les exercer, mais le droit est désormais attribuable sans changer le code.

---

## 2. Une route qui n'avait aucune décision

`/api/blockers/discuss` était ouverte à **toute session** : n'importe quel
compte authentifié lisait les messages d'un blocker en changeant son identifiant,
et le message était attribué au `sender_id` **fourni par le client** — une
usurpation triviale.

Correction (trou de sécurité « nulle part », conforme au principe du plan) :

- une discussion est une sous-ressource de la tâche : elle suit désormais
  `canAccessTask` (rôles portefeuille, ou porteur / assigné / superviseur) ;
- l'auteur est `session.cid`, jamais le corps de la requête ;
- un blocker inexistant répond 404, un appelant hors périmètre 403.

Effet réel : **aucun changement** pour staff, gestionnaire et propriétaire
(`seesWholePortfolio`), qui voyaient déjà tout. Un participant ou un membre qui
n'est pas sur la tâche perd un accès qu'il n'aurait jamais dû avoir.

---

## 3. Une règle recopiée, ramenée à un seul endroit

Les standups et les rétros portaient **deux copies** de la même condition
(`role !== "super_admin"` + `isSupervisorOf`). Elle vit maintenant dans
`services/tasks/weeklyReports.js`, qui passe par le vocabulaire d'identité. Les
deux écrans ne peuvent plus diverger, et le comportement est identique.

---

## 4. Compteurs

| Indicateur | Avant le lot 6 | Après le lot 6 |
|---|---:|---:|
| Actions en dette | 110 | **94** |
| Actions sans capacité (liste de travail) | 154 | **151** |
| dont à protéger | 97 | **94** |
| Listes de rôles en dur dans les actions | 77 | **74** |
| Comparaisons de rôle hors moteur (lignes) | 356 | **351** |
| Exceptions figées du garde-fou rôles | 215 | **210** |
| Exceptions figées du garde-fou étendu | 48 | **48** |
| Nouvelles occurrences non listées / périmées | 0 / 0 | **0 / 0** |

---

## 5. Tests

- `blockers-api` : deux tests ajoutés — l'auteur est la session (pas le corps)
  et un appelant hors périmètre est refusé sans écriture.
- `tasks-actions-api` : la couche d'autorisation est simulée (les tests
  caractérisent les statuts et les écritures, pas la capacité).
- `permissions-characterization` : `admin/tasks` et `admin/blockers` figent
  `tasks.view` ; `admin/finance/data-sources` reste sur sa liste.
- `permissions-static-guards` : cinq exceptions devenues périmées retirées.
- Suites ciblées : `blockers-api`, `tasks-api`, `tasks-api.safety`,
  `tasks-actions-api`, `tasks-create-api`, `tasks-mutations-api`,
  `tasks-query-api`, `tasks-subresources-api`, `tasks-update-api`,
  `security-lot10-tasks-contacts`, `permissions-characterization`
  → 11 suites / 179 tests verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 6. Retour arrière

`git revert`. Aucune écriture en base, aucune migration.

---

## 7. Compte rendu

```
LOT 4 — Un registre déclaratif des actions — étape 4.2, lot 6/7
Fait :
  - 13 routes tâches/blockers déclarent leur décision déléguée
  - 3 routes admin passent à tasks.view / tasks.edit
  - une règle de visibilité recopiée ramenée dans un service unique
  - /api/blockers/discuss reçoit la règle d'accès de la tâche et prend
    l'auteur dans la session (correction d'usurpation)
Compteurs :
  - dette : 110 -> 94
  - liste de travail : 154 -> 151 (à protéger 97 -> 94)
  - listes de rôles : 77 -> 74
  - comparaisons de rôle : 356 -> 351
  - exceptions figées : 215 -> 210
  - accès retirés pour une personne réelle : 0 (portefeuille inchangé)
Divergences : la discussion d'un blocker n'est plus lisible par un compte hors
  tâche ; l'auteur ne peut plus être usurpé. Deux autres écarts corrigés
  (voir §2).
Tests ajoutés / passants : 11 suites ciblées (179 tests) + 54 tests authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : lot 7/7 — projets et invitations, puis Lot 5 (un seul contrôle
  venture, 38 appels).
```
