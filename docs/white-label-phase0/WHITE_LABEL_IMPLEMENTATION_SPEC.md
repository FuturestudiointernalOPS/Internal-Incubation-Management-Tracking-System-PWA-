# White-label ImpactOS — Spécification d’implémentation

> **Statut : spécification. Aucune ligne de code applicatif n’est encore
> modifiée.** Ce document décrit ce qu’il faut construire, dans quel ordre, avec
> quels points d’intégration et quels critères de non-régression.
>
> **Modèle conceptuel :**
> [`WHITE_LABEL_ORGANIZATION_MODEL.md`](./WHITE_LABEL_ORGANIZATION_MODEL.md).
>
> **Plan de réalisation :**
> [`WHITE_LABEL_DELIVERY_PLAN.md`](./WHITE_LABEL_DELIVERY_PLAN.md).
>
> **Documents de référence :**
> [`ARCHITECTURE.md`](./ARCHITECTURE.md),
> [`AUTHZ_CURRENT_STATE.md`](./AUTHZ_CURRENT_STATE.md),
> [`LAYER_SPLIT.md`](./LAYER_SPLIT.md),
> [`MVC_REFACTOR.md`](./MVC_REFACTOR.md),
> [`LMS_ARCHITECTURE.md`](./LMS_ARCHITECTURE.md),
> [`SECURITY_AUDIT_REGISTER.md`](./SECURITY_AUDIT_REGISTER.md),
> [`PRODUCTION_TEST.md`](./PRODUCTION_TEST.md).

---

## 1. Objectif et non-objectifs

### Objectif

Ajouter une frontière **organisation cliente** au-dessus de l’existant, puis
ouvrir un portail client limité aux modules **Programmes**, **LMS** et
**Venture**, sans modifier le comportement des écrans internes ni le moteur de
permissions déjà en place.

### Non-objectifs de la première version

- Pas de copie du code ni de la base par client.
- Pas de reprise massive des écrans internes.
- Pas de remplacement du moteur de permissions existant.
- Pas de modification des rôles, profils et plafonds d’éligibilité existants.
- Pas de gestion de facturation, de SSO ou de sous-domaines personnalisés dans
  le pilote.
- Pas de CRM multi-organisations dans le pilote.
- Pas de rapports transverses entre clients, hors supervision Future Studio.

---

## 2. Contraintes non négociables

1. **Les routes internes gardent leur moteur de permissions.**
   `resolveAuthorizationContext`, `getAuthorizationContext`, `requireAuthorization`
   et les gardes existants ne sont pas remplacés. Elles reçoivent un contexte
   d’organisation par défaut (l’organisation plateforme) pour que les données
   existantes restent visibles exactement comme avant.
2. **Le portail client est une entrée séparée.**
   Il réutilise les modèles, les services purs et les composants, mais il a ses
   propres routes, son propre shell et son propre garde.
3. **L’organisation active vient de la session authentifiée.**
   Elle n’est jamais lue depuis le corps de la requête, un paramètre d’URL ou le
   navigateur. Le code d’organisation présent dans l’URL est un **indice
   d’affichage**, pas une autorité.
4. **Aucun cumul entre organisations.**
   Les rôles et autorisations sont lus dans l’organisation active uniquement.
5. **Le refus est la valeur par défaut.**
   Une appartenance absente, une organisation suspendue, un module désactivé, un
   périmètre vide ou une erreur de lecture refusent l’accès.
   Décision confirmée par Christelle le 22 octobre 2026 : une organisation
   suspendue n’a aucun accès client, y compris en lecture ; aucune période de
   grâce en lecture seule. Les données restent conservées.
6. **La migration est additive.**
   Les données existantes rejoignent l’organisation plateforme. Aucune colonne
   existante n’est supprimée, aucun rôle n’est renommé, aucun droit n’est retiré.
7. **Pas d’interrupteur d’application de la règle.**
   Le garde du portail est toujours actif pour les routes du portail. Un
   interrupteur global qui pourrait être oublié n’est pas un contrôle.
8. **Les fichiers clients ne sont pas publics.**
   Le stockage actuel peut créer des buckets publics ; le portail client ne
   réutilise pas ce comportement pour des données privées.
9. **L’isolation fonctionne dans les deux sens.**
   Une requête interne sans contexte est limitée à l’organisation plateforme.
   Une requête interne qui vise une organisation cliente exige un mandat de
   supervision actif. Une requête cliente ne voit jamais la plateforme ni une
   autre organisation.
10. **Les écritures existantes restent valides.**
    Toute colonne d’organisation devenue obligatoire est remplie pour les
    anciens chemins de création par un déclencheur ou une valeur par défaut qui
    utilise l’organisation de session, sinon l’organisation plateforme. Aucun
    chemin interne ne doit échouer après la migration.
11. **La supervision précède la donnée cliente.**
    Aucune organisation cliente n’est activée avant que la supervision et
    l’isolation bidirectionnelle soient en place et testées.
12. **L’historique est garanti par la base.**
    Les tables d’historique refusent les suppressions et les modifications
    interdites par des déclencheurs et des privilèges, pas seulement par le
    service.

---

## 3. Stratégie : l’étrangleur, pas le grand soir

```
Phase 0  Inventaire et décisions           aucune modification applicative
Phase 1  Fondation et isolation            tables, org plateforme, session,
                                            filtres internes, écritures compatibles,
                                            supervision, garanties d'historique
Phase 2  Portail en lecture                programmes, LMS, ventures, membres
Phase 3  Écritures, fichiers, exports      remises, livrables, documents, partages
Phase 4  Durcissement et pilote fictif     revue sécurité, charge, runbooks
Phase 5  Promotion                          test de production
```

Chaque phase est réversible. Tant que le portail n’est pas activé, les routes
internes continuent de voir les données de l’organisation plateforme comme
avant.

---

## 4. Points d’intégration dans le code existant

### 4.1 Ce qui est créé

| Couche | Fichiers proposés |
|---|---|
| Modèles | `src/models/organizations.js` (barrel) + `src/models/organizations/{schema,core,branding,contracts,modules,memberships,roles,assignments,grants,invitations,licenses,supervision,audit,retention,scopes,scopedQueries,tenantTables,dbGuards}.js` |
| Services | `src/services/organizations/{index,organizationContext,organizationAccess,organizationAdmin,organizationInvitations,organizationBranding,organizationAudit,organizationExports,organizationFiles,organizationSupervision,organizationCache,organizationScopes,internalScope}.js` |
| Garde HTTP | `src/server/authz/organization.js` |
| API portail | `src/app/api/org/**/route.js` |
| API publique d’invitation | `src/app/api/org/invitations/accept/route.js` |
| API plateforme | `src/app/api/platform/organizations/**/route.js` |
| Pages portail | `src/app/o/[organizationCode]/**/page.js` + `layout.js`, `src/app/o/select/page.js`, `src/app/o/invite/[token]/page.js` |
| Composants | `src/components/organization/**` |
| Traductions | `src/locales/en/organization.json`, `src/locales/fr/organization.json` |
| Migration | `supabase/migrations/YYYYMMDD_white_label_organizations.sql` (tables, colonnes, index, déclencheurs, privilèges) |
| Tests | `src/__tests__/organization-*.test.js`, dont `organization-internal-isolation.test.js`, `organization-write-compatibility.test.js`, `organization-db-history.test.js` |

### 4.2 Ce qui est modifié, et seulement cela

| Fichier | Modification | Raison |
|---|---|---|
| `supabase/migrations/…` | Nouvelle migration additive : tables, colonnes, index, déclencheurs, privilèges | Créer la frontière et protéger l’historique |
| Modèles du pilote (programmes, LMS, ventures) | Ajouter une variante scopée qui exige l’organisation ; un adaptateur interne fournit l’organisation plateforme | Empêcher une requête interne de lire les données clientes |
| `src/lib/api/createHandler.js` | Attacher `organizationId` au request context (plateforme par défaut) | Journalisation et diagnostics |
| `src/models/sessions.js` | Lire/écrire `active_organization_id` | La session porte l’organisation active |
| `src/server/auth/session.js` | Ajouter `activeOrganizationId` au session object ; fonction de changement d’organisation ; invalidation du cache de session | Le changement d’organisation doit être immédiat |
| `src/server/auth/session.js` | Ne pas modifier les règles de statut, d’expiration ou de session unique | Non-régression |
| `src/lib/locales.js` | Importer et enregistrer le namespace `organization` en EN et FR | i18n |
| `src/app/api/auth/login/route.js` et `src/app/api/auth/session-login/route.js` (résolveur d’atterrissage partagé) | Rediriger vers `/o/<code>` **uniquement** si la personne a une appartenance cliente active | Les utilisateurs internes gardent leur atterrissage actuel |
| `src/lib/storage.js` | Ne pas modifier le comportement interne ; ajouter une fonction séparée pour les fichiers clients privés | Ne pas casser les fichiers existants |
| `src/proxy.js` | Ajouter `/o/invite` et `/api/org/invitations/accept` aux chemins publics | Le jeton d’invitation est le credential ; le proxy ne fait pas d’autorisation d’organisation |
| `src/models/authorization/constants/feature-module-capability.js` | Ajouter le module de capacités `organization_admin` (membres, rôles, marque, journal) | Administration de l’espace, additive |
| `AGENTS.md` | Ajouter le namespace `organization.*` au tableau i18n | Cohérence des instructions |

`src/proxy.js` n’est modifié que pour ajouter deux chemins publics ; il ne
devient pas un garde d’organisation. `src/lib/request-context.js` n’est pas
modifié : le garde appelle `setRequestContext({ organizationId })`.

### 4.3 Ce qui n’est pas modifié

- `src/services/authorization/contextResolver.js`
- `src/services/authorization/contextCache.js` (clé `cid|role|profiles`)
- `src/services/authorization/contextDecisions.js`
- `src/server/authz/guards.js`
- `src/server/authz/responses.js` (les gardes existants restent)
- `src/models/authorization/**` (tables, profils, éligibilité, périmètre)
- `src/lib/identity.js`
- `src/lib/masterNavigation.js`
- `src/components/layout/DashboardLayout.js`
- Les écrans internes existants ne sont pas réécrits : seuls les modèles du
  pilote gagnent un filtre d’organisation par défaut, ce qui préserve leur
  comportement pour les données de l’organisation plateforme.

---

## 5. Modèle de session et de contexte

### 5.1 Session

La session existante reste la même. On ajoute une colonne :

```sql
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS active_organization_id UUID
  REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_org
  ON user_sessions (active_organization_id);
```

Le session object expose :

```js
{
  cid,
  name,
  email,
  role,
  group_name,
  token,
  activeOrganizationId,
}
```

### 5.2 Choix de l’organisation active

À la connexion :

1. Lire les appartenances actives de la personne.
2. Si aucune appartenance cliente n’existe, ne rien changer : la personne reste
   dans le parcours interne actuel.
3. Si une seule appartenance cliente existe, elle devient active.
4. Si plusieurs existent, afficher le sélecteur `/o/select`.
5. L’organisation plateforme est toujours disponible pour le personnel interne,
   mais elle n’est pas proposée comme « espace client ».

Un salarié de Future Studio qui possède un mandat de supervision peut choisir
l’organisation supervisée sans appartenance. Ce choix est traité comme une
supervision, pas comme une appartenance : il est borné dans le temps et
journalisé.

### 5.3 Changement d’organisation

`POST /api/org/context` avec `{ organization_id }` :

1. Vérifier que la personne a une appartenance `active` **ou un mandat de
   supervision actif** dans cette organisation.
2. Vérifier que l’organisation est `active`.
3. Mettre à jour `user_sessions.active_organization_id`.
4. Invalider le cache de session du jeton courant.
5. Invalider le cache de contexte d’organisation de la personne.
6. Retourner le nouveau contexte.

**Règles :**

- Le changement d’organisation ne crée pas une nouvelle session.
- Un membre du personnel Future Studio peut basculer sur une organisation
  cliente uniquement avec un mandat de supervision actif ; le mandat reste
  visible et journalisé.
- Deux sessions simultanées peuvent avoir deux organisations actives
  différentes : l’organisation active est **par session**, pas par personne.
- Aucune donnée de l’ancienne organisation ne reste dans le contexte renvoyé.
- Le sélecteur ne réutilise pas `impactos_active_context` du `localStorage` :
  ce mécanisme existant reste pour les contextes de navigation internes et est
  ignoré par le portail.

### 5.4 Résolution du contexte d’organisation

Nouveau service : `resolveOrganizationContext({ cid, organizationId })`.

Requêtes (indexées) :

1. Appartenance active + organisation + contrat + modules.
2. Affectations de rôle actives + modèles de rôle + capacités de modèle.
3. Autorisations et refus actifs.
4. Marque.

Le résultat contient :

```js
{
  organization: { id, code, name, status, locale, timezone },
  membership: { id, status, startedAt, expiresAt },
  modules: { programs: true, lms: true, venture: true },
  roles: [{ assignmentId, roleKey, scopeType, scopeId }],
  capabilities: { programs: { view: 1, edit: 3 }, ... },
  branding: { displayName, logoUrl, primaryColor, ... },
}
```

**Qui fournit `organizationId` :**

- **requête interne** : l’organisation plateforme, par défaut ;
- **requête de supervision** : l’organisation cible, avec un mandat actif ;
- **portail client** : l’organisation active de la session ;
- **lien public** : l’organisation encodée dans le jeton, pour un objet unique.

Aucun appelant ne peut demander « toutes les organisations ». Une requête sans
contexte est refusée ou limitée à l’organisation plateforme ; elle n’est jamais
non filtrée.

### 5.5 Cache

Le cache existant `cid|role|profiles` **n’est pas modifié**.

Nouveau cache, séparé :

- clé : `cid|organizationId`;
- TTL : 30 à 60 secondes ;
- invalidé sur : changement d’organisation, ajout/retrait d’appartenance,
  changement de rôle, autorisation, refus, module, contrat ;
- l’appartenance active est **relue à chaque requête** (une requête indexée) ;
  seules les capacités et la marque sont mises en cache. Une révocation
  d’appartenance prend donc effet immédiatement.

Aucune donnée d’une organisation ne doit être servie depuis une entrée de cache
d’une autre organisation.

Comme le cache d’autorisation existant, ce cache est **local au processus** : une
écriture invalide l’instance qui la traite, et le TTL est le filet de sécurité
pour les autres instances. C’est pourquoi l’appartenance active est relue à
chaque requête : une révocation ne dépend pas de la propagation d’un cache.

### 5.6 Contexte interne et supervision

L’isolation doit fonctionner dans les deux sens.

- Une requête interne sans mandat est limitée à l’organisation plateforme. Elle
  ne peut pas retourner une ligne d’une organisation cliente.
- Une requête interne qui vise une organisation cliente exige un mandat de
  supervision actif, avec la portée `read` ou `export`. Même le propriétaire de
  la plateforme passe par ce mandat pour lire le contenu client.
- Une requête du portail client ne peut viser que l’organisation active de la
  session. Elle ne peut jamais atteindre l’organisation plateforme ni une autre
  organisation.
- Les modèles du pilote n’exposent qu’une variante scopée : l’organisation est
  exigée. Les appelants internes existants passent par un adaptateur qui fournit
  l’organisation plateforme ; les appelants du portail fournissent l’organisation
  active. Aucune variante non scopée ne subsiste.
- Une requête sans organisation est refusée, jamais interprétée comme « toutes
  les organisations ».

La supervision n’est pas une phase de fin de programme : le schéma, le garde et
les tests sont livrés en Phase 1, et l’accès au contenu client est bloqué tant
qu’ils ne sont pas verts.

---

## 6. Schéma de données

### 6.1 Principes

- Les nouvelles tables sont préfixées `organization_` ou `organizations`.
- Toute table cliente porte `organization_id`.
- Les index commencent par `organization_id`.
- Les unicités sont **par organisation**.
- Les nouvelles tables utilisent des clés composites quand c’est possible.
- Les tables historiques reçoivent d’abord une colonne nullable, puis un
  backfill, puis une contrainte sur les seules tables du pilote.
- Aucune colonne existante n’est supprimée.

### 6.2 Tables nouvelles

Voir l’annexe A pour le DDL complet. Les tables sont :

- `organizations`
- `organization_branding`
- `organization_contracts`
- `organization_modules`
- `organization_memberships`
- `organization_role_templates`
- `organization_role_template_capabilities`
- `organization_roles`
- `organization_role_assignments`
- `organization_grants`
- `organization_invitations`
- `organization_content_licenses`
- `organization_supervision_grants`
- `organization_audit_events`
- `organization_retention_policies`

### 6.3 Tables existantes du pilote

Le principe : **les tables racines et les tables lues directement par le
portail** reçoivent `organization_id`.

| Domaine | Tables racines | Colonne |
|---|---|---|
| Programmes | `v2_programs`, `v2_program_staff`, `participant_programs`, `v2_sessions`, `v2_groups`, `v2_kpis` | `organization_id` |
| LMS | `lms_courses` | `owner_organization_id` |
| LMS | `lms_enrollments`, `lms_certificates`, `lms_assessment_attempts` | `organization_id` |
| Venture | `ventures`, `venture_members`, `venture_tasks`, `venture_documents`, `venture_deliverables`, `venture_sessions` | `organization_id` |
| Groupes d’organisation | `groups` (le groupe interne reste rattaché à l’organisation plateforme) | `organization_id` |
| Formulaires | `platform_form_runs` (si utilisé par le portail) | `organization_id` |
| Fichiers | table de métadonnées de fichiers utilisée par le portail | `organization_id` |
| Exports | table des exports | `organization_id` |
| Notifications | table de notifications lue par le portail | `organization_id` |

Les tables purement enfants (commentaires, pièces jointes, progression d’une
leçon, réponses d’une tentative) peuvent ne pas porter la colonne si elles sont
toujours lues via leur parent. La règle est : **toute requête directe du portail
doit avoir un filtre d’organisation**, soit sur la table, soit via une jointure
avec une table qui le porte.

### 6.4 Index et unicités

```sql
CREATE INDEX IF NOT EXISTS idx_v2_programs_organization
  ON v2_programs (organization_id);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_org_person
  ON organization_memberships (organization_id, person_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_role_assignments_org
  ON organization_role_assignments (organization_id, membership_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_grants_org
  ON organization_grants (organization_id, subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_organization_audit_org_created
  ON organization_audit_events (organization_id, created_at DESC);
```

Les unicités existantes qui portent sur un nom, un slug ou un code doivent
devenir **par organisation** sur les tables du pilote. Exemples :

- nom de programme unique dans une organisation ;
- identifiant de cours unique dans une organisation ;
- nom de groupe unique dans une organisation.

Ne pas modifier une unicité existante sans inventaire : certaines sont utilisées
par des `ON CONFLICT`. La migration doit recréer l’index avec
`(organization_id, …)` et supprimer l’ancien seulement après vérification.

Cas particulier des groupes : l’unicité du nom devient
`(organization_id, name)`. Le groupe `FUTURE STUDIO` reste protégé et rattaché à
l’organisation plateforme. Les écritures qui utilisent `ON CONFLICT (name)`
doivent être adaptées en même temps.

### 6.5 Clés composites

Sur les nouvelles tables et les tables du pilote dont les types le permettent :

```sql
ALTER TABLE v2_programs
  ADD CONSTRAINT v2_programs_organization_id_id_key
  UNIQUE (organization_id, id);

ALTER TABLE v2_program_staff
  ADD CONSTRAINT v2_program_staff_program_org_fk
  FOREIGN KEY (organization_id, program_id)
  REFERENCES v2_programs (organization_id, id);
```

**Attention :** les identifiants historiques ne sont pas tous du même type
(entiers, UUID, texte). Une clé composite exige des types compatibles. Pour les
tables historiques qui ne s’y prêtent pas en Phase 1 :

- appliquer la vérification dans le service ;
- ajouter un test d’isolation ;
- planifier la normalisation des types dans une phase séparée.

Ne pas forcer une clé composite au prix d’une migration risquée.

### 6.6 Garanties de base et historique

Les règles d’historique ne doivent pas dépendre du service seul. La migration
installe des déclencheurs et des privilèges sur les tables critiques.

**Tables d’historique et de cycle de vie :**

- `organization_audit_events` : ajout seul ; `UPDATE` et `DELETE` refusés.
- `organization_memberships` : pas de suppression ; `status = 'ended'`.
- `organization_role_assignments` : pas de suppression ; `status = 'ended'`.
- `organization_roles` : pas de suppression ; `is_active = FALSE`.
- `organization_grants` : pas de suppression ; `revoked_at` et `revoked_by`.
- `organization_invitations` : pas de suppression ; `status = 'revoked'`.
- `organization_content_licenses` : pas de suppression ; `status = 'revoked'`.
- `organization_supervision_grants` : pas de suppression ; `status = 'ended'`.
- `organization_contracts`, `organization_modules` : pas de suppression ;
  `status` et dates de fin.

**Déclencheurs :**

- `forbid_delete()` : refuse toute suppression sur les tables de cycle de vie.
- `forbid_audit_mutation()` : refuse `UPDATE` et `DELETE` sur le journal.
- `forbid_immutable_update()` : refuse la modification des colonnes qui ne
  doivent plus changer après création (`organization_id`, `person_id`,
  `created_at`, `content_id`, `owner_organization_id`).
- `validate_scope_belongs_to_organization()` : vérifie que la fiche visée par
  `scope_type`/`scope_id` appartient à la même organisation. Ce contrôle est
  nécessaire parce que la portée est polymorphe et ne peut pas être une clé
  étrangère simple.
- `audit_lifecycle_change()` : écrit un événement minimal dans le journal pour
  les tables critiques, même si le service a oublié de le faire. Les compléments
  du service sont de nouveaux événements ; aucun événement existant n'est
  enrichi par UPDATE, puisque le journal est en ajout seul.

**Privilèges :**

- `REVOKE UPDATE, DELETE ON organization_audit_events FROM <application_role>`.
- `GRANT SELECT, INSERT ON organization_audit_events TO <application_role>`.
- Les déclencheurs restent nécessaires : le propriétaire d’une table contourne
  les privilèges, pas un déclencheur.

**Suppression légale :** une opération de conservation ou d’anonymisation passe
par une fonction dédiée, avec un motif et un événement de journal. Aucun chemin
applicatif ordinaire ne peut supprimer une ligne d’historique.

### 6.7 Compatibilité des écritures existantes

Les anciens chemins de création ne connaissent pas encore l’organisation. Pour
qu’une colonne puisse devenir obligatoire sans les casser :

1. Ajouter `organization_id` nullable.
2. Backfiller les lignes existantes vers l’organisation plateforme.
3. Installer un déclencheur `BEFORE INSERT` sur chaque table du pilote.
4. Tester chaque chemin de création existant.
5. Seulement ensuite, passer la colonne à `NOT NULL` sur les tables du pilote.

Le déclencheur :

- si `NEW.organization_id` est vide, utilise l’organisation de session
  (`app.organization_id`) si elle est posée, sinon l’organisation plateforme ;
- si `NEW.organization_id` est renseignée et que la session porte une
  organisation différente, refuse l’écriture ;
- si l’organisation plateforme n’existe pas, refuse l’écriture ;
- ne remplace jamais une organisation cliente par l’organisation plateforme.

Ainsi, un ancien chemin interne crée bien dans l’organisation plateforme. Pour
le portail, le service reste la première validation : il passe l’organisation
active et refuse toute différence. Le déclencheur est la seconde barrière,
active lorsque le contexte de session est posé.

**Chemins à tester explicitement :** création de programme, création de venture,
inscription LMS, import CSV, invitations, formulaires publics, création de
groupe, création de tâche, création de document. Le test vérifie
`organization_id = plateforme` après chaque création interne.

### 6.8 Isolation interne

Le portail séparé ne suffit pas : les requêtes internes doivent elles aussi être
filtrées.

- Les modèles du pilote n’exposent qu’une variante scopée : l’organisation est
  exigée. L’adaptateur interne fournit l’organisation plateforme ; le portail
  fournit l’organisation active.
- Aucune requête sur une table du pilote n’est autorisée sans prédicat
  d’organisation, et aucune variante non scopée ne subsiste.
- Le registre `tenantTables` liste les tables, la colonne et le test d’isolation.
- Un test statique échoue si une requête sur une table du registre n’a pas de
  filtre d’organisation, ou si une table cliente est ajoutée sans entrée.
- Les routes qui contiennent encore du SQL en ligne sont converties ou
  explicitement exemptées, avec un test qui empêche la réintroduction.
- Une requête interne qui vise une organisation cliente exige un mandat de
  supervision ; sinon, elle est limitée à l’organisation plateforme.

---

## 7. Migration

**Décision confirmée par Christelle le 23 octobre 2026 : migrations additives,
non destructives.** Ajouter les structures nécessaires sans supprimer ni
renommer les tables/colonnes existantes, sans effacer les données et sans
remplacer les contraintes d'unicité existantes dans la première tranche.
Les nouvelles colonnes des tables existantes restent facultatives au départ.
Le repli conserve les ajouts et ferme le portail ; il ne lance pas de migration
de suppression. Le DDL proposé dans les annexes reste une cible à découper et
à tester, pas une migration à appliquer intégralement.

La première migration préparée est
`supabase/migrations/20261023_white_label_programs_foundation.sql`.
Elle n'est pas exécutée automatiquement par l'application. Elle prépare
Programmes uniquement et bloque encore l'activation des clients et l'ajout
de programmes clients, tant que les lectures internes et la supervision ne
sont pas protégées. Les lignes existantes ne sont ni reprises ni modifiées.

La suite `20261023_white_label_programs_history.sql` ajoute les protections
d'historique, le journal et les références typées de cette première tranche.
Les deux fichiers ont été appliqués deux fois sur PostgreSQL 16 dans un
conteneur sans réseau avec schéma minimal et données fictives. Ce résultat
ne remplace pas la validation du schéma complet ni l'isolation du portail.
Voir `docs/white-label-phase0/PLAN_SOLO.md` pour le bilan et les limites de validation.

### 7.1 Ordre

| Étape | Contenu | Comportement visible |
|---|---|---|
| 0 | Inventaire des tables, points d’entrée, fichiers, exports, tâches de fond, requêtes internes | Aucun |
| 1 | Créer les tables nouvelles et l’organisation plateforme | Aucun |
| 2 | Ajouter `organization_id` nullable aux tables du pilote, backfill vers l’organisation plateforme, créer les index | Aucun |
| 3 | Installer les déclencheurs d’écriture compatibles (organisation de session, sinon plateforme) | Aucun |
| 4 | Tester chaque ancien chemin de création : l’organisation plateforme est bien renseignée | Aucun |
| 5 | Installer les déclencheurs d’historique, d’immuabilité, de portée et de journal | Aucun |
| 6 | Déployer les modèles filtrés par organisation et la supervision | Les écrans internes ne voient que la plateforme par défaut |
| 7 | Créer les modèles de rôles et les rôles de l’organisation plateforme | Aucun |
| 8 | Déployer le code du portail, désactivé | Aucun |
| 9 | Créer les organisations fictives ; activer seulement si supervision et isolation sont vertes | Uniquement pour elles |
| 10 | Passer `organization_id` en `NOT NULL` sur les tables du pilote | Aucun pour l’interne |
| 11 | Ajouter les clés composites et les contraintes | Aucun pour l’interne |
| 12 | Pilote réel, puis test de production | Uniquement pour les clients |

**Ordre critique :** les étapes 3 à 6 précèdent toute donnée cliente. Aucune
organisation cliente ne passe à `active` avant que l’isolation interne, la
supervision et la compatibilité des écritures soient testées.

### 7.2 Backfill de l’organisation plateforme

```sql
-- 1. Créer l'organisation plateforme une seule fois.
INSERT INTO organizations (code, name, kind, status, is_platform)
VALUES ('future-studio', 'Future Studio', 'company', 'active', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. Récupérer son identifiant.
--    (Le code ci-dessous est indicatif ; le script de migration le fera en une
--    seule requête.)
UPDATE v2_programs
SET organization_id = (SELECT id FROM organizations WHERE is_platform = TRUE)
WHERE organization_id IS NULL;
```

Le backfill doit être :

- idempotent ;
- exécuté par lots sur les grosses tables ;
- vérifié par un comptage avant/après ;
- accompagné d’une sauvegarde ou d’un point de restauration sur staging.

Le déclencheur d’écriture compatible est installé **après** le backfill et
**avant** le passage à `NOT NULL`. Il ne remplace jamais une organisation
explicite : il ne remplit que les valeurs vides, et refuse un conflit avec
l’organisation de session.

### 7.3 Rollback

- Désactiver le portail : les écrans internes restent disponibles.
- Les tables nouvelles sont additives ; on peut les laisser en place.
- Les colonnes `organization_id` restent en place et les filtres internes
  restent actifs.
- **Un rollback ne doit jamais rouvrir les filtres d’organisation.** Si le code
  du portail est retiré, les modèles filtrés et les déclencheurs restent.
- Ne pas supprimer une colonne ou une table contenant des données sans export
  préalable.
- Un rollback de code ne doit jamais nécessiter un rollback de schéma.

### 7.4 Environnements

- La migration et les tests se font sur **staging**.
- Le propriétaire a confirmé que `.env.local` pointe sur **staging** sur ce
  poste. Le contrôle read-only du 29 octobre 2026 y a trouvé 11 contacts,
  3 ventures et aucune table d’organisation white-label. `.env.audit-staging`
  est absent.
- Vérifier la référence du projet Supabase avant toute écriture ; les noms des
  fichiers d’environnement ne prouvent pas leur cible. Le runner
  `node scripts/db-audit/run-readonly.mjs <sql-file> <env-file>` n’exécute que
  les requêtes read-only autorisées.
- Les migrations de préparation gardent l’activation client bloquée jusqu’à
  l’approbation de l’isolation. Aucun compte client de test ne peut ouvrir le
  portail avant cette gate ; ne pas désactiver manuellement ce verrou.
- La promotion vers la production suit `docs/PRODUCTION_TEST.md`.

---

## 8. Autorisation du portail

### 8.1 Nouveau garde

`src/server/authz/organization.js` expose :

```js
requireOrganization()                       // session + organisation active valide
requireOrganizationMembership()             // appartenance active
requireOrganizationModule(moduleKey)        // module activé
requireOrganizationAuthorization(module, capability, options)
requireOrganizationRole(roleKey, options)
requireInternalOrganizationScope()          // interne : plateforme par défaut
requireSupervision(organizationId, scope)   // mandat actif pour une org cliente
```

Chaque fonction retourne `null` si la requête peut continuer, ou une réponse
`NextResponse` sinon. Le style est identique aux gardes existants.

Les routes du portail utilisent `createHandler` **sans liste de rôles**, puis
appellent `requireOrganization()`. Le garde attache `req.organization` et
appelle `setRequestContext({ organizationId })`. Les routes publiques
d’invitation utilisent `createHandler({ public: true }, …)` et valident le jeton.

Les routes internes ne sont pas réécrites : `requireInternalOrganizationScope()`
fixe l’organisation plateforme par défaut. Une route interne qui vise une
organisation cliente doit appeler `requireSupervision()` **avant** de lire la
moindre fiche.

### 8.2 Décision

`evaluateOrganizationAuthorization` dans
`src/services/organizations/organizationAccess.js` :

```
0. contexte de requête : interne / portail / supervision
1. session + organisation active (ou cible supervisée)
2. appartenance active (relue) ou mandat de supervision actif
3. organisation active, non suspendue, non archivée
4. module activé
5. affectations de rôle actives dans l'organisation
6. capacités du modèle de rôle (base)
7. autorisations de groupe / appartenance / affectation
8. refus (gagnent toujours)
9. plafond du modèle de rôle
10. périmètre de la fiche
11. fiche dans l'organisation active
12. décision + journal
```

Pour une requête interne sans mandat, l’organisation est la plateforme : la
décision ne peut jamais porter sur une fiche cliente. Pour une requête de
supervision, le mandat doit être actif et couvrir la portée demandée ; sinon, la
décision est `no-supervision`.

Retour :

```js
{
  allowed: boolean,
  reason: "allowed" | "no-membership" | "org-suspended" | "module-disabled"
        | "capability-missing" | "out-of-scope" | "wrong-organization",
  missing: { module, capability, scope } | null,
}
```

### 8.3 Réutilisation du moteur existant

- `mergeEffectiveCapabilities` est réutilisé tel quel pour l’arithmétique
  base + groupe + personnel − refus.
- `evaluateScopeDecision` est réutilisé pour l’ordre de décision.
- Les prédicats de périmètre existants ne sont pas modifiés. On ajoute une
  vérification d’organisation **avant** ou **dans** la requête, via
  `src/services/organizations/organizationScopes.js`.
- Le catalogue des capacités reste
  `src/models/authorization/constants/feature-module-capability.js`.
- Un module de capacités `organization_admin` est ajouté pour l’administration
  de l’espace : `organization_admin.members.view`,
  `organization_admin.members.manage`, `organization_admin.roles.manage`,
  `organization_admin.branding.edit`, `organization_admin.audit.view`.
  C’est additif ; les modules existants ne changent pas. Les tests de cohérence
  du catalogue sont mis à jour en conséquence. Le rôle `org_admin` et le module
  `organization_admin` sont deux vocabulaires distincts : le rôle est une
  affectation, le module est un domaine de capacités.
- Le catalogue des modèles de rôles est nouveau et référence les mêmes clés de
  capacité.

### 8.4 Deux régimes d’éligibilité

Le portail client ne réutilise pas les lignes globales `feature_eligibility` qui
décrivent les fonctions internes. Il applique :

- le plafond du **modèle de rôle d’organisation** ;
- l’activation du **module** ;
- l’appartenance et le périmètre.

Les routes internes conservent leur éligibilité actuelle. Une personne peut donc
avoir deux plafonds différents selon la porte d’entrée, ce qui est le
comportement attendu : ce sont deux chapeaux.

### 8.5 Erreurs

| Situation | Réponse |
|---|---|
| Pas de session | `401` |
| Pas d’appartenance à l’organisation active | `403` |
| Requête interne vers une organisation cliente sans mandat | `403` (`no-supervision`) |
| Requête sans contexte d’organisation | `403` (`unscoped`) |
| Organisation suspendue ou archivée | `403` |
| Module désactivé | `403` |
| Capacité absente | `403` |
| Fiche hors périmètre | `404` |
| Fiche d’une autre organisation | `404` (ne pas révéler son existence) |
| Conflit d’invitation ou d’appartenance | `409` |
| Validation | `422` |

Les refus portent un en-tête de diagnostic, sur le modèle de
`X-Authz-Decision` :

```
X-Org-Decision: no-membership | no-supervision | unscoped | module-disabled
              | capability-missing | out-of-scope | wrong-organization | allowed
```

Ne jamais renvoyer un message qui distingue « la fiche existe mais ne vous
appartient pas » de « la fiche n’existe pas ».

---

## 9. API du portail

### 9.1 Contexte et session

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/org/context` | Contexte de l’organisation active |
| `POST` | `/api/org/context` | Changer d’organisation active |
| `GET` | `/api/org/profile` | Marque, modules, appartenance |
| `PATCH` | `/api/org/branding` | Modifier la marque (admin) |
| `GET` | `/api/org/audit` | Journal de l’organisation (admin) |
| `POST` | `/api/org/invitations/accept` | Accepter une invitation (public, jeton en credential) |

### 9.2 Membres et rôles

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/org/members` | Liste paginée |
| `POST` | `/api/org/invitations` | Inviter une personne |
| `DELETE` | `/api/org/invitations/[id]` | Révoquer une invitation |
| `PATCH` | `/api/org/members/[id]` | Suspendre, retirer, changer un rôle |
| `GET` | `/api/org/roles` | Rôles de l’organisation |
| `PATCH` | `/api/org/roles/[id]` | Libellé et délégabilité uniquement |

### 9.3 Programmes, LMS, Venture

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/org/programs` | Programmes de l’organisation |
| `GET` | `/api/org/programs/[id]` | Détail, cohortes, participants |
| `GET` | `/api/org/lms/courses` | Cours possédés ou licenciés |
| `GET` | `/api/org/lms/enrollments` | Inscriptions de l’organisation |
| `GET` | `/api/org/ventures` | Ventures de l’organisation |
| `GET` | `/api/org/ventures/[id]` | Détail, membres, documents partagés |
| `POST` | `/api/org/files` | Téléversement contrôlé (Phase 3) |
| `GET` | `/api/org/files/[id]` | Téléchargement contrôlé (Phase 3) |

### 9.4 Plateforme Future Studio

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/platform/organizations` | Liste |
| `POST` | `/api/platform/organizations` | Créer une organisation (et ses rôles à partir des modèles actifs) |
| `GET` | `/api/platform/organizations/[id]` | Détail |
| `PATCH` | `/api/platform/organizations/[id]` | Identité, statut, contrat |
| `PUT` | `/api/platform/organizations/[id]/modules` | Activer/désactiver un module |
| `POST` | `/api/platform/organizations/[id]/supervision` | Accorder un mandat |
| `DELETE` | `/api/platform/organizations/[id]/supervision` | Terminer un mandat |

Ces routes sont gardées par le moteur interne existant
(`requireAuthorization("permissions", …)` ou une capacité plateforme dédiée,
par exemple `permissions.manage_organizations` et
`permissions.supervise_organizations`, ajoutées au catalogue en Phase 0). Elles
ne passent pas par le garde du portail.

### 9.5 Règles de contrat d’API

- Aucune route `/api/org/**` n’accepte `organization_id` comme source
  d’autorité. L’organisation active vient de la session.
- Les routes `/api/platform/**` acceptent l’identifiant cible dans le chemin,
  mais le garde interne vérifie la capacité.
- Les listes sont paginées (`page`, `pageSize`, maximum 100).
- Les mutations utilisent `POST`, `PATCH` ou `DELETE`, jamais un `GET`.
- Les mutations vérifient l’origine de la requête (même origine) pour éviter les
  actions CSRF. Exception : l’acceptation d’une invitation publique, où le jeton
  est le credential.
- Les réponses d’erreur utilisent les clés i18n existantes (`errors.*`) ou un
  nouveau namespace `organization.errors.*`.

---

## 10. Interface du portail

### 10.1 Routes

```
/o/select                          choix de l'organisation
/o/invite/[token]                  acceptation d'une invitation (public)
/o/[organizationCode]              tableau de bord
/o/[organizationCode]/programs     programmes
/o/[organizationCode]/programs/[id]
/o/[organizationCode]/lms          cours et inscriptions
/o/[organizationCode]/ventures     ventures
/o/[organizationCode]/ventures/[id]
/o/[organizationCode]/members      membres et invitations
/o/[organizationCode]/settings/branding
/o/[organizationCode]/settings/roles
/o/[organizationCode]/audit        journal (admin)
```

### 10.2 Layout

`src/app/o/[organizationCode]/layout.js` :

- `export const dynamic = "force-dynamic"` ;
- résout la session et l’organisation active côté serveur ;
- compare le code du chemin à l’organisation active : si différent, redirige
  vers le chemin de l’organisation active (ou vers `/o/select`) ;
- vérifie l’appartenance ; sinon, redirige vers `/o/select` ou `/login` ;
- charge la marque et les modules ;
- rend `OrganizationShell` avec le contexte initial.

Le layout ne remplace pas l’autorisation des routes API. Il évite seulement
d’afficher un écran vide ou un mauvais espace. Chaque route API refait le garde.

### 10.3 Shell client

`src/components/organization/OrganizationShell.js` :

- logo et nom de l’organisation ;
- navigation construite à partir des modules activés et des capacités ;
- sélecteur d’organisation si la personne en a plusieurs ;
- menu utilisateur, langue, déconnexion ;
- aucune dépendance au `DashboardLayout` interne ;
- réutilise `PageHero`, `KpiCard`, `SectionHead`, `LinkCard`, `AppCard`,
  `AppButton`, `AppTable`, `AppEmptyState`, `AppPagination`.

### 10.4 Marque

- Les couleurs sont injectées comme variables CSS sur un conteneur :
  `--org-primary`, `--org-secondary`, `--org-accent`.
- Aucune couleur hexadécimale en JSX.
- Pas de variantes `dark:`.
- Le logo a un fallback vers la marque ImpactOS si l’URL est absente ou cassée.
- Les actifs de marque peuvent être publics ; les fichiers clients, non.

### 10.5 i18n

- Nouveau namespace : `organization.*`.
- Fichiers : `src/locales/en/organization.json` et
  `src/locales/fr/organization.json`.
- Enregistrement dans `src/lib/locales.js` (EN et FR).
- Aucune chaîne visible en dur.
- `npm run i18n:parity` doit passer.

Sous-namespaces proposés :

```
organization.portal.*
organization.nav.*
organization.members.*
organization.roles.*
organization.programs.*
organization.lms.*
organization.ventures.*
organization.settings.*
organization.audit.*
organization.errors.*
organization.status.*
```

---

## 11. Sécurité et isolation

### 11.1 Menaces

| Menace | Contrôle |
|---|---|
| Un membre curieux change un identifiant dans l’URL | La fiche est lue, son organisation est vérifiée, réponse `404` |
| Un administrateur client tente d’obtenir un rôle global | Rôles d’espace uniquement, plafond du modèle, audit |
| Un ancien membre garde une session | Appartenance relue à chaque requête ; changement d’organisation invalide le cache |
| Un lien de fichier est transmis | Téléchargement contrôlé, lien signé court, vérification de l’organisation |
| Un export inclut une autre organisation | Filtre d’organisation dans la requête et dans le job |
| Un e-mail part au mauvais destinataire | Contenu et expéditeur composés depuis l’organisation active |
| Un lien public est réutilisé ailleurs | Jeton lié à une organisation et à un objet ; vérification à l’ouverture |
| Un salarié Future Studio lit sans mandat | Supervision explicite, limitée, journalisée |
| Un job de fond travaille sur toutes les organisations | `organization_id` obligatoire dans le job |
| Un cache sert les droits de l’organisation précédente | Clé de cache avec l’organisation ; invalidation au changement |

### 11.2 Fichiers

Le helper de stockage existant peut créer un bucket public et renvoyer une URL
publique. Il reste utilisé pour les fichiers internes, mais **le portail client
ne l’utilise pas** pour des données privées.

Nouveau comportement :

- bucket privé `organization-files`, créé avec `public: false` ;
- chemin `org/<organizationId>/<domain>/<objectId>/<filename>` ;
- validation de type et de taille réutilisée depuis le helper existant ; seule
  la destination change ;
- aucune URL publique renvoyée ;
- `GET /api/org/files/[id]` vérifie session, appartenance, capacité et
  organisation de la fiche, puis renvoie un lien signé de courte durée ou
  streame le fichier ;
- le journal enregistre le téléchargement.

Les logos et favicons peuvent rester publics : ce sont des actifs de marque.

### 11.3 Exports

- Chaque export porte `organization_id`.
- La requête d’export est filtrée avant la génération.
- Le fichier généré est stocké sous le préfixe de l’organisation.
- Le téléchargement repasse par le garde.
- Un export massif passe par un job, pas par une requête longue.
- Un export déclenché par Future Studio exige un mandat de supervision.

### 11.4 E-mails et notifications

- L’expéditeur vient de la marque de l’organisation.
- Si l’adresse n’est pas vérifiée, utiliser l’expéditeur plateforme par défaut,
  jamais celui d’une autre organisation.
- Le contenu est composé à partir de données filtrées par organisation.
- Les notifications internes existantes ne sont pas modifiées.

### 11.5 Liens publics et formulaires

- Le jeton encode l’organisation et l’objet.
- À l’ouverture, le serveur vérifie que l’organisation est active et que l’objet
  appartient toujours à cette organisation.
- Un lien révoqué ne donne plus accès, même s’il est encore en circulation.
- Les formulaires publics du portail sont distincts des formulaires internes.

### 11.6 Recherche, compteurs et tableaux de bord

- Toute recherche et tout compteur porte le filtre d’organisation.
- Un total ne doit jamais révéler l’existence d’une fiche d’une autre
  organisation.
- Les agrégats transverses sont réservés à Future Studio avec supervision.

### 11.7 Supervision

- Un mandat actif est obligatoire pour lire le contenu client, **dans le portail
  comme dans la console interne**, même pour le propriétaire de la plateforme.
- Le mandat a un motif, une portée et une date de fin.
- Chaque usage écrit un événement de journal.
- Une procédure d’urgence (« break-glass ») peut exister, mais elle est
  journalisée et alertée.
- La supervision est livrée en Phase 1 et testée avant l’activation de la
  première organisation cliente.

### 11.8 Verrou dans la base (seconde ceinture)

Le verrou principal est le **filtre d’organisation dans les modèles**, livré en
Phase 1. Un second verrou dans la base peut être ajouté en Phase 4 ou 5 : la base
ne rend que les lignes de l’organisation active. Ce n’est pas la ceinture
principale, et cela ne protège ni les fichiers, ni les exports, ni les jobs.

Le verrou de base demande :

- un rôle de connexion applicatif distinct ;
- l’organisation active posée par transaction ou par connexion ;
- `FORCE ROW LEVEL SECURITY` pour que le propriétaire des tables n’y échappe
  pas ;
- une vérification que les DDL de maintenance au démarrage ne contournent pas le
  verrou ;
- des tests de fuite inter-organisations sur les tables couvertes.

**Limite technique :** l’exécution actuelle interroge la base par requêtes
indépendantes sur un pool. Une politique de base ne voit l’organisation que si
la requête partage la transaction ou la connexion qui a posé le contexte. Le
verrou de base exige donc un `db.withOrganizationContext` et un chemin de
requête qui utilise la même transaction. Tant que ce chemin n’existe pas, le
verrou de base ne peut pas être la protection principale : le filtre des modèles
et la matrice d’isolation restent la référence.

### 11.9 Journalisation

- `setRequestContext({ organizationId })` après résolution de l’organisation.
- Les refus `X-Org-Decision` sont journalisés sans données sensibles.
- Les événements d’appartenance, de rôle, d’autorisation, de module, de marque,
  de supervision, d’export et de téléchargement sont journalisés.
- Le journal est en ajout seul.
- Ne jamais stocker de secret, de mot de passe ou de jeton dans les valeurs
  avant/après d’un événement ; les données sensibles sont redigées.
- Les invitations, les exports et les téléchargements sensibles utilisent le
  limiteur de débit existant.

### 11.10 Isolation bidirectionnelle

| Sens | Requête | Ce qui est refusé |
|---|---|---|
| Interne → client | Console interne sans mandat | Toute ligne d’une organisation cliente |
| Interne → client | Console interne avec mandat | Toute ligne hors de l’organisation supervisée ou hors de la portée du mandat |
| Client → interne | Portail client | Toute ligne de l’organisation plateforme |
| Client → client | Portail client | Toute ligne d’une autre organisation |
| Public → client | Lien ou formulaire | Tout objet qui n’appartient pas à l’organisation du jeton |

**Règles :**

- Les modèles du pilote exigent l’organisation et ne retombent jamais sur «
  toutes les organisations ».
- Une requête interne sans mandat est limitée à l’organisation plateforme.
- Une requête interne avec mandat est limitée à l’organisation supervisée et à
  la portée du mandat.
- Le portail ne peut pas demander une autre organisation que celle de sa
  session, même en forgeant un identifiant.
- Les tests d’isolation couvrent les deux sens, pas seulement le portail.

### 11.11 Compatibilité des écritures existantes

- Le déclencheur `BEFORE INSERT` remplit l’organisation de session si elle est
  posée, sinon l’organisation plateforme.
- Une organisation explicite différente de la session est refusée.
- Les anciens chemins de création sont testés un par un avant le passage à
  `NOT NULL`.
- Les imports en masse, les invitations, les formulaires publics et les créations
  de groupes sont couverts.
- Une colonne obligatoire ne l’est qu’après la preuve que tous les chemins
  existants la renseignent correctement.

### 11.12 Garanties d’historique

- Journal en ajout seul : `UPDATE` et `DELETE` refusés par déclencheur et par
  privilèges.
- Tables de cycle de vie : pas de suppression ; `status`, `ended_at` ou
  `revoked_at` à la place.
- Colonnes immuables protégées : `organization_id`, `person_id`, `created_at`,
  `content_id`, `owner_organization_id`.
- Portée polymorphe validée par déclencheur (la fiche visée doit appartenir à la
  même organisation).
- Événements d’audit écrits par déclencheur pour les tables critiques, même si
  le service a oublié de le faire.
- Suppression légale uniquement par une fonction dédiée, avec motif et journal.

---

## 12. Performance

### 12.1 Budget de requêtes

| Endpoint | Requêtes cibles |
|---|---|
| `GET /api/org/context` | 3 maximum (appartenance + rôles + marque/modules) |
| `GET /api/org/programs` | 2 (comptage + page) |
| `GET /api/org/ventures` | 2 |
| `GET /api/org/lms/enrollments` | 2 |
| `GET /api/org/members` | 2 |

### 12.2 Règles

- Index commençant par `organization_id`.
- Pagination par défaut 25, maximum 100.
- Pas de chargement de toutes les lignes pour compter.
- Pas de N+1 sur les rôles, les modules ou les participants.
- Le contexte d’organisation est résolu une fois par requête, pas par composant.
- Le cache de capacités est invalidé par les écritures, pas seulement par le TTL.
- Les exports volumineux passent par un job.

---

## 13. Plan de tests

### 13.1 Tests unitaires

| Suite | Ce qu’elle verrouille |
|---|---|
| `organization-model.test.js` | Contraintes, unicités, invariants, organisation plateforme unique |
| `organization-access.test.js` | Ordre de décision, refus par défaut, refus gagne, plafond du modèle |
| `organization-roles.test.js` | Un rôle d’organisation ne dépasse pas son modèle |
| `organization-invitations.test.js` | Portée, expiration, révocation, domaine non autoritaire |
| `organization-licenses.test.js` | Contenu partagé, résultats non partagés |
| `organization-scopes.test.js` | Périmètre dans la même organisation, `404` hors organisation |
| `organization-internal-isolation.test.js` | Une requête interne ne voit pas les lignes clientes sans mandat |
| `organization-write-compatibility.test.js` | Chaque ancien chemin de création renseigne l’organisation plateforme |
| `organization-db-history.test.js` | Suppressions et modifications interdites refusées par la base |
| `organization-tenant-registry.test.js` | Toute table du pilote a un filtre et un test d’isolation |

### 13.2 Tests de service

| Suite | Ce qu’elle verrouille |
|---|---|
| `organization-context.test.js` | Résolution de l’appartenance, modules, rôles, cache |
| `organization-switch.test.js` | Changement d’organisation, invalidation, aucune fuite |
| `organization-admin.test.js` | Délégation bornée, audit, refus d’escalade |
| `organization-supervision.test.js` | Mandat obligatoire, expiration, journal, accès interne |
| `organization-supervision-timing.test.js` | Aucune organisation cliente activée avant la supervision |

### 13.3 Tests de route

| Suite | Ce qu’elle verrouille |
|---|---|
| `organization-routes-auth.test.js` | `401` sans session, `403` sans appartenance |
| `organization-routes-isolation.test.js` | Pour chaque route du pilote : identifiant d’une autre organisation → `404` |
| `organization-routes-modules.test.js` | Module désactivé → refus |
| `organization-routes-csrf.test.js` | Mutations même origine, pas de `GET` mutant |
| `organization-files.test.js` | Téléchargement contrôlé, bucket privé, lien court |
| `organization-internal-routes.test.js` | Routes internes limitées à l’organisation plateforme |
| `organization-legacy-writes.test.js` | Créations internes existantes : organisation plateforme correcte |
| `organization-db-guards.test.js` | `UPDATE`/`DELETE` directs refusés, portée inter-organisations refusée |

### 13.4 Tests de non-régression

- `npm test`
- `npm run test:authz`
- `npm run lint`
- `npm run build`
- `npm run check:lines`
- `npm run i18n:parity`

Les suites existantes suivantes doivent rester vertes sans modification :

- `src/__tests__/authorization-resolver.core.test.js`
- `src/__tests__/authorization-resolver.advanced.test.js`
- `src/__tests__/authorization-resolver.lms.test.js`
- `src/__tests__/authorization-resolver.modules.test.js`
- `src/__tests__/authorization-resolver.migrations.test.js`
- `src/__tests__/phase5-scope-engine.test.js`
- `src/__tests__/program-scoped-access.test.js`
- `src/__tests__/program-scope-wiring.test.js`
- `src/__tests__/program-scope-coverage.test.js`
- `src/__tests__/server/auth-boundaries.test.js`
- `src/__tests__/server/services-boundaries.test.js`
- `src/__tests__/route-catalog-contract.test.js`

### 13.5 Matrice d’isolation

Pour chaque table du pilote :

1. Créer une ligne dans l’organisation A et une ligne dans l’organisation B.
2. Lire avec la session A : la ligne B ne doit jamais apparaître.
3. Appeler la route de détail avec l’identifiant B : `404`.
4. Appeler la route de mutation avec l’identifiant B : `404`.
5. Exporter depuis A : aucune ligne B.
6. Ouvrir un fichier de B depuis A : refus.
7. Tenter un lien public de B depuis A : refus.
8. Lire depuis la console interne sans mandat : aucune ligne de A ni de B.
9. Lire depuis la console interne avec un mandat sur A : uniquement A.
10. Créer une fiche par un ancien chemin interne : organisation plateforme.
11. Tenter un `DELETE` direct sur une ligne d’historique : refus.
12. Tenter un `UPDATE` sur une colonne immuable : refus.

Cette matrice est un test automatisé, pas une checklist manuelle.

Le registre `src/models/organizations/tenantTables.js` liste chaque table du
pilote, sa colonne d’organisation et le test d’isolation associé. Un test échoue
si une table du registre n’a pas de test, ou si une table cliente est ajoutée
sans entrée dans le registre. C’est ce qui empêche la longue traîne des requêtes
de rouvrir une fuite silencieusement.

### 13.6 Scénario manuel Horizon

- Créer l’organisation fictive `horizon-test`.
- Activer les trois modules.
- Inviter une administratrice, une coach, une participante, un investisseur.
- Créer un programme, une cohorte 2027, un cours, un venture.
- Affecter la coach au venture.
- Partager un document avec l’investisseur.
- Vérifier que chaque personne ne voit que ce qui la concerne.
- Créer une cohorte 2028 et vérifier que 2027 reste intact.
- Tenter les accès croisés de la matrice.

---

## 14. Déploiement et pilote

### 14.1 Staging

1. Sauvegarde / point de restauration.
2. Migration additive.
3. Vérification des comptages avant/après backfill.
4. Tests des anciens chemins de création avec les déclencheurs.
5. Déploiement du code avec filtres internes et supervision.
6. Vérification que les écrans internes ne voient pas les données clientes.
7. Création des organisations fictives, uniquement si la supervision est verte.
8. Exécution de la matrice d’isolation bidirectionnelle.
9. Vérification des tests existants.

### 14.2 Production

- `.env.local` pointe vers staging sur ce poste ; ne pas l’utiliser comme cible
  de production. Vérifier la référence du projet avant toute opération.
- Utiliser staging pour les essais et garder la production distincte.
- Vérifier que la supervision et l’isolation bidirectionnelle sont vertes avant
  d’activer la première organisation cliente.
- Le compte de test MTN ne peut être provisionné qu’après l’approbation de
  l’isolation et l’ajout d’un parcours de provisionnement contrôlé ; voir
  [`Accès de test white-label sur staging`](./white-label-phase0/STAGING_TEST_ACCESS.md).
- La promotion vers `main` suit le **test de production**
  (`docs/PRODUCTION_TEST.md`), item par item.

### 14.3 Critères go / no-go

- Aucun accès croisé dans la matrice d’isolation, **dans les deux sens**.
- Les écrans internes voient toujours les données de l’organisation plateforme
  comme avant, et aucune ligne cliente sans mandat.
- Les anciens chemins de création fonctionnent et rattachent l’organisation
  plateforme.
- Aucune organisation cliente n’est activée avant que la supervision et l’isolation soient en place.
- Les suppressions et modifications interdites échouent au niveau de la base.
- Aucune régression des suites de permissions existantes.
- Le scénario Horizon passe de bout en bout.
- Les fichiers clients ne sont pas publics.
- Les exports ne contiennent aucune ligne d’une autre organisation.
- Le changement d’organisation ne laisse aucun droit résiduel.
- La supervision est explicite et journalisée.
- Le test de production est vert.

---

## 15. Risques et mitigations

| Risque | Mitigation |
|---|---|
| La longue traîne des requêtes SQL oublie un filtre | Pilote borné, registre des tables, tests d’isolation par table |
| Une requête interne non filtrée lit les données clientes | Modèles filtrés par défaut sur la plateforme, tests bidirectionnels, registre |
| Une ancienne création échoue ou écrit dans la mauvaise organisation | Déclencheur d’écriture compatible, tests de chaque chemin avant `NOT NULL` |
| La supervision arrive trop tard | Supervision livrée en Phase 1, activation cliente bloquée sans elle |
| Un service contourne l’historique | Déclencheurs de non-suppression, d’immuabilité et de journal |
| Une route interne est modifiée par erreur | Liste « ne pas toucher », revue de diff, tests existants |
| Le cache sert les droits de l’ancienne organisation | Clé avec organisation, invalidation au changement |
| Un bucket public expose des fichiers clients | Bucket privé séparé, téléchargement contrôlé |
| Un job de fond travaille sans organisation | `organization_id` obligatoire, test de job |
| Un rôle client dépasse son plafond | Modèle de rôle global, validation, test d’escalade |
| Une clé composite échoue à cause des types historiques | Vérification applicative d’abord, normalisation ensuite |
| La migration est trop longue ou destructive | Additive, par lots, staging, sauvegarde |
| Un administrateur client voit la console interne | Portes séparées, rôle d’organisation, test de route |
| Un salarié Future Studio lit sans mandat | Supervision obligatoire dans le portail **et** la console interne, journal |

---

## 16. Définition de terminé

La fonctionnalité est terminée lorsque :

- le modèle conceptuel est validé ;
- les tables et contraintes sont en place ;
- l’organisation plateforme existe et toutes les données du pilote y sont
  rattachées ;
- les requêtes internes sont filtrées sur l’organisation plateforme par défaut ;
- les anciens chemins de création renseignent l’organisation plateforme ;
- le portail client fonctionne en lecture pour les trois modules ;
- les écritures du pilote sont couvertes par le garde d’organisation ;
- les fichiers, exports, e-mails, liens publics et jobs sont filtrés ;
- la matrice d’isolation est verte dans les deux sens ;
- les suppressions et modifications interdites échouent en base ;
- les suites de non-régression sont vertes ;
- le scénario Horizon est reproductible ;
- la supervision est explicite et journalisée, avant toute activation cliente ;
- le test de production est passé ;
- la documentation est à jour.

---

## Annexe A — DDL proposé

```sql
-- ─── Organisation ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE
    CHECK (code ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  legal_name TEXT,
  kind TEXT NOT NULL DEFAULT 'company'
    CHECK (kind IN ('company','university','incubator','ngo','public_body','other')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','suspended','archived','closed')),
  is_platform BOOLEAN NOT NULL DEFAULT FALSE,
  parent_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  default_locale TEXT NOT NULL DEFAULT 'fr',
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  data_region TEXT,
  suspended_reason TEXT,
  archived_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organizations_one_platform
  ON organizations (is_platform) WHERE is_platform = TRUE;

CREATE INDEX IF NOT EXISTS organizations_status
  ON organizations (status);

-- Les codes réservés (select, invite, api, settings, admin, login) sont refusés
-- par le service de création, pas par une contrainte SQL : la liste est une
-- règle produit, pas une règle de format.

-- ─── Marque ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_branding (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  display_name TEXT,
  logo_url TEXT,
  logo_dark_url TEXT,
  mark_url TEXT,
  favicon_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  email_from_name TEXT,
  email_from_address TEXT,
  reply_to TEXT,
  support_email TEXT,
  support_url TEXT,
  website_url TEXT,
  legal_url TEXT,
  privacy_url TEXT,
  custom_domain TEXT UNIQUE,
  domain_verified_at TIMESTAMPTZ,
  login_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Contrat ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','suspended','ended')),
  starts_at DATE,
  ends_at DATE,
  renewal_mode TEXT NOT NULL DEFAULT 'manual'
    CHECK (renewal_mode IN ('manual','auto')),
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  signed_at TIMESTAMPTZ,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_contracts_one_active
  ON organization_contracts (organization_id) WHERE status = 'active';

-- ─── Modules ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL CHECK (module_key IN ('programs','lms','venture')),
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('enabled','disabled','trial','suspended')),
  starts_at DATE,
  ends_at DATE,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled_by TEXT,
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, module_key)
);

-- ─── Appartenances ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','active','suspended','ended')),
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,
  invited_by TEXT,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_one_active
  ON organization_memberships (organization_id, person_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS organization_memberships_person
  ON organization_memberships (person_id, status);

-- ─── Modèles de rôles (global) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_role_templates (
  key TEXT PRIMARY KEY,
  label_key TEXT NOT NULL,
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('organization','program','cohort','venture','course','investment','document')),
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  delegable BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_role_template_capabilities (
  template_key TEXT NOT NULL
    REFERENCES organization_role_templates(key) ON DELETE CASCADE,
  module TEXT NOT NULL,
  capability TEXT NOT NULL,
  access_level INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (template_key, module, capability)
);

-- ─── Rôles d'organisation ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL REFERENCES organization_role_templates(key),
  label TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  delegable_by_org_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, template_key)
);

-- V1 : un rôle par modèle et par organisation. Les rôles personnalisés
-- multiples basés sur le même modèle sont une évolution ultérieure.

-- ─── Affectations de rôle ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  membership_id UUID NOT NULL
    REFERENCES organization_memberships(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE RESTRICT,
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('organization','program','cohort','venture','course','investment','document')),
  scope_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','ended')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  assigned_by TEXT,
  ended_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope_type = 'organization' AND scope_id IS NULL)
    OR (scope_type <> 'organization' AND scope_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_role_assignments_one_active
  ON organization_role_assignments
    (membership_id, role_id, scope_type, COALESCE(scope_id, ''))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS organization_role_assignments_org
  ON organization_role_assignments (organization_id, membership_id, status);

-- scope_id est polymorphe (programme, cohorte, venture, cours, investissement,
-- document).
-- Le service vérifie que la fiche visée appartient à la même organisation ; une
-- clé étrangère simple ne peut pas exprimer cette règle.

-- ─── Autorisations et refus ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL
    CHECK (subject_type IN ('role_assignment','membership','group')),
  subject_id TEXT NOT NULL,
  module TEXT NOT NULL,
  capability TEXT NOT NULL,
  access_level INTEGER NOT NULL DEFAULT 1,
  effect TEXT NOT NULL DEFAULT 'allow'
    CHECK (effect IN ('allow','deny')),
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('organization','program','cohort','venture','course','investment','document')),
  scope_id TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  granted_by TEXT,
  reason TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope_type = 'organization' AND scope_id IS NULL)
    OR (scope_type <> 'organization' AND scope_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_grants_one_effect
  ON organization_grants
    (organization_id, subject_type, subject_id, module, capability,
     effect, scope_type, COALESCE(scope_id, ''))
  WHERE revoked_at IS NULL;

-- Une autorisation expirée est marquée révoquée par le balayage ; sinon elle
-- bloquerait une nouvelle autorisation identique.

CREATE INDEX IF NOT EXISTS organization_grants_subject
  ON organization_grants (organization_id, subject_type, subject_id);

-- subject_id est polymorphe (affectation, appartenance, groupe). Le service
-- vérifie que le sujet appartient à l'organisation ; aucune clé étrangère
-- simple ne peut l'exprimer.

-- ─── Invitations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  person_id TEXT REFERENCES contacts(cid) ON DELETE SET NULL,
  role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL
    CHECK (scope_type IN ('organization','program','cohort','venture','course','investment','document')),
  scope_id TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by TEXT,
  accepted_at TIMESTAMPTZ,
  accepted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope_type = 'organization' AND scope_id IS NULL)
    OR (scope_type <> 'organization' AND scope_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_one_pending
  ON organization_invitations
    (organization_id, LOWER(email), role_id, scope_type, COALESCE(scope_id, ''))
  WHERE status = 'pending';

-- ─── Licences de contenu ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_content_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL
    CHECK (content_type IN ('course','template','resource')),
  content_id TEXT NOT NULL,
  owner_organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  licensee_organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked','expired')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (owner_organization_id <> licensee_organization_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_content_licenses_one_active
  ON organization_content_licenses
    (content_type, content_id, licensee_organization_id)
  WHERE status = 'active';

-- ─── Supervision ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_supervision_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_person_id TEXT NOT NULL REFERENCES contacts(cid) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('read','export','administer')),
  reason TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','ended')),
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS organization_supervision_active
  ON organization_supervision_grants
    (organization_id, staff_person_id, status, ends_at);

-- ─── Journal ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_audit_events (
  id BIGSERIAL PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor_person_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS organization_audit_events_org_created
  ON organization_audit_events (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS organization_audit_events_actor
  ON organization_audit_events (actor_person_id, created_at DESC);

-- ─── Politique de conservation ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_retention_policies (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_retention_months INTEGER NOT NULL DEFAULT 24,
  per_category JSONB NOT NULL DEFAULT '{}'::jsonb,
  export_format TEXT NOT NULL DEFAULT 'json',
  deletion_mode TEXT NOT NULL DEFAULT 'anonymize'
    CHECK (deletion_mode IN ('anonymize','delete')),
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### A.1 Seed initial des modèles de rôles

Le seed est idempotent (`ON CONFLICT DO NOTHING`) et s’exécute une fois par
base. Il crée les modèles globaux, puis les rôles de chaque organisation à
partir de ces modèles.

```sql
INSERT INTO organization_role_templates (key, label_key, scope_type, is_system, delegable)
VALUES
  ('org_admin',       'organization.roles.orgAdmin',       'organization', TRUE, FALSE),
  ('program_manager', 'organization.roles.programManager', 'program',      TRUE, TRUE),
  ('coach',           'organization.roles.coach',          'venture',      TRUE, TRUE),
  ('participant',     'organization.roles.participant',    'cohort',       TRUE, FALSE),
  ('learner',         'organization.roles.learner',        'course',       TRUE, FALSE),
  ('investor',        'organization.roles.investor',       'venture',      TRUE, FALSE),
  ('content_manager', 'organization.roles.contentManager', 'organization', TRUE, TRUE),
  ('guest',           'organization.roles.guest',          'venture',      TRUE, FALSE)
ON CONFLICT (key) DO NOTHING;

-- Extrait : le socle de l’administrateur d’organisation.
INSERT INTO organization_role_template_capabilities
  (template_key, module, capability, access_level)
VALUES
  ('org_admin', 'organization_admin', 'members.view',   1),
  ('org_admin', 'organization_admin', 'members.manage', 5),
  ('org_admin', 'organization_admin', 'roles.manage',   5),
  ('org_admin', 'organization_admin', 'branding.edit',  3),
  ('org_admin', 'organization_admin', 'audit.view',     1)
ON CONFLICT (template_key, module, capability) DO NOTHING;
```

Le seed complet des capacités de chaque modèle est un script idempotent, pas
une saisie manuelle. À la création d’une organisation, les rôles d’organisation
correspondants sont créés à partir des modèles actifs, avec les libellés par
défaut.

### A.2 Déclencheurs et privilèges

PostgreSQL 14+ (`CREATE OR REPLACE TRIGGER`). Les fonctions ci-dessous sont
représentatives : les noms exacts des tables de documents et d’investissement
sont confirmés en Phase 0.

```sql
-- ─── Organisation plateforme ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION platform_organization_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM organizations
  WHERE is_platform = TRUE
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'platform organization is missing';
  END IF;

  RETURN v_id;
END;
$$;

-- ─── Écriture compatible : organisation de session, sinon plateforme ────────

CREATE OR REPLACE FUNCTION set_organization_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_org UUID;
  v_platform UUID := platform_organization_id();
BEGIN
  BEGIN
    v_session_org := NULLIF(current_setting('app.organization_id', true), '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_session_org := NULL;
  END;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := COALESCE(v_session_org, v_platform);
  ELSIF v_session_org IS NOT NULL AND NEW.organization_id <> v_session_org THEN
    RAISE EXCEPTION 'organization mismatch: row %, session %',
      NEW.organization_id, v_session_org;
  END IF;

  RETURN NEW;
END;
$$;

-- Variante pour lms_courses, dont la colonne est owner_organization_id.
CREATE OR REPLACE FUNCTION set_course_owner_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_org UUID;
  v_platform UUID := platform_organization_id();
BEGIN
  BEGIN
    v_session_org := NULLIF(current_setting('app.organization_id', true), '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_session_org := NULL;
  END;

  IF NEW.owner_organization_id IS NULL THEN
    NEW.owner_organization_id := COALESCE(v_session_org, v_platform);
  ELSIF v_session_org IS NOT NULL AND NEW.owner_organization_id <> v_session_org THEN
    RAISE EXCEPTION 'organization mismatch: course %, session %',
      NEW.owner_organization_id, v_session_org;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Historique ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION forbid_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'delete is forbidden on %', TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION forbid_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only';
END;
$$;

CREATE OR REPLACE FUNCTION forbid_immutable_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_column TEXT;
  v_old JSONB := to_jsonb(OLD);
  v_new JSONB := to_jsonb(NEW);
BEGIN
  FOREACH v_column IN ARRAY TG_ARGV LOOP
    IF v_old->>v_column IS DISTINCT FROM v_new->>v_column THEN
      RAISE EXCEPTION 'column % is immutable on %', v_column, TG_TABLE_NAME;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ─── Portée polymorphe dans la même organisation ────────────────────────────

CREATE OR REPLACE FUNCTION validate_scope_belongs_to_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_ok BOOLEAN := FALSE;
BEGIN
  IF NEW.scope_type = 'organization' THEN
    IF NEW.scope_id IS NOT NULL THEN
      RAISE EXCEPTION 'organization scope must not carry a scope_id';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.scope_id IS NULL THEN
    RAISE EXCEPTION 'scope_id is required for scope_type %', NEW.scope_type;
  END IF;

  CASE NEW.scope_type
    WHEN 'program' THEN
      SELECT EXISTS (
        SELECT 1 FROM v2_programs
        WHERE id::text = NEW.scope_id
          AND organization_id = NEW.organization_id
      ) INTO v_ok;
    WHEN 'cohort' THEN
      SELECT EXISTS (
        SELECT 1 FROM v2_groups
        WHERE id::text = NEW.scope_id
          AND organization_id = NEW.organization_id
      ) INTO v_ok;
    WHEN 'venture' THEN
      SELECT EXISTS (
        SELECT 1 FROM ventures
        WHERE venture_id = NEW.scope_id
          AND organization_id = NEW.organization_id
      ) INTO v_ok;
    WHEN 'course' THEN
      SELECT EXISTS (
        SELECT 1 FROM lms_courses
        WHERE id::text = NEW.scope_id
          AND owner_organization_id = NEW.organization_id
      ) INTO v_ok;
    WHEN 'document' THEN
      SELECT EXISTS (
        SELECT 1 FROM <document_table>
        WHERE id::text = NEW.scope_id
          AND organization_id = NEW.organization_id
      ) INTO v_ok;
    WHEN 'investment' THEN
      SELECT EXISTS (
        SELECT 1 FROM <investment_table>
        WHERE id::text = NEW.scope_id
          AND organization_id = NEW.organization_id
      ) INTO v_ok;
    ELSE
      RAISE EXCEPTION 'unsupported scope_type %', NEW.scope_type;
  END CASE;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'scope % % does not belong to organization %',
      NEW.scope_type, NEW.scope_id, NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Journal automatique des changements de cycle de vie ────────────────────

CREATE OR REPLACE FUNCTION audit_lifecycle_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_org UUID;
  v_id TEXT;
  v_before JSONB;
  v_after JSONB;
  v_actor TEXT := NULLIF(current_setting('app.actor_cid', true), '');
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id;
    v_id := OLD.id::text;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  ELSE
    v_org := NEW.organization_id;
    v_id := NEW.id::text;
    v_before := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
    v_after := to_jsonb(NEW);
  END IF;

  INSERT INTO organization_audit_events
    (organization_id, actor_person_id, action, entity_type, entity_id,
     before, after, metadata)
  VALUES
    (v_org, v_actor, TG_OP, TG_TABLE_NAME, v_id,
     v_before, v_after, jsonb_build_object('source', 'database_trigger'));

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── Pose des déclencheurs ──────────────────────────────────────────────────

CREATE OR REPLACE TRIGGER v2_programs_set_org
BEFORE INSERT ON v2_programs
FOR EACH ROW EXECUTE FUNCTION set_organization_on_insert();

CREATE OR REPLACE TRIGGER lms_courses_set_owner_org
BEFORE INSERT ON lms_courses
FOR EACH ROW EXECUTE FUNCTION set_course_owner_on_insert();

CREATE OR REPLACE TRIGGER organization_audit_events_append_only
BEFORE UPDATE OR DELETE ON organization_audit_events
FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

CREATE OR REPLACE TRIGGER organization_memberships_no_delete
BEFORE DELETE ON organization_memberships
FOR EACH ROW EXECUTE FUNCTION forbid_delete();

CREATE OR REPLACE TRIGGER organization_memberships_immutable
BEFORE UPDATE ON organization_memberships
FOR EACH ROW EXECUTE FUNCTION forbid_immutable_update(
  'organization_id', 'person_id', 'created_at'
);

CREATE OR REPLACE TRIGGER organization_role_assignments_scope_org
BEFORE INSERT OR UPDATE OF scope_type, scope_id, organization_id
ON organization_role_assignments
FOR EACH ROW EXECUTE FUNCTION validate_scope_belongs_to_organization();

CREATE OR REPLACE TRIGGER organization_grants_scope_org
BEFORE INSERT OR UPDATE OF scope_type, scope_id, organization_id
ON organization_grants
FOR EACH ROW EXECUTE FUNCTION validate_scope_belongs_to_organization();

CREATE OR REPLACE TRIGGER organization_invitations_scope_org
BEFORE INSERT OR UPDATE OF scope_type, scope_id, organization_id
ON organization_invitations
FOR EACH ROW EXECUTE FUNCTION validate_scope_belongs_to_organization();

CREATE OR REPLACE TRIGGER organization_role_assignments_audit
AFTER INSERT OR UPDATE OR DELETE ON organization_role_assignments
FOR EACH ROW EXECUTE FUNCTION audit_lifecycle_change();
```

Le même modèle de déclencheurs est appliqué aux autres tables de cycle de vie
(`organization_roles`, `organization_grants`, `organization_invitations`,
`organization_content_licenses`, `organization_supervision_grants`,
`organization_contracts`, `organization_modules`).

**Privilèges :**

```sql
REVOKE UPDATE, DELETE ON organization_audit_events FROM <application_role>;
GRANT SELECT, INSERT ON organization_audit_events TO <application_role>;
```

Le rôle applicatif est fourni par l’environnement. Si l’application se connecte
avec le propriétaire des tables, les privilèges ne suffisent pas : les
déclencheurs restent la protection effective.

**Suppression légale :** une fonction de maintenance dédiée, avec un privilège
séparé, peut effectuer une anonymisation ou une suppression pour une obligation
légale. Elle pose un drapeau de session, journalise l’opération et n’est jamais
appelée par un chemin applicatif ordinaire.

---

## Annexe B — Colonnes sur les tables existantes

```sql
-- Programmes
ALTER TABLE v2_programs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE v2_program_staff
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE participant_programs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE v2_sessions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE v2_groups
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE v2_kpis
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Groupes d’organisation (le groupe interne FUTURE STUDIO reste plateforme)
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_groups_organization
  ON groups (organization_id);

-- LMS
ALTER TABLE lms_courses
  ADD COLUMN IF NOT EXISTS owner_organization_id UUID REFERENCES organizations(id);
ALTER TABLE lms_enrollments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE lms_certificates
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE lms_assessment_attempts
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Venture
ALTER TABLE ventures
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE venture_members
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE venture_tasks
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE venture_documents
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE venture_deliverables
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE venture_sessions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Formulaires (si utilisés par le portail)
ALTER TABLE platform_form_runs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Session
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS active_organization_id UUID REFERENCES organizations(id);
```

Chaque colonne ajoutée doit avoir un index. Les noms exacts des tables de
fichiers, d’exports et de notifications sont confirmés en Phase 0, avant la
migration.

Le déclencheur `set_organization_on_insert` est posé sur **chaque** table du
pilote qui reçoit `organization_id` ; `lms_courses` utilise la variante
`set_course_owner_on_insert` sur `owner_organization_id`. Le déclencheur est
installé avant le passage à `NOT NULL`, et chaque ancien chemin de création est
testé après son installation.

---

## Annexe C — Ordre de mise en œuvre recommandé

1. **Phase 0** — inventaire, décisions, liste des tables, points d’entrée,
   lectures/écritures internes et chemins de création.
2. **Phase 1** — `organizations`, organisation plateforme, colonnes nullables,
   backfill, session, filtres internes, écritures compatibles, supervision,
   garanties d’historique, tests de schéma.
3. **Phase 2** — portail lecture : contexte, marque, membres, programmes, LMS,
   ventures, tests d’isolation bidirectionnelle en lecture.
4. **Phase 3** — écritures : invitations, rôles, inscriptions, remises,
   livrables, fichiers privés, exports, tests d’isolation en écriture.
5. **Phase 4** — suspension, conservation, revue de supervision, charge, pilote
   fictif.
6. **Phase 5** — test de production et promotion.

---

## Annexe D — Fichiers à revoir avant chaque phase

| Phase | Revue obligatoire |
|---|---|
| 0 | `docs/ARCHITECTURE.md`, `docs/AUTHZ_CURRENT_STATE.md`, `docs/LAYER_SPLIT.md` |
| 1 | `src/server/auth/session.js`, `src/models/sessions.js`, `supabase/migrations/` |
| 2 | `src/app/o/**`, `src/components/organization/**`, `src/locales/**` |
| 3 | `src/lib/storage.js`, routes d’export, e-mails, notifications |
| 4 | `docs/SECURITY_AUDIT_REGISTER.md`, `docs/PRODUCTION_TEST.md` |
| 5 | `docs/PRODUCTION_TEST.md` |

---

## Journal des décisions

| Date | Décision | Statut |
|---|---|---|
| 2026-10-22 | Organisation suspendue : refus de tout accès client, sans lecture seule ni période de grâce ; données conservées | Confirmé par Christelle dans la conversation |
| 2026-10-22 | Portail client séparé de la console interne | À valider |
| 2026-10-22 | Moteur de permissions existant non modifié en Phase 1 | À valider |
| 2026-10-22 | Organisation active dans la session, jamais dans l’URL | À valider |
| 2026-10-22 | Cache d’organisation séparé du cache d’autorisation existant | À valider |
| 2026-10-22 | Fichiers clients dans un bucket privé | À valider |
| 2026-10-22 | Supervision obligatoire pour lire le contenu client | À valider |
| 2026-10-22 | Éligibilité du portail séparée des lignes internes | À valider |
| 2026-10-22 | Isolation interne par filtres de modèles, plateforme par défaut | À valider |
| 2026-10-22 | Écritures existantes sécurisées par déclencheur compatible | À valider |
| 2026-10-22 | Supervision livrée en Phase 1, activation cliente bloquée sans elle | À valider |
| 2026-10-22 | Historique protégé par déclencheurs et privilèges de base | À valider |
