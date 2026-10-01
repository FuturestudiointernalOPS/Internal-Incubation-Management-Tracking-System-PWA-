/**
 * services/finance — the finance SERVICE layer.
 *
 * Use-case and decision code for the finance domain. It reads and writes
 * through `@/models/finance/**` (the repository layer) and never runs SQL
 * itself (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   ingest.js  — parse the Google Sheets and orchestrate the all-or-nothing sync
 *   queries.js — resolve the data source, aggregate and shape the finance reads
 */

export * from "./ingest";
export * from "./queries";
