# Lot 4 — étape 4.2, lot 5/7 : surfaces programme

> Date : 2026-10-20. Neuf routes du programme (planning, soumissions, KPI,
> modèles de parcours, assignation de groupe, types standard) passent à une
> capacité ; trois déclarent une décision déléguée. Une route couple enfin
> capacité **et** périmètre.

---

## 1. Les actions migrées

| Action | Avant | Après |
|---|---|---|
| `GET /api/pm/schedule` | `staff`, `program_manager`, `super_admin` + `role === "super_admin"` | `programs.view` + prédicat du propriétaire |
| `GET /api/pm/submissions` | idem + `role !== "super_admin"` | `programs.view` + prédicat du propriétaire (garde IDOR conservée) |
| `PATCH /api/pm/programs/assignment` | liste de rôles + `role === "staff"` + `isAssignedPmForProgram` | `requireProgramScope(programs.edit)` — capacité **et** périmètre |
| `GET /api/kpi-progress` | `staff`, `program_manager`, `super_admin` | `programs.view` |
| `POST /api/kpi-progress/recalculate` | idem | `programs.edit` |
| `GET /api/journey-templates` | `staff`, `program_manager`, `super_admin` | `programs.view` |
| `GET /api/superadmin/standard-types` | `const ROLE = super_admin` | `settings.view` |
| `POST` / `DELETE` `/api/superadmin/standard-types` | idem | `settings.edit` |
| `POST /api/superadmin/groups/assignment` | `super_admin` | `permissions.assign_groups` |
| `POST /api/admin/fix-participant` | `super_admin` | `settings.edit` |

### Décisions déléguées déclarées

| Action | Service | Règle |
|---|---|---|
| `GET /api/pm/full-state` | `authorization/programManagement.js` | gestionnaire, PM affecté à **ce** programme, ou facilitateur affecté |
| `GET /api/participant/full-state` | `participant/fullState.js` | `canReadFullState` (soi-même, ou interne pour autrui) |
| `GET/POST /api/participant/submissions` | `participant/submissions.js` | `resolveSubmission(Read|Write)Scope` (soi-même ou son équipe) |

---

## 2. Le couplage capacité + périmètre (première route)

`PATCH /api/pm/programs/assignment` décidait qui peut nommer le gestionnaire
d'un programme. Sa règle était double : une liste de rôles, puis « un staff
seulement s'il est le PM désigné de ce programme ».

Elle passe par le garde unifié : `programs.edit` **et** le périmètre
`program_managed` (le profil gestionnaire, D-4). Justification :

- `programs.edit` est porté par le profil **Staff Default** : la capacité seule
  aurait laissé **tout** staff nommer le PM de n'importe quel programme. Le
  périmètre est ce qui borne le droit.
- La couverture a été vérifiée en lecture seule sur la production avant la
  bascule (`scripts/db-audit/program-manager-profile-coverage.sql`) :
  **0** personne ayant une affectation PM sans le profil actif.

### Effet

| Camp | Avant | Après |
|---|---|---|
| Propriétaire | tout | inchangé (contournement) |
| Gestionnaire du programme | pouvait nommer le PM | inchangé |
| Staff PM désigné, avec profil | pouvait | inchangé |
| Staff sans lien avec le programme | refusé | refusé |
| Gestionnaire d'un **autre** programme | contournait par `role === "program_manager"` | **refusé** |

Le dernier cas est un resserrement assumé : la fonction ne donne plus de droit
sur un programme qu'elle ne gère pas.

---

## 3. Effet sur les autres accès

Aucun retrait. Le profil **Staff Default** porte `programs.view` et
`programs.edit` ; le profil **Program Manager** porte tout `programs.*` ; le
propriétaire contourne. Aucun profil standard ne porte `settings.*` ni
`permissions.assign_groups`, donc les surfaces super-admin restent réservées au
propriétaire.

Les trois décisions déléguées ne changent rien : seul le registre les nomme.

---

## 4. Cas laissés en dette, à dessein

- `GET /api/journey-reports` : portefeuille **global** (toutes ventures),
  réservé au propriétaire par choix documenté. Aucune capacité existante
  n'exprime « propriétaire seulement » ; élargir à `programs.view` ouvrirait la
  vue à tout staff. Reste en dette jusqu'à une capacité dédiée.
- `GET/POST /api/v2/groups`, `/api/v2/program-staff` : en-tête explicite
  « V2 — READ-ONLY here, changes go in V1 counterparts ». Non modifiés.
- `/api/responses`, `/api/responses/review` : retirés (`RETIRED = true`,
  403 systématique) — chemins morts du lot 8.

---

## 5. Compteurs

| Indicateur | Avant le lot 5 | Après le lot 5 |
|---|---:|---:|
| Actions en dette | 122 | **110** |
| Actions sans capacité (liste de travail) | 163 | **154** |
| dont à protéger | 106 | **97** |
| Listes de rôles en dur dans les actions | 85 | **77** |
| Comparaisons de rôle hors moteur (lignes) | 367 | **356** |
| Exceptions figées du garde-fou rôles | 226 | **215** |
| Exceptions figées du garde-fou étendu | 49 | **48** |
| Appels de périmètre programme | 31 | **32** |
| dont vérifiant aussi la capacité | 30 | **31** |
| Nouvelles occurrences non listées / périmées | 0 / 0 | **0 / 0** |

---

## 6. Tests

- `permissions-characterization` : deux assertions super-admin figent désormais
  `permissions.assign_groups` et `settings.view` / `settings.edit`.
- `permissions-static-guards` et `permissions-role-gates-extended` : douze
  exceptions devenues périmées retirées par le cliquet.
- Suites ciblées : `journey-templates`, `kpi-progress`,
  `program-manager-assignment`, `program-scope-coverage`,
  `program-scoped-access`, `program-scope-wiring`, `program-workspace-wiring`,
  `phase5-program-managed-scope`, `security-lot7-program-scope`,
  `phase6-self-scope-participant`, `participant-misc`, `participant-home`,
  `journey-reports-portfolio`, `journey-wiring`,
  `permissions-characterization` → 15 suites / 185 tests verts.
- `npm run test:authz` → 7 suites / 54 tests verts.
- `npm run authz:metrics:check` → cliquet respecté.
- `npm run lint` sur les fichiers modifiés → 0 erreur.

---

## 7. Retour arrière

`git revert`. Aucune écriture en base, aucune migration.

---

## 8. Compte rendu

```
LOT 4 — Un registre déclaratif des actions — étape 4.2, lot 5/7
Fait :
  - 9 routes programme passent d'une liste de rôles à une capacité
  - 3 routes déclarent une décision déléguée
  - 1 route couple capacité et périmètre (requireProgramScope)
  - 2 comparaisons de rôle remplacées par le prédicat d'identité
Compteurs :
  - dette : 122 -> 110
  - liste de travail : 163 -> 154 (à protéger 106 -> 97)
  - listes de rôles : 85 -> 77
  - comparaisons de rôle : 367 -> 356
  - exceptions figées : 226 -> 215 (étendues 49 -> 48)
  - périmètre programme : 31 -> 32 appels, 31 avec capacité
  - accès retirés pour une personne réelle : 0
Divergences : un resserrement assumé — un gestionnaire ne peut plus nommer le
  PM d'un programme qu'il ne gère pas (D-4) ; couverture vérifiée à 0 écart.
Tests ajoutés / passants : 15 suites ciblées (185 tests) + 54 tests authz.
Décisions requises : aucune.
Retour arrière : git revert.
Prochaine étape : lot 6/7 — tâches et blockers (operations), puis les surfaces
  venture (Lot 5).
```
