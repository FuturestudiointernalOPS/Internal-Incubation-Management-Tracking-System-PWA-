# Inventaire D2 — décisions d'autorisation déléguées (suivi jusqu'à la décision)

Périmètre : handlers classés **AUTH_SEULE** (ou signalés « décision déléguée ») dans
`docs/permissions/inventaire-D-actions.md`, dont le `route.js` ne porte pas la décision et
la confie à un service / modèle / garde délégué. Pour chacun, l'appel est suivi jusqu'à la
décision effective (fichier + ligne + extrait). Lecture seule — aucune modification de code.

## 0. Méthode et légende

1. Lecture du `route.js`, repérage de chaque appel à un service / modèle / garde.
2. Ouverture du fichier cible et descente jusqu'à la branche qui décide (capacité, portée,
   appartenance, rôle), avec le `fichier:ligne` **exact** et un extrait.
3. Verdict par handler :
   - `CONTRÔLÉ` — une décision réelle existe sur le chemin (capacité, portée, appartenance, rôle).
   - `AUTH_SEULE_CONFIRMÉ` — session exigée mais **aucune** décision de permission en aval.
   - `INDÉTERMINABLE` — le chemin n'aboutit pas à une garde statiquement lisible.
   - `ROLE_VISIBLE` — décision de rôle écrite dans le `route.js` (hors délégation, hors compteurs).

Rappel : la présence d'un **appel** à un service n'est **jamais** prise pour un contrôle ; seul
le contenu du fichier cible la vaut.

---

## 1. Points de départ cités dans l'inventaire D

### 1.1 `participant-programs` (services/programs/participantPrograms.js)

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /participant-programs | GET | `getParticipantProgramsService(...)` | services/programs/participantPrograms.js | L29 `const capError = await requireAuthorization("programs", "view");` puis L31-39 `if (session && !canRead)` → L35 `await requireAssignmentAccess({ resource: "program", contextId: programId })` → services/authorization/resourceGuards.js L132 `if (FACILITATOR_BYPASS_ROLES.includes(session.role)) return ALLOWED;` L134 `if (resource !== "program") return denied(403, …)` | CONTRÔLÉ |
| /participant-programs | POST | `assignParticipantToProgramsService(body)` | services/programs/participantPrograms.js | L47 `const authError = await requireAuth(["staff","super_admin","program_manager"]);` (rôle) + L61 `await requireProgramScopeForAll({ programIds: program_ids, wave: "enrollment" })` → lib/programScopedAccess.js L111-124 `const within = await isWithinScope("program_staffed", session.cid, programId, …); if (!within) return denied(…, "out-of-scope")` | CONTRÔLÉ |
| /participant-programs | DELETE | `removeParticipantFromProgramService(body)` | services/programs/participantPrograms.js | L107 `requireAuth(["staff","super_admin","program_manager"])` + L114 `await requireProgramScope({ programId: program_id, wave: "enrollment" })` → lib/programScopedAccess.js L111-124 (`isWithinScope("program_staffed", …)` → 403 `out-of-scope`) | CONTRÔLÉ |

Note : le moteur `requireProgramScope` short-circuite Super Admin (L74-76) puis exige un
programme **staffé** (`program_staffed`), pas seulement une inscription.

### 1.2 `ventures/[id]/members` (models/ventureMemberAccess.js)

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /ventures/[id]/members | GET | `checkAccess(db, id, userRole, userCid)` (alias de `checkVentureMemberViewAccess`) | src/models/ventureMemberAccess.js | L61-67 : L62 `if (["super_admin"].includes(userRole)) return true;` L63 `if (!userCid) return false;` L64 `if (await isVentureMember(db, ventureId, userCid)) return true;` L66 `return hasAnyVentureAssignment({ ventureId: code, contactId: userCid });` | CONTRÔLÉ |
| /ventures/[id]/members | POST | `checkAccess(...)` + `checkMutateAccess(...)` (alias `checkVentureMemberMutateAccess`) | src/models/ventureMemberAccess.js | L69-75 : L70 `super_admin` → true, L71 `!userCid` → false, L72 `if (await isVentureFounder(db, ventureId, userCid)) return true;` L74 `return hasVentureCapability({ … area: "founders", action: "manage" });` (`hasVentureCapability` → services/ventures/permissions.js L298-321, décision L318 `if (matrixRow.rows?.[0]?.allowed) return true;`) | CONTRÔLÉ |
| /ventures/[id]/members | PATCH | `checkAccess(...)` + `checkMutateAccess(...)` | src/models/ventureMemberAccess.js | identique POST (L61-67 / L69-75) ; décision dans la route à L197-207 (`if (!canMutate) … 403`) | CONTRÔLÉ |

### 1.3 `ventures/[id]/member-invitations`

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /ventures/[id]/member-invitations | GET | `checkVentureMemberViewAccess(db, code, userRole, userCid)` | src/models/ventureMemberAccess.js | L61-67 (cf. 1.2 GET) | CONTRÔLÉ |
| /ventures/[id]/member-invitations | DELETE | `checkVentureMemberMutateAccess(db, code, userRole, userCid)` | src/models/ventureMemberAccess.js | L69-75 : L72 `isVentureFounder` / L74 `hasVentureCapability({ area: "founders", action: "manage" })` | CONTRÔLÉ |

### 1.4 `ventures/[id]/founders/*` (services/ventures/founders.js)

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /ventures/[id]/founders | GET | `await import("@/lib/ventureAuth")` puis `requireVentureAccess(id)` | src/lib/ventureAuth.js | L109-131 : L114-117 `if (globalRoles.includes(session.role)) return { ventureId, session };` L124-128 `if (facts && (relationship.is_member || relationship.is_assigned)) return { ventureId, session };` ; sinon L130 `return { ventureId, session: null };` — la route transforme `session:null` en 404 (route L25-27) | CONTRÔLÉ |
| /ventures/[id]/founders | POST | `canManageFounders(id, session)` | src/services/ventures/founders.js | L96-115 : L98 `if (session.role === "super_admin") return { allowed: true, isOwner: true };` L100 `selectFounderForManage(...)` L102-104 `if (founderRes.rows.length === 0) return { allowed: false };` L107 `const allowed = founder.is_owner || MANAGEMENT_ROLES.includes(founder.role);` | CONTRÔLÉ |
| /ventures/[id]/founders/[founderId] | GET | *(aucune garde de permission — p. de 12-23)* | — | La route lit `getFounderById(...)` puis vérifie seulement `founder.venture_id !== id` (L17) et renvoie l'enregistrement. `createHandler` n'apporte que la session (createHandler.js L62 `requireAuth(roles, session)` sans roles). Aucune appartenance ni capacité. | AUTH_SEULE_CONFIRMÉ |
| /ventures/[id]/founders/[founderId] | PATCH | `canManageFounders(id, session)` | src/services/ventures/founders.js | L96-115 (cf. POST founders) ; décision dans la route L39-42 (`if (!permission.allowed) … 403`) | CONTRÔLÉ |
| /ventures/[id]/founders/[founderId] | DELETE | `canManageFounders(id, session)` | src/services/ventures/founders.js | L96-115 ; route L95-98 (`if (!permission.allowed) … 403`) | CONTRÔLÉ |
| /ventures/[id]/founders/[founderId]/suspend | POST | `canManageFounders(id, session)` | src/services/ventures/founders.js | L96-115 ; route L20-23 | CONTRÔLÉ |
| /ventures/[id]/founders/[founderId]/reactivate | POST | `canManageFounders(id, session)` | src/services/ventures/founders.js | L96-115 ; route L20-23 | CONTRÔLÉ |
| /ventures/[id]/founders/transfer-ownership | POST | `canManageFounders(id, session)` | src/services/ventures/founders.js | L96-115 + route L21 `if (!permission.allowed \|\| !permission.isOwner) … 403` (isOwner vient de L98/L105-107) | CONTRÔLÉ |

### 1.5 `ventures/[id]/lead` et `ventures/[id]/lifecycle` (lib/ventureAuth.js, import dynamique)

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /ventures/[id]/lead | POST | `hasActiveVentureAssignment(ventureId, session.cid)` + `findLeadFounderMembership(...)` + `requireOperationalVentureAccess(...)` | src/lib/ventureAuth.js | L97-107 : L102-103 `const relationship = await getViewerRelationship(ventureCode, sessionCid); return relationship.is_assigned;` ; + L78-84 `leadCheck = await findLeadFounderMembership(ventureId, session.cid); if (leadCheck.rows.length === 0) … 403` ; + L62-75 (archive) | CONTRÔLÉ |
| /ventures/[id]/lifecycle | POST | `hasActiveVentureAssignment(ventureId, session.cid)` | src/lib/ventureAuth.js | L49-58 : `if (!["super_admin"].includes(session.role)) { const { hasActiveVentureAssignment } = await import("@/lib/ventureAuth"); if (!(await hasActiveVentureAssignment(ventureId, session.cid))) … 403 }` → décision L102-103 (`relationship.is_assigned`) | CONTRÔLÉ |

### 1.6 `projects/*`

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /projects | GET | `listProjects({ role, sessionCid, requestedCid, … })` | src/services/projects/workspace.js → services/authorization/listingScope.js | workspace.js L60-69 `resolveProjectListFilter` → listingScope.js L35-48 : L41 `if (seesWholePortfolio(role)) return { cid: requestedCid };` L44-45 `if (requestedCid && String(requestedCid) !== String(sessionCid)) return { denied: denialMessage };` | CONTRÔLÉ |
| /projects | POST | `requireAuthorization("projects", "create")` | src/models/authorization/index.js | Moteur de capacités invoqué directement dans la route (L32) — décision visible/centralisée | CONTRÔLÉ |
| /projects | PUT | `needsProjectObjectCheck(...)` + `requireProjectAccess(id)` | src/services/authorization/resourceGuards.js | L38-55 `evaluateProjectAccess` : L43 `if (session.role === "super_admin") return ALLOWED;` L45 `if (!(await projectExists(projectId))) return denied(404, …);` L48 `if (await isProjectMember(projectId, session.cid)) return ALLOWED;` L50 `return denied(403, "errors.insufficientPermissions");` | CONTRÔLÉ |
| /projects | DELETE | `requireAuthorization("projects","delete")` + `requireProjectAccess(id)` | src/services/authorization/resourceGuards.js | L38-55 (cf. PUT) | CONTRÔLÉ |
| /projects/members | GET | `needsProjectObjectCheck(...)` + `requireProjectAccess(projectId)` | src/services/authorization/resourceGuards.js | L38-55 (cf. PUT) | CONTRÔLÉ |
| /projects/members | POST | `requireAuthorization("projects","edit")` + `requireProjectAccess(project_id)` | src/services/authorization/resourceGuards.js | L38-55 (cf. PUT) | CONTRÔLÉ |
| /projects/members | DELETE | `requireAuthorization("projects","edit")` + `requireProjectAccess(projectId)` | src/services/authorization/resourceGuards.js | L38-55 (cf. PUT) | CONTRÔLÉ |
| /projects/assignments | GET | `listProjectAssignments({ role, sessionCid, requestedCid })` | src/services/projects/collaboration.js | L94-100 : `const scope = resolveOwnScope({ … }); if (scope.denied) return { status: 403, error: scope.denied };` → listingScope.js L44-45 | CONTRÔLÉ |
| /projects/invitations | GET | `listProjectInvitations({ role, sessionCid, inviteeId, … })` | src/services/projects/collaboration.js | L231-237 : `const scope = resolveOwnScope({ … denialMessage: "You can only view your own invitations." }); if (scope.denied) return { status: 403, … }` | CONTRÔLÉ |
| /projects/invitations/respond | POST | `respondToProjectInvitation({ … })` | src/services/projects/collaboration.js | L283-287 `const isInviter = Boolean(inviterCid) && String(sessionCid) === String(inviterCid); if (!isInviter && role !== "super_admin") return { status: 403, error: "Only the inviter can cancel" };` et L293-295 `if (invitation.invitee_id !== sessionCid) return { status: 403, error: "Only the invited user can respond" };` | CONTRÔLÉ |
| /projects/discuss | GET | `requireProjectAccess(project_id)` | src/services/authorization/resourceGuards.js | L38-55 (cf. PUT) | CONTRÔLÉ |
| /projects/discuss | POST | `requireProjectAccess(project_id)` | src/services/authorization/resourceGuards.js | L38-55 (cf. PUT) | CONTRÔLÉ |

### 1.7 `tasks/*` (services/tasks/*)

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /tasks | GET | `listTasks({ … role, sessionCid })` | src/services/tasks/query.js | L58-60 `if (role !== "super_admin" && userId && userId !== sessionCid) return { status: 403, … }` ; L66-68 `if (notStaffSide && assignedTo && String(assignedTo) !== String(sessionCid)) … 403` ; L78-84 contrôle par id (owner/assignee/supervisor) | CONTRÔLÉ |
| /tasks | POST | `createTaskRecord({ input, role, sessionCid })` | src/services/tasks/create.js | L84-88 `if (!["super_admin","staff","program_manager","team"].includes(role)) { user_id = sessionCid; }` ; L203-214 `if (!groupCheck.allowed) return { status: 403, error: "Cannot assign task outside your Contact Group…" }` | CONTRÔLÉ |
| /tasks | PUT | `updateTaskRecord({ id, input, role, sessionCid, sessionName })` | src/services/tasks/updateGuards.js | L44-56 `if (role !== "super_admin" && String(task.user_id) !== cid && String(task.assigned_to \|\| "") !== cid && String(task.supervisor_id \|\| "") !== cid) return { failure: { status: 403, … } };` (+ L62-76 règle statut) | CONTRÔLÉ |
| /tasks | DELETE | `deleteTaskRecord({ id, role, sessionCid, sessionName })` | src/services/tasks/remove.js | L39-49 `if (role !== "super_admin" && String(taskRow.user_id) !== String(sessionCid) && String(taskRow.assigned_to \|\| "") !== String(sessionCid) && String(taskRow.supervisor_id \|\| "") !== String(sessionCid)) return { status: 403, … }` | CONTRÔLÉ |
| /tasks | PATCH | `respondToPendingAssignment({ action, taskAssignmentId, taskId, sessionCid, … })` | src/services/tasks/assignments.js | L231-236 `if (String(assignment.assignee_id) !== String(sessionCid)) return { status: 403, error: "You can only respond to your own assignments." };` | CONTRÔLÉ |
| /tasks/assignments | GET | `listTaskAssignments({ role, sessionCid, requestedCid, status })` | src/services/tasks/assignments.js | L58-64 `const scope = resolveListingScope({ … }); if (scope.denied) return { status: 403, error: scope.denied };` (→ listingScope.js L44-45) | CONTRÔLÉ |
| /tasks/assignments | POST | `respondToTaskAssignment({ assignmentId, action, newAssigneeId, sessionCid, … role })` | src/services/tasks/assignments.js | L101-102 `if (role !== "super_admin" && assignment.assigner_id !== userCid) return { status: 403, error: "Only the assigner can reassign" };` ; L104-106 `else if (assignment.assignee_id !== userCid) return { status: 403, … }` ; L160-172 (groupe de contacts) | CONTRÔLÉ |
| /tasks/assignment-action | POST | `applyAssignmentAction({ taskId, userId, … sessionCid })` | src/services/tasks/assignmentAction.js | L52-57 `if (String(task.assigned_to) !== String(sessionCid)) return { status: 403, error: "You are not the assigned person for this task" };` | CONTRÔLÉ |
| /tasks/comments | GET | `listTaskComments({ taskId, role, sessionCid })` | src/services/tasks/comments.js → services/tasks/access.js | comments.js L36-38 `if (!canAccessTask({ task, role, cid: sessionCid })) return { status: 403, … }` → access.js L27 `return seesWholePortfolio(role) \|\| ownsTask(task, cid);` | CONTRÔLÉ |
| /tasks/comments | POST | `postTaskComment({ … role, sessionCid })` | src/services/tasks/comments.js → access.js | comments.js L68-70 (`canAccessTask`) → access.js L26-28 | CONTRÔLÉ |
| /tasks/comments | DELETE | `deleteTaskComment({ id, role, sessionCid })` | src/services/tasks/comments.js | L136-139 `if (String(comment.sender_id) !== String(sessionCid) && role !== "super_admin") return { status: 403, error: "Only the author can delete this comment." };` | CONTRÔLÉ |
| /tasks/comments | PUT | `editTaskComment({ id, body, role, sessionCid })` | src/services/tasks/comments.js | L156-160 `if (String(commentResult.rows[0].sender_id) !== String(sessionCid) && role !== "super_admin") return { status: 403, error: "Only the author can edit this comment." };` | CONTRÔLÉ |
| /tasks/carryover | GET | `listCarryoverTasks({ role, sessionCid, requestedCid, … })` | src/services/tasks/carryover.js | L46-52 `const scope = resolveListingScope({ … }); if (scope.denied) return { status: 403, error: scope.denied };` | CONTRÔLÉ |
| /tasks/carryover | POST | `carryOverTask({ taskId, … role, sessionCid })` | src/services/tasks/carryover.js | L90-92 `if (!seesWholePortfolio(role) && !ownsTask(originalTask, sessionCid)) return { status: 403, error: "You can only carry over your own tasks." };` | CONTRÔLÉ |
| /tasks/duplicate | POST | `duplicateTask({ taskId, role, sessionCid })` | src/services/tasks/duplicate.js | L42-47 `if (!canAccessTask({ task, role, cid: sessionCid })) return { status: 403, error: "You do not have permission to duplicate this task." };` | CONTRÔLÉ |
| /tasks/logs | GET | `listTaskLogs({ taskId, limit, role, sessionCid })` | src/services/tasks/logs.js | L22-24 `if (!canAccessTask({ task, role, cid: sessionCid })) return { status: 403, … };` | CONTRÔLÉ |
| /tasks/reconcile | POST | `reconcileTasks({ userId, userName, tasks, role, sessionCid })` | src/services/tasks/reconcile.js | L56-62 `const scope = resolveListingScope({ … denialMessage: "You can only reconcile your own tasks." }); if (scope.denied) return { status: 403, error: scope.denied };` ; + L81-92 contrôle par ligne (`"Not your task"`) | CONTRÔLÉ |
| /tasks/resources | POST | `addTaskResource({ … role, sessionCid })` | src/services/tasks/resources.js → access.js | L36-38 `if (!canAccessTask({ task, role, cid: sessionCid })) return { status: 403, … }` | CONTRÔLÉ |
| /tasks/resources | DELETE | `removeTaskResource({ id, role, sessionCid })` | src/services/tasks/resources.js → access.js | L69-71 `if (!canAccessTask({ task, role, cid: sessionCid })) return { status: 403, … }` | CONTRÔLÉ |
| /tasks/approve | POST | `reviewTaskApproval({ … })` | (route) | L19 `const authError = await requireAuth(["super_admin"]);` — décision de rôle écrite **dans la route**, non déléguée | ROLE_VISIBLE |

### 1.8 `program-types` et `venture-templates`

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /program-types | GET | `listProgramTypeKeys()` | (route) | L16 `const authError = await requireAuth();` puis lecture d'un référentiel — aucune décision de permission | AUTH_SEULE_CONFIRMÉ |
| /program-types | POST | `createProgramTypeOption(type_key)` | (route) | L31 `const authError = await requireAuth(["super_admin"]);` — rôle écrit dans la route | ROLE_VISIBLE |
| /venture-templates | GET | `listActivePlaybookTemplates()` | (route) | L29 `const authError = await requireAuth();` puis lecture d'un référentiel — aucune décision de permission | AUTH_SEULE_CONFIRMÉ |
| /venture-templates | POST | `createPlaybookTemplate(...)` / `assignPlaybookToVenture(...)` | (route) | L52-60 `requireAuth()` puis `if (!session \|\| !SETUP_ROLES.includes(session.role)) … 403` (`SETUP_ROLES = ["super_admin","staff"]`, L25) — rôle écrit dans la route | ROLE_VISIBLE |

### 1.9 `platform/form-runs` — sous-action `submit` (hub)

| Route | Méthode | Appel observé | Fichier cible | Décision effective (fichier:ligne + extrait) | Verdict |
|---|---|---|---|---|---|
| /platform/form-runs?action=submit | POST | `submitResponse({ run_id, data, status, session })` | src/services/platform/formRuns/submitters.js | L69-212 : L72-73 (existence + `run.status !== "active"`), L79-86 (deadline/auto-close), L92-94 (une seule réponse), L101-110 (limite de soumissions), L131 (réponse déjà décidée). Ce sont des règles d'**état du run**, pas une décision sur l'identité du demandeur : `session.cid` est seulement l'auteur (L93, L179). Aucune capacité/portée/appartenance du caller. | AUTH_SEULE_CONFIRMÉ |

Pour mémoire, la sous-action voisine `status` porte bien `requireAuthorization("runs", "create")`
(handlers/post/status.js L12) — `submit` est la seule sous-action sans décision de permission.

---

## 2. Famille étendue `ventures/[id]/*` + `venture-plan-templates`

Ces routes réutilisent les mêmes gardes déléguées. Les **fonctions de décision** ont été
ouvertes et vérifiées ; les sites d'appel listés proviennent de la recherche des imports des
gardes dans `src/app/api/**/route.js`. Chaque entrée correspond à au moins un verbe qui appelle
la garde et teste son verdict.

Décisions de référence (vérifiées) :

- `requireVentureAccess` — src/lib/ventureAuth.js **L109-131** (L114-117 super_admin ; L124-128
  `relationship.is_member || relationship.is_assigned` ; sinon `session:null`).
  `hasActiveVentureAssignment` — même fichier **L97-107** (L102-103).
  `requireOperationalVentureAccess` — même fichier **L62-75** (L65-73).
  `isStaffActorForVenture` — même fichier **L16-28** (L18-24).
- `resolveVentureScopedAccess` / `resolveVentureScopedDecision` — src/lib/ventureScopedAccess.js
  **L56-97** (L67-68 super-admin ; L72-79 capacité ; L82-94 portée `venture_own`).
- `resolvePlanAccess` / `allowsPlanAction` — src/services/ventures/operatingPlans.js
  **L62-71** (L65 global ; L69 aucune assignation → `ok:false`) et **L89-102**
  (L93 `delete` interdit ; L98-99 action d'écriture + `venture_wide`).
- `canManageVentureDocumentTypes` — src/services/ventures/ventureDocumentTypes.js **L206-213**
  (L208 super_admin ; L211-212 `selectLeadManagerAssignment`).
- `canDefineDeliverables` / `canReviewDeliverable` — src/lib/ventureDeliverables.js
  **L21-23** / **L30-37** (L31 super_admin ; L34 aucun scope → refus ; L35-36 portée).

| Route | Garde déléguée observée | Décision (fichier:ligne) | Verdict |
|---|---|---|---|
| /ventures/[id]/advisors | `requireVentureAccess(id)` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/analytics | `requireVentureAccess(id)` + `isStaffActorForVenture(id, session)` | lib/ventureAuth.js L109-131 ; L16-28 (L18 super_admin, L24 `hasActiveVentureAssignment`) | CONTRÔLÉ |
| /ventures/[id]/coaching | `requireVentureAccess(id)` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/coach-invite | `resolvePlanAccess(id, session)` + `allowsPlanAction(access, "manage")` | operatingPlans.js L62-71 ; L89-102 | CONTRÔLÉ |
| /ventures/[id]/deliverables | `requireVentureAccess(id)` + `requireVentureScopedAccess(...)` + `canDefineDeliverables` / `canReviewDeliverable` | lib/ventureAuth.js L109-131 ; lib/ventureScopedAccess.js L99-176 ; lib/ventureDeliverables.js L21-23 / L30-37 | CONTRÔLÉ |
| /ventures/[id]/deliverables/upload | `requireVentureAccess(id)` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/document-types | `requireVentureAccess(id)` (GET) + `canManageVentureDocumentTypes(req.session, ventureId)` (POST) | lib/ventureAuth.js L109-131 ; ventureDocumentTypes.js L206-213 | CONTRÔLÉ |
| /ventures/[id]/document-types/[typeId] | `canManageVentureDocumentTypes(req.session, ventureId)` (via `requireManage`) | ventureDocumentTypes.js L206-213 (route L25-33) | CONTRÔLÉ |
| /ventures/[id]/documents | `requireVentureAccess(id)` + `isFounderForDocument*` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/documents/[docId]/permissions | `requireVentureAccess(id)` + `isFounderForDocumentPermissions` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/documents/[docId]/reviews | `requireVentureAccess(id)` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/documents/[docId]/transition | `requireVentureAccess(id)` + `isFounderForDocumentTransition` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/documents/[docId]/versions | `requireVentureAccess(id)` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/feedback | `requireVentureAccess(id)` + `isStaffActorForVenture(id, session)` | lib/ventureAuth.js L109-131 ; L16-28 | CONTRÔLÉ |
| /ventures/[id]/fundraising | `requireVentureAccess(id)` + `isStaffActorForVenture(id, session)` | lib/ventureAuth.js L109-131 ; L16-28 | CONTRÔLÉ |
| /ventures/[id]/operating-plans | `resolvePlanAccess(...)` + `allowsPlanAction(...)` | operatingPlans.js L62-71 ; L89-102 | CONTRÔLÉ |
| /ventures/[id]/progress | `requireVentureAccess(id)` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/progress-reports | `resolvePlanAccess(...)` + `allowsPlanAction(...)` + `isStaffActorForVenture` | operatingPlans.js L62-71, L89-102 ; lib/ventureAuth.js L16-28 | CONTRÔLÉ |
| /ventures/[id]/reports | `requireVentureAccess(id)` + `isStaffActorForVenture(id, session)` | lib/ventureAuth.js L109-131 ; L16-28 | CONTRÔLÉ |
| /ventures/[id]/sessions | `requireVentureScopedAccess(...)` + `isStaffActorForVenture` + `checkSessionManagement` | lib/ventureScopedAccess.js L56-97 ; lib/ventureAuth.js L16-28 | CONTRÔLÉ |
| /ventures/[id]/sessions/upload | `requireVentureAccess(id)` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /ventures/[id]/submissions/review-queue | `requireVentureAccess(id)` + `isStaffActorForVenture` + scopes | lib/ventureAuth.js L109-131 ; L16-28 | CONTRÔLÉ |
| /ventures/[id]/tasks/[taskId]/submissions | `requireVentureAccess(id)` + `isStaffActorForVenture` | lib/ventureAuth.js L109-131 ; L16-28 | CONTRÔLÉ |
| /ventures/[id]/venture-history | `requireVentureScopedAccess(...)` + `isStaffActorForVenture` | lib/ventureScopedAccess.js L56-97 ; lib/ventureAuth.js L16-28 | CONTRÔLÉ |
| /ventures/[id]/verification/upload | `requireVentureAccess(id)` | lib/ventureAuth.js L109-131 | CONTRÔLÉ |
| /venture-plan-templates | `resolvePlanAccess` + `allowsPlanAction(..., "manage")` (POST) | operatingPlans.js L62-71 ; L89-102 | CONTRÔLÉ |
| /venture-plan-templates/apply | `resolvePlanAccess` + `allowsPlanAction` | operatingPlans.js L62-71 ; L89-102 | CONTRÔLÉ |

---

## 3. Résumé chiffré

### 3.1 Ensemble des points de départ cités (section 1)

Handlers examinés : **53** (dont 3 avec décision de rôle visible dans la route, exclus des compteurs).

| Verdict | Handlers |
|---|---|
| CONTRÔLÉ | 49 |
| AUTH_SEULE_CONFIRMÉ | 4 |
| INDÉTERMINABLE | 0 |
| (hors compteurs) ROLE_VISIBLE | 3 |

Routes restant **AUTH_SEULE_CONFIRMÉ** dans la section 1 :

- `GET /api/ventures/[id]/founders/[founderId]`
- `GET /api/program-types`
- `GET /api/venture-templates`
- `POST /api/platform/form-runs?action=submit`

### 3.2 Famille étendue (section 2)

Routes avec garde déléguée confirmée : **26**, toutes `CONTRÔLÉ` (décision partagée vérifiée).
Aucune n'est `AUTH_SEULE_CONFIRMÉ` ni `INDÉTERMINABLE` **parmi celles listées** ; l'exhaustivité
verbe par verbe n'a pas été faite au-delà des sites d'appel détectés (voir Incertitudes).

---

## Incertitudes

- **Correction du jugement sur la classe :** `GET /api/ventures/[id]/founders/[founderId]` était
  classé AUTH_SEULE dans D ; il est confirmé AUTH_SEULE : `createHandler` n'authentifie que la
  session (createHandler.js L62) et la route ne vérifie que `founder.venture_id === id` (L17),
  sans appartenance ni capacité. C'est une **lecture d'enregistrement par identifiant** — un
  contrôle d'objet manque. À signaler comme tel (possible IDOR numérique).
- **`platform/form-runs` hub.** Seule la sous-action `submit` est AUTH_SEULE (submitters.js
  L69-212, règles d'état uniquement). Les 19 autres sous-actions portent une décision de
  capacité ; elles sont hors périmètre D2.
- **Famille `ventures/[id]/*` étendue.** La section 2 est établie à partir des sites d'appel
  détectés par recherche des imports de gardes (`requireVentureAccess`, `hasActiveVentureAssignment`,
  `resolvePlanAccess`, `resolveVentureScopedAccess`, `canManageVentureDocumentTypes`,
  `checkVentureMember*`, `canManageFounders`, `isStaffActorForVenture`). Chaque fonction de décision
  a été ouverte et vérifiée, mais **je n'ai pas lu chaque `route.js` verbe par verbe** : une
  méthode d'un même fichier pourrait appeler la garde différemment. Les fichiers non détectés par
  ces motifs (garde par `requireAuthorization`/`requireVentureScopedAccess` d'un autre module)
  restent à couvrir.
- **Décisions « personnelles » non examinées.** L'inventaire D range ~21 `participant/*`, 19
  `tasks/*` personnels, `profile/*`, `me/*`, `notifications/*`, `feedback`, `intents/*`,
  `blockers/*`, `retro/standup`, `lms/*` apprenant, `integrations/google-calendar/*`, `upload`,
  `contact-emails` en PERSONNELLE_LEGITIME. Ceux-là n'ont pas été suivis ici faute d'indice de
  décision déléguée ; ils restent non couverts par D2.
- **`hasProgramManagementAccess`.** Pour `GET /participant-programs`, la décision combine
  `requireAuthorization("programs","view")` et `hasProgramManagementAccess(role)` (capabilities) :
  je n'ai pas ouvert `server/authz/capabilities.js` ligne à ligne, mais le chemin alternatif
  `requireAssignmentAccess` est, lui, vérifié.
- **Indirections dynamiques.** Plusieurs routes chargent la garde par `await import(...)` (ex.
  `@/lib/ventureAuth` dans members, lead, lifecycle) : le chemin est lisible et a été suivi ; aucune
  indirection de type table de dispatch non résolvable n'a été rencontrée sur ces points.
- **Roles construits dynamiquement.** Pour les `requireAuth([...])` dont la liste est inline
  (advisors, coaching, documents), la décision de rôle est visible dans la route ; ces routes
  cumulent donc rôle **et** garde déléguée. Le verdict retenu (CONTRÔLÉ) s'appuie sur la garde
  déléguée vérifiée.
