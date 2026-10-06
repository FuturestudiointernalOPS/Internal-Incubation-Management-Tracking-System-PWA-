/**
 * server/authz — the authorization layer.
 *
 * Answers "may this caller do this, to this?" It depends on the authentication
 * layer — an identity must exist before a permission can be asked about — and
 * never the other way around.
 *
 *   capabilities.js  — the permission vocabulary (pure data and predicates)
 *   programAccess.js — which assignment does this person hold in this program,
 *                      and at which level
 *   guards.js        — the 401/403/404/409 answers routes return as-is
 *   responses.js     — turns an authorization decision into that response
 *                      (the only place a service decision meets HTTP)
 *
 * The SQL behind all of it lives in @/models/authorization/accessQueries.
 * New code imports from here; the old `@/lib/auth` facade was removed once every
 * importer was repointed to this layer.
 */

export * from "./capabilities";
export * from "./programAccess";
export * from "./guards";
export * from "./responses";
