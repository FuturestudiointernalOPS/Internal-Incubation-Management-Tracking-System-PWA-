# Lot 5 — étape 5.3 : les six routes venture sans porte

> Date : 2026-10-20. Les six dernières routes venture qui n'avaient **aucune**
> décision (membre, invitations, historique, lead, cycle de vie, affectations)
> rejoignent le contrôle unifié. Le census ne compte plus **aucun** fichier sur
> l'ancien contrôle.

---

## 1. Les six routes

| Route | Décision |
|---|---|
| `GET /api/ventures/[id]/history` | `requireVentureScopedAccess(ventures.view)` |
| `POST /api/ventures/[id]/lead` | `requireVentureScopedAccess(ventures.edit)` + **lead actuel** (ou propriétaire) |
| `POST /api/ventures/[id]/lifecycle` | `requireVentureScopedAccess(ventures.edit)` + **acteur staff** |
| `GET /api/ventures/[id]/members` | `requireVentureScopedAccess(ventures.view)` |
| `POST/PATCH /api/ventures/[id]/members` | `requireVentureScopedAccess(ventures.edit)` + **fondateur / `founders:manage`** |
| `GET /api/ventures/[id]/member-invitations` | `requireVentureScopedAccess(ventures.view)` |
| `DELETE /api/ventures/[id]/member-invitations` | `requireVentureScopedAccess(ventures.edit)` + **fondateur / `founders:manage`** |
| `GET/POST/PATCH /api/ventures/[id]/staff-assignments` | `permissions.assign_groups` |

### Pourquoi ces règles plus étroites sont conservées

Le contrôle venture complet autorise toute personne dans le périmètre
`venture_own` qui porte la capacité. Pour trois surfaces, la règle métier est
**plus étroite** et reste un second contrôle, nommé :

- **Cycle de vie** (`pause` / `resume` / `archive`) est un instrument staff :
  `isStaffActorForVenture` exige une affectation explicite, donc un fondateur ne
  peut pas archiver sa propre venture.
- **Roster** : `checkVentureMemberMutateAccess` exige un fondateur, ou une
  affectation qui porte `founders:manage` (Lead Manager, pas Coach). D-7 donne
  `ventures.edit` à tout membre ; le second contrôle empêche un simple membre
  d'équipe de gérer le roster.
- **Lead** : au-delà du propriétaire, seul le **lead actuel** peut transmettre le
  lead. (L'ancien code exigeait une affectation pour staff/PM **puis** le lead
  actuel — la règle effective était donc « propriétaire ou lead actuel » ; elle
  est conservée à l'identique.)

`staff-assignments` n'est pas une décision venture mais une **opération de
plateforme** : `permissions.assign_groups`, le même droit que les équipes et les
affectations de facilitateurs. Aucun profil standard ne le porte.

---

## 2. Compteurs

| Indicateur | Avant 5.3 | Après 5.3 |
|---|---:|---:|
| Appels au contrôle venture complet | 104 | **112** |
| Ancien contrôle d'appartenance | 0 | **0** |
| Fichiers sur le nouveau système (census) | 59 | **64** |
| Fichiers sur l'ancien contrôle (census) | 6 | **0** |
| Actions en dette | 66 | **60** |
| Actions sans capacité (liste de travail) | 131 | **125** |
| dont à protéger | 93 | **87** |
| Comparaisons de rôle hors moteur (lignes) | 350 | **346** |
| Exceptions figées du garde-fou rôles | 209 | **206** |
| Exceptions figées du garde-fou étendu | 24 | **23** |
| Nouvelles occurrences non listées / périmées | 0 / 0 | **0 / 0** |

---

## 3. Effet sur les accès

Aucun retrait. Chaque porte remplace une règle qui décidait déjà la même chose :

- l'historique et le roster en lecture : propriétaire, membre actif ou
  affectation active (identique au contrôle inline) ;
- les écritures : mêmes conditions, avec le second contrôle métier conservé ;
- `staff-assignments` : propriétaire uniquement (aucun profil ne porte
  `permissions.assign_groups`).

---

## 4. Tests

- `ventures/lifecycle`, `ventures/member-invitations`,
  `ventures/member-invite-api`, `ventures/access-read`,
  `ventures/venture-bugfix-reads` → 62 tests verts.
- `ventures/member-invite-api` : le faux garde scoped remplace les faux
  `checkVentureMemberViewAccess` ; le refus « sans accès en lecture » passe par
  la réponse du garde.
- Ensemble `venture*` : **79 suites / 900 tests verts**, aux **7 suites
  préexistantes près** (13 tests, inchangées).
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les routes venture → 0 erreur.

---

## 5. Retour arrière

`git revert`. Aucune écriture en base.

---

## 6. Compte rendu

```
LOT 5 — Un seul contrôle venture — étape 5.3 (routes sans porte)
Fait :
  - 6 routes venture reçoivent la décision qui leur manquait
  - les règles métier plus étroites (cycle de vie, roster, lead) restent
    des seconds contrôles nommés
  - staff-assignments passe à permissions.assign_groups
Compteurs :
  - contrôle complet : 104 -> 112
  - census legacy : 6 -> 0 fichier
  - dette : 66 -> 60 ; liste de travail : 131 -> 125
  - comparaisons de rôle : 350 -> 346
  - exceptions figées : 209 -> 206 (étendues 24 -> 23)
  - accès retirés pour une personne réelle : 0
Divergences : aucune ; chaque règle est reproduite à l'identique.
Tests ajoutés / passants : 62 tests ciblés + 79 suites venture (900) + 54 authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : Lot 6 — écriture atomique profil + droits, puis Lot 7
  (projection unique pour l'interface), Lot 8 (chemins morts).
```
