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
  resolveAuthorizationContext,
  mergeEffectiveCapabilities,
  effectivePermissionsFromContext,
  buildPermissionExplanation,
  rowsToCaps,
  rowsToRestrictions,
  restrictionsToJson,
} from "@/services/authorization/context";

export {
  ensureEligibilitySchema,
  seedDefaultEligibility,
  MODULE_TO_FEATURE,
  FEATURE_ELIGIBILITY_DEFAULTS,
  FEATURE_ELIGIBILITY_PROFILE_DEFAULTS,
  FEATURE_ORDER,
} from "./eligibility";

// The eligibility DECISION lives in the service layer; re-exported here so this
// barrel keeps the surface it always had.
export { evaluateEligibility } from "@/services/authorization/eligibility";

export { runAuthzMigration } from "./migrations";

export { resolveContextAssignment } from "@/services/authorization/scopedAccess";

// The HTTP boundary: the authorization DECISIONS come from the service layer,
// and are turned into the 401/403 responses routes return as-is here. Moving
// this out of the services is what keeps every service free of `next/server`.
export {
  requireAuthorization,
  requireScopedAccess,
} from "@/server/authz/responses";

export {
  FEATURE_KEYS,
  IDENTITY_TYPES,
  ROLE_CATALOG,
  ELIGIBILITY_IDENTITIES,
  BASELINE_IDENTITIES,
  CONTEXT_ROLES,
  ELIGIBILITY_IDENTITY_GROUPS,
  validateEligibilityChanges,
  validateCapabilitiesWithinEligibility,
  assertTemplateCapsEligible,
  findTemplatesGrantingFeature,
} from "@/services/authorization/eligibilityAdmin";
