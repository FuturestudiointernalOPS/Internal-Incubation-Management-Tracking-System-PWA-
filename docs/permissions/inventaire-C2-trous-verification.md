# Inventaire C2 — Vérification des 3 trous de portée déclarés corrigés

Objet : pour chacun des 3 trous listés dans
`docs/permissions/inventaire-C-portees.md` §3, établir **(1) le correctif réel**,
**(2) le test de régression existant**, **(3) le résultat d'exécution réel**.

Mode : **lecture seule** (aucun fichier de code modifié). Seule l'exécution de suites
de tests ciblées a été autorisée et réalisée.

Convention de preuve : « corrigé » = le code de refus existe à l'endroit indiqué ;
« test trouvé » = une assertion automatisée échoue si le refus est retiré ;
« résultat » = sortie réellement observée d'une commande exécutée (jamais déduite).

---

## (a) Portée d'équipe vide en notation de soumissions

Refus quand un facilitateur n'a **aucune équipe assignée** dans le programme :
notation `PATCH /api/submissions` ; lecture `GET /api/submissions` (chemin jumeau).

### Correctif

| Élément | Fichier:ligne | Extrait / condition |
|---|---|---|
| Route PATCH (point d'appel) | `src/app/api/submissions/route.js:97-109` | `const inScope = await isSubmissionWithinFacilitatorScope({ id, sessionCid: session.cid, programId }); if (!inScope) { … 403 }` |
| Helper de décision (notation) | `src/services/ventures/submissions/review.js:33-41` | `const scope = await getFacilitatorTeamScope(programId, sessionCid); if (scope.scope !== "all") { if (scope.teamIds.length === 0) return false; … }` |
| Helper de décision (lecture, jumeau) | `src/services/ventures/submissions/scope.js:60-61` | `if (scope.scope === "all") return { facScopeFilter: null, facScopeArgs: [] }; if (scope.teamIds.length === 0) return { empty: true };` |

Condition appliquée : dès que la portée n'est pas `"all"` **et** que la liste d'équipes
est vide, la fonction renvoie `false` → `403` (notation) / `{ empty: true }` → liste
vide (lecture). C'est un **refus fail-closed** sur liste vide. La correction consiste à
avoir retiré le garde fail-open `length > 0 &&` : l'ancien code sautait le contrôle
quand `teamIds` était vide, laissant noter toute soumission du programme.

### Test de régression

Fichier : `src/__tests__/authz-scope-enforcement.test.js`

| Test (ligne) | Nom | Assertion clé |
|---|---|---|
| L141-151 | « an assigned facilitator with NO teams cannot grade (403, no record check skipped) » | `getFacilitatorTeamScope` → `{ scope: "none", teamIds: [] }` ; attend `res.status === 403` **et** `checkSubmissionInFacilitatorTeamScope` **non appelé** |
| L153-161 | « a facilitator with teams is still checked against them » | `{ scope: "teams", teamIds: ["T1","T2"] }` ; attend `checkSubmissionInFacilitatorTeamScope` appelé avec `(9, ["T1","T2"])` |

Ce test exerce le **vrai** helper `review.js` (le service n'est pas mocké ; seul le
modèle `@/models/authorization/accessQueries` l'est), donc la branche
`teamIds.length === 0 → return false` est réellement exécutée.

### Résultat d'exécution réel

Commande : `npx jest src/__tests__/authz-scope-enforcement.test.js --runInBand`

```
PASS  src/__tests__/authz-scope-enforcement.test.js
  PATCH /api/submissions — empty team scope must deny
    ✓ an assigned facilitator with NO teams cannot grade (403, no record check skipped)
    ✓ a facilitator with teams is still checked against them
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total
```

**Verdict (a) : corrigé OUI — test trouvé OUI — résultat PASS.**

---

## (b) Présences groupées vers un programme non autorisé

Écriture `POST /api/attendance` : la porte d'autorisation était décidée sur le
`program_id` du **premier** enregistrement, alors que chaque ligne insère son propre
`program_id` — un lot pouvait donc écrire hors du périmètre vérifié.

### Correctif

| Élément | Fichier:ligne | Extrait / condition |
|---|---|---|
| Route (point d'appel) | `src/app/api/attendance/route.js:66-76` | `if (findForeignAttendanceRecord(records, programId)) { return NextResponse.json({ success: false, error: "errors.insufficientPermissions" }, { status: 403 }); }` |
| Helper de décision | `src/services/operations/attendance.js:86-91` | `return records.find((record) => record?.program_id && String(record.program_id) !== String(programId));` |

Condition appliquée : si **un seul** enregistrement du lot porte un `program_id`
différent de celui autorisé, le lot entier est refusé (`403`) **avant toute écriture**
(le contrôle est placé avant `writeAttendanceRecords`).

### Test de régression

| Fichier:ligne | Nom | Assertion clé |
|---|---|---|
| `src/__tests__/authz-scope-enforcement.test.js:213-227` | « a batch carrying a foreign program_id is refused before any write » | lot `[P1, OTHER]`, `getFacilitatorTeamScope → { scope: "all" }` ; attend `res.status === 403` et `insertAttendanceMark` **non appelé** |
| `src/__tests__/attendance-api.test.js:70-79` | « a batch carrying a foreign program_id is refused before any write » | même scénario ; attend `403` et `insertAttendanceMark` non appelé |

Le helper réel `findForeignAttendanceRecord` est exécuté (seul le modèle
`@/models/facilitation` est mocké dans ces suites).

### Résultat d'exécution réel

Commande : `npx jest src/__tests__/authz-scope-enforcement.test.js --runInBand` (le test
b est inclus dans le `PASS` ci-dessus, ligne `POST /api/attendance …`).

Commande : `npx jest src/__tests__/attendance-api.test.js --runInBand`

```
PASS  src/__tests__/attendance-api.test.js
  POST /api/attendance — batch program binding
    ✓ a batch carrying a foreign program_id is refused before any write
    ✓ a non-management batch without a program is refused (403)
  POST /api/attendance — facilitator team scope
    ✓ participants outside the facilitator's teams are silently dropped
    ✓ a facilitator with no team writes nothing
  POST /api/attendance — today window
    ✓ a non-manager cannot record a far-past date (400)
    ✓ a super admin may backfill an old date
    ✓ an empty status clears the mark without inserting
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

**Verdict (b) : corrigé OUI — test trouvé OUI — résultat PASS.**

---

## (c) Calendrier dérivé du libellé de rôle

`GET /api/calendar` : la portée programme était indexée sur le libellé de rôle
plateforme (`role === 'facilitator'`). Depuis que prendre une affectation de
facilitation ne mute plus `contacts.role`, un `member` agissant comme facilitateur
tombait dans « aucune restriction » et lisait tous les programmes (fail-open lecteur).
La portée est désormais dérivée des **relations** (affectation facilitateur ∪
enrôlement participant), et une portée vide reste vide (sentinelle).

### Correctif

| Élément | Fichier:ligne | Extrait / condition |
|---|---|---|
| Route (délégation) | `src/app/api/calendar/route.js:49-52` | `const { programScopeSql, programTableScopeSql, programScopeArgs } = await resolveCalendarProgramScope(sessionCid, session?.role);` |
| Service (décision) | `src/services/workspace/calendar.js:84-113` | `if (!sessionCid || PROGRAM_UNSCOPED_ROLES.includes(role)) return none;` puis `programIdSet` = `getFacilitatorProgramScopePids` ∪ `getParticipantProgramScopePids` ; `const scopedProgramIds = programIdSet.size ? [...programIdSet] : ["__no_program_scope__"];` |

Condition appliquée : seuls les rôles privilégiés (`super_admin`, `staff`,
`program_manager`, `team`) restent non filtrés ; **tout autre rôle** est restreint aux
programmes réellement liés, et une liste vide donne la sentinelle
`"__no_program_scope__"` (qui ne peut correspondre à aucun programme réel) → **refus
fail-closed**, plus de retombée sur « tout ».

### Test de régression

| Fichier:ligne | Nom | Assertion clé |
|---|---|---|
| `src/__tests__/authz-scope-enforcement.test.js:165-177` | « a member acting as a facilitator is scoped to the assigned programs » | rôle `member`, `getFacilitatorProgramScopePids → [{ pid: "P-A" }]` ; attend `getCalendarPrograms` appelé avec `AND CAST(id AS TEXT) IN (?)` et `["P-A"]` |
| `src/__tests__/authz-scope-enforcement.test.js:179-185` | « a contextual caller with no relationship sees no program-scoped events » | attend `getCalendarPrograms` appelé avec `["__no_program_scope__"]` |
| `src/__tests__/authz-scope-enforcement.test.js:187-194` | « management keeps the unrestricted view » | rôle `program_manager` ; attend `getCalendarPrograms` appelé avec `""`, `[]` |
| `src/__tests__/workspace-calendar.test.js:65-74` | « fails CLOSED when the caller has no program relationship » | rôle `member`, listes vides ; attend `scopedProgramIds === ["__no_program_scope__"]` |
| `src/__tests__/workspace-calendar.test.js:49-63` | « scopes a participant to their assigned and enrolled programs » | attend l'union `{"1","2"}` et les fragments SQL avec `(?,?)` |
| `src/__tests__/workspace-calendar.test.js:38-47` | « leaves the privileged platform roles unscoped » | rôle `staff` ; attend `scopedProgramIds === null` et modèle non interrogé |

### Résultat d'exécution réel

Commande : `npx jest src/__tests__/authz-scope-enforcement.test.js --runInBand` (les
tests c y figurent dans le `PASS` ci-dessus, section `GET /api/calendar …`).

Commande : `npx jest src/__tests__/workspace-calendar.test.js --runInBand`

```
PASS  src/__tests__/workspace-calendar.test.js
  resolveCalendarProgramScope
    ✓ leaves the privileged platform roles unscoped
    ✓ scopes a participant to their assigned and enrolled programs
    ✓ fails CLOSED when the caller has no program relationship
    ✓ leaves an anonymous caller unscoped
  resolveCalendarFollowupVisibility
    ✓ shows a participant only their own follow-ups
    ✓ shows a super admin everything
    ✓ restricts everyone else to what they created, keeping legacy rows
    ✓ is unscoped without a session
  resolveCalendarVentureScope
    ✓ grants a privileged role every Venture outside personal mode
    ✓ restricts a privileged role to its own Ventures in personal mode
    ✓ keeps an empty scope empty for a non-privileged caller
Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
```

**Verdict (c) : corrigé OUI — test trouvé OUI — résultat PASS.**

---

## Suites suggérées examinées et écartées

| Suite | Portée réelle | Couvre un des 3 trous ? |
|---|---|---|
| `src/__tests__/program-scoped-access.test.js` | Moteur générique `requireProgramScope` / `requireProgramScopeForAll` (enforcement inconditionnel, id manquant = refus, échec infra = 500) | **Non** |
| `src/__tests__/program-scope-wiring.test.js` | Aucune correspondance sur submissions / attendance / calendar / facilitator / foreign | **Non** |

Aucun test unitaire direct sur `isSubmissionWithinFacilitatorScope` ni sur
`findForeignAttendanceRecord` (recherche de texte : aucune correspondance dans
`src/__tests__/**`). Ces helpers ne sont couverts **qu'indirectement**, via les routes
qui les appellent.

---

## Ce que ces tests prouvent — et ce qu'ils ne prouvent pas

Ces suites **mockent la base de données** :
`@/lib/db` (retourne `{ rows: [] }`), les modèles (`@/models/forms`,
`@/models/facilitation`, `@/models/workspace`, `@/models/authorization/accessQueries`)
et les gardes d'authentification/affectation (`requireAuth`,
`requireAssignmentAccess` → `null`). Les décisions de service/route réelles sont, elles,
exécutées.

**Prouvé** :
- Que la logique de décision (liste d'équipes vide → refus ; lot hétérogène → refus ;
  absence de relation → sentinelle vide) s'exécute dans le code réel et produit le
  statut HTTP / la valeur attendue.
- Que le paramétrage passé aux couches de lecture (filtres SQL et arguments) est bien
  celui qui restreint la portée.

**Non prouvé** :
- La validité du **SQL** réellement émis et de son exécution contre le schéma/données
  de production (les modèles sont des `jest.fn` qui ne compilent rien).
- Le comportement de `getFacilitatorTeamScope` / des modèles de portée en conditions
  réelles (invariant `"teams" ⇔ teamIds non vide`, contenu réel des tables
  d'affectation, `venture_members`, etc.).
- L'absence de **contournement** par une autre route ou un autre chemin non couvert.

---

## Incertitudes

1. **Aucune substitution à la production test.** Ces trois `PASS` sont des tests
   unitaires à base mockée ; ils ne remplacent pas `docs/PRODUCTION_TEST.md` contre la
   base réelle (staging ≠ production).
2. **Couverture indirecte uniquement** pour `isSubmissionWithinFacilitatorScope` et
   `findForeignAttendanceRecord` : aucun test ne les cible par leur nom. Un changement
   de leur signature interne non reflété dans le comportement HTTP ne serait pas
   détecté.
3. **Le test (a) prouve la route PATCH**, pas la branche lecture `GET` de
   `scope.js:60-61` (le jumeau). L'assertion de lecture (`{ empty: true }`) n'est pas
   directement exercée par les suites ici exécutées.
4. **Portée réelle des mocks de portée.** `getFacilitatorTeamScope` étant mocké, le
   contrat « vide ⇒ `scope:"none"`, jamais `scope:"teams"` avec `teamIds:[]` » (déjà
   signalé comme dépendance d'invariant dans `inventaire-C-portees.md`, Incertitude 3)
   n'est pas lui-même testé ici.
5. **Exhaustivité des suites exécutées.** Je n'ai exécuté que les 3 suites ciblées
   identifiées par recherche de texte. Une suite non listée pourrait recouper ces trous
   sous un autre nom, sans que la recherche par motif l'ait révélé.

---

## Résumé final

Fichier écrit : `docs/permissions/inventaire-C2-trous-verification.md`

| Trou | Corrigé | Test trouvé | Résultat exécuté |
|---|---|---|---|
| (a) Portée d'équipe vide (soumissions) | OUI | OUI | PASS |
| (b) Présences groupées, programme étranger | OUI | OUI | PASS |
| (c) Calendrier dérivé du rôle | OUI | OUI | PASS |
