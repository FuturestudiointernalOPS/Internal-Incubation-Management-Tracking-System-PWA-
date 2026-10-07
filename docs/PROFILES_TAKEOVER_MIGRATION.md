# Migration — les profils reprennent les access profiles

**Statut :** tranches 1 à 5, garde d'assignation, seed direct (6a), A1 (override par clé de profil) et B1 (défaut de rôle éditable) faits. Reste la suppression des routes/tables/UI retirées.

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
| 3 | Résolveur | `contextReads` + `baseCapabilities` lisent `profile_capabilities` (priorité), repli sur l'ancien chemin tant qu'il existe. **FAIT** | Moyen |
| 4 | API | `/api/engineering/permissions/profiles` gère capacités + créer/supprimer ; catalogue dynamique (clés libres, libellés stockés, validation par forme). **FAIT** (`baseCapabilities.js` — le garde d'assignation — reste à basculer en tranche 5) | Moyen |
| 5 | UI | Écran « Profiles » unique : créer/supprimer un profil, éditer ses capacités ; sous-onglet « Access profiles » et rollup retirés. **FAIT** (`baseCapabilities.js` — le garde d'assignation — reste à basculer : comportement d'avertissement, pas une décision d'accès) | Moyen |
| 6 | Nettoyage | **6a FAIT** : seed direct du catalogue. **A1 FAIT** : l'override individuel de l'écran People passe par la clé de profil (nouvelle route). **B1 FAIT** : « Défaut pour » réintroduit sur l'écran Profiles. **Reste** : supprimer les routes `/api/access-profiles*`, l'éditeur mort (`AccessProfilesView` + blocs + `EntitlementRollup`) et enfin les tables. | Élevé (en dernier) |

## 4. Garde-fous

- **Aucune perte d'accès** : chaque modèle existant a une destination ; les
  overrides individuels sont migrés vers `profile_key`.
- **Idempotence** : la migration de données est enregistrée une fois par base
  (`runAuthzMigration`) et n'écrase jamais une décision d'administrateur.
- **Rien en dur** : les capacités vivent en base et sont éditables par l'UI ;
  le catalogue `PROFILE_CATALOG` ne fournit plus que les libellés i18n initiaux.
- **Suites de tests** : `npm run lint` et `npm test` verts à chaque tranche.
