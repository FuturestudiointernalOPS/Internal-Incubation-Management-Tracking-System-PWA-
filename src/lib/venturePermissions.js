/**
 * COMPATIBILITY FACADE — the Venture permission engine moved to the service.
 *
 * This module evaluated capability against the matrix and ran its SQL in the
 * same functions. The decisions (the seed corrections, the scope match, the
 * capability answer) and the taxonomy now live in
 * `@/services/ventures/permissions`; every statement in
 * `@/models/venturePermissionStore`.
 *
 * Re-exported unchanged so existing importers keep working (the permission
 * admin routes, the assignment routes and the suites). New code imports the
 * decisions from the service. Deleted once `grep` finds no importer — see
 * docs/LAYER_SPLIT.md.
 */

export {
  VENTURE_PERMISSION_AREAS,
  VENTURE_PERMISSION_ACTIONS,
  VENTURE_SCOPE_TYPES,
  correctSeedDefaults,
  seedVenturePermissions,
  listResponsibilities,
  listScopeTypes,
  getResponsibility,
  getGlobalMatrix,
  setMatrixCell,
  listAssignments,
  createAssignment,
  removeAssignment,
  hasVentureCapability,
  hasAnyVentureAssignment,
} from "@/services/ventures/permissions";
