/**
 * services/investor — the investor-portal SERVICE layer.
 *
 * Use-case and decision code for the investor surfaces. It reads and writes
 * through `@/models/investor` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   diligence.js — the due-diligence workspace and its action dispatch
 *   campaigns.js — the fundraising campaigns (scope, matching, milestones)
 */

export * from "./diligence";
export * from "./campaigns";
