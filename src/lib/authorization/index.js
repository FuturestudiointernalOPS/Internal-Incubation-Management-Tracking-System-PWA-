/**
 * ImpactOS — Authorization Foundation (Phase 0)
 *
 * Canonical entry point for the new
 * IDENTITY → ELIGIBILITY → CAPABILITY → EFFECTIVE ACCESS model.
 *
 * Phase 0 is ADDITIVE: no feature route enforces these yet. Existing
 * V1/V2/role gates keep working untouched.
 */

export {
  authorize,
  can,
  getAuthorizationContext,
  invalidateAuthorizationContext,
  invalidateAllAuthorizationContexts,
  requireAuthorization,
  resolveAuthorizationContext,
  mergeEffectiveCapabilities,
  effectivePermissionsFromContext,
  buildPermissionExplanation,
  rowsToCaps,
  rowsToRestrictions,
} from "./resolver";

export {
  evaluateEligibility,
  ensureEligibilitySchema,
  seedDefaultEligibility,
  MODULE_TO_FEATURE,
  FEATURE_ELIGIBILITY_DEFAULTS,
} from "./eligibility";

export { runAuthzMigration } from "./migrations";

export {
  requireScopedAccess,
  resolveContextAssignment,
  CONTEXT_RESOURCES,
} from "./context";

export {
  FEATURE_KEYS,
  IDENTITY_TYPES,
  ROLE_CATALOG,
  ELIGIBILITY_IDENTITIES,
  validateEligibilityChanges,
  validateCapabilitiesWithinEligibility,
  assertTemplateCapsEligible,
} from "./eligibility-admin";
