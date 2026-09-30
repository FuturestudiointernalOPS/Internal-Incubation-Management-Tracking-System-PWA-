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
export * from "./contextGrantReadiness";
export * from "./eligibility";
export * from "./membership";
export * from "./scope";
