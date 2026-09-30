/**
 * services/programs — the programs SERVICE layer.
 *
 * Use-case and decision code for the programs domain. It reads and writes
 * through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   kpiProgress.js — objective (KPI) progress: the rate and the cache policy
 */

export * from "./kpiProgress";
