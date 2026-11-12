# Étape 0 — inventaire des décisions « qui » encore dans le code

Généré le 2026-11-12T11:02:46.074Z. **Aucun accès n'a été modifié.**

Ce document est la liste de travail des étapes 1 à 6 : chaque
section indique ce qui doit cesser de décider dans le code.

## Résumé

| Indicateur | Valeur |
|---|---|
| Rôles dans la table de menu | 6 |
| Destinations du menu | 73 |
| Destinations sans droit déclaré | 43 |
| Espaces | 3 |
| Entrées de la table d'arrivée | 7 |
| Mentions du propriétaire | 340 |
|   dont décisions probables | 101 |
| Fichiers avec une décision « propriétaire » | 71 |
| Comparaisons de rôle hors moteur (lignes) | 189 |
| Fichiers concernés | 115 |
| Marqueurs de seed à l'exécution | 7 |

> La classification des mentions du propriétaire est **heuristique**.
> Chaque ligne est listée avec son extrait : la colonne « catégorie » propose, elle ne tranche pas.

## 1. Table de menu par rôle (à supprimer — étape 3)

### `super_admin`

- Sections : dashboard, crm, communication, programs, ventures, investors, finance, operations, intelligence, reports, knowledge, lms, settings
- Enfants surchargés : 10
- Adresses surchargées : —
- Icônes surchargées : —

### `staff`

- Sections : dashboard, weekly_ops, programs, my_projects, communication
- Enfants surchargés : 1
- Adresses surchargées : dashboard, programs, messages
- Icônes surchargées : —

### `member`

- Sections : dashboard
- Enfants surchargés : 0
- Adresses surchargées : dashboard
- Icônes surchargées : —

### `team`

- Sections : dashboard, programs
- Enfants surchargés : 0
- Adresses surchargées : dashboard, programs
- Icônes surchargées : —

### `finance`

- Sections : dashboard, profile
- Enfants surchargés : 0
- Adresses surchargées : dashboard, profile
- Icônes surchargées : dashboard

### `crm`

- Sections : crm, communication
- Enfants surchargés : 2
- Adresses surchargées : crm_dashboard, all_contacts, crm_timeline, crm_membership, crm_duplicates
- Icônes surchargées : —

## 2. Destinations du menu sans droit déclaré

Ces destinations ne peuvent pas encore être dérivées des droits : il faut leur associer un droit, ou les déclarer ouvertes à tous.

| Destination | Droit exigé |
|---|---|
| `dashboard` | aucun |
| `announcements` | aucun |
| `forms` | aucun |
| `groups` | aucun |
| `all_programs` | aucun |
| `create_program` | aucun |
| `progress` | aucun |
| `all_ventures` | aucun |
| `investors_manage` | aucun |
| `investors_dashboard` | aucun |
| `investors_review` | aucun |
| `investors_campaigns` | aucun |
| `investors_relationships` | aucun |
| `investors_portfolio` | aucun |
| `investors_deal_flow` | aucun |
| `investors_introductions` | aucun |
| `investors_metrics` | aucun |
| `internal_ops_board` | aucun |
| `all_projects` | aucun |
| `create_project` | aucun |
| `tasks` | aucun |
| `blockers` | aucun |
| `standup` | aucun |
| `retro` | aucun |
| `intelligence` | aucun |
| `program_reports` | aucun |
| `internal_reports` | aucun |
| `metrics` | aucun |
| `knowledge_base` | aucun |
| `lms_courses` | aucun |
| `lms_registrations` | aucun |
| `system` | aucun |
| `audit_logs` | aucun |
| `access_summary` | aucun |
| `permissions` | aucun |
| `my_programs` | aucun |
| `reviews` | aucun |
| `profile` | aucun |
| `learning` | aucun |
| `certificates` | aucun |
| `timeline` | aucun |
| `portfolio` | aucun |
| `activity` | aucun |

30 destinations ont déjà un droit déclaré (détail dans le JSON).

## 3. Espaces (à trancher — étape 5)

| Espace | Accueil | Identités |
|---|---|---|
| `member` | `/member` | member, participant, founder, investor, facilitator, team |
| `staff` | `/staff` | staff, program_manager, finance, crm |
| `admin` | `/admin` | super_admin |

Identités refusées dans un espace d'exploitation : member, participant, founder, investor

## 4. Arrivée après connexion (à supprimer — étape 4)

| Rôle | Adresse codée | Dépend des relations |
|---|---|---|
| `super_admin` | `/admin` | non |
| `program_manager` | `/staff/program-manager` | non |
| `staff` | `/staff` | non |
| `facilitator` | `/member/facilitator` | non |
| `participant` | `/member/participant` | oui |
| `finance` | `/staff/finance` | non |
| `investor` | `/member/investor/dashboard` | non |

Rôles internes autorisés aux rapports opérationnels : super_admin, staff, program_manager

## 5. Valeurs d'accès fournies par le code (à déplacer — étape 1)

### Éligibilité par rôle de base

| Fonctionnalité | Identités éligibles |
|---|---|
| `crm` | super_admin, staff |
| `communication` | super_admin, staff |
| `programs` | super_admin, staff, member |
| `ventures` | super_admin, staff, member |
| `investors` | super_admin, staff, member |
| `finance` | super_admin, staff |
| `operations` | super_admin, staff |
| `reports` | super_admin, staff |
| `knowledge` | super_admin, staff |
| `lms` | super_admin, staff |
| `security` | super_admin, staff |
| `settings` | super_admin, staff |

### Éligibilité par profil

| Fonctionnalité | Profils éligibles |
|---|---|
| `communication` | program_manager, participant, investor |
| `programs` | program_manager, participant, facilitator |
| `ventures` | program_manager, investor, founder |
| `investors` | investor |
| `operations` | program_manager, participant, investor |
| `reports` | program_manager |
| `lms` | program_manager |

### Rôle → profil par défaut et catalogue de profils

| Profil | Contexte | Rôles de base autorisés |
|---|---|---|
| `participant` | program | member |
| `learner` | lms | member |
| `founder` | venture | member |
| `investor` | investor | member |
| `facilitator` | program | staff, member |
| `program_manager` | program | staff |
| `venture_manager` | venture | staff |
| `course_manager` | staff | staff |

Rôles de base acceptés : super_admin, staff, member

Règle profil ↔ rôle : `block`

Marqueurs de seed à l'exécution : `eligibility-bootstrap-seed`, `eligibility-lms-bootstrap-v2`, `eligibility-ventures-member-v1`, `eligibility-programs-assignment-v1`, `eligibility-profile-defaults-v1`, `eligibility-baseline-roles-only-v1`, `legacy-identities-normalization-v1`

## 6. Mentions du propriétaire, par catégorie

| Catégorie | Nombre |
|---|---|
| label | 111 |
| decision | 101 |
| comment | 99 |
| default | 21 |
| other | 5 |
| routing | 3 |

### Décisions probables — lignes à traiter

| Fichier | Extrait |
|---|---|
| `src/app/api/admin/projects/[id]/reports/generate/route.js:18` | const authError = await requireAuth(["super_admin", "staff", "program_manager"]); |
| `src/app/api/attendance/route.js:99` | session?.role !== "super_admin" && |
| `src/app/api/auth/invite/route.js:36` | const authError = await requireAuth(["super_admin", "program_manager", "staff"]); |
| `src/app/api/contacts/full-state/route.js:26` | if (!["super_admin", "staff", "program_manager"].includes(session?.role)) { |
| `src/app/api/deliverables/route.js:40` | { roles: ["staff", "super_admin", "program_manager", "team", "member"] }, |
| `src/app/api/facilitators/invite-bulk/route.js:84` | const authError = await requireAuth(["super_admin", "program_manager", "staff"]); |
| `src/app/api/families/route.js:155` | const authError = await requireAuth(["super_admin", "program_manager", "staff"]); |
| `src/app/api/families/route.js:187` | const authError = await requireAuth(["staff", "super_admin"]); |
| `src/app/api/families/route.js:214` | const authError = await requireAuth(["staff", "super_admin"]); |
| `src/app/api/forensic/user-role/route.js:20` | if (user.role === "super_admin" \|\| user.id === "sa") return "super_admin"; |
| `src/app/api/group-members/route.js:24` | const authError = await requireAuth(["staff", "super_admin"]); |
| `src/app/api/group-members/route.js:74` | const authError = await requireAuth(["staff", "super_admin"]); |
| `src/app/api/groups/route.js:22` | const authError = await requireAuth(["super_admin", "staff", "program_manager"]); |
| `src/app/api/investor/approval/route.js:18` | const authError = await requireAuth(["super_admin", "staff"]); |
| `src/app/api/investor/profile/route.js:89` | const authError = await requireAuth(["super_admin", "staff"]); |
| `src/app/api/invites/route.js:14` | export const POST = createHandler({ roles: ["staff", "super_admin"] }, async (req) => { |
| `src/app/api/participants/route.js:27` | const authError = await requireAuth(["staff", "super_admin"]); |
| `src/app/api/platform/form-runs/handlers/get.js:259` | const targetSubmitter = session.role === "super_admin" ? submitterId : session.cid; |
| `src/app/api/pm/programs/[id]/route.js:16` | { roles: ["super_admin", "program_manager", "staff"] }, |
| `src/app/api/pm/reports/route.js:32` | const fullAccess = ["staff", "super_admin", "program_manager"].includes( |
| `src/app/api/programs/route.js:22` | const authError = await requireAuth(["staff", "super_admin"]); |
| `src/app/api/programs/route.js:107` | const authError = await requireAuth(["staff", "super_admin"]); |
| `src/app/api/retros/submit/route.js:73` | if (session.role !== "super_admin" && String(user_id) !== String(session.cid)) { |
| `src/app/api/sessions/route.js:8` | export const POST = createHandler({ roles: ["staff", "super_admin", "program_manager", "member"] }, async (req) => { |
| `src/app/api/sessions/route.js:53` | export const GET = createHandler({ roles: ["staff", "super_admin", "program_manager", "member"] }, async (req) => { |
| `src/app/api/standups/submit/route.js:69` | if (session.role !== "super_admin" && String(user_id) !== String(session.cid)) { |
| `src/app/api/v2/program-staff/route.js:30` | const authError = await requireAuth(["super_admin", "program_manager", "staff"]); |
| `src/app/api/v2/program-staff/route.js:48` | const authError = await requireAuth(["super_admin", "program_manager", "staff"]); |
| `src/app/api/v2/program-staff/route.js:64` | const authError = await requireAuth(["super_admin", "program_manager", "staff"]); |
| `src/app/api/v2/program-staff/route.js:80` | const authError = await requireAuth(["super_admin", "program_manager", "staff"]); |
| `src/app/api/ventures/[id]/blockers/route.js:69` | if (blockerCreator.rows[0].user_id !== session.cid && !["staff","super_admin","program_manager"].includes(session.role)) { |
| `src/app/api/ventures/[id]/my-access/route.js:156` | is_super_admin: isSuperAdmin, |
| `src/app/api/ventures/[id]/reporting/settings/route.js:23` | export const PUT = createHandler({ roles: ["super_admin", "staff"] }, async (req) => { |
| `src/app/api/ventures/assigned/route.js:26` | if (["super_admin"].includes(session.role)) { |
| `src/app/api/ventures/lead-manager/home/route.js:27` | if (session.role === "super_admin") { |
| `src/app/login/page.js:72` | userRole === "super_admin" \|\| userRole === "staff" |
| `src/components/shared/messaging/chat/messagingMode.js:32` | if (isSuperAdmin) return "super_admin"; |
| `src/lib/featureAccess.js:55` | const WARNING_BYPASS_ROLES = ["super_admin"]; |
| `src/lib/masterNavigation/builders.js:101` | const canOpenAdmin = role === "super_admin"; |
| `src/lib/notificationLinks.js:50` | ["staff", "super_admin", "program_manager"].includes(role); |
| `src/lib/ventureDeliverables.js:33` | if (role === "super_admin") return true; |
| `src/models/investor/diligenceAndPipeline/pipeline.js:250` | } else if (stage && (role === "super_admin" \|\| role === "staff")) { |
| `src/models/platform/roles.js:85` | if (normalizedRole === "super_admin" \|\| legacySa) return "super_admin"; |
| `src/models/programs/core/programList.js:85` | !["super_admin", "program_manager", "staff"].includes(session.role) |
| `src/server/auth/session.js:235` | session.role !== "super_admin" |
| `src/services/authorization/contextResolver.js:133` | if (role === "super_admin") { |
| `src/services/authorization/profileCatalog.js:173` | if (rawRole === "super_admin") return { allowed: true, reason: "ok" }; |
| `src/services/communications/announcements.js:35` | isSuperAdmin: session.role === "super_admin", |
| `src/services/communications/announcements.js:97` | if (existing.rows[0].author_id !== session.cid && session.role !== "super_admin") { |
| `src/services/communications/announcements.js:126` | if (existing.rows[0].author_id !== session.cid && session.role !== "super_admin") { |
| `src/services/communications/internal-comms/inbox.js:10` | return session.role === "super_admin" \|\| cid === session.cid; |
| `src/services/communications/internal-comms/read.js:23` | session.role !== "super_admin" |
| `src/services/communications/internal-comms/scope.js:166` | if (session.role === "super_admin") { |
| `src/services/communications/internal-comms/send.js:29` | if (effectiveSenderId !== sessionCid && session.role !== "super_admin") { |
| `src/services/communications/internal-comms/send.js:34` | if (target_type === "all" && session.role !== "super_admin") { |
| `src/services/communications/internal-comms/send.js:40` | if (session.role !== "super_admin") { |
| `src/services/communications/ventureNotifications.js:21` | session.role !== "super_admin" |
| `src/services/communications/ventureNotifications.js:32` | session.role === "super_admin" |
| `src/services/contacts/alternativeEmails.js:27` | if (session?.role === "super_admin") return true; |
| `src/services/contacts/registryRead.js:50` | } else if (statusFilter === "archived" && session.role === "super_admin") { |
| `src/services/contacts/registryRead.js:55` | } else if (session.role === "super_admin") { |
| `src/services/dashboard/opReports.js:57` | if (session.role !== "super_admin") { |
| `src/services/dashboard/opReports.js:71` | isSuperAdmin: session.role === "super_admin", |
| `src/services/dashboard/overview/build.js:49` | const isSessionAdmin = session.role === "super_admin" \|\| session.role === "admin"; |
| `src/services/dashboard/userAdmin.js:106` | actor?.role === "super_admin" |
| `src/services/investor/diligence/requestActions.js:43` | const isAdmin = session?.role === "super_admin"; |
| `src/services/investor/pipeline.js:66` | return !ventureId && !(stage && (role === "super_admin" \|\| role === "staff")); |
| `src/services/platform/intents/delete.js:30` | session.role !== "super_admin" && |
| `src/services/platform/intents/detail.js:37` | session.role !== "super_admin" && |
| `src/services/platform/intents/list.js:24` | session.role !== "super_admin" && |
| `src/services/platform/intents/list.js:36` | isSuperAdmin: session.role === "super_admin", |
| `src/services/platform/intents/tasks.js:43` | session.role !== "super_admin" && |
| `src/services/platform/intents/tasks.js:92` | if (finalAssignedTo && session.role !== "super_admin") { |
| `src/services/platform/intents/update.js:44` | session.role !== "super_admin" && |
| `src/services/programs/participantPrograms.js:76` | const authError = await requireAuth(["staff", "super_admin", "program_manager"]); |
| `src/services/programs/participantPrograms.js:143` | const authError = await requireAuth(["staff", "super_admin", "program_manager"]); |
| `src/services/programs/programStaff.js:36` | if (session.role === "super_admin") return; |
| `src/services/projects/collaboration.js:285` | if (!isInviter && role !== "super_admin") { |
| `src/services/tasks/assignments.js:101` | if (role !== "super_admin" && assignment.assigner_id !== userCid) { |
| `src/services/tasks/assignments.js:160` | if (role !== "super_admin") { |
| `src/services/tasks/blockers.js:61` | if (session.role !== "super_admin") { |
| `src/services/tasks/blockers.js:119` | session.role !== "super_admin" && |
| `src/services/tasks/blockers.js:275` | session.role !== "super_admin" && |
| `src/services/tasks/comments.js:137` | role !== "super_admin" |
| `src/services/tasks/comments.js:157` | role !== "super_admin" |
| `src/services/tasks/create.js:85` | !["super_admin", "staff", "program_manager", "team"].includes(role) |
| `src/services/tasks/create.js:203` | if (needsAssignment && role !== "super_admin") { |
| `src/services/tasks/query.js:58` | if (role !== "super_admin" && userId && userId !== sessionCid) { |
| `src/services/tasks/query.js:79` | role !== "super_admin" && |
| `src/services/tasks/query.js:108` | if (role !== "super_admin") { |
| `src/services/tasks/query.js:128` | isSuperAdmin: role === "super_admin", |
| `src/services/tasks/remove.js:40` | role !== "super_admin" && |
| `src/services/tasks/updateEffects.js:235` | if (role !== "super_admin" && !isTaskOwner && !isAssignee && !isOnlyStatusChange) { |
| `src/services/tasks/updateFields/assignment.js:66` | if (role !== "super_admin") { |
| `src/services/tasks/updateGuards.js:45` | role !== "super_admin" && |
| `src/services/tasks/updateGuards.js:65` | role !== "super_admin" && |
| `src/services/ventures/dataRoom/access.js:141` | viewerType: isSuperAdmin ? "super_admin" : internalStaff ? "staff" : "member", |
| `src/spaces/staff/program-manager/components/programs/programTabs.js:29` | roles: ["super_admin", "program_manager"], |
| `src/spaces/staff/program-manager/components/programs/programTabs.js:45` | roles: ["super_admin", "program_manager", "staff"], |
| `src/spaces/staff/program-manager/components/programs/programTabs.js:51` | roles: ["super_admin", "program_manager", "staff"], |
| `src/spaces/staff/program-manager/components/programs/programTabs.js:67` | roles: ["super_admin", "program_manager", "staff"], |

## 7. Comparaisons de rôle hors du moteur

| Motif | Lignes |
|---|---|
| M3 — role === / role !== | 106 |
| M1 — requireAuth([...]) | 26 |
| M4 — .includes(...role...) | 44 |
| M2 — roles: [...] | 13 |

### Par fichier

| Fichier | Lignes |
|---|---|
| `src/services/programs/programStaff.js` | 8 |
| `src/app/api/teams/route.js` | 5 |
| `src/services/participant/submissions.js` | 5 |
| `src/services/ventures/submissions/scope.js` | 5 |
| `src/app/api/families/route.js` | 4 |
| `src/app/api/v2/program-staff/route.js` | 4 |
| `src/services/tasks/query.js` | 4 |
| `src/spaces/staff/program-manager/components/programs/programTabs.js` | 4 |
| `src/app/api/forensic/user-role/route.js` | 3 |
| `src/app/member/(contexts)/investor/organizations/page.js` | 3 |
| `src/server/auth/guards.js` | 3 |
| `src/services/communications/announcements.js` | 3 |
| `src/services/communications/inboxNotifications.js` | 3 |
| `src/services/communications/internal-comms/send.js` | 3 |
| `src/services/dashboard/opReports.js` | 3 |
| `src/services/tasks/blockers.js` | 3 |
| `src/services/ventures/founders.js` | 3 |
| `src/spaces/admin/permissions/center/drawers/CreateProfileDrawer.js` | 3 |
| `src/app/admin/communications/contacts/BulkProgramModal.js` | 2 |
| `src/app/api/attendance/route.js` | 2 |
| `src/app/api/facilitators/invite-bulk/route.js` | 2 |
| `src/app/api/group-members/route.js` | 2 |
| `src/app/api/programs/route.js` | 2 |
| `src/app/api/sessions/route.js` | 2 |
| `src/app/api/standups/submit/route.js` | 2 |
| `src/app/api/ventures/[id]/members/route.js` | 2 |
| `src/lib/featureAccess.js` | 2 |
| `src/lib/identity.js` | 2 |
| `src/services/communications/internal-comms/scope.js` | 2 |
| `src/services/communications/ventureNotifications.js` | 2 |
| `src/services/contacts/alternativeEmails.js` | 2 |
| `src/services/contacts/registryRead.js` | 2 |
| `src/services/investor/pipeline.js` | 2 |
| `src/services/platform/intents/list.js` | 2 |
| `src/services/platform/intents/tasks.js` | 2 |
| `src/services/programs/participantPrograms.js` | 2 |
| `src/services/tasks/assignments.js` | 2 |
| `src/services/tasks/comments.js` | 2 |
| `src/services/tasks/create.js` | 2 |
| `src/services/tasks/updateGuards.js` | 2 |
| `src/services/ventures/verification/categories.js` | 2 |
| `src/app/api/admin/projects/[id]/reports/generate/route.js` | 1 |
| `src/app/api/auth/invite/route.js` | 1 |
| `src/app/api/auth/invite-family/route.js` | 1 |
| `src/app/api/contacts/full-state/route.js` | 1 |
| `src/app/api/deliverables/route.js` | 1 |
| `src/app/api/engineering/permissions/profile-role-defaults/route.js` | 1 |
| `src/app/api/facilitator-reviews/route.js` | 1 |
| `src/app/api/groups/route.js` | 1 |
| `src/app/api/investor/approval/route.js` | 1 |
| `src/app/api/investor/profile/route.js` | 1 |
| `src/app/api/invites/route.js` | 1 |
| `src/app/api/participant-programs/bulk/route.js` | 1 |
| `src/app/api/participants/route.js` | 1 |
| `src/app/api/platform/form-runs/handlers/get.js` | 1 |
| `src/app/api/pm/programs/[id]/route.js` | 1 |
| `src/app/api/program-staff/route.js` | 1 |
| `src/app/api/retros/submit/route.js` | 1 |
| `src/app/api/ventures/[id]/blockers/route.js` | 1 |
| `src/app/api/ventures/[id]/documents/[docId]/permissions/route.js` | 1 |
| `src/app/api/ventures/[id]/documents/[docId]/transition/route.js` | 1 |
| `src/app/api/ventures/[id]/founders/[founderId]/route.js` | 1 |
| `src/app/api/ventures/[id]/founders/route.js` | 1 |
| `src/app/api/ventures/[id]/reporting/settings/route.js` | 1 |
| `src/app/api/ventures/[id]/tasks/[taskId]/submissions/route.js` | 1 |
| `src/app/api/ventures/[id]/tasks/route.js` | 1 |
| `src/app/api/ventures/[id]/verification/route.js` | 1 |
| `src/app/api/ventures/assigned/route.js` | 1 |
| `src/app/api/ventures/lead-manager/home/route.js` | 1 |
| `src/app/api/ventures/route.js` | 1 |
| `src/app/staff/dashboard/page.js` | 1 |
| `src/components/shared/crm/useMembershipState.js` | 1 |
| `src/components/shared/dashboard/ProfileView.js` | 1 |
| `src/components/shared/dashboard/unified-dashboard/MyProjectsCard.js` | 1 |
| `src/lib/api/createHandler.js` | 1 |
| `src/lib/masterNavigation/builders.js` | 1 |
| `src/lib/notificationLinks.js` | 1 |
| `src/lib/ventureDeliverables.js` | 1 |
| `src/models/investor/diligenceAndPipeline/pipeline.js` | 1 |
| `src/models/platform/registry.js` | 1 |
| `src/models/programs/core/programList.js` | 1 |
| `src/server/auth/session.js` | 1 |
| `src/services/communications/internal-comms/inbox.js` | 1 |
| `src/services/communications/internal-comms/read.js` | 1 |
| `src/services/contacts/registration.js` | 1 |
| `src/services/contacts/update.js` | 1 |
| `src/services/dashboard/overview/build.js` | 1 |
| `src/services/dashboard/userAdmin.js` | 1 |
| `src/services/investor/campaigns.js` | 1 |
| `src/services/investor/diligence/requestActions.js` | 1 |
| `src/services/investor/organizations.js` | 1 |
| `src/services/participant/fullState.js` | 1 |
| `src/services/platform/intents/delete.js` | 1 |
| `src/services/platform/intents/detail.js` | 1 |
| `src/services/platform/intents/update.js` | 1 |
| `src/services/programs/teams.js` | 1 |
| `src/services/projects/collaboration.js` | 1 |
| `src/services/tasks/remove.js` | 1 |
| `src/services/tasks/teamBoard.js` | 1 |
| `src/services/tasks/updateEffects.js` | 1 |
| `src/services/tasks/updateFields/assignment.js` | 1 |
| `src/services/ventures/memberRoster.js` | 1 |
| `src/services/ventures/operatingPlans.js` | 1 |
| `src/services/ventures/people.js` | 1 |
| `src/services/ventures/scope.js` | 1 |
| `src/services/ventures/submissions/createSubmission.js` | 1 |
| `src/services/ventures/submissions/review.js` | 1 |
| `src/services/workspace/calendar.js` | 1 |
| `src/services/workspace/navigation.js` | 1 |
| `src/spaces/admin/permissions/center/personAccess.js` | 1 |
| `src/spaces/staff/core/components/ProjectsView.js` | 1 |
| `src/spaces/staff/core/components/op-report/SummaryOwnerCard.js` | 1 |
| `src/spaces/staff/core/components/project-detail/TeamTab.js` | 1 |
| `src/spaces/staff/program-manager/components/program-workspace/DeployTeamModal.js` | 1 |
| `src/spaces/staff/program-manager/components/programs/programWorkspaceSelectors.js` | 1 |

Le détail ligne par ligne est dans le JSON.
