# Lot 0 — actions serveur sans capacité (liste exacte)

Mesuré le 2026-10-20T22:36:40.121Z.

Définition : une action est « sans capacité » quand aucun contrôle de fichier ne vérifie une capacité. Les catégories distinguent les trous des déclarations légitimes.

| Catégorie | Nombre | Sens |
|---|---:|---|
| À protéger | 73 | Trou de décision à corriger |
| À vérifier — décision déléguée | 3 | Périmètre présent, capacité absente |
| Personnelle légitime | 33 | Déclarée « soi-même » |
| Ouverte assumée | 2 | Déclarée publique / hub / stub |

Le compteur d'audit « requireAuth sans contrôle central » est de **84** fichiers. La liste ci-dessous en contient **111** parce qu'elle inclut aussi les enveloppes d'action et les lectures de session manuelles.

## Compteur d'audit strict (84)

Ces fichiers appellent la garde de session mais jamais le contrôle central de capacité. Une capacité peut toutefois être vérifiée par une garde composée : la colonne le dit.

| Fichier | Capacité composée | Périmètre |
|---|---|---|
| `src/app/api/admin/projects/[id]/reports/generate/route.js` | non | oui |
| `src/app/api/attendance/route.js` | oui | oui |
| `src/app/api/auth/invite-family/route.js` | non | non |
| `src/app/api/auth/language/route.js` | non | non |
| `src/app/api/blockers/discuss/route.js` | non | non |
| `src/app/api/blockers/route.js` | non | non |
| `src/app/api/calendar/route.js` | non | non |
| `src/app/api/campaigns/[id]/route.js` | non | non |
| `src/app/api/contact-emails/route.js` | non | non |
| `src/app/api/facilitator-reviews/route.js` | oui | oui |
| `src/app/api/facilitators/invite-bulk/route.js` | oui | oui |
| `src/app/api/group-members/route.js` | oui | oui |
| `src/app/api/integrations/google-calendar/callback/route.js` | non | non |
| `src/app/api/integrations/google-calendar/connect/route.js` | non | non |
| `src/app/api/integrations/google-calendar/events/route.js` | non | non |
| `src/app/api/integrations/google-calendar/route.js` | non | non |
| `src/app/api/integrations/google-calendar/sync/route.js` | non | non |
| `src/app/api/intents/[id]/route.js` | non | non |
| `src/app/api/intents/[id]/tasks/route.js` | non | non |
| `src/app/api/intents/route.js` | non | non |
| `src/app/api/investor/approval/route.js` | non | non |
| `src/app/api/investor/campaigns/route.js` | non | non |
| `src/app/api/investor/pipeline/route.js` | oui | non |
| `src/app/api/investor/profile/route.js` | oui | non |
| `src/app/api/investor/relationships/meetings/route.js` | oui | non |
| `src/app/api/investor/relationships/route.js` | oui | non |
| `src/app/api/kpis/route.js` | oui | oui |
| `src/app/api/lms/assessments/[id]/submit/route.js` | non | non |
| `src/app/api/lms/assessments/[id]/take/route.js` | non | non |
| `src/app/api/lms/certificates/[id]/download/route.js` | non | non |
| `src/app/api/lms/certificates/[id]/route.js` | non | non |
| `src/app/api/lms/certificates/route.js` | non | non |
| `src/app/api/lms/courses/[id]/learn/route.js` | non | non |
| `src/app/api/lms/lessons/[id]/complete/route.js` | non | non |
| `src/app/api/lms/my-learning/route.js` | non | non |
| `src/app/api/me/relationships/route.js` | non | non |
| `src/app/api/notifications/route.js` | non | non |
| `src/app/api/participant-programs/bulk/route.js` | oui | oui |
| `src/app/api/participant/assignments/route.js` | non | non |
| `src/app/api/participant/certificates/route.js` | non | non |
| `src/app/api/participant/full-state/route.js` | non | non |
| `src/app/api/participant/home/route.js` | non | non |
| `src/app/api/participant/programs/[id]/route.js` | non | non |
| `src/app/api/participant/programs/route.js` | non | non |
| `src/app/api/participant/progress/route.js` | non | non |
| `src/app/api/participant/timeline/route.js` | non | non |
| `src/app/api/participants/route.js` | oui | oui |
| `src/app/api/platform/collections/route.js` | non | non |
| `src/app/api/platform/investor-run/route.js` | non | non |
| `src/app/api/pm/full-state/route.js` | non | oui |
| `src/app/api/profile/history/route.js` | non | non |
| `src/app/api/projects/invitations/respond/route.js` | non | non |
| `src/app/api/retros/current/route.js` | non | non |
| `src/app/api/send-pending/route.js` | non | non |
| `src/app/api/standups/current/route.js` | non | non |
| `src/app/api/submissions/route.js` | oui | oui |
| `src/app/api/tasks/assignment-action/route.js` | non | non |
| `src/app/api/tasks/assignments/route.js` | non | non |
| `src/app/api/tasks/duplicate/route.js` | non | non |
| `src/app/api/tasks/reconcile/route.js` | non | non |
| `src/app/api/tasks/route.js` | non | non |
| `src/app/api/upload/route.js` | non | non |
| `src/app/api/v2/groups/route.js` | non | non |
| `src/app/api/v2/program-staff/route.js` | non | non |
| `src/app/api/venture-kpi-definitions/route.js` | non | non |
| `src/app/api/venture-options/route.js` | non | non |
| `src/app/api/venture-permissions/matrix/route.js` | non | non |
| `src/app/api/venture-permissions/responsibilities/route.js` | non | non |
| `src/app/api/venture-permissions/scopes/route.js` | non | non |
| `src/app/api/venture-templates/route.js` | non | non |
| `src/app/api/ventures/[id]/advisors/route.js` | oui | oui |
| `src/app/api/ventures/[id]/coaching/route.js` | oui | oui |
| `src/app/api/ventures/[id]/documents/[docId]/permissions/route.js` | oui | oui |
| `src/app/api/ventures/[id]/documents/[docId]/reviews/route.js` | oui | oui |
| `src/app/api/ventures/[id]/documents/[docId]/transition/route.js` | oui | oui |
| `src/app/api/ventures/[id]/documents/[docId]/versions/route.js` | oui | oui |
| `src/app/api/ventures/[id]/documents/route.js` | oui | oui |
| `src/app/api/ventures/[id]/history/route.js` | oui | oui |
| `src/app/api/ventures/[id]/lead/route.js` | oui | oui |
| `src/app/api/ventures/[id]/lifecycle/route.js` | oui | oui |
| `src/app/api/ventures/[id]/member-invitations/route.js` | oui | oui |
| `src/app/api/ventures/[id]/members/route.js` | oui | oui |
| `src/app/api/ventures/[id]/progress/route.js` | oui | oui |
| `src/app/api/workspaces/route.js` | non | non |

## À protéger (73)

| Fichier | Garde présente | Périmètre | Compteur d'audit strict |
|---|---|---|---|
| `src/app/api/auth/invite-family/route.js` | requireAuth | non | oui |
| `src/app/api/blockers/discuss/route.js` | requireAuth | non | oui |
| `src/app/api/blockers/route.js` | requireAuth | non | oui |
| `src/app/api/calendar/route.js` | requireAuth | non | oui |
| `src/app/api/campaigns/[id]/route.js` | requireAuth | non | oui |
| `src/app/api/campaigns/route.js` | createHandler | non | non |
| `src/app/api/contact-emails/route.js` | requireAuth | non | oui |
| `src/app/api/followups/route.js` | createHandler | non | non |
| `src/app/api/integrations/google-calendar/connect/route.js` | requireAuth | non | oui |
| `src/app/api/intents/[id]/route.js` | requireAuth | non | oui |
| `src/app/api/intents/[id]/tasks/route.js` | requireAuth | non | oui |
| `src/app/api/intents/route.js` | requireAuth | non | oui |
| `src/app/api/investor/approval/route.js` | requireAuth | non | oui |
| `src/app/api/investor/campaigns/route.js` | requireAuth | non | oui |
| `src/app/api/journey-reports/route.js` | getSession | non | non |
| `src/app/api/notifications/route.js` | requireAuth | non | oui |
| `src/app/api/notifications/venture/route.js` | createHandler | non | non |
| `src/app/api/participant/full-state/route.js` | requireAuth | non | oui |
| `src/app/api/participant/submissions/route.js` | createHandler | non | non |
| `src/app/api/platform/collections/route.js` | requireAuth | non | oui |
| `src/app/api/platform/investor-run/route.js` | requireAuth | non | oui |
| `src/app/api/platform/notifications/route.js` | getSession | non | non |
| `src/app/api/projects/assignments/route.js` | createHandler | non | non |
| `src/app/api/projects/invitations/respond/route.js` | requireAuth | non | oui |
| `src/app/api/projects/invitations/route.js` | createHandler | non | non |
| `src/app/api/retros/current/route.js` | requireAuth | non | oui |
| `src/app/api/send-pending/route.js` | requireAuth | non | oui |
| `src/app/api/standups/current/route.js` | requireAuth | non | oui |
| `src/app/api/tasks/assignment-action/route.js` | requireAuth | non | oui |
| `src/app/api/tasks/assignments/route.js` | requireAuth | non | oui |
| `src/app/api/tasks/carryover/route.js` | createHandler | non | non |
| `src/app/api/tasks/comments/route.js` | createHandler | non | non |
| `src/app/api/tasks/duplicate/route.js` | requireAuth | non | oui |
| `src/app/api/tasks/logs/route.js` | createHandler | non | non |
| `src/app/api/tasks/reconcile/route.js` | requireAuth | non | oui |
| `src/app/api/tasks/resources/route.js` | createHandler | non | non |
| `src/app/api/tasks/route.js` | requireAuth | non | oui |
| `src/app/api/upload/route.js` | requireAuth | non | oui |
| `src/app/api/v2/groups/route.js` | requireAuth | non | oui |
| `src/app/api/v2/program-staff/route.js` | requireAuth | non | oui |
| `src/app/api/venture-kpi-definitions/route.js` | requireAuth | non | oui |
| `src/app/api/venture-options/route.js` | requireAuth | non | oui |
| `src/app/api/venture-permissions/matrix/route.js` | requireAuth | non | oui |
| `src/app/api/venture-permissions/responsibilities/route.js` | requireAuth | non | oui |
| `src/app/api/venture-permissions/scopes/route.js` | requireAuth | non | oui |
| `src/app/api/venture-plan-templates/apply/route.js` | createHandler | non | non |
| `src/app/api/venture-plan-templates/route.js` | createHandler | non | non |
| `src/app/api/venture-templates/route.js` | requireAuth | non | oui |
| `src/app/api/ventures/[id]/coach-invite/route.js` | getSession | non | non |
| `src/app/api/ventures/[id]/document-types/[typeId]/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/founders/[founderId]/reactivate/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/founders/[founderId]/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/founders/[founderId]/suspend/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/founders/transfer-ownership/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/journey/apply-journey-template/route.js` | getSession | non | non |
| `src/app/api/ventures/[id]/journey/apply-template/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/journey/archive/route.js` | getSession | non | non |
| `src/app/api/ventures/[id]/journey/delete/route.js` | getSession | non | non |
| `src/app/api/ventures/[id]/journey/duplicate/route.js` | getSession | non | non |
| `src/app/api/ventures/[id]/journey/save-template/route.js` | getSession | non | non |
| `src/app/api/ventures/[id]/my-access/route.js` | getSession | non | non |
| `src/app/api/ventures/[id]/notes/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/operating-plans/[planId]/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/operating-plans/[planId]/sections/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/operating-plans/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/progress-reports/route.js` | getSession | non | non |
| `src/app/api/ventures/[id]/startup-profile/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/startup-profile/submit/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/verification/documents/[docId]/versions/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/verification/route.js` | createHandler | non | non |
| `src/app/api/ventures/[id]/verification/status/route.js` | createHandler | non | non |
| `src/app/api/ventures/assigned/route.js` | createHandler | non | non |
| `src/app/api/ventures/lead-manager/home/route.js` | createHandler | non | non |

## À vérifier — décision déléguée (3)

| Fichier | Garde présente | Périmètre | Compteur d'audit strict |
|---|---|---|---|
| `src/app/api/admin/projects/[id]/reports/generate/route.js` | requireAuth | oui | oui |
| `src/app/api/pm/full-state/route.js` | requireAuth | oui | oui |
| `src/app/api/projects/discuss/route.js` | createHandler | oui | non |

## Personnelle légitime (33)

| Fichier | Garde présente | Périmètre | Compteur d'audit strict |
|---|---|---|---|
| `src/app/api/auth/language/route.js` | requireAuth | non | oui |
| `src/app/api/auth/session/route.js` | getSession | non | non |
| `src/app/api/integrations/google-calendar/callback/route.js` | requireAuth | non | oui |
| `src/app/api/integrations/google-calendar/events/route.js` | requireAuth | non | oui |
| `src/app/api/integrations/google-calendar/route.js` | requireAuth | non | oui |
| `src/app/api/integrations/google-calendar/sync/route.js` | requireAuth | non | oui |
| `src/app/api/lms/assessments/[id]/submit/route.js` | requireAuth | non | oui |
| `src/app/api/lms/assessments/[id]/take/route.js` | requireAuth | non | oui |
| `src/app/api/lms/certificates/[id]/download/route.js` | requireAuth | non | oui |
| `src/app/api/lms/certificates/[id]/route.js` | requireAuth | non | oui |
| `src/app/api/lms/certificates/route.js` | requireAuth | non | oui |
| `src/app/api/lms/courses/[id]/learn/route.js` | requireAuth | non | oui |
| `src/app/api/lms/lessons/[id]/complete/route.js` | requireAuth | non | oui |
| `src/app/api/lms/my-learning/route.js` | requireAuth | non | oui |
| `src/app/api/me/permissions/route.js` | getSession | non | non |
| `src/app/api/me/relationships/route.js` | requireAuth | non | oui |
| `src/app/api/participant/announcements/route.js` | getSession | non | non |
| `src/app/api/participant/assignments/route.js` | requireAuth | non | oui |
| `src/app/api/participant/certificates/route.js` | requireAuth | non | oui |
| `src/app/api/participant/followups/route.js` | createHandler | non | non |
| `src/app/api/participant/home/route.js` | requireAuth | non | oui |
| `src/app/api/participant/programs/[id]/route.js` | requireAuth | non | oui |
| `src/app/api/participant/programs/route.js` | requireAuth | non | oui |
| `src/app/api/participant/progress/route.js` | requireAuth | non | oui |
| `src/app/api/participant/rituals/checkin/route.js` | createHandler | non | non |
| `src/app/api/participant/rituals/reflect/route.js` | createHandler | non | non |
| `src/app/api/participant/rituals/retro/route.js` | createHandler | non | non |
| `src/app/api/participant/rituals/standup/route.js` | createHandler | non | non |
| `src/app/api/participant/timeline/route.js` | requireAuth | non | oui |
| `src/app/api/profile/history/route.js` | requireAuth | non | oui |
| `src/app/api/profile/photo/route.js` | getSession | non | non |
| `src/app/api/profile/route.js` | getSession | non | non |
| `src/app/api/workspaces/route.js` | requireAuth | non | oui |

## Ouverte assumée (2)

| Fichier | Garde présente | Périmètre | Compteur d'audit strict |
|---|---|---|---|
| `src/app/api/auth/login/route.js` | getSession | non | non |
| `src/app/api/auth/session-login/route.js` | getSession | non | non |
