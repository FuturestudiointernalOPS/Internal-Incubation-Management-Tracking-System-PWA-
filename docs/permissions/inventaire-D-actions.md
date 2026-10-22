# Inventaire des actions exposees (routes API) et de leur controle d acces

Perimetre : tous les fichiers src/app/api/**/route.js (Next.js App Router). Inventaire en lecture seule.

Methodes de l inventaire : enumeration des route.js et de leurs methodes HTTP exportees ; pour chaque handler, detection statique du mecanisme de garde dans le corps du handler (y compris les helpers definis au niveau module et les fonctions de garde importees), puis lecture ciblee des fichiers et services pour les cas ambigus. Chaque ligne correspond a un handler reel, avec son chemin exact.

## 1. Reconciliation des comptages

| Mesure | Valeur | Methode |
|---|---|---|
| Fichiers route.js | 435 | find src/app/api -name route.js |
| Handlers HTTP exportes | 748 | export (async) function/const GET...OPTIONS |

Les comptages fournis au depart (435 fichiers, 535 handlers) divergent : le decompte reel des handlers exportes est 748. L ecart vient du fait que de nombreux fichiers exportent la methode sous la forme export const X = createHandler(...), et que certaines routes (platform/form-runs) sont des hubs de dispatch. Le nombre d appels createHandler( dans les route.js est de 233 ; requireAuth( de 220 ; requireAuthorization( de 253 ; requireScopedAccess( : 0 dans les routes (14 occurrences ailleurs, services/modeles).

## 2. Legende des mecanismes

| Tag | Signification |
|---|---|
| createHandler( | enveloppe : initDb + requireAuth (auth seule) |
| roles:[...] | liste de roles globaux (grille grossiere historique) |
| requireAuth( | verifie la session (et eventuellement une liste de roles) |
| requireAuthorization( | moteur de capacites centralise (module, capacite, niveau) |
| requireVentureScopedAccess( | portee venture centralisee (capacite + scope venture_own) |
| requireProgramScope( | portee programme centralisee (program_staffed) |
| requireVentureAccess( | appartenance a un venture (membre ou staff assigne) |
| requireAssignmentAccess / requireProjectAccess / requireProgramFacilitator | gardes de ressource (services/authorization/resourceGuards) |
| assertNoParticipantFacilitatorConflict | garde de conflit (409) |
| resolvePlanAccess | portee d un plan d operation (service ventures/operatingPlans) |
| canManageFounders (service) | decision domaine (services/ventures/founders) |
| getSession( | lecture de session + controle manuel (401 si absent) |
| secret | secret partage de tache planifiee (x-cron-secret / Bearer) |
| rateLimit | limitation de debit (pas une autorisation) |
| webhook | signature de webhook (provider.verifyWebhookSignature / Svix / X-Goog-Channel-Token) |

Regroupement par famille (repertoire racine sous src/app/api) : Public = public, s, respond, verify, health, ready, forms ; Auth / compte = auth, invites, me, profile, org-membership ; Admin / superadmin / securite = admin, superadmin, migrate, forensic, audit-log, audit-logs, security, system, data, dashboard, intelligence, api-keys, errors ; Staff (operations partagees) = activity, attendance, blockers, calendar, categories, contact-emails, contacts, deliverables, documents, evaluation, events, families, feedback, followups, group-members, groups, internal-comms, intents, journey-reports, journey-templates, knowledge, kpis, kpi-progress, notifications, op-reports, participants, people, program-staff, program-types, progress, projects, responsibilities, retros, run-export, segments, send-pending, sessions, standups, submissions, tasks, upload, user-groups, v2, workspaces, venture-kpi-definitions, venture-options, venture-permissions, venture-plan-templates, venture-templates ; Program Manager = pm, programs, participant-programs ; Participant = participant ; Investisseur = investor ; CRM = crm, campaigns ; Finance = finance ; Equipe = teams, team-tasks ; Facilitateur = facilitator-reviews, facilitators ; Engineering = engineering ; Platform / Webhooks / Integrations = platform, webhooks, integrations, reminders ; Autres (announcements, LMS) = announcements, lms.

## Famille : Public

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /forms/[form_id] | GET | non | - | - | SANS_DECISION |
| /forms | GET | non | - | - | SANS_DECISION |
| /forms | POST | non | - | - | SANS_DECISION |
| /forms | PUT | non | - | - | SANS_DECISION |
| /forms | DELETE | non | - | - | SANS_DECISION |
| /health | GET | non | - | - | SANS_DECISION |
| /public/checkout | GET | non | - | - | SANS_DECISION |
| /public/checkout | POST | non | - | - | SANS_DECISION |
| /public/course-match | GET | non | - | - | SANS_DECISION |
| /public/group-info | GET | non | - | - | SANS_DECISION |
| /public/register | POST | non | - | - | SANS_DECISION |
| /ready | GET | non | - | - | SANS_DECISION |
| /respond | POST | non | - | - | SANS_DECISION |
| /s/public-draft | POST | non | - | - | SANS_DECISION |
| /s/public-draft | GET | non | - | - | SANS_DECISION |
| /s/public-run | GET | non | - | - | SANS_DECISION |
| /s/public-submit | POST | non | - | - | SANS_DECISION |
| /verify/certificate/[token] | GET | non | - | - | SANS_DECISION |

## Famille : Auth / compte

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /auth/activate | GET | non | - | - | SANS_DECISION |
| /auth/activate | POST | non | - | - | SANS_DECISION |
| /auth/forgot-password | POST | non | - | - | SANS_DECISION |
| /auth/invite-family | POST | oui | conflictGuard | - | CENTRALISE |
| /auth/invite | POST | oui | requireAuthorization | - | CENTRALISE |
| /auth/language | PUT | oui | - | - | AUTH_SEULE |
| /auth/login | POST | oui | - | - | AUTH_SEULE |
| /auth/resend-invite/[cid] | POST | oui | - | ["super_admin"] | ROLE |
| /auth/reset-password | POST | non | - | - | SANS_DECISION |
| /auth/revoke/[cid] | POST | oui | - | ["super_admin"] | ROLE |
| /auth/session-login | POST | oui | - | - | AUTH_SEULE |
| /auth/session-logout | POST | non | - | - | SANS_DECISION |
| /auth/session | GET | oui | - | - | AUTH_SEULE |
| /auth/setup-password | POST | non | - | - | SANS_DECISION |
| /auth/setup-password/validate | GET | non | - | - | SANS_DECISION |
| /invites/[token] | GET | non | - | - | SANS_DECISION |
| /invites/[token] | POST | oui | conflictGuard | - | CENTRALISE |
| /invites | POST | oui | requireProgramScope | ["staff", "super_admin"] | CENTRALISE |
| /invites | GET | oui | requireAuthorization | - | CENTRALISE |
| /me/permissions | GET | oui | - | - | AUTH_SEULE |
| /me/relationships | GET | oui | - | - | AUTH_SEULE |
| /org-membership | GET | oui | requireAuthorization | - | CENTRALISE |
| /org-membership | PUT | oui | requireAuthorization | - | CENTRALISE |
| /profile/history | GET | oui | - | - | AUTH_SEULE |
| /profile/photo | POST | oui | - | - | AUTH_SEULE |
| /profile | GET | oui | - | - | AUTH_SEULE |
| /profile | PUT | oui | - | - | AUTH_SEULE |

## Famille : Admin / superadmin / securite

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /admin/analytics | GET | oui | - | - | ROLE |
| /admin/analytics/users | GET | oui | - | - | ROLE |
| /admin/approve-user | POST | oui | requireAuthorization | - | CENTRALISE |
| /admin/blockers | GET | oui | - | ["super_admin"] | ROLE |
| /admin/bulk-upload | POST | oui | requireAuthorization | - | CENTRALISE |
| /admin/finance/data-sources | GET | oui | - | ["super_admin"] | ROLE |
| /admin/fix-participant | POST | oui | - | - | ROLE |
| /admin/pending-users | GET | oui | requireAuthorization | - | CENTRALISE |
| /admin/projects/[id]/approvals | GET | oui | requireProjectAccess | - | CENTRALISE |
| /admin/projects/[id]/approvals | POST | oui | requireProjectAccess | - | CENTRALISE |
| /admin/projects/[id]/reports/generate | POST | oui | requireProjectAccess | - | CENTRALISE |
| /admin/projects/[id] | GET | oui | requireProjectAccess | - | CENTRALISE |
| /admin/projects/[id]/updates | GET | oui | requireProjectAccess | - | CENTRALISE |
| /admin/projects/[id]/updates | POST | oui | requireProjectAccess | - | CENTRALISE |
| /admin/projects | GET | oui | - | - | ROLE |
| /admin/reject-user | POST | oui | requireAuthorization | - | CENTRALISE |
| /admin/run-migration | POST | oui | - | - | ROLE |
| /admin/tasks | GET | oui | - | ["super_admin"] | ROLE |
| /admin/ventures/create | POST | oui | - | ["super_admin"] | ROLE |
| /admin/ventures | GET | oui | - | ["super_admin"] | ROLE |
| /admin/ventures | PATCH | oui | - | ["super_admin"] | ROLE |
| /api-keys/[id] | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /api-keys/[id] | PATCH | oui | requireAuthorization | - | CENTRALISE |
| /api-keys | GET | oui | requireAuthorization | - | CENTRALISE |
| /api-keys | POST | oui | requireAuthorization | - | CENTRALISE |
| /audit-log | GET | oui | - | ["super_admin"] | ROLE |
| /audit-logs/[id] | GET | oui | - | ["super_admin", "security_officer"] | ROLE |
| /audit-logs | GET | oui | - | ["super_admin", "security_officer"] | ROLE |
| /dashboard | GET | oui | - | - | ROLE |
| /data | GET | oui | - | - | ROLE |
| /data | POST | oui | - | - | ROLE |
| /errors | POST | non | - | - | SANS_DECISION |
| /errors | GET | oui | requireAuthorization | - | CENTRALISE |
| /errors | PATCH | oui | requireAuthorization | - | CENTRALISE |
| /forensic/user-role | GET | oui | - | ["super_admin"] | ROLE |
| /intelligence/metrics | GET | oui | - | ["super_admin"] | ROLE |
| /migrate/phase0 | GET | oui | - | - | ROLE |
| /migrate/phase1 | POST | oui | - | - | ROLE |
| /migrate/phase1 | GET | oui | - | - | ROLE |
| /migrate/phase5 | POST | oui | - | - | ROLE |
| /migrate/phase5 | GET | oui | - | - | ROLE |
| /security/events | GET | oui | - | ["super_admin", "security_officer"] | ROLE |
| /security/events | PATCH | oui | - | ["super_admin", "security_officer"] | ROLE |
| /security/login-history | GET | oui | - | ["super_admin", "security_officer", "program_manager"] | ROLE |
| /security/sessions | GET | oui | - | ["super_admin", "security_officer"] | ROLE |
| /security/sessions | POST | oui | - | ["super_admin", "security_officer"] | ROLE |
| /superadmin/full-state | GET | oui | - | ["super_admin"] | ROLE |
| /superadmin/groups/assignment | POST | oui | conflictGuard | ["super_admin"] | CENTRALISE |
| /superadmin/standard-types | GET | oui | - | ['super_admin'] | ROLE |
| /superadmin/standard-types | POST | oui | - | ['super_admin'] | ROLE |
| /superadmin/standard-types | DELETE | oui | - | ['super_admin'] | ROLE |
| /system/cache | GET | oui | requireAuthorization | - | CENTRALISE |
| /system/database | GET | oui | requireAuthorization | - | CENTRALISE |
| /system/database | POST | oui | - | - | ROLE |
| /system/health | GET | oui | requireAuthorization | - | CENTRALISE |
| /system/jobs | GET | oui | requireAuthorization | - | CENTRALISE |
| /system/jobs | POST | oui | requireAuthorization | - | CENTRALISE |
| /system/metrics | GET | oui | requireAuthorization | - | CENTRALISE |
| /system/queues | GET | oui | requireAuthorization | - | CENTRALISE |
| /system/reports | GET | oui | requireAuthorization | - | CENTRALISE |
| /system/status | GET | oui | requireAuthorization | - | CENTRALISE |
| /system/storage | GET | oui | requireAuthorization | - | CENTRALISE |

## Famille : Staff (operations partagees)

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /activity | GET | oui | - | ["staff", "super_admin"] | ROLE |
| /activity | POST | oui | - | ["staff", "super_admin"] | ROLE |
| /attendance | POST | oui | requireAssignmentAccess | - | CENTRALISE |
| /attendance | GET | oui | requireAssignmentAccess | - | CENTRALISE |
| /blockers/discuss | GET | oui | - | - | AUTH_SEULE |
| /blockers/discuss | POST | oui | - | - | AUTH_SEULE |
| /blockers | GET | oui | - | - | AUTH_SEULE |
| /blockers | POST | oui | - | - | AUTH_SEULE |
| /blockers | PUT | oui | - | - | AUTH_SEULE |
| /blockers | DELETE | oui | - | - | AUTH_SEULE |
| /calendar | GET | oui | - | - | AUTH_SEULE |
| /categories | GET | oui | - | - | AUTH_SEULE |
| /contact-emails | GET | oui | - | - | AUTH_SEULE |
| /contact-emails | POST | oui | - | - | AUTH_SEULE |
| /contact-emails | DELETE | oui | - | - | AUTH_SEULE |
| /contacts/[cid]/emails | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts/[cid]/learning | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts/[cid]/programs | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts/[cid]/roles | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts/[cid]/timeline | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts/[cid]/timeline | POST | oui | requireAuthorization | - | CENTRALISE |
| /contacts/duplicates | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts/duplicates | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /contacts/full-state | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts/merge/preview | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts/merge | POST | oui | requireAuthorization | - | CENTRALISE |
| /contacts | POST | oui | requireAuthorization | - | CENTRALISE |
| /contacts | PUT | oui | requireAuthorization, conflictGuard | - | CENTRALISE |
| /contacts | GET | oui | requireAuthorization | - | CENTRALISE |
| /contacts | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /contacts/search | GET | oui | requireAuthorization | - | CENTRALISE |
| /deliverables | POST | oui | - | ["staff", "super_admin"] | ROLE |
| /deliverables | GET | oui | - | ["staff", "super_admin", "program_manager", "team", "participant"] | ROLE |
| /documents | GET | oui | - | ["staff", "super_admin"] | ROLE |
| /documents | POST | oui | - | ["staff", "super_admin"] | ROLE |
| /evaluation | GET | oui | - | ["staff", "super_admin", "program_manager"] | ROLE |
| /evaluation | PUT | oui | - | ["staff", "super_admin", "program_manager"] | ROLE |
| /evaluation | POST | oui | - | ["staff", "super_admin"] | ROLE |
| /events | GET | oui | - | ["staff", "super_admin"] | ROLE |
| /events | POST | oui | - | ["staff", "super_admin", "program_manager"] | ROLE |
| /families | GET | oui | requireAuthorization | - | CENTRALISE |
| /families | POST | oui | - | - | ROLE |
| /families | PUT | oui | - | - | ROLE |
| /families | PATCH | oui | - | - | ROLE |
| /families | DELETE | oui | - | - | ROLE |
| /feedback | POST | oui | - | - | AUTH_SEULE |
| /feedback | GET | oui | - | - | AUTH_SEULE |
| /followups | GET | oui | - | ["staff", "super_admin", "program_manager", "facilitator", "participant"] | ROLE |
| /followups | POST | oui | - | ["staff", "super_admin", "program_manager", "facilitator"] | ROLE |
| /followups | PATCH | oui | - | ["staff", "super_admin", "program_manager", "facilitator"] | ROLE |
| /group-members | POST | oui | requireProgramScope | - | CENTRALISE |
| /group-members | GET | oui | - | - | ROLE |
| /groups | GET | oui | - | - | ROLE |
| /groups | POST | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /groups | PUT | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /groups | DELETE | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /intents/[id] | GET | oui | - | - | AUTH_SEULE |
| /intents/[id]/tasks | POST | oui | - | - | AUTH_SEULE |
| /intents | GET | oui | - | - | AUTH_SEULE |
| /intents | POST | oui | - | - | AUTH_SEULE |
| /intents | PUT | oui | - | - | AUTH_SEULE |
| /intents | DELETE | oui | - | - | AUTH_SEULE |
| /internal-comms | GET | oui | requireAuthorization | - | CENTRALISE |
| /internal-comms | POST | oui | requireAuthorization | - | CENTRALISE |
| /internal-comms | PUT | oui | requireAuthorization | - | CENTRALISE |
| /journey-reports | GET | oui | - | - | AUTH_SEULE |
| /journey-templates | GET | oui | - | - | AUTH_SEULE |
| /knowledge | POST | oui | requireAuthorization | - | CENTRALISE |
| /knowledge | GET | oui | requireAuthorization | - | CENTRALISE |
| /knowledge | PATCH | oui | requireAuthorization | - | CENTRALISE |
| /knowledge | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /kpi-progress/recalculate | POST | oui | - | ["staff", "super_admin", "program_manager"] | ROLE |
| /kpi-progress | GET | oui | - | ["staff", "super_admin", "program_manager"] | ROLE |
| /kpis | POST | oui | requireProgramScope | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /kpis | PUT | oui | requireProgramScope | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /kpis | DELETE | oui | requireProgramScope | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /notifications/due-reminders | POST | non | - | - | SANS_DECISION |
| /notifications/overdue | POST | non | - | - | SANS_DECISION |
| /notifications | POST | oui | - | - | AUTH_SEULE |
| /notifications | GET | oui | - | - | AUTH_SEULE |
| /notifications | PATCH | oui | - | - | AUTH_SEULE |
| /notifications/venture | GET | oui | - | - | AUTH_SEULE |
| /notifications/venture | POST | oui | - | - | AUTH_SEULE |
| /op-reports | GET | oui | - | - | AUTH_SEULE |
| /op-reports | POST | oui | requireAuthorization | - | CENTRALISE |
| /participants | POST | oui | conflictGuard | - | CENTRALISE |
| /participants | GET | oui | requireAssignmentAccess | - | CENTRALISE |
| /people | GET | oui | requireAuthorization | - | CENTRALISE |
| /people | POST | oui | requireAuthorization | - | CENTRALISE |
| /program-staff | GET | oui | - | ['super_admin'] | ROLE |
| /program-staff | POST | oui | - | ['super_admin'] | ROLE |
| /program-staff | PUT | oui | - | ['super_admin'] | ROLE |
| /program-staff | DELETE | oui | - | ['super_admin'] | ROLE |
| /program-types | GET | oui | - | - | AUTH_SEULE |
| /program-types | POST | oui | - | - | ROLE |
| /progress | GET | oui | - | ["staff", "super_admin"] | ROLE |
| /projects/assignments | GET | oui | - | - | AUTH_SEULE |
| /projects/discuss | GET | oui | requireProjectAccess | - | CENTRALISE |
| /projects/discuss | POST | oui | requireProjectAccess | - | CENTRALISE |
| /projects/invitations/respond | POST | oui | - | - | AUTH_SEULE |
| /projects/invitations | GET | oui | - | - | AUTH_SEULE |
| /projects/members | GET | oui | requireProjectAccess | - | CENTRALISE |
| /projects/members | POST | oui | requireAuthorization, requireProjectAccess | - | CENTRALISE |
| /projects/members | DELETE | oui | requireAuthorization, requireProjectAccess | - | CENTRALISE |
| /projects | POST | oui | requireAuthorization | - | CENTRALISE |
| /projects | GET | oui | - | - | AUTH_SEULE |
| /projects | PUT | oui | requireProjectAccess | - | CENTRALISE |
| /projects | DELETE | oui | requireAuthorization, requireProjectAccess | - | CENTRALISE |
| /responsibilities/access | PUT | oui | requireAuthorization | - | CENTRALISE |
| /responsibilities/assign | PUT | oui | requireAuthorization | - | CENTRALISE |
| /responsibilities/assign | GET | oui | requireAuthorization | - | CENTRALISE |
| /responsibilities | GET | oui | - | - | AUTH_SEULE |
| /responsibilities | POST | oui | requireAuthorization | - | CENTRALISE |
| /responsibilities | PUT | oui | requireAuthorization | - | CENTRALISE |
| /responsibilities | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /retros/current | GET | oui | - | - | AUTH_SEULE |
| /retros/submit | POST | oui | requireAuthorization | - | CENTRALISE |
| /run-export | GET | oui | requireAuthorization | - | CENTRALISE |
| /segments | GET | oui | - | ["staff", "super_admin"] | ROLE |
| /segments | POST | oui | - | ["staff", "super_admin"] | ROLE |
| /segments/run | POST | oui | - | ["staff", "super_admin"] | ROLE |
| /send-pending | GET | oui | - | - | ROLE |
| /sessions | POST | oui | requireAssignmentAccess | ["staff", "super_admin", "program_manager", "facilitator"] | CENTRALISE |
| /sessions | GET | oui | requireAssignmentAccess | ["staff", "super_admin", "program_manager", "facilitator"] | CENTRALISE |
| /standups/current | GET | oui | - | - | AUTH_SEULE |
| /standups/submit | POST | oui | requireAuthorization | - | CENTRALISE |
| /submissions | POST | oui | - | - | AUTH_SEULE |
| /submissions | PATCH | oui | requireAssignmentAccess | - | CENTRALISE |
| /submissions | GET | oui | requireAssignmentAccess | - | CENTRALISE |
| /submissions | PUT | oui | requireProgramScope | - | CENTRALISE |
| /tasks/approve | POST | oui | - | - | ROLE |
| /tasks/assignment-action | POST | oui | - | - | AUTH_SEULE |
| /tasks/assignments | GET | oui | - | - | AUTH_SEULE |
| /tasks/assignments | POST | oui | - | - | AUTH_SEULE |
| /tasks/carryover | GET | oui | - | - | AUTH_SEULE |
| /tasks/carryover | POST | oui | - | - | AUTH_SEULE |
| /tasks/comments | GET | oui | - | - | AUTH_SEULE |
| /tasks/comments | POST | oui | - | - | AUTH_SEULE |
| /tasks/comments | DELETE | oui | - | - | AUTH_SEULE |
| /tasks/comments | PUT | oui | - | - | AUTH_SEULE |
| /tasks/duplicate | POST | oui | - | - | AUTH_SEULE |
| /tasks/logs | GET | oui | - | - | AUTH_SEULE |
| /tasks/notify-deadlines | POST | non | - | - | SANS_DECISION |
| /tasks/reconcile | POST | oui | - | - | AUTH_SEULE |
| /tasks/resources | POST | oui | - | - | AUTH_SEULE |
| /tasks/resources | DELETE | oui | - | - | AUTH_SEULE |
| /tasks | GET | oui | - | - | AUTH_SEULE |
| /tasks | POST | oui | - | - | AUTH_SEULE |
| /tasks | PUT | oui | - | - | AUTH_SEULE |
| /tasks | DELETE | oui | - | - | AUTH_SEULE |
| /tasks | PATCH | oui | - | - | AUTH_SEULE |
| /upload | POST | oui | - | - | AUTH_SEULE |
| /user-groups | GET | oui | - | - | AUTH_SEULE |
| /user-groups | POST | oui | requireAuthorization | - | CENTRALISE |
| /user-groups | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /v2/groups | POST | oui | - | - | ROLE |
| /v2/groups | PUT | oui | - | - | ROLE |
| /v2/groups | GET | oui | - | - | ROLE |
| /v2/kpis | GET | oui | - | - | ROLE |
| /v2/kpis | POST | oui | - | - | ROLE |
| /v2/kpis | DELETE | oui | - | - | ROLE |
| /v2/program-staff | GET | oui | - | - | ROLE |
| /v2/program-staff | POST | oui | - | - | ROLE |
| /v2/program-staff | PUT | oui | - | - | ROLE |
| /v2/program-staff | DELETE | oui | - | - | ROLE |
| /venture-kpi-definitions | GET | oui | - | ["participant", "staff", "program_manager", "super_admin"] | ROLE |
| /venture-kpi-definitions | POST | oui | - | ["staff", "program_manager", "super_admin"] | ROLE |
| /venture-kpi-definitions | PATCH | oui | - | ["staff", "program_manager", "super_admin"] | ROLE |
| /venture-options | GET | oui | - | - | AUTH_SEULE |
| /venture-options | POST | oui | - | - | AUTH_SEULE |
| /venture-options | PATCH | oui | - | - | AUTH_SEULE |
| /venture-permissions/matrix | GET | oui | - | ["super_admin"] | ROLE |
| /venture-permissions/matrix | POST | oui | - | ["super_admin"] | ROLE |
| /venture-permissions/responsibilities | GET | oui | - | ["super_admin"] | ROLE |
| /venture-permissions/responsibilities | POST | oui | - | ["super_admin"] | ROLE |
| /venture-permissions/responsibilities | PATCH | oui | - | ["super_admin"] | ROLE |
| /venture-permissions/scopes | GET | oui | - | ["super_admin", "staff"] | ROLE |
| /venture-plan-templates/apply | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /venture-plan-templates | GET | oui | - | - | AUTH_SEULE |
| /venture-plan-templates | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /venture-plan-templates | PATCH | oui | - | - | AUTH_SEULE |
| /venture-templates | GET | oui | - | - | AUTH_SEULE |
| /venture-templates | POST | oui | - | - | AUTH_SEULE |
| /workspaces | GET | oui | - | - | AUTH_SEULE |

## Famille : Program Manager

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /participant-programs/bulk | POST | oui | requireProgramScope, conflictGuard | - | CENTRALISE |
| /participant-programs | GET | non | - | - | SANS_DECISION |
| /participant-programs | POST | non | - | - | SANS_DECISION |
| /participant-programs | DELETE | non | - | - | SANS_DECISION |
| /pm/curriculum | POST | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/curriculum | PUT | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/curriculum | DELETE | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/export | GET | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/full-state | GET | oui | requireProgramFacilitator | - | CENTRALISE |
| /pm/programs/[id]/manager | PUT | oui | requireAuthorization | - | CENTRALISE |
| /pm/programs/[id] | GET | oui | requireAuthorization | ["super_admin", "program_manager", "staff"] | CENTRALISE |
| /pm/programs/assignment | PATCH | oui | - | ["super_admin", "program_manager", "staff"] | ROLE |
| /pm/programs | GET | oui | - | - | AUTH_SEULE |
| /pm/programs | POST | oui | requireAuthorization | - | CENTRALISE |
| /pm/programs | PUT | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/programs | DELETE | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/programs/templates | GET | oui | - | - | ROLE |
| /pm/programs/templates | POST | oui | requireAuthorization | - | CENTRALISE |
| /pm/reports | GET | oui | requireAssignmentAccess | - | CENTRALISE |
| /pm/reports | POST | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/schedule | GET | oui | - | ["staff", "super_admin", "program_manager"] | ROLE |
| /pm/submissions | GET | oui | - | ["staff", "super_admin", "program_manager"] | ROLE |
| /pm/teams | GET | oui | requireAssignmentAccess | - | CENTRALISE |
| /pm/teams | POST | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/teams | PATCH | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /pm/teams | DELETE | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /programs | POST | oui | - | - | ROLE |
| /programs | GET | oui | requireAuthorization, requireAssignmentAccess | - | CENTRALISE |
| /programs | PUT | oui | requireProgramScope | - | CENTRALISE |

## Famille : Participant

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /participant/announcements | GET | oui | - | - | AUTH_SEULE |
| /participant/assignments | GET | oui | - | - | AUTH_SEULE |
| /participant/assignments | POST | oui | - | - | AUTH_SEULE |
| /participant/certificates | GET | oui | - | - | AUTH_SEULE |
| /participant/followups | GET | oui | - | - | AUTH_SEULE |
| /participant/full-state | GET | oui | - | - | AUTH_SEULE |
| /participant/home | GET | oui | - | - | AUTH_SEULE |
| /participant/programs/[id] | GET | oui | - | - | AUTH_SEULE |
| /participant/programs | GET | oui | - | - | AUTH_SEULE |
| /participant/progress | GET | oui | - | - | AUTH_SEULE |
| /participant/rituals/checkin | GET | oui | - | - | AUTH_SEULE |
| /participant/rituals/checkin | POST | oui | - | - | AUTH_SEULE |
| /participant/rituals/reflect | GET | oui | - | - | AUTH_SEULE |
| /participant/rituals/reflect | POST | oui | - | - | AUTH_SEULE |
| /participant/rituals/retro | GET | oui | - | - | AUTH_SEULE |
| /participant/rituals/retro | POST | oui | - | - | AUTH_SEULE |
| /participant/rituals/standup | GET | oui | - | - | AUTH_SEULE |
| /participant/rituals/standup | POST | oui | - | - | AUTH_SEULE |
| /participant/submissions | GET | oui | - | - | AUTH_SEULE |
| /participant/submissions | POST | oui | - | - | AUTH_SEULE |
| /participant/timeline | GET | oui | - | - | AUTH_SEULE |

## Famille : Investisseur

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /investor/admin-overview | GET | oui | - | - | ROLE |
| /investor/approval | GET | oui | - | - | ROLE |
| /investor/approval | POST | oui | - | - | ROLE |
| /investor/campaigns | GET | oui | - | - | AUTH_SEULE |
| /investor/campaigns | POST | oui | - | - | ROLE |
| /investor/campaigns | PUT | oui | - | - | ROLE |
| /investor/dashboard | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/decisions | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/decisions | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/diligence/documents | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/diligence/documents | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/diligence | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/diligence | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/evaluation | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/evaluation | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/executive-dashboard | GET | oui | - | - | ROLE |
| /investor/kpis | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/kpis | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/meetings | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/meetings | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/organizations | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/organizations | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/organizations | PUT | oui | investorSelfService | - | CENTRALISE |
| /investor/pipeline | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/pipeline | GET | oui | - | - | AUTH_SEULE |
| /investor/preferences | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/profile | GET | oui | - | - | AUTH_SEULE |
| /investor/profile | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/profile | PUT | oui | - | - | ROLE |
| /investor/register | POST | non | - | - | SANS_DECISION |
| /investor/relationships/meetings | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/relationships/meetings | POST | oui | - | - | ROLE |
| /investor/relationships/meetings | PUT | oui | - | - | ROLE |
| /investor/relationships | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/relationships | POST | oui | - | - | ROLE |
| /investor/relationships | PUT | oui | - | - | ROLE |
| /investor/setup-password | POST | non | - | - | SANS_DECISION |
| /investor/updates | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/updates | POST | oui | investorSelfService | - | CENTRALISE |
| /investor/venture-kpis | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/ventures | GET | oui | investorSelfService | - | CENTRALISE |
| /investor/watchlist | POST | oui | investorSelfService | - | CENTRALISE |

## Famille : CRM

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /campaigns/[id] | GET | oui | - | - | ROLE |
| /campaigns/[id] | PUT | oui | - | - | ROLE |
| /campaigns/[id] | DELETE | oui | - | - | ROLE |
| /campaigns | GET | oui | - | ["staff", "super_admin"] | ROLE |
| /campaigns | POST | oui | - | ["staff", "super_admin"] | ROLE |
| /crm/activities/[id] | PATCH | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/activities/[id] | DELETE | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/activities | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/activities | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/automations/[id] | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/automations/[id] | PATCH | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/automations/[id] | DELETE | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/automations | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/automations | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/contacts/[cid]/organizations/[rid] | PATCH | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/contacts/[cid]/organizations/[rid] | DELETE | oui | requireAuthorization | ["super_admin", "staff"] | CENTRALISE |
| /crm/contacts/[cid]/organizations | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/contacts/[cid]/organizations | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/leads/[id] | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/leads/[id] | PATCH | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/leads/[id] | DELETE | oui | requireAuthorization | ["super_admin"] | CENTRALISE |
| /crm/leads/[id]/tasks | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/leads | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/leads | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/opportunities/[id] | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/opportunities/[id] | PATCH | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/opportunities/[id] | DELETE | oui | requireAuthorization | ["super_admin"] | CENTRALISE |
| /crm/opportunities/[id]/stage | PATCH | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/opportunities/[id]/tasks | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/opportunities | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/opportunities | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/organizations/[id] | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/organizations/[id] | PATCH | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/organizations/[id] | DELETE | oui | requireAuthorization | ["super_admin"] | CENTRALISE |
| /crm/organizations | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/organizations | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/pipelines/[id] | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/pipelines/[id] | PATCH | oui | requireAuthorization | ["super_admin"] | CENTRALISE |
| /crm/pipelines/[id]/stages | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/pipelines/[id]/stages | POST | oui | requireAuthorization | ["super_admin"] | CENTRALISE |
| /crm/pipelines | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/pipelines | POST | oui | requireAuthorization | ["super_admin"] | CENTRALISE |
| /crm/segments/[id] | PATCH | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/segments/[id] | DELETE | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/segments | GET | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |
| /crm/segments | POST | oui | requireAuthorization | ["super_admin", "staff", "program_manager"] | CENTRALISE |

## Famille : Finance

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /finance/budget-lines | GET | oui | requireAuthorization | - | CENTRALISE |
| /finance/monthly | GET | oui | requireAuthorization | - | CENTRALISE |
| /finance/summary | GET | oui | requireAuthorization | - | CENTRALISE |
| /finance/sync | POST | oui | requireAuthorization | - | CENTRALISE |
| /finance/transaction | POST | oui | requireAuthorization | - | CENTRALISE |
| /finance/transactions | GET | oui | requireAuthorization | - | CENTRALISE |

## Famille : Equipe

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /team-tasks | GET | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /team-tasks | POST | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /team-tasks | PUT | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /team-tasks | DELETE | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /teams | GET | oui | requireAuthorization, requireAssignmentAccess | - | CENTRALISE |
| /teams | POST | oui | requireProgramScope | - | CENTRALISE |
| /teams | PUT | oui | requireProgramScope | - | CENTRALISE |
| /teams | DELETE | oui | requireProgramScope | - | CENTRALISE |

## Famille : Facilitateur

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /facilitator-reviews | GET | oui | - | - | AUTH_SEULE |
| /facilitator-reviews | POST | oui | requireAssignmentAccess | - | CENTRALISE |
| /facilitator-reviews | PUT | oui | - | - | ROLE |
| /facilitators/invite-bulk | POST | oui | requireProgramScope | - | CENTRALISE |

## Famille : Engineering

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /engineering/permissions/audit | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/context-grant-readiness | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/context-grants-sweep | POST | non | - | - | SANS_DECISION |
| /engineering/permissions/context-roles | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/context-roles | PUT | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/eligibility | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/eligibility | PUT | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/legacy-role-cleanup | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/legacy-role-cleanup | POST | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profile-assignments | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profile-assignments | POST | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profile-assignments | PATCH | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profile-override | PUT | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profile-override | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profile-role-defaults | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profile-role-defaults | PUT | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profiles | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profiles | PUT | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profiles | POST | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/profiles | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions | PUT | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/scope-check | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/seed | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/seed | POST | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/sync-context-grants | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/user-context | GET | oui | requireAuthorization | - | CENTRALISE |
| /engineering/permissions/venture-strict-audit | GET | oui | requireAuthorization | - | CENTRALISE |

## Famille : Platform / Webhooks / Integrations

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /integrations/google-calendar/callback | GET | oui | - | - | AUTH_SEULE |
| /integrations/google-calendar/connect | GET | oui | - | - | AUTH_SEULE |
| /integrations/google-calendar/cron | GET | non | - | - | SANS_DECISION |
| /integrations/google-calendar/cron | POST | non | - | - | SANS_DECISION |
| /integrations/google-calendar/events | GET | oui | - | - | AUTH_SEULE |
| /integrations/google-calendar | GET | oui | - | - | AUTH_SEULE |
| /integrations/google-calendar | DELETE | oui | - | - | AUTH_SEULE |
| /integrations/google-calendar/sync | POST | oui | - | - | AUTH_SEULE |
| /integrations/google-calendar/webhook | POST | non | - | - | SANS_DECISION |
| /platform/ai/analyze | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/analyze | GET | oui | - | - | AUTH_SEULE |
| /platform/ai/evaluate-submission | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/evaluate-submission | GET | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/evaluation-config | GET | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/evaluation-config | PUT | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/evaluation-config | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/evaluation-scores | GET | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/generate-all | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/generate-form | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/generate-framework | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai/personalize-template | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/ai | GET | oui | - | - | AUTH_SEULE |
| /platform/collections | GET | oui | - | - | ROLE |
| /platform/collections | POST | oui | - | - | ROLE |
| /platform/collections | PUT | oui | - | - | ROLE |
| /platform/collections | DELETE | oui | - | - | ROLE |
| /platform/form-runs/report-file | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/form-runs/report-file | GET | oui | requireAuthorization | - | CENTRALISE |
| /platform/form-runs/report-file | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /platform/form-runs | POST | non | - | - | SANS_DECISION |
| /platform/forms | GET | oui | requireAuthorization | - | CENTRALISE |
| /platform/forms | POST | oui | requireAuthorization | - | CENTRALISE |
| /platform/forms | PUT | oui | requireAuthorization | - | CENTRALISE |
| /platform/forms | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /platform/import/execute | POST | oui | - | - | ROLE |
| /platform/import/preview | POST | oui | - | - | ROLE |
| /platform/import/review-flags | GET | oui | - | - | ROLE |
| /platform/import/review-flags | PUT | oui | - | - | ROLE |
| /platform/integrations/calendar | GET | oui | requireAuthorization | - | CENTRALISE |
| /platform/integrations/calendar | POST | oui | - | - | ROLE |
| /platform/investor-run | GET | oui | - | - | ROLE |
| /platform/notifications | GET | oui | - | - | AUTH_SEULE |
| /platform/notifications | POST | oui | - | - | AUTH_SEULE |
| /platform/scheduled-result-emails | GET | non | - | - | SANS_DECISION |
| /platform/scheduled-result-emails | POST | non | - | - | SANS_DECISION |
| /platform/seed/founder-assessment | POST | oui | - | - | ROLE |
| /platform/seed/founder-assessment | GET | oui | - | - | AUTH_SEULE |
| /platform/seed/investor-application | POST | oui | - | - | ROLE |
| /reminders/sweep | POST | non | - | - | SANS_DECISION |
| /webhooks/[id] | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /webhooks/[id] | GET | oui | requireAuthorization | - | CENTRALISE |
| /webhooks/kkiapay | POST | non | - | - | SANS_DECISION |
| /webhooks/resend | POST | non | - | - | SANS_DECISION |
| /webhooks | GET | oui | requireAuthorization | - | CENTRALISE |
| /webhooks | POST | oui | requireAuthorization | - | CENTRALISE |

## Famille : Autres (announcements, LMS)

| Fichier-hote (route) | Methode | Auth | Decision centralisee | Role global | Controle (bucket) |
|---|---|---|---|---|---|
| /announcements | GET | oui | - | - | AUTH_SEULE |
| /announcements | POST | oui | requireAuthorization | - | CENTRALISE |
| /announcements | PUT | oui | requireAuthorization | - | CENTRALISE |
| /announcements | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /lms/assessments/[id]/questions | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/assessments/[id] | PUT | oui | requireAuthorization | - | CENTRALISE |
| /lms/assessments/[id] | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /lms/assessments/[id]/submit | POST | oui | - | - | AUTH_SEULE |
| /lms/assessments/[id]/take | GET | oui | - | - | AUTH_SEULE |
| /lms/certificates/[id]/download | GET | oui | - | - | AUTH_SEULE |
| /lms/certificates/[id]/revoke | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/certificates/[id] | GET | oui | - | - | AUTH_SEULE |
| /lms/certificates | GET | oui | - | - | AUTH_SEULE |
| /lms/checkout-reconcile | POST | non | - | - | SANS_DECISION |
| /lms/coaching-requests/[id] | PUT | oui | requireAuthorization | - | CENTRALISE |
| /lms/coaching-requests/[id] | DELETE | oui | - | - | AUTH_SEULE |
| /lms/coaching-requests | GET | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /lms/coaching-requests | POST | oui | - | - | AUTH_SEULE |
| /lms/courses/[id]/archive | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/[id]/assessments | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/[id]/enrollments | GET | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/[id]/learn | GET | oui | - | - | AUTH_SEULE |
| /lms/courses/[id]/publish | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/[id] | GET | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/[id] | PUT | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/[id] | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/[id]/sections/reorder | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/[id]/sections | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses | GET | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/courses/thumbnail | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/enrollments | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/lessons/[id]/complete | POST | oui | - | - | AUTH_SEULE |
| /lms/lessons/[id] | PUT | oui | requireAuthorization | - | CENTRALISE |
| /lms/lessons/[id] | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /lms/my-learning | GET | oui | - | - | AUTH_SEULE |
| /lms/program-requirements/[id] | PUT | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /lms/program-requirements/[id] | DELETE | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /lms/program-requirements | GET | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /lms/program-requirements | POST | oui | requireAuthorization, requireProgramScope | - | CENTRALISE |
| /lms/questions/[id] | PUT | oui | requireAuthorization | - | CENTRALISE |
| /lms/questions/[id] | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /lms/registrations/[id] | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/registrations | GET | oui | requireAuthorization | - | CENTRALISE |
| /lms/registrations | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/section-resources/[id] | PUT | oui | requireAuthorization | - | CENTRALISE |
| /lms/section-resources/[id] | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /lms/section-resources | GET | oui | requireAuthorization | - | CENTRALISE |
| /lms/section-resources | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/section-resources/upload | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/section-resources/upload | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /lms/sections/[id]/lessons | POST | oui | requireAuthorization | - | CENTRALISE |
| /lms/sections/[id] | PUT | oui | requireAuthorization | - | CENTRALISE |
| /lms/sections/[id] | DELETE | oui | requireAuthorization | - | CENTRALISE |
| /lms/video-info | GET | oui | requireAuthorization | - | CENTRALISE |
| /responses/review | POST | oui | - | ["super_admin", "staff"] | ROLE |
| /responses | GET | oui | - | ["staff", "super_admin"] | ROLE |
| /venture-member-invites/[token] | GET | non | - | - | SANS_DECISION |
| /venture-member-invites/[token] | POST | non | - | - | SANS_DECISION |
| /ventures/[id]/action-plans | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/action-plans | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/action-plans | PATCH | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/advisors | GET | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/advisors | POST | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/advisors | PATCH | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/analytics | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/assignments/resolve | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/assignments/resolve | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/blockers | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/blockers | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/blockers | PATCH | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/business-model | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/business-model | PUT | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/calendar | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/changes | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/coach-invite | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/coaches | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/coaches | POST | oui | requireAuthorization, requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/coaches | PATCH | oui | requireAuthorization, requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/coaches | DELETE | oui | requireAuthorization, requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/coaching | GET | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/coaching | POST | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/coaching | PATCH | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/dashboard | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/deliverables | GET | oui | requireVentureAccess, requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/deliverables | POST | oui | requireVentureScopedAccess, requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/deliverables | PATCH | oui | requireVentureScopedAccess, requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/deliverables/upload | POST | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/document-types/[typeId] | PATCH | oui | - | - | AUTH_SEULE |
| /ventures/[id]/document-types/[typeId] | DELETE | oui | - | - | AUTH_SEULE |
| /ventures/[id]/document-types | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/document-types | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/documents/[docId]/permissions | GET | oui | requireVentureAccess | ["participant", "founder", "staff", "program_manager", "super_admin"] | CENTRALISE |
| /ventures/[id]/documents/[docId]/permissions | PATCH | oui | requireVentureAccess | ["participant", "founder", "staff", "program_manager", "super_admin"] | CENTRALISE |
| /ventures/[id]/documents/[docId]/reviews | GET | oui | requireVentureAccess | ["participant", "founder", "staff", "program_manager", "super_admin"] | CENTRALISE |
| /ventures/[id]/documents/[docId]/reviews | POST | oui | requireVentureAccess | ["staff", "program_manager", "super_admin"] | CENTRALISE |
| /ventures/[id]/documents/[docId]/transition | PATCH | oui | requireVentureAccess | ["participant", "founder", "staff", "program_manager", "super_admin"] | CENTRALISE |
| /ventures/[id]/documents/[docId]/versions | GET | oui | requireVentureAccess | ["participant", "founder", "staff", "program_manager", "super_admin"] | CENTRALISE |
| /ventures/[id]/documents/[docId]/versions | POST | oui | requireVentureAccess | ["participant", "founder", "staff", "program_manager", "super_admin"] | CENTRALISE |
| /ventures/[id]/documents | GET | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/documents | POST | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/feedback | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/feedback | POST | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/followups | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/founders/[founderId]/reactivate | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/founders/[founderId] | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/founders/[founderId] | PATCH | oui | - | - | AUTH_SEULE |
| /ventures/[id]/founders/[founderId] | DELETE | oui | - | - | AUTH_SEULE |
| /ventures/[id]/founders/[founderId]/suspend | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/founders | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/founders | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/founders/transfer-ownership | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/fundraising | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/fundraising | POST | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/history | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/interviews | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/interviews | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/investment-readiness | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/investment | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/investment | POST | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/investors | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/investors | POST | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/journey-report | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/journey/apply-journey-template | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/journey/apply-template | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/journey/archive | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/journey/delete | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/journey/duplicate | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/journey | GET | oui | requireVentureAccess, resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/journey | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/journey | PATCH | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/journey/save-template | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/knowledge | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/knowledge | POST | oui | requireAuthorization, requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/kpis | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/kpis | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/kpis | PATCH | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/lead | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/lifecycle | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/member-invitations | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/member-invitations | DELETE | oui | - | - | AUTH_SEULE |
| /ventures/[id]/members | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/members | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/members | PATCH | oui | - | - | AUTH_SEULE |
| /ventures/[id]/milestones/archive | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/milestones/duplicate | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/milestones/reorder | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/milestones | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/milestones | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/milestones | PATCH | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/my-access | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/notes | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/notes | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/notes | DELETE | oui | - | - | AUTH_SEULE |
| /ventures/[id]/operating-plans/[planId] | GET | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/operating-plans/[planId] | PATCH | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/operating-plans/[planId] | DELETE | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/operating-plans/[planId]/sections | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/operating-plans/[planId]/sections | PATCH | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/operating-plans/[planId]/sections | DELETE | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/operating-plans | GET | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/operating-plans | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/plan-import | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/plan-import | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/plan-import | PATCH | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/playbook | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/pmf | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/pmf | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/progress-reports | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/progress-reports | POST | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/progress-reports | PATCH | oui | resolvePlanAccess | - | CENTRALISE |
| /ventures/[id]/progress | GET | oui | requireVentureAccess | ["participant","founder","staff","program_manager","super_admin"] | CENTRALISE |
| /ventures/[id]/reminders | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/reminders | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/reports | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/retros | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/retros | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id] | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id] | PATCH | oui | requireAuthorization | - | CENTRALISE |
| /ventures/[id]/sessions | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/sessions | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/sessions/upload | POST | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/staff-assignments | GET | oui | - | ["super_admin"] | ROLE |
| /ventures/[id]/staff-assignments | POST | oui | - | ["super_admin"] | ROLE |
| /ventures/[id]/staff-assignments | PATCH | oui | - | ["super_admin"] | ROLE |
| /ventures/[id]/standups | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/standups | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/startup-profile | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/startup-profile | PATCH | oui | - | - | AUTH_SEULE |
| /ventures/[id]/startup-profile/submit | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/submissions/review-queue | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/tasks/[taskId]/submissions | GET | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/tasks/[taskId]/submissions | POST | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/tasks/archive | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/tasks/duplicate | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/tasks | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/tasks | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/tasks | PATCH | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/tasks | DELETE | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/timeline | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/timeline | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/validations | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/validations | POST | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/validations | PATCH | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/venture-history | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/[id]/verification/documents/[docId]/versions | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/verification/documents/[docId]/versions | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/verification | GET | oui | - | - | AUTH_SEULE |
| /ventures/[id]/verification | POST | oui | - | - | AUTH_SEULE |
| /ventures/[id]/verification/status | PATCH | oui | - | - | AUTH_SEULE |
| /ventures/[id]/verification/upload | POST | oui | requireVentureAccess | - | CENTRALISE |
| /ventures/[id]/work-items | GET | oui | requireVentureScopedAccess | - | CENTRALISE |
| /ventures/assigned | GET | oui | - | ["staff", "program_manager", "super_admin"] | ROLE |
| /ventures/lead-manager/home | GET | oui | - | ["staff", "program_manager", "super_admin"] | ROLE |
| /ventures | GET | oui | - | - | AUTH_SEULE |
| /ventures | POST | oui | - | - | AUTH_SEULE |
| /ventures | PUT | oui | requireAuthorization | - | CENTRALISE |


## 3. Handlers sans decision centralisee

### 3.1 Aucune authentification ni decision observable (SANS_DECISION) : 48 handlers

| Route | Methode | Mecanisme observe | Classe | Justification |
|---|---|---|---|---|
| /forms/[form_id] | GET | aucun | OUVERTE_ASSUMEE | Stub HTTP 501 : fonctionnalite retiree, aucune action |
| /forms | GET | aucun | OUVERTE_ASSUMEE | Stub HTTP 501 : fonctionnalite retiree, aucune action |
| /forms | POST | aucun | OUVERTE_ASSUMEE | Stub HTTP 501 : fonctionnalite retiree, aucune action |
| /forms | PUT | aucun | OUVERTE_ASSUMEE | Stub HTTP 501 : fonctionnalite retiree, aucune action |
| /forms | DELETE | aucun | OUVERTE_ASSUMEE | Stub HTTP 501 : fonctionnalite retiree, aucune action |
| /health | GET | aucun | OUVERTE_ASSUMEE | Sonde de sante publique, n expose aucune donnee |
| /ready | GET | aucun | OUVERTE_ASSUMEE | Sonde de disponibilite |
| /respond | POST | aucun, pas de rate-limit | A_PROTEGER | Ecriture publique non authentifiee d une reponse de campagne (voir section 4) |
| /s/public-draft | GET | jeton de brouillon | OUVERTE_ASSUMEE | Lecture d un brouillon public par slug + jeton |
| /s/public-draft | POST | aucun, pas de rate-limit | A_PROTEGER | Creation/mise a jour publique de brouillon (voir section 4) |
| /s/public-run | GET | slug seulement | OUVERTE_ASSUMEE | Lecture publique d un run par slug (les ID numeriques sont refuses) |
| /s/public-submit | POST | jeton navigateur + limite par run | OUVERTE_ASSUMEE | Soumission publique, limite de debit par run |
| /public/checkout | GET | rate-limit | OUVERTE_ASSUMEE | Etat de paiement public, limite de debit |
| /public/checkout | POST | rate-limit | OUVERTE_ASSUMEE | Paiement public, limite de debit |
| /public/course-match | GET | rate-limit | OUVERTE_ASSUMEE | Catalogue public, limite de debit |
| /public/group-info | GET | aucun | OUVERTE_ASSUMEE | Info de groupe pour la page d inscription (reserve : enumeration par identifiant) |
| /public/register | POST | garde de conflit de role interne | OUVERTE_ASSUMEE | Inscription publique via lien de groupe |
| /verify/certificate/[token] | GET | jeton | OUVERTE_ASSUMEE | Verification publique de certificat (champs volontairement publics) |
| /auth/activate | GET | rate-limit + jeton | OUVERTE_ASSUMEE | Validation de jeton d activation |
| /auth/activate | POST | rate-limit + jeton | OUVERTE_ASSUMEE | Activation de compte par jeton |
| /auth/forgot-password | POST | rate-limit + anti-enumeration | OUVERTE_ASSUMEE | Envoi de lien de reinitialisation |
| /auth/reset-password | POST | rate-limit + mot de passe courant | OUVERTE_ASSUMEE | Auto-reinitialisation verifiee (pas de chemin administrateur) |
| /auth/session-logout | POST | aucun | OUVERTE_ASSUMEE | Detruit la session courante (idempotent) |
| /auth/setup-password | POST | rate-limit + jeton | OUVERTE_ASSUMEE | Definition de mot de passe par jeton |
| /auth/setup-password/validate | GET | rate-limit + jeton | OUVERTE_ASSUMEE | Validation de jeton de configuration |
| /invites/[token] | GET | jeton | OUVERTE_ASSUMEE | Validation d un jeton d invitation |
| /investor/register | POST | aucun | OUVERTE_ASSUMEE | Flux retire (HTTP 410), aucune donnee |
| /investor/setup-password | POST | jeton | OUVERTE_ASSUMEE | Definition de mot de passe investisseur par jeton |
| /venture-member-invites/[token] | GET | jeton | OUVERTE_ASSUMEE | Description d une invitation membre par jeton |
| /venture-member-invites/[token] | POST | jeton | OUVERTE_ASSUMEE | Acceptation d une invitation membre par jeton |
| /errors | POST | rate-limit | OUVERTE_ASSUMEE | Rapporteur d erreurs cote client, limite de debit |
| /engineering/permissions/context-grants-sweep | POST | secret (x-cron-secret) | OUVERTE_ASSUMEE | Tache planifiee : 503 si secret non configure, 403 si secret errone |
| /lms/checkout-reconcile | POST | secret (x-cron-secret) | OUVERTE_ASSUMEE | Reconciliation de paiements planifiee |
| /notifications/due-reminders | POST | secret (x-cron-secret) | OUVERTE_ASSUMEE | Rappels planifies |
| /notifications/overdue | POST | secret (x-cron-secret) | OUVERTE_ASSUMEE | Relances planifiees |
| /tasks/notify-deadlines | POST | secret (x-cron-secret) | OUVERTE_ASSUMEE | Notifications d echeance planifiees |
| /reminders/sweep | POST | secret (x-cron-secret) | OUVERTE_ASSUMEE | Balayage de rappels planifie |
| /platform/scheduled-result-emails | GET | secret (x-cron-secret) | OUVERTE_ASSUMEE | Envoi planifie des emails de resultat |
| /platform/scheduled-result-emails | POST | secret (x-cron-secret) | OUVERTE_ASSUMEE | Envoi planifie des emails de resultat |
| /integrations/google-calendar/cron | GET | secret (x-cron-secret ou Bearer) | OUVERTE_ASSUMEE | Synchronisation Google Calendar planifiee |
| /integrations/google-calendar/cron | POST | secret (x-cron-secret ou Bearer) | OUVERTE_ASSUMEE | Synchronisation Google Calendar planifiee |
| /integrations/google-calendar/webhook | POST | jeton de canal X-Goog-Channel-Token | OUVERTE_ASSUMEE | Notification push Google (verifiee dans le service) |
| /webhooks/kkiapay | POST | signature provider.verifyWebhookSignature | OUVERTE_ASSUMEE | Webhook de paiement signe ; 401 si signature invalide |
| /webhooks/resend | POST | signature Svix | OUVERTE_ASSUMEE | Webhook email signe |
| /participant-programs | GET | decision deleguee au service | CENTRALISE (delegue) | requireAuth + requireAuthorization + requireProgramScope dans services/programs/participantPrograms |
| /participant-programs | POST | decision deleguee au service | CENTRALISE (delegue) | Idem ; requireProgramScopeForAll sur les programmes vises |
| /participant-programs | DELETE | decision deleguee au service | CENTRALISE (delegue) | Idem ; requireProgramScope |
| /platform/form-runs | POST | hub de dispatch | MIXTE | 19 sous-actions requireAuthorization(runs, ...) ; la sous-action submit ne fait que verifier la session |

Total : 48 handlers SANS_DECISION, dont 42 OUVERTE_ASSUMEE, 2 A_PROTEGER, 4 dont la decision est en fait deleguee (participant-programs x3, hub form-runs x1).

Note : la route /invites/[token] POST n apparait pas ici car son corps importe assertNoParticipantFacilitatorConflict (garde de conflit). Ce n est PAS une decision de permission : la route est en realite publique par jeton (voir Incertitudes).

### 3.2 Authentification seule (AUTH_SEULE) : 155 handlers

Ces handlers exigent une session mais n appliquent aucune decision de permission centralisee visible dans le fichier route. Ils se repartissent en trois natures :

- PERSONNELLE_LEGITIME (self-service, donnees propres) : participant/* (21), profile/* (4), me/* (2), notifications/* (5), calendar (1), auth/language et auth/session (2), feedback (2), tasks (19 : tableau de taches filtre par session), intents/* (6), blockers/* (6), contact-emails (3), retros/standups current (3), lms/* apprenant (10), integrations/google-calendar/* (6, calendrier de l utilisateur), upload (1, fichiers propres), projects/invitations/respond (1).
- Lecture de donnees de reference/partagees : categories, program-types, venture-options, venture-templates, journey-templates, venture-plan-templates GET, responsibilities GET, announcements, op-reports, workspaces, user-groups, projects GET, facilitator-reviews GET, submissions POST, ventures GET.
- Mutations partagees dont la decision est deleguee a un service ou un import dynamique (non visible statiquement) : une grande partie des ventures/[id]/* (32), ventures POST, projects/*, tasks/* mutations, program-types, venture-templates POST. Voir Incertitudes.

Aucun de ces handlers n est OUVERTE_ASSUMEE (une session est requise) et aucun n a ete classe A_PROTEGER apres lecture : les mutations sensibles verifiees (ventures) appliquent une decision de domaine (canManageFounders, hasActiveVentureAssignment, checkVentureMemberMutateAccess), et les lectures partagees sont des referentiels.

### 3.3 Role global seul (ROLE) : 129 handlers

Controle par liste de roles globaux (roles:[...]) : c est une decision de permission, mais grossiere (pas de capacite ni de portee). Exemples : admin/* (11), v2/* (10), security/* (5), migrate/* (5), campaigns/* (5), venture-permissions/* (6), investor/* (11), platform/* (12). A migrer progressivement vers requireAuthorization/portees selon le plan MVC.

## 4. A_PROTEGER

Deux handlers exposes sans authentification, sans decision de permission et sans limitation de debit. Ils sont en ecriture et acceptent des identifiants fournis par l appelant.

| Fichier | Methode | Route | Ce que fait | Pourquoi c est risque |
|---|---|---|---|---|
| src/app/api/respond/route.js | POST | /api/respond | Enregistre une reponse de campagne publique via services/platformRespond.recordPublicCampaignResponse (insertion, scoring, derivation du statut de contact) | Aucune authentification, aucune verification de jeton ni de campagne, aucun rate-limit : n importe qui peut injecter des reponses en masse et faire grossir la base (abus/spam, deni de service applicatif). C est l ancien point d entree public, remplace par /s/public-submit qui, lui, est limite par run et protege par jeton navigateur |
| src/app/api/s/public-draft/route.js | POST | /api/s/public-draft | Cree ou met a jour un brouillon de formulaire public (cle slug) ; a la creation, genere un jeton de brouillon | Aucune authentification ni limitation de debit : n importe qui peut creer un nombre illimite de brouillons (croissance de stockage, abus). La mise a jour exige le jeton stocke, mais la creation est ouverte |

Ces deux routes devraient au minimum etre limitees en debit (enforceRateLimit) comme leurs equivalents recents, et valider l existence/activeite de la campagne ou du slug cible.

## 5. Resume chiffre

| Categorie | Handlers | Part |
|---|---|---|
| Total handlers HTTP exportes | 748 | 100% |
| Decision centralisee (moteur de capacites ou portee) | 416 | 55,6% |
| Decision centralisee deleguee (participant-programs) + hub form-runs | 4 | 0,5% |
| Role global seul (liste roles:[...]) | 129 | 17,2% |
| Authentification seule | 155 | 20,7% |
| Sans decision (SANS_DECISION) | 48 | 6,4% |
| dont OUVERTE_ASSUMEE | 42 | 5,6% |
| dont A_PROTEGER | 2 | 0,3% |
| dont decision en fait deleguee (reclassee) | 4 | 0,5% |

Repartition des 48 SANS_DECISION en trois classes : PERSONNELLE_LEGITIME = 0 (aucune de ces routes n agit sur les donnees propres d un utilisateur connecte) ; OUVERTE_ASSUMEE = 42 ; A_PROTEGER = 2 ; + 4 reclassees en decision deleguee.

## 6. Incertitudes

- Decisions deleguees invisibles au niveau route. Plusieurs route.js confient leur decision a un service ou a un import dynamique : participant-programs (services/programs/participantPrograms : requireAuth + requireAuthorization + requireProgramScope), ventures/[id]/members (models/ventureMemberAccess checkVentureMemberViewAccess/checkVentureMemberMutateAccess), ventures/[id]/founders/* (services/ventures/founders canManageFounders), ventures/[id]/lead et lifecycle (import dynamique de hasActiveVentureAssignment et requireOperationalVentureAccess). Ces handlers figurent en AUTH_SEULE dans les tableaux alors qu ils appliquent bien une decision : le tableau decrit le mecanisme OBSERVABLE dans le fichier route, pas la decision cachee. A verifier un par un pour un audit exhaustif.
- Pattern isAuthError. Certaines routes renvoient simplement data.response quand le service signale data.isAuthError (participant-programs, invitations). La decision est alors dans le service, non dans la route.
- invites/[token] POST classe CENTRALISE uniquement a cause de assertNoParticipantFacilitatorConflict (garde de conflit 409, pas une decision de permission). En pratique la route est publique par jeton d invitation ; a reclasser en OUVERTE_ASSUMEE.
- platform/form-runs POST est un hub : la classe depend de la valeur du parametre action. 19 sous-actions sont centralisees (requireAuthorization runs), mais la sous-action submit ne verifie que la session (AUTH_SEULE). Un inventaire par sous-action serait plus precis.
- platform/ai/analyze GET, platform/seed/founder-assessment GET, et quelques autres apparaissent en AUTH_SEULE alors qu un tableau de roles peut etre passe en argument d une constante (ex. requireAuth([super_admin]) inline). La detection des listes de roles est heuristique et peut manquer les cas ou la liste est construite dynamiquement.
- Routes getSession-seules. Les handlers qui lisent getSession et renvoient 401 manuellement (announcements, journey-reports, me/permissions, participant/announcements, profile, platform/notifications, platform/ai GET) sont supposes appliquer le 401 ; non verifie exhaustivement ligne a ligne.
- Enumeration par identifiant. /public/group-info?id=X expose le nom de groupe, le programme et la fenetre d inscription pour tout identifiant (pas de slug). C est voulu pour la page d inscription, mais reste enumerable ; a surveiller.
- requireScopedAccess( : 0 appel dans les route.js (14 occurrences hors routes, dans services/modeles). Le mecanisme scoped global n est donc pas utilise directement par les controleurs.
- Webhooks. La verification des signatures (Kkiapay via provider.verifyWebhookSignature, Resend via Svix) et le jeton de canal Google (verifie dans handleNotification) n ont pas ete audites en profondeur ; ils sont consideres comme des gardes OUVERTE_ASSUMEE sur la base du code lu en surface.
