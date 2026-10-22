# Lot 5 — étape 5.2 : un seul contrôle venture (les écritures)

> Date : 2026-10-20. **D-7 = option A** : le profil `venture_member` reçoit
> `ventures.edit`. Les 18 écritures et les 2 lectures historiques rejoignent le
> contrôle venture complet. **L'ancien contrôle d'appartenance n'a plus aucun
> appelant.**

---

## 1. D-7 — le droit d'écriture venture

| Profil | Avant | Après |
|---|---|---|
| `venture_member` (défaut du rôle `member`) | `ventures.view` | `ventures.view`, **`ventures.edit` (niveau 3)** |

Deux écritures, pour deux bases différentes :

1. **Le seed** (`PROFILE_CATALOGUE_SEED`) : une base neuve naît avec le droit.
2. **Une migration one-shot** (`venture-member-edit-v1`,
   `ensureVentureMemberEditBackfill`) : une base déjà semée reçoit le droit.
   `ON CONFLICT DO NOTHING` — un niveau choisi par un administrateur n'est jamais
   écrasé.

Le droit est borné par le périmètre `venture_own` : un membre écrit dans **ses**
ventures, et nulle part ailleurs. C'est exactement ce que faisait l'ancien
contrôle d'appartenance, sans capacité.

---

## 2. Les 18 écritures migrées

Chacune passe de `requireVentureAccess(id)` à
`requireVentureScopedAccess({ ventureId: id, module: "ventures", capability: "edit" })`.

| Surface | Méthodes |
|---|---|
| `advisors` | POST, PATCH |
| `coaching` | POST, PATCH |
| `deliverables` | PATCH (`action: submit`) |
| `deliverables/upload` | POST |
| `documents` | POST |
| `documents/[docId]/permissions` | PATCH |
| `documents/[docId]/reviews` | POST |
| `documents/[docId]/transition` | PATCH |
| `documents/[docId]/versions` | POST |
| `feedback` | POST |
| `fundraising` | POST |
| `investment` | POST |
| `investors` | POST |
| `sessions/upload` | POST |
| `tasks/[taskId]/submissions` | POST |
| `verification/upload` | POST |

---

## 3. Les 2 lectures historiques (D1)

`GET /api/ventures/[id]/documents` et `GET /api/ventures/[id]/reports` portent la
consultation en lecture seule d'un ancien gestionnaire. Ils passent au garde
unifié **avec** le repli historique :

1. le verdict est calculé par le contrôle complet (`ventures.view` + périmètre) ;
2. s'il refuse avec un **403**, et seulement dans ce cas, la consultation
   historique est tentée (`hasHistoricalVentureAccess`) ;
3. sinon la réponse du garde est renvoyée telle quelle.

Un 401 ou une panne système ne déclenche **jamais** le repli : l'échec reste un
échec (refus par défaut). Le repli ne donne que la lecture — aucune écriture ne
l'atteint.

---

## 4. Nettoyage

- Les imports `requireVentureAccess` / `ventureAccessRefusal` ont disparu des
  routes venture (plus aucun appelant).
- Une constante de rôles morte (`REVIEWER_ROLES`) a été retirée d'une route
  touchée.
- Le census (`node scripts/authz-venture-coverage.mjs`) passe de **12** à **6**
  fichiers encore classés « ancien contrôle » — et ces 6 ne sont pas des appels
  à l'ancien contrôle : ce sont des routes qui n'ont **aucune** porte venture
  (`history`, `lead`, `lifecycle`, `member-invitations`, `members`,
  `staff-assignments`), un travail distinct.

---

## 5. Compteurs

| Indicateur | Avant 5.2 | Après 5.2 |
|---|---:|---:|
| Appels au contrôle venture complet | 84 | **104** |
| Appels à l'ancien contrôle d'appartenance | 20 | **0** |
| Fichiers sur le nouveau système (census) | 53 | **59** |
| Fichiers encore sur l'ancien contrôle (census) | 12 | **6** (aucune porte) |
| Actions en dette | 69 | **66** |
| Actions sans capacité (liste de travail) | 134 | **131** |
| dont « à vérifier — décision déléguée » | 6 | **3** |
| Exceptions figées du garde-fou étendu | 41 | **24** |
| Nouvelles occurrences non listées / périmées | 0 / 0 | **0 / 0** |

---

## 6. Tests

- `venture*` : **79 suites / 900 tests verts**, aux **7 suites préexistantes
  près** (13 tests, inchangées).
- `profile-catalogue-seed`, `authorization-resolver.core`,
  `authorization-resolver.modules`, `permissions-spec-scenarios`,
  `action-declarations` → 94 tests verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les routes venture → 0 erreur.

---

## 7. Retour arrière

`git revert`. La migration est insert-only et réversible par une suppression de
la ligne `profile_capabilities` ; aucune autre écriture en base.

---

## 8. Compte rendu

```
LOT 5 — Un seul contrôle venture — étape 5.2 (écritures)
Fait :
  - D-7 A : `ventures.edit` ajouté au profil venture_member (seed + migration)
  - 16 routes d'écriture (18 handlers) passent à capacité + périmètre
  - 2 lectures historiques gardent D1, avec repli limité aux 403
  - imports et constante de rôles morts retirés
Compteurs :
  - contrôle complet : 84 -> 104
  - ancien contrôle : 20 -> 0
  - dette : 69 -> 66 ; liste de travail : 134 -> 131
  - exceptions étendues : 41 -> 24
  - accès retirés pour une personne réelle : 0 (D-7 préserve le comportement)
Divergences : aucune sur les écritures après D-7 ; le périmètre reste `venture_own`.
Tests ajoutés / passants : 79 suites / 900 tests venture verts + 94 tests
  profil/résolveur + 54 tests authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : les 6 routes venture sans porte (history, lead, lifecycle,
  member-invitations, members, staff-assignments), puis les lots 6 à 8.
```
