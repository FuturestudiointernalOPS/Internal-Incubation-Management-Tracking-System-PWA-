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
 *
 * The SQL behind all of it lives in @/models/authorization/accessQueries.
 * New code imports from here; @/lib/auth re-exports the same symbols for the
 * importers that predate the split.
 */

export * from "./capabilities";
export * from "./programAccess";
export * from "./guards";
