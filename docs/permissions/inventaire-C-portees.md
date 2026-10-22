# Inventaire C — Portées (scope) d'une permission

> Lecture seule. Aucune ligne de code applicatif n'a été modifiée par cet inventaire.
> Objet : recenser **exhaustivement** les endroits où le PÉRIMÈTRE (portée) d'une
> permission est décidé, dans le moteur (`src/services/authorization/**`,
> `src/server/authz/**`) et **hors moteur** (filtres ad hoc dans les routes et les
> modèles). Chaque point est sourcé `fichier:ligne` avec un extrait exact.
>
> Conventions de lecture des colonnes « appliquée » :
> - **ENFORCEMENT** = la décision de portée refuse/accepte une requête ;
> - **PROJECTION** = la même donnée de portée sert à afficher/auditer, pas à refuser ;
> - **déclarée non appliquée** = définie et résolvable, mais aucun consommateur ne l'exécute.

---

## 0. Vue d'ensemble du moteur

| Élément | Emplacement | Rôle |
|---|---|---|
| Catalogue des politiques (pur, sans DB) | `src/models/authorization/scope-catalog.js` | vocabulaire + état `implemented` |
| Moteur/prédicat (service) | `src/services/authorization/scope.js` | `resolveScopeIds`, `isWithinScope` |
| Lectures SQL (repository) | `src/models/authorization/scopeReads.js` | une fonction par requête |
| Garde « programme » | `src/lib/programScopedAccess.js` | `requireProgramScope(ForAll)` |
| Garde « venture » | `src/lib/ventureScopedAccess.js` | `requireVentureScopedAccess` |
| Gardes de ressource génériques | `src/services/authorization/resourceGuards.js` + `src/server/authz/guards.js` | projet / facilitateur / assignation |
| Portée de listing (propre vs portefeuille) | `src/services/authorization/listingScope.js` | `resolveListingScope` |
| Gardes serveur HTTP | `src/server/authz/{guards,responses,programAccess,capabilities}.js` | décision → `NextResponse` |

Note importante : l'en-tête de `scope.js` déclare encore la Phase 5a « délibérément
**INERTE** » (`src/services/authorization/scope.js:19-22`) :

```
 * Phase 5a is deliberately INERT: predicates are implemented and verifiable
 * through the Permission Center verification endpoint, but no route enforces
 * them yet.
```

Ce commentaire est **périmé** : `program_staffed` et `venture_own` sont désormais
appliquées par des routes (voir §1). Il faut le lire comme un vestige.

---

## 1. Politiques de portée du MOTEUR

Catalogue : `SCOPE_POLICY_KEYS` = 7 clés — `src/models/authorization/scope-catalog.js:18-26`.

```
export const SCOPE_POLICY_KEYS = [
  "venture_own",
  "program_assigned",
  "program_staffed",
  "learning_own",
  "venture_managed_history",
  "program_managed_history",
  "team_own",
];
```

| Politique | Sémantique | Définie (catalogue) | Résolution (moteur) | Requête (SQL) | Implémentée | Où APPLIQUÉE | Statut |
|---|---|---|---|---|---|---|---|
| `venture_own` | Les ventures « à soi » : adhésion active (`venture_members`) ∪ affectation staff active (`venture_staff_assignments`) | `scope-catalog.js:34-40` | `scope.js:65-66` | `scopeReads.js:18-30` | `true` | ENFORCEMENT : `lib/ventureScopedAccess.js:85` ; **direct** `app/api/ventures/route.js:139` et `app/api/ventures/[id]/route.js:84` | **Appliquée** |
| `program_assigned` | Programmes où l'on est staffé **ou** inscrit (`v2_program_staff` ∪ `participant_programs`) | `scope-catalog.js:41-47` | `scope.js:70-71` | `scopeReads.js:33-45` | `true` | PROJECTION seule : `models/authorization/contactContexts.js:142` | **Déclarée, résolue, mais NON appliquée en enforcement** |
| `program_staffed` | Côté ÉCRITURE : staffing uniquement (`v2_program_staff` ∪ `v2_programs.assigned_pm_id`) | `scope-catalog.js:54-60` | `scope.js:75-76` | `scopeReads.js:48-60` | `true` | ENFORCEMENT : `lib/programScopedAccess.js:111` (19 fichiers porteurs, §1.1) ; direct `app/api/pm/programs/[id]/manager/route.js:62` | **Appliquée** |
| `learning_own` | Cours de ses propres inscriptions non suspendues (`lms_enrollments`) | `scope-catalog.js:61-66` | `scope.js:77-78` | `scopeReads.js:63-71` | `true` | PROJECTION seule : `models/authorization/contactContexts.js:143` | **Déclarée, résolue, mais NON appliquée en enforcement** |
| `venture_managed_history` | Lecture résiduelle : ventures managés dans le passé (assignations terminées) | `scope-catalog.js:70-76` | `scope.js:80-81` | `scopeReads.js:78-93` | `true` | AUCUN consommateur hors tests/UI | **Déclarée mais NON appliquée** |
| `program_managed_history` | Idem, côté programme | `scope-catalog.js:77-83` | `scope.js:82-83` | `scopeReads.js:96-111` | `true` | AUCUN consommateur hors tests/UI | **Déclarée mais NON appliquée** |
| `team_own` | Vide (à faire) : « v2_teams mapping not resolved yet » | `scope-catalog.js:84-89` | **absente du `switch`** de `resolveScopeIds` (`scope.js:60-86`) | — | `false` | Aucune (fail-closed) | **Déclarée, NON implémentée → DENY** |

### 1.1 Fonctions de décision du moteur (contrat fail-closed)

- `resolveScopeIds(policyKey, userCid, {email})` — `src/services/authorization/scope.js:57-91`.
  Retourne `string[]` (possiblement vide) ou `null`. `null` = **DENY** :
  ```
  if (!userCid || !isScopePolicyImplemented(policyKey)) return null;   // :58
  ...
  } catch (error) {
    console.warn(`[Scope] resolveScopeIds(${policyKey}) failed:`, error.message);
    return null; // fail closed — an unresolvable scope is a denial      // :89
  ```
- `isWithinScope(policyKey, userCid, resourceId, options)` — `scope.js:121-128`.
  Fail-closed sur id vide, politique inconnue et erreur :
  ```
  if (resourceId === null || resourceId === undefined || resourceId === "") {
    return false;                                                        // :122-124
  }
  const ids = await resolveScopeIds(policyKey, userCid, options);
  if (!ids) return false;                                                // :126
  return ids.includes(String(resourceId));                               // :127
  ```
- `evaluateScopeDecision({capabilityHeld, policyKey, withinScope})` — `scope-catalog.js:116-127`
  (capability → politique supportée → portée).
- `isScopePolicyImplemented` — `scope-catalog.js:101-103`.
- Normalisation d'identifiant venture : `resolveVentureScopeId` — `scope.js:102-115`.
- Règle contact → programme staffé : `isContactWithinStaffedPrograms` — `scope.js:139-147`
  (délègue à `contactSharesStaffedProgram`, `scopeReads.js:123-133`).

### 1.2 Où `program_staffed` est APPLIQUÉE (par le garde `requireProgramScope`)

`src/lib/programScopedAccess.js` — `requireProgramScope` (:51-135), `requireProgramScopeForAll` (:143-162).
Pas de commutateur d'activation (« ENFORCED UNCONDITIONALLY », :23-26). Appelants (routes et services),
d'après `src/__tests__/program-scope-coverage.test.js:33-61` et le grep des imports :

| Vague | Fichiers appelants (fichier:ligne d'appel documentée) |
|---|---|
| content | `app/api/pm/programs/route.js` ; `app/api/pm/curriculum/route.js:41,74,101` ; `app/api/pm/reports/route.js` (via `requireAssignmentAccess` + `requireProgramScope`) ; `app/api/pm/export/route.js:26` ; `app/api/programs/route.js` ; `app/api/submissions/route.js:252` |
| enrollment | `app/api/participant-programs/route.js` (garde déplacée dans `services/programs/participantPrograms.js`) ; `app/api/participant-programs/bulk/route.js:65` ; `app/api/invites/route.js:41` ; `app/api/facilitators/invite-bulk/route.js:101` |
| groups | `app/api/groups/route.js:60,106,154` ; `app/api/kpis/route.js:60,88,109` ; `app/api/pm/teams/route.js` ; `app/api/teams/route.js` ; `app/api/group-members/route.js:45` ; `app/api/team-tasks/route.js` |
| lms | `app/api/lms/coaching-requests/route.js:42` ; `app/api/lms/program-requirements/route.js:48,77` ; `app/api/lms/program-requirements/[id]/route.js:41,71` |

Fonctions internes du garde :
```
const within = await isWithinScope("program_staffed", session.cid, programId, {
  email: session.email,
});                                                              // programScopedAccess.js:111-113
```
et `requireProgramScopeForAll` refuse tout lot dont un id échoue (`:143-162`).

Exclusions assumées (vagues `enrollment`/`groups`, `programScopeWaves.js:36-62`) :
accepter une invitation (le token autorise), inscriptions en effet de bord, routes
legacy V2 `api/v2/groups` et `api/v2/kpis` (bannière « partial »).

### 1.3 Où `venture_own` est APPLIQUÉE

- Garde canonique : `src/lib/ventureScopedAccess.js:85` (`resolveVentureScopedDecision` :56-97 ; garde :99-176). 34 fichiers l'importent.
- Appels directs (sans passer par le garde) : `app/api/ventures/route.js:139` (PUT) et `app/api/ventures/[id]/route.js:84` (PATCH).
- PROJECTION / audit : `services/authorization/ventureStrictAudit.js:142`, `models/authorization/contactContexts.js:141`.

---

## 2. Filtres de portée AD HOC (hors moteur)

Comportement visé par la règle « liste vide = aucun accès » : pour chaque filtre,
on précise ce qui se passe quand la liste de périmètre est **vide**.

| # | Fichier:ligne | Ce qu'il filtre | Comportement si liste VIDE |
|---|---|---|---|
| 1 | `src/services/operations/attendance.js:67-79` `resolveAttendanceParticipantScope` | participants écrivables par un facilitateur (équipes) | `scope==="none"` → `new Set()` = **refuse tout** (ok) ; voir fail-open structural #2 |
| 2 | `src/services/operations/attendance.js:97-104` `filterAllowedAttendanceRecords` | ne garde que les participants autorisés | `null` = **aucune restriction** (c'est le sens « management / tout le programme », pas une liste vide) |
| 3 | `src/services/operations/attendance.js:86-91` `findForeignAttendanceRecord` | refuse tout lot contenant un `program_id` étranger | n/a (compare le 1er programme) — **corrige le trou (b)** |
| 4 | `src/services/ventures/submissions/scope.js:58-68` `resolveFacilitatorSubmissionScope` | soumissions visibles (équipes du facilitateur) | `teamIds.length === 0` → `{ empty: true }` = **refuse tout** (ok) |
| 5 | `src/services/ventures/submissions/review.js:33-41` `isSubmissionWithinFacilitatorScope` | notation : soumission dans les équipes | `teamIds.length === 0` → `return false` = **refuse** (ok) — **corrige le trou (a)** |
| 6 | `src/models/groups/enrollment.js:90-93` `getProgramParticipants` | participants d'un programme (filtre `teamIds`) | `teamIds` vide → **AUCUN filtre** → tous les participants (**fail-open STRUCTURAL**, neutralisé par l'appelant §#7) |
| 7 | `src/app/api/participants/route.js:139-148` | portée d'équipe du facilitateur | `scope.teamIds.length === 0` → `{ participants: [] }` = **refuse** (neutralise #6) |
| 8 | `src/services/workspace/calendar.js:84-113` `resolveCalendarProgramScope` | programmes du calendrier unifié (relation, pas rôle) | sentinelle `["__no_program_scope__"]` → **rien** — **corrige le trou (c)** |
| 9 | `src/services/workspace/calendar.js:151-203` `resolveCalendarVentureScope` | ventures du calendrier | `ventureScope` vide → `scopeIds:null` ; la route saute le bloc → **rien affiché** (fail-closed de fait) |
| 10 | `src/services/workspace/calendar.js:120-134` `resolveCalendarFollowupVisibility` | suivis visibles | non-privilégié → `f.created_by IS NULL OR f.created_by = ?` (propre) |
| 11 | `src/services/ventures/scope.js:94-104` `getAssignmentScopes` | portées d'assignation d'un acteur venture | `[]` (aucune ligne) ; `null` seulement en erreur |
| 12 | `src/services/ventures/scope.js:141-160` `isTaskInScope` | tâche couverte par une portée | `[]`/`null` → `return false` (refuse) |
| 13 | `src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js:145-161` | revue d'une soumission de tâche | `scopes.length === 0` → `inScope = true` — **FAIL-OPEN documenté** (`// no assignment rows → legacy behavior unchanged`) |
| 14 | `src/app/api/ventures/[id]/submissions/review-queue/route.js:46-58` | file de revue venture | `scopes.length > 0` requis ; vide → **pas de filtrage** = toute la file — **FAIL-OPEN documenté** (lecture) |
| 15 | `src/lib/ventureDeliverables.js:30-37` `canReviewDeliverable` | revue d'un livrable | `!Array.isArray(scopes) || scopes.length === 0` → `return false` (refuse, ok) |
| 16 | `src/services/communications/followups.js:112-119` `isParticipantInFacilitatorScope` | participant dans les équipes du facilitateur | `teamIds.length === 0` → `return false` (refuse, ok) |
| 17 | `src/models/communications/followups.js:73-77` / `:158-162` `isContactInFacilitatorTeams[...]` | contact dans les équipes (`IN (...)`) | dépend de l'appelant (#16 garantit non-vide) |
| 18 | `src/models/authorization/investorScope.js:40-75` `resolveInvestorScope` + `investorOwns*` | périmètre d'un investisseur (profil) | `profileId` null → non liable → routes `404` (fail-closed) |
| 19 | `src/services/projects/workspace.js:60-69` / `src/services/authorization/listingScope.js:35-48` | liste de projets : portefeuille vs propre | hors portefeuille : `cid = sessionCid` ; demander autrui → `denied` (refuse, ok) |
| 20 | `src/models/contacts/directory.js:123-130` `getTeamsScopedByPrograms` | équipes des programmes du PM | `programId` vide → placeholder `"NULL"` → `IN (NULL)` → **aucune ligne** (ok) |
| 21 | `src/models/contacts/families.js:19-28` `getFamiliesScopedByProgramsAndGroups` | familles des programmes/groupes du PM | idem `"NULL"` → **aucune ligne** (ok) |
| 22 | `src/models/groups/enrollment.js` (`getEnrolledProgramParticipants`, `directory.js:110-119`) | participants inscrits des programmes du PM | `"NULL"` → aucune ligne (ok) |
| 23 | `src/app/api/sessions/route.js:53-79` | sessions d'un programme | sans `program_id` et hors management → **403** (corrige « lister tout ») |
| 24 | `src/models/ventureDocumentsStore.js:19-29` `selectDocuments` | `approval_status` selon `visibility` | `visibility` vide/null → **AFFICHE TOUT** (commentaire « null = show all ») — à confirmer côté appelant |

---

## 3. Vérification des 3 trous de portée historiquement connus

Source de référence : `src/__tests__/authz-scope-enforcement.test.js:1-24`
(documente les défauts et leur correction).

### (a) Portée d'équipe ignorée quand la liste d'équipes est vide (soumissions / notation)
**État : CORRIGÉ.**

- Notation (`PATCH /api/submissions`) : `src/app/api/submissions/route.js:97-109` :
  ```
  // Fail closed: a facilitator with NO assigned teams has no record scope
  // in this program (mirrors the GET path).
  const inScope = await isSubmissionWithinFacilitatorScope({
    id, sessionCid: session.cid, programId,
  });
  if (!inScope) { ... 403 ... }
  ```
- Helper : `src/services/ventures/submissions/review.js:35-37` :
  ```
  if (scope.scope !== "all") {
    if (scope.teamIds.length === 0) return false;
  ```
- Lecture (`GET /api/submissions`) : `src/services/ventures/submissions/scope.js:60-61`
  (`teamIds.length === 0` → `{ empty: true }`).
- Test : `authz-scope-enforcement.test.js:140-161`.

### (b) Écriture groupée (présences) pouvant viser un programme non autorisé
**État : CORRIGÉ.**

- Route : `src/app/api/attendance/route.js:66-76` :
  ```
  // ... A batch whose first row names the assigned program could therefore
  // carry later rows for a different program ...
  if (findForeignAttendanceRecord(records, programId)) {
    return NextResponse.json(
      { success: false, error: "errors.insufficientPermissions" },
      { status: 403 },
    );
  }
  ```
- Helper : `src/services/operations/attendance.js:86-91` :
  ```
  export function findForeignAttendanceRecord(records, programId) {
    return records.find(
      (record) =>
        record?.program_id && String(record.program_id) !== String(programId),
    );
  }
  ```
- Test : `authz-scope-enforcement.test.js:212-227`.

### (c) Portée dérivée du libellé de rôle plutôt que de la relation (calendrier)
**État : CORRIGÉ.**

- Route : `src/app/api/calendar/route.js:49-52` délègue au service :
  ```
  const { programScopeSql, programTableScopeSql, programScopeArgs } =
    await resolveCalendarProgramScope(sessionCid, session?.role);
  ```
- Service : `src/services/workspace/calendar.js:68-113` — « derived from RELATIONSHIPS,
  not from the platform role label » ; portée = `getFacilitatorProgramScopePids` ∪
  `getParticipantProgramScopePids` ; vide → sentinelle :
  ```
  // Fail closed: no relationship at all means NO program-scoped events.
  const scopedProgramIds = programIdSet.size
    ? [...programIdSet]
    : ["__no_program_scope__"];                                  // calendar.js:101-104
  ```
- Test : `authz-scope-enforcement.test.js:164-195`.

Trou apparenté également corrigé (hors des 3 demandés) : `GET /api/sessions` sans
`program_id` (auparavant toutes les sessions) — `app/api/sessions/route.js:57-79`.

---

## 4. Gardes `length > 0 &&` / `if (ids.length)` = SIGNAL de fail-open

| # | Fichier:ligne | Extraits | Verdict |
|---|---|---|---|
| 1 | `src/models/groups/enrollment.js:90` | `if (teamIds && teamIds.length > 0) {` | **Fail-open structural** : vide → pas de filtre → tous. Neutralisé par l'appelant `app/api/participants/route.js:143-145`. |
| 2 | `src/services/operations/attendance.js:72` | `if (scope.scope === "teams" && scope.teamIds.length > 0) {` | **Fail-open structural** : `"teams"` + vide tomberait sur `return { allowedParticipantIds: null }` (non restreint). En pratique `getFacilitatorTeamScope` renvoie `"none"` si vide (`accessQueries.js:230-233`), donc non déclenché. |
| 3 | `src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js:151-152` | `} else if (scopes.length === 0) { inScope = true;` | **Fail-open ASSUMÉ** (écriture de revue) : aucune ligne d'assignation → legacy = autorisé. |
| 4 | `src/app/api/ventures/[id]/submissions/review-queue/route.js:49` | `if (scopes && scopes.length > 0 && !hasVentureWideReach(scopes)) {` | **Fail-open ASSUMÉ** (lecture) : vide → pas de restriction de la file. |
| 5 | `src/models/ventureDocumentsStore.js:25` | `if (visibility && Array.isArray(visibility) && visibility.length > 0) {` | **Suspect** : `visibility` vide/null → tous les statuts. Dépend de l'appelant (non tracé ici). |
| 6 | `src/models/contacts/timeline.js:41-49` | `if (pmProgramIds.length > 0) {...} else { sql += " AND context_module != 'programs'"; }` | **Non fail-open** : branche `else` explicite (refuse). |
| 7 | `src/models/messageScopeStore.js:37-51` / `messages.js:126-142` | `if (plan.groupIds.length > 0) {...}` | **Non fail-open** : clauses **additives** de visibilité de la propre boîte du demandeur ; vide = pas de messages de groupe (correct). |
| 8 | `src/models/authorization/accessQueries.js:216-236` `getFacilitatorTeamScope` | `scope: teams.rows.length ? "teams" : "none"` ; `catch → { scope: "none" }` | **Fail-closed** (erreur → `"none"`). |

---

## 5. Résumé chiffré

| Indicateur | Valeur |
|---|---|
| Politiques de portée **déclarées** (moteur) | **7** (`SCOPE_POLICY_KEYS`) |
| Politiques **implémentées** | **6** (`team_own` = non implémentée) |
| Politiques **appliquées en enforcement** | **2** (`venture_own`, `program_staffed`) |
| Politiques seulement **projetées** (affichage/audit) | **2** (`program_assigned`, `learning_own`) |
| Politiques **déclarées mais non appliquées** | **3** (`venture_managed_history`, `program_managed_history`, + `team_own` non implémentée) |
| Fichiers portant le garde `requireProgramScope` | **19** (imports) ; **42** points d'appel |
| Fichiers portant le garde `requireVentureScopedAccess` | **34** (imports) ; **71** points d'appel |
| Filtres de portée **ad hoc** recensés (hors moteur) | **24** (§2) |
| Gardes **fail-open potentielles** | **4** franches (#1, #2, #3, #4) + **1** à confirmer (#5) |
| Dont fail-open **assumées / documentées** | **2** (#3, #4 — venture review) |

### La règle « liste vide = aucun accès » est-elle respectée partout ?

**Non, pas partout — mais le moteur lui-même l'applique sans exception.**

- **Moteur** : toujours respectée. `isWithinScope` renvoie `false` sur id vide, politique inconnue ou périmètre vide (`scope.js:121-128`) ; `resolveScopeIds` renvoie `null` (→ DENY) sur erreur (`scope.js:87-90`). `requireProgramScope` refuse un `programId` manquant (`programScopeAccess.js:99-109`).
- **Hors moteur** : majoritairement respectée via des sentinelles fail-closed
  (`"__no_program_scope__"`, `"NULL"`, `{ empty: true }`, `return false`).
- **Exceptions fail-open** (liste vide = accès élargi) :
  1. `src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js:151` — écrire une revue sans aucune assignation (legacy assumé) ;
  2. `src/app/api/ventures/[id]/submissions/review-queue/route.js:49` — voir toute la file sans portée (legacy assumé) ;
  3. `src/models/groups/enrollment.js:90` — `teamIds` vide = tous les participants (neutralisé par l'appelant, mais fragile) ;
  4. `src/services/operations/attendance.js:72` — forme fail-open non déclenchable aujourd'hui (dépend de l'invariant `getFacilitatorTeamScope`) ;
  5. `src/models/ventureDocumentsStore.js:25` — `visibility` vide = tous les statuts (à confirmer côté appelant).

---

## Incertitudes

1. **Complétude des filtres ad hoc.** Le recensement §2 s'appuie sur des motifs de
   recherche (`program_id`, `venture_id`, `team_id`, `IN (...)`, `length > 0`).
   Un filtre de portée construit sous une autre forme (colonne calculée, jointure
   implicite, variable non nommée « scope ») peut échapper à cette méthode. Non
   exhaustif **par preuve** ; exhaustif **par motif**.
2. **`src/models/ventureDocumentsStore.js:19-29` (#24/#5).** Je n'ai pas tracé
   les appelants de `selectDocuments`/`listDocuments` (`src/services/ventures/documents.js:39-41`)
   pour établir si `visibility` traduit une autorisation ou un simple filtre d'UI
   d'affichage. « Fail-open » reste donc **hypothétique** ici.
3. **`getFacilitatorTeamScope` et l'invariant `"teams" ⇔ teamIds non vide`.**
   Le fail-open #2 (`attendance.js:72`) n'est neutralisé que parce que la requête
   renvoie `"none"` quand aucune équipe n'est trouvée (`accessQueries.js:230-233`).
   Si une évolution renvoyait `"teams"` avec `teamIds: []`, ce chemin élargirait
   l'accès. Dépendance d'invariant, non d'un contrat explicite.
4. **Statut « appliquée » des politiques de lecture.** `program_assigned` et
   `learning_own` n'ont **aucun** consommateur d'enforcement identifié ; je les
   classe « projection seule » d'après le grep (seul `contactContexts.js` les
   appelle). S'il existe un consommateur dynamique (référence par chaîne, config
   DB), il m'a échappé.
5. **Routes legacy V2.** `api/v2/groups` et `api/v2/kpis` sont classées
   « partial/exempt » (`programScopeWaves.js:53-62`) : leurs écritures ne
   consultent **pas** la portée programme. Je les ai comptées comme non couvertes,
   conformément à la bannière projet, sans vérifier route par route.
6. **Portées venture `lead_manager` / `venture_wide`.** `hasVentureWideReach`
   (`services/ventures/scope.js:119-126`) accorde la portée totale sur simple
   `responsibility_code === "lead_manager"` ; je n'ai pas audité la cohérence de
   cette règle avec `isMilestoneLeadAuthority` (mentionnée en commentaire) ni
   avec le moteur `venture_own`.
7. **Commentaire « Phase 5a INERTE ».** Il contredit l'usage réel observé
   (routes appliquant `program_staffed`/`venture_own`). J'ai traité le commentaire
   comme obsolète ; je n'ai pas cherché l'historique git qui l'a rendu tel.
