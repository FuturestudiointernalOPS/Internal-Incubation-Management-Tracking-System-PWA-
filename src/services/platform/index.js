/**
 * services/platform — the platform SERVICE layer.
 *
 * Use-case and decision code for the platform AI surfaces. It reads and writes
 * through `@/models/**` (the repository layer) and never runs SQL itself
 * (enforced by `src/__tests__/server/services-boundaries.test.js`).
 *
 *   report.js — composing a Run's AI report from its Output Instruction and
 *               attached reference document
 */

export * from "./report";
