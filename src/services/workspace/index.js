/**
 * services/workspace — the workspace SERVICE layer.
 *
 * Use-case and decision code for the cross-cutting workspace surfaces. It reads
 * and writes through `@/models/**` (the repository layer) and never runs SQL
 * itself (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   calendar.js — the personal-calendar Venture session source
 */

export * from "./calendar";
