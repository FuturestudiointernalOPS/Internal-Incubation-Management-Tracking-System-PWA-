# Migration — les profils reprennent les access profiles

**Statut :** produit migré (profils porteurs), A1/B1 faits, surfaces `access_profiles` retirées, **registre des contextes + grants contextuels portés sur `profile_key`**, **colonne d'override des affectations portée sur `profile_key`**, **repli legacy retiré des lectures vivantes**. Reste le retrait des tables physiques (surfaces restantes : écran matrice, admin éligibilité, migrations de boot, schéma).

**Décisions produit validées :**

1. `program_manager` devient **un seul profil**, avec l'accès **programme seulement**
   (l'ancien modèle portfolio « Program Manager » est abandonné).
2. Les modèles ad hoc (Project Owner, Operations Manager, Instructor,
   Finance Assistant) sont **convertis en profils**.
3. **Tous** les profils ont des permissions **dynamiques**, éditables depuis
   l'interface : rien n'est figé dans le code.

---

## 1. Le modèle avant

| Couche | Table(s) | Rôle |
|---|---|---|
| Identité de base | `contacts.role` | super_admin / staff / member |
| Profils contextuels | `profiles` | *qui* la personne est (founder, learner…). **Aucune capacité** |
| Access profiles (modèles) | `access_profiles` + `access_profile_capabilities` | *ce que* la personne reçoit |

Trois ponts reliaient les modèles au reste :

- `role_access_profile_defaults` — rôle de base → modèle
- `context_role_profiles` — rôle contextuel → modèle (`profile_id`)
- `contacts.access_profile_id` — override individuel

Le résolveur (`services/authorization/contextResolver.js`) choisissait le modèle
(override → défaut de rôle → legacy), puis lisait ses capacités.

## 2. Le modèle cible

| Couche | Table(s) | Rôle |
|---|---|---|
| Identité de base | `contacts.role` + `role_capabilities` | super_admin / staff / member et leurs capacités par défaut |
| **Profils (porteurs)** | `profiles` + **`profile_capabilities`** | *qui* la personne est **et** ce que le profil accorde |
| Ponts | `role_profile_defaults`, `context_role_profiles.profile_key`, `contacts.profile_key` | tout pointe vers une **clé de profil** |

`access_profiles` et `access_profile_capabilities` disparaissent du produit (UI,
API, résolveur). Les modèles qui n'ont pas d'équivalent contextuel deviennent des
profils (contexte `staff` / `global`).

### Répartition décidée

Rôles de base → `role_capabilities` (mécanisme existant, déjà le repli legacy) :

| Modèle d'origine | Destination |
|---|---|
| Super Admin Default | `role_capabilities('super_admin')` |
| Staff Default | `role_capabilities('staff')` |
| Venture Member | `role_capabilities('member')` |

Profils → `profile_capabilities` :

| Modèle d'origine | Clé de profil |
|---|---|
| Participant Default | `participant` |
| Mentor | `investor` |
| Founder | `founder` |
| Learner | `learner` |
| Venture Manager | `venture_manager` |
| **Assigned Program Manager** | `program_manager` (programme seulement) |
| Venture Member (contexte) | `venture_member` (nouveau) |
| Project Owner | `project_owner` (nouveau) |
| Operations Manager | `operations_manager` (nouveau) |
| Instructor | `instructor` (nouveau) |
| Finance Assistant | `finance_assistant` (nouveau) |
| Program Manager (portfolio) | **abandonné** (fusion dans `program_manager`) |

## 3. Tranches (chacune laisse la suite de tests verte)

| # | Tranche | Contenu | Risque |
|---|---|---|---|
| 1 | **Fondation** (ce commit) | Schéma additif : `profile_capabilities`, `role_profile_defaults`, `profiles.label`, `context_role_profiles.profile_key`, `contacts.profile_key`. Store + validation. | Nul (additif) |
| 2 | Données | Migration one-time `profiles-takeover-v1` (`profileTakeoverBackfill.js`) : crée les profils manquants, copie les capacités, recopie les trois ponts. Anciennes tables intactes. **FAIT** | Faible |
| 3 | Résolveur | `contextReads` + `baseCapabilities` lisent `profile_capabilities` par clé ; le repli legacy sur `access_profiles`/`access_profile_capabilities` est **retiré** (le résolveur et le garde d'assignation ne connaissent plus que la clé). **FAIT** | Moyen |
| 4 | API | `/api/engineering/permissions/profiles` gère capacités + créer/supprimer ; catalogue dynamique (clés libres, libellés stockés, validation par forme). **FAIT** | Moyen |
| 5 | UI | Écran « Profiles » unique : créer/supprimer un profil, éditer ses capacités ; sous-onglet « Access profiles » et rollup retirés ; le garde d'assignation (`baseCapabilities.js`) résout par clé. **FAIT** | Moyen |
| 6 | Nettoyage | Surfaces retirées. **Portage FAIT** : les 10 rattrapages de modules + le rattrapage LMS écrivent désormais `profile_capabilities` par clé. **Registre des contextes FAIT** : `context_role_profiles` lit/écrit `profile_key` (seed par clé, `listContextRoleProfiles`/`getContextRoleProfile` en JOIN sur `profiles.key`, API + écran `ContextRolesView` par clé), et les migrations de boot redondantes (`assigned-program-manager-profile-v1`, `portfolio-program-manager-profile-v1`, `phase-e-context-profiles-v1`) sont **retirées** — le seed direct du catalogue + le seed du registre les remplacent. **Grants contextuels FAIT** : `contextGrantsStore.getProfileCapabilityRows` + `resolveContextDesiredCaps` lisent la clé (`profile_capabilities`). **Override des affectations FAIT** : `v2_program_staff.profile_key` (migration `program-assignment-profile-key-v1`, backfill NULL-only depuis `access_profile_id`) remplace l'id dans `programAssignmentReads` et `backfillFacilitatorTickLists`. **Repli legacy RETIRÉ** : le résolveur (`contextReads.resolveContactBaseProfile`/`resolveRoleDefaultBaseProfile`/`getBaseCapabilityRows`) et le garde d'assignation (`baseCapabilities.js`) ne lisent plus que la clé ; `getActiveAccessProfileById`, `getRoleDefaultAccessProfile` et les lectures `baseCapabilityReads` legacy sont supprimées. **Reste avant un `DROP TABLE`** : (a) les surfaces hors résolveur qui lisent encore les tables (écran matrice `permissionMatrix`, admin éligibilité `eligibilityAdminReads`, migrations de boot `profiles-takeover`/retired-role cleanup, schéma) ; (b) le feature « portfolio split » (`program-portfolio-default` + `programScopeReadiness`) à retirer ou porter ; (c) les CREATE du schéma + une migration `DROP`. | Élevé (en dernier) |

## 4. Garde-fous

- **Aucune perte d'accès** : chaque modèle existant a une destination ; les
  overrides individuels sont migrés vers `profile_key`.
- **Idempotence** : la migration de données est enregistrée une fois par base
  (`runAuthzMigration`) et n'écrase jamais une décision d'administrateur.
- **Rien en dur** : les capacités vivent en base et sont éditables par l'UI ;
  le catalogue `PROFILE_CATALOG` ne fournit plus que les libellés i18n initiaux.
- **Suites de tests** : `npm run lint` et `npm test` verts à chaque tranche.
