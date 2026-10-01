/**
 * services/participant — the participant-portal SERVICE layer.
 *
 * Use-case and decision code for the participant-facing portal. It reads and
 * writes through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   assignments.js — the submission assignments and their version history
 *   home.js        — the participant home dashboard (metrics, action centre,
 *                    calendar)
 */

export * from "./assignments";
export * from "./home";
