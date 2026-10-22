# Lot 2 — étape 2.2 : une seule forme de refus, traduite

> Date : 2026-10-20. Objectif : tout refus d'authentification ou d'autorisation
> sort par le même constructeur, avec un **code** traduit, jamais une phrase
> anglaise en dur.

---

## 1. Un seul constructeur

`src/server/http/refusal.js` :

```js
refusalResponse({ status, errorKey, missing?, decision? })
```

- corps stable : `{ success: false, error: "<clé>" }` ;
- `missing` ajoute la capacité ou le périmètre manquant ;
- `decision` ajoute l'en-tête de diagnostic `X-Authz-Decision`.

Aucune route ni aucun service ne construit plus son propre JSON de refus.

Migrés vers ce constructeur :

| Fichier | Rôle |
|---|---|
| `src/server/auth/guards.js` | session obligatoire |
| `src/server/authz/guards.js` | gardes de ressource |
| `src/server/authz/responses.js` | traduction décision → HTTP |
| `src/lib/programScopedAccess.js` | périmètre programme |
| `src/lib/ventureScopedAccess.js` | périmètre venture |

---

## 2. Un seul vocabulaire de refus

Les refus sont des clés `errors.*`, présentes dans **les deux** locales.

| Famille | Exemples de clés |
|---|---|
| Session | `errors.authRequired`, `errors.invalidCredentials` |
| Compte | `errors.accountInactive`, `errors.accountPendingApproval`, `errors.accountArchived` |
| Capacité | `errors.insufficientPermissions`, `errors.forbidden` |
| Périmètre | `errors.outsideAssignedScope`, `errors.notEnrolledInProgram` |
| Propriété | `errors.notOwner`, `errors.notAuthor`, `errors.notAssignee`, `errors.notInviter` |
| Portée personnelle | `errors.ownTasksOnly`, `errors.ownSubmissionsOnly`, `errors.ownReportsOnly` |
| Tâches | `errors.taskAccessDenied`, `errors.taskLockedDelete`, `errors.taskStatusCreatorOrAssignee` |
| Ventures | `errors.ventureStaffOnly`, `errors.ventureManagerOnly`, `errors.foundersOnly` |
| Intents | `errors.intentAccessDenied`, `errors.intentTaskAddDenied` |
| Administration | `errors.cannotChangeOwnAccess`, `errors.cannotChangeOwnProfile` |

`src/locales/en/errors.json` et `src/locales/fr/errors.json` comptent **138 clés
chacun**, sans écart entre les deux fichiers.

---

## 3. Périmètre exact de l'étape

Cette étape convertit **les refus d'authentification et d'autorisation**
(HTTP 401 et 403, y compris les blocs `denied`). Elle ne touche pas :

- les messages de validation (400) ;
- les messages « ressource introuvable » (404) : ils relèvent de l'étape 2.3
  (D-6 — raison réelle ou anti-énumération) ;
- les signaux serveur-à-serveur qui ne s'affichent jamais : signatures du
  fournisseur d'e-mail et secrets de tâches planifiées.

Ces exceptions sont nommées explicitement dans le test.

---

## 4. Garde-fou

Nouveau test dans `src/__tests__/authz-refusal-response.test.js` :

- un refus 401/403 ne peut plus être une phrase anglaise ;
- `Authentication required.` et `Not authenticated` ne peuvent plus réapparaître ;
- les quatre fichiers techniques autorisés sont listés, avec leur justification.

Le test échoue si une nouvelle phrase anglaise apparaît dans un refus
d'autorisation.

---

## 5. Compteurs

| Indicateur | Avant 2.2 | Après 2.2 |
|---|---:|---:|
| Refus 401/403 en anglais (occurrences) | **297** | **0** |
| Fichiers concernés | **172** | **0** |
| Constructeurs de refus JSON distincts | 5+ | **1** |
| Clés `errors.*` (EN / FR) | 41 / 41 | **138 / 138** |
| Tests de la suite `authz-refusal-response` | 0 | **10** |

Mesure : même compteur textuel exécuté sur `HEAD` puis sur l'arbre courant ;
fenêtre de ±6 lignes autour du statut, les 4 fichiers techniques exclus.

---

## 6. Tests

- `npx jest src/__tests__/authz-refusal-response.test.js` → **10 tests verts**
- `npm run test:authz` → **7 suites, 54 tests verts**
- Suites ciblées : tâches, ventures, communications, annonces, participant,
  connexion, sécurité lot 1 → lot 14 → **1284 tests verts**
- 7 suites venture échouent **déjà sur `HEAD`** (mocks de requêtes et appels
  `db.execute`), vérifié dans un worktree propre : sans rapport avec cette étape.
- `npm run lint` → **0 erreur**, 261 avertissements préexistants
- `npm run authz:metrics:check` → **cliquet respecté**

---

## 7. Retour arrière

`git revert` du commit. Aucune écriture en base, aucune migration.

---

## 8. Compte rendu

```
LOT 2 — Une seule décision, une seule forme de refus — étape 2.2
Fait :
  - constructeur unique refusalResponse (corps + en-tête de diagnostic)
  - 5 gardes migrés vers ce constructeur
  - 297 refus anglais remplacés par des clés errors.* traduites EN/FR
  - clés ajoutées aux deux locales (138 chacune, parité vérifiée)
  - garde-fou automatique contre le retour des phrases anglaises
Compteurs :
  - refus 401/403 en anglais : 297 → 0
  - fichiers concernés : 172 → 0
  - constructeurs de refus : 5+ → 1
Tests ajoutés / passants : 10 nouveaux ; 1284 verts sur le périmètre élargi.
Décisions requises : D-6 (404 « introuvable » vs raison réelle) avant l'étape 2.3.
Retour arrière : git revert.
Prochaine étape : étape 2.3 (refus honnêtes) après validation de D-6, puis 2.4
  (point d'entrée unifié, D-3).
```
