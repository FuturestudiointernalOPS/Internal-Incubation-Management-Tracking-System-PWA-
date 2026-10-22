# White-label ImpactOS — Spécification d’implémentation

> **Statut : spécification. Aucune ligne de code applicatif n’est encore
> modifiée.** Ce document décrit ce qu’il faut construire, dans quel ordre, avec
> quels points d’intégration et quels critères de non-régression.
>
> **Modèle conceptuel :**
> [`WHITE_LABEL_ORGANIZATION_MODEL.md`](./WHITE_LABEL_ORGANIZATION_MODEL.md).
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

1. **Les routes internes gardent leur moteur et leur comportement.**
   `resolveAuthorizationContext`, `getAuthorizationContext`, `requireAuthorization`
   et les gardes existants ne sont pas modifiés en Phase 1.
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
6. **La migration est additive.**
   Les données existantes rejoignent l’organisation plateforme. Aucune colonne
   existante n’est supprimée, aucun rôle n’est renommé, aucun droit n’est retiré.
7. **Pas de interrupteur d’application de la règle.**
   Le garde du portail est toujours actif pour les routes du portail. Un
   interrupteur global qui pourrait être oublié n’est pas un contrôle.
8. **Les fichiers clients ne sont pas publics.**
   Le stockage actuel peut créer des buckets publics ; le portail client ne
   réutilise pas ce comportement pour des données privées.

---

## 3. Stratégie : l’étrangleur, pas le grand soir

```
Phase 0  Inventaire et décisions           aucune modification applicative
Phase 1  Fondation invisible               tables, organisation plateforme, session
Phase 2  Portail en lecture                programmes, LMS, ventures, membres
Phase 3  Écritures, fichiers, exports      remises, livrables, documents, partages
Phase 4  Durcissement et pilote fictif     isolation, supervision, charge
Phase 5  Promotion                          test de production
```

Chaque phase est réversible. Tant que le portail n’est pas activé, les routes
internes se comportent exactement comme avant.

---

## 4. Points d’intégration dans le code existant

### 4.1 Ce qui est créé

| Couche | Fichiers proposés |
|---|---|
| Modèles | `src/models/organizations.js` (barrel) + `src/models/organizations/{schema,core,branding,contracts,modules,memberships,roles,assignments,grants,invitations,licenses,supervision,audit,retention,scopes,tenantTables}.js` |
| Services | `src/services/organizations/{index,organizationContext,organizationAccess,organizationAdmin,organizationInvitations,organizationBranding,organizationAudit,organizationExports,organizationFiles,organizationSupervision,organizationCache,organizationScopes}.js` |
| Garde HTTP | `src/server/authz/organization.js` |
| API portail | `src/app/api/org/**/route.js` |
| API publique d’invitation | `src/app/api/org/invitations/accept/route.js` |
| API plateforme | `src/app/api/platform/organizations/**/route.js` |
| Pages portail | `src/app/o/[organizationCode]/**/page.js` + `layout.js`, `src/app/o/select/page.js`, `src/app/o/invite/[token]/page.js` |
| Composants | `src/components/organization/**` |
| Traductions | `src/locales/en/organization.json`, `src/locales/fr/organization.json` |
| Migration | `supabase/migrations/YYYYMMDD_white_label_organizations.sql` |
| Tests | `src/__tests__/organization-*.test.js` |

### 4.2 Ce qui est modifié, et seulement cela

| Fichier | Modification | Raison |
|---|---|---|
| `supabase/migrations/…` | Nouvelle migration additive | Créer les tables et colonnes |
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
- Les routes et écrans internes existants.

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

### 5.3 Changement d’organisation

`POST /api/org/context` avec `{ organization_id }` :

1. Vérifier que la personne a une appartenance `active` dans cette organisation.
2. Vérifier que l’organisation est `active`.
3. Mettre à jour `user_sessions.active_organization_id`.
4. Invalider le cache de session du jeton courant.
5. Invalider le cache de contexte d’organisation de la personne.
6. Retourner le nouveau contexte.

**Règles :**

- Le changement d’organisation ne crée pas une nouvelle session.
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

---

## 7. Migration

### 7.1 Ordre

| Étape | Contenu | Comportement visible |
|---|---|---|
| 0 | Inventaire des tables, points d’entrée, fichiers, exports, tâches de fond | Aucun |
| 1 | Créer les tables nouvelles et l’organisation plateforme | Aucun |
| 2 | Ajouter `organization_id` nullable aux tables du pilote, backfill vers l’organisation plateforme, créer les index | Aucun |
| 3 | Créer les modèles de rôles et les rôles de l’organisation plateforme | Aucun |
| 4 | Déployer le code du portail, désactivé | Aucun |
| 5 | Créer les organisations fictives et activer le portail pour elles | Uniquement pour elles |
| 6 | Passer `organization_id` en `NOT NULL` sur les tables du pilote | Aucun pour l’interne |
| 7 | Ajouter les clés composites et les contraintes | Aucun pour l’interne |
| 8 | Pilote réel, puis test de production | Uniquement pour les clients |

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

### 7.3 Rollback

- Désactiver le portail : les routes internes restent inchangées.
- Les tables nouvelles sont additives ; on peut les laisser en place.
- Les colonnes `organization_id` sont nullables sur les tables historiques ;
  les routes internes les ignorent.
- Ne pas supprimer une colonne ou une table contenant des données sans export
  préalable.
- Un rollback de code ne doit jamais nécessiter un rollback de schéma.

### 7.4 Environnements

- La migration et les tests se font sur **staging**.
- Sur ce poste, `.env.local` pointe sur la **production** : ne pas exécuter la
  migration avec cet environnement.
- Les vérifications read-only utilisent
  `node scripts/db-audit/run-readonly.mjs <sql-file> .env.audit-staging`.
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
```

Chaque fonction retourne `null` si la requête peut continuer, ou une réponse
`NextResponse` sinon. Le style est identique aux gardes existants.

Les routes du portail utilisent `createHandler` **sans liste de rôles**, puis
appellent `requireOrganization()`. Le garde attache `req.organization` et
appelle `setRequestContext({ organizationId })`. Les routes publiques
d’invitation utilisent `createHandler({ public: true }, …)` et valident le jeton.

### 8.2 Décision

`evaluateOrganizationAuthorization` dans
`src/services/organizations/organizationAccess.js` :

```
1. session + organisation active
2. appartenance active (relue)
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
X-Org-Decision: no-membership | module-disabled | capability-missing
              | out-of-scope | wrong-organization | allowed
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

- Un mandat actif est obligatoire pour lire le contenu client dans le portail,
  même pour le propriétaire de la plateforme.
- Le mandat a un motif, une portée et une date de fin.
- Chaque usage écrit un événement de journal.
- Une procédure d’urgence (« break-glass ») peut exister, mais elle est
  journalisée et alertée.

### 11.8 Verrou dans la base (durcissement)

En Phase 4, on peut ajouter un second verrou dans la base sur les tables du
pilote : la base ne rend que les lignes de l’organisation active. Ce n’est pas la
ceinture principale, et cela ne protège ni les fichiers, ni les exports, ni les
jobs. Cela demande :

- un rôle de connexion applicatif distinct ;
- l’organisation active posée par transaction ou par connexion ;
- `FORCE ROW LEVEL SECURITY` pour que le propriétaire des tables n’y échappe
  pas ;
- une vérification que les DDL de maintenance au démarrage ne contournent pas le
  verrou ;
- des tests de fuite inter-organisations sur les tables couvertes.

Tant que ces conditions ne sont pas réunies, l’isolation applicative et les
tests de la matrice restent la référence.

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

### 13.2 Tests de service

| Suite | Ce qu’elle verrouille |
|---|---|
| `organization-context.test.js` | Résolution de l’appartenance, modules, rôles, cache |
| `organization-switch.test.js` | Changement d’organisation, invalidation, aucune fuite |
| `organization-admin.test.js` | Délégation bornée, audit, refus d’escalade |
| `organization-supervision.test.js` | Mandat obligatoire, expiration, journal |

### 13.3 Tests de route

| Suite | Ce qu’elle verrouille |
|---|---|
| `organization-routes-auth.test.js` | `401` sans session, `403` sans appartenance |
| `organization-routes-isolation.test.js` | Pour chaque route du pilote : identifiant d’une autre organisation → `404` |
| `organization-routes-modules.test.js` | Module désactivé → refus |
| `organization-routes-csrf.test.js` | Mutations même origine, pas de `GET` mutant |
| `organization-files.test.js` | Téléchargement contrôlé, bucket privé, lien court |

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
4. Déploiement du code.
5. Création des organisations fictives.
6. Exécution de la matrice d’isolation.
7. Vérification des tests existants.

### 14.2 Production

- Ne pas exécuter la migration avec `.env.local` sur ce poste : il pointe sur la
  production.
- Utiliser l’environnement de staging pour les essais.
- La promotion vers `main` suit le **test de production**
  (`docs/PRODUCTION_TEST.md`), item par item.

### 14.3 Critères go / no-go

- Aucun accès croisé dans la matrice d’isolation.
- Aucune régression des suites de permissions existantes.
- Aucune route interne modifiée dans son comportement.
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
| Une route interne est modifiée par erreur | Liste « ne pas toucher », revue de diff, tests existants |
| Le cache sert les droits de l’ancienne organisation | Clé avec organisation, invalidation au changement |
| Un bucket public expose des fichiers clients | Bucket privé séparé, téléchargement contrôlé |
| Un job de fond travaille sans organisation | `organization_id` obligatoire, test de job |
| Un rôle client dépasse son plafond | Modèle de rôle global, validation, test d’escalade |
| Une clé composite échoue à cause des types historiques | Vérification applicative d’abord, normalisation ensuite |
| La migration est trop longue ou destructive | Additive, par lots, staging, sauvegarde |
| Un administrateur client voit la console interne | Portes séparées, rôle d’organisation, test de route |
| Un salarié Future Studio lit sans mandat | Supervision obligatoire dans le portail, journal |

---

## 16. Définition de terminé

La fonctionnalité est terminée lorsque :

- le modèle conceptuel est validé ;
- les tables et contraintes sont en place ;
- l’organisation plateforme existe et toutes les données du pilote y sont
  rattachées ;
- le portail client fonctionne en lecture pour les trois modules ;
- les écritures du pilote sont couvertes par le garde d’organisation ;
- les fichiers, exports, e-mails, liens publics et jobs sont filtrés ;
- la matrice d’isolation est verte ;
- les suites de non-régression sont vertes ;
- le scénario Horizon est reproductible ;
- la supervision est explicite et journalisée ;
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (scope_type = 'organization' AND scope_id IS NULL)
    OR (scope_type <> 'organization' AND scope_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_grants_one_effect
  ON organization_grants
    (organization_id, subject_type, subject_id, module, capability,
     effect, scope_type, COALESCE(scope_id, ''));

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

---

## Annexe C — Ordre de mise en œuvre recommandé

1. **Phase 0** — inventaire, décisions, liste des tables et des points d’entrée.
2. **Phase 1** — `organizations`, organisation plateforme, colonnes nullables,
   backfill, session, cache, tests de schéma.
3. **Phase 2** — portail lecture : contexte, marque, membres, programmes, LMS,
   ventures, tests d’isolation en lecture.
4. **Phase 3** — écritures : invitations, rôles, inscriptions, remises,
   livrables, fichiers privés, exports, tests d’isolation en écriture.
5. **Phase 4** — supervision, suspension, conservation, charge, pilote fictif.
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
| 2026-10-22 | Portail client séparé de la console interne | À valider |
| 2026-10-22 | Moteur de permissions existant non modifié en Phase 1 | À valider |
| 2026-10-22 | Organisation active dans la session, jamais dans l’URL | À valider |
| 2026-10-22 | Cache d’organisation séparé du cache d’autorisation existant | À valider |
| 2026-10-22 | Fichiers clients dans un bucket privé | À valider |
| 2026-10-22 | Supervision obligatoire pour lire le contenu client | À valider |
| 2026-10-22 | Éligibilité du portail séparée des lignes internes | À valider |
