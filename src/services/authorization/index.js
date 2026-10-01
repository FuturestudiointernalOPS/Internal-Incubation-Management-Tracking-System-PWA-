/**
 * services/authorization — the authorization SERVICE layer.
 *
 * The decision surface for the permission system: it reads through
 * `@/models/authorization/*` (the repository layer) and decides, but never runs
 * SQL itself and never renders anything.
 *
 *   context.js — resolve a person's effective access, and answer "may they?"
 *   contextGrantReadiness.js — the read-only readiness/impact report an
 *                              administrator consults before narrowing access
 *   resourceGuards.js — the decisions behind the project/program-guard helpers
 *                              (`@/server/authz/guards` maps them to responses)
 *   contextGrants.js — the context-role grants that a person's assignment seeds
 *   accessProfiles.js / permissionMatrix.js / permissionWrites.js — the access
 *                              profiles a person resolves through, and the
 *                              decision to grant/revoke a capability
 *   listingScope.js — which venues a listing (tasks, projects) may show
 *
 * Who imports it:
 *   - endpoints (controllers) call `requireAuthorization` at the top of a handler
 *   - other services/components call `can` / `getAuthorizationContext`
 *
 * Compatibility: `src/models/authorization/resolver.js` and
 * `src/lib/authorization/resolver.js` re-export this module verbatim, so older
 * import paths and the suites that mock them keep working. New code imports
 * from here.
 */

export * from "./context";
export * from "./contextGrants";
export * from "./contextGrantReadiness";
export * from "./eligibility";
export * from "./eligibilityAdmin";
export * from "./membership";
export * from "./programAssignments";
export * from "./programScopeReadiness";
export * from "./scope";
export * from "./scopedAccess";
export * from "./resourceGuards";
export * from "./accessProfiles";
export * from "./permissionMatrix";
export * from "./permissionWrites";
export * from "./listingScope";
