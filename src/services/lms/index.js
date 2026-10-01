/**
 * services/lms — the LMS SERVICE layer.
 *
 * Use-case and decision code for the LMS domain. It reads and writes through
 * `@/models/lms/**` (the repository layer) and never runs SQL itself (enforced by
 * `src/__tests__/server/services-boundaries.test.js`).
 *
 *   learning.js — the learner experience: progress, completion, access,
 *                 assessment submission and certificate finalisation
 *   checkout.js — the paid-course checkout: price resolution, registration
 *                 capture, access grant and the one-time access/resume links
 *   coaching.js — the learner coaching-request queue (create, staff decision,
 *                 cancel) and its notification fan-out
 */

export * from "./learning";
export * from "./checkout";
export * from "./coaching";
