# Lot 0 — actions serveur sans capacité (liste exacte)

Mesuré le 2026-10-21T05:50:32.769Z.

Définition : une action est « sans capacité » quand aucun contrôle de fichier ne vérifie une capacité. Les catégories distinguent les trous des déclarations légitimes.

| Catégorie | Nombre | Sens |
|---|---:|---|
| À protéger | 1 | Trou de décision à corriger |
| À vérifier — décision déléguée | 0 | Périmètre présent, capacité absente |
| Personnelle légitime | 34 | Déclarée « soi-même » |
| Ouverte assumée | 2 | Déclarée publique / hub / stub |

Le compteur d'audit « requireAuth sans contrôle central » est de **70** fichiers. La liste ci-dessous en contient **37** parce qu'elle inclut aussi les enveloppes d'action et les lectures de session manuelles.

## Compteur d'audit strict (70)

Ces fichiers appellent la garde de session mais jamais le contrôle central de capacité. Une capacité peut toutefois être vérifiée par une garde composée : la colonne le dit.

| Fichier | Capacité composée | Périmètre |
|---|---|---|
| `src/app/api/admin/projects/[id]/reports/generate/route.js` | non | oui |
| `src/app/api/attendance/route.js` | oui | oui |
| `src/app/api/auth/language/route.js` | non | non |
| `src/app/api/blockers/discuss/route.js` | non | non |
| `src/app/api/blockers/route.js` | non | non |
| `src/app/api/calendar/route.js` | non | non |
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
| `src/app/api/pm/full-state/route.js` | non | oui |
| `src/app/api/profile/history/route.js` | non | non |
| `src/app/api/projects/invitations/respond/route.js` | non | non |
| `src/app/api/retros/current/route.js` | non | non |
| `src/app/api/standups/current/route.js` | non | non |
| `src/app/api/submissions/route.js` | oui | oui |
| `src/app/api/tasks/assignment-action/route.js` | non | non |
| `src/app/api/tasks/assignments/route.js` | non | non |
| `src/app/api/tasks/duplicate/route.js` | non | non |
| `src/app/api/tasks/reconcile/route.js` | non | non |
| `src/app/api/tasks/route.js` | non | non |
| `src/app/api/upload/route.js` | non | non |
| `src/app/api/v2/program-staff/route.js` | non | non |
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

## À protéger (1)

| Fichier | Garde présente | Périmètre | Compteur d'audit strict |
|---|---|---|---|
| `src/app/api/integrations/google-calendar/connect/route.js` | requireAuth | non | oui |

## À vérifier — décision déléguée (0)

Aucune action.

## Personnelle légitime (34)

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
| `src/app/api/platform/notifications/route.js` | getSession | non | non |
| `src/app/api/profile/history/route.js` | requireAuth | non | oui |
| `src/app/api/profile/photo/route.js` | getSession | non | non |
| `src/app/api/profile/route.js` | getSession | non | non |
| `src/app/api/workspaces/route.js` | requireAuth | non | oui |

## Ouverte assumée (2)

| Fichier | Garde présente | Périmètre | Compteur d'audit strict |
|---|---|---|---|
| `src/app/api/auth/login/route.js` | getSession | non | non |
| `src/app/api/auth/session-login/route.js` | getSession | non | non |
