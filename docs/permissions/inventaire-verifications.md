# Inventaire — Vérifications d'autorisation (points « non vérifiés »)

**Périmètre** : lecture seule du dépôt `ImpactOs` (branche courante), code de
production sous `src/**`.
**Moteur inspecté** : `src/server/authz/**`, `src/models/authorization/**`,
`src/services/authorization/**` (dont `profile-catalog.js`,
`contextGrantReconcile.js`, `responsibilityAssignment.js`,
`contextGrantAssignments.js`, `profileAssignmentsStore.js`, `contextResolver.js`,
`contextDecisions.js`, `eligibility.js`).

**Méthode** : chaque point est confronté au code. Chaque conclusion porte un
`fichier:ligne` et un extrait exact. Aucune base de données n'a été interrogée :
quand la réponse dépend d'un état de données, c'est explicité.

## Légende des statuts

| Statut | Sens |
|---|---|
| **CONFIRMÉ** | Le comportement décrit existe dans le code tel qu'affirmé. |
| **PARTIEL** | Une partie est vérifiée, une partie manque ou diverge. |
| **ABSENT** | Le comportement n'existe pas dans le code. |

---

## 1. Compatibilité rôle ↔ profil (bloque ou avertit ?)

**Verdict : PARTIEL** — la règle est vérifiée et **bloque** aux deux points de
contrôle nommés (reconcile automatique + affectation manuelle de responsabilité),
mais **deux autres chemins d'attribution manuelle y échappent**.

> **CORRECTIF (Phase 8, tâche 3 — 2026-10-10).** Les deux chemins manuels
> ci-dessous **appliquent désormais la même règle** : une garde partagée
> (`profileRoleAssignmentGate` dans `services/authorization/profileCatalog.js`)
> compose le **même** `buildProfileRoleGap` + `profileRoleGateDecision` que les
> deux points de contrôle existants, et renvoie un **409** explicite avec
> `profile_role_gap`. Le verdict passe donc à **CONFORME** pour la règle §3.3
> (automatique + manuelle). Tests : `profile-assignments-phase-c.test.js`,
> `profile-override-api.test.js`.

### Le commutateur et sa valeur

`src/models/authorization/profile-catalog.js:53`

```
export const PROFILE_ROLE_ENFORCEMENT = "block";
```

La décision est centralisée, jamais recopiée sur les sites d'appel :

`src/services/authorization/profileCatalog.js:275-277`

```
export function profileRoleGateDecision(gap, mode = PROFILE_ROLE_ENFORCEMENT) {
  return { blocked: Boolean(gap) && mode === "block", gap: gap || null, mode };
}
```

Valeur effective : **`"block"`** (elle **REFUSE**, elle n'avertit pas). Le
commentaire du catalogue (`profile-catalog.js:44-51`) situe le basculement en
« Phase H ».

### Point de contrôle AUTOMATIQUE — REFUSE

`src/services/authorization/contextGrantReconcile.js:114-128`

```
const profileKey = await profileKeyForContextRole(context, roleKey);
const profileRoleGap = sourceIds.length
  ? await buildProfileRoleGap({ profileKey, cid })
  : null;
const profileGate = profileRoleGateDecision(profileRoleGap);
if (profileGate.blocked) {
  return {
    success: false,
    cid: String(cid),
    context,
    roleKey,
    error: "profile-role-not-allowed",
    profileRoleGap: profileGate.gap,
  };
}
```

Le refus intervient **avant toute écriture** (avant l'étape 3 « What exists
today »), donc rien n'est appliqué ni révoqué.

### Point de contrôle MANUEL (responsabilité) — REFUSE

`src/services/authorization/responsibilityAssignment.js:129-152`
(`buildResponsibilityProfileGap` puis `responsibilityProfileGate`
→ `profileRoleGateDecision`), appliqué dans la route :

`src/app/api/responsibilities/assign/route.js:73-91`

```
const profileRoleGap = await buildResponsibilityProfileGap({
  userCid: user_cid,
  responsibilityKey,
});
const profileGate = responsibilityProfileGate(profileRoleGap);
...
if (profileGate.blocked) {
  return NextResponse.json(
    {
      success: false,
      error: `Profile "${profileRoleGap.profile}" is not open to role "${profileRoleGap.role}".`,
      profile_role_gap: profileRoleGap,
    },
    { status: 409 },
  );
}
```

### Les deux chemins manuels qui N'appliquent PAS la règle

- **Registre d'affectations de profil** (Phase C) : la validation n'exige que la
  cohérence de contexte, jamais la compatibilité rôle ↔ profil.
  `src/services/authorization/profileAssignments.js:125-135`

  ```
  const profileContext = profileRow?.context ? String(profileRow.context) : null;
  ...
  } else if (profileContext && profileContext !== contextType) {
    errors.push(`context "${contextType}" does not match profile "${profileKey}"`);
  }
  ```

  La route ne fait appel à aucun `buildProfileRoleGap` :
  `src/app/api/engineering/permissions/profile-assignments/route.js:107-130`
  (`validateProfileAssignment`, `findActiveAssignment`, `insertProfileAssignment`)
  — pas de contrôle de rôle.

- **Override de profil par personne** : il contrôle l'éligibilité de *feature*
  (`assertAssignmentEligible`), pas l'appartenance rôle ↔ profil.
  `src/app/api/engineering/permissions/profile-override/route.js:88-102`

  ```
  const eligibility = await assertAssignmentEligible(user.rows[0], user_cid, {
    profileKey: profile_key,
  });
  ```

  Or `assertAssignmentEligible` (`src/services/authorization/profileAssignment.js:49-65`)
  ne lit que rôle/groupes/profils pour la table d'éligibilité, pas `allowed_roles`.

**Conséquence** : la rule « un profil réservé à un rôle » est *effective* (bloque)
sur l'automatique et sur la responsabilité manuelle ; elle n'est *pas appliquée*
si l'administrateur attribue directement une carte de profil via le registre
`profile_assignments` ou via l'override.

> **CORRIGÉ** : les deux chemins ci-dessus passent maintenant par
> `profileRoleAssignmentGate` (voir l'encadré en tête de section). Le registre
> `profile_assignments` lit le rôle de base via `cid` ; l'override utilise le
> `role` déjà lu (`getContactProfileOverrideTarget`), donc sans lecture
> supplémentaire.

---

## 2. Anti-escalade de privilèges

**Verdict : PARTIEL** — les gardes d'auto-attribution existent et sont
confirmées ; la garde générale « pas plus puissant que ce que j'administre »
est **ABSENTE**.

### Gardes d'auto-attribution (présentes)

- Responsabilités (séparation des tâches) :
  `src/services/authorization/responsibilityAssignment.js:42-45`

  ```
  export function isSelfResponsibilityChange(session, userCid) {
    if (!session?.cid || !userCid) return false;
    return String(session.cid) === String(userCid);
  }
  ```

  Appliquée en `src/app/api/responsibilities/assign/route.js:49-54` (HTTP `403`).

- Profil propre (override) :
  `src/services/authorization/profileAssignment.js:37-40`

  ```
  export function isSelfAssignment(session, userCid) {
    if (!session?.cid || !userCid) return false;
    return String(session.cid) === String(userCid);
  }
  ```

  Appliquée en `src/app/api/engineering/permissions/profile-override/route.js:64-69`
  (HTTP `403`).

### Contrôle sur les rôles cibles (présent, mais partiel)

- Promotion/retrait Super Admin : la capacité `assign_capabilities` ne suffit
  pas, il faut le rôle `super_admin`.
  `src/app/api/engineering/permissions/route.js:84-92`

  ```
  if (
    (action === "promote_super_admin" || action === "remove_super_admin") &&
    session.role !== "super_admin"
  ) {
    return NextResponse.json(
      { success: false, error: "errors.insufficientPermissions" },
      { status: 403 },
    );
  }
  ```

- Frontière d'éligibilité à l'attribution d'une capacité : la cible doit être
  éligible à la feature, sinon refus.
  `src/services/authorization/permissionWrites.js:106-121`

  ```
  const featureKey = MODULE_TO_FEATURE[module];
  if (action === "grant" && featureKey) {
    const targetAuthorization = await getAuthorizationContext({ cid: userCid, role: targetRole });
    const targetEligible =
      targetAuthorization?.isSuperAdmin ||
      targetAuthorization?.eligibility?.[featureKey] === true;
    if (!targetEligible) { ... 403 ... }
  }
  ```

### Ce qui manque (ABSENT)

Aucune requête de code ne compare **le pouvoir de la cible** au **pouvoir de
l'acteur** (niveau d'accès, rôle administré, périmètre). Le seul contrôle de
niveau est celui de la route de capacités (`ACCESS_LEVELS`), qui borne la cible
par son éligibilité — pas par l'acteur. Il n'existe donc pas de garde « on ne
peut pas s'accorder / accorder un droit supérieur à ce que l'on administre ».
La seule barrière de séparation des tâches est l'auto-attribution (points
ci-dessus), qui n'empêche pas A (non super admin) d'attribuer à B un rôle ou une
capacité plus forte que la sienne, tant que B est éligible.

---

## 3. Historique des changements de rôle global (audit)

**Verdict : PARTIEL** — journalisé sur le chemin du « Permission Center »,
**non journalisé** sur le chemin `PUT /api/contacts`.

### Journalisé

`src/services/authorization/permissionWrites.js:235-253` (`action === "set_role"`)

```
const priorContact = await getContactForAssignment(userCid);
const priorRole = priorContact.rows[0]?.role;
await setUserRole(payload.role, userCid);
await logPermissionAudit({
  actorCid: actor.cid,
  actorName: actor.name,
  targetCid: userCid,
  targetName,
  action: "role_changed",
  previousValue: priorRole || "none",
  newValue: payload.role,
  details: `Role changed to ${payload.role}`,
});
```

Promotion/retrait Super Admin journalisés aussi :
`src/services/authorization/permissionWrites.js:71-78` et `:85-92`
(`action: "role_changed"`).

### NON journalisé (le trou)

Le `role` d'un contact est modifiable par `PUT /api/contacts`
(`role` n'est écrit que si `canAssignRole`), et cette écriture **n'appelle
aucun `logPermissionAudit`** :

- construction du champ : `src/services/contacts/update.js:44-97`
  (`...(canAssignRole ? ["role"] : [])`, aucune trace d'audit).
- route : `src/app/api/contacts/route.js:104-129` → `updateContactFields(...)`
  sans appel d'audit de rôle.

**Conséquence** : un changement de rôle via l'écran contact standard laisse le
rôle modifié sans entrée dans `permission_audit_log`.

---

## 4. Anti-doublons d'affectation / chevauchements

**Verdict : CONFIRMÉ** (déduplication applicative et idempotence), **avec une
réserve** : `profile_assignments` n'a **aucune contrainte UNIQUE** en base.

### Évitement des doublons sur les cartes automatiques

Plan pur qui ne demande l'ouverture que des ids non couverts :
`src/services/authorization/contextGrantAssignments.js:55-80`

```
const toOpen = [...wanted].filter((id) => !covered.has(id));
```

Application idempotente (on ne compte que les lignes réellement déplacées) :
`src/services/authorization/contextGrantAssignments.js:135-154`

```
const result = await refreshAutomaticAssignmentPeriod({ ... });
if (Number(result?.rowsAffected ?? 0) > 0) refreshed.push(card.contextId);
...
const result = await closeProfileAssignment({ id: card.id, status: "ended" });
if (Number(result?.rowsAffected ?? 0) > 0) closed.push(card.contextId);
```

Les statements sont gardés (`WHERE ... status = 'active'`, `IS DISTINCT FROM`) :
`src/models/authorization/profileAssignmentsStore.js:146-154` et `:236-243`.

### Anti-doublon manuel

`src/app/api/engineering/permissions/profile-assignments/route.js:119-130`

```
const existing = await findActiveAssignment({ ... });
if ((existing.rows || []).length > 0) {
  return NextResponse.json(
    { success: false, error: "this profile is already active for this person" },
    { status: 409 },
  );
}
```

### Capacités : dédupliquées au niveau base

`user_capabilities` : upsert `ON CONFLICT (user_cid, module, capability)`
`src/models/authorization/contextGrantsStore.js:202-212`.
`context_applied_grants` : `UNIQUE(user_cid, context, role_key, module, capability)`
`src/models/authorization/contextGrantsStore.js:43`.

### Gestion des chevauchements

Un seul enregistrement par période : « une période = un enregistrement », une
réactivation écrit une **nouvelle** ligne, une fin **ferme** la ligne
(`status = 'ended'`), jamais de réécriture de période
(`src/services/authorization/contextGrantAssignments.js:18-24`).

### Réserve (PARTIEL en base)

La table `profile_assignments` n'a que deux index **non uniques** :
`src/models/authorization/profileAssignmentsStore.js:27-50`

```
CREATE TABLE IF NOT EXISTS profile_assignments ( ... )
...
CREATE INDEX IF NOT EXISTS idx_profile_assignments_lookup
  ON profile_assignments(contact_cid, profile_key, status)
...
CREATE INDEX IF NOT EXISTS idx_profile_assignments_context
  ON profile_assignments(context_type, context_id) WHERE status = 'active'
```

La déduplication « active » reposant sur des **lectures** applicatives, deux
exécutions concurrentes du reconcile (ex. sweep + on-connect) pourraient, en
théorie, ouvrir deux cartes. Aucune contrainte de base ne l'interdit.

---

## 5. Déclencheurs automatiques

**Verdict : PARTIEL** — les cinq automatismes **existent** dans le code ; aucun
n'est écrit **dans la même transaction** que la relation métier ; deux d'entre
eux (participant, learner) n'ont même pas d'appel *inline* et ne sont résolus
que par le reconcile « à la connexion » / le balayage planifié.

> **CORRECTIF PARTIEL (Phase 8, tâche 2 — 2026-10-10).** Les deux déclencheurs
> **PARTICIPANT** et **LEARNER** ont désormais un appel **inline** best-effort :
> `assignParticipantToProgramsService` / `removeParticipantFromProgramService`
> (`services/programs/participantPrograms.js`) et `enrollLearner`
> (`services/lms/learning/enrollments.js`) réconcilient le couple
> (`program`,`participant`) / (`lms`,`learner`) juste après l'écriture métier.
> Le patron reste **best-effort** (un échec est journalisé, jamais propagé) et
> **sans transaction englobante** — la transaction « même que la relation
> métier » reste ouverte. Tests : `phase8-automatic-triggers.test.js`.

### La liste d'activation (source unique)

`src/services/authorization/contextGrantPlan.js:27-44`

```
export const SUPPORTED_CONTEXT_ROLES = [
  { context: "venture", roleKey: "founder" },
  { context: "program", roleKey: "facilitator" },
  { context: "program", roleKey: "program_manager" },
  { context: "investor", roleKey: "investor" },
  { context: "lms", roleKey: "learner" },
  { context: "venture", roleKey: "venture_manager" },
  { context: "program", roleKey: "participant" },
];
```

### Résolution (justification) de chaque couple

`src/services/authorization/contextGrantJustification.js`

- **PARTICIPANT** : `:177-181`

  ```
  if (context === "program" && roleKey === "participant") {
    const { rows } = await listActiveParticipantPrograms(cid);
    const sourceIds = (rows || []).map((row) => String(row.program_id)).filter(Boolean);
    return await coupleReport(context, roleKey, sourceIds);
  }
  ```

  lecture : `src/models/authorization/contextGrantsStore.js:159-167`
  (`FROM participant_programs WHERE participant_id = ?`).

- **LEARNER** : `contextGrantJustification.js:161-165`

  ```
  if (context === "lms" && roleKey === "learner") {
    const { rows } = await listActiveLearnerCourses(cid);
    const sourceIds = (rows || []).map((row) => String(row.course_id)).filter(Boolean);
    return await coupleReport(context, roleKey, sourceIds);
  }
  ```

  lecture : `contextGrantsStore.js:120-128`
  (`FROM lms_enrollments WHERE user_cid = ? AND status <> 'suspended'`).

- **VENTURE_MANAGER** : `contextGrantJustification.js:168-172`

  ```
  if (context === "venture" && roleKey === "venture_manager") {
    const ventures = await listActiveVentureManagerVentures(cid);
    const sourceIds = (ventures || []).map((id) => String(id)).filter(Boolean);
    return await coupleReport(context, roleKey, sourceIds);
  }
  ```

  lecture : `contextGrantsStore.js:139-147`
  (`FROM venture_staff_assignments WHERE ... responsibility_code = 'lead_manager' AND status = 'active'`).

- **FACILITATOR** : `contextGrantJustification.js:99-131` (branche
  `context === "program" && roleKey === "facilitator"`) ; lecture des
  affectations par `listActiveProgramAssignments` / `assignmentsForRole`.

- **PROGRAM_MANAGER** : `contextGrantJustification.js:99-143` (même branche,
  sous-cas `roleKey === "program_manager"`, profil décidé par le registre
  Context Roles).

### « Même transaction que la relation métier ? » — **NON**

Aucun `BEGIN`/`COMMIT` ni transaction englobante : le reconcile est appelé
**après** l'écriture métier, en « best-effort » (commentaires explicites
« a failure here must never fail the acceptance itself »).

- **PROGRAM_MANAGER** — écriture puis reconcile séparés :
  `src/services/programs/programManager.js:71` (`await setProgramManager(...)`)
  puis `:80`

  ```
  const result = await syncContextGrantsForUser(cid, {
    context: "program",
    roleKey: "program_manager",
  });
  ```

  et le commentaire `:73-75` : « Reconcile failures must not lose the recorded
  relationship ».

- **FACILITATOR** — appel *inline* après l'affectation :
  `src/app/api/program-staff/route.js:34-36`

  ```
  if (contactCid) {
    await reconcileFacilitatorAccessForUser(contactCid, { email: staffRef });
  }
  ```

  (rappel : l'affectation elle-même dans `v2_program_staff` est écrite plus tôt).

- **VENTURE_MANAGER / FOUNDER** — appels best-effort :
  `src/services/ventures/record.js:232-235`,
  `src/services/ventures/memberRoster.js:27-30`,
  `src/models/ventureMemberInvitations.js:102-110`.

- **PARTICIPANT** — **aucun** appel inline trouvé. La seule entrée est la
  résolution à la connexion : `src/app/api/me/permissions/route.js:36-40`

  ```
  await syncContextGrantsOnConnect(session.cid, { email: session.email || null });
  ```

  et le balayage planifié :
  `src/app/api/engineering/permissions/context-grants-sweep/route.js:61-65`.

- **LEARNER** — idem PARTICIPANT : aucun appel inline ; résolu par le reconcile
  à la connexion / le balayage.

**Conséquence** : une inscription à un programme ou à un cours n'accorde le
profil correspondant qu'au prochain reconcile de la personne (connexion, à TTL
5 min, voir `src/services/authorization/contextGrantOnConnect.js:27-37`) ou au
prochain balayage — jamais dans la transaction d'inscription.

> **PARTIELLEMENT CORRIGÉ** : PARTICIPANT et LEARNER ne dépendent plus du seul
> reconcile de connexion/balayage — ils sont déclenchés **inline** (voir
> l'encadré en tête de section). La **transaction** unique reste à faire.

---

## 6. Gestion du catalogue de profils (créer / modifier / désactiver / supprimer)

**Verdict : CONFIRMÉ**.

### Créer

`src/app/api/engineering/permissions/profiles/route.js:264-333` (`POST`,
capacité `permissions.configure_eligibility`), validation
`validateProfileCreate` (`src/services/authorization/profileCatalog.js:112-130`),
insertion `insertProfile` (`src/models/authorization/profilesStore.js:93-106`).

### Modifier

`src/app/api/engineering/permissions/profiles/route.js:165-262` (`PUT`),
persistance `updateProfile` (`profilesStore.js:120-127`).

### Désactiver (conserve l'historique)

Le PUT écrit un simple drapeau `is_active` ; *aucune* ligne n'est supprimée :

`src/models/authorization/profilesStore.js:120-127`

```
export function updateProfile({ key, allowedRoles, isActive, notes }) {
  return db.execute({
    sql: `UPDATE profiles
          SET allowed_roles = ?, is_active = ?, notes = ?, updated_at = NOW()
          WHERE key = ?`,
    args: [...],
  });
}
```

Les `profile_assignments` et l'historique ne sont pas touchés (la désactivation
n'écrit pas dans `profile_assignments`). La lecture d'éligibilité filtre sur
`is_active = 1` (`src/models/authorization/contextReads.js:61-68,76-84`) : un
profil inactif n'est simplement plus accordé, son historique reste lisible via
`listProfileAssignments` (`profileAssignmentsStore.js:62-71`).

### Supprimer

`src/app/api/engineering/permissions/profiles/route.js:335-410` (`DELETE`),
avec **trois garde-fous de référence** avant toute suppression :

- défaut de rôle : `:363-370` (`listRolesUsingProfileDefault` → 400) ;
- affectation détenue : `:372-379`

  ```
  const assignedRes = await countActiveAssignmentsForProfileKey(key);
  const assignedCount = Number(assignedRes.rows?.[0]?.n || 0);
  if (assignedCount > 0) { ... "profile_in_use_assignments" ... 400 }
  ```

- ligne de registre de contexte : `:381-388`.

Puis suppression des capacités et de la ligne :
`:390-391` (`deleteProfileCapabilities(key)` puis `deleteProfile(key)`).

**Conséquence** : désactiver préserve bien l'historique ; supprimer est possible
mais refusé tant qu'une référence active existe.

---

## 7. Comportement de MANAGE (implication d'autres actions ?)

**Verdict : ABSENT** — dans la décision d'autorisation, `MANAGE` n'autorise
implicitement **aucune** autre action. Il existe une règle d'implication
distincte, mais elle porte sur `view` et s'applique à l'**écriture** des
capacités de profil, pas à la décision.

### La décision est à capacité exacte

`src/services/authorization/contextDecisions.js:32-45`

```
export function authorize(ctx, module, capability, minLevel = 1) {
  if (!ctx || !module || !capability) return false;
  if (ctx.isSuperAdmin) { ... }
  const featureKey = MODULE_TO_FEATURE[module];
  if (featureKey && ctx.eligibility?.[featureKey] !== true) return false;
  return Number(ctx.effective?.[module]?.[capability] ?? 0) >= minLevel;
}
```

Aucune expansion `manage → view`, ni `manage → create/edit/delete`. Les
capacités sont distinctes dans le vocabulaire, ex.
`permissions` : `grant`, `revoke`, `assign_capabilities`, `configure_eligibility`
(`src/server/authz/capabilities.js:54-67`), `org_membership` : `["view","manage"]`
(`:81-84`).

### Seule « implication » existante : le niveau et `view`

- Le niveau d'accès est une comparaison : `ACCESS_LEVELS.FULL = 5`
  (`src/server/authz/capabilities.js:125-132`) satisfait tout `minLevel`.

- À l'écriture des capacités de **profil**, toute capacité active d'un module
  portant `view` implique `view` au niveau 1 :
  `src/services/authorization/profileCapabilities.js:48-53`

  ```
  const supportsView =
    PERMISSION_MODULES[module]?.capabilities?.includes("view") ?? false;
  const othersActive = Object.keys(moduleLevels).some(
    (capability) => capability !== "view" && moduleLevels[capability] > 0,
  );
  if (supportsView && othersActive && !moduleLevels.view) moduleLevels.view = 1;
  ```

Ce n'est donc pas `MANAGE` qui implique quoi que ce soit : c'est la règle
générique « toute action implique `view` » du normalisateur de capacités de
profil.

---

## 8. État du compte dans la décision

**Verdict : PARTIEL** — l'état du compte est contrôlé à la **lecture de
session** (authentification), **pas** dans la décision d'autorisation.

### Contrôle existant (session)

`src/server/auth/session.js:230-248`

```
const allowedStatuses = ["active", "approved"];
if (
  session.status &&
  !allowedStatuses.includes(session.status) &&
  session.role !== "super_admin"
) {
  ...
  return null;
}
```

Le `status` provient du JOIN contact :
`src/models/sessions.js:39-47`

```
SELECT s.*, c.name, c.email, c.status, c.group_name
FROM user_sessions s
LEFT JOIN contacts c ON s.user_cid = c.cid
WHERE s.expires_at > NOW() AND s.token_hash = ?
```

Un compte non `active`/`approved` (donc désactivé/suspendu/en attente) obtient
une session nulle → toute route protégée répond 401. Le Super Admin est exempté.

### Ce que la décision ne fait pas

`src/services/authorization/contextResolver.js:106-222` ne lit le contact que
pour `profile_key` et `group_name`
(`src/models/authorization/contextReads.js:46-51`), jamais `status` :
`contextDecisions.js:32-45` n'a aucune notion d'état de compte. Si un contexte
d'autorisation est résolu pour un contact désactivé (hors requête HTTP, ou
session déjà en cache), la décision accorde quand même.

**Conséquence** : le garde-fou d'état existe (bloque à l'authentification) mais
n'est pas une condition de la décision d'autorisation elle-même.

---

## 9. Période de validité à la décision

**Verdict : CONFIRMÉ** — la décision lit **directement** les colonnes de période
(`expires_at` pour les capacités, `ends_at` pour les affectations) ; il n'existe
**pas** de copie recalculée consultée à la place.

### Capacités (expiry lue à la décision)

`src/models/authorization/contextReads.js:27-34`

```
export function getUserCapabilityGrants(cid) {
  return db.execute({
    sql: `SELECT module, capability, access_level FROM user_capabilities
          WHERE user_cid = ? AND (expires_at IS NULL OR expires_at > NOW())`,
    args: [cid],
  });
}
```

Idem pour les restrictions : `contextReads.js:37-43`.

### Profils (période lue à la décision)

`src/models/authorization/profileAssignmentsStore.js:77-87`

```
SELECT DISTINCT profile_key
FROM profile_assignments
WHERE contact_cid = ?
  AND status = 'active'
  AND (ends_at IS NULL OR ends_at > NOW())
```

et `findActiveAssignment` : `profileAssignmentsStore.js:157-180`
(`ends_at IS NULL OR ends_at > NOW()`).

### Aucune copie recalculée

Le mécanisme de reconcile **met à jour la même colonne** (`expires_at`) plutôt
que d'entretenir une table dérivée :
`src/models/authorization/contextGrantsStore.js:253-259`

```
export function refreshUserCapabilityExpiry(cid, sentinel, expiresAt) {
  return db.execute({
    sql: `UPDATE user_capabilities SET expires_at = ?
                WHERE user_cid = ? AND granted_by = ? AND expires_at IS DISTINCT FROM ?`,
    args: [expiresAt, String(cid), sentinel, expiresAt],
  });
}
```

De même, la justification calcule `expiresAt` (dernière date de fin de
programme) et l'écrit dans `user_capabilities` / `profile_assignments`
(`contextGrantJustification.js:116` + `contextGrantReconcile.js:142-161,
175-178`). La lecture d'autorisation reste donc une lecture directe de la
période stockée.

---

## Synthèse

| # | Point | Verdict |
|---|---|---|
| 1 | Compatibilité rôle ↔ profil (bloque/avertit) | PARTIEL |
| 2 | Anti-escalade de privilèges | PARTIEL |
| 3 | Historique des changements de rôle | PARTIEL |
| 4 | Anti-doublons d'affectation | CONFIRMÉ |
| 5 | Déclencheurs automatiques | PARTIEL |
| 6 | Gestion du catalogue de profils | CONFIRMÉ |
| 7 | Comportement de MANAGE | ABSENT |
| 8 | État du compte dans la décision | PARTIEL |
| 9 | Période de validité à la décision | CONFIRMÉ |

---

## Incertitudes

1. **Point 4 — course concurrente** : l'absence de contrainte `UNIQUE` sur
   `profile_assignments` rend le doublon possible uniquement sous concurrence
   réelle (sweep + on-connect simultanés). Je n'ai pas pu le vérifier en base ;
   c'est une limite de conception, non observée à l'exécution dans ce travail en
   lecture seule.
2. **Point 3 — audit par d'autres canaux** : je n'ai pas trouvé de
   `logPermissionAudit` sur `PUT /api/contacts`, mais une trace de changement de
   rôle pourrait exister dans un journal *fonctionnel* distinct de
   `permission_audit_log` (ex. timelines de contact/venture). Le point porte sur
   le journal d'audit de permissions ; d'autres journaux n'ont pas été
   exhaustive-ment parcourus.
3. **Point 5 — « transaction »** : je conclus à l'absence de transaction
   englobante à partir de la lecture des appels (`setX` puis `sync` séparés, pas
   de `BEGIN`/`COMMIT` dans ces modules). Je n'ai pas inspecté le driver
   `src/lib/db.js` pour un éventuel auto-commit transactionnel par requête ;
   toutefois aucun regroupement transactionnel n'apparaît dans le code
   d'orchestration.
4. **Point 6 — présence de la colonne `label`** : `listProfiles` et `getProfileRow`
   sélectionnent une colonne `label` (`profilesStore.js:72-87`) absente du
   `CREATE TABLE` (`:26-35`). Cela n'affecte pas la conclusion (création,
   modification, désactivation, suppression existent), mais la lecture peut
   dépendre d'une migration hors du fichier lu.
