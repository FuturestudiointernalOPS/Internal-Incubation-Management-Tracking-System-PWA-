// ─────────────────────────────────────────────────────────────────────────────
// FACADE — src/lib/auth.js is no longer where any of this is implemented.
//
//   AUTHENTICATION  → @/server/auth             (session, cookies, password, guards)
//   AUTHORIZATION   → @/server/authz            (capabilities, program access, guards)
//                     @/models/authorization     (the SQL behind them)
//
// Both halves are re-exported below so the ~250 importers that read them from
// here keep working unchanged; new code imports the real home.
//
// What is still IMPLEMENTED here is the last six functions: the effective
// access-profile resolution and the responsibilities domain. They are held back
// on purpose — each has a second, parallel implementation over the same tables
// (models/authorization.js, models/responsibilities.js), and merging them would
// change behaviour. Once that is arbitrated they move too, and this file goes.
// ─────────────────────────────────────────────────────────────────────────────
export {
  SESSION_COOKIE_NAME,
  setSessionCookieOnResponse,
} from "@/server/auth/cookies";
export { createSession, getSession, destroySession } from "@/server/auth/session";
export { requireSession, requireAuth } from "@/server/auth/guards";

export {
  PERMISSION_MODULES,
  ACCESS_LEVELS,
  FACILITATOR_BYPASS_ROLES,
  hasProgramManagementAccess,
} from "@/server/authz/capabilities";
export {
  resolveProgramAssignment,
  getFacilitatorPermissionLevel,
} from "@/server/authz/programAccess";
export {
  requireProjectAccess,
  requireProgramFacilitator,
  enforceFacilitatorProgramAccess,
  requireAssignmentAccess,
  assertNoParticipantFacilitatorConflict,
} from "@/server/authz/guards";
// Authorization reads and the audit write used to be defined here; they now sit
// in the model and are re-exported so the public surface of this module only
// ever grows.
export {
  getProgramFacilitatorAssignment,
  getProgramAssignment,
  getAssignmentStatus,
  getUserGroups,
  logPermissionAudit,
  isAssignedPmForProgram,
  hasAnyFacilitatorAssignment,
  getFacilitatorTeamScope,
  isSupervisorOf,
} from "@/models/authorization/accessQueries";
// The runtime schema self-heal and the default grants (role capabilities,
// Access Profiles, the responsibilities catalogue) are model code now.
export {
  seedDefaultRoleCapabilities,
  seedDefaultAccessProfiles,
  ensureResponsibilitiesSchema,
  ensurePermissionsSchema,
  seedDefaultResponsibilities,
} from "@/models/authorization/bootstrap";

// The effective access-profile resolution and the responsibilities domain used
// to be implemented here; they were relocated (NOT merged with the parallel
// implementations) to the authorization service and are re-exported so the
// public surface only ever grows.
export {
  getUserEffectiveProfile,
  getAccessProfileCapabilities,
  getUserResponsibilities,
  assignResponsibility,
  removeResponsibility,
  getAllResponsibilities,
} from "@/services/authorization/accessProfiles";
