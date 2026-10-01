# Couloir Permissions & Sécurité — Fiche de travail (L5 + B10)

> Fiche 4 de `REPARTITION_STAGIAIRES.md` — Harry.
> Méthode : `PLAN_DE_TRAVAIL_STAGIAIRES.md` §6 (CH-3) et §5 (CH-2).
> Règles zéro-conflit : périmètre exclusif, fichiers listés **avant** toute édition.
> Branche : `feature/permissions` (issue de `interns`).

---

## 1. Mission (rappel)

1. **L5 — couloir autorisation côté décision** : finir d'amaigrir les contrôleurs
   des routes du périmètre (la décision part vers `src/services/authorization/**`),
   puis découper les deux gros services `context.js` (560) et `contextGrants.js` (538).
2. **B10 — centre de permissions** : découper `src/components/permissions/PermissionCenter.js`
   (4 884) en composants dans `src/components/permissions/permission-center/`.

Comportement **invariant** : même réponses HTTP, même rendu, mêmes tests périmés.

---

## 2. Périmètre exclusif — liste exacte des fichiers (25 routes, 3 206 L)

### Routes (dossiers entiers)

`src/app/api/access-profiles/**`
- `access-profiles/route.js` (463) · `access-profiles/assign/route.js` (291)
- `access-profiles/role-defaults/route.js` (160)

`src/app/api/engineering/permissions/**`
- `route.js` (117) · `audit/route.js` (110) · `eligibility/route.js` (258)
- `context-roles/route.js` (169) · `context-grants-sweep/route.js` (64)
- `sync-context-grants/route.js` (50) · `user-context/route.js` (94)
- `venture-strict-audit/route.js` (123) · `scope-check/route.js` (81)
- `impact/route.js` (37) · `program-scope-readiness/route.js` (44)
- `program-portfolio-default/route.js` (126) · `seed/route.js` (51)
- `seed-access-profiles/route.js` (31) · `context-grant-readiness/route.js` (46)

`src/app/api/org-membership/**`
- `org-membership/route.js` (225)

`src/app/api/responsibilities/**`
- `route.js` (199) · `assign/route.js` (223) · `access/route.js` (101)

`src/app/api/security/**` *(comportement d'autorisation CONSERVÉ — allowlist
statique `createHandler({ roles })`, pas de bascule matrix)*
- `events/route.js` (63) · `sessions/route.js` (47) · `login-history/route.js` (33)

### Service (le barillet est à moi, additif seulement)

- `src/services/authorization/` — **tous** les fichiers : `index.js` (barillet),
  `context.js` (560), `contextGrants.js` (538), `contextGrantReadiness.js`,
  `eligibility.js`, `eligibilityAdmin.js`, `membership.js`, `programAssignments.js`,
  `programScopeReadiness.js`, `scope.js`, `scopedAccess.js`, `resourceGuards.js`,
  `accessProfiles.js`, `permissionMatrix.js`, `permissionWrites.js`, `listingScope.js`.
  ⚠️ Ne jamais retirer d'export (12 `DECISION_EXPORTS` pinnés par
  `services-boundaries.test.js` ; `listingScope` importé par tasks/projects).

### Modèles (données du couloir)

- `src/models/authorization.js` (951) · `src/models/authorization/**`
  (dont facades `resolver.js`, `contextGrants.js`, `contextGrantReadiness.js`,
  `context.js`, `scope.js`, …) · `src/models/accessProfilesStore.js`
  · `src/models/responsibilities.js`.

### Composant (B10)

- `src/components/permissions/PermissionCenter.js` (4 884, seule source)
  → nouveaux fichiers uniquement dans `src/components/permissions/permission-center/`.
  Surface publique à garder : `default PermissionManager`, `{ GovernanceView }`.

---

## 3. Ne PAS toucher (autres propriétaires)

- `src/components/permissions/PeopleView.js`, `ProgramScopePanel.js` → lead (B11).
- Le reste de `src/components/permissions/` (dossier partagé — lecture seule).
- Toute route hors des 5 dossiers ci-dessus ; facades `src/lib/**` (CH-4, lead) ;
  `docs/LAYER_SPLIT.md` (mise à jour seulement à la fin, une section) ;
  `package.json` / config lint.
- `GUIDE_DECOUPAGE_COUCHES.md` est cité par les deux docs mais **absent** du dépôt
  → à signaler au lead (recette inline en PLAN §6).

---

## 4. Cartographie décisions restantes dans les routes (état mesuré)

| Bloc | Route(s) | Décision à exporter vers service |
|---|---|---|
| ~~a~~ | ~~`access-profiles/route.js`~~ | **fait** → `services/authorization/accessProfileWrites.js` (`normalizeCapabilities`, gate désactivation, `assertCapsEligibleForProfile`, `replaceProfileCapabilities`, `assertProfileDeletable`) ; filet `access-profile-decisions.test.js` |
| ~~b~~ | ~~`access-profiles/assign/route.js`~~ | **fait** → `services/authorization/profileAssignment.js` (`isSelfAssignment`, `assertAssignmentEligible`, `evaluateCapabilityLoss`, `resolveRemovalFallback`) ; filet `access-profile-assign-decisions.test.js` |
| ~~c~~ | ~~`responsibilities/assign/route.js`~~ | **fait** → `services/authorization/responsibilityAssignment.js` (`isSelfResponsibilityChange`, `grantBaseAccessForResponsibility`, `revokeBaseAccessForResponsibility`, `formatBaseAccessNote`) ; filet `responsibility-assign-decisions.test.js` |
| ~~d~~ | ~~`responsibilities/route.js`~~ + ~~`access/route.js`~~ | **fait** → `services/authorization/responsibilityCatalog.js` (`presentResponsibilityFields`, `resolveAllowedRolesValue`) ; filet `responsibility-catalog-decisions.test.js` |
| ~~e~~ | ~~`org-membership/route.js`~~ | **fait** → `services/authorization/membershipQueries.js` (`buildMembershipFilter`, `resolveProtectedGroupFlags`, `resolveMembershipOperation`, `parseMembershipExpiry`) + **`getProtectedGroupFlags` (N+1 → 1 statement)** ; filet `org-membership-queries-decisions.test.js` |
| ~~f~~ | ~~`engineering/permissions/eligibility/route.js`~~ | **fait** → `services/authorization/eligibilityConfiguration.js` (`resolveCanConfigure`, `deriveExtraRoles`, `deriveEligibleGroupNames`, `selectTemplateImpactCandidates`, `foldImpactedTemplates`, `collectTemplateImpacts`, `resolveEligibilityWrite`, `formatEligibilityAuditDetails`) + **`getSession` hors de la boucle (N changements → 1 lecture)** ; filet `eligibility-queries-decisions.test.js` |
| ~~g~~ | ~~`venture-strict-audit/route.js`~~ | **fait** → `services/authorization/ventureStrictAudit.js` (`resolveAuditLimit`, `groupVenturesByCid`, `selectAuditedCids`, `buildSyntheticSession`, `probeVentureGate`, `countVentureScope`, `auditPerson`) + **`summarizeVentureStrictAudit` sortie du modèle** (décision pure, cf. `docs/LAYER_SPLIT.md`) ; filet `venture-strict-audit-decisions.test.js` |
| ~~h~~ | ~~`audit/route.js`~~ + ~~`context-roles/route.js`~~ | **fait** → `services/authorization/auditViewer.js` (`buildAuditFilters`, `resolveAuditPagination`) ; `countContextRoleHoldersBatch` (**N+1 → 1 statement**, repli fail-soft par paire) ; filets `block-h-audit-context-roles-decisions.test.js` + `context-role-holder-batch.test.js` |
| ~~i~~ | ~~`user-context/route.js`~~, ~~`context-grants-sweep/route.js`~~, ~~`sync-context-grants/route.js`~~ | **fait** → `services/authorization/userContextProjection.js` (`projectUserContext`, `toResolverIdentity`) + `services/authorization/scheduledSweeps.js` (`resolveSweepAuthorization`, `secretMatches`) ; ré-aiguillage des imports `contextGrants` vers le service (façade modèle conservée) ; filet `block-i-context-endpoints-decisions.test.js` |

Routes déjà fines (pattern de référence) : `engineering/permissions/route.js`
(permissionMatrix + permissionWrites), `impact`, `program-scope-readiness`,
`context-grant-readiness`, `seed`, `seed-access-profiles`.

### Split services (Phase 2)

- `context.js` → `contextBootstrap`, `capabilityMaps`, `contextResolution`,
  `contextCache`, `contextDecision`, `contextEvaluation` (facade total via
  `models/authorization/resolver.js` ; `server/authz/responses.js` inchangé).
- `contextGrants.js` → `contextGrantPlan` (pur), `contextGrantJustification`
  (+ `resolveContextDesiredCaps`), `contextGrantReconcile` (+ `revokeAllContextGrants`),
  `contextGrantSweep` (façade `models/authorization/contextGrants.js` totale —
  4 suites la mockent ; repointage de `contextGrantReadiness.js` ; correction du
  dynamic `import("./context")` → `contextCache`).

### B10 — découpe (Phase 3)

Shim `PermissionCenter.js` + sous `permission-center/` :
`PersonAccessScreen`, `PersonCapabilityGrid`, `PersonProfileOverrideCard`,
`ProfileTemplatesView`, `ProfileEditorPanels`, `ProfileRoleDefaultsModal`,
`ProfileSaveConfirmModal`, `ResponsibilitiesView`, `ResponsibilityAccessView`,
`EligibilityView`, `AccessExplanationPanel`, `AuditView`, `GovernanceView`,
`CapabilityWhyModal`, `shared/editableModules`.

---

## 5. Tests de comportement à écrire/étendre AVANT chaque déplacement

- `access-profile-guards.test.js` (DELETE gardes + assign 409) — étendre.
- `security-lot8-scope-selfassign.test.js` (SoD) — couvre déjà les deux assign.
- `org-membership-api.test.js` (lifecycle + groupes protégés) — étendre.
- `governance-audit-api.test.js` (audit SQL) — repointe si SQL bouge.
- `phase4-context-roles.test.js`, `ui4-contexts.test.js` — étendre.
- `services-boundaries.test.js`, `db-sequencing.test.js` (≤3 waves),
  `db-roundtrip-budget.test.js` (responsibilities GET ≤25/1 warm) — garder verts.
- B10 : suites `ui1-permission-shell`, `ui2-people`, `ui2-profiles`,
  `ui3-followups`, `ui3-governance-audit`, `ui3-responsive` (2× `hidden md:block` +
  commentaire « Small screens » dans PermissionCenter.js), `ui4-contexts`,
  `ui7-access-clarity`, `access-profile-cleanup-ui` — assercent sur le **texte**
  de `PermissionCenter.js` → à repointersur les nouveaux fichiers.

---

## 6. Log du chantier (à remplir au fil des étapes)

| Étape | Fichiers ajoutés/modifiés | Tests | Vert ? |
|---|---|---|---|
| Phase 0 : branche + baseline + ce doc | `docs/PERMISSION_CORRIDOR.md` | 3552 tests, eslint 0 err, build ✓ | ✅ |
| P1 : barillet +4 modules | `services/authorization/index.js` (additif : accessProfiles, permissionMatrix, permissionWrites, listingScope) | services-boundaries, authz-boundaries, authorization-resolver, permissions-admin-api : 567 ✓ | ✅ eslint 0, build ✓ |
| P1 : extractions a–i | routes + services + tests | | |
| ~~P2 : split context.js~~ | **fait** → `capabilityMerge.js`, `contextBootstrap.js`, `contextResolver.js`, `contextCache.js`, `contextDecisions.js`, `contextAccess.js` ; `context.js` devient façade (36 l.) ; filet `block-p2-context-module-decisions.test.js` (42 tests) | authorization-resolver + block-p2 : 154 ✓ | ✅ 255 suites / 3892, eslint 0, build ✓ |
| ~~P2 : split contextGrants.js~~ | **fait** → `contextGrantPlan.js` (pur), `contextGrantJustification.js`, `contextGrantCache.js`, `contextGrantReconcile.js`, `contextGrantSweep.js`, `contextGrantOnConnect.js`, `contextGrantRevoke.js` ; `contextGrants.js` devient façade (47 l.) ; filet `block-p2b-context-grants-decisions.test.js` (22 tests) | phase6 + program-assignment + block-p2b : 61 ✓ ; +14 tests auto par services-boundaries (2/fichier service) | ✅ 256 suites / 3928, eslint 0, build ✓ |
| P3 (3/3) : `AccessProfilesView` (1 419 l.) + `shared/buildEditableModules.js` ; shim **3 340 → 1 897 l.** ; 4 suites repointées, 19 pins vacants détectés puis corrigés | 257 suites / 3932 ✓ | ✅ eslint 0 err / 5 warnings, build ✓, garde d'intégrité verte |
| P3 (2/3) : `EligibilityView` extraite (595 l.) ; shim **3 940 → 3 340 l.** ; commentaire orphelin rattaché | 256 suites / 3928 ✓ | ✅ eslint 0 err / 5 warnings, build ✓, garde `ui4-contexts` repointée + canari |
| P3 (1/3) : 4 vues extraites | `permission-center/ResponsibilitiesView.js` (332), `ResponsibilityAccessView.js` (245), `AccessExplanationPanel.js` (118), `CapabilityWhyModal.js` (236) ; shim 4 884 → **3 940 l.** ; 5 icônes + 5 imports orphelins retirés | 256 suites / 3928 ✓ | ✅ eslint 0 err / 5 warnings (= baseline), build ✓ |
| P4 : LAYER_SPLIT + rebase | docs/LAYER_SPLIT.md | | |