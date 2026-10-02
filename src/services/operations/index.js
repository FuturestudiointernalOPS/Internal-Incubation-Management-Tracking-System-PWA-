/**
 * services/operations — the INTERNAL OPERATIONS service layer.
 *
 * Use-case and decision code for the internal-operations surfaces that are not
 * tied to a project or a task workflow: attendance and facilitator reviews. It
 * reads and writes through `@/models/**` and never runs SQL itself (enforced by
 * `src/__tests__/server/services-boundaries.test.js`).
 *
 *   attendance.js          — the write plan (program/team scope, ±1 day window,
 *                            idempotent upsert) and the read scope (facilitator
 *                            team filter, summary/list)
 *   facilitatorReviews.js  — the review read scope, the submit assembly (with
 *                            the respond-to-changes branch) and the PM decision
 */

export * from "./attendance";
export * from "./facilitatorReviews";
