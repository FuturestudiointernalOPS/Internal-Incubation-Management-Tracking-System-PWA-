/**
 * models/authorization — bootstrap.
 *
 * What a fresh (or partially migrated) environment needs before anything else
 * works, in two halves:
 *
 *   SELF-HEAL — creates the authorization and responsibility tables and columns
 *   on first use, so a database that has not run the migrations yet does not
 *   500 the permission screens. Every statement is idempotent, and each heal
 *   runs ONCE per process: it is dozens of statements called from request paths.
 *
 *   DEFAULT GRANTS — the catalogue every environment starts from: role
 *   capabilities, the named Access Profiles with their capability templates and
 *   role bindings, and the responsibilities catalogue. All upserts, so running
 *   them again is a no-op.
 *
 * Both memos clear themselves on failure: a transient database error must be
 * retried on the next call, never cached as "done".
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/authorization/bootstrap/` folder (the split convention: `x.js` + `x/`):
 *
 *   schema.js           — the runtime schema self-heal (responsibilities + authz)
 *   roleDefaults.js     — the seeded role capabilities and named Access Profiles
 *   responsibilities.js — the default responsibilities catalogue
 *
 * Importers keep the same path (`@/models/authorization/bootstrap`).
 */

export * from "./bootstrap/schema";
export * from "./bootstrap/roleDefaults";
export * from "./bootstrap/responsibilities";
