/**
 * Forms & submissions model — submission/response data access.
 *
 * This file is a thin BARREL over cohesive modules in the sibling
 * `models/forms/submissions/` folder (the split convention: `x.js` + `x/`):
 *
 *   statusReads.js — program/participant status gates, team-scope check and the
 *                    submission review detail read
 *   migrations.js  — the idempotent additive-column guards
 *   writes.js      — versioning, creation, review decisions, follow-ups,
 *                    notifications, team propagation and score writers
 *   listing.js     — the filtered submission list (latest-version mode)
 *   responses.js   — campaign/form-response reads and the manual match writes
 *
 * Each function wraps exactly one SQL statement. SQL is byte-identical to the
 * queries that used to live inline in the controllers, so behavior is unchanged.
 * Importers keep the same path (`@/models/forms`).
 *
 * Model-layer rules (see docs/MVC_REFACTOR.md):
 *  - No HTTP / Next.js imports here — only the db engine (in the modules).
 *  - One function per query, named after the data it returns.
 */

export * from "./submissions/statusReads";
export * from "./submissions/migrations";
export * from "./submissions/writes";
export * from "./submissions/listing";
export * from "./submissions/responses";
