# Étape 3 — proposition de mapping menu → droit

Généré en lecture seule à partir de l'arbre de navigation, des droits
déjà déclarés et des tables de rôle actuelles. **Aucun code n'est modifié.**

Une destination est soit `public` (aucun droit), soit un ou plusieurs
droits séparés par ` OR ` (un seul suffit).

| Destination | Nom | Section parente | Droit actuel | Droit proposé | Rôles qui la voient aujourd'hui | Note |
|---|---|---|---|---|---|---|
| `dashboard` | DASHBOARD | — | — | `public` | super_admin, staff, member, team, finance |  |
| `crm` | CRM | — | `crm.view OR contacts.view OR org_membership.view OR duplicates.view` | — | super_admin, crm | déjà déclaré |
| `crm_dashboard` | DASHBOARD | `crm` | `crm.view OR contacts.view` | — | super_admin, crm | déjà déclaré |
| `all_contacts` | PEOPLE | `crm` | `contacts.view` | — | super_admin, crm | déjà déclaré |
| `crm_organizations` | ORGANIZATIONS | `crm` | `crm.view` | — | super_admin, crm | déjà déclaré |
| `crm_leads` | LEADS | `crm` | `crm.view` | — | super_admin, crm | déjà déclaré |
| `crm_opportunities` | OPPORTUNITIES | `crm` | `crm.view` | — | super_admin, crm | déjà déclaré |
| `crm_pipelines` | PIPELINES | `crm` | `crm.view` | — | super_admin, crm | déjà déclaré |
| `crm_activities` | ACTIVITIES | `crm` | `crm.view` | — | super_admin, crm | déjà déclaré |
| `crm_segments` | SEGMENTS | `crm` | `crm.view` | — | super_admin, crm | déjà déclaré |
| `crm_automations` | AUTOMATIONS | `crm` | `crm.view` | — | super_admin, crm | déjà déclaré |
| `crm_timeline` | TIMELINE | `crm` | `contacts.view` | — | super_admin, crm | déjà déclaré |
| `crm_membership` | MEMBERSHIP | `crm` | `org_membership.view` | — | super_admin, crm | déjà déclaré |
| `crm_duplicates` | DUPLICATES | `crm` | `duplicates.view` | — | super_admin, crm | déjà déclaré |
| `pending_users` | PENDING APPROVALS | `crm` | `permissions.view_matrix` | — | super_admin | déjà déclaré |
| `bulk_upload` | BULK IMPORT | `crm` | `bulk_upload.execute` | — | super_admin | déjà déclaré |
| `communication` | COMMUNICATION | — | `messaging.view OR internal_comms.view OR forms.view OR runs.view OR collections.view` | — | super_admin, staff, crm | déjà déclaré |
| `messages` | MESSAGES | `communication` | `messaging.view` | — | super_admin, staff | déjà déclaré |
| `announcements` | ANNOUNCEMENTS | `communication` | — | `internal_comms.view` | super_admin | Le GET n'exige qu'une session ; l'écran est sous /admin. Décision : qui doit voir ou gérer les annonces ? Lecture = internal_comms.view ; publication = create_announcements ; modération = moderate. |
| `forms` | FORMS | `communication` | — | `forms.view` | super_admin, staff, crm |  |
| `groups` | GROUPS | `communication` | — | `programs.groups` | — | Page PM en LECTURE (groupes, équipes, staff du programme) ; les API /api/pm/* scopent au PM. Le droit de porte est programs.groups. |
| `programs` | PROGRAMS | — | `programs.view` | — | super_admin, staff, team | déjà déclaré |
| `all_programs` | ALL PROGRAMS | `programs` | — | `programs.view` | super_admin |  |
| `create_program` | CREATE PROGRAM | `programs` | — | `programs.create` | super_admin |  |
| `progress` | PROGRESS | `programs` | — | `programs.view` | super_admin |  |
| `ventures` | VENTURES | — | `ventures.view` | — | super_admin | déjà déclaré |
| `all_ventures` | ALL VENTURES | `ventures` | — | `ventures.view` | super_admin |  |
| `investors` | INVESTORS | — | `investor.view` | — | super_admin | déjà déclaré |
| `investors_manage` | INVESTOR MANAGEMENT | `investors` | — | `investor.view` | super_admin |  |
| `investors_dashboard` | DASHBOARD | `investors` | — | `investor.view` | super_admin |  |
| `investors_review` | REVIEW | `investors` | — | `investor.view` | super_admin |  |
| `investors_campaigns` | CAMPAIGNS | `investors` | — | `investor.view` | super_admin |  |
| `investors_relationships` | RELATIONSHIPS | `investors` | — | `investor.view` | super_admin |  |
| `investors_portfolio` | STUDIO PORTFOLIO | `investors` | — | `investor.view` | super_admin |  |
| `investors_deal_flow` | DEAL FLOW | `investors` | — | `investor.view` | super_admin |  |
| `investors_introductions` | INTRODUCTIONS | `investors` | — | `investor.view` | super_admin |  |
| `investors_metrics` | METRICS | `investors` | — | `investor.view` | super_admin |  |
| `finance` | FINANCE | — | `finance.view` | — | super_admin | déjà déclaré |
| `operations` | OPERATIONS | — | `tasks.view` | — | super_admin | déjà déclaré |
| `internal_ops_board` | OPS BOARD | `operations` | — | `tasks.view OR projects.view` | super_admin | Board ops : tasks.view ou projects.view, selon le contenu réel du board. |
| `all_projects` | PROJECTS | `operations` | — | `projects.view` | super_admin |  |
| `create_project` | CREATE PROJECT | `operations` | — | `projects.create` | super_admin |  |
| `tasks` | TASKS | `operations` | — | `tasks.view` | super_admin |  |
| `blockers` | BLOCKERS | `operations` | — | `tasks.view` | super_admin |  |
| `standup` | STANDUP | `operations` | — | `reports.create` | super_admin |  |
| `retro` | RETRO | `operations` | — | `reports.create` | super_admin |  |
| `intelligence` | INTELLIGENCE | — | — | `knowledge.view` | super_admin | L'API /api/intelligence/metrics exige knowledge.view (section knowledge), pas reports.view. |
| `reports` | REPORTS | — | `reports.view` | — | super_admin | déjà déclaré |
| `program_reports` | PROGRAM REPORTS | `reports` | — | `reports.view` | super_admin |  |
| `internal_reports` | OP REPORTS | `reports` | — | `reports.view` | super_admin |  |
| `metrics` | PROGRAM HEALTH | `reports` | — | `reports.view` | super_admin |  |
| `my_projects` | MY PROJECTS | `reports` | `projects.view` | — | staff | déjà déclaré |
| `knowledge` | KNOWLEDGE | — | `knowledge.view` | — | super_admin | déjà déclaré |
| `knowledge_base` | KNOWLEDGE BASE | `knowledge` | — | `knowledge.view` | super_admin |  |
| `lms` | LMS | — | `lms.view OR lms.create OR lms.edit` | — | super_admin | déjà déclaré |
| `lms_courses` | COURSES | `lms` | — | `lms.view OR lms.create OR lms.edit` | super_admin |  |
| `lms_registrations` | REGISTRATIONS | `lms` | — | `lms.edit` | super_admin |  |
| `settings` | SETTINGS | — | `settings.view` | — | super_admin | déjà déclaré |
| `system` | SYSTEM MONITORING | `settings` | — | `settings.view` | super_admin |  |
| `security` | SECURITY | `settings` | `settings.view` | — | super_admin | déjà déclaré |
| `audit_logs` | AUDIT LOGS | `settings` | — | `settings.view` | super_admin |  |
| `access_summary` | USER ACCESS | `settings` | — | `permissions.view_matrix` | super_admin |  |
| `permissions` | PERMISSIONS | `settings` | — | `permissions.view_matrix` | super_admin |  |
| `projects` | PROJECTS | — | `projects.view` | — | — | déjà déclaré |
| `weekly_ops` | WEEKLY OPS | — | `reports.create` | — | staff | déjà déclaré |
| `my_projects` | MY PROJECTS | — | `projects.view` | — | staff | déjà déclaré |
| `my_programs` | MY PROGRAMS | — | — | `public` | — |  |
| `reviews` | MY REVIEWS | — | — | `public` | — | Page personnelle : /api/facilitator-reviews exige seulement une session et renvoie les avis du facilitateur. |
| `profile` | PROFILE | — | — | `public` | finance |  |
| `learning` | MY LEARNING | — | — | `public` | — | Surface personnelle : /api/lms/my-learning exige seulement une session et scope au participant. |
| `certificates` | MY CERTIFICATES | — | — | `public` | — | Surface personnelle : /api/participant/certificates exige seulement une session. |
| `timeline` | MY TIMELINE | — | — | `public` | — | Surface personnelle : /api/participant/timeline exige seulement une session. |
| `portfolio` | PORTFOLIO | — | — | `public` | — | Surface personnelle investisseur : l'API self-service admet un membre avec un profil investisseur, même sans investor.view. |
| `activity` | ACTIVITY | — | — | `public` | — | Surface personnelle : /api/investor/decisions self-service, scopée à l'investisseur. |

## Constats

- `my_projects` apparaît **deux fois** dans l'arbre maître (une fois sous `reports`, une fois à la racine). C'est un point à corriger avant de dériver le menu.
- La section `security` porte déjà `settings.view`, plus large que la fonctionnalité sécurité ; à revoir.
- `pending_users` porte déjà `permissions.view_matrix` ; les approbations pourraient relever de `users.view`.
- Les 31 destinations déjà déclarées le sont dans le code (`NAV_CAPABILITY_REQUIREMENTS`), pas en base. L'étape 3 devra aussi les déplacer en données.

## Points à valider

- Les destinations `public` sont accessibles sans droit ; elles doivent
  réellement être personnelles ou neutres.
- Les propositions `OR` ouvrent la porte à plusieurs droits ; vérifier
  qu'aucune ne mélange deux publics différents.
- Les rôles listés sont l'état ACTUEL, pas la cible : ils servent à
  repérer une éventuelle perte de porte lors de la bascule.
